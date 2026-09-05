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

  ipcMain.handle("menu:setProjectLoaded", (_, isLoaded: boolean) => {
    const mainWindow = windowController.getMainWindow();
    if (mainWindow) {
      const menu = buildAppMenu(mainWindow, isLoaded);
      Menu.setApplicationMenu(menu);
    }
  });

  // ── Font Management ───────────────────────────────────────────────────

  ipcMain.handle("fonts:listSystem", async (event) => {
    assertTrustedMainFrame(event, windowController.getMainWindow());
    try {
      const fonts = await getFonts();
      return { success: true, fonts };
    } catch (error: any) {
      return { success: false, error: error.message, fonts: [] };
    }
  });

  ipcMain.handle(
    "fonts:fetchGoogleFontCss",
    async (event, args: { family: string; weight: string; style: string }) => {
      assertTrustedMainFrame(event, windowController.getMainWindow());
      if (!args?.family || typeof args.family !== "string") {
        return { success: false, error: "family required", css: "" };
      }

      try {
        const family = args.family.trim();
        const style =
          String(args?.style || "normal").toLowerCase() === "italic"
            ? "italic"
            : "normal";
        const weightRaw = String(args?.weight || "400");
        const weightMatch = weightRaw.match(/\d{3}/);
        const weight = weightMatch ? weightMatch[0] : "400";
        const italic = style === "italic" ? "1" : "0";

        const encodedFamily = encodeURIComponent(family).replace(/%20/g, "+");
        const cssUrl = `https://fonts.googleapis.com/css2?family=${encodedFamily}:ital,wght@${italic},${weight}&display=swap`;
        const css = await googleFonts.fetchText(cssUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
        });
        return { success: true, css };
      } catch (error: any) {
        return { success: false, error: error.message, css: "" };
      }
    },
  );

  ipcMain.handle(
    "fonts:fetchGoogleFontFile",
    async (event, args: { url: string }) => {
      assertTrustedMainFrame(event, windowController.getMainWindow());
      if (!args?.url || typeof args.url !== "string") {
        return { success: false, error: "url required", dataUri: "" };
      }

      try {
        const url = args.url.trim();
        if (!googleFonts.isAllowedUrl(url)) {
          return {
            success: false,
            error: "Unexpected font URL origin (blocked)",
            dataUri: "",
          };
        }

        const { filePath, mimeType } = await googleFonts.cacheFile(url);
        const data = await fs.readFile(filePath);
        const base64 = data.toString("base64");
        return {
          success: true,
          dataUri: `data:${mimeType};base64,${base64}`,
        };
      } catch (error: any) {
        return { success: false, error: error.message, dataUri: "" };
      }
    },
  );

  ipcMain.handle(
    "fonts:checkFileExists",
    async (event, args: { relativePath: string }) => {
      assertTrustedMainFrame(event, windowController.getMainWindow());
      if (!currentProjectDir) return { exists: false };
      if (!args?.relativePath) return { exists: false };

      const rel = String(args.relativePath)
        .replace(/^[/\\]+/, "")
        .replace(/\\/g, "/");
      const targetPath = path.join(currentProjectDir, rel);

      if (!isPathSafe(targetPath, currentProjectDir)) return { exists: false };

      return { exists: existsSync(targetPath) };
    },
  );

  ipcMain.handle("fonts:listProject", async (event) => {
    assertTrustedMainFrame(event, windowController.getMainWindow());
    if (!currentProjectDir) return { success: true, fonts: [] };

    try {
      const fontsDir = path.join(currentProjectDir, "assets", "fonts");
      try {
        await fs.access(fontsDir);
      } catch {
        return { success: true, fonts: [] };
      }

      const entries = await fs.readdir(fontsDir);
      const FONT_EXTS = new Set([".ttf", ".otf", ".woff", ".woff2"]);

      const fonts: any[] = entries
        .filter((f) => FONT_EXTS.has(path.extname(f).toLowerCase()))
        .map((fileName) => {
          const ext = path.extname(fileName).slice(1) as
            | "ttf"
            | "otf"
            | "woff"
            | "woff2";
          const relativePath = `assets/fonts/${fileName}`;
          return {
            id: `font_${Buffer.from(relativePath).toString("base64url").slice(0, 12)}`,
            name: path.basename(fileName, path.extname(fileName)),
            fileName,
            relativePath,
            format: ext,
            weight: "400",
            style: "normal",
            source: "imported",
          };
        });

      return { success: true, fonts };
    } catch (error: any) {
      return { success: false, error: error.message, fonts: [] };
    }
  });

  // ── Export HTML ────────────────────────────────────────────────────────

  ipcMain.handle(
    "project:exportHtml",
    async (_, data: { html: string; defaultPath?: string }) => {
      try {
        const { canceled, filePath } = await dialog.showSaveDialog(
          windowController.getMainWindow()!,
          {
            title: "Export HTML",
            defaultPath: path.join(
              app.getPath("documents"),
              data.defaultPath || "index.html",
            ),
            filters: [{ name: "HTML Files", extensions: ["html", "htm"] }],
          },
        );

        if (canceled || !filePath) return { success: false, canceled: true };

        await fs.writeFile(filePath, data.html, "utf-8");
        return { success: true, filePath };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // ── Export Site (multi-file) ───────────────────────────────────────────

  ipcMain.handle(
    "project:exportSite",
    async (
      _,
      data: {
        files: { path: string; content: string | Uint8Array }[];
        defaultDirName?: string;
        previewFile?: string;
      },
    ) => {
      try {
        const { canceled, filePaths } = await dialog.showOpenDialog(
          windowController.getMainWindow()!,
          {
            title: "Choose Export Directory",
            defaultPath: app.getPath("documents"),
            properties: ["openDirectory", "createDirectory"],
          },
        );

        if (canceled || filePaths.length === 0)
          return { success: false, canceled: true };

        const baseDir = filePaths[0];
        const dirName = (data.defaultDirName || "").trim();
        const exportDir = dirName ? path.join(baseDir, dirName) : baseDir;

        await fs.mkdir(exportDir, { recursive: true });

        const total = Array.isArray(data.files) ? data.files.length : 0;
        let written = 0;

        for (const file of data.files || []) {
          const rel = String(file.path || "").replace(/^[/\\]+/, "");
          if (!rel) continue;

          if (path.isAbsolute(rel)) {
            continue;
          }

          const normalizedRel = path.normalize(rel);
          const targetPath = path.join(exportDir, normalizedRel);

          if (!isPathSafe(targetPath, exportDir)) {
            continue;
          }

          await fs.mkdir(path.dirname(targetPath), { recursive: true });

          const content: any = (file as any).content;
          if (typeof content === "string") {
            await fs.writeFile(targetPath, content, "utf-8");
          } else if (content && typeof content === "object") {
            // Handle Uint8Array or Buffer-like
            if (content.type === "Buffer" && Array.isArray(content.data)) {
              await fs.writeFile(targetPath, Buffer.from(content.data));
            } else {
              await fs.writeFile(
                targetPath,
                Buffer.from(content as Uint8Array),
              );
            }
          } else {
            await fs.writeFile(targetPath, "");
          }

          written++;
          const mainWindow = windowController.getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send("project:exportProgress", {
              written,
              total,
              path: normalizedRel,
            });
          }
        }

        const previewRel = (data.previewFile || "index.html").replace(
          /^[/\\]+/,
          "",
        );
        const previewPath = path.join(exportDir, path.normalize(previewRel));
        const safePreview = isPathSafe(previewPath, exportDir)
          ? previewPath
          : undefined;

        return {
          success: true,
          directory: exportDir,
          previewPath: safePreview,
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // ── Preview (open exported HTML in default browser) ────────────────────

  ipcMain.handle("project:openInBrowser", async (_, filePath: string) => {
    try {
      const target = String(filePath || "");
      if (!target) return { success: false, error: "No file path provided" };

      const isExternalUrl = /^https?:\/\//i.test(target);
      if (isExternalUrl) {
        await shell.openExternal(target);
        return { success: true };
      }

      const err = await shell.openPath(target);
      if (err) return { success: false, error: err };
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── List project assets ───────────────────────────────────────────────

  ipcMain.handle("assets:list", async (event) => {
    assertTrustedMainFrame(event, windowController.getMainWindow());
    try {
      const workspacePath = projectSessions.active.workspacePath;
      const sessionId = projectSessions.active.id;
      if (workspacePath === null || sessionId === null) {
        return { success: true, assets: [] };
      }

      const assetsDir = path.join(workspacePath, "assets");
      if (!existsSync(assetsDir)) {
        return { success: true, assets: [] };
      }

      const entries = await fs.readdir(assetsDir, { withFileTypes: true });
      const imageExts = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".svg",
        ".bmp",
        ".ico",
        ".avif",
        ".apng",
        ".tif",
        ".tiff",
      ];
      const videoExts = [".mp4", ".webm", ".ogv", ".ogg", ".mov", ".m4v"];
      const assets = entries
        .filter(
          (e) =>
            e.isFile() &&
            (imageExts.includes(path.extname(e.name).toLowerCase()) ||
              videoExts.includes(path.extname(e.name).toLowerCase())),
        )
        .map((e) => {
          const ext = path.extname(e.name).toLowerCase();
          const type = imageExts.includes(ext) ? "image" : "video";
          const relativePath = `assets/${e.name}`;
          return {
            name: e.name,
            path: buildRuntimeAssetUrl(sessionId, relativePath),
            relativePath,
            type,
          };
        });

      return { success: true, assets };
    } catch (error: any) {
      return { success: false, error: error.message, assets: [] };
    }
  });

  ipcMain.handle("assets:readFileAsBase64", async (event, reference: string) => {
    assertTrustedMainFrame(event, windowController.getMainWindow());
    try {
      const input = String(reference || "");
      if (!input) return { success: false, error: "No file path provided" };

      const maxBytes = 5 * 1024 * 1024;

      if (/^https?:\/\//i.test(input)) {
        return {
          success: false,
          error: "Remote URLs cannot be read through the local project asset bridge",
        };
      }

      if (input.startsWith("blob:")) {
        return {
          success: false,
          error:
            "Blob URLs are not supported for base64 embedding in Electron mode. Please re-browse the file.",
        };
      }

      if (projectService === null) return { success: false, error: "Project service unavailable" };
      const readable = await projectService.resolveAssetRead(input);
      try {
        const stats = await fs.stat(readable.filePath);
        const sizeMB = stats.size / (1024 * 1024);
        if (stats.size > maxBytes) {
          return {
            success: false,
            error: `File is too large (${sizeMB.toFixed(1)}MB). Max 5MB for base64 embedding.`,
          };
        }
        const data = await fs.readFile(readable.filePath);
        const mime = getMimeType(readable.filePath);
        return {
          success: true,
          data: `data:${mime};base64,${data.toString("base64")}`,
          mimeType: mime,
        };
      } finally {
        readable.release();
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Read asset as base64 (for preview / export) ───────────────────────

  ipcMain.handle("assets:readAsset", async (event, reference: string) => {
    assertTrustedMainFrame(event, windowController.getMainWindow());
    try {
      if (projectService === null) return { success: false, error: "Project service unavailable" };
      const readable = await projectService.resolveAssetRead(reference);
      try {
        const stats = await fs.stat(readable.filePath);
        if (stats.size > 5 * 1024 * 1024) return { success: false, error: "File exceeds the 5MB base64 limit" };
        const data = await fs.readFile(readable.filePath);
        const mime = getMimeType(readable.filePath);
        return { success: true, data: `data:${mime};base64,${data.toString("base64")}`, mimeType: mime };
      } finally {
        readable.release();
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "asset read failed" };
    }
  });

  // ── Auto-save configuration ───────────────────────────────────────────

  registerAutosaveIpc(ipcMain, autosave);

  // ── App Settings ───────────────────────────────────────────────────────

  ipcMain.handle("app:getVersion", () => {
    return { success: true, version: app.getVersion() };
  });

  ipcMain.handle("app:getSettings", async () => {
    try {
      const filePath = path.join(app.getPath("userData"), "app-settings.json");
      const raw = await fs.readFile(filePath, "utf-8");
      const settings = JSON.parse(raw);
      return { success: true, settings };
    } catch {
      return { success: true, settings: null };
    }
  });

  ipcMain.handle("app:saveSettings", async (_, patch: any) => {
    try {
      const filePath = path.join(app.getPath("userData"), "app-settings.json");
      let existing = {};
      try {
        const raw = await fs.readFile(filePath, "utf-8");
        existing = JSON.parse(raw);
      } catch {
        // file doesn't exist yet, ignore
      }
      const updated = { ...existing, ...patch };
      await fs.writeFile(filePath, JSON.stringify(updated, null, 2), "utf-8");
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Encryption status ────────────────────────────────────────────────

  ipcMain.handle("app:isEncryptionSecure", () => {
    return { secure: isEncryptionSecure() };
  });

  // ── Credential Manager ──────────────────────────────────────────────

  ipcMain.handle("app:getCredentials", async () => {
    try {
      const credentials = await listCredentialRecords();
      return {
        success: true,
        credentials,
        definitions: getCredentialDefinitions(),
        secure: isEncryptionSecure(),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("app:getCredentialDefinitions", async () => {
    try {
      return { success: true, definitions: getCredentialDefinitions() };
    } catch (error: any) {
      return { success: false, error: error.message, definitions: [] };
    }
  });

  ipcMain.handle("app:getCredentialValues", async (_, id: string) => {
    try {
      return { success: true, values: await getCredentialValues(id) };
    } catch (error: any) {
      return { success: false, error: error.message, values: {} };
    }
  });

  ipcMain.handle(
    "app:saveCredential",
    async (_, data: { id: string; values: PublishCredentials }) => {
      try {
        await saveCredentialRecord(data.id, data.values);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle("app:deleteCredential", async (_, id: string) => {
    try {
      await deleteCredentialRecord(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
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
