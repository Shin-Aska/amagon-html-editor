import {useEffect, useMemo, useRef, useState} from 'react'

interface MultiComboboxFieldProps {
  value: string[]
  options: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}

export default function MultiComboboxField({
  value,
  options,
  onChange,
  placeholder
}: MultiComboboxFieldProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selected = Array.isArray(value) ? value : []

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.toLowerCase().includes(q))
  }, [options, query])

  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((v) => v !== opt))
    } else {
      onChange([...selected, opt])
    }
  }

  const remove = (opt: string) => {
    onChange(selected.filter((v) => v !== opt))
  }

  return (
    <div className="multi-combobox-wrapper" ref={wrapperRef}>
      <div
        className="multi-combobox-input inspector-input"
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen((v) => !v)
          if (e.key === 'Escape') setOpen(false)
        }}
      >
        {selected.length === 0 ? (
          <span className="multi-combobox-placeholder">{placeholder || ''}</span>
        ) : (
          <div className="multi-combobox-tags">
            {selected.map((opt) => (
              <span
                key={opt}
                className="multi-combobox-tag"
                onClick={(e) => {
                  e.stopPropagation()
                  remove(opt)
                }}
                title="Remove"
              >
                {opt}
              </span>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="multi-combobox-dropdown">
          <input
            className="multi-combobox-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            autoFocus
          />
          <div className="multi-combobox-options">
            {filtered.map((opt) => {
              const isSelected = selected.includes(opt)
              return (
                <div
                  key={opt}
                  className={`multi-combobox-option ${isSelected ? 'selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    toggle(opt)
                  }}
                >
                  <input type="checkbox" checked={isSelected} readOnly />
                  <span>{opt}</span>
                </div>
              )
            })}
            {filtered.length === 0 && <div className="multi-combobox-empty">No matches</div>}
          </div>
        </div>
      )}
    </div>
  )
}
