import {useEffect, useState} from 'react'
import {ChevronRight, Clock, FilePlus, FolderOpen, Settings, X} from 'lucide-react'
import appLogo from '../../../../assets/app.png'
import {projectCommands, useProjectCommandState} from '../../project/projectCommands'
import type {RecentProjectId} from '../../../shared/projects/projectIpcContract'
import {useProjectStore} from '../../store/projectStore'
import {useEditorStore} from '../../store/editorStore'
import {useAppSettingsStore} from '../../store/appSettingsStore'
import NewProjectWizard from '../NewProjectWizard/NewProjectWizard'
import SettingsDialog from '../SettingsDialog/SettingsDialog'
import {WelcomeSignature} from './WelcomeSignature'
import {
    commandErrorMessage,
    getFrameworkLabel,
    getFrameworkTitle,
    normalizeBrowserRecentProjects,
    parseBrowserRecentProject,
    projectOperationErrorMessage,
    type RecentFailure,
} from './welcomeRecentModel'
import {useWelcomeLaunchMetadata} from './useWelcomeLaunchMetadata'
import './WelcomeScreen.css'
import './WelcomeScreenRefresh.css'

export default function WelcomeScreen(): JSX.Element {
    const isElectron = typeof window.api !== 'undefined';
    const {busy} = useProjectCommandState();
    const setProject = useProjectStore((s) => s.setProject);
    const setCustomCss = useEditorStore((s) => s.setCustomCss);
    const markSaved = useEditorStore((s) => s.markSaved);
    const loadPageBlocks = useEditorStore((s) => s.loadPageBlocks);
    const setEditorLayout = useEditorStore((s) => s.setEditorLayout);

    const [recentFailure, setRecentFailure] = useState<RecentFailure | null>(null);
    const [projectError, setProjectError] = useState<string | null>(null);
    const {appVersion, legacyProjectApi, recentProjects, setRecentProjects} = useWelcomeLaunchMetadata(isElectron)

    const [showNewProject, setShowNewProject] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        const linkId = 'welcome-inter-font';
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = 'app-framework://asset/google-fonts/Inter/inter.css';
            document.head.appendChild(link);
        }
    }, []);

    const handleLoad = async () => {
        setProjectError(null);
        const result = await projectCommands.openProject();
        if (result.ok && !isElectron) {
            setEditorLayout(useAppSettingsStore.getState().defaultLayout);
        }
        setProjectError(commandErrorMessage(result));
    };

    const handleOpenBrowserRecent = async (path: string) => {
        const result = await legacyProjectApi.loadFile(path);
        if (result.success && result.content) {
            try {
                const data = parseBrowserRecentProject(result.content)
                setProject(data, result.filePath)
                const firstPage = data.pages[0]
                if (firstPage) {
                    loadPageBlocks(firstPage.blocks.slice())
                }
                setCustomCss(data.customCss)
                markSaved()

                const defaultLayout = useAppSettingsStore.getState().defaultLayout
                setEditorLayout(defaultLayout)
            } catch (error) {
                const message = error instanceof Error ? error.message : 'The legacy project could not be opened.'
                console.error('Failed to load recent project:', error)
                alert(`Failed to load project: ${message}`)
            }
        } else if (!result.canceled) {
            console.error('Failed to load recent project:', result.error);
            alert(`Failed to load project: ${result.error}`)
        }
    };

    const handleOpenRecent = async (recentId: RecentProjectId) => {
        setProjectError(null);
        const result = await projectCommands.openRecent(recentId);
        const message = commandErrorMessage(result);
        if (message !== null) {
            setRecentFailure({id: recentId, message});
            setProjectError(message);
        }
    };

    const handleRemoveElectronRecent = async (e: React.MouseEvent, recentId: RecentProjectId) => {
        e.stopPropagation();
        const result = await projectCommands.removeRecent(recentId);
        if (result.success) {
            setRecentProjects((previous) => previous.filter((recent) => recent.source !== 'electron' || recent.project.id !== result.removedId));
            setRecentFailure((previous) => previous?.id === result.removedId ? null : previous);
        } else {
            setProjectError(projectOperationErrorMessage(result.error));
        }
    };

    const handleRemoveBrowserRecent = async (e: React.MouseEvent, projectPath: string) => {
        e.stopPropagation();
        const result = await legacyProjectApi.removeRecent(projectPath);
        if (result.success && result.projects) {
            setRecentProjects(normalizeBrowserRecentProjects(result.projects).map((project) => ({source: 'browser', project})))
        } else {
            setRecentProjects((previous) => previous.filter((recent) => recent.source !== 'browser' || recent.project.path !== projectPath))
        }
    };

    return (
        <div className="welcome-screen">
            <div className="welcome-background" aria-hidden="true">
                <div className="welcome-aurora welcome-aurora-one"/>
                <div className="welcome-aurora welcome-aurora-two"/>
                <div className="welcome-grid-glow"/>
                <div className="welcome-scanline"/>
                <div className="dot-pulse dot-pulse-one"/>
                <div className="dot-pulse dot-pulse-two"/>
                <div className="dot-pulse dot-pulse-three"/>
                <div className="dot-pulse dot-pulse-four"/>
            </div>

            <div className="welcome-content">
                <header className="welcome-header">
                    <div className="welcome-brand">
                        <div className="welcome-kicker">LOCAL-FIRST VISUAL HTML EDITOR</div>
                        <div className="logo-container">
                            <img src={appLogo} alt="Amagon logo" className="logo-icon" width={40} height={40}/>
                            <div className="welcome-logo">Amagon</div>
                        </div>
                        <div className="welcome-subtitle">
                            Design visually. <span className="highlight">Own the HTML. Ship anywhere.</span>
                        </div>
                        <div className="welcome-proof">
                            <span>Visual canvas</span><span>Live code</span><span>Portable output</span>
                        </div>
                        <div className="welcome-version">{appVersion ? `v${appVersion}` : ''}</div>
                    </div>
                    <WelcomeSignature/>
                </header>

                <div className="welcome-body">
                    <div className="welcome-actions" aria-busy={busy !== null}>
                        <button type="button" className="welcome-btn primary-action" disabled={busy !== null} onClick={() => setShowNewProject(true)}>
                            <div className="btn-icon-wrapper">
                                <FilePlus size={24}/>
                            </div>
                            <div className="btn-text">
                                <div className="btn-title">New Project</div>
                                <div className="btn-desc">Choose a stack and create one .amg project file</div>
                            </div>
                            <ChevronRight className="btn-arrow" size={20}/>
                        </button>

                        <button type="button" className="welcome-btn secondary-action" disabled={busy !== null} onClick={handleLoad}>
                            <div className="btn-icon-wrapper">
                                <FolderOpen size={24}/>
                            </div>
                            <div className="btn-text">
                                <div className="btn-title">Open Project</div>
                                <div className="btn-desc">Open an .amg bundle or legacy JSON project</div>
                            </div>
                            <ChevronRight className="btn-arrow" size={20}/>
                        </button>

                        <button type="button" className="welcome-btn utility-action" onClick={() => setShowSettings(true)}>
                            <div className="btn-icon-wrapper">
                                <Settings size={24}/>
                            </div>
                            <div className="btn-text">
                                <div className="btn-title">Settings</div>
                                <div className="btn-desc">Global preferences &amp; API keys</div>
                            </div>
                            <ChevronRight className="btn-arrow" size={20}/>
                        </button>
                    </div>

                    <div className="welcome-recent">
                        <div className="recent-header">
                            <Clock size={16}/>
                            <span>Recent Projects</span>
                        </div>
                        <div className="recent-list">
                            {projectError !== null && (
                                <div className="recent-path" role="status">{projectError}</div>
                            )}
                            {recentProjects.length === 0 ? (
                                <div className="recent-empty">
                                    No recent projects found
                                </div>
                            ) : (
                                recentProjects.map((recent) => {
                                    if (recent.source === 'electron') {
                                        const {project} = recent;
                                        const failedRecent = recentFailure?.id === project.id;
                                        return (
                                            <div key={project.id} className="recent-row">
                                                <button type="button" className="recent-item" disabled={failedRecent || busy !== null} onClick={() => void handleOpenRecent(project.id)}>
                                                    <div className={`recent-item-icon recent-fw-icon fw-icon-${project.framework ?? 'vanilla'}`} title={getFrameworkTitle(project.framework)} aria-label={getFrameworkTitle(project.framework)}>
                                                        {getFrameworkLabel(project.framework)}
                                                    </div>
                                                    <div className="recent-item-info">
                                                        <div className="recent-name">{project.name}</div>
                                                        <div className="recent-path">{project.displayPath}</div>
                                                        {failedRecent && <div className="recent-path" role="status">Unavailable. Remove it from recents to dismiss this entry.</div>}
                                                    </div>
                                                </button>
                                                <button type="button" className="recent-item-remove" onClick={(event) => void handleRemoveElectronRecent(event, project.id)} title={`Remove ${project.name} from recent projects`}>
                                                    <X size={14}/>
                                                </button>
                                            </div>
                                        )
                                    }

                                    const {project} = recent;
                                    return (
                                        <div key={project.path} className="recent-row">
                                            <button type="button" className="recent-item" disabled={busy !== null} onClick={() => void handleOpenBrowserRecent(project.path)}>
                                                <div className={`recent-item-icon recent-fw-icon fw-icon-${project.framework ?? 'vanilla'}`} title={getFrameworkTitle(project.framework)} aria-label={getFrameworkTitle(project.framework)}>
                                                    {getFrameworkLabel(project.framework)}
                                                </div>
                                                <div className="recent-item-info">
                                                    <div className="recent-name">{project.name}</div>
                                                    <div className="recent-path">{project.path}</div>
                                                </div>
                                            </button>
                                            <button type="button" className="recent-item-remove" onClick={(event) => void handleRemoveBrowserRecent(event, project.path)} title={`Remove ${project.name} from recent projects`}>
                                                <X size={14}/>
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
                <NewProjectWizard onClose={() => setShowNewProject(false)}/>
            )}

            {showSettings && (
                <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)}/>
            )}
        </div>
    )
}
