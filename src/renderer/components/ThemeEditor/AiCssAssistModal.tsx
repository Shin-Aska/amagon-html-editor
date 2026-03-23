import { useEffect, useMemo, useState } from 'react'
import { getApi } from '../../utils/api'
import type { CssFile, ProjectTheme } from '../../store/types'
import './AiCssAssistModal.css'

type AiCssMode = 'replace' | 'insert'
type AiCssAnchor = 'end_of_file' | 'after_selector' | 'before_selector'

export interface AiCssProposal {
    mode: AiCssMode
    css: string
    explanation: string
    insertHint?: string
    anchor?: AiCssAnchor
    matchText?: string
}

interface AiCssAssistModalProps {
    isOpen: boolean
    file: CssFile | null
    allFileNames: string[]
    theme: ProjectTheme
    prompt: string
    onPromptChange: (value: string) => void
    onClose: () => void
    onProposalGenerated: (proposal: AiCssProposal) => void
}

function buildThemeVariables(theme: ProjectTheme): string {
    const lines: string[] = []

    lines.push(`--theme-primary: ${theme.colors.primary};`)
    lines.push(`--theme-secondary: ${theme.colors.secondary};`)
    lines.push(`--theme-accent: ${theme.colors.accent};`)
    lines.push(`--theme-bg: ${theme.colors.background};`)
    lines.push(`--theme-surface: ${theme.colors.surface};`)
    lines.push(`--theme-text: ${theme.colors.text};`)
    lines.push(`--theme-text-muted: ${theme.colors.textMuted};`)
    lines.push(`--theme-border: ${theme.colors.border};`)
    lines.push(`--theme-success: ${theme.colors.success};`)
    lines.push(`--theme-warning: ${theme.colors.warning};`)
    lines.push(`--theme-danger: ${theme.colors.danger};`)
    lines.push(`--theme-font-family: ${theme.typography.fontFamily};`)
    lines.push(`--theme-heading-font-family: ${theme.typography.headingFontFamily};`)
    lines.push(`--theme-font-size: ${theme.typography.baseFontSize};`)
    lines.push(`--theme-line-height: ${theme.typography.lineHeight};`)
    lines.push(`--theme-heading-line-height: ${theme.typography.headingLineHeight};`)
    lines.push(`--theme-spacing-unit: ${theme.spacing.baseUnit};`)

    const unit = parseFloat(theme.spacing.baseUnit) || 8
    const unitSuffix = theme.spacing.baseUnit.replace(/[\d.]+/, '') || 'px'
    theme.spacing.scale.forEach((mult, index) => {
        lines.push(`--theme-space-${index}: ${mult * unit}${unitSuffix};`)
    })

    lines.push(`--theme-border-radius: ${theme.borders.radius};`)
    lines.push(`--theme-border-width: ${theme.borders.width};`)
    lines.push(`--theme-border-color: ${theme.borders.color};`)

    return lines.join('\n')
}

function extractJsonBlock(content: string): string | null {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
    return match?.[1]?.trim() ?? null
}

function extractJsonObject(content: string): string | null {
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    return content.slice(start, end + 1).trim()
}

function extractCssFromResponse(content: string): string {
    const fenceMatch = content.match(/```(?:css)?\s*([\s\S]*?)```/i)
    if (fenceMatch && fenceMatch[1]) {
        return fenceMatch[1].trim()
    }
    return content.trim()
}

function parseCssProposal(content: string, currentCss: string): AiCssProposal | null {
    const jsonCandidate = extractJsonBlock(content) ?? extractJsonObject(content) ?? content.trim()

    try {
        const parsed = JSON.parse(jsonCandidate) as Partial<AiCssProposal>
        const css = typeof parsed.css === 'string' ? parsed.css.trim() : ''
        if (!css) return null

        return {
            mode: parsed.mode === 'insert' || parsed.mode === 'replace' ? parsed.mode : currentCss.trim() ? 'insert' : 'replace',
            css,
            explanation:
                typeof parsed.explanation === 'string' && parsed.explanation.trim()
                    ? parsed.explanation.trim()
                    : 'AI prepared a CSS proposal.',
            insertHint: typeof parsed.insertHint === 'string' ? parsed.insertHint.trim() : undefined,
            anchor:
                parsed.anchor === 'end_of_file' || parsed.anchor === 'after_selector' || parsed.anchor === 'before_selector'
                    ? parsed.anchor
                    : undefined,
            matchText: typeof parsed.matchText === 'string' ? parsed.matchText.trim() : undefined
        }
    } catch {
        const css = extractCssFromResponse(content)
        if (!css) return null
        return {
            mode: 'replace',
            css,
            explanation: 'AI returned a full CSS replacement.'
        }
    }
}

export default function AiCssAssistModal({
    isOpen,
    file,
    allFileNames,
    theme,
    prompt,
    onPromptChange,
    onClose,
    onProposalGenerated
}: AiCssAssistModalProps): JSX.Element | null {
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const themeVariables = useMemo(() => buildThemeVariables(theme), [theme])

    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    useEffect(() => {
        if (!isOpen) return
        setError(null)
        setIsGenerating(false)
    }, [isOpen, file?.id])

    if (!isOpen || !file) return null

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please describe what you want to build.')
            return
        }

        setIsGenerating(true)
        setError(null)

        try {
            const api = getApi()
            const systemPrompt = `You are an AI assistant embedded in "Amagon", a visual HTML editor.

You help users edit a CSS file safely.
- Prefer targeted insertions when the file already has useful styles.
- Use "replace" only when the request clearly asks for a full rewrite or the file is nearly empty.
- Return ONLY a JSON code block in this shape:
\`\`\`json
{
  "mode": "insert",
  "anchor": "end_of_file",
  "matchText": "",
  "insertHint": "Append this as a new block at the end of the file.",
  "explanation": "Adds a new hover treatment without disturbing existing rules.",
  "css": ".button:hover { transform: translateY(-2px); }"
}
\`\`\`
- The "css" field must contain only valid CSS, with no markdown fences.`

            const userPrompt = `User request:
${prompt.trim()}

Current CSS file (${file.name}):
\`\`\`css
${file.css || '/* empty */'}
\`\`\`

Other CSS files:
${allFileNames.join(', ') || 'None'}

Theme CSS variables (use these when relevant):
${themeVariables}`

            const result = await (api as any).ai.chat({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })

            if (!result.success) {
                setError(result.error || 'AI request failed.')
                setIsGenerating(false)
                return
            }

            const proposal = parseCssProposal(String(result.content || ''), file.css || '')
            if (!proposal) {
                setError('AI response was empty. Try adjusting your request.')
                setIsGenerating(false)
                return
            }

            onProposalGenerated(proposal)
            onClose()
        } catch (err: any) {
            setError(err?.message || 'AI request failed.')
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="ai-css-assist-overlay" onClick={onClose}>
            <div className="ai-css-assist-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="ai-css-assist-header">
                    <div>
                        <div className="ai-css-assist-title">Assist with AI ✨</div>
                        <div className="ai-css-assist-subtitle">{file.name}</div>
                    </div>
                    <button className="ai-css-assist-close" onClick={onClose} aria-label="Close">×</button>
                </div>

                <div className="ai-css-assist-body">
                    <label className="ai-css-assist-label">Describe the CSS you want</label>
                    <textarea
                        className="ai-css-assist-textarea"
                        placeholder="E.g. Create a glassmorphism card style for .pricing-card"
                        value={prompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                    />

                    {error && <div className="ai-css-assist-error">{error}</div>}
                </div>

                <div className="ai-css-assist-footer">
                    <button className="theme-btn" onClick={onClose}>Cancel</button>
                    <button
                        className="theme-btn theme-btn-primary"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                    >
                        {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>
        </div>
    )
}
