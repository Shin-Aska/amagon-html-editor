import {useMemo} from 'react'
import {HelpCircle} from 'lucide-react'
import {useEditorStore} from '../../store/editorStore'
import {useAppSettingsStore} from '../../store/appSettingsStore'
import {useProjectStore} from '../../store/projectStore'
import {useTutorialStore} from '../../store/tutorialStore'
import {tutorialSteps} from '../Tutorial/tutorialSteps'
import type {Block, FrameworkChoice} from '../../store/types'
import './StatusBar.css'

const FRAMEWORK_META: Record<FrameworkChoice, { label: string; title: string; colorClass: string }> = {
  'bootstrap-5': { label: 'B',   title: 'Bootstrap 5',     colorClass: 'sb-fw-bootstrap' },
  'tailwind':    { label: 'T',   title: 'Tailwind CSS',    colorClass: 'sb-fw-tailwind'  },
  'vanilla':     { label: '<>', title: 'Vanilla HTML/CSS', colorClass: 'sb-fw-vanilla'   }
}

function countBlocks(blocks: Block[]): number {
  let count = blocks.length
  for (const block of blocks) {
    count += countBlocks(block.children)
  }
  return count
}

export default function StatusBar(): JSX.Element {
  const zoom = useEditorStore((s) => s.zoom)
  const blocks = useEditorStore((s) => s.blocks)
  const isDirty = useEditorStore((s) => s.isDirty)
  const startTutorial = useTutorialStore((s) => s.startTutorial)
  const setTutorialEnabled = useAppSettingsStore((s) => s.setTutorialEnabled)
  const setTutorialCompleted = useAppSettingsStore((s) => s.setTutorialCompleted)

  const currentPageId = useProjectStore((s) => s.currentPageId)
  const pages = useProjectStore((s) => s.pages)
  const framework = useProjectStore((s) => s.settings.framework)

  const currentPage = useMemo(() =>
    pages.find(p => p.id === currentPageId),
    [pages, currentPageId]
  )

  const blockCount = useMemo(() => countBlocks(blocks), [blocks])

  const fwMeta = FRAMEWORK_META[framework] ?? FRAMEWORK_META['vanilla']

  const handleRestartTutorial = () => {
    setTutorialEnabled(true)
    setTutorialCompleted(false)
    startTutorial(tutorialSteps)
  }

  return (
    <div className="status-bar">
      <div className="status-section">
        <div
          className={`status-framework-badge ${fwMeta.colorClass}`}
          title={fwMeta.title}
          aria-label={`Framework: ${fwMeta.title}`}
        >
          {fwMeta.label}
        </div>

        <div className="status-item">
          <span className="status-label">Page:</span>
          <span>{currentPage?.title || 'None'}</span>
          {currentPage?.slug && <span style={{ opacity: 0.5 }}>({currentPage.slug})</span>}
        </div>

        <div className="status-item">
          <span className="status-label">Blocks:</span>
          <span>{blockCount}</span>
        </div>
      </div>

      <div className="status-section">
        <div className="status-item">
          <span className="status-icon" style={{ color: isDirty ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
            {isDirty ? '● Unsaved' : 'Saved'}
          </span>
        </div>

        <div className="status-item">
          <span className="status-label">Zoom:</span>
          <span>{zoom}%</span>
        </div>

        <button
          type="button"
          className="status-help-btn"
          onClick={handleRestartTutorial}
          title="Restart tutorial"
          aria-label="Restart tutorial"
        >
          <HelpCircle size={12} aria-hidden="true" />
          <span>?</span>
        </button>
      </div>
    </div>
  )
}
