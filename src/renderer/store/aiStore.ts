// ---------------------------------------------------------------------------
// AI Assistant Store — manages chat state and AI configuration
// ---------------------------------------------------------------------------

import { create } from 'zustand'
import { getApi } from '../utils/api'
import { dispatchAiAvailabilityChanged } from '../hooks/useAiAvailability'
import { componentRegistry } from '../registry/ComponentRegistry'
import { useEditorStore } from './editorStore'
import { useProjectStore } from './projectStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'mistral' | 'claude-cli' | 'codex-cli' | 'gemini-cli'

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: number
    isError?: boolean
}

export interface AiConfig {
    provider: AiProvider
    model: string
    apiKey: string
    ollamaUrl: string
}

interface AiState {
    messages: ChatMessage[]
    isLoading: boolean
    config: AiConfig
    providerModels: Record<string, string[]>
    configLoaded: boolean
    showSettings: boolean
}

interface AiActions {
    sendMessage: (content: string) => Promise<void>
    clearChat: () => void
    loadConfig: () => Promise<void>
    saveConfig: (config: Partial<AiConfig>) => Promise<void>
    loadModels: () => Promise<void>
    fetchModelsForProvider: (provider: string, apiKey: string, ollamaUrl?: string) => Promise<string[]>
    setShowSettings: (show: boolean) => void
}

type AiStore = AiState & AiActions

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
    return 'msg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function getBlockRegistrySchema(): string {
    const categories = componentRegistry.getCategories()
    const result: Record<string, any[]> = {}

    for (const category of categories) {
        const blocks = componentRegistry.getByCategory(category)
        result[category] = blocks.map((b) => ({
            type: b.type,
            label: b.label,
            defaultClasses: b.defaultClasses || [],
            propsSchema: b.propsSchema
        }))
    }

    return JSON.stringify(result, null, 2)
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: AiConfig = {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    ollamaUrl: 'http://localhost:11434'
}

export const useAiStore = create<AiStore>((set, get) => ({
    // ─── Initial State ─────────────────────────────────────────────────
    messages: [],
    isLoading: false,
    config: { ...DEFAULT_CONFIG },
    providerModels: {},
    configLoaded: false,
    showSettings: false,

    // ─── Actions ───────────────────────────────────────────────────────

    sendMessage: async (content: string) => {
        const userMessage: ChatMessage = {
            id: generateId(),
            role: 'user',
            content,
            timestamp: Date.now()
        }

        set((state) => ({
            messages: [...state.messages, userMessage],
            isLoading: true
        }))

        try {
            const api = getApi()
            const { messages } = get()

            const projectTheme = useProjectStore.getState().settings.theme
            const uiTheme = useEditorStore.getState().theme

            // Build messages array for the API (only role + content)
            const apiMessages = messages.map((m) => ({
                role: m.role,
                content: m.content
            }))

            const result = await (api as any).ai.chat({
                messages: apiMessages,
                blockRegistry: getBlockRegistrySchema(),
                themeContext: {
                    projectTheme,
                    uiTheme
                }
            })

            const assistantMessage: ChatMessage = {
                id: generateId(),
                role: 'assistant',
                content: result.success ? result.content : result.error || 'An unknown error occurred.',
                timestamp: Date.now(),
                isError: !result.success
            }

            set((state) => ({
                messages: [...state.messages, assistantMessage],
                isLoading: false
            }))
        } catch (error: any) {
            const errorMessage: ChatMessage = {
                id: generateId(),
                role: 'assistant',
                content: `Error: ${error.message}`,
                timestamp: Date.now(),
                isError: true
            }

            set((state) => ({
                messages: [...state.messages, errorMessage],
                isLoading: false
            }))
        }
    },

    clearChat: () => {
        set({ messages: [] })
    },

    loadConfig: async () => {
        try {
            const api = getApi()
            const result = await (api as any).ai.getConfig()
            if (result.success && result.config) {
                set({ config: result.config, configLoaded: true })
            }
        } catch {
            set({ configLoaded: true })
        }
    },

    saveConfig: async (partial: Partial<AiConfig>) => {
        const current = get().config
        const merged = { ...current, ...partial }
        set({ config: merged })

        try {
            const api = getApi()
            const result = await (api as any).ai.setConfig(merged)
            if (result.success && result.config) {
                // Update state with masked config from main process so the
                // raw API key isn't retained in renderer memory.
                set({ config: result.config })
                dispatchAiAvailabilityChanged()
            }
        } catch {
            // silently fail — config still in memory
        }
    },

    loadModels: async () => {
        try {
            const api = getApi()
            const result = await (api as any).ai.getModels()
            if (result.success && result.models) {
                set({ providerModels: result.models })
            }
        } catch {
            // use defaults
        }
    },

    fetchModelsForProvider: async (provider: string, apiKey: string, ollamaUrl?: string): Promise<string[]> => {
        try {
            const api = getApi()
            const result = await (api as any).ai.fetchModelsForProvider({ provider, apiKey, ollamaUrl })
            if (result.success && result.models) {
                // Merge into providerModels so the dropdown can use them
                set((state) => ({
                    providerModels: { ...state.providerModels, [provider]: result.models }
                }))
                return result.models as string[]
            }
        } catch {
            // ignore
        }
        return []
    },

    setShowSettings: (show: boolean) => {
        set({ showSettings: show })
    }
}))
