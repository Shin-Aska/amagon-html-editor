import { useEffect, useState } from 'react'
import { FilePlus, FolderOpen, Zap, Clock, ChevronRight, X, Settings } from 'lucide-react'
import appLogo from '../../../../assets/app.png'
import { getApi } from '../../utils/api'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { useAppSettingsStore } from '../../store/appSettingsStore'
import NewProjectWizard from '../NewProjectWizard/NewProjectWizard'
import SettingsDialog from '../SettingsDialog/SettingsDialog'
import './WelcomeScreen.css'

export default function WelcomeScreen(): JSX.Element {
  const api = getApi()
  const setProject = useProjectStore((s) => s.setProject)
  const setCustomCss = useEditorStore((s) => s.setCustomCss)
  const markSaved = useEditorStore((s) => s.markSaved)
  const loadPageBlocks = useEditorStore((s) => s.loadPageBlocks)
  const setEditorLayout = useEditorStore((s) => s.setEditorLayout)

  const [recentProjects, setRecentProjects] = useState<{ path: string; name: string }[]>([])
  const [appVersion, setAppVersion] = useState('')

  const normalizeRecentProjects = (projects: unknown): Array<{ path: string; name: string }> => {
    if (!Array.isArray(projects)) return []

    return projects.flatMap((project) => {
      if (typeof project === 'string') {
        const trimmedPath = project.trim()
        if (!trimmedPath) return []

        return [{
          path: trimmedPath,
          name: trimmedPath.split(/[/\\]/).pop()?.replace(/\.json$/i, '') || 'Untitled'
        }]
      }

      if (!project || typeof project !== 'object') return []

      const pathValue = typeof (project as { path?: unknown }).path === 'string'
        ? (project as { path: string }).path.trim()
        : ''
      if (!pathValue) return []

      const nameValue = typeof (project as { name?: unknown }).name === 'string'
        ? (project as { name: string }).name.trim()
        : ''

      return [{
        path: pathValue,
        name: nameValue || pathValue.split(/[/\\]/).pop()?.replace(/\.json$/i, '') || 'Untitled'
      }]
    })
  }
  const [showNewProject, setShowNewProject] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    async function loadRecent() {
      const result = await api.project.getRecent()
      if (result.success && result.projects) {
        setRecentProjects(normalizeRecentProjects(result.projects))
      }
    }
    loadRecent()
  }, [])

  useEffect(() => {
    async function loadAppVersion() {
      const result = await api.app.getVersion()
      if (result.success && typeof result.version === 'string') {
        setAppVersion(result.version)
      }
    }

    loadAppVersion()
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

      const defaultLayout = useAppSettingsStore.getState().defaultLayout
      setEditorLayout(defaultLayout)
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

      const defaultLayout = useAppSettingsStore.getState().defaultLayout
      setEditorLayout(defaultLayout)
    } else {
      console.error('Failed to load recent project:', result.error)
      alert(`Failed to load project: ${result.error}`)
    }
  }

  const handleRemoveRecent = async (e: React.MouseEvent, projectPath: string) => {
    e.stopPropagation()
    const result = await api.project.removeRecent(projectPath)
    if (result.success && result.projects) {
      setRecentProjects(normalizeRecentProjects(result.projects))
    } else {
      setRecentProjects((prev) => prev.filter((p) => p.path !== projectPath))
    }
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-background" aria-hidden="true">
        <div className="welcome-aurora welcome-aurora-one" />
        <div className="welcome-aurora welcome-aurora-two" />
        <div className="welcome-grid-glow" />
        <div className="welcome-scanline" />
        <div className="dot-pulse dot-pulse-one" />
        <div className="dot-pulse dot-pulse-two" />
        <div className="dot-pulse dot-pulse-three" />
        <div className="dot-pulse dot-pulse-four" />
      </div>

      <div className="welcome-content">
        <div className="welcome-header">
          <div className="logo-container">
            <img src={appLogo} className="logo-icon" width={40} height={40} />
            <div className="welcome-logo">Amagon</div>
          </div>
          <div className="welcome-subtitle">
            Visual Website Builder. <span className="highlight">Build websites within minutes.</span>
          </div>
          <div className="welcome-version">{appVersion ? `v${appVersion}` : ''}</div>
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

            <button className="welcome-btn secondary-action" onClick={() => setShowSettings(true)}>
              <div className="btn-icon-wrapper">
                <Settings size={24} />
              </div>
              <div className="btn-text">
                <div className="btn-title">Settings</div>
                <div className="btn-desc">Global preferences & API keys</div>
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
                recentProjects.map((project) => {
                  return (
                    <div key={project.path} className="recent-item" onClick={() => handleOpenRecent(project.path)}>
                      <div className="recent-item-icon">
                        <Zap size={14} />
                      </div>
                      <div className="recent-item-info">
                        <div className="recent-name">{project.name}</div>
                        <div className="recent-path">{project.path}</div>
                      </div>
                      <button
                        className="recent-item-remove"
                        onClick={(e) => handleRemoveRecent(e, project.path)}
                        title="Remove from recent projects"
                      >
                        <X size={14} />
                      </button>
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

      {showSettings && (
        <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
