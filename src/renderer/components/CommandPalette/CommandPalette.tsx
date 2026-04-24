import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {
    Box,
    Code,
    Command,
    Copy,
    Download,
    FilePlus,
    FolderOpen,
    Grid3x3,
    Image as ImageIcon,
    LayoutGrid,
    Moon,
    MousePointerClick,
    PanelLeft,
    PanelRight,
    Redo,
    Save,
    Scissors,
    SeparatorHorizontal,
    Sun,
    Trash2,
    Type,
    Undo
} from 'lucide-react'
import {useEditorStore} from '../../store/editorStore'
import {useProjectStore} from '../../store/projectStore'
import {buildDefaultBlockProps, componentRegistry} from '../../registry/ComponentRegistry'
import {createBlock} from '../../store/types'
import './CommandPalette.css'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onNewProject: () => void
  onOpen: () => void
  onSave: () => void
  onExport: () => void
  onToggleCodeEditor: () => void
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
}

interface PaletteItem {
  id: string
  type: 'command' | 'block'
  label: string
  icon: React.ReactNode
  shortcut?: string
  keywords: string[]
  action: () => void
}

export default function CommandPalette({
  isOpen,
  onClose,
  onNewProject,
  onOpen,
  onSave,
  onExport,
  onToggleCodeEditor,
  onToggleLeftPanel,
  onToggleRightPanel
}: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Store access
  const blocks = useEditorStore((s) => s.blocks);
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId);
  const addBlock = useEditorStore((s) => s.addBlock);
  const selectBlock = useEditorStore((s) => s.selectBlock);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const setClipboard = useEditorStore((s) => s.setClipboard);
  const getBlockById = useEditorStore((s) => s.getBlockById);
  const removeBlock = useEditorStore((s) => s.removeBlock);
  const theme = useEditorStore((s) => s.theme);
  const setTheme = useEditorStore((s) => s.setTheme);
  const userBlocks = useProjectStore((s) => s.userBlocks);

  // Build palette items
  const items: PaletteItem[] = useMemo(() => {
    const result: PaletteItem[] = [];

    // Commands
    result.push(
      {
        id: 'cmd-new-project',
        type: 'command',
        label: 'New Project',
        icon: <FilePlus size={16} />,
        shortcut: 'Ctrl+N',
        keywords: ['new', 'project', 'create'],
        action: () => {
          onNewProject();
          onClose()
        }
      },
      {
        id: 'cmd-open',
        type: 'command',
        label: 'Open Project',
        icon: <FolderOpen size={16} />,
        shortcut: 'Ctrl+O',
        keywords: ['open', 'load', 'project', 'file'],
        action: () => {
          onOpen();
          onClose()
        }
      },
      {
        id: 'cmd-save',
        type: 'command',
        label: 'Save Project',
        icon: <Save size={16} />,
        shortcut: 'Ctrl+S',
        keywords: ['save', 'project', 'file'],
        action: () => {
          onSave();
          onClose()
        }
      },
      {
        id: 'cmd-export',
        type: 'command',
        label: 'Export HTML',
        icon: <Download size={16} />,
        shortcut: 'Ctrl+E',
        keywords: ['export', 'html', 'download', 'build'],
        action: () => {
          onExport();
          onClose()
        }
      },
      {
        id: 'cmd-undo',
        type: 'command',
        label: 'Undo',
        icon: <Undo size={16} />,
        shortcut: 'Ctrl+Z',
        keywords: ['undo', 'revert', 'back'],
        action: () => {
          undo();
          onClose()
        }
      },
      {
        id: 'cmd-redo',
        type: 'command',
        label: 'Redo',
        icon: <Redo size={16} />,
        shortcut: 'Ctrl+Y',
        keywords: ['redo', 'restore', 'forward'],
        action: () => {
          redo();
          onClose()
        }
      },
      {
        id: 'cmd-cut',
        type: 'command',
        label: 'Cut Block',
        icon: <Scissors size={16} />,
        shortcut: 'Ctrl+X',
        keywords: ['cut', 'block', 'move'],
        action: () => {
          if (selectedBlockId) {
            const block = getBlockById(selectedBlockId);
            if (block) {
              setClipboard({ ...block, id: selectedBlockId });
              removeBlock(selectedBlockId)
            }
          }
          onClose()
        }
      },
      {
        id: 'cmd-copy',
        type: 'command',
        label: 'Copy Block',
        icon: <Copy size={16} />,
        shortcut: 'Ctrl+C',
        keywords: ['copy', 'block', 'duplicate', 'clone'],
        action: () => {
          if (selectedBlockId) {
            const block = getBlockById(selectedBlockId);
            if (block) {
              setClipboard({ ...block, id: selectedBlockId })
            }
          }
          onClose()
        }
      },
      {
        id: 'cmd-duplicate',
        type: 'command',
        label: 'Duplicate Block',
        icon: <Copy size={16} />,
        shortcut: 'Ctrl+D',
        keywords: ['duplicate', 'copy', 'block', 'clone'],
        action: () => {
          // This is handled by keyboard shortcuts
          onClose()
        }
      },
      {
        id: 'cmd-delete',
        type: 'command',
        label: 'Delete Block',
        icon: <Trash2 size={16} />,
        shortcut: 'Delete',
        keywords: ['delete', 'remove', 'block'],
        action: () => {
          if (selectedBlockId) {
            removeBlock(selectedBlockId)
          }
          onClose()
        }
      },
      {
        id: 'cmd-toggle-code',
        type: 'command',
        label: 'Toggle Code Editor',
        icon: <Code size={16} />,
        shortcut: 'Ctrl+E',
        keywords: ['code', 'editor', 'html', 'toggle'],
        action: () => {
          onToggleCodeEditor();
          onClose()
        }
      },
      {
        id: 'cmd-toggle-left',
        type: 'command',
        label: 'Toggle Left Panel',
        icon: <PanelLeft size={16} />,
        shortcut: 'Ctrl+\\',
        keywords: ['panel', 'left', 'sidebar', 'toggle', 'widgets'],
        action: () => {
          onToggleLeftPanel();
          onClose()
        }
      },
      {
        id: 'cmd-toggle-right',
        type: 'command',
        label: 'Toggle Right Panel',
        icon: <PanelRight size={16} />,
        shortcut: 'Ctrl+/',
        keywords: ['panel', 'right', 'inspector', 'toggle', 'properties'],
        action: () => {
          onToggleRightPanel();
          onClose()
        }
      },
      {
        id: 'cmd-theme',
        type: 'command',
        label: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`,
        icon: theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />,
        keywords: ['theme', 'dark', 'light', 'toggle', 'mode'],
        action: () => {
          setTheme(theme === 'dark' ? 'light' : 'dark');
          onClose()
        }
      }
    );

    // Block types from registry
    const blockCategories: Record<string, { icon: React.ReactNode; keywords: string[] }> = {
      'container': { icon: <Box size={16} />, keywords: ['container', 'wrapper', 'div'] },
      'row': { icon: <LayoutGrid size={16} />, keywords: ['row', 'grid', 'layout'] },
      'column': { icon: <Grid3x3 size={16} />, keywords: ['column', 'col', 'grid'] },
      'heading': { icon: <Type size={16} />, keywords: ['heading', 'title', 'h1', 'h2', 'text'] },
      'paragraph': { icon: <Type size={16} />, keywords: ['paragraph', 'text', 'content'] },
      'image': { icon: <ImageIcon size={16} />, keywords: ['image', 'picture', 'photo', 'img'] },
      'button': { icon: <MousePointerClick size={16} />, keywords: ['button', 'btn', 'click'] },
      'divider': { icon: <SeparatorHorizontal size={16} />, keywords: ['divider', 'line', 'separator', 'hr'] }
    };

    // Add blocks from registry
    const registryBlocks = componentRegistry.getAll();
    for (const def of registryBlocks) {
      const category = blockCategories[def.type] || { icon: <Box size={16} />, keywords: [def.type] };
      result.push({
        id: `block-${def.type}`,
        type: 'block',
        label: `Insert ${def.label}`,
        icon: category.icon,
        keywords: [...category.keywords, def.label.toLowerCase(), def.type, 'insert', 'add', 'block'],
        action: () => {
          const newBlock = createBlock(def.type, {
            props: buildDefaultBlockProps(def),
            classes: def.defaultClasses ? [...def.defaultClasses] : [],
            styles: {...def.defaultStyles}
          });
          
          // Add as child of selected or at root
          const parentId = selectedBlockId || null;
          addBlock(newBlock, parentId);
          selectBlock(newBlock.id);
          onClose()
        }
      })
    }

    return result
  }, [
    blocks,
    selectedBlockId,
    theme,
    userBlocks,
    onNewProject,
    onOpen,
    onSave,
    onExport,
    onToggleCodeEditor,
    onToggleLeftPanel,
    onToggleRightPanel,
    undo,
    redo,
    setClipboard,
    getBlockById,
    removeBlock,
    addBlock,
    selectBlock,
    setTheme,
    onClose
  ]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;

    const q = query.toLowerCase().trim();
    return items.filter(item => {
      return item.label.toLowerCase().includes(q) ||
             item.keywords.some(k => k.toLowerCase().includes(q))
    })
  }, [items, query]);

  // Reset selection when filtered items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredItems.length, query]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0)
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < filteredItems.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev > 0 ? prev - 1 : filteredItems.length - 1
      )
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filteredItems[selectedIndex];
      if (item) {
        item.action()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose()
    }
  }, [filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <div className="command-palette-header">
          <Command size={18} className="command-palette-icon" />
          <input
            ref={inputRef}
            className="command-palette-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or block name..."
          />
          <kbd className="command-palette-kbd">ESC</kbd>
        </div>

        {filteredItems.length > 0 ? (
          <div className="command-palette-list">
            {filteredItems.map((item, index) => (
              <div
                key={item.id}
                className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="command-palette-item-icon">{item.icon}</div>
                <div className="command-palette-item-label">{item.label}</div>
                {item.shortcut && (
                  <div className="command-palette-item-shortcut">{item.shortcut}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="command-palette-empty">
            No results found for &quot;{query}&quot;
          </div>
        )}

        <div className="command-palette-footer">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Execute</span>
          <span><kbd>ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
