import { ZipWriter } from "@zip.js/zip.js";
import type { ZipWriterAddDataOptions, ZipWriterCloseOptions } from "@zip.js/zip.js";

export interface AmgZipWriter {
  add(filename: string, source: ReadableStream<Uint8Array>, options: ZipWriterAddDataOptions): Promise<void>;
  close(comment: Uint8Array | undefined, options: ZipWriterCloseOptions): Promise<void>;
}

export type AmgZipWriterFactory = (writable: WritableStream<Uint8Array>) => AmgZipWriter;

const FIXED_DATE = new Date("1980-01-01T00:00:00.000Z");

export function amgArchiveEntryOptions(
  compression: "store" | "deflate",
  uncompressedSize: number,
): ZipWriterAddDataOptions {
  return {
    zip64: true,
    compressionMethod: compression === "store" ? 0 : 8,
    level: compression === "store" ? 0 : 6,
    uncompressedSize,
    bufferedWrite: false,
    dataDescriptor: true,
    extendedTimestamp: false,
    lastModDate: FIXED_DATE,
    useWebWorkers: false,
  };
}

export const defaultAmgZipWriterFactory: AmgZipWriterFactory = (writable) => {
  const zip = new ZipWriter(writable, { bufferedWrite: false, keepOrder: true, useWebWorkers: false });
  return {
    async add(filename, source, options) { await zip.add(filename, source, options); },
    async close(comment, options) { await zip.close(comment, options); },
  };
};
