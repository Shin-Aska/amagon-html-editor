import * as path from "path";
import { describe, expect, it, vi } from "vitest";
import { buildRuntimeAssetUrl } from "../shared/projects/assetReference";
import { ProjectSession, ProjectSessionRegistry } from "./projects/projectSession";
import { registerAssetReadIpc, type AssetReadIpcContext } from "./registerAssetReadIpc";

type Handler = Parameters<AssetReadIpcContext["handle"]>[1];

const setup = (overrides: Partial<AssetReadIpcContext> = {}) => {
  const handlers = new Map<string, Handler>();
  const mainFrame = {};
  const sender = { id: 1, mainFrame };
  const event = { sender, senderFrame: mainFrame };
  const sessions = new ProjectSessionRegistry();
  const context: AssetReadIpcContext = {
    handle: (channel, handler) => handlers.set(channel, handler),
    getMainWindow: () => ({ webContents: sender }),
    sessions,
    getProjectService: () => null,
    exists: () => false,
    readDirectory: vi.fn(async () => []),
    stat: vi.fn(async () => ({ size: 4 })),
    readFile: vi.fn(async () => Buffer.from("data")),
    buildRuntimeAssetUrl,
    getMimeType: () => "image/png",
    ...overrides,
  };
  registerAssetReadIpc(context);
  return { handlers, event, sessions };
};

const invoke = (handlers: ReadonlyMap<string, Handler>, channel: string, event: Parameters<Handler>[0], argument?: unknown): unknown => {
  const handler = handlers.get(channel);
  if (handler === undefined) throw new Error(`missing handler: ${channel}`);
  return handler(event, argument);
};

const readableService = (release: () => void, filePath = path.join("C:", "project", "assets", "image.png")) => ({
  resolveAssetRead: vi.fn(async () => ({ filePath, release })),
});

describe("asset read IPC registration", () => {
  it("returns empty lists without an active session or assets directory", async () => {
    const none = setup();
    await expect(invoke(none.handlers, "assets:list", none.event)).resolves.toEqual({ success: true, assets: [] });

    const sessions = new ProjectSessionRegistry();
    sessions.activate(ProjectSession.createLegacyJson({ sourcePath: "project.json", workspacePath: "C:/project" }));
    const missing = setup({ sessions, exists: () => false });
    await expect(invoke(missing.handlers, "assets:list", missing.event)).resolves.toEqual({ success: true, assets: [] });
  });

  it("lists supported files in directory order with session-bound runtime URLs", async () => {
    const sessions = new ProjectSessionRegistry();
    sessions.activate(ProjectSession.createLegacyJson({ sourcePath: "project.json", workspacePath: "C:/project" }));
    const entries = [
      { name: "photo.PNG", isFile: () => true },
      { name: "clip.webm", isFile: () => true },
      { name: "notes.txt", isFile: () => true },
      { name: "nested.jpg", isFile: () => false },
    ];
    const listed = setup({ sessions, exists: () => true, readDirectory: vi.fn(async () => entries) });
    const sessionId = sessions.active.id;
    if (sessionId === null) throw new Error("test session id missing");
    await expect(invoke(listed.handlers, "assets:list", listed.event)).resolves.toEqual({
      success: true,
      assets: [
        { name: "photo.PNG", relativePath: "assets/photo.PNG", path: buildRuntimeAssetUrl(sessionId, "assets/photo.PNG"), type: "image" },
        { name: "clip.webm", relativePath: "assets/clip.webm", path: buildRuntimeAssetUrl(sessionId, "assets/clip.webm"), type: "video" },
      ],
    });
  });

  it("rejects remote and Blob inputs before acquiring a read lease", async () => {
    const resolveAssetRead = vi.fn(async () => ({ filePath: "unused", release: vi.fn() }));
    const current = setup({ getProjectService: () => ({ resolveAssetRead }) });
    await expect(invoke(current.handlers, "assets:readFileAsBase64", current.event, "https://example.test/x.png")).resolves.toEqual({
      success: false,
      error: "Remote URLs cannot be read through the local project asset bridge",
    });
    await expect(invoke(current.handlers, "assets:readFileAsBase64", current.event, "blob:local")).resolves.toEqual({
      success: false,
      error: "Blob URLs are not supported for base64 embedding in Electron mode. Please re-browse the file.",
    });
    expect(resolveAssetRead).not.toHaveBeenCalled();
  });

  it("reports an unavailable project service", async () => {
    const current = setup();
    await expect(invoke(current.handlers, "assets:readFileAsBase64", current.event, "assets/x.png")).resolves.toEqual({ success: false, error: "Project service unavailable" });
    await expect(invoke(current.handlers, "assets:readAsset", current.event, "assets/x.png")).resolves.toEqual({ success: false, error: "Project service unavailable" });
  });

  it("preserves both distinct 5MB errors and releases each lease", async () => {
    const firstRelease = vi.fn();
    const firstRead = vi.fn(async () => Buffer.from("unused"));
    const first = setup({
      getProjectService: () => readableService(firstRelease),
      stat: vi.fn(async () => ({ size: 5.5 * 1024 * 1024 })),
      readFile: firstRead,
    });
    await expect(invoke(first.handlers, "assets:readFileAsBase64", first.event, "assets/x.png")).resolves.toEqual({
      success: false,
      error: "File is too large (5.5MB). Max 5MB for base64 embedding.",
    });
    expect(firstRelease).toHaveBeenCalledOnce();
    expect(firstRead).not.toHaveBeenCalled();

    const secondRelease = vi.fn();
    const secondRead = vi.fn(async () => Buffer.from("unused"));
    const second = setup({
      getProjectService: () => readableService(secondRelease),
      stat: vi.fn(async () => ({ size: 5 * 1024 * 1024 + 1 })),
      readFile: secondRead,
    });
    await expect(invoke(second.handlers, "assets:readAsset", second.event, "assets/x.png")).resolves.toEqual({ success: false, error: "File exceeds the 5MB base64 limit" });
    expect(secondRelease).toHaveBeenCalledOnce();
    expect(secondRead).not.toHaveBeenCalled();
  });

  it("returns a data URI and releases the read lease exactly once", async () => {
    const release = vi.fn();
    const current = setup({ getProjectService: () => readableService(release) });
    await expect(invoke(current.handlers, "assets:readAsset", current.event, "assets/x.png")).resolves.toEqual({
      success: true,
      data: "data:image/png;base64,ZGF0YQ==",
      mimeType: "image/png",
    });
    expect(release).toHaveBeenCalledOnce();
  });

  it("maps operational errors and releases after a read error", async () => {
    const release = vi.fn();
    const current = setup({
      getProjectService: () => readableService(release),
      readFile: vi.fn(async () => { throw new Error("read failed"); }),
    });
    await expect(invoke(current.handlers, "assets:readFileAsBase64", current.event, "assets/x.png")).resolves.toEqual({ success: false, error: "read failed" });
    expect(release).toHaveBeenCalledOnce();
  });

  it("rejects untrusted events before remote checks or file reads", async () => {
    const readFile = vi.fn(async () => Buffer.from("data"));
    const current = setup({ readFile });
    const foreignFrame = {};
    const foreignEvent = { sender: { id: 2, mainFrame: foreignFrame }, senderFrame: foreignFrame };
    await expect(invoke(current.handlers, "assets:readFileAsBase64", foreignEvent, "https://example.test/x.png")).rejects.toMatchObject({ name: "ProjectIpcSecurityError" });
    expect(readFile).not.toHaveBeenCalled();
  });
});
