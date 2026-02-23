import { useEffect, useRef, useState } from 'react'
import { Settings, Send, Trash2, Sparkles, ArrowDownToLine, Copy, X } from 'lucide-react'
import { useAiStore, type AiProvider } from '../../store/aiStore'
import { useEditorStore } from '../../store/editorStore'
import { createBlock, type Block } from '../../store/types'
import './AiAssistant.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Try to extract a JSON blocks payload from the AI response */
function tryParseBlocks(content: string): Block[] | null {
    try {
        // Look for JSON object with a "blocks" array
        const jsonMatch = content.match(/\{[\s\S]*"blocks"\s*:\s*\[[\s\S]*\][\s\S]*\}/)
        if (!jsonMatch) return null

        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
            return parsed.blocks
        }
    } catch {
        // Not valid JSON — that's fine, it's a text response
    }
    return null
}

function buildBlockFromAiData(data: any): Block {
    return createBlock(data.type || 'container', {
        props: data.props || {},
        styles: data.styles || {},
        classes: data.classes || [],
        content: data.content,
        children: Array.isArray(data.children)
            ? data.children.map(buildBlockFromAiData)
            : []
    })
}

// ---------------------------------------------------------------------------
// Settings Modal
// ---------------------------------------------------------------------------

function AiSettingsModal(): JSX.Element {
    const { config, providerModels, saveConfig, setShowSettings, loadModels } = useAiStore()
    const [localConfig, setLocalConfig] = useState(() => ({
        ...config,
        apiKey: '' // Never pre-fill with the masked key
    }))
    const hasExistingKey = !!(config.apiKey && config.apiKey.startsWith('\u2022\u2022\u2022\u2022'))

    useEffect(() => {
        loadModels()
    }, [loadModels])

    const models = providerModels[localConfig.provider] || []

    const handleProviderChange = (provider: AiProvider) => {
        const defaultModel =
            providerModels[provider]?.[0] || (provider === 'ollama' ? 'llama3' : 'gpt-4o')
        setLocalConfig({ ...localConfig, provider, model: defaultModel })
    }

    const handleSave = () => {
        const configToSave = { ...localConfig }
        if (!configToSave.apiKey && hasExistingKey) {
            // User didn't enter a new key — send the masked value so the
            // main process knows to keep the existing encrypted key.
            configToSave.apiKey = config.apiKey
        }
        saveConfig(configToSave)
        setShowSettings(false)
    }

    return (
        <div className="ai-settings-overlay" onClick={() => setShowSettings(false)}>
            <div className="ai-settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ai-settings-header">
                    <h3>AI Settings</h3>
                    <button className="ai-settings-close" onClick={() => setShowSettings(false)}>
                        <X size={16} />
                    </button>
                </div>

                <div className="ai-settings-body">
                    <div className="ai-settings-field">
                        <label>Provider</label>
                        <select
                            value={localConfig.provider}
                            onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
                        >
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic (Claude)</option>
                            <option value="google">Google (Gemini)</option>
                            <option value="ollama">Ollama (Local)</option>
                        </select>
                    </div>

                    <div className="ai-settings-field">
                        <label>Model</label>
                        <select
                            value={models.includes(localConfig.model) ? localConfig.model : 'custom'}
                            onChange={(e) => {
                                if (e.target.value !== 'custom') {
                                    setLocalConfig({ ...localConfig, model: e.target.value })
                                } else {
                                    setLocalConfig({ ...localConfig, model: '' })
                                }
                            }}
                        >
                            {models.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                            <option value="custom">-- Custom Model --</option>
                        </select>

                        {!models.includes(localConfig.model) && (
                            <input
                                type="text"
                                style={{ marginTop: '4px' }}
                                value={localConfig.model}
                                onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
                                placeholder="Enter custom model name"
                            />
                        )}
                        <span className="ai-settings-hint">
                            {localConfig.provider === 'ollama'
                                ? 'Type any model name or pick from suggestions. Make sure it\'s pulled via `ollama pull <model>`.'
                                : 'Pick from suggestions or type any model name (e.g. a new release).'}
                        </span>
                    </div>

                    {localConfig.provider !== 'ollama' ? (
                        <div className="ai-settings-field">
                            <label>API Key</label>
                            <input
                                type="password"
                                value={localConfig.apiKey}
                                placeholder={
                                    hasExistingKey
                                        ? `Key configured (${config.apiKey}). Enter new key to replace.`
                                        : `Enter your ${localConfig.provider === 'openai' ? 'OpenAI' : localConfig.provider === 'anthropic' ? 'Anthropic' : 'Google'} API key`
                                }
                                onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                            />
                            <span className="ai-settings-hint">
                                {hasExistingKey
                                    ? 'Your API key is encrypted and stored securely. Leave empty to keep the current key.'
                                    : 'Your API key is encrypted and stored securely on your machine.'}
                            </span>
                        </div>
                    ) : (
                        <div className="ai-settings-field">
                            <label>Ollama Server URL</label>
                            <input
                                type="text"
                                value={localConfig.ollamaUrl}
                                placeholder="http://localhost:11434"
                                onChange={(e) => setLocalConfig({ ...localConfig, ollamaUrl: e.target.value })}
                            />
                            <span className="ai-settings-hint">
                                Default is http://localhost:11434. Make sure Ollama is running.
                            </span>
                        </div>
                    )}
                </div>

                <div className="ai-settings-footer">
                    <button className="ai-settings-cancel-btn" onClick={() => setShowSettings(false)}>
                        Cancel
                    </button>
                    <button className="ai-settings-save-btn" onClick={handleSave}>
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Main AI Assistant Component
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
    'Create a hero section with a title and CTA button',
    'Build a pricing table with 3 tiers',
    'Make a footer with copyright and social links',
    'Add a contact form with name, email, and message'
]

export default function AiAssistant(): JSX.Element {
    const { messages, isLoading, config, configLoaded, showSettings, sendMessage, clearChat, loadConfig, setShowSettings } = useAiStore()
    const addBlock = useEditorStore((s) => s.addBlock)
    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Load config on mount
    useEffect(() => {
        if (!configLoaded) {
            loadConfig()
        }
    }, [configLoaded, loadConfig])

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isLoading])

    const handleSend = () => {
        const text = input.trim()
        if (!text || isLoading) return
        setInput('')
        sendMessage(text)
        inputRef.current?.focus()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleInsertBlocks = (content: string) => {
        const blocks = tryParseBlocks(content)
        if (!blocks) return

        for (const blockData of blocks) {
            const block = buildBlockFromAiData(blockData)
            addBlock(block)
        }
    }

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content).catch(() => {
            // fallback — ignore
        })
    }

    const providerLabel =
        config.provider === 'openai'
            ? 'OpenAI'
            : config.provider === 'anthropic'
                ? 'Claude'
                : config.provider === 'google'
                    ? 'Gemini'
                    : 'Ollama'

    const hasApiKey = config.provider === 'ollama' || (config.apiKey && config.apiKey.length > 0)

    return (
        <div className="ai-assistant">
            {/* Header */}
            <div className="ai-header">
                <div className="ai-header-left">
                    <Sparkles size={14} />
                    <span>AI Assistant</span>
                    <span className="ai-header-provider">{providerLabel}</span>
                </div>
                <div className="ai-header-actions">
                    {messages.length > 0 && (
                        <button
                            className="ai-header-btn"
                            title="Clear chat"
                            onClick={clearChat}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                    <button
                        className="ai-header-btn"
                        title="AI Settings"
                        onClick={() => setShowSettings(true)}
                    >
                        <Settings size={14} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="ai-messages">
                {messages.length === 0 && !isLoading ? (
                    <div className="ai-empty">
                        <div className="ai-empty-icon">✨</div>
                        <div className="ai-empty-title">AI Assistant</div>
                        <div className="ai-empty-subtitle">
                            {hasApiKey
                                ? 'Ask me to generate components, edit content, or suggest design improvements.'
                                : 'Configure your API key in settings to get started.'}
                        </div>
                        {hasApiKey && (
                            <div className="ai-empty-suggestions">
                                {SUGGESTIONS.map((s) => (
                                    <button
                                        key={s}
                                        className="ai-suggestion-btn"
                                        onClick={() => {
                                            setInput(s)
                                            inputRef.current?.focus()
                                        }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`ai-message ${msg.role} ${msg.isError ? 'error' : ''}`}
                            >
                                <div className="ai-message-content">{msg.content}</div>
                                <div className="ai-message-time">
                                    {new Date(msg.timestamp).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </div>
                                {msg.role === 'assistant' && !msg.isError && (
                                    <div className="ai-message-actions">
                                        {tryParseBlocks(msg.content) && (
                                            <button
                                                className="ai-action-btn"
                                                onClick={() => handleInsertBlocks(msg.content)}
                                                title="Insert blocks into canvas"
                                            >
                                                <ArrowDownToLine size={12} /> Insert
                                            </button>
                                        )}
                                        <button
                                            className="ai-action-btn"
                                            onClick={() => handleCopy(msg.content)}
                                            title="Copy response"
                                        >
                                            <Copy size={12} /> Copy
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="ai-loading">
                                <div className="ai-loading-dots">
                                    <span />
                                    <span />
                                    <span />
                                </div>
                                Thinking...
                            </div>
                        )}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="ai-input-bar">
                <textarea
                    ref={inputRef}
                    className="ai-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={hasApiKey ? 'Ask the AI to build something...' : 'Configure API key in settings first...'}
                    rows={1}
                    disabled={isLoading}
                />
                <button
                    className="ai-send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    title="Send message"
                >
                    <Send size={16} />
                </button>
            </div>

            {/* Settings modal */}
            {showSettings && <AiSettingsModal />}
        </div>
    )
}
