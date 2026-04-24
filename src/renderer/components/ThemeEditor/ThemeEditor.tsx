import {useCallback, useEffect, useState} from 'react'
import {Check, Download, Palette, Pencil, Plus, RotateCcw, Trash2, Upload, X, XIcon} from 'lucide-react'
import {useProjectStore} from '../../store/projectStore'
import {useToastStore} from '../../store/toastStore'
import type {
    PageThemeMode,
    ProjectTheme,
    ThemeBorders,
    ThemeColors,
    ThemeSpacing,
    ThemeTypography
} from '../../store/types'
import {createDefaultDarkTheme, createDefaultTheme, getThemeVariant} from '../../store/types'
import {themePresets} from './themePresets'
import CustomCssManager from './CustomCssManager'
import ColorField from './ColorField'
import CreatePresetModal from './CreatePresetModal'
import FontManager from './FontManager'
import TypographyFontPicker from './TypographyFontPicker'
import './ThemeEditor.css'

type ThemeTab = 'colors' | 'typography' | 'spacing' | 'borders' | 'customCss' | 'presets' | 'fonts'

interface ThemeEditorProps {
    isOpen: boolean
    onClose: () => void
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
        {key: 'primary', label: 'Primary'},
        {key: 'secondary', label: 'Secondary'},
        {key: 'accent', label: 'Accent'},
        {key: 'background', label: 'Background'},
        {key: 'surface', label: 'Surface'},
        {key: 'text', label: 'Text'},
        {key: 'textMuted', label: 'Text Muted'},
        {key: 'border', label: 'Border'},
        {key: 'success', label: 'Success'},
        {key: 'warning', label: 'Warning'},
        {key: 'danger', label: 'Danger'}
    ];

    return (
        <div className="theme-section">
            <div className="theme-section-title">Theme Colors</div>
            <div className="theme-color-grid">
                {colorFields.map(({key, label}) => (
                    <ColorField
                        key={key}
                        label={label}
                        value={colors[key]}
                        onChange={(v) => onChange({[key]: v})}
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
                <TypographyFontPicker
                    label="Body Font"
                    value={typography.fontFamily}
                    onChange={(v) => onChange({fontFamily: v})}
                />
                <TypographyFontPicker
                    label="Heading Font"
                    value={typography.headingFontFamily}
                    onChange={(v) => onChange({headingFontFamily: v})}
                />
                <div className="theme-field">
                    <label className="theme-field-label">Base Font Size</label>
                    <input
                        className="theme-field-input"
                        value={typography.baseFontSize}
                        onChange={(e) => onChange({baseFontSize: e.target.value})}
                    />
                </div>
                <div className="theme-field">
                    <label className="theme-field-label">Line Height</label>
                    <input
                        className="theme-field-input"
                        value={typography.lineHeight}
                        onChange={(e) => onChange({lineHeight: e.target.value})}
                    />
                </div>
                <div className="theme-field">
                    <label className="theme-field-label">Heading Line Height</label>
                    <input
                        className="theme-field-input"
                        value={typography.headingLineHeight}
                        onChange={(e) => onChange({headingLineHeight: e.target.value})}
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
    const unit = parseFloat(spacing.baseUnit) || 8;

    return (
        <div className="theme-section">
            <div className="theme-section-title">Spacing</div>
            <div className="theme-field-group">
                <div className="theme-field">
                    <label className="theme-field-label">Base Unit</label>
                    <input
                        className="theme-field-input"
                        value={spacing.baseUnit}
                        onChange={(e) => onChange({baseUnit: e.target.value})}
                    />
                </div>
            </div>

            <div className="theme-section-title" style={{marginTop: 16}}>Scale Preview</div>
            <div className="theme-spacing-preview">
                {spacing.scale.map((mult, i) => (
                    <div key={i} className="theme-spacing-bar">
                        <span style={{minWidth: 50}}>space-{i}</span>
                        <div
                            className="theme-spacing-bar-fill"
                            style={{width: `${Math.max(4, mult * unit * 2)}px`}}
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
                        onChange={(e) => onChange({radius: e.target.value})}
                    />
                </div>
                <div className="theme-field">
                    <label className="theme-field-label">Border Width</label>
                    <input
                        className="theme-field-input"
                        value={borders.width}
                        onChange={(e) => onChange({width: e.target.value})}
                    />
                </div>
                <div className="theme-field">
                    <label className="theme-field-label">Border Color</label>
                    <div className="theme-color-input-row">
                        <div className="theme-color-swatch" style={{backgroundColor: borders.color}}>
                            <input
                                type="color"
                                value={borders.color}
                                onChange={(e) => onChange({color: e.target.value})}
                            />
                        </div>
                        <input
                            className="theme-color-hex"
                            value={borders.color}
                            onChange={(e) => onChange({color: e.target.value})}
                        />
                    </div>
                </div>
            </div>

            <div className="theme-section-title" style={{marginTop: 16}}>Preview</div>
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
                        editingMode,
                        onApplyPreset,
                        onCreatePreset,
                        onUpdatePreset,
                        onDeletePreset
                    }: {
    currentTheme: ProjectTheme
    customPresets: ProjectTheme[]
    editingMode: PageThemeMode
    onApplyPreset: (preset: ProjectTheme) => void
    onCreatePreset: (name: string, colors: ThemeColors) => void
    onUpdatePreset: (name: string, preset: ProjectTheme) => void
    onDeletePreset: (name: string) => void
}): JSX.Element {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingPreset, setEditingPreset] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleEditStart = (preset: ProjectTheme) => {
        setEditingPreset(preset.name);
        setEditName(preset.name)
    };

    const handleEditSave = (originalName: string) => {
        if (editName.trim() && editName.trim() !== originalName) {
            const preset = customPresets.find(p => p.name === originalName);
            if (preset) {
                onUpdatePreset(originalName, {...preset, name: editName.trim()})
            }
        }
        setEditingPreset(null);
        setEditName('')
    };

    const handleEditCancel = () => {
        setEditingPreset(null);
        setEditName('')
    };

    const allPresets = [...themePresets, ...customPresets];

    return (
        <div className="theme-section">
            <div className="theme-section-header">
                <div className="theme-section-title">Theme Presets
                    for {editingMode === 'light' ? 'Light Page' : 'Dark Page'}</div>
                <button
                    className="theme-btn theme-btn-small"
                    data-tutorial="preset-create-btn"
                    onClick={() => setIsCreateModalOpen(true)}
                    title="Save current theme as preset"
                >
                    <Plus size={14}/> Create Preset
                </button>
            </div>

            <div className="theme-preset-grid">
                {allPresets.map((preset) => {
                    const isCustom = preset.isCustom ?? false;
                    const isActive = currentTheme.name === preset.name;
                    const isEditing = editingPreset === preset.name;

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
                                                if (e.key === 'Enter') handleEditSave(preset.name);
                                                if (e.key === 'Escape') handleEditCancel()
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            className="theme-btn theme-btn-small theme-btn-primary"
                                            onClick={() => handleEditSave(preset.name)}
                                        >
                                            <Check size={12}/>
                                        </button>
                                        <button className="theme-btn theme-btn-small" onClick={handleEditCancel}>
                                            <XIcon size={12}/>
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
                                                    <Pencil size={12}/>
                                                </button>
                                                <button
                                                    className="theme-preset-action-btn theme-preset-action-btn-danger"
                                                    onClick={() => onDeletePreset(preset.name)}
                                                    title="Delete preset"
                                                >
                                                    <Trash2 size={12}/>
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="theme-preset-swatches">
                                <div className="theme-preset-swatch" style={{backgroundColor: preset.colors.primary}}/>
                                <div className="theme-preset-swatch"
                                     style={{backgroundColor: preset.colors.secondary}}/>
                                <div className="theme-preset-swatch" style={{backgroundColor: preset.colors.accent}}/>
                                <div className="theme-preset-swatch"
                                     style={{backgroundColor: preset.colors.background}}/>
                                <div className="theme-preset-swatch" style={{backgroundColor: preset.colors.text}}/>
                            </div>
                        </div>
                    )
                })}
            </div>

            <CreatePresetModal
                isOpen={isCreateModalOpen}
                initialTheme={currentTheme}
                onClose={() => setIsCreateModalOpen(false)}
                onCreate={onCreatePreset}
            />
        </div>
    )
}

// ─── Main ThemeEditor ─────────────────────────────────────────────────────────

export default function ThemeEditor({isOpen, onClose}: ThemeEditorProps): JSX.Element | null {
    const [activeTab, setActiveTab] = useState<ThemeTab>('colors');
    const [editingMode, setEditingMode] = useState<PageThemeMode>('light');
    const theme = useProjectStore((s) => s.settings.theme);
    const themeVariants = useProjectStore((s) => s.settings.themes);
    const customPresets = useProjectStore((s) => s.customPresets);
    const setProjectTheme = useProjectStore((s) => s.setProjectTheme);
    const setThemePreviewMode = useProjectStore((s) => s.setThemePreviewMode);
    const addCustomPreset = useProjectStore((s) => s.addCustomPreset);
    const updateCustomPreset = useProjectStore((s) => s.updateCustomPreset);
    const deleteCustomPreset = useProjectStore((s) => s.deleteCustomPreset);
    const updateThemeColors = useProjectStore((s) => s.updateThemeColors);
    const updateThemeTypography = useProjectStore((s) => s.updateThemeTypography);
    const updateThemeSpacing = useProjectStore((s) => s.updateThemeSpacing);
    const updateThemeBorders = useProjectStore((s) => s.updateThemeBorders);
    const showToast = useToastStore((s) => s.showToast);
    const selectedTheme = getThemeVariant(theme, themeVariants, editingMode);

    const getUniquePresetName = useCallback((baseName: string) => {
        const reserved = new Set<string>([...themePresets.map((p) => p.name), ...customPresets.map((p) => p.name)]);
        if (!reserved.has(baseName)) return baseName;
        let i = 2;
        while (reserved.has(`${baseName} (${i})`)) i++;
        return `${baseName} (${i})`
    }, [customPresets]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        setEditingMode('light');
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented) return;
            if (e.key === 'Escape') onClose()
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose]);

    const handleReset = useCallback(() => {
        const resetTheme = editingMode === 'dark' ? createDefaultDarkTheme() : createDefaultTheme();
        setProjectTheme(resetTheme, editingMode);
        showToast(`${editingMode === 'dark' ? 'Dark' : 'Light'} page theme reset to defaults`, 'success')
    }, [editingMode, setProjectTheme, showToast]);

    const handleExportTheme = useCallback(() => {
        const exportTheme: ProjectTheme = {...selectedTheme, isCustom: true};
        const json = JSON.stringify(exportTheme, null, 2);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedTheme.name.toLowerCase().replace(/\s+/g, '-')}.hoarses-theme.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Theme exported', 'success')
    }, [selectedTheme, showToast]);

    const handleImportTheme = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.hoarses-theme.json';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const parsed = JSON.parse(text) as Partial<ProjectTheme>;

                // Validate required fields
                if (!parsed.colors || !parsed.typography || !parsed.spacing || !parsed.borders) {
                    showToast('Invalid theme file: missing required sections', 'error');
                    return
                }

                // Merge with defaults to fill any missing fields
                const defaultTheme = createDefaultTheme();
                const rawName = parsed.name || file.name.replace(/\..*$/, '');
                const imported: ProjectTheme = {
                    name: getUniquePresetName(rawName),
                    isCustom: true,
                    colors: {...defaultTheme.colors, ...parsed.colors},
                    typography: {...defaultTheme.typography, ...parsed.typography},
                    spacing: {...defaultTheme.spacing, ...parsed.spacing},
                    borders: {...defaultTheme.borders, ...parsed.borders},
                    customCss: typeof parsed.customCss === 'string' ? parsed.customCss : '',
                    customCssFiles: Array.isArray(parsed.customCssFiles) ? parsed.customCssFiles : []
                };

                addCustomPreset(imported);
                setProjectTheme(imported, editingMode);
                showToast(`Theme "${imported.name}" imported and applied to ${editingMode} page`, 'success')
            } catch (err) {
                showToast('Failed to parse theme file', 'error')
            }
        };
        input.click()
    }, [setProjectTheme, showToast, addCustomPreset, getUniquePresetName, editingMode]);

    const handleApplyPreset = useCallback((preset: ProjectTheme) => {
        const mergedPreset: ProjectTheme = {
            ...preset,
            customCss: selectedTheme.customCss,
            customCssFiles: Array.isArray(selectedTheme.customCssFiles)
                ? selectedTheme.customCssFiles.map((file) => ({...file}))
                : []
        };
        setProjectTheme(mergedPreset, editingMode);
        showToast(`Applied "${preset.name}" to ${editingMode} page`, 'success')
    }, [editingMode, selectedTheme, setProjectTheme, showToast]);

    const handleCreatePreset = useCallback((name: string, colors: ThemeColors) => {
        const finalName = getUniquePresetName(name);
        const presetToSave: ProjectTheme = {
            ...selectedTheme,
            name: finalName,
            colors,
            isCustom: true
        };
        addCustomPreset(presetToSave);
        setProjectTheme(presetToSave, editingMode);
        showToast(`Created preset "${finalName}"`, 'success')
    }, [selectedTheme, addCustomPreset, showToast, getUniquePresetName, editingMode, setProjectTheme]);

    const handleUpdatePreset = useCallback((name: string, preset: ProjectTheme) => {
        updateCustomPreset(name, preset);
        showToast(`Updated preset "${preset.name}"`, 'success')
    }, [updateCustomPreset, showToast]);

    const handleDeletePreset = useCallback((name: string) => {
        deleteCustomPreset(name);
        showToast(`Deleted preset "${name}"`, 'success')
    }, [deleteCustomPreset, showToast]);

    if (!isOpen) return null;

    const tabs: { id: ThemeTab; label: string }[] = [
        {id: 'presets', label: 'Presets'},
        {id: 'colors', label: 'Colors'},
        {id: 'typography', label: 'Typography'},
        {id: 'fonts', label: 'Fonts'},
        {id: 'spacing', label: 'Spacing'},
        {id: 'borders', label: 'Borders'},
        {id: 'customCss', label: 'Custom CSS'}
    ];

    return (
        <div className="theme-editor-overlay" onClick={onClose}>
            <div className="theme-editor-dialog" data-tutorial="theme-editor-dialog"
                 onClick={(e) => e.stopPropagation()}>
                <div className="theme-editor-header">
                    <h2><Palette size={18}/> Theme Editor — {selectedTheme.name}</h2>
                    <button className="theme-editor-close" onClick={onClose} aria-label="Close">
                        <X size={18}/>
                    </button>
                </div>

                <div className="theme-editor-tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={`theme-editor-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                            data-tutorial={tab.id === 'colors' ? 'theme-colors-tab' : tab.id === 'customCss' ? 'theme-custom-css-tab' : tab.id === 'presets' ? 'theme-presets-tab' : undefined}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="theme-editor-mode-bar">
                    <div className="theme-editor-mode-group">
                        <span className="theme-editor-mode-label">Editing</span>
                        <button
                            className={`theme-btn theme-btn-small ${editingMode === 'light' ? 'theme-btn-primary' : ''}`}
                            onClick={() => setEditingMode('light')}
                        >
                            Light Page
                        </button>
                        <button
                            className={`theme-btn theme-btn-small ${editingMode === 'dark' ? 'theme-btn-primary' : ''}`}
                            onClick={() => setEditingMode('dark')}
                        >
                            Dark Page
                        </button>
                    </div>

                    <div className="theme-editor-mode-group">
                        <span className="theme-editor-mode-label">Page Preview</span>
                        <button
                            className={`theme-btn theme-btn-small ${themeVariants?.previewMode === 'device' ? 'theme-btn-primary' : ''}`}
                            onClick={() => setThemePreviewMode('device')}
                        >
                            Device
                        </button>
                        <button
                            className={`theme-btn theme-btn-small ${themeVariants?.previewMode === 'light' ? 'theme-btn-primary' : ''}`}
                            onClick={() => setThemePreviewMode('light')}
                        >
                            Light
                        </button>
                        <button
                            className={`theme-btn theme-btn-small ${themeVariants?.previewMode === 'dark' ? 'theme-btn-primary' : ''}`}
                            onClick={() => setThemePreviewMode('dark')}
                        >
                            Dark
                        </button>
                    </div>
                </div>

                <div className="theme-editor-content">
                    {activeTab === 'presets' && (
                        <PresetsTab
                            currentTheme={selectedTheme}
                            customPresets={customPresets}
                            editingMode={editingMode}
                            onApplyPreset={handleApplyPreset}
                            onCreatePreset={handleCreatePreset}
                            onUpdatePreset={handleUpdatePreset}
                            onDeletePreset={handleDeletePreset}
                        />
                    )}
                    {activeTab === 'colors' && (
                        <ColorsTab colors={selectedTheme.colors}
                                   onChange={(patch) => updateThemeColors(patch, editingMode)}/>
                    )}
                    {activeTab === 'typography' && (
                        <TypographyTab typography={selectedTheme.typography}
                                       onChange={(patch) => updateThemeTypography(patch, editingMode)}/>
                    )}
                    {activeTab === 'spacing' && (
                        <SpacingTab spacing={selectedTheme.spacing}
                                    onChange={(patch) => updateThemeSpacing(patch, editingMode)}/>
                    )}
                    {activeTab === 'borders' && (
                        <BordersTab borders={selectedTheme.borders}
                                    onChange={(patch) => updateThemeBorders(patch, editingMode)}/>
                    )}
                    {activeTab === 'customCss' && (
                        <CustomCssManager theme={selectedTheme}/>
                    )}
                    {activeTab === 'fonts' && (
                        <FontManager/>
                    )}
                </div>

                <div className="theme-editor-footer">
                    <div className="theme-editor-footer-left">
                        <button className="theme-btn" onClick={handleImportTheme}>
                            <Upload size={14}/> Import
                        </button>
                        <button className="theme-btn" onClick={handleExportTheme}>
                            <Download size={14}/> Export
                        </button>
                    </div>
                    <div className="theme-editor-footer-right">
                        <button className="theme-btn" onClick={handleReset}>
                            <RotateCcw size={14}/> Reset
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
