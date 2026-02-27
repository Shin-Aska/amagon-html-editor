import { useEffect, useMemo, useState } from 'react'
import './SaveCustomBlockDialog.css'

interface SaveCustomBlockDialogProps {
  isOpen: boolean
  availableCategories: string[]
  availableIcons: string[]
  defaultLabel: string
  defaultIcon: string
  defaultCategory: string
  onCancel: () => void
  onSave: (data: { label: string; icon: string; category: string }) => void
}

export default function SaveCustomBlockDialog({
  isOpen,
  availableCategories,
  availableIcons,
  defaultLabel,
  defaultIcon,
  defaultCategory,
  onCancel,
  onSave
}: SaveCustomBlockDialogProps): JSX.Element | null {
  const [label, setLabel] = useState(defaultLabel)
  const [icon, setIcon] = useState(defaultIcon)
  const [category, setCategory] = useState(defaultCategory)

  useEffect(() => {
    if (!isOpen) return
    setLabel(defaultLabel)
    setIcon(defaultIcon)
    setCategory(defaultCategory)
  }, [defaultCategory, defaultIcon, defaultLabel, isOpen])

  const dedupedCategories = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const c of availableCategories || []) {
      const trimmed = String(c || '').trim()
      if (!trimmed) continue
      if (seen.has(trimmed)) continue
      seen.add(trimmed)
      list.push(trimmed)
    }
    return list
  }, [availableCategories])

  const dedupedIcons = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const i of availableIcons || []) {
      const trimmed = String(i || '').trim()
      if (!trimmed) continue
      if (seen.has(trimmed)) continue
      seen.add(trimmed)
      list.push(trimmed)
    }
    return list
  }, [availableIcons])

  if (!isOpen) return null

  const canSave = !!label.trim() && !!category.trim()
  const categoryTrimmed = category.trim()
  const selectedCategory = dedupedCategories.includes(categoryTrimmed) ? categoryTrimmed : ''

  return (
    <div className="scb-overlay" onClick={onCancel}>
      <div className="scb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="scb-header">
          <h2>Save Custom Block</h2>
          <button className="scb-close-btn" onClick={onCancel}>
            &times;
          </button>
        </div>

        <div className="scb-content">
          <div className="scb-form-group">
            <label className="scb-label">Name</label>
            <input
              className="scb-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') onCancel()
                if (e.key === 'Enter' && canSave) {
                  onSave({ label: label.trim(), icon: icon.trim() || '🧩', category: category.trim() })
                }
              }}
            />
          </div>

          <div className="scb-form-group">
            <label className="scb-label">Icon</label>
            <div className="scb-icon-row">
              <div className="scb-icon-preview" aria-label="Selected icon">
                {icon.trim() || '🧩'}
              </div>
              <input
                className="scb-input"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="e.g. 🧩"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onCancel()
                }}
              />
            </div>

            <div className="scb-icon-grid" role="list">
              {dedupedIcons.slice(0, 40).map((i) => {
                const active = (icon || '').trim() === i
                return (
                  <button
                    key={i}
                    type="button"
                    className={`scb-icon-btn ${active ? 'active' : ''}`}
                    onClick={() => setIcon(i)}
                    title={`Use icon ${i}`}
                  >
                    {i}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="scb-form-group">
            <label className="scb-label">Section</label>
            <select
              className="scb-select"
              value={selectedCategory}
              onChange={(e) => {
                const v = e.target.value
                if (v) setCategory(v)
              }}
            >
              <option value="">(Custom)</option>
              {dedupedCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className="scb-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="scb-category-list"
              placeholder="e.g. Layout"
              onKeyDown={(e) => {
                if (e.key === 'Escape') onCancel()
              }}
            />
            <datalist id="scb-category-list">
              {dedupedCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="scb-footer">
          <button className="scb-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="scb-btn-primary"
            onClick={() => onSave({ label: label.trim(), icon: icon.trim() || '🧩', category: category.trim() })}
            disabled={!canSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
