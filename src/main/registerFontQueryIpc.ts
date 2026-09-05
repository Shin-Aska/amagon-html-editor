import * as path from "path";
import type { GoogleFontsService } from "./googleFontsTransport";
import { assertTrustedMainFrame } from "./projects/projectIpcSecurity";
import type { FontAsset } from "../renderer/store/types";

type IpcEvent = Parameters<typeof assertTrustedMainFrame>[0];
type MainWindow = Parameters<typeof assertTrustedMainFrame>[1];
type Handler = (event: IpcEvent, argument?: unknown) => unknown;

export interface FontQueryIpcContext {
  readonly handle: (channel: string, handler: Handler) => void;
  readonly getMainWindow: () => MainWindow;
  readonly getProjectDirectory: () => string | null;
  readonly getSystemFonts: () => Promise<readonly string[]>;
  readonly googleFonts: GoogleFontsService;
  readonly exists: (filePath: string) => boolean;
  readonly access: (filePath: string) => Promise<unknown>;
  readonly readFile: (filePath: string) => Promise<Buffer>;
  readonly readDirectory: (directory: string) => Promise<readonly string[]>;
  readonly isPathSafe: (requestedPath: string, allowedBase: string) => boolean;
}

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
const field = (value: unknown, key: string): unknown => (
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined
);
const FONT_FORMATS = new Map<string, FontAsset["format"]>([
  [".ttf", "ttf"],
  [".otf", "otf"],
  [".woff", "woff"],
  [".woff2", "woff2"],
]);

export const registerFontQueryIpc = (context: FontQueryIpcContext): void => {
  context.handle("fonts:listSystem", async (event) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      return { success: true, fonts: await context.getSystemFonts() };
    } catch (error) {
      return { success: false, error: errorMessage(error), fonts: [] };
    }
  });

  context.handle("fonts:fetchGoogleFontCss", async (event, argument) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    const familyValue = field(argument, "family");
    if (typeof familyValue !== "string" || !familyValue) {
      return { success: false, error: "family required", css: "" };
    }
    try {
      const family = familyValue.trim();
      const style = String(field(argument, "style") || "normal").toLowerCase() === "italic" ? "italic" : "normal";
      const weightMatch = String(field(argument, "weight") || "400").match(/\d{3}/);
      const weight = weightMatch ? weightMatch[0] : "400";
      const italic = style === "italic" ? "1" : "0";
      const encodedFamily = encodeURIComponent(family).replace(/%20/g, "+");
      const cssUrl = `https://fonts.googleapis.com/css2?family=${encodedFamily}:ital,wght@${italic},${weight}&display=swap`;
      const css = await context.googleFonts.fetchText(cssUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
      });
      return { success: true, css };
    } catch (error) {
      return { success: false, error: errorMessage(error), css: "" };
    }
  });

  context.handle("fonts:fetchGoogleFontFile", async (event, argument) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    const urlValue = field(argument, "url");
    if (typeof urlValue !== "string" || !urlValue) {
      return { success: false, error: "url required", dataUri: "" };
    }
    try {
      const url = urlValue.trim();
      if (!context.googleFonts.isAllowedUrl(url)) {
        return { success: false, error: "Unexpected font URL origin (blocked)", dataUri: "" };
      }
      const { filePath, mimeType } = await context.googleFonts.cacheFile(url);
      const data = await context.readFile(filePath);
      return { success: true, dataUri: `data:${mimeType};base64,${data.toString("base64")}` };
    } catch (error) {
      return { success: false, error: errorMessage(error), dataUri: "" };
    }
  });

  context.handle("fonts:checkFileExists", async (event, argument) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    const directory = context.getProjectDirectory();
    const relativePath = field(argument, "relativePath");
    if (directory === null || !relativePath) return { exists: false };
    const relative = String(relativePath).replace(/^[/\\]+/, "").replace(/\\/g, "/");
    const target = path.join(directory, relative);
    return { exists: context.isPathSafe(target, directory) && context.exists(target) };
  });

  context.handle("fonts:listProject", async (event) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    const directory = context.getProjectDirectory();
    if (directory === null) return { success: true, fonts: [] };
    try {
      const fontsDirectory = path.join(directory, "assets", "fonts");
      try {
        await context.access(fontsDirectory);
      } catch {
        return { success: true, fonts: [] };
      }
      const fonts = (await context.readDirectory(fontsDirectory)).flatMap((fileName): readonly FontAsset[] => {
        const extension = path.extname(fileName);
        const format = FONT_FORMATS.get(extension.toLowerCase());
        if (format === undefined) return [];
        const relativePath = `assets/fonts/${fileName}`;
        return [{
          id: `font_${Buffer.from(relativePath).toString("base64url").slice(0, 12)}`,
          name: path.basename(fileName, extension),
          fileName,
          relativePath,
          format,
          weight: "400",
          style: "normal",
          source: "imported",
        }];
      });
      return { success: true, fonts };
    } catch (error) {
      return { success: false, error: errorMessage(error), fonts: [] };
    }
  });
};
