import { useEffect, useRef } from 'react'
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

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    // Close on any click (even inside, usually context menus close on action)
    // Actually, usually close on action or click outside. 
    // Let's attach to window to catch everything.
    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  // Adjust position to stay in viewport
  const style = {
    top: y,
    left: x
  }

  // Simple adjustment logic could be added here or via useLayoutEffect to measure ref

  return (
    <div className="context-menu" style={style} ref={menuRef}>
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={index} className="context-menu-divider" />
        }

        return (
          <div
            key={index}
            className={`context-menu-item ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''}`}
            onClick={() => {
              if (!item.disabled && item.action) {
                item.action()
                onClose()
              }
            }}
          >
            <div className="context-menu-item-icon">{item.icon}</div>
            <div className="context-menu-item-label">{item.label}</div>
            {item.shortcut && <div className="context-menu-item-shortcut">{item.shortcut}</div>}
          </div>
        )
      })}
    </div>
  )
}
