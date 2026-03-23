import { useState, useEffect, useRef } from 'react'
import { X, Settings, Image as ImageIcon, Sparkles, KeyRound, Monitor, Moon, Sun, LayoutPanelLeft } from 'lucide-react'
import { getApi } from '../../utils/api'
import { useAppSettingsStore } from '../../store/appSettingsStore'
import { useAiStore } from '../../store/aiStore'
import type { EditorLayout } from '../../store/types'
import './SettingsDialog.css'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  initialTab?: TabType
}

type TabType = 'general' | 'keys'

export default function SettingsDialog({ open, onClose, initialTab = 'general' }: SettingsDialogProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const overlayRef = useRef<HTMLDivElement>(null)

  // -- App Settings --
  const theme = useAppSettingsStore((s) => s.theme)
  const setTheme = useAppSettingsStore((s) => s.setTheme)
  const defaultLayout = useAppSettingsStore((s) => s.defaultLayout)
  const setDefaultLayout = useAppSettingsStore((s) => s.setDefaultLayout)
  const showTabChildSelectionWarning = useAppSettingsStore((s) => s.showTabChildSelectionWarning)
  const setShowTabChildSelectionWarning = useAppSettingsStore((s) => s.setShowTabChildSelectionWarning)

  // -- AI Settings --
  const aiConfig = useAiStore((s) => s.config)
  const providerModels = useAiStore((s) => s.providerModels)
  const loadAiConfig = useAiStore((s) => s.loadConfig)
  const saveAiConfig = useAiStore((s) => s.saveConfig)
  const loadAiModels = useAiStore((s) => s.loadModels)
  const fetchModelsForProvider = useAiStore((s) => s.fetchModelsForProvider)

  // local AI state for form
  const [aiProvider, setAiProvider] = useState(aiConfig?.provider || 'openai')
  const [aiModel, setAiModel] = useState(aiConfig?.model || '')
  const [aiKey, setAiKey] = useState(aiConfig?.apiKey || '')
  const [aiOllamaUrl, setAiOllamaUrl] = useState(aiConfig?.ollamaUrl || 'http://localhost:11434')

  // -- Media Search Settings --
  const [mediaProvider, setMediaProvider] = useState('unsplash')
  const [mediaKey, setMediaKey] = useState('')

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
    }
  }, [open, loadAiConfig, loadAiModels])

  // Sync local state when aiConfig updates
  useEffect(() => {
    if (aiConfig) {
      setAiProvider(aiConfig.provider)
      setAiModel(aiConfig.model)
      setAiKey(aiConfig.apiKey)
      setAiOllamaUrl(aiConfig.ollamaUrl || 'http://localhost:11434')
    }
  }, [aiConfig])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  const handleSaveAi = async () => {
    await saveAiConfig({ provider: aiProvider as any, model: aiModel, apiKey: aiKey, ollamaUrl: aiOllamaUrl })
    // Refresh available models for the current provider now that the key / URL may have changed
    fetchModelsForProvider(aiProvider, aiKey, aiOllamaUrl)
  }

  const handleSaveMedia = async () => {
    const api = getApi()
    await api.mediaSearch.setConfig({ provider: mediaProvider, apiKey: mediaKey })
  }

  if (!open) return null

  const availableModels = providerModels[aiProvider] || []

  return (
    <div className="settings-dialog-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="settings-dialog">
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
              <span>API Keys</span>
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
                <h3>AI Assistant</h3>
                <div className="settings-card">
                  <div className="settings-field">
                    <label>Provider</label>
                    <select
                      value={aiProvider}
                      onChange={(e) => {
                        const newProvider = e.target.value as any
                        setAiProvider(newProvider)
                        // Reset model so the new provider's default is used
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
                      <span className="settings-hint">
                        URL of your Ollama server
                      </span>
                    </div>
                  )}

                  <div className="settings-field">
                    <label>Model</label>
                    <select
                      value={aiModel}
                      onChange={(e) => {
                        const newModel = e.target.value
                        setAiModel(newModel)
                        saveAiConfig({ provider: aiProvider as any, model: newModel, apiKey: aiKey, ollamaUrl: aiOllamaUrl })
                      }}
                      className="settings-input"
                    >
                      {availableModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="settings-field">
                    <label>API Key{aiProvider === 'ollama' ? ' (Optional)' : ''}</label>
                    <input
                      type="password"
                      placeholder={aiProvider === 'ollama' ? 'Leave empty if not required' : 'sk-...'}
                      value={aiKey}
                      onChange={(e) => setAiKey(e.target.value)}
                      onBlur={handleSaveAi}
                      className="settings-input"
                    />
                    <span className="settings-hint">
                      {aiProvider === 'ollama'
                        ? 'Only needed for authenticated Ollama deployments'
                        : 'Saved securely in system keychain'}
                    </span>
                  </div>
                </div>

                <h3 className="section-divider">Media Search</h3>
                <div className="settings-card">
                  <div className="settings-field">
                    <label>Image Provider</label>
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
                    <label>API Key</label>
                    <input
                      type="password"
                      placeholder="Enter Access Key..."
                      value={mediaKey}
                      onChange={(e) => setMediaKey(e.target.value)}
                      onBlur={handleSaveMedia}
                      className="settings-input"
                    />
                    <span className="settings-hint">
                      Required for web image search
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
