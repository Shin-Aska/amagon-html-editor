import { useMemo, useState } from "react";
import { PackageCheck, Search, Trash2, Type, Upload } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { useToastStore } from "../../store/toastStore";
import type { FontAsset, ThemeTypography } from "../../store/types";
import GoogleFontBrowser from "./GoogleFontBrowser";
import TypographyFontPicker from "./TypographyFontPicker";
import "./FontManager.css";

interface FontManagerProps {
  typography: ThemeTypography;
  onTypographyChange: (patch: Partial<ThemeTypography>) => void;
}

export default function FontManager({
  typography,
  onTypographyChange,
}: FontManagerProps): JSX.Element {
  const fonts = useProjectStore((s) => s.fonts);
  const addFonts = useProjectStore((s) => s.addFonts);
  const removeFontStore = useProjectStore((s) => s.removeFont);
  const showToast = useToastStore((s) => s.showToast);
  const [searchQuery, setSearchQuery] = useState("");

  const handleImportFile = async () => {
    try {
      const res = await window.api.fonts.importFile();
      if (res.success && res.fonts && res.fonts.length > 0) {
        addFonts(res.fonts);
        showToast(
          `Imported ${res.fonts.length} font file${res.fonts.length > 1 ? "s" : ""}`,
          "success",
        );
      } else if (!res.canceled) {
        showToast("No fonts were imported", "info");
      }
    } catch {
      showToast("Failed to import font", "error");
    }
  };

  const handleDeleteFont = async (font: FontAsset) => {
    try {
      const res = await window.api.fonts.deleteFont({
        relativePath: font.relativePath,
      });
      if (res.success) {
        removeFontStore(font.id);
        showToast(`Removed "${font.name}"`, "success");
      } else {
        showToast("Failed to remove font file", "error");
      }
    } catch {
      showToast("Error removing font", "error");
    }
  };

  // Inject @font-face rules so previews render correctly in the editor UI
  const fontFacesCSS = useMemo(
    () =>
      fonts
        .filter((f) => f.relativePath)
        .map(
          (font) => `@font-face {
  font-family: "${font.name}";
  src: url("app-media://project-asset/${font.relativePath}");
  ${font.weight ? `font-weight: ${font.weight};` : ""}
  ${font.style ? `font-style: ${font.style};` : ""}
}`,
        )
        .join("\n"),
    [fonts],
  );

  const filteredFonts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return fonts;
    return fonts.filter((f) => f.name.toLowerCase().includes(q));
  }, [fonts, searchQuery]);

  return (
    <div className="theme-font-manager">
      {fontFacesCSS && (
        <style dangerouslySetInnerHTML={{ __html: fontFacesCSS }} />
      )}

      <div className="theme-section">
        <div className="theme-section-title">Typography</div>
        <div className="theme-field-group">
          <TypographyFontPicker
            label="Body Font"
            value={typography.fontFamily}
            onChange={(v) => onTypographyChange({ fontFamily: v })}
          />
          <TypographyFontPicker
            label="Heading Font"
            value={typography.headingFontFamily}
            onChange={(v) => onTypographyChange({ headingFontFamily: v })}
          />
          <div className="theme-field">
            <label className="theme-field-label">Base Font Size</label>
            <input
              className="theme-field-input"
              value={typography.baseFontSize}
              onChange={(e) =>
                onTypographyChange({ baseFontSize: e.target.value })
              }
            />
          </div>
          <div className="theme-field">
            <label className="theme-field-label">Line Height</label>
            <input
              className="theme-field-input"
              value={typography.lineHeight}
              onChange={(e) =>
                onTypographyChange({ lineHeight: e.target.value })
              }
            />
          </div>
          <div className="theme-field">
            <label className="theme-field-label">Heading Line Height</label>
            <input
              className="theme-field-input"
              value={typography.headingLineHeight}
              onChange={(e) =>
                onTypographyChange({ headingLineHeight: e.target.value })
              }
            />
          </div>
        </div>
      </div>

      <div className="theme-font-divider" />

      <div className="theme-section">
        <div className="theme-font-library-header">
          <div className="theme-section-title" style={{ marginBottom: 0 }}>
            Font Library
          </div>
          <button
            className="theme-btn theme-btn-primary"
            onClick={handleImportFile}
          >
            <Upload size={14} /> Import Font File(s)
          </button>
        </div>

        <div className="theme-font-info-banner">
          <PackageCheck
            size={15}
            style={{
              flexShrink: 0,
              color: "var(--color-accent)",
              marginTop: 1,
            }}
          />
          <span>
            <strong style={{ color: "var(--color-accent)" }}>
              Fonts are bundled automatically.
            </strong>{" "}
            Imported font files are copied into your exported site — nothing
            extra to do. Browse Google Fonts below and they will be downloaded
            to your project.
          </span>
        </div>

        <div className="theme-font-search">
          <Search size={16} className="theme-font-search-icon" />
          <input
            type="text"
            placeholder="Search project fonts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="theme-section-title">Project Fonts</div>
        {fonts.length === 0 ? (
          <div className="theme-font-empty-state">
            <Type size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>
              No custom font files imported yet.
            </div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
              Click "Import Font File(s)" to get started.
            </div>
          </div>
        ) : filteredFonts.length === 0 ? (
          <div className="theme-font-empty-state">
            <div style={{ fontSize: 13 }}>No fonts match "{searchQuery}".</div>
          </div>
        ) : (
          <div className="theme-font-grid">
            {filteredFonts.map((font) => (
              <div key={font.id} className="theme-font-card">
                <div className="theme-font-header">
                  <div>
                    <div className="theme-font-name">{font.name}</div>
                    <div className="theme-font-badges">
                      <span className="theme-font-badge">
                        {font.format.toUpperCase()}
                      </span>
                      {font.weight &&
                        font.weight !== "400" &&
                        font.weight !== "normal" && (
                          <span className="theme-font-badge">
                            w{font.weight}
                          </span>
                        )}
                      {font.style && font.style !== "normal" && (
                        <span className="theme-font-badge">{font.style}</span>
                      )}
                      {font.relativePath && (
                        <span
                          className="theme-font-badge"
                          style={{
                            color: "var(--color-success, #22c55e)",
                            borderColor: "rgba(34,197,94,0.35)",
                            background: "rgba(34,197,94,0.08)",
                          }}
                        >
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
                    <Trash2 size={15} />
                  </button>
                </div>
                <div
                  className="theme-font-preview"
                  style={{
                    fontFamily: `"${font.name}", sans-serif`,
                    fontWeight: font.weight || "normal",
                    fontStyle: font.style || "normal",
                  }}
                >
                  The quick brown fox jumps over the lazy dog
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="theme-section-title" style={{ marginTop: 24 }}>
          Google Fonts
        </div>
        <GoogleFontBrowser />
      </div>
    </div>
  );
}
