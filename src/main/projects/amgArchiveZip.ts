import { createHash } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import {
  Reader,
  ZipReader,
} from "@zip.js/zip.js";
import type { Entry, FileEntry } from "@zip.js/zip.js";
import type { FileHandle } from "node:fs/promises";
import { AMG_FIXED_LIMITS } from "../../shared/projects/amgContract";
import {
  ArchivePathError,
  canonicalizeArchivePath,
  createArchivePathIndex,
  resolveArchivePath,
} from "./archivePath";
import type { ArchivePreflight } from "./amgArchivePreflight";
import { AmgArchiveReaderError } from "./amgArchiveReaderError";

class FileHandleReader extends Reader<FileHandle> {
  readonly handle: FileHandle;

  constructor(handle: FileHandle, size: number) {
    super(handle);
    this.handle = handle;
    this.size = size;
  }

  override async readUint8Array(index: number, length: number): Promise<Uint8Array> {
    if (!Number.isSafeInteger(index) || !Number.isSafeInteger(length) || index < 0 || length < 0) {
      throw new AmgArchiveReaderError("invalid-archive", "zip.js requested an invalid byte range");
    }
    const boundedLength = Math.min(length, Math.max(0, this.size - index));
    const bytes = new Uint8Array(boundedLength);
    let read = 0;
    while (read < boundedLength) {
      const result = await this.handle.read(bytes, read, boundedLength - read, index + read);
      if (result.bytesRead === 0) {
        throw new AmgArchiveReaderError("invalid-archive", "archive ended during positional read");
      }
      read += result.bytesRead;
    }
    return bytes;
  }
}

export type OpenedAmgZip = {
  readonly reader: ZipReader<FileHandle>;
  readonly entries: ReadonlyMap<string, FileEntry>;
};

function validateEntry(entry: Entry): asserts entry is FileEntry {
  if (entry.directory || entry.symlink) {
    throw new AmgArchiveReaderError("unsupported-feature", "directory and link entries are forbidden");
  }
  if (entry.encrypted || entry.diskNumberStart !== 0) {
    throw new AmgArchiveReaderError("unsupported-feature", "encrypted and split entries are forbidden");
  }
  if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
    throw new AmgArchiveReaderError("unsupported-feature", "compression method is forbidden");
  }
  if (entry.filename !== canonicalizeArchivePath(entry.filename)) {
    throw new AmgArchiveReaderError("unsafe-entry", "entry path is not canonical");
  }
}

export async function openValidatedZip(
  archive: FileHandle,
  preflight: ArchivePreflight,
): Promise<OpenedAmgZip> {
  const reader = new ZipReader(new FileHandleReader(archive, preflight.fileSize), {
    strictness: "strict",
    filenameValidation: "strict",
    checkOverlappingEntry: true,
  });
  const listed: FileEntry[] = [];
  try {
    for await (const entry of reader.getEntriesGenerator({
      strictness: "strict",
      filenameValidation: "strict",
    })) {
      if (listed.length >= AMG_FIXED_LIMITS.totalZipEntries) {
        throw new AmgArchiveReaderError("limit-exceeded", "entry count limit exceeded");
      }
      validateEntry(entry);
      const structural = preflight.entries[listed.length];
      if (
        structural === undefined ||
        structural.filename !== entry.filename ||
        structural.localOffset !== entry.offset ||
        structural.compressedSize !== entry.compressedSize ||
        structural.uncompressedSize !== entry.uncompressedSize ||
        structural.compressionMethod !== entry.compressionMethod
      ) {
        throw new AmgArchiveReaderError("invalid-archive", "zip.js metadata disagrees with positional preflight");
      }
      listed.push(entry);
    }
    if (listed.length !== preflight.entries.length) {
      throw new AmgArchiveReaderError("invalid-archive", "zip.js entry count disagrees with positional preflight");
    }
    createArchivePathIndex(listed.map((entry) => entry.filename));
    return { reader, entries: new Map(listed.map((entry) => [entry.filename, entry])) };
  } catch (error) {
    await reader.close();
    if (error instanceof AmgArchiveReaderError || error instanceof ArchivePathError) throw error;
    throw new AmgArchiveReaderError("invalid-archive", "zip.js rejected the archive", error);
  }
}

export async function readEntryBounded(
  entry: FileEntry,
  maximumBytes: number,
): Promise<Uint8Array> {
  if (entry.uncompressedSize > maximumBytes) {
    throw new AmgArchiveReaderError("limit-exceeded", "entry declared size exceeds its limit");
  }
  const chunks: Uint8Array[] = [];
  let actual = 0;
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      actual += chunk.byteLength;
      if (actual > maximumBytes) {
        throw new AmgArchiveReaderError("limit-exceeded", "entry output exceeds its limit");
      }
      chunks.push(chunk.slice());
    },
  });
  await entry.getData(writable, { checkOverlappingEntry: true, strictness: "strict" });
  const output = new Uint8Array(actual);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function writeEntryVerified(
  entry: FileEntry,
  workspacePath: string,
  expected: { readonly path: string; readonly bytes: number; readonly sha256: string },
  remainingBudget: number,
): Promise<number> {
  if (expected.bytes > remainingBudget || entry.uncompressedSize !== expected.bytes) {
    throw new AmgArchiveReaderError("limit-exceeded", "declared payload exceeds output budget");
  }
  const outputPath = resolveArchivePath(workspacePath, expected.path);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const output = await open(outputPath, "wx");
  const hash = createHash("sha256");
  let actual = 0;
  let position = 0;
  try {
    const writable = new WritableStream<Uint8Array>({
      async write(chunk) {
        actual += chunk.byteLength;
        if (actual > expected.bytes || actual > remainingBudget) {
          throw new AmgArchiveReaderError("limit-exceeded", "payload output exceeds declared size");
        }
        hash.update(chunk);
        let written = 0;
        while (written < chunk.byteLength) {
          const result = await output.write(chunk, written, chunk.byteLength - written, position + written);
          if (result.bytesWritten === 0) {
            throw new AmgArchiveReaderError("integrity", "payload write made no progress");
          }
          written += result.bytesWritten;
        }
        position += chunk.byteLength;
      },
    });
    await entry.getData(writable, { checkOverlappingEntry: true, strictness: "strict" });
    await output.sync();
  } finally {
    await output.close();
  }
  if (actual !== expected.bytes || hash.digest("hex") !== expected.sha256) {
    throw new AmgArchiveReaderError("integrity", "payload size or SHA-256 does not match manifest");
  }
  return actual;
}
