import { useEffect, useRef, useState } from 'react'
import { X, Settings, Image as ImageIcon, Sparkles, KeyRound, Monitor, Moon, Sun, LayoutPanelLeft } from 'lucide-react'
import { getApi } from '../../utils/api'
import { useAppSettingsStore } from '../../store/appSettingsStore'
import { useAiStore } from '../../store/aiStore'
import type { EditorLayout } from '../../store/types'
import { dispatchAiAvailabilityChanged } from '../../hooks/useAiAvailability'
import CredentialEditModal from './CredentialEditModal'
import './SettingsDialog.css'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  initialTab?: TabType
}

type TabType = 'general' | 'keys' | 'ai' | 'media'

export default function SettingsDialog({ open, onClose, initialTab = 'general' }: SettingsDialogProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const overlayRef = useRef<HTMLDivElement>(null)

  const theme = useAppSettingsStore((s) => s.theme)
  const setTheme = useAppSettingsStore((s) => s.setTheme)
  const defaultLayout = useAppSettingsStore((s) => s.defaultLayout)
  const setDefaultLayout = useAppSettingsStore((s) => s.setDefaultLayout)
  const showTabChildSelectionWarning = useAppSettingsStore((s) => s.showTabChildSelectionWarning)
  const setShowTabChildSelectionWarning = useAppSettingsStore((s) => s.setShowTabChildSelectionWarning)

  const aiConfig = useAiStore((s) => s.config)
  const providerModels = useAiStore((s) => s.providerModels)
  const loadAiConfig = useAiStore((s) => s.loadConfig)
  const saveAiConfig = useAiStore((s) => s.saveConfig)
  const loadAiModels = useAiStore((s) => s.loadModels)
  const fetchModelsForProvider = useAiStore((s) => s.fetchModelsForProvider)

  const [aiProvider, setAiProvider] = useState(aiConfig?.provider || 'openai')
  const [aiModel, setAiModel] = useState(aiConfig?.model || '')
  const [aiOllamaUrl, setAiOllamaUrl] = useState(aiConfig?.ollamaUrl || 'http://localhost:11434')

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

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab)
      loadAiConfig().then(() => {
        loadAiModels()
      })

      const api = getApi()
      api.mediaSearch.getConfig().then((result) => {
        if (result.success && result.config) {
          setMediaProvider(result.config.provider || 'unsplash')
        }
      })

      void refreshCredentials()
    }
  }, [open, initialTab, loadAiConfig, loadAiModels])

  useEffect(() => {
    if (aiConfig) {
      setAiProvider(aiConfig.provider)
      setAiModel(aiConfig.model)
      setAiOllamaUrl(aiConfig.ollamaUrl || 'http://localhost:11434')
    }
  }, [aiConfig])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  const handleSaveAi = async () => {
    await saveAiConfig({ provider: aiProvider as any, model: aiModel, apiKey: '', ollamaUrl: aiOllamaUrl })
    fetchModelsForProvider(aiProvider, '', aiOllamaUrl)
  }

  const handleSaveMedia = async () => {
    const api = getApi()
    await api.mediaSearch.setConfig({ provider: mediaProvider, apiKey: '' })
  }

  const handleDeleteCredential = async (id: string) => {
    const api = getApi()
    const result = await api.app.deleteCredential(id)
    if (!result.success) {
      setConfirmDeleteId(null)
      return
    }
    dispatchAiAvailabilityChanged()
    await refreshCredentials()
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

  if (!open) return null

  const availableModels = providerModels[aiProvider] || []

  return (
    <>
      <div className="settings-dialog-overlay" ref={overlayRef} onClick={handleOverlayClick}>
        <div className="settings-dialog settings-dialog--wide">
          <div className="settings-dialog-header">
            <div className="settings-dialog-title">
              <Settings size={18} />
              <span>Global Settings</span>
            </div>
            <button className="settings-dialog-close" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>

          <div className="settings-dialog-layout">
            <div className="settings-dialog-sidebar">
              <button
                className={`settings-dialog-tab ${activeTab === 'general' ? 'active' : ''}`}
                onClick={() => setActiveTab('general')}
              >
                <Monitor size={16} />
                <span>General</span>
              </button>
              <button
                className={`settings-dialog-tab ${activeTab === 'keys' ? 'active' : ''}`}
                onClick={() => setActiveTab('keys')}
              >
                <KeyRound size={16} />
                <span>Credentials</span>
              </button>
              <button
                className={`settings-dialog-tab ${activeTab === 'ai' ? 'active' : ''}`}
                onClick={() => setActiveTab('ai')}
              >
                <Sparkles size={16} />
                <span>AI Assistant</span>
              </button>
              <button
                className={`settings-dialog-tab ${activeTab === 'media' ? 'active' : ''}`}
                onClick={() => setActiveTab('media')}
              >
                <ImageIcon size={16} />
                <span>Media Search</span>
              </button>
            </div>

            <div className="settings-dialog-content">
              {activeTab === 'general' && (
                <div className="settings-section animate-fade-in">
                  <h3>Appearance & Layout</h3>
                  <div className="settings-row">
                    <div className="settings-label">
                      <span className="settings-label-title">Theme</span>
                      <span className="settings-label-desc">Switch between dark and light mode</span>
                    </div>
                    <div className="settings-control">
                      <div className="theme-toggle">
                        <button
                          className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                          onClick={() => setTheme('light')}
                        >
                          <Sun size={14} /> Light
                        </button>
                        <button
                          className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
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
                      <span className="settings-label-title">Tab Child Selection Warning</span>
                      <span className="settings-label-desc">Show an informational warning when selecting content rendered inside a tab component</span>
                    </div>
                    <div className="settings-control">
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={showTabChildSelectionWarning}
                          onChange={(e) => setShowTabChildSelectionWarning(e.target.checked)}
                        />
                        <span>{showTabChildSelectionWarning ? 'On' : 'Off'}</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'keys' && (
                <div className="settings-section animate-fade-in">
                  <div className="settings-heading-row">
                    <div>
                      <h3>Credentials</h3>
                      <p className="settings-subcopy">A single inventory for AI, multimedia, and publisher credentials.</p>
                    </div>
                    <button className="settings-btn-primary" onClick={openCreateModal}>
                      Add Credential
                    </button>
                  </div>

                  {credentialLoading && credentials.length === 0 ? (
                    <p className="settings-subcopy">Loading credentials…</p>
                  ) : credentials.length === 0 ? (
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
                        {credentials.map((cred) => (
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
                                    <span className="cred-confirm-text">Are you sure?</span>
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

                  {credentialLoading && credentials.length > 0 && (
                    <p className="settings-subcopy">Refreshing credentials…</p>
                  )}
                </div>
              )}

              {activeTab === 'ai' && (
                <div className="settings-section animate-fade-in">
                  <h3>AI Assistant</h3>
                  <div className="settings-card">
                    <div className="settings-field">
                      <label>Provider</label>
                      <select
                        value={aiProvider}
                        onChange={(e) => {
                          const nextProvider = e.target.value as any
                          setAiProvider(nextProvider)
                          setAiModel('')
                        }}
                        onBlur={handleSaveAi}
                        className="settings-input"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="google">Google</option>
                        <option value="mistral">Mistral</option>
                        <option value="ollama">Ollama (Local)</option>
                      </select>
                    </div>

                    {aiProvider === 'ollama' && (
                      <div className="settings-field">
                        <label>Base URL</label>
                        <input
                          type="text"
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
                      <select
                        value={aiModel}
                        onChange={(e) => {
                          const nextModel = e.target.value
                          setAiModel(nextModel)
                          saveAiConfig({ provider: aiProvider as any, model: nextModel, apiKey: '', ollamaUrl: aiOllamaUrl })
                        }}
                        className="settings-input"
                      >
                        {availableModels.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    </div>

                    <div className="settings-info-notice">
                      <span>API keys are managed in the </span>
                      <button className="settings-notice-link" onClick={() => setActiveTab('keys')}>Credentials tab</button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'media' && (
                <div className="settings-section animate-fade-in">
                  <h3>Media Search</h3>
                  <div className="settings-card">
                    <div className="settings-field">
                      <label>Default Provider</label>
                      <select
                        value={mediaProvider}
                        onChange={(e) => {
                          setMediaProvider(e.target.value)
                          setTimeout(handleSaveMedia, 0)
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
                      <button className="settings-notice-link" onClick={() => setActiveTab('keys')}>Credentials tab</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CredentialEditModal
        open={modalOpen}
        mode={modalMode}
        credential={modalCredential}
        definitions={definitions}
        onClose={() => setModalOpen(false)}
        onSaved={refreshCredentials}
      />
    </>
  )
}
