import path from "node:path";
import { ProjectSession } from "./projectSession";
import { validateStoredProject } from "./projectServiceSave";
import { collectApprovedExternalReferences } from "./projectServiceState";
import type { ActiveProjectState, ProjectServiceRuntime } from "./projectServiceTypes";

export const stageAmgProject = async (
  filePath: string,
  runtime: ProjectServiceRuntime,
): Promise<ActiveProjectState> => {
  const candidate = await runtime.files.openAmg(filePath, runtime.userDataPath);
  const state: ActiveProjectState = {
    session: ProjectSession.createAmg({ sourcePath: filePath, workspacePath: candidate.workspace.path }),
    data: candidate.project,
    approvedExternalReferences: [],
  };
  try {
    await validateStoredProject(state, runtime, candidate.project, "bundle-stored");
    return state;
  } catch (error) {
    await runtime.files.cleanupWorkspace(runtime.userDataPath, candidate.workspace.path);
    throw error;
  }
};

export const stageLegacyProject = async (
  filePath: string,
  runtime: ProjectServiceRuntime,
): Promise<ActiveProjectState> => {
  const data = await runtime.files.readLegacy(filePath);
  const state: ActiveProjectState = {
    session: ProjectSession.createLegacyJson({ sourcePath: filePath, workspacePath: path.dirname(filePath) }),
    data,
    approvedExternalReferences: [],
  };
  return { ...state, approvedExternalReferences: await collectApprovedExternalReferences(state, runtime) };
};
