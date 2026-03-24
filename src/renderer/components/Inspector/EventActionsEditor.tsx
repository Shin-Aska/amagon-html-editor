import { useState, useCallback, useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useEditorStore } from '../../store/editorStore'
import { AI_API_KEY_REQUIRED_MESSAGE, useAiAvailability } from '../../hooks/useAiAvailability'
import { openGlobalSettings } from '../../utils/settingsNavigation'
import './EventActionsEditor.css'
import type * as MonacoType from 'monaco-editor'
import AiCodeAssistModal, { type AiCodeProposal, type AiCodeSelection } from './AiCodeAssistModal'
import AiProposalReviewPanel from '../AiAssistant/AiProposalReviewPanel'

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

interface PendingAiReview {
    proposal: AiCodeProposal
    sourceCode: string
    previewCode: string
    selectionSnapshot: AiCodeSelection | null
}

function normalizeProposalToFullCode(currentCode: string, proposal: AiCodeProposal): string {
    const nextCode = proposal.code.trim()
    if (!nextCode) return currentCode
    if (nextCode.includes('(function') && nextCode.includes('.call(this, event)')) return nextCode
    return `(function(event) {\n  ${nextCode.replace(/\n/g, '\n  ')}\n}).call(this, event)`
}

function insertSnippetAtAnchor(currentCode: string, proposal: AiCodeProposal): string {
    const snippet = proposal.code.trim()
    if (!snippet) return currentCode

    const appendWithSpacing = (base: string, addition: string): string => {
        if (!base.trim()) return addition
        const separator = base.endsWith('\n') ? '' : '\n'
        return `${base}${separator}${addition}`
    }

    if (proposal.anchor === 'inside_function_start') {
        const match = currentCode.match(/\(function\(event\)\s*\{\n?/)
        if (match && typeof match.index === 'number') {
            const insertAt = match.index + match[0].length
            return `${currentCode.slice(0, insertAt)}\n  ${snippet.replace(/\n/g, '\n  ')}${currentCode.slice(insertAt)}`
        }
    }

    if (proposal.anchor === 'inside_function_end') {
        const closingIndex = currentCode.lastIndexOf('}).call(this, event)')
        if (closingIndex >= 0) {
            const beforeClosing = currentCode.slice(0, closingIndex).replace(/\s*$/, '')
            const afterClosing = currentCode.slice(closingIndex)
            return `${beforeClosing}\n  ${snippet.replace(/\n/g, '\n  ')}\n${afterClosing}`
        }
    }

    if (proposal.matchText) {
        const lines = currentCode.split('\n')
        const lineIndex = lines.findIndex((line) => line.includes(proposal.matchText!))
        if (lineIndex >= 0) {
            const insertIndex = proposal.anchor === 'before_line_containing' ? lineIndex : lineIndex + 1
            lines.splice(insertIndex, 0, ...snippet.split('\n'))
            return lines.join('\n')
        }
    }

    return appendWithSpacing(currentCode, snippet)
}

function applyProposalToCode(
    currentCode: string,
    proposal: AiCodeProposal,
    selectionSnapshot: AiCodeSelection | null
): string {
    if (proposal.mode === 'replace_all') {
        return normalizeProposalToFullCode(currentCode, proposal)
    }

    if (proposal.mode === 'replace_selection' && selectionSnapshot?.text.trim()) {
        const target = selectionSnapshot.text
        const index = currentCode.indexOf(target)
        if (index >= 0) {
            return `${currentCode.slice(0, index)}${proposal.code}${currentCode.slice(index + target.length)}`
        }
    }

    return insertSnippetAtAnchor(currentCode, proposal)
}

export default function EventActionsEditor({ blockId, events }: EventActionsEditorProps): JSX.Element {
    const updateBlock = useEditorStore((s) => s.updateBlock)
    const setIsTypingCode = useEditorStore((s) => s.setIsTypingCode)
    const getBlockById = useEditorStore((s) => s.getBlockById)
    const { hasConfiguredAiProvider } = useAiAvailability()
    const [editingEvent, setEditingEvent] = useState<string | null>(null)
    const [editorCode, setEditorCode] = useState('')
    const [showAddDropdown, setShowAddDropdown] = useState(false)
    const [showAiAssist, setShowAiAssist] = useState(false)
    const [aiRequestText, setAiRequestText] = useState('')
    const [selection, setSelection] = useState<AiCodeSelection | null>(null)
    const [pendingAiReview, setPendingAiReview] = useState<PendingAiReview | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null)

    const currentEvents = events || {}
    const eventEntries = Object.entries(currentEvents).filter(([, v]) => v !== undefined)
    const block = getBlockById(blockId)

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
        setShowAddDropdown(false)
        // Open editor for new event — only persist when user clicks Save
        setEditingEvent(eventName)
        setEditorCode(template)
        setAiRequestText('')
        setSelection(null)
        setPendingAiReview(null)
    }, [])

    const handleRemoveEvent = useCallback((eventName: string) => {
        const newEvents = { ...currentEvents }
        delete newEvents[eventName]
        updateBlock(blockId, { events: newEvents })
    }, [blockId, currentEvents, updateBlock])

    const handleEditEvent = useCallback((eventName: string) => {
        setEditingEvent(eventName)
        setEditorCode(currentEvents[eventName] || '')
        setAiRequestText('')
        setSelection(null)
        setPendingAiReview(null)
    }, [currentEvents])

    const handleSaveCode = useCallback(() => {
        if (!editingEvent) return
        const newEvents = { ...currentEvents, [editingEvent]: editorCode }
        updateBlock(blockId, { events: newEvents })
        setEditingEvent(null)
        setEditorCode('')
        setAiRequestText('')
        setPendingAiReview(null)
    }, [blockId, editingEvent, editorCode, currentEvents, updateBlock])

    const handleSaveAndClose = useCallback(() => {
        handleSaveCode()
        setShowAiAssist(false)
        setIsTypingCode(false)
    }, [handleSaveCode, setIsTypingCode])

    const handleCancelEdit = useCallback(() => {
        setShowAiAssist(false)
        setEditingEvent(null)
        setEditorCode('')
        setAiRequestText('')
        setSelection(null)
        setPendingAiReview(null)
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
        const updateSelectionState = () => {
            const model = editor.getModel()
            const currentSelection = editor.getSelection()
            if (!model || !currentSelection) {
                setSelection(null)
                return
            }

            const text = model.getValueInRange(currentSelection)
            if (!text.trim()) {
                setSelection(null)
                return
            }

            setSelection({
                text,
                startLineNumber: currentSelection.startLineNumber,
                endLineNumber: currentSelection.endLineNumber
            })
        }
        
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

        const disposableSelection = editor.onDidChangeCursorSelection(() => {
            updateSelectionState()
        })
        
        return () => {
            disposableBlur.dispose()
            disposableFocus.dispose()
            disposableSelection.dispose()
        }
    }

    const handleProposalGenerated = useCallback(
        (proposal: AiCodeProposal) => {
            const selectionSnapshot = selection ? { ...selection } : null
            const sourceCode = editorCode
            const previewCode = applyProposalToCode(sourceCode, proposal, selectionSnapshot)
            setPendingAiReview({
                proposal,
                sourceCode,
                previewCode,
                selectionSnapshot
            })
            setShowAiAssist(false)
        },
        [editorCode, selection]
    )

    const handleApplyAiReview = useCallback(() => {
        if (!pendingAiReview) return
        setEditorCode(pendingAiReview.previewCode)
        setPendingAiReview(null)
        setSelection(null)
    }, [pendingAiReview])

    const handleDiscardAiReview = useCallback(() => {
        setPendingAiReview(null)
        setShowAiAssist(true)
    }, [])

    return (
        <div className="event-actions-editor">
            {eventEntries.length === 0 && (
                <p className="event-actions-empty">No events configured. Add an event to attach JavaScript behavior.</p>
            )}

            {eventEntries.length > 0 && (
                <div className="event-actions-list">
                    {eventEntries.map(([name]) => (
                        <div key={name} className="event-actions-item">
                            <div className="event-actions-item-info">
                                <span className="event-actions-name">{getEventLabel(name)}</span>
                            </div>
                            <div className="event-actions-item-buttons">
                                <button
                                    className="event-actions-btn edit"
                                    onClick={() => handleEditEvent(name)}
                                    title="Edit code"
                                >
                                    Edit
                                </button>
                                <button
                                    className="event-actions-btn remove"
                                    onClick={() => handleRemoveEvent(name)}
                                    title="Remove event"
                                >
                                    Remove
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
                <>
                    <div className="event-editor-overlay" onClick={handleCancelEdit}>
                        <div className="event-editor-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="event-editor-header">
                                <div className="event-editor-header-left">
                                    <h4>Edit: {getEventLabel(editingEvent)}</h4>
                                    <span className="event-editor-event-name">{editingEvent}</span>
                                </div>
                            </div>
                            <div className="event-editor-body">
                                <AiCodeAssistModal
                                    isOpen={showAiAssist}
                                    eventName={editingEvent}
                                    block={block}
                                    currentCode={editorCode}
                                    selection={selection}
                                    requestText={aiRequestText}
                                    onRequestTextChange={setAiRequestText}
                                    onProposalGenerated={handleProposalGenerated}
                                    onClose={() => setShowAiAssist(false)}
                                />
                                <div className="event-editor-code-surface">
                                    {pendingAiReview ? (
                                        <AiProposalReviewPanel
                                            modeLabel={pendingAiReview.proposal.mode.replace('_', ' ')}
                                            explanation={pendingAiReview.proposal.explanation}
                                            hint={pendingAiReview.proposal.insertHint}
                                            original={pendingAiReview.sourceCode}
                                            modified={pendingAiReview.previewCode}
                                            language="javascript"
                                            height="300px"
                                            onDiscard={handleDiscardAiReview}
                                            onApply={handleApplyAiReview}
                                        />
                                    ) : (
                                        <Editor
                                            height="300px"
                                            defaultLanguage="javascript"
                                            value={editorCode}
                                            onChange={(value) => {
                                                setEditorCode(value || '')
                                                if (pendingAiReview) setPendingAiReview(null)
                                            }}
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
                                    )}
                                </div>
                            </div>
                            <div className="event-editor-footer">
                                <button
                                    className="event-editor-btn ai"
                                    onClick={() => {
                                        if (!hasConfiguredAiProvider) return
                                        setShowAiAssist((prev) => !prev)
                                    }}
                                    type="button"
                                    disabled={!hasConfiguredAiProvider || !!pendingAiReview}
                                    title={
                                        pendingAiReview
                                            ? 'Apply or discard the current proposal first'
                                            : !hasConfiguredAiProvider
                                              ? AI_API_KEY_REQUIRED_MESSAGE
                                              : undefined
                                    }
                                >
                                    {showAiAssist ? 'Hide AI Assist' : '✨ AI Code Assist'}
                                </button>
                                {!hasConfiguredAiProvider && (
                                    <button
                                        className="event-editor-inline-link"
                                        type="button"
                                        onClick={() => openGlobalSettings({ tab: 'keys' })}
                                    >
                                        {AI_API_KEY_REQUIRED_MESSAGE}
                                    </button>
                                )}
                                <button className="event-editor-btn cancel" onClick={handleCancelEdit}>
                                    Cancel
                                </button>
                                <button className="event-editor-btn save" onClick={handleSaveAndClose}>
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
