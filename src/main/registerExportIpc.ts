import * as path from "path";

type Handler = (event: unknown, argument?: unknown) => unknown;

interface SaveDialogOptions {
  readonly title: string;
  readonly defaultPath: string;
  readonly filters: { name: string; extensions: string[] }[];
}

interface OpenDialogOptions {
  readonly title: string;
  readonly defaultPath: string;
  readonly properties: ("openDirectory" | "createDirectory")[];
}

interface ProgressWindow {
  readonly webContents: { readonly send: (channel: string, payload: unknown) => void };
}

export interface ExportIpcContext {
  readonly handle: (channel: string, handler: Handler) => void;
  readonly getMainWindow: () => ProgressWindow | null;
  readonly getDocumentsPath: () => string;
  readonly showSaveDialog: (options: SaveDialogOptions) => Promise<{ canceled: boolean; filePath?: string }>;
  readonly showOpenDialog: (options: OpenDialogOptions) => Promise<{ canceled: boolean; filePaths: string[] }>;
  readonly writeFile: (filePath: string, data: string | Uint8Array, encoding?: "utf-8") => Promise<unknown>;
  readonly makeDirectory: (directory: string, options: { recursive: true }) => Promise<unknown>;
  readonly isPathSafe: (requestedPath: string, allowedBase: string) => boolean;
  readonly openExternal: (url: string) => Promise<unknown>;
  readonly openPath: (filePath: string) => Promise<string>;
}

const field = (value: unknown, key: string): unknown => (
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined
);
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const binaryContent = (content: object): Uint8Array => {
  const bufferData = field(content, "data");
  if (field(content, "type") === "Buffer" && Array.isArray(bufferData)) {
    return Buffer.from(bufferData);
  }
  if (content instanceof Uint8Array) return Buffer.from(content);
  throw new TypeError("Unsupported binary export content");
};

export const registerExportIpc = (context: ExportIpcContext): void => {
  context.handle("project:exportHtml", async (_event, argument) => {
    try {
      const result = await context.showSaveDialog({
        title: "Export HTML",
        defaultPath: path.join(context.getDocumentsPath(), String(field(argument, "defaultPath") || "index.html")),
        filters: [{ name: "HTML Files", extensions: ["html", "htm"] }],
      });
      if (result.canceled || !result.filePath) return { success: false, canceled: true };
      await context.writeFile(result.filePath, String(field(argument, "html") ?? ""), "utf-8");
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });

  context.handle("project:exportSite", async (_event, argument) => {
    try {
      const result = await context.showOpenDialog({
        title: "Choose Export Directory",
        defaultPath: context.getDocumentsPath(),
        properties: ["openDirectory", "createDirectory"],
      });
      if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };

      const baseDirectory = result.filePaths[0];
      const directoryName = String(field(argument, "defaultDirName") || "").trim();
      const exportDirectory = directoryName ? path.join(baseDirectory, directoryName) : baseDirectory;
      await context.makeDirectory(exportDirectory, { recursive: true });

      const filesValue = field(argument, "files");
      const files = Array.isArray(filesValue) ? filesValue : [];
      const total = files.length;
      let written = 0;
      for (const file of files) {
        const relative = String(field(file, "path") || "").replace(/^[/\\]+/, "");
        if (!relative || path.isAbsolute(relative)) continue;
        const normalizedRelative = path.normalize(relative);
        const targetPath = path.join(exportDirectory, normalizedRelative);
        if (!context.isPathSafe(targetPath, exportDirectory)) continue;
        await context.makeDirectory(path.dirname(targetPath), { recursive: true });

        const content = field(file, "content");
        if (typeof content === "string") await context.writeFile(targetPath, content, "utf-8");
        else if (typeof content === "object" && content !== null) await context.writeFile(targetPath, binaryContent(content));
        else await context.writeFile(targetPath, "");

        written += 1;
        context.getMainWindow()?.webContents.send("project:exportProgress", {
          written,
          total,
          path: normalizedRelative,
        });
      }

      const previewRelative = String(field(argument, "previewFile") || "index.html").replace(/^[/\\]+/, "");
      const previewPath = path.join(exportDirectory, path.normalize(previewRelative));
      return {
        success: true,
        directory: exportDirectory,
        previewPath: context.isPathSafe(previewPath, exportDirectory) ? previewPath : undefined,
      };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });

  context.handle("project:openInBrowser", async (_event, argument) => {
    try {
      const target = String(argument || "");
      if (!target) return { success: false, error: "No file path provided" };
      if (/^https?:\/\//i.test(target)) {
        await context.openExternal(target);
        return { success: true };
      }
      const error = await context.openPath(target);
      return error ? { success: false, error } : { success: true };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });
};
