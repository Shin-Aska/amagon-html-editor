import { useCallback, useEffect, useMemo, useState } from 'react'
import { getApi } from '../../utils/api'
import type { Block } from '../../store/types'
import { AI_API_KEY_REQUIRED_MESSAGE, useAiAvailability } from '../../hooks/useAiAvailability'
import { openGlobalSettings } from '../../utils/settingsNavigation'
import AiProviderSelector from '../AiAssistant/AiProviderSelector'
import './AiCodeAssistModal.css'

type AiEditMode = 'insert' | 'replace_selection' | 'replace_all'
type AiAnchorType = 'after_line_containing' | 'before_line_containing' | 'inside_function_start' | 'inside_function_end'

export interface AiCodeSelection {
    text: string
    startLineNumber: number
    endLineNumber: number
}

export interface AiCodeProposal {
    mode: AiEditMode
    code: string
    explanation: string
    insertHint?: string
    matchText?: string
    anchor?: AiAnchorType
}

interface AiCodeAssistModalProps {
    isOpen: boolean
    eventName: string
    block: Block | null
    currentCode: string
    selection: AiCodeSelection | null
    requestText: string
    onRequestTextChange: (value: string) => void
    onProposalGenerated: (proposal: AiCodeProposal) => void
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

function stripFence(text: string, language: string): string | null {
    const match = text.match(new RegExp(String.raw`(?:\`\`\`${language}|\`\`\`)\s*([\s\S]*?)\`\`\``, 'i'))
    return match ? match[1].trim() : null
}

function extractJsonBlock(text: string): string | null {
    return stripFence(text, 'json')
}

function extractCodeBlock(text: string): string {
    return stripFence(text, 'javascript') ?? stripFence(text, 'js') ?? stripFence(text, '') ?? text.trim()
}

function indentLines(text: string, spaces: number): string {
    const pad = ' '.repeat(spaces)
    return text
        .split('\n')
        .map((line) => (line.trim().length ? pad + line : line))
        .join('\n')
}

function normalizeSnippet(code: string): string {
    return code.trim().replace(/^\s*```(?:javascript|js)?/i, '').replace(/```\s*$/i, '').trim()
}

function normalizeToIife(code: string): string {
    const trimmed = code.trim()
    if (trimmed.includes('(function') && trimmed.includes('.call(this, event)')) return trimmed
    return `(function(event) {\n${indentLines(trimmed || '// Your code here', 2)}\n}).call(this, event)`
}

function looksLikeHandlerSkeleton(code: string): boolean {
    const trimmed = code.trim()
    if (!trimmed) return true
    return /\/\/\s*Your code here/.test(trimmed) || /\/\/\s*Runs when/.test(trimmed)
}

function parseAiProposal(text: string, currentCode: string, selection: AiCodeSelection | null): AiCodeProposal | null {
    const jsonCandidate = extractJsonBlock(text) ?? text.trim()

    try {
        const parsed = JSON.parse(jsonCandidate) as Partial<AiCodeProposal>
        const rawCode = typeof parsed.code === 'string' ? normalizeSnippet(parsed.code) : ''
        if (!rawCode) return null

        const requestedMode = parsed.mode
        const fallbackMode: AiEditMode = selection?.text.trim()
            ? 'replace_selection'
            : looksLikeHandlerSkeleton(currentCode)
              ? 'replace_all'
              : 'insert'

        return {
            mode:
                requestedMode === 'insert' || requestedMode === 'replace_selection' || requestedMode === 'replace_all'
                    ? requestedMode
                    : fallbackMode,
            code: rawCode,
            explanation:
                typeof parsed.explanation === 'string' && parsed.explanation.trim()
                    ? parsed.explanation.trim()
                    : 'AI suggested a targeted update.',
            insertHint: typeof parsed.insertHint === 'string' ? parsed.insertHint.trim() : undefined,
            matchText: typeof parsed.matchText === 'string' ? parsed.matchText.trim() : undefined,
            anchor:
                parsed.anchor === 'after_line_containing' ||
                parsed.anchor === 'before_line_containing' ||
                parsed.anchor === 'inside_function_start' ||
                parsed.anchor === 'inside_function_end'
                    ? parsed.anchor
                    : undefined
        }
    } catch {
        const extracted = extractCodeBlock(text)
        const normalized = normalizeToIife(extracted)
        return {
            mode: 'replace_all',
            code: normalized,
            explanation: 'AI returned a full handler, so this will replace the current script.'
        }
    }
}

function buildEventCodeSystemPrompt(args: {
    eventName: string
    block: Block | null
    currentCode: string
    selection: AiCodeSelection | null
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
    const selectionSummary = args.selection
        ? {
              startLineNumber: args.selection.startLineNumber,
              endLineNumber: args.selection.endLineNumber,
              text: args.selection.text
          }
        : null

    return `You are an AI assistant helping edit JavaScript event handler code in an HTML editor.

## Runtime contract
- The handler runs in this exact IIFE pattern:
\`\`\`js
(function(event) {
  // ...
}).call(this, event)
\`\`\`
- \`this\` is the DOM element the event handler is attached to.
- \`event\` is the browser event for "${args.eventName}".

## Block context
\`\`\`json
${blockJson}
\`\`\`

## Current handler
\`\`\`js
${currentCode || '// (empty)'}
\`\`\`

## Current editor selection
\`\`\`json
${truncateJson(selectionSummary, 2000) || 'null'}
\`\`\`

## Your task
- Prefer a targeted snippet edit over replacing the full handler.
- Use \`replace_selection\` when the selection is relevant and non-empty.
- Use \`insert\` when adding logic into existing code without removing the rest.
- Use \`replace_all\` only when the handler is empty, placeholder-only, or the request clearly needs a full rewrite.
- For \`insert\`, provide an anchor and optional \`matchText\` when possible.
- Return JavaScript only in the \`code\` field, not wrapped in markdown fences.
- If using \`replace_all\`, return the full IIFE in \`code\`.
- If using \`insert\` or \`replace_selection\`, return only the snippet to add or swap.

## Output format
Return ONLY a JSON code block in this shape:
\`\`\`json
{
  "mode": "insert",
  "anchor": "inside_function_end",
  "matchText": "",
  "insertHint": "Add this before the handler closes.",
  "explanation": "Appends a class toggle and keeps existing logic intact.",
  "code": "this.classList.toggle('is-active');"
}
\`\`\`
`
}

export default function AiCodeAssistModal({
    isOpen,
    eventName,
    block,
    currentCode,
    selection,
    requestText,
    onRequestTextChange,
    onProposalGenerated,
    onClose
}: AiCodeAssistModalProps): JSX.Element | null {
    const { hasConfiguredAiProvider } = useAiAvailability()
    const [isGenerating, setIsGenerating] = useState(false)
    const [proposal, setProposal] = useState<AiCodeProposal | null>(null)
    const [error, setError] = useState<string | null>(null)

    const systemPrompt = useMemo(
        () => buildEventCodeSystemPrompt({ eventName, block, currentCode, selection }),
        [eventName, block, currentCode, selection]
    )

    useEffect(() => {
        if (!isOpen) return
        setError(null)
        setIsGenerating(false)
        setProposal(null)
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
        setProposal(null)

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
            const nextProposal = parseAiProposal(raw, currentCode, selection)
            if (!nextProposal) {
                setError('AI response did not include a usable code proposal.')
                return
            }
            setProposal(nextProposal)
            onProposalGenerated(nextProposal)
            onClose()
        } catch (err: any) {
            setError(err?.message || 'AI request failed.')
        } finally {
            setIsGenerating(false)
        }
    }, [currentCode, eventName, onClose, onProposalGenerated, requestText, selection, systemPrompt])

    if (!isOpen) return null

    return (
        <div className="ai-code-assist-panel">
            <div className="ai-code-assist-header">
                <h4>AI Assist: {eventName}</h4>
                <div className="ai-code-assist-header-right">
                    <AiProviderSelector />
                    <button className="ai-code-assist-close" onClick={onClose} title="Close">
                        ×
                    </button>
                </div>
            </div>

            <div className="ai-code-assist-body">
                <label className="ai-code-assist-label">
                    Describe what you want this event handler to do
                </label>
                <textarea
                    className="ai-code-assist-textarea"
                    value={requestText}
                    onChange={(e) => onRequestTextChange(e.target.value)}
                    placeholder='Example: "Add a guard clause for disabled buttons, then toggle an active class."'
                    rows={4}
                    disabled={isGenerating || !hasConfiguredAiProvider}
                />

                {!hasConfiguredAiProvider && (
                    <div className="ai-code-assist-selection-note">
                        <span>{AI_API_KEY_REQUIRED_MESSAGE}</span>
                        {' '}
                        <button
                            type="button"
                            className="ai-code-assist-inline-link"
                            onClick={() => openGlobalSettings({ tab: 'keys' })}
                        >
                            Open Global Settings
                        </button>
                    </div>
                )}

                {selection?.text.trim() && (
                    <div className="ai-code-assist-selection-note">
                        Selection detected on lines {selection.startLineNumber}-{selection.endLineNumber}. AI can target that block directly.
                    </div>
                )}

                {error && <div className="ai-code-assist-error">{error}</div>}

                {proposal && (
                    <div className="ai-code-assist-summary">
                        <span className="ai-code-assist-badge">{proposal.mode.replace('_', ' ')}</span>
                        <span>{proposal.explanation}</span>
                    </div>
                )}
            </div>

            <div className="ai-code-assist-footer">
                <button
                    className="ai-code-assist-btn primary"
                    onClick={handleGenerate}
                    disabled={isGenerating || !hasConfiguredAiProvider}
                >
                    {isGenerating ? 'Generating…' : 'Generate'}
                </button>
            </div>
        </div>
    )
}
