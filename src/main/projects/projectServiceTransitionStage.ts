import path from "node:path";
import type { ProjectNewRequest } from "../../shared/projects/projectIpcContract";
import { ProjectSession } from "./projectSession";
import { ProjectServiceTargetError } from "./projectServiceErrors";
import { createInitialProjectDocument } from "./projectServiceFiles";
import { stageAmgProject, stageLegacyProject } from "./projectServiceOpen";
import type { ActiveProjectState, ProjectServiceRuntime } from "./projectServiceTypes";

export type StagedProject = {
  readonly state: ActiveProjectState;
  readonly retainedWorkspacePath?: string;
};

export const stageNewProject = async (
  request: ProjectNewRequest,
  targetPath: string,
  runtime: ProjectServiceRuntime,
): Promise<StagedProject> => {
  const project = createInitialProjectDocument(request.name, request.framework);
  const workspace = await runtime.files.createWorkspace(runtime.userDataPath, project);
  try {
    await runtime.files.writeAmg({ targetPath, workspacePath: workspace.path, project });
    return {
      state: {
        session: ProjectSession.createAmg({ sourcePath: targetPath, workspacePath: workspace.path }),
        data: project,
        approvedExternalReferences: [],
      },
    };
  } catch (error) {
    await runtime.files.cleanupWorkspace(runtime.userDataPath, workspace.path);
    throw error;
  }
};

export const stageProjectPath = async (
  filePath: string,
  runtime: ProjectServiceRuntime,
): Promise<StagedProject> => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension !== ".amg" && extension !== ".json") {
    throw new ProjectServiceTargetError("only .amg and legacy .json projects can be opened");
  }
  return {
    state: extension === ".amg"
      ? await stageAmgProject(filePath, runtime)
      : await stageLegacyProject(filePath, runtime),
  };
};
