import { describe, expect, it, vi } from "vitest";
import type { AiConfig, AiProvider } from "./aiService";
import { registerAiIpc, type AiIpcContext } from "./registerAiIpc";

type TestHandler = (event: unknown, argument: unknown) => unknown;

const modelCatalog = (suffix = "model"): Record<AiProvider, string[]> => ({
  openai: [`openai-${suffix}`],
  anthropic: [`anthropic-${suffix}`],
  google: [`google-${suffix}`],
  ollama: [`ollama-${suffix}`],
  mistral: [`mistral-${suffix}`],
  "codex-cli": [`codex-${suffix}`],
  "github-cli": [`github-${suffix}`],
  "junie-cli": [`junie-${suffix}`],
  opencode: [`opencode-${suffix}`],
});

const defaultConfig = (): AiConfig => ({
  provider: "openai",
  model: "gpt-test",
  apiKey: "secret",
  ollamaUrl: "http://localhost:11434",
});

const setup = (overrides: Partial<AiIpcContext> = {}) => {
  const handlers = new Map<string, TestHandler>();
  const chat = vi.fn(async () => ({ content: "reply" }));
  const detectCliProvider = vi.fn(async () => ({ available: false }));
  const saveConfig = vi.fn(async (config: Partial<AiConfig>) => ({ ...defaultConfig(), ...config }));
  const loadApiKeyForProvider = vi.fn(async () => "stored-key");
  const fetchModelsForProvider = vi.fn(async () => ["remote-model"]);
  const context: AiIpcContext = {
    handle: (channel, handler) => {
      handlers.set(channel, (event, argument) => Reflect.apply(handler, undefined, [event, argument]));
    },
    buildSystemPrompt: () => "generated system",
    chat,
    cliBinaryNames: { "codex-cli": "codex", "github-cli": "copilot", "junie-cli": "junie" },
    detectCliProvider,
    createOpenCodeClient: vi.fn(async () => ({ provider: { list: vi.fn(async () => ({})) } })),
    loadConfig: vi.fn(async () => defaultConfig()),
    saveConfig,
    maskApiKey: (key) => `masked:${key}`,
    maskedKeyPrefix: "masked:",
    fetchAvailableModels: vi.fn(async () => modelCatalog("dynamic")),
    staticModels: modelCatalog("static"),
    loadApiKeyForProvider,
    fetchModelsForProvider,
    ...overrides,
  };
  registerAiIpc(context);
  return { handlers, chat, detectCliProvider, saveConfig, loadApiKeyForProvider, fetchModelsForProvider };
};

const invoke = (handlers: ReadonlyMap<string, TestHandler>, channel: string, argument?: unknown): unknown => {
  const handler = handlers.get(channel);
  if (handler === undefined) throw new Error(`missing handler: ${channel}`);
  return handler({}, argument);
};

describe("AI IPC registration", () => {
  it("chats without changing messages when no registry is supplied", async () => {
    const current = setup();
    const messages = [{ role: "user" as const, content: "hello" }];
    const config = { model: "override" };
    await expect(invoke(current.handlers, "ai:chat", { messages, config })).resolves.toEqual({ success: true, content: "reply" });
    expect(current.chat).toHaveBeenCalledWith(messages, config);
  });

  it("puts the generated system prompt first and filters prior system messages", async () => {
    const buildSystemPrompt = vi.fn(() => "generated system");
    const current = setup({ buildSystemPrompt });
    await expect(invoke(current.handlers, "ai:chat", {
      messages: [
        { role: "system", content: "old" },
        { role: "user", content: "hello" },
        { role: "assistant", content: "answer" },
      ],
      blockRegistry: "schema",
      themeContext: { uiTheme: "dark" },
    })).resolves.toEqual({ success: true, content: "reply" });
    expect(buildSystemPrompt).toHaveBeenCalledWith("schema", { uiTheme: "dark" });
    expect(current.chat).toHaveBeenCalledWith([
      { role: "system", content: "generated system" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "answer" },
    ], undefined);
  });

  it("preserves chat service errors and thrown failure objects", async () => {
    const serviceError = setup({ chat: vi.fn(async () => ({ content: "", error: "provider rejected" })) });
    await expect(invoke(serviceError.handlers, "ai:chat", { messages: [] })).resolves.toEqual({ success: false, error: "provider rejected" });
    const thrown = setup({ chat: vi.fn(async () => { throw new Error("chat failed"); }) });
    await expect(invoke(thrown.handlers, "ai:chat", { messages: [] })).resolves.toEqual({ success: false, error: "chat failed" });
  });

  it("reports CLI and OpenCode availability without starting a service", async () => {
    const createOpenCodeClient = vi.fn(async () => ({ provider: { list: vi.fn(async () => ({})) } }));
    const current = setup({
      detectCliProvider: vi.fn(async (provider) => ({ available: provider === "codex-cli", path: `${provider}.exe` })),
      createOpenCodeClient,
    });
    await expect(invoke(current.handlers, "ai:checkCliAvailability")).resolves.toEqual({
      success: true,
      availability: {
        "codex-cli": { available: true, path: "codex-cli.exe" },
        "github-cli": { available: false, path: "github-cli.exe" },
        "junie-cli": { available: false, path: "junie-cli.exe" },
        opencode: { available: true },
      },
    });
    expect(createOpenCodeClient).toHaveBeenCalledOnce();
  });

  it("marks OpenCode unavailable when its existing endpoint probe fails", async () => {
    const current = setup({
      createOpenCodeClient: vi.fn(async () => ({ provider: { list: vi.fn(async () => { throw new Error("offline"); }) } })),
    });
    const result = await invoke(current.handlers, "ai:checkCliAvailability");
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(result).toEqual(expect.objectContaining({ availability: expect.objectContaining({ opencode: { available: false } }) }));
  });

  it("returns a failure when a CLI availability probe rejects", async () => {
    const current = setup({ detectCliProvider: vi.fn(async () => { throw new Error("probe failed"); }) });
    await expect(invoke(current.handlers, "ai:checkCliAvailability")).resolves.toEqual({ success: false, error: "probe failed" });
  });

  it("masks config reads and preserves stored keys on masked writes", async () => {
    const current = setup();
    await expect(invoke(current.handlers, "ai:getConfig")).resolves.toEqual({ success: true, config: { ...defaultConfig(), apiKey: "masked:secret" } });
    await expect(invoke(current.handlers, "ai:setConfig", { provider: "google", apiKey: "masked:unchanged" })).resolves.toEqual({
      success: true,
      config: { ...defaultConfig(), provider: "google", apiKey: "masked:secret" },
    });
    expect(current.saveConfig).toHaveBeenCalledWith({ provider: "google" });
  });

  it("returns dynamic models and static models on fallback", async () => {
    const dynamic = setup();
    await expect(invoke(dynamic.handlers, "ai:getModels")).resolves.toEqual({ success: true, models: modelCatalog("dynamic") });
    const fallback = setup({ fetchAvailableModels: vi.fn(async () => { throw new Error("offline"); }) });
    await expect(invoke(fallback.handlers, "ai:getModels")).resolves.toEqual({ success: true, models: modelCatalog("static") });
  });

  it("uses the provider-specific stored key for masked or empty input", async () => {
    const current = setup();
    await expect(invoke(current.handlers, "ai:fetchModelsForProvider", { provider: "google", apiKey: "masked:value" })).resolves.toEqual({ success: true, models: ["remote-model"] });
    expect(current.loadApiKeyForProvider).toHaveBeenCalledWith("google");
    expect(current.fetchModelsForProvider).toHaveBeenCalledWith("google", "stored-key", undefined);
  });

  it("returns an empty models array on provider failure", async () => {
    const current = setup({ fetchModelsForProvider: vi.fn(async () => { throw new Error("models failed"); }) });
    await expect(invoke(current.handlers, "ai:fetchModelsForProvider", { provider: "mistral", apiKey: "direct" })).resolves.toEqual({
      success: false,
      error: "models failed",
      models: [],
    });
  });
});
