import {useEffect, useMemo, useState} from 'react'
import {getApi} from '../../utils/api'
import type {CssFile, ProjectTheme} from '../../store/types'
import {AI_API_KEY_REQUIRED_MESSAGE, useAiAvailability} from '../../hooks/useAiAvailability'
import {openGlobalSettings} from '../../utils/settingsNavigation'
import {useAiStore} from '../../store/aiStore'
import AiProviderSelector from '../AiAssistant/AiProviderSelector'
import './AiCssAssistModal.css'
import {Sparkles} from 'lucide-react'

type AiCssMode = 'replace' | 'insert' | 'replace_match' | 'delete_match'
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
    const lines: string[] = [];

    lines.push(`--theme-primary: ${theme.colors.primary};`);
    lines.push(`--theme-secondary: ${theme.colors.secondary};`);
    lines.push(`--theme-accent: ${theme.colors.accent};`);
    lines.push(`--theme-bg: ${theme.colors.background};`);
    lines.push(`--theme-surface: ${theme.colors.surface};`);
    lines.push(`--theme-text: ${theme.colors.text};`);
    lines.push(`--theme-text-muted: ${theme.colors.textMuted};`);
    lines.push(`--theme-border: ${theme.colors.border};`);
    lines.push(`--theme-success: ${theme.colors.success};`);
    lines.push(`--theme-warning: ${theme.colors.warning};`);
    lines.push(`--theme-danger: ${theme.colors.danger};`);
    lines.push(`--theme-font-family: ${theme.typography.fontFamily};`);
    lines.push(`--theme-heading-font-family: ${theme.typography.headingFontFamily};`);
    lines.push(`--theme-font-size: ${theme.typography.baseFontSize};`);
    lines.push(`--theme-line-height: ${theme.typography.lineHeight};`);
    lines.push(`--theme-heading-line-height: ${theme.typography.headingLineHeight};`);
    lines.push(`--theme-spacing-unit: ${theme.spacing.baseUnit};`);

    const unit = parseFloat(theme.spacing.baseUnit) || 8;
    const unitSuffix = theme.spacing.baseUnit.replace(/[\d.]+/, '') || 'px';
    theme.spacing.scale.forEach((mult, index) => {
        lines.push(`--theme-space-${index}: ${mult * unit}${unitSuffix};`)
    });

    lines.push(`--theme-border-radius: ${theme.borders.radius};`);
    lines.push(`--theme-border-width: ${theme.borders.width};`);
    lines.push(`--theme-border-color: ${theme.borders.color};`);

    return lines.join('\n')
}

function extractJsonBlock(content: string): string | null {
    const match = content.match(/```json\s*([\s\S]*?)```/i);
    return match?.[1]?.trim() ?? null
}

function extractJsonObject(content: string): string | null {
    const start = content.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < content.length; index += 1) {
        const ch = content[index];
        if (escaped) {
            escaped = false;
            continue
        }
        if (inString) {
            if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue
        }
        if (ch === '"') {
            inString = true;
            continue
        }
        if (ch === '{') depth += 1;
        else if (ch === '}') {
            depth -= 1;
            if (depth === 0) return content.slice(start, index + 1).trim()
        }
    }

    return null
}

// Escape literal newlines/tabs inside JSON string values so JSON.parse can handle them.
// LLMs often emit multi-line CSS inside a JSON string without proper \n escaping.
function repairJson(json: string): string {
    let inStr = false, escaped = false, out = '';
    for (const ch of json) {
        if (escaped) {
            out += ch;
            escaped = false
        } else if (ch === '\\' && inStr) {
            out += ch;
            escaped = true
        } else if (ch === '"') {
            out += ch;
            inStr = !inStr
        } else if (inStr && ch === '\n') {
            out += '\\n'
        } else if (inStr && ch === '\r') {
            out += '\\r'
        } else {
            out += ch
        }
    }
    return out
}

// Only match ```css fences or bare ``` fences — never ```json or other language fences.
function extractCssFromResponse(content: string): string | null {
    const cssMatch = content.match(/```css\s*\n([\s\S]*?)```/i);
    if (cssMatch?.[1]) return cssMatch[1].trim();
    const bareMatch = content.match(/```\n([\s\S]*?)```/);
    if (bareMatch?.[1]) return bareMatch[1].trim();
    return null
}

function buildProposalFromParsed(
    parsed: Partial<AiCssProposal>,
    currentCss: string,
    cssOverride?: string
): AiCssProposal | null {
    const rawCss = typeof cssOverride === 'string' ? cssOverride.trim() : typeof parsed.css === 'string' ? parsed.css.trim() : '';
    // Strip any accidental fences the AI embedded inside the css field value
    const css = extractCssFromResponse(rawCss) ?? rawCss;
    const requestedMode = parsed.mode;
    if (!css && requestedMode !== 'delete_match') return null;
    return {
        mode:
            requestedMode === 'insert' ||
            requestedMode === 'replace' ||
            requestedMode === 'replace_match' ||
            requestedMode === 'delete_match'
                ? requestedMode
                : currentCss.trim()
                    ? 'insert'
                    : 'replace',
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
}

function decodeJsonLikeString(value: string): string {
    return value
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
}

function extractJsonLikeStringField(jsonLike: string, fieldName: string): string | null {
    const keyMatch = new RegExp(`"${fieldName}"\\s*:\\s*"`, 'm').exec(jsonLike);
    if (!keyMatch) return null;

    let value = '';
    let escaped = false;
    let index = keyMatch.index + keyMatch[0].length;

    while (index < jsonLike.length) {
        const ch = jsonLike[index];
        if (escaped) {
            value += ch;
            escaped = false;
            index += 1;
            continue
        }
        if (ch === '\\') {
            value += ch;
            escaped = true;
            index += 1;
            continue
        }
        if (ch === '"') {
            const remainder = jsonLike.slice(index + 1);
            if (/^\s*[,}]/.test(remainder)) {
                return decodeJsonLikeString(value).trim()
            }
        }
        value += ch;
        index += 1
    }

    return null
}

// When JSON.parse fails entirely, extract the "css" and "mode" fields via regex.
// Handles unescaped quotes/backslashes that repairJson cannot fix.
function extractCssFieldFromJsonLike(jsonLike: string): { css: string; mode: AiCssMode | null } | null {
    const css = extractJsonLikeStringField(jsonLike, 'css');
    if (!css) return null;
    const modeMatch = jsonLike.match(/"mode"\s*:\s*"(insert|replace|replace_match|delete_match)"/);
    return {css, mode: (modeMatch?.[1] as AiCssMode) ?? null}
}

export function parseCssProposal(content: string, currentCss: string): AiCssProposal | null {
    const fencedCss = extractCssFromResponse(content);
    const jsonCandidate = extractJsonBlock(content) ?? extractJsonObject(content) ?? content.trim();

    if (fencedCss) {
        for (const candidate of [jsonCandidate, repairJson(jsonCandidate)]) {
            try {
                const parsed = JSON.parse(candidate) as Partial<AiCssProposal>;
                const proposal = buildProposalFromParsed(parsed, currentCss, fencedCss);
                if (proposal) return proposal
            } catch {
                // continue to older fallbacks
            }
        }
    }

    // Attempt 1: direct parse. Attempt 2: repair literal newlines in string values.
    for (const candidate of [jsonCandidate, repairJson(jsonCandidate)]) {
        try {
            const parsed = JSON.parse(candidate) as Partial<AiCssProposal>;
            const proposal = buildProposalFromParsed(parsed, currentCss);
            if (proposal) return proposal
        } catch {
            // try next candidate
        }
    }

    // Attempt 3: regex-extract the css field when JSON is completely unparseable
    // (e.g. unescaped quotes inside CSS string values like content: "text")
    const jsonLike = extractJsonBlock(content) ?? extractJsonObject(content);
    if (jsonLike) {
        const rescued = extractCssFieldFromJsonLike(jsonLike);
        if (rescued?.css) {
            return {
                mode: rescued.mode ?? (currentCss.trim() ? 'insert' : 'replace'),
                css: rescued.css,
                explanation: 'AI prepared a CSS proposal.'
            }
        }
    }

    // Last resort: look for an explicit ```css block in the response
    const css = extractCssFromResponse(content);
    if (!css) return null;
    return {
        mode: currentCss.trim() ? 'insert' : 'replace',
        css,
        explanation: currentCss.trim()
            ? 'AI returned CSS without a structured response — appending to existing styles.'
            : 'AI returned a full CSS replacement.'
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
    const {hasConfiguredAiProvider} = useAiAvailability();
    const modelsLoaded = useAiStore((s) => s.modelsLoaded);
    const configLoaded = useAiStore((s) => s.configLoaded);
    const isReady = configLoaded && modelsLoaded;
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const themeVariables = useMemo(() => buildThemeVariables(theme), [theme]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setIsGenerating(false)
    }, [isOpen, file?.id]);

    if (!isOpen || !file) return null;

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please describe what you want to build.');
            return
        }

        setIsGenerating(true);
        setError(null);

        try {
            const api = getApi();
            const systemPrompt = `You are an AI assistant embedded in "Amagon", a visual HTML editor.

You help users edit a CSS file safely.
- Inspect the current CSS carefully before proposing changes.
- Prefer targeted edits to existing rules when the request asks to change or remove something already in the file.
- Use "insert" only when adding new CSS that does not replace existing blocks.
- Use "replace_match" when modifying an existing selector or block.
- Use "delete_match" when removing an existing selector or block.
- Use "replace" only when the request clearly asks for a full rewrite or the file is nearly empty.
- Return ONLY two code blocks in this exact order:
\`\`\`json
{
  "mode": "replace_match",
  "anchor": "end_of_file",
  "matchText": ".button:hover",
  "insertHint": "Replaces the existing hover rule.",
  "explanation": "Updates the existing hover treatment instead of appending a duplicate block."
}
\`\`\`
\`\`\`css
.button:hover { transform: translateY(-2px); }
\`\`\`
- Put metadata in the JSON block and put the stylesheet only in the CSS block.
- Do not include a "css" property in the JSON.
- Do not include any prose before, between, or after the two blocks.
- The CSS block must contain only valid CSS, with no JSON escaping and no markdown inside it.
- For "replace", return the full replacement stylesheet in the CSS block.
- For "insert", return only the CSS snippet to add.
- For "replace_match", set "matchText" to the exact selector or a unique snippet from the current CSS that should be replaced, and return the replacement CSS block in the CSS block.
- For "delete_match", set "matchText" to the exact selector or a unique snippet from the current CSS that should be removed. Return an empty CSS block for deletions when no replacement text is needed.
- When the user asks to remove or change something that already exists, do not choose "insert" unless you are intentionally adding a separate new rule.`;

            const userPrompt = `User request:
${prompt.trim()}

Current CSS file (${file.name}):
\`\`\`css
${file.css || '/* empty */'}
\`\`\`

Other CSS files:
${allFileNames.join(', ') || 'None'}

Theme CSS variables (use these when relevant):
${themeVariables}`;

            const result = await (api as any).ai.chat({
                messages: [
                    {role: 'system', content: systemPrompt},
                    {role: 'user', content: userPrompt}
                ]
            });

            if (!result.success) {
                setError(result.error || 'AI request failed.');
                setIsGenerating(false);
                return
            }

            const proposal = parseCssProposal(String(result.content || ''), file.css || '');
            if (!proposal) {
                setError('AI response was empty. Try adjusting your request.');
                setIsGenerating(false);
                return
            }

            onProposalGenerated(proposal);
            onClose()
        } catch (err: any) {
            setError(err?.message || 'AI request failed.')
        } finally {
            setIsGenerating(false)
        }
    };

    return (
        <div className="ai-css-assist-overlay" onClick={onClose}>
            <div className="ai-css-assist-dialog" data-tutorial="ai-css-assist-dialog"
                 onClick={(e) => e.stopPropagation()}>
                <div className="ai-css-assist-header">
                    <div>
                        <div className="ai-css-assist-title">Assist with AI <Sparkles size={14}/></div>
                        <div className="ai-css-assist-subtitle">{file.name}</div>
                    </div>
                    <AiProviderSelector/>
                    <button className="ai-css-assist-close" onClick={onClose} aria-label="Close">×</button>
                </div>

                <div className="ai-css-assist-body">
                    <label className="ai-css-assist-label">Describe the CSS you want</label>
                    <textarea
                        className="ai-css-assist-textarea"
                        placeholder="E.g. Create a glassmorphism card style for .pricing-card"
                        value={prompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                        disabled={!hasConfiguredAiProvider || isGenerating || !isReady}
                    />

                    {error && <div className="ai-css-assist-error">{error}</div>}
                    {!hasConfiguredAiProvider && (
                        <div className="ai-css-assist-disabled-note">
                            <span>{AI_API_KEY_REQUIRED_MESSAGE}</span>
                            <button type="button" onClick={() => openGlobalSettings({tab: 'keys'})}>
                                Open Global Settings
                            </button>
                        </div>
                    )}
                </div>

                <div className="ai-css-assist-footer">
                    <button className="theme-btn" onClick={onClose}>Cancel</button>
                    <button
                        className="theme-btn theme-btn-primary"
                        onClick={handleGenerate}
                        disabled={isGenerating || !hasConfiguredAiProvider || !isReady}
                    >
                        {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>
        </div>
    )
}
