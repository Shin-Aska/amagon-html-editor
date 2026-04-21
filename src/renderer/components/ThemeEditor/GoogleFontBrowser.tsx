import React, { useState, useMemo, useEffect } from 'react';
import { Search, Check, Download, AlertCircle, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useToastStore } from '../../store/toastStore';
import { googleFontsCatalog, getGoogleFontPreviewUrl, type GoogleFontMeta } from '../../data/googleFontsCatalog';
import './GoogleFontBrowser.css';

const CATEGORIES = ['All', 'sans-serif', 'serif', 'display', 'handwriting', 'monospace'];
const RESULTS_PER_PAGE = 8;

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

  // Inject stylesheets for visible fonts
  useEffect(() => {
    const injectedUrls = new Set<string>();

    visibleFonts.forEach((font) => {
      const regularVariant = font.variants.find((v) => v.weight === '400') || font.variants[0];
      const url = getGoogleFontPreviewUrl(font.family, regularVariant.weight, regularVariant.style);

      // Check if already injected
      if (!document.querySelector(`link[href="${url}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.setAttribute('data-gfont-preview', 'true');
        document.head.appendChild(link);
      }
      injectedUrls.add(url);
    });

    return () => {
      // Remove ALL gfont preview links that are not in the current visible set
      // This ensures no accumulation when paginating or on unmount
      document.querySelectorAll('link[data-gfont-preview="true"]').forEach((el) => {
        const link = el as HTMLLinkElement;
        if (!injectedUrls.has(link.href)) {
          link.parentNode?.removeChild(link);
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
                    fontFamily: `"${font.family}", sans-serif`,
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
