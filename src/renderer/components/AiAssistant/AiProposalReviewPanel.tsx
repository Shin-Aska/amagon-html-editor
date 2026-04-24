import {DiffEditor} from '@monaco-editor/react'
import {useEffect, useId, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import './AiProposalReviewPanel.css'

interface AiProposalReviewPanelProps {
    explanation: string
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
    explanation,
    original,
    modified,
    language,
    height = '100%',
    onDiscard,
    onApply,
    discardLabel = 'Discard Proposal',
    applyLabel = 'Apply Proposal'
}: AiProposalReviewPanelProps): JSX.Element {
    const infoRef = useRef<HTMLButtonElement | null>(null);
    const [tooltipOpen, setTooltipOpen] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const tooltipId = useId();

    useEffect(() => {
        if (!tooltipOpen) return;

        const updatePosition = () => {
            const anchor = infoRef.current;
            if (!anchor) return;
            const rect = anchor.getBoundingClientRect();
            const width = Math.min(320, Math.max(220, window.innerWidth * 0.6));
            const left = Math.min(
                Math.max(12, rect.left),
                Math.max(12, window.innerWidth - width - 12)
            );
            const top = rect.bottom + 8;
            setTooltipStyle({ top, left })
        };

        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition)
        }
    }, [tooltipOpen]);

    return (
        <div className="ai-proposal-review-panel">
            <div className="ai-proposal-review-bar">
                <div className="ai-proposal-review-summary">
                    <div className="ai-proposal-review-summary-top">
                        <button
                            ref={infoRef}
                            className="ai-proposal-review-info"
                            type="button"
                            aria-label="Show explanation"
                            aria-describedby={tooltipOpen ? tooltipId : undefined}
                            onMouseEnter={() => setTooltipOpen(true)}
                            onMouseLeave={() => setTooltipOpen(false)}
                            onFocus={() => setTooltipOpen(true)}
                            onBlur={() => setTooltipOpen(false)}
                        >
                            <span className="ai-proposal-review-info-icon">i</span>
                        </button>
                    </div>
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
            {tooltipOpen && typeof document !== 'undefined'
                ? createPortal(
                      <div
                          id={tooltipId}
                          className="ai-proposal-review-tooltip is-portal"
                          role="tooltip"
                          style={{ top: tooltipStyle.top, left: tooltipStyle.left }}
                      >
                          {explanation}
                      </div>,
                      document.body
                  )
                : null}
        </div>
    )
}
