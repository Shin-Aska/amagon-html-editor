import type {CSSProperties} from 'react'
import type {TutorialPlacement} from '../../store/tutorialStore'

export interface TutorialArrowProps {
  direction: TutorialPlacement | 'none'
  style?: CSSProperties
}

export default function TutorialArrow({ direction, style }: TutorialArrowProps): JSX.Element | null {
  if (direction === 'none') return null;

  return <div className={`tutorial-arrow tutorial-arrow-${direction}`} style={style} aria-hidden="true" />
}
