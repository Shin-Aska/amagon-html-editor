import {useEffect, useRef} from 'react'
import {Cpu} from 'lucide-react'
import {preloadAiModels} from '../../aiBootstrap'
import {useAiStore} from '../../store/aiStore'
import WelcomeScreen from './WelcomeScreen'
import './WelcomeStartupGate.css'

export default function WelcomeStartupGate(): JSX.Element {
    const configLoaded = useAiStore((state) => state.configLoaded)
    const modelsLoaded = useAiStore((state) => state.modelsLoaded)
    const initializing = !configLoaded || !modelsLoaded
    const dialogRef = useRef<HTMLElement>(null)
    const welcomeRef = useRef<HTMLDivElement>(null)
    const wasInitializing = useRef(initializing)

    useEffect(() => {
        if (initializing) {
            void preloadAiModels()
            dialogRef.current?.focus()
        } else if (wasInitializing.current) {
            welcomeRef.current?.querySelector<HTMLButtonElement>('.welcome-btn.primary-action')?.focus()
        }
        wasInitializing.current = initializing
    }, [initializing])

    return (
        <>
            <div ref={welcomeRef} className="welcome-startup-content" inert={initializing} aria-hidden={initializing}>
                <WelcomeScreen/>
            </div>

            {initializing && (
                <div className="welcome-initialization-overlay">
                    <section
                        ref={dialogRef}
                        className="welcome-initialization-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="welcome-initialization-title"
                        aria-describedby="welcome-initialization-description"
                        tabIndex={-1}
                    >
                        <div className="welcome-initialization-icon" aria-hidden="true">
                            <Cpu size={24} strokeWidth={1.75}/>
                        </div>
                        <div className="welcome-initialization-copy">
                            <span className="welcome-initialization-kicker">AI ENGINE</span>
                            <h2 id="welcome-initialization-title">App is initializing (AI engine)…</h2>
                            <p id="welcome-initialization-description">Loading providers and available models before your workspace opens.</p>
                        </div>
                        <div className="welcome-initialization-status" role="status">
                            <span className="welcome-initialization-dots" aria-hidden="true">
                                <span/><span/><span/>
                            </span>
                            <span>Preparing your workspace</span>
                        </div>
                    </section>
                </div>
            )}
        </>
    )
}
