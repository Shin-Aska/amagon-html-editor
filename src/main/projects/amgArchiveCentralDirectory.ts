import type { PreflightEntry } from "./amgArchivePreflight";
import { AmgArchiveReaderError } from "./amgArchiveReaderError";

const CENTRAL = 0x02014b50;

const invalid = (message: string): never => {
  throw new AmgArchiveReaderError("invalid-archive", message);
};

function safeUint64(view: DataView, offset: number): number {
  const value = view.getBigUint64(offset, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) invalid("ZIP64 integer is unsafe");
  return Number(value);
}

function zip64Fields(extra: Uint8Array, needs: readonly boolean[]): readonly number[] {
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

export function parseCentralDirectory(
  directory: Uint8Array,
  expectedCount: number,
): readonly PreflightEntry[] {
  const entries: PreflightEntry[] = [];
  let cursor = 0;
  while (cursor < directory.byteLength) {
    const end = cursor + centralDirectoryRecordLength(directory.subarray(cursor));
    if (end > directory.byteLength) invalid("central directory record exceeds its range");
    entries.push(parseCentralDirectoryRecord(directory.subarray(cursor, end)));
    cursor = end;
  }
  if (entries.length !== expectedCount) invalid("central directory entry count disagrees");
  return entries;
}

export function centralDirectoryRecordLength(record: Uint8Array): number {
  if (record.byteLength < 46) invalid("central directory record is invalid");
  const view = new DataView(record.buffer, record.byteOffset, record.byteLength);
  if (view.getUint32(0, true) !== CENTRAL) invalid("central directory record is invalid");
  return 46 + view.getUint16(28, true) + view.getUint16(30, true) + view.getUint16(32, true);
}

export function parseCentralDirectoryRecord(record: Uint8Array): PreflightEntry {
  const length = centralDirectoryRecordLength(record);
  if (length !== record.byteLength) invalid("central directory record has trailing bytes");
  const view = new DataView(record.buffer, record.byteOffset, record.byteLength);
  const nameLength = view.getUint16(28, true);
  const extraLength = view.getUint16(30, true);
  const compressed32 = view.getUint32(20, true);
  const uncompressed32 = view.getUint32(24, true);
  const local32 = view.getUint32(42, true);
  const disk32 = view.getUint16(34, true);
  const needs = [uncompressed32 === 0xffffffff, compressed32 === 0xffffffff, local32 === 0xffffffff, disk32 === 0xffff];
  const values = needs.some(Boolean)
    ? zip64Fields(record.subarray(46 + nameLength, 46 + nameLength + extraLength), needs)
    : [];
  let valueIndex = 0;
  const take = (fallback: number, needed: boolean): number => needed ? values[valueIndex++] ?? invalid("ZIP64 value is missing") : fallback;
  const uncompressedSize = take(uncompressed32, needs[0] ?? false);
  const compressedSize = take(compressed32, needs[1] ?? false);
  const localOffset = take(local32, needs[2] ?? false);
  if (take(disk32, needs[3] ?? false) !== 0) invalid("entry starts on a different disk");
  const flags = view.getUint16(8, true);
  const compressionMethod = view.getUint16(10, true);
  const external = view.getUint32(38, true);
  const unixType = (external >>> 16) & 0xf000;
  const filename = decodeFilename(record.subarray(46, 46 + nameLength));
  if ((flags & 1) !== 0 || (flags & 0x40) !== 0) invalid("encrypted entries are forbidden");
  if (compressionMethod !== 0 && compressionMethod !== 8) invalid("compression method is forbidden");
  if (filename.endsWith("/") || (external & 0x10) !== 0 || (unixType !== 0 && unixType !== 0x8000)) {
    invalid("non-regular ZIP entries are forbidden");
  }
  return {
    filename,
    localOffset,
    dataOffset: 0,
    dataEnd: 0,
    compressedSize,
    uncompressedSize,
    compressionMethod,
    flags,
    crc32: view.getUint32(16, true),
  };
}
