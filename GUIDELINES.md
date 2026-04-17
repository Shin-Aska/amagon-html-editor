# Amagon HTML Editor — Codebase Guidelines

> **Purpose:** This file gives AI assistants (Claude, Gemini, ChatGPT, etc.) enough context to work on this codebase without reading every file. Keep it up-to-date as the project evolves.

---

## 1. What Is This?

**Amagon HTML Editor** is an offline, AI-powered visual HTML editor — a desktop alternative to Pingendo, Mobirise, and Bootstrap Studio. Users drag-and-drop blocks onto a canvas, edit properties in an inspector panel, toggle to a Monaco code editor for raw HTML, and export standalone sites.

- **Repo:** `github.com/Shin-Aska/amagon-html-editor`
- **License:** GPL v3.0
- **App ID:** `com.hoarses.editor`

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Electron 40 |
| Frontend | React 18, TypeScript 5.7 |
| Build | Vite 7 via electron-vite 5 |
| State | Zustand 5 |
| Code editor | Monaco Editor 0.47 |
| Drag-and-drop | @dnd-kit/core + sortable |
| HTML parsing | parse5 7 |
| Formatting | Prettier 3.5 |
| Icons | lucide-react |
| Testing | Vitest 4 + jsdom |
| Packaging | electron-builder 26 |

---

## 3. Project Structure

```
src/
├── main/                   # Electron main process (Node.js)
│   ├── index.ts            # Entry point, IPC handlers, file I/O
│   ├── aiService.ts        # Multi-provider AI adapter
│   ├── cryptoHelpers.ts    # API key encryption (safeStorage / AES-256-GCM)
│   ├── credentialCatalog.ts # Credential definition registry for all providers
│   ├── publishCredentials.ts # Publish credential storage helpers
│   ├── mediaSearchService.ts # Pexels/Pixabay image search
│   └── menu.ts             # Native app menu
│
├── preload/
│   └── index.ts            # contextBridge → exposes `window.api`
│
├── preview/
│   └── runtime.ts          # Runs inside the canvas iframe
│
├── publish/                # Publish-to-web extension system
│   ├── index.ts            # Public entry point
│   ├── registry.ts         # Publisher registration and lookup
│   ├── types/              # PublisherExtension, PublishResult, ValidationResult, etc.
│   ├── providers/
│   │   ├── github/         # GitHub Pages adapter
│   │   ├── cloudflare/     # Cloudflare Pages adapter
│   │   └── neocities/      # Neocities adapter
│   └── validators/         # Per-provider credential + file validators
│
├── renderer/               # React app (Vite-bundled)
│   ├── App.tsx             # Root component, layout orchestration
│   ├── canvas.html         # Iframe shell for live preview
│   ├── canvasRuntime.ts    # Canvas initialisation
│   │
│   ├── components/         # ~30 top-level components
│   │   ├── AiAssistant/    # AI chat panel + AiProposalReviewPanel (diff editor for AI proposals)
│   │   ├── Canvas/         # Iframe wrapper for visual editing
│   │   ├── CodeEditor/     # Monaco editor wrapper
│   │   ├── Inspector/      # Property/style panel (~20 sub-components)
│   │   ├── ThemeEditor/    # Visual theme editor (colors, typography, etc.)
│   │   ├── Sidebar/        # Block library + page tree
│   │   ├── Toolbar/        # Action buttons
│   │   ├── CommandPalette/ # Cmd+K search
│   │   ├── ExportDialog/   # Export configuration
│   │   ├── PublishDialog/  # Publish-to-web UI (provider selection, credentials, progress)
│   │   ├── NewProjectWizard/
│   │   ├── SettingsDialog/ # Includes CredentialEditModal for per-service credential editing
│   │   ├── AssetManager/   # Media/asset UI
│   │   ├── CredentialManager/ # API key overview popover in toolbar
│   │   ├── BlockTree/      # DOM tree visualisation
│   │   ├── ContextMenu/
│   │   ├── StatusBar/      # Status bar with tutorial progress feedback
│   │   ├── Toast/          # Notifications
│   │   ├── Tutorial/       # Interactive onboarding overlay system
│   │   │   ├── TutorialOverlay.tsx   # Main overlay controller
│   │   │   ├── TutorialInfoBox.tsx   # Step info box with choices
│   │   │   ├── SpotlightMask.tsx     # Spotlight highlight mask
│   │   │   ├── TutorialArrow.tsx     # Directional pointer arrow
│   │   │   ├── WelcomeTourDialog.tsx # Initial welcome / tutorial launch dialog
│   │   │   ├── tutorialSteps.ts      # Core step definitions
│   │   │   └── branches/            # Branching tutorial paths
│   │   │       ├── aiAssistanceTutorial.ts
│   │   │       ├── publishTutorial.ts
│   │   │       └── webMediaSearchTutorial.ts
│   │   └── …others (WelcomeScreen, AboutAmagon, PageModal, etc.)
│   │
│   ├── store/              # Zustand stores
│   │   ├── editorStore.ts  # Blocks, selection, history, clipboard
│   │   ├── projectStore.ts # Project settings, pages, themes, user blocks
│   │   ├── aiStore.ts      # AI chat state and config
│   │   ├── appSettingsStore.ts # UI preferences (theme, layout, tutorial state)
│   │   ├── tutorialStore.ts    # Interactive tutorial step state and action listener
│   │   ├── toastStore.ts   # Notification state
│   │   └── types.ts        # Shared TypeScript types
│   │
│   ├── registry/
│   │   ├── ComponentRegistry.ts # Block type registry class
│   │   └── registerBlocks.ts    # 50+ block definitions
│   │
│   ├── utils/
│   │   ├── blockToHtml.ts  # Block → HTML serialisation
│   │   ├── htmlToBlocks.ts # HTML → Block parsing
│   │   ├── exportEngine.ts # Export to file(s)
│   │   ├── api.ts          # IPC bridge wrapper
│   │   └── …helpers
│   │
│   ├── constants/
│   │   └── tutorialEvents.ts # Tutorial action type constants
│   │
│   ├── hooks/
│   │   └── useKeyboardShortcuts.ts
│   │
│   └── styles/             # Component CSS files
│
└── shared/
    └── welcomeBlocks.ts    # Default welcome page template
```

---

## 4. Architecture Overview

```
┌───────────────── MAIN PROCESS (Node.js) ─────────────────┐
│  File I/O, IPC handlers, AI service, encryption,         │
│  media search, native menu, auto-save                    │
└────────────────────────┬─────────────────────────────────┘
                         │ ipcRenderer.invoke / on
                         │ exposed via window.api (preload)
┌────────────────────────┴─────────────────────────────────┐
│              RENDERER PROCESS (React + Vite)              │
│  Zustand stores → Components → Monaco / Canvas iframe    │
└────────────────────────┬─────────────────────────────────┘
                         │ postMessage protocol
┌────────────────────────┴─────────────────────────────────┐
│              CANVAS IFRAME (preview/runtime.ts)           │
│  Isolated DOM, block rendering, click/hover/drag relay   │
└──────────────────────────────────────────────────────────┘
```

**Key patterns:**
- **IPC bridge** — The preload script (`preload/index.ts`) exposes a typed `window.api` object with namespaces: `project`, `assets`, `autosave`, `menu`, `app`, `ai`, `mediaSearch`.
- **Block-based model** — The UI is a tree of `Block` objects, not direct DOM manipulation. Blocks have `id`, `type`, `props`, `styles`, `classes`, `events`, `children`.
- **Bidirectional sync** — `blockToHtml` and `htmlToBlocks` keep the visual canvas and code editor in sync.
- **Canvas isolation** — The live preview runs in an iframe. The renderer and iframe communicate via `postMessage`.

---

## 5. Data Models

### Block

```typescript
interface Block {
  id: string                        // e.g. "blk_abc123"
  type: string                      // registered block type
  tag?: string                      // HTML tag override
  props: Record<string, unknown>    // component-specific properties
  styles: Record<string, string>    // inline CSS
  classes: string[]                 // CSS class names
  events?: Record<string, string>   // JS event handlers
  content?: string                  // raw HTML escape hatch
  children: Block[]                 // nested blocks
  locked?: boolean                  // prevents editing
}
```

### Project File (`.json`)

```typescript
{
  version?: string
  settings: {
    name: string
    framework: 'bootstrap-5' | 'tailwind' | 'vanilla'
    theme: ProjectTheme
    themeVariants?: ProjectThemeVariants
    customCss?: string
  }
  pages: Page[]          // each has id, title, slug, blocks[], meta
  folders: PageFolder[]  // organisational grouping
  userBlocks: UserBlock[] // saved reusable blocks
  customPresets?: ProjectTheme[]
  publisherConfig?: PublisherConfig  // selected provider + last publish metadata
}
```

### PublisherConfig

```typescript
interface PublisherConfig {
  providerId: string          // e.g. 'github-pages', 'cloudflare-pages', 'neocities'
  encryptedCredentials?: string
  lastPublishedUrl?: string
  lastPublishedAt?: string
}
```

### Theme

```typescript
interface ProjectTheme {
  name: string
  colors: { primary, secondary, accent, background, surface, text, textMuted, border, success, warning, danger }
  typography: { fontFamily, headingFontFamily, baseFontSize, lineHeight, headingLineHeight }
  spacing: { baseUnit: string, scale: number[] }
  borders: { radius, width, color }
  customCss: string
  customCssFiles: CssFile[]
}
```

Themes compile to `--theme-*` CSS custom properties. Light/dark variants are supported via `html[data-page-theme]` and `prefers-color-scheme`.

---

## 6. Zustand Stores

| Store | File | Responsibility |
|-------|------|---------------|
| `editorStore` | `store/editorStore.ts` | Current page blocks, selection, 50-step undo/redo, clipboard, drag state, layout |
| `projectStore` | `store/projectStore.ts` | Project settings, pages, folders, theme variants, user blocks, custom presets, publisher config |
| `aiStore` | `store/aiStore.ts` | AI chat messages, loading state, provider config, model lists |
| `appSettingsStore` | `store/appSettingsStore.ts` | App-level UI preferences (light/dark theme, default layout, tutorial enabled flag) |
| `tutorialStore` | `store/tutorialStore.ts` | Interactive tutorial step state, branching paths, reactive action listener |
| `toastStore` | `store/toastStore.ts` | Notification display |

---

## 7. AI Integration

**Supported providers:** OpenAI, Anthropic, Google Gemini, Ollama (local), Mistral, Claude CLI, Codex CLI, Gemini CLI, GitHub Copilot CLI, Junie CLI, Opencode CLI.

The AI service lives in `src/main/aiService.ts`. It:
1. Builds a system prompt from the block registry + current theme context
2. Dispatches chat to the selected provider's API
3. Parses block-array JSON from the response
4. Returns blocks the renderer can insert into the page

**IPC channels:** `ai:chat`, `ai:getConfig`, `ai:setConfig`, `ai:getModels`, `ai:fetchModelsForProvider`, `ai:checkCliAvailability`.

**CLI providers** run local CLI binaries instead of API calls. Claude CLI, Gemini CLI, and Junie CLI are gated behind the "Enable Dangerous Features" toggle; Codex CLI, GitHub Copilot CLI, and Opencode CLI are available without that toggle. GitHub Copilot CLI uses the standalone `copilot` binary with `copilot -p`; do not integrate it through `gh models`. Its model dropdown is populated from `copilot help config` plus `COPILOT_MODEL` / `~/.copilot/config.json`, because `/model` is an interactive slash command.

API keys are encrypted at rest using Electron `safeStorage` (OS keyring) with an AES-256-GCM fallback. Keys are stored per-provider in `ai-config.json` and never leave the main process.

---

## 8. IPC Channels Reference

| Namespace | Key Channels |
|-----------|-------------|
| `project` | `save`, `saveAs`, `load`, `loadFile`, `exportHtml`, `exportSite`, `openInBrowser`, `getRecent`, `new`, `getDir` |
| `assets` | `selectImage`, `selectSingleImage`, `selectVideo`, `list`, `delete`, `readAsset`, `readFileAsBase64`, `import` |
| `autosave` | `start`, `stop` + `auto-save-tick` event |
| `menu` | `setProjectLoaded` + `menu:action` event |
| `app` | `getVersion`, `isEncryptionSecure`, `getCredentials`, `getCredentialDefinitions`, `getCredentialValues`, `saveCredential`, `deleteCredential`, `getSettings`, `saveSettings` |
| `ai` | `chat`, `getConfig`, `setConfig`, `getModels`, `fetchModelsForProvider` |
| `mediaSearch` | `getConfig`, `setConfig`, `search`, `downloadAndImport` |
| `publish` | `getProviders`, `getCredentials`, `saveCredentials`, `deleteCredentials`, `validate`, `publish` + `publish:progress` event |

**Canvas ↔ Renderer:** `postMessage` with `source: 'canvas-runtime'` and types: `clicked`, `contextMenu`, `moveBlock`, `updateText`, `keydown`, `hovered`.

---

## 9. Block Registry

Defined in `src/renderer/registry/registerBlocks.ts`. There are **63 block types** organized into 7 categories:

**Layout (6):** `container`, `row`, `column`, `section`, `divider`, `spacer`

**Typography (5):** `heading`, `paragraph`, `blockquote`, `list`, `code-block`

**Media (4):** `image`, `video`, `icon`, `carousel`

**Components (24):** `navbar`, `hero`, `feature-card`, `footer`, `accordion`, `tabs`, `pricing-table`, `testimonial`, `cta-section`, `modal`, `page-list`, `alert`, `badge`, `progress`, `spinner`, `breadcrumb`, `pagination`, `table`, `dropdown`, `offcanvas`, `card`, `social-links`, `cookie-banner`, `back-to-top`

**Interactive (13):** `button`, `link`, `form`, `input`, `textarea`, `checkbox`, `select`, `radio`, `range`, `file-input`, `countdown`, `before-after`, `map-embed`

**Sections (9):** `stats-section`, `team-grid`, `gallery`, `timeline`, `logo-cloud`, `process-steps`, `newsletter`, `comparison-table`, `contact-card`

**Embed (2):** `raw-html`, `iframe`

Each registration defines: label, icon, default props schema, allowed children, and HTML rendering rules.

### Category Descriptions

- **Layout** — Structure and spacing elements that organize content flow
- **Typography** — Text and content presentation blocks
- **Media** — Image, video, and icon display elements
- **Components** — Complex reusable widgets (navbars, modals, tables, cards, etc.)
- **Interactive** — User interaction elements (forms, buttons, dropdowns, and interactive widgets like countdowns and sliders)
- **Sections** — Full-width composite sections with multiple sub-elements (hero sections, stats displays, team grids, galleries, etc.)
- **Embed** — Raw HTML and iframe embedding for custom content

### PropType Reference

Each block's props are typed using one of these PropTypes (defined in `src/renderer/registry/ComponentRegistry.ts`):

- **text** — Plain text input
- **textarea** — Multi-line text input
- **number** — Numeric input with optional min/max
- **boolean** — Checkbox/toggle
- **select** — Dropdown with predefined options
- **color** — Color picker
- **image** — Image file upload/selection
- **video** — Video URL or upload
- **icon** — Icon picker (lucide-react)
- **url** — URL input with page link suggestions
- **carousel** — Carousel item (used for nested carousel content)
- **array** — Array of items (for collections like carousel items, nav links, etc.)
- **combobox** — Editable dropdown with auto-complete suggestions (commonly used for tag filtering)
- **multi-combobox** — Multi-select dropdown with checkboxes (new in v1.8.0)
- **measurement** — CSS measurement input (e.g., "10px", "1rem") (new in v1.8.0)
- **sortable-list** — Array with drag-and-drop reordering capability (new in v1.8.0)
- **object** — Structured key-value pairs (new in v1.8.0)

---

## 10. Build & Dev Commands

```bash
npm run dev          # Electron dev with hot reload
npm run dev:web      # Web-only dev server (Vite)
npm run build        # Production build (electron-vite)
npm run build:web    # Web-only production build
npm test             # Run tests (vitest)
npm test:watch       # Watch mode
npm run lint         # ESLint auto-fix
npm run format       # Prettier formatting
npm run dist:win     # Windows NSIS installer
npm run dist:mac     # macOS DMG (x64 + arm64)
npm run dist:linux   # Linux AppImage + deb
```

---

## 11. Conventions & Patterns

- **Component files** use PascalCase (e.g. `ThemeEditor.tsx`) and live in their own folder under `components/`.
- **Store files** use camelCase (e.g. `editorStore.ts`).
- **CSS** — component-scoped CSS files in `styles/` or co-located. Theme uses CSS custom properties (`--theme-*`).
- **IPC** — all main ↔ renderer communication goes through the typed `window.api` bridge. Never use `ipcRenderer` directly in renderer code.
- **Block IDs** — generated with prefix `blk_` followed by a random string.
- **History** — 50-entry undo/redo stack managed by `editorStore`. Mutations push snapshots; undo/redo restores them.
- **No direct DOM manipulation** in the renderer. All visual changes flow through the block model → `blockToHtml` → canvas iframe re-render.

---

## 12. Publish-to-Web System

The publish system is a self-contained package at `src/publish/` with a versioned extension API.

**Architecture:**
- **`PublisherExtension`** interface (`src/publish/types/PublisherExtension.ts`) — contracts each provider must satisfy: `meta`, `credentialFields`, `validate()`, `publish()`.
- **Registry** (`src/publish/registry.ts`) — `registerPublisher()` / `getPublisher()` / `getAllPublishers()`. Throws on version mismatch or duplicate ID.
- **Built-in providers:** `github-pages`, `cloudflare-pages`, `neocities` — each in its own `src/publish/providers/<name>/` folder.
- **Validators** (`src/publish/validators/`) — per-provider credential and file validation returning `ValidationResult` with typed `ValidationIssue[]`.

**IPC flow:** The renderer calls `window.api.publish.*` → main process (`src/main/index.ts`) → resolves the provider via the registry → streams `publish:progress` events back to the renderer → returns `PublishResult`.

**Credential storage:** Publish credentials are stored separately from AI keys via `src/main/publishCredentials.ts` (encrypted with `safeStorage` / AES-256-GCM fallback).

**UI:** `PublishDialog` component handles provider selection, credential entry, validation display, progress tracking, and the final published URL.

---

## 13. Interactive Tutorial System

The tutorial system provides a branching, spotlight-driven onboarding experience for new users.

**Architecture:**
- **`tutorialStore`** (`src/renderer/store/tutorialStore.ts`) — Zustand store holding the active step list, current step index, branch state, and the `dispatchTutorialAction()` function that drives reactive step advancement.
- **`TutorialOverlay`** — Renders the spotlight mask (`SpotlightMask`), the floating info box (`TutorialInfoBox`), and the pointer arrow (`TutorialArrow`). Resolves `data-tutorial="<marker>"` attributes on DOM elements as spotlight targets.
- **`WelcomeTourDialog`** — Initial dialog shown to first-time users; launches the tutorial.
- **`TutorialStep`** — Each step defines: `target` (CSS selector or `data-tutorial` marker), `placement`, `action` (the `TutorialActionType` that auto-advances the step), `choices` (optional branching), `onEnter`/`onExit` callbacks.
- **Branches** (`src/renderer/components/Tutorial/branches/`) — Three optional deep-dive paths: AI Assistance, Publish Workflow, Web Media Search.
- **`data-tutorial` markers** — Added to key UI elements (`data-tutorial="toolbar-publish"`, `data-tutorial="theme-editor-colors"`, etc.) so tutorial steps can target them without fragile CSS selectors.
- **Action dispatch** — Components call `dispatchTutorialAction({ type, targetValue })` after meaningful interactions; the store checks if it matches the current step's expected action and auto-advances.

---

## 14. Key Files to Read First

If you need deeper context, start with these:

1. **`src/renderer/store/types.ts`** — All TypeScript interfaces (Block, Page, ProjectSettings, Theme, PublisherConfig, etc.)
2. **`src/renderer/registry/registerBlocks.ts`** — Every block type definition
3. **`src/renderer/store/editorStore.ts`** — Core editing logic
4. **`src/renderer/store/projectStore.ts`** — Project and theme management
5. **`src/main/index.ts`** — All IPC handlers and main process logic
6. **`src/main/aiService.ts`** — AI provider integration
7. **`src/renderer/utils/blockToHtml.ts`** + **`htmlToBlocks.ts`** — Serialisation layer
8. **`src/preload/index.ts`** — The `window.api` bridge definition
9. **`src/publish/types/index.ts`** — Publisher extension API types
10. **`src/publish/registry.ts`** — Publisher registration/lookup
11. **`src/renderer/store/tutorialStore.ts`** — Tutorial step state and action listener system

---

*Last updated: 2026-04-17*
