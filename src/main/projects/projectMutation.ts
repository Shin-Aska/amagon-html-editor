import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, open, rename, rm } from "node:fs/promises";
import path from "node:path";
import {
  parseProjectSessionId,
  parseWorkspaceGeneration,
  type MutationResult,
  type ProjectSessionId,
} from "../../shared/projects/projectIpcContract";
import { canonicalizePortablePath } from "../../shared/projects/assetReference";
import { resolveMutationPath } from "./mutationPath";
import { SessionStateError, type ProjectSessionRegistry } from "./projectSession";

export type ProjectMutationContext = {
  readonly sessions: ProjectSessionRegistry;
  readonly expectedSessionId: ProjectSessionId;
  readonly listInventory: () => Promise<readonly string[]>;
};

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

export class MutationRollbackError extends Error {
  readonly name = "MutationRollbackError";

  constructor(
    readonly completedItems: readonly string[],
    readonly failedItems: readonly string[],
    message: string,
  ) {
    super(message);
  }
}

const sameInventory = (left: readonly string[], right: readonly string[]): boolean => (
  left.length === right.length && left.every((item, index) => item === right[index])
);

export const runProjectMutation = async <T>(
  context: ProjectMutationContext,
  mutate: () => Promise<T>,
): Promise<MutationResult<T>> => {
  try {
    return await context.sessions.runMutation(
      context.expectedSessionId,
      async () => {
        const before = await context.listInventory();
        try {
          const value = await mutate();
          const after = await context.listInventory();
          const changed = !sameInventory(before, after);
          const generation = changed
            ? context.sessions.active.recordWorkspaceMutation(context.expectedSessionId)
            : context.sessions.active.generations.workspace;
          return {
            success: true,
            sessionId: parseProjectSessionId(context.expectedSessionId),
            workspaceGeneration: parseWorkspaceGeneration(generation),
            changed,
            value,
          };
        } catch (error) {
          const after = await context.listInventory();
          const changed = !sameInventory(before, after);
          const generation = changed
            ? context.sessions.active.recordWorkspaceMutation(context.expectedSessionId)
            : context.sessions.active.generations.workspace;
          const base = {
            success: false as const,
            sessionId: parseProjectSessionId(context.expectedSessionId),
            workspaceGeneration: parseWorkspaceGeneration(generation),
            changed,
          };
          if (changed) {
            const details = error instanceof MutationRollbackError
              ? error
              : new MutationRollbackError([], [], error instanceof Error ? error.message : "project mutation failed");
            return {
              ...base,
              changed: true,
              error: {
                code: "PARTIAL_MUTATION" as const,
                message: details.message,
                completedItems: details.completedItems,
                failedItems: details.failedItems,
              },
            };
          }
          return {
            ...base,
            changed: false,
            error: {
              code: "INTERNAL" as const,
              message: error instanceof Error ? error.message : "project mutation failed",
            },
          };
        }
      },
    );
  } catch (error) {
    const active = context.sessions.active;
    const sameSession = active.id === context.expectedSessionId;
    return {
      success: false,
      sessionId: context.expectedSessionId,
      workspaceGeneration: parseWorkspaceGeneration(sameSession ? active.generations.workspace : 0),
      changed: false,
      error: error instanceof SessionStateError && error.code === "stale-session"
        ? {
            code: "STALE_SESSION",
            expectedSessionId: context.expectedSessionId,
            ...(active.id === null ? {} : { activeSessionId: parseProjectSessionId(active.id) }),
          }
        : {
            code: "INTERNAL",
            message: error instanceof Error ? error.message : "project mutation failed",
          },
    };
  }
};

export type ImportedFile = {
  readonly sourcePath: string;
  readonly fileName: string;
  readonly relativePath: string;
  readonly destinationPath: string;
};

export type AtomicCopyOperations = {
  readonly promote: typeof rename;
  readonly remove: typeof rm;
};

export const copyFilesAtomically = async (
  workspacePath: string,
  relativeDirectory: string,
  sourcePaths: readonly string[],
  operations: AtomicCopyOperations = { promote: rename, remove: rm },
): Promise<readonly ImportedFile[]> => {
  const portableDirectory = canonicalizePortablePath(relativeDirectory);
  if (!portableDirectory.startsWith("assets")) throw new TypeError("imports must target the assets directory");
  const destinationDirectory = await resolveMutationPath(workspacePath, portableDirectory);
  await mkdir(destinationDirectory, { recursive: true });
  await resolveMutationPath(workspacePath, portableDirectory);
  const used = new Set<string>();
  const staged: Array<ImportedFile & { readonly partialPath: string; readonly partialRelativePath: string }> = [];
  const promoted: ImportedFile[] = [];
  try {
    for (const sourcePath of sourcePaths) {
      const original = path.basename(sourcePath);
      const extension = path.extname(original);
      const base = path.basename(original, extension);
      let fileName = original;
      let counter = 1;
      while (used.has(fileName) || await open(await resolveMutationPath(workspacePath, `${portableDirectory}/${fileName}`), "r").then(
        async (handle) => { await handle.close(); return true; },
        (error: unknown) => {
          if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
          throw error;
        },
      )) {
        fileName = `${base}-${counter}${extension}`;
        counter += 1;
      }
      used.add(fileName);
      const relativePath = canonicalizePortablePath(`${portableDirectory}/${fileName}`);
      const destinationPath = await resolveMutationPath(workspacePath, relativePath);
      const partialRelativePath = `${relativePath}.amagon-partial-${randomUUID()}`;
      const partialPath = await resolveMutationPath(workspacePath, partialRelativePath);
      await copyFile(sourcePath, partialPath, constants.COPYFILE_EXCL);
      const handle = await open(await resolveMutationPath(workspacePath, partialRelativePath), "r+");
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
      staged.push({
        sourcePath,
        fileName,
        relativePath,
        destinationPath,
        partialPath,
        partialRelativePath,
      });
    }
    for (const item of staged) {
      await resolveMutationPath(workspacePath, item.partialRelativePath);
      await resolveMutationPath(workspacePath, item.relativePath);
      await operations.promote(item.partialPath, item.destinationPath);
      promoted.push(item);
    }
    return promoted;
  } catch (error) {
    const cleanupFailures: string[] = [];
    for (const item of staged) {
      await resolveMutationPath(workspacePath, item.partialRelativePath).then(
        (safePath) => operations.remove(safePath, { force: true }),
      ).catch((cleanupError: unknown) => {
        cleanupFailures.push(cleanupError instanceof Error ? cleanupError.message : item.partialPath);
      });
    }
    for (const item of promoted) {
      await resolveMutationPath(workspacePath, item.relativePath).then(
        (safePath) => operations.remove(safePath, { force: true }),
      ).catch((cleanupError: unknown) => {
        cleanupFailures.push(cleanupError instanceof Error ? cleanupError.message : item.destinationPath);
      });
    }
    if (cleanupFailures.length > 0) {
      throw new MutationRollbackError(
        promoted.map((item) => item.relativePath),
        cleanupFailures,
        "project import failed and rollback was incomplete",
      );
    }
    throw error;
  }
};

export const runFileCopyMutation = <T>(
  context: ProjectMutationContext,
  workspacePath: string,
  relativeDirectory: string,
  sourcePaths: readonly string[],
  mapFiles: (files: readonly ImportedFile[]) => T,
  operations?: AtomicCopyOperations,
): Promise<MutationResult<T>> => runProjectMutation(context, async () => mapFiles(
  await copyFilesAtomically(workspacePath, relativeDirectory, sourcePaths, operations),
));
