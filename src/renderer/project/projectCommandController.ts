import { LegacyProjectDocumentSchema, ProjectDocumentV1Schema } from "../../shared/projects/projectDocumentSchema";
import {
  parseRendererGeneration,
  parseWorkspaceGeneration,
  type DirtyTransitionChoice,
  type MutationResult,
  type ProjectOperation,
  type ProjectOperationError,
  type ProjectSession,
  type ProjectTransitionRequest,
} from "../../shared/projects/projectIpcContract";
import { buildProjectSnapshot } from "./projectSnapshot";
import {
  type CoordinatorSaveKind,
} from "./projectSaveCoordinator";
import { canceledMessage, operationErrorMessage } from "./projectCommandMessages";
import { ProjectCommandSessionInstaller, type ProjectCommandSessionRuntime } from "./projectCommandSession";
import type {
  MutationPerformer,
  ProjectCommandDependencies,
  ProjectCommandMessage,
  ProjectCommandResult,
  ProjectCommands,
  ProjectCommandState,
} from "./projectCommandTypes";

export const createProjectCommands = (dependencies: ProjectCommandDependencies): ProjectCommands => {
  const listeners = new Set<() => void>();
  let state: ProjectCommandState = { session: null, busy: null, progress: null, dirty: false, message: null };
  const sessionRuntime: ProjectCommandSessionRuntime = { coordinator: null, installing: false, latestSaveSession: null, availableAssetPaths: [] };
  let mutating = false;
  let runSave: (kind: CoordinatorSaveKind) => Promise<ProjectCommandResult>;
  const getLatestSaveSession = (): ProjectSession | null => sessionRuntime.latestSaveSession;

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
      availableAssetPaths: sessionRuntime.availableAssetPaths,
    });
  };

  const sessionInstaller = new ProjectCommandSessionInstaller(
    sessionRuntime,
    dependencies,
    { createSnapshot, fail, unexpected, publish },
  );
  const installSession = (session: ProjectSession): Promise<ProjectCommandResult> => sessionInstaller.install(session);

  const activate = async (
    operation: ProjectOperation,
    request: (transition: ProjectTransitionRequest) => ReturnType<ProjectCommandDependencies["project"]["load"]>,
  ): Promise<ProjectCommandResult> => {
    if (state.busy !== null) return fromError({ code: "BUSY", operation: state.busy });
    let transition: ProjectTransitionRequest;
    if (state.session === null || sessionRuntime.coordinator === null) {
      transition = {
        expectedSessionId: null,
        rendererGeneration: parseRendererGeneration(0),
        workspaceGeneration: parseWorkspaceGeneration(0),
        snapshot: null,
        dirtyChoice: "discard",
      };
    } else {
      const dirtyChoice = state.dirty ? dependencies.chooseDirtyTransition?.() ?? "cancel" : "discard";
      if (dirtyChoice === "save") {
        const built = createSnapshot("save");
        if (!built.ok) return fail({
          tone: "error",
          title: "Project contains non-portable references",
          detail: "Fix the listed locations before continuing.",
          locations: built.offenders.map((item) => item.location),
        });
        const snapshot = state.session.kind === "legacy-json"
          ? LegacyProjectDocumentSchema.parse(built.project)
          : ProjectDocumentV1Schema.parse(built.project);
        transition = {
          expectedSessionId: state.session.sessionId,
          rendererGeneration: sessionRuntime.coordinator.state.rendererGeneration,
          workspaceGeneration: sessionRuntime.coordinator.state.workspaceGeneration,
          snapshot,
          dirtyChoice,
        };
      } else {
        transition = {
          expectedSessionId: state.session.sessionId,
          rendererGeneration: sessionRuntime.coordinator.state.rendererGeneration,
          workspaceGeneration: sessionRuntime.coordinator.state.workspaceGeneration,
          snapshot: null,
          dirtyChoice,
        };
      }
    }
    publish({ busy: operation, message: null });
    try {
      const result = await request(transition);
      if (!result.success) return result.canceled ? cancel() : fromError(result.error);
      return await installSession(result.session);
    } catch (error) {
      return unexpected(error);
    } finally {
      publish({ busy: null });
    }
  };

  runSave = async (kind: CoordinatorSaveKind): Promise<ProjectCommandResult> => {
    if (sessionRuntime.coordinator === null || state.session === null) return fail({ tone: "error", title: "No project is open", detail: "Open or create a project first.", locations: [] });
    if (state.busy !== null) return fromError({ code: "BUSY", operation: state.busy });
    if (kind === "autosave" && !sessionRuntime.coordinator.state.dirty) return { ok: true, value: undefined };
    const operation = kind === "save-as" ? "save-as" : "save";
    sessionRuntime.latestSaveSession = null;
    publish({ busy: operation, message: null });
    try {
      const result = kind === "autosave" ? await sessionRuntime.coordinator.requestAutosave() : kind === "save-as" ? await sessionRuntime.coordinator.requestSaveAs() : await sessionRuntime.coordinator.requestSave();
      if (!result.success) {
        if ("error" in result) return fail({ tone: "error", title: "Save did not complete", detail: result.error.message ?? result.error.code, locations: [] }, result.error.code === "CANCELED");
        if (result.code === "portability") return fail({ tone: "error", title: "Project contains non-portable references", detail: "Fix the listed locations before saving.", locations: result.offenders.map((item) => item.location) });
        return fail({ tone: "error", title: "Save did not complete", detail: result.message ?? result.code, locations: [] });
      }
      const savedSession = getLatestSaveSession();
      if (savedSession !== null && kind === "save-as") return await installSession(savedSession);
      if (savedSession !== null) publish({ session: savedSession });
      const dirty = sessionRuntime.coordinator.state.dirty;
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
    if (sessionRuntime.coordinator === null || state.session === null) return fail({ tone: "error", title: "No project is open", detail: "Open or create a project first.", locations: [] });
    if (mutating || state.busy !== null) return fail({ tone: "info", title: "Project operation in progress", detail: "Wait for the current file operation to finish.", locations: [] });
    mutating = true;
    try {
      const result: MutationResult<T> = await perform(state.session.sessionId);
      const acceptance = sessionRuntime.coordinator.recordMutation(result);
      if (!acceptance.accepted) return fail({ tone: "error", title: "Stale project mutation ignored", detail: "Retry in the currently open project.", locations: [] });
      if (result.changed) {
        dependencies.markDirty();
        publish({ dirty: sessionRuntime.coordinator.state.dirty });
        try {
          sessionRuntime.availableAssetPaths = await dependencies.assets.listPaths();
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
    if (sessionRuntime.coordinator === null || state.session === null) return { ok: true, value: undefined };
    if (state.busy !== null || mutating) return fail({ tone: "info", title: "Project operation in progress", detail: "Wait for the current operation before closing.", locations: [] });
    const dirtyChoice = choice ?? (state.dirty ? dependencies.chooseDirtyTransition?.() ?? "cancel" : "discard");
    publish({ busy: "close", message: null });
    try {
      let request: Parameters<ProjectCommandDependencies["project"]["close"]>[0];
      if (dirtyChoice === "save") {
        const built = createSnapshot("save");
        if (!built.ok) return fail({ tone: "error", title: "Project contains non-portable references", detail: "Fix the listed locations before closing.", locations: built.offenders.map((item) => item.location) });
        const snapshot = state.session.kind === "legacy-json" ? LegacyProjectDocumentSchema.parse(built.project) : ProjectDocumentV1Schema.parse(built.project);
        request = {
          expectedSessionId: state.session.sessionId,
          rendererGeneration: sessionRuntime.coordinator.state.rendererGeneration,
          workspaceGeneration: sessionRuntime.coordinator.state.workspaceGeneration,
          snapshot,
          dirtyChoice,
        };
      } else {
        request = {
          expectedSessionId: state.session.sessionId,
          rendererGeneration: sessionRuntime.coordinator.state.rendererGeneration,
          workspaceGeneration: sessionRuntime.coordinator.state.workspaceGeneration,
          snapshot: null,
          dirtyChoice,
        };
      }
      const result = await dependencies.project.close(request);
      if (!result.success) return result.canceled ? cancel() : fromError(result.error);
      sessionRuntime.installing = true;
      dependencies.closeProject();
      dependencies.markSaved();
      sessionRuntime.installing = false;
      sessionRuntime.coordinator = null;
      publish({ session: null, dirty: false, message: null });
      return { ok: true, value: undefined };
    } catch (error) {
      sessionRuntime.installing = false;
      return unexpected(error);
    } finally {
      publish({ busy: null });
    }
  };

  const unsubscribeEdits = dependencies.subscribeRendererEdits(() => {
    if (sessionRuntime.installing || sessionRuntime.coordinator === null) return;
    sessionRuntime.coordinator.recordRendererEdit(parseRendererGeneration(sessionRuntime.coordinator.state.rendererGeneration + 1));
    dependencies.markDirty();
    publish({ dirty: true });
  });
  const unsubscribeProgress = dependencies.project.onProgress((progress) => publish({ progress, busy: progress.busy ? progress.operation : state.busy }));

  return {
    get state() { return state; },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    openProject: () => activate("open", dependencies.project.load),
    openRecent: (recentId) => activate("open-recent", (transition) => dependencies.project.openRecent({ ...transition, recentId })),
    newProject: (request) => activate("new", (transition) => dependencies.project.new({ ...transition, ...request })),
    save: () => runSave("save"), saveAs: () => runSave("save-as"), autosave: () => runSave("autosave"), close,
    getRecent: dependencies.project.getRecent, removeRecent: dependencies.project.removeRecent,
    selectImages: () => runMutation((expectedSessionId) => dependencies.assets.selectImage({ expectedSessionId })),
    selectSingleImage: () => runMutation((expectedSessionId) => dependencies.assets.selectSingleImage({ expectedSessionId })),
    selectVideos: () => runMutation((expectedSessionId) => dependencies.assets.selectVideo({ expectedSessionId })),
    deleteAsset: (relativePath) => runMutation((expectedSessionId) => dependencies.assets.delete({ expectedSessionId, relativePath })),
    importFonts: () => runMutation((expectedSessionId) => dependencies.fonts.importFile({ expectedSessionId })),
    copySystemFont: (familyName) => runMutation((expectedSessionId) => dependencies.fonts.copySystemFont({ expectedSessionId, familyName })),
    downloadGoogleFont: (family, variants) => runMutation((expectedSessionId) => dependencies.fonts.downloadGoogleFont({ expectedSessionId, family, variants })),
    deleteFont: (relativePath) => runMutation((expectedSessionId) => dependencies.fonts.deleteFont({ expectedSessionId, relativePath })),
    downloadMedia: (downloadId) => runMutation((expectedSessionId) => dependencies.mediaSearch.downloadAndImport({ expectedSessionId, downloadId })),
    dispose: () => { unsubscribeEdits(); unsubscribeProgress(); listeners.clear(); },
  };
};
