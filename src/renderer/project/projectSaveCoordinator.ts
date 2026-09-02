import type { ProjectPortabilityOffender } from "../../shared/projects/projectPortability";
import type {
  ProjectSessionId,
  RendererGeneration,
  WorkspaceGeneration,
} from "../../shared/projects/projectIpcContract";
import type {
  PersistedProjectSnapshot,
  ProjectSnapshotResult,
} from "./projectSnapshot";

export type CoordinatorSaveKind = "autosave" | "save" | "save-as";

export type CoordinatorSaveInvocation = {
  readonly kind: CoordinatorSaveKind;
  readonly expectedSessionId: ProjectSessionId;
  readonly rendererGeneration: RendererGeneration;
  readonly snapshot: PersistedProjectSnapshot;
};

export type CoordinatorSaveResponse =
  | {
      readonly success: true;
      readonly sessionId: ProjectSessionId;
      readonly rendererGeneration: RendererGeneration;
      readonly workspaceGeneration: WorkspaceGeneration;
    }
  | {
      readonly success: false;
      readonly error: {
        readonly code: string;
        readonly message?: string;
      };
    };

export type CoordinatorSaveResult = CoordinatorSaveResponse | {
  readonly success: false;
  readonly code: "stale-session" | "stale-renderer-generation" | "stale-workspace-generation" | "execution-failed";
  readonly message?: string;
} | {
  readonly success: false;
  readonly code: "portability";
  readonly offenders: readonly ProjectPortabilityOffender[];
  readonly referencedAssetPaths: readonly string[];
};

export type MutationAcceptance =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly code: "stale-session" | "stale-workspace-generation" };

export type WorkspaceMutationObservation = {
  readonly sessionId: ProjectSessionId;
  readonly workspaceGeneration: WorkspaceGeneration;
  readonly changed: boolean;
};

export type ProjectSaveCoordinatorState = {
  readonly sessionId: ProjectSessionId;
  readonly rendererGeneration: RendererGeneration;
  readonly committedRendererGeneration: RendererGeneration;
  readonly workspaceGeneration: WorkspaceGeneration;
  readonly committedWorkspaceGeneration: WorkspaceGeneration;
  readonly activeRendererGeneration: RendererGeneration | null;
  readonly dirty: boolean;
};

export type ProjectSaveCoordinatorOptions = {
  readonly sessionId: ProjectSessionId;
  readonly rendererGeneration: RendererGeneration;
  readonly committedRendererGeneration: RendererGeneration;
  readonly workspaceGeneration: WorkspaceGeneration;
  readonly committedWorkspaceGeneration: WorkspaceGeneration;
  readonly createSnapshot: () => ProjectSnapshotResult;
  readonly executeSave: (invocation: CoordinatorSaveInvocation) => Promise<CoordinatorSaveResponse>;
};

export interface ProjectSaveCoordinator {
  readonly state: ProjectSaveCoordinatorState;
  readonly recordRendererEdit: (generation: RendererGeneration) => void;
  readonly recordMutation: (result: WorkspaceMutationObservation) => MutationAcceptance;
  readonly requestAutosave: () => Promise<CoordinatorSaveResult>;
  readonly requestSave: () => Promise<CoordinatorSaveResult>;
  readonly requestSaveAs: () => Promise<CoordinatorSaveResult>;
}

type ResultWaiter = (result: CoordinatorSaveResult) => void;

type CoordinatorState = {
  renderer: RendererGeneration;
  committedRenderer: RendererGeneration;
  workspace: WorkspaceGeneration;
  committedWorkspace: WorkspaceGeneration;
  activeRenderer: RendererGeneration | null;
  draining: boolean;
  pending: { kind: CoordinatorSaveKind; waiters: ResultWaiter[] } | null;
};

const preferredKind = (
  current: CoordinatorSaveKind,
  incoming: CoordinatorSaveKind,
): CoordinatorSaveKind => {
  if (current === "save-as" || incoming === "save-as") return "save-as";
  if (current === "save" || incoming === "save") return "save";
  return "autosave";
};

export const createProjectSaveCoordinator = (
  options: ProjectSaveCoordinatorOptions,
): ProjectSaveCoordinator => {
  const internal: CoordinatorState = {
    renderer: options.rendererGeneration,
    committedRenderer: options.committedRendererGeneration,
    workspace: options.workspaceGeneration,
    committedWorkspace: options.committedWorkspaceGeneration,
    activeRenderer: null,
    draining: false,
    pending: null,
  };

  const runSave = async (kind: CoordinatorSaveKind): Promise<CoordinatorSaveResult> => {
    const rendererGeneration = internal.renderer;
    const built = options.createSnapshot();
    if (!built.ok) {
      return {
        success: false,
        code: "portability",
        offenders: built.offenders,
        referencedAssetPaths: built.referencedAssetPaths,
      };
    }
    internal.activeRenderer = rendererGeneration;
    let response: CoordinatorSaveResponse;
    try {
      response = await options.executeSave({
        kind,
        expectedSessionId: options.sessionId,
        rendererGeneration,
        snapshot: built.project,
      });
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, code: "execution-failed", message: error.message };
      }
      throw error;
    } finally {
      internal.activeRenderer = null;
    }
    if (!response.success) return response;
    if (response.sessionId !== options.sessionId) {
      return { success: false, code: "stale-session" };
    }
    if (response.rendererGeneration !== rendererGeneration) {
      return { success: false, code: "stale-renderer-generation" };
    }
    if (response.workspaceGeneration < internal.committedWorkspace) {
      return { success: false, code: "stale-workspace-generation" };
    }
    internal.committedRenderer = rendererGeneration;
    internal.workspace = response.workspaceGeneration > internal.workspace
      ? response.workspaceGeneration
      : internal.workspace;
    internal.committedWorkspace = response.workspaceGeneration;
    return response;
  };

  const drain = async (): Promise<void> => {
    if (internal.draining) return;
    internal.draining = true;
    while (internal.pending !== null) {
      const request = internal.pending;
      internal.pending = null;
      const result = await runSave(request.kind);
      request.waiters.forEach((resolve) => resolve(result));
    }
    internal.draining = false;
  };

  const request = (kind: CoordinatorSaveKind): Promise<CoordinatorSaveResult> => (
    new Promise((resolve) => {
      if (internal.pending === null) {
        internal.pending = { kind, waiters: [resolve] };
      } else {
        internal.pending.kind = preferredKind(internal.pending.kind, kind);
        internal.pending.waiters.push(resolve);
      }
      void drain();
    })
  );

  return {
    get state(): ProjectSaveCoordinatorState {
      return {
        sessionId: options.sessionId,
        rendererGeneration: internal.renderer,
        committedRendererGeneration: internal.committedRenderer,
        workspaceGeneration: internal.workspace,
        committedWorkspaceGeneration: internal.committedWorkspace,
        activeRendererGeneration: internal.activeRenderer,
        dirty: internal.renderer !== internal.committedRenderer
          || internal.workspace !== internal.committedWorkspace,
      };
    },
    recordRendererEdit: (generation) => {
      if (Number.isSafeInteger(generation) && generation > internal.renderer) {
        internal.renderer = generation;
      }
    },
    recordMutation: (result) => {
      if (result.sessionId !== options.sessionId) {
        return { accepted: false, code: "stale-session" };
      }
      if (result.workspaceGeneration < internal.workspace) {
        return { accepted: false, code: "stale-workspace-generation" };
      }
      internal.workspace = result.workspaceGeneration;
      return { accepted: true };
    },
    requestAutosave: () => request("autosave"),
    requestSave: () => request("save"),
    requestSaveAs: () => request("save-as"),
  };
};
