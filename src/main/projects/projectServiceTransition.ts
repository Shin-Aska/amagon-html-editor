import path from "node:path";
import {
  parseRendererGeneration,
  parseWorkspaceGeneration,
  type ActiveProjectTransitionRequest,
  type ProjectCloseRequest,
  type ProjectCloseResult,
  type ProjectFailure,
  type ProjectNewRequest,
  type ProjectOpenRecentRequest,
  type ProjectSaveRequest,
  type ProjectSessionResult,
  type ProjectTransitionRequest,
} from "../../shared/projects/projectIpcContract";
import { chooseAmgTarget, OPEN_PROJECT_FILTERS, projectSlug } from "./projectServiceDialogs";
import { mapProjectOperationError, ProjectServiceTargetError, type ProjectErrorContext } from "./projectServiceErrors";
import { persistActiveProject, saveActiveProjectAs } from "./projectServiceSave";
import { requireSessionId, retireState, sessionSuccess, closedSuccess } from "./projectServiceState";
import { ProjectSession, SessionStateError } from "./projectSession";
import {
  stageNewProject,
  stageProjectPath,
  type StagedProject,
} from "./projectServiceTransitionStage";
import type {
  ActiveProjectState,
  ActiveProjectStateStore,
  ProjectServiceOptions,
  ProjectServiceRuntime,
} from "./projectServiceTypes";

export class ProjectServiceTransition {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly options: ProjectServiceOptions,
    private readonly runtime: ProjectServiceRuntime,
    private readonly active: ActiveProjectStateStore,
  ) {}

  private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.tail.then(operation);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  private context(request: ProjectTransitionRequest | ProjectSaveRequest): ProjectErrorContext {
    const state = this.active.current;
    return {
      expectedSessionId: request.expectedSessionId,
      expectedRendererGeneration: request.rendererGeneration,
      expectedWorkspaceGeneration: request.workspaceGeneration,
      ...(state === null ? {} : {
        activeSessionId: requireSessionId(state.session),
        actualRendererGeneration: parseRendererGeneration(state.session.generations.renderer),
        actualWorkspaceGeneration: parseWorkspaceGeneration(state.session.generations.workspace),
      }),
    };
  }

  private failure(error: unknown, request: ProjectTransitionRequest | ProjectSaveRequest): ProjectFailure {
    return { success: false, error: mapProjectOperationError(error, this.context(request)) };
  }

  private authorize(request: ProjectTransitionRequest): ActiveProjectState | null {
    const state = this.active.current;
    if (state === null) {
      if (
        request.expectedSessionId !== null
        || request.rendererGeneration !== 0
        || request.workspaceGeneration !== 0
        || request.snapshot !== null
        || request.dirtyChoice !== "discard"
      ) {
        throw new SessionStateError("stale-session", "initial transition context is stale");
      }
      return null;
    }
    if (request.expectedSessionId === null) {
      throw new SessionStateError("stale-session", "an active project requires its session identity");
    }
    state.session.assertTransition(
      request.expectedSessionId,
      request.rendererGeneration,
      request.workspaceGeneration,
    );
    return state;
  }

  private activate(next: ActiveProjectState): void {
    this.runtime.sessions.activate(next.session);
    this.active.current = next;
    this.options.onDirectoryChange?.(next.session.workspacePath);
  }

  private async persistTransition(
    state: ActiveProjectState,
    request: ActiveProjectTransitionRequest,
  ): Promise<ActiveProjectState> {
    if (request.dirtyChoice !== "save") return state;
    const saved = await persistActiveProject(state, this.runtime, request);
    this.active.current = saved.state;
    return saved.state;
  }

  private async commitReplacement(
    request: ProjectTransitionRequest,
    stage: () => Promise<StagedProject>,
  ): Promise<ProjectSessionResult> {
    const authorized = this.authorize(request);
    if (authorized === null) return this.stageAndActivate(request, stage);
    if (request.expectedSessionId === null) {
      throw new SessionStateError("stale-session", "replacement session identity is missing");
    }
    this.runtime.abortSessionTransfers?.(request.expectedSessionId);
    return this.runtime.sessions.runMutation(request.expectedSessionId, async () => {
      const current = this.authorize(request);
      if (current === null) throw new SessionStateError("stale-session", "active project disappeared");
      const persisted = await this.persistTransition(current, request);
      this.active.current = persisted;
      return this.stageAndActivate(request, stage);
    });
  }

  private async stageAndActivate(
    request: ProjectTransitionRequest,
    stage: () => Promise<StagedProject>,
  ): Promise<ProjectSessionResult> {
    const staged = await stage();
    try {
      this.authorize(request);
      await this.options.recents.add(staged.state.session.sourcePath ?? "");
      this.authorize(request);
      const previous = this.active.current;
      this.activate(staged.state);
      await retireState(previous, this.runtime, staged.retainedWorkspacePath);
      return sessionSuccess(staged.state);
    } catch (error) {
      if (this.active.current !== staged.state) {
        await retireState(staged.state, this.runtime, staged.retainedWorkspacePath);
      }
      throw error;
    }
  }

  newProject(request: ProjectNewRequest): Promise<ProjectSessionResult> {
    return this.enqueue(async () => {
      try {
        this.authorize(request);
        if (request.dirtyChoice === "cancel") return { success: false, canceled: true };
        const targetPath = await chooseAmgTarget(
          this.options.dialogs,
          this.options.documentsPath,
          "New Project",
          `${projectSlug(request.name)}.amg`,
        );
        if (targetPath === null) return { success: false, canceled: true };
        this.authorize(request);
        return await this.commitReplacement(request, () => stageNewProject(request, targetPath, this.runtime));
      } catch (error) {
        return this.failure(error, request);
      }
    });
  }

  openProject(request: ProjectTransitionRequest): Promise<ProjectSessionResult> {
    return this.enqueue(async () => {
      try {
        this.authorize(request);
        if (request.dirtyChoice === "cancel") return { success: false, canceled: true };
        const selection = await this.options.dialogs.showOpen({ title: "Open Project", filters: OPEN_PROJECT_FILTERS });
        const filePath = selection.filePaths[0];
        if (selection.canceled || filePath === undefined) return { success: false, canceled: true };
        this.authorize(request);
        return await this.commitReplacement(request, () => stageProjectPath(filePath, this.runtime));
      } catch (error) {
        return this.failure(error, request);
      }
    });
  }

  openRecent(request: ProjectOpenRecentRequest): Promise<ProjectSessionResult> {
    return this.enqueue(async () => {
      try {
        this.authorize(request);
        if (request.dirtyChoice === "cancel") return { success: false, canceled: true };
        const filePath = await this.options.recents.resolvePath(request.recentId);
        this.authorize(request);
        return await this.commitReplacement(request, () => stageProjectPath(filePath, this.runtime));
      } catch (error) {
        return this.failure(error, request);
      }
    });
  }

  saveAs(request: ProjectSaveRequest): Promise<ProjectSessionResult> {
    return this.enqueue(async () => {
      try {
        const state = this.active.current;
        if (state === null) throw new ProjectServiceTargetError("no project session is active");
        state.session.assertTransition(request.expectedSessionId, request.rendererGeneration, request.workspaceGeneration);
        const sourcePath = state.session.sourcePath ?? "project";
        const defaultName = `${path.basename(sourcePath, path.extname(sourcePath))}.amg`;
        const targetPath = await chooseAmgTarget(this.options.dialogs, this.options.documentsPath, "Save Project As", defaultName);
        if (targetPath === null) return { success: false, canceled: true };
        state.session.assertTransition(request.expectedSessionId, request.rendererGeneration, request.workspaceGeneration);
        this.runtime.abortSessionTransfers?.(request.expectedSessionId);
        return await this.runtime.sessions.runMutation(request.expectedSessionId, async () => {
          const current = this.active.current;
          if (current === null) throw new SessionStateError("stale-session", "active project disappeared");
          current.session.assertTransition(request.expectedSessionId, request.rendererGeneration, request.workspaceGeneration);
          const committed = await saveActiveProjectAs(current, this.runtime, request, targetPath);
          try {
            current.session.assertTransition(request.expectedSessionId, request.rendererGeneration, request.workspaceGeneration);
            await this.options.recents.add(targetPath);
            current.session.assertTransition(request.expectedSessionId, request.rendererGeneration, request.workspaceGeneration);
            this.activate(committed.next);
            await retireState(committed.previous, this.runtime, committed.retainedWorkspacePath);
            return committed.result;
          } catch (error) {
            await retireState(committed.next, this.runtime, committed.retainedWorkspacePath);
            throw error;
          }
        });
      } catch (error) {
        return this.failure(error, request);
      }
    });
  }

  close(request: ProjectCloseRequest): Promise<ProjectCloseResult> {
    return this.enqueue(async () => {
      try {
        const state = this.authorize(request);
        if (state === null) throw new SessionStateError("stale-session", "no active project can be closed");
        if (request.dirtyChoice === "cancel") return { success: false, canceled: true };
        this.runtime.abortSessionTransfers?.(request.expectedSessionId);
        return await this.runtime.sessions.runMutation(request.expectedSessionId, async () => {
          const current = this.authorize(request);
          if (current === null) throw new SessionStateError("stale-session", "active project disappeared");
          const persisted = await this.persistTransition(current, request);
          persisted.session.assertTransition(request.expectedSessionId, request.rendererGeneration, request.workspaceGeneration);
          const result = closedSuccess(persisted);
          this.runtime.sessions.activate(ProjectSession.createNone());
          this.active.current = null;
          this.options.onDirectoryChange?.(null);
          await retireState(persisted, this.runtime);
          return result;
        });
      } catch (error) {
        return this.failure(error, request);
      }
    });
  }
}
