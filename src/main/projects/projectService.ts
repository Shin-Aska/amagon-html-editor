import path from "node:path";
import {
  parseRecentProjectId,
  parseRendererGeneration,
  type ProjectCloseRequest,
  type ProjectCloseResult,
  type ProjectFailure,
  type ProjectNewRequest,
  type ProjectSaveRequest,
  type ProjectSessionResult,
  type RecentProject,
  type RecentProjectsResult,
  type RemoveRecentResult,
} from "../../shared/projects/projectIpcContract";
import { ProjectSession, ProjectSessionRegistry } from "./projectSession";
import { chooseAmgTarget, OPEN_PROJECT_FILTERS, projectSlug } from "./projectServiceDialogs";
import {
  mapProjectOperationError,
  ProjectServiceTargetError,
  type ProjectErrorContext,
} from "./projectServiceErrors";
import {
  createDefaultProjectServiceFiles,
  createInitialProjectDocument,
} from "./projectServiceFiles";
import { stageAmgProject, stageLegacyProject } from "./projectServiceOpen";
import { saveActiveProject, saveActiveProjectAs } from "./projectServiceSave";
import {
  closedSuccess,
  requireSessionId,
  retireState,
  sessionSuccess,
} from "./projectServiceState";
import type {
  ActiveProjectState,
  ProjectPersistenceService,
  ProjectServiceOptions,
  ProjectServiceRuntime,
} from "./projectServiceTypes";

export type { ProjectDialogPort, ProjectPersistenceService, ProjectServiceOptions } from "./projectServiceTypes";
export type { ProjectServiceFiles } from "./projectServiceFiles";

class ProjectPersistenceServiceImpl implements ProjectPersistenceService {
  private active: ActiveProjectState | null = null;
  private readonly runtime: ProjectServiceRuntime;

  constructor(private readonly options: ProjectServiceOptions) {
    this.runtime = {
      userDataPath: options.userDataPath,
      files: options.files ?? createDefaultProjectServiceFiles(),
      sessions: options.sessions ?? new ProjectSessionRegistry(),
    };
  }

  private context(request?: ProjectSaveRequest): ProjectErrorContext {
    const activeSessionId = this.active === null ? undefined : requireSessionId(this.active.session);
    return {
      ...(request === undefined ? {} : {
        expectedSessionId: request.expectedSessionId,
        expectedRendererGeneration: request.rendererGeneration,
      }),
      ...(activeSessionId === undefined ? {} : { activeSessionId }),
      ...(this.active === null ? {} : {
        actualRendererGeneration: parseRendererGeneration(this.active.session.generations.renderer),
      }),
    };
  }

  private failure(error: unknown, context: ProjectErrorContext = {}): ProjectFailure {
    return { success: false, error: mapProjectOperationError(error, context) };
  }

  private requireActive(): ActiveProjectState {
    if (this.active === null) throw new ProjectServiceTargetError("no project session is active");
    return this.active;
  }

  private activate(next: ActiveProjectState): ActiveProjectState | null {
    const previous = this.active;
    this.runtime.sessions.activate(next.session);
    this.active = next;
    this.options.onDirectoryChange?.(next.session.workspacePath);
    return previous;
  }

  private async finishActivation(next: ActiveProjectState, retainedWorkspacePath?: string): Promise<ProjectSessionResult> {
    await this.options.recents.add(next.session.sourcePath ?? "");
    const previous = this.activate(next);
    await retireState(previous, this.runtime, retainedWorkspacePath);
    return sessionSuccess(next);
  }

  async newProject(request: ProjectNewRequest): Promise<ProjectSessionResult> {
    const targetPath = await chooseAmgTarget(
      this.options.dialogs,
      this.options.documentsPath,
      "New Project",
      `${projectSlug(request.name)}.amg`,
    );
    if (targetPath === null) return { success: false, canceled: true };
    let workspacePath: string | undefined;
    try {
      const project = createInitialProjectDocument(request.name, request.framework);
      const workspace = await this.runtime.files.createWorkspace(this.options.userDataPath, project);
      workspacePath = workspace.path;
      await this.runtime.files.writeAmg({ targetPath, workspacePath, project });
      const next: ActiveProjectState = {
        session: ProjectSession.createAmg({ sourcePath: targetPath, workspacePath }),
        data: project,
        approvedExternalReferences: [],
      };
      return await this.finishActivation(next);
    } catch (error) {
      if (workspacePath !== undefined && this.active?.session.workspacePath !== workspacePath) {
        const cleanupFailure = await this.runtime.files.cleanupWorkspace(this.options.userDataPath, workspacePath)
          .then(() => null, (cleanupError: unknown) => this.failure(cleanupError));
        if (cleanupFailure !== null) return cleanupFailure;
      }
      return this.failure(error);
    }
  }

  private async openPath(filePath: string): Promise<ProjectSessionResult> {
    const extension = path.extname(filePath).toLowerCase();
    if (extension !== ".amg" && extension !== ".json") {
      throw new ProjectServiceTargetError("only .amg and legacy .json projects can be opened");
    }
    const next = extension === ".amg"
      ? await stageAmgProject(filePath, this.runtime)
      : await stageLegacyProject(filePath, this.runtime);
    try {
      return await this.finishActivation(next);
    } catch (error) {
      if (this.active !== next) await retireState(next, this.runtime);
      throw error;
    }
  }

  async openProject(): Promise<ProjectSessionResult> {
    const selection = await this.options.dialogs.showOpen({ title: "Open Project", filters: OPEN_PROJECT_FILTERS });
    const filePath = selection.filePaths[0];
    if (selection.canceled || filePath === undefined) return { success: false, canceled: true };
    try {
      return await this.openPath(filePath);
    } catch (error) {
      return this.failure(error);
    }
  }

  async openRecent(recentId: unknown): Promise<ProjectSessionResult> {
    try {
      const filePath = await this.options.recents.resolvePath(parseRecentProjectId(recentId));
      return await this.openPath(filePath);
    } catch (error) {
      return this.failure(error);
    }
  }

  async save(request: ProjectSaveRequest): Promise<ProjectSessionResult> {
    try {
      const saved = await saveActiveProject(this.requireActive(), this.runtime, request);
      this.active = saved.state;
      return saved.result;
    } catch (error) {
      return this.failure(error, this.context(request));
    }
  }

  async saveAs(request: ProjectSaveRequest): Promise<ProjectSessionResult> {
    const active = this.active;
    if (active === null) return this.failure(new ProjectServiceTargetError("no project session is active"));
    const defaultName = `${path.basename(active.session.sourcePath ?? "project", path.extname(active.session.sourcePath ?? ""))}.amg`;
    const targetPath = await chooseAmgTarget(
      this.options.dialogs,
      this.options.documentsPath,
      "Save Project As",
      defaultName,
    );
    if (targetPath === null) return { success: false, canceled: true };
    try {
      const committed = await saveActiveProjectAs(active, this.runtime, request, targetPath);
      try {
        await this.options.recents.add(targetPath);
      } catch (error) {
        await retireState(committed.next, this.runtime, committed.retainedWorkspacePath);
        throw error;
      }
      this.activate(committed.next);
      await retireState(committed.previous, this.runtime, committed.retainedWorkspacePath);
      return committed.result;
    } catch (error) {
      return this.failure(error, this.context(request));
    }
  }

  async close(request: ProjectCloseRequest): Promise<ProjectCloseResult> {
    if (request.dirtyChoice === "cancel") return { success: false, canceled: true };
    if (request.dirtyChoice === "save") {
      const saved = await this.save(request);
      if (!saved.success) return saved;
    }
    try {
      const state = this.requireActive();
      const expectedSessionId = request.expectedSessionId;
      const result = closedSuccess(state);
      await this.runtime.sessions.runMutation(expectedSessionId, () => {
        this.runtime.sessions.activate(ProjectSession.createNone());
        this.active = null;
        this.options.onDirectoryChange?.(null);
      });
      await retireState(state, this.runtime);
      return result;
    } catch (error) {
      return this.failure(error, this.context(request));
    }
  }

  async getRecent(): Promise<RecentProjectsResult> {
    try {
      const metadata = await this.options.recents.list();
      const projects: readonly RecentProject[] = metadata.map((project) => ({
        id: parseRecentProjectId(project.id),
        name: project.name,
        framework: project.framework ?? "vanilla",
        kind: path.extname(project.displayPath).toLowerCase() === ".amg" ? "amg" : "legacy-json",
        displayPath: project.displayPath,
      }));
      return { success: true, projects };
    } catch (error) {
      return this.failure(error);
    }
  }

  async removeRecent(recentId: unknown): Promise<RemoveRecentResult> {
    try {
      const parsedId = parseRecentProjectId(recentId);
      await this.options.recents.remove(parsedId);
      return { success: true, removedId: parsedId };
    } catch (error) {
      return this.failure(error);
    }
  }

  async getDirectory(): Promise<{ readonly success: true; readonly directory: string | null }> {
    return { success: true, directory: this.active?.session.workspacePath ?? null };
  }
}

export const createProjectService = (options: ProjectServiceOptions): ProjectPersistenceService => new ProjectPersistenceServiceImpl(options);
