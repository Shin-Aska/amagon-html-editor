import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Settings, Image as ImageIcon, Sparkles, KeyRound, Monitor, Moon, Sun, LayoutPanelLeft } from 'lucide-react'
import { getApi } from '../../utils/api'
import { useAppSettingsStore } from '../../store/appSettingsStore'
import { useAiStore } from '../../store/aiStore'
import type { EditorLayout } from '../../store/types'
import { dispatchAiAvailabilityChanged } from '../../hooks/useAiAvailability'
import './SettingsDialog.css'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  initialTab?: TabType
}

type TabType = 'general' | 'keys' | 'ai' | 'media'

type EditorMode = 'create' | 'edit' | null

const CATEGORY_OPTIONS: Array<{ value: CredentialCategory; label: string }> = [
  { value: 'ai', label: 'AI' },
  { value: 'multimedia', label: 'Multimedia' },
  { value: 'publisher', label: 'Publisher' }
]

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
  const [aiKey, setAiKey] = useState(aiConfig?.apiKey || '')
  const [aiOllamaUrl, setAiOllamaUrl] = useState(aiConfig?.ollamaUrl || 'http://localhost:11434')

  const [mediaProvider, setMediaProvider] = useState('unsplash')
  const [mediaKey, setMediaKey] = useState('')

  const [credentials, setCredentials] = useState<CredentialRecordInfo[]>([])
  const [definitions, setDefinitions] = useState<CredentialDefinitionInfo[]>([])
  const [credentialLoading, setCredentialLoading] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>(null)
  const [selectedCategory, setSelectedCategory] = useState<CredentialCategory>('ai')
  const [selectedDefinitionId, setSelectedDefinitionId] = useState('')
  const [editingCredentialId, setEditingCredentialId] = useState<string | null>(null)
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({})
  const [credentialHints, setCredentialHints] = useState<Record<string, string>>({})
  const [credentialError, setCredentialError] = useState<string | null>(null)

  const selectedDefinition = useMemo(
    () => definitions.find((definition) => definition.id === selectedDefinitionId) ?? null,
    [definitions, selectedDefinitionId]
  )

  const definitionsForCategory = useMemo(
    () => definitions.filter((definition) => definition.category === selectedCategory),
    [definitions, selectedCategory]
  )

  const groupedCredentials = useMemo(() => {
    return CATEGORY_OPTIONS.map((category) => ({
      ...category,
      items: credentials.filter((credential) => credential.category === category.value)
    }))
  }, [credentials])

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
          setMediaKey(result.config.apiKey || '')
        }
      })

      void refreshCredentials()
    }
  }, [open, initialTab, loadAiConfig, loadAiModels])

  useEffect(() => {
    if (aiConfig) {
      setAiProvider(aiConfig.provider)
      setAiModel(aiConfig.model)
      setAiKey(aiConfig.apiKey)
      setAiOllamaUrl(aiConfig.ollamaUrl || 'http://localhost:11434')
    }
  }, [aiConfig])

  useEffect(() => {
    if (!selectedDefinitionId && definitions.length > 0) {
      const fallback = definitions.find((definition) => definition.category === selectedCategory) ?? definitions[0]
      if (fallback) {
        setSelectedDefinitionId(fallback.id)
      }
    }
  }, [definitions, selectedCategory, selectedDefinitionId])

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
    await saveAiConfig({ provider: aiProvider as any, model: aiModel, apiKey: aiKey, ollamaUrl: aiOllamaUrl })
    fetchModelsForProvider(aiProvider, aiKey, aiOllamaUrl)
  }

  const handleSaveMedia = async () => {
    const api = getApi()
    await api.mediaSearch.setConfig({ provider: mediaProvider, apiKey: mediaKey })
  }

  const startCreateCredential = (category: CredentialCategory = 'ai') => {
    const firstDefinition = definitions.find((definition) => definition.category === category) ?? definitions[0]
    setEditorMode('create')
    setSelectedCategory(category)
    setSelectedDefinitionId(firstDefinition?.id ?? '')
    setEditingCredentialId(null)
    setCredentialValues({})
    setCredentialHints({})
    setCredentialError(null)
  }

  const startEditCredential = async (credential: CredentialRecordInfo) => {
    const api = getApi()
    const result = await api.app.getCredentialValues(credential.id)
    const values = result.success ? (result.values ?? {}) : {}
    const nextValues: Record<string, string> = {}
    const nextHints: Record<string, string> = {}

    for (const field of credential.fields) {
      const fieldValue = values[field.key] ?? ''
      nextValues[field.key] = field.sensitive ? '' : fieldValue
      nextHints[field.key] = fieldValue
    }

    setEditorMode('edit')
    setSelectedCategory(credential.category)
    setSelectedDefinitionId(credential.id)
    setEditingCredentialId(credential.id)
    setCredentialValues(nextValues)
    setCredentialHints(nextHints)
    setCredentialError(null)
  }

  const buildCredentialPayload = (): Record<string, string> => {
    if (!selectedDefinition) return {}

    return selectedDefinition.fields.reduce<Record<string, string>>((acc, field) => {
      const value = credentialValues[field.key] ?? ''
      const hint = credentialHints[field.key] ?? ''
      if (field.sensitive && value === '' && hint) {
        return acc
      }
      acc[field.key] = value
      return acc
    }, {})
  }

  const handleSaveCredential = async () => {
    if (!selectedDefinition) return

    const api = getApi()
    const result = await api.app.saveCredential(selectedDefinition.id, buildCredentialPayload())
    if (!result.success) {
      setCredentialError(result.error || 'Could not save credential.')
      return
    }

    dispatchAiAvailabilityChanged()
    await refreshCredentials()
    setEditorMode(null)
    setEditingCredentialId(null)
    setCredentialValues({})
    setCredentialHints({})
    setCredentialError(null)
  }

  const handleDeleteCredential = async (id: string) => {
    const api = getApi()
    const result = await api.app.deleteCredential(id)
    if (!result.success) {
      setCredentialError(result.error || 'Could not delete credential.')
      return
    }

    dispatchAiAvailabilityChanged()
    await refreshCredentials()
    if (editingCredentialId === id) {
      setEditorMode(null)
      setEditingCredentialId(null)
      setCredentialValues({})
      setCredentialHints({})
    }
  }

  if (!open) return null

  const availableModels = providerModels[aiProvider] || []

  return (
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
                </div>

                <div className="settings-credential-stack">
                  {groupedCredentials.map((group) => (
                    <div key={group.value} className="settings-card">
                      <div className="settings-card-header">
                        <h4>{group.label}</h4>
                        <span className="settings-card-count">{group.items.length}</span>
                      </div>
                      {group.items.length === 0 ? (
                        <p className="settings-empty">No {group.label.toLowerCase()} credentials saved yet.</p>
                      ) : (
                        <div className="settings-credential-list">
                          {group.items.map((credential) => (
                            <div key={credential.id} className="settings-credential-item">
                              <div className="settings-credential-copy">
                                <div className="settings-credential-topline">
                                  <span className="settings-credential-title">{credential.label}</span>
                                  <span className="settings-credential-pill">{credential.categoryLabel}</span>
                                </div>
                                <div className="settings-credential-meta">
                                  {credential.maskedKey || credential.description}
                                </div>
                              </div>
                              <div className="settings-credential-actions">
                                <button className="settings-btn-secondary" onClick={() => startEditCredential(credential)}>
                                  Edit
                                </button>
                                <button className="settings-btn-danger" onClick={() => handleDeleteCredential(credential.id)}>
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="settings-card">
                    <button className="settings-btn-primary settings-btn-block" onClick={() => startCreateCredential()}>
                      Add New Credential
                    </button>
                  </div>

                  {editorMode && selectedDefinition && (
                    <div className="settings-card">
                      <div className="settings-card-header">
                        <h4>{editorMode === 'create' ? 'Add Credential' : 'Edit Credential'}</h4>
                      </div>

                      {editorMode === 'create' && (
                        <>
                          <div className="settings-field">
                            <label>Credential Type</label>
                            <select
                              value={selectedCategory}
                              onChange={(e) => {
                                const nextCategory = e.target.value as CredentialCategory
                                const fallback = definitions.find((definition) => definition.category === nextCategory)
                                setSelectedCategory(nextCategory)
                                setSelectedDefinitionId(fallback?.id ?? '')
                                setCredentialValues({})
                                setCredentialHints({})
                              }}
                              className="settings-input"
                            >
                              {CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="settings-field">
                            <label>Provider</label>
                            <select
                              value={selectedDefinitionId}
                              onChange={(e) => {
                                setSelectedDefinitionId(e.target.value)
                                setCredentialValues({})
                                setCredentialHints({})
                              }}
                              className="settings-input"
                            >
                              {definitionsForCategory.map((definition) => (
                                <option key={definition.id} value={definition.id}>{definition.label}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}

                      {selectedDefinition.fields.map((field) => (
                        <div key={field.key} className="settings-field">
                          <label>{field.label}</label>
                          <input
                            type={field.sensitive ? 'password' : 'text'}
                            className="settings-input"
                            placeholder={
                              field.sensitive && credentialHints[field.key]
                                ? `Saved ${credentialHints[field.key]}`
                                : (field.placeholder ?? '')
                            }
                            value={credentialValues[field.key] ?? ''}
                            onChange={(e) =>
                              setCredentialValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                            }
                          />
                        </div>
                      ))}

                      {credentialError && <div className="settings-error">{credentialError}</div>}

                      <div className="settings-inline-actions">
                        <button className="settings-btn-secondary" onClick={() => setEditorMode(null)}>
                          Cancel
                        </button>
                        <button className="settings-btn-primary" onClick={handleSaveCredential}>
                          Save Credential
                        </button>
                      </div>
                    </div>
                  )}

                  {credentialLoading && (
                    <p className="settings-subcopy">Refreshing credentials...</p>
                  )}
                </div>
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
                        saveAiConfig({ provider: aiProvider as any, model: nextModel, apiKey: aiKey, ollamaUrl: aiOllamaUrl })
                      }}
                      className="settings-input"
                    >
                      {availableModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </div>

                  <div className="settings-field">
                    <label>Active Provider API Key{aiProvider === 'ollama' ? ' (Optional)' : ''}</label>
                    <input
                      type="password"
                      placeholder={aiProvider === 'ollama' ? 'Leave empty if not required' : 'Saved in Credentials'}
                      value={aiKey}
                      onChange={(e) => setAiKey(e.target.value)}
                      onBlur={handleSaveAi}
                      className="settings-input"
                    />
                    <span className="settings-hint">
                      Provider credentials can also be managed centrally from the Credentials tab.
                    </span>
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
                  <div className="settings-field">
                    <label>Provider API Key</label>
                    <input
                      type="password"
                      placeholder="Saved in Credentials"
                      value={mediaKey}
                      onChange={(e) => setMediaKey(e.target.value)}
                      onBlur={handleSaveMedia}
                      className="settings-input"
                    />
                    <span className="settings-hint">
                      Credentials for all media providers can be managed from the Credentials tab.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
