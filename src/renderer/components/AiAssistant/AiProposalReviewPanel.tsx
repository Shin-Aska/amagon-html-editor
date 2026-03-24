import { DiffEditor } from '@monaco-editor/react'
import './AiProposalReviewPanel.css'

interface AiProposalReviewPanelProps {
    modeLabel: string
    explanation: string
    hint?: string
    original: string
    modified: string
    language: string
    height?: string
    onDiscard: () => void
    onApply: () => void
    discardLabel?: string
    applyLabel?: string
}

export default function AiProposalReviewPanel({
    modeLabel,
    explanation,
    hint,
    original,
    modified,
    language,
    height = '100%',
    onDiscard,
    onApply,
    discardLabel = 'Discard Proposal',
    applyLabel = 'Apply Proposal'
}: AiProposalReviewPanelProps): JSX.Element {
    return (
        <div className="ai-proposal-review-panel">
            <div className="ai-proposal-review-bar">
                <div className="ai-proposal-review-summary">
                    <span className="ai-proposal-review-badge">{modeLabel}</span>
                    <span className="ai-proposal-review-explanation">{explanation}</span>
                    {hint && <span className="ai-proposal-review-hint">{hint}</span>}
                </div>
                <div className="ai-proposal-review-actions">
                    <button className="ai-proposal-review-btn" type="button" onClick={onDiscard}>
                        {discardLabel}
                    </button>
                    <button className="ai-proposal-review-btn primary" type="button" onClick={onApply}>
                        {applyLabel}
                    </button>
                </div>
            </div>
            <div className="ai-proposal-review-surface">
                <DiffEditor
                    height={height}
                    original={original}
                    modified={modified}
                    language={language}
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
            </div>
        </div>
    )
}
