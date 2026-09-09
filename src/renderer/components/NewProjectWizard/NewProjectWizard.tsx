import {useEffect, useRef, useState} from 'react'
import {projectCommands} from '../../project/projectCommands'
import {useEditorStore} from '../../store/editorStore'
import {useAppSettingsStore} from '../../store/appSettingsStore'
import type {FrameworkChoice} from '../../store/types'
import './NewProjectWizard.css'

interface NewProjectWizardProps {
    onClose: () => void
}

const FRAMEWORK_OPTIONS: { id: FrameworkChoice; label: string; desc: string; icon: string; color: string }[] = [
    {
        id: 'bootstrap-5',
        label: 'Bootstrap 5',
        desc: 'The most popular HTML/CSS/JS framework.',
        icon: 'B',
        color: '#7952b3'
    },
    {id: 'tailwind', label: 'Tailwind CSS', desc: 'A utility-first CSS framework.', icon: 'T', color: '#38bdf8'},
    {
        id: 'vanilla',
        label: 'Vanilla HTML/CSS',
        desc: 'No framework — pure semantic HTML and CSS.',
        icon: '<>',
        color: '#6c757d'
    }
];

export default function NewProjectWizard({onClose}: NewProjectWizardProps): JSX.Element {
    const [projectName, setProjectName] = useState('My Website');
    const [framework, setFramework] = useState<FrameworkChoice>('bootstrap-5');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setEditorLayout = useEditorStore((s) => s.setEditorLayout);
    const isElectron = typeof window.api !== 'undefined';
    const modalRef = useRef<HTMLDivElement>(null);
    const projectNameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        projectNameInputRef.current?.focus();

        return () => {
            previouslyFocused?.focus();
        };
    }, []);

    const handleModalKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            return;
        }

        if (event.key !== 'Tab') return;

        const focusableElements = Array.from(
            modalRef.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled])'
            ) ?? []
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (!firstFocusable || !lastFocusable) return;

        if (event.shiftKey && document.activeElement === firstFocusable) {
            event.preventDefault();
            lastFocusable.focus();
        } else if (!event.shiftKey && document.activeElement === lastFocusable) {
            event.preventDefault();
            firstFocusable.focus();
        }
    };

    const handleCreate = async () => {
        if (!projectName.trim()) {
            setError('Please enter a project name.');
            return
        }

        setLoading(true);
        setError(null);

        try {
            const result = await projectCommands.newProject({
                name: projectName.trim(),
                framework
            });
            if (result.ok) {
                if (!isElectron) {
                    setEditorLayout(useAppSettingsStore.getState().defaultLayout);
                }
                onClose();
            } else if (!result.canceled) {
                setError(result.message.detail);
            }
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    };

    return (
        <div className="npw-overlay" onClick={onClose}>
            <div
                ref={modalRef}
                className="npw-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-project-title"
                aria-describedby="new-project-format-help"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleModalKeyDown}
            >
                <div className="npw-header">
                    <h2 id="new-project-title">New Project</h2>
                    <button className="npw-close-btn" onClick={onClose} aria-label="Close new project dialog">&times;</button>
                </div>

                <div className="npw-content">
                    <div className="npw-form-group">
                        <label className="npw-label" htmlFor="new-project-name">Project Name</label>
                        <input
                            ref={projectNameInputRef}
                            id="new-project-name"
                            type="text"
                            className="npw-input"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            placeholder="e.g. My Portfolio"
                            aria-describedby="new-project-format-help"
                        />
                        <span id="new-project-format-help" className="npw-fw-info">
                            {isElectron
                                ? 'Creates one portable .amg project file. You will choose where to save it next.'
                                : 'Browser preview creates a legacy JSON project only.'}
                        </span>
                    </div>

                    <div className="npw-form-group">
                        <label className="npw-label">CSS Framework</label>
                        <div className="npw-framework-list" role="radiogroup" aria-label="CSS Framework">
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
                                    <div className="npw-fw-icon" style={{backgroundColor: fw.color}}>
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
