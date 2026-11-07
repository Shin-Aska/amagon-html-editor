import {useId, useState, type ReactNode} from 'react'

/** Closed sections do not mount their editors (font pickers, image browsers, etc.). */
export default function InspectorSection({title, children, defaultOpen = false, forceOpen = false}: {
    title: string
    children: ReactNode
    defaultOpen?: boolean
    forceOpen?: boolean
}): JSX.Element {
    const [open, setOpen] = useState(defaultOpen);
    const id = useId();
    const expanded = forceOpen || open;
    return <section className="inspector-group inspector-section">
        <h4 className="inspector-group-title">
            <button type="button" className="inspector-section-toggle" aria-expanded={expanded}
                    aria-controls={id} onClick={() => setOpen(!expanded)}>
                <span>{title}</span><span aria-hidden="true">{expanded ? '−' : '+'}</span>
            </button>
        </h4>
        {expanded && <div id={id} className="inspector-section-body">{children}</div>}
    </section>
}
