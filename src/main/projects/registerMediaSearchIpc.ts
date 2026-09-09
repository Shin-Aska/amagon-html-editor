import * as path from "node:path";
import { ipcMain } from "electron";
import { z } from "zod";
import {
  loadConfig,
  maskApiKey,
  MASKED_KEY_PREFIX,
  saveConfig,
} from "../mediaSearchService";
import { searchMedia } from "../mediaProviderSearch";
import { downloadAndImportMedia } from "../mediaDownload";
import { parseProjectSessionId } from "../../shared/projects/projectIpcContract";
import { createMediaDownloadCapabilityRegistry } from "./mediaDownloadCapability";
import { runProjectMutation } from "./projectMutation";
import { runMutationBoundary } from "./projectMutationBoundary";
import { assertTrustedMainFrame } from "./projectIpcSecurity";
import { importedAsset, resourceMutationContext, type ProjectResourceContext } from "./projectResourceContext";

const SearchRequestSchema = z.object({
  query: z.string().trim().min(1),
  perPage: z.number().int().min(1).max(100).optional(),
  page: z.number().int().min(1).optional(),
  type: z.enum(["image", "video"]).optional(),
}).strict();

const ConfigPatchSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(["unsplash", "pexels", "pixabay"]).optional(),
  apiKey: z.string().optional(),
}).strict();

export const registerMediaSearchIpc = (context: ProjectResourceContext): void => {
  const capabilities = createMediaDownloadCapabilityRegistry();
  const install = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]): void => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, handler);
  };

  install("mediaSearch:getConfig", async (event) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      const config = await loadConfig();
      return { success: true, config: { ...config, apiKey: maskApiKey(config.apiKey) } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "media search configuration failed" };
    }
  });

  install("mediaSearch:setConfig", async (event, input: unknown) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      const patch = ConfigPatchSchema.parse(input);
      const configToSave = { ...patch };
      if (configToSave.apiKey?.startsWith(MASKED_KEY_PREFIX)) delete configToSave.apiKey;
      const saved = await saveConfig(configToSave);
      return { success: true, config: { ...saved, apiKey: maskApiKey(saved.apiKey) } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "media search configuration failed" };
    }
  });

  install("mediaSearch:search", async (event, input: unknown) => {
    const senderId = assertTrustedMainFrame(event, context.getMainWindow());
    try {
      const sessionId = parseProjectSessionId(context.sessions.active.id);
      const options = SearchRequestSchema.parse(input);
      const result = await searchMedia(options, await loadConfig());
      if (result.error !== undefined) return result;
      if (context.sessions.active.id !== sessionId) return { results: [], error: "Project session changed during media search" };
      return {
        results: result.results.map((item) => capabilities.issue(sessionId, senderId, item)),
      };
    } catch (error) {
      return { results: [], error: error instanceof Error ? error.message : "media search failed" };
    }
  });

  install("mediaSearch:downloadAndImport", async (event, request: unknown) => {
    const senderId = assertTrustedMainFrame(event, context.getMainWindow());
    return runMutationBoundary(context.sessions, request, async (expectedSessionId) => {
      if (typeof request !== "object" || request === null || !("downloadId" in request)) {
        throw new TypeError("downloadId is required");
      }
      const mediaUrl = capabilities.consume(request.downloadId, expectedSessionId, senderId);
      const mutation = resourceMutationContext(context, expectedSessionId);
      return runProjectMutation(mutation.context, async () => {
        const downloaded = await context.transfers.run(expectedSessionId, (signal) => downloadAndImportMedia({
          url: mediaUrl,
          projectDir: mutation.workspacePath,
          signal,
        }));
        if (!downloaded.success || downloaded.relativePath === undefined) {
          throw new TypeError(downloaded.error ?? "media download failed");
        }
        return importedAsset(expectedSessionId, {
          fileName: path.basename(downloaded.relativePath),
          relativePath: downloaded.relativePath,
        });
      });
    });
  });
};
