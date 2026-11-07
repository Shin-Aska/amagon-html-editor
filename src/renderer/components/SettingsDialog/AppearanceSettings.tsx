import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAppSettingsStore } from "../../store/appSettingsStore";
import {
  APP_TOKEN_LABELS,
  BUILTIN_APP_THEMES,
  applyAppPalette,
  contrastRatio,
  parseAppTheme,
  resolveAppTheme,
  serializeAppTheme,
  type AppColorTheme,
  type AppMode,
  type AppToken,
} from "../../themes/appThemes";
import "./AppearanceSettings.css";

function restoreAppearance(): void {
  const s = useAppSettingsStore.getState();
  applyAppPalette(
    s.theme,
    resolveAppTheme(s.appColorTheme, s.customAppThemes)[s.theme],
  );
}
export default function AppearanceSettings(): JSX.Element {
  const mode = useAppSettingsStore((s) => s.theme);
  const active = useAppSettingsStore((s) => s.appColorTheme);
  const custom = useAppSettingsStore((s) => s.customAppThemes);
  const save = useAppSettingsStore((s) => s.saveSettings);
  const [draft, setDraft] = useState<AppColorTheme | null>(null);
  const [editMode, setEditMode] = useState<AppMode>(mode);
  const [message, setMessage] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (draft) applyAppPalette(editMode, draft[editMode]);
    else restoreAppearance();
    return restoreAppearance;
  }, [draft, editMode, mode, active, custom]);
  const start = (theme: AppColorTheme, copy: boolean) => {
    setDraft({
      ...theme,
      id: copy ? crypto.randomUUID() : theme.id,
      name: copy ? `${theme.name} copy`.slice(0, 60) : theme.name,
      light: { ...theme.light },
      dark: { ...theme.dark },
    });
    setEditMode(mode);
    setMessage("");
    setDeleteId(null);
  };
  const persist = async () => {
    if (!draft || !draft.name.trim()) {
      setMessage("Give your theme a name.");
      return;
    }
    if (!custom.some((t) => t.id === draft.id) && custom.length >= 50) {
      setMessage(
        "You can save up to 50 custom themes. Delete one before adding another.",
      );
      return;
    }
    const persisted = await save({
      customAppThemes: [
        ...custom.filter((t) => t.id !== draft.id),
        { ...draft, name: draft.name.trim() },
      ],
      appColorTheme: draft.id,
    });
    if (!persisted) {
      setMessage(
        "Theme applied for this session, but preferences could not be saved. Try Save theme again.",
      );
      return;
    }
    setDraft(null);
    setMessage("Theme saved.");
  };
  const exportTheme = (theme: AppColorTheme) => {
    const url = URL.createObjectURL(
      new Blob([serializeAppTheme(theme)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.amagon-ui-theme.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const card = (theme: AppColorTheme, builtin: boolean) => {
    const p = theme[mode];
    return (
      <div
        key={theme.id}
        className={`app-theme-card ${active === theme.id ? "is-selected" : ""}`}
      >
        <button
          type="button"
          className="app-theme-choose"
          aria-pressed={active === theme.id}
          onClick={() => {
            void save({ appColorTheme: theme.id });
            setMessage("");
          }}
        >
          <span
            className="app-theme-preview"
            style={
              {
                "--preview-bg": p.bgPrimary,
                "--preview-surface": p.bgSurface,
                "--preview-accent": p.accent,
                "--preview-text": p.textPrimary,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            <span className="app-theme-preview-bar" />
            <span className="app-theme-preview-side" />
            <span className="app-theme-preview-lines">
              <i />
              <i />
              <i />
            </span>
          </span>
          <span>{theme.name}</span>
        </button>
        <div className="app-theme-card-actions">
          {!builtin && (
            <button
              type="button"
              onClick={() => start(theme, false)}
              aria-label={`Edit ${theme.name}`}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => start(theme, true)}
            aria-label={`${builtin ? "Customize" : "Duplicate"} ${theme.name}`}
          >
            {builtin ? "Customize" : "Duplicate"}
          </button>
          <button
            type="button"
            onClick={() => exportTheme(theme)}
            aria-label={`Export ${theme.name}`}
          >
            Export
          </button>
          {!builtin && (
            <button
              type="button"
              onClick={() => setDeleteId(theme.id)}
              aria-label={`Delete ${theme.name}`}
            >
              Delete
            </button>
          )}
        </div>
        {deleteId === theme.id && (
          <div className="app-theme-delete">
            Delete this theme?{" "}
            <button
              type="button"
              onClick={() => {
                void save({
                  customAppThemes: custom.filter((t) => t.id !== theme.id),
                  appColorTheme: active === theme.id ? "classic" : active,
                });
                setDeleteId(null);
              }}
            >
              Delete theme
            </button>
            <button type="button" onClick={() => setDeleteId(null)}>
              Keep
            </button>
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="appearance-settings">
      <p className="settings-label-desc">
        Personalize the app and code editor. Your website’s theme stays
        independent.
      </p>
      {!draft ? (
        <>
          <div className="appearance-heading">
            <h3>Mode</h3>
            <div className="theme-toggle">
              {(["light", "dark"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`theme-btn ${m === mode ? "active" : ""}`}
                  aria-pressed={m === mode}
                  onClick={() => void save({ theme: m })}
                >
                  {m === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </div>
          <h3>Built-in themes</h3>
          <div className="app-theme-grid">
            {BUILTIN_APP_THEMES.map((t) => card(t, true))}
          </div>
          <div className="appearance-heading">
            <h3>
              My themes <small>({custom.length}/50)</small>
            </h3>
            <div className="appearance-actions">
              <button
                type="button"
                className="settings-btn-secondary"
                onClick={() => start(resolveAppTheme(active, custom), true)}
              >
                Create theme
              </button>
              <button
                type="button"
                className="settings-btn-secondary"
                onClick={() => inputRef.current?.click()}
              >
                Import JSON
              </button>
            </div>
          </div>
          {!custom.length && (
            <p className="settings-label-desc">
              Start from any built-in theme, adjust its colors, and save your
              own.
            </p>
          )}
          <div className="app-theme-grid">
            {custom.map((t) => card(t, false))}
          </div>
        </>
      ) : (
        <div className="app-theme-builder">
          <div className="appearance-heading">
            <h3>Theme creator</h3>
            <span className="app-theme-preview-label">
              Live preview · not saved yet
            </span>
          </div>
          <label className="app-theme-name">
            Theme name
            <input
              autoFocus
              maxLength={60}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <div className="appearance-heading">
            <span>Edit palette</span>
            <div className="theme-toggle">
              {(["light", "dark"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`theme-btn ${editMode === m ? "active" : ""}`}
                  aria-pressed={editMode === m}
                  onClick={() => setEditMode(m)}
                >
                  {m === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </div>
          <div className="app-theme-colors">
            {(
              ["bgPrimary", "accent", "textPrimary", "border"] as AppToken[]
            ).map((key) => (
              <label key={key}>
                {APP_TOKEN_LABELS[key]}
                <input
                  aria-label={APP_TOKEN_LABELS[key]}
                  type="color"
                  value={draft[editMode][key]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [editMode]: { ...draft[editMode], [key]: e.target.value },
                    })
                  }
                />
                <code>{draft[editMode][key]}</code>
              </label>
            ))}
          </div>
          <details>
            <summary>Advanced colors & syntax</summary>
            <div className="app-theme-colors">
              {(Object.keys(APP_TOKEN_LABELS) as AppToken[])
                .filter(
                  (k) =>
                    !["bgPrimary", "accent", "textPrimary", "border"].includes(
                      k,
                    ),
                )
                .map((key) => (
                  <label key={key}>
                    {APP_TOKEN_LABELS[key]}
                    <input
                      aria-label={APP_TOKEN_LABELS[key]}
                      type="color"
                      value={draft[editMode][key]}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [editMode]: {
                            ...draft[editMode],
                            [key]: e.target.value,
                          },
                        })
                      }
                    />
                    <code>{draft[editMode][key]}</code>
                  </label>
                ))}
            </div>
          </details>
          <div className="app-theme-contrast" role="status">
            {(["light", "dark"] as const).map((m) => {
              const p = draft[m],
                ratio = contrastRatio(p.textPrimary, p.bgPrimary);
              return (
                <p key={m}>
                  {m === "light" ? "Light" : "Dark"} text contrast:{" "}
                  {ratio.toFixed(1)}:1{" "}
                  {ratio >= 4.5
                    ? "— good for normal text"
                    : "— low contrast; aim for 4.5:1"}
                </p>
              );
            })}
          </div>
          <p className="settings-label-desc">
            Save stores both palettes. Closing or cancelling restores your saved
            appearance.
          </p>
          <div className="appearance-actions">
            <button
              type="button"
              className="settings-btn-primary"
              onClick={() => void persist()}
            >
              Save theme
            </button>
            <button
              type="button"
              className="settings-btn-secondary"
              onClick={() => {
                setDraft(null);
                setMessage("Preview cancelled.");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 65536)
              throw new Error("Theme files must be smaller than 64 KB.");
            const theme = parseAppTheme(JSON.parse(await file.text()));
            setDraft(theme);
            setEditMode(mode);
            setMessage(
              "Imported theme ready to preview. Save to add it to My themes.",
            );
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Could not import this theme.",
            );
          }
        }}
      />
      {message && (
        <p className="app-theme-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
