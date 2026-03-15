import { useState, useCallback, useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useEditorStore } from '../../store/editorStore'
import './EventActionsEditor.css'
import type * as MonacoType from 'monaco-editor'

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

// Prepopulated code templates for each event type
const EVENT_TEMPLATES: Record<string, string> = {
    onclick: `(function(event) {
  // Runs when this element is clicked
  // 'this' refers to the element, 'event' is the click event
  
}).call(this, event)`,
    ondblclick: `(function(event) {
  // Runs when this element is double-clicked
  
}).call(this, event)`,
    onchange: `(function(event) {
  // Runs when the value of this element changes
  // For inputs/selects: var value = this.value;
  
}).call(this, event)`,
    oninput: `(function(event) {
  // Runs on every keystroke/input change
  // var value = this.value;
  
}).call(this, event)`,
    onsubmit: `(function(event) {
  // Runs when this form is submitted
  // event.preventDefault(); // Uncomment to prevent default submission
  
}).call(this, event)`,
    onfocus: `(function(event) {
  // Runs when this element receives focus
  
}).call(this, event)`,
    onblur: `(function(event) {
  // Runs when this element loses focus
  
}).call(this, event)`,
    onkeydown: `(function(event) {
  // Runs when a key is pressed down
  // var key = event.key;
  
}).call(this, event)`,
    onkeyup: `(function(event) {
  // Runs when a key is released
  // var key = event.key;
  
}).call(this, event)`,
    onmouseover: `(function(event) {
  // Runs when the mouse enters this element (bubbles)
  
}).call(this, event)`,
    onmouseout: `(function(event) {
  // Runs when the mouse leaves this element (bubbles)
  
}).call(this, event)`,
    onmouseenter: `(function(event) {
  // Runs when the mouse enters this element (no bubbling)
  
}).call(this, event)`,
    onmouseleave: `(function(event) {
  // Runs when the mouse leaves this element (no bubbling)
  
}).call(this, event)`,
    onload: `(function(event) {
  // Runs when this element has finished loading
  
}).call(this, event)`,
    onerror: `(function(event) {
  // Runs when an error occurs on this element
  
}).call(this, event)`
}

interface EventActionsEditorProps {
    blockId: string
    events: Record<string, string>
}

export default function EventActionsEditor({ blockId, events }: EventActionsEditorProps): JSX.Element {
    const updateBlock = useEditorStore((s) => s.updateBlock)
    const setIsTypingCode = useEditorStore((s) => s.setIsTypingCode)
    const [editingEvent, setEditingEvent] = useState<string | null>(null)
    const [editorCode, setEditorCode] = useState('')
    const [showAddDropdown, setShowAddDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null)

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
        const template = EVENT_TEMPLATES[eventName] || `(function(event) {
  // Your code here
  
}).call(this, event)`
        const newEvents = { ...currentEvents, [eventName]: template }
        updateBlock(blockId, { events: newEvents })
        setShowAddDropdown(false)
        // Immediately open editor for new event
        setEditingEvent(eventName)
        setEditorCode(template)
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

    const handleSaveAndClose = useCallback(() => {
        handleSaveCode()
        setIsTypingCode(false)
    }, [handleSaveCode, setIsTypingCode])

    const handleCancelEdit = useCallback(() => {
        setEditingEvent(null)
        setEditorCode('')
        setIsTypingCode(false)
    }, [setIsTypingCode])

    // Set isTypingCode when editor opens/closes
    useEffect(() => {
        if (editingEvent) {
            setIsTypingCode(true)
        } else {
            setIsTypingCode(false)
        }
    }, [editingEvent, setIsTypingCode])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            setIsTypingCode(false)
        }
    }, [setIsTypingCode])
    const availableToAdd = AVAILABLE_EVENTS.filter(
        (e) => !Object.prototype.hasOwnProperty.call(currentEvents, e.value)
    )

    const getEventLabel = (eventName: string): string => {
        const found = AVAILABLE_EVENTS.find((e) => e.value === eventName)
        return found ? found.label : eventName
    }

    const handleEditorMount: OnMount = (editor) => {
        editorRef.current = editor
        
        // Focus the editor when it mounts
        editor.focus()
        
        // Listen for blur/focus to update isTypingCode
        const disposableBlur = editor.onDidBlurEditorWidget(() => {
            // We keep isTypingCode true while the modal is open
            // even if the editor loses focus, to prevent accidental block operations
        })
        
        const disposableFocus = editor.onDidFocusEditorWidget(() => {
            setIsTypingCode(true)
        })
        
        return () => {
            disposableBlur.dispose()
            disposableFocus.dispose()
        }
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
                                onMount={handleEditorMount}
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
                            <button className="event-editor-btn save" onClick={handleSaveAndClose}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
