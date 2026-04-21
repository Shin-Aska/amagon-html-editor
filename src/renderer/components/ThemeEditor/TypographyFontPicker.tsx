/**
 * TypographyFontPicker — true dropdown design
 *
 * - Trigger: a button showing the current font name, rendered IN that font
 * - Click → portal dropdown opens (escapes overflow:hidden parents)
 * - Inside the dropdown: search bar + full scrollable font list
 * - Each option renders its name in its own typeface
 * - No clearing required — trigger is never an input
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { useProjectStore } from '../../store/projectStore'
import './TypographyFontPicker.css'

interface FontOption {
  label: string
  value: string
  group: string
}

const FONT_OPTIONS: FontOption[] = [
  // System
  { label: 'System Default', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', group: 'System' },
  { label: 'System Serif', value: 'ui-serif, Georgia, Cambria, "Times New Roman", serif', group: 'System' },
  { label: 'System Mono', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', group: 'System' },
  { label: 'Inherit', value: 'inherit', group: 'System' },
  // Sans-Serif
  { label: 'Inter', value: 'Inter, system-ui, sans-serif', group: 'Sans-Serif' },
  { label: 'Roboto', value: 'Roboto, Arial, sans-serif', group: 'Sans-Serif' },
  { label: 'Open Sans', value: '"Open Sans", Arial, sans-serif', group: 'Sans-Serif' },
  { label: 'Lato', value: 'Lato, Arial, sans-serif', group: 'Sans-Serif' },
  { label: 'Poppins', value: 'Poppins, system-ui, sans-serif', group: 'Sans-Serif' },
  { label: 'Nunito', value: 'Nunito, system-ui, sans-serif', group: 'Sans-Serif' },
  { label: 'Montserrat', value: 'Montserrat, system-ui, sans-serif', group: 'Sans-Serif' },
  { label: 'Raleway', value: 'Raleway, system-ui, sans-serif', group: 'Sans-Serif' },
  { label: 'DM Sans', value: '"DM Sans", system-ui, sans-serif', group: 'Sans-Serif' },
  { label: 'Outfit', value: 'Outfit, system-ui, sans-serif', group: 'Sans-Serif' },
  { label: 'Figtree', value: 'Figtree, system-ui, sans-serif', group: 'Sans-Serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif', group: 'Sans-Serif' },
  { label: 'Helvetica Neue', value: '"Helvetica Neue", Helvetica, Arial, sans-serif', group: 'Sans-Serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif', group: 'Sans-Serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif', group: 'Sans-Serif' },
  // Serif
  { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif', group: 'Serif' },
  { label: 'Lora', value: 'Lora, Georgia, serif', group: 'Serif' },
  { label: 'Merriweather', value: 'Merriweather, Georgia, serif', group: 'Serif' },
  { label: 'Georgia', value: 'Georgia, serif', group: 'Serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif', group: 'Serif' },
  // Display
  { label: 'Space Grotesk', value: '"Space Grotesk", system-ui, sans-serif', group: 'Display' },
  { label: 'Sora', value: 'Sora, system-ui, sans-serif', group: 'Display' },
  { label: 'Manrope', value: 'Manrope, system-ui, sans-serif', group: 'Display' },
  // Monospace
  { label: 'Fira Code', value: '"Fira Code", Consolas, monospace', group: 'Monospace' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", Menlo, monospace', group: 'Monospace' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace', group: 'Monospace' },
]

const GROUPS = ['Imported', 'System', 'Sans-Serif', 'Serif', 'Display', 'Monospace'] as const

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
}

export default function TypographyFontPicker({ label, value, onChange }: Props): JSX.Element {
  const managedFonts = useProjectStore((s) => s.fonts)

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({})

  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // All options with managed fonts at top
  const allOptions = useMemo<FontOption[]>(() => {
    const managed: FontOption[] = managedFonts
      .filter((f) => f.name.trim())
      .map((f) => ({ label: f.name, value: f.name, group: 'Imported' }))
    return [...managed, ...FONT_OPTIONS]
  }, [managedFonts])

  // Current option (for trigger display)
  const currentOption = useMemo(() => {
    return allOptions.find((o) => o.value === value) ?? { label: value || 'Select a font…', value: value || '', group: '' }
  }, [allOptions, value])

  // Filtered by search
  const filteredOptions = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return allOptions
    return allOptions.filter((o) => o.label.toLowerCase().includes(q))
  }, [allOptions, search])

  // Grouped filtered options
  const groups = useMemo(() => {
    return GROUPS
      .map((g) => ({ group: g, items: filteredOptions.filter((o) => o.group === g) }))
      .filter((g) => g.items.length > 0)
  }, [filteredOptions])

  const openDropdown = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setPortalStyle({
      position: 'fixed',
      top: rect.bottom + 3,
      left: rect.left,
      width: Math.max(rect.width, 240),
      maxHeight: Math.min(360, spaceBelow - 12),
      zIndex: 99999,
    })
    setSearch('')
    setOpen(true)
  }

  // Focus search and scroll to active item after open
  useEffect(() => {
    if (!open) return
    setTimeout(() => {
      searchRef.current?.focus()
      const active = listRef.current?.querySelector('[data-active="true"]') as HTMLElement | null
      active?.scrollIntoView({ block: 'center' })
    }, 0)
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const portal = document.getElementById('tfp-dropdown-portal')
      if (!triggerRef.current?.contains(e.target as Node) && !portal?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const commit = (v: string) => {
    onChange(v)
    setOpen(false)
    setSearch('')
  }

  const dropdown = (
    <div id="tfp-dropdown-portal" className="tfp-dropdown" style={portalStyle}>
      {/* Search — separate from trigger, always shows all fonts when empty */}
      <div className="tfp-search-bar">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="tfp-search-icon">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          ref={searchRef}
          type="text"
          className="tfp-search-input"
          placeholder="Search fonts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); setSearch('') }
          }}
        />
        {search && (
          <button type="button" className="tfp-search-clear" onClick={() => setSearch('')}>×</button>
        )}
      </div>

      {/* Font list */}
      <div className="tfp-list" ref={listRef}>
        {groups.length === 0 && (
          <div className="tfp-empty">No fonts match "{search}"</div>
        )}
        {groups.map(({ group, items }) => (
          <div key={group}>
            <div className="tfp-group-header">{group}</div>
            {items.map((option) => {
              const isActive = option.value === value
              return (
                <button
                  key={option.value + option.group}
                  type="button"
                  data-active={isActive}
                  className={`tfp-option ${isActive ? 'is-active' : ''}`}
                  style={{ fontFamily: option.value || 'inherit' }}
                  onMouseDown={(e) => { e.preventDefault(); commit(option.value) }}
                >
                  <span className="tfp-option-name">{option.label}</span>
                  {isActive && (
                    <svg className="tfp-option-check" viewBox="0 0 12 9" width="12" height="9" fill="none">
                      <path d="M1 4.5L4.5 8 11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="tfp-field">
      <label className="theme-field-label">{label}</label>
      {/* Trigger — a button, never a text input */}
      <button
        ref={triggerRef}
        type="button"
        className={`tfp-trigger ${open ? 'is-open' : ''}`}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        title={value}
      >
        {/* "Aa" chip rendered in selected font — instant visual preview */}
        <span className="tfp-trigger-sample" style={{ fontFamily: value || 'inherit' }}>Aa</span>
        <span className="tfp-trigger-label" style={{ fontFamily: value || 'inherit' }}>
          {currentOption.label}
        </span>
        <svg className="tfp-trigger-chevron" viewBox="0 0 10 6" width="10" height="6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && ReactDOM.createPortal(dropdown, document.body)}
    </div>
  )
}
