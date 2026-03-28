import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import SpotlightMask from './SpotlightMask'
import TutorialArrow from './TutorialArrow'
import TutorialInfoBox from './TutorialInfoBox'
import { useEditorStore } from '../../store/editorStore'
import { useTutorialStore, type TutorialPlacement } from '../../store/tutorialStore'
import './Tutorial.css'

interface TutorialOverlayProps {
  queryElement?: (selector: string) => Element | null
}

interface SpotlightRect {
  x: number
  y: number
  width: number
  height: number
}

interface Coordinates {
  left: number
  top: number
}

interface TargetResolution {
  element: Element
  rect: SpotlightRect
}

const defaultQueryElement = (selector: string): Element | null => document.querySelector(selector)
const INFOBOX_GAP = 16
const INFOBOX_DEFAULT_WIDTH = 320
const INFOBOX_DEFAULT_HEIGHT = 190
const VIEWPORT_PADDING = 12

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function areRectsEqual(a: SpotlightRect | null, b: SpotlightRect | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

function areRectListsEqual(a: SpotlightRect[], b: SpotlightRect[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false

  for (let index = 0; index < a.length; index += 1) {
    if (!areRectsEqual(a[index], b[index])) return false
  }

  return true
}

function areCoordinatesEqual(a: Coordinates, b: Coordinates): boolean {
  return a.left === b.left && a.top === b.top
}

function getOppositePlacement(placement: TutorialPlacement): TutorialPlacement {
  if (placement === 'top') return 'bottom'
  if (placement === 'bottom') return 'top'
  if (placement === 'left') return 'right'
  return 'left'
}

function getArrowDirection(placement: TutorialPlacement): TutorialPlacement {
  if (placement === 'top') return 'bottom'
  if (placement === 'bottom') return 'top'
  if (placement === 'left') return 'right'
  return 'left'
}

function calculatePosition(
  targetRect: SpotlightRect,
  placement: TutorialPlacement,
  boxWidth: number,
  boxHeight: number
): Coordinates {
  if (placement === 'right') {
    return {
      left: targetRect.x + targetRect.width + INFOBOX_GAP,
      top: targetRect.y + targetRect.height / 2 - boxHeight / 2
    }
  }

  if (placement === 'left') {
    return {
      left: targetRect.x - boxWidth - INFOBOX_GAP,
      top: targetRect.y + targetRect.height / 2 - boxHeight / 2
    }
  }

  if (placement === 'bottom') {
    return {
      left: targetRect.x + targetRect.width / 2 - boxWidth / 2,
      top: targetRect.y + targetRect.height + INFOBOX_GAP
    }
  }

  return {
    left: targetRect.x + targetRect.width / 2 - boxWidth / 2,
    top: targetRect.y - boxHeight - INFOBOX_GAP
  }
}

function clampPosition(position: Coordinates, boxWidth: number, boxHeight: number): Coordinates {
  return {
    left: clamp(position.left, VIEWPORT_PADDING, window.innerWidth - boxWidth - VIEWPORT_PADDING),
    top: clamp(position.top, VIEWPORT_PADDING, window.innerHeight - boxHeight - VIEWPORT_PADDING)
  }
}

function isOutOfViewport(rect: SpotlightRect): boolean {
  return rect.y + rect.height < 0 || rect.y > window.innerHeight || rect.x + rect.width < 0 || rect.x > window.innerWidth
}

function findElementInWindow(selector: string, rootWindow: Window | null): Element | null {
  if (!rootWindow) return null

  const directMatch = rootWindow.document.querySelector(selector)
  if (directMatch) return directMatch

  const frames = Array.from(rootWindow.document.querySelectorAll('iframe'))
  for (const frame of frames) {
    try {
      const childWindow = frame.contentWindow
      if (!childWindow || !frame.contentDocument) continue
      const childMatch = findElementInWindow(selector, childWindow)
      if (childMatch) return childMatch
    } catch {
      // Ignore cross-origin frames and continue searching.
    }
  }

  return null
}

function resolveElementRect(element: Element): SpotlightRect {
  const baseRect = element.getBoundingClientRect()
  let currentRect = {
    x: baseRect.x,
    y: baseRect.y,
    width: baseRect.width,
    height: baseRect.height
  }

  let currentWindow: Window | null = element.ownerDocument?.defaultView ?? null
  while (currentWindow && currentWindow !== window) {
    const frameElement = currentWindow.frameElement as HTMLIFrameElement | null
    if (!frameElement) break

    const frameRect = frameElement.getBoundingClientRect()
    const widthScale = frameRect.width / (frameElement.offsetWidth || frameElement.clientWidth || frameRect.width || 1)
    const heightScale = frameRect.height / (frameElement.offsetHeight || frameElement.clientHeight || frameRect.height || 1)

    currentRect = {
      x: frameRect.left + currentRect.x * widthScale,
      y: frameRect.top + currentRect.y * heightScale,
      width: currentRect.width * widthScale,
      height: currentRect.height * heightScale
    }

    currentWindow = currentWindow.parent
  }

  return currentRect
}

function resolveTarget(selector: string, queryElement: (selector: string) => Element | null): TargetResolution | null {
  const element = queryElement(selector) ?? findElementInWindow(selector, window)
  if (!element) return null
  return {
    element,
    rect: resolveElementRect(element)
  }
}

export default function TutorialOverlay({ queryElement = defaultQueryElement }: TutorialOverlayProps): JSX.Element | null {
  const isActive = useTutorialStore((s) => s.isActive)
  const currentStepIndex = useTutorialStore((s) => s.currentStepIndex)
  const steps = useTutorialStore((s) => s.steps)
  const nextStep = useTutorialStore((s) => s.nextStep)
  const prevStep = useTutorialStore((s) => s.prevStep)
  const skipTutorial = useTutorialStore((s) => s.skipTutorial)
  const isActionCompleted = useTutorialStore((s) => s.isActionCompleted)
  const editorLayout = useEditorStore((s) => s.editorLayout)

  const infoBoxElementRef = useRef<HTMLDivElement | null>(null)
  const skippedMissingStepRef = useRef<string | null>(null)
  const lastNavDirectionRef = useRef<'forward' | 'backward' | null>(null)
  const [ariaAnnouncement, setAriaAnnouncement] = useState('')

  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null)
  const [additionalTargetRects, setAdditionalTargetRects] = useState<SpotlightRect[]>([])
  const [infoBoxPosition, setInfoBoxPosition] = useState<Coordinates>({ left: 0, top: 0 })
  const [resolvedPlacement, setResolvedPlacement] = useState<TutorialPlacement>('bottom')
  const [isDynamicTargetActive, setIsDynamicTargetActive] = useState(false)

  const handleNext = useCallback(() => {
    lastNavDirectionRef.current = 'forward'
    nextStep()
  }, [nextStep])

  const handleBack = useCallback(() => {
    lastNavDirectionRef.current = 'backward'
    prevStep()
  }, [prevStep])

  const step = steps[currentStepIndex]
  const cutoutRect = useMemo(() => {
    if (!targetRect) return null

    const padding = isDynamicTargetActive ? 8 : (step?.spotlightPadding ?? 8)
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const allRects = [targetRect, ...additionalTargetRects]

    const paddedRects = allRects.map((rect) => ({
      left: clamp(rect.x - padding, 0, viewportWidth),
      top: clamp(rect.y - padding, 0, viewportHeight),
      right: clamp(rect.x + rect.width + padding, 0, viewportWidth),
      bottom: clamp(rect.y + rect.height + padding, 0, viewportHeight)
    }))

    const left = Math.min(...paddedRects.map((rect) => rect.left))
    const top = Math.min(...paddedRects.map((rect) => rect.top))
    const right = Math.max(...paddedRects.map((rect) => rect.right))
    const bottom = Math.max(...paddedRects.map((rect) => rect.bottom))

    return {
      x: left,
      y: top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top)
    }
  }, [additionalTargetRects, isDynamicTargetActive, step?.spotlightPadding, targetRect])

  const recalculate = useCallback(() => {
    if (!isActive || !step) return

    if (!step.target) {
      const centeredBoxWidth = infoBoxElementRef.current?.offsetWidth ?? INFOBOX_DEFAULT_WIDTH
      const centeredBoxHeight = infoBoxElementRef.current?.offsetHeight ?? INFOBOX_DEFAULT_HEIGHT
      const centeredPosition = {
        left: window.innerWidth / 2 - centeredBoxWidth / 2,
        top: window.innerHeight / 2 - centeredBoxHeight / 2
      }

      setTargetRect((previousRect) => (previousRect === null ? previousRect : null))
      setAdditionalTargetRects((previousRects) => (previousRects.length === 0 ? previousRects : []))
      setResolvedPlacement((previousPlacement) => (previousPlacement === 'bottom' ? previousPlacement : 'bottom'))
      setInfoBoxPosition((previousPosition) => (
        areCoordinatesEqual(previousPosition, centeredPosition) ? previousPosition : centeredPosition
      ))
      return
    }

    // Check if a dynamicTarget exists and should override the primary target
    let activeTargetSelector = step.target
    let dynamicActive = false
    if (step.dynamicTarget) {
      const dynamicEl = queryElement(step.dynamicTarget) ?? findElementInWindow(step.dynamicTarget, window)
      if (dynamicEl) {
        activeTargetSelector = step.dynamicTarget
        dynamicActive = true
      }
    }
    setIsDynamicTargetActive(dynamicActive)

    const resolvedTarget = activeTargetSelector ? resolveTarget(activeTargetSelector, queryElement) : null
    if (!resolvedTarget) {
      setTargetRect((previousRect) => (previousRect === null ? previousRect : null))
      setAdditionalTargetRects((previousRects) => (previousRects.length === 0 ? previousRects : []))
      return
    }

    const { element } = resolvedTarget
    let elementRect = resolvedTarget.rect
    if (isOutOfViewport(elementRect)) {
      if (typeof (element as HTMLElement).scrollIntoView === 'function') {
        ;(element as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      }
      elementRect = resolveElementRect(element)
    }

    const spotlightRect: SpotlightRect = {
      x: elementRect.x,
      y: elementRect.y,
      width: elementRect.width,
      height: elementRect.height
    }

    const resolvedAdditionalRects = (step.additionalTargets ?? [])
      .map((selector) => resolveTarget(selector, queryElement))
      .filter((resolved): resolved is TargetResolution => resolved !== null)
      .map((resolved) => resolved.rect)

    setTargetRect((previousRect) => (areRectsEqual(previousRect, spotlightRect) ? previousRect : spotlightRect))
    setAdditionalTargetRects((previousRects) => (
      areRectListsEqual(previousRects, resolvedAdditionalRects) ? previousRects : resolvedAdditionalRects
    ))

    const infoBoxWidth = infoBoxElementRef.current?.offsetWidth ?? INFOBOX_DEFAULT_WIDTH
    const infoBoxHeight = infoBoxElementRef.current?.offsetHeight ?? INFOBOX_DEFAULT_HEIGHT

    const basePlacement = step.placement
    const primary = clampPosition(calculatePosition(spotlightRect, basePlacement, infoBoxWidth, infoBoxHeight), infoBoxWidth, infoBoxHeight)

    const overflowX = primary.left <= VIEWPORT_PADDING || primary.left + infoBoxWidth >= window.innerWidth - VIEWPORT_PADDING
    const overflowY = primary.top <= VIEWPORT_PADDING || primary.top + infoBoxHeight >= window.innerHeight - VIEWPORT_PADDING

    const shouldFlip =
      (basePlacement === 'left' || basePlacement === 'right') ? overflowX : overflowY

    const finalPlacement = shouldFlip ? getOppositePlacement(basePlacement) : basePlacement
    const finalPosition = clampPosition(calculatePosition(spotlightRect, finalPlacement, infoBoxWidth, infoBoxHeight), infoBoxWidth, infoBoxHeight)

    setResolvedPlacement((previousPlacement) => (previousPlacement === finalPlacement ? previousPlacement : finalPlacement))
    setInfoBoxPosition((previousPosition) => (
      areCoordinatesEqual(previousPosition, finalPosition) ? previousPosition : finalPosition
    ))
  }, [isActive, queryElement, step])

  useEffect(() => {
    if (!isActive || !step?.target) return

    const element = resolveTarget(step.target, queryElement)
    if (element) {
      skippedMissingStepRef.current = null
      return
    }

    if (skippedMissingStepRef.current === step.id) return

    // Don't auto-skip when the user is navigating backward
    if (lastNavDirectionRef.current === 'backward') {
      lastNavDirectionRef.current = null
      return
    }

    lastNavDirectionRef.current = null
    skippedMissingStepRef.current = step.id
    window.setTimeout(() => {
      nextStep()
    }, 0)
  }, [isActive, step, queryElement, nextStep])

  useLayoutEffect(() => {
    recalculate()
  }, [recalculate, currentStepIndex, editorLayout])

  useEffect(() => {
    if (!isActive || !step) return
    setAriaAnnouncement(`Step ${currentStepIndex + 1} of ${steps.length}. ${step.title}`)
  }, [currentStepIndex, isActive, step, steps.length])

  useEffect(() => {
    if (isActive) {
      document.body.dataset.tutorialActive = 'true'
    } else {
      delete document.body.dataset.tutorialActive
    }
    return () => {
      delete document.body.dataset.tutorialActive
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive) return

    const handleResize = () => recalculate()
    const handleScroll = () => recalculate()

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, true)

    const intervalId = window.setInterval(() => {
      recalculate()
    }, 250)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll, true)
      window.clearInterval(intervalId)
    }
  }, [isActive, recalculate])

  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        skipTutorial()
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handleBack()
      }

      if (event.key === 'ArrowRight' && step?.action.type === 'none') {
        event.preventDefault()
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, handleNext, handleBack, skipTutorial, step?.action.type])

  const arrowStyle = useMemo(() => {
    if (!targetRect || !infoBoxElementRef.current || !step?.target) return undefined

    const infoRect = infoBoxElementRef.current.getBoundingClientRect()
    const targetCenterX = targetRect.x + targetRect.width / 2
    const targetCenterY = targetRect.y + targetRect.height / 2

    if (resolvedPlacement === 'right') {
      return {
        left: infoRect.left - 7,
        top: clamp(targetCenterY - 7, infoRect.top + 14, infoRect.bottom - 20)
      }
    }

    if (resolvedPlacement === 'left') {
      return {
        left: infoRect.right - 5,
        top: clamp(targetCenterY - 7, infoRect.top + 14, infoRect.bottom - 20)
      }
    }

    if (resolvedPlacement === 'bottom') {
      return {
        left: clamp(targetCenterX - 7, infoRect.left + 14, infoRect.right - 20),
        top: infoRect.top - 7
      }
    }

    return {
      left: clamp(targetCenterX - 7, infoRect.left + 14, infoRect.right - 20),
      top: infoRect.bottom - 5
    }
  }, [resolvedPlacement, step?.target, targetRect])

  if (!isActive || !step) return null

  const showFullScreenBlocker = !step.target || !cutoutRect
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const overlay = (
    <>
      <div className="tutorial-overlay" aria-live="polite" aria-label="Tutorial overlay">
        {showFullScreenBlocker ? (
          <div className="tutorial-interaction-blocker" aria-hidden="true" />
        ) : (
          <>
            <div
              className="tutorial-interaction-guard"
              aria-hidden="true"
              style={{ left: 0, top: 0, width: viewportWidth, height: cutoutRect.y }}
            />
            <div
              className="tutorial-interaction-guard"
              aria-hidden="true"
              style={{
                left: 0,
                top: cutoutRect.y + cutoutRect.height,
                width: viewportWidth,
                height: Math.max(0, viewportHeight - (cutoutRect.y + cutoutRect.height))
              }}
            />
            <div
              className="tutorial-interaction-guard"
              aria-hidden="true"
              style={{
                left: 0,
                top: cutoutRect.y,
                width: cutoutRect.x,
                height: cutoutRect.height
              }}
            />
            <div
              className="tutorial-interaction-guard"
              aria-hidden="true"
              style={{
                left: cutoutRect.x + cutoutRect.width,
                top: cutoutRect.y,
                width: Math.max(0, viewportWidth - (cutoutRect.x + cutoutRect.width)),
                height: cutoutRect.height
              }}
            />
          </>
        )}

        <SpotlightMask
          targetRect={targetRect}
          additionalRects={additionalTargetRects}
          padding={step.spotlightPadding ?? 8}
        />
        <span className="tutorial-sr-only" aria-live="polite" aria-atomic="true">
          {ariaAnnouncement}
        </span>
      </div>

      <TutorialArrow
        direction={step.target ? getArrowDirection(resolvedPlacement) : 'none'}
        style={arrowStyle}
      />

      <TutorialInfoBox
        key={step.id}
        step={step}
        currentIndex={currentStepIndex}
        totalSteps={steps.length}
        onNext={handleNext}
        onBack={handleBack}
        onSkip={skipTutorial}
        style={{ left: infoBoxPosition.left, top: infoBoxPosition.top }}
        infoBoxRef={(element) => {
          infoBoxElementRef.current = element
        }}
        nextDisabled={step.action.type !== 'none' && !isActionCompleted}
      />
    </>
  )

  if (typeof document === 'undefined') {
    return overlay
  }

  return createPortal(overlay, document.body)
}
