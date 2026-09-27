import {beforeEach, describe, expect, it, vi} from 'vitest'
import {useAiStore, type AiConfig} from '../aiStore'

const api = vi.hoisted(() => ({
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    removeProvider: vi.fn(),
    checkCliAvailability: vi.fn(),
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
})
