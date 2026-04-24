import {useEffect} from 'react'
import {type AiProvider, useAiStore} from '../../store/aiStore'
import {useAppSettingsStore} from '../../store/appSettingsStore'
import './AiProviderSelector.css'

const PROVIDER_LABELS: Record<AiProvider, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Gemini',
    mistral: 'Mistral',
    ollama: 'Ollama',
    'claude-cli': 'Claude CLI',
    'codex-cli': 'Codex CLI',
    'gemini-cli': 'Gemini CLI',
    'github-cli': 'GitHub Copilot CLI',
    'junie-cli': 'Junie CLI',
    'opencode-cli': 'Opencode CLI'
}

export default function AiProviderSelector(): JSX.Element {
    const config = useAiStore((s) => s.config)
    const configLoaded = useAiStore((s) => s.configLoaded)
    const modelsLoaded = useAiStore((s) => s.modelsLoaded)
    const providerModels = useAiStore((s) => s.providerModels)
    const loadConfig = useAiStore((s) => s.loadConfig)
    const loadModels = useAiStore((s) => s.loadModels)
    const saveConfig = useAiStore((s) => s.saveConfig)
    const enableDangerousFeatures = useAppSettingsStore((s) => s.enableDangerousFeatures)

    useEffect(() => {
        if (!configLoaded) {
            loadConfig().then(() => loadModels())
        }
    }, [configLoaded, loadConfig, loadModels])

    const DANGEROUS_PROVIDERS: AiProvider[] = ['claude-cli', 'gemini-cli', 'junie-cli']

    const isReady = configLoaded && modelsLoaded

    const models = providerModels[config.provider] || []

    // Only show providers that have been configured (have models loaded), plus
    // always include the currently active provider so the selector is never blank.
    // Dangerous providers are hidden unless the flag is on.
    const visibleProviders = (Object.keys(PROVIDER_LABELS) as AiProvider[]).filter((p) => {
        if (DANGEROUS_PROVIDERS.includes(p) && !enableDangerousFeatures) return false
        return p === config.provider || (providerModels[p] && providerModels[p].length > 0)
    })

    const handleProviderChange = (provider: AiProvider) => {
        const firstModel = (providerModels[provider] || [])[0] || ''
        saveConfig({ provider, model: firstModel })
    }

    const handleModelChange = (model: string) => {
        saveConfig({ model })
    }

    // Config hasn't loaded yet — show skeleton selects so layout doesn't shift
    if (!configLoaded) {
        return (
            <div className="ai-provider-selector ai-provider-selector--loading">
                <select className="ai-provider-select" disabled><option>Loading…</option></select>
                <select className="ai-provider-select ai-model-select" disabled><option>Loading…</option></select>
            </div>
        )
    }

    // Config loaded but no providers configured
    if (visibleProviders.length === 0) return <></>

    return (
        <div className="ai-provider-selector">
            <select
                className="ai-provider-select"
                value={config.provider}
                onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
                title="AI Provider"
                disabled={!isReady}
            >
                {visibleProviders.map((p) => (
                    <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                ))}
            </select>
            <select
                className="ai-provider-select ai-model-select"
                value={isReady ? config.model : ''}
                onChange={(e) => handleModelChange(e.target.value)}
                title="AI Model"
                disabled={!isReady || models.length === 0}
            >
                {!isReady ? (
                    <option value="">Loading…</option>
                ) : models.length === 0 ? (
                    <option value="">No models</option>
                ) : (
                    models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                    ))
                )}
            </select>
        </div>
    )
}
