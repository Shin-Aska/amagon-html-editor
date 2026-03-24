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
│   ├── mediaSearchService.ts # Pexels/Pixabay image search
│   └── menu.ts             # Native app menu
│
├── preload/
│   └── index.ts            # contextBridge → exposes `window.api`
│
├── preview/
│   └── runtime.ts          # Runs inside the canvas iframe
│
├── renderer/               # React app (Vite-bundled)
│   ├── App.tsx             # Root component, layout orchestration
│   ├── canvas.html         # Iframe shell for live preview
│   ├── canvasRuntime.ts    # Canvas initialisation
│   │
│   ├── components/         # ~25 top-level components
│   │   ├── AiAssistant/    # AI chat panel
│   │   ├── Canvas/         # Iframe wrapper for visual editing
│   │   ├── CodeEditor/     # Monaco editor wrapper
│   │   ├── Inspector/      # Property/style panel (~20 sub-components)
│   │   ├── ThemeEditor/    # Visual theme editor (colors, typography, etc.)
│   │   ├── Sidebar/        # Block library + page tree
│   │   ├── Toolbar/        # Action buttons
│   │   ├── CommandPalette/ # Cmd+K search
│   │   ├── ExportDialog/   # Export configuration
│   │   ├── NewProjectWizard/
│   │   ├── SettingsDialog/
│   │   ├── AssetManager/   # Media/asset UI
│   │   ├── CredentialManager/ # API key management UI
│   │   ├── BlockTree/      # DOM tree visualisation
│   │   ├── ContextMenu/
│   │   ├── StatusBar/
│   │   ├── Toast/          # Notifications
│   │   └── …others (WelcomeScreen, AboutAmagon, PageModal, etc.)
│   │
│   ├── store/              # Zustand stores
│   │   ├── editorStore.ts  # Blocks, selection, history, clipboard
│   │   ├── projectStore.ts # Project settings, pages, themes, user blocks
│   │   ├── aiStore.ts      # AI chat state and config
│   │   ├── appSettingsStore.ts # UI preferences (theme, layout)
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
| `projectStore` | `store/projectStore.ts` | Project settings, pages, folders, theme variants, user blocks, custom presets |
| `aiStore` | `store/aiStore.ts` | AI chat messages, loading state, provider config, model lists |
| `appSettingsStore` | `store/appSettingsStore.ts` | App-level UI preferences (light/dark theme, default layout) |
| `toastStore` | `store/toastStore.ts` | Notification display |

---

## 7. AI Integration

**Supported providers:** OpenAI, Anthropic, Google Gemini, Ollama (local), Mistral.

The AI service lives in `src/main/aiService.ts`. It:
1. Builds a system prompt from the block registry + current theme context
2. Dispatches chat to the selected provider's API
3. Parses block-array JSON from the response
4. Returns blocks the renderer can insert into the page

**IPC channels:** `ai:chat`, `ai:getConfig`, `ai:setConfig`, `ai:getModels`, `ai:fetchModelsForProvider`.

API keys are encrypted at rest using Electron `safeStorage` (OS keyring) with an AES-256-GCM fallback. Keys are stored per-provider in `ai-config.json` and never leave the main process.

---

## 8. IPC Channels Reference

| Namespace | Key Channels |
|-----------|-------------|
| `project` | `save`, `saveAs`, `load`, `loadFile`, `exportHtml`, `exportSite`, `openInBrowser`, `getRecent`, `new`, `getDir` |
| `assets` | `selectImage`, `selectSingleImage`, `selectVideo`, `list`, `delete`, `readAsset`, `readFileAsBase64`, `import` |
| `autosave` | `start`, `stop` + `auto-save-tick` event |
| `menu` | `setProjectLoaded` + `menu:action` event |
| `app` | `getVersion`, `isEncryptionSecure`, `getCredentials`, `deleteCredential`, `getSettings`, `saveSettings` |
| `ai` | `chat`, `getConfig`, `setConfig`, `getModels`, `fetchModelsForProvider` |
| `mediaSearch` | `getConfig`, `setConfig`, `search`, `downloadAndImport` |

**Canvas ↔ Renderer:** `postMessage` with `source: 'canvas-runtime'` and types: `clicked`, `contextMenu`, `moveBlock`, `updateText`, `keydown`, `hovered`.

---

## 9. Block Registry

Defined in `src/renderer/registry/registerBlocks.ts`. There are **50+ block types** including:

**Layout:** `container`, `row`, `column`, `section`, `grid`
**Content:** `heading`, `paragraph`, `text`, `blockquote`, `list`, `table`
**Media:** `image`, `video`, `icon`, `carousel`
**Interactive:** `button`, `link`, `accordion`, `tabs`, `modal`, `dropdown`
**Forms:** `form`, `input`, `textarea`, `select`, `checkbox`, `radio`, `range`, `file-input`
**Navigation:** `navbar`, `breadcrumb`, `pagination`
**Feedback:** `alert`, `badge`, `progress`, `spinner`, `toast-container`
**Cards:** `card`, `card-header`, `card-body`, `card-footer`
**Misc:** `hr`, `embed`, `raw-html`, `offcanvas`

Each registration defines: label, icon, default props schema, allowed children, and HTML rendering rules.

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

## 12. Key Files to Read First

If you need deeper context, start with these:

1. **`src/renderer/store/types.ts`** — All TypeScript interfaces (Block, Page, ProjectSettings, Theme, etc.)
2. **`src/renderer/registry/registerBlocks.ts`** — Every block type definition
3. **`src/renderer/store/editorStore.ts`** — Core editing logic
4. **`src/renderer/store/projectStore.ts`** — Project and theme management
5. **`src/main/index.ts`** — All IPC handlers and main process logic
6. **`src/main/aiService.ts`** — AI provider integration
7. **`src/renderer/utils/blockToHtml.ts`** + **`htmlToBlocks.ts`** — Serialisation layer
8. **`src/preload/index.ts`** — The `window.api` bridge definition

---

*Last updated: 2026-03-23*
