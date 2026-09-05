import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { canonicalizePortablePath } from "../../shared/projects/assetReference";

export class MutationPathError extends Error {
  readonly name = "MutationPathError";

  constructor(
    readonly code: "outside-root" | "reparse",
    message: string,
    readonly originalError?: unknown,
  ) {
    super(message);
  }
}

const isMissing = (error: unknown): boolean => (
  error instanceof Error && "code" in error && error.code === "ENOENT"
);

const assertContained = (rootPath: string, candidatePath: string): void => {
  const relative = path.relative(rootPath, candidatePath);
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new MutationPathError("reparse", "project mutation path escapes through a symbolic link or junction");
  }
};

export const resolveMutationPath = async (
  workspacePath: string,
  relativePath: string,
): Promise<string> => {
  const canonical = canonicalizePortablePath(relativePath);
  const root = path.resolve(workspacePath);
  const resolved = path.resolve(root, ...canonical.split("/"));
  const lexicalRelative = path.relative(root, resolved);
  if (
    lexicalRelative.length === 0
    || lexicalRelative.startsWith(`..${path.sep}`)
    || path.isAbsolute(lexicalRelative)
  ) {
    throw new MutationPathError("outside-root", "project mutation path must resolve beneath its workspace");
  }

  const rootRealPath = await realpath(root);
  let candidate = root;
  for (const segment of canonical.split("/")) {
    candidate = path.join(candidate, segment);
    try {
      const stats = await lstat(candidate);
      if (stats.isSymbolicLink()) {
        throw new MutationPathError("reparse", "project mutation path crosses a symbolic link or junction");
      }
      assertContained(rootRealPath, await realpath(candidate));
    } catch (error) {
      if (isMissing(error)) break;
      throw error;
    }
  }
  return resolved;
};
