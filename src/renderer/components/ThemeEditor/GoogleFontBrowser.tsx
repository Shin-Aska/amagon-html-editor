import React, {useEffect, useMemo, useState} from 'react';
import {AlertCircle, Check, ChevronLeft, ChevronRight, Download, Search} from 'lucide-react';
import {useProjectStore} from '../../store/projectStore';
import {useToastStore} from '../../store/toastStore';
import {getGoogleFontPreviewUrl, type GoogleFontMeta, googleFontsCatalog} from '../../data/googleFontsCatalog';
import './GoogleFontBrowser.css';

const CATEGORIES = ['All', 'sans-serif', 'serif', 'display', 'handwriting', 'monospace'];
const RESULTS_PER_PAGE = 8;

function getScopedPreviewFontId(family: string): string {
  return `__gfont_preview_${family.replace(/\s+/g, '_')}`;
}

export default function GoogleFontBrowser(): JSX.Element {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [selectedFont, setSelectedFont] = useState<GoogleFontMeta | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const projectFonts = useProjectStore((s) => s.fonts);
  const addFonts = useProjectStore((s) => s.addFonts);
  const showToast = useToastStore((s) => s.showToast);

  // Filter fonts
  const filteredFonts = useMemo(() => {
    return googleFontsCatalog.filter((font) => {
      const matchQuery = font.family.toLowerCase().includes(query.toLowerCase());
      const matchCategory = category === 'All' || font.category === category;
      return matchQuery && matchCategory;
    });
  }, [query, category]);

  const totalPages = Math.max(1, Math.ceil(filteredFonts.length / RESULTS_PER_PAGE));

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [query, category]);

  // Ensure page is in bounds
  const currentPage = Math.min(page, totalPages);

  const visibleEndIndex = currentPage * RESULTS_PER_PAGE;
  const visibleStartIndex = visibleEndIndex - RESULTS_PER_PAGE;
  const visibleFonts = filteredFonts.slice(visibleStartIndex, visibleEndIndex);

  useEffect(() => {
    const injectedIds = new Set<string>();
    const abortControllers: AbortController[] = [];

    visibleFonts.forEach((font) => {
      const regularVariant = font.variants.find((v) => v.weight === '400') || font.variants[0];
      const url = getGoogleFontPreviewUrl(font.family, regularVariant.weight, regularVariant.style);
      const previewId = getScopedPreviewFontId(font.family);

      if (document.getElementById(previewId)) {
        injectedIds.add(previewId);
        return;
      }

      const controller = new AbortController();
      abortControllers.push(controller);

      fetch(url, { signal: controller.signal })
        .then((res) => res.text())
        .then((css) => {
          const escapedFamily = font.family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const scopedCss = css.replace(
            new RegExp(`font-family:\\s*['"]?${escapedFamily}['"]?`, 'g'),
            `font-family: "${previewId}"`
          );

          const style = document.createElement('style');
          style.id = previewId;
          style.setAttribute('data-gfont-preview', 'true');
          style.textContent = scopedCss;
          document.head.appendChild(style);
          injectedIds.add(previewId);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn(`Failed to load font preview for ${font.family}:`, err);
          }
        });
    });

    return () => {
      abortControllers.forEach((ctrl) => ctrl.abort());
      document.querySelectorAll('style[data-gfont-preview="true"]').forEach((el) => {
        if (!injectedIds.has(el.id)) {
          el.parentNode?.removeChild(el);
        }
      });
    };
  }, [visibleFonts]);

  // Helper to check if a font is already added
  const isFontDownloaded = (family: string) => {
    return projectFonts.some((f) => f.name.toLowerCase() === family.toLowerCase());
  };

  const handleDownloadClick = (font: GoogleFontMeta) => {
    setSelectedFont(font);
    // Select 400 normal by default, or first variant if 400 is not available
    const has400 = font.variants.some((v) => v.weight === '400' && v.style === 'normal');
    const defaultVariant = has400 ? '400-normal' : `${font.variants[0].weight}-${font.variants[0].style}`;
    setSelectedVariants(new Set([defaultVariant]));
  };

  const toggleVariant = (variantKey: string) => {
    setSelectedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(variantKey)) {
        next.delete(variantKey);
      } else {
        next.add(variantKey);
      }
      return next;
    });
  };

  const confirmDownload = async () => {
    if (!selectedFont || selectedVariants.size === 0) return;

    setDownloading(true);
    try {
      const variantsToDownload = selectedFont.variants.filter((v) =>
        selectedVariants.has(`${v.weight}-${v.style}`)
      );

      const res = await window.api.fonts.downloadGoogleFont({
        family: selectedFont.family,
        variants: variantsToDownload,
      });

      if (res.success && res.fonts) {
        addFonts(res.fonts);
        showToast(`Successfully downloaded ${selectedFont.family}`, 'success');
        setSelectedFont(null);
      } else {
        showToast(res.errors?.[0] || 'Failed to download font', 'error');
      }
    } catch (err) {
      showToast('Error communicating with Google Fonts downloader', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="google-font-browser">
      <div className="gfont-warning">
        <AlertCircle size={14} />
        <span>Requires internet connection to preview and download fonts.</span>
      </div>

      <div className="gfont-controls">
        <div className="gfont-search">
          <Search size={16} className="gfont-search-icon" />
          <input
            type="text"
            placeholder="Search fonts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="gfont-categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`gfont-cat-btn ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat === 'All' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="gfont-grid">
        {visibleFonts.length === 0 ? (
          <div className="gfont-empty">No fonts found matching your criteria.</div>
        ) : (
          visibleFonts.map((font) => {
            const downloaded = isFontDownloaded(font.family);
            const regularVariant = font.variants.find((v) => v.weight === '400') || font.variants[0];

            return (
              <div key={font.family} className="theme-font-card gfont-card">
                <div className="theme-font-header">
                  <div>
                    <div className="theme-font-name">{font.family}</div>
                    <div className="theme-font-badges">
                      <span className="theme-font-badge">{font.category}</span>
                      <span className="theme-font-badge">{font.variants.length} styles</span>
                      {font.popularity < 99999 && (
                        <span className="theme-font-badge gfont-popularity-badge">#{font.popularity}</span>
                      )}
                    </div>
                  </div>
                  {downloaded ? (
                    <div className="gfont-status success">
                      <Check size={14} /> Downloaded
                    </div>
                  ) : (
                    <button
                      className="theme-btn theme-btn-small"
                      onClick={() => handleDownloadClick(font)}
                      title={`Download ${font.family}`}
                    >
                      <Download size={14} /> Download
                    </button>
                  )}
                </div>
                <div
                  className="theme-font-preview"
                  style={{
                    fontFamily: `"${getScopedPreviewFontId(font.family)}", sans-serif`,
                    fontWeight: regularVariant.weight,
                    fontStyle: regularVariant.style,
                  }}
                >
                  The quick brown fox jumps over the lazy dog
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="gfont-pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="gfont-page-btn"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="gfont-page-btn"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}

      {selectedFont && (
        <div className="gfont-modal-overlay" onClick={() => setSelectedFont(null)}>
          <div className="gfont-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gfont-modal-header">
              <h3>Download {selectedFont.family}</h3>
              <p>Select variants to download for your project.</p>
            </div>
            <div className="gfont-variant-list">
              {selectedFont.variants.map((v) => {
                const key = `${v.weight}-${v.style}`;
                const isSelected = selectedVariants.has(key);
                return (
                  <label key={key} className="gfont-variant-item">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleVariant(key)}
                    />
                    <span>
                      {v.style === 'italic' ? 'Italic ' : 'Regular '}
                      {v.weight}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="gfont-modal-actions">
              <button
                className="theme-btn"
                onClick={() => setSelectedFont(null)}
                disabled={downloading}
              >
                Cancel
              </button>
              <button
                className="theme-btn theme-btn-primary"
                onClick={confirmDownload}
                disabled={selectedVariants.size === 0 || downloading}
              >
                {downloading ? 'Downloading...' : `Download ${selectedVariants.size} styles`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
