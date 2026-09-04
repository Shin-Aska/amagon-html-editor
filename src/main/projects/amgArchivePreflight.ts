import { AMG_FIXED_LIMITS } from "../../shared/projects/amgContract";
import {
  centralDirectoryRecordLength,
  parseCentralDirectoryRecord,
} from "./amgArchiveCentralDirectory";
import { AmgArchiveReaderError } from "./amgArchiveReaderError";

const EOCD = 0x06054b50;
const ZIP64_EOCD = 0x06064b50;
const ZIP64_LOCATOR = 0x07064b50;
const LOCAL = 0x04034b50;
const MAX_TAIL = 65_557;

export type PreflightEntry = {
  readonly filename: string;
  readonly localOffset: number;
  readonly dataOffset: number;
  readonly dataEnd: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly compressionMethod: number;
  readonly flags: number;
  readonly crc32: number;
};

export type ArchivePreflight = {
  readonly fileSize: number;
  readonly entries: readonly PreflightEntry[];
};

export type ArchiveReadHandle = {
  read(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<{ readonly bytesRead: number }>;
};

export type ArchivePreflightFileHandle = ArchiveReadHandle & {
  stat(): Promise<{ readonly size: number; isFile(): boolean }>;
};

const invalid = (message: string): never => {
  throw new AmgArchiveReaderError("invalid-archive", message);
};

export async function readExactly(
  archive: ArchiveReadHandle,
  position: number,
  length: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(position) || !Number.isSafeInteger(length) || position < 0 || length < 0) {
    invalid("archive requested an unsafe positional range");
  }
  if (length > AMG_FIXED_LIMITS.streamChunkBytes) {
    throw new AmgArchiveReaderError("limit-exceeded", "archive read exceeds the stream chunk limit");
  }
  const bytes = new Uint8Array(length);
  let read = 0;
  while (read < length) {
    const requestBytes = Math.min(AMG_FIXED_LIMITS.streamChunkBytes, length - read);
    const result = await archive.read(bytes, read, requestBytes, position + read);
    if (result.bytesRead === 0) invalid("archive ended inside a ZIP record");
    read += result.bytesRead;
  }
  return bytes;
}

async function readCentralDirectory(
  archive: ArchiveReadHandle,
  directory: { readonly offset: number; readonly size: number; readonly count: number },
): Promise<readonly PreflightEntry[]> {
  const end = directory.offset + directory.size;
  const entries: PreflightEntry[] = [];
  let position = directory.offset;
  while (position < end) {
    const fixed = await readExactly(archive, position, 46);
    const recordLength = centralDirectoryRecordLength(fixed);
    if (position + recordLength > end) invalid("central directory record exceeds its range");
    const record = recordLength === fixed.byteLength
      ? fixed
      : await readExactly(archive, position, recordLength);
    entries.push(parseCentralDirectoryRecord(record));
    position += recordLength;
  }
  if (position !== end || entries.length !== directory.count) {
    invalid("central directory entry count disagrees");
  }
  return entries;
}

function safeUint64(view: DataView, offset: number): number {
  const value = view.getBigUint64(offset, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) invalid("ZIP64 integer is unsafe");
  return Number(value);
}

function findEocd(tail: Uint8Array, tailOffset: number): number {
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  for (let index = tail.byteLength - 22; index >= 0; index -= 1) {
    if (
      view.getUint32(index, true) === EOCD &&
      index + 22 + view.getUint16(index + 20, true) === tail.byteLength
    ) {
      return tailOffset + index;
    }
  }
  return invalid("end of central directory was not found");
}

async function readDirectoryLocation(
  archive: ArchiveReadHandle,
  fileSize: number,
): Promise<{ readonly offset: number; readonly size: number; readonly count: number }> {
  const tailSize = Math.min(fileSize, MAX_TAIL);
  const tailOffset = fileSize - tailSize;
  const tail = await readExactly(archive, tailOffset, tailSize);
  const eocdOffset = findEocd(tail, tailOffset);
  const eocd = new DataView(tail.buffer, tail.byteOffset + eocdOffset - tailOffset, 22);
  const classicCount = eocd.getUint16(10, true);
  if (eocd.getUint16(8, true) !== classicCount) invalid("split entry counts disagree");
  const classicSize = eocd.getUint32(12, true);
  const classicOffset = eocd.getUint32(16, true);
  const needsZip64 = classicCount === 0xffff || classicSize === 0xffffffff || classicOffset === 0xffffffff;
  if (!needsZip64) {
    if (eocd.getUint16(4, true) !== 0 || eocd.getUint16(6, true) !== 0) {
      invalid("multi-disk ZIP archives are forbidden");
    }
    if (!Number.isSafeInteger(classicOffset + classicSize) || classicOffset + classicSize !== eocdOffset) {
      invalid("central directory range is ambiguous");
    }
    return { offset: classicOffset, size: classicSize, count: classicCount };
  }
  const diskNumber = eocd.getUint16(4, true);
  const directoryDisk = eocd.getUint16(6, true);
  if ((diskNumber !== 0 && diskNumber !== 0xffff) || (directoryDisk !== 0 && directoryDisk !== 0xffff)) {
    invalid("multi-disk ZIP archives are forbidden");
  }
  if (eocdOffset < 20) invalid("ZIP64 locator is missing");
  const locatorBytes = await readExactly(archive, eocdOffset - 20, 20);
  const locator = new DataView(locatorBytes.buffer, locatorBytes.byteOffset, 20);
  if (locator.getUint32(0, true) !== ZIP64_LOCATOR) invalid("ZIP64 locator is missing");
  if (locator.getUint32(4, true) !== 0 || locator.getUint32(16, true) !== 1) {
    invalid("multi-disk ZIP64 archives are forbidden");
  }
  const zip64Offset = safeUint64(locator, 8);
  const fixed = await readExactly(archive, zip64Offset, 56);
  const zip64 = new DataView(fixed.buffer, fixed.byteOffset, fixed.byteLength);
  if (zip64.getUint32(0, true) !== ZIP64_EOCD) invalid("ZIP64 end record is missing");
  const recordSize = safeUint64(zip64, 4);
  if (recordSize < 44 || zip64Offset + 12 + recordSize !== eocdOffset - 20) {
    invalid("ZIP64 end record range is invalid");
  }
  if (zip64.getUint32(16, true) !== 0 || zip64.getUint32(20, true) !== 0) {
    invalid("multi-disk ZIP64 archives are forbidden");
  }
  const diskCount = safeUint64(zip64, 24);
  const count = safeUint64(zip64, 32);
  if (diskCount !== count) invalid("ZIP64 entry counts disagree");
  const size = safeUint64(zip64, 40);
  const offset = safeUint64(zip64, 48);
  if (!Number.isSafeInteger(offset + size) || offset + size !== zip64Offset) {
    invalid("ZIP64 central directory range is ambiguous");
  }
  return { offset, size, count };
}

function zip64Fields(
  extra: Uint8Array,
  needs: readonly boolean[],
): readonly number[] {
  const view = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
  let cursor = 0;
  while (cursor + 4 <= extra.byteLength) {
    const type = view.getUint16(cursor, true);
    const length = view.getUint16(cursor + 2, true);
    const start = cursor + 4;
    if (start + length > extra.byteLength) invalid("extra field range is invalid");
    if (type === 1) {
      const values: number[] = [];
      let valueOffset = start;
      for (const needed of needs) {
        if (!needed) continue;
        if (valueOffset + 8 > start + length) invalid("ZIP64 extra field is incomplete");
        values.push(safeUint64(view, valueOffset));
        valueOffset += 8;
      }
      return values;
    }
    cursor = start + length;
  }
  return invalid("ZIP64 extra field is missing");
}

function decodeFilename(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    if (error instanceof TypeError) invalid("entry filename is not valid UTF-8");
    throw error;
  }
}

async function verifyLocal(
  archive: ArchiveReadHandle,
  entry: PreflightEntry,
  directoryOffset: number,
): Promise<PreflightEntry> {
  const fixed = await readExactly(archive, entry.localOffset, 30);
  const view = new DataView(fixed.buffer, fixed.byteOffset, fixed.byteLength);
  if (view.getUint32(0, true) !== LOCAL) invalid("local file header is missing");
  const nameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const variable = await readExactly(archive, entry.localOffset + 30, nameLength + extraLength);
  if (decodeFilename(variable.subarray(0, nameLength)) !== entry.filename) invalid("local filename disagrees");
  if (view.getUint16(6, true) !== entry.flags || view.getUint16(8, true) !== entry.compressionMethod) {
    invalid("local header features disagree");
  }
  if ((entry.flags & 8) === 0) {
    const compressed32 = view.getUint32(18, true);
    const uncompressed32 = view.getUint32(22, true);
    const needs = [uncompressed32 === 0xffffffff, compressed32 === 0xffffffff];
    const extra = variable.subarray(nameLength);
    const values = needs.some(Boolean) ? zip64Fields(extra, needs) : [];
    let valueIndex = 0;
    const uncompressed = needs[0] ? values[valueIndex++] : uncompressed32;
    const compressed = needs[1] ? values[valueIndex] : compressed32;
    if (
      view.getUint32(14, true) !== entry.crc32 ||
      uncompressed !== entry.uncompressedSize ||
      compressed !== entry.compressedSize
    ) {
      invalid("local header CRC or sizes disagree");
    }
  }
  const dataOffset = entry.localOffset + 30 + nameLength + extraLength;
  const dataEnd = dataOffset + entry.compressedSize;
  if (!Number.isSafeInteger(dataOffset) || !Number.isSafeInteger(dataEnd) || dataEnd > directoryOffset) {
    invalid("entry data range exceeds the local-file area");
  }
  return { ...entry, dataOffset, dataEnd };
}

export async function preflightAmgArchive(archive: ArchivePreflightFileHandle): Promise<ArchivePreflight> {
  const stats = await archive.stat();
  const fileSize = stats.size;
  if (!stats.isFile() || !Number.isSafeInteger(fileSize) || fileSize < 0) {
    invalid("archive handle is not a safe regular file");
  }
  if (fileSize > AMG_FIXED_LIMITS.archiveBytes) throw new AmgArchiveReaderError("limit-exceeded", "archive byte limit exceeded");
  const directory = await readDirectoryLocation(archive, fileSize);
  if (directory.count > AMG_FIXED_LIMITS.totalZipEntries) throw new AmgArchiveReaderError("limit-exceeded", "entry count limit exceeded");
  if (directory.size > AMG_FIXED_LIMITS.centralDirectoryBytes) throw new AmgArchiveReaderError("limit-exceeded", "central directory byte limit exceeded");
  if (
    directory.offset < 0 ||
    !Number.isSafeInteger(directory.offset + directory.size) ||
    directory.offset + directory.size > fileSize
  ) {
    invalid("central directory is outside the archive");
  }
  const central = await readCentralDirectory(archive, directory);
  const entries: PreflightEntry[] = [];
  for (const entry of central) entries.push(await verifyLocal(archive, entry, directory.offset));
  const sorted = [...entries].sort((left, right) => left.localOffset - right.localOffset);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous && current && current.localOffset < previous.dataEnd) invalid("local entry ranges overlap");
  }
  return { fileSize, entries };
}
