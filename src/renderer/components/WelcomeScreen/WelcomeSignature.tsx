export function WelcomeSignature() {
    return (
        <div className="workbench-beacon" aria-hidden="true">
            <div className="beacon-titlebar">
                <span className="beacon-window-mark" />
                <span>index.html</span>
                <span className="beacon-live">LIVE</span>
            </div>

            <div className="beacon-workspace">
                <div className="beacon-rail">
                    <span className="beacon-rail-dot is-active" />
                    <span className="beacon-rail-dot" />
                    <span className="beacon-rail-dot" />
                    <span className="beacon-rail-dot" />
                </div>

                <div className="beacon-canvas">
                    <div className="beacon-canvas-bar">
                        <span />
                        <span />
                        <span />
                    </div>
                    <div className="beacon-page">
                        <span className="beacon-page-kicker" />
                        <span className="beacon-page-heading" />
                        <span className="beacon-page-copy" />
                        <span className="beacon-page-action" />
                        <span className="beacon-selection-label">HERO</span>
                    </div>
                </div>

                <div className="beacon-inspector">
                    <span className="beacon-inspector-label">STYLE</span>
                    <span className="beacon-field" />
                    <span className="beacon-field is-short" />
                    <div className="beacon-swatches">
                        <span />
                        <span />
                        <span />
                    </div>
                </div>
            </div>

            <div className="beacon-code">
                <span className="beacon-line-number">12</span>
                <span className="beacon-code-tag">&lt;section</span>
                <span className="beacon-code-attr"> class</span>
                <span>=&quot;hero&quot;</span>
                <span className="beacon-code-tag">&gt;</span>
                <span className="beacon-caret" />
            </div>
        </div>
    )
}
