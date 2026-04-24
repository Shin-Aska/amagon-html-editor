import React, {Suspense, useMemo, useState} from 'react'
import BlockIcon from '../BlockIcon/BlockIcon'
import {Plus, X} from 'lucide-react'
import {
    allLucideIconNames,
    getLazyLucideIcon,
    isKnownLucideIcon,
    isRenderableGlyph,
    lucidePickerIcons,
    mapLegacyBootstrapIcon,
} from '../../utils/iconCatalog'
import './IconField.css'

interface IconFieldProps {
    value: string
    onChange: (value: string) => void
}

function LazyGridIcon({name}: { name: string }): JSX.Element | null {
    const LazyIcon = getLazyLucideIcon(name);
    if (!LazyIcon) return <div style={{width: 16, height: 16}}/>;
    return (
        <Suspense fallback={<div style={{width: 16, height: 16}}/>}>
            <LazyIcon size={16}/>
        </Suspense>
    )
}

function IconField({value, onChange}: IconFieldProps): JSX.Element {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const trimmed = String(value || '').trim();
    const lucideName = trimmed.startsWith('lucide:') ? trimmed.replace(/^lucide:/, '') : '';
    const legacyLucideName = mapLegacyBootstrapIcon(trimmed);
    const hasLucideIcon = isKnownLucideIcon(lucideName);
    const hasLegacyLucideIcon = !!legacyLucideName && isKnownLucideIcon(legacyLucideName);
    const hasGlyph = !trimmed ? false : isRenderableGlyph(trimmed);

    const query = searchQuery.trim().toLowerCase();
    const visibleIconNames = useMemo(() => {
        if (query.length < 2) return lucidePickerIcons;
        return allLucideIconNames.filter((n) => n.includes(query))
    }, [query]);

    return (
        <div className="icon-field">
            <div className="icon-field-controls">
                <button
                    type="button"
                    className={`icon-field-button ${!value ? 'empty' : ''}`}
                    onClick={() => {
                        setPickerOpen(true);
                        setSearchQuery('')
                    }}
                    title={value ? "Change Icon" : "Choose Icon"}
                >
                    {hasLucideIcon ? (
                        <BlockIcon name={lucideName} className="icon-field-lucide"/>
                    ) : hasLegacyLucideIcon ? (
                        <BlockIcon name={legacyLucideName!} className="icon-field-lucide"/>
                    ) : hasGlyph ? (
                        <span className="icon-field-glyph">{trimmed}</span>
                    ) : (
                        <Plus size={18} className="icon-field-plus"/>
                    )}
                </button>
                {value && (
                    <button
                        type="button"
                        className="icon-field-clear"
                        onClick={() => onChange('')}
                        title="Clear icon"
                    >
                        <X size={16}/>
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
                                <p>Select a Lucide icon or enter a custom value below.</p>
                            </div>
                            <button type="button" className="icon-field-modal-close"
                                    onClick={() => setPickerOpen(false)} aria-label="Close icon picker">
                                <X size={16}/>
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

                        <div className="icon-field-search-row">
                            <input
                                type="text"
                                className="icon-field-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search icons..."
                                autoFocus
                            />
                        </div>

                        <div className="icon-field-grid" role="list">
                            {visibleIconNames.length === 0 ? (
                                <div style={{
                                    gridColumn: '1 / -1',
                                    textAlign: 'center',
                                    padding: '16px 0',
                                    color: 'var(--color-text-muted)',
                                    fontSize: 12
                                }}>
                                    No icons match "{searchQuery}"
                                </div>
                            ) : (
                                visibleIconNames.map((iconName) => {
                                    const iconValue = `lucide:${iconName}`;
                                    const active = trimmed === iconValue;
                                    const isPopular = lucidePickerIcons.includes(iconName);
                                    return (
                                        <button
                                            key={iconValue}
                                            type="button"
                                            className={`icon-field-grid-btn ${active ? 'active' : ''}`}
                                            onClick={() => {
                                                onChange(iconValue);
                                                setPickerOpen(false);
                                                setSearchQuery('')
                                            }}
                                            title={`${iconValue}${isPopular ? ' (popular)' : ''}`}
                                        >
                                            <LazyGridIcon name={iconName}/>
                                        </button>
                                    )
                                })
                            )}
                        </div>

                        <div
                            style={{marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center'}}>
                            {query.length < 2
                                ? `Showing ${lucidePickerIcons.length} popular icons. Type to search ${allLucideIconNames.length}+ icons.`
                                : `Showing ${visibleIconNames.length} of ${allLucideIconNames.length} icons`}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default IconField
