import { dialog, ipcMain } from "electron";
import { z } from "zod";
import { canonicalizePortablePath } from "../../shared/projects/assetReference";
import { parseLegacyProjectDocument } from "../../shared/projects/projectDocumentSchema";
import { WorkspaceGenerationSchema } from "../../shared/projects/projectIpcContract";
import { reviewProjectAssetUsage } from "../../shared/projects/projectAssetUsage";
import { AssetCleanup } from "./assetCleanup";
import { batchRepairAssets } from "./batchRepairAssets";
import { assertTrustedMainFrame } from "./projectIpcSecurity";
import {
  canceledMutation,
  runMutationBoundary,
} from "./projectMutationBoundary";
import { runProjectMutation } from "./projectMutation";
import {
  resourceMutationContext,
  type ProjectResourceContext,
} from "./projectResourceContext";

const pathsSchema = z.array(z.string().max(4096)).max(10000);
export function registerAssetMaintenanceIpc(
  context: ProjectResourceContext,
): void {
  const cleanup = new AssetCleanup();
  const install = (
    channel: string,
    handler: Parameters<typeof ipcMain.handle>[1],
  ): void => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, handler);
  };
  install("assets:repairMany", async (event, request: unknown) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    return runMutationBoundary(
      context.sessions,
      request,
      async (expectedSessionId) => {
        const parsed = z.object({ relativePaths: pathsSchema }).parse(request);
        const targets = [
          ...new Set(parsed.relativePaths.map(canonicalizePortablePath)),
        ];
        if (
          !targets.length ||
          targets.some((target) => !target.startsWith("assets/"))
        )
          throw new TypeError("Select missing project assets");
        const mutation = resourceMutationContext(context, expectedSessionId);
        const mainWindow = context.getMainWindow();
        if (!mainWindow) throw new TypeError("Main window not available");
        const selected = await dialog.showOpenDialog(mainWindow, {
          title:
            "Select replacement files — matching filenames will be repaired",
          properties: ["openFile", "multiSelections"],
        });
        if (selected.canceled || !selected.filePaths.length)
          return canceledMutation(context.sessions, expectedSessionId);
        if (selected.filePaths.length > 10000)
          throw new TypeError("Select up to 10,000 replacements per batch");
        return runProjectMutation(mutation.context, () =>
          batchRepairAssets(
            mutation.workspacePath,
            targets,
            selected.filePaths,
          ),
        );
      },
    );
  });
  install("assets:cleanupUnused", async (event, request: unknown) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    return runMutationBoundary(
      context.sessions,
      request,
      async (expectedSessionId) => {
        const parsed = z
          .object({
            snapshot: z.unknown(),
            workspaceGeneration: WorkspaceGenerationSchema,
            keys: pathsSchema,
          })
          .parse(request);
        const snapshot = parseLegacyProjectDocument(parsed.snapshot);
        const mutation = resourceMutationContext(context, expectedSessionId);
        return runProjectMutation(mutation.context, async () => {
          if (
            context.sessions.active.generations.workspace !==
            parsed.workspaceGeneration
          )
            throw new TypeError(
              "Project assets changed. Recheck before cleanup.",
            );
          const paths = await context.projectFiles.listAssetPaths(
            mutation.workspacePath,
          );
          const review = reviewProjectAssetUsage(
            snapshot,
            paths,
            expectedSessionId,
          );
          const keys = new Set(parsed.keys);
          const entries = review.candidates.filter((entry) =>
            keys.has(entry.key),
          );
          if (!keys.size || entries.length !== keys.size)
            throw new TypeError(
              "Some selected assets are used or changed. Recheck before cleanup.",
            );
          return cleanup.move(
            mutation.workspacePath,
            expectedSessionId,
            entries,
          );
        });
      },
    );
  });
  install("assets:undoCleanup", async (event, request: unknown) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    return runMutationBoundary(
      context.sessions,
      request,
      async (expectedSessionId) => {
        const { token } = z.object({ token: z.string().uuid() }).parse(request);
        const mutation = resourceMutationContext(context, expectedSessionId);
        return runProjectMutation(mutation.context, () =>
          cleanup.undo(mutation.workspacePath, expectedSessionId, token),
        );
      },
    );
  });
}
