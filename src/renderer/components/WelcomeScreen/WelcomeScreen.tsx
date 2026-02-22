import { useState, useEffect } from 'react'
import { FilePlus, FolderOpen } from 'lucide-react'
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
        <div className="welcome-left">
          <div>
            <div className="welcome-logo">Hoarses</div>
            <div className="welcome-subtitle">
              Visual builder for Bootstrap & Tailwind.<br />
              Create beautiful websites in minutes.
            </div>
          </div>

          <div className="welcome-actions">
            <button className="welcome-btn primary" onClick={() => setShowNewProject(true)}>
              <FilePlus size={20} />
              <div>
                <div style={{ fontWeight: 600 }}>New Project</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Start from scratch</div>
              </div>
            </button>
            
            <button className="welcome-btn" onClick={handleLoad}>
              <FolderOpen size={20} />
              <div>
                <div style={{ fontWeight: 600 }}>Open Project</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Load existing .json file</div>
              </div>
            </button>
          </div>
        </div>

        <div className="welcome-right">
          <div className="recent-header">Recent Projects</div>
          <div className="recent-list">
            {recentProjects.length === 0 ? (
              <div className="recent-empty">No recent projects</div>
            ) : (
              recentProjects.map((path) => (
                <div key={path} className="recent-item" onClick={() => handleOpenRecent(path)}>
                  <div className="recent-name">{path.split(/[/\\]/).pop()?.replace('.json', '') || 'Untitled'}</div>
                  <div className="recent-path">{path}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showNewProject && (
        <NewProjectWizard onClose={() => setShowNewProject(false)} />
      )}
    </div>
  )
}
