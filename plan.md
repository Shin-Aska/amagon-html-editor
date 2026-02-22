# Hoarses — Master Implementation Plan

> **Project:** Hoarses (Offline Visual HTML Editor — Pingendo / Mobirise / Bootstrap Studio Alternative)
> **Stack:** Electron + Vite + React + TypeScript + Zustand + Monaco Editor + dnd-kit
> **Reference:** See `research.md` for full architectural blueprint

---

## How to Use This Plan

This plan is designed for **sequential execution across multiple AI agents** in Windsurf. Each phase is assigned to a specific agent based on its strengths. To execute:

1. Switch to the assigned agent in Windsurf's model selector
2. Tell the agent: **"Execute Phase N of plan.md"**
3. The agent should read `plan.md` and `research.md` for full context
4. Check off completed tasks as you go (`[ ]` → `[x]`)
5. Move to the next phase and switch agents if needed

### Agent Assignment Rationale

| Agent | Strengths | Assigned Phases |
|---|---|---|
| **Claude Opus 4.6** | Architectural scaffolding, multi-file coherence, IPC design, complex state patterns | 1, 2, 8 |
| **GPT 5.2 High Thinking** | Deep algorithmic reasoning, AST parsing, bidirectional sync, coordinate math, diffing | 3, 4, 5, 9 |
| **Gemini 3 Pro** | Broad UI/UX component generation, widget libraries, CSS framework integration, large component volumes | 6, 7, 10 |
| **Kimi K2** | Well-scoped implementation, test writing, documentation, polishing, accessibility | 11, 12 |

---

## Phase 1 — Project Scaffolding & Foundation ✅ COMPLETED

**Agent: 🟣 Claude Opus 4.6**
**Goal:** Initialize the project with React+TypeScript, establish the 3-panel layout, and create the API abstraction layer.

> **⚠️ ARCHITECTURAL PIVOT:** Electron's built-in module resolution (`require('electron')`) is broken on this Linux environment — it resolves to the npm package (binary path string) instead of the built-in API module. All Electron versions tested (v28, v33) have this issue.
>
> **Decision:** Develop as a **pure Vite + React web app** with a **mock API layer** (`src/renderer/utils/api.ts`). The mock uses browser APIs (localStorage, File API, download links) to simulate Electron IPC. When Electron integration is needed (Phase 8), we swap the mock for real IPC. All visual editor work (canvas, drag-drop, Monaco, widgets, inspector) is pure web and unaffected.
>
> **Current stack:** Vite 5 + React 18 + TypeScript (strict) — run with `npm run dev`

### Tasks

- [x] **1.1** Initialize project with Vite + React + TypeScript (pivoted from electron-vite)
- [x] **1.2** Set up directory structure:
  ```
  /src
    /renderer         — Editor UI (React app)
      /components/    — Sidebar, Canvas, Inspector, Toolbar, CodeEditor
      /store/         — (ready for Zustand in Phase 2)
      /utils/         — api.ts (mock API layer)
      /styles/        — global.css
    /preview          — Canvas iframe runtime
      runtime.ts      — Script injected into user's page
  ```
- [x] **1.3** Configure TypeScript with strict mode
- [x] **1.4** Created mock API layer (`src/renderer/utils/api.ts`) with browser-based implementations for: `project.save`, `project.load`, `project.saveAs`, `project.exportHtml`, `assets.selectImage`, `assets.readAsset`
- [x] **1.5** Electron preload script written (`src/preload/index.ts`) but deferred — mock API used in dev
- [x] **1.6** Created minimal React shell with 3-panel layout (left sidebar with widget categories, center canvas with iframe, right inspector, top toolbar with Save/Open/Export/toggle buttons)
- [x] **1.7** Verified app runs end-to-end: `npm run dev` → Vite dev server → UI renders with all panels
- [ ] **1.8** Configure ESLint + Prettier for consistent code style (skipped for now — low priority)

### Acceptance Criteria ✅
- App launches via `npm run dev` with hot reload ✅
- 3-panel layout renders ✅
- Mock API save/load works via browser APIs ✅
- Canvas iframe renders default Bootstrap page ✅

---

## Phase 2 — State Management & Data Layer ✅ COMPLETED

**Agent: 🟣 Claude Opus 4.6**
**Goal:** Implement the Zustand store with the JSON Block Tree schema, history system (undo/redo stack), and the HTML generation pipeline.

### Tasks

- [x] **2.1** Defined core TypeScript interfaces in `src/renderer/store/types.ts`: `Block`, `Page`, `ProjectData`, `ProjectSettings`, `FrameworkChoice`, `HistoryEntry`, `EditorState`, `EditorActions` + utility functions `generateBlockId()`, `createBlock()`
- [x] **2.2** Created Zustand editor store (`src/renderer/store/editorStore.ts`) with:
  - Block tree state + `addBlock`, `updateBlock`, `moveBlock`, `removeBlock`, `setPageBlocks`
  - Selection: `selectBlock`, `hoverBlock`
  - History: `undo()`, `redo()` with max 50 snapshots, truncates redo on new mutations
  - Tree helpers: `getBlockById`, `getBlockPath`, circular-reference prevention in `moveBlock`
- [x] **2.3** Created project store (`src/renderer/store/projectStore.ts`) with multi-page management, framework settings, page CRUD, reorder
- [x] **2.4** Implemented `blockToHtml` (`src/renderer/utils/blockToHtml.ts`): recursive tree→HTML, respects tag/classes/styles/content/children, void elements, attribute escaping, indentation, `pageToHtml()` with framework CDN injection (Bootstrap 5 / Tailwind / Vanilla)
- [x] **2.5** Implemented `htmlToBlocks` (`src/renderer/utils/htmlToBlocks.ts`): DOMParser-based HTML→Block tree, generates unique IDs, maps semantic tags, extracts text/classes/styles/attributes, handles malformed HTML gracefully
- [x] **2.6** **54 unit tests passing** across 3 test files:
  - `blockToHtml.test.ts` — 23 tests (headings, paragraphs, classes, styles, nesting, void elements, lists, buttons, links, attributes, data-block-id, tag override, raw-html, escaping, pageToHtml)
  - `htmlToBlocks.test.ts` — 21 tests (all element types, classes, styles, nesting, attributes, ID preservation, script/style filtering, orphan text, malformed HTML, semantic tags, tag overrides)
  - `roundTrip.test.ts` — 10 tests (heading, paragraph, classes+styles, nested structure, button, image, link, multiple blocks, tag overrides, semantic sections)
- [x] **2.7** History middleware integrated directly into `editorStore` — snapshot on every block mutation, capped at 50 entries, undo/redo clears selection

### Acceptance Criteria ✅
- Block tree can be built programmatically and serialized to clean HTML ✅

---

## Phase 3 — Canvas Engine (iframe Isolation) ✅ COMPLETED

**Agent: 🔵 GPT 5.2 High Thinking**
**Goal:** Implement the isolated iframe canvas that renders the user's page, with injected editor helpers for selection, hovering, and highlighting.

### Context for Agent
> Read `research.md` sections 2.2 (Canvas Isolation Strategy), 3.3 (Component Rendering), and the Zustand store from Phase 2. The canvas must be completely style-isolated from the editor UI.

### Tasks

- [x] **3.1** Create the `Canvas` component (`/src/renderer/components/Canvas/Canvas.tsx`):
  - Renders a sandboxed `<iframe>` element
  - Manages iframe lifecycle (load, reload, error states)
  - Exposes ref to iframe's `contentWindow` and `contentDocument`
- [x] **3.2** Create the canvas runtime script (`/src/preview/runtime.ts`):
  - Injected into the iframe on load
  - Listens for `postMessage` commands from the parent editor
  - Handles: `renderBlocks`, `highlightElement`, `selectElement`, `clearSelection`, `scrollToElement`
  - Sends events back: `elementClicked`, `elementHovered`, `elementContextMenu`
- [x] **3.3** Implement the iframe content renderer:
  - Subscribes to the Zustand block tree
  - On change: generates full HTML document (with `<head>` containing framework CSS + global styles, `<body>` containing block HTML)
  - Writes to iframe via `srcdoc` or `document.write` (with careful handling to avoid history pollution)
- [x] **3.4** Implement element selection system inside the iframe:
  - Click on element → sends `elementClicked` with block ID back to parent
  - Parent updates `selectedBlockId` in Zustand
  - Runtime draws a blue outline overlay on the selected element
  - Hover draws a lighter dashed outline
- [x] **3.5** Implement selection overlay rendering:
  - Overlays are absolutely positioned `<div>`s injected into the iframe
  - Recalculate position on scroll/resize using `ResizeObserver` and `MutationObserver`
  - Show resize handles on selected elements (visual only for now)
- [x] **3.6** Add `data-block-id` attributes to rendered elements in the iframe for hit-testing
- [x] **3.7** Implement the `postMessage` communication protocol:
  - Define a typed message schema (TypeScript discriminated union)
  - Parent→iframe: `{ type: 'render', html: string }`, `{ type: 'select', blockId: string }`, etc.
  - iframe→Parent: `{ type: 'clicked', blockId: string, rect: DOMRect }`, etc.
- [x] **3.8** Handle iframe responsive preview (desktop/tablet/mobile width toggling)

### Acceptance Criteria
- iframe renders Block tree as a live HTML page
- Clicking elements in iframe selects the corresponding block in the store
- Hover/selection overlays display correctly and track element position
- Editor CSS does not bleed into iframe content
- Responsive preview modes work

---

## Phase 4 — Drag & Drop Engine

**Agent: 🔵 GPT 5.2 High Thinking**
**Goal:** Implement the cross-iframe drag-and-drop system using dnd-kit, including the overlay technique, coordinate translation, and drop indicators.

### Context for Agent
> Read `research.md` section 3.1 (Drag-and-Drop Implementation). The critical challenge is that draggable sources are in the parent window (sidebar) but drop targets are inside the iframe. Use the transparent overlay technique to solve the "iframe eats mouse events" problem.

### Tasks

- [x] **4.1** Install and configure `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- [x] **4.2** Create the `DragOverlayManager` component:
  - Renders a transparent `<div>` over the iframe during active drag operations
  - Captures all mouse move/up events in the parent context
  - Translates mouse coordinates relative to iframe position
- [x] **4.3** Create draggable widget items in the sidebar:
  - Each widget type (text, image, button, container, etc.) is a `useDraggable` source
  - On drag start: show a ghost preview thumbnail of the widget
  - Wire up `DragOverlay` from dnd-kit for the floating preview
- [x] **4.4** Implement the cross-iframe drop zone detection:
  - During drag: send translated coordinates to iframe via `postMessage`
  - iframe runtime performs `document.elementFromPoint(x, y)` hit-testing
  - Determine insertion point: before, after, or inside the target block
  - iframe runtime renders a drop indicator (horizontal blue line) at the insertion point
- [x] **4.5** Implement the drop handler:
  - On `dragEnd`: read the target block ID and insertion position from iframe
  - Call `addBlock(type, parentId, index)` on the Zustand store
  - New block is inserted, iframe re-renders, drop indicator clears
- [x] **4.6** Implement block reordering within the canvas:
  - Allow dragging existing blocks (from canvas) to reorder them
  - Show drag preview and drop indicators during reorder
  - Call `moveBlock(id, newParentId, newIndex)` on drop
- [x] **4.7** Implement nested drop zones:
  - Container blocks (rows, columns, sections) accept child blocks
  - Visual feedback: container highlights when hovering with a draggable
  - Distinguish between "insert as sibling" vs "insert as child" based on cursor position relative to container edges
- [x] **4.8** Handle edge cases:
  - Cancel drag on Escape key
  - Prevent dropping a block inside itself (circular reference)
  - Snap-to-grid or snap-to-element helpers (optional)

### Acceptance Criteria
- Widgets can be dragged from sidebar into the canvas iframe
- Drop indicator shows correct insertion point
- Blocks are inserted at the correct position in the tree
- Existing blocks can be reordered via drag
- Nested containers accept child blocks
- No mouse event loss when crossing the iframe boundary

---

## Phase 5 — Monaco Editor Integration & Bidirectional Sync

**Agent: 🔵 GPT 5.2 High Thinking**
**Goal:** Integrate Monaco Editor with bidirectional synchronization between the code view and the visual canvas, using diffing to avoid cursor jumping.

### Context for Agent
> Read `research.md` section 3.2 (Real-Time Code Synchronization). The key challenges are: (1) avoiding flicker/cursor reset when updating Monaco from visual changes, (2) parsing user-typed HTML back to the Block tree without crashing on invalid HTML, (3) debouncing in both directions.

### Tasks

- [x] **5.1** Install `@monaco-editor/react` and configure for HTML language support
- [x] **5.2** Create the `CodeEditor` component (`/src/renderer/components/CodeEditor/CodeEditor.tsx`):
  - Renders Monaco Editor in a bottom panel (collapsible/resizable)
  - HTML language mode with syntax highlighting, auto-closing tags, Emmet support
  - Show/hide toggle with keyboard shortcut
- [x] **5.3** Implement Visual → Code sync:
  - Subscribe to Zustand block tree changes
  - On change: run `blockToHtml()` to generate HTML string
  - **Diff strategy:** Compare new HTML with current Monaco content using a diff algorithm (e.g., `diff-match-patch` or Myers diff)
  - Apply changes via `model.pushEditOperations()` to preserve cursor position, scroll position, and undo stack
  - Debounce: during active drag operations, delay code updates until `dragEnd`
- [x] **5.4** Implement Code → Visual sync:
  - Listen to Monaco `onChange` events
  - Debounce by 800ms after last keystroke
  - Parse HTML via `htmlToBlocks()` utility
  - If valid: update Zustand store → triggers canvas re-render
  - If invalid: show inline Monaco diagnostics (red squiggly) without breaking the canvas
- [x] **5.5** Implement the HTML validation layer:
  - Validate parsed HTML structure before committing to store
  - Report errors as Monaco `markers` (line number, column, message)
  - Differentiate between warnings (e.g., unclosed tag) and errors (completely unparseable)
- [x] **5.6** Handle sync conflict resolution:
  - When user is typing in Monaco, visual canvas is read-only (no drag-drop)
  - When user is dragging on canvas, Monaco is read-only
  - Clear "editing mode" indicator in the UI
- [x] **5.7** Add "Format HTML" button that pretty-prints the code via a formatter
- [x] **5.8** Add CSS editing support in Monaco (secondary tab) synced with block styles

### Acceptance Criteria
- Code editor shows live HTML that matches the canvas
- Editing code updates the canvas after debounce (without cursor jump in Monaco)
- Visual edits update the code (without scroll jump in Monaco)
- Invalid HTML shows errors in Monaco without crashing
- Format button produces clean indented HTML

---

## Phase 6 — Widget & Block Library

**Agent: 🟢 Gemini 3 Pro**
**Goal:** Create a comprehensive library of draggable widgets/blocks organized by category, with JSON schema definitions and Bootstrap 5 templates.

### Context for Agent
> Read `research.md` sections 1.1 (Pingendo analysis), 1.2 (Mobirise block system), 3.3 (Component Rendering), and 4.1 (JSON Schema). Each block is defined by a JSON schema that specifies its type, default props, editable properties, and HTML template. The Component Registry maps block types to their render templates.

### Tasks

- [x] **6.1** Create the `ComponentRegistry` system (`/src/renderer/registry/ComponentRegistry.ts`):
  - Registry maps block `type` string → block definition object
  - Block definition includes: `defaultProps`, `propsSchema`, `template`, `icon`, `category`, `label`
  - `propsSchema` uses a JSON Schema-like format to define editable properties and their types
- [x] **6.2** Create block categories and sidebar UI (`/src/renderer/components/Sidebar/WidgetSidebar.tsx`):
  - **Layout:** Container, Row, Column (1-12 grid), Section, Divider
  - **Typography:** Heading (H1-H6), Paragraph, Blockquote, List, Code Block
  - **Media:** Image, Video, Carousel/Slider, Icon
  - **Interactive:** Button, Link, Form, Input, Textarea, Select, Checkbox
  - **Components:** Navbar, Hero Section, Feature Card, Pricing Table, Footer, Testimonial, Call-to-Action, Accordion, Tabs, Modal Trigger
  - **Embed:** Raw HTML, iframe Embed
  - Sidebar should have a search/filter, collapsible categories, and drag-preview thumbnails
- [x] **6.3** Implement **Layout blocks**:
  - `container` — Bootstrap `.container` / `.container-fluid`
  - `row` — Bootstrap `.row` with gutter options
  - `column` — Bootstrap `.col-*` with responsive breakpoint props (xs, sm, md, lg, xl, xxl)
  - `section` — Full-width semantic `<section>` wrapper
  - `divider` — `<hr>` with style variants
- [x] **6.4** Implement **Typography blocks**:
  - `heading` — Props: level (1-6), text, alignment
  - `paragraph` — Props: text (rich text), alignment, lead class
  - `blockquote` — Props: text, cite
  - `list` — Props: items array, ordered/unordered
- [x] **6.5** Implement **Media blocks**:
  - `image` — Props: src, alt, width, objectFit, responsive class, link
  - `video` — Props: src (URL or local), autoplay, controls, poster
  - `carousel` — Props: slides array (each with image, caption, link)
- [x] **6.6** Implement **Interactive blocks**:
  - `button` — Props: text, variant (primary/secondary/etc.), size, link, outline
  - `link` — Props: text, href, target, class
  - `form` — Container for form elements with action props
  - `input` / `textarea` / `select` — Props: label, placeholder, name, required, type
- [x] **6.7** Implement **Component blocks** (complex multi-element blocks):
  - `navbar` — Props: brand text/logo, nav items array, style (light/dark), sticky
  - `hero` — Props: heading, subheading, CTA button text/link, background image/color, overlay
  - `feature-card` — Props: icon, title, description, link
  - `pricing-table` — Props: plans array (name, price, features list, CTA)
  - `footer` — Props: columns array (title, links), copyright text, social links
  - `testimonial` — Props: quote, author, avatar, role
  - `cta-section` — Props: heading, text, button text/link, background
  - `accordion` — Props: items array (title, content)
  - `tabs` — Props: tabs array (label, content)
- [x] **6.8** Implement the `raw-html` block — escape hatch for arbitrary HTML
- [x] **6.9** Create thumbnail previews for each block (small static renders or SVG icons for the sidebar)
- [x] **6.10** Implement "User Blocks" — ability to save a block configuration as a reusable custom block (stored as JSON in the project)

### Acceptance Criteria
- All block types render correctly in the canvas
- Each block has a complete `propsSchema` for the property inspector
- Sidebar shows categorized blocks with icons/thumbnails
- Dragging any block from sidebar to canvas creates it with default props
- User can save/load custom blocks

---

## Phase 7 — Property Inspector Panel

**Agent: 🟢 Gemini 3 Pro**
**Goal:** Build the right-side property inspector that dynamically renders editing controls based on the selected block's schema.

### Context for Agent
> Read `research.md` section 5.5 (Styling and Property Inspectors). The inspector must dynamically generate form fields based on the selected block's `propsSchema`. Changes should update the Zustand store in real-time using transient updates for performance.

### Tasks

- [x] **7.1** Create the `Inspector` panel component (`/src/renderer/components/Inspector/Inspector.tsx`):
  - Reads `selectedBlockId` from Zustand store
  - Looks up the block's `propsSchema` from the ComponentRegistry
  - Renders grouped property controls dynamically
  - Shows "No selection" state when nothing is selected
- [x] **7.2** Implement property field renderers for each type:
  - **Text input** — for string props (heading text, alt text, etc.)
  - **Textarea** — for multi-line text / rich content
  - **Number input** — with min/max/step (padding, margin, font-size)
  - **Select dropdown** — for enum props (heading level, button variant)
  - **Color picker** — for color props (background, text color)
  - **Toggle/Checkbox** — for boolean props (container-fluid, sticky, etc.)
  - **Image selector** — triggers file picker via IPC, shows preview thumbnail
  - **URL input** — for link/href props with validation
  - **Array editor** — for list props (nav items, carousel slides, pricing plans) with add/remove/reorder
  - **Slider/Range** — for numeric ranges (opacity, border-radius)
- [x] **7.3** Implement the **Spacing editor** (visual box-model control):
  - Interactive box-model diagram (margin → border → padding → content)
  - Click on a side to edit its value
  - Supports px, rem, em, % units
- [x] **7.4** Implement the **Typography section**:
  - Font family selector (with preview)
  - Font size, weight, line-height, letter-spacing
  - Text alignment buttons
  - Text color picker
- [x] **7.5** Implement the **Background section**:
  - Background color picker
  - Background image selector (local file via IPC)
  - Background position, size, repeat controls
  - Gradient builder (optional, stretch goal)
- [x] **7.6** Implement the **Border section**:
  - Border width, style, color for each side
  - Border radius (per-corner or uniform)
- [x] **7.7** Implement the **Layout section** (for container/flex blocks):
  - Display type (block, flex, grid)
  - Flex direction, justify, align
  - Gap controls
- [x] **7.8** Implement the **Responsive overrides**:
  - Breakpoint tabs (xs, sm, md, lg, xl, xxl)
  - Properties set per breakpoint map to Bootstrap responsive classes
- [x] **7.9** Implement the **CSS Classes editor**:
  - Text input with autocomplete for Bootstrap/Tailwind classes
  - Shows current classes as removable tags/chips
- [x] **7.10** Implement the **Block actions** section:
  - Duplicate block button
  - Delete block button (with confirmation)
  - Move up / Move down buttons
  - Lock/unlock toggle
  - "Save as User Block" button
- [x] **7.11** Ensure all property changes update the Zustand store with minimal re-renders (use Zustand selectors and transient subscriptions)

### Acceptance Criteria
- Selecting a block shows its editable properties in the inspector
- Changing any property updates the canvas in real-time
- All field types render and function correctly
- Spacing editor visually represents the box model
- Responsive breakpoint overrides work
- Block actions (duplicate, delete, move, lock) all function

---

## Phase 8 — Asset Management, File I/O & Electron Integration

**Agent: 🟣 Claude Opus 4.6**
**Goal:** Implement the complete file I/O system, wrap the app in Electron (resolving the module resolution issue from Phase 1), and create the asset manager UI.

### Context for Agent
> Read `research.md` section 4.2 (Asset Management) and 2.1 (Electron Process Model). Assets must be served via a custom `app-media://` protocol. File operations happen exclusively in the Main Process via IPC.
>
> **⚠️ NOTE FROM PHASE 1:** Electron's `require('electron')` resolves to the npm package (binary path string) instead of the built-in module on this Linux system. The Electron main process code is already written in `src/main/index.ts` and preload in `src/preload/index.ts`, but needs the module resolution issue fixed before it can run. A mock API layer (`src/renderer/utils/api.ts`) currently provides browser-based fallbacks. This phase should: (1) fix or work around the Electron issue, (2) swap the mock API for real IPC when running in Electron, (3) implement all file I/O features.

### Tasks

- [x] **8.1** Implement the full `app-media://` protocol handler in Main Process:
  - Register via `protocol.handle('app-media', handler)`
  - Resolve paths securely (prevent directory traversal attacks)
  - Serve images, fonts, CSS, JS files from the project directory
  - Set correct MIME types
  - Handle 404 for missing files
- [x] **8.2** Implement project save:
  - Serialize the full `ProjectData` (settings + all pages + blocks) to JSON
  - Write to `project.json` in the project directory
  - Copy referenced assets to project `assets/` folder
  - Show save dialog for "Save As" (new project location)
  - Auto-save timer (configurable interval, default 60s)
- [x] **8.3** Implement project load:
  - "Open Project" dialog → select a folder or `.json` file
  - Deserialize JSON → populate Zustand stores
  - Validate schema version compatibility
  - Show recent projects list on startup
- [x] **8.4** Implement the Asset Manager panel/dialog:
  - Grid view of all images in the project's `assets/` folder
  - Drag image from asset manager into the canvas (sets `src` prop)
  - "Add Image" button → native file picker → copies file to project assets
  - Delete unused assets
  - Image preview with dimensions info
- [x] **8.5** Implement "New Project" wizard:
  - Project name, directory selection
  - Framework choice (Bootstrap 5, Tailwind CSS, Vanilla)
  - Starter template selection (Blank, Landing Page, Portfolio, etc.)
- [ ] **8.6** Implement file watchers for external changes (optional):
  - Watch project directory for external modifications
  - Prompt user to reload if files changed externally

### Acceptance Criteria
- Projects save and load correctly (full round-trip)
- Images display in the canvas via `app-media://` protocol
- Asset manager shows project images
- File picker integration works for selecting images
- New project wizard creates a valid project structure

---

## Phase 9 — Export Engine

**Agent: Cascade**
**Goal:** Build the export engine that converts the internal JSON representation into clean, deployable HTML/CSS/JS files.

### Context for Agent
> Read `research.md` section 4.3 (Export Engine). The export must produce standard, vendor-agnostic HTML that works without the editor. All editor artifacts (`data-block-id`, internal classes, editor scripts) must be stripped. Assets must be consolidated.

### Tasks

- [x] **9.1** Create the export pipeline (`/src/renderer/utils/exportEngine.ts`):
  - Accept `ProjectData` as input
  - Output a file tree: `{ path: string, content: string | Buffer }[]`
- [x] **9.2** Implement HTML generation:
  - Traverse Block tree recursively
  - Generate semantic, indented HTML
  - Strip all `data-block-id`, `data-editor-*` attributes
  - Strip editor-only CSS classes
  - Include framework CDN links (Bootstrap CSS/JS) in `<head>`
  - Include Google Fonts links if custom fonts are used
- [x] **9.3** Implement CSS extraction:
  - Collect all custom styles (non-framework) from blocks
  - Generate a consolidated `styles.css` file
  - Convert inline styles to CSS classes where sensible
  - Include CSS custom properties from `globalStyles`
- [x] **9.4** Implement asset consolidation:
  - Scan HTML for asset references (`app-media://` paths)
  - Copy referenced files to `export/assets/` directory
  - Rewrite paths in HTML to relative paths (`./assets/filename.ext`)
  - Handle duplicate filenames
- [x] **9.5** Implement multi-page export:
  - Generate one HTML file per page
  - Correct inter-page link references
  - Shared assets folder across pages
- [x] **9.6** Implement export dialog UI:
  - "Export" button in toolbar → choose export directory
  - Options: minify HTML/CSS, include/exclude JS, single file vs multi-file
  - Progress indicator for large projects
  - "Preview in browser" button (opens exported index.html in default browser)
- [x] **9.7** Implement "Copy HTML" function:
  - Quick copy of current page's HTML to clipboard
  - Useful for pasting into other tools
- [x] **9.8** Write tests for the export pipeline:
  - Verify no editor artifacts in output
  - Verify asset paths are correctly rewritten
  - Verify HTML validates (via an HTML validator)

### Acceptance Criteria
- Exported HTML is clean, standard-compliant, and renders correctly in a browser
- No editor artifacts remain in exported files
- Assets are properly consolidated with correct paths
- Multi-page export generates correct inter-page links
- Export dialog provides useful options

---

## Phase 10 — Editor UI, Layout & Theming

**Agent: 🟢 Gemini 3 Pro**
**Goal:** Build the polished editor shell: resizable panel layout, toolbar, theme system, and overall UX.

### Context for Agent
> The editor layout should be: left sidebar (widgets), center (canvas + code editor), right sidebar (inspector). All panels should be resizable and collapsible. The editor should have a dark/light theme. Follow modern desktop IDE aesthetics.

### Tasks

- [x] **10.1** Implement the resizable panel layout:
  - Use a split-pane library (e.g., `react-resizable-panels` or `allotment`)
  - Left sidebar: collapsible, default 260px
  - Center: flexible, contains canvas (top) and code editor (bottom, collapsible)
  - Right sidebar: collapsible, default 300px
  - Persist panel sizes to localStorage
- [x] **10.2** Create the top toolbar:
  - Project name (editable)
  - File operations: New, Open, Save, Save As, Export
  - Edit operations: Undo, Redo, Cut, Copy, Paste, Delete
  - View operations: Toggle left panel, Toggle right panel, Toggle code editor
  - Responsive preview buttons: Desktop, Tablet, Mobile
  - Zoom controls for canvas
  - Theme toggle (dark/light)
- [x] **10.3** Implement the Page manager (tab bar or dropdown):
  - Show all pages in project
  - Add/rename/delete pages
  - Switch between pages (loads different block tree)
- [x] **10.4** Implement the dark/light theme system:
  - CSS custom properties based theme
  - Follows OS preference by default
  - Toggle override
  - Theme applies to editor UI only (not canvas content)
- [x] **10.5** Implement the status bar (bottom):
  - Current page name
  - Block count
  - Sync status indicator (synced/syncing/error)
  - Zoom level
  - cursor position info when in code editor
- [x] **10.6** Implement the context menu system:
  - Right-click on canvas elements → Cut, Copy, Paste, Duplicate, Delete, Move Up, Move Down, Lock, Save as Block
  - Right-click on sidebar blocks → Insert at top, Insert at bottom
- [x] **10.7** Implement the welcome/start screen:
  - Show on app launch (when no project is open)
  - Recent projects list
  - "New Project" and "Open Project" buttons
  - Quick template gallery
- [x] **10.8** Add loading states and transitions:
  - Skeleton loading for panels
  - Smooth transitions for panel collapse/expand
  - Progress indicator for heavy operations (export, large file load)
- [x] **10.9** Polish icons using Lucide React icon set throughout the editor

### Acceptance Criteria
- All panels resize and collapse smoothly
- Toolbar operations are functional and have keyboard shortcut hints
- Page management works
- Dark/light theme looks polished
- Context menus work correctly
- Welcome screen displays on cold start

---

## Phase 11 — UX Polish: Shortcuts, Undo/Redo & Accessibility

**Agent: 🟠 Kimi K2**
**Goal:** Implement keyboard shortcuts, refine undo/redo, add clipboard operations, and ensure accessibility basics.

### Context for Agent
> The undo/redo stack exists in the Zustand store from Phase 2. This phase wires it to keyboard shortcuts and polishes the interaction. Also implement clipboard operations for blocks.

### Tasks

- [x] **11.1** Implement global keyboard shortcuts:
  - `Ctrl+S` — Save project
  - `Ctrl+Shift+S` — Save As
  - `Ctrl+O` — Open project
  - `Ctrl+Z` — Undo
  - `Ctrl+Shift+Z` / `Ctrl+Y` — Redo
  - `Ctrl+C` — Copy selected block
  - `Ctrl+V` — Paste block
  - `Ctrl+X` — Cut selected block
  - `Ctrl+D` — Duplicate selected block
  - `Delete` / `Backspace` — Delete selected block
  - `Escape` — Deselect / Cancel drag
  - `Ctrl+E` — Toggle code editor
  - `Ctrl+\` — Toggle left sidebar
  - `Ctrl+/` — Toggle right sidebar
  - Arrow keys — Navigate between sibling blocks
  - `Tab` / `Shift+Tab` — Navigate into/out of children
- [x] **11.2** Implement block clipboard:
  - Copy: serialize selected block (and children) to clipboard as JSON
  - Paste: deserialize and insert after selected block (with new IDs)
  - Cut: copy + delete
  - Support cross-page paste
- [x] **11.3** Refine undo/redo:
  - Group rapid changes (e.g., typing in a text field) into single undo steps
  - Show undo/redo descriptions in toolbar tooltips
  - Visual flash feedback on undo/redo
- [x] **11.4** Implement drag handles:
  - Show a drag handle icon on hover for each block in the canvas
  - Handle initiates block reorder drag
- [x] **11.5** Implement basic accessibility:
  - ARIA labels on all interactive elements
  - Focus management for panels
  - Screen reader announcements for drag-and-drop operations
  - High contrast mode support
- [x] **11.6** Add tooltip system for toolbar buttons and sidebar items
- [x] **11.7** Implement "Quick Add" command palette:
  - `Ctrl+K` opens a search overlay
  - Type block name → insert it at current selection
  - Also search for commands (save, export, undo, etc.)

### Acceptance Criteria
- All keyboard shortcuts work correctly
- Copy/paste blocks works within and across pages
- Undo/redo handles grouped changes properly
- Drag handles appear and initiate reorder
- Command palette search works
- Basic ARIA labels are in place

---

## Phase 12 — Testing, Performance & Documentation

**Agent: 🟠 Kimi K2**
**Goal:** Write tests, optimize performance, and create user-facing documentation.

### Context for Agent
> Read `research.md` section 7 (Performance Optimization). Focus on lazy loading, virtualization for large block lists, IPC throttling, and CSS containment.

### Tasks

- [x] **12.1** Unit tests:
  - Block tree manipulation (add, remove, move, update)
  - `blockToHtml` and `htmlToBlocks` — various edge cases
  - Export engine — clean output, no editor artifacts
  - State store — undo/redo, history limits
- [x] **12.2** Integration tests:
  - Drag from sidebar → drop in canvas → block appears
  - Edit in code editor → canvas updates
  - Edit in inspector → code editor updates
  - Save → close → load → state restored
  - Export → open in browser → renders correctly
- [x] **12.3** Performance optimizations:
  - `React.lazy` + `Suspense` for Monaco Editor and Asset Manager
  - Virtualization for sidebar widget list if >50 items
  - Canvas: Use `CSS contain` property on top-level blocks
  - Throttle IPC messages (auto-save ≤ 1/min, not on every change)
  - Debounce canvas re-renders during rapid state changes
  - Profile and fix any memory leaks in iframe lifecycle
- [x] **12.4** Create `README.md`:
  - Project description and screenshots
  - Setup instructions (`npm install`, `npm run dev`, `npm run build`)
  - Architecture overview (link to research.md)
  - Contribution guidelines
- [x] **12.5** Create in-app help:
  - Keyboard shortcuts reference dialog (`Ctrl+?`)
  - First-launch tutorial overlay (highlight key UI areas)
- [x] **12.6** Build and package:
  - Configure `electron-builder` for Linux, macOS, Windows
  - Test packaged app on at least one platform
  - Create release build scripts
- [x] **12.7** Final QA pass:
  - Test all block types render correctly
  - Test save/load round-trip
  - Test export output
  - Test theme switching
  - Test responsive preview modes
  - Verify no console errors in production build

### Acceptance Criteria
- All unit tests pass
- Integration tests cover core workflows
- App starts in <3 seconds (dev mode)
- No visible jank during drag operations
- Packaged app runs standalone
- README is complete and accurate

---

## Dependency Graph

```
Phase 1 (Foundation)
  └─→ Phase 2 (State & Data)
        ├─→ Phase 3 (Canvas) ─→ Phase 4 (Drag & Drop)
        ├─→ Phase 5 (Monaco Sync)
        └─→ Phase 8 (Assets & File I/O)
              └─→ Phase 9 (Export Engine)

Phase 6 (Widget Library) — requires Phase 2 schema, can start after Phase 2
Phase 7 (Inspector) — requires Phase 6 registry, can start after Phase 6
Phase 10 (Editor UI) — can start after Phase 3, integrates all panels
Phase 11 (UX Polish) — requires Phases 3-7 complete
Phase 12 (Testing) — final phase, requires all others
```

## Recommended Execution Order

| Order | Phase | Agent | Est. Effort |
|-------|-------|-------|-------------|
| 1st | Phase 1 — Scaffolding | Claude Opus 4.6 | Medium |
| 2nd | Phase 2 — State & Data | Claude Opus 4.6 | Medium |
| 3rd | Phase 3 — Canvas Engine | GPT 5.2 High | Large |
| 4th | Phase 4 — Drag & Drop | GPT 5.2 High | Large |
| 5th | Phase 6 — Widget Library | Gemini 3 Pro | Large |
| 6th | Phase 5 — Monaco Sync | GPT 5.2 High | Large |
| 7th | Phase 7 — Inspector | Gemini 3 Pro | Large |
| 8th | Phase 8 — Assets & I/O | Claude Opus 4.6 | Medium |
| 9th | Phase 9 — Export Engine | GPT 5.2 High | Medium |
| 10th | Phase 10 — Editor UI | Gemini 3 Pro | Medium |
| 11th | Phase 11 — UX Polish | Kimi K2 | Medium |
| 12th | Phase 12 — Testing & Docs | Kimi K2 | Medium |

---

*Plan generated from `research.md` architectural blueprint. Each phase should reference both this plan and `research.md` for full context.*
