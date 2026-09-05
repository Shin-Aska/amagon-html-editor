import { randomBytes } from "node:crypto";
import {
  parseRuntimeAssetUrl,
  type ParsedRuntimeAssetUrl,
} from "../../shared/projects/assetReference";
import type {
  ProjectSessionId,
  RendererGeneration,
  WorkspaceGeneration,
} from "../../shared/projects/projectIpcContract";
import { resolveExistingArchiveFile } from "./archivePath";

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

export type ProjectReadLease = {
  readonly release: () => void;
};

export type SessionAssetRead = ParsedRuntimeAssetUrl & {
  readonly filePath: string;
  readonly lease: ProjectReadLease;
};

export class ProjectSession {
  readonly id: string | null;
  readonly sourcePath: string | null;
  readonly workspacePath: string | null;
  readonly ownership: WorkspaceOwnership | null;
  private lifecycleState: ProjectSessionState;
  private rendererGeneration = 0;
  private committedRendererGeneration = 0;
  private workspaceGeneration = 0;
  private committedWorkspaceGeneration = 0;
  private mutationTail: Promise<void> = Promise.resolve();
  private readLeaseCount = 0;
  private readonly leaseDrainWaiters = new Set<() => void>();

  private constructor(
    readonly kind: ProjectSessionKind,
    options?: ActiveProjectSessionOptions,
  ) {
    this.id = kind === "none" ? null : randomBytes(24).toString("base64url");
    this.sourcePath = options?.sourcePath ?? null;
    this.workspacePath = options?.workspacePath ?? null;
    this.ownership = kind === "none" ? null : kind === "amg" ? "app" : "user";
    this.lifecycleState = kind === "none" ? "closed" : "active";
  }

  static createNone(): ProjectSession {
    return new ProjectSession("none");
  }

  static createLegacyJson(
    options: ActiveProjectSessionOptions,
  ): ProjectSession {
    return new ProjectSession("legacy-json", options);
  }

  static createAmg(options: ActiveProjectSessionOptions): ProjectSession {
    return new ProjectSession("amg", options);
  }

  get state(): ProjectSessionState {
    return this.lifecycleState;
  }

  get generations(): SessionGenerations {
    return {
      renderer: this.rendererGeneration,
      committedRenderer: this.committedRendererGeneration,
      workspace: this.workspaceGeneration,
      committedWorkspace: this.committedWorkspaceGeneration,
    };
  }

  get isDirty(): boolean {
    return (
      this.rendererGeneration !== this.committedRendererGeneration ||
      this.workspaceGeneration !== this.committedWorkspaceGeneration
    );
  }

  get activeReadLeaseCount(): number {
    return this.readLeaseCount;
  }

  assertTransition(
    expectedSessionId: ProjectSessionId,
    rendererGeneration: RendererGeneration,
    workspaceGeneration: WorkspaceGeneration,
  ): void {
    this.assertActive(expectedSessionId);
    if (rendererGeneration < this.rendererGeneration) {
      throw new SessionStateError(
        "generation",
        "renderer generation is stale",
      );
    }
    if (workspaceGeneration !== this.workspaceGeneration) {
      throw new SessionStateError(
        "workspace-generation",
        "workspace generation is stale",
      );
    }
  }

  runMutation<T>(
    expectedSessionId: string | null,
    task: () => Promise<T> | T,
  ): Promise<T> {
    this.assertActive(expectedSessionId);
    const result = this.mutationTail.then(() => {
      this.assertActive(expectedSessionId);
      return task();
    });
    this.mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  acquireReadLease(expectedSessionId: string | null): ProjectReadLease {
    this.assertActive(expectedSessionId);
    this.readLeaseCount += 1;
    let active = true;
    return {
      release: () => {
        if (!active) return;
        active = false;
        this.readLeaseCount -= 1;
        if (this.readLeaseCount === 0) {
          for (const resolve of this.leaseDrainWaiters) resolve();
          this.leaseDrainWaiters.clear();
        }
      },
    };
  }

  waitForReadLeases(): Promise<void> {
    if (this.readLeaseCount === 0) return Promise.resolve();
    return new Promise((resolve) => this.leaseDrainWaiters.add(resolve));
  }

  beginClosing(): void {
    if (this.lifecycleState === "active") this.lifecycleState = "closing";
  }

  close(): void {
    if (this.readLeaseCount !== 0) {
      throw new SessionStateError(
        "inactive",
        "cannot close a session with active read leases",
      );
    }
    this.lifecycleState = "closed";
  }

  updateRendererGeneration(
    expectedSessionId: string | null,
    generation: number,
  ): void {
    this.assertActive(expectedSessionId);
    if (
      !Number.isSafeInteger(generation) ||
      generation < this.rendererGeneration
    ) {
      throw new SessionStateError(
        "generation",
        "renderer generation must be monotonic",
      );
    }
    this.rendererGeneration = generation;
  }

  recordWorkspaceMutation(expectedSessionId: string | null): number {
    this.assertActive(expectedSessionId);
    this.workspaceGeneration += 1;
    return this.workspaceGeneration;
  }

  commitGenerations(
    expectedSessionId: string | null,
    commit: GenerationCommit,
  ): void {
    this.assertActive(expectedSessionId);
    if (
      commit.rendererGeneration !== this.rendererGeneration ||
      commit.workspaceGeneration !== this.workspaceGeneration
    ) {
      throw new SessionStateError(
        "generation",
        "only current generations can be committed",
      );
    }
    this.committedRendererGeneration = commit.rendererGeneration;
    this.committedWorkspaceGeneration = commit.workspaceGeneration;
  }

  private assertActive(expectedSessionId: string | null): void {
    if (this.id === null) {
      throw new SessionStateError("no-session", "no project session is active");
    }
    if (expectedSessionId !== this.id) {
      throw new SessionStateError(
        "stale-session",
        "project session identity is stale",
      );
    }
    if (this.lifecycleState !== "active") {
      throw new SessionStateError("inactive", "project session is not active");
    }
  }
}

export class ProjectSessionRegistry {
  private current = ProjectSession.createNone();

  get active(): ProjectSession {
    return this.current;
  }

  activate(next: ProjectSession): void {
    if (this.current.kind !== "none") this.current.beginClosing();
    this.current = next;
  }

  runMutation<T>(
    expectedSessionId: string | null,
    task: () => Promise<T> | T,
  ): Promise<T> {
    const captured = this.current;
    return captured.runMutation(expectedSessionId, () => {
      if (this.current !== captured) {
        throw new SessionStateError(
          "stale-session",
          "project session changed while queued",
        );
      }
      return task();
    });
  }

  acquireReadLease(expectedSessionId: string | null): ProjectReadLease {
    return this.current.acquireReadLease(expectedSessionId);
  }

  async resolveRuntimeAsset(runtimeUrl: string): Promise<SessionAssetRead> {
    const parsed = parseRuntimeAssetUrl(runtimeUrl);
    const captured = this.current;
    if (captured.id !== parsed.sessionId) {
      throw new SessionStateError(
        "stale-session",
        "runtime asset belongs to another session",
      );
    }
    const workspacePath = captured.workspacePath;
    if (workspacePath === null) {
      throw new SessionStateError(
        "no-session",
        "active session has no workspace",
      );
    }
    const lease = captured.acquireReadLease(parsed.sessionId);
    try {
      const filePath = await resolveExistingArchiveFile(
        workspacePath,
        parsed.assetPath,
      );
      return { ...parsed, filePath, lease };
    } catch (error) {
      lease.release();
      throw error;
    }
  }
}
