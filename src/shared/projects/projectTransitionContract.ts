import type {
  DurableProjectData,
  ProjectSessionId,
  RecentProjectId,
  RendererGeneration,
  WorkspaceGeneration,
} from "./projectIpcContract";

export type DirtyTransitionChoice = "save" | "discard" | "cancel";

export type InitialProjectTransitionRequest = {
  readonly expectedSessionId: null;
  readonly rendererGeneration: RendererGeneration;
  readonly workspaceGeneration: WorkspaceGeneration;
  readonly snapshot: null;
  readonly dirtyChoice: "discard";
};

export type ActiveProjectTransitionRequest = {
  readonly expectedSessionId: ProjectSessionId;
  readonly rendererGeneration: RendererGeneration;
  readonly workspaceGeneration: WorkspaceGeneration;
} & ({
  readonly dirtyChoice: "save";
  readonly snapshot: DurableProjectData;
} | {
  readonly dirtyChoice: "discard" | "cancel";
  readonly snapshot: null;
});

export type ProjectTransitionRequest = InitialProjectTransitionRequest | ActiveProjectTransitionRequest;

export type ProjectSaveRequest = {
  readonly expectedSessionId: ProjectSessionId;
  readonly rendererGeneration: RendererGeneration;
  readonly workspaceGeneration: WorkspaceGeneration;
  readonly snapshot: DurableProjectData;
};

export type ProjectCloseRequest = ActiveProjectTransitionRequest;

export type ProjectNewRequest = ProjectTransitionRequest & {
  readonly name: string;
  readonly framework: string;
};

export type ProjectOpenRecentRequest = ProjectTransitionRequest & {
  readonly recentId: RecentProjectId;
};
