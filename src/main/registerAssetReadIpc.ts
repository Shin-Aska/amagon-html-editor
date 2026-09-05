import * as path from "path";
import type { ProjectPersistenceService } from "./projects/projectServiceTypes";
import type { ProjectSessionRegistry } from "./projects/projectSession";
import { assertTrustedMainFrame } from "./projects/projectIpcSecurity";

type IpcEvent = Parameters<typeof assertTrustedMainFrame>[0];
type MainWindow = Parameters<typeof assertTrustedMainFrame>[1];
type Handler = (event: IpcEvent, argument?: unknown) => unknown;

interface DirectoryEntry {
  readonly name: string;
  readonly isFile: () => boolean;
}

export interface AssetReadIpcContext {
  readonly handle: (channel: string, handler: Handler) => void;
  readonly getMainWindow: () => MainWindow;
  readonly sessions: ProjectSessionRegistry;
  readonly getProjectService: () => Pick<ProjectPersistenceService, "resolveAssetRead"> | null;
  readonly exists: (filePath: string) => boolean;
  readonly readDirectory: (directory: string) => Promise<readonly DirectoryEntry[]>;
  readonly stat: (filePath: string) => Promise<{ readonly size: number }>;
  readonly readFile: (filePath: string) => Promise<Buffer>;
  readonly buildRuntimeAssetUrl: (sessionId: string, assetPath: string) => string;
  readonly getMimeType: (filePath: string) => string;
}

const IMAGE_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif", ".apng", ".tif", ".tiff",
];
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogv", ".ogg", ".mov", ".m4v"];
const MAX_BASE64_BYTES = 5 * 1024 * 1024;
const errorMessage = (error: unknown, fallback?: string): string => (
  error instanceof Error ? error.message : fallback ?? String(error)
);

export const registerAssetReadIpc = (context: AssetReadIpcContext): void => {
  context.handle("assets:list", async (event) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      const { workspacePath, id: sessionId } = context.sessions.active;
      if (workspacePath === null || sessionId === null) return { success: true, assets: [] };
      const assetsDirectory = path.join(workspacePath, "assets");
      if (!context.exists(assetsDirectory)) return { success: true, assets: [] };
      const entries = await context.readDirectory(assetsDirectory);
      const assets = entries
        .filter((entry) => {
          const extension = path.extname(entry.name).toLowerCase();
          return entry.isFile() && (IMAGE_EXTENSIONS.includes(extension) || VIDEO_EXTENSIONS.includes(extension));
        })
        .map((entry) => {
          const extension = path.extname(entry.name).toLowerCase();
          const relativePath = `assets/${entry.name}`;
          return {
            name: entry.name,
            path: context.buildRuntimeAssetUrl(sessionId, relativePath),
            relativePath,
            type: IMAGE_EXTENSIONS.includes(extension) ? "image" : "video",
          };
        });
      return { success: true, assets };
    } catch (error) {
      return { success: false, error: errorMessage(error), assets: [] };
    }
  });

  context.handle("assets:readFileAsBase64", async (event, reference) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      const input = String(reference || "");
      if (!input) return { success: false, error: "No file path provided" };
      if (/^https?:\/\//i.test(input)) {
        return { success: false, error: "Remote URLs cannot be read through the local project asset bridge" };
      }
      if (input.startsWith("blob:")) {
        return {
          success: false,
          error: "Blob URLs are not supported for base64 embedding in Electron mode. Please re-browse the file.",
        };
      }
      const service = context.getProjectService();
      if (service === null) return { success: false, error: "Project service unavailable" };
      const readable = await service.resolveAssetRead(input);
      try {
        const stats = await context.stat(readable.filePath);
        if (stats.size > MAX_BASE64_BYTES) {
          const sizeMegabytes = stats.size / (1024 * 1024);
          return { success: false, error: `File is too large (${sizeMegabytes.toFixed(1)}MB). Max 5MB for base64 embedding.` };
        }
        const data = await context.readFile(readable.filePath);
        const mimeType = context.getMimeType(readable.filePath);
        return { success: true, data: `data:${mimeType};base64,${data.toString("base64")}`, mimeType };
      } finally {
        readable.release();
      }
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });

  context.handle("assets:readAsset", async (event, reference) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      const service = context.getProjectService();
      if (service === null) return { success: false, error: "Project service unavailable" };
      const readable = await service.resolveAssetRead(String(reference));
      try {
        const stats = await context.stat(readable.filePath);
        if (stats.size > MAX_BASE64_BYTES) return { success: false, error: "File exceeds the 5MB base64 limit" };
        const data = await context.readFile(readable.filePath);
        const mimeType = context.getMimeType(readable.filePath);
        return { success: true, data: `data:${mimeType};base64,${data.toString("base64")}`, mimeType };
      } finally {
        readable.release();
      }
    } catch (error) {
      return { success: false, error: errorMessage(error, "asset read failed") };
    }
  });
};
