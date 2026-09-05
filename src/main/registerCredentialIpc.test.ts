import { describe, expect, it, vi } from "vitest";
import { createTrustedIpcTestFixture } from "./__tests__/trustedIpcTestFixture";
import { registerCredentialIpc, type CredentialIpcContext } from "./registerCredentialIpc";

type TestHandler = (event: unknown, argument: unknown) => unknown;
type TestContext = CredentialIpcContext & { readonly getMainWindow: () => ReturnType<typeof createTrustedIpcTestFixture>["mainWindow"] | null };
const ipc = createTrustedIpcTestFixture();

const setup = (overrides: Partial<TestContext> = {}) => {
  const handlers = new Map<string, TestHandler>();
  const saveCredential = vi.fn(async () => undefined);
  const deleteCredential = vi.fn(async () => undefined);
  const context: TestContext = {
    handle: (channel, handler) => {
      handlers.set(channel, (event, argument) => Reflect.apply(handler, undefined, [event, argument]));
    },
    getMainWindow: () => ipc.mainWindow,
    listCredentials: vi.fn(async () => []),
    getDefinitions: vi.fn(() => []),
    getValues: vi.fn(async () => ({ apiKey: "masked" })),
    saveCredential,
    deleteCredential,
    isEncryptionSecure: () => true,
    ...overrides,
  };
  registerCredentialIpc(context);
  return { handlers, saveCredential, deleteCredential };
};

const invoke = (handlers: ReadonlyMap<string, TestHandler>, channel: string, argument?: unknown, event: unknown = ipc.trustedEvent): unknown => {
  const handler = handlers.get(channel);
  if (handler === undefined) throw new Error(`missing handler: ${channel}`);
  return handler(event, argument);
};

describe("credential catalog IPC registration", () => {
  it("rejects foreign, child-frame, missing-frame, and missing-window requests before credential sinks", async () => {
    const sink = vi.fn();
    const argumentsByChannel = new Map<string, unknown>([
      ["app:getCredentialValues", "ai:openai"],
      ["app:saveCredential", { id: "ai:openai", values: { apiKey: "secret" } }],
      ["app:deleteCredential", "ai:openai"],
    ]);
    for (const [event, getMainWindow] of [
      [ipc.foreignEvent, () => ipc.mainWindow],
      [ipc.childFrameEvent, () => ipc.mainWindow],
      [ipc.missingFrameEvent, () => ipc.mainWindow],
      [ipc.trustedEvent, () => null],
    ] as const) {
      const { handlers } = setup({
        getMainWindow,
        listCredentials: async () => { sink(); return []; },
        getDefinitions: () => { sink(); return []; },
        getValues: async () => { sink(); return {}; },
        saveCredential: async () => { sink(); },
        deleteCredential: async () => { sink(); },
        isEncryptionSecure: () => { sink(); return true; },
      });
      for (const [channel, handler] of handlers) {
        await expect(Promise.resolve().then(() => handler(event, argumentsByChannel.get(channel)))).rejects.toThrow("trusted");
      }
    }
    expect(sink).not.toHaveBeenCalled();
  });

  it("preserves handler order", () => {
    const { handlers } = setup();
    expect([...handlers.keys()]).toEqual([
      "app:getCredentials",
      "app:getCredentialDefinitions",
      "app:getCredentialValues",
      "app:saveCredential",
      "app:deleteCredential",
    ]);
  });

  it("success results preserve every catalog operation shape and arguments", async () => {
    const getDefinitions = vi.fn(() => []);
    const getValues = vi.fn(async () => ({ apiKey: "masked" }));
    const current = setup({ getDefinitions, getValues });
    await expect(invoke(current.handlers, "app:getCredentials")).resolves.toEqual({
      success: true,
      credentials: [],
      definitions: [],
      secure: true,
    });
    await expect(invoke(current.handlers, "app:getCredentialDefinitions")).resolves.toEqual({ success: true, definitions: [] });
    await expect(invoke(current.handlers, "app:getCredentialValues", "ai:openai")).resolves.toEqual({ success: true, values: { apiKey: "masked" } });
    expect(getValues).toHaveBeenCalledWith("ai:openai");
    await expect(invoke(current.handlers, "app:saveCredential", { id: "ai:openai", values: { apiKey: "secret" } })).resolves.toEqual({ success: true });
    expect(current.saveCredential).toHaveBeenCalledWith("ai:openai", { apiKey: "secret" });
    await expect(invoke(current.handlers, "app:deleteCredential", "ai:openai")).resolves.toEqual({ success: true });
    expect(current.deleteCredential).toHaveBeenCalledWith("ai:openai");
  });

  it("list failure preserves the error-only default", async () => {
    const current = setup({ listCredentials: vi.fn(async () => { throw new Error("list failed"); }) });
    await expect(invoke(current.handlers, "app:getCredentials")).resolves.toEqual({ success: false, error: "list failed" });
  });

  it("definitions failure preserves the empty array default", async () => {
    const current = setup({ getDefinitions: vi.fn(() => { throw new Error("definitions failed"); }) });
    await expect(invoke(current.handlers, "app:getCredentialDefinitions")).resolves.toEqual({
      success: false,
      error: "definitions failed",
      definitions: [],
    });
  });

  it("values failure preserves the empty object default", async () => {
    const current = setup({ getValues: vi.fn(async () => { throw new Error("values failed"); }) });
    await expect(invoke(current.handlers, "app:getCredentialValues", "missing")).resolves.toEqual({ success: false, error: "values failed", values: {} });
  });

  it("save and delete failure results remain error-only", async () => {
    const current = setup({
      saveCredential: vi.fn(async () => { throw new Error("save failed"); }),
      deleteCredential: vi.fn(async () => { throw new Error("delete failed"); }),
    });
    await expect(invoke(current.handlers, "app:saveCredential", { id: "ai:openai", values: {} })).resolves.toEqual({ success: false, error: "save failed" });
    await expect(invoke(current.handlers, "app:deleteCredential", "ai:openai")).resolves.toEqual({ success: false, error: "delete failed" });
  });
});
