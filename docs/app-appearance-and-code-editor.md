# App appearance and code editor

App Settings → Appearance changes the application chrome and code editor independently of the website/project theme. The toolbar keeps the quick light/dark toggle; color theme selection and creation live in App Settings → Appearance.

## Themes

Six built-in families each include a light and dark palette: Amagon Classic, Graphite, Ocean, Forest, Rose, and Sandstone. Selecting a family preserves the current mode. Previews are CSS miniatures, with no iframe or preview worker.

Customize a built-in or choose Create theme to make a private copy. The creator edits both palettes, previews changes temporarily, and reports text/background contrast for each mode. Basic controls cover background, accent, text, and border; advanced controls include surfaces, secondary text, selection, status, and syntax colors. Save stores both variants and activates the copy. Cancel, leaving Appearance, or closing settings restores the saved appearance. My themes supports edit/rename, duplicate, delete, and JSON export/import. Built-ins remain immutable. Up to 50 custom themes are stored in application settings.

Share `.amagon-ui-theme.json` files, using the versioned `amagon-ui-theme` format. Import validates complete light/dark hex palettes, names, and a 64 KB size limit; imported identities are regenerated. Website theme files are a separate format. Invalid saved themes are ignored and missing selections fall back to Classic.

## Code editor

The existing lazy Monaco panel uses locally bundled Monaco with HTML/CSS language services, no CDN loader, and app-matched UI/syntax colors. Prettier's HTML or CSS parser loads only on Format. Find/Replace uses Monaco's existing commands. Preferences include 10–24 px type, 2/4-space indentation, wrapping, and an optional minimap (off by default).

HTML models belong to a page; styles.css and custom CSS files belong to the project. Valid edits flush before page changes, saves, and closing the panel. Code commits inside a tab widget merge its edited content into the full page, preserving surrounding widgets and other tabs. Invalid HTML stays a clearly marked draft and does not overwrite the canvas. The status bar distinguishes pending, synced, and invalid edits; the Problems list reveals each issue in its file.

Up to six live models retain cursor, scroll, and undo across file/page switches. A six-model LRU bounds Monaco memory; eviction releases undo history, while a small separate text/view cache helps reopen recent files. Older clean documents regenerate from current project data. Closing the panel releases models; recent text/view snapshots and invalid drafts remain for the current project session. Drafts are not persisted across application restarts. Opening/closing a project clears the session. Removed CSS files release their models.

Clicking a canvas widget switches an open code editor to HTML, centers its opening tag, and highlights its complete element (including nested markup). Repeated clicks reveal the widget again without taking keyboard focus from the canvas. Source-only identities leave export rendering unchanged, and a cached source-range map reuses the installed HTML parser. Reveal on canvas selects the widget enclosing the caret. On-demand completion offers project classes, page filenames, a section snippet, and project theme color variables without background indexing or an additional language server.

## Implementation and checks

- `themes/appThemes.ts`: built-ins, schema validation, contrast, semantic CSS tokens.
- `store/appSettingsStore.ts`: preferences and persistence; `AppearanceSettings.tsx`: lightweight creator/gallery.
- `CodeEditor.tsx` / `editorSupport.ts`: bounded models, formatting, theme integration, navigation and completion.
- `utils/codeEditingSession.ts`: small flush bridge, so project actions never eagerly import Monaco.
- Focused unit tests cover palettes, imports, persistence, preview cancellation, theme management, and editor helpers. Desktop checks cover actual Monaco input, page/tab transitions, formatting, draft recovery and themes.

Validation completed: 36 focused unit tests, fresh-profile Electron theme/code checks, the existing widget desktop smoke check, TypeScript, and the production build pass. Desktop checks cover exact paste output, immediate page switches, HTML/CSS formatting, cursor/undo retention, invalid-draft recovery, theme persistence, canvas navigation, resizing, zero code models on panel close, the six-model cache limit, and saving a pending edit followed by closing and reopening the project.

## Canvas + Code layout

Choose **Canvas + Code** from Change Layout for a resizable 50/50 split: canvas on the left, code on the right. The sidebar and inspector stay hidden. The layout opens code automatically, including when set as the default in App Settings → General. Its code toggle switches to Canvas Only; toggling code there returns to Canvas + Code. This reuses the existing canvas/editor and model cache.
