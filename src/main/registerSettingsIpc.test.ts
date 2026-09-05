import * as path from "path";
import { describe, expect, it, vi } from "vitest";
import { createTrustedIpcTestFixture } from "./__tests__/trustedIpcTestFixture";
import { registerSettingsIpc, type JsonObject, type SettingsIpcContext } from "./registerSettingsIpc";

type Handler = Parameters<SettingsIpcContext["handle"]>[1];
type TestContext = SettingsIpcContext & { readonly getMainWindow: () => ReturnType<typeof createTrustedIpcTestFixture>["mainWindow"] | null };
const ipc = createTrustedIpcTestFixture();

const setup = (overrides: Partial<TestContext> = {}) => {
  const handlers = new Map<string, Handler>();
  const writes: [string, string, "utf-8"][] = [];
  const context: TestContext = {
    handle: (channel, handler) => handlers.set(channel, handler),
    getMainWindow: () => ipc.mainWindow,
    getVersion: () => "1.9.0-test",
    getUserDataPath: () => path.join("C:", "user-data"),
    readFile: vi.fn(async () => "{}"),
    writeFile: vi.fn(async (filePath, data, encoding) => { writes.push([filePath, data, encoding]); }),
    isEncryptionSecure: () => true,
    ...overrides,
  };
  registerSettingsIpc(context);
  return { handlers, writes };
};

const invoke = (handlers: ReadonlyMap<string, Handler>, channel: string, argument?: JsonObject, event: Parameters<Handler>[0] = ipc.trustedEvent): unknown => {
  const handler = handlers.get(channel);
  if (handler === undefined) throw new Error(`missing handler: ${channel}`);
  return handler(event, argument);
};

describe("settings IPC registration", () => {
  it.each([
    ["a foreign WebContents", ipc.foreignEvent],
    ["a same-WebContents child frame", ipc.childFrameEvent],
    ["a missing sender frame", ipc.missingFrameEvent],
  ])("rejects every handler from %s before settings sinks run", async (_label, event) => {
    const sink = vi.fn();
    const { handlers } = setup({
      getVersion: () => { sink(); return "blocked"; },
      readFile: async () => { sink(); return "{}"; },
      writeFile: async () => { sink(); },
      isEncryptionSecure: () => { sink(); return true; },
    });
    for (const [channel, handler] of handlers) {
      const argument = channel === "app:saveSettings" ? { theme: "dark" } : undefined;
      await expect(Promise.resolve().then(() => handler(event, argument))).rejects.toThrow("trusted");
    }
    expect(sink).not.toHaveBeenCalled();
  });

  it("rejects every handler when the current main window is missing", async () => {
    const sink = vi.fn();
    const { handlers } = setup({
      getMainWindow: () => null,
      getVersion: () => { sink(); return "blocked"; },
      readFile: async () => { sink(); return "{}"; },
      writeFile: async () => { sink(); },
      isEncryptionSecure: () => { sink(); return true; },
    });
    for (const [channel, handler] of handlers) {
      const argument = channel === "app:saveSettings" ? { theme: "dark" } : undefined;
      await expect(Promise.resolve().then(() => handler(ipc.trustedEvent, argument))).rejects.toThrow("trusted application window");
    }
    expect(sink).not.toHaveBeenCalled();
  });

  it("returns version and encryption security metadata", () => {
    const { handlers } = setup();
    expect(invoke(handlers, "app:getVersion")).toEqual({ success: true, version: "1.9.0-test" });
    expect(invoke(handlers, "app:isEncryptionSecure")).toEqual({ secure: true });
  });

  it("reads valid settings", async () => {
    const { handlers } = setup({ readFile: vi.fn(async () => '{"theme":"dark","zoom":1.2}') });
    await expect(invoke(handlers, "app:getSettings")).resolves.toEqual({ success: true, settings: { theme: "dark", zoom: 1.2 } });
  });

  it("returns null settings for missing files", async () => {
    const { handlers } = setup({ readFile: vi.fn(async () => { throw new Error("ENOENT"); }) });
    await expect(invoke(handlers, "app:getSettings")).resolves.toEqual({ success: true, settings: null });
  });

  it("returns null settings for malformed JSON", async () => {
    const { handlers } = setup({ readFile: vi.fn(async () => "{") });
    await expect(invoke(handlers, "app:getSettings")).resolves.toEqual({ success: true, settings: null });
  });

  it("writes the first settings file when the read is missing", async () => {
    const { handlers, writes } = setup({ readFile: vi.fn(async () => { throw new Error("ENOENT"); }) });
    await expect(invoke(handlers, "app:saveSettings", { theme: "dark" })).resolves.toEqual({ success: true });
    expect(writes).toEqual([[
      path.join("C:", "user-data", "app-settings.json"),
      JSON.stringify({ theme: "dark" }, null, 2),
      "utf-8",
    ]]);
  });

  it("shallow merge replaces patched top-level values and preserves siblings", async () => {
    const existing = { theme: "light", editor: { zoom: 1, wrap: true }, untouched: true };
    const { handlers, writes } = setup({ readFile: vi.fn(async () => JSON.stringify(existing)) });
    await expect(invoke(handlers, "app:saveSettings", { editor: { zoom: 2 }, theme: "dark" })).resolves.toEqual({ success: true });
    expect(writes[0][1]).toBe(JSON.stringify({ theme: "dark", editor: { zoom: 2 }, untouched: true }, null, 2));
  });

  it("returns the original write failure message", async () => {
    const { handlers } = setup({ writeFile: vi.fn(async () => { throw new Error("disk full"); }) });
    await expect(invoke(handlers, "app:saveSettings", { theme: "dark" })).resolves.toEqual({ success: false, error: "disk full" });
  });
});
