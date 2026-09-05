import {
  parseRendererGeneration,
  parseWorkspaceGeneration,
  type DurableProjectData,
  type ProjectOpenRecentRequest,
  type ProjectSaveRequest,
  type ProjectSession,
  type ProjectTransitionRequest,
  type RecentProjectId,
} from "../../src/shared/projects/projectIpcContract";

export const initialProjectTransition = (): ProjectTransitionRequest => ({
  expectedSessionId: null,
  rendererGeneration: parseRendererGeneration(0),
  workspaceGeneration: parseWorkspaceGeneration(0),
  snapshot: null,
  dirtyChoice: "discard",
});

export const discardProjectTransition = (session: ProjectSession): ProjectTransitionRequest => ({
  expectedSessionId: session.sessionId,
  rendererGeneration: session.committedRendererGeneration,
  workspaceGeneration: session.committedWorkspaceGeneration,
  snapshot: null,
  dirtyChoice: "discard",
});

export const openRecentRequest = (
  recentId: RecentProjectId,
  session: ProjectSession | null,
): ProjectOpenRecentRequest => ({
  ...(session === null ? initialProjectTransition() : discardProjectTransition(session)),
  recentId,
});

export const saveRequest = (
  session: ProjectSession,
  rendererGeneration: number,
  snapshot: DurableProjectData,
): ProjectSaveRequest => ({
  expectedSessionId: session.sessionId,
  rendererGeneration: parseRendererGeneration(rendererGeneration),
  workspaceGeneration: session.committedWorkspaceGeneration,
  snapshot,
});

export const sessionAfterWorkspaceMutation = (
  session: ProjectSession,
  workspaceGeneration: ProjectSession["committedWorkspaceGeneration"],
): ProjectSession => ({
  ...session,
  committedWorkspaceGeneration: workspaceGeneration,
});
