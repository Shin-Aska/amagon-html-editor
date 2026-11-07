import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, link, mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import { canonicalizePortablePath } from "../../shared/projects/assetReference";
import { resolveMutationPath } from "./mutationPath";

/** Fill an absent asset without replacing an existing file or following workspace links. */
export async function repairMissingAsset(
  workspace: string,
  relativePath: string,
  source: string,
): Promise<void> {
  const canonical = canonicalizePortablePath(relativePath);
  if (!canonical.startsWith("assets/"))
    throw new TypeError("Only missing project assets can be repaired");
  const target = await resolveMutationPath(workspace, canonical);
  const directory = path.posix.dirname(canonical);
  await mkdir(await resolveMutationPath(workspace, directory), {
    recursive: true,
  });
  await resolveMutationPath(workspace, directory);
  const partialReference = `${canonical}.amagon-partial-${randomUUID()}`;
  const partial = await resolveMutationPath(workspace, partialReference);
  await copyFile(source, partial, constants.COPYFILE_EXCL);
  try {
    const handle = await open(partial, "r+");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await resolveMutationPath(workspace, canonical);
    // A hard link promotes complete bytes exclusively, including on Windows.
    await link(await resolveMutationPath(workspace, partialReference), target);
  } finally {
    await rm(await resolveMutationPath(workspace, partialReference), {
      force: true,
    });
  }
}
