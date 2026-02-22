# Hoarses — Revision 1: Visual Polish & Usability Fixes

> **Scope:** Fix 6 UX issues discovered during testing
> **Stack:** Electron + Vite + React + TypeScript + Zustand + Monaco Editor + dnd-kit
> **Reference:** See `plan.md` for original implementation plan

---

## How to Use This Plan

Same workflow as `plan.md`:

1. Switch to the assigned agent in Windsurf's model selector
2. Tell the agent: **"Execute Phase RN of revision1.md"** (where N is the phase number)
3. The agent should read `revision1.md` and relevant source files for context
4. Check off completed tasks as you go (`[ ]` → `[x]`)

### Agent Assignment Rationale

| Agent | Strengths | Assigned Phases |
|---|---|---|
| **Gemini 3 Pro** | UI/UX components, CSS theming, widget library, broad styling fixes | R1 (CSS fixes, defaults, block tree) |
| **GPT 5.2 High Thinking** | Canvas engine, iframe runtime, coordinate math, overlay rendering | R2 (Canvas layout indicators) |

---

## Phase R1 — UI Fixes, Default Content & Block Tree Panel

**Agent: Gemini 3 Pro**
**Goal:** Fix CSS variable mismatches, add offline-safe media placeholders, provide default content for invisible blocks, fix light-mode contrast, and add a block tree/layers panel.

### Context for Agent

> Multiple components use CSS variable names that don't match `global.css` definitions. For example, `Inspector.css` and `BlockActions.css` use `--border-color`, `--bg-primary`, `--bg-secondary`, `--text-primary`, `--accent-color`, etc., but `global.css` defines them with a `color-` prefix: `--color-border`, `--color-bg-primary`, etc. This causes styles to silently fail (no borders, no backgrounds).
>
> Additionally, the app is **fully offline** when packaged — any `https://via.placeholder.com/` URLs will not load. Placeholders must be base64 data URIs or inline SVGs.

### Bug 1: Inspector input boxes have no visible border (CSS variable mismatch)

**Files to inspect:**
- `src/renderer/styles/global.css` — defines `--color-border`, `--color-bg-primary`, etc.
- `src/renderer/components/Inspector/Inspector.css` — uses `--border-color` (WRONG)
- `src/renderer/components/Inspector/BlockActions.css` — uses `--border-color`, `--bg-primary`, `--bg-secondary`, `--text-primary`, `--accent-color` (ALL WRONG)

**Root cause:** CSS variable name mismatch. `global.css` defines `--color-*` but components reference unprefixed names.

**Tasks:**
- [x] **R1.1a** Audit all `.css` files in `src/renderer/components/` for CSS variables that don't start with `--color-`. Create a mapping of incorrect → correct variable names.
- [x] **R1.1b** Fix all mismatched CSS variable references across the project. Key mappings:
  - `--border-color` → `--color-border`
  - `--bg-primary` → `--color-bg-primary`
  - `--bg-secondary` → `--color-bg-secondary`
  - `--bg-tertiary` → `--color-bg-surface`
  - `--text-primary` → `--color-text-primary`
  - `--text-secondary` → `--color-text-secondary`
  - `--accent-color` → `--color-accent`
  - `--accent-color-rgb` → needs to be defined or replaced
- [x] **R1.1c** Verify inputs, selects, and buttons render with visible borders in both dark and light themes.

### Bug 2: "Save as Custom Block" button has white text on light mode

**File:** `src/renderer/components/Inspector/BlockActions.css`

**Root cause:** `.primary-action-btn` hardcodes `color: white` and uses `--accent-color` for background. On light theme, `--color-accent` is `#1e66f5` (dark blue), so white text is actually fine IF the variable resolved. The real issue is likely that `--accent-color` is undefined (see Bug 1), so the button has no background → white text on white-ish background.

**Tasks:**
- [x] **R1.2a** Fix the CSS variable reference (covered by R1.1b).
- [x] **R1.2b** Ensure `.primary-action-btn` has sufficient contrast in both themes. Consider using `--color-text-primary` for non-accent buttons and keeping `color: white` only for buttons with a dark accent background.

### Bug 3: Media blocks have no offline-safe placeholders

**File:** `src/renderer/registry/registerBlocks.ts`

**Root cause:** Image blocks use `https://via.placeholder.com/900x300` as default `src`. This requires internet. The app is offline when built.

**Tasks:**
- [x] **R1.3a** Create a utility file `src/renderer/utils/placeholders.ts` that exports base64-encoded SVG data URIs for:
  - `IMAGE_PLACEHOLDER` — A grey rectangle with "Image" text (e.g. 900×300)
  - `ICON_PLACEHOLDER` — A small star/icon SVG (e.g. 48×48)
  - Keep them minimal (inline SVG → base64) so they don't bloat the bundle.
- [x] **R1.3b** Update `registerBlocks.ts` to use these placeholders as default `src` for:
  - `image` block
  - Any composite blocks that include images (cards, heroes, etc.)
- [x] **R1.3c** For the `icon` block, ensure it renders a visible placeholder even if Bootstrap Icons CSS isn't loaded. Add a fallback inline SVG or text character.
- [x] **R1.3d** Do NOT touch the `video` block — leave it as-is.

### Bug 4: Blockquote and Code Block are invisible until content is edited

**File:** `src/renderer/registry/registerBlocks.ts` and `src/renderer/utils/blockToHtml.ts`

**Root cause:** `blockquote` and `code-block` are registered without `defaultProps`, so when a user drags them onto the canvas, `props.text` and `props.code` are `undefined`. `getBlockContent()` in `blockToHtml.ts` returns an empty string for these, making them render as empty `<blockquote></blockquote>` or `<pre><code></code></pre>` — invisible.

**Tasks:**
- [x] **R1.4a** Add `defaultProps` to the `blockquote` registration:
  ```ts
  defaultProps: {
    text: 'A well-known quote, contained in a blockquote element.',
    footer: 'Someone famous'
  }
  ```
- [x] **R1.4b** Add `defaultProps` to the `code-block` registration:
  ```ts
  defaultProps: {
    code: 'console.log("Hello world");'
  }
  ```
- [x] **R1.4c** Verify both blocks render visible content immediately when dropped onto the canvas.

### Feature: Block Tree / Layers Panel

**Goal:** Users currently have no way to see what components are nested inside a layout container. Add a tree view panel that shows the block hierarchy.

**Files to create/modify:**
- Create `src/renderer/components/BlockTree/BlockTree.tsx` — Tree view component
- Create `src/renderer/components/BlockTree/BlockTree.css` — Styling
- Modify `src/renderer/components/Sidebar/Sidebar.tsx` — Add a tab/section for the tree view

**Tasks:**
- [x] **R1.5a** Create `BlockTree.tsx` component that:
  - Reads `blocks` from `useEditorStore`
  - Renders a recursive tree with indentation showing nesting depth
  - Shows block type + label (e.g. "▢ Container", "H Heading", "P Paragraph")
  - Highlights the currently selected block
  - Highlights hovered block on mouse over
  - Clicking a tree node selects that block (calls `selectBlock`)
  - Hovering a tree node highlights it in the canvas (calls `hoverBlock`)
  - Collapsible nodes for containers with children
- [x] **R1.5b** Create `BlockTree.css` with appropriate styling:
  - Tree lines/indentation guides
  - Selected/hovered state colors using existing CSS variables
  - Compact layout (12-13px font, 24px row height)
- [x] **R1.5c** Integrate into `Sidebar.tsx`:
  - Add a tab or collapsible section labeled "Layers" or "Structure"
  - Show it alongside or switchable with the block library
- [x] **R1.5d** Test with deeply nested layouts (3+ levels) to ensure it's usable.

### Acceptance Criteria
- All inspector inputs/selects have visible borders in both themes
- "Save as Custom Block" button text is readable in light mode
- Dropping an image block shows a placeholder (no broken image icon)
- Dropping a blockquote or code-block shows default content immediately
- Block tree panel shows the full hierarchy with correct nesting
- Clicking tree nodes selects blocks in the canvas
- No regressions in dark theme

---

## Phase R2 — Canvas Layout Indicators

**Agent: GPT 5.2 High Thinking**
**Goal:** Make layout containers (container, row, column, section, header, footer, article, aside) visually distinguishable in the editor canvas by showing subtle borders/outlines that indicate nesting depth.

### Context for Agent

> The canvas renders blocks inside an iframe via `src/preview/runtime.ts`. Currently, empty containers are invisible — they have no visible boundaries. Users can't tell where a container starts/ends or how deeply nested a block is.
>
> This should be an **editor-only** visual aid. The exported HTML must remain clean (no indicator styles). The runtime already injects editor CSS and overlays for selection/hover.
>
> Key files:
> - `src/preview/runtime.ts` — Injected into the canvas iframe, handles overlays, selection, drag
> - `src/renderer/utils/blockToHtml.ts` — Generates HTML with optional `data-block-id` attributes in editor mode
> - `src/renderer/components/Canvas/Canvas.tsx` — Manages the iframe and postMessage communication

### Tasks:

- [x] **R2.1** In `runtime.ts`, add an editor-mode stylesheet that applies to all blocks with `data-block-id` whose tag is a layout container (`div`, `section`, `header`, `footer`, `article`, `aside`, `nav`):
  - Subtle dashed border (e.g. `1px dashed rgba(128, 128, 255, 0.3)`)
  - Minimal padding (e.g. `min-height: 40px; padding: 8px`) so empty containers are clickable/visible
  - Nesting depth indication via increasing border opacity or alternating border colors
  - A small floating label in the top-left corner showing the block type (e.g. "container", "row", "col") using `::before` pseudo-element with `content: attr(data-block-type)` or similar
- [x] **R2.2** Modify `blockToHtml.ts` to include a `data-block-type` attribute when `includeDataAttributes` is true, so the CSS can use `attr()` or type-based selectors.
- [x] **R2.3** Ensure the layout indicators do NOT appear in exported HTML (only when `includeDataAttributes` is true).
- [x] **R2.4** Add a toggle in the toolbar or canvas controls to show/hide layout outlines (for users who find them distracting). Store the preference in `useEditorStore` (e.g. `showLayoutOutlines: boolean`).
- [x] **R2.5** Test with:
  - Empty container (should be visible and clickable)
  - Container > Row > Column > Paragraph (3-level nesting should show depth)
  - Columns side by side (should show column boundaries)
  - Exported HTML should have zero trace of indicator styles

### Acceptance Criteria
- Empty layout containers are visible and clickable in the canvas
- Nesting depth is visually distinguishable (at least 3 levels)
- Block type labels appear on containers in the canvas
- Outlines can be toggled on/off
- Exported HTML is clean — no indicator artifacts
- No visual regression on non-layout blocks

---

## Execution Order

| Order | Phase | Agent | Est. Effort |
|-------|-------|-------|-------------|
| 1st | Phase R1 — UI Fixes, Defaults & Block Tree | Gemini 3 Pro | Large |
| 2nd | Phase R2 — Canvas Layout Indicators | GPT 5.2 High | Medium |

---

## Notes

- Phase R1 should be done first because the CSS variable fixes affect the entire UI and are foundational.
- Phase R2 depends on `data-block-type` attribute from R2.2 but is otherwise independent.
- The CSS variable mismatch (Bug 1) is the root cause of multiple visual issues — fixing it may resolve more problems than listed.
