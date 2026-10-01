// ---------------------------------------------------------------------------
// AI Assistant Store — manages chat state and AI configuration
// ---------------------------------------------------------------------------

import {create} from 'zustand'
import {getApi} from '../utils/api'
import {dispatchAiAvailabilityChanged} from '../hooks/useAiAvailability'
import {componentRegistry} from '../registry/ComponentRegistry'
import {useEditorStore} from './editorStore'
import {useProjectStore} from './projectStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiProvider =
    'openai'
    | 'anthropic'
    | 'google'
    | 'ollama'
    | 'mistral'
    | 'codex-cli'
    | 'github-cli'
    | 'junie-cli'
    | 'opencode'

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
    dismissedMissingProviders: AiProvider[]
    removedProviders: AiProvider[]
}

type DetectableLocalProvider = Extract<AiProvider, 'codex-cli' | 'github-cli' | 'junie-cli' | 'opencode'>

function isDetectableLocalProvider(provider: AiProvider): provider is DetectableLocalProvider {
    return provider === 'codex-cli' || provider === 'github-cli' || provider === 'junie-cli' || provider === 'opencode'
}

async function findMissingProvider(config: AiConfig): Promise<DetectableLocalProvider | null> {
    const provider = config.provider
    if (!isDetectableLocalProvider(provider)
        || config.dismissedMissingProviders.includes(provider)
        || config.removedProviders.includes(provider)) return null

    try {
        const result = await getApi().ai.checkCliAvailability()
        if (!result.success || !result.availability) return null
        return result.availability[provider]?.available === false ? provider : null
    } catch {
        return null
    }
}

class AiProviderUpdateError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'AiProviderUpdateError'
    }
}

interface AiState {
    messages: ChatMessage[]
    isLoading: boolean
    config: AiConfig
    providerModels: Record<string, string[]>
    configLoaded: boolean
    modelsLoaded: boolean
    showSettings: boolean
    missingProvider: DetectableLocalProvider | null
}

interface AiActions {
    sendMessage: (content: string) => Promise<void>
    clearChat: () => void
    loadConfig: () => Promise<void>
    saveConfig: (config: Partial<AiConfig>) => Promise<void>
    loadModels: () => Promise<void>
    fetchModelsForProvider: (provider: string, apiKey: string, ollamaUrl?: string) => Promise<string[]>
    setShowSettings: (show: boolean) => void
    keepMissingProvider: () => Promise<void>
    removeProvider: (provider: AiProvider) => Promise<void>
}

type AiStore = AiState & AiActions

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
    return 'msg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function getBlockRegistrySchema(): string {
    const categories = componentRegistry.getCategories();
    const result: Record<string, any[]> = {};

    for (const category of categories) {
        const blocks = componentRegistry.getByCategory(category);
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
    ollamaUrl: 'http://localhost:11434',
    dismissedMissingProviders: [],
    removedProviders: []
};

export const useAiStore = create<AiStore>((set, get) => ({
    // ─── Initial State ─────────────────────────────────────────────────
    messages: [],
    isLoading: false,
    config: {...DEFAULT_CONFIG},
    providerModels: {},
    configLoaded: false,
    modelsLoaded: false,
    showSettings: false,
    missingProvider: null,

    // ─── Actions ───────────────────────────────────────────────────────

    sendMessage: async (content: string) => {
        const userMessage: ChatMessage = {
            id: generateId(),
            role: 'user',
            content,
            timestamp: Date.now()
        };

        set((state) => ({
            messages: [...state.messages, userMessage],
            isLoading: true
        }));

        try {
            const api = getApi();
            const {messages, config} = get();

            const projectTheme = useProjectStore.getState().settings.theme;
            const uiTheme = useEditorStore.getState().theme;

            // Build messages array for the API (only role + content)
            const apiMessages = messages.map((m) => ({
                role: m.role,
                content: m.content
            }));

            const result = await (api as any).ai.chat({
                messages: apiMessages,
                blockRegistry: getBlockRegistrySchema(),
                themeContext: {
                    projectTheme,
                    uiTheme
                }
            });

            const assistantMessage: ChatMessage = {
                id: generateId(),
                role: 'assistant',
                content: result.success ? result.content : result.error || 'An unknown error occurred.',
                timestamp: Date.now(),
                isError: !result.success
            };

            set((state) => ({
                messages: [...state.messages, assistantMessage],
                isLoading: false
            }))

            if (!result.success && isDetectableLocalProvider(config.provider)) {
                const missingProvider = await findMissingProvider(config)
                const currentConfig = get().config
                if (missingProvider
                    && currentConfig.provider === config.provider
                    && !currentConfig.dismissedMissingProviders.includes(missingProvider)
                    && !currentConfig.removedProviders.includes(missingProvider)) set({missingProvider})
            }
        } catch (error: any) {
            const errorMessage: ChatMessage = {
                id: generateId(),
                role: 'assistant',
                content: `Error: ${error.message}`,
                timestamp: Date.now(),
                isError: true
            };

            set((state) => ({
                messages: [...state.messages, errorMessage],
                isLoading: false
            }))
        }
    },

    clearChat: () => {
        set({messages: []})
    },

    loadConfig: async () => {
        try {
            const api = getApi();
            const result = await (api as any).ai.getConfig();
            if (result.success && result.config) {
                const config: AiConfig = result.config
                set({config, configLoaded: true, missingProvider: null})
                const missingProvider = await findMissingProvider(config)
                const currentConfig = get().config
                if (currentConfig.provider === config.provider
                    && !currentConfig.dismissedMissingProviders.includes(config.provider)
                    && !currentConfig.removedProviders.includes(config.provider)) set({missingProvider})
            } else {
                set({configLoaded: true})
            }
        } catch {
            set({configLoaded: true})
        }
    },

    saveConfig: async (partial: Partial<AiConfig>) => {
        const current = get().config;
        const merged = {...current, ...partial};
        set({config: merged});

        try {
            const api = getApi();
            const result = await (api as any).ai.setConfig(partial);
            if (result.success && result.config) {
                // Update state with masked config from main process so the
                // raw API key isn't retained in renderer memory.
                set({
                    config: result.config,
                    missingProvider: result.config.provider === get().missingProvider ? get().missingProvider : null
                });
                dispatchAiAvailabilityChanged()
            }
        } catch {
            // silently fail — config still in memory
        }
    },

    loadModels: async () => {
        try {
            const api = getApi();
            const result = await (api as any).ai.getModels();
            if (result.success && result.models) {
                const removedProviders = get().config.removedProviders
                const fetchedModels: Record<string, string[]> = result.models
                const providerModels = Object.fromEntries(
                    Object.entries(fetchedModels).filter(([provider]) => !removedProviders.some((removed) => removed === provider))
                )
                set({providerModels, modelsLoaded: true});
                return
            }
        } catch {
            // use defaults
        }
        set({modelsLoaded: true})
    },

    fetchModelsForProvider: async (provider: string, apiKey: string, ollamaUrl?: string): Promise<string[]> => {
        try {
            const api = getApi();
            const result = await (api as any).ai.fetchModelsForProvider({provider, apiKey, ollamaUrl});
            if (result.success && result.models) {
                // Merge into providerModels so the dropdown can use them
                set((state) => state.config.removedProviders.some((removedProvider) => removedProvider === provider)
                    ? {}
                    : {providerModels: {...state.providerModels, [provider]: result.models}});
                return result.models as string[]
            }
        } catch {
            // ignore
        }
        return []
    },

    setShowSettings: (show: boolean) => {
        set({showSettings: show})
    },

    keepMissingProvider: async () => {
        const provider = get().missingProvider
        if (!provider) return
        const dismissedMissingProviders = [...new Set([...get().config.dismissedMissingProviders, provider])]
        const result = await getApi().ai.setConfig({dismissedMissingProviders})
        if (!result.success || !result.config) {
            throw new AiProviderUpdateError(result.error || 'Could not save the reminder choice.')
        }
        set({config: result.config, missingProvider: null})
    },

    removeProvider: async (provider: AiProvider) => {
        const result = await getApi().ai.removeProvider(provider)
        if (!result.success || !result.config) {
            throw new AiProviderUpdateError(result.error || 'Could not remove the AI provider.')
        }
        set((state) => {
            const providerModels = {...state.providerModels}
            delete providerModels[provider]
            return {config: result.config, missingProvider: null, providerModels}
        })
        dispatchAiAvailabilityChanged()
    }
}));
