import React from 'react'
import BlockIcon from '../BlockIcon/BlockIcon'
import { getLucideIconComponent, isRenderableGlyph, lucidePickerIcons, mapLegacyBootstrapIcon } from '../../utils/iconCatalog'
import './IconField.css'

interface IconFieldProps {
  value: string
  onChange: (value: string) => void
}

function IconField({ value, onChange }: IconFieldProps): JSX.Element {
  const trimmed = String(value || '').trim()
  const lucideName = trimmed.startsWith('lucide:') ? trimmed.replace(/^lucide:/, '') : ''
  const legacyLucideName = mapLegacyBootstrapIcon(trimmed)
  const hasLucideIcon = !!getLucideIconComponent(lucideName)
  const hasLegacyLucideIcon = !!legacyLucideName && !!getLucideIconComponent(legacyLucideName)
  const hasGlyph = !trimmed ? false : isRenderableGlyph(trimmed)

  return (
    <div className="icon-field">
      <div className="icon-field-row">
        <div className="icon-field-preview" aria-label="Selected icon">
          {hasLucideIcon ? (
            <BlockIcon name={lucideName} className="icon-field-lucide" />
          ) : hasLegacyLucideIcon ? (
            <BlockIcon name={legacyLucideName!} className="icon-field-lucide" />
          ) : hasGlyph ? (
            <span className="icon-field-glyph">{trimmed}</span>
          ) : (
            <span className="icon-field-empty">☆</span>
          )}
        </div>
        <input
          type="text"
          className="inspector-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. lucide:star or ⭐"
        />
      </div>

      <div className="icon-field-actions">
        <button type="button" className="icon-field-action-btn" onClick={() => onChange('')}>
          Clear
        </button>
        <button type="button" className="icon-field-action-btn" onClick={() => onChange('lucide:star')}>
          Reset to Star
        </button>
      </div>

      <div className="icon-field-grid" role="list">
        {lucidePickerIcons.map((iconName) => {
          const iconValue = `lucide:${iconName}`
          const active = trimmed === iconValue
          return (
            <button
              key={iconValue}
              type="button"
              className={`icon-field-grid-btn ${active ? 'active' : ''}`}
              onClick={() => onChange(iconValue)}
              title={`Use ${iconValue}`}
            >
              <BlockIcon name={iconName} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default IconField
