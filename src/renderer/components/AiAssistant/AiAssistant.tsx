import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Send, Trash2, Sparkles, ArrowDownToLine, Copy, Eye, ZoomIn, ZoomOut } from 'lucide-react'
import { useAiStore } from '../../store/aiStore'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { createBlock, type Block } from '../../store/types'
import { themeToCSS } from '../../store/types'
import { blockToHtml } from '../../utils/blockToHtml'
import { openGlobalSettings } from '../../utils/settingsNavigation'
import { AI_API_KEY_REQUIRED_MESSAGE, useAiAvailability } from '../../hooks/useAiAvailability'
import AiProviderSelector from './AiProviderSelector'
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
    const [zoom, setZoom] = useState(1)
    const [systemUiTheme, setSystemUiTheme] = useState<'light' | 'dark'>(() =>
        document.body.classList.contains('dark') ? 'dark' : 'light'
    )

    const projectTheme = useProjectStore((s) => s.settings.theme)
    const projectThemeVariants = useProjectStore((s) => s.settings.themes)
    const previewMode = projectThemeVariants?.previewMode ?? 'device'
    const previewTheme = previewMode === 'device' ? systemUiTheme : previewMode
    const activeTheme = useMemo(
        () => previewTheme === 'dark'
            ? (projectThemeVariants?.dark ?? projectTheme)
            : (projectThemeVariants?.light ?? projectTheme),
        [previewTheme, projectTheme, projectThemeVariants]
    )
    const themeCss = useMemo(
        () => themeToCSS(activeTheme),
        [activeTheme]
    )

    const html = useMemo(() => blockToHtml(blocks), [blocks])

    const previewDoc = useMemo(() => `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<style id="hoarses-theme-css">
${themeCss}
</style>
<style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: var(--theme-bg);
        font-family: var(--theme-font-family);
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
</html>`, [html, themeCss])

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

    useEffect(() => {
        const syncTheme = () => {
            setSystemUiTheme(document.body.classList.contains('dark') ? 'dark' : 'light')
        }

        syncTheme()

        const observer = new MutationObserver(syncTheme)
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        })

        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        const iframe = iframeRef.current
        const doc = iframe?.contentDocument
        if (!iframe || !doc) return

        doc.documentElement.setAttribute('data-page-theme', previewTheme)
        doc.documentElement.setAttribute('data-bs-theme', previewTheme)
        doc.documentElement.style.colorScheme = previewTheme

        const themeStyle = doc.getElementById('hoarses-theme-css')
        if (themeStyle) {
            themeStyle.textContent = themeCss
        }
    }, [previewTheme, themeCss])

    return (
        <div className="ai-preview-container">
            <div className="ai-preview-label">
                <Eye size={11} />
                <span>Preview</span>
                <div className="ai-preview-zoom">
                    <button
                        className="ai-preview-zoom-btn"
                        onClick={() => setZoom(z => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))}
                        title="Zoom out"
                        disabled={zoom <= 0.25}
                    >
                        <ZoomOut size={10} />
                    </button>
                    <span className="ai-preview-zoom-level">{Math.round(zoom * 100)}%</span>
                    <button
                        className="ai-preview-zoom-btn"
                        onClick={() => setZoom(z => Math.min(2, parseFloat((z + 0.25).toFixed(2))))}
                        title="Zoom in"
                        disabled={zoom >= 2}
                    >
                        <ZoomIn size={10} />
                    </button>
                </div>
            </div>
            <div className="ai-preview-viewport" style={{ height: `${height * zoom}px` }}>
                <iframe
                    ref={iframeRef}
                    className="ai-preview-iframe"
                    key={previewTheme}
                    srcDoc={previewDoc}
                    title="Block Preview"
                    sandbox="allow-scripts"
                    style={{
                        height: `${height}px`,
                        width: `${(1 / zoom) * 100}%`,
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top left',
                    }}
                />
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
            <div className="ai-message-actions">
                {msg.role === 'assistant' && !msg.isError && hasBlocks && parsed?.blocks && (
                    <button
                        className="ai-action-btn ai-action-insert"
                        data-tutorial="ai-insert-blocks-btn"
                        onClick={() => onInsertBlocks(parsed.blocks!)}
                        title={`Insert into ${insertTargetLabel}`}
                    >
                        <ArrowDownToLine size={12} /> Insert into {insertTargetLabel}
                    </button>
                )}
                <button
                    className="ai-action-btn"
                    onClick={() => onCopy(msg.content)}
                    title={msg.role === 'user' ? 'Copy message' : 'Copy response'}
                >
                    <Copy size={12} /> Copy
                </button>
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
    const { messages, isLoading, config, configLoaded, sendMessage, clearChat, loadConfig } = useAiStore()
    const { hasConfiguredAiProvider } = useAiAvailability()
    const addBlock = useEditorStore((s) => s.addBlock)
    const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea based on content
    const adjustTextareaHeight = useCallback(() => {
        const textarea = inputRef.current
        if (!textarea) return
        
        // Reset to auto to get correct scrollHeight
        textarea.style.height = 'auto'
        
        // Set new height (clamped to max-height in CSS: 100px)
        const newHeight = Math.min(textarea.scrollHeight, 100)
        textarea.style.height = `${newHeight}px`
    }, [])

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
        // Reset textarea height after sending
        if (inputRef.current) {
            inputRef.current.style.height = 'auto'
        }
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

    const aiEnabled = hasConfiguredAiProvider

    return (
        <div className={`ai-assistant ${!aiEnabled ? 'is-disabled' : ''}`}>
            {/* Header */}
            <div className="ai-header">
                <div className="ai-header-left">
                    <Sparkles size={14} />
                    <span>AI Assistant</span>
                </div>
                <div className="ai-header-actions">
                    <AiProviderSelector />
                    {messages.length > 0 && (
                        <button
                            className="ai-header-btn"
                            title="Clear chat"
                            onClick={clearChat}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="ai-messages">
                {messages.length === 0 && !isLoading ? (
                    <div className="ai-empty">
                        <div className="ai-empty-icon">
                            <Sparkles size={28} strokeWidth={2.2} />
                        </div>
                        <div className="ai-empty-title">AI Assistant</div>
                        <div className="ai-empty-subtitle">
                            {aiEnabled
                                ? 'Ask me to generate components, edit content, or suggest design improvements.'
                                : AI_API_KEY_REQUIRED_MESSAGE}
                        </div>
                        {!aiEnabled && (
                            <button
                                className="ai-suggestion-btn"
                                onClick={() => openGlobalSettings({ tab: 'keys' })}
                            >
                                Manage API Keys
                            </button>
                        )}
                        {aiEnabled && (
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
                    data-tutorial="ai-input"
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value)
                        // Adjust height on next tick to get correct scrollHeight
                        requestAnimationFrame(adjustTextareaHeight)
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={aiEnabled ? 'Ask the AI to build something...' : AI_API_KEY_REQUIRED_MESSAGE}
                    rows={1}
                    disabled={isLoading || !aiEnabled}
                />
                <button
                    className="ai-send-btn"
                    data-tutorial="ai-send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading || !aiEnabled}
                    title="Send message"
                >
                    <Send size={16} />
                </button>
            </div>
            {!aiEnabled && (
                <div className="ai-disabled-note">
                    <span>{AI_API_KEY_REQUIRED_MESSAGE}</span>
                    <button type="button" className="ai-disabled-link" onClick={() => openGlobalSettings({ tab: 'keys' })}>
                        Open Global Settings
                    </button>
                </div>
            )}
        </div>
    )
}
