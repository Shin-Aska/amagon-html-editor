import {useEffect} from 'react'
import {
    Clipboard,
    Code,
    Command,
    Copy,
    FolderOpen,
    HelpCircle,
    Layout,
    Menu,
    Moon,
    Redo,
    Save,
    Scissors,
    Search,
    Settings,
    Trash2,
    Undo,
    X
} from 'lucide-react'
import './KeyboardShortcutsHelp.css'

interface KeyboardShortcutsHelpProps {
    isOpen: boolean
    onClose: () => void
}

interface ShortcutCategory {
    name: string
    shortcuts: { key: string; description: string; icon?: React.ReactNode }[]
}

const shortcutCategories: ShortcutCategory[] = [
    {
        name: 'File Operations',
        shortcuts: [
            {key: 'Ctrl+S', description: 'Save project', icon: <Save size={14}/>},
            {key: 'Ctrl+Shift+S', description: 'Save As'},
            {key: 'Ctrl+O', description: 'Open project', icon: <FolderOpen size={14}/>},
        ]
    },
    {
        name: 'Edit Operations',
        shortcuts: [
            {key: 'Ctrl+Z', description: 'Undo', icon: <Undo size={14}/>},
            {key: 'Ctrl+Y', description: 'Redo', icon: <Redo size={14}/>},
            {key: 'Ctrl+Shift+Z', description: 'Redo (alternate)'},
            {key: 'Ctrl+C', description: 'Copy selected block', icon: <Copy size={14}/>},
            {key: 'Ctrl+X', description: 'Cut selected block', icon: <Scissors size={14}/>},
            {key: 'Ctrl+V', description: 'Paste block', icon: <Clipboard size={14}/>},
            {key: 'Ctrl+D', description: 'Duplicate selected block'},
            {key: 'Delete / Backspace', description: 'Delete selected block', icon: <Trash2 size={14}/>},
        ]
    },
    {
        name: 'View & Panels',
        shortcuts: [
            {key: 'Ctrl+E', description: 'Toggle code editor', icon: <Code size={14}/>},
            {key: 'Ctrl+\\', description: 'Toggle left sidebar', icon: <Menu size={14}/>},
            {key: 'Ctrl+/', description: 'Toggle right sidebar', icon: <Settings size={14}/>},
            {key: 'Ctrl+M', description: 'Toggle theme (dark/light)', icon: <Moon size={14}/>},
        ]
    },
    {
        name: 'Layout Switching',
        shortcuts: [
            {key: 'F1', description: 'Standard layout', icon: <Layout size={14}/>},
            {key: 'F2', description: 'No Sidebar (canvas + inspector)'},
            {key: 'F3', description: 'No Inspector (canvas + sidebar)'},
            {key: 'F4', description: 'Canvas Only'},
            {key: 'F5', description: 'Code Focus (canvas + code editor)'},
            {key: 'F6', description: 'Zen Mode (canvas + code + inspector)'},
        ]
    },
    {
        name: 'Navigation',
        shortcuts: [
            {key: 'Escape', description: 'Deselect / Cancel drag'},
            {key: 'Arrow Keys', description: 'Navigate between blocks'},
            {key: 'Tab', description: 'Navigate into child blocks'},
            {key: 'Shift+Tab', description: 'Navigate to parent block'},
        ]
    },
    {
        name: 'Tools',
        shortcuts: [
            {key: 'Ctrl+K', description: 'Open command palette', icon: <Search size={14}/>},
            {key: 'Ctrl+?', description: 'Show this help dialog', icon: <HelpCircle size={14}/>},
        ]
    }
];

export default function KeyboardShortcutsHelp({isOpen, onClose}: KeyboardShortcutsHelpProps): JSX.Element | null {
    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="shortcuts-overlay" onClick={onClose}>
            <div className="shortcuts-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="shortcuts-header">
                    <h2><Command size={20}/> Keyboard Shortcuts</h2>
                    <button className="shortcuts-close" onClick={onClose} aria-label="Close">
                        <X size={18}/>
                    </button>
                </div>

                <div className="shortcuts-content">
                    {shortcutCategories.map((category) => (
                        <div key={category.name} className="shortcuts-category">
                            <h3>{category.name}</h3>
                            <div className="shortcuts-list">
                                {category.shortcuts.map((shortcut, index) => (
                                    <div key={index} className="shortcut-item">
                    <span className="shortcut-keys">
                      {shortcut.key.split(' ').map((part, i) => (
                          <span key={i}>
                          {part.split('+').map((key, j) => (
                              <kbd key={j}>{key}</kbd>
                          ))}
                              {i < shortcut.key.split(' ').length - 1 && <span> / </span>}
                        </span>
                      ))}
                    </span>
                                        <span className="shortcut-description">
                      {shortcut.icon && <span className="shortcut-icon">{shortcut.icon}</span>}
                                            {shortcut.description}
                    </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="shortcuts-footer">
                    <p>Press <kbd>Escape</kbd> to close this dialog</p>
                </div>
            </div>
        </div>
    )
}
