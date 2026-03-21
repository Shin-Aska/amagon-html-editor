import { useState, useCallback } from 'react'
import './ArrayField.css'
import { useEditorStore } from '../../store/editorStore'

export interface TabItem {
  label: string
  content: string
}

export interface AccordionItem {
  title: string
  content: string
}

export type ArrayItem = string | TabItem | AccordionItem

interface ArrayFieldProps {
  blockId?: string
  value: ArrayItem[]
  onChange: (value: ArrayItem[]) => void
  itemType?: 'string' | 'tab' | 'accordion'
}

function ArrayField({ blockId, value = [], onChange, itemType = 'string' }: ArrayFieldProps): JSX.Element {
  const [newItemText, setNewItemText] = useState('')

  const normalizeValue = useCallback((): ArrayItem[] => {
    if (!Array.isArray(value)) return []
    return value
  }, [value])

  const handleAddStringItem = useCallback(() => {
    if (!newItemText.trim()) return
    const current = normalizeValue()
    onChange([...current, newItemText.trim()])
    setNewItemText('')
  }, [newItemText, normalizeValue, onChange])

  const handleAddObjectItem = useCallback(() => {
    const current = normalizeValue()
    if (itemType === 'tab') {
      onChange([...current, { label: 'New Tab', content: '' }])
    } else if (itemType === 'accordion') {
      onChange([...current, { title: 'New Item', content: '' }])
    }
  }, [itemType, normalizeValue, onChange])

  const updateItem = (index: number, updates: Partial<TabItem | AccordionItem>) => {
    const next = [...normalizeValue()]
    const item = next[index]
    if (typeof item === 'object' && item !== null) {
      next[index] = { ...item, ...updates }
      onChange(next)
    }
  }

  const updateStringItem = (index: number, newValue: string) => {
    const next = [...normalizeValue()]
    next[index] = newValue
    onChange(next)
  }

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    const current = normalizeValue()
    if (newIndex < 0 || newIndex >= current.length) return

    const next = [...current]
    const [item] = next.splice(index, 1)
    next.splice(newIndex, 0, item)
    onChange(next)
  }

  const removeItem = (index: number) => {
    const next = [...normalizeValue()]
    next.splice(index, 1)
    onChange(next)
  }

  const items = normalizeValue()

  const isStringArray = itemType === 'string'
  const isTabArray = itemType === 'tab'
  const isAccordionArray = itemType === 'accordion'

  return (
    <div className="array-field">
      <div className="array-field-header">
        {isStringArray ? (
          <div className="array-add-row">
            <input
              type="text"
              className="array-input"
              placeholder="Add new item..."
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddStringItem()
                }
              }}
            />
            <button
              className="array-add-btn"
              onClick={handleAddStringItem}
              disabled={!newItemText.trim()}
            >
              + Add
            </button>
          </div>
        ) : (
          <button className="array-add-btn" onClick={handleAddObjectItem}>
            + Add {isTabArray ? 'Tab' : 'Item'}
          </button>
        )}
      </div>

      <div className="array-items-list">
        {items.length === 0 ? (
          <div className="array-empty">No items added.</div>
        ) : (
          items.map((item, index) => (
            <div key={index} className="array-item">
              {isStringArray ? (
                <div className="array-item-string">
                  <input
                    type="text"
                    className="array-input"
                    value={String(item)}
                    onChange={(e) => updateStringItem(index, e.target.value)}
                  />
                </div>
              ) : (
                <div className="array-item-object">
                  {isTabArray && (
                    <>
                      <input
                        type="text"
                        className="array-input"
                        placeholder="Tab label"
                        value={(item as TabItem).label || ''}
                        onChange={(e) => updateItem(index, { label: e.target.value })}
                      />
                      <textarea
                        className="array-textarea"
                        placeholder="Tab content"
                        value={(item as TabItem).content || ''}
                        onChange={(e) => updateItem(index, { content: e.target.value })}
                        rows={2}
                      />
                      {blockId && (
                        <button
                          className="array-action-btn edit-canvas"
                          style={{
                            width: '100%',
                            marginTop: '4px',
                            background: 'var(--theme-primary)',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          onClick={() => useEditorStore.getState().enterTabEditMode(blockId, index)}
                          title="Edit tab content visually in the canvas"
                        >
                          Edit in Canvas
                        </button>
                      )}
                    </>
                  )}
                  {isAccordionArray && (
                    <>
                      <input
                        type="text"
                        className="array-input"
                        placeholder="Item title"
                        value={(item as AccordionItem).title || ''}
                        onChange={(e) => updateItem(index, { title: e.target.value })}
                      />
                      <textarea
                        className="array-textarea"
                        placeholder="Item content"
                        value={(item as AccordionItem).content || ''}
                        onChange={(e) => updateItem(index, { content: e.target.value })}
                        rows={2}
                      />
                    </>
                  )}
                </div>
              )}
              <div className="array-item-actions">
                <button
                  className="array-action-btn"
                  onClick={() => moveItem(index, 'up')}
                  disabled={index === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  className="array-action-btn"
                  onClick={() => moveItem(index, 'down')}
                  disabled={index === items.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  className="array-action-btn delete"
                  onClick={() => removeItem(index)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ArrayField
