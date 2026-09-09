import { describe, expect, it, vi } from "vitest";
import type { GoogleFontsService } from "./googleFontsTransport";
import { registerFontQueryIpc, type FontQueryIpcContext } from "./registerFontQueryIpc";

type Handler = Parameters<FontQueryIpcContext["handle"]>[1];

const setup = (overrides: Partial<FontQueryIpcContext> = {}) => {
  const handlers = new Map<string, Handler>();
  const mainFrame = {};
  const sender = { id: 1, mainFrame };
  const event = { sender, senderFrame: mainFrame };
  const googleFonts: GoogleFontsService = {
    fetchText: vi.fn(async () => "font-css"),
    cacheFile: vi.fn(async () => ({ filePath: "C:/cache/font.woff2", mimeType: "font/woff2" })),
    isAllowedUrl: (url) => url.startsWith("https://fonts.gstatic.com/"),
    maxResponseBytes: 10 * 1024 * 1024,
  };
  const context: FontQueryIpcContext = {
    handle: (channel, handler) => handlers.set(channel, handler),
    getMainWindow: () => ({ webContents: sender }),
    getProjectDirectory: () => "C:/project",
    getSystemFonts: vi.fn(async () => ["Arial"]),
    googleFonts,
    exists: () => true,
    access: vi.fn(async () => undefined),
    readFile: vi.fn(async () => Buffer.from("font")),
    readDirectory: vi.fn(async () => ["Inter.woff2", "notes.txt"]),
    isPathSafe: () => true,
    ...overrides,
  };
  registerFontQueryIpc(context);
  return { handlers, event, sender, googleFonts };
};

const invoke = (handlers: ReadonlyMap<string, Handler>, channel: string, event: Parameters<Handler>[0], argument?: unknown): unknown => {
  const handler = handlers.get(channel);
  if (handler === undefined) throw new Error(`missing handler: ${channel}`);
  return handler(event, argument);
};

describe("font query IPC registration", () => {
  it("registers the five handlers in baseline order", () => {
    const { handlers } = setup();
    expect([...handlers.keys()]).toEqual([
      "fonts:listSystem",
      "fonts:fetchGoogleFontCss",
      "fonts:fetchGoogleFontFile",
      "fonts:checkFileExists",
      "fonts:listProject",
    ]);
  });

  it("listSystem returns system fonts", async () => {
    const { handlers, event } = setup();
    await expect(invoke(handlers, "fonts:listSystem", event)).resolves.toEqual({ success: true, fonts: ["Arial"] });
  });

  it("fetchGoogleFontCss normalizes family, style, and weight", async () => {
    const { handlers, event, googleFonts } = setup();
    await expect(invoke(handlers, "fonts:fetchGoogleFontCss", event, {
      family: "Open Sans",
      weight: "weight-700",
      style: "ITALIC",
    })).resolves.toEqual({ success: true, css: "font-css" });
    expect(googleFonts.fetchText).toHaveBeenCalledWith(
      "https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@1,700&display=swap",
      expect.objectContaining({ headers: expect.objectContaining({ "User-Agent": expect.any(String) }) }),
    );
  });

  it("returns required and blocked failures without I/O", async () => {
    const { handlers, event, googleFonts } = setup();
    await expect(invoke(handlers, "fonts:fetchGoogleFontCss", event, {})).resolves.toEqual({ success: false, error: "family required", css: "" });
    await expect(invoke(handlers, "fonts:fetchGoogleFontFile", event, { url: "https://evil.test/font.woff2" })).resolves.toEqual({
      success: false,
      error: "Unexpected font URL origin (blocked)",
      dataUri: "",
    });
    expect(googleFonts.cacheFile).not.toHaveBeenCalled();
  });

  it("listProject filters extensions and preserves metadata", async () => {
    const { handlers, event } = setup();
    const result = await invoke(handlers, "fonts:listProject", event);
    expect(result).toEqual({
      success: true,
      fonts: [{
        id: expect.stringMatching(/^font_/),
        name: "Inter",
        fileName: "Inter.woff2",
        relativePath: "assets/fonts/Inter.woff2",
        format: "woff2",
        weight: "400",
        style: "normal",
        source: "imported",
      }],
    });
  });

  it("rejects untrusted events before operational fallback", async () => {
    const { handlers } = setup();
    const foreignFrame = {};
    const foreign = { sender: { id: 2, mainFrame: foreignFrame }, senderFrame: foreignFrame };
    await expect(invoke(handlers, "fonts:listSystem", foreign)).rejects.toMatchObject({ name: "ProjectIpcSecurityError" });
  });
});
