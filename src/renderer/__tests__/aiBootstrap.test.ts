import {afterEach, describe, expect, it, vi} from 'vitest'
import {preloadAiModels} from '../aiBootstrap'
import {useAiStore} from '../store/aiStore'

const original = useAiStore.getState()

afterEach(() => {
    useAiStore.setState({
        loadConfig: original.loadConfig,
        loadModels: original.loadModels,
        configLoaded: original.configLoaded,
        modelsLoaded: original.modelsLoaded
    })
})

describe('AI startup preload', () => {
    it('shares one config and model request across concurrent callers', async () => {
        let finishConfig: (() => void) | undefined
        const configGate = new Promise<void>((resolve) => {
            finishConfig = resolve
        })
        const loadConfig = vi.fn(async () => {
            await configGate
            useAiStore.setState({configLoaded: true})
        })
        const loadModels = vi.fn(async () => {
            useAiStore.setState({modelsLoaded: true})
        })
        useAiStore.setState({configLoaded: false, modelsLoaded: false, loadConfig, loadModels})

        const first = preloadAiModels()
        const second = preloadAiModels()
        expect(second).toBe(first)
        expect(loadConfig).toHaveBeenCalledTimes(1)
        expect(loadModels).not.toHaveBeenCalled()

        if (!finishConfig) throw new TypeError('Missing config gate resolver')
        finishConfig()
        await Promise.all([first, second])

        expect(loadConfig).toHaveBeenCalledTimes(1)
        expect(loadModels).toHaveBeenCalledTimes(1)
        await preloadAiModels()
        expect(loadModels).toHaveBeenCalledTimes(1)
    })
})
