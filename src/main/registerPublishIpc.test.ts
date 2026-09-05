import { describe, expect, it, vi } from "vitest";
import type { PublishCredentials, PublisherExtensionVersion } from "../publish";
import type { PublisherExtension } from "../publish/types/PublisherExtension";
import { registerPublishIpc, type PublishIpcContext } from "./registerPublishIpc";

type TestHandler = (event: { sender: { send: (channel: string, payload: unknown) => void } }, argument: unknown) => unknown;

const createPublisher = (): PublisherExtension => ({
  apiVersion: "1.0" satisfies PublisherExtensionVersion,
  meta: { id: "test", displayName: "Test Host", websiteUrl: "https://example.test", description: "Test publisher" },
  credentialFields: [
    { key: "token", label: "Token", sensitive: true },
    { key: "site", label: "Site", sensitive: false },
  ],
  validate: vi.fn(async () => ({ ok: true, issues: [] })),
  publish: vi.fn(async () => ({ success: true, url: "https://example.test/site", warnings: [] })),
});

const setup = (overrides: Partial<PublishIpcContext> = {}) => {
  const handlers = new Map<string, TestHandler>();
  const publisher = createPublisher();
  const saveCredentials = vi.fn(async () => undefined);
  const deleteCredentials = vi.fn(async () => undefined);
  const resolveSensitiveValues = vi.fn((_fields, stored: PublishCredentials, incoming: PublishCredentials) => ({ ...stored, ...incoming }));
  const context: PublishIpcContext = {
    handle: (channel, handler) => {
      handlers.set(channel, (event, argument) => Reflect.apply(handler, undefined, [event, argument]));
    },
    getAllPublishers: () => [publisher],
    getPublisher: (providerId) => providerId === "test" ? publisher : undefined,
    loadCredentials: vi.fn(async () => ({ token: "secret", site: "my-site" })),
    saveCredentials,
    deleteCredentials,
    resolveSensitiveValues,
    maskApiKey: (key) => `masked:${key}`,
    ...overrides,
  };
  registerPublishIpc(context);
  const send = vi.fn();
  return { handlers, publisher, saveCredentials, deleteCredentials, resolveSensitiveValues, event: { sender: { send } }, send };
};

const invoke = (current: ReturnType<typeof setup>, channel: string, argument?: unknown): unknown => {
  const handler = current.handlers.get(channel);
  if (handler === undefined) throw new Error(`missing handler: ${channel}`);
  return handler(current.event, argument);
};

describe("publish IPC registration", () => {
  it("clones provider metadata and credential fields", () => {
    const current = setup();
    const result = invoke(current, "publish:getProviders");
    expect(result).toEqual([{
      id: "test",
      displayName: "Test Host",
      description: "Test publisher",
      credentialFields: current.publisher.credentialFields,
    }]);
    if (!Array.isArray(result)) throw new Error("provider result was not an array");
    expect(result[0].credentialFields[0]).not.toBe(current.publisher.credentialFields[0]);
  });

  it("returns stored credentials with sensitive fields masked", async () => {
    const current = setup();
    await expect(invoke(current, "publish:getCredentials", "test")).resolves.toEqual({ token: "masked:secret", site: "my-site" });
  });

  it("falls back to blank known-provider credentials when storage fails", async () => {
    const current = setup({ loadCredentials: vi.fn(async () => { throw new Error("storage failed"); }) });
    await expect(invoke(current, "publish:getCredentials", "test")).resolves.toEqual({ token: "", site: "" });
  });

  it("saves and deletes credentials for a known provider", async () => {
    const current = setup();
    await expect(invoke(current, "publish:saveCredentials", { providerId: "test", credentials: { token: "new" } })).resolves.toEqual({ success: true });
    expect(current.saveCredentials).toHaveBeenCalledWith("test", { token: "new" });
    await expect(invoke(current, "publish:deleteCredentials", "test")).resolves.toEqual({ success: true });
    expect(current.deleteCredentials).toHaveBeenCalledWith("test");
  });

  it("validates with resolved sensitive credentials and passes through the result", async () => {
    const current = setup();
    const files = [{ path: "index.html", content: "hello" }];
    await expect(invoke(current, "publish:validate", { providerId: "test", files, credentials: { token: "incoming" } })).resolves.toEqual({ ok: true, issues: [] });
    expect(current.resolveSensitiveValues).toHaveBeenCalledWith(
      current.publisher.credentialFields,
      { token: "secret", site: "my-site" },
      { token: "incoming" },
    );
    expect(current.publisher.validate).toHaveBeenCalledWith(files, { token: "incoming", site: "my-site" });
  });

  it("publishes and forwards progress through the invoking sender", async () => {
    const progress = { phase: "uploading" as const, percent: 50, message: "Uploading" };
    const publisher = createPublisher();
    publisher.publish = vi.fn(async (_files, _credentials, onProgress) => {
      onProgress(progress);
      return { success: true, url: "https://example.test/site", warnings: [] };
    });
    const current = setup({
      getAllPublishers: () => [publisher],
      getPublisher: (providerId) => providerId === "test" ? publisher : undefined,
    });
    const files = [{ path: "index.html", content: "hello" }];
    await expect(invoke(current, "publish:publish", { providerId: "test", files })).resolves.toEqual({
      success: true,
      url: "https://example.test/site",
      warnings: [],
    });
    expect(current.send).toHaveBeenCalledWith("publish:progress", progress);
  });

  it("unknown provider preserves endpoint-specific failures", async () => {
    const current = setup();
    await expect(invoke(current, "publish:getCredentials", "missing")).resolves.toEqual({});
    await expect(invoke(current, "publish:saveCredentials", { providerId: "missing", credentials: {} })).resolves.toEqual({ success: false, error: "Unknown publish provider: missing" });
    await expect(invoke(current, "publish:deleteCredentials", "missing")).resolves.toEqual({ success: false, error: "Unknown publish provider: missing" });
    await expect(invoke(current, "publish:validate", { providerId: "missing", files: [] })).resolves.toEqual({
      ok: false,
      issues: [{ severity: "error", message: "Unknown publish provider: missing" }],
    });
    await expect(invoke(current, "publish:publish", { providerId: "missing", files: [] })).resolves.toEqual({
      success: false,
      error: "Unknown publish provider: missing",
      warnings: [],
    });
  });
});
