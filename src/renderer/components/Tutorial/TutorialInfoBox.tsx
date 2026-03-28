import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { TutorialStep } from '../../store/tutorialStore'

export interface TutorialInfoBoxProps {
  step: TutorialStep
  currentIndex: number
  totalSteps: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  style: CSSProperties
  infoBoxRef?: (element: HTMLDivElement | null) => void
  nextDisabled?: boolean
}

export default function TutorialInfoBox({
  step,
  currentIndex,
  totalSteps,
  onNext,
  onBack,
  onSkip,
  style,
  infoBoxRef,
  nextDisabled = false
}: TutorialInfoBoxProps): JSX.Element {
  const isFirstStep = currentIndex === 0
  const isLastStep = currentIndex === totalSteps - 1
  const isCompletion = step.id === 'completion'
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const primaryActionRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const focusTarget = primaryActionRef.current ?? dialogRef.current?.querySelector<HTMLElement>('[data-tutorial-focus="true"]') ?? dialogRef.current
    focusTarget?.focus?.()
  }, [step.id])

  const getFocusableElements = () => {
    const root = dialogRef.current
    if (!root) return [] as HTMLElement[]
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex >= 0)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onSkip()
      return
    }

    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements()

    if (focusableElements.length === 0) {
      event.preventDefault()
      return
    }

    const activeElement = document.activeElement as HTMLElement | null
    const currentFocusIndex = focusableElements.indexOf(activeElement ?? (document.body as HTMLElement))
    const nextIndex = event.shiftKey
      ? (currentFocusIndex <= 0 ? focusableElements.length - 1 : currentFocusIndex - 1)
      : (currentFocusIndex === -1 || currentFocusIndex === focusableElements.length - 1 ? 0 : currentFocusIndex + 1)

    if (currentFocusIndex === -1 || currentFocusIndex === 0 || currentFocusIndex === focusableElements.length - 1) {
      event.preventDefault()
      focusableElements[nextIndex]?.focus()
    }
  }

  return (
    <div
      ref={(element) => {
        dialogRef.current = element
        infoBoxRef?.(element)
      }}
      className="tutorial-info-box"
      role="dialog"
      aria-modal="true"
      aria-label="Editor tutorial"
      aria-labelledby={`tutorial-step-title-${step.id}`}
      aria-describedby={`tutorial-step-body-${step.id}`}
      style={style}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <span className="tutorial-sr-only" aria-live="polite" aria-atomic="true">
        Step {currentIndex + 1} of {totalSteps}. {step.title}
      </span>
      {isCompletion && (
        <div className="tutorial-confetti" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, index) => (
            <span key={`confetti-${index}`} className="tutorial-confetti-dot" />
          ))}
        </div>
      )}
      <button type="button" className="tutorial-close" aria-label="Skip tutorial" onClick={onSkip}>
        <X size={16} />
      </button>

      <h3 id={`tutorial-step-title-${step.id}`} className="tutorial-title">{step.title}</h3>
      <p id={`tutorial-step-body-${step.id}`} className="tutorial-body" dangerouslySetInnerHTML={{ __html: step.body }} />

      <div className="tutorial-progress-row">
        <span className="tutorial-step-counter">
          {currentIndex + 1} of {totalSteps}
        </span>
        <div className="tutorial-progress-dots" aria-hidden="true">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <span
              key={`${step.id}-dot-${index}`}
              className={`tutorial-progress-dot ${
                index < currentIndex ? 'is-complete' : index === currentIndex ? 'is-current' : ''
              }`}
            />
          ))}
        </div>
      </div>

      <div className="tutorial-actions">
        <button type="button" className="tutorial-btn tutorial-btn-secondary" onClick={onBack} disabled={isFirstStep}>
          <ChevronLeft size={14} />
          Back
        </button>
        <button
          type="button"
          className="tutorial-btn tutorial-btn-primary"
          onClick={onNext}
          disabled={nextDisabled}
          ref={primaryActionRef}
          data-tutorial-focus="true"
        >
          {isLastStep ? 'Explore on your own' : 'Next'}
          <ChevronRight size={14} />
        </button>
        <button type="button" className="tutorial-btn tutorial-btn-ghost" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  )
}
