import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import path from "node:path";
import { canonicalizePortablePath } from "../../shared/projects/assetReference";

export const inventoryWithHashes = async (
  workspacePath: string,
  relativePaths: readonly string[],
): Promise<readonly string[]> => {
  const inventory: string[] = [];
  for (const relativePath of relativePaths) {
    const filePath = path.join(workspacePath, ...canonicalizePortablePath(relativePath).split("/"));
    const handle = await open(filePath, "r");
    try {
      const stats = await handle.stat();
      const hash = createHash("sha256");
      let position = 0;
      while (position < stats.size) {
        const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, stats.size - position));
        const result = await handle.read(buffer, 0, buffer.byteLength, position);
        if (result.bytesRead === 0) break;
        hash.update(buffer.subarray(0, result.bytesRead));
        position += result.bytesRead;
      }
      inventory.push(`${relativePath}:${stats.size}:${hash.digest("hex")}`);
    } finally {
      await handle.close();
    }
  }
  return inventory;
};
