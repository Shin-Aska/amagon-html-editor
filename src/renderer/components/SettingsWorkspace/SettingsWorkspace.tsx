import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Folder, Monitor, X } from 'lucide-react';
import './SettingsWorkspace.css';

export interface SettingsSection<T extends string> {
    id: T;
    label: string;
    description: string;
    icon: ReactNode;
    tutorial?: string;
}

interface SettingsWorkspaceProps<T extends string> {
    title: string;
    subtitle: string;
    icon: ReactNode;
    scope: 'project' | 'application';
    className: string;
    closeClassName: string;
    tutorial: string;
    sections: readonly SettingsSection<T>[];
    activeSection: T;
    onSectionChange: (section: T) => void;
    onClose: () => void;
    footer: ReactNode;
    children: ReactNode;
}

export default function SettingsWorkspace<T extends string>({
    title, subtitle, icon, scope, className, closeClassName, tutorial,
    sections, activeSection, onSectionChange, onClose, footer, children,
}: SettingsWorkspaceProps<T>): JSX.Element {
    const titleId = useId();
    const contentId = useId();
    const closeRef = useRef<HTMLButtonElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const scrollPositions = useRef(new Map<T, number>());
    const section = sections.find((item) => item.id === activeSection);

    useEffect(() => {
        const previousFocus = document.activeElement;
        closeRef.current?.focus();
        return () => {
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
        };
    }, []);

    useLayoutEffect(() => {
        if (contentRef.current) contentRef.current.scrollTop = scrollPositions.current.get(activeSection) ?? 0;
    }, [activeSection]);

    const containFocus = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.key !== 'Tab' || !(event.target instanceof Element)
            || event.target.closest('[role="dialog"]') !== event.currentTarget) return;
        const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        )].filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    };

    return (
        <div className={`settings-workspace ${className}`} role="dialog" aria-modal="true"
            aria-labelledby={titleId} data-tutorial={tutorial} onKeyDown={containFocus}
            onClick={(event) => event.stopPropagation()}>
            <header className="settings-workspace-header">
                <span className="settings-workspace-icon" aria-hidden="true">{icon}</span>
                <div className="settings-workspace-title">
                    <h2 id={titleId}>{title}</h2>
                    <p>{subtitle}</p>
                </div>
                <button ref={closeRef} className={`settings-workspace-close ${closeClassName}`}
                    onClick={onClose} aria-label="Close" title="Close"><X size={20} /></button>
            </header>
            <div className="settings-workspace-layout">
                <aside className="settings-workspace-sidebar">
                    <nav aria-label={`${title} sections`}>
                        {sections.map((item) => (
                            <button key={item.id} className="settings-workspace-nav-item"
                                aria-current={activeSection === item.id ? 'page' : undefined}
                                aria-controls={contentId} data-tutorial={item.tutorial}
                                onClick={() => onSectionChange(item.id)}>
                                <span aria-hidden="true">{item.icon}</span>{item.label}
                            </button>
                        ))}
                    </nav>
                    <div className="settings-workspace-scope">
                        {scope === 'project' ? <Folder size={16} aria-hidden="true" /> : <Monitor size={16} aria-hidden="true" />}
                        <span>{scope === 'project' ? 'Saved with this project' : 'This application'}</span>
                    </div>
                </aside>
                <div id={contentId} ref={contentRef} className="settings-workspace-content"
                    onScroll={(event) => scrollPositions.current.set(activeSection, event.currentTarget.scrollTop)}>
                    <div className="settings-workspace-section-heading">
                        <h3>{section?.label}</h3>
                        <p>{section?.description}</p>
                    </div>
                    {children}
                </div>
            </div>
            <footer className="settings-workspace-footer">{footer}</footer>
        </div>
    );
}
