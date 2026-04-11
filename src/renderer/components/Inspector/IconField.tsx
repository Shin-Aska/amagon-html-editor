import React, { useState } from 'react'
import BlockIcon from '../BlockIcon/BlockIcon'
import { X, Plus } from 'lucide-react'
import { getLucideIconComponent, isRenderableGlyph, lucidePickerIcons, mapLegacyBootstrapIcon } from '../../utils/iconCatalog'
import './IconField.css'

interface IconFieldProps {
  value: string
  onChange: (value: string) => void
}

function IconField({ value, onChange }: IconFieldProps): JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false)
  const trimmed = String(value || '').trim()
  const lucideName = trimmed.startsWith('lucide:') ? trimmed.replace(/^lucide:/, '') : ''
  const legacyLucideName = mapLegacyBootstrapIcon(trimmed)
  const hasLucideIcon = !!getLucideIconComponent(lucideName)
  const hasLegacyLucideIcon = !!legacyLucideName && !!getLucideIconComponent(legacyLucideName)
  const hasGlyph = !trimmed ? false : isRenderableGlyph(trimmed)

  return (
    <div className="icon-field">
      <div className="icon-field-controls">
        <button
          type="button"
          className={`icon-field-button ${!value ? 'empty' : ''}`}
          onClick={() => setPickerOpen(true)}
          title={value ? "Change Icon" : "Choose Icon"}
        >
          {hasLucideIcon ? (
            <BlockIcon name={lucideName} className="icon-field-lucide" />
          ) : hasLegacyLucideIcon ? (
            <BlockIcon name={legacyLucideName!} className="icon-field-lucide" />
          ) : hasGlyph ? (
            <span className="icon-field-glyph">{trimmed}</span>
          ) : (
            <Plus size={18} className="icon-field-plus" />
          )}
        </button>
        {value && (
          <button 
            type="button"
            className="icon-field-clear" 
            onClick={() => onChange('')}
            title="Clear icon"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {pickerOpen && (
        <div className="icon-field-modal-backdrop" role="presentation" onMouseDown={() => setPickerOpen(false)}>
          <div
            className="icon-field-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Choose icon"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="icon-field-modal-header">
              <div>
                <h4>Choose Icon</h4>
                <p>Select a Lucide icon or enter a custom emoji/value below.</p>
              </div>
              <button type="button" className="icon-field-modal-close" onClick={() => setPickerOpen(false)} aria-label="Close icon picker">
                <X size={16} />
              </button>
            </div>
            
            <div className="icon-field-search-row">
              <input
                type="text"
                className="icon-field-search-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Custom value e.g. lucide:star or ⭐"
              />
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
                    onClick={() => {
                      onChange(iconValue)
                      setPickerOpen(false)
                    }}
                    title={`Use ${iconValue}`}
                  >
                    <BlockIcon name={iconName} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IconField
