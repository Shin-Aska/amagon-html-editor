import { LegacyProjectDocumentSchema, parseLegacyProjectDocument } from "../../shared/projects/projectDocumentSchema";
import type { AssetInfo, FontMutationBridge, MutationResult, ProjectBridge, ProjectSession, SessionRequest } from "../../shared/projects/projectIpcContract";
import { parseProjectSessionId, parseRendererGeneration, parseWorkspaceGeneration } from "../../shared/projects/projectIpcContract";
import { canonicalizePortablePath } from "../../shared/projects/assetReference";
import { useEditorStore } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";
import { useToastStore } from "../store/toastStore";
import type { FontAsset } from "../store/types";
import { getApi, getLegacyBrowserProjectApi } from "../utils/api";
import { createProjectCommands } from "./projectCommandController";
import type { AssetCommands, ProjectCommands } from "./projectCommandTypes";

const missingMutation = <T>(request: SessionRequest): MutationResult<T> => ({
  success: false,
  sessionId: request.expectedSessionId,
  workspaceGeneration: parseWorkspaceGeneration(0),
  changed: false,
  error: { code: "INTERNAL", message: "Electron project bridge is unavailable" },
});

type RuntimeInventoryResult = {
  readonly success: boolean;
  readonly assets?: readonly { readonly relativePath: string }[];
  readonly fonts?: readonly { readonly relativePath: string }[];
};

export const mergeRuntimeAssetPaths = (
  assets: RuntimeInventoryResult,
  fonts: RuntimeInventoryResult,
): readonly string[] => [...new Set([
  ...(assets.success ? assets.assets?.map((asset) => canonicalizePortablePath(asset.relativePath)) ?? [] : []),
  ...(fonts.success ? fonts.fonts?.map((font) => canonicalizePortablePath(font.relativePath)) ?? [] : []),
])].sort();

type LegacyBrowserProjectFacade = {
  readonly new: (request: { readonly name: string; readonly framework: string }) => Promise<{ readonly success: boolean; readonly content?: unknown; readonly filePath?: string; readonly canceled?: boolean; readonly error?: string }>;
  readonly load: () => Promise<{ readonly success: boolean; readonly content?: unknown; readonly filePath?: string; readonly canceled?: boolean; readonly error?: string }>;
  readonly save: (request: { readonly filePath?: string; readonly content: string }) => Promise<{ readonly success: boolean; readonly filePath?: string; readonly canceled?: boolean; readonly error?: string }>;
  readonly saveAs: (request: { readonly content: string }) => Promise<{ readonly success: boolean; readonly filePath?: string; readonly canceled?: boolean; readonly error?: string }>;
};

const newBrowserSessionId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  return parseProjectSessionId(Array.from(bytes, (value) => alphabet[value % alphabet.length]).join(""));
};

export const createLegacyBrowserProjectBridge = (legacy: LegacyBrowserProjectFacade): ProjectBridge => {
  let active: ProjectSession | null = null;
  const activate = async (request: () => ReturnType<LegacyBrowserProjectFacade["load"]>) => {
    const result = await request();
    if (!result.success) {
      if (result.canceled) return { success: false as const, canceled: true as const };
      return { success: false as const, error: { code: "INTERNAL" as const, message: result.error ?? "Legacy JSON operation failed" } };
    }
    try {
      active = {
        sessionId: newBrowserSessionId(),
        kind: "legacy-json",
        displayPath: result.filePath ?? "browser-project.json",
        data: parseLegacyProjectDocument(result.content),
        committedRendererGeneration: parseRendererGeneration(0),
        committedWorkspaceGeneration: parseWorkspaceGeneration(0),
        dirty: false,
      };
      return { success: true as const, session: active };
    } catch (error) {
      return { success: false as const, error: { code: "ARCHIVE_INVALID" as const, message: error instanceof Error ? error.message : "Legacy JSON is invalid" } };
    }
  };
  const persist = async (request: Parameters<ProjectBridge["save"]>[0], saveAs: boolean) => {
    if (active === null || active.sessionId !== request.expectedSessionId) {
      return { success: false as const, error: { code: "STALE_SESSION" as const, expectedSessionId: request.expectedSessionId, activeSessionId: active?.sessionId } };
    }
    const data = LegacyProjectDocumentSchema.parse(request.snapshot);
    const serialized = JSON.stringify(data, null, 2);
    const result = saveAs
      ? await legacy.saveAs({ content: serialized })
      : await legacy.save({ filePath: active.displayPath, content: serialized });
    if (!result.success) {
      if (result.canceled) return { success: false as const, canceled: true as const };
      return { success: false as const, error: { code: "INTERNAL" as const, message: result.error ?? "Legacy JSON save failed" } };
    }
    active = {
      ...active,
      sessionId: saveAs ? newBrowserSessionId() : active.sessionId,
      displayPath: result.filePath ?? active.displayPath,
      data,
      committedRendererGeneration: request.rendererGeneration,
      dirty: false,
    };
    return { success: true as const, session: active };
  };
  return {
    new: (request) => activate(() => legacy.new(request)),
    load: () => activate(legacy.load),
    save: (request) => persist(request, false),
    saveAs: (request) => persist(request, true),
    close: async (request) => {
      if (active === null || active.sessionId !== request.expectedSessionId) {
        return { success: false, error: { code: "STALE_SESSION", expectedSessionId: request.expectedSessionId, activeSessionId: active?.sessionId } };
      }
      if (request.dirtyChoice === "save") {
        const saved = await persist(request, false);
        if (!saved.success) return saved;
      }
      const closed = active;
      active = null;
      return { success: true, ...closed };
    },
    openRecent: async (recentId) => ({ success: false, error: { code: "RECENT_NOT_FOUND", recentId } }),
    removeRecent: async (recentId) => ({ success: false, error: { code: "RECENT_NOT_FOUND", recentId } }),
    getRecent: async () => ({ success: true, projects: [] }),
    getDir: async () => ({ success: true, directory: null }),
    onProgress: () => () => undefined,
  };
};

const unavailableAssets: AssetCommands = {
  listPaths: async () => [],
  selectImage: async (request) => missingMutation<readonly AssetInfo[]>(request),
  selectSingleImage: async (request) => missingMutation<AssetInfo>(request),
  selectVideo: async (request) => missingMutation<readonly AssetInfo[]>(request),
  delete: async (request) => missingMutation<null>(request),
  import: async (request) => missingMutation<AssetInfo>(request),
};

const unavailableFonts: FontMutationBridge<FontAsset> = {
  importFile: async (request) => missingMutation<readonly FontAsset[]>(request),
  downloadGoogleFont: async (request) => missingMutation<readonly FontAsset[]>(request),
  copySystemFont: async (request) => missingMutation<readonly FontAsset[]>(request),
  deleteFont: async (request) => missingMutation<null>(request),
};

export const createRuntimeProjectCommands = (): ProjectCommands => {
  const electron = window.api;
  const commands = createProjectCommands({
    project: electron?.project ?? createLegacyBrowserProjectBridge(getLegacyBrowserProjectApi()),
    assets: {
      listPaths: async () => {
        const api = getApi();
        const [assets, fonts] = await Promise.all([api.assets.list(), api.fonts.listProject()]);
        return mergeRuntimeAssetPaths(assets, fonts);
      },
      selectImage: electron?.assets.selectImage ?? unavailableAssets.selectImage,
      selectSingleImage: electron?.assets.selectSingleImage ?? unavailableAssets.selectSingleImage,
      selectVideo: electron?.assets.selectVideo ?? unavailableAssets.selectVideo,
      delete: electron?.assets.delete ?? unavailableAssets.delete,
      import: electron?.assets.import ?? unavailableAssets.import,
    },
    fonts: {
      importFile: electron?.fonts.importFile ?? unavailableFonts.importFile,
      downloadGoogleFont: electron?.fonts.downloadGoogleFont ?? unavailableFonts.downloadGoogleFont,
      copySystemFont: electron?.fonts.copySystemFont ?? unavailableFonts.copySystemFont,
      deleteFont: electron?.fonts.deleteFont ?? unavailableFonts.deleteFont,
    },
    mediaSearch: { downloadAndImport: electron?.mediaSearch.downloadAndImport ?? (async (request) => missingMutation<AssetInfo>(request)) },
    readProject: () => {
      const project = useProjectStore.getState();
      const editor = useEditorStore.getState();
      return { project: project.getProjectData(), currentPageId: project.currentPageId, blocks: editor.getFullBlocks(), customCss: editor.customCss };
    },
    installProject: (project, displayPath) => {
      useProjectStore.getState().setProject(project, displayPath);
      useEditorStore.getState().loadPageBlocks(project.pages[0]?.blocks ?? []);
      useEditorStore.getState().setCustomCss(project.customCss);
    },
    closeProject: () => {
      useProjectStore.getState().closeProject();
      useEditorStore.getState().loadPageBlocks([]);
    },
    markSaved: () => useEditorStore.getState().markSaved(),
    markDirty: () => useEditorStore.getState().markDirty(),
    subscribeRendererEdits: (listener) => {
      const editor = useEditorStore.subscribe((next, previous) => {
        if (next.blocks !== previous.blocks || next.customCss !== previous.customCss) listener();
      });
      const project = useProjectStore.subscribe((next, previous) => {
        if (next.settings !== previous.settings || next.pages !== previous.pages || next.folders !== previous.folders || next.userBlocks !== previous.userBlocks || next.customPresets !== previous.customPresets || next.fonts !== previous.fonts || next.themePacks !== previous.themePacks || next.sectionTemplates !== previous.sectionTemplates || next.pageTemplates !== previous.pageTemplates || next.appliedThemePackId !== previous.appliedThemePackId || next.boundPublisherId !== previous.boundPublisherId || next.lastPublishedUrl !== previous.lastPublishedUrl || next.lastPublishedAt !== previous.lastPublishedAt) listener();
      });
      return () => { editor(); project(); };
    },
    notify: (message) => useToastStore.getState().showToast(
      `${message.title}: ${message.detail}${message.locations.length > 0 ? ` (${message.locations.join(", ")})` : ""}`,
      message.tone,
    ),
    chooseDirtyTransition: () => window.confirm("Save changes before closing?") ? "save" : window.confirm("Discard unsaved changes?") ? "discard" : "cancel",
  });
  electron?.project.onLifecycleCloseRequest((request) => {
    void commands.close().then((result) => electron.project.finishLifecycleClose({
      ...request,
      proceed: result.ok,
    }));
  });
  return commands;
};
