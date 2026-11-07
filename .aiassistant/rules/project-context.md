---
apply: always
---

# Amagon Project Context

Amagon is an offline, AI-powered visual HTML editor built with Electron, React, and TypeScript.

For deeper context on architecture, data models, IPC channels, and conventions, see `GUIDELINES.md` at the repo root.

## Tech Stack

- Electron, Vite, React, TypeScript, Zustand, Monaco Editor, Bootstrap 5

## Project Structure

```text
src/
├── main/                 # Electron main process
│   ├── aiService.ts      # AI provider adapters + secure key storage
│   ├── cliHelpers.ts     # CLI provider discovery and model probing
│   ├── credentialCatalog.ts  # Credential definition registry for all providers
│   └── publishCredentials.ts # Publish credential storage helpers
├── preload/              # Electron preload scripts
├── preview/              # Canvas runtime (iframe content)
├── publish/              # Publish-to-web extension system
│   ├── registry.ts       # Publisher registration and lookup
│   ├── types/            # PublisherExtension API types (versioned)
│   ├── providers/        # GitHub Pages, Cloudflare Pages, Neocities, AWS S3 adapters
│   └── validators/       # Per-provider credential + file validators
├── renderer/             # React app
│   ├── components/       # AiAssistant, Canvas, CodeEditor, Inspector, ThemeEditor,
│   │                        # FontManager (import fonts), GoogleFontBrowser (search & download),
│   │                        # FontPickerField (per-block), TypographyFontPicker (theme-level),
│   │                        # ThemeGallery/ThemeMiniPreview (live theme previews),
│   │                        # PublishDialog, Tutorial (interactive onboarding overlay)
│   ├── hooks/            # Custom React hooks
│   ├── registry/         # Block definitions (63 types across 7 categories)
│   ├── store/            # Zustand stores (EditorStore, ProjectStore, AiStore,
│   │                     # TutorialStore, AppSettingsStore, ToastStore)
│   ├── themes/           # Theme packs, gallery registry, component tokens, preview blocks
│   ├── templates/        # Page templates and section templates (reusable layouts)
│   ├── styles/           # CSS styles
│   └── utils/            # Utility functions
└── types/                # TypeScript types
```

## Key Systems

- **Publish-to-web** (`src/publish/`): Versioned `PublisherExtension` API with built-in GitHub Pages, Cloudflare Pages, Neocities, and AWS S3 providers. IPC namespace: `publish`. Credentials stored encrypted via `src/main/publishCredentials.ts`.
- **Tutorial system** (`src/renderer/components/Tutorial/` + `src/renderer/store/tutorialStore.ts`): Spotlight-driven onboarding with branching paths (AI Assistance, Publish Workflow, Web Media Search). Steps auto-advance via `dispatchTutorialAction()`. UI elements are marked with `data-tutorial="<marker>"` attributes.
- **Credential catalog** (`src/main/credentialCatalog.ts`): Central registry of credential field definitions for all providers; drives the new credential edit modal in Settings.
- **Font management system**: `FontAsset` model stored in `projectStore.fonts` with `source` field (`'system'`, `'imported'`, or `'google-fonts'`). `FontManager.tsx` handles file import AND Google Fonts browsing via `GoogleFontBrowser.tsx` (search, filter, download). `TypographyFontPicker.tsx` (theme-wide) and `FontPickerField.tsx` (per-block) provide visual button-trigger dropdowns with portal rendering. `themeToCSS()` generates `@font-face` rules; `exportEngine.ts` bundles font files automatically. **Export behavior**: Downloaded Google Fonts are self-hosted (no CDN); typed-only fonts use CDN links. IPC namespace: `fonts` (`listSystem`, `importFile`, `copySystemFont`, `deleteFont`, `listProject`, `downloadGoogleFont`). Static catalog at `src/renderer/data/google-fonts-catalog.json`. See section 13a of GUIDELINES.md for full details.
- **Theme gallery & theme packs**: Browsable gallery of pre-built themes with categories, tags, and dark variants. `ThemePack` definitions in `src/renderer/themes/themePacks.ts`, gallery registry in `themeGalleryRegistry.ts`, live mini preview via `ThemeMiniPreview.tsx`. Themes include `ComponentTokens` for consistent button/card/heading/form styling. Applied through `ThemeEditor`.
- **Page & section templates**: Reusable, theme-aware layout templates. `PageTemplate` and `SectionTemplate` types in `src/renderer/templates/templateTypes.ts` with categories (landing, portfolio, hero, pricing, testimonials, etc.). Built-in templates in `pageTemplates.ts` and `sectionTemplates.ts`. Inserted via sidebar template gallery UI.

## Hard Constraints

- Never use `as any`, `@ts-ignore`, `@ts-expect-error` for type suppression.
- Never use empty catch blocks.
- Never delete failing tests to force pass.
- Never commit unless explicitly requested.
- Never leave code in broken state after failures.


## Widget customization

All 63 widget types share a searchable Content/Design/Advanced inspector with lazy collapsible sections. `registry/inspectorSchema.ts` owns control metadata; `registry/widgetDesigns.ts` maps every type to a preset profile. New design controls use existing block styles; resets preserve content and classes. Verify each registered type in inspector and preview/export tests across all three frameworks. See `docs/widget-enhancement-goal.md` for scope and coverage.


## Application appearance and code editing

App Settings → Appearance provides six light/dark color families plus custom app themes with live preview, contrast feedback, and JSON sharing. These preferences never change the website’s project theme. The lazy code editor uses locally bundled Monaco, app-matched colors, page-specific drafts, a six-model LRU, HTML/CSS formatting, find/replace, editor preferences, clickable diagnostics, canvas navigation, and on-demand project suggestions. Minimap defaults off; no new dependencies or background indexing services. See [app appearance and code editor](../../docs/app-appearance-and-code-editor.md) for formats, memory limits, and draft lifetime.


The **Canvas + Code** layout places a resizable canvas on the left and code editor on the right, with the sidebar and inspector hidden. Select it from Change Layout or as the default in App Settings → General. It opens code automatically; the code toggle switches between this layout and Canvas Only. App color themes remain in App Settings → Appearance; the toolbar color-theme shortcut has been removed.


Canvas widget clicks switch an open code editor to HTML, scroll to the widget’s opening tag, and highlight its complete markup. Re-clicking the same widget reveals it again. Source-only widget identities preserve export markup; a single-version source-range cache uses the existing HTML parser and preserves code drafts.


Release 1.11.1 combines the widget, theme, and code-editor improvements with the legacy-project and media-import corrections. The npm manifest and lockfile record compatible upstream updates; bundled Bootstrap 5.3.8, Bootstrap Icons 1.13.2, and Highlight.js 11.12.0 assets match previews and exports. Font catalog generation fetches validated, pinned upstream data instead of installing an unused generation CLI. See [release validation](../../docs/releases/1.11.1/validation.md).

Bundled framework fonts and icons use the CORS-enabled `app-framework` protocol, registered together with `app-media` in one call before Electron is ready.


Backend archive streams must keep ArrayBuffer-backed `Uint8Array` chunks when calling `DecompressionStream` for Node 22 compatibility. Use the Node test environment and host-native filesystem fixture paths. Verify DNS pinning at the production HTTPS request/lookup boundary without binding privileged ports or depending on external network connectivity. See [backend test portability](../../docs/development.md#backend-test-portability).

Asset import results encode raw relative paths with `encodeDurableAssetReference` before building session URLs; filesystem operations retain the raw path. Preserve literal percent sequences in filenames. Legacy JSON open/Save opts into missing-asset warnings for repair, while invalid references and all bundle/conversion validation remain blocking. Verify backend legacy staging/save, renderer warnings and round trips, and every media picker; never commit personal reproduction projects.

Regression prevention: `.github/workflows/regression.yml` runs the complete Node 22 suite and TypeScript checks on Windows/Linux for code changes on main and pull requests. Release packaging also runs the complete Windows desktop suite and the portable Linux `npm run test:e2e:release` checks, covering asset filename round trips, legacy missing-file repair/conversion, widget controls, application themes, code editing, canvas layouts, and selection. Keep checks sequential and use one worker on memory-limited machines.

Monaco 0.54 word-highlighter cancellation is handled by a scoped build/development transform in `scripts/monacoCancellation.ts`. Real errors remain reported, and rapid page switching is covered by desktop tests. No extra runtime dependency or background service is added.

Imported font filenames use raw paths at native mutation boundaries and current-session URLs in the renderer. Save encodes new font paths once; font deletion decodes only the current session, and export reads the original scoped URL while writing safe, distinct output filenames. Regression coverage includes font import/save/reopen/export/delete alongside media filename cases.

Desktop manual Save/Save As on a legacy JSON project opens the lazy native `LegacyProjectDialog`. It explains `.amg` conversion, lists missing assets, supports exact-path Locate file repair through an explicit picker, and rechecks externally restored files. Conversion remains disabled until all references validate. Cancel preserves edits and repairs; autosave is paused while this dialog is open. Conversion creates a new owned bundle, preserves the original JSON, and copies the full project asset library (including unreferenced imported assets). Browser JSON persistence and low-level legacy Save remain supported.

Save validation uses the session-bound `assets:listPaths` inventory from the main process, including nested media, nested fonts, and non-media assets; do not infer save completeness from the filtered Asset Manager display list. Repair accepts only canonical paths under assets, denies workspace links and stale sessions, and promotes complete files without overwriting an existing asset. Backend, controller, and desktop regressions cover cancellation, edits before Save, same-path repairs from a differently named replacement, source preservation, and strict conversion after repair.

Asset maintenance is on demand and adds no dependency. The legacy conversion dialog and Asset Manager's **Review unused assets** share a searchable review with at most 25 rendered rows. **Locate multiple files** matches full folder suffixes first, then unique basenames; ambiguous names remain for manual repair, and existing files are never overwritten. Repair and cleanup use bounded batches of up to 10,000 entries. Cleanup checks all pages, themes, presets, saved blocks, templates, and custom CSS, offers both unused files and unused missing font entries, and retains uncertain/dynamic references. Selected files move outside `assets/` to `.amagon-unused-assets`; matching unused font metadata is removed. Review/confirmation and session-scoped Undo preserve recoverability without including trash in `.amg` bundles. Recheck current references and workspace generation before cleanup; preserve strict bundle conversion checks.

Autosave ticks received during an import or save acknowledgement coalesce into one session-scoped pending save. Flush it after the operation and caller metadata updates settle; discard it when its project is replaced or the controller is disposed. Keep controller-owned operations busy through their acknowledgement, and clear completed native progress without leaving a stale busy flag. There is no idle polling timer. The portable release gate includes asset-only and font-only autosave with real image/font fixtures; failures retain live UI, inventory and archive diagnostics.
