import {beforeEach, describe, expect, it, vi} from 'vitest'
import {useAiStore, type AiConfig} from '../aiStore'

const api = vi.hoisted(() => ({
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    removeProvider: vi.fn(),
    checkCliAvailability: vi.fn(),
    getModels: vi.fn(),
    fetchModelsForProvider: vi.fn()
}))

vi.mock('../../utils/api', () => ({getApi: () => ({ai: api})}))

const openCodeConfig: AiConfig = {
    provider: 'opencode',
    model: 'opencode/gpt-5',
    apiKey: '',
    ollamaUrl: 'http://localhost:11434',
    dismissedMissingProviders: [],
    removedProviders: []
}

function createDeferred<T>() {
    let fulfill: (value: T) => void = () => {}
    const promise = new Promise<T>((resolve) => {
        fulfill = resolve
    })
    return {promise, fulfill}
}

describe('missing local AI provider', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAiStore.setState({
            config: openCodeConfig,
            configLoaded: false,
            missingProvider: null,
            providerModelErrors: {},
            providerModels: {opencode: ['opencode/gpt-5']}
        })
        api.getConfig.mockResolvedValue({success: true, config: openCodeConfig})
        api.checkCliAvailability.mockResolvedValue({
            success: true,
            availability: {opencode: {available: false}}
        })
    })

    it('offers removal when the selected OpenCode executable is missing', async () => {
        await useAiStore.getState().loadConfig()

        expect(useAiStore.getState().missingProvider).toBe('opencode')
    })

    it('does not repeat a reminder after Keep is saved', async () => {
        api.getConfig.mockResolvedValue({
            success: true,
            config: {...openCodeConfig, dismissedMissingProviders: ['opencode']}
        })

        await useAiStore.getState().loadConfig()

        expect(useAiStore.getState().missingProvider).toBeNull()
        expect(api.checkCliAvailability).not.toHaveBeenCalled()
    })

    it('persists Keep without reselecting the provider', async () => {
        useAiStore.setState({config: openCodeConfig, missingProvider: 'opencode'})
        api.setConfig.mockResolvedValue({
            success: true,
            config: {...openCodeConfig, dismissedMissingProviders: ['opencode']}
        })

        await useAiStore.getState().keepMissingProvider()

        expect(api.setConfig).toHaveBeenCalledWith({dismissedMissingProviders: ['opencode']})
        expect(useAiStore.getState().missingProvider).toBeNull()
    })

    it('removes OpenCode from configuration and its quick picker models', async () => {
        api.removeProvider.mockResolvedValue({
            success: true,
            config: {...openCodeConfig, provider: 'openai', model: 'gpt-4o', removedProviders: ['opencode']}
        })

        await useAiStore.getState().removeProvider('opencode')

        expect(api.removeProvider).toHaveBeenCalledWith('opencode')
        expect(useAiStore.getState().config.provider).toBe('openai')
        expect(useAiStore.getState().config.removedProviders).toContain('opencode')
        expect(useAiStore.getState().providerModels.opencode).toBeUndefined()
    })

    it('does not restore models when OpenCode is removed before its model request resolves', async () => {
        const modelsResponse = createDeferred<{success: boolean, models: string[]}>()
        api.fetchModelsForProvider.mockReturnValue(modelsResponse.promise)
        api.removeProvider.mockResolvedValue({
            success: true,
            config: {...openCodeConfig, provider: 'openai', model: 'gpt-4o', removedProviders: ['opencode']}
        })

        const modelsLoad = useAiStore.getState().fetchModelsForProvider('opencode', '')
        await useAiStore.getState().removeProvider('opencode')
        modelsResponse.fulfill({success: true, models: ['opencode/gpt-5']})
        await modelsLoad

        expect(useAiStore.getState().providerModels.opencode).toBeUndefined()
    })

    it('keeps a provider error visible and clears it after a successful refresh', async () => {
        api.fetchModelsForProvider.mockResolvedValueOnce({success: false, error: 'OpenAI API error (403): Missing api.model.read', models: []})
        expect(await useAiStore.getState().fetchModelsForProvider('openai', '')).toEqual([])
        expect(useAiStore.getState().providerModelErrors.openai).toContain('api.model.read')
        api.fetchModelsForProvider.mockResolvedValueOnce({success: true, models: ['gpt-5.4-mini']})
        expect(await useAiStore.getState().fetchModelsForProvider('openai', '')).toEqual(['gpt-5.4-mini'])
        expect(useAiStore.getState().providerModelErrors.openai).toBe('')
    })

    it('replaces an unavailable saved OpenAI model with an available default', async () => {
        useAiStore.setState({config: {...openCodeConfig, provider: 'openai', model: 'retired-model'}})
        api.getModels.mockResolvedValue({success: true, models: {openai: ['gpt-6-sol', 'gpt-5.4-mini']}})
        api.setConfig.mockResolvedValue({success: true, config: {...openCodeConfig, provider: 'openai', model: 'gpt-5.4-mini'}})
        await useAiStore.getState().loadModels()
        expect(api.setConfig).toHaveBeenCalledWith({model: 'gpt-5.4-mini'})
        expect(useAiStore.getState().config.model).toBe('gpt-5.4-mini')
    })

    it('preserves a selected OpenAI model that is still available', async () => {
        useAiStore.setState({config: {...openCodeConfig, provider: 'openai', model: 'gpt-6-sol'}})
        api.getModels.mockResolvedValue({success: true, models: {openai: ['gpt-6-sol', 'gpt-5.4-mini']}})
        await useAiStore.getState().loadModels()
        expect(api.setConfig).not.toHaveBeenCalled()
        expect(useAiStore.getState().config.model).toBe('gpt-6-sol')
    })
})
