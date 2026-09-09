import { createHash } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { Reader } from "@zip.js/zip.js";
import type { FileHandle } from "node:fs/promises";
import { AMG_FIXED_LIMITS } from "../../shared/projects/amgContract";
import {
  createArchivePathIndex,
  resolveArchivePath,
} from "./archivePath";
import type { ArchivePreflight, PreflightEntry } from "./amgArchivePreflight";
import { AmgArchiveReaderError } from "./amgArchiveReaderError";

export type ArchiveFileReader = {
  read(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<{ readonly bytesRead: number }>;
};

export type ArchiveEntryDataSource = {
  readonly uncompressedSize: number;
  readonly compressionMethod: number;
  getData(writer: WritableStream<Uint8Array>): Promise<unknown>;
};

export class FileHandleReader extends Reader<ArchiveFileReader> {
  readonly handle: ArchiveFileReader;

  constructor(handle: ArchiveFileReader, size: number) {
    super(handle);
    this.handle = handle;
    this.size = size;
  }

  override async readUint8Array(index: number, length: number): Promise<Uint8Array> {
    if (!Number.isSafeInteger(index) || !Number.isSafeInteger(length) || index < 0 || length < 0) {
      throw new AmgArchiveReaderError("invalid-archive", "zip.js requested an invalid byte range");
    }
    if (length > AMG_FIXED_LIMITS.streamChunkBytes) {
      throw new AmgArchiveReaderError("limit-exceeded", "zip.js requested an oversized byte range");
    }
    const boundedLength = Math.min(length, Math.max(0, this.size - index));
    const bytes = new Uint8Array(boundedLength);
    let read = 0;
    while (read < boundedLength) {
      const requestBytes = Math.min(AMG_FIXED_LIMITS.streamChunkBytes, boundedLength - read);
      const result = await this.handle.read(bytes, read, requestBytes, index + read);
      if (result.bytesRead === 0) {
        throw new AmgArchiveReaderError("invalid-archive", "archive ended during positional read");
      }
      read += result.bytesRead;
    }
    return bytes;
  }
}

export type OpenedAmgZip = {
  readonly entries: ReadonlyMap<string, ArchiveEntryDataSource>;
};

function readEntryStream(archive: ArchiveFileReader, entry: PreflightEntry): ReadableStream<Uint8Array> {
  let position = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const remaining = entry.compressedSize - position;
      if (remaining === 0) {
        controller.close();
        return;
      }
      const bytes = new Uint8Array(Math.min(remaining, AMG_FIXED_LIMITS.streamChunkBytes));
      const result = await archive.read(bytes, 0, bytes.byteLength, entry.dataOffset + position);
      if (result.bytesRead <= 0 || result.bytesRead > bytes.byteLength) {
        controller.error(new AmgArchiveReaderError("invalid-archive", "archive ended during entry read"));
        return;
      }
      position += result.bytesRead;
      controller.enqueue(bytes.subarray(0, result.bytesRead));
    },
  });
}

function createEntryDataSource(archive: ArchiveFileReader, entry: PreflightEntry): ArchiveEntryDataSource {
  return {
    uncompressedSize: entry.uncompressedSize,
    compressionMethod: entry.compressionMethod,
    async getData(writer) {
      const source = readEntryStream(archive, entry);
      const decompressed = entry.compressionMethod === 8
        ? source
          .pipeThrough(new TransformStream<Uint8Array, ArrayBuffer>({
            transform(chunk, controller) {
              controller.enqueue(new Uint8Array(chunk).buffer);
            },
          }))
          .pipeThrough(new DecompressionStream("deflate-raw"))
        : source;
      await decompressed
        .pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            for (let offset = 0; offset < chunk.byteLength; offset += AMG_FIXED_LIMITS.streamChunkBytes) {
              controller.enqueue(chunk.slice(offset, offset + AMG_FIXED_LIMITS.streamChunkBytes));
            }
          },
        }))
        .pipeTo(writer);
    },
  };
}

export async function openValidatedZip(
  archive: FileHandle,
  preflight: ArchivePreflight,
): Promise<OpenedAmgZip> {
  createArchivePathIndex(preflight.entries.map((entry) => entry.filename));
  return {
    entries: new Map(preflight.entries.map((entry) => [entry.filename, createEntryDataSource(archive, entry)])),
  };
}

export async function readEntryBounded(
  entry: ArchiveEntryDataSource,
  maximumBytes: number,
): Promise<Uint8Array> {
  if (entry.uncompressedSize > maximumBytes) {
    throw new AmgArchiveReaderError("limit-exceeded", "entry declared size exceeds its limit");
  }
  const chunks: Uint8Array[] = [];
  let actual = 0;
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      if (chunk.byteLength > AMG_FIXED_LIMITS.streamChunkBytes) {
        throw new AmgArchiveReaderError("limit-exceeded", "entry stream chunk exceeds the limit");
      }
      actual += chunk.byteLength;
      if (actual > maximumBytes) {
        throw new AmgArchiveReaderError("limit-exceeded", "entry output exceeds its limit");
      }
      chunks.push(chunk.slice());
    },
  });
  await entry.getData(writable);
  const output = new Uint8Array(actual);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function writeEntryVerified(
  entry: ArchiveEntryDataSource,
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
        if (chunk.byteLength > AMG_FIXED_LIMITS.streamChunkBytes) {
          throw new AmgArchiveReaderError("limit-exceeded", "payload stream chunk exceeds the limit");
        }
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
    await entry.getData(writable);
    await output.sync();
  } finally {
    await output.close();
  }
  if (actual !== expected.bytes || hash.digest("hex") !== expected.sha256) {
    throw new AmgArchiveReaderError("integrity", "payload size or SHA-256 does not match manifest");
  }
  return actual;
}
