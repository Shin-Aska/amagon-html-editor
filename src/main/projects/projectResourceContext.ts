import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { BrowserWindow } from "electron";
import type { FontAsset } from "../../renderer/store/types";
import { buildRuntimeAssetUrl } from "../../shared/projects/assetReference";
import type { AssetInfo, ProjectSessionId } from "../../shared/projects/projectIpcContract";
import { inventoryWithHashes } from "./projectMutation";
import type { ProjectSessionRegistry } from "./projectSession";
import type { ProjectTransferRegistry } from "./projectTransferRegistry";

export type ResourceProjectFiles = {
  readonly listAssetPaths: (workspacePath: string) => Promise<readonly string[]>;
};

export type ProjectResourceContext = {
  readonly sessions: ProjectSessionRegistry;
  readonly transfers: ProjectTransferRegistry;
  readonly projectFiles: ResourceProjectFiles;
  readonly getMainWindow: () => BrowserWindow | null;
  readonly resolveSystemFontPath: (familyName: string) => Promise<string | null>;
  readonly fetchGoogleFontsText: (
    url: string,
    options: { readonly headers: Readonly<Record<string, string>>; readonly signal: AbortSignal },
  ) => Promise<string>;
  readonly googleFontsMaxBytes: number;
};

export const requireWorkspacePath = (context: ProjectResourceContext): string => {
  const workspacePath = context.sessions.active.workspacePath;
  if (workspacePath === null) throw new TypeError("no project workspace is active");
  return workspacePath;
};

export const resourceMutationContext = (
  context: ProjectResourceContext,
  expectedSessionId: ProjectSessionId,
) => {
  const workspacePath = requireWorkspacePath(context);
  return {
    workspacePath,
    context: {
      sessions: context.sessions,
      expectedSessionId,
      listInventory: async () => inventoryWithHashes(
        workspacePath,
        await context.projectFiles.listAssetPaths(workspacePath),
      ),
    },
  };
};

export const importedAsset = (
  sessionId: ProjectSessionId,
  file: { readonly fileName: string; readonly relativePath: string },
  type?: "image" | "video",
): AssetInfo => ({
  name: file.fileName,
  path: buildRuntimeAssetUrl(sessionId, file.relativePath),
  relativePath: file.relativePath,
  ...(type === undefined ? {} : { type }),
});

export const importedFont = (
  file: { readonly fileName: string; readonly relativePath: string },
  name: string,
  source: FontAsset["source"],
  weight = "400",
  style = "normal",
): FontAsset => {
  const extension = path.extname(file.fileName).slice(1).toLowerCase();
  const format = extension === "otf" || extension === "woff" || extension === "woff2" ? extension : "ttf";
  return {
    id: `font_${randomUUID()}`,
    name,
    fileName: file.fileName,
    relativePath: file.relativePath,
    format,
    weight,
    style,
    source,
  };
};
