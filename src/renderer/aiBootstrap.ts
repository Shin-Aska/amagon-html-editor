import {useAiStore} from './store/aiStore'

let pendingPreload: Promise<void> | null = null

export function preloadAiModels(): Promise<void> {
    if (pendingPreload) return pendingPreload
    const state = useAiStore.getState()
    if (state.configLoaded && state.modelsLoaded) return Promise.resolve()

    pendingPreload = (async () => {
        if (!useAiStore.getState().configLoaded) await useAiStore.getState().loadConfig()
        if (!useAiStore.getState().modelsLoaded) await useAiStore.getState().loadModels()
    })().finally(() => {
        pendingPreload = null
    })
    return pendingPreload
}
