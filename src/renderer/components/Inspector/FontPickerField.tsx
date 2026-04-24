/**
 * FontPickerField — per-block font override in the Inspector
 * Button trigger (not textbox) → portal dropdown with search + visual font list
 */
import {useEffect, useMemo, useRef, useState} from 'react'
import ReactDOM from 'react-dom'
import {useProjectStore} from '../../store/projectStore'
import './FontPickerField.css'

interface FontPickerFieldProps {
    value: string
    onChange: (value: string) => void
}

interface FontOption {
    label: string
    value: string
    group: string
}

const PRESET_FONTS: FontOption[] = [
    // System
    {label: 'Inherit (theme default)', value: '', group: 'System'},
    {label: 'System Default', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', group: 'System'},
    {label: 'System Serif', value: 'ui-serif, Georgia, Cambria, "Times New Roman", serif', group: 'System'},
    {label: 'System Mono', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace', group: 'System'},
    // Sans-Serif
    {label: 'Inter', value: 'Inter, system-ui, sans-serif', group: 'Sans-Serif'},
    {label: 'Roboto', value: 'Roboto, Arial, sans-serif', group: 'Sans-Serif'},
    {label: 'Open Sans', value: '"Open Sans", Arial, sans-serif', group: 'Sans-Serif'},
    {label: 'Lato', value: 'Lato, Arial, sans-serif', group: 'Sans-Serif'},
    {label: 'Poppins', value: 'Poppins, system-ui, sans-serif', group: 'Sans-Serif'},
    {label: 'Nunito', value: 'Nunito, system-ui, sans-serif', group: 'Sans-Serif'},
    {label: 'Montserrat', value: 'Montserrat, system-ui, sans-serif', group: 'Sans-Serif'},
    {label: 'DM Sans', value: '"DM Sans", system-ui, sans-serif', group: 'Sans-Serif'},
    {label: 'Outfit', value: 'Outfit, system-ui, sans-serif', group: 'Sans-Serif'},
    {label: 'Arial', value: 'Arial, Helvetica, sans-serif', group: 'Sans-Serif'},
    {label: 'Helvetica Neue', value: '"Helvetica Neue", Helvetica, Arial, sans-serif', group: 'Sans-Serif'},
    {label: 'Verdana', value: 'Verdana, Geneva, sans-serif', group: 'Sans-Serif'},
    // Serif
    {label: 'Playfair Display', value: '"Playfair Display", Georgia, serif', group: 'Serif'},
    {label: 'Lora', value: 'Lora, Georgia, serif', group: 'Serif'},
    {label: 'Merriweather', value: 'Merriweather, Georgia, serif', group: 'Serif'},
    {label: 'Georgia', value: 'Georgia, serif', group: 'Serif'},
    {label: 'Times New Roman', value: '"Times New Roman", Times, serif', group: 'Serif'},
    // Display
    {label: 'Space Grotesk', value: '"Space Grotesk", system-ui, sans-serif', group: 'Display'},
    {label: 'Sora', value: 'Sora, system-ui, sans-serif', group: 'Display'},
    {label: 'Manrope', value: 'Manrope, system-ui, sans-serif', group: 'Display'},
    // Monospace
    {label: 'Fira Code', value: '"Fira Code", Consolas, monospace', group: 'Monospace'},
    {label: 'JetBrains Mono', value: '"JetBrains Mono", Menlo, monospace', group: 'Monospace'},
    {label: 'Courier New', value: '"Courier New", Courier, monospace', group: 'Monospace'},
];

const GROUPS = ['Imported', 'System', 'Sans-Serif', 'Serif', 'Display', 'Monospace'] as const;

export default function FontPickerField({value, onChange}: FontPickerFieldProps): JSX.Element {
    const managedFonts = useProjectStore((s) => s.fonts);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [portalStyle, setPortalStyle] = useState<{ [k: string]: string | number }>({});

    const triggerRef = useRef<HTMLButtonElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const allOptions = useMemo<FontOption[]>(() => {
        const managed: FontOption[] = managedFonts
            .filter((f) => f.name.trim())
            .map((f) => ({label: f.name, value: f.name, group: 'Imported'}));
        return [...managed, ...PRESET_FONTS]
    }, [managedFonts]);

    const currentOption = useMemo(() => {
        return allOptions.find((o) => o.value === value) ?? {label: value || 'Inherit', value: value || '', group: ''}
    }, [allOptions, value]);

    const filteredOptions = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return allOptions;
        return allOptions.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
    }, [allOptions, search]);

    const groups = useMemo(() => {
        return GROUPS
            .map((g) => ({group: g, items: filteredOptions.filter((o) => o.group === g)}))
            .filter((g) => g.items.length > 0)
    }, [filteredOptions]);

    const openDropdown = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropH = 300;
        // flip up if not enough space below
        const flipUp = spaceBelow < dropH + 12 && spaceAbove > spaceBelow;
        setPortalStyle({
            position: 'fixed',
            top: flipUp ? rect.top - Math.min(dropH, spaceAbove - 12) : rect.bottom + 3,
            left: rect.left,
            width: Math.max(rect.width, 220),
            maxHeight: flipUp ? Math.min(dropH, spaceAbove - 12) : Math.min(dropH, spaceBelow - 12),
            zIndex: 99999,
        });
        setSearch('');
        setOpen(true)
    };

    useEffect(() => {
        if (!open) return;
        setTimeout(() => {
            searchRef.current?.focus();
            const active = listRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
            active?.scrollIntoView({block: 'nearest'})
        }, 0)
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const portal = document.getElementById('font-picker-portal');
            if (!triggerRef.current?.contains(e.target as Node) && !portal?.contains(e.target as Node)) {
                setOpen(false)
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler)
    }, [open]);

    const commit = (v: string) => {
        onChange(v);
        setOpen(false);
        setSearch('')
    };

    const dropdown = (
        <div id="font-picker-portal" className="fp-dropdown" style={portalStyle as React.CSSProperties}>
            <div className="fp-search-bar">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="fp-search-icon">
                    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                    ref={searchRef}
                    type="text"
                    className="fp-search-input"
                    placeholder="Search fonts…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setOpen(false);
                            setSearch('')
                        }
                    }}
                />
                {search && <button type="button" className="fp-search-clear" onClick={() => setSearch('')}>×</button>}
            </div>
            <div className="fp-list" ref={listRef}>
                {groups.length === 0 && <div className="fp-empty">No fonts match "{search}"</div>}
                {groups.map(({group, items}) => (
                    <div key={group}>
                        <div className="fp-group-header">{group}</div>
                        {items.map((opt) => {
                            const isActive = opt.value === value;
                            return (
                                <button
                                    key={opt.value + opt.group}
                                    type="button"
                                    data-active={isActive}
                                    className={`fp-option ${isActive ? 'is-active' : ''}`}
                                    style={{fontFamily: opt.value || 'inherit'}}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        commit(opt.value)
                                    }}
                                >
                                    <span className="fp-option-name">{opt.label}</span>
                                    {isActive && (
                                        <svg className="fp-option-check" viewBox="0 0 12 9" width="12" height="9"
                                             fill="none">
                                            <path d="M1 4.5L4.5 8 11 1" stroke="currentColor" strokeWidth="1.8"
                                                  strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="font-picker">
            <button
                ref={triggerRef}
                type="button"
                className={`fp-trigger ${open ? 'is-open' : ''}`}
                onClick={() => open ? setOpen(false) : openDropdown()}
                title={value}
            >
                <span className="fp-trigger-sample" style={{fontFamily: value || 'inherit'}}>Aa</span>
                <span className="fp-trigger-label" style={{fontFamily: value || 'inherit'}}>
          {currentOption.label}
        </span>
                <svg className="fp-trigger-chevron" viewBox="0 0 10 6" width="10" height="6" fill="none">
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                          strokeLinejoin="round"/>
                </svg>
            </button>
            {open && ReactDOM.createPortal(dropdown, document.body)}
        </div>
    )
}
