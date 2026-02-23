import { useState, useEffect } from 'react'
import { FilePlus, FolderOpen, Zap, Clock, ChevronRight, Activity } from 'lucide-react'
import { getApi } from '../../utils/api'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import NewProjectWizard from '../NewProjectWizard/NewProjectWizard'
import './WelcomeScreen.css'

export default function WelcomeScreen(): JSX.Element {
  const api = getApi()
  const setProject = useProjectStore((s) => s.setProject)
  const setCustomCss = useEditorStore((s) => s.setCustomCss)
  const markSaved = useEditorStore((s) => s.markSaved)
  const loadPageBlocks = useEditorStore((s) => s.loadPageBlocks)

  const [recentProjects, setRecentProjects] = useState<string[]>([])
  const [showNewProject, setShowNewProject] = useState(false)

  useEffect(() => {
    async function loadRecent() {
      const result = await api.project.getRecent()
      if (result.success && result.projects) {
        setRecentProjects(result.projects)
      }
    }
    loadRecent()
  }, [])

  const handleLoad = async () => {
    const result = await api.project.load()
    if (result.success && result.content) {
      setProject(result.content as any, result.filePath)
      const data = result.content as any
      const firstPage = Array.isArray(data.pages) ? data.pages[0] : null
      if (firstPage && Array.isArray(firstPage.blocks)) {
        loadPageBlocks(firstPage.blocks)
      }
      setCustomCss(typeof data.customCss === 'string' ? data.customCss : '')
      markSaved()
    }
  }

  const handleOpenRecent = async (path: string) => {
    const result = await api.project.loadFile(path)
    if (result.success && result.content) {
      setProject(result.content as any, result.filePath)
      const data = result.content as any
      const firstPage = Array.isArray(data.pages) ? data.pages[0] : null
      if (firstPage && Array.isArray(firstPage.blocks)) {
        loadPageBlocks(firstPage.blocks)
      }
      setCustomCss(typeof data.customCss === 'string' ? data.customCss : '')
      markSaved()
    } else {
      console.error('Failed to load recent project:', result.error)
      alert(`Failed to load project: ${result.error}`)
    }
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-header">
          <div className="logo-container">
            <Activity className="logo-icon" size={32} />
            <div className="welcome-logo">Amagon</div>
          </div>
          <div className="welcome-subtitle">
            Visual Website Builder. <span className="highlight">Build websites within minutes.</span>
          </div>
        </div>

        <div className="welcome-body">
          <div className="welcome-actions">
            <button className="welcome-btn primary-action" onClick={() => setShowNewProject(true)}>
              <div className="btn-icon-wrapper">
                <FilePlus size={24} />
              </div>
              <div className="btn-text">
                <div className="btn-title">New Project</div>
                <div className="btn-desc">Start building from scratch</div>
              </div>
              <ChevronRight className="btn-arrow" size={20} />
            </button>

            <button className="welcome-btn secondary-action" onClick={handleLoad}>
              <div className="btn-icon-wrapper">
                <FolderOpen size={24} />
              </div>
              <div className="btn-text">
                <div className="btn-title">Open Project</div>
                <div className="btn-desc">Load an existing .json file</div>
              </div>
              <ChevronRight className="btn-arrow" size={20} />
            </button>
          </div>

          <div className="welcome-recent">
            <div className="recent-header">
              <Clock size={16} />
              <span>Recent Projects</span>
            </div>
            <div className="recent-list">
              {recentProjects.length === 0 ? (
                <div className="recent-empty">
                  No recent projects found
                </div>
              ) : (
                recentProjects.map((path) => {
                  const name = path.split(/[/\\]/).pop()?.replace('.json', '') || 'Untitled'
                  return (
                    <div key={path} className="recent-item" onClick={() => handleOpenRecent(path)}>
                      <div className="recent-item-icon">
                        <Zap size={14} />
                      </div>
                      <div className="recent-item-info">
                        <div className="recent-name">{name}</div>
                        <div className="recent-path">{path}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {showNewProject && (
        <NewProjectWizard onClose={() => setShowNewProject(false)} />
      )}
    </div>
  )
}
