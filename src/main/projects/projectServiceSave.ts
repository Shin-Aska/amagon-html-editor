import {
  parseLegacyProjectDocument,
  parseProjectDocumentV1,
  type LegacyProjectDocument,
  type ProjectDocumentV1,
} from "../../shared/projects/projectDocumentSchema";
import type {
  ProjectSaveRequest,
  ProjectSessionResult,
} from "../../shared/projects/projectIpcContract";
import { scanProjectPortability } from "../../shared/projects/projectPortability";
import { ProjectSession } from "./projectSession";
import { ProjectServicePortabilityError } from "./projectServiceErrors";
import { requireSessionId, sessionSuccess } from "./projectServiceState";
import type { ActiveProjectState, ProjectServiceRuntime } from "./projectServiceTypes";

const requireWorkspace = (state: ActiveProjectState): string => {
  if (state.session.workspacePath === null) {
    throw new TypeError("active project has no workspace");
  }
  return state.session.workspacePath;
};

export const validateStoredProject = async (
  state: ActiveProjectState,
  runtime: ProjectServiceRuntime,
  project: ProjectDocumentV1 | LegacyProjectDocument,
  mode: "bundle-stored" | "legacy-stored",
): Promise<readonly string[]> => {
  const workspacePath = requireWorkspace(state);
  const result = scanProjectPortability(project, {
    mode,
    sessionId: requireSessionId(state.session),
    availableAssetPaths: await runtime.files.listAssetPaths(workspacePath),
    approvedExternalReferences: state.approvedExternalReferences,
  });
  if (result.offenders.length > 0) {
    throw new ProjectServicePortabilityError(result.offenders);
  }
  return result.referencedAssetPaths;
};

export const saveActiveProject = async (
  state: ActiveProjectState,
  runtime: ProjectServiceRuntime,
  request: ProjectSaveRequest,
): Promise<{ readonly state: ActiveProjectState; readonly result: ProjectSessionResult }> => (
  runtime.sessions.runMutation(request.expectedSessionId, () => persistActiveProject(state, runtime, request))
);

export const persistActiveProject = async (
  state: ActiveProjectState,
  runtime: ProjectServiceRuntime,
  request: ProjectSaveRequest,
): Promise<{ readonly state: ActiveProjectState; readonly result: ProjectSessionResult }> => {
  const expectedSessionId = request.expectedSessionId;
  state.session.assertTransition(expectedSessionId, request.rendererGeneration, request.workspaceGeneration);
  state.session.updateRendererGeneration(expectedSessionId, request.rendererGeneration);
  const workspacePath = requireWorkspace(state);
  if (state.session.kind === "amg") {
    const project = parseProjectDocumentV1(request.snapshot);
    await validateStoredProject(state, runtime, project, "bundle-stored");
    await runtime.files.writeAmg({
      targetPath: state.session.sourcePath ?? "",
      workspacePath,
      project,
    });
    state.session.commitGenerations(expectedSessionId, {
      rendererGeneration: request.rendererGeneration,
      workspaceGeneration: state.session.generations.workspace,
    });
    const next = { ...state, data: project };
    return { state: next, result: sessionSuccess(next) };
  }
  const project = parseLegacyProjectDocument(request.snapshot);
  await validateStoredProject(state, runtime, project, "legacy-stored");
  await runtime.files.writeLegacy(state.session.sourcePath ?? "", project);
  state.session.commitGenerations(expectedSessionId, {
    rendererGeneration: request.rendererGeneration,
    workspaceGeneration: state.session.generations.workspace,
  });
  const next = { ...state, data: project };
  return { state: next, result: sessionSuccess(next) };
};

export type SaveAsCommit = {
  readonly previous: ActiveProjectState;
  readonly next: ActiveProjectState;
  readonly retainedWorkspacePath?: string;
  readonly result: ProjectSessionResult;
};

export const saveActiveProjectAs = async (
  state: ActiveProjectState,
  runtime: ProjectServiceRuntime,
  request: ProjectSaveRequest,
  targetPath: string,
): Promise<SaveAsCommit> => {
  const expectedSessionId = request.expectedSessionId;
  state.session.assertTransition(expectedSessionId, request.rendererGeneration, request.workspaceGeneration);
  state.session.updateRendererGeneration(expectedSessionId, request.rendererGeneration);
  const project = parseProjectDocumentV1(request.snapshot);
  const referencedAssets = await validateStoredProject(state, runtime, project, "bundle-stored");
  const sourceWorkspacePath = requireWorkspace(state);
  const candidate = state.session.kind === "legacy-json"
    ? await runtime.files.createWorkspace(runtime.userDataPath, project, {
        sourceWorkspacePath,
        assetPaths: referencedAssets,
      })
    : undefined;
  const workspacePath = candidate?.path ?? sourceWorkspacePath;
  try {
    await runtime.files.writeAmg({ targetPath, workspacePath, project });
  } catch (error) {
    if (candidate !== undefined) {
      await runtime.files.cleanupWorkspace(runtime.userDataPath, candidate.path);
    }
    throw error;
  }
  const nextSession = ProjectSession.createAmg({ sourcePath: targetPath, workspacePath });
  const nextSessionId = requireSessionId(nextSession);
  nextSession.updateRendererGeneration(nextSessionId, request.rendererGeneration);
  nextSession.commitGenerations(nextSessionId, {
    rendererGeneration: request.rendererGeneration,
    workspaceGeneration: 0,
  });
  const next: ActiveProjectState = {
    session: nextSession,
    data: project,
    approvedExternalReferences: [],
  };
  return {
    previous: state,
    next,
    ...(candidate === undefined ? { retainedWorkspacePath: workspacePath } : {}),
    result: sessionSuccess(next),
  };
};
