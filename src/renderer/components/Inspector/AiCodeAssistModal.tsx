import { useCallback, useEffect, useMemo, useState } from 'react'
import { getApi } from '../../utils/api'
import type { Block } from '../../store/types'
import './AiCodeAssistModal.css'

interface AiCodeAssistModalProps {
    isOpen: boolean
    eventName: string
    block: Block | null
    currentCode: string
    onApply: (nextCode: string, mode?: 'replace' | 'insert') => void
    onClose: () => void
}

function truncateJson(value: unknown, maxLen: number): string {
    try {
        const raw = JSON.stringify(value, null, 2)
        if (raw.length <= maxLen) return raw
        return raw.slice(0, maxLen) + '\n…(truncated)…'
    } catch {
        return ''
    }
}

function extractCodeBlock(text: string): string {
    const match = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i)
    if (match) return match[1].trim()
    return text.trim()
}

function indentLines(text: string, spaces: number): string {
    const pad = ' '.repeat(spaces)
    return text
        .split('\n')
        .map((line) => (line.trim().length ? pad + line : line))
        .join('\n')
}

function normalizeToIife(code: string): string {
    const trimmed = code.trim()
    if (trimmed.includes('(function') && trimmed.includes('.call(this, event)')) return trimmed
    return `(function(event) {\n${indentLines(trimmed || '// Your code here', 2)}\n}).call(this, event)`
}

function buildEventCodeSystemPrompt(args: {
    eventName: string
    block: Block | null
    currentCode: string
}): string {
    const blockSummary = args.block
        ? {
              id: args.block.id,
              type: args.block.type,
              tag: args.block.tag,
              classes: args.block.classes,
              props: args.block.props,
              childCount: Array.isArray(args.block.children) ? args.block.children.length : 0,
              children: (args.block.children || []).slice(0, 12).map((c) => ({
                  type: c.type,
                  tag: c.tag,
                  classes: c.classes
              }))
          }
        : null

    const blockJson = blockSummary ? truncateJson(blockSummary, 4500) : '(unknown block)'
    const currentCode = args.currentCode ? args.currentCode.trim() : ''

    return `You are an AI assistant helping generate JavaScript event handler code in an HTML editor.

## Runtime contract
- The code MUST be a JavaScript snippet in this exact IIFE pattern:
\`\`\`js
(function(event) {
  // ...
}).call(this, event)
\`\`\`
- \`this\` is the DOM element the event handler is attached to.
- \`event\` is the browser event (MouseEvent, KeyboardEvent, etc.) for "${args.eventName}".

## Block context (semantic reference only)
\`\`\`json
${blockJson}
\`\`\`

## Existing editor code (replace it with an improved version)
\`\`\`js
${currentCode || '// (empty)'}
\`\`\`

## Output rules
- Return ONLY a single JavaScript code block (\`\`\`js ... \`\`\`) containing the full replacement code.
- No markdown outside the code block. No explanations.`
}

export default function AiCodeAssistModal({
    isOpen,
    eventName,
    block,
    currentCode,
    onApply,
    onClose
}: AiCodeAssistModalProps): JSX.Element | null {
    const [requestText, setRequestText] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedCode, setGeneratedCode] = useState('')
    const [error, setError] = useState<string | null>(null)

    const systemPrompt = useMemo(
        () => buildEventCodeSystemPrompt({ eventName, block, currentCode }),
        [eventName, block, currentCode]
    )

    useEffect(() => {
        if (!isOpen) return
        setError(null)
        setIsGenerating(false)
        setGeneratedCode('')
        setRequestText('')
    }, [isOpen, eventName])

    useEffect(() => {
        if (!isOpen) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [isOpen, onClose])

    const handleGenerate = useCallback(async () => {
        const prompt = requestText.trim()
        if (!prompt) {
            setError('Describe what you want the event to do.')
            return
        }

        setIsGenerating(true)
        setError(null)
        setGeneratedCode('')

        try {
            const api = getApi()
            const result = await (api as any).ai.chat({
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: `Event: ${eventName}\nRequest: ${prompt}`
                    }
                ]
            })

            if (!result?.success) {
                setError(result?.error || 'AI request failed.')
                setIsGenerating(false)
                return
            }

            const raw = String(result.content || '')
            const extracted = extractCodeBlock(raw)
            const normalized = normalizeToIife(extracted)
            setGeneratedCode(normalized)
        } catch (err: any) {
            setError(err?.message || 'AI request failed.')
        } finally {
            setIsGenerating(false)
        }
    }, [eventName, requestText, systemPrompt])

    const handleApplyReplace = useCallback(() => {
        if (!generatedCode.trim()) return
        onApply(generatedCode, 'replace')
    }, [generatedCode, onApply])

    const handleApplyInsert = useCallback(() => {
        if (!generatedCode.trim()) return
        onApply(generatedCode, 'insert')
    }, [generatedCode, onApply])

    if (!isOpen) return null

    return (
        <div className="ai-code-assist-overlay" onClick={onClose}>
            <div className="ai-code-assist-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ai-code-assist-header">
                    <h4>AI Assist: {eventName}</h4>
                    <button className="ai-code-assist-close" onClick={onClose} title="Close">
                        ×
                    </button>
                </div>

                <div className="ai-code-assist-body">
                    <label className="ai-code-assist-label">
                        Describe what you want this event handler to do
                    </label>
                    <textarea
                        className="ai-code-assist-textarea"
                        value={requestText}
                        onChange={(e) => setRequestText(e.target.value)}
                        placeholder='Example: "Toggle an active class, and prevent default if a link."'
                        rows={4}
                        disabled={isGenerating}
                    />

                    {error && <div className="ai-code-assist-error">{error}</div>}

                    <div className="ai-code-assist-preview-header">
                        <span>Generated code preview</span>
                    </div>
                    <pre className="ai-code-assist-preview">{generatedCode || '(nothing yet)'}</pre>
                </div>

                <div className="ai-code-assist-footer">
                    <button className="ai-code-assist-btn secondary" onClick={onClose} disabled={isGenerating}>
                        Cancel
                    </button>
                    <button className="ai-code-assist-btn" onClick={handleGenerate} disabled={isGenerating}>
                        {isGenerating ? 'Generating…' : 'Generate'}
                    </button>
                    <button
                        className="ai-code-assist-btn primary"
                        onClick={handleApplyReplace}
                        disabled={isGenerating || !generatedCode.trim()}
                        title="Replace the editor contents"
                    >
                        Apply
                    </button>
                    <button
                        className="ai-code-assist-btn"
                        onClick={handleApplyInsert}
                        disabled={isGenerating || !generatedCode.trim()}
                        title="Insert at cursor in the editor"
                    >
                        Insert
                    </button>
                </div>
            </div>
        </div>
    )
}

