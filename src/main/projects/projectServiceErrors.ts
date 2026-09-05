import { z } from "zod";
import { AmgContractError } from "../../shared/projects/amgContract";
import {
  parseRecentProjectId,
  type ProjectOperationError,
  type ProjectSessionId,
  type RendererGeneration,
  type WorkspaceGeneration,
} from "../../shared/projects/projectIpcContract";
import type { ProjectPortabilityOffender } from "../../shared/projects/projectPortability";
import { AmgArchiveReaderError } from "./amgArchiveReader";
import { AmgArchiveWriterError } from "./amgArchiveWriter";
import { ArchivePathError } from "./archivePath";
import { AtomicWriteError } from "./atomicFile";
import { LegacyProjectValidationError } from "./legacyJsonProject";
import {
  InvalidRecentProjectIdError,
  UnknownRecentProjectError,
} from "./recentProjects";
import { SessionStateError } from "./projectSession";
import { ProjectServiceFileError } from "./projectServiceFiles";

export class ProjectServicePortabilityError extends Error {
  readonly name = "ProjectServicePortabilityError";

  constructor(readonly offenders: readonly ProjectPortabilityOffender[]) {
    super("project contains references that cannot be bundled");
  }
}

export class ProjectServiceTargetError extends Error {
  readonly name = "ProjectServiceTargetError";

  constructor(message: string) {
    super(message);
  }
}

export type ProjectErrorContext = {
  readonly expectedSessionId?: ProjectSessionId | null;
  readonly activeSessionId?: ProjectSessionId;
  readonly expectedRendererGeneration?: RendererGeneration;
  readonly actualRendererGeneration?: RendererGeneration;
  readonly expectedWorkspaceGeneration?: WorkspaceGeneration;
  readonly actualWorkspaceGeneration?: WorkspaceGeneration;
};

const archiveError = (error: AmgArchiveReaderError): ProjectOperationError => {
  if (error.code === "limit-exceeded") {
    return { code: "ARCHIVE_LIMIT_EXCEEDED", message: error.message };
  }
  if (error.code === "integrity") {
    return { code: "ARCHIVE_INTEGRITY_FAILED", message: error.message };
  }
  return { code: "ARCHIVE_INVALID", message: error.message };
};

export const mapProjectOperationError = (
  error: unknown,
  context: ProjectErrorContext = {},
): ProjectOperationError => {
  if (error instanceof ProjectServicePortabilityError) {
    return {
      code: "PROJECT_NOT_PORTABLE",
      message: error.message,
      offenders: error.offenders.map(({ code, location }) => `${location}:${code}`),
    };
  }
  if (error instanceof SessionStateError) {
    if (
      (error.code === "stale-session" || error.code === "inactive")
      && "expectedSessionId" in context
      && context.activeSessionId !== context.expectedSessionId
    ) {
      return {
        code: "STALE_SESSION",
        expectedSessionId: context.expectedSessionId ?? null,
        ...(context.activeSessionId === undefined ? {} : { activeSessionId: context.activeSessionId }),
      };
    }
    if (
      error.code === "generation"
      && context.expectedRendererGeneration !== undefined
      && context.actualRendererGeneration !== undefined
    ) {
      return {
        code: "STALE_RENDERER_GENERATION",
        expected: context.expectedRendererGeneration,
        actual: context.actualRendererGeneration,
      };
    }
    if (
      error.code === "workspace-generation"
      && context.expectedWorkspaceGeneration !== undefined
      && context.actualWorkspaceGeneration !== undefined
    ) {
      return {
        code: "STALE_WORKSPACE_GENERATION",
        expected: context.expectedWorkspaceGeneration,
        actual: context.actualWorkspaceGeneration,
      };
    }
    return { code: "INTERNAL", message: error.message };
  }
  if (error instanceof UnknownRecentProjectError) {
    return { code: "RECENT_NOT_FOUND", recentId: parseRecentProjectId(error.id) };
  }
  if (error instanceof InvalidRecentProjectIdError || error instanceof z.ZodError) {
    return { code: "PATH_AUTHORITY_FORBIDDEN", message: "renderer path authority is forbidden" };
  }
  if (error instanceof ProjectServiceTargetError) {
    return { code: "PATH_AUTHORITY_FORBIDDEN", message: error.message };
  }
  if (error instanceof AmgArchiveReaderError) return archiveError(error);
  if (error instanceof AmgArchiveWriterError) {
    return error.code === "capacity"
      ? { code: "ARCHIVE_LIMIT_EXCEEDED", message: error.message }
      : { code: "ARCHIVE_INVALID", message: error.message };
  }
  if (
    error instanceof AmgContractError
    || error instanceof LegacyProjectValidationError
    || error instanceof ArchivePathError
    || error instanceof ProjectServiceFileError
  ) {
    return { code: "ARCHIVE_INVALID", message: error.message };
  }
  if (error instanceof AtomicWriteError) {
    return { code: "INTERNAL", message: error.message };
  }
  if (error instanceof Error) {
    return { code: "INTERNAL", message: error.message };
  }
  return { code: "INTERNAL", message: "unknown project persistence failure" };
};
