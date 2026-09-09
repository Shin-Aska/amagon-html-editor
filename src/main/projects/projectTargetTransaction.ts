import { randomUUID } from "node:crypto";
import { rename, unlink } from "node:fs/promises";

export interface ProjectTargetTransaction {
  readonly commit: () => Promise<void>;
  readonly rollback: () => Promise<void>;
}

export type ProjectTargetFileSystem = {
  readonly rename: typeof rename;
  readonly unlink: typeof unlink;
};

export class ProjectTargetRollbackError extends Error {
  readonly name = "ProjectTargetRollbackError";

  constructor(
    readonly originalError: unknown,
    readonly rollbackErrors: readonly Error[],
  ) {
    super("project target rollback was incomplete");
  }
}

const isMissing = (error: unknown): boolean => (
  error instanceof Error && "code" in error && error.code === "ENOENT"
);

const unlinkIfPresent = async (
  filePath: string,
  fileSystem: ProjectTargetFileSystem,
): Promise<void> => {
  try {
    await fileSystem.unlink(filePath);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
};

export const beginProjectTargetTransaction = async (
  targetPath: string,
  fileSystem: ProjectTargetFileSystem = { rename, unlink },
  createId: () => string = randomUUID,
): Promise<ProjectTargetTransaction> => {
  const backupPath = `${targetPath}.${createId()}.amagon-rollback`;
  let hadPriorTarget = true;
  try {
    await fileSystem.rename(targetPath, backupPath);
  } catch (error) {
    if (!isMissing(error)) throw error;
    hadPriorTarget = false;
  }
  let finished = false;
  return {
    commit: async () => {
      if (finished) return;
      if (hadPriorTarget) await unlinkIfPresent(backupPath, fileSystem);
      finished = true;
    },
    rollback: async () => {
      if (finished) return;
      await unlinkIfPresent(targetPath, fileSystem);
      if (hadPriorTarget) await fileSystem.rename(backupPath, targetPath);
      finished = true;
    },
  };
};

export const rollbackProjectTarget = async (
  transaction: ProjectTargetTransaction,
  originalError: unknown,
  cleanup: readonly (() => Promise<void>)[],
): Promise<never> => {
  const rollbackErrors: Error[] = [];
  try {
    await transaction.rollback();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    rollbackErrors.push(error);
  }
  for (const operation of cleanup) {
    try {
      await operation();
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      rollbackErrors.push(error);
    }
  }
  if (rollbackErrors.length > 0) {
    throw new ProjectTargetRollbackError(originalError, rollbackErrors);
  }
  throw originalError;
};
