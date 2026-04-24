import {useEffect} from 'react'
import {Compass, X} from 'lucide-react'
import './WelcomeTourDialog.css'

interface WelcomeTourDialogProps {
  open: boolean
  onStartTour: () => void
  onSkipForNow: () => void
  onDontShowAgain: () => void
}

export default function WelcomeTourDialog({
  open,
  onStartTour,
  onSkipForNow,
  onDontShowAgain
}: WelcomeTourDialogProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkipForNow()
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onSkipForNow]);

  if (!open) return null;

  return (
    <div className="welcome-tour-overlay" onClick={onSkipForNow}>
      <div className="welcome-tour-dialog" onClick={(e) => e.stopPropagation()}>
        <button
          className="welcome-tour-close"
          aria-label="Skip tutorial for now"
          onClick={onSkipForNow}
        >
          <X size={16} />
        </button>

        <div className="welcome-tour-header">
          <div className="welcome-tour-icon" aria-hidden="true">
            <Compass size={22} />
          </div>
          <h2>Welcome to Amagon!</h2>
          <p>Would you like a quick tour?</p>
        </div>

        <div className="welcome-tour-actions">
          <button className="welcome-tour-btn welcome-tour-btn-primary" onClick={onStartTour}>
            Yes, show me around
          </button>
          <button className="welcome-tour-btn welcome-tour-btn-secondary" onClick={onSkipForNow}>
            Skip for now
          </button>
          <button className="welcome-tour-btn welcome-tour-btn-ghost" onClick={onDontShowAgain}>
            Don&apos;t show again
          </button>
        </div>
      </div>
    </div>
  )
}
