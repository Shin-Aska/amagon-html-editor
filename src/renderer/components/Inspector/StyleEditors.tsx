import { useState } from 'react'
import './StyleEditor.css'
import FontPickerField from './FontPickerField'

interface StyleEditorProps {
  styles: Record<string, string>
  onChange: (key: string, value: string | undefined) => void
}

const SIZE_UNITS = ['px', 'pt', 'rem', 'em', '%', 'vw', 'vh'] as const

function isSimpleMeasurement(val?: string): boolean {
  if (!val) return true
  return /^[\d.]+\s*(px|pt|rem|em|%|vw|vh)$/.test(val)
}

function parseMeasurement(val?: string): { num: string; unit: string } {
  if (!val) return { num: '', unit: 'px' }
  const match = val.match(/^([\d.]+)\s*(px|pt|rem|em|%|vw|vh)$/)
  if (match) return { num: match[1], unit: match[2] }
  return { num: val.replace(/\D/g, '') || '', unit: 'px' }
}

export function TypographyEditor({ styles, onChange }: StyleEditorProps): JSX.Element {
  const [fontSizeMode, setFontSizeMode] = useState<'simple' | 'complex'>(() =>
    isSimpleMeasurement(styles.fontSize) ? 'simple' : 'complex'
  )

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target
    onChange(name, value || undefined)
  }

  const fontSizeParsed = parseMeasurement(styles.fontSize)

  const handleFontSizeNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = e.target.value
    if (!num) {
      onChange('fontSize', undefined)
      return
    }
    onChange('fontSize', `${num}${fontSizeParsed.unit}`)
  }

  const handleFontSizeUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const unit = e.target.value
    if (!fontSizeParsed.num) {
      onChange('fontSize', undefined)
      return
    }
    onChange('fontSize', `${fontSizeParsed.num}${unit}`)
  }

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
          {fontSizeMode === 'simple' ? (
            <div className="style-measurement-group">
              <input
                className="inspector-input"
                type="number"
                step="0.1"
                value={fontSizeParsed.num}
                onChange={handleFontSizeNumChange}
                placeholder="16"
              />
              <select className="inspector-select" value={fontSizeParsed.unit} onChange={handleFontSizeUnitChange}>
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
              placeholder="e.g. clamp(2.5rem, 5vw, 4rem)"
            />
          )}
        </div>
      </div>
      <div className="style-row">
        <div className="style-col">
          <label className="style-label">Weight</label>
          <select className="inspector-select" name="fontWeight" value={styles.fontWeight || ''} onChange={handleChange}>
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
          <label className="style-label">Line Height</label>
          <input className="inspector-input" type="text" name="lineHeight" value={styles.lineHeight || ''} onChange={handleChange} placeholder="e.g. 1.5, 24px" />
        </div>
      </div>
      <div className="style-row">
        <div className="style-col">
          <label className="style-label">Letter Spacing</label>
          <input className="inspector-input" type="text" name="letterSpacing" value={styles.letterSpacing || ''} onChange={handleChange} placeholder="e.g. 1px, 0.1em" />
        </div>
        <div className="style-col">
          <label className="style-label">Color</label>
          <div className="color-picker-wrapper">
            <input type="color" name="color" value={styles.color || '#000000'} onChange={handleChange} />
            <input type="text" className="inspector-input color-hex-input" name="color" value={styles.color || ''} onChange={handleChange} placeholder="#000000" />
          </div>
        </div>
      </div>
      <div className="style-row">
        <div className="style-col">
          <label className="style-label">Align</label>
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

export function BackgroundEditor({ styles, onChange }: StyleEditorProps): JSX.Element {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target
    onChange(name, value || undefined)
  }

  return (
    <div className="style-editor-section">
      <div className="style-row">
        <div className="style-col">
          <label className="style-label">Color</label>
          <div className="color-picker-wrapper">
            <input type="color" name="backgroundColor" value={styles.backgroundColor || '#ffffff'} onChange={handleChange} />
            <input type="text" className="inspector-input color-hex-input" name="backgroundColor" value={styles.backgroundColor || ''} onChange={handleChange} placeholder="transparent" />
          </div>
        </div>
      </div>
      <div className="style-row">
        <div className="style-col">
          <label className="style-label">Image URL</label>
          <input className="inspector-input" type="text" name="backgroundImage" value={styles.backgroundImage?.replace(/url\(['"]?(.*?)['"]?\)/, '$1') || ''} onChange={(e) => onChange('backgroundImage', e.target.value ? `url('${e.target.value}')` : undefined)} placeholder="e.g. https://..." />
        </div>
      </div>
      <div className="style-row">
        <div className="style-col">
          <label className="style-label">Size</label>
          <select className="inspector-select" name="backgroundSize" value={styles.backgroundSize || ''} onChange={handleChange}>
            <option value="">Default</option>
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="100% 100%">100% 100%</option>
            <option value="auto">Auto</option>
          </select>
        </div>
        <div className="style-col">
          <label className="style-label">Position</label>
          <select className="inspector-select" name="backgroundPosition" value={styles.backgroundPosition || ''} onChange={handleChange}>
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
          <label className="style-label">Repeat</label>
          <select className="inspector-select" name="backgroundRepeat" value={styles.backgroundRepeat || ''} onChange={handleChange}>
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

export function BorderEditor({ styles, onChange }: StyleEditorProps): JSX.Element {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target
    onChange(name, value || undefined)
  }

  return (
    <div className="style-editor-section">
      <div className="style-row">
        <div className="style-col">
          <label className="style-label">Radius</label>
          <input className="inspector-input" type="text" name="borderRadius" value={styles.borderRadius || ''} onChange={handleChange} placeholder="e.g. 4px, 50%" />
        </div>
        <div className="style-col">
          <label className="style-label">Width</label>
          <input className="inspector-input" type="text" name="borderWidth" value={styles.borderWidth || ''} onChange={handleChange} placeholder="e.g. 1px" />
        </div>
      </div>
      <div className="style-row">
        <div className="style-col">
          <label className="style-label">Style</label>
          <select className="inspector-select" name="borderStyle" value={styles.borderStyle || ''} onChange={handleChange}>
            <option value="">Default (none)</option>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>
        <div className="style-col">
          <label className="style-label">Color</label>
          <div className="color-picker-wrapper">
            <input type="color" name="borderColor" value={styles.borderColor || '#000000'} onChange={handleChange} />
            <input type="text" className="inspector-input color-hex-input" name="borderColor" value={styles.borderColor || ''} onChange={handleChange} placeholder="#000000" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function LayoutEditor({ styles, onChange }: StyleEditorProps): JSX.Element {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target
    onChange(name, value || undefined)
  }

  return (
    <div className="style-editor-section">
      <div className="style-row">
        <div className="style-col">
          <label className="style-label">Display</label>
          <select className="inspector-select" name="display" value={styles.display || ''} onChange={handleChange}>
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
          <label className="style-label">Position</label>
          <select className="inspector-select" name="position" value={styles.position || ''} onChange={handleChange}>
            <option value="">Default</option>
            <option value="static">Static</option>
            <option value="relative">Relative</option>
            <option value="absolute">Absolute</option>
            <option value="fixed">Fixed</option>
            <option value="sticky">Sticky</option>
          </select>
        </div>
        <div className="style-col">
          <label className="style-label">Z-Index</label>
          <input className="inspector-input" type="text" name="zIndex" value={styles.zIndex || ''} onChange={handleChange} placeholder="e.g. 10, 1030" />
        </div>
      </div>
      <div className="style-row">
        <div className="style-col">
          <label className="style-label">Top</label>
          <input className="inspector-input" type="text" name="top" value={styles.top || ''} onChange={handleChange} placeholder="e.g. 0, 1rem" />
        </div>
        <div className="style-col">
          <label className="style-label">Bottom</label>
          <input className="inspector-input" type="text" name="bottom" value={styles.bottom || ''} onChange={handleChange} placeholder="e.g. 0, 1rem" />
        </div>
      </div>

      {styles.display === 'flex' && (
        <>
          <div className="style-row">
            <div className="style-col">
              <label className="style-label">Flex Direction</label>
              <select className="inspector-select" name="flexDirection" value={styles.flexDirection || ''} onChange={handleChange}>
                <option value="">Default (row)</option>
                <option value="row">Row</option>
                <option value="column">Column</option>
                <option value="row-reverse">Row Reverse</option>
                <option value="column-reverse">Column Reverse</option>
              </select>
            </div>
            <div className="style-col">
              <label className="style-label">Flex Wrap</label>
              <select className="inspector-select" name="flexWrap" value={styles.flexWrap || ''} onChange={handleChange}>
                <option value="">Default (nowrap)</option>
                <option value="nowrap">No Wrap</option>
                <option value="wrap">Wrap</option>
                <option value="wrap-reverse">Wrap Reverse</option>
              </select>
            </div>
          </div>
          <div className="style-row">
            <div className="style-col">
              <label className="style-label">Justify Content</label>
              <select className="inspector-select" name="justifyContent" value={styles.justifyContent || ''} onChange={handleChange}>
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
              <label className="style-label">Align Items</label>
              <select className="inspector-select" name="alignItems" value={styles.alignItems || ''} onChange={handleChange}>
                <option value="">Default (stretch)</option>
                <option value="flex-start">Flex Start</option>
                <option value="center">Center</option>
                <option value="flex-end">Flex End</option>
                <option value="baseline">Baseline</option>
              </select>
            </div>
            <div className="style-col">
              <label className="style-label">Gap</label>
              <input className="inspector-input" type="text" name="gap" value={styles.gap || ''} onChange={handleChange} placeholder="e.g. 16px, 1rem" />
            </div>
          </div>
        </>
      )}
      
      <div className="style-row">
        <div className="style-col">
          <label className="style-label">Width</label>
          <input className="inspector-input" type="text" name="width" value={styles.width || ''} onChange={handleChange} placeholder="e.g. 100%, 200px" />
        </div>
        <div className="style-col">
          <label className="style-label">Height</label>
          <input className="inspector-input" type="text" name="height" value={styles.height || ''} onChange={handleChange} placeholder="e.g. auto, 100vh" />
        </div>
      </div>
      <div className="style-row">
        <div className="style-col">
          <label className="style-label">Min Width</label>
          <input className="inspector-input" type="text" name="minWidth" value={styles.minWidth || ''} onChange={handleChange} />
        </div>
        <div className="style-col">
          <label className="style-label">Min Height</label>
          <input className="inspector-input" type="text" name="minHeight" value={styles.minHeight || ''} onChange={handleChange} />
        </div>
      </div>
    </div>
  )
}
