import * as fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dialog, ipcMain } from "electron";
import { canonicalizePortablePath } from "../../shared/projects/assetReference";
import { canceledMutation, runMutationBoundary } from "./projectMutationBoundary";
import { copyFilesAtomically, runFileCopyMutation, runProjectMutation } from "./projectMutation";
import { assertTrustedMainFrame } from "./projectIpcSecurity";
import { resolveMutationPath } from "./mutationPath";
import {
  importedAsset,
  resourceMutationContext,
  type ProjectResourceContext,
} from "./projectResourceContext";

const imageExtensions = [
  "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif", "apng", "tif", "tiff",
];

export const registerAssetMutationIpc = (context: ProjectResourceContext): void => {
  const install = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]): void => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, handler);
  };

  install("assets:selectImage", async (event, request: unknown) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    return runMutationBoundary(context.sessions, request, async (expectedSessionId) => {
      const mutation = resourceMutationContext(context, expectedSessionId);
      const mainWindow = context.getMainWindow();
      if (mainWindow === null) throw new TypeError("Main window not available");
      const selected = await dialog.showOpenDialog(mainWindow, {
        title: "Select Image(s)",
        filters: [{ name: "Images", extensions: imageExtensions }],
        properties: ["openFile", "multiSelections"],
      });
      if (selected.canceled || selected.filePaths.length === 0) {
        return canceledMutation(context.sessions, expectedSessionId);
      }
      return runFileCopyMutation(
        mutation.context,
        mutation.workspacePath,
        "assets",
        selected.filePaths,
        (files) => files.map((file) => importedAsset(expectedSessionId, file, "image")),
      );
    });
  });

  install("assets:selectSingleImage", async (event, request: unknown) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    return runMutationBoundary(context.sessions, request, async (expectedSessionId) => {
      const mutation = resourceMutationContext(context, expectedSessionId);
      const mainWindow = context.getMainWindow();
      if (mainWindow === null) throw new TypeError("Main window not available");
      const selected = await dialog.showOpenDialog(mainWindow, {
        title: "Select Image",
        filters: [{ name: "Images", extensions: imageExtensions }],
        properties: ["openFile"],
      });
      if (selected.canceled || selected.filePaths.length === 0) {
        return canceledMutation(context.sessions, expectedSessionId);
      }
      const sourcePath = selected.filePaths[0];
      if (sourcePath === undefined) throw new TypeError("selected image path is missing");
      return runProjectMutation(mutation.context, async () => {
        const file = (await copyFilesAtomically(mutation.workspacePath, "assets", [sourcePath]))[0];
        if (file === undefined) throw new TypeError("image import produced no file");
        return importedAsset(expectedSessionId, file, "image");
      });
    });
  });

  install("assets:selectVideo", async (event, request: unknown) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    return runMutationBoundary(context.sessions, request, async (expectedSessionId) => {
      const mutation = resourceMutationContext(context, expectedSessionId);
      const mainWindow = context.getMainWindow();
      if (mainWindow === null) throw new TypeError("Main window not available");
      const selected = await dialog.showOpenDialog(mainWindow, {
        title: "Select Video",
        filters: [{ name: "Videos", extensions: ["mp4", "webm", "ogv", "ogg", "mov", "m4v", "wav"] }],
        properties: ["openFile"],
      });
      if (selected.canceled || selected.filePaths.length === 0) {
        return canceledMutation(context.sessions, expectedSessionId);
      }
      return runProjectMutation(mutation.context, async () => (
        await copyFilesAtomically(mutation.workspacePath, "assets", selected.filePaths)
      ).map((file) => importedAsset(expectedSessionId, file, "video")));
    });
  });

  install("assets:delete", async (event, request: unknown) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    return runMutationBoundary(context.sessions, request, async (expectedSessionId) => {
      if (typeof request !== "object" || request === null || !("relativePath" in request) || typeof request.relativePath !== "string") {
        throw new TypeError("relativePath is required");
      }
      const relativePath = canonicalizePortablePath(request.relativePath);
      if (!relativePath.startsWith("assets/")) throw new TypeError("only project assets can be deleted");
      const mutation = resourceMutationContext(context, expectedSessionId);
      return runProjectMutation(mutation.context, async () => {
        const fullPath = await resolveMutationPath(mutation.workspacePath, relativePath);
        const backupRelativePath = `${relativePath}.amagon-delete-${randomUUID()}`;
        const backupPath = await resolveMutationPath(mutation.workspacePath, backupRelativePath);
        await fs.rename(fullPath, backupPath);
        await fs.rm(await resolveMutationPath(mutation.workspacePath, backupRelativePath));
        return null;
      });
    });
  });

  ipcMain.removeHandler("assets:import");
};
