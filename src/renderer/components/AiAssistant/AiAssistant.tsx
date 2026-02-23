import { useEffect, useMemo, useRef, useState } from 'react'
import { Settings, Send, Trash2, Sparkles, ArrowDownToLine, Copy, X, Eye } from 'lucide-react'
import { useAiStore, type AiProvider } from '../../store/aiStore'
import { useEditorStore } from '../../store/editorStore'
import { createBlock, type Block } from '../../store/types'
import { blockToHtml } from '../../utils/blockToHtml'
import './AiAssistant.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ParsedAiResponse {
    /** Explanatory text from the AI (everything outside the JSON) */
    text: string
    /** Parsed blocks, if the response contained a blocks JSON payload */
    blocks: Block[] | null
}

/** Parse an AI response into explanatory text + optional blocks */
function parseAiResponse(content: string): ParsedAiResponse {
    try {
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?"blocks"\s*:\s*\[[\s\S]*?\]\s*\})\s*```/)
            || content.match(/(\{[\s\S]*?"blocks"\s*:\s*\[[\s\S]*?\]\s*\})/)

        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
            if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
                // Extract the text portion (everything that isn't the JSON)
                let text = content
                    .replace(/```(?:json)?\s*\{[\s\S]*?"blocks"\s*:\s*\[[\s\S]*?\]\s*\}\s*```/g, '')
                    .replace(/\{[\s\S]*?"blocks"\s*:\s*\[[\s\S]*?\]\s*\}/g, '')
                    .trim()

                // Clean up markdown artifacts
                text = text.replace(/^\s*```\s*/gm, '').replace(/\s*```\s*$/gm, '').trim()

                const blocks = parsed.blocks.map(buildBlockFromAiData)
                return { text, blocks }
            }
        }
    } catch {
        // Not valid JSON — treat as text-only response
    }

    return { text: content, blocks: null }
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
// Block Preview Component
// ---------------------------------------------------------------------------

function BlockPreview({ blocks }: { blocks: Block[] }): JSX.Element {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const [height, setHeight] = useState(120)

    const html = useMemo(() => blockToHtml(blocks), [blocks])

    const previewDoc = useMemo(() => `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #fff;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    body { padding: 12px; }
    img { max-width: 100%; height: auto; }
</style>
</head>
<body>${html}</body>
<script>
    function sendHeight() {
        const h = Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.scrollHeight
        );
        parent.postMessage({ source: 'ai-preview', height: h }, '*');
    }
    // Send height after load and after images load
    sendHeight();
    window.addEventListener('load', sendHeight);
    new MutationObserver(sendHeight).observe(document.body, { childList: true, subtree: true });
<\/script>
</html>`, [html])

    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            if (e.data?.source === 'ai-preview' && typeof e.data.height === 'number') {
                // Only update if the message came from our iframe
                if (iframeRef.current && e.source === iframeRef.current.contentWindow) {
                    setHeight(Math.min(Math.max(e.data.height, 60), 400))
                }
            }
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [])

    return (
        <div className="ai-preview-container">
            <div className="ai-preview-label">
                <Eye size={11} />
                <span>Preview</span>
            </div>
            <iframe
                ref={iframeRef}
                className="ai-preview-iframe"
                srcDoc={previewDoc}
                title="Block Preview"
                sandbox="allow-scripts"
                style={{ height: `${height}px` }}
            />
        </div>
    )
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
// AI Message Bubble
// ---------------------------------------------------------------------------

function AiMessageBubble({
    msg,
    onInsertBlocks,
    onCopy
}: {
    msg: { id: string; role: string; content: string; timestamp: number; isError?: boolean }
    onInsertBlocks: (blocks: Block[]) => void
    onCopy: (content: string) => void
}): JSX.Element {
    const parsed = useMemo(() => {
        if (msg.role !== 'assistant' || msg.isError) return null
        return parseAiResponse(msg.content)
    }, [msg.role, msg.content, msg.isError])

    const hasBlocks = parsed?.blocks && parsed.blocks.length > 0

    // Build display text: use AI's text if available, otherwise auto-generate a summary
    const displayText = useMemo(() => {
        if (msg.role === 'user' || msg.isError) return msg.content
        if (!parsed) return msg.content
        if (parsed.text) return parsed.text
        // Fallback: auto-generate summary when the AI sent only JSON
        if (hasBlocks && parsed.blocks) {
            const types = [...new Set(parsed.blocks.map((b) => b.type))]
            const typeList = types.slice(0, 4).join(', ') + (types.length > 4 ? '…' : '')
            return `Generated ${parsed.blocks.length} block${parsed.blocks.length > 1 ? 's' : ''}: ${typeList}. Click "Insert" to add ${parsed.blocks.length > 1 ? 'them' : 'it'} to your page.`
        }
        return msg.content
    }, [msg.role, msg.content, msg.isError, parsed, hasBlocks])

    const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
    const getBlockById = useEditorStore((s) => s.getBlockById)

    // Determine insert target label
    const insertTargetLabel = useMemo(() => {
        if (!selectedBlockId) return 'page root'
        const block = getBlockById(selectedBlockId)
        if (!block) return 'page root'
        const label = (block.props?.text as string) || block.type
        return label.length > 20 ? label.slice(0, 20) + '…' : label
    }, [selectedBlockId, getBlockById])

    return (
        <div className={`ai-message ${msg.role} ${msg.isError ? 'error' : ''}`}>
            {/* Text content */}
            {displayText && (
                <div className="ai-message-content">{displayText}</div>
            )}

            {/* Live preview for block responses */}
            {hasBlocks && parsed?.blocks && (
                <BlockPreview blocks={parsed.blocks} />
            )}

            {/* Timestamp */}
            <div className="ai-message-time">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                })}
            </div>

            {/* Action buttons */}
            {msg.role === 'assistant' && !msg.isError && (
                <div className="ai-message-actions">
                    {hasBlocks && parsed?.blocks && (
                        <button
                            className="ai-action-btn ai-action-insert"
                            onClick={() => onInsertBlocks(parsed.blocks!)}
                            title={`Insert into ${insertTargetLabel}`}
                        >
                            <ArrowDownToLine size={12} /> Insert into {insertTargetLabel}
                        </button>
                    )}
                    <button
                        className="ai-action-btn"
                        onClick={() => onCopy(msg.content)}
                        title="Copy response"
                    >
                        <Copy size={12} /> Copy
                    </button>
                </div>
            )}
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
    const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
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

    const handleInsertBlocks = (blocks: Block[]) => {
        // Insert into selected container, or at page root
        const parentId = selectedBlockId || null
        for (const block of blocks) {
            addBlock(block, parentId)
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
                            <AiMessageBubble
                                key={msg.id}
                                msg={msg}
                                onInsertBlocks={handleInsertBlocks}
                                onCopy={handleCopy}
                            />
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
