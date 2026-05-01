import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Globe,
  PackageCheck,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { useToastStore } from "../../store/toastStore";
import type { FontAsset, ThemeTypography } from "../../store/types";
import {
  getGoogleFontPreviewUrl,
  type GoogleFontMeta,
  googleFontsCatalog,
} from "../../data/googleFontsCatalog";
import TypographyFontPicker from "./TypographyFontPicker";
import "./FontManager.css";

type FilterTab = "all" | "imported" | "system" | "internet";

interface UnifiedFont {
  id: string;
  name: string;
  source: "system" | "internet" | "local";
  status: "imported" | "available";
  fontAsset?: FontAsset;
  internetMeta?: GoogleFontMeta;
}

const PAGE_SIZE = 50;

function getScopedPreviewFontId(family: string): string {
  return `__gfont_preview_${family.replace(/\s+/g, "_")}`;
}

function variantLabel(v: { weight: string; style: string }): string {
  const styleLabel = v.style === "italic" ? "Italic" : "Regular";
  return `${styleLabel} ${v.weight}`;
}

function variantKey(v: { weight: string; style: string }): string {
  return `${v.weight}-${v.style}`;
}

export default function FontManager({
  typography,
  onTypographyChange,
}: {
  typography: ThemeTypography;
  onTypographyChange: (patch: Partial<ThemeTypography>) => void;
}): JSX.Element {
  const fonts = useProjectStore((s) => s.fonts);
  const systemFonts = useProjectStore((s) => s.systemFonts);
  const addFonts = useProjectStore((s) => s.addFonts);
  const removeFontStore = useProjectStore((s) => s.removeFont);
  const setSystemFonts = useProjectStore((s) => s.setSystemFonts);
  const showToast = useToastStore((s) => s.showToast);

  const [filter, setFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [loadingSystemFonts, setLoadingSystemFonts] = useState(false);

  const selectRefs = useRef<Record<string, HTMLSelectElement | null>>({});
  const systemFontsAcc = useRef<string[]>([]);

  useEffect(() => {
    if (systemFonts.length > 0) return;
    setLoadingSystemFonts(true);
    systemFontsAcc.current = [];
    window.api.fonts
      .listSystem()
      .then((res) => {
        if (res.success && Array.isArray(res.fonts) && res.fonts.length > 0) {
          const batchSize = 40;
          let index = 0;

          const flush = () => {
            const batch = res.fonts.slice(index, index + batchSize);
            if (batch.length === 0) {
              setLoadingSystemFonts(false);
              return;
            }
            const existing = new Set(
              systemFontsAcc.current.map((f) => f.toLowerCase()),
            );
            for (const name of batch) {
              if (
                typeof name === "string" &&
                !existing.has(name.toLowerCase())
              ) {
                systemFontsAcc.current.push(name);
                existing.add(name.toLowerCase());
              }
            }
            setSystemFonts([...systemFontsAcc.current]);
            index += batchSize;
            requestAnimationFrame(flush);
          };

          flush();
        } else {
          setLoadingSystemFonts(false);
        }
      })
      .catch(() => setLoadingSystemFonts(false));
  }, [systemFonts.length, setSystemFonts]);

  const importedNames = useMemo(
    () => new Set(fonts.map((f) => f.name.toLowerCase())),
    [fonts],
  );

  const unifiedList = useMemo<UnifiedFont[]>(() => {
    const q = searchQuery.toLowerCase().trim();
    const list: UnifiedFont[] = [];

    const includeImported = filter === "all" || filter === "imported";
    const includeSystem = filter === "all" || filter === "system";
    const includeInternet = filter === "all" || filter === "internet";

    if (includeImported) {
      for (const font of fonts) {
        if (q && !font.name.toLowerCase().includes(q)) continue;
        const source: UnifiedFont["source"] =
          font.source === "google-fonts"
            ? "internet"
            : font.source === "system"
              ? "system"
              : "local";
        list.push({
          id: font.id,
          name: font.name,
          source,
          status: "imported",
          fontAsset: font,
        });
      }
    }

    if (includeSystem) {
      for (const name of systemFonts) {
        if (importedNames.has(name.toLowerCase())) continue;
        if (q && !name.toLowerCase().includes(q)) continue;
        list.push({
          id: `sys_${name}`,
          name,
          source: "system",
          status: "available",
        });
      }
    }

    if (includeInternet) {
      for (const meta of googleFontsCatalog) {
        if (importedNames.has(meta.family.toLowerCase())) continue;
        if (q && !meta.family.toLowerCase().includes(q)) continue;
        list.push({
          id: `web_${meta.family}`,
          name: meta.family,
          source: "internet",
          status: "available",
          internetMeta: meta,
        });
      }
    }

    return list;
  }, [fonts, systemFonts, importedNames, filter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(unifiedList.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = unifiedList.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [filter, searchQuery]);

  useEffect(() => {
    const injectedIds = new Set<string>();
    const abortControllers: AbortController[] = [];

    const internetItems = pageItems.filter(
      (i) => i.source === "internet" && i.internetMeta,
    );
    internetItems.forEach((item) => {
      const meta = item.internetMeta!;
      const regularVariant =
        meta.variants.find((v) => v.weight === "400" && v.style === "normal") ||
        meta.variants[0];
      const url = getGoogleFontPreviewUrl(
        meta.family,
        regularVariant.weight,
        regularVariant.style,
      );
      const previewId = getScopedPreviewFontId(meta.family);

      if (document.getElementById(previewId)) {
        injectedIds.add(previewId);
        return;
      }

      const controller = new AbortController();
      abortControllers.push(controller);

      fetch(url, { signal: controller.signal })
        .then((res) => res.text())
        .then((css) => {
          const escapedFamily = meta.family.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          );
          const scopedCss = css.replace(
            new RegExp(`font-family:\\s*['"]?${escapedFamily}['"]?`, "g"),
            `font-family: "${previewId}"`,
          );
          const style = document.createElement("style");
          style.id = previewId;
          style.setAttribute("data-gfont-preview", "true");
          style.textContent = scopedCss;
          document.head.appendChild(style);
          injectedIds.add(previewId);
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.warn(
              `Failed to load font preview for ${meta.family}:`,
              err,
            );
          }
        });
    });

    return () => {
      abortControllers.forEach((ctrl) => ctrl.abort());
      document
        .querySelectorAll('style[data-gfont-preview="true"]')
        .forEach((el) => {
          if (!injectedIds.has(el.id)) {
            el.parentNode?.removeChild(el);
          }
        });
    };
  }, [pageItems]);

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

  const handleImportSystemFont = async (name: string) => {
    try {
      const res = await window.api.fonts.copySystemFont({
        familyName: name,
        filePaths: [],
      });
      if (res.success && res.fonts && res.fonts.length > 0) {
        addFonts(res.fonts);
        showToast(`Imported system font "${name}"`, "success");
      } else {
        showToast(res.error || `Failed to import "${name}"`, "error");
      }
    } catch {
      showToast(`Error importing "${name}"`, "error");
    }
  };

  const handleDownloadInternet = async (item: UnifiedFont) => {
    if (!item.internetMeta) return;
    const meta = item.internetMeta;
    const selectEl = selectRefs.current[item.id];
    const selectedKey = selectEl?.value;

    if (!selectedKey) return;
    const variant = meta.variants.find((v) => variantKey(v) === selectedKey);
    if (!variant) return;

    setDownloadingIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });

    try {
      const res = await window.api.fonts.downloadGoogleFont({
        family: meta.family,
        variants: [variant],
      });
      if (res.success && res.fonts) {
        addFonts(res.fonts);
        showToast(`Downloaded "${meta.family}"`, "success");
      } else {
        showToast(res.errors?.[0] || "Download failed", "error");
      }
    } catch {
      showToast("Error downloading font", "error");
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

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

  const sourceBadge = (source: UnifiedFont["source"]) => {
    const map: Record<string, { label: string; cls: string }> = {
      system: { label: "System", cls: "tag-system" },
      internet: { label: "Internet", cls: "tag-internet" },
      local: { label: "Local", cls: "tag-local" },
    };
    const cfg = map[source] ?? map.local;
    return <span className={`theme-font-tag ${cfg.cls}`}>{cfg.label}</span>;
  };

  const statusBadge = (status: UnifiedFont["status"]) => (
    <span
      className={`theme-font-tag ${status === "imported" ? "tag-imported" : "tag-available"}`}
    >
      {status === "imported" ? "Imported" : "Available"}
    </span>
  );

  const previewFamily = (item: UnifiedFont): string => {
    if (item.source === "internet" && item.internetMeta) {
      return `"${getScopedPreviewFontId(item.name)}", sans-serif`;
    }
    return `"${item.name}", sans-serif`;
  };

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
            Imported font files are copied into your exported site.
          </span>
        </div>

        {loadingSystemFonts && (
          <div className="theme-font-loading-bar">
            <div className="theme-font-loading-track">
              <div className="theme-font-loading-fill" />
            </div>
            <span className="theme-font-loading-label">
              Loading system fonts...
            </span>
          </div>
        )}

        <div className="theme-font-controls">
          <div className="theme-font-filter-tabs">
            {[
              { id: "all" as FilterTab, label: "All" },
              { id: "imported" as FilterTab, label: "Imported" },
              { id: "system" as FilterTab, label: "System" },
              { id: "internet" as FilterTab, label: "Internet" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`theme-font-filter-tab ${filter === tab.id ? "active" : ""}`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="theme-font-search">
            <Search size={16} className="theme-font-search-icon" />
            <input
              type="text"
              placeholder="Search fonts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="theme-font-table-wrapper">
          <table className="theme-font-table">
            <thead>
              <tr>
                <th className="col-preview">Preview</th>
                <th className="col-name">Name</th>
                <th className="col-source">Source</th>
                <th className="col-status">Status</th>
                <th className="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="theme-font-table-empty">
                    No fonts match your search.
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => (
                  <tr key={item.id}>
                    <td className="col-preview">
                      <span
                        className="theme-font-preview-text"
                        style={{ fontFamily: previewFamily(item) }}
                      >
                        {item.name}
                      </span>
                    </td>
                    <td className="col-name">{item.name}</td>
                    <td className="col-source">{sourceBadge(item.source)}</td>
                    <td className="col-status">{statusBadge(item.status)}</td>
                    <td className="col-action">
                      {item.status === "imported" && item.fontAsset ? (
                        <button
                          className="theme-font-action-btn theme-font-action-btn-danger"
                          onClick={() => handleDeleteFont(item.fontAsset!)}
                          title={`Remove "${item.name}"`}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : item.source === "system" ? (
                        <button
                          className="theme-font-action-btn"
                          onClick={() => handleImportSystemFont(item.name)}
                          title={`Import "${item.name}"`}
                        >
                          <Download size={14} />
                        </button>
                      ) : item.source === "internet" && item.internetMeta ? (
                        <div className="theme-font-inline-action">
                          <select
                            className="theme-font-variant-select"
                            ref={(el) => {
                              selectRefs.current[item.id] = el;
                            }}
                            defaultValue={variantKey(
                              item.internetMeta.variants.find(
                                (v) =>
                                  v.weight === "400" && v.style === "normal",
                              ) ?? item.internetMeta.variants[0],
                            )}
                          >
                            {item.internetMeta.variants.map((v) => (
                              <option key={variantKey(v)} value={variantKey(v)}>
                                {variantLabel(v)}
                              </option>
                            ))}
                          </select>
                          <button
                            className="theme-btn theme-btn-small theme-btn-primary"
                            onClick={() => handleDownloadInternet(item)}
                            disabled={downloadingIds.has(item.id)}
                            title={`Download "${item.name}"`}
                          >
                            {downloadingIds.has(item.id) ? (
                              "..."
                            ) : (
                              <>
                                <Globe size={12} /> Apply
                              </>
                            )}
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="theme-font-pagination">
            <button
              className="theme-font-page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <span className="theme-font-page-info">
              Page {currentPage} of {totalPages} ({unifiedList.length} fonts)
            </span>
            <button
              className="theme-font-page-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
