import {useState, type KeyboardEvent} from 'react'
import './StyleEditor.css'
import FontPickerField from './FontPickerField'
import type {BlockAnimation, BlockHoverEffect, HoverEffectPreset} from '../../store/types'
import {
    clampDelayMs,
    clampDurationMs,
    EASING_OPTIONS,
    normalizeEasing,
    PRESET_LABELS,
    PRESETS
} from '../../utils/animationPresets'
import {HOVER_EFFECT_LABELS, HOVER_EFFECT_PRESETS} from '../../utils/hoverEffects'

interface StyleEditorProps {
    styles: Record<string, string>
    onChange: (key: string, value: string | undefined) => void
}

const SIZE_UNITS = ['px', 'pt', 'rem', 'em', '%', 'vw', 'vh'] as const;

function isSimpleMeasurement(val?: string): boolean {
    if (!val) return true;
    return /^[\d.]+\s*(px|pt|rem|em|%|vw|vh)$/.test(val)
}

function parseMeasurement(val?: string): { num: string; unit: string } {
    if (!val) return {num: '', unit: 'rem'};
    const match = val.match(/^([\d.]+)\s*(px|pt|rem|em|%|vw|vh)$/);
    if (match) return {num: match[1], unit: match[2]};
    return {num: val.replace(/\D/g, '') || '', unit: 'rem'}
}

export function TypographyEditor({styles, onChange}: StyleEditorProps): JSX.Element {
    const [fontSizeMode, setFontSizeMode] = useState<'simple' | 'complex'>(() =>
        isSimpleMeasurement(styles.fontSize) ? 'simple' : 'complex'
    );

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const {name, value} = e.target;
        onChange(name, value || undefined)
    };

    const fontSizeParsed = parseMeasurement(styles.fontSize);

    const handleFontSizeNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const num = e.target.value;
        if (!num) {
            onChange('fontSize', undefined);
            return
        }
        onChange('fontSize', `${num}${fontSizeParsed.unit}`)
    };

    const handleFontSizeUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const unit = e.target.value;
        if (!fontSizeParsed.num) {
            onChange('fontSize', undefined);
            return
        }
        onChange('fontSize', `${fontSizeParsed.num}${unit}`)
    };

    return (
        <div className="style-editor-section">
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Font Family</label>
                        <span
                            className="style-info-btn"
                            title="Select a preset font, type a custom font name, or enter a full CSS font stack."
                        >?</span>
                    </div>
                    <FontPickerField
                        value={styles.fontFamily || ''}
                        onChange={(v) => onChange('fontFamily', v || undefined)}
                    />
                </div>
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Size</label>
                        <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <span
                  className="style-info-btn"
                  title="Switch between simple number+unit or advanced CSS values like clamp()."
              >?</span>
                            <div className="style-mode-toggle">
                                <button
                                    type="button"
                                    className={`style-mode-btn ${fontSizeMode === 'simple' ? 'active' : ''}`}
                                    onClick={() => setFontSizeMode('simple')}
                                    title="Simple value"
                                >
                                    123
                                </button>
                                <button
                                    type="button"
                                    className={`style-mode-btn ${fontSizeMode === 'complex' ? 'active' : ''}`}
                                    onClick={() => setFontSizeMode('complex')}
                                    title="CSS value"
                                >
                                    {'{}'}
                                </button>
                            </div>
                        </div>
                    </div>
                    {fontSizeMode === 'simple' ? (
                        <div className="style-measurement-group">
                            <input
                                className="inspector-input"
                                type="number"
                                step="0.1"
                                value={fontSizeParsed.num}
                                onChange={handleFontSizeNumChange}
                                placeholder="1"
                            />
                            <select className="inspector-select" value={fontSizeParsed.unit}
                                    onChange={handleFontSizeUnitChange}>
                                {SIZE_UNITS.map((u) => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                            <input
                                className="inspector-input"
                                type="text"
                                value={styles.fontSize || ''}
                                onChange={(e) => onChange('fontSize', e.target.value || undefined)}
                                placeholder="e.g. 1rem, 16px, clamp(2.5rem, 5vw, 4rem)"
                            />
                    )}
                </div>
            </div>
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Weight</label>
                        <span
                            className="style-info-btn"
                            title="Font weight from 100 (thin) to 900 (black). Leave empty to inherit."
                        >?</span>
                    </div>
                    <select className="inspector-select" name="fontWeight" value={styles.fontWeight || ''}
                            onChange={handleChange}>
                        <option value="">Default</option>
                        <option value="100">100 - Thin</option>
                        <option value="200">200 - Extra Light</option>
                        <option value="300">300 - Light</option>
                        <option value="400">400 - Normal</option>
                        <option value="500">500 - Medium</option>
                        <option value="600">600 - Semi Bold</option>
                        <option value="700">700 - Bold</option>
                        <option value="800">800 - Extra Bold</option>
                        <option value="900">900 - Black</option>
                    </select>
                </div>
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Line Height</label>
                        <span
                            className="style-info-btn"
                            title="Space between lines. Use unitless (1.5) or any supported CSS unit."
                        >?</span>
                    </div>
                    <input className="inspector-input" type="text" name="lineHeight" value={styles.lineHeight || ''}
                           onChange={handleChange} placeholder="e.g. 1.5, 1.5rem, 24px"/>
                </div>
            </div>
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Letter Spacing</label>
                        <span
                            className="style-info-btn"
                            title="Space between characters. Positive values spread text apart."
                        >?</span>
                    </div>
                    <input className="inspector-input" type="text" name="letterSpacing"
                           value={styles.letterSpacing || ''} onChange={handleChange} placeholder="e.g. 0.1em, 1px"/>
                </div>
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Color</label>
                        <span
                            className="style-info-btn"
                            title="Text color in hex (#rrggbb) or named color format."
                        >?</span>
                    </div>
                    <div className="color-picker-wrapper">
                        <input type="color" name="color" value={styles.color || '#000000'} onChange={handleChange}/>
                        <input type="text" className="inspector-input color-hex-input" name="color"
                               value={styles.color || ''} onChange={handleChange} placeholder="#000000"/>
                    </div>
                </div>
            </div>
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Align</label>
                        <span
                            className="style-info-btn"
                            title="Horizontal text alignment within the element."
                        >?</span>
                    </div>
                    <div className="button-group">
                        {['left', 'center', 'right', 'justify'].map(align => (
                            <button
                                key={align}
                                className={`btn-toggle ${styles.textAlign === align ? 'active' : ''}`}
                                onClick={() => onChange('textAlign', styles.textAlign === align ? undefined : align)}
                                title={`Align ${align}`}
                            >
                                {align.charAt(0).toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export function BackgroundEditor({styles, onChange}: StyleEditorProps): JSX.Element {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const {name, value} = e.target;
        onChange(name, value || undefined)
    };

    return (
        <div className="style-editor-section">
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Color</label>
                        <span className="style-info-btn"
                              title="Background color in hex (#rrggbb) or named color format.">?</span>
                    </div>
                    <div className="color-picker-wrapper">
                        <input type="color" name="backgroundColor" value={styles.backgroundColor || '#ffffff'}
                               onChange={handleChange}/>
                        <input type="text" className="inspector-input color-hex-input" name="backgroundColor"
                               value={styles.backgroundColor || ''} onChange={handleChange} placeholder="transparent"/>
                    </div>
                </div>
            </div>
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Image URL</label>
                        <span className="style-info-btn"
                              title="URL to a background image. The image will be wrapped in url() automatically.">?</span>
                    </div>
                    <input className="inspector-input" type="text" name="backgroundImage"
                           value={styles.backgroundImage?.replace(/url\(['"]?(.*?)['"]?\)/, '$1') || ''}
                           onChange={(e) => onChange('backgroundImage', e.target.value ? `url('${e.target.value}')` : undefined)}
                           placeholder="e.g. https://..."/>
                </div>
            </div>
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Size</label>
                        <span className="style-info-btn"
                              title="How the background image is sized within the element.">?</span>
                    </div>
                    <select className="inspector-select" name="backgroundSize" value={styles.backgroundSize || ''}
                            onChange={handleChange}>
                        <option value="">Default</option>
                        <option value="cover">Cover</option>
                        <option value="contain">Contain</option>
                        <option value="100% 100%">100% 100%</option>
                        <option value="auto">Auto</option>
                    </select>
                </div>
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Position</label>
                        <span className="style-info-btn" title="Starting position of the background image.">?</span>
                    </div>
                    <select className="inspector-select" name="backgroundPosition"
                            value={styles.backgroundPosition || ''} onChange={handleChange}>
                        <option value="">Default</option>
                        <option value="center">Center</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                    </select>
                </div>
            </div>
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Repeat</label>
                        <span className="style-info-btn"
                              title="Whether the background image tiles or appears once.">?</span>
                    </div>
                    <select className="inspector-select" name="backgroundRepeat" value={styles.backgroundRepeat || ''}
                            onChange={handleChange}>
                        <option value="">Default</option>
                        <option value="no-repeat">No Repeat</option>
                        <option value="repeat">Repeat</option>
                        <option value="repeat-x">Repeat X</option>
                        <option value="repeat-y">Repeat Y</option>
                    </select>
                </div>
            </div>
        </div>
    )
}

export function BorderEditor({styles, onChange}: StyleEditorProps): JSX.Element {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const {name, value} = e.target;
        onChange(name, value || undefined)
    };

    return (
        <div className="style-editor-section">
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Radius</label>
                        <span className="style-info-btn"
                              title="Corner roundness. Use px for fixed or % for elliptical corners.">?</span>
                    </div>
                    <input className="inspector-input" type="text" name="borderRadius" value={styles.borderRadius || ''}
                           onChange={handleChange} placeholder="e.g. 4px, 50%"/>
                </div>
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Width</label>
                        <span className="style-info-btn" title="Thickness of the element border on all sides.">?</span>
                    </div>
                    <input className="inspector-input" type="text" name="borderWidth" value={styles.borderWidth || ''}
                           onChange={handleChange} placeholder="e.g. 1px"/>
                </div>
            </div>
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Style</label>
                        <span className="style-info-btn" title="Visual style of the border line.">?</span>
                    </div>
                    <select className="inspector-select" name="borderStyle" value={styles.borderStyle || ''}
                            onChange={handleChange}>
                        <option value="">Default (none)</option>
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                    </select>
                </div>
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Color</label>
                        <span className="style-info-btn"
                              title="Border color in hex (#rrggbb) or named color format.">?</span>
                    </div>
                    <div className="color-picker-wrapper">
                        <input type="color" name="borderColor" value={styles.borderColor || '#000000'}
                               onChange={handleChange}/>
                        <input type="text" className="inspector-input color-hex-input" name="borderColor"
                               value={styles.borderColor || ''} onChange={handleChange} placeholder="#000000"/>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function LayoutEditor({styles, onChange}: StyleEditorProps): JSX.Element {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const {name, value} = e.target;
        onChange(name, value || undefined)
    };

    return (
        <div className="style-editor-section">
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Display</label>
                        <span className="style-info-btn"
                              title="CSS display mode. Flex enables the flexbox controls below.">?</span>
                    </div>
                    <select className="inspector-select" name="display" value={styles.display || ''}
                            onChange={handleChange}>
                        <option value="">Default</option>
                        <option value="block">Block</option>
                        <option value="inline-block">Inline Block</option>
                        <option value="flex">Flex</option>
                        <option value="grid">Grid</option>
                        <option value="none">None</option>
                    </select>
                </div>
            </div>
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Position</label>
                        <span className="style-info-btn"
                              title="How the element is positioned in the document. Relative/absolute/fixed require top/bottom/left/right.">?</span>
                    </div>
                    <select className="inspector-select" name="position" value={styles.position || ''}
                            onChange={handleChange}>
                        <option value="">Default</option>
                        <option value="static">Static</option>
                        <option value="relative">Relative</option>
                        <option value="absolute">Absolute</option>
                        <option value="fixed">Fixed</option>
                        <option value="sticky">Sticky</option>
                    </select>
                </div>
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Z-Index</label>
                        <span className="style-info-btn"
                              title="Stacking order. Higher values appear above lower ones. Only works on positioned elements.">?</span>
                    </div>
                    <input className="inspector-input" type="text" name="zIndex" value={styles.zIndex || ''}
                           onChange={handleChange} placeholder="e.g. 10, 1030"/>
                </div>
            </div>
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Top</label>
                        <span className="style-info-btn"
                              title="Offset from the top edge. Only applies to relative, absolute, fixed, or sticky positioning.">?</span>
                    </div>
                    <input className="inspector-input" type="text" name="top" value={styles.top || ''}
                           onChange={handleChange} placeholder="e.g. 0, 1rem"/>
                </div>
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Bottom</label>
                        <span className="style-info-btn"
                              title="Offset from the bottom edge. Only applies to relative, absolute, fixed, or sticky positioning.">?</span>
                    </div>
                    <input className="inspector-input" type="text" name="bottom" value={styles.bottom || ''}
                           onChange={handleChange} placeholder="e.g. 0, 1rem"/>
                </div>
            </div>

            {styles.display === 'flex' && (
                <>
                    <div className="style-row">
                        <div className="style-col">
                            <div className="style-label-row">
                                <label className="style-label">Flex Direction</label>
                                <span className="style-info-btn" title="Main axis direction for flex children.">?</span>
                            </div>
                            <select className="inspector-select" name="flexDirection" value={styles.flexDirection || ''}
                                    onChange={handleChange}>
                                <option value="">Default (row)</option>
                                <option value="row">Row</option>
                                <option value="column">Column</option>
                                <option value="row-reverse">Row Reverse</option>
                                <option value="column-reverse">Column Reverse</option>
                            </select>
                        </div>
                        <div className="style-col">
                            <div className="style-label-row">
                                <label className="style-label">Flex Wrap</label>
                                <span className="style-info-btn"
                                      title="Whether flex children wrap onto multiple lines when they overflow.">?</span>
                            </div>
                            <select className="inspector-select" name="flexWrap" value={styles.flexWrap || ''}
                                    onChange={handleChange}>
                                <option value="">Default (nowrap)</option>
                                <option value="nowrap">No Wrap</option>
                                <option value="wrap">Wrap</option>
                                <option value="wrap-reverse">Wrap Reverse</option>
                            </select>
                        </div>
                    </div>
                    <div className="style-row">
                        <div className="style-col">
                            <div className="style-label-row">
                                <label className="style-label">Justify Content</label>
                                <span className="style-info-btn"
                                      title="Alignment along the main axis (horizontal in row, vertical in column).">?</span>
                            </div>
                            <select className="inspector-select" name="justifyContent"
                                    value={styles.justifyContent || ''} onChange={handleChange}>
                                <option value="">Default (flex-start)</option>
                                <option value="flex-start">Flex Start</option>
                                <option value="center">Center</option>
                                <option value="flex-end">Flex End</option>
                                <option value="space-between">Space Between</option>
                                <option value="space-around">Space Around</option>
                                <option value="space-evenly">Space Evenly</option>
                            </select>
                        </div>
                    </div>
                    <div className="style-row">
                        <div className="style-col">
                            <div className="style-label-row">
                                <label className="style-label">Align Items</label>
                                <span className="style-info-btn"
                                      title="Alignment along the cross axis (vertical in row, horizontal in column).">?</span>
                            </div>
                            <select className="inspector-select" name="alignItems" value={styles.alignItems || ''}
                                    onChange={handleChange}>
                                <option value="">Default (stretch)</option>
                                <option value="flex-start">Flex Start</option>
                                <option value="center">Center</option>
                                <option value="flex-end">Flex End</option>
                                <option value="baseline">Baseline</option>
                            </select>
                        </div>
                        <div className="style-col">
                            <div className="style-label-row">
                                <label className="style-label">Gap</label>
                                <span className="style-info-btn" title="Space between flex children.">?</span>
                            </div>
                            <input className="inspector-input" type="text" name="gap" value={styles.gap || ''}
                                   onChange={handleChange} placeholder="e.g. 16px, 1rem"/>
                        </div>
                    </div>
                </>
            )}

            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Width</label>
                        <span className="style-info-btn"
                              title="Element width. Use % for responsive or px for fixed.">?</span>
                    </div>
                    <input className="inspector-input" type="text" name="width" value={styles.width || ''}
                           onChange={handleChange} placeholder="e.g. 100%, 200px"/>
                </div>
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Height</label>
                        <span className="style-info-btn"
                              title="Element height. Use auto to let content decide.">?</span>
                    </div>
                    <input className="inspector-input" type="text" name="height" value={styles.height || ''}
                           onChange={handleChange} placeholder="e.g. auto, 100vh"/>
                </div>
            </div>
            <div className="style-row">
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Min Width</label>
                        <span className="style-info-btn" title="Minimum width the element can shrink to.">?</span>
                    </div>
                    <input className="inspector-input" type="text" name="minWidth" value={styles.minWidth || ''}
                           onChange={handleChange}/>
                </div>
                <div className="style-col">
                    <div className="style-label-row">
                        <label className="style-label">Min Height</label>
                        <span className="style-info-btn" title="Minimum height the element can shrink to.">?</span>
                    </div>
                    <input className="inspector-input" type="text" name="minHeight" value={styles.minHeight || ''}
                           onChange={handleChange}/>
                </div>
            </div>
        </div>
    )
}

interface AnimationEditorProps {
    animation?: BlockAnimation
    eligible: boolean
    onChange: (animation?: BlockAnimation) => void
}

export function AnimationEditor({animation, eligible, onChange}: AnimationEditorProps): JSX.Element {
    const selectedPreset = animation?.preset;

    const handleSelectPreset = (preset: string) => {
        if (!eligible) return;
        if (preset === '' || preset === 'none') {
            onChange(undefined);
            return
        }
        const p = preset as BlockAnimation['preset'];
        onChange({
            preset: p,
            durationMs: clampDurationMs(animation?.durationMs),
            delayMs: clampDelayMs(animation?.delayMs),
            easing: normalizeEasing(animation?.easing)
        })
    };

    const handleDurationChange = (value: string) => {
        if (!animation || !eligible) return;
        const num = Number(value);
        onChange({
            ...animation,
            durationMs: Number.isFinite(num) ? clampDurationMs(num) : clampDurationMs(undefined)
        })
    };

    const handleDelayChange = (value: string) => {
        if (!animation || !eligible) return;
        const num = Number(value);
        onChange({
            ...animation,
            delayMs: Number.isFinite(num) ? clampDelayMs(num) : clampDelayMs(undefined)
        })
    };

    const handleEasingChange = (value: string) => {
        if (!animation || !eligible) return;
        onChange({
            ...animation,
            easing: normalizeEasing(value)
        })
    };

    const clear = () => onChange(undefined);

    const handlePresetKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                ? -1
                : 0;
        if (direction === 0) return;

        const group = event.currentTarget.closest('[role="radiogroup"]');
        const radios = Array.from(group?.querySelectorAll<HTMLInputElement>('input[name="animation-preset"]') ?? []);
        const currentIndex = radios.indexOf(event.currentTarget);
        if (currentIndex === -1 || radios.length === 0) return;

        event.preventDefault();
        const next = radios[(currentIndex + direction + radios.length) % radios.length];
        next.focus();
        next.click()
    };

    if (!eligible) {
        return (
            <div className="style-editor-section">
                <p className="animation-ineligible-note">
                    This element type does not support entrance animations.
                </p>
            </div>
        )
    }

    return (
        <div className="style-editor-section">
            <div className="style-label-row" id="animation-preset-label">
                <label className="style-label">Entrance preset</label>
                <span
                    className="style-info-btn"
                    title="Pick a friendly entrance animation. Animations run once when the page loads."
                >?</span>
            </div>
            <div
                className="animation-preset-grid"
                role="radiogroup"
                aria-labelledby="animation-preset-label"
            >
                <label
                    className={`animation-preset-btn ${!selectedPreset ? 'active' : ''}`}
                >
                    <input
                        type="radio"
                        name="animation-preset"
                        value=""
                        checked={!selectedPreset}
                        onChange={() => handleSelectPreset('none')}
                        onKeyDown={handlePresetKeyDown}
                        className="sr-only"
                    />
                    None
                </label>
                {PRESETS.map((preset) => (
                    <label
                        key={preset}
                        className={`animation-preset-btn ${selectedPreset === preset ? 'active' : ''}`}
                    >
                        <input
                            type="radio"
                            name="animation-preset"
                            value={preset}
                            checked={selectedPreset === preset}
                            onChange={() => handleSelectPreset(preset)}
                            onKeyDown={handlePresetKeyDown}
                            className="sr-only"
                        />
                        {PRESET_LABELS[preset]}
                    </label>
                ))}
            </div>

            {selectedPreset && (
                <>
                    <div className="style-row">
                        <div className="style-col">
                            <div className="style-label-row">
                                <label className="style-label" htmlFor="animation-duration">
                                    Duration (ms)
                                </label>
                            </div>
                            <input
                                id="animation-duration"
                                className="inspector-input"
                                type="number"
                                min={100}
                                max={3000}
                                step={50}
                                value={animation?.durationMs ?? 600}
                                onChange={(e) => handleDurationChange(e.target.value)}
                            />
                        </div>
                        <div className="style-col">
                            <div className="style-label-row">
                                <label className="style-label" htmlFor="animation-delay">
                                    Delay (ms)
                                </label>
                            </div>
                            <input
                                id="animation-delay"
                                className="inspector-input"
                                type="number"
                                min={0}
                                max={2000}
                                step={50}
                                value={animation?.delayMs ?? 0}
                                onChange={(e) => handleDelayChange(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="style-row">
                        <div className="style-col">
                            <div className="style-label-row">
                                <label className="style-label" htmlFor="animation-easing">
                                    Easing
                                </label>
                            </div>
                            <select
                                id="animation-easing"
                                className="inspector-select"
                                value={animation?.easing ?? 'ease-out'}
                                onChange={(e) => handleEasingChange(e.target.value)}
                            >
                                {EASING_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="style-row">
                        <button
                            type="button"
                            className="animation-clear-btn"
                            onClick={clear}
                        >
                            Clear animation
                        </button>
                    </div>
                </>
            )}

            <p className="animation-reduced-motion-note">
                Respects prefers-reduced-motion automatically.
            </p>
        </div>
    )
}

interface HoverEffectEditorProps {
    hoverEffect?: BlockHoverEffect
    eligible: boolean
    onChange: (hoverEffect?: BlockHoverEffect) => void
}

export function HoverEffectEditor({hoverEffect, eligible, onChange}: HoverEffectEditorProps): JSX.Element {
    const selectedPreset = hoverEffect?.preset;

    const handleSelectPreset = (preset: HoverEffectPreset | 'none') => {
        if (!eligible) return;
        onChange(preset === 'none' ? undefined : {preset})
    };

    const handlePresetKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                ? -1
                : 0;
        if (direction === 0) return;

        const group = event.currentTarget.closest('[role="radiogroup"]');
        const radios = Array.from(group?.querySelectorAll<HTMLInputElement>('input[name="hover-effect-preset"]') ?? []);
        const currentIndex = radios.indexOf(event.currentTarget);
        if (currentIndex === -1 || radios.length === 0) return;

        event.preventDefault();
        const next = radios[(currentIndex + direction + radios.length) % radios.length];
        next.focus();
        next.click()
    };

    if (!eligible) {
        return (
            <div className="style-editor-section">
                <p className="hover-effect-ineligible-note">
                    This element type does not support hover effects.
                </p>
            </div>
        )
    }

    return (
        <div className="style-editor-section">
            <div className="style-label-row" id="hover-effect-preset-label">
                <label className="style-label">Hover preset</label>
                <span
                    className="style-info-btn"
                    title="Pick optional hover feedback for interactive and media widgets."
                >?</span>
            </div>
            <div
                className="hover-effect-preset-grid"
                role="radiogroup"
                aria-labelledby="hover-effect-preset-label"
            >
                <label
                    className={`hover-effect-preset-btn ${!selectedPreset ? 'active' : ''}`}
                >
                    <input
                        type="radio"
                        name="hover-effect-preset"
                        value=""
                        checked={!selectedPreset}
                        onChange={() => handleSelectPreset('none')}
                        onKeyDown={handlePresetKeyDown}
                        className="sr-only"
                    />
                    None
                </label>
                {HOVER_EFFECT_PRESETS.map((preset) => (
                    <label
                        key={preset}
                        className={`hover-effect-preset-btn ${selectedPreset === preset ? 'active' : ''}`}
                    >
                        <input
                            type="radio"
                            name="hover-effect-preset"
                            value={preset}
                            checked={selectedPreset === preset}
                            onChange={() => handleSelectPreset(preset)}
                            onKeyDown={handlePresetKeyDown}
                            className="sr-only"
                        />
                        {HOVER_EFFECT_LABELS[preset]}
                    </label>
                ))}
            </div>

            {selectedPreset && (
                <div className="style-row">
                    <button
                        type="button"
                        className="hover-effect-clear-btn"
                        onClick={() => onChange(undefined)}
                    >
                        Clear hover effect
                    </button>
                </div>
            )}

            <p className="hover-effect-reduced-motion-note">
                Applies on hover-capable pointers and respects reduced motion.
            </p>
        </div>
    )
}
