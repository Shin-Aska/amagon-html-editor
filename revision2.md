# Hoarses — Revision 2: Functional Fixes & Theme System

> **Scope:** Fix 5 functional bugs and add 2 new features discovered during testing
> **Stack:** Electron + Vite + React + TypeScript + Zustand + Monaco Editor + dnd-kit
> **Reference:** See `plan.md` for original implementation plan, `revision1.md` for prior fixes

---

## How to Use This Plan

Same workflow as `plan.md`:

1. Switch to the assigned agent in Windsurf's model selector
2. Tell the agent: **"Execute Phase RN of revision2.md"** (where N is the phase number)
3. The agent should read `revision2.md` and relevant source files for context
4. Check off completed tasks as you go (`[ ]` → `[x]`)

### Agent Assignment Rationale

| Agent | Strengths | Assigned Phases |
|---|---|---|
| **Claude Opus 4.6** | Asset management, IPC design, file I/O, complex state patterns, multi-file coherence | R3 (Media placeholders & file picker), R6 (Theme system) |
| **GPT 5.2 High Thinking / Cascade** | Deep debugging, state reasoning, bidirectional sync, algorithmic problem solving | R4 (Page picker & save fixes) |
| **Kimi K2** | Well-scoped UI implementation, UX polishing, layout work, accessibility | R5 (View layout customization) |

---

## Phase R3 — Media Placeholders & Image File Picker

**Agent: 🟣 Claude Opus 4.6**
**Goal:** Ensure all media blocks (image, icon) display meaningful placeholders with visible text labels, and add a local file picker for image URLs with optional base64 conversion.

### Context for Agent

> Revision 1 (Phase R1) addressed offline-safe placeholders by switching from `https://via.placeholder.com/` URLs to base64 data URIs. However, the current placeholders are still not rendering meaningful content — users see generic grey boxes without clear "Image here" or "Icon here" labels. The placeholders need to be visually informative so users understand what type of media block they've placed.
>
> Additionally, the image URL property field in the Inspector has no file picker — users must manually type/paste a URL. There should be a "Browse" button that opens a native file dialog for local images, with an option to embed them as base64 data URIs.
>
> **Do NOT touch the `video` block** — leave it as-is.

### Bug 1: Media blocks still lack informative placeholders

**Files to inspect:**
- `src/renderer/utils/placeholders.ts` — Current placeholder data URIs
- `src/renderer/registry/registerBlocks.ts` — Block default props

**Root cause:** The existing placeholders (from revision1) are either too generic or not rendering visible text labels. Users cannot distinguish what type of media block they've placed.

**Tasks:**
- [x] **R3.1a** Update `src/renderer/utils/placeholders.ts` to generate SVG-based base64 data URIs that include visible text labels:
  - `IMAGE_PLACEHOLDER` — A light grey rectangle (900×300) with centered "Image here" text in dark grey, with a small image icon above the text
  - `ICON_PLACEHOLDER` — A small square (64×64) with centered "Icon here" text and a simple star/icon shape
  - Keep SVGs minimal to avoid bundle bloat
- [x] **R3.1b** Update `registerBlocks.ts` to use the new labeled placeholders as default `src` for:
  - `image` block
  - `icon` block
  - Any composite blocks that include images (hero, feature-card, testimonial, carousel, etc.)
- [x] **R3.1c** Verify in both dark and light themes that placeholders are clearly visible and text is readable
- [x] **R3.1d** Do NOT touch the `video` block — leave it completely as-is

### Feature 1: Image URL file picker with base64 conversion

**Files to inspect:**
- `src/renderer/components/Inspector/Inspector.tsx` — Property field renderers
- `src/renderer/utils/api.ts` — Mock API layer (file selection)

**Root cause:** The image `src` property in the Inspector renders as a plain text input. There is no "Browse" button to select a local file, and no way to embed a local image as a base64 data URI.

**Tasks:**
- [x] **R3.2a** Create or update the image selector field in the Inspector to include:
  - A text input for manual URL entry (existing behavior)
  - A "Browse..." button next to the input that opens a native file dialog (via the API layer) filtered for image files (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`)
  - After file selection, populate the text input with the file path
- [x] **R3.2b** Add a checkbox or toggle labeled "Embed as Base64" next to the file picker:
  - When enabled and a local file is selected, read the file and convert it to a base64 data URI (`data:image/png;base64,...`)
  - Store the base64 string as the block's `src` property
  - When disabled, store the file path as-is (for `app-media://` protocol resolution)
- [x] **R3.2c** Update the API layer (`src/renderer/utils/api.ts`) if needed to support:
  - `assets.selectImage()` — returns the selected file path
  - `assets.readFileAsBase64(path)` — reads a local file and returns base64 data URI
- [x] **R3.2d** Show a small preview thumbnail below the input when a valid image URL or base64 string is set
- [x] **R3.2e** Handle edge cases:
  - Large files: warn if base64 would exceed 500KB
  - Invalid files: show error if selected file is not a valid image
  - Cancel: handle dialog cancellation gracefully

### Acceptance Criteria
- Dropping an image block shows a placeholder with "Image here" text
- Dropping an icon block shows a placeholder with "Icon here" text
- Composite blocks (hero, card, etc.) show labeled image placeholders
- Inspector image field has a "Browse..." button that opens a file picker
- "Embed as Base64" option converts local files to data URIs
- Image preview thumbnail appears in the Inspector
- Video blocks are completely untouched

---

## Phase R4 — Page Picker Fix & Save Project Fix

**Agent: 🔵 GPT 5.2 High Thinking / Cascade**
**Goal:** Fix the confusing page picker UX, fix page switching (blocks not updating when switching pages), and fix the broken save project functionality.

### Context for Agent

> The page management system was implemented in Phase 2 (`projectStore.ts`) and the page manager UI in Phase 10 (`Toolbar.tsx` or a dedicated page manager component). Two critical bugs exist:
>
> 1. **Page picker is confusing and switching doesn't work:** When the user switches pages via the page picker/tab bar, the canvas and editor do not update to show the new page's blocks. The page selection likely updates the `currentPageId` in the project store, but the editor store's `blocks` array is not being swapped to match the selected page.
>
> 2. **Save project doesn't work:** The save button/shortcut (`Ctrl+S`) either does nothing, throws an error, or saves incomplete data. This could be a mock API issue, a serialization issue, or a state synchronization problem between the editor store and project store.

### Bug 2: Page picker is confusing and page switching doesn't work

**Files to inspect:**
- `src/renderer/store/projectStore.ts` — Page state, `setCurrentPage()`, page CRUD
- `src/renderer/store/editorStore.ts` — `blocks`, `setPageBlocks()`
- `src/renderer/components/` — Page picker/tab bar component (find the page switching UI)
- `src/renderer/App.tsx` — May contain page switching orchestration

**Tasks:**
- [x] **R4.1a** Trace the page switching flow end-to-end:
  - Identify the page picker UI component
  - Trace what happens when a user clicks a different page
  - Determine if `currentPageId` updates in the project store
  - Determine if `blocks` in the editor store gets swapped to the new page's block tree
  - Identify where the chain breaks
- [x] **R4.1b** Fix the page switching mechanism:
  - When `currentPageId` changes in the project store, the editor store must:
    1. Save the current page's blocks back to the project store
    2. Load the new page's blocks into the editor store
    3. Clear the selection state
    4. Clear the undo/redo history (or scope it per-page)
  - The canvas must re-render with the new page's blocks
  - The code editor must update to show the new page's HTML
- [x] **R4.1c** Improve the page picker UX to be less confusing:
  - Clearly indicate the active/selected page (bold text, highlighted background, or underline)
  - Show page names prominently (not just IDs)
  - Add visual feedback when switching (brief loading state or transition)
  - If using a dropdown, consider switching to a tab bar for better discoverability
- [ ] **R4.1d** Ensure page CRUD operations work correctly after the fix:
  - Add page → new page appears and is selectable
  - Rename page → name updates in the picker
  - Delete page → switches to another page, doesn't leave the user on a deleted page
  - Reorder pages → order is preserved

### Bug 3: Save project doesn't work

**Files to inspect:**
- `src/renderer/utils/api.ts` — Mock API save implementation
- `src/renderer/store/projectStore.ts` — `saveProject()` action
- `src/renderer/store/editorStore.ts` — Current blocks state
- `src/renderer/components/Toolbar/Toolbar.tsx` — Save button handler

**Tasks:**
- [x] **R4.2a** Debug the save flow:
  - Click Save or press `Ctrl+S`
  - Trace the call from the toolbar → store action → API layer
  - Check the browser console for errors
  - Check if localStorage is being written to (in mock mode)
  - Identify what fails: serialization, API call, or state collection
- [x] **R4.2b** Fix the save mechanism:
  - Ensure the save flow collects the **complete** project state:
    - All pages with their block trees (not just the current page)
    - Project settings (name, framework, global styles)
    - Asset references
  - The current page's blocks must be synced from the editor store back to the project store before serialization
  - In mock mode (browser): save to localStorage with a proper key and show success feedback
  - In Electron mode: save to the file system via IPC
- [x] **R4.2c** Add user feedback for save operations:
  - Show a brief "Saved" toast/notification on success
  - Show an error message on failure
  - Update the title bar or status bar to indicate unsaved changes (e.g., dot indicator or asterisk)
  - Disable the save button briefly during save to prevent double-saves
- [ ] **R4.2d** Verify save/load round-trip:
  - Save a project with multiple pages
  - Reload the app
  - Load the project
  - Verify all pages, blocks, and settings are restored correctly

### Acceptance Criteria
- Clicking a different page in the page picker switches the canvas to show that page's content
- The active page is clearly indicated in the page picker UI
- Page CRUD (add, rename, delete) works and the picker updates
- `Ctrl+S` / Save button saves the complete project state
- Saved projects can be loaded back with all pages and blocks intact
- User receives visual feedback on save success/failure
- No data loss when switching pages (blocks are preserved)

---

## Phase R5 — Editor View Layout Customization

**Agent: 🟠 Kimi K2**
**Goal:** Allow users to customize the arrangement of the live preview canvas and code editor, offering multiple layout options beyond the current fixed "live view on top, code editor on bottom" arrangement.

### Context for Agent

> Currently the center panel has a fixed layout: the live preview canvas is always on top and the Monaco code editor is always on the bottom (collapsible). Users have requested the ability to arrange these differently, including side-by-side layouts. The panel system uses `react-resizable-panels` (or similar) from Phase 10.
>
> Key files:
> - `src/renderer/App.tsx` — Main layout composition
> - `src/renderer/components/Canvas/Canvas.tsx` — Live preview iframe
> - `src/renderer/components/CodeEditor/CodeEditor.tsx` — Monaco editor
> - `src/renderer/store/editorStore.ts` — Editor preferences state

### Tasks

- [ ] **R5.1** Add an `editorLayout` preference to the editor store:
  - Type: `'top-bottom' | 'bottom-top' | 'left-right' | 'right-left' | 'canvas-only' | 'code-only'`
  - Default: `'top-bottom'` (current behavior)
  - Persist to localStorage so the preference survives reloads
- [ ] **R5.2** Implement the layout variants in the center panel:
  - **`top-bottom`** — Canvas on top, code editor on bottom (current default)
  - **`bottom-top`** — Code editor on top, canvas on bottom
  - **`left-right`** — Canvas on left, code editor on right (side-by-side)
  - **`right-left`** — Code editor on left, canvas on right (side-by-side)
  - **`canvas-only`** — Full-height canvas, code editor hidden
  - **`code-only`** — Full-height code editor, canvas hidden
  - All split layouts should use resizable dividers
- [ ] **R5.3** Add a layout switcher control to the toolbar or status bar:
  - A dropdown or segmented button group with icons representing each layout
  - Use intuitive icons (e.g., split-horizontal, split-vertical, maximize icons)
  - Show the currently active layout as selected
  - Tooltip on each option describing the layout
- [ ] **R5.4** Add keyboard shortcuts for quick layout switching:
  - `Ctrl+Alt+1` — Top-bottom (default)
  - `Ctrl+Alt+2` — Side-by-side (left-right)
  - `Ctrl+Alt+3` — Canvas only
  - `Ctrl+Alt+4` — Code only
  - Register these in the existing keyboard shortcut system
- [ ] **R5.5** Ensure smooth transitions when switching layouts:
  - Panels should resize/reflow without losing scroll position in either the canvas or code editor
  - Monaco editor should re-layout after resize (`editor.layout()`)
  - Canvas iframe should not reload when layout changes
- [ ] **R5.6** Test all layouts:
  - Verify canvas renders correctly in all layouts
  - Verify code editor functions correctly in all layouts (syntax highlighting, scrolling, editing)
  - Verify resizable dividers work in both horizontal and vertical splits
  - Verify layout preference persists across page reloads
  - Test with both dark and light themes

### Acceptance Criteria
- Users can switch between at least 4 layout options (top-bottom, side-by-side, canvas-only, code-only)
- Layout switcher is accessible from the toolbar with clear icons
- Keyboard shortcuts provide quick layout switching
- Layout preference persists across sessions
- No content loss or reload when switching layouts
- Resizable dividers work in all split modes
- Monaco editor and canvas both function correctly in all layouts

---

## Phase R6 — Theme Editor, Import & Export

**Agent: 🟣 Claude Opus 4.6**
**Goal:** Create a theme editor that allows users to customize the visual theme of their project (colors, fonts, spacing), and implement theme import/export for sharing and reusing themes.

### Context for Agent

> The project supports framework choices (Bootstrap 5, Tailwind CSS, Vanilla) set in `projectStore.ts`. However, there is no way to customize the project's visual theme — CSS variables, color palettes, typography, etc. Users need a theme editor to define and tweak their project's design tokens, and the ability to export/import these themes as shareable files.
>
> This is about the **project's theme** (the website being built), NOT the editor's own dark/light theme.
>
> Key files:
> - `src/renderer/store/projectStore.ts` — Project settings, `globalStyles`
> - `src/renderer/store/types.ts` — `ProjectSettings`, `ProjectData` types
> - `src/renderer/utils/blockToHtml.ts` — Injects global styles into page HTML
> - `src/renderer/utils/exportEngine.ts` — Export pipeline

### Tasks

#### Theme Data Model

- [ ] **R6.1a** Define a `ProjectTheme` TypeScript interface in `src/renderer/store/types.ts`:
  ```ts
  interface ProjectTheme {
    name: string;
    version: string;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      surface: string;
      text: string;
      textSecondary: string;
      border: string;
      success: string;
      warning: string;
      danger: string;
      info: string;
      [key: string]: string; // custom colors
    };
    typography: {
      fontFamily: string;
      headingFontFamily: string;
      baseFontSize: string;       // e.g. '16px'
      baseLineHeight: string;     // e.g. '1.5'
      headingWeight: string;      // e.g. '700'
      bodyWeight: string;         // e.g. '400'
    };
    spacing: {
      unit: string;               // e.g. '8px'
      containerMaxWidth: string;  // e.g. '1200px'
      sectionPadding: string;     // e.g. '60px'
    };
    borders: {
      radius: string;             // e.g. '4px'
      width: string;              // e.g. '1px'
      color: string;              // e.g. matches colors.border
    };
    customCSS: string;            // raw CSS overrides
  }
  ```
- [ ] **R6.1b** Add `theme: ProjectTheme` to `ProjectSettings` with sensible defaults per framework:
  - Bootstrap 5: Bootstrap's default color palette and typography
  - Tailwind CSS: Tailwind's default theme values
  - Vanilla: A clean, neutral default theme
- [ ] **R6.1c** Add Zustand actions to `projectStore.ts`:
  - `updateTheme(partial: Partial<ProjectTheme>)` — merge partial theme changes
  - `resetTheme()` — reset to framework defaults
  - `setTheme(theme: ProjectTheme)` — replace entire theme (for import)
  - `getTheme(): ProjectTheme` — get current theme

#### Theme Editor UI

- [ ] **R6.2a** Create `src/renderer/components/ThemeEditor/ThemeEditor.tsx`:
  - A modal or slide-out panel accessible from the toolbar (e.g., paint palette icon button)
  - Organized into sections: **Colors**, **Typography**, **Spacing**, **Borders**, **Custom CSS**
- [ ] **R6.2b** Implement the **Colors** section:
  - Color swatches for each named color (primary, secondary, accent, etc.)
  - Click a swatch to open a color picker
  - Live preview: changing a color immediately updates the canvas
  - "Add Custom Color" button for user-defined color variables
- [ ] **R6.2c** Implement the **Typography** section:
  - Font family selector with dropdown (include Google Fonts suggestions)
  - Separate selectors for body and heading fonts
  - Font size, line height, and font weight controls
  - Preview text that updates live
- [ ] **R6.2d** Implement the **Spacing** section:
  - Base spacing unit control
  - Container max-width control
  - Section padding control
  - Visual preview of spacing scale
- [ ] **R6.2e** Implement the **Borders** section:
  - Border radius control (with visual preview)
  - Default border width and color
- [ ] **R6.2f** Implement the **Custom CSS** section:
  - A mini Monaco editor (or textarea) for raw CSS overrides
  - Applied after all theme variables

#### Theme → Canvas Integration

- [ ] **R6.3a** Update `blockToHtml.ts` to inject theme CSS variables into the `<head>` of the canvas iframe:
  - Generate CSS custom properties from `ProjectTheme` (e.g., `--theme-primary: #007bff;`)
  - Include the `customCSS` block
  - For Bootstrap: override Bootstrap's CSS variables
  - For Tailwind: generate appropriate utility overrides
- [ ] **R6.3b** Update `exportEngine.ts` to include theme variables in exported CSS:
  - Theme CSS variables go into `styles.css`
  - Custom CSS is appended
  - Google Fonts `@import` or `<link>` tags are included if custom fonts are used

#### Theme Import & Export

- [ ] **R6.4a** Implement theme export:
  - "Export Theme" button in the Theme Editor
  - Serializes `ProjectTheme` to a `.hoarses-theme.json` file
  - Triggers a download in mock mode / save dialog in Electron mode
  - Include a human-readable header with theme name and version
- [ ] **R6.4b** Implement theme import:
  - "Import Theme" button in the Theme Editor
  - Opens a file picker filtered for `.json` files
  - Validates the imported JSON against the `ProjectTheme` schema
  - Shows a preview of the theme before applying
  - "Apply" button replaces the current theme
  - "Cancel" discards the import
- [ ] **R6.4c** Add built-in theme presets:
  - At least 3 presets: "Default", "Dark", "Warm" (or similar)
  - Accessible from a "Presets" dropdown in the Theme Editor
  - Selecting a preset replaces the current theme (with confirmation)
- [ ] **R6.4d** Handle edge cases:
  - Invalid JSON: show error message
  - Missing fields: merge with defaults (don't crash)
  - Version mismatch: attempt migration or warn
  - Theme applied to wrong framework: show compatibility warning

### Acceptance Criteria
- Theme Editor is accessible from the toolbar
- Changing colors/fonts/spacing updates the canvas in real-time
- Theme variables are included in exported HTML/CSS
- Themes can be exported as `.hoarses-theme.json` files
- Imported themes are validated and previewed before applying
- Built-in presets provide quick starting points
- Theme data is saved with the project and restored on load
- No regressions in existing canvas rendering

---

## Execution Order

| Order | Phase | Agent | Est. Effort |
|-------|-------|-------|-------------|
| 1st | Phase R3 — Media Placeholders & Image File Picker | Claude Opus 4.6 | Medium |
| 2nd | Phase R4 — Page Picker & Save Project Fixes | GPT 5.2 High Thinking / Cascade | Large |
| 3rd | Phase R5 — Editor View Layout Customization | Kimi K2 | Medium |
| 4th | Phase R6 — Theme Editor, Import & Export | Claude Opus 4.6 | Large |

---

## Checklist Summary

### Phase R3 — Media Placeholders & Image File Picker *(Claude Opus 4.6)*
- [x] R3.1a — Update placeholder SVGs with "Image here" / "Icon here" text labels
- [x] R3.1b — Apply new placeholders to all relevant blocks in registerBlocks.ts
- [x] R3.1c — Verify placeholders visible in both themes
- [x] R3.1d — Do NOT touch video block
- [x] R3.2a — Add "Browse..." button to image URL field in Inspector
- [x] R3.2b — Add "Embed as Base64" toggle with conversion logic
- [x] R3.2c — Update API layer for file selection and base64 reading
- [x] R3.2d — Add image preview thumbnail in Inspector
- [x] R3.2e — Handle edge cases (large files, invalid files, cancel)

### Phase R4 — Page Picker & Save Project Fixes *(GPT 5.2 High Thinking / Cascade)*
- [x] R4.1a — Trace and diagnose page switching flow
- [x] R4.1b — Fix page switching (block tree swap, selection clear, history scope)
- [x] R4.1c — Improve page picker UX (active state, names, feedback)
- [x] R4.1d — Verify page CRUD operations work after fix
- [x] R4.2a — Debug save flow end-to-end
- [x] R4.2b — Fix save to collect complete project state
- [x] R4.2c — Add save feedback (toast, unsaved indicator)
- [x] R4.2d — Verify save/load round-trip with multiple pages

### Phase R5 — Editor View Layout Customization *(Kimi K2)*
- [x] R5.1 — Add `editorLayout` preference to store with persistence
- [x] R5.2 — Implement all 6 layout variants
- [x] R5.3 — Add layout switcher control to toolbar
- [x] R5.4 — Add keyboard shortcuts for layout switching
- [x] R5.5 — Ensure smooth transitions (no reload, no scroll loss)
- [x] R5.6 — Test all layouts in both themes

### Phase R6 — Theme Editor, Import & Export *(Claude Opus 4.6)*
- [x] R6.1a — Define `ProjectTheme` interface
- [x] R6.1b — Add theme to ProjectSettings with framework defaults
- [x] R6.1c — Add Zustand theme actions
- [x] R6.2a — Create ThemeEditor component (modal/panel)
- [x] R6.2b — Implement Colors section with live preview
- [x] R6.2c — Implement Typography section
- [x] R6.2d — Implement Spacing section
- [x] R6.2e — Implement Borders section
- [x] R6.2f — Implement Custom CSS section
- [x] R6.3a — Inject theme CSS variables into canvas iframe
- [x] R6.3b — Include theme in export pipeline
- [x] R6.4a — Theme export to .hoarses-theme.json
- [x] R6.4b — Theme import with validation and preview
- [x] R6.4c — Built-in theme presets (3+)
- [x] R6.4d — Handle import edge cases

---

## Notes

- **Phase R3** should go first because media placeholders affect first impressions and the file picker is foundational for asset workflows.
- **Phase R4** is critical — page switching and save are core functionality that must work reliably before adding new features.
- **Phase R5** is independent and can be done in parallel with R4 if desired, but is scheduled after for sequential execution.
- **Phase R6** is the largest phase and introduces a new subsystem. It should go last because it builds on a working save system (from R4).
- Gemini 3 Pro is excluded from this revision due to resource constraints.
- The theme system (R6) is about the **user's project theme**, not the editor's own dark/light UI theme.
