import {useEffect, useRef} from 'react'
import './ContextMenu.css'

export interface ContextMenuItem {
    label: string
    icon?: React.ReactNode
    shortcut?: string
    action?: () => void
    disabled?: boolean
    danger?: boolean
    divider?: boolean
}

interface ContextMenuProps {
    x: number
    y: number
    items: ContextMenuItem[]
    onClose: () => void
}

export default function ContextMenu({x, y, items, onClose}: ContextMenuProps): JSX.Element {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose()
            }
        };

        // Close on any click (even inside, usually context menus close on action)
        // Actually, usually close on action or click outside.
        // Let's attach to window to catch everything.
        window.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', onClose, true);
        window.addEventListener('resize', onClose);

        return () => {
            window.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', onClose, true);
            window.removeEventListener('resize', onClose)
        }
    }, [onClose]);

    useEffect(() => {
        const previousFocus = document.activeElement;
        const menu = menuRef.current;
        menu?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll: true});
        return () => {
            if (previousFocus instanceof HTMLElement && (document.activeElement === document.body || menu?.contains(document.activeElement))) {
                previousFocus.focus({preventScroll: true})
            }
        }
    }, []);

    // Adjust position to stay in viewport
    const style = {
        top: y,
        left: x
    };

    // Simple adjustment logic could be added here or via useLayoutEffect to measure ref

    return (
        <div className="context-menu" role="menu" aria-label="Actions" style={style} ref={menuRef}
            onKeyDown={event => {
                if (event.key === 'Escape' || event.key === 'Tab') {
                    if (event.key === 'Escape') event.preventDefault();
                    onClose();
                    return
                }
                if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
                const current = buttons.findIndex(button => button === document.activeElement);
                const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                    : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
                buttons[index]?.focus({preventScroll: true})
            }}>
            {items.map((item, index) => {
                if (item.divider) {
                    return <div key={index} className="context-menu-divider"/>
                }

                return (
                    <button
                        type="button" role="menuitem" tabIndex={-1} disabled={item.disabled}
                        key={index}
                        className={`context-menu-item ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''}`}
                        onClick={() => {
                            if (!item.disabled && item.action) {
                                item.action();
                                onClose()
                            }
                        }}
                    >
                        <span className="context-menu-item-icon">{item.icon}</span>
                        <span className="context-menu-item-label">{item.label}</span>
                        {item.shortcut && <span className="context-menu-item-shortcut">{item.shortcut}</span>}
                    </button>
                )
            })}
        </div>
    )
}
