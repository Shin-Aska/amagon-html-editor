import React, {useState} from 'react'
import {Globe, PackageCheck, Trash2, Type, Upload, X} from 'lucide-react'
import {useProjectStore} from '../../store/projectStore'
import {useToastStore} from '../../store/toastStore'
import type {FontAsset} from '../../store/types'
import GoogleFontBrowser from './GoogleFontBrowser'
import './FontManager.css'

export default function FontManager(): JSX.Element {
    const fonts = useProjectStore((s) => s.fonts);
    const addFonts = useProjectStore((s) => s.addFonts);
    const removeFontStore = useProjectStore((s) => s.removeFont);
    const showToast = useToastStore((s) => s.showToast);
    const [showGoogleFonts, setShowGoogleFonts] = useState(false);

    const handleImportFile = async () => {
        try {
            const res = await window.api.fonts.importFile();
            if (res.success && res.fonts && res.fonts.length > 0) {
                addFonts(res.fonts);
                showToast(`Imported ${res.fonts.length} font file${res.fonts.length > 1 ? 's' : ''}`, 'success')
            } else if (!res.canceled) {
                showToast('No fonts were imported', 'info')
            }
        } catch {
            showToast('Failed to import font', 'error')
        }
    };

    const handleDeleteFont = async (font: FontAsset) => {
        try {
            const res = await window.api.fonts.deleteFont({relativePath: font.relativePath});
            if (res.success) {
                removeFontStore(font.id);
                showToast(`Removed "${font.name}"`, 'success')
            } else {
                showToast('Failed to remove font file', 'error')
            }
        } catch {
            showToast('Error removing font', 'error')
        }
    };

    // Inject @font-face rules so previews render correctly in the editor UI
    const fontFacesCSS = fonts
        .filter((f) => f.relativePath)
        .map(
            (font) => `@font-face {
  font-family: "${font.name}";
  src: url("app-media://project-asset/${font.relativePath}");
  ${font.weight ? `font-weight: ${font.weight};` : ''}
  ${font.style ? `font-style: ${font.style};` : ''}
}`
        )
        .join('\n');

    return (
        <div className="theme-font-manager">
            {fontFacesCSS && <style dangerouslySetInnerHTML={{__html: fontFacesCSS}}/>}

            <div className="theme-section">
                <div className="theme-section-title">Import Custom Fonts</div>
                {/* Auto-export info banner */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    marginBottom: 12,
                    background: 'rgba(124, 58, 237, 0.08)',
                    border: '1px solid rgba(124, 58, 237, 0.25)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.5
                }}>
                    <PackageCheck size={15} style={{flexShrink: 0, color: 'var(--color-accent)', marginTop: 1}}/>
                    <span>
            <strong style={{color: 'var(--color-accent)'}}>Fonts are bundled automatically.</strong>
                        {' '}Imported font files are copied into your exported site — nothing extra to do.
            For web / Google fonts, just type the name in the Typography tab.
          </span>
                </div>
                <div style={{display: 'flex', gap: '12px'}}>
                    <button className="theme-btn theme-btn-primary" onClick={handleImportFile}>
                        <Upload size={14}/> Import Font File(s)
                    </button>
                    <button className="theme-btn" onClick={() => setShowGoogleFonts(!showGoogleFonts)}>
                        {showGoogleFonts ? (
                            <>
                                <X size={14}/> Hide Font Browser
                            </>
                        ) : (
                            <>
                                <Globe size={14}/> Browse Google Fonts
                            </>
                        )}
                    </button>
                </div>
            </div>

            {showGoogleFonts && (
                <GoogleFontBrowser/>
            )}

            <div className="theme-section">
                <div className="theme-section-title">Imported Fonts</div>
                {fonts.length === 0 ? (
                    <div style={{
                        padding: '32px 16px',
                        textAlign: 'center',
                        color: 'var(--color-text-muted)',
                        background: 'var(--color-bg-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px dashed var(--color-border)'
                    }}>
                        <Type size={28} style={{opacity: 0.3, marginBottom: 8}}/>
                        <div style={{fontSize: 13}}>No custom font files imported yet.</div>
                        <div style={{fontSize: 12, marginTop: 4, opacity: 0.7}}>
                            Click "Import Font File(s)" to get started.
                        </div>
                    </div>
                ) : (
                    <div className="theme-font-grid">
                        {fonts.map((font) => (
                            <div key={font.id} className="theme-font-card">
                                <div className="theme-font-header">
                                    <div>
                                        <div className="theme-font-name">{font.name}</div>
                                        <div className="theme-font-badges">
                                            <span className="theme-font-badge">{font.format.toUpperCase()}</span>
                                            {font.weight && font.weight !== '400' && font.weight !== 'normal' && (
                                                <span className="theme-font-badge">w{font.weight}</span>
                                            )}
                                            {font.style && font.style !== 'normal' && (
                                                <span className="theme-font-badge">{font.style}</span>
                                            )}
                                            {font.relativePath && (
                                                <span className="theme-font-badge" style={{
                                                    color: 'var(--color-success, #22c55e)',
                                                    borderColor: 'rgba(34,197,94,0.35)',
                                                    background: 'rgba(34,197,94,0.08)'
                                                }}>
                          ✓ Included in export
                        </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        className="theme-font-delete"
                                        onClick={() => handleDeleteFont(font)}
                                        title={`Remove "${font.name}"`}
                                    >
                                        <Trash2 size={15}/>
                                    </button>
                                </div>
                                <div
                                    className="theme-font-preview"
                                    style={{
                                        fontFamily: `"${font.name}", sans-serif`,
                                        fontWeight: font.weight || 'normal',
                                        fontStyle: font.style || 'normal'
                                    }}
                                >
                                    The quick brown fox jumps over the lazy dog
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
