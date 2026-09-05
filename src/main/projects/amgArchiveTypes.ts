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

export type ArchiveReadHandle = {
  read(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<{ readonly bytesRead: number }>;
};
