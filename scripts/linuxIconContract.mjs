import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';

export const LINUX_ICON_SIZES = [16, 22, 24, 32, 48, 64, 96, 128, 192, 256, 512, 1024, 2048];
export function pngSize(bytes) {
  assert(bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Expected a PNG icon');
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}
export function verifyIconSet(directory) {
  for (const size of LINUX_ICON_SIZES) {
    const file = path.join(directory, `${size}x${size}.png`);
    assert.deepEqual(pngSize(readFileSync(file)), {width: size, height: size}, `Icon must be square and match its advertised size: ${file}`);
  }
}
