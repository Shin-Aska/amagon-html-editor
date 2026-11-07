# Getting Started as a Contributor

Welcome to **Amagon** (internal codename: *Hoarses*). This guide will get you from zero to productive in the codebase.

For AI-provider changes, cover model discovery and generation separately. OpenAI's protocol helpers live in `src/main/openaiProvider.ts`; retain modern GPT/reasoning models, legacy Chat Completions support, explicit model selections, and redacted discovery errors. Codex completion calls must work without a Git repository and use a read-only sandbox. `tests/electron/ai-provider-connectivity.spec.ts` checks modern model choices and API-error recovery through the real Settings UI with fake credentials; it is included in the portable release test command. Enter real credentials only in the app when performing optional live verification.

Amagon is a desktop HTML editor built with Electron, React, and TypeScript. You drag-and-drop blocks onto a canvas, edit properties in an inspector panel, switch to a Monaco code editor for raw HTML when you need it, and export standalone sites. It is an alternative to tools like Pingendo or Bootstrap Studio, with a built-in AI assistant that understands your project's block structure and theme.

> **For AI assistants:** read `.aiassistant/rules/project-context.md` first, then come back here for the human-friendly tour.

---

## First Steps

1. **Clone and install**
   ```bash
   npm install
   npm run dev
   ```
2. **Read the dev guide** — See [`docs/development.md`](development.md) for build commands, test commands, and Linux sandbox setup.
3. **Read the architecture overview** — [`GUIDELINES.md`](../GUIDELINES.md) at the repo root is the single most important file for understanding how the codebase is organized. It covers:
   - Tech stack and project structure
   - Data models (Block, ProjectTheme, FontAsset, etc.)
   - Zustand stores and their responsibilities
   - IPC channels reference
   - Architecture diagrams
   - Conventions and patterns
4. **Skim the project context** — [`.aiassistant/rules/project-context.md`](../.aiassistant/rules/project-context.md) is written for AI agents but is also a dense, accurate cheat-sheet of the project's key systems and hard constraints.

---

## Architecture at a Glance

The app runs in three layers:

```mermaid
flowchart TB
  main["MAIN PROCESS (Node.js)<br/>File I/O, IPC handlers, AI service,<br/>encryption, media search, native menu, auto-save"]
  renderer["RENDERER PROCESS (React + Vite)<br/>Zustand stores -> Components -> Monaco / Canvas iframe"]
  canvas["CANVAS IFRAME (preview/runtime.ts)<br/>Isolated DOM, block rendering, click/hover/drag relay"]

  main -->|ipcRenderer.invoke / on<br/>via window.api preload bridge| renderer
  renderer -->|postMessage protocol| canvas
```

All main ↔ renderer communication goes through the typed `window.api` bridge defined in `src/preload/index.ts`. Never use `ipcRenderer` directly in renderer code.

---

## Where to Look for What

### I want to work on...

| Feature area                                              | Start with these files                                                                                                                               |
|-----------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Visual canvas / blocks**                                | `src/renderer/components/Canvas/Canvas.tsx`, `src/preview/runtime.ts`, `src/renderer/registry/registerBlocks.ts`                                     |
| **Block definitions / adding a new block type**           | `src/renderer/registry/registerBlocks.ts`, `src/renderer/registry/ComponentRegistry.ts`                                                              |
| **Inspector panel (property editor)**                     | `src/renderer/components/Inspector/Inspector.tsx` and its sub-components                                                                             |
| **Theme editor / colors / typography**                    | `src/renderer/components/ThemeEditor/ThemeEditor.tsx`, `src/renderer/themes/themePacks.ts`, `src/renderer/themes/componentTokens.ts`                 |
| **Theme gallery / presets**                               | `src/renderer/themes/themeGalleryRegistry.ts`, `src/renderer/themes/themePacks.ts`, `src/renderer/components/ThemeGallery/ThemeMiniPreview.tsx`      |
| **Page / section templates**                              | `src/renderer/templates/pageTemplates.ts`, `src/renderer/templates/sectionTemplates.ts`, `src/renderer/templates/templateTypes.ts`                   |
| **AI chat assistant**                                     | `src/renderer/components/AiAssistant/AiAssistant.tsx`, `src/main/aiService.ts`                                                                       |
| **AI provider adapters (OpenAI, Anthropic, Ollama, CLI)** | `src/main/aiService.ts`, `src/main/cliHelpers.ts`                                                                                                    |
| **Settings dialog**                                       | `src/renderer/components/SettingsDialog/SettingsDialog.tsx`, `src/renderer/store/appSettingsStore.ts`                                                |
| **Credentials / API key management**                      | `src/main/credentialCatalog.ts`, `src/renderer/components/SettingsDialog/CredentialEditModal.tsx`                                                    |
| **Publish to web**                                        | `src/publish/registry.ts`, `src/publish/providers/`, `src/renderer/components/PublishDialog/PublishDialog.tsx`                                       |
| **Tutorial / onboarding**                                 | `src/renderer/components/Tutorial/tutorialSteps.ts`, `src/renderer/store/tutorialStore.ts`                                                           |
| **Code editor (Monaco)**                                  | `src/renderer/components/CodeEditor/CodeEditor.tsx`                                                                                                  |
| **Fonts / Google Fonts browser**                          | `src/renderer/components/ThemeEditor/FontManager.tsx`, `src/renderer/components/ThemeEditor/GoogleFontBrowser.tsx`                                   |
| **Export engine**                                         | `src/renderer/utils/exportEngine.ts`, `src/renderer/utils/blockToHtml.ts`                                                                            |
| **Keyboard shortcuts / command palette**                  | `src/renderer/hooks/useKeyboardShortcuts.ts`, `src/renderer/components/CommandPalette/CommandPalette.tsx`                                            |
| **Toolbar / status bar / sidebar**                        | `src/renderer/components/Toolbar/Toolbar.tsx`, `src/renderer/components/StatusBar/StatusBar.tsx`, `src/renderer/components/Sidebar/Sidebar.tsx`      |
| **Data models / TypeScript types**                        | `src/renderer/store/types.ts`                                                                                                                        |
| **State management**                                      | `src/renderer/store/editorStore.ts`, `src/renderer/store/projectStore.ts`, `src/renderer/store/aiStore.ts`, `src/renderer/store/appSettingsStore.ts` |
| **Main process IPC handlers**                             | `src/main/index.ts`                                                                                                                                  |
| **Preload / bridge**                                      | `src/preload/index.ts`                                                                                                                               |

---

## Key Patterns to Know

1. **Block-based model** — The UI is a tree of `Block` objects, not direct DOM manipulation. Blocks have `id`, `type`, `props`, `styles`, `classes`, `events`, `children`.
2. **Bidirectional sync** — `blockToHtml` and `htmlToBlocks` keep the visual canvas and code editor in sync.
3. **Zustand stores** — State is split across focused stores: `editorStore`, `projectStore`, `aiStore`, `appSettingsStore`, `tutorialStore`.
4. **Canvas isolation** — The live preview runs in an iframe (`src/preview/runtime.ts`). The renderer and iframe communicate via `postMessage`.
5. **No direct DOM manipulation** in the renderer. All visual changes flow through the block model → `blockToHtml` → canvas iframe re-render.
6. **IPC bridge** — `window.api` is the only way renderer code talks to the main process. It is typed in `src/preload/index.ts`.
7. **Block IDs** — generated with prefix `blk_` followed by a random string.
8. **History** — 50-entry undo/redo stack managed by `editorStore`. Mutations push snapshots; undo/redo restores them.

---

## Conventions

- **Component files** use PascalCase (e.g. `ThemeEditor.tsx`) and live in their own folder under `src/renderer/components/`.
- **Store files** use camelCase (e.g. `editorStore.ts`).
- **CSS** — component-scoped CSS files in `styles/` or co-located. Theme uses CSS custom properties (`--theme-*`).
- **Never suppress types** — No `as any`, `@ts-ignore`, or `@ts-expect-error`.
- **Never use empty catch blocks** — Always handle or log errors.

---

## Testing

```bash
npm test         # Run all tests (vitest)
npm test:watch   # Watch mode
```

Tests live next to their source files (e.g. `Foo.tsx` → `Foo.test.tsx` or `__tests__/foo.test.ts`). Backend filesystem/archive tests use the Node environment and native fixture paths. The low-memory suite command and stream/transport test conventions are in [Backend test portability](development.md#backend-test-portability).

---

## Need More Context?

- **Architecture deep dive** → [`GUIDELINES.md`](../GUIDELINES.md)
- **Quick system cheat-sheet** → [`.aiassistant/rules/project-context.md`](../.aiassistant/rules/project-context.md)
- **Development / build / Linux sandbox** → [`docs/development.md`](development.md)
- **Known compatibility issues** → [`docs/post-install.md`](post-install.md)

Happy hacking.


## Working on widget editing

Start with `src/renderer/registry/ComponentRegistry.ts` and `registerBlocks.ts` for widget properties. The shared inspector groups controls into Content, Design, and Advanced; `inspectorSchema.ts` handles tab placement, visibility, and search aliases. Assign every widget a profile in `widgetDesigns.ts`. Extend existing styles rather than introducing a new project format. Run the inspector experience tests and widget-design export coverage with one Vitest worker; `tests/electron/widget-experience.spec.ts` exercises the desktop workflow.


## Application appearance and code editing

App Settings → Appearance provides six light/dark color families plus custom app themes with live preview, contrast feedback, and JSON sharing. These preferences never change the website’s project theme. The lazy code editor uses locally bundled Monaco, app-matched colors, page-specific drafts, a six-model LRU, HTML/CSS formatting, find/replace, editor preferences, clickable diagnostics, canvas navigation, and on-demand project suggestions. Minimap defaults off; no new dependencies or background indexing services. See [app appearance and code editor](app-appearance-and-code-editor.md) for formats, memory limits, and draft lifetime.


The **Canvas + Code** layout places a resizable canvas on the left and code editor on the right, with the sidebar and inspector hidden. Select it from Change Layout or as the default in App Settings → General. It opens code automatically; the code toggle switches between this layout and Canvas Only. App color themes remain in App Settings → Appearance; the toolbar color-theme shortcut has been removed.


Canvas widget clicks switch an open code editor to HTML, scroll to the widget’s opening tag, and highlight its complete markup. Re-clicking the same widget reveals it again. Source-only widget identities preserve export markup; a single-version source-range cache uses the existing HTML parser and preserves code drafts.


Release 1.11.1 combines the widget, theme, and code-editor improvements with the legacy-project and media-import corrections. The npm manifest and lockfile record compatible upstream updates; bundled Bootstrap 5.3.8, Bootstrap Icons 1.13.2, and Highlight.js 11.12.0 assets match previews and exports. Font catalog generation fetches validated, pinned upstream data instead of installing an unused generation CLI. See [release validation](releases/1.11.1/validation.md).

Bundled framework fonts and icons use the CORS-enabled `app-framework` protocol, registered together with `app-media` in one call before Electron is ready.

## Legacy assets and media imports

Legacy JSON projects may open and Save with missing-asset warnings so their references can be repaired. Conversion to `.amg` requires the referenced files to exist. `projectPortability` keeps strict validation by default; only legacy open/save callers request `allowMissingLegacyAssets`, and bundle modes ignore that option.

Import results use encoded runtime URLs while retaining raw filesystem-relative paths. Exercise spaces, Unicode, `#`, literal `%`, `%20`, and `%2F` filenames through image, single-image, and video IPC handlers. Regressions belong in `registerResourceMutationSecurity.test.ts`, `legacySessionlessAssetCompatibility.test.ts`, and the renderer snapshot/command tests. Keep personal reproduction projects outside the repository and use copies when testing Save.

Regression prevention: `.github/workflows/regression.yml` runs the complete Node 22 suite and TypeScript checks on Windows/Linux for code changes on main and pull requests. Release packaging also runs the complete Windows desktop suite and the portable Linux `npm run test:e2e:release` checks, covering asset filename round trips, legacy missing-file repair/conversion, widget controls, application themes, code editing, canvas layouts, and selection. Keep checks sequential and use one worker on memory-limited machines.

Monaco 0.54 word-highlighter cancellation is handled by a scoped build/development transform in `scripts/monacoCancellation.ts`. Real errors remain reported, and rapid page switching is covered by desktop tests. No extra runtime dependency or background service is added.

Imported font filenames use raw paths at native mutation boundaries and current-session URLs in the renderer. Save encodes new font paths once; font deletion decodes only the current session, and export reads the original scoped URL while writing safe, distinct output filenames. Regression coverage includes font import/save/reopen/export/delete alongside media filename cases.

Desktop manual Save/Save As on a legacy JSON project opens the lazy native `LegacyProjectDialog`. It explains `.amg` conversion, lists missing assets, supports exact-path Locate file repair through an explicit picker, and rechecks externally restored files. Conversion remains disabled until all references validate. Cancel preserves edits and repairs; autosave is paused while this dialog is open. Conversion creates a new owned bundle, preserves the original JSON, and copies the full project asset library (including unreferenced imported assets). Browser JSON persistence and low-level legacy Save remain supported.

Save validation uses the session-bound `assets:listPaths` inventory from the main process, including nested media, nested fonts, and non-media assets; do not infer save completeness from the filtered Asset Manager display list. Repair accepts only canonical paths under assets, denies workspace links and stale sessions, and promotes complete files without overwriting an existing asset. Backend, controller, and desktop regressions cover cancellation, edits before Save, same-path repairs from a differently named replacement, source preservation, and strict conversion after repair.

Asset maintenance is on demand and adds no dependency. The legacy conversion dialog and Asset Manager's **Review unused assets** share a searchable review with at most 25 rendered rows. **Locate multiple files** matches full folder suffixes first, then unique basenames; ambiguous names remain for manual repair, and existing files are never overwritten. Repair and cleanup use bounded batches of up to 10,000 entries. Cleanup checks all pages, themes, presets, saved blocks, templates, and custom CSS, offers both unused files and unused missing font entries, and retains uncertain/dynamic references. Selected files move outside `assets/` to `.amagon-unused-assets`; matching unused font metadata is removed. Review/confirmation and session-scoped Undo preserve recoverability without including trash in `.amg` bundles. Recheck current references and workspace generation before cleanup; preserve strict bundle conversion checks.

Autosave ticks received during an import or save acknowledgement coalesce into one session-scoped pending save. Flush it after the operation and caller metadata updates settle; discard it when its project is replaced or the controller is disposed. Keep controller-owned operations busy through their acknowledgement, and clear completed native progress without leaving a stale busy flag. There is no idle polling timer. The portable release gate includes asset-only and font-only autosave with real image/font fixtures; failures retain live UI, inventory and archive diagnostics.

Linux launchers use `assets/icons/` with transparent square PNGs at 16, 22, 24, 32, 48, 64, 96, 128, 192, 256, 512, 1024 and 2048 pixels. Regenerate them with `npm run generate:icons`, which reuses the existing square artwork embedded in `assets/app.ico`; sizes above its 512px source are upscaled. Keep `desktopName` and `linux.syncDesktopName` aligned with the installed launcher for X11/Wayland window association. `npm run check:linux-package -- path/to/package.deb` validates the actual Debian desktop entry, installed icon dimensions, executable and packaged Electron identity; the release workflow runs this check for Linux packages.
