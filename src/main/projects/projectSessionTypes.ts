import type { ParsedRuntimeAssetUrl } from "../../shared/projects/assetReference";
import type { ProjectReadLease } from "./projectSessionConcurrency";

export type ProjectSessionKind = "none" | "legacy-json" | "amg";
export type ProjectSessionState = "active" | "closing" | "closed";
export type WorkspaceOwnership = "app" | "user";

export class SessionStateError extends Error {
  readonly name = "SessionStateError";

  constructor(
    readonly code: "no-session" | "stale-session" | "inactive" | "generation" | "workspace-generation",
    message: string,
  ) {
    super(message);
  }
}

export type SessionGenerations = {
  readonly renderer: number;
  readonly committedRenderer: number;
  readonly workspace: number;
  readonly committedWorkspace: number;
};

export type GenerationCommit = {
  readonly rendererGeneration: number;
  readonly workspaceGeneration: number;
};

export type ActiveProjectSessionOptions = {
  readonly sourcePath: string;
  readonly workspacePath: string;
};

export type SessionAssetRead = ParsedRuntimeAssetUrl & {
  readonly filePath: string;
  readonly lease: ProjectReadLease;
};
