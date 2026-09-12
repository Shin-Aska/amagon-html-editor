import { type MouseEvent, useEffect, useRef, useState } from 'react'
import {
    Image as ImageIcon,
    Info,
    KeyRound,
    LayoutPanelLeft,
    Monitor,
    Moon,
    RefreshCw,
    Settings,
    Sparkles,
    Sun
} from 'lucide-react'
import { getApi } from '../../utils/api'
import { useAppSettingsStore } from '../../store/appSettingsStore'
import { type AiProvider, useAiStore } from '../../store/aiStore'
import { useTutorialStore } from '../../store/tutorialStore'
import type { EditorLayout } from '../../store/types'
import { dispatchAiAvailabilityChanged } from '../../hooks/useAiAvailability'
import { tutorialSteps } from '../Tutorial/tutorialSteps'
import CredentialEditModal from './CredentialEditModal'
import SettingsWorkspace, { type SettingsSection } from '../SettingsWorkspace/SettingsWorkspace'
import './SettingsDialog.css'

const DANGEROUS_CLI_PROVIDERS: AiProvider[] = ['junie-cli']
const DANGEROUS_CRED_IDS = DANGEROUS_CLI_PROVIDERS.map((provider) => `ai:${provider}`)

type CliAvailability = Record<string, {
    available: boolean
    path?: string
    version?: string
}>

type ModelRefreshStatus = {
    type: 'success' | 'error'
    message: string
}

interface SettingsDialogProps {
    open: boolean
    onClose: () => void
    initialTab?: TabType
}

type TabType = 'general' | 'keys' | 'ai' | 'media'

const SETTINGS_SECTIONS: readonly SettingsSection<TabType>[] = [
    { id: 'general', label: 'General', description: 'Personalize your editing workspace.', icon: <Monitor size={18} /> },
    { id: 'keys', label: 'Credentials', description: 'Manage credentials for AI, multimedia, and publishing.', icon: <KeyRound size={18} /> },
    { id: 'ai', label: 'AI Assistant', description: 'Choose the provider and model for your assistant.', icon: <Sparkles size={18} /> },
    { id: 'media', label: 'Media Search', description: 'Choose where to search for images and videos.', icon: <ImageIcon size={18} /> }
]

export default function SettingsDialog({
    open,
    onClose,
    initialTab = 'general'
}: SettingsDialogProps) {
    const [activeTab, setActiveTab] = useState<TabType>(initialTab)
    const overlayRef = useRef<HTMLDivElement>(null)

    const theme = useAppSettingsStore((s) => s.theme);
    const setTheme = useAppSettingsStore((s) => s.setTheme);
    const defaultLayout = useAppSettingsStore((s) => s.defaultLayout);
    const setDefaultLayout = useAppSettingsStore((s) => s.setDefaultLayout);
    const libraryPreviewMode = useAppSettingsStore((s) => s.libraryPreviewMode);
    const libraryPreviewCacheSlots = useAppSettingsStore((s) => s.libraryPreviewCacheSlots);
    const saveSettings = useAppSettingsStore((s) => s.saveSettings);
    const [previewCacheSlotsDraft, setPreviewCacheSlotsDraft] = useState(String(libraryPreviewCacheSlots));
    const showTabChildSelectionWarning = useAppSettingsStore((s) => s.showTabChildSelectionWarning);
    const setShowTabChildSelectionWarning = useAppSettingsStore((s) => s.setShowTabChildSelectionWarning);
    const tutorialEnabled = useAppSettingsStore((s) => s.tutorialEnabled);
    const setTutorialEnabled = useAppSettingsStore((s) => s.setTutorialEnabled);
    const setTutorialCompleted = useAppSettingsStore((s) => s.setTutorialCompleted);
    const enableDangerousFeatures = useAppSettingsStore((s) => s.enableDangerousFeatures);
    const setEnableDangerousFeatures = useAppSettingsStore((s) => s.setEnableDangerousFeatures);
    const showRestartTutorialButton = useAppSettingsStore((s) => s.showRestartTutorialButton);
    const setShowRestartTutorialButton = useAppSettingsStore((s) => s.setShowRestartTutorialButton);
    const startTutorial = useTutorialStore((s) => s.startTutorial);

    useEffect(() => {
        setPreviewCacheSlotsDraft(String(libraryPreviewCacheSlots))
    }, [libraryPreviewCacheSlots, open]);

    const applyPreviewCacheSlots = (): void => {
        const value = Number(previewCacheSlotsDraft);
        if (previewCacheSlotsDraft.trim() && Number.isSafeInteger(value) && value >= 0) {
            if (value !== libraryPreviewCacheSlots) void saveSettings({libraryPreviewCacheSlots: value})
        } else {
            setPreviewCacheSlotsDraft(String(libraryPreviewCacheSlots))
        }
    };

    const aiConfig = useAiStore((s) => s.config);
    const providerModels = useAiStore((s) => s.providerModels);
    const loadAiConfig = useAiStore((s) => s.loadConfig);
    const saveAiConfig = useAiStore((s) => s.saveConfig);
    const loadAiModels = useAiStore((s) => s.loadModels);
    const fetchModelsForProvider = useAiStore((s) => s.fetchModelsForProvider);

    const [aiProvider, setAiProvider] = useState(aiConfig?.provider || 'openai');
    const [aiModel, setAiModel] = useState(aiConfig?.model || '');
    const [aiOllamaUrl, setAiOllamaUrl] = useState(aiConfig?.ollamaUrl || 'http://localhost:11434')
    const [refreshingModels, setRefreshingModels] = useState(false)
    const [modelRefreshStatus, setModelRefreshStatus] = useState<ModelRefreshStatus | null>(null)

    const [cliAvailability, setCliAvailability] = useState<CliAvailability>({})
    const [checkingCli, setCheckingCli] = useState(false)

    const refreshCliAvailability = async () => {
        setCheckingCli(true)
        try {
            const result = await getApi().ai.checkCliAvailability()
            if (result.success && result.availability) {
                setCliAvailability(result.availability)
            }
        } finally {
            setCheckingCli(false)
        }
    }

    const [mediaProvider, setMediaProvider] = useState('unsplash')

    const [credentials, setCredentials] = useState<CredentialRecordInfo[]>([])
    const [definitions, setDefinitions] = useState<CredentialDefinitionInfo[]>([])
    const [credentialLoading, setCredentialLoading] = useState(false)

    const [modalOpen, setModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
    const [modalCredential, setModalCredential] = useState<CredentialRecordInfo | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    const refreshCredentials = async (): Promise<void> => {
        setCredentialLoading(true)
        try {
            const api = getApi()
            const result = await api.app.getCredentials()
            if (result.success) {
                setCredentials(Array.isArray(result.credentials) ? result.credentials : [])
                setDefinitions(Array.isArray(result.definitions) ? result.definitions : [])
            }
        } finally {
            setCredentialLoading(false)
        }
    }

    const refreshFeatureConfigs = async (): Promise<void> => {
        const api = getApi()
        await loadAiConfig()
        await loadAiModels()

        const result = await api.mediaSearch.getConfig()
        if (result.success && result.config) {
            setMediaProvider(result.config.provider || 'unsplash')
        }
    }

    const refreshCredentialsAndFeatureConfigs = async (): Promise<void> => {
        await Promise.all([refreshCredentials(), refreshFeatureConfigs(), refreshCliAvailability()])
    }

    useEffect(() => {
        if (open) {
            setActiveTab(initialTab)
            void refreshCredentialsAndFeatureConfigs()
        }
    }, [open, initialTab])

    useEffect(() => {
        if (aiConfig) {
            setAiProvider(aiConfig.provider)
            setAiModel(aiConfig.model)
            setAiOllamaUrl(aiConfig.ollamaUrl || 'http://localhost:11434')
        }
    }, [aiConfig])

    useEffect(() => {
        if (!open || modalOpen) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !e.defaultPrevented) onClose()
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [open, modalOpen, onClose])

    useEffect(() => {
        if (!open || (!aiProvider.endsWith('-cli') && aiProvider !== 'opencode')) return

        let cancelled = false
        fetchModelsForProvider(aiProvider, '', aiOllamaUrl).then((models) => {
            if (cancelled || models.length === 0) return
            if (aiModel && models.includes(aiModel)) return

            const nextModel = models[0]
            setAiModel(nextModel)
            void saveAiConfig({ provider: aiProvider as AiProvider, model: nextModel, apiKey: '', ollamaUrl: aiOllamaUrl })
        })

        return () => {
            cancelled = true
        }
    }, [open, aiProvider, aiOllamaUrl, aiModel, fetchModelsForProvider, saveAiConfig])

    const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
        if (e.target === overlayRef.current) {
            onClose()
        }
    }

    const handleRefreshModels = async (provider = aiProvider, currentModel = aiModel): Promise<string[]> => {
        setRefreshingModels(true)
        setModelRefreshStatus(null)

        try {
            const models = await fetchModelsForProvider(provider, '', aiOllamaUrl)
            if (models.length === 0) {
                setModelRefreshStatus({
                    type: 'error',
                    message: provider.endsWith('-cli') || provider === 'opencode'
                        ? (provider === 'opencode'
                            ? 'No models returned. Check that the OpenCode service is installed and running.'
                            : 'No models returned. Check that the CLI is installed, signed in, and up to date.')
                        : 'No models returned. Check the provider credentials or connection.'
                })
                return []
            }

            const nextModel = currentModel && models.includes(currentModel) ? currentModel : models[0]
            setAiModel(nextModel)
            await saveAiConfig({ provider: provider as AiProvider, model: nextModel, apiKey: '', ollamaUrl: aiOllamaUrl })
            setModelRefreshStatus({
                type: 'success',
                message: `Loaded ${models.length} model${models.length === 1 ? '' : 's'} from ${provider}.`
            })
            return models
        } finally {
            setRefreshingModels(false)
        }
    }

    const handleSaveAi = async () => {
        const nextModel = aiModel || (providerModels[aiProvider]?.[0] ?? '')
        await saveAiConfig({ provider: aiProvider as AiProvider, model: nextModel, apiKey: '', ollamaUrl: aiOllamaUrl })
        void handleRefreshModels(aiProvider, nextModel)
    }

    const handleSaveMedia = async (provider = mediaProvider) => {
        const api = getApi()
        await api.mediaSearch.setConfig({ provider, apiKey: '' })
    }

    const handleDeleteCredential = async (id: string) => {
        const api = getApi()
        const result = await api.app.deleteCredential(id)
        if (!result.success) {
            setConfirmDeleteId(null)
            return
        }
        dispatchAiAvailabilityChanged()
        await refreshCredentialsAndFeatureConfigs()
        setConfirmDeleteId(null)
    }

    const openCreateModal = () => {
        setModalMode('create')
        setModalCredential(null)
        setModalOpen(true)
    }

    const openEditModal = (credential: CredentialRecordInfo) => {
        setModalMode('edit')
        setModalCredential(credential)
        setModalOpen(true)
    }

    const handleRestartTutorial = () => {
        setTutorialEnabled(true)
        setTutorialCompleted(false)
        onClose()
        startTutorial(tutorialSteps)
    }

    if (!open) return null
    const visibleCredentials = enableDangerousFeatures
        ? credentials
        : credentials.filter((c) => !DANGEROUS_CRED_IDS.includes(c.id))
    const visibleDefinitions = enableDangerousFeatures
        ? definitions
        : definitions.filter((d) => !DANGEROUS_CRED_IDS.includes(d.id))
    const availableModels = providerModels[aiProvider] || []
    const selectedAiModel = aiModel || availableModels[0] || ''
    const isCliProvider = aiProvider.endsWith('-cli')
    const isOpenCode = aiProvider === 'opencode'
    const showStatusCheck = isCliProvider || isOpenCode
    const cliStatus = cliAvailability[aiProvider]

    return (
        <>
            <div className="settings-dialog-overlay" ref={overlayRef} onClick={handleOverlayClick}>
                <SettingsWorkspace
                    title="App Settings"
                    subtitle="Applies across projects"
                    icon={<Settings size={28} />}
                    scope="application"
                    className="settings-dialog settings-dialog--wide"
                    closeClassName="settings-dialog-close"
                    tutorial="settings-dialog"
                    sections={SETTINGS_SECTIONS}
                    activeSection={activeTab}
                    onSectionChange={setActiveTab}
                    onClose={onClose}
                    footer={(
                        <>
                            <span className="settings-preferences-note">Preferences apply immediately</span>
                            <button type="button" className="settings-btn-primary" onClick={onClose}>Done</button>
                        </>
                    )}
                >
                            {activeTab === 'general' && (
                                <div className="settings-section settings-section--general animate-fade-in">
                                    <div className="settings-row">
                                        <div className="settings-label">
                                            <span className="settings-label-title">Theme</span>
                                            <span
                                                className="settings-label-desc">Switch between dark and light mode</span>
                                        </div>
                                        <div className="settings-control">
                                            <div className="theme-toggle">
                                                <button
                                                    className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                                                    aria-pressed={theme === 'light'}
                                                    onClick={() => setTheme('light')}
                                                >
                                                    <Sun size={14} /> Light
                                                </button>
                                                <button
                                                    className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                                                    aria-pressed={theme === 'dark'}
                                                    onClick={() => setTheme('dark')}
                                                >
                                                    <Moon size={14} /> Dark
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="settings-row">
                                        <div className="settings-label">
                                            <span className="settings-label-title">Default Layout</span>
                                            <span className="settings-label-desc">Initial layout for new projects</span>
                                        </div>
                                        <div className="settings-control">
                                            <div className="select-wrapper">
                                                <LayoutPanelLeft size={14} className="select-icon" />
                                                <select
                                                    aria-label="Default Layout"
                                                    value={defaultLayout}
                                                    onChange={(e) => setDefaultLayout(e.target.value as EditorLayout)}
                                                    className="settings-select"
                                                >
                                                    <option value="standard">Standard (All panels)</option>
                                                    <option value="no-sidebar">No Left Sidebar</option>
                                                    <option value="no-inspector">No Right Inspector</option>
                                                    <option value="canvas-only">Canvas Only</option>
                                                    <option value="code-focus">Code Focus</option>
                                                    <option value="zen">Zen Mode</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="settings-row">
                                        <div className="settings-label">
                                            <label className="settings-label-title" htmlFor="library-preview-mode">Preview mode</label>
                                            <span className="settings-label-desc" id="library-preview-mode-description">Choose how pages and widgets appear in the sidebar</span>
                                        </div>
                                        <div className="settings-control">
                                            <select
                                                id="library-preview-mode"
                                                aria-describedby="library-preview-mode-description"
                                                value={libraryPreviewMode}
                                                onChange={(e) => void saveSettings({libraryPreviewMode: e.target.value === 'classic' ? 'classic' : 'live'})}
                                                className="settings-select"
                                            >
                                                <option value="live">Live</option>
                                                <option value="classic">Classic</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="settings-row">
                                        <div className="settings-label">
                                            <label className="settings-label-title" htmlFor="library-preview-cache-slots">Preview cache slots</label>
                                            <span className="settings-label-desc" id="library-preview-cache-description">Keep this many recent previews ready. Set 0 to turn off caching.</span>
                                        </div>
                                        <div className="settings-control">
                                            <input
                                                id="library-preview-cache-slots"
                                                type="number"
                                                min={0}
                                                step={1}
                                                aria-describedby="library-preview-cache-description"
                                                className="settings-input settings-input--cache-slots"
                                                value={previewCacheSlotsDraft}
                                                onChange={(event) => setPreviewCacheSlotsDraft(event.target.value)}
                                                onBlur={applyPreviewCacheSlots}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter') event.currentTarget.blur()
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="settings-row">
                                        <div className="settings-label">
                                            <span className="settings-label-title">Tab Child Selection Warning</span>
                                            <span className="settings-label-desc">Show an informational warning when selecting content rendered inside a tab component</span>
                                        </div>
                                        <div className="settings-control">
                                            <label className="settings-toggle">
                                                <input
                                                    type="checkbox"
                                                    aria-label="Tab Child Selection Warning"
                                                    checked={showTabChildSelectionWarning}
                                                    onChange={(e) => setShowTabChildSelectionWarning(e.target.checked)}
                                                />
                                                <span>{showTabChildSelectionWarning ? 'On' : 'Off'}</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="settings-row">
                                        <div className="settings-label">
                                            <span className="settings-label-title">Show Tutorial on Startup</span>
                                            <span className="settings-label-desc">Show the quick onboarding prompt after a project is loaded</span>
                                        </div>
                                        <div className="settings-control">
                                            <label className="settings-toggle">
                                                <input
                                                    type="checkbox"
                                                    aria-label="Show Tutorial on Startup"
                                                    checked={tutorialEnabled}
                                                    onChange={(e) => setTutorialEnabled(e.target.checked)}
                                                />
                                                <span>{tutorialEnabled ? 'On' : 'Off'}</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="settings-row">
                                        <div className="settings-label">
                                            <span className="settings-label-title">Show Restart Tutorial Button</span>
                                            <span className="settings-label-desc">Display the restart-tutorial button in the status bar</span>
                                        </div>
                                        <div className="settings-control">
                                            <label className="settings-toggle">
                                                <input
                                                    type="checkbox"
                                                    aria-label="Show Restart Tutorial Button"
                                                    checked={showRestartTutorialButton}
                                                    onChange={(e) => setShowRestartTutorialButton(e.target.checked)}
                                                />
                                                <span>{showRestartTutorialButton ? 'On' : 'Off'}</span>
                                            </label>
                                        </div>
                                    </div>

                                    {showRestartTutorialButton && (
                                        <div className="settings-row">
                                            <div className="settings-label">
                                                <span className="settings-label-title">Tutorial Progress</span>
                                                <span className="settings-label-desc">Reset progress so the tutorial prompt appears again on next project load</span>
                                            </div>
                                            <div className="settings-control">
                                                <button
                                                    type="button"
                                                    className="settings-btn-secondary"
                                                    onClick={handleRestartTutorial}
                                                >
                                                    Restart Tutorial
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'keys' && (
                                <div className="settings-section animate-fade-in">
                                    <div className="settings-heading-row">
                                        <button className="settings-btn-primary" onClick={openCreateModal}>
                                            Add Credential
                                        </button>
                                    </div>

                                    {credentialLoading && visibleCredentials.length === 0 ? (
                                        <p className="settings-subcopy">Loading credentials…</p>
                                    ) : visibleCredentials.length === 0 ? (
                                        <p className="settings-subcopy">No credentials saved yet.</p>
                                    ) : (
                                        <table className="cred-table">
                                            <thead>
                                                <tr>
                                                    <th>Type</th>
                                                    <th>Provider</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {visibleCredentials.map((cred) => (
                                                    <tr key={cred.id}>
                                                        <td>
                                                            <span className={`cred-pill cred-pill--${cred.category}`}>
                                                                {cred.categoryLabel}
                                                            </span>
                                                        </td>
                                                        <td className="cred-table-provider">{cred.label}</td>
                                                        <td>
                                                            <div className="cred-table-actions">
                                                                {confirmDeleteId === cred.id ? (
                                                                    <>
                                                                        <span
                                                                            className="cred-confirm-text">Are you sure?</span>
                                                                        <button
                                                                            className="settings-btn-danger"
                                                                            onClick={() => handleDeleteCredential(cred.id)}
                                                                        >
                                                                            Yes, Delete
                                                                        </button>
                                                                        <button
                                                                            className="settings-btn-secondary"
                                                                            onClick={() => setConfirmDeleteId(null)}
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            className="settings-btn-secondary"
                                                                            onClick={() => openEditModal(cred)}
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                        <button
                                                                            className="settings-btn-danger"
                                                                            onClick={() => setConfirmDeleteId(cred.id)}
                                                                        >
                                                                            Remove
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}

                                    {credentialLoading && visibleCredentials.length > 0 && (
                                        <p className="settings-subcopy">Refreshing credentials…</p>
                                    )}
                                </div>
                            )}

                            {activeTab === 'ai' && (
                                <div className="settings-section animate-fade-in">
                                    <div className="settings-card">
                                        <div className="settings-field">
                                            <label>Provider</label>
                                            <select
                                                aria-label="AI Provider"
                                                value={aiProvider}
                                                onChange={(e) => {
                                                    const nextProvider = e.target.value as AiProvider
                                                    setAiProvider(nextProvider)
                                                    setAiModel('')
                                                    void saveAiConfig({
                                                        provider: nextProvider,
                                                        model: '',
                                                        apiKey: '',
                                                        ollamaUrl: aiOllamaUrl
                                                    })
                                                    void handleRefreshModels(nextProvider, '')
                                                }}
                                                className="settings-input"
                                            >
                                                <optgroup label="API Providers">
                                                    <option value="openai">OpenAI</option>
                                                    <option value="anthropic">Anthropic</option>
                                                    <option value="google">Google</option>
                                                    <option value="mistral">Mistral</option>
                                                </optgroup>
                                                <optgroup label="Local / CLI">
                                                    <option value="ollama">Ollama (Local)</option>
                                                    <option value="codex-cli">Codex CLI</option>
                                                    <option value="github-cli">GitHub Copilot CLI</option>
                                                    <option value="opencode">OpenCode</option>
                                                    {enableDangerousFeatures && (
                                                        <>
                                                            <option value="junie-cli">Junie CLI</option>
                                                        </>
                                                    )}
                                                </optgroup>
                                            </select>
                                        </div>

                                        {showStatusCheck && (
                                            <div className="settings-field">
                                                <label>{isOpenCode ? 'Service Status' : 'CLI Status'}</label>
                                                <div className="settings-inline-row">
                                                    {checkingCli ? (
                                                        <span className="settings-cli-status settings-cli-status--muted">Checking...</span>
                                                    ) : cliStatus?.available ? (
                                                        <span className="settings-cli-status settings-cli-status--success">
                                                            ✓ {isOpenCode ? 'Connected' : `Installed (${cliStatus.version || 'Unknown version'})`}
                                                        </span>
                                                    ) : (
                                                        <span className="settings-cli-status settings-cli-status--error">
                                                            ✗ Not found
                                                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="settings-btn-secondary settings-btn-secondary--compact"
                                                        onClick={refreshCliAvailability}
                                                        disabled={checkingCli}
                                                    >
                                                        Refresh
                                                    </button>
                                                </div>
                                                {!cliStatus?.available && !checkingCli && (
                                                    <span className="settings-hint settings-hint--error">
                                                        {isOpenCode
                                                            ? 'OpenCode service is not running. Please start the OpenCode background service.'
                                                            : 'This CLI tool is required. Please install it to use this provider.'}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {aiProvider === 'ollama' && (
                                            <div className="settings-field">
                                                <label>Base URL</label>
                                                <input
                                                    type="text"
                                                    aria-label="Base URL"
                                                    placeholder="http://localhost:11434"
                                                    value={aiOllamaUrl}
                                                    onChange={(e) => setAiOllamaUrl(e.target.value)}
                                                    onBlur={handleSaveAi}
                                                    className="settings-input"
                                                />
                                                <span className="settings-hint">URL of your Ollama server</span>
                                            </div>
                                        )}

                                        <div className="settings-field">
                                            <label>Model</label>
                                            <div className="settings-inline-row">
                                                <select
                                                    aria-label="Model"
                                                    value={selectedAiModel}
                                                    onChange={(e) => {
                                                        const nextModel = e.target.value
                                                        setAiModel(nextModel)
                                                        saveAiConfig({
                                                            provider: aiProvider as AiProvider,
                                                            model: nextModel,
                                                            apiKey: '',
                                                            ollamaUrl: aiOllamaUrl
                                                        })
                                                    }}
                                                    className="settings-input settings-input--flex"
                                                >
                                                    {availableModels.map((model) => (
                                                        <option key={model} value={model}>{model}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    className="settings-btn-secondary settings-btn-secondary--compact"
                                                    onClick={() => void handleRefreshModels()}
                                                    disabled={refreshingModels}
                                                >
                                                    <RefreshCw
                                                        size={14}
                                                        className={refreshingModels ? 'settings-spin-icon' : undefined}
                                                    />
                                                    {refreshingModels ? 'Refreshing...' : 'Refresh Models List'}
                                                </button>
                                            </div>
                                            {modelRefreshStatus && (
                                                <span
                                                    className={`settings-hint settings-hint--${modelRefreshStatus.type}`}
                                                    aria-live="polite"
                                                >
                                                    {modelRefreshStatus.message}
                                                </span>
                                            )}
                                            {isCliProvider && (
                                                <span className="settings-hint">
                                                    For CLI integration, available models may depend on the CLI version installed. Update the CLI tool to access newer models.
                                                </span>
                                            )}
                                            {isOpenCode && (
                                                <span className="settings-hint">
                                                    For OpenCode, available models are retrieved from the running OpenCode service. Start or restart the OpenCode service to update the list.
                                                </span>
                                            )}
                                        </div>

                                        <div className="settings-info-notice">
                                            <span>API keys are managed in the </span>
                                            <button className="settings-notice-link"
                                                onClick={() => setActiveTab('keys')}>Credentials tab
                                            </button>
                                        </div>
                                    </div>

                                    <div className="settings-row settings-row--danger">
                                        <div className="settings-label">
                                            <span className="settings-label-title settings-label-title--danger">
                                                Enable Dangerous Features
                                                <span className="settings-danger-info-wrap">
                                                    <Info size={13} className="settings-danger-info-icon" />
                                                    <span className="settings-danger-tooltip">
                                                        <strong>Dangerous features (disabled by default):</strong>
                                                        <ul>
                                                            <li>Gemini CLI — AI provider via local Gemini CLI tool</li>
                                                            <li>Junie CLI — AI provider via local Junie CLI tool</li>
                                                        </ul>
                                                        These features interact with local system tools and may expose your environment to risk. Additionally some of these features may
                                                        cause your accounts to be banned. Use at your own risk.
                                                    </span>
                                                </span>
                                            </span>
                                            <span className="settings-label-desc">Use at your own risk. Powerful features but may have unintended side-effects and/or consequences.</span>
                                        </div>
                                        <div className="settings-control">
                                            <label className="settings-toggle">
                                                <input
                                                    type="checkbox"
                                                    aria-label="Enable Dangerous Features"
                                                    checked={enableDangerousFeatures}
                                                    onChange={(e) => {
                                                        const next = e.target.checked
                                                        setEnableDangerousFeatures(next)
                                                        if (!next && DANGEROUS_CRED_IDS.includes(`ai:${aiProvider}`)) {
                                                            const fallback = 'openai'
                                                            setAiProvider(fallback)
                                                            setAiModel('')
                                                            void saveAiConfig({
                                                                provider: fallback as AiProvider,
                                                                model: '',
                                                                apiKey: '',
                                                                ollamaUrl: aiOllamaUrl
                                                            })
                                                            void handleRefreshModels(fallback, '')
                                                        }
                                                    }}
                                                />
                                                <span>{enableDangerousFeatures ? 'On' : 'Off'}</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'media' && (
                                <div className="settings-section animate-fade-in">
                                    <div className="settings-card">
                                        <div className="settings-field">
                                            <label>Default Provider</label>
                                            <select
                                                aria-label="Default Provider"
                                                value={mediaProvider}
                                                onChange={(e) => {
                                                    const nextProvider = e.target.value
                                                    setMediaProvider(nextProvider)
                                                    void handleSaveMedia(nextProvider)
                                                }}
                                                className="settings-input"
                                            >
                                                <option value="unsplash">Unsplash</option>
                                                <option value="pexels">Pexels</option>
                                                <option value="pixabay">Pixabay</option>
                                            </select>
                                        </div>
                                        <div className="settings-info-notice">
                                            <span>API keys are managed in the </span>
                                            <button className="settings-notice-link"
                                                onClick={() => setActiveTab('keys')}>Credentials tab
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                </SettingsWorkspace>
            </div>

            <CredentialEditModal
                open={modalOpen}
                mode={modalMode}
                credential={modalCredential}
                definitions={visibleDefinitions}
                onClose={() => setModalOpen(false)}
                onSaved={refreshCredentialsAndFeatureConfigs}
            />
        </>
    )
}
