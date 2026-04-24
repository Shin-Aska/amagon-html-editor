// ---------------------------------------------------------------------------
// AI Service — provider-agnostic proxy for LLM chat completions.
// Runs in the Electron main process so API keys never reach the renderer.
// ---------------------------------------------------------------------------

import * as path from 'path'
import * as fs from 'fs/promises'
import {app, net} from 'electron'
import {decryptApiKey, encryptApiKey, maskApiKey, MASKED_KEY_PREFIX} from './cryptoHelpers'
import {CLI_BINARY_NAMES, fetchCliModels, spawnCliChat} from './cliHelpers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export type AiProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'mistral' | 'claude-cli' | 'codex-cli' | 'gemini-cli' | 'github-cli' | 'junie-cli' | 'opencode-cli'

export interface AiConfig {
    provider: AiProvider
    model: string
    apiKey: string
    ollamaUrl: string // e.g. http://localhost:11434
}

interface ProviderResponse {
    content: string
    error?: string
}

type CliProvider = Extract<AiProvider, 'claude-cli' | 'codex-cli' | 'gemini-cli' | 'github-cli' | 'junie-cli' | 'opencode-cli'>

/** Shape of the config as persisted to disk (API keys are encrypted). */
interface PersistedAiConfig {
    provider: AiProvider
    model: string
    encryptedApiKeys?: Record<string, string>  // per-provider encrypted keys (current format)
    encryptedApiKey?: string   // legacy single key — auto-migrated on first load
    apiKey?: string            // legacy plaintext — auto-migrated on first load
    ollamaUrl: string
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: AiConfig = {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    ollamaUrl: 'http://localhost:11434'
};

// Re-export crypto helpers so existing imports from aiService still work
export { encryptApiKey, decryptApiKey, maskApiKey, MASKED_KEY_PREFIX } from './cryptoHelpers'

// Fallback model lists — used when dynamic fetching is unavailable
const FALLBACK_MODELS: Record<AiProvider, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o1', 'o1-mini'],
    anthropic: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    google: ['gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    ollama: [],
    mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest', 'mistral-nemo'],
    'claude-cli': [],
    'codex-cli': [],
    'gemini-cli': [],
    'github-cli': [],
    'junie-cli': [],
    'opencode-cli': [
        'opencode/gpt-5.2',
        'opencode/gpt-5.1',
        'opencode/gpt-5',
        'opencode/claude-sonnet-4-6',
        'opencode/claude-opus-4-6',
        'opencode/gemini-3-flash',
        'opencode/kimi-k2.5'
    ]
};

// Re-export for the IPC handler to use as a baseline
export { FALLBACK_MODELS as PROVIDER_MODELS }

function getDefaultModelForProvider(provider: AiProvider, preferredModel?: string): string {
    const providerModels = FALLBACK_MODELS[provider];
    if (preferredModel && (provider === 'ollama' || providerModels.includes(preferredModel))) {
        return preferredModel
    }
    return providerModels[0] ?? ''
}

function getFirstConfiguredAiProvider(encryptedApiKeys: Record<string, string>): AiProvider | null {
    const providers: AiProvider[] = ['openai', 'anthropic', 'google', 'ollama', 'mistral', 'claude-cli', 'codex-cli', 'gemini-cli', 'github-cli', 'junie-cli', 'opencode-cli'];
    return providers.find((provider) => Boolean(encryptedApiKeys[provider])) ?? null
}

// ---------------------------------------------------------------------------
// Config persistence (JSON file in userData)
// ---------------------------------------------------------------------------

function getConfigPath(): string {
    return path.join(app.getPath('userData'), 'ai-config.json')
}

/** Read the persisted file and normalize to the current format (encryptedApiKeys map). */
async function loadPersistedRaw(): Promise<{ persisted: PersistedAiConfig; encryptedApiKeys: Record<string, string> }> {
    try {
        const raw = await fs.readFile(getConfigPath(), 'utf-8');
        const parsed = JSON.parse(raw) as PersistedAiConfig;
        const provider = parsed.provider ?? DEFAULT_CONFIG.provider;

        let encryptedApiKeys: Record<string, string> = { ...(parsed.encryptedApiKeys ?? {}) };

        // Migrate legacy single-key format → per-provider map
        if (Object.keys(encryptedApiKeys).length === 0) {
            if (parsed.encryptedApiKey) {
                encryptedApiKeys[provider] = parsed.encryptedApiKey
            } else if (parsed.apiKey) {
                encryptedApiKeys[provider] = encryptApiKey(parsed.apiKey)
            }

            if (Object.keys(encryptedApiKeys).length > 0) {
                const migrated: PersistedAiConfig = {
                    provider,
                    model: parsed.model ?? DEFAULT_CONFIG.model,
                    encryptedApiKeys,
                    ollamaUrl: parsed.ollamaUrl ?? DEFAULT_CONFIG.ollamaUrl
                };
                await fs.writeFile(getConfigPath(), JSON.stringify(migrated, null, 2), 'utf-8');
                console.log('[AI Service] Migrated legacy API key to per-provider encrypted storage.');
                return { persisted: migrated, encryptedApiKeys }
            }
        }

        return { persisted: parsed, encryptedApiKeys }
    } catch {
        const empty: PersistedAiConfig = {
            provider: DEFAULT_CONFIG.provider,
            model: DEFAULT_CONFIG.model,
            encryptedApiKeys: {},
            ollamaUrl: DEFAULT_CONFIG.ollamaUrl
        };
        return { persisted: empty, encryptedApiKeys: {} }
    }
}

export async function loadConfig(): Promise<AiConfig> {
    const { persisted, encryptedApiKeys } = await loadPersistedRaw();
    const provider = persisted.provider ?? DEFAULT_CONFIG.provider;

    let apiKey = '';
    if (encryptedApiKeys[provider]) {
        try { apiKey = decryptApiKey(encryptedApiKeys[provider]) } catch { /* corrupted key */ }
    }

    return {
        provider,
        model: persisted.model ?? DEFAULT_CONFIG.model,
        apiKey,
        ollamaUrl: persisted.ollamaUrl ?? DEFAULT_CONFIG.ollamaUrl
    }
}

/** Returns the stored (decrypted) API key for a specific provider, regardless of the active provider. */
export async function loadApiKeyForProvider(provider: AiProvider): Promise<string> {
    const { encryptedApiKeys } = await loadPersistedRaw();
    if (encryptedApiKeys[provider]) {
        try { return decryptApiKey(encryptedApiKeys[provider]) } catch { /* corrupted */ }
    }
    return ''
}

/** Returns masked credentials for key-based providers and credentialless CLI providers. */
export async function loadAllProviderCredentials(): Promise<{ provider: AiProvider; hasKey: boolean; maskedKey: string }[]> {
    const { encryptedApiKeys } = await loadPersistedRaw();
    const providers: AiProvider[] = ['openai', 'anthropic', 'google', 'ollama', 'mistral', 'claude-cli', 'codex-cli', 'gemini-cli', 'github-cli', 'junie-cli', 'opencode-cli'];
    const result: { provider: AiProvider; hasKey: boolean; maskedKey: string }[] = [];

    for (const provider of providers) {
        if (isCliProvider(provider)) {
            result.push({ provider, hasKey: true, maskedKey: '' });
            continue
        }
        if (!encryptedApiKeys[provider]) continue;
        let key = '';
        try { key = decryptApiKey(encryptedApiKeys[provider]) } catch { /* corrupted — skip */ }
        if (!key) continue;
        result.push({ provider, hasKey: true, maskedKey: maskApiKey(key) })
    }

    return result
}

/** Removes the stored API key for a specific provider. */
export async function clearApiKeyForProvider(provider: AiProvider): Promise<void> {
    const { persisted, encryptedApiKeys } = await loadPersistedRaw();
    const updatedKeys = { ...encryptedApiKeys };
    const currentProvider = persisted.provider ?? DEFAULT_CONFIG.provider;
    delete updatedKeys[provider];
    const nextProvider = currentProvider === provider
        ? (getFirstConfiguredAiProvider(updatedKeys) ?? DEFAULT_CONFIG.provider)
        : currentProvider;
    const nextModel = nextProvider === currentProvider
        ? (persisted.model ?? DEFAULT_CONFIG.model)
        : getDefaultModelForProvider(nextProvider);

    await fs.writeFile(getConfigPath(), JSON.stringify({
        provider: nextProvider,
        model: nextModel,
        encryptedApiKeys: updatedKeys,
        ollamaUrl: persisted.ollamaUrl ?? DEFAULT_CONFIG.ollamaUrl
    }, null, 2), 'utf-8')
}

/**
 * Saves or clears a provider API key and promotes that provider when the current
 * active provider has no key yet (or when editing the active provider itself).
 */
export async function saveApiKeyForProvider(provider: AiProvider, apiKey: string): Promise<void> {
    const { persisted, encryptedApiKeys } = await loadPersistedRaw();
    const updatedKeys = { ...encryptedApiKeys };
    const currentProvider = persisted.provider ?? DEFAULT_CONFIG.provider;
    const currentModel = persisted.model ?? DEFAULT_CONFIG.model;
    const shouldPromoteProvider = Boolean(apiKey) && (!updatedKeys[currentProvider] || currentProvider === provider);
    const nextProvider = shouldPromoteProvider ? provider : currentProvider;
    const nextModel = shouldPromoteProvider
        ? getDefaultModelForProvider(nextProvider, currentProvider === provider ? currentModel : undefined)
        : currentModel;

    if (apiKey) {
        updatedKeys[provider] = encryptApiKey(apiKey)
    } else {
        delete updatedKeys[provider]
    }

    await fs.writeFile(getConfigPath(), JSON.stringify({
        provider: nextProvider,
        model: nextModel,
        encryptedApiKeys: updatedKeys,
        ollamaUrl: persisted.ollamaUrl ?? DEFAULT_CONFIG.ollamaUrl
    }, null, 2), 'utf-8')
}

export async function saveConfig(config: Partial<AiConfig>): Promise<AiConfig> {
    const { persisted, encryptedApiKeys } = await loadPersistedRaw();

    const current: AiConfig = {
        provider: persisted.provider ?? DEFAULT_CONFIG.provider,
        model: persisted.model ?? DEFAULT_CONFIG.model,
        apiKey: '',
        ollamaUrl: persisted.ollamaUrl ?? DEFAULT_CONFIG.ollamaUrl
    };
    const merged: AiConfig = { ...current, ...config };
    const activeProvider = merged.provider;

    // Preserve existing per-provider keys; only update the active provider's key if explicitly set
    const newEncryptedApiKeys = { ...encryptedApiKeys };
    if (config.apiKey !== undefined && config.apiKey !== '') {
        newEncryptedApiKeys[activeProvider] = encryptApiKey(config.apiKey)
    }

    const newPersisted: PersistedAiConfig = {
        provider: merged.provider,
        model: merged.model,
        encryptedApiKeys: newEncryptedApiKeys,
        ollamaUrl: merged.ollamaUrl
    };

    await fs.writeFile(getConfigPath(), JSON.stringify(newPersisted, null, 2), 'utf-8');

    // Return config with the decrypted key for the active provider
    let activeApiKey = '';
    if (config.apiKey !== undefined && config.apiKey !== '') {
        activeApiKey = config.apiKey
    } else if (newEncryptedApiKeys[activeProvider]) {
        try { activeApiKey = decryptApiKey(newEncryptedApiKeys[activeProvider]) } catch { /* ignore */ }
    }

    return { ...merged, apiKey: activeApiKey }
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

export function buildSystemPrompt(
    blockRegistryJson: string,
    themeContext?: { projectTheme?: unknown; uiTheme?: 'light' | 'dark' }
): string {
    const projectTheme = themeContext?.projectTheme;
    const uiTheme = themeContext?.uiTheme;

    const safeThemeJson = (() => {
        if (!projectTheme || typeof projectTheme !== 'object') return '';
        try {
            const raw = JSON.stringify(projectTheme, null, 2);
            return raw.length > 6000 ? raw.slice(0, 6000) + '\n…(truncated)…' : raw
        } catch {
            return ''
        }
    })();

    const themeSection = safeThemeJson
        ? `\n## Project Theme\nThe current project has a theme system applied to the canvas.\n\nTheme CSS variables available in the page:\n- --theme-primary, --theme-secondary, --theme-accent\n- --theme-bg, --theme-surface\n- --theme-text, --theme-text-muted\n- --theme-border\n- --theme-success, --theme-warning, --theme-danger\n- --theme-font-family, --theme-heading-font-family, --theme-font-size\n- --theme-line-height, --theme-heading-line-height\n- --theme-spacing-unit, --theme-space-0..--theme-space-8\n- --theme-border-radius, --theme-border-width, --theme-border-color\n\nTheme JSON (reference values):\n\n\`\`\`json\n${safeThemeJson}\n\`\`\`\n`
        : '';

    const uiThemeSection = uiTheme
        ? `\n## Editor UI Theme\nThe editor UI is currently in ${uiTheme} mode. This does not change the exported page, but it may influence what users expect to see in previews.\n`
        : '';

    return `You are an AI assistant embedded in "Amagon", a visual HTML editor that uses Bootstrap 5.
The editor represents the page as a tree of Block objects.

${themeSection}${uiThemeSection}

## Block Interface
\`\`\`ts
interface Block {
  id: string       // unique id, e.g. "blk_abc123"
  type: string     // registered block type
  tag?: string     // optional HTML tag override
  props: Record<string, unknown>
  styles: Record<string, string>  // inline CSS
  classes: string[]               // CSS classes
  content?: string
  children: Block[]
}
\`\`\`

## Available Block Types
${blockRegistryJson}

## Rules
- When the user asks you to **generate UI components**, ALWAYS start with a brief 1-2 sentence summary describing what you built (e.g. "Here's a pricing table with three tiers…"). Then provide the JSON block on the next line:
  \`\`\`json
  { "blocks": [ ...array of Block objects... ] }
  \`\`\`
  Generate unique IDs using the format "blk_" followed by a random alphanumeric string.
  Only use block types listed above. Set appropriate \`props\`, \`classes\`, and \`children\`.

- When the user asks a **general question** or makes a **conversational request**, respond with plain text (NOT JSON).

- When the user asks to **modify existing blocks**, respond with a JSON object:
  \`\`\`json
  { "actions": [ { "type": "update", "blockId": "<id>", "patch": { ... } } ] }
  \`\`\`

- Keep your responses concise and practical. You are helping build real web pages.
- Use Bootstrap 5 classes wherever appropriate.
- If a project theme is provided, prefer theme consistency over Bootstrap defaults:
  - Use theme CSS variables via inline styles (e.g. backgroundColor: 'var(--theme-surface)'; color: 'var(--theme-text)') instead of hard-coded hex colors.
  - Avoid Bootstrap semantic colors (e.g. 'text-muted', 'bg-light') when they would conflict with a dark or custom theme; use theme variables instead.
  - Prefer borderRadius: 'var(--theme-border-radius)' and borderColor: 'var(--theme-border)'.
`
}

// ---------------------------------------------------------------------------
// Provider adapters
// ---------------------------------------------------------------------------

async function chatOpenAI(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    const url = 'https://api.openai.com/v1/chat/completions';
    const body = JSON.stringify({
        model: config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_tokens: 4096
    });

    const response = await net.fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`
        },
        body
    });

    if (!response.ok) {
        const errorText = await response.text();
        return { content: '', error: `OpenAI API error (${response.status}): ${errorText}` }
    }

    const data = await response.json() as any;
    return { content: data.choices?.[0]?.message?.content ?? '' }
}

async function chatAnthropic(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    const url = 'https://api.anthropic.com/v1/messages';

    // Anthropic separates system from messages
    const systemMsg = messages.find((m) => m.role === 'system')?.content ?? '';
    const chatMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));

    const body = JSON.stringify({
        model: config.model,
        system: systemMsg,
        messages: chatMessages,
        max_tokens: 4096
    });

    const response = await net.fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01'
        },
        body
    });

    if (!response.ok) {
        const errorText = await response.text();
        return { content: '', error: `Anthropic API error (${response.status}): ${errorText}` }
    }

    const data = await response.json() as any;
    const textBlock = data.content?.find((b: any) => b.type === 'text');
    return { content: textBlock?.text ?? '' }
}

async function chatGoogle(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    const model = config.model || 'gemini-2.5-flash-preview-05-20';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

    // Convert to Google's format
    const systemMsg = messages.find((m) => m.role === 'system')?.content ?? '';
    const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

    const body = JSON.stringify({
        systemInstruction: systemMsg ? { parts: [{ text: systemMsg }] } : undefined,
        contents,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096
        }
    });

    const response = await net.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
    });

    if (!response.ok) {
        const errorText = await response.text();
        return { content: '', error: `Google AI API error (${response.status}): ${errorText}` }
    }

    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return { content: text }
}

async function chatOllama(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    const baseUrl = config.ollamaUrl || 'http://localhost:11434';
    const url = `${baseUrl}/api/chat`;

    const body = JSON.stringify({
        model: config.model || 'llama3',
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false
    });

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

    try {
        const response = await net.fetch(url, {
            method: 'POST',
            headers,
            body
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { content: '', error: `Ollama error (${response.status}): ${errorText}` }
        }

        const data = await response.json() as any;
        return { content: data.message?.content ?? '' }
    } catch (err: any) {
        return {
            content: '',
            error: `Could not connect to Ollama at ${baseUrl}. Is Ollama running? (${err.message})`
        }
    }
}

async function chatMistral(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    const url = 'https://api.mistral.ai/v1/chat/completions';
    const body = JSON.stringify({
        model: config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_tokens: 4096
    });

    const response = await net.fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`
        },
        body
    });

    if (!response.ok) {
        const errorText = await response.text();
        return { content: '', error: `Mistral API error (${response.status}): ${errorText}` }
    }

    const data = await response.json() as any;
    return { content: data.choices?.[0]?.message?.content ?? '' }
}

function formatPromptForCli(messages: ChatMessage[]): string {
    return messages
        .map((message) => {
            const roleLabel = message.role.charAt(0).toUpperCase() + message.role.slice(1);
            return `[${roleLabel}]\n${message.content}`
        })
        .join('\n\n')
}

function normalizeCopilotCliOutput(output: string): string {
    return output
        .replace(/^\s*●\s?/, '')
        .replace(/\n\s*●\s?/g, '\n')
        .trim()
}

function stripAnsi(value: string): string {
    return value.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
}

function normalizeJunieCliOutput(output: string): string {
    const cleaned = stripAnsi(output).trim();
    let result = cleaned;
    try {
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        const jsonPayload = jsonStart >= 0 && jsonEnd > jsonStart
            ? cleaned.slice(jsonStart, jsonEnd + 1)
            : cleaned;
        const parsed = JSON.parse(jsonPayload);
        if (typeof parsed?.result === 'string') result = parsed.result
    } catch {
        result = cleaned
    }

    const summaryMatch = result.match(/^### Summary\s*\n([\s\S]*?)(?:\n### \w|$)/);
    const content = (summaryMatch ? summaryMatch[1] : result)
        .trim();

    return content
        .replace(/^\s*●\s?/, '')
        .replace(/\n\s*●\s?/g, '\n')
        .replace(/^\s*[-*]\s+([^\n]+)$/, '$1')
        .trim()
}

function normalizeOpencodeOutput(output: string): string {
    return stripAnsi(output).trim()
}

function isCliProvider(provider: AiProvider): provider is CliProvider {
    return provider === 'claude-cli' || provider === 'codex-cli' || provider === 'gemini-cli' || provider === 'github-cli' || provider === 'junie-cli' || provider === 'opencode-cli'
}

function getCliInstallInstruction(provider: CliProvider): string {
    if (provider === 'claude-cli') {
        return 'Claude CLI is not installed. Install it from https://docs.anthropic.com/en/docs/claude-cli'
    }
    if (provider === 'codex-cli') {
        return 'Codex CLI is not installed. Install it from https://github.com/openai/codex'
    }
    if (provider === 'gemini-cli') {
        return 'Gemini CLI is not installed. Install it from https://github.com/google-gemini/gemini-cli'
    }
    if (provider === 'github-cli') {
        return 'GitHub Copilot CLI is not installed. Install it from https://github.com/github/copilot-cli and authenticate with `copilot login`.'
    }
    if (provider === 'opencode-cli') {
        return 'Opencode CLI is not installed. Install it from https://opencode.ai'
    }
    return 'Junie CLI is not installed. Install it from https://junie.jetbrains.com/docs/junie-cli.html'
}

function normalizeCliModel(provider: CliProvider, model: string): string {
    const normalized = model.trim();
    if (provider === 'github-cli') {
        const lower = normalized.toLowerCase();
        return !lower || lower === 'default' ? 'default' : normalized
    }

    if (provider === 'junie-cli') {
        const lower = normalized.toLowerCase();
        if (!lower || lower === 'default') return 'default';
        const aliases: Record<string, string> = {
            'gemini 3 flash': 'gemini-3-flash-preview',
            'gemini-3-0-flash': 'gemini-3-flash-preview',
            'gemini_3_0_flash': 'gemini-3-flash-preview',
            'gemini 3.1 flash lite': 'gemini-3.1-flash-lite-preview',
            'gemini-3-1-flash-lite-preview': 'gemini-3.1-flash-lite-preview',
            'gemini_3_1_flash_lite': 'gemini-3.1-flash-lite-preview',
            'gemini 3.1 pro preview': 'gemini-3.1-pro-preview',
            'gemini-3-1-pro-preview': 'gemini-3.1-pro-preview',
            'gemini_3_1_pro': 'gemini-3.1-pro-preview',
            'claude opus 4.6': 'claude-opus-4-6',
            'opus-4.6': 'claude-opus-4-6',
            'opus_4_6': 'claude-opus-4-6',
            'claude opus 4.7': 'claude-opus-4-7',
            'opus-4.7': 'claude-opus-4-7',
            'opus_4_7': 'claude-opus-4-7',
            'claude sonnet 4.6': 'claude-sonnet-4-6',
            'sonnet-4.6': 'claude-sonnet-4-6',
            'sonnet_4_6': 'claude-sonnet-4-6',
            'gpt5': 'gpt-5-2025-08-07',
            'gpt-5': 'gpt-5-2025-08-07',
            'gpt5_2': 'gpt-5.2-2025-12-11',
            'gpt-5.2': 'gpt-5.2-2025-12-11',
            'gpt5_3_codex': 'gpt-5.3-codex',
            'gpt5-3-codex': 'gpt-5.3-codex',
            'gpt5_4': 'gpt-5.4',
            'grok 4.1 fast reasoning': 'grok-4-1-fast-reasoning',
            'grok-4.1-fast-reasoning': 'grok-4-1-fast-reasoning',
            'grok_4_1_fast_reasoning': 'grok-4-1-fast-reasoning'
        };
        return aliases[lower] ?? normalized
    }

    if (provider === 'opencode-cli') {
        const lower = normalized.toLowerCase();
        if (!lower || lower === 'default') return 'default';
        return normalized
    }

    if (provider !== 'claude-cli') return normalized;

    const lower = normalized.toLowerCase();
    if (!lower || lower === 'default') return 'sonnet';
    if (lower.includes('opus')) return 'opus';
    if (lower.includes('haiku')) return 'haiku';
    if (lower.includes('sonnet')) return 'sonnet';
    return normalized
}

function getCliEmptyError(provider: CliProvider, exitCode: number): string {
    if (provider === 'claude-cli') {
        return `Claude CLI exited with code ${exitCode}. Try running "claude --print \"hello\"" in a terminal to verify Claude Code is authenticated and can run non-interactively.`
    }
    if (provider === 'codex-cli') {
        return `Codex CLI exited with code ${exitCode}. Try running "codex exec \"hello\"" in a terminal to verify Codex is authenticated.`
    }
    if (provider === 'gemini-cli') {
        return `Gemini CLI exited with code ${exitCode}. Try running "gemini --prompt \"hello\"" in a terminal to verify Gemini is authenticated.`
    }
    if (provider === 'github-cli') {
        return `GitHub Copilot CLI exited with code ${exitCode}. Try running "copilot login", then "copilot -p \"hello\" --silent --output-format text".`
    }
    if (provider === 'opencode-cli') {
        return `Opencode CLI exited with code ${exitCode}. Try running "opencode run -q \\"hello\\"" in a terminal to verify opencode is authenticated.`
    }
    return `Junie CLI exited with code ${exitCode}. Try running "junie --task \"hello\" --output-format text" in a terminal to verify Junie is authenticated.`
}

async function runCliChat(
    provider: CliProvider,
    args: string[],
    messages: ChatMessage[],
    stdinOverride?: string,
    timeoutMs?: number
): Promise<ProviderResponse> {
    const prompt = formatPromptForCli(messages);

    try {
        const result = await spawnCliChat(CLI_BINARY_NAMES[provider], args, stdinOverride ?? prompt, timeoutMs);
        if (result.exitCode !== 0) {
            const error = result.stderr.trim() || result.stdout.trim() || getCliEmptyError(provider, result.exitCode);
            return { content: '', error }
        }

        const content = provider === 'github-cli'
            ? normalizeCopilotCliOutput(result.stdout)
            : provider === 'junie-cli'
                ? normalizeJunieCliOutput(result.stdout)
                : provider === 'opencode-cli'
                    ? normalizeOpencodeOutput(result.stdout)
                    : result.stdout.trim();
        if (!content) {
            const error = result.stderr.trim() || 'CLI returned no output.';
            return { content: '', error }
        }
        return { content }
    } catch (err: any) {
        if (err?.code === 'ENOENT') {
            return { content: '', error: getCliInstallInstruction(provider) }
        }
        return { content: '', error: err?.message ?? 'CLI request failed.' }
    }
}

async function chatClaudeCli(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    return runCliChat(
        'claude-cli',
        ['--print', '--input-format', 'text', '--model', normalizeCliModel('claude-cli', config.model), '--output-format', 'text'],
        messages
    )
}

async function chatCodexCli(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    return runCliChat(
        'codex-cli',
        ['exec', '--model', normalizeCliModel('codex-cli', config.model), '-'],
        messages
    )
}

async function chatGeminiCli(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    return runCliChat(
        'gemini-cli',
        ['--prompt', ' ', '--model', normalizeCliModel('gemini-cli', config.model)],
        messages
    )
}

async function chatGithubCli(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    const prompt = formatPromptForCli(messages);
    const model = normalizeCliModel('github-cli', config.model);
    const args = [
        '--silent',
        '--output-format', 'text',
        '--stream', 'off',
        '--no-color',
        '--no-auto-update',
        '--disable-builtin-mcps',
        '--no-custom-instructions',
        '--no-ask-user'
    ];
    if (model !== 'default') args.push('--model', model);

    return runCliChat(
        'github-cli',
        args,
        messages,
        prompt
    )
}

async function chatJunieCli(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    const prompt = [
        'You are being used by Amagon as a chat/completion provider, not as a code-editing agent.',
        'Do not inspect, create, modify, delete, or run files.',
        'Put the complete assistant response in the Summary section of your task result. Do not merely say that you complied.',
        'Answer only from the request text below.',
        '',
        formatPromptForCli(messages)
    ].join('\n');
    const model = normalizeCliModel('junie-cli', config.model);
    const tempProjectDir = await fs.mkdtemp(path.join(app.getPath('temp'), 'amagon-junie-'));
    const args = ['--project', tempProjectDir, '--input-format', 'text', '--output-format', 'json', '--skip-update-check'];
    if (model !== 'default') args.push('--model', model);

    try {
        return await runCliChat('junie-cli', args, messages, prompt, 300_000)
    } finally {
        await fs.rm(tempProjectDir, { recursive: true, force: true }).catch(() => undefined)
    }
}

async function chatOpencodeCli(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    const prompt = [
        'You are being used by Amagon as a chat/completion provider, not as a code-editing agent.',
        'Do not inspect, create, modify, delete, or run files.',
        'Answer only from the request text below.',
        '',
        formatPromptForCli(messages)
    ].join('\n');

    const model = normalizeCliModel('opencode-cli', config.model);
    const args = ['run'];
    if (model !== 'default') args.push('--model', model);

    return runCliChat('opencode-cli', args, messages, prompt, 300_000)
}

// ---------------------------------------------------------------------------
// Main chat dispatcher
// ---------------------------------------------------------------------------

const ADAPTERS: Record<AiProvider, (msgs: ChatMessage[], cfg: AiConfig) => Promise<ProviderResponse>> = {
    openai: chatOpenAI,
    anthropic: chatAnthropic,
    google: chatGoogle,
    ollama: chatOllama,
    mistral: chatMistral,
    'claude-cli': chatClaudeCli,
    'codex-cli': chatCodexCli,
    'gemini-cli': chatGeminiCli,
    'github-cli': chatGithubCli,
    'junie-cli': chatJunieCli,
    'opencode-cli': chatOpencodeCli
};

// ---------------------------------------------------------------------------
// Dynamic model discovery
// ---------------------------------------------------------------------------

const MODEL_FETCH_TIMEOUT_MS = 10_000;

async function fetchGoogleModels(apiKey: string): Promise<string[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS);

    try {
        const response = await net.fetch(url, { signal: controller.signal });
        if (!response.ok) return [];
        const data = (await response.json()) as any;
        if (!Array.isArray(data.models)) return [];

        return data.models
            .filter((m: any) =>
                Array.isArray(m.supportedGenerationMethods) &&
                m.supportedGenerationMethods.includes('generateContent')
            )
            .map((m: any) => String(m.name ?? '').replace(/^models\//, ''))
            .filter((name: string) => name.length > 0)
    } finally {
        clearTimeout(timer)
    }
}

async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
    const url = 'https://api.openai.com/v1/models';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS);

    try {
        const response = await net.fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal
        });
        if (!response.ok) return [];
        const data = (await response.json()) as any;
        if (!Array.isArray(data.data)) return [];

        // Keep only chat-capable models
        const chatPrefixes = ['gpt-4', 'gpt-3.5', 'o1', 'o3', 'o4', 'chatgpt'];
        return data.data
            .map((m: any) => m.id as string)
            .filter((id: string) =>
                chatPrefixes.some((p) => id.startsWith(p)) &&
                !id.includes('instruct') &&
                !id.includes('realtime')
            )
            .sort()
            .reverse()
    } finally {
        clearTimeout(timer)
    }
}

async function fetchOllamaModels(ollamaUrl: string, apiKey?: string): Promise<string[]> {
    const baseUrl = ollamaUrl || 'http://localhost:11434';
    const url = `${baseUrl}/api/tags`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS);

    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    try {
        const response = await net.fetch(url, { signal: controller.signal, headers });
        if (!response.ok) return [];
        const data = (await response.json()) as any;
        if (!Array.isArray(data.models)) return [];

        return data.models.map((m: any) => String(m.name ?? ''))
    } finally {
        clearTimeout(timer)
    }
}

async function fetchMistralModels(apiKey: string): Promise<string[]> {
    const url = 'https://api.mistral.ai/v1/models';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS);

    try {
        const response = await net.fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal
        });
        if (!response.ok) return [];
        const data = (await response.json()) as any;
        if (!Array.isArray(data.data)) return [];

        return data.data.map((m: any) => m.id as string).filter((id: string) => id.length > 0)
    } finally {
        clearTimeout(timer)
    }
}

export async function fetchModelsForProvider(
    provider: AiProvider,
    apiKey: string,
    ollamaUrl?: string
): Promise<string[]> {
    try {
        if (isCliProvider(provider)) return await fetchCliModels(provider, FALLBACK_MODELS[provider]);
        if (provider !== 'ollama' && provider !== 'anthropic' && !apiKey) return [];
        if (provider === 'openai') return await fetchOpenAIModels(apiKey);
        if (provider === 'google') return await fetchGoogleModels(apiKey);
        if (provider === 'mistral') return await fetchMistralModels(apiKey);
        if (provider === 'ollama') {
            return await fetchOllamaModels(ollamaUrl || 'http://localhost:11434', apiKey || undefined)
        }
        // Anthropic has no public list-models endpoint
        if (provider === 'anthropic') {
            return apiKey ? FALLBACK_MODELS.anthropic : []
        }
    } catch {
        // fall through
    }
    return []
}

export async function fetchAvailableModels(): Promise<Record<AiProvider, string[]>> {
    const { persisted, encryptedApiKeys } = await loadPersistedRaw();

    // Decrypt all stored per-provider keys
    const apiKeys: Record<string, string> = {};
    for (const [provider, encrypted] of Object.entries(encryptedApiKeys)) {
        try { apiKeys[provider] = decryptApiKey(encrypted) } catch { /* skip corrupted */ }
    }

    const result: Record<AiProvider, string[]> = {
        openai: [],
        anthropic: [],
        google: [],
        ollama: [],
        mistral: [],
        'claude-cli': [],
        'codex-cli': [],
        'gemini-cli': [],
        'github-cli': [],
        'junie-cli': [],
        'opencode-cli': []
    };

    const fetchers: Promise<void>[] = [];

    // Anthropic has no public list-models endpoint — use fallback if key is present
    if (apiKeys['anthropic']) {
        result.anthropic = [...FALLBACK_MODELS.anthropic]
    }

    if (apiKeys['openai']) {
        fetchers.push(
            fetchOpenAIModels(apiKeys['openai'])
                .then((models) => { result.openai = models })
                .catch(() => { /* keep empty */ })
        )
    }

    if (apiKeys['google']) {
        fetchers.push(
            fetchGoogleModels(apiKeys['google'])
                .then((models) => { result.google = models })
                .catch(() => { /* keep empty */ })
        )
    }

    if (apiKeys['mistral']) {
        fetchers.push(
            fetchMistralModels(apiKeys['mistral'])
                .then((models) => { result.mistral = models.length > 0 ? models : FALLBACK_MODELS.mistral })
                .catch(() => { result.mistral = FALLBACK_MODELS.mistral })
        )
    }

    // Ollama: try the configured URL with the optional stored key
    fetchers.push(
        fetchOllamaModels(persisted.ollamaUrl ?? DEFAULT_CONFIG.ollamaUrl, apiKeys['ollama'])
            .then((models) => { if (models.length > 0) result.ollama = models })
            .catch(() => { /* server unreachable — leave empty */ })
    );

    const cliProviders: CliProvider[] = ['claude-cli', 'codex-cli', 'gemini-cli', 'github-cli', 'junie-cli', 'opencode-cli'];
    for (const provider of cliProviders) {
        fetchers.push(
            fetchCliModels(provider, FALLBACK_MODELS[provider])
                .then((models) => { result[provider] = models })
                .catch(() => { /* leave empty when lookup fails */ })
        )
    }

    await Promise.allSettled(fetchers);
    return result
}

export async function chat(
    messages: ChatMessage[],
    config?: Partial<AiConfig>
): Promise<{ content: string; error?: string }> {
    const cfg = config
        ? { ...(await loadConfig()), ...config }
        : await loadConfig();

    // Validate config
    if (!isCliProvider(cfg.provider) && cfg.provider !== 'ollama' && !cfg.apiKey) {
        return { content: '', error: `No API key configured for ${cfg.provider}. Please add your API key in the AI settings.` }
    }

    const adapter = ADAPTERS[cfg.provider];
    if (!adapter) {
        return { content: '', error: `Unknown provider: ${cfg.provider}` }
    }

    try {
        return await adapter(messages, cfg)
    } catch (err: any) {
        return { content: '', error: `AI request failed: ${err.message}` }
    }
}
