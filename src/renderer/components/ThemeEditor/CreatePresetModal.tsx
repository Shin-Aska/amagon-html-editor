import {useEffect, useMemo, useState} from 'react'
import {Loader2, Sparkles} from 'lucide-react'
import type {ProjectTheme, ThemeColors} from '../../store/types'
import {AI_API_KEY_REQUIRED_MESSAGE, useAiAvailability} from '../../hooks/useAiAvailability'
import {openGlobalSettings} from '../../utils/settingsNavigation'
import {getApi} from '../../utils/api'
import ColorField from './ColorField'
import './CreatePresetModal.css'

const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
    {key: 'primary', label: 'Primary'},
    {key: 'secondary', label: 'Secondary'},
    {key: 'accent', label: 'Accent'},
    {key: 'background', label: 'Background'},
    {key: 'surface', label: 'Surface'},
    {key: 'text', label: 'Text'},
    {key: 'textMuted', label: 'Text Muted'},
    {key: 'border', label: 'Border'},
    {key: 'success', label: 'Success'},
    {key: 'warning', label: 'Warning'},
    {key: 'danger', label: 'Danger'}
];

function safeJson(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2)
    } catch {
        return '{}'
    }
}

function isValidHexColor(value: unknown): value is string {
    return typeof value === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
}

function parseThemeColorsFromAi(content: string): ThemeColors | null {
    const candidates: string[] = [];
    const fencedBlocks = content.match(/```(?:json)?\s*([\s\S]*?)```/gi) ?? [];

    for (const block of fencedBlocks) {
        const match = block.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (match?.[1]) candidates.push(match[1].trim())
    }
    candidates.push(content.trim());

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate) as Record<string, unknown>;
            const hasAll = COLOR_FIELDS.every(({key}) => isValidHexColor(parsed[key]));
            if (!hasAll) continue;

            return {
                primary: parsed.primary as string,
                secondary: parsed.secondary as string,
                accent: parsed.accent as string,
                background: parsed.background as string,
                surface: parsed.surface as string,
                text: parsed.text as string,
                textMuted: parsed.textMuted as string,
                border: parsed.border as string,
                success: parsed.success as string,
                warning: parsed.warning as string,
                danger: parsed.danger as string
            }
        } catch {
            // Continue to next candidate
        }
    }

    return null
}

function buildColorGenerationSystemPrompt(theme: ProjectTheme): string {
    return `You generate color palettes for a ThemeColors object.
Return ONLY valid JSON in a markdown \`\`\`json code block.
Use exactly these keys:
- primary
- secondary
- accent
- background
- surface
- text
- textMuted
- border
- success
- warning
- danger

Rules:
- Every value must be a valid hex color string (#RRGGBB or #RGB).
- Include all keys exactly once.
- Keep contrast and readability in mind.
- Keep the palette coherent with the provided theme context.
- Do not include explanations outside the JSON block.

Current theme context:
\`\`\`json
${safeJson(theme)}
\`\`\``
}

export default function CreatePresetModal({
                                              isOpen,
                                              initialTheme,
                                              onClose,
                                              onCreate
                                          }: {
    isOpen: boolean
    initialTheme: ProjectTheme
    onClose: () => void
    onCreate: (name: string, colors: ThemeColors) => void
}): JSX.Element | null {
    const {hasConfiguredAiProvider} = useAiAvailability();
    const [name, setName] = useState('');
    const [aiDescription, setAiDescription] = useState('');
    const [colors, setColors] = useState<ThemeColors>(initialTheme.colors);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAiPreviewing, setIsAiPreviewing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setName('');
        setAiDescription('');
        setColors(initialTheme.colors);
        setError(null);
        setIsGenerating(false);
        setIsAiPreviewing(false)
    }, [initialTheme.colors, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            onClose()
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isAiPreviewing) return;
        const timer = window.setTimeout(() => setIsAiPreviewing(false), 900);
        return () => window.clearTimeout(timer)
    }, [isAiPreviewing]);

    const previewColors = useMemo(
        () => COLOR_FIELDS.map(({key, label}) => ({key, label, value: colors[key]})),
        [colors]
    );

    if (!isOpen) return null;

    const generateWithAi = async () => {
        const prompt = aiDescription.trim();
        if (!prompt) {
            setError('Describe your desired color scheme first.');
            return
        }

        setError(null);
        setIsGenerating(true);
        try {
            const api = getApi();
            const system = buildColorGenerationSystemPrompt(initialTheme);
            const userContent = [
                `User goal: ${prompt}`,
                '',
                'Current selected colors (for refinement context):',
                '```json',
                safeJson(colors),
                '```'
            ].join('\n');

            const result = await api.ai.chat({
                messages: [
                    {role: 'system', content: system},
                    {role: 'user', content: userContent}
                ]
            });

            if (!result.success || typeof result.content !== 'string') {
                throw new Error(result.error || 'AI generation failed.')
            }

            const parsed = parseThemeColorsFromAi(result.content);
            if (!parsed) {
                throw new Error('AI response did not include a valid ThemeColors JSON block.')
            }

            setColors(parsed);
            setIsAiPreviewing(true)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to generate colors.';
            setError(message)
        } finally {
            setIsGenerating(false)
        }
    };

    const handleCreate = () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Preset name is required.');
            return
        }
        onCreate(trimmed, colors);
        onClose()
    };

    return (
        <div className="create-preset-overlay" onClick={onClose}>
            <div className="create-preset-dialog" data-tutorial="create-preset-dialog"
                 onClick={(e) => e.stopPropagation()}>
                <div className="create-preset-header">
                    <h3>Create Theme Preset</h3>
                </div>

                <div className="create-preset-body">
                    <div className={`create-preset-ai-card ${!hasConfiguredAiProvider ? 'is-disabled' : ''}`}>
                        <label className="theme-field-label" htmlFor="create-preset-ai-description">
                            Describe your desired color scheme
                        </label>
                        <div className="create-preset-ai-row">
              <textarea
                  id="create-preset-ai-description"
                  className="create-preset-ai-textarea"
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder="Describe your desired color scheme (e.g., Ocean breeze, Cyberpunk, Soft pastel)..."
                  rows={3}
                  disabled={!hasConfiguredAiProvider || isGenerating}
              />
                            <button
                                className="theme-btn theme-btn-primary create-preset-generate-btn"
                                onClick={generateWithAi}
                                disabled={isGenerating || !hasConfiguredAiProvider}
                            >
                                {isGenerating ? <Loader2 size={14} className="create-preset-spin"/> :
                                    <Sparkles size={14}/>}
                                {isGenerating ? 'Generating...' : 'Generate Colors'}
                            </button>
                        </div>
                        <p className="create-preset-helper">
                            {hasConfiguredAiProvider
                                ? 'Generate a palette, then fine-tune any color below before saving.'
                                : AI_API_KEY_REQUIRED_MESSAGE}
                        </p>
                        {!hasConfiguredAiProvider && (
                            <button
                                type="button"
                                className="create-preset-settings-link"
                                onClick={() => openGlobalSettings({tab: 'keys'})}
                            >
                                Open Global Settings
                            </button>
                        )}
                    </div>

                    <div className="create-preset-divider"/>

                    <div className={`create-preset-manual ${isAiPreviewing ? 'is-ai-updated' : ''}`}>
                        <div className="theme-color-grid">
                            {COLOR_FIELDS.map(({key, label}) => (
                                <ColorField
                                    key={key}
                                    label={label}
                                    value={colors[key]}
                                    onChange={(value) => setColors((prev) => ({...prev, [key]: value}))}
                                />
                            ))}
                        </div>

                        <div className="create-preset-preview" aria-label="Color preview strip">
                            {previewColors.map(({key, label, value}) => (
                                <div
                                    key={key}
                                    className="create-preset-preview-swatch"
                                    title={`${label}: ${value}`}
                                    style={{backgroundColor: value}}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="theme-field">
                        <label className="theme-field-label">Preset Name</label>
                        <input
                            className="theme-field-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My preset name"
                            autoFocus
                        />
                    </div>

                    {error && <div className="create-preset-error">{error}</div>}
                </div>

                <div className="create-preset-footer">
                    <button className="theme-btn" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="theme-btn theme-btn-primary"
                        onClick={handleCreate}
                        disabled={!name.trim()}
                    >
                        Save Preset
                    </button>
                </div>
            </div>
        </div>
    )
}
