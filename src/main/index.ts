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
  type ChatMessage,
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
  type ExportedFile,
  getAllPublishers,
  getPublisher,
  type PublishCredentials,
  type PublishProgress,
  type PublishResult,
  type ValidationResult,
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
// Publish credential helpers
// ---------------------------------------------------------------------------

function buildMaskedCredentials(providerId: string): PublishCredentials {
  const publisher = getPublisher(providerId);
  if (!publisher) {
    return {};
  }

  return publisher.credentialFields.reduce<PublishCredentials>((acc, field) => {
    acc[field.key] = "";
    return acc;
  }, {});
}

async function getMaskedPublishCredentials(
  providerId: string,
): Promise<PublishCredentials> {
  const publisher = getPublisher(providerId);
  if (!publisher) {
    return {};
  }

  const storedCredentials = await loadPublishCredentials(providerId);
  const masked: PublishCredentials = {};

  for (const field of publisher.credentialFields) {
    const value = storedCredentials[field.key] ?? "";
    masked[field.key] = field.sensitive ? maskApiKey(value) : value;
  }

  return masked;
}

function getPublisherOrThrow(providerId: string) {
  const publisher = getPublisher(providerId);
  if (!publisher) {
    throw new Error(`Unknown publish provider: ${providerId}`);
  }
  return publisher;
}

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

  // ── Publish ───────────────────────────────────────────────────────────────

  ipcMain.handle("publish:getProviders", () => {
    return getAllPublishers().map((publisher) => ({
      id: publisher.meta.id,
      displayName: publisher.meta.displayName,
      description: publisher.meta.description,
      credentialFields: publisher.credentialFields.map((field) => ({
        ...field,
      })),
    }));
  });

  ipcMain.handle("publish:getCredentials", async (_, providerId: string) => {
    try {
      return await getMaskedPublishCredentials(providerId);
    } catch {
      return buildMaskedCredentials(providerId);
    }
  });

  ipcMain.handle(
    "publish:saveCredentials",
    async (
      _,
      data: { providerId: string; credentials: PublishCredentials },
    ) => {
      try {
        getPublisherOrThrow(data.providerId);
        await savePublishCredentials(data.providerId, data.credentials);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle("publish:deleteCredentials", async (_, providerId: string) => {
    try {
      getPublisherOrThrow(providerId);
      await deletePublishCredentials(providerId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    "publish:validate",
    async (
      _,
      data: {
        providerId: string;
        files: ExportedFile[];
        credentials?: PublishCredentials;
      },
    ): Promise<ValidationResult> => {
      const publisher = getPublisher(data.providerId);
      if (!publisher) {
        return {
          ok: false,
          issues: [
            {
              severity: "error",
              message: `Unknown publish provider: ${data.providerId}`,
            },
          ],
        };
      }

      const storedCredentials = await loadPublishCredentials(data.providerId);
      const credentials = resolveSensitiveValues(
        publisher.credentialFields,
        storedCredentials,
        data.credentials || {},
      );
      return publisher.validate(data.files, credentials);
    },
  );

  ipcMain.handle(
    "publish:publish",
    async (
      event,
      data: {
        providerId: string;
        files: ExportedFile[];
        credentials?: PublishCredentials;
      },
    ): Promise<PublishResult> => {
      const publisher = getPublisher(data.providerId);
      if (!publisher) {
        return {
          success: false,
          error: `Unknown publish provider: ${data.providerId}`,
          warnings: [],
        };
      }

      const storedCredentials = await loadPublishCredentials(data.providerId);
      const credentials = resolveSensitiveValues(
        publisher.credentialFields,
        storedCredentials,
        data.credentials || {},
      );
      return publisher.publish(
        data.files,
        credentials,
        (progress: PublishProgress) => {
          event.sender.send("publish:progress", progress);
        },
      );
    },
  );

  // ── AI Assistant ─────────────────────────────────────────────────────

  ipcMain.handle(
    "ai:chat",
    async (
      _,
      data: {
        messages: ChatMessage[];
        blockRegistry?: string;
        config?: any;
        themeContext?: { projectTheme?: unknown; uiTheme?: "light" | "dark" };
      },
    ) => {
      try {
        // Prepend system prompt if block registry schema is provided
        let messages = data.messages;
        if (data.blockRegistry) {
          const systemPrompt = buildSystemPrompt(
            data.blockRegistry,
            data.themeContext,
          );
          messages = [
            { role: "system" as const, content: systemPrompt },
            ...messages.filter((m) => m.role !== "system"),
          ];
        }

        const result = await aiChat(messages, data.config);
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true, content: result.content };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle("ai:checkCliAvailability", async () => {
    try {
      const entries = await Promise.all(
        (
          Object.keys(CLI_BINARY_NAMES) as Array<keyof typeof CLI_BINARY_NAMES>
        ).map(
          async (providerId) =>
            [providerId, await detectCliProvider(providerId)] as const,
        ),
      );

      // Also probe OpenCode SDK availability
      let opencodeAvailable = false;
      try {
        const { createOpencodeClient } = await import("@opencode-ai/sdk");
        const client = createOpencodeClient({ baseUrl: "http://127.0.0.1:4096" });
        await client.provider.list();
        opencodeAvailable = true;
      } catch {
        // OpenCode service is not currently running
      }

      return {
        success: true,
        availability: {
          ...Object.fromEntries(entries),
          opencode: { available: opencodeAvailable },
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("ai:getConfig", async () => {
    try {
      const config = await aiLoadConfig();
      // Never send the raw API key to the renderer — mask it
      return {
        success: true,
        config: {
          ...config,
          apiKey: maskApiKey(config.apiKey),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("ai:setConfig", async (_, config: any) => {
    try {
      const configToSave = { ...config };
      // If the renderer sent back a masked key, the user didn't change it
      if (
        configToSave.apiKey &&
        configToSave.apiKey.startsWith(MASKED_KEY_PREFIX)
      ) {
        delete configToSave.apiKey; // preserve existing encrypted key
      }
      const saved = await aiSaveConfig(configToSave);
      return {
        success: true,
        config: {
          ...saved,
          apiKey: maskApiKey(saved.apiKey),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("ai:getModels", async () => {
    try {
      const models = await fetchAvailableModels();
      return { success: true, models };
    } catch {
      // Fall back to static list if dynamic fetch fails entirely
      return { success: true, models: PROVIDER_MODELS };
    }
  });

  ipcMain.handle(
    "ai:fetchModelsForProvider",
    async (
      _event,
      data: {
        provider: string;
        apiKey: string;
        ollamaUrl?: string;
      },
    ) => {
      try {
        let apiKeyToUse = data.apiKey || "";
        // If the renderer sent a masked or empty key, look up the saved key for this specific provider
        if (!apiKeyToUse || apiKeyToUse.startsWith(MASKED_KEY_PREFIX)) {
          apiKeyToUse = await loadApiKeyForProvider(data.provider as any);
        }

        const models = await fetchModelsForProvider(
          data.provider as any,
          apiKeyToUse,
          data.ollamaUrl,
        );
        return { success: true, models };
      } catch (error: any) {
        return { success: false, error: error.message, models: [] };
      }
    },
  );

  projectService = createProjectService({
    userDataPath: app.getPath("userData"),
    documentsPath: app.getPath("documents"),
    dialogs: {
      showSave: async (request) => {
        const mainWindow = windowController.getMainWindow();
        const options = {
          title: request.title,
          defaultPath: request.defaultPath,
          filters: request.filters.map((filter) => ({
            name: filter.name,
            extensions: [...filter.extensions],
          })),
        };
        return mainWindow === null
          ? dialog.showSaveDialog(options)
          : dialog.showSaveDialog(mainWindow, options);
      },
      showOpen: async (request) => {
        const mainWindow = windowController.getMainWindow();
        const options = {
          title: request.title,
          filters: request.filters.map((filter) => ({
            name: filter.name,
            extensions: [...filter.extensions],
          })),
          properties: ["openFile" as const],
        };
        return mainWindow === null
          ? dialog.showOpenDialog(options)
          : dialog.showOpenDialog(mainWindow, options);
      },
    },
    recents: createRecentProjectsStore({
      storagePath: path.join(app.getPath("userData"), "recent-projects.json"),
      inspect: inspectProjectMetadata,
    }),
    sessions: projectSessions,
    files: projectFiles,
    abortSessionTransfers: (sessionId) => projectTransfers.abortSession(sessionId),
    onDirectoryChange: (directory) => {
      currentProjectDir = directory;
      if (directory === null) autosave.stop();
      else autosave.start();
    },
  });
  registerProjectIpc({
    handle: (channel, handler) => {
      ipcMain.handle(channel, (event, argument) => handler(event, argument));
    },
    removeHandler: (channel) => ipcMain.removeHandler(channel),
  }, projectService);
  registerProjectResourceIpc({
    sessions: projectSessions,
    transfers: projectTransfers,
    projectFiles,
    getMainWindow: windowController.getMainWindow,
    resolveSystemFontPath: resolveMainSystemFontPath,
    fetchGoogleFontsText: (url, options) => googleFonts.fetchText(url, options),
    googleFontsMaxBytes: googleFonts.maxResponseBytes,
  });
  ipcMain.handle("project:finish-lifecycle-close", (_event, result: LifecycleResult) => (
    windowController.getLifecycleController()?.finish(result) ?? false
  ));
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
