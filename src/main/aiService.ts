// ---------------------------------------------------------------------------
// AI Service — provider-agnostic proxy for LLM chat completions.
// Runs in the Electron main process so API keys never reach the renderer.
// ---------------------------------------------------------------------------

import * as path from 'path'
import * as fs from 'fs/promises'
import { app, net } from 'electron'
import { encryptApiKey, decryptApiKey, maskApiKey, MASKED_KEY_PREFIX } from './cryptoHelpers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export type AiProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'mistral'

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
}

// Re-export crypto helpers so existing imports from aiService still work
export { encryptApiKey, decryptApiKey, maskApiKey, MASKED_KEY_PREFIX } from './cryptoHelpers'

// Fallback model lists — used when dynamic fetching is unavailable
const FALLBACK_MODELS: Record<AiProvider, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o1', 'o1-mini'],
    anthropic: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    google: ['gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    ollama: ['llama3.3', 'deepseek-r1', 'qwen3', 'mistral', 'phi4', 'gemma3'],
    mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest', 'mistral-nemo']
}

// Re-export for the IPC handler to use as a baseline
export { FALLBACK_MODELS as PROVIDER_MODELS }

// ---------------------------------------------------------------------------
// Config persistence (JSON file in userData)
// ---------------------------------------------------------------------------

function getConfigPath(): string {
    return path.join(app.getPath('userData'), 'ai-config.json')
}

/** Read the persisted file and normalize to the current format (encryptedApiKeys map). */
async function loadPersistedRaw(): Promise<{ persisted: PersistedAiConfig; encryptedApiKeys: Record<string, string> }> {
    try {
        const raw = await fs.readFile(getConfigPath(), 'utf-8')
        const parsed = JSON.parse(raw) as PersistedAiConfig
        const provider = parsed.provider ?? DEFAULT_CONFIG.provider

        let encryptedApiKeys: Record<string, string> = { ...(parsed.encryptedApiKeys ?? {}) }

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
                }
                await fs.writeFile(getConfigPath(), JSON.stringify(migrated, null, 2), 'utf-8')
                console.log('[AI Service] Migrated legacy API key to per-provider encrypted storage.')
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
        }
        return { persisted: empty, encryptedApiKeys: {} }
    }
}

export async function loadConfig(): Promise<AiConfig> {
    const { persisted, encryptedApiKeys } = await loadPersistedRaw()
    const provider = persisted.provider ?? DEFAULT_CONFIG.provider

    let apiKey = ''
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
    const { encryptedApiKeys } = await loadPersistedRaw()
    if (encryptedApiKeys[provider]) {
        try { return decryptApiKey(encryptedApiKeys[provider]) } catch { /* corrupted */ }
    }
    return ''
}

export async function saveConfig(config: Partial<AiConfig>): Promise<AiConfig> {
    const { persisted, encryptedApiKeys } = await loadPersistedRaw()

    const current: AiConfig = {
        provider: persisted.provider ?? DEFAULT_CONFIG.provider,
        model: persisted.model ?? DEFAULT_CONFIG.model,
        apiKey: '',
        ollamaUrl: persisted.ollamaUrl ?? DEFAULT_CONFIG.ollamaUrl
    }
    const merged: AiConfig = { ...current, ...config }
    const activeProvider = merged.provider

    // Preserve existing per-provider keys; only update the active provider's key if explicitly set
    const newEncryptedApiKeys = { ...encryptedApiKeys }
    if (config.apiKey !== undefined && config.apiKey !== '') {
        newEncryptedApiKeys[activeProvider] = encryptApiKey(config.apiKey)
    }

    const newPersisted: PersistedAiConfig = {
        provider: merged.provider,
        model: merged.model,
        encryptedApiKeys: newEncryptedApiKeys,
        ollamaUrl: merged.ollamaUrl
    }

    await fs.writeFile(getConfigPath(), JSON.stringify(newPersisted, null, 2), 'utf-8')

    // Return config with the decrypted key for the active provider
    let activeApiKey = ''
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
    const projectTheme = themeContext?.projectTheme
    const uiTheme = themeContext?.uiTheme

    const safeThemeJson = (() => {
        if (!projectTheme || typeof projectTheme !== 'object') return ''
        try {
            const raw = JSON.stringify(projectTheme, null, 2)
            return raw.length > 6000 ? raw.slice(0, 6000) + '\n…(truncated)…' : raw
        } catch {
            return ''
        }
    })()

    const themeSection = safeThemeJson
        ? `\n## Project Theme\nThe current project has a theme system applied to the canvas.\n\nTheme CSS variables available in the page:\n- --theme-primary, --theme-secondary, --theme-accent\n- --theme-bg, --theme-surface\n- --theme-text, --theme-text-muted\n- --theme-border\n- --theme-success, --theme-warning, --theme-danger\n- --theme-font-family, --theme-heading-font-family, --theme-font-size\n- --theme-line-height, --theme-heading-line-height\n- --theme-spacing-unit, --theme-space-0..--theme-space-8\n- --theme-border-radius, --theme-border-width, --theme-border-color\n\nTheme JSON (reference values):\n\n\`\`\`json\n${safeThemeJson}\n\`\`\`\n`
        : ''

    const uiThemeSection = uiTheme
        ? `\n## Editor UI Theme\nThe editor UI is currently in ${uiTheme} mode. This does not change the exported page, but it may influence what users expect to see in previews.\n`
        : ''

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
    const url = 'https://api.openai.com/v1/chat/completions'
    const body = JSON.stringify({
        model: config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_tokens: 4096
    })

    const response = await net.fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`
        },
        body
    })

    if (!response.ok) {
        const errorText = await response.text()
        return { content: '', error: `OpenAI API error (${response.status}): ${errorText}` }
    }

    const data = await response.json() as any
    return { content: data.choices?.[0]?.message?.content ?? '' }
}

async function chatAnthropic(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    const url = 'https://api.anthropic.com/v1/messages'

    // Anthropic separates system from messages
    const systemMsg = messages.find((m) => m.role === 'system')?.content ?? ''
    const chatMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }))

    const body = JSON.stringify({
        model: config.model,
        system: systemMsg,
        messages: chatMessages,
        max_tokens: 4096
    })

    const response = await net.fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01'
        },
        body
    })

    if (!response.ok) {
        const errorText = await response.text()
        return { content: '', error: `Anthropic API error (${response.status}): ${errorText}` }
    }

    const data = await response.json() as any
    const textBlock = data.content?.find((b: any) => b.type === 'text')
    return { content: textBlock?.text ?? '' }
}

async function chatGoogle(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    const model = config.model || 'gemini-2.5-flash-preview-05-20'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`

    // Convert to Google's format
    const systemMsg = messages.find((m) => m.role === 'system')?.content ?? ''
    const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }))

    const body = JSON.stringify({
        systemInstruction: systemMsg ? { parts: [{ text: systemMsg }] } : undefined,
        contents,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096
        }
    })

    const response = await net.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
    })

    if (!response.ok) {
        const errorText = await response.text()
        return { content: '', error: `Google AI API error (${response.status}): ${errorText}` }
    }

    const data = await response.json() as any
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return { content: text }
}

async function chatOllama(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    const baseUrl = config.ollamaUrl || 'http://localhost:11434'
    const url = `${baseUrl}/api/chat`

    const body = JSON.stringify({
        model: config.model || 'llama3',
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false
    })

    try {
        const response = await net.fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        })

        if (!response.ok) {
            const errorText = await response.text()
            return { content: '', error: `Ollama error (${response.status}): ${errorText}` }
        }

        const data = await response.json() as any
        return { content: data.message?.content ?? '' }
    } catch (err: any) {
        return {
            content: '',
            error: `Could not connect to Ollama at ${baseUrl}. Is Ollama running? (${err.message})`
        }
    }
}

async function chatMistral(messages: ChatMessage[], config: AiConfig): Promise<ProviderResponse> {
    const url = 'https://api.mistral.ai/v1/chat/completions'
    const body = JSON.stringify({
        model: config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_tokens: 4096
    })

    const response = await net.fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`
        },
        body
    })

    if (!response.ok) {
        const errorText = await response.text()
        return { content: '', error: `Mistral API error (${response.status}): ${errorText}` }
    }

    const data = await response.json() as any
    return { content: data.choices?.[0]?.message?.content ?? '' }
}

// ---------------------------------------------------------------------------
// Main chat dispatcher
// ---------------------------------------------------------------------------

const ADAPTERS: Record<AiProvider, (msgs: ChatMessage[], cfg: AiConfig) => Promise<ProviderResponse>> = {
    openai: chatOpenAI,
    anthropic: chatAnthropic,
    google: chatGoogle,
    ollama: chatOllama,
    mistral: chatMistral
}

// ---------------------------------------------------------------------------
// Dynamic model discovery
// ---------------------------------------------------------------------------

const MODEL_FETCH_TIMEOUT_MS = 10_000

async function fetchGoogleModels(apiKey: string): Promise<string[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS)

    try {
        const response = await net.fetch(url, { signal: controller.signal })
        if (!response.ok) return []
        const data = (await response.json()) as any
        if (!Array.isArray(data.models)) return []

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
    const url = 'https://api.openai.com/v1/models'
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS)

    try {
        const response = await net.fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal
        })
        if (!response.ok) return []
        const data = (await response.json()) as any
        if (!Array.isArray(data.data)) return []

        // Keep only chat-capable models
        const chatPrefixes = ['gpt-4', 'gpt-3.5', 'o1', 'o3', 'o4', 'chatgpt']
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

async function fetchOllamaModels(ollamaUrl: string): Promise<string[]> {
    const baseUrl = ollamaUrl || 'http://localhost:11434'
    const url = `${baseUrl}/api/tags`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS)

    try {
        const response = await net.fetch(url, { signal: controller.signal })
        if (!response.ok) return []
        const data = (await response.json()) as any
        if (!Array.isArray(data.models)) return []

        return data.models.map((m: any) => String(m.name ?? ''))
    } finally {
        clearTimeout(timer)
    }
}

async function fetchMistralModels(apiKey: string): Promise<string[]> {
    const url = 'https://api.mistral.ai/v1/models'
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS)

    try {
        const response = await net.fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal
        })
        if (!response.ok) return []
        const data = (await response.json()) as any
        if (!Array.isArray(data.data)) return []

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
        if (provider !== 'ollama' && !apiKey) return []
        if (provider === 'openai') return await fetchOpenAIModels(apiKey)
        if (provider === 'google') return await fetchGoogleModels(apiKey)
        if (provider === 'mistral') return await fetchMistralModels(apiKey)
        if (provider === 'ollama') {
            const models = await fetchOllamaModels(ollamaUrl || 'http://localhost:11434')
            return models.length > 0 ? models : FALLBACK_MODELS.ollama
        }
        // Anthropic has no public list-models endpoint
        if (provider === 'anthropic') {
            return apiKey ? FALLBACK_MODELS.anthropic : []
        }
    } catch {
        // fall through
    }
    return provider === 'ollama' ? (FALLBACK_MODELS[provider] || []) : []
}

export async function fetchAvailableModels(): Promise<Record<AiProvider, string[]>> {
    const { persisted, encryptedApiKeys } = await loadPersistedRaw()

    // Decrypt all stored per-provider keys
    const apiKeys: Record<string, string> = {}
    for (const [provider, encrypted] of Object.entries(encryptedApiKeys)) {
        try { apiKeys[provider] = decryptApiKey(encrypted) } catch { /* skip corrupted */ }
    }

    const result: Record<AiProvider, string[]> = {
        openai: [],
        anthropic: [],
        google: [],
        ollama: [...FALLBACK_MODELS.ollama],
        mistral: []
    }

    const fetchers: Promise<void>[] = []

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

    // Ollama: always try (local server, no API key needed)
    fetchers.push(
        fetchOllamaModels(persisted.ollamaUrl ?? DEFAULT_CONFIG.ollamaUrl)
            .then((models) => { if (models.length > 0) result.ollama = models })
            .catch(() => { /* keep fallback */ })
    )

    await Promise.allSettled(fetchers)
    return result
}

export async function chat(
    messages: ChatMessage[],
    config?: Partial<AiConfig>
): Promise<{ content: string; error?: string }> {
    const cfg = config
        ? { ...(await loadConfig()), ...config }
        : await loadConfig()

    // Validate config
    if (cfg.provider !== 'ollama' && !cfg.apiKey) {
        return { content: '', error: `No API key configured for ${cfg.provider}. Please add your API key in the AI settings.` }
    }

    const adapter = ADAPTERS[cfg.provider]
    if (!adapter) {
        return { content: '', error: `Unknown provider: ${cfg.provider}` }
    }

    try {
        return await adapter(messages, cfg)
    } catch (err: any) {
        return { content: '', error: `AI request failed: ${err.message}` }
    }
}
