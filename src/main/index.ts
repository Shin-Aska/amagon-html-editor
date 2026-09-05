import * as electron from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { getFonts } from "font-list";
import {
  buildSystemPrompt,
  chat as aiChat,
  fetchAvailableModels,
  fetchModelsForProvider,
  loadApiKeyForProvider,
  loadConfig as aiLoadConfig,
  maskApiKey,
  MASKED_KEY_PREFIX,
  PROVIDER_MODELS,
  saveConfig as aiSaveConfig,
} from "./aiService";
import { CLI_BINARY_NAMES, detectCliProvider } from "./cliHelpers";
import { isEncryptionSecure } from "./cryptoHelpers";
import { buildAppMenu } from "./menu";
import "../publish/providers/index";
import {
  getAllPublishers,
  getPublisher,
} from "../publish";
import {
  deletePublishCredentials,
  loadPublishCredentials,
  savePublishCredentials,
} from "./publishCredentials";
import {
  deleteCredentialRecord,
  getCredentialDefinitions,
  getCredentialValues,
  listCredentialRecords,
  resolveSensitiveValues,
  saveCredentialRecord,
} from "./credentialCatalog";
import { createProjectService, type ProjectPersistenceService } from "./projects/projectService";
import { createDefaultProjectServiceFiles, inspectProjectMetadata } from "./projects/projectServiceFiles";
import { createRecentProjectsStore } from "./projects/recentProjects";
import { registerProjectIpc } from "./projects/registerProjectIpc";
import { ProjectSessionRegistry } from "./projects/projectSession";
import { cleanupStaleOwnedWorkspaces } from "./projects/projectWorkspace";
import { focusSecondInstance, type LifecycleResult } from "./projects/projectLifecycle";
import { buildRuntimeAssetUrl } from "../shared/projects/assetReference";
import { createProjectTransferRegistry } from "./projects/projectTransferRegistry";
import { initializeProjectStartup } from "./projects/projectStartup";
import { registerProjectResourceIpc } from "./projects/registerProjectResourceIpc";
import { assertTrustedMainFrame } from "./projects/projectIpcSecurity";
import { resolveSystemFontPath as resolveMainSystemFontPath } from "./systemFontResolver";
import { getMimeType, isPathSafe } from "./mainFileHelpers";
import { createGoogleFontsService } from "./googleFontsTransport";
import { registerAppProtocols } from "./registerAppProtocols";
import { createAutosaveController } from "./autosaveController";
import { registerAutosaveIpc } from "./registerAutosaveIpc";
import { createMainWindowController } from "./mainWindowController";
import { registerMenuIpc } from "./registerMenuIpc";
import { registerFontQueryIpc } from "./registerFontQueryIpc";
import { registerExportIpc } from "./registerExportIpc";
import { registerAssetReadIpc } from "./registerAssetReadIpc";
import { registerSettingsIpc } from "./registerSettingsIpc";
import { registerCredentialIpc } from "./registerCredentialIpc";
import { registerPublishIpc } from "./registerPublishIpc";
import { registerAiIpc } from "./registerAiIpc";
import { registerProjectRuntime } from "./registerProjectRuntime";

const { app, ipcMain, protocol, dialog, shell, net, Menu } = electron;
const BrowserWindowCtor = electron.BrowserWindow;

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let currentProjectDir: string | null = null;
const projectSessions = new ProjectSessionRegistry();
const projectTransfers = createProjectTransferRegistry();
const projectFiles = createDefaultProjectServiceFiles();
let projectService: ProjectPersistenceService | null = null;

const hasSingleInstanceLock = initializeProjectStartup({
  registerScheme: (scheme, privileges) => protocol.registerSchemesAsPrivileged([{ scheme, privileges }]),
  requestSingleInstanceLock: () => app.requestSingleInstanceLock(),
  quit: () => app.quit(),
});

const googleFonts = createGoogleFontsService({
  getTempPath: () => app.getPath("temp"),
  exists: existsSync,
  mkdir: async (directory) => fs.mkdir(directory, { recursive: true }),
  writeFile: async (filePath, data) => fs.writeFile(filePath, data),
  execFile: (file, args, options, callback) => {
    execFile(file, [...args], options, callback);
  },
  fetch,
}, getMimeType);

const windowController = createMainWindowController({
  moduleDirectory: __dirname,
  rendererUrl: process.env.ELECTRON_RENDERER_URL,
  platform: process.platform,
  createRequestId: randomUUID,
  quit: () => app.quit(),
  stopAutosave: () => autosave.stop(),
  createWindow: (options) => new BrowserWindowCtor(options),
  onClosed: (window, listener) => window.on("closed", listener),
  onClose: (window, listener) => window.on("close", listener),
});

const autosave = createAutosaveController({
  getMainWindow: windowController.getMainWindow,
  getCurrentProjectDir: () => currentProjectDir,
});

// ---------------------------------------------------------------------------
// IPC Handlers  (Tasks 8.2 – 8.5)
// ---------------------------------------------------------------------------

function registerIpcHandlers(): void {
  // ── Menu State ─────────────────────────────────────────────────────────

  registerMenuIpc({
    handle: (channel, handler) => ipcMain.handle(channel, handler),
    getMainWindow: windowController.getMainWindow,
    buildMenu: buildAppMenu,
    setApplicationMenu: (menu) => Menu.setApplicationMenu(menu),
  });

  registerFontQueryIpc({
    handle: (channel, handler) => ipcMain.handle(channel, handler),
    getMainWindow: windowController.getMainWindow,
    getProjectDirectory: () => currentProjectDir,
    getSystemFonts: getFonts,
    googleFonts,
    exists: existsSync,
    access: fs.access,
    readFile: fs.readFile,
    readDirectory: fs.readdir,
    isPathSafe,
  });

  registerExportIpc({
    handle: (channel, handler) => ipcMain.handle(channel, handler),
    getMainWindow: windowController.getMainWindow,
    getDocumentsPath: () => app.getPath("documents"),
    showSaveDialog: async (options) => {
      const mainWindow = windowController.getMainWindow();
      if (mainWindow === null) throw new Error("Main window is not available");
      return dialog.showSaveDialog(mainWindow, options);
    },
    showOpenDialog: async (options) => {
      const mainWindow = windowController.getMainWindow();
      if (mainWindow === null) throw new Error("Main window is not available");
      return dialog.showOpenDialog(mainWindow, options);
    },
    writeFile: fs.writeFile,
    makeDirectory: fs.mkdir,
    isPathSafe,
    openExternal: shell.openExternal,
    openPath: shell.openPath,
  });

  registerAssetReadIpc({
    handle: (channel, handler) => ipcMain.handle(channel, handler),
    getMainWindow: windowController.getMainWindow,
    sessions: projectSessions,
    getProjectService: () => projectService,
    exists: existsSync,
    readDirectory: (directory) => fs.readdir(directory, { withFileTypes: true }),
    stat: fs.stat,
    readFile: fs.readFile,
    buildRuntimeAssetUrl,
    getMimeType,
  });

  // ── Auto-save configuration ───────────────────────────────────────────

  registerAutosaveIpc(ipcMain, autosave);

  registerSettingsIpc({
    handle: (channel, handler) => ipcMain.handle(channel, handler),
    getVersion: () => app.getVersion(),
    getUserDataPath: () => app.getPath("userData"),
    readFile: fs.readFile,
    writeFile: fs.writeFile,
    isEncryptionSecure,
  });

  registerCredentialIpc({
    handle: (channel, handler) => ipcMain.handle(channel, handler),
    listCredentials: listCredentialRecords,
    getDefinitions: getCredentialDefinitions,
    getValues: getCredentialValues,
    saveCredential: saveCredentialRecord,
    deleteCredential: deleteCredentialRecord,
    isEncryptionSecure,
  });

  registerPublishIpc({
    handle: (channel, handler) => ipcMain.handle(channel, handler),
    getAllPublishers,
    getPublisher,
    loadCredentials: loadPublishCredentials,
    saveCredentials: savePublishCredentials,
    deleteCredentials: deletePublishCredentials,
    resolveSensitiveValues,
    maskApiKey,
  });

  registerAiIpc({
    handle: (channel, handler) => ipcMain.handle(channel, handler),
    buildSystemPrompt,
    chat: aiChat,
    cliBinaryNames: CLI_BINARY_NAMES,
    detectCliProvider,
    createOpenCodeClient: async () => {
      const { createOpencodeClient } = await import("@opencode-ai/sdk");
      return createOpencodeClient({ baseUrl: "http://127.0.0.1:4096" });
    },
    loadConfig: aiLoadConfig,
    saveConfig: aiSaveConfig,
    maskApiKey,
    maskedKeyPrefix: MASKED_KEY_PREFIX,
    fetchAvailableModels,
    staticModels: PROVIDER_MODELS,
    loadApiKeyForProvider,
    fetchModelsForProvider,
  });

  projectService = registerProjectRuntime({
    userDataPath: app.getPath("userData"),
    documentsPath: app.getPath("documents"),
    sessions: projectSessions,
    transfers: projectTransfers,
    projectFiles,
    autosave,
    googleFonts,
    getMainWindow: windowController.getMainWindow,
    getLifecycleController: windowController.getLifecycleController,
    setCurrentProjectDirectory: (directory) => {
      currentProjectDir = directory;
    },
    showSaveDialog: (mainWindow, options) => mainWindow === null
      ? dialog.showSaveDialog(options)
      : dialog.showSaveDialog(mainWindow, options),
    showOpenDialog: (mainWindow, options) => mainWindow === null
      ? dialog.showOpenDialog(options)
      : dialog.showOpenDialog(mainWindow, options),
    inspectProjectMetadata,
    resolveSystemFontPath: resolveMainSystemFontPath,
    createRecentProjectsStore,
    createProjectService,
    registerProjectIpc,
    registerProjectResources: registerProjectResourceIpc,
    handle: (channel, handler) => ipcMain.handle(channel, handler),
    removeHandler: (channel) => ipcMain.removeHandler(channel),
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

if (hasSingleInstanceLock) app.on("second-instance", () => {
  focusSecondInstance(windowController.getMainWindow());
});

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  await cleanupStaleOwnedWorkspaces(app.getPath("userData"));
  registerAppProtocols({
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    moduleDirectory: __dirname,
    handle: (scheme, handler) => protocol.handle(scheme, handler),
    exists: existsSync,
    readFile: fs.readFile,
    sessions: projectSessions,
    getMimeType,
  });
  registerIpcHandlers();
  await windowController.createWindow();

  const mainWindow = windowController.getMainWindow();
  if (mainWindow) {
    const menu = buildAppMenu(mainWindow, false);
    Menu.setApplicationMenu(menu);
  }

  app.on("activate", () => {
    if (BrowserWindowCtor.getAllWindows().length === 0) {
      windowController.createWindow();
    }
  });
});

app.on("before-quit", (event) => {
  const controller = windowController.getLifecycleController();
  if (!hasSingleInstanceLock || controller === null || controller.canQuit()) return;
  if (windowController.getMainWindow() === null) return;
  event.preventDefault();
  controller.request("quit");
});

app.on("window-all-closed", () => {
  autosave.stop();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
