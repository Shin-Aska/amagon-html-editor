import { useEffect, useMemo, useState } from 'react'
import { getApi } from '../../utils/api'
import { exportProject } from '../../utils/exportEngine'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import './ExportDialog.css'

interface ExportDialogProps {
  onClose: () => void
}

type ExportMode = 'multi' | 'single'

export default function ExportDialog({ onClose }: ExportDialogProps): JSX.Element {
  const api = getApi()

  const getProjectData = useProjectStore((s) => s.getProjectData)
  const currentPageId = useProjectStore((s) => s.currentPageId)
  const updatePage = useProjectStore((s) => s.updatePage)
  const projectName = useProjectStore((s) => s.settings.name)
  const projectFramework = useProjectStore((s) => s.settings.framework)

  const editorBlocks = useEditorStore((s) => s.blocks)
  const customCss = useEditorStore((s) => s.customCss)

  const [mode, setMode] = useState<ExportMode>('multi')
  const [minify, setMinify] = useState(false)
  const [includeJs, setIncludeJs] = useState(true)

  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [progressWritten, setProgressWritten] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [lastExportDir, setLastExportDir] = useState<string | null>(null)
  const [lastPreviewPath, setLastPreviewPath] = useState<string | null>(null)

  const defaultDirName = useMemo(() => {
    const raw = String(projectName || 'export').trim()
    const sanitized = raw.replace(/[^a-zA-Z0-9._ -]/g, '').trim()
    return sanitized || 'export'
  }, [projectName])

  const previewFile = useMemo(() => {
    const data = getProjectData()
    const index = data.pages.find((p) => (p.slug || '').toLowerCase() === 'index')
    const page = index || data.pages[0]
    const slug = (page?.slug || page?.title || 'index').toString().trim()
    const safe = slug
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
    return `${safe || 'index'}.html`
  }, [getProjectData])

  useEffect(() => {
    const cleanup = api.project.onExportProgress((data) => {
      setProgressWritten(data.written)
      setProgressTotal(data.total)
    })
    return cleanup
  }, [])

  const handleExport = async (): Promise<void> => {
    setError(null)
    setLastExportDir(null)
    setLastPreviewPath(null)
    setProgressWritten(0)
    setProgressTotal(0)

    if (!currentPageId) {
      setError('No page selected.')
      return
    }

    setExporting(true)
    try {
      updatePage(currentPageId, { blocks: editorBlocks })
      const projectData = getProjectData()

      const isSingle = mode === 'single'

      const files = await exportProject(projectData, {
        customCss,
        includeJs,
        minify,
        onlyPageId: isSingle ? currentPageId : undefined,
        inlineCss: isSingle,
        inlineAssets: isSingle
      })

      const result = await api.project.exportSite({
        files,
        defaultDirName: defaultDirName,
        previewFile: isSingle ? files.find((f) => f.path.endsWith('.html'))?.path || 'index.html' : previewFile
      })

      if (result.success) {
        setLastExportDir(result.directory || null)
        setLastPreviewPath((result as any).previewPath || null)
      } else if (!result.canceled) {
        setError(result.error || 'Export failed.')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setExporting(false)
    }
  }

  const handlePreview = async (): Promise<void> => {
    if (!lastPreviewPath) return
    try {
      const result = await api.project.openInBrowser(lastPreviewPath)
      if (!result.success && !result.canceled) {
        setError(result.error || 'Failed to open preview.')
      }
    } catch (err) {
      setError(String(err))
    }
  }

  const progressPct = progressTotal > 0 ? Math.round((progressWritten / progressTotal) * 100) : 0

  return (
    <div className="export-overlay" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-header">
          <h2>Export</h2>
          <button className="export-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="export-content">
          <div className="export-row">
            <div className="export-label">Project</div>
            <div className="export-value">
              {projectName} ({projectFramework})
            </div>
          </div>

          <div className="export-section">
            <div className="export-section-title">Mode</div>
            <div className="export-toggle-row">
              <label className={`export-radio ${mode === 'multi' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="export-mode"
                  checked={mode === 'multi'}
                  onChange={() => setMode('multi')}
                />
                Multi-file (all pages)
              </label>
              <label className={`export-radio ${mode === 'single' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="export-mode"
                  checked={mode === 'single'}
                  onChange={() => setMode('single')}
                />
                Single HTML (current page)
              </label>
            </div>
          </div>

          <div className="export-section">
            <div className="export-section-title">Options</div>
            <div className="export-options">
              <label className="export-check">
                <input
                  type="checkbox"
                  checked={minify}
                  onChange={(e) => setMinify(e.target.checked)}
                />
                Minify HTML/CSS
              </label>
              <label className="export-check">
                <input
                  type="checkbox"
                  checked={includeJs}
                  onChange={(e) => setIncludeJs(e.target.checked)}
                />
                Include JS (framework scripts)
              </label>
            </div>
          </div>

          {exporting && (
            <div className="export-progress">
              <div className="export-progress-top">
                <span>Exporting...</span>
                <span>
                  {progressWritten}/{progressTotal} {progressTotal > 0 ? `(${progressPct}%)` : ''}
                </span>
              </div>
              <progress value={progressWritten} max={progressTotal || 1} />
            </div>
          )}

          {lastExportDir && (
            <div className="export-success">
              <div className="export-success-title">Export complete</div>
              <div className="export-success-path">{lastExportDir}</div>
            </div>
          )}

          {error && <div className="export-error">{error}</div>}
        </div>

        <div className="export-footer">
          <button className="export-btn-secondary" onClick={onClose} disabled={exporting}>
            Close
          </button>
          <button
            className="export-btn-secondary"
            onClick={handlePreview}
            disabled={exporting || !lastPreviewPath}
          >
            Preview in browser
          </button>
          <button className="export-btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}
