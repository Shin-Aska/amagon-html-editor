import { useId } from 'react'

interface SpotlightRect {
  x: number
  y: number
  width: number
  height: number
}

export interface SpotlightMaskProps {
  targetRect: SpotlightRect | null
  padding?: number
  borderRadius?: number
  overlayOpacity?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export default function SpotlightMask({
  targetRect,
  padding = 8,
  borderRadius = 6,
  overlayOpacity = 0.65
}: SpotlightMaskProps): JSX.Element {
  const maskId = useId().replace(/:/g, '')

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const cutout = targetRect
    ? {
        x: clamp(targetRect.x - padding, 0, viewportWidth),
        y: clamp(targetRect.y - padding, 0, viewportHeight),
        width: clamp(targetRect.width + padding * 2, 0, viewportWidth),
        height: clamp(targetRect.height + padding * 2, 0, viewportHeight)
      }
    : null

  return (
    <svg className="tutorial-spotlight-mask" width={viewportWidth} height={viewportHeight} aria-hidden="true">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={viewportWidth} height={viewportHeight}>
          <rect x="0" y="0" width={viewportWidth} height={viewportHeight} fill="white" />
          {cutout && (
            <rect
              className="tutorial-spotlight-cutout"
              x={cutout.x}
              y={cutout.y}
              width={cutout.width}
              height={cutout.height}
              rx={borderRadius}
              ry={borderRadius}
              fill="black"
            />
          )}
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width={viewportWidth}
        height={viewportHeight}
        fill={`rgba(0, 0, 0, ${overlayOpacity})`}
        mask={`url(#${maskId})`}
      />
    </svg>
  )
}
