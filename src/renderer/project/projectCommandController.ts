import { z } from "zod";
import { LegacyProjectDocumentSchema, ProjectDocumentV1Schema } from "../../shared/projects/projectDocumentSchema";
import {
  parseRendererGeneration,
  type DirtyTransitionChoice,
  type MutationResult,
  type ProjectOperation,
  type ProjectOperationError,
  type ProjectSession,
} from "../../shared/projects/projectIpcContract";
import type { ProjectData } from "../store/types";
import { buildProjectSnapshot, materializeProjectSnapshot } from "./projectSnapshot";
import {
  createProjectSaveCoordinator,
  type CoordinatorSaveKind,
  type CoordinatorSaveResponse,
  type ProjectSaveCoordinator,
} from "./projectSaveCoordinator";
import { canceledMessage, operationErrorMessage } from "./projectCommandMessages";
import type {
  MutationPerformer,
  ProjectCommandDependencies,
  ProjectCommandMessage,
  ProjectCommandResult,
  ProjectCommands,
  ProjectCommandState,
} from "./projectCommandTypes";

const RendererProjectSchema = z.custom<ProjectData>(
  (value) => LegacyProjectDocumentSchema.safeParse(value).success,
  { message: "Project data is not compatible with the renderer" },
);

export const createProjectCommands = (dependencies: ProjectCommandDependencies): ProjectCommands => {
  const listeners = new Set<() => void>();
  let state: ProjectCommandState = { session: null, busy: null, progress: null, dirty: false, message: null };
  let coordinator: ProjectSaveCoordinator | null = null;
  let installing = false;
  let mutating = false;
  let latestSaveSession: ProjectSession | null = null;
  let availableAssetPaths: readonly string[] = [];
  const getLatestSaveSession = (): ProjectSession | null => latestSaveSession;

  const publish = (patch: Partial<ProjectCommandState>): void => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const fail = (message: ProjectCommandMessage, canceled = false): ProjectCommandResult<never> => {
    publish({ message });
    dependencies.notify(message);
    return { ok: false, canceled, message };
  };
  const cancel = (): ProjectCommandResult<never> => fail(canceledMessage(), true);
  const fromError = (error: ProjectOperationError): ProjectCommandResult<never> => fail(operationErrorMessage(error));
  const unexpected = (error: unknown): ProjectCommandResult<never> => fail({
    tone: "error",
    title: "Project operation failed",
    detail: error instanceof Error ? error.message : "An unexpected project error occurred.",
    locations: [],
  });

  const createSnapshot = (kind: CoordinatorSaveKind) => {
    const source = dependencies.readProject();
    if (state.session === null) {
      return { ok: false as const, offenders: [{ code: "stale-session" as const, location: "$" }], referencedAssetPaths: [] };
    }
    return buildProjectSnapshot({
      ...source,
      flushedBlocks: source.blocks,
      operation: kind === "save-as" ? "save-as" : "save",
      sessionId: state.session.sessionId,
      sessionKind: state.session.kind,
      availableAssetPaths,
    });
  };

  const installSession = async (session: ProjectSession): Promise<ProjectCommandResult> => {
    try {
      availableAssetPaths = await dependencies.assets.listPaths();
      const materialized = materializeProjectSnapshot({
        project: RendererProjectSchema.parse(session.data),
        sessionId: session.sessionId,
        sessionKind: session.kind,
        availableAssetPaths,
      });
      if (!materialized.ok) return fail({
        tone: "error",
        title: "Project contains invalid asset references",
        detail: "Fix the listed locations before continuing.",
        locations: materialized.offenders.map((item) => item.location),
      });
      installing = true;
      dependencies.installProject(materialized.project, session.displayPath);
      dependencies.markSaved();
      installing = false;
      coordinator = createProjectSaveCoordinator({
        sessionId: session.sessionId,
        rendererGeneration: session.committedRendererGeneration,
        committedRendererGeneration: session.committedRendererGeneration,
        workspaceGeneration: session.committedWorkspaceGeneration,
        committedWorkspaceGeneration: session.committedWorkspaceGeneration,
        createSnapshot,
        executeSave: async (invocation): Promise<CoordinatorSaveResponse> => {
          const snapshot = session.kind === "legacy-json" && invocation.kind !== "save-as"
            ? LegacyProjectDocumentSchema.parse(invocation.snapshot)
            : ProjectDocumentV1Schema.parse(invocation.snapshot);
          const result = invocation.kind === "save-as"
            ? await dependencies.project.saveAs({ ...invocation, snapshot })
            : await dependencies.project.save({ ...invocation, snapshot });
          if (!result.success) {
            if (result.canceled) return { success: false, error: { code: "CANCELED" } };
            const detail = operationErrorMessage(result.error).detail;
            return { success: false, error: { code: result.error.code, message: detail } };
          }
          latestSaveSession = result.session;
          return {
            success: true,
            sessionId: invocation.kind === "save-as" ? invocation.expectedSessionId : result.session.sessionId,
            rendererGeneration: result.session.committedRendererGeneration,
            workspaceGeneration: result.session.committedWorkspaceGeneration,
          };
        },
      });
      latestSaveSession = null;
      publish({ session, dirty: false, message: null });
      return { ok: true, value: undefined };
    } catch (error) {
      installing = false;
      return unexpected(error);
    }
  };

  const activate = async (
    operation: ProjectOperation,
    request: () => ReturnType<ProjectCommandDependencies["project"]["load"]>,
  ): Promise<ProjectCommandResult> => {
    if (state.busy !== null) return fromError({ code: "BUSY", operation: state.busy });
    publish({ busy: operation, message: null });
    try {
      const result = await request();
      if (!result.success) return result.canceled ? cancel() : fromError(result.error);
      return await installSession(result.session);
    } catch (error) {
      return unexpected(error);
    } finally {
      publish({ busy: null });
    }
  };

  const runSave = async (kind: CoordinatorSaveKind): Promise<ProjectCommandResult> => {
    if (coordinator === null || state.session === null) return fail({ tone: "error", title: "No project is open", detail: "Open or create a project first.", locations: [] });
    if (state.busy !== null) return fromError({ code: "BUSY", operation: state.busy });
    const operation = kind === "save-as" ? "save-as" : "save";
    latestSaveSession = null;
    publish({ busy: operation, message: null });
    try {
      const result = kind === "autosave" ? await coordinator.requestAutosave() : kind === "save-as" ? await coordinator.requestSaveAs() : await coordinator.requestSave();
      if (!result.success) {
        if ("error" in result) return fail({ tone: "error", title: "Save did not complete", detail: result.error.message ?? result.error.code, locations: [] }, result.error.code === "CANCELED");
        if (result.code === "portability") return fail({ tone: "error", title: "Project contains non-portable references", detail: "Fix the listed locations before saving.", locations: result.offenders.map((item) => item.location) });
        return fail({ tone: "error", title: "Save did not complete", detail: result.message ?? result.code, locations: [] });
      }
      const savedSession = getLatestSaveSession();
      if (savedSession !== null && kind === "save-as") return await installSession(savedSession);
      if (savedSession !== null) publish({ session: savedSession });
      const dirty = coordinator.state.dirty;
      if (!dirty) dependencies.markSaved();
      publish({ dirty, message: kind === "autosave" ? null : { tone: "success", title: "Project saved", detail: savedSession?.displayPath ?? state.session.displayPath, locations: [] } });
      return { ok: true, value: undefined };
    } catch (error) {
      return unexpected(error);
    } finally {
      publish({ busy: null });
    }
  };

  const runMutation = async <T>(perform: MutationPerformer<T>): Promise<ProjectCommandResult<T>> => {
    if (coordinator === null || state.session === null) return fail({ tone: "error", title: "No project is open", detail: "Open or create a project first.", locations: [] });
    if (mutating || state.busy !== null) return fail({ tone: "info", title: "Project operation in progress", detail: "Wait for the current file operation to finish.", locations: [] });
    mutating = true;
    try {
      const result: MutationResult<T> = await perform(state.session.sessionId);
      const acceptance = coordinator.recordMutation(result);
      if (!acceptance.accepted) return fail({ tone: "error", title: "Stale project mutation ignored", detail: "Retry in the currently open project.", locations: [] });
      if (result.changed) {
        dependencies.markDirty();
        publish({ dirty: coordinator.state.dirty });
        try {
          availableAssetPaths = await dependencies.assets.listPaths();
        } catch {
          return fail({ tone: "error", title: "Project files changed but the file index did not refresh", detail: "Retry Save after reopening the asset or font manager.", locations: [] });
        }
      }
      if (result.success) return { ok: true, value: result.value };
      if ("canceled" in result && result.canceled) return cancel();
      if (result.error?.code === "PARTIAL_MUTATION") return fail({ tone: "error", title: "Some project files changed", detail: result.error.message, locations: result.error.failedItems });
      return result.error === undefined ? fail({ tone: "error", title: "Mutation failed", detail: "No project files were changed.", locations: [] }) : fromError(result.error);
    } catch (error) {
      return unexpected(error);
    } finally {
      mutating = false;
    }
  };

  const close = async (choice?: DirtyTransitionChoice): Promise<ProjectCommandResult> => {
    if (coordinator === null || state.session === null) return { ok: true, value: undefined };
    if (state.busy !== null || mutating) return fail({ tone: "info", title: "Project operation in progress", detail: "Wait for the current operation before closing.", locations: [] });
    const dirtyChoice = choice ?? (state.dirty ? dependencies.chooseDirtyTransition?.() ?? "cancel" : "discard");
    if (dirtyChoice === "cancel") return cancel();
    publish({ busy: "close", message: null });
    try {
      const built = createSnapshot("save");
      const rendererSnapshot = built.ok ? built.project : RendererProjectSchema.parse(state.session.data);
      const snapshot = state.session.kind === "legacy-json" ? LegacyProjectDocumentSchema.parse(rendererSnapshot) : ProjectDocumentV1Schema.parse(rendererSnapshot);
      const result = await dependencies.project.close({ expectedSessionId: state.session.sessionId, rendererGeneration: coordinator.state.rendererGeneration, snapshot, dirtyChoice });
      if (!result.success) return result.canceled ? cancel() : fromError(result.error);
      installing = true;
      dependencies.closeProject();
      dependencies.markSaved();
      installing = false;
      coordinator = null;
      publish({ session: null, dirty: false, message: null });
      return { ok: true, value: undefined };
    } catch (error) {
      installing = false;
      return unexpected(error);
    } finally {
      publish({ busy: null });
    }
  };

  const unsubscribeEdits = dependencies.subscribeRendererEdits(() => {
    if (installing || coordinator === null) return;
    coordinator.recordRendererEdit(parseRendererGeneration(coordinator.state.rendererGeneration + 1));
    dependencies.markDirty();
    publish({ dirty: true });
  });
  const unsubscribeProgress = dependencies.project.onProgress((progress) => publish({ progress, busy: progress.busy ? progress.operation : state.busy }));

  return {
    get state() { return state; },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    openProject: () => activate("open", dependencies.project.load),
    openRecent: (recentId) => activate("open-recent", () => dependencies.project.openRecent(recentId)),
    newProject: (request) => activate("new", () => dependencies.project.new(request)),
    save: () => runSave("save"), saveAs: () => runSave("save-as"), autosave: () => runSave("autosave"), close,
    getRecent: dependencies.project.getRecent, removeRecent: dependencies.project.removeRecent,
    selectImages: () => runMutation((expectedSessionId) => dependencies.assets.selectImage({ expectedSessionId })),
    selectSingleImage: () => runMutation((expectedSessionId) => dependencies.assets.selectSingleImage({ expectedSessionId })),
    selectVideos: () => runMutation((expectedSessionId) => dependencies.assets.selectVideo({ expectedSessionId })),
    deleteAsset: (relativePath) => runMutation((expectedSessionId) => dependencies.assets.delete({ expectedSessionId, relativePath })),
    importAsset: (srcPath) => runMutation((expectedSessionId) => dependencies.assets.import({ expectedSessionId, srcPath })),
    importFonts: () => runMutation((expectedSessionId) => dependencies.fonts.importFile({ expectedSessionId })),
    copySystemFont: (familyName, filePaths) => runMutation((expectedSessionId) => dependencies.fonts.copySystemFont({ expectedSessionId, familyName, filePaths })),
    downloadGoogleFont: (family, variants) => runMutation((expectedSessionId) => dependencies.fonts.downloadGoogleFont({ expectedSessionId, family, variants })),
    deleteFont: (relativePath) => runMutation((expectedSessionId) => dependencies.fonts.deleteFont({ expectedSessionId, relativePath })),
    downloadMedia: (url) => runMutation((expectedSessionId) => dependencies.mediaSearch.downloadAndImport({ expectedSessionId, url })),
    dispose: () => { unsubscribeEdits(); unsubscribeProgress(); listeners.clear(); },
  };
};
