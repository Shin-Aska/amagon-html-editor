import {useEffect, useState} from 'react'
import {TriangleAlert} from 'lucide-react'
import {useAiStore, type AiProvider} from '../../store/aiStore'
import './MissingAiProviderNotice.css'

const PROVIDER_NAMES: Record<Extract<AiProvider, 'codex-cli' | 'github-cli' | 'junie-cli' | 'opencode'>, string> = {
    'codex-cli': 'Codex CLI',
    'github-cli': 'GitHub Copilot CLI',
    'junie-cli': 'Junie CLI',
    opencode: 'OpenCode'
}

export default function MissingAiProviderNotice(): JSX.Element | null {
    const missingProvider = useAiStore((state) => state.missingProvider)
    const keepMissingProvider = useAiStore((state) => state.keepMissingProvider)
    const removeProvider = useAiStore((state) => state.removeProvider)
    const [pendingChoice, setPendingChoice] = useState<'keep' | 'remove' | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setError(null)
    }, [missingProvider])

    if (!missingProvider) return null
    const providerName = PROVIDER_NAMES[missingProvider]
    const busy = pendingChoice !== null

    const handleChoice = async (choice: 'keep' | 'remove'): Promise<void> => {
        setPendingChoice(choice)
        setError(null)
        try {
            if (choice === 'keep') {
                await keepMissingProvider()
            } else {
                await removeProvider(missingProvider)
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not update the provider. Please try again.')
        } finally {
            setPendingChoice(null)
        }
    }

    return (
        <section className="missing-ai-provider-notice" role="status" aria-labelledby="missing-ai-provider-title" aria-busy={busy}>
            <div className="missing-ai-provider-notice__heading">
                <TriangleAlert size={18} aria-hidden="true"/>
                <strong id="missing-ai-provider-title">{providerName} is missing</strong>
            </div>
            <p>It looks like {providerName} is no longer on this machine. Keep it in Amagon or remove it?</p>
            <p className="missing-ai-provider-notice__hint">
                Keeping it turns off this reminder. You can remove it later in App Settings → AI Assistant.
            </p>
            {busy && <p className="missing-ai-provider-notice__hint">Saving your choice…</p>}
            {error && <p className="missing-ai-provider-notice__error" role="alert">{error}</p>}
            <div className="missing-ai-provider-notice__actions">
                <button type="button" className="missing-ai-provider-notice__keep" disabled={busy} onClick={() => void handleChoice('keep')}>
                    {pendingChoice === 'keep' ? 'Keeping…' : `Keep ${providerName}`}
                </button>
                <button type="button" className="missing-ai-provider-notice__remove" disabled={busy} onClick={() => void handleChoice('remove')}>
                    {pendingChoice === 'remove' ? 'Removing…' : `Remove ${providerName}`}
                </button>
            </div>
        </section>
    )
}
