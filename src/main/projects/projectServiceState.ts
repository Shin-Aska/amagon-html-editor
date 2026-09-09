import {
  parseProjectSessionId,
  parseRendererGeneration,
  parseWorkspaceGeneration,
  type ProjectClosedSuccess,
  type ProjectSessionId,
  type ProjectSessionSuccess,
} from "../../shared/projects/projectIpcContract";
import { scanProjectPortability } from "../../shared/projects/projectPortability";
import type { ProjectSession } from "./projectSession";
import { ProjectServicePortabilityError } from "./projectServiceErrors";
import type { ActiveProjectState, ProjectServiceRuntime } from "./projectServiceTypes";

export const requireSessionId = (session: ProjectSession): ProjectSessionId => {
  if (session.id === null) throw new TypeError("active project session has no identity");
  return parseProjectSessionId(session.id);
};

export const sessionSuccess = (state: ActiveProjectState): ProjectSessionSuccess => {
  const generations = state.session.generations;
  return {
    success: true,
    session: {
      sessionId: requireSessionId(state.session),
      kind: state.session.kind === "amg" ? "amg" : "legacy-json",
      displayPath: state.session.sourcePath ?? "",
      data: state.data,
      committedRendererGeneration: parseRendererGeneration(generations.committedRenderer),
      committedWorkspaceGeneration: parseWorkspaceGeneration(generations.committedWorkspace),
      dirty: state.session.isDirty,
    },
  };
};

export const closedSuccess = (state: ActiveProjectState): ProjectClosedSuccess => {
  const success = sessionSuccess(state).session;
  return { success: true, ...success };
};

export const validateLegacyProject = async (
  state: ActiveProjectState,
  runtime: ProjectServiceRuntime,
): Promise<void> => {
  const workspacePath = state.session.workspacePath;
  if (workspacePath === null) return;
  const scan = scanProjectPortability(state.data, {
    mode: "legacy-durable",
    sessionId: requireSessionId(state.session),
    availableAssetPaths: await runtime.files.listAssetPaths(workspacePath),
  });
  const references: string[] = [];
  for (const offender of scan.offenders) {
    if (offender.code === "external-local" && offender.reference !== undefined) {
      references.push(offender.reference);
    }
  }
  const approved = [...new Set(references)].sort();
  const stored = scanProjectPortability(state.data, {
    mode: "legacy-stored",
    sessionId: requireSessionId(state.session),
    availableAssetPaths: await runtime.files.listAssetPaths(workspacePath),
    approvedExternalReferences: approved,
  });
  if (stored.offenders.length > 0) throw new ProjectServicePortabilityError(stored.offenders);
};

export const retireState = async (
  state: ActiveProjectState | null,
  runtime: ProjectServiceRuntime,
  retainedWorkspacePath?: string,
): Promise<void> => {
  if (state === null) return;
  runtime.abortSessionTransfers?.(requireSessionId(state.session));
  await state.session.waitForReadLeases();
  state.session.close();
  if (
    state.session.kind === "amg"
    && state.session.workspacePath !== null
    && state.session.workspacePath !== retainedWorkspacePath
  ) {
    await runtime.files.cleanupWorkspace(runtime.userDataPath, state.session.workspacePath);
  }
};
