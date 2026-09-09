import type { AiConfig, AiProvider, ChatMessage } from "./aiService";
import { assertTrustedMainFrame } from "./projects/projectIpcSecurity";

type CliProvider = Extract<AiProvider, "codex-cli" | "github-cli" | "junie-cli">;
type CliAvailability = { readonly available: boolean; readonly path?: string; readonly version?: string };
type ModelCatalog = Record<AiProvider, string[]>;
type IpcEvent = Parameters<typeof assertTrustedMainFrame>[0];
type MainWindow = Parameters<typeof assertTrustedMainFrame>[1];
type Handler<TArgument> = (event: IpcEvent, argument: TArgument) => unknown;

interface ChatRequest {
  readonly messages: ChatMessage[];
  readonly blockRegistry?: string;
  readonly config?: Partial<AiConfig>;
  readonly themeContext?: { readonly projectTheme?: unknown; readonly uiTheme?: "light" | "dark" };
}

interface ProviderModelsRequest {
  readonly provider: AiProvider;
  readonly apiKey: string;
  readonly ollamaUrl?: string;
}

interface OpenCodeClient {
  readonly provider: { readonly list: () => Promise<unknown> };
}

export interface AiIpcContext {
  readonly handle: <TArgument>(channel: string, handler: Handler<TArgument>) => void;
  readonly getMainWindow: () => MainWindow;
  readonly buildSystemPrompt: (blockRegistry: string, themeContext?: ChatRequest["themeContext"]) => string;
  readonly chat: (messages: ChatMessage[], config?: Partial<AiConfig>) => Promise<{ content: string; error?: string }>;
  readonly cliBinaryNames: Readonly<Record<CliProvider, string>>;
  readonly detectCliProvider: (provider: CliProvider) => Promise<CliAvailability>;
  readonly createOpenCodeClient: () => Promise<OpenCodeClient>;
  readonly loadConfig: () => Promise<AiConfig>;
  readonly saveConfig: (config: Partial<AiConfig>) => Promise<AiConfig>;
  readonly maskApiKey: (apiKey: string) => string;
  readonly maskedKeyPrefix: string;
  readonly fetchAvailableModels: () => Promise<ModelCatalog>;
  readonly staticModels: ModelCatalog;
  readonly loadApiKeyForProvider: (provider: AiProvider) => Promise<string>;
  readonly fetchModelsForProvider: (provider: AiProvider, apiKey: string, ollamaUrl?: string) => Promise<string[]>;
}

const isCliProvider = (provider: string): provider is CliProvider => (
  provider === "codex-cli" || provider === "github-cli" || provider === "junie-cli"
);
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export const registerAiIpc = (context: AiIpcContext): void => {
  context.handle<ChatRequest>("ai:chat", async (event, data) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      let messages = data.messages;
      if (data.blockRegistry) {
        const systemPrompt = context.buildSystemPrompt(data.blockRegistry, data.themeContext);
        messages = [
          { role: "system", content: systemPrompt },
          ...messages.filter((message) => message.role !== "system"),
        ];
      }
      const result = await context.chat(messages, data.config);
      return result.error
        ? { success: false, error: result.error }
        : { success: true, content: result.content };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });

  context.handle<never>("ai:checkCliAvailability", async (event) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      const providerIds = Object.keys(context.cliBinaryNames).filter(isCliProvider);
      const entries = await Promise.all(providerIds.map(async (providerId) => (
        [providerId, await context.detectCliProvider(providerId)] as const
      )));
      let openCodeAvailable = false;
      try {
        const client = await context.createOpenCodeClient();
        await client.provider.list();
        openCodeAvailable = true;
      } catch {
        openCodeAvailable = false;
      }
      return {
        success: true,
        availability: {
          ...Object.fromEntries(entries),
          opencode: { available: openCodeAvailable },
        },
      };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });

  context.handle<never>("ai:getConfig", async (event) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      const config = await context.loadConfig();
      return { success: true, config: { ...config, apiKey: context.maskApiKey(config.apiKey) } };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });

  context.handle<Partial<AiConfig>>("ai:setConfig", async (event, config) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      const configToSave = { ...config };
      if (configToSave.apiKey?.startsWith(context.maskedKeyPrefix)) delete configToSave.apiKey;
      const saved = await context.saveConfig(configToSave);
      return { success: true, config: { ...saved, apiKey: context.maskApiKey(saved.apiKey) } };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });

  context.handle<never>("ai:getModels", async (event) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      return { success: true, models: await context.fetchAvailableModels() };
    } catch {
      return { success: true, models: context.staticModels };
    }
  });

  context.handle<ProviderModelsRequest>("ai:fetchModelsForProvider", async (event, data) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      let apiKey = data.apiKey || "";
      if (!apiKey || apiKey.startsWith(context.maskedKeyPrefix)) {
        apiKey = await context.loadApiKeyForProvider(data.provider);
      }
      const models = await context.fetchModelsForProvider(data.provider, apiKey, data.ollamaUrl);
      return { success: true, models };
    } catch (error) {
      return { success: false, error: errorMessage(error), models: [] };
    }
  });
};
