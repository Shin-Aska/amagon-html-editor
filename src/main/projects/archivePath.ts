import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import {
  AssetReferenceError,
  canonicalizePortablePath,
} from "../../shared/projects/assetReference";

export class ArchivePathError extends Error {
  readonly name = "ArchivePathError";

  constructor(
    readonly code:
      | "invalid"
      | "collision"
      | "outside-root"
      | "reparse"
      | "not-file",
    message: string,
    readonly originalError?: unknown,
  ) {
    super(message);
  }
}

export function canonicalizeArchivePath(input: string): string {
  try {
    return canonicalizePortablePath(input);
  } catch (error) {
    if (error instanceof AssetReferenceError) {
      throw new ArchivePathError("invalid", error.message, error);
    }
    throw error;
  }
}

export function createArchivePathIndex(
  paths: readonly string[],
): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const input of paths) {
    const canonical = canonicalizeArchivePath(input);
    // Locale-independent upper/lower closure expands multi-code-point folds and merges contextual forms before NFC comparison.
    const portableKey = canonical.toUpperCase().toLowerCase().normalize("NFC");
    if (index.has(portableKey)) {
      throw new ArchivePathError(
        "collision",
        `archive path collides with ${canonical}`,
      );
    }
    index.set(portableKey, canonical);
  }
  return index;
}

export function resolveArchivePath(
  rootPath: string,
  archivePath: string,
): string {
  const canonical = canonicalizeArchivePath(archivePath);
  const root = path.resolve(rootPath);
  const resolved = path.resolve(root, ...canonical.split("/"));
  const relative = path.relative(root, resolved);
  if (
    relative.length === 0 ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new ArchivePathError(
      "outside-root",
      "archive path does not resolve beneath its root",
    );
  }
  return resolved;
}

export async function resolveExistingArchiveFile(
  rootPath: string,
  archivePath: string,
): Promise<string> {
  const resolved = resolveArchivePath(rootPath, archivePath);
  const root = path.resolve(rootPath);
  const rootRealPath = await realpath(root);
  const segments = canonicalizeArchivePath(archivePath).split("/");
  let candidate = root;
  for (const segment of segments) {
    candidate = path.join(candidate, segment);
    const stats = await lstat(candidate);
    if (stats.isSymbolicLink()) {
      throw new ArchivePathError(
        "reparse",
        "archive path crosses a symbolic link or junction",
      );
    }
  }
  const resolvedRealPath = await realpath(resolved);
  const relative = path.relative(rootRealPath, resolvedRealPath);
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new ArchivePathError(
      "reparse",
      "archive path escapes through a reparse point",
    );
  }
  const stats = await lstat(resolved);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new ArchivePathError(
      "not-file",
      "archive path is not a regular file",
    );
  }
  return resolved;
}
