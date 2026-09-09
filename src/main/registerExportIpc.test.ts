import * as path from "path";
import { describe, expect, it, vi } from "vitest";
import { createTrustedIpcTestFixture } from "./__tests__/trustedIpcTestFixture";
import { registerExportIpc, type ExportIpcContext } from "./registerExportIpc";

type Handler = Parameters<ExportIpcContext["handle"]>[1];
type TestContext = ExportIpcContext & { readonly getMainWindow: () => ReturnType<typeof createTrustedIpcTestFixture>["mainWindow"] | null };

const setup = (overrides: Partial<TestContext> = {}) => {
  const handlers = new Map<string, Handler>();
  const send = vi.fn();
  const writes: [string, string | Uint8Array, "utf-8"?][] = [];
  const writeFile = vi.fn(async (filePath: string, data: string | Uint8Array, encoding?: "utf-8") => {
    writes.push([filePath, data, encoding]);
  });
  const makeDirectory = vi.fn(async () => undefined);
  const openExternal = vi.fn(async () => undefined);
  const openPath = vi.fn(async () => "");
  const ipc = createTrustedIpcTestFixture(send);
  const context: TestContext = {
    handle: (channel, handler) => handlers.set(channel, handler),
    getMainWindow: () => ipc.mainWindow,
    getDocumentsPath: () => path.join("C:", "Documents"),
    showSaveDialog: vi.fn(async () => ({ canceled: true })),
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
    writeFile,
    makeDirectory,
    isPathSafe: () => true,
    openExternal,
    openPath,
    ...overrides,
  };
  registerExportIpc(context);
  return { handlers, send, writes, writeFile, makeDirectory, openExternal, openPath, ipc };
};

const invoke = (current: ReturnType<typeof setup>, channel: string, argument?: unknown, event: Parameters<Handler>[0] = current.ipc.trustedEvent): unknown => {
  const { handlers } = current;
  const handler = handlers.get(channel);
  if (handler === undefined) throw new Error(`missing handler: ${channel}`);
  return handler(event, argument);
};

describe("export IPC registration", () => {
  it("rejects foreign, child-frame, missing-frame, and missing-window requests before export sinks", async () => {
    const sink = vi.fn();
    const argumentsByChannel = new Map<string, unknown>([
      ["project:exportHtml", { html: "blocked" }],
      ["project:exportSite", { files: [] }],
      ["project:openInBrowser", "https://example.test"],
    ]);
    for (const state of ["foreign", "child", "missing-frame", "missing-window"] as const) {
      const windowOverride = state === "missing-window" ? { getMainWindow: () => null } : {};
      const current = setup({
        ...windowOverride,
        showSaveDialog: async () => { sink(); return { canceled: true }; },
        showOpenDialog: async () => { sink(); return { canceled: true, filePaths: [] }; },
        openExternal: async () => { sink(); },
      });
      const event = state === "foreign" ? current.ipc.foreignEvent
        : state === "child" ? current.ipc.childFrameEvent
          : state === "missing-frame" ? current.ipc.missingFrameEvent
            : current.ipc.trustedEvent;
      for (const [channel, handler] of current.handlers) {
        await expect(Promise.resolve().then(() => handler(event, argumentsByChannel.get(channel)))).rejects.toThrow("trusted");
      }
    }
    expect(sink).not.toHaveBeenCalled();
  });

  it("preserves HTML cancel and success payloads", async () => {
    const canceled = setup();
    await expect(invoke(canceled, "project:exportHtml", { html: "x" })).resolves.toEqual({ success: false, canceled: true });

    const output = path.join("C:", "output.html");
    const success = setup({ showSaveDialog: vi.fn(async () => ({ canceled: false, filePath: output })) });
    await expect(invoke(success, "project:exportHtml", { html: "<p>x</p>" })).resolves.toEqual({ success: true, filePath: output });
    expect(success.writeFile).toHaveBeenCalledWith(output, "<p>x</p>", "utf-8");
  });

  it("converts HTML write failure to the baseline error object", async () => {
    const current = setup({
      showSaveDialog: vi.fn(async () => ({ canceled: false, filePath: "output.html" })),
      writeFile: vi.fn(async () => { throw new Error("disk full"); }),
    });
    await expect(invoke(current, "project:exportHtml", { html: "x" })).resolves.toEqual({ success: false, error: "disk full" });
  });

  it("preserves site cancel payload", async () => {
    const current = setup();
    await expect(invoke(current, "project:exportSite", { files: [] })).resolves.toEqual({ success: false, canceled: true });
  });

  it("multi-file export writes every content form and ordered progress", async () => {
    const base = path.join("C:", "exports");
    const current = setup({
      showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: [base] })),
      isPathSafe: (target) => !target.includes("unsafe"),
    });
    await expect(invoke(current, "project:exportSite", {
      defaultDirName: " site ",
      files: [
        { path: "index.html", content: "hello" },
        { path: "assets/raw.bin", content: new Uint8Array([1, 2]) },
        { path: "assets/buffer.bin", content: { type: "Buffer", data: [3, 4] } },
        { path: "empty.txt" },
        { path: "" },
        { path: "../unsafe.txt", content: "blocked" },
      ],
    })).resolves.toEqual({
      success: true,
      directory: path.join(base, "site"),
      previewPath: path.join(base, "site", "index.html"),
    });
    expect(current.writeFile).toHaveBeenCalledTimes(4);
    expect(current.writes[0]).toEqual([path.join(base, "site", "index.html"), "hello", "utf-8"]);
    expect([...current.writes[1][1]]).toEqual([1, 2]);
    expect([...current.writes[2][1]]).toEqual([3, 4]);
    expect(current.writes[3]).toEqual([path.join(base, "site", "empty.txt"), "", undefined]);
    expect(current.send.mock.calls).toEqual([
      ["project:exportProgress", { written: 1, total: 6, path: "index.html" }],
      ["project:exportProgress", { written: 2, total: 6, path: path.normalize("assets/raw.bin") }],
      ["project:exportProgress", { written: 3, total: 6, path: path.normalize("assets/buffer.bin") }],
      ["project:exportProgress", { written: 4, total: 6, path: "empty.txt" }],
    ]);
  });

  it("unsafe paths are skipped and unsafe preview is omitted", async () => {
    const base = path.join("C:", "exports");
    const current = setup({
      showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: [base] })),
      isPathSafe: (target) => !target.includes("outside"),
    });
    await expect(invoke(current, "project:exportSite", {
      files: [{ path: "../outside.txt", content: "blocked" }],
      previewFile: "../outside.html",
    })).resolves.toEqual({ success: true, directory: base, previewPath: undefined });
    expect(current.writeFile).not.toHaveBeenCalled();
  });

  it("opens external and local browser targets", async () => {
    const success = setup();
    await expect(invoke(success, "project:openInBrowser", "https://example.test/page")).resolves.toEqual({ success: true });
    expect(success.openExternal).toHaveBeenCalledWith("https://example.test/page");
    await expect(invoke(success, "project:openInBrowser", "C:/site/index.html")).resolves.toEqual({ success: true });
    expect(success.openPath).toHaveBeenCalledWith("C:/site/index.html");
  });

  it("preserves missing path, openPath error, and shell exception results", async () => {
    const localError = setup({ openPath: vi.fn(async () => "No association") });
    await expect(invoke(localError, "project:openInBrowser", "")).resolves.toEqual({ success: false, error: "No file path provided" });
    await expect(invoke(localError, "project:openInBrowser", "file.html")).resolves.toEqual({ success: false, error: "No association" });

    const shellError = setup({ openExternal: vi.fn(async () => { throw new Error("shell unavailable"); }) });
    await expect(invoke(shellError, "project:openInBrowser", "https://example.test")).resolves.toEqual({ success: false, error: "shell unavailable" });
  });
});
