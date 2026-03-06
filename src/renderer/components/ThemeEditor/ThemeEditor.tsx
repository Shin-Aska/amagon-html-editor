import { useState, useCallback, useEffect } from 'react'
import { X, Palette, Download, Upload, RotateCcw, Plus, Pencil, Trash2, Check, XIcon } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useToastStore } from '../../store/toastStore'
import { createDefaultTheme, themeToCSS } from '../../store/types'
import type { ProjectTheme, ThemeColors, ThemeTypography, ThemeSpacing, ThemeBorders } from '../../store/types'
import { themePresets } from './themePresets'
import CustomCssManager from './CustomCssManager'
import './ThemeEditor.css'

type ThemeTab = 'colors' | 'typography' | 'spacing' | 'borders' | 'customCss' | 'presets'

interface ThemeEditorProps {
  isOpen: boolean
  onClose: () => void
}

// ─── Color Field ──────────────────────────────────────────────────────────────

function ColorField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): JSX.Element {
  const [hex, setHex] = useState(value)

  useEffect(() => {
    setHex(value)
  }, [value])

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setHex(v)
    if (/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v)) {
      onChange(v)
    }
  }

  const handleHexBlur = () => {
    if (!/^#[0-9a-fA-F]{3,6}$/.test(hex)) {
      setHex(value)
    }
  }

  return (
    <div className="theme-color-item">
      <span className="theme-color-label">{label}</span>
      <div className="theme-color-input-row">
        <div className="theme-color-swatch" style={{ backgroundColor: value }}>
          <input
            type="color"
            value={value}
            onChange={(e) => { setHex(e.target.value); onChange(e.target.value) }}
          />
        </div>
        <input
          className="theme-color-hex"
          value={hex}
          onChange={handleHexChange}
          onBlur={handleHexBlur}
          spellCheck={false}
        />
      </div>
    </div>
  )
}

// ─── Colors Tab ───────────────────────────────────────────────────────────────

function ColorsTab({
  colors,
  onChange
}: {
  colors: ThemeColors
  onChange: (patch: Partial<ThemeColors>) => void
}): JSX.Element {
  const colorFields: { key: keyof ThemeColors; label: string }[] = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'accent', label: 'Accent' },
    { key: 'background', label: 'Background' },
    { key: 'surface', label: 'Surface' },
    { key: 'text', label: 'Text' },
    { key: 'textMuted', label: 'Text Muted' },
    { key: 'border', label: 'Border' },
    { key: 'success', label: 'Success' },
    { key: 'warning', label: 'Warning' },
    { key: 'danger', label: 'Danger' }
  ]

  return (
    <div className="theme-section">
      <div className="theme-section-title">Theme Colors</div>
      <div className="theme-color-grid">
        {colorFields.map(({ key, label }) => (
          <ColorField
            key={key}
            label={label}
            value={colors[key]}
            onChange={(v) => onChange({ [key]: v })}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Typography Tab ───────────────────────────────────────────────────────────

function TypographyTab({
  typography,
  onChange
}: {
  typography: ThemeTypography
  onChange: (patch: Partial<ThemeTypography>) => void
}): JSX.Element {
  return (
    <div className="theme-section">
      <div className="theme-section-title">Typography</div>
      <div className="theme-field-group">
        <div className="theme-field">
          <label className="theme-field-label">Font Family</label>
          <input
            className="theme-field-input"
            value={typography.fontFamily}
            onChange={(e) => onChange({ fontFamily: e.target.value })}
          />
        </div>
        <div className="theme-field">
          <label className="theme-field-label">Heading Font Family</label>
          <input
            className="theme-field-input"
            value={typography.headingFontFamily}
            onChange={(e) => onChange({ headingFontFamily: e.target.value })}
          />
        </div>
        <div className="theme-field">
          <label className="theme-field-label">Base Font Size</label>
          <input
            className="theme-field-input"
            value={typography.baseFontSize}
            onChange={(e) => onChange({ baseFontSize: e.target.value })}
          />
        </div>
        <div className="theme-field">
          <label className="theme-field-label">Line Height</label>
          <input
            className="theme-field-input"
            value={typography.lineHeight}
            onChange={(e) => onChange({ lineHeight: e.target.value })}
          />
        </div>
        <div className="theme-field">
          <label className="theme-field-label">Heading Line Height</label>
          <input
            className="theme-field-input"
            value={typography.headingLineHeight}
            onChange={(e) => onChange({ headingLineHeight: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Spacing Tab ──────────────────────────────────────────────────────────────

function SpacingTab({
  spacing,
  onChange
}: {
  spacing: ThemeSpacing
  onChange: (patch: Partial<ThemeSpacing>) => void
}): JSX.Element {
  const unit = parseFloat(spacing.baseUnit) || 8

  return (
    <div className="theme-section">
      <div className="theme-section-title">Spacing</div>
      <div className="theme-field-group">
        <div className="theme-field">
          <label className="theme-field-label">Base Unit</label>
          <input
            className="theme-field-input"
            value={spacing.baseUnit}
            onChange={(e) => onChange({ baseUnit: e.target.value })}
          />
        </div>
      </div>

      <div className="theme-section-title" style={{ marginTop: 16 }}>Scale Preview</div>
      <div className="theme-spacing-preview">
        {spacing.scale.map((mult, i) => (
          <div key={i} className="theme-spacing-bar">
            <span style={{ minWidth: 50 }}>space-{i}</span>
            <div
              className="theme-spacing-bar-fill"
              style={{ width: `${Math.max(4, mult * unit * 2)}px` }}
            />
            <span>{mult * unit}px</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Borders Tab ──────────────────────────────────────────────────────────────

function BordersTab({
  borders,
  onChange
}: {
  borders: ThemeBorders
  onChange: (patch: Partial<ThemeBorders>) => void
}): JSX.Element {
  return (
    <div className="theme-section">
      <div className="theme-section-title">Borders</div>
      <div className="theme-field-group">
        <div className="theme-field">
          <label className="theme-field-label">Border Radius</label>
          <input
            className="theme-field-input"
            value={borders.radius}
            onChange={(e) => onChange({ radius: e.target.value })}
          />
        </div>
        <div className="theme-field">
          <label className="theme-field-label">Border Width</label>
          <input
            className="theme-field-input"
            value={borders.width}
            onChange={(e) => onChange({ width: e.target.value })}
          />
        </div>
        <div className="theme-field">
          <label className="theme-field-label">Border Color</label>
          <div className="theme-color-input-row">
            <div className="theme-color-swatch" style={{ backgroundColor: borders.color }}>
              <input
                type="color"
                value={borders.color}
                onChange={(e) => onChange({ color: e.target.value })}
              />
            </div>
            <input
              className="theme-color-hex"
              value={borders.color}
              onChange={(e) => onChange({ color: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="theme-section-title" style={{ marginTop: 16 }}>Preview</div>
      <div style={{
        padding: 16,
        border: `${borders.width} solid ${borders.color}`,
        borderRadius: borders.radius,
        background: 'var(--color-bg-primary)',
        fontSize: 13,
        color: 'var(--color-text-secondary)'
      }}>
        Border preview with radius: {borders.radius}, width: {borders.width}
      </div>
    </div>
  )
}

// CustomCssTab removed — now using CustomCssManager component


// ─── Presets Tab ──────────────────────────────────────────────────────────────

function PresetsTab({
  currentTheme,
  customPresets,
  onApplyPreset,
  onCreatePreset,
  onUpdatePreset,
  onDeletePreset
}: {
  currentTheme: ProjectTheme
  customPresets: ProjectTheme[]
  onApplyPreset: (preset: ProjectTheme) => void
  onCreatePreset: (name: string) => void
  onUpdatePreset: (name: string, preset: ProjectTheme) => void
  onDeletePreset: (name: string) => void
}): JSX.Element {
  const [isCreating, setIsCreating] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [editingPreset, setEditingPreset] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleCreate = () => {
    if (newPresetName.trim()) {
      onCreatePreset(newPresetName.trim())
      setNewPresetName('')
      setIsCreating(false)
    }
  }

  const handleEditStart = (preset: ProjectTheme) => {
    setEditingPreset(preset.name)
    setEditName(preset.name)
  }

  const handleEditSave = (originalName: string) => {
    if (editName.trim() && editName.trim() !== originalName) {
      const preset = customPresets.find(p => p.name === originalName)
      if (preset) {
        onUpdatePreset(originalName, { ...preset, name: editName.trim() })
      }
    }
    setEditingPreset(null)
    setEditName('')
  }

  const handleEditCancel = () => {
    setEditingPreset(null)
    setEditName('')
  }

  const allPresets = [...themePresets, ...customPresets]

  return (
    <div className="theme-section">
      <div className="theme-section-header">
        <div className="theme-section-title">Theme Presets</div>
        {!isCreating ? (
          <button
            className="theme-btn theme-btn-small"
            onClick={() => setIsCreating(true)}
            title="Save current theme as preset"
          >
            <Plus size={14} /> Create Preset
          </button>
        ) : (
          <div className="theme-preset-create-form">
            <input
              className="theme-field-input"
              placeholder="Preset name..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setIsCreating(false)
              }}
              autoFocus
            />
            <button className="theme-btn theme-btn-primary" onClick={handleCreate}>
              <Check size={14} />
            </button>
            <button className="theme-btn" onClick={() => setIsCreating(false)}>
              <XIcon size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="theme-preset-grid">
        {allPresets.map((preset) => {
          const isCustom = preset.isCustom ?? false
          const isActive = currentTheme.name === preset.name
          const isEditing = editingPreset === preset.name

          return (
            <div
              key={`${isCustom ? 'custom' : 'built-in'}-${preset.name}`}
              className={`theme-preset-card ${isActive ? 'active' : ''} ${isCustom ? 'custom' : ''}`}
              onClick={() => !isEditing && onApplyPreset(preset)}
            >
              <div className="theme-preset-header">
                {isEditing ? (
                  <div className="theme-preset-edit-form" onClick={(e) => e.stopPropagation()}>
                    <input
                      className="theme-field-input theme-field-input-small"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditSave(preset.name)
                        if (e.key === 'Escape') handleEditCancel()
                      }}
                      autoFocus
                    />
                    <button
                      className="theme-btn theme-btn-small theme-btn-primary"
                      onClick={() => handleEditSave(preset.name)}
                    >
                      <Check size={12} />
                    </button>
                    <button className="theme-btn theme-btn-small" onClick={handleEditCancel}>
                      <XIcon size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="theme-preset-name">
                      {preset.name}
                      {isCustom && <span className="theme-preset-badge">Custom</span>}
                    </div>
                    {isCustom && (
                      <div className="theme-preset-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="theme-preset-action-btn"
                          onClick={() => handleEditStart(preset)}
                          title="Edit preset name"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          className="theme-preset-action-btn theme-preset-action-btn-danger"
                          onClick={() => onDeletePreset(preset.name)}
                          title="Delete preset"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="theme-preset-swatches">
                <div className="theme-preset-swatch" style={{ backgroundColor: preset.colors.primary }} />
                <div className="theme-preset-swatch" style={{ backgroundColor: preset.colors.secondary }} />
                <div className="theme-preset-swatch" style={{ backgroundColor: preset.colors.accent }} />
                <div className="theme-preset-swatch" style={{ backgroundColor: preset.colors.background }} />
                <div className="theme-preset-swatch" style={{ backgroundColor: preset.colors.text }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main ThemeEditor ─────────────────────────────────────────────────────────

export default function ThemeEditor({ isOpen, onClose }: ThemeEditorProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<ThemeTab>('colors')
  const theme = useProjectStore((s) => s.settings.theme)
  const customPresets = useProjectStore((s) => s.customPresets)
  const setProjectTheme = useProjectStore((s) => s.setProjectTheme)
  const addCustomPreset = useProjectStore((s) => s.addCustomPreset)
  const updateCustomPreset = useProjectStore((s) => s.updateCustomPreset)
  const deleteCustomPreset = useProjectStore((s) => s.deleteCustomPreset)
  const updateThemeColors = useProjectStore((s) => s.updateThemeColors)
  const updateThemeTypography = useProjectStore((s) => s.updateThemeTypography)
  const updateThemeSpacing = useProjectStore((s) => s.updateThemeSpacing)
  const updateThemeBorders = useProjectStore((s) => s.updateThemeBorders)
  const showToast = useToastStore((s) => s.showToast)

  const getUniquePresetName = useCallback((baseName: string) => {
    const reserved = new Set<string>([...themePresets.map((p) => p.name), ...customPresets.map((p) => p.name)])
    if (!reserved.has(baseName)) return baseName
    let i = 2
    while (reserved.has(`${baseName} (${i})`)) i++
    return `${baseName} (${i})`
  }, [customPresets])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleReset = useCallback(() => {
    setProjectTheme(createDefaultTheme())
    showToast('Theme reset to defaults', 'success')
  }, [setProjectTheme, showToast])

  const handleExportTheme = useCallback(() => {
    const exportTheme: ProjectTheme = { ...theme, isCustom: true }
    const json = JSON.stringify(exportTheme, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${theme.name.toLowerCase().replace(/\s+/g, '-')}.hoarses-theme.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Theme exported', 'success')
  }, [theme, showToast])

  const handleImportTheme = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.hoarses-theme.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const parsed = JSON.parse(text) as Partial<ProjectTheme>

        // Validate required fields
        if (!parsed.colors || !parsed.typography || !parsed.spacing || !parsed.borders) {
          showToast('Invalid theme file: missing required sections', 'error')
          return
        }

        // Merge with defaults to fill any missing fields
        const defaultTheme = createDefaultTheme()
        const rawName = parsed.name || file.name.replace(/\..*$/, '')
        const imported: ProjectTheme = {
          name: getUniquePresetName(rawName),
          isCustom: true,
          colors: { ...defaultTheme.colors, ...parsed.colors },
          typography: { ...defaultTheme.typography, ...parsed.typography },
          spacing: { ...defaultTheme.spacing, ...parsed.spacing },
          borders: { ...defaultTheme.borders, ...parsed.borders },
          customCss: typeof parsed.customCss === 'string' ? parsed.customCss : '',
          customCssFiles: Array.isArray(parsed.customCssFiles) ? parsed.customCssFiles : []
        }

        addCustomPreset(imported)
        setProjectTheme(imported)
        showToast(`Theme "${imported.name}" imported as custom preset`, 'success')
      } catch (err) {
        showToast('Failed to parse theme file', 'error')
      }
    }
    input.click()
  }, [setProjectTheme, showToast, addCustomPreset, getUniquePresetName])

  const handleApplyPreset = useCallback((preset: ProjectTheme) => {
    setProjectTheme({ ...preset })
    showToast(`Applied "${preset.name}" theme`, 'success')
  }, [setProjectTheme, showToast])

  const handleCreatePreset = useCallback((name: string) => {
    const finalName = getUniquePresetName(name)
    const presetToSave: ProjectTheme = { ...theme, name: finalName, isCustom: true }
    addCustomPreset(presetToSave)
    showToast(`Created preset "${finalName}"`, 'success')
  }, [theme, addCustomPreset, showToast, getUniquePresetName])

  const handleUpdatePreset = useCallback((name: string, preset: ProjectTheme) => {
    updateCustomPreset(name, preset)
    showToast(`Updated preset "${preset.name}"`, 'success')
  }, [updateCustomPreset, showToast])

  const handleDeletePreset = useCallback((name: string) => {
    deleteCustomPreset(name)
    showToast(`Deleted preset "${name}"`, 'success')
  }, [deleteCustomPreset, showToast])

  if (!isOpen) return null

  const tabs: { id: ThemeTab; label: string }[] = [
    { id: 'presets', label: 'Presets' },
    { id: 'colors', label: 'Colors' },
    { id: 'typography', label: 'Typography' },
    { id: 'spacing', label: 'Spacing' },
    { id: 'borders', label: 'Borders' },
    { id: 'customCss', label: 'Custom CSS' }
  ]

  return (
    <div className="theme-editor-overlay" onClick={onClose}>
      <div className="theme-editor-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="theme-editor-header">
          <h2><Palette size={18} /> Theme Editor — {theme.name}</h2>
          <button className="theme-editor-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="theme-editor-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`theme-editor-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="theme-editor-content">
          {activeTab === 'presets' && (
            <PresetsTab
              currentTheme={theme}
              customPresets={customPresets}
              onApplyPreset={handleApplyPreset}
              onCreatePreset={handleCreatePreset}
              onUpdatePreset={handleUpdatePreset}
              onDeletePreset={handleDeletePreset}
            />
          )}
          {activeTab === 'colors' && (
            <ColorsTab colors={theme.colors} onChange={updateThemeColors} />
          )}
          {activeTab === 'typography' && (
            <TypographyTab typography={theme.typography} onChange={updateThemeTypography} />
          )}
          {activeTab === 'spacing' && (
            <SpacingTab spacing={theme.spacing} onChange={updateThemeSpacing} />
          )}
          {activeTab === 'borders' && (
            <BordersTab borders={theme.borders} onChange={updateThemeBorders} />
          )}
          {activeTab === 'customCss' && (
            <CustomCssManager />
          )}
        </div>

        <div className="theme-editor-footer">
          <div className="theme-editor-footer-left">
            <button className="theme-btn" onClick={handleImportTheme}>
              <Upload size={14} /> Import
            </button>
            <button className="theme-btn" onClick={handleExportTheme}>
              <Download size={14} /> Export
            </button>
          </div>
          <div className="theme-editor-footer-right">
            <button className="theme-btn" onClick={handleReset}>
              <RotateCcw size={14} /> Reset
            </button>
            <button className="theme-btn theme-btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
