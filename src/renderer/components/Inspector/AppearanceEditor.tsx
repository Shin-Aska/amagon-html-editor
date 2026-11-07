import type {Block} from '../../store/types'

interface Props {
    styles: Record<string, string>
    onChange: (key: string, value: string | undefined) => void
}

const themeColors = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'text-muted', 'border', 'success', 'warning', 'danger'];

export function ThemeColorEditor({styles, onChange}: Props): JSX.Element {
    return <div className="style-editor-section">
        <p className="inspector-field-note">Theme colors follow future theme changes. Choose Custom in Background or Typography for a fixed color.</p>
        {([['color', 'Text color'], ['backgroundColor', 'Fill color'], ['borderColor', 'Border color']] as const).map(([key, label]) =>
            <label key={key} className="inspector-stacked-label">{label}
                <select aria-label={label} className="inspector-select" value={styles[key]?.startsWith('var(--theme-') ? styles[key] : styles[key] ? 'custom' : ''}
                    onChange={event => {if (event.target.value !== 'custom') onChange(key, event.target.value || undefined)}}>
                    <option value="">Inherit</option><option value="custom" disabled>Custom value</option>
                    {themeColors.map(color => <option key={color} value={`var(--theme-${color})`}>{color.replace('-', ' ')}</option>)}
                </select>
            </label>)}
    </div>
}

export function AppearanceEditor({styles, onChange}: Props): JSX.Element {
    return <div className="style-editor-section">
        <label className="inspector-stacked-label">Shadow
            <select aria-label="Shadow" className="inspector-select" value={styles.boxShadow || ''} onChange={e => onChange('boxShadow', e.target.value || undefined)}>
                <option value="">Inherit</option><option value="none">None</option>
                <option value="0 2px 8px rgb(0 0 0 / .12)">Small</option>
                <option value="0 8px 24px rgb(0 0 0 / .14)">Medium</option>
                <option value="0 16px 48px rgb(0 0 0 / .18)">Large</option>
                <option value="inset 0 1px 4px rgb(0 0 0 / .12)">Inset</option>
                {styles.boxShadow && !['none', '0 2px 8px rgb(0 0 0 / .12)', '0 8px 24px rgb(0 0 0 / .14)', '0 16px 48px rgb(0 0 0 / .18)', 'inset 0 1px 4px rgb(0 0 0 / .12)'].includes(styles.boxShadow) && <option value={styles.boxShadow}>Custom</option>}
            </select>
        </label>
        <label className="inspector-stacked-label">Opacity
            <input className="inspector-input" type="number" min="0" max="1" step="0.05" value={styles.opacity ?? ''}
                placeholder="1" onChange={e => onChange('opacity', e.target.value === '' ? undefined : String(Math.min(1, Math.max(0, Number(e.target.value)))))}/>
        </label>
        <label className="inspector-stacked-label">Cursor
            <select aria-label="Cursor" className="inspector-select" value={styles.cursor || ''} onChange={e => onChange('cursor', e.target.value || undefined)}>
                <option value="">Inherit</option>{['auto', 'default', 'pointer', 'text', 'grab', 'not-allowed', 'help'].map(value => <option key={value}>{value}</option>)}
            </select>
        </label>
        <label className="inspector-stacked-label">Background gradient
            <input className="inspector-input" value={styles.backgroundImage?.includes('gradient(') ? styles.backgroundImage : ''}
                placeholder="linear-gradient(135deg, …)" onChange={e => onChange('backgroundImage', e.target.value || undefined)}/>
        </label>
        <p className="inspector-field-note">A gradient replaces the background image. Clear an override to inherit the widget or theme value.</p>
    </div>
}

export function ExtendedLayoutEditor({styles, onChange}: Props): JSX.Element {
    const fields = [['maxWidth', 'Maximum width', 'e.g. 72rem, 100%'], ['maxHeight', 'Maximum height', 'e.g. 80vh'],
        ['left', 'Left offset', 'e.g. 0, 1rem'], ['right', 'Right offset', 'e.g. 0, 1rem']] as const;
    return <div className="style-editor-section">
        {fields.map(([key, label, placeholder]) => <label key={key} className="inspector-stacked-label">{label}
            <input className="inspector-input" value={styles[key] || ''} placeholder={placeholder} onChange={e => onChange(key, e.target.value || undefined)}/>
        </label>)}
        <label className="inspector-stacked-label">Overflow
            <select aria-label="Overflow" className="inspector-select" value={styles.overflow || ''} onChange={e => onChange('overflow', e.target.value || undefined)}>
                <option value="">Inherit</option>{['visible', 'hidden', 'auto', 'scroll', 'clip'].map(value => <option key={value}>{value}</option>)}
            </select>
        </label>
        {styles.display === 'grid' && <>
            <label className="inspector-stacked-label">Grid columns
                <input className="inspector-input" value={styles.gridTemplateColumns || ''} placeholder="repeat(auto-fit, minmax(12rem, 1fr))"
                    onChange={e => onChange('gridTemplateColumns', e.target.value || undefined)}/>
            </label>
            <label className="inspector-stacked-label">Grid gap
                <input className="inspector-input" value={styles.gap || ''} placeholder="1rem" onChange={e => onChange('gap', e.target.value || undefined)}/>
            </label>
            <label className="inspector-stacked-label">Grid item alignment
                <select aria-label="Grid item alignment" className="inspector-select" value={styles.alignItems || ''} onChange={e => onChange('alignItems', e.target.value || undefined)}>
                    <option value="">Inherit</option>{['stretch', 'start', 'center', 'end', 'baseline'].map(value => <option key={value}>{value}</option>)}
                </select>
            </label>
        </>}
    </div>
}

/** These apply to the selected media element; composite widgets use their own media controls. */
export function MediaFitEditor({block, onChange}: {block: Block; onChange: Props['onChange']}): JSX.Element {
    const styles = block.styles;
    return <div className="style-editor-section">
        <label className="inspector-stacked-label">Image fit
            <select aria-label="Image fit" className="inspector-select" value={styles.objectFit || ''} onChange={e => onChange('objectFit', e.target.value || undefined)}>
                <option value="">Inherit</option>{['cover', 'contain', 'fill', 'none', 'scale-down'].map(value => <option key={value}>{value}</option>)}
            </select>
        </label>
        <label className="inspector-stacked-label">Focal point
            <input className="inspector-input" value={styles.objectPosition || ''} placeholder="50% 50%" onChange={e => onChange('objectPosition', e.target.value || undefined)}/>
        </label>
        <label className="inspector-stacked-label">CSS aspect ratio
            <input className="inspector-input" value={styles.aspectRatio || ''} placeholder="16 / 9" onChange={e => onChange('aspectRatio', e.target.value || undefined)}/>
        </label>
    </div>
}
