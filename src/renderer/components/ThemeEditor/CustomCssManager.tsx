import { useState, useCallback, useEffect, useMemo, type MouseEvent } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import { useProjectStore } from '../../store/projectStore'
import type { CssFile, ProjectTheme } from '../../store/types'
import AiCssAssistModal, { type AiCssProposal } from './AiCssAssistModal'
import './CustomCssManager.css'

interface PendingCssReview {
    proposal: AiCssProposal
    sourceCss: string
    previewCss: string
}

function applyCssProposal(currentCss: string, proposal: AiCssProposal): string {
    const snippet = proposal.css.trim()
    if (!snippet) return currentCss

    if (proposal.mode === 'replace') {
        return snippet
    }

    if (proposal.matchText) {
        const lines = currentCss.split('\n')
        const lineIndex = lines.findIndex((line) => line.includes(proposal.matchText!))
        if (lineIndex >= 0) {
            const insertIndex = proposal.anchor === 'before_selector' ? lineIndex : lineIndex + 1
            lines.splice(insertIndex, 0, ...snippet.split('\n'))
            return lines.join('\n')
        }
    }

    if (!currentCss.trim()) return snippet
    return `${currentCss.replace(/\s*$/, '')}\n\n${snippet}`
}

export default function CustomCssManager({ theme }: { theme: ProjectTheme }): JSX.Element {
    const addCssFile = useProjectStore((s) => s.addCssFile)
    const removeCssFile = useProjectStore((s) => s.removeCssFile)
    const updateCssFile = useProjectStore((s) => s.updateCssFile)
    const reorderCssFiles = useProjectStore((s) => s.reorderCssFiles)
    const toggleCssFile = useProjectStore((s) => s.toggleCssFile)

    const files = theme.customCssFiles || []
    const [selectedFileId, setSelectedFileId] = useState<string | null>(
        files.length > 0 ? files[0].id : null
    )
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: CssFile } | null>(null)
    const [aiModalFile, setAiModalFile] = useState<CssFile | null>(null)
    const [aiPrompt, setAiPrompt] = useState('')
    const [pendingCssReview, setPendingCssReview] = useState<PendingCssReview | null>(null)

    const selectedFile = files.find((f) => f.id === selectedFileId) || null
    const allFileNames = useMemo(() => files.map((f) => f.name), [files])

    useEffect(() => {
        if (!contextMenu) return
        const handlePointerDown = () => setContextMenu(null)
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setContextMenu(null)
        }
        window.addEventListener('pointerdown', handlePointerDown)
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown)
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [contextMenu])

    const handleAddFile = useCallback(() => {
        const name = `stylesheet-${files.length + 1}.css`
        const file = addCssFile(name)
        setSelectedFileId(file.id)
        setPendingCssReview(null)
    }, [files.length, addCssFile])

    const handleRemoveFile = useCallback((id: string) => {
        removeCssFile(id)
        if (selectedFileId === id) {
            const remaining = files.filter((f) => f.id !== id)
            setSelectedFileId(remaining.length > 0 ? remaining[0].id : null)
        }
    }, [files, selectedFileId, removeCssFile])

    const handleCssChange = useCallback((value: string | undefined) => {
        if (selectedFileId) {
            updateCssFile(selectedFileId, { css: value || '' })
            setPendingCssReview(null)
        }
    }, [selectedFileId, updateCssFile])

    const handleStartRename = useCallback((file: CssFile) => {
        setRenamingId(file.id)
        setRenameValue(file.name)
    }, [])

    const handleFinishRename = useCallback(() => {
        if (renamingId && renameValue.trim()) {
            updateCssFile(renamingId, { name: renameValue.trim() })
        }
        setRenamingId(null)
        setRenameValue('')
    }, [renamingId, renameValue, updateCssFile])

    const handleMoveUp = useCallback((index: number) => {
        if (index > 0) reorderCssFiles(index, index - 1)
    }, [reorderCssFiles])

    const handleMoveDown = useCallback((index: number) => {
        if (index < files.length - 1) reorderCssFiles(index, index + 1)
    }, [files.length, reorderCssFiles])

    const handleOpenContextMenu = useCallback((event: MouseEvent<HTMLDivElement>, file: CssFile) => {
        event.preventDefault()
        const menuWidth = 180
        const menuHeight = 44
        const padding = 8
        const x = Math.min(event.clientX, window.innerWidth - menuWidth - padding)
        const y = Math.min(event.clientY, window.innerHeight - menuHeight - padding)
        setSelectedFileId(file.id)
        setContextMenu({ x, y, file })
    }, [])

    const handleProposalGenerated = useCallback((proposal: AiCssProposal) => {
        if (!aiModalFile) return
        const sourceCss = aiModalFile.css || ''
        const previewCss = applyCssProposal(sourceCss, proposal)
        setPendingCssReview({
            proposal,
            sourceCss,
            previewCss
        })
    }, [aiModalFile])

    const handleAcceptProposal = useCallback(() => {
        if (!pendingCssReview || !selectedFileId) return
        updateCssFile(selectedFileId, { css: pendingCssReview.previewCss })
        setPendingCssReview(null)
        setAiPrompt('')
    }, [pendingCssReview, selectedFileId, updateCssFile])

    const handleDenyProposal = useCallback(() => {
        setPendingCssReview(null)
        if (selectedFile) {
            setAiModalFile(selectedFile)
        }
    }, [selectedFile])

    return (
        <div className="css-manager">
            <div className="css-manager-sidebar">
                <div className="css-manager-sidebar-header">
                    <span className="css-manager-sidebar-title">CSS Files</span>
                    <button className="css-manager-add-btn" onClick={handleAddFile} title="Add CSS file">
                        +
                    </button>
                </div>

                {files.length === 0 && (
                    <p className="css-manager-empty">No CSS files. Click + to add one.</p>
                )}

                <div className="css-manager-file-list">
                    {files.map((file, index) => (
                        <div
                            key={file.id}
                            className={`css-manager-file-item ${file.id === selectedFileId ? 'active' : ''} ${!file.enabled ? 'disabled' : ''}`}
                            onClick={() => setSelectedFileId(file.id)}
                            onContextMenu={(e) => handleOpenContextMenu(e, file)}
                        >
                            <span className="css-manager-file-order">{index + 1}</span>

                            {renamingId === file.id ? (
                                <input
                                    className="css-manager-rename-input"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={handleFinishRename}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleFinishRename()
                                        if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                                    }}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span
                                    className="css-manager-file-name"
                                    onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(file) }}
                                    title="Double-click to rename"
                                >
                                    {file.name}
                                </span>
                            )}

                            <div className="css-manager-file-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                    className="css-manager-icon-btn"
                                    onClick={() => handleMoveUp(index)}
                                    disabled={index === 0}
                                    title="Move up"
                                >
                                    ↑
                                </button>
                                <button
                                    className="css-manager-icon-btn"
                                    onClick={() => handleMoveDown(index)}
                                    disabled={index === files.length - 1}
                                    title="Move down"
                                >
                                    ↓
                                </button>
                                <button
                                    className={`css-manager-icon-btn toggle ${file.enabled ? 'on' : 'off'}`}
                                    onClick={() => toggleCssFile(file.id)}
                                    title={file.enabled ? 'Disable' : 'Enable'}
                                >
                                    {file.enabled ? '●' : '○'}
                                </button>
                                <button
                                    className="css-manager-icon-btn delete"
                                    onClick={() => handleRemoveFile(file.id)}
                                    title="Delete"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="css-manager-editor">
                {selectedFile ? (
                    <>
                        <div className="css-manager-editor-header">
                            <span className="css-manager-editor-filename">{selectedFile.name}</span>
                            {!selectedFile.enabled && (
                                <span className="css-manager-editor-disabled-badge">Disabled</span>
                            )}
                        </div>
                        {pendingCssReview && selectedFileId === selectedFile.id && (
                            <div className="css-manager-review-bar">
                                <div className="css-manager-review-summary">
                                    <span className="css-manager-review-badge">{pendingCssReview.proposal.mode}</span>
                                    <div className="css-manager-review-explanation">
                                        {pendingCssReview.proposal.explanation}
                                    </div>
                                    {pendingCssReview.proposal.insertHint && (
                                        <div className="css-manager-review-hint">
                                            {pendingCssReview.proposal.insertHint}
                                        </div>
                                    )}
                                </div>
                                <div className="css-manager-review-actions">
                                    <button className="theme-btn" onClick={handleDenyProposal}>
                                        Deny Proposal
                                    </button>
                                    <button className="theme-btn theme-btn-primary" onClick={handleAcceptProposal}>
                                        Accept Proposal
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="css-manager-editor-body">
                            {pendingCssReview && selectedFileId === selectedFile.id ? (
                                <DiffEditor
                                    height="100%"
                                    original={pendingCssReview.sourceCss}
                                    modified={pendingCssReview.previewCss}
                                    language="css"
                                    theme="vs-dark"
                                    options={{
                                        renderSideBySide: false,
                                        readOnly: true,
                                        minimap: { enabled: false },
                                        fontSize: 13,
                                        lineNumbers: 'on',
                                        scrollBeyondLastLine: false,
                                        wordWrap: 'on',
                                        automaticLayout: true,
                                        diffCodeLens: true,
                                        renderIndicators: true
                                    }}
                                />
                            ) : (
                                <Editor
                                    key={selectedFile.id}
                                    height="100%"
                                    defaultLanguage="css"
                                    value={selectedFile.css}
                                    onChange={handleCssChange}
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
                            )}
                        </div>
                    </>
                ) : (
                    <div className="css-manager-no-selection">
                        <p>Select a CSS file from the sidebar or create a new one.</p>
                    </div>
                )}
            </div>

            {contextMenu && (
                <div
                    className="css-manager-context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <div className="css-manager-context-group-label">Smart Actions</div>
                    <button
                        className="css-manager-context-item css-manager-context-item-ai"
                        onClick={() => {
                            setAiModalFile(contextMenu.file)
                            setContextMenu(null)
                        }}
                    >
                        ✨ Assist with AI
                    </button>
                    <div className="css-manager-context-divider" />
                </div>
            )}

            <AiCssAssistModal
                isOpen={!!aiModalFile}
                file={aiModalFile}
                allFileNames={allFileNames}
                theme={theme}
                prompt={aiPrompt}
                onPromptChange={setAiPrompt}
                onClose={() => setAiModalFile(null)}
                onProposalGenerated={handleProposalGenerated}
            />
        </div>
    )
}
