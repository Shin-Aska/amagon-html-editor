import { AMG_FIXED_LIMITS } from "../../shared/projects/amgContract";
import { AmgArchiveReaderError } from "./amgArchiveReaderError";
import type { ArchiveReadHandle } from "./amgArchiveTypes";

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
