import { useState, useCallback, useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { useEditorStore } from '../../store/editorStore'
import './EventActionsEditor.css'

const AVAILABLE_EVENTS = [
    { value: 'onclick', label: 'On Click' },
    { value: 'ondblclick', label: 'On Double Click' },
    { value: 'onchange', label: 'On Change' },
    { value: 'oninput', label: 'On Input' },
    { value: 'onsubmit', label: 'On Submit' },
    { value: 'onfocus', label: 'On Focus' },
    { value: 'onblur', label: 'On Blur' },
    { value: 'onkeydown', label: 'On Key Down' },
    { value: 'onkeyup', label: 'On Key Up' },
    { value: 'onmouseover', label: 'On Mouse Over' },
    { value: 'onmouseout', label: 'On Mouse Out' },
    { value: 'onmouseenter', label: 'On Mouse Enter' },
    { value: 'onmouseleave', label: 'On Mouse Leave' },
    { value: 'onload', label: 'On Load' },
    { value: 'onerror', label: 'On Error' }
]

interface EventActionsEditorProps {
    blockId: string
    events: Record<string, string>
}

export default function EventActionsEditor({ blockId, events }: EventActionsEditorProps): JSX.Element {
    const updateBlock = useEditorStore((s) => s.updateBlock)
    const [editingEvent, setEditingEvent] = useState<string | null>(null)
    const [editorCode, setEditorCode] = useState('')
    const [showAddDropdown, setShowAddDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const currentEvents = events || {}
    const eventEntries = Object.entries(currentEvents).filter(([, v]) => v !== undefined)

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!showAddDropdown) return
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowAddDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showAddDropdown])

    const handleAddEvent = useCallback((eventName: string) => {
        const newEvents = { ...currentEvents, [eventName]: '' }
        updateBlock(blockId, { events: newEvents })
        setShowAddDropdown(false)
        // Immediately open editor for new event
        setEditingEvent(eventName)
        setEditorCode('')
    }, [blockId, currentEvents, updateBlock])

    const handleRemoveEvent = useCallback((eventName: string) => {
        const newEvents = { ...currentEvents }
        delete newEvents[eventName]
        updateBlock(blockId, { events: newEvents })
    }, [blockId, currentEvents, updateBlock])

    const handleEditEvent = useCallback((eventName: string) => {
        setEditingEvent(eventName)
        setEditorCode(currentEvents[eventName] || '')
    }, [currentEvents])

    const handleSaveCode = useCallback(() => {
        if (!editingEvent) return
        const newEvents = { ...currentEvents, [editingEvent]: editorCode }
        updateBlock(blockId, { events: newEvents })
        setEditingEvent(null)
        setEditorCode('')
    }, [blockId, editingEvent, editorCode, currentEvents, updateBlock])

    const handleCancelEdit = useCallback(() => {
        setEditingEvent(null)
        setEditorCode('')
    }, [])

    // Filter out events already added
    const availableToAdd = AVAILABLE_EVENTS.filter(
        (e) => !Object.prototype.hasOwnProperty.call(currentEvents, e.value)
    )

    const getEventLabel = (eventName: string): string => {
        const found = AVAILABLE_EVENTS.find((e) => e.value === eventName)
        return found ? found.label : eventName
    }

    return (
        <div className="event-actions-editor">
            {eventEntries.length === 0 && (
                <p className="event-actions-empty">No events configured. Add an event to attach JavaScript behavior.</p>
            )}

            {eventEntries.length > 0 && (
                <div className="event-actions-list">
                    {eventEntries.map(([name, code]) => (
                        <div key={name} className="event-actions-item">
                            <div className="event-actions-item-info">
                                <span className="event-actions-name">{getEventLabel(name)}</span>
                                <span className="event-actions-code-preview">
                                    {code ? code.substring(0, 40) + (code.length > 40 ? '…' : '') : '(empty)'}
                                </span>
                            </div>
                            <div className="event-actions-item-buttons">
                                <button
                                    className="event-actions-btn edit"
                                    onClick={() => handleEditEvent(name)}
                                    title="Edit code"
                                >
                                    ✎
                                </button>
                                <button
                                    className="event-actions-btn remove"
                                    onClick={() => handleRemoveEvent(name)}
                                    title="Remove event"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="event-actions-add-wrapper" ref={dropdownRef}>
                <button
                    className="event-actions-add-btn"
                    onClick={() => setShowAddDropdown(!showAddDropdown)}
                    disabled={availableToAdd.length === 0}
                >
                    + Add Event
                </button>
                {showAddDropdown && (
                    <div className="event-actions-dropdown">
                        {availableToAdd.map((evt) => (
                            <button
                                key={evt.value}
                                className="event-actions-dropdown-item"
                                onClick={() => handleAddEvent(evt.value)}
                            >
                                {evt.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Monaco Editor Modal */}
            {editingEvent && (
                <div className="event-editor-overlay" onClick={handleCancelEdit}>
                    <div className="event-editor-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="event-editor-header">
                            <h4>Edit: {getEventLabel(editingEvent)}</h4>
                            <span className="event-editor-event-name">{editingEvent}</span>
                        </div>
                        <div className="event-editor-body">
                            <Editor
                                height="300px"
                                defaultLanguage="javascript"
                                value={editorCode}
                                onChange={(value) => setEditorCode(value || '')}
                                theme="vs-dark"
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 13,
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                    wordWrap: 'on',
                                    tabSize: 2,
                                    automaticLayout: true,
                                    padding: { top: 8 }
                                }}
                            />
                        </div>
                        <div className="event-editor-footer">
                            <button className="event-editor-btn cancel" onClick={handleCancelEdit}>
                                Cancel
                            </button>
                            <button className="event-editor-btn save" onClick={handleSaveCode}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
