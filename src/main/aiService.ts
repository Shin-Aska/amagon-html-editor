// ---------------------------------------------------------------------------
// AI Service — provider-agnostic proxy for LLM chat completions.
// Runs in the Electron main process so API keys never reach the renderer.
// ---------------------------------------------------------------------------

import * as path from 'path'
import * as fs from 'fs/promises'
import { app, net, safeStorage } from 'electron'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export type AiProvider = 'openai' | 'anthropic' | 'google' | 'ollama'

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

/** Shape of the config as persisted to disk (API key is encrypted). */
interface PersistedAiConfig {
    provider: AiProvider
    model: string
    encryptedApiKey?: string   // base64-encoded, encrypted via safeStorage
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

// ---------------------------------------------------------------------------
// Secure key storage helpers
// ---------------------------------------------------------------------------

export const MASKED_KEY_PREFIX = '\u2022\u2022\u2022\u2022'

function encryptApiKey(plaintext: string): string {
    if (!plaintext) return ''
    if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.encryptString(plaintext).toString('base64')
    }
    // Fallback: base64-obfuscate (not truly secure, but better than plaintext)
    console.warn('[AI Service] OS-level encryption unavailable. API key stored with basic obfuscation only.')
    return Buffer.from(`__PLAIN__${plaintext}`).toString('base64')
}

function decryptApiKey(encoded: string): string {
    if (!encoded) return ''
    const buffer = Buffer.from(encoded, 'base64')
    if (safeStorage.isEncryptionAvailable()) {
        try {
            return safeStorage.decryptString(buffer)
        } catch {
            // May have been stored with the fallback encoder
            const text = buffer.toString('utf-8')
            if (text.startsWith('__PLAIN__')) return text.slice(9)
            return ''
        }
    }
    // Fallback decode
    const text = buffer.toString('utf-8')
    if (text.startsWith('__PLAIN__')) return text.slice(9)
    return ''
}

export function maskApiKey(apiKey: string): string {
    if (!apiKey) return ''
    if (apiKey.length <= 4) return MASKED_KEY_PREFIX
    return MASKED_KEY_PREFIX + apiKey.slice(-4)
}

// Fallback model lists — used when dynamic fetching is unavailable
const FALLBACK_MODELS: Record<AiProvider, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o1', 'o1-mini'],
    anthropic: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    google: ['gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    ollama: ['llama3.3', 'deepseek-r1', 'qwen3', 'mistral', 'phi4', 'gemma3']
}

// Re-export for the IPC handler to use as a baseline
export { FALLBACK_MODELS as PROVIDER_MODELS }

// ---------------------------------------------------------------------------
// Config persistence (JSON file in userData)
// ---------------------------------------------------------------------------

function getConfigPath(): string {
    return path.join(app.getPath('userData'), 'ai-config.json')
}

export async function loadConfig(): Promise<AiConfig> {
    try {
        const raw = await fs.readFile(getConfigPath(), 'utf-8')
        const parsed = JSON.parse(raw) as PersistedAiConfig

        let apiKey = ''

        if (parsed.encryptedApiKey) {
            // Decrypt the stored key
            apiKey = decryptApiKey(parsed.encryptedApiKey)
        } else if (parsed.apiKey) {
            // Legacy migration: encrypt the plaintext key and rewrite the file
            apiKey = parsed.apiKey
            const migrated: PersistedAiConfig = {
                provider: parsed.provider ?? DEFAULT_CONFIG.provider,
                model: parsed.model ?? DEFAULT_CONFIG.model,
                encryptedApiKey: encryptApiKey(apiKey),
                ollamaUrl: parsed.ollamaUrl ?? DEFAULT_CONFIG.ollamaUrl
            }
            await fs.writeFile(getConfigPath(), JSON.stringify(migrated, null, 2), 'utf-8')
            console.log('[AI Service] Migrated plaintext API key to encrypted storage.')
        }

        return {
            provider: parsed.provider ?? DEFAULT_CONFIG.provider,
            model: parsed.model ?? DEFAULT_CONFIG.model,
            apiKey,
            ollamaUrl: parsed.ollamaUrl ?? DEFAULT_CONFIG.ollamaUrl
        }
    } catch {
        return { ...DEFAULT_CONFIG }
    }
}

export async function saveConfig(config: Partial<AiConfig>): Promise<AiConfig> {
    const current = await loadConfig()
    const merged: AiConfig = { ...current, ...config }

    // Persist with the API key encrypted — never write plaintext to disk
    const persisted: PersistedAiConfig = {
        provider: merged.provider,
        model: merged.model,
        encryptedApiKey: encryptApiKey(merged.apiKey),
        ollamaUrl: merged.ollamaUrl
    }

    await fs.writeFile(getConfigPath(), JSON.stringify(persisted, null, 2), 'utf-8')
    return merged
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

export function buildSystemPrompt(blockRegistryJson: string): string {
    return `You are an AI assistant embedded in "Amagon", a visual HTML editor that uses Bootstrap 5.
The editor represents the page as a tree of Block objects.

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
- When the user asks you to **generate UI components**, respond with a JSON object:
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

// ---------------------------------------------------------------------------
// Main chat dispatcher
// ---------------------------------------------------------------------------

const ADAPTERS: Record<AiProvider, (msgs: ChatMessage[], cfg: AiConfig) => Promise<ProviderResponse>> = {
    openai: chatOpenAI,
    anthropic: chatAnthropic,
    google: chatGoogle,
    ollama: chatOllama
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

/**
 * Fetch real model lists from provider APIs. Returns the fallback list
 * for any provider whose API could not be reached.
 */
export async function fetchAvailableModels(): Promise<Record<AiProvider, string[]>> {
    const config = await loadConfig()
    const result: Record<AiProvider, string[]> = {
        openai: [...FALLBACK_MODELS.openai],
        anthropic: [...FALLBACK_MODELS.anthropic],
        google: [...FALLBACK_MODELS.google],
        ollama: [...FALLBACK_MODELS.ollama]
    }

    const fetchers: Promise<void>[] = []

    // Query the currently-configured provider (we only have one API key)
    if (config.apiKey) {
        if (config.provider === 'google') {
            fetchers.push(
                fetchGoogleModels(config.apiKey)
                    .then((models) => { if (models.length > 0) result.google = models })
                    .catch(() => { /* keep fallback */ })
            )
        } else if (config.provider === 'openai') {
            fetchers.push(
                fetchOpenAIModels(config.apiKey)
                    .then((models) => { if (models.length > 0) result.openai = models })
                    .catch(() => { /* keep fallback */ })
            )
        }
        // Anthropic doesn't expose a public list-models endpoint—keep fallback
    }

    // Ollama: always try (local server, no API key needed)
    fetchers.push(
        fetchOllamaModels(config.ollamaUrl)
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
