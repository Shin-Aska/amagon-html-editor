import { useState } from 'react'
import { getApi } from '../../utils/api'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { useAppSettingsStore } from '../../store/appSettingsStore'
import type { FrameworkChoice } from '../../store/types'
import './NewProjectWizard.css'

interface NewProjectWizardProps {
  onClose: () => void
}

const FRAMEWORK_OPTIONS: { id: FrameworkChoice; label: string; desc: string; icon: string; color: string }[] = [
  { id: 'bootstrap-5', label: 'Bootstrap 5', desc: 'The most popular HTML/CSS/JS framework.', icon: 'B', color: '#7952b3' },
  { id: 'tailwind', label: 'Tailwind CSS', desc: 'A utility-first CSS framework.', icon: 'T', color: '#38bdf8' },
  { id: 'vanilla', label: 'Vanilla HTML/CSS', desc: 'No framework — pure semantic HTML and CSS.', icon: '<>', color: '#6c757d' }
]

export default function NewProjectWizard({ onClose }: NewProjectWizardProps): JSX.Element {
  const [projectName, setProjectName] = useState('My Website')
  const [framework, setFramework] = useState<FrameworkChoice>('bootstrap-5')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setProject = useProjectStore((s) => s.setProject)
  const setPageBlocks = useEditorStore((s) => s.setPageBlocks)
  const setEditorLayout = useEditorStore((s) => s.setEditorLayout)
  const api = getApi()

  const handleCreate = async () => {
    if (!projectName.trim()) {
      setError('Please enter a project name.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await api.project.new({
        name: projectName.trim(),
        framework
      })

      if (result.success && result.content) {
        const data = result.content as any
        setProject(data, result.filePath)

        // Load the first page into the editor
        if (data.pages && data.pages.length > 0) {
          setPageBlocks(data.pages[0].blocks)
        }

        const defaultLayout = useAppSettingsStore.getState().defaultLayout
        setEditorLayout(defaultLayout)

        onClose()
      } else if (!result.canceled) {
        setError(result.error || 'Failed to create project.')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="npw-overlay" onClick={onClose}>
      <div className="npw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="npw-header">
          <h2>New Project</h2>
          <button className="npw-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="npw-content">
          <div className="npw-form-group">
            <label className="npw-label">Project Name</label>
            <input
              type="text"
              className="npw-input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. My Portfolio"
              autoFocus
            />
          </div>

          <div className="npw-form-group">
            <label className="npw-label">CSS Framework</label>
            <div className="npw-framework-list">
              {FRAMEWORK_OPTIONS.map((fw) => (
                <label
                  key={fw.id}
                  className={`npw-framework-card ${framework === fw.id ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="framework"
                    value={fw.id}
                    checked={framework === fw.id}
                    onChange={() => setFramework(fw.id)}
                    className="npw-hidden-radio"
                  />
                  <div className="npw-fw-icon" style={{ backgroundColor: fw.color }}>
                    {fw.icon}
                  </div>
                  <div className="npw-fw-info">
                    <strong>{fw.label}</strong>
                    <span>{fw.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && <div className="npw-error">{error}</div>}
        </div>

        <div className="npw-footer">
          <button className="npw-btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="npw-btn-create"
            onClick={handleCreate}
            disabled={loading || !projectName.trim()}
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}
