import { useEffect, useMemo, useState } from 'react'
import { getApi } from '../../utils/api'
import type { CssFile, ProjectTheme } from '../../store/types'
import './AiCssAssistModal.css'

interface AiCssAssistModalProps {
    isOpen: boolean
    file: CssFile | null
    allFileNames: string[]
    theme: ProjectTheme
    onClose: () => void
    onApplyReplace: (css: string) => void
    onApplyAppend: (css: string) => void
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

function extractCssFromResponse(content: string): string {
    const fenceMatch = content.match(/```(?:css)?\s*([\s\S]*?)```/i)
    if (fenceMatch && fenceMatch[1]) {
        return fenceMatch[1].trim()
    }
    return content.trim()
}

export default function AiCssAssistModal({
    isOpen,
    file,
    allFileNames,
    theme,
    onClose,
    onApplyReplace,
    onApplyAppend
}: AiCssAssistModalProps): JSX.Element | null {
    const [prompt, setPrompt] = useState('')
    const [generatedCss, setGeneratedCss] = useState('')
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
        if (isOpen) {
            setPrompt('')
            setGeneratedCss('')
            setError(null)
        }
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
            const systemPrompt = `You are an AI assistant embedded in "Amagon", a visual HTML editor.\n\nYou help users write CSS that complements the existing project styles.\nReturn ONLY valid CSS. Do not include JSON or explanations. A \`\`\`css\`\`\` code fence is allowed, but do not include any extra text.`

            const userPrompt = `User request:\n${prompt.trim()}\n\nCurrent CSS file (${file.name}):\n\`\`\`css\n${file.css || '/* empty */'}\n\`\`\`\n\nOther CSS files:\n${allFileNames.join(', ') || 'None'}\n\nTheme CSS variables (use these when relevant):\n${themeVariables}`

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

            const css = extractCssFromResponse(result.content || '')
            if (!css) {
                setError('AI response was empty. Try adjusting your request.')
                setIsGenerating(false)
                return
            }

            setGeneratedCss(css)
        } catch (err: any) {
            setError(err?.message || 'AI request failed.')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleApplyReplace = () => {
        if (!generatedCss.trim()) return
        onApplyReplace(generatedCss)
        onClose()
    }

    const handleApplyAppend = () => {
        if (!generatedCss.trim()) return
        onApplyAppend(generatedCss)
        onClose()
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
                        onChange={(e) => setPrompt(e.target.value)}
                    />

                    <div className="ai-css-assist-actions">
                        <button
                            className="theme-btn theme-btn-primary"
                            onClick={handleGenerate}
                            disabled={isGenerating}
                        >
                            {isGenerating ? 'Generating...' : 'Generate'}
                        </button>
                        {error && <span className="ai-css-assist-error">{error}</span>}
                    </div>

                    <label className="ai-css-assist-label">AI Output</label>
                    <pre className="ai-css-assist-preview">
                        {generatedCss || 'AI-generated CSS will appear here.'}
                    </pre>
                </div>

                <div className="ai-css-assist-footer">
                    <button className="theme-btn" onClick={onClose}>Cancel</button>
                    <div className="ai-css-assist-footer-actions">
                        <button
                            className="theme-btn"
                            onClick={handleApplyAppend}
                            disabled={!generatedCss.trim()}
                        >
                            Append
                        </button>
                        <button
                            className="theme-btn theme-btn-primary"
                            onClick={handleApplyReplace}
                            disabled={!generatedCss.trim()}
                        >
                            Apply
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
