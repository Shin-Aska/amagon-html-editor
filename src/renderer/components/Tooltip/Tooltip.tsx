import {useEffect, useRef, useState} from 'react'
import './Tooltip.css'

interface TooltipProps {
  children: React.ReactNode
  content: string
  shortcut?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export default function Tooltip({
  children,
  content,
  shortcut,
  position = 'bottom',
  delay = 300
}: TooltipProps): JSX.Element {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsVisible(false)
  }

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const tooltipEl = tooltipRef.current
      
      let x = 0
      let y = 0

      switch (position) {
        case 'top':
          x = rect.left + rect.width / 2
          y = rect.top
          break
        case 'bottom':
          x = rect.left + rect.width / 2
          y = rect.bottom
          break
        case 'left':
          x = rect.left
          y = rect.top + rect.height / 2
          break
        case 'right':
          x = rect.right
          y = rect.top + rect.height / 2
          break
      }

      setCoords({ x, y })

      // Adjust if tooltip would go off screen
      if (tooltipEl) {
        const tooltipRect = tooltipEl.getBoundingClientRect()
        const padding = 8

        if (x - tooltipRect.width / 2 < padding) {
          x = tooltipRect.width / 2 + padding
        } else if (x + tooltipRect.width / 2 > window.innerWidth - padding) {
          x = window.innerWidth - tooltipRect.width / 2 - padding
        }

        if (y + tooltipRect.height > window.innerHeight - padding) {
          y = rect.top - tooltipRect.height // Flip to top
        }

        setCoords({ x, y })
      }
    }
  }, [isVisible, position])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <>
      <div
        ref={triggerRef}
        className="tooltip-trigger"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={`tooltip tooltip-${position}`}
          style={{
            left: coords.x,
            top: coords.y
          }}
        >
          <span className="tooltip-content">{content}</span>
          {shortcut && <kbd className="tooltip-shortcut">{shortcut}</kbd>}
        </div>
      )}
    </>
  )
}
