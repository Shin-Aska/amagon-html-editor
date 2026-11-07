import path from "node:path";
import { canonicalizePortablePath } from "../../shared/projects/assetReference";
import type { BatchRepairResult } from "../../shared/projects/assetMaintenanceContract";
import { repairMissingAsset } from "./repairMissingAsset";

/** Match full asset suffixes first; basename fallback requires uniqueness on both sides. */
export function matchRepairFiles(
  targets: readonly string[],
  sources: readonly string[],
): Map<string, string> {
  const sourceNames = new Map<string, string[]>();
  const targetNames = new Map<string, number>();
  const suffixes = new Map<string, string[]>();
  const append = (
    index: Map<string, string[]>,
    key: string,
    source: string,
  ): void => {
    const bucket = index.get(key);
    if (bucket) bucket.push(source);
    else index.set(key, [source]);
  };
  for (const source of new Set(sources)) {
    const normalized = source.replace(/\\/gu, "/");
    const name = path.posix.basename(normalized);
    append(sourceNames, name, source);
    const parts = normalized.split("/");
    for (let index = 0; index < parts.length; index++) {
      const suffix = parts.slice(index).join("/");
      append(suffixes, suffix, source);
    }
  }
  for (const target of targets) {
    const name = path.posix.basename(target);
    targetNames.set(name, (targetNames.get(name) ?? 0) + 1);
  }
  const matches = new Map<string, string>();
  for (const target of targets) {
    const shortened = target.slice("assets/".length);
    const exact =
      suffixes.get(target) ??
      (shortened.includes("/") ? suffixes.get(shortened) : undefined);
    const basename = path.posix.basename(target);
    const options =
      exact ??
      (targetNames.get(basename) === 1 ? sourceNames.get(basename) : undefined);
    if (options?.length === 1 && options[0]) matches.set(target, options[0]);
  }
  return matches;
}

export async function batchRepairAssets(
  workspace: string,
  targets: readonly string[],
  sources: readonly string[],
): Promise<BatchRepairResult> {
  const canonical = [
    ...new Set(targets.map((target) => canonicalizePortablePath(target))),
  ];
  if (canonical.some((target) => !target.startsWith("assets/")))
    throw new TypeError("Only project assets can be repaired");
  const matches = matchRepairFiles(canonical, sources);
  const repaired: string[] = [];
  const failed: string[] = [];
  for (const [target, source] of matches) {
    try {
      await repairMissingAsset(workspace, target, source);
      repaired.push(target);
    } catch (error) {
      failed.push(
        `${target}: ${error instanceof Error ? error.message : "Could not copy replacement"}`,
      );
    }
  }
  return {
    repaired,
    failed,
    unmatched: canonical.filter((target) => !matches.has(target)),
  };
}
