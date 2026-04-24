import {useEffect, useMemo, useRef, useState} from 'react'
import BlockIcon from '../BlockIcon/BlockIcon'
import './SaveCustomBlockDialog.css'

interface SaveCustomBlockDialogProps {
  isOpen: boolean
  availableCategories: string[]
  availableIcons: string[]
  defaultLabel: string
  defaultIcon: string
  defaultCategory: string
  onCancel: () => void
  onSave: (data: { label: string; icon: string; category: string }) => void
}

export default function SaveCustomBlockDialog({
  isOpen,
  availableCategories,
  availableIcons,
  defaultLabel,
  defaultIcon,
  defaultCategory,
  onCancel,
  onSave
}: SaveCustomBlockDialogProps): JSX.Element | null {
  const [label, setLabel] = useState(defaultLabel);
  const [icon, setIcon] = useState(defaultIcon);
  const [category, setCategory] = useState(defaultCategory);
  const iconSupportCacheRef = useRef<Map<string, boolean>>(new Map());

  const isLikelyRenderableIcon = (value: string): boolean => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('lucide:')) return true;
    if (/^[\u2500-\u257F\u2580-\u259F\u25A0-\u25FF]$/.test(trimmed)) return false;
    if (trimmed === '☐' || trimmed === '☑' || trimmed === '▢' || trimmed === '▣' || trimmed === '▭' || trimmed === '🔲' || trimmed === '🔳') return false;

    const cached = iconSupportCacheRef.current.get(trimmed);
    if (cached !== undefined) return cached;

    try {
      if (typeof document === 'undefined') {
        iconSupportCacheRef.current.set(trimmed, true);
        return true
      }

      const canvas = document.createElement('canvas');
      canvas.width = 28;
      canvas.height = 28;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        iconSupportCacheRef.current.set(trimmed, true);
        return true
      }

      const render = (s: string) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textBaseline = 'top';
        ctx.font = '20px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Noto Emoji",sans-serif';
        ctx.fillStyle = '#000';
        ctx.fillText(s, 2, 2);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let hasNonGray = false;
        let hash = 2166136261;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] || 0;
          const g = data[i + 1] || 0;
          const b = data[i + 2] || 0;
          const a = data[i + 3] || 0;
          if (a > 0 && (r !== g || g !== b)) hasNonGray = true;
          hash ^= r;
          hash = Math.imul(hash, 16777619);
          hash ^= g;
          hash = Math.imul(hash, 16777619);
          hash ^= b;
          hash = Math.imul(hash, 16777619);
          hash ^= a;
          hash = Math.imul(hash, 16777619)
        }
        return { hash, hasNonGray }
      };

      const rendered = render(trimmed);
      if (rendered.hasNonGray) {
        iconSupportCacheRef.current.set(trimmed, true);
        return true
      }

      const missing1 = render('\u0378');
      const missing2 = render('\u{10ffff}');
      const replacement = render('\uFFFD');
      const whiteSquare = render('\u25A1');

      const supported =
        rendered.hash !== missing1.hash &&
        rendered.hash !== missing2.hash &&
        rendered.hash !== replacement.hash &&
        rendered.hash !== whiteSquare.hash;
      iconSupportCacheRef.current.set(trimmed, supported);
      return supported
    } catch {
      iconSupportCacheRef.current.set(trimmed, true);
      return true
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setLabel(defaultLabel);
    setIcon(defaultIcon);
    setCategory(defaultCategory)
  }, [defaultCategory, defaultIcon, defaultLabel, isOpen]);

  const dedupedCategories = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const c of availableCategories || []) {
      const trimmed = String(c || '').trim();
      if (!trimmed) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      list.push(trimmed)
    }
    return list
  }, [availableCategories]);

  const dedupedIcons = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const i of availableIcons || []) {
      const trimmed = String(i || '').trim();
      if (!trimmed) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      if (!isLikelyRenderableIcon(trimmed)) continue;
      list.push(trimmed)
    }
    return list
  }, [availableIcons]);

  if (!isOpen) return null;

  const canSave = !!label.trim() && !!category.trim();
  const categoryTrimmed = category.trim();
  const selectedCategory = dedupedCategories.includes(categoryTrimmed) ? categoryTrimmed : '';
  const fallbackIcon = 'lucide:user-block';
  const iconTrimmed = icon.trim();
  const iconToSave = iconTrimmed && isLikelyRenderableIcon(iconTrimmed) ? iconTrimmed : fallbackIcon;

  return (
    <div className="scb-overlay" onClick={onCancel}>
      <div className="scb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="scb-header">
          <h2>Save Custom Block</h2>
          <button className="scb-close-btn" onClick={onCancel}>
            &times;
          </button>
        </div>

        <div className="scb-content">
          <div className="scb-form-group">
            <label className="scb-label">Name</label>
            <input
              className="scb-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') onCancel();
                if (e.key === 'Enter' && canSave) {
                  onSave({ label: label.trim(), icon: iconToSave, category: category.trim() })
                }
              }}
            />
          </div>

          <div className="scb-form-group">
            <label className="scb-label">Icon</label>
            <div className="scb-icon-row">
              <div className="scb-icon-preview" aria-label="Selected icon">
                {iconToSave.startsWith('lucide:') ? (
                  <BlockIcon name={iconToSave.replace(/^lucide:/, '')} className="scb-lucide" />
                ) : !iconTrimmed ? (
                  <BlockIcon name="user-block" className="scb-lucide" />
                ) : (
                  icon.trim()
                )}
              </div>
              <input
                className="scb-input"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="e.g. 🧩 or lucide:container"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onCancel()
                }}
              />
            </div>

            <div className="scb-icon-grid" role="list">
              {dedupedIcons.slice(0, 40).map((i) => {
                const active = (icon || '').trim() === i;
                const isLucide = i.startsWith('lucide:');
                const lucideName = i.replace(/^lucide:/, '');
                return (
                  <button
                    key={i}
                    type="button"
                    className={`scb-icon-btn ${active ? 'active' : ''}`}
                    onClick={() => setIcon(i)}
                    title={`Use icon ${i}`}
                  >
                    {isLucide ? <BlockIcon name={lucideName} /> : i}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="scb-form-group">
            <label className="scb-label">Section</label>
            <select
              className="scb-select"
              value={selectedCategory}
              onChange={(e) => {
                const v = e.target.value;
                if (v) setCategory(v)
              }}
            >
              <option value="">(Custom)</option>
              {dedupedCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className="scb-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="scb-category-list"
              placeholder="e.g. Layout"
              onKeyDown={(e) => {
                if (e.key === 'Escape') onCancel()
              }}
            />
            <datalist id="scb-category-list">
              {dedupedCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="scb-footer">
          <button className="scb-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="scb-btn-primary"
            onClick={() => onSave({ label: label.trim(), icon: iconToSave, category: category.trim() })}
            disabled={!canSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
