import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRecentProjectId,
  parseRendererGeneration,
  parseWorkspaceGeneration,
  type ProjectCloseRequest,
  type ProjectCloseResult,
  type ProjectFailure,
  type ProjectNewRequest,
  type ProjectOpenRecentRequest,
  type ProjectSaveRequest,
  type ProjectSessionResult,
  type ProjectTransitionRequest,
  type RecentProject,
  type RecentProjectsResult,
  type RemoveRecentResult,
} from "../../shared/projects/projectIpcContract";
import { ProjectSessionRegistry } from "./projectSession";
import {
  mapProjectOperationError,
  ProjectServiceTargetError,
  type ProjectErrorContext,
} from "./projectServiceErrors";
import { createDefaultProjectServiceFiles } from "./projectServiceFiles";
import { saveActiveProject } from "./projectServiceSave";
import { requireSessionId } from "./projectServiceState";
import { ProjectServiceTransition } from "./projectServiceTransition";
import type {
  ActiveProjectState,
  ActiveProjectStateStore,
  ProjectPersistenceService,
  ProjectServiceOptions,
  ProjectServiceRuntime,
} from "./projectServiceTypes";

export type { ProjectDialogPort, ProjectPersistenceService, ProjectServiceOptions } from "./projectServiceTypes";
export type { ProjectServiceFiles } from "./projectServiceFiles";

class ProjectPersistenceServiceImpl implements ProjectPersistenceService {
  private readonly active: ActiveProjectStateStore = { current: null };
  private readonly runtime: ProjectServiceRuntime;
  private readonly transitions: ProjectServiceTransition;

  constructor(private readonly options: ProjectServiceOptions) {
    this.runtime = {
      userDataPath: options.userDataPath,
      files: options.files ?? createDefaultProjectServiceFiles(),
      sessions: options.sessions ?? new ProjectSessionRegistry(),
      ...(options.abortSessionTransfers === undefined ? {} : { abortSessionTransfers: options.abortSessionTransfers }),
    };
    this.transitions = new ProjectServiceTransition(options, this.runtime, this.active);
  }

  private context(request?: ProjectSaveRequest): ProjectErrorContext {
    const activeSessionId = this.active.current === null ? undefined : requireSessionId(this.active.current.session);
    return {
      ...(request === undefined ? {} : {
        expectedSessionId: request.expectedSessionId,
        expectedRendererGeneration: request.rendererGeneration,
        expectedWorkspaceGeneration: request.workspaceGeneration,
      }),
      ...(activeSessionId === undefined ? {} : { activeSessionId }),
      ...(this.active.current === null ? {} : {
        actualRendererGeneration: parseRendererGeneration(this.active.current.session.generations.renderer),
        actualWorkspaceGeneration: parseWorkspaceGeneration(this.active.current.session.generations.workspace),
      }),
    };
  }

  private failure(error: unknown, context: ProjectErrorContext = {}): ProjectFailure {
    return { success: false, error: mapProjectOperationError(error, context) };
  }

  private requireActive(): ActiveProjectState {
    if (this.active.current === null) throw new ProjectServiceTargetError("no project session is active");
    return this.active.current;
  }

  async newProject(request: ProjectNewRequest): Promise<ProjectSessionResult> {
    return this.transitions.newProject(request);
  }

  async openProject(request: ProjectTransitionRequest): Promise<ProjectSessionResult> {
    return this.transitions.openProject(request);
  }

  async openRecent(request: ProjectOpenRecentRequest): Promise<ProjectSessionResult> {
    return this.transitions.openRecent(request);
  }

  async save(request: ProjectSaveRequest): Promise<ProjectSessionResult> {
    try {
      const saved = await saveActiveProject(this.requireActive(), this.runtime, request);
      this.active.current = saved.state;
      return saved.result;
    } catch (error) {
      return this.failure(error, this.context(request));
    }
  }

  async saveAs(request: ProjectSaveRequest): Promise<ProjectSessionResult> {
    return this.transitions.saveAs(request);
  }

  async close(request: ProjectCloseRequest): Promise<ProjectCloseResult> {
    return this.transitions.close(request);
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
    return { success: true, directory: this.active.current?.session.workspacePath ?? null };
  }

  async resolveAssetRead(reference: string): Promise<{ readonly filePath: string; readonly release: () => void }> {
    const active = this.requireActive();
    if (reference.startsWith("app-media://")) {
      const resolved = await this.runtime.sessions.resolveRuntimeAsset(reference);
      return { filePath: resolved.filePath, release: resolved.lease.release };
    }
    if (active.session.kind !== "legacy-json" || !active.approvedExternalReferences.includes(reference)) {
      throw new ProjectServiceTargetError("project data cannot authorize this local file read");
    }
    let filePath: string;
    if (reference.toLowerCase().startsWith("file:")) {
      filePath = fileURLToPath(reference);
    } else if (reference.toLowerCase().startsWith("app-media://absolute/")) {
      filePath = decodeURIComponent(reference.slice("app-media://absolute/".length));
    } else if (path.isAbsolute(reference)) {
      filePath = reference;
    } else {
      throw new ProjectServiceTargetError("approved legacy reference is not an absolute local path");
    }
    const lease = active.session.acquireReadLease(requireSessionId(active.session));
    return { filePath, release: lease.release };
  }
}

export const createProjectService = (options: ProjectServiceOptions): ProjectPersistenceService => new ProjectPersistenceServiceImpl(options);
