import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { dialog, ipcMain } from "electron";
import { canonicalizePortablePath } from "../../shared/projects/assetReference";
import type { FontAsset } from "../../renderer/store/types";
import { downloadAndImportMedia } from "../mediaDownload";
import { copyFilesAtomically, runFileCopyMutation, runProjectMutation } from "./projectMutation";
import { canceledMutation, runMutationBoundary } from "./projectMutationBoundary";
import { assertTrustedMainFrame } from "./projectIpcSecurity";
import { importedFont, resourceMutationContext, type ProjectResourceContext } from "./projectResourceContext";
import { runCancellableTransferBatch } from "./projectTransferRegistry";

type RequestedFontVariant = {
  readonly weight: string;
  readonly style: string;
};

const parseVariants = (request: object): readonly RequestedFontVariant[] => {
  if (!("variants" in request) || !Array.isArray(request.variants)) throw new TypeError("font variants are required");
  return request.variants.map((variant) => {
    if (
      typeof variant !== "object" || variant === null
      || !("weight" in variant) || typeof variant.weight !== "string"
      || !("style" in variant) || typeof variant.style !== "string"
    ) throw new TypeError("font variant is invalid");
    return { weight: variant.weight, style: variant.style };
  });
};

export const registerFontMutationIpc = (context: ProjectResourceContext): void => {
  const install = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]): void => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, handler);
  };

  install("fonts:importFile", async (event, request: unknown) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    return runMutationBoundary(context.sessions, request, async (expectedSessionId) => {
      const mainWindow = context.getMainWindow();
      if (mainWindow === null) throw new TypeError("Main window not available");
      const selected = await dialog.showOpenDialog(mainWindow, {
        title: "Import Font Files",
        filters: [{ name: "Font Files", extensions: ["ttf", "otf", "woff", "woff2"] }],
        properties: ["openFile", "multiSelections"],
      });
      if (selected.canceled || selected.filePaths.length === 0) {
        return canceledMutation(context.sessions, expectedSessionId);
      }
      const mutation = resourceMutationContext(context, expectedSessionId);
      return runFileCopyMutation(
        mutation.context,
        mutation.workspacePath,
        "assets/fonts",
        selected.filePaths,
        (files) => files.map((file) => importedFont(file, path.basename(file.fileName, path.extname(file.fileName)), "imported")),
      );
    });
  });

  install("fonts:copySystemFont", async (event, request: unknown) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    return runMutationBoundary(context.sessions, request, async (expectedSessionId) => {
      if (typeof request !== "object" || request === null || !("familyName" in request) || typeof request.familyName !== "string") {
        throw new TypeError("familyName is required");
      }
      const familyName = request.familyName;
      const mutation = resourceMutationContext(context, expectedSessionId);
      return runProjectMutation(mutation.context, async () => {
        const sourcePath = await context.resolveSystemFontPath(familyName);
        if (sourcePath === null) {
          return [{
            id: `font_${randomUUID()}`,
            name: familyName,
            fileName: "",
            relativePath: "",
            format: "ttf",
            weight: "400",
            style: "normal",
            source: "system",
          } satisfies FontAsset];
        }
        const files = await copyFilesAtomically(mutation.workspacePath, "assets/fonts", [sourcePath]);
        return files.map((file) => importedFont(file, familyName, "system"));
      });
    });
  });

  install("fonts:downloadGoogleFont", async (event, request: unknown) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    return runMutationBoundary(context.sessions, request, async (expectedSessionId) => {
      if (typeof request !== "object" || request === null || !("family" in request) || typeof request.family !== "string") {
        throw new TypeError("font family is required");
      }
      const variants = parseVariants(request);
      const family = request.family.trim();
      const mutation = resourceMutationContext(context, expectedSessionId);
      return runProjectMutation(mutation.context, async () => context.transfers.run(expectedSessionId, async (signal) => {
        const completed: string[] = [];
        try {
          return await runCancellableTransferBatch(signal, variants, async (variant) => {
            const style = variant.style.toLowerCase() === "italic" ? "italic" : "normal";
            const weight = variant.weight.match(/\d{3}/u)?.[0] ?? "400";
            const encodedFamily = encodeURIComponent(family).replace(/%20/gu, "+");
            const slug = family.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "font";
            const css = await context.fetchGoogleFontsText(
              `https://fonts.googleapis.com/css2?family=${encodedFamily}:ital,wght@${style === "italic" ? "1" : "0"},${weight}&display=swap`,
              { headers: { "User-Agent": "Mozilla/5.0" }, signal },
            );
            const sourceUrl = css.match(/src:\s*url\(([^)]+)\)/iu)?.[1]?.trim().replace(/^["']|["']$/gu, "");
            if (sourceUrl === undefined || !sourceUrl.startsWith("https://fonts.gstatic.com/")) {
              throw new TypeError("Google Fonts returned an invalid font URL");
            }
            const downloaded = await downloadAndImportMedia({
              url: sourceUrl,
              projectDir: mutation.workspacePath,
              filename: `${slug}-${weight}-${style}`,
              signal,
              maxBytes: context.googleFontsMaxBytes,
              relativeDirectory: "assets/fonts",
            });
            if (!downloaded.success || downloaded.relativePath === undefined) {
              throw new TypeError(downloaded.error ?? "Google Font download failed");
            }
            completed.push(downloaded.relativePath);
            return importedFont({ fileName: path.basename(downloaded.relativePath), relativePath: downloaded.relativePath }, family, "google-fonts", weight, style);
          });
        } catch (error) {
          await Promise.all(completed.map((relativePath) => fs.rm(path.join(mutation.workspacePath, ...relativePath.split("/")), { force: true })));
          throw error;
        }
      }));
    });
  });

  install("fonts:deleteFont", async (event, request: unknown) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    return runMutationBoundary(context.sessions, request, async (expectedSessionId) => {
      if (typeof request !== "object" || request === null || !("relativePath" in request) || typeof request.relativePath !== "string") {
        throw new TypeError("relativePath is required");
      }
      const relativePath = canonicalizePortablePath(request.relativePath);
      if (!relativePath.startsWith("assets/fonts/")) throw new TypeError("only project fonts can be deleted");
      const mutation = resourceMutationContext(context, expectedSessionId);
      return runProjectMutation(mutation.context, async () => {
        const target = path.join(mutation.workspacePath, ...relativePath.split("/"));
        const backup = `${target}.amagon-delete-${randomUUID()}`;
        await fs.rename(target, backup);
        await fs.rm(backup);
        return null;
      });
    });
  });
};
