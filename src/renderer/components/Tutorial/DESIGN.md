# Tutorial System — Design Specification

> **Phase 1 output.** This document is the authoritative design for the onboarding tutorial feature. Phases 2–4
> implement from this spec.

---

## 1. Overview

The tutorial is a sequential, interactive overlay that walks new users through the editor's key UI areas. It uses a
spotlight mask to focus attention, a directional arrow to connect the spotlight to an info box, and a floating info box
for step content and navigation.

**Scope:** Pages tab, Widgets tab (drag to canvas), Canvas block selection, Inspector, Layers tab, Toolbar
viewport/undo-redo/layout/zoom, keyboard shortcuts hint. **Excluded:** AI tab, publishing.

---

## 2. Component Tree

```
App.tsx
└── TutorialOverlay          (rendered when tutorialStore.isActive === true)
    ├── SpotlightMask        (SVG full-screen overlay with cutout)
    ├── TutorialArrow        (CSS/SVG arrow pointing from info box to target)
    └── TutorialInfoBox      (floating card: title, body, nav, progress)

WelcomeTourDialog            (rendered once on first project load when !completed && enabled)
```

Supporting files:

```
src/renderer/components/Tutorial/
  DESIGN.md                  ← this file
  TutorialOverlay.tsx
  SpotlightMask.tsx
  TutorialArrow.tsx
  TutorialInfoBox.tsx
  WelcomeTourDialog.tsx
  tutorialSteps.ts
  Tutorial.css

src/renderer/store/
  tutorialStore.ts
```

---

## 3. TypeScript Interfaces

### 3.1 `TutorialStep`

```typescript
export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right'

export type TutorialActionType =
    | 'click'            // user must click the target element
    | 'drag-to-canvas'   // user must drag a widget onto the canvas
    | 'select-block'     // user must click a block in the canvas (editorStore.selectedBlockId changes)
    | 'change-viewport'  // user must click a viewport mode button
    | 'edit-property'    // user must change any inspector field
    | 'none'             // no user action required; Next button advances

export interface TutorialAction {
    type: TutorialActionType
    /** Optional: the specific value to detect (e.g. viewport mode 'tablet') */
    targetValue?: string
}

export interface TutorialStep {
    /** Unique identifier used for logging and action detection */
    id: string

    /**
     * CSS selector for the element to spotlight.
     * Prefer data-tutorial="<step-id>" attributes for stability.
     * Fallback to class/role selectors if the element is dynamic.
     * Use null for steps with no specific target (e.g. welcome/completion).
     */
    target: string | null

    /** Short headline shown in the info box */
    title: string

    /** Body copy (supports simple HTML: <b>, <code>, <br>) */
    body: string

    /**
     * Where the info box appears relative to the target element.
     * The overlay auto-flips if placement would overflow the viewport.
     */
    placement: TutorialPlacement

    /**
     * Extra space (px) between the target's bounding rect and the spotlight cutout.
     * Default: 8
     */
    spotlightPadding?: number

    /**
     * Direction the arrow points FROM the info box TOWARD the target.
     * Usually the same as placement (e.g. placement='right' → arrow points left toward target).
     */
    arrowDirection: TutorialPlacement | 'none'

    /** What the user must do to advance to the next step. */
    action: TutorialAction

    /**
     * If true, the step advances automatically when the action is detected.
     * If false (default), the detected action is confirmed by clicking Next.
     */
    autoAdvance: boolean

    /**
     * Called when this step becomes active.
     * Use to set up required UI state (e.g. switch sidebar tab, open a panel).
     * Receives the Zustand set function so it can dispatch store actions.
     */
    onEnter?: () => void

    /**
     * Called when this step is about to be left (Next/Back/Skip).
     * Use to clean up any temporary UI state.
     */
    onExit?: () => void
}
```

### 3.2 `TutorialOverlay` props

```typescript
export interface TutorialOverlayProps {
    /** Injected for testability; defaults to document.querySelector */
    queryElement?: (selector: string) => Element | null
}
```

The component reads all state from `useTutorialStore` — no step data passed as props.

### 3.3 `SpotlightMask` props

```typescript
export interface SpotlightMaskProps {
    /** Bounding rect of the spotlighted element, or null for full-screen dim (welcome/completion) */
    targetRect: DOMRect | null
    /** Extra padding around the target rect */
    padding?: number
    /** Border radius of the spotlight cutout (px). Default: 6 */
    borderRadius?: number
    /** Overlay fill opacity. Default: 0.65 */
    overlayOpacity?: number
}
```

### 3.4 `TutorialArrow` props

```typescript
export interface TutorialArrowProps {
    /** Direction the arrow points (from info box toward the target) */
    direction: TutorialPlacement | 'none'
}
```

### 3.5 `TutorialInfoBox` props

```typescript
export interface TutorialInfoBoxProps {
    step: TutorialStep
    currentIndex: number
    totalSteps: number
    onNext: () => void
    onBack: () => void
    onSkip: () => void
    /** Absolute position computed by TutorialOverlay */
    style: React.CSSProperties
}
```

---

## 4. `useTutorialStore` Zustand Store

### 4.1 State shape

```typescript
interface TutorialState {
    isActive: boolean
    currentStepIndex: number
    steps: TutorialStep[]
    /** Mirror of appSettingsStore.tutorialCompleted */
    hasCompletedTutorial: boolean
    /** Mirror of appSettingsStore.tutorialEnabled */
    isTutorialEnabled: boolean
}
```

### 4.2 Actions

```typescript
interface TutorialActions {
    /** Load steps array and begin at step 0. Also calls steps[0].onEnter() */
    startTutorial: (steps: TutorialStep[]) => void

    /** Advance to the next step (calls onExit on current, onEnter on next) */
    nextStep: () => void

    /** Go back one step (calls onExit on current, onEnter on previous) */
    prevStep: () => void

    /** Immediately close the tutorial without completing (marks nothing in settings) */
    skipTutorial: () => void

    /**
     * Called when the final step's action is confirmed.
     * Sets isActive=false, hasCompletedTutorial=true,
     * and persists via appSettingsStore.saveSettings({ tutorialCompleted: true }).
     */
    completeTutorial: () => void

    /** Sync isTutorialEnabled from appSettingsStore on load */
    setTutorialEnabled: (enabled: boolean) => void

    /** Sync hasCompletedTutorial from appSettingsStore on load */
    setTutorialCompleted: (completed: boolean) => void
}
```

### 4.3 Implementation notes

- Use `create<TutorialStore>()` following the pattern in `editorStore.ts` and `appSettingsStore.ts`.
- `startTutorial` is called with the pre-built `tutorialSteps` array from `tutorialSteps.ts`.
- `nextStep` / `prevStep` call `steps[currentStepIndex].onExit?.()` then `steps[newIndex].onEnter?.()`.
- When `currentStepIndex` reaches `steps.length - 1` and `nextStep()` is called, delegate to `completeTutorial()`.

---

## 5. App Settings Integration

### 5.1 Changes to `AppSettings` in `appSettingsStore.ts`

Add to the `AppSettings` interface:

```typescript
tutorialEnabled: boolean   // default: true
tutorialCompleted: boolean // default: false
```

Add to `DEFAULT_SETTINGS`:

```typescript
tutorialEnabled: true,
    tutorialCompleted
:
false,
```

Add dedicated actions (following the existing `setTheme` pattern):

```typescript
setTutorialEnabled: (enabled: boolean) => void
    setTutorialCompleted
:
(completed: boolean) => void
```

Both actions call `saveSettings({ tutorialEnabled })` / `saveSettings({ tutorialCompleted })` internally and sync state
to `tutorialStore` via `useTutorialStore.getState().setTutorialEnabled(...)`.

### 5.2 Settings UI — General Tab

In `SettingsDialog` → General tab, add below the existing layout controls:

```
┌──────────────────────────────────────────────────────────┐
│ Tutorial                                                 │
│  ☑ Show tutorial on startup                             │
│  [Restart Tutorial]   ← button, calls resetTutorial()   │
└──────────────────────────────────────────────────────────┘
```

`resetTutorial()` sets `tutorialCompleted = false` (persisted) so the welcome dialog reappears on next project load.

---

## 6. First-Time Detection Flow

```
App.tsx mounts
  └── useEffect watching isProjectLoaded (from projectStore)
        └── when isProjectLoaded transitions false → true:
              load appSettings if not yet loaded
              if tutorialEnabled && !tutorialCompleted:
                render <WelcomeTourDialog />
```

### `WelcomeTourDialog` options

| Button    | Label                 | Action                                                                                                       |
|-----------|-----------------------|--------------------------------------------------------------------------------------------------------------|
| Primary   | "Yes, show me around" | `tutorialStore.startTutorial(tutorialSteps)` → closes dialog                                                 |
| Secondary | "Skip for now"        | Closes dialog; does NOT set tutorialCompleted (dialog appears again next launch)                             |
| Tertiary  | "Don't show again"    | `appSettingsStore.setTutorialCompleted(true)` + `appSettingsStore.setTutorialEnabled(false)` → closes dialog |

Dialog is a standard modal (same visual style as existing modals). It is **not** the tutorial overlay — it renders
before the overlay is active.

---

## 7. Tutorial Step Sequence (13 Steps)

| #  | ID                   | Title              | Target selector                         | Placement | Action            | Auto-advance |
|----|----------------------|--------------------|-----------------------------------------|-----------|-------------------|--------------|
| 1  | `welcome`            | Welcome to Amagon! | `null`                                  | —         | `none`            | false        |
| 2  | `sidebar-pages`      | Pages panel        | `[data-tutorial="sidebar-tab-pages"]`   | `right`   | `none`            | false        |
| 3  | `sidebar-widgets`    | Widgets panel      | `[data-tutorial="sidebar-tab-widgets"]` | `right`   | `none`            | false        |
| 4  | `drag-widget`        | Drag a widget      | `[data-tutorial="widget-grid"]`         | `right`   | `drag-to-canvas`  | true         |
| 5  | `canvas-select`      | Select a block     | `[data-tutorial="canvas"]`              | `top`     | `select-block`    | true         |
| 6  | `inspector`          | Edit properties    | `[data-tutorial="inspector"]`           | `left`    | `edit-property`   | true         |
| 7  | `sidebar-layers`     | Layers panel       | `[data-tutorial="sidebar-tab-layers"]`  | `right`   | `none`            | false        |
| 8  | `toolbar-viewport`   | Viewport modes     | `[data-tutorial="toolbar-viewport"]`    | `bottom`  | `change-viewport` | true         |
| 9  | `toolbar-undo-redo`  | Undo / Redo        | `[data-tutorial="toolbar-undo-redo"]`   | `bottom`  | `none`            | false        |
| 10 | `toolbar-layout`     | Layout modes       | `[data-tutorial="toolbar-layout"]`      | `bottom`  | `none`            | false        |
| 11 | `toolbar-zoom`       | Zoom controls      | `[data-tutorial="toolbar-zoom"]`        | `bottom`  | `none`            | false        |
| 12 | `keyboard-shortcuts` | Keyboard shortcuts | `null`                                  | —         | `none`            | false        |
| 13 | `completion`         | You're all set!    | `null`                                  | —         | `none`            | false        |

### Step content details

**Step 1 — Welcome** (`welcome`)

- Title: "Welcome to Amagon!"
- Body: "Let's take a quick tour of the editor. It takes about 2 minutes. You can skip at any time."
- No spotlight target; dim entire screen. Show "Let's go →" (Next) button only (no Back).

**Step 2 — Pages** (`sidebar-pages`)

- onEnter: switch sidebar to `pages` tab (`setActiveTab('pages')`)
- Title: "Pages"
- Body: "Manage your site's pages here. Create new pages, organize them into folders, and switch between them."

**Step 3 — Widgets** (`sidebar-widgets`)

- onEnter: switch sidebar to `widgets` tab
- Title: "Widgets"
- Body: "Browse all available building blocks. Drag any widget onto the canvas to add it to your page."

**Step 4 — Drag a widget** (`drag-widget`)

- Spotlight: the widget grid area (`[data-tutorial="widget-grid"]`)
- Title: "Drag a widget to the canvas"
- Body: "Try it now — grab any widget and drop it onto the canvas on the right."
- Arrow points right (toward canvas)
- autoAdvance: true (detects new block added to editorStore.blocks)

**Step 5 — Select a block** (`canvas-select`)

- Spotlight: canvas container
- Title: "Select a block"
- Body: "Click any block on the canvas to select it. The block will be highlighted with a blue outline."
- autoAdvance: true (detects editorStore.selectedBlockId becoming non-null)

**Step 6 — Inspector** (`inspector`)

- onEnter: ensure right panel (inspector) is open
- Title: "Edit properties"
- Body: "The Inspector shows all properties for the selected block. Change text, colors, spacing, and more."
- autoAdvance: true (detects any block property update via editorStore)

**Step 7 — Layers** (`sidebar-layers`)

- onEnter: switch sidebar to `layers` tab
- Title: "Layers panel"
- Body: "The Layers panel shows a tree of all blocks on the page. Use it to select, reorder, and nest blocks."

**Step 8 — Viewport modes** (`toolbar-viewport`)

- Title: "Responsive preview"
- Body: "Switch between Desktop, Tablet, and Mobile views to check how your page looks at each breakpoint."
- autoAdvance: true (detects editorStore.viewportMode change away from 'desktop')

**Step 9 — Undo / Redo** (`toolbar-undo-redo`)

- Title: "Undo and Redo"
- Body: "Made a mistake? Use <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd> or these buttons to step through your history."

**Step 10 — Layout modes** (`toolbar-layout`)

- Title: "Layout modes"
- Body: "Toggle the sidebar and inspector panels, or enter focus mode. Choose the layout that fits your workflow."

**Step 11 — Zoom** (`toolbar-zoom`)

- Title: "Zoom controls"
- Body: "Use the zoom controls to get a closer look at your design, or zoom out to see the full page."

**Step 12 — Keyboard shortcuts** (`keyboard-shortcuts`)

- No spotlight target; info box centered on screen.
- Title: "Keyboard shortcuts"
- Body: "Press <kbd>?</kbd> or click the <strong>Help</strong> menu to view all keyboard shortcuts."

**Step 13 — Completion** (`completion`)

- No spotlight; celebratory state.
- Title: "You're all set!"
- Body: "That's the tour. Explore Amagon and build something great. You can restart this tutorial any time from
  Settings → General."
- Shows "Explore on your own →" button (calls `completeTutorial()` instead of `nextStep()`).
- Simple CSS confetti animation (keyframe, 1.5s, 6–8 colored dots falling from top of info box).

---

## 8. Visual Design Specification

### 8.1 Spotlight overlay — CSS approach

Use an **SVG full-screen overlay** with a `<clipPath>` containing a rounded-rect cutout. The SVG fills
`position: fixed; inset: 0; z-index: 10000; pointer-events: all`.

```
<svg width="100vw" height="100vh">
  <defs>
    <clipPath id="tutorial-spotlight-clip" clipPathUnits="userSpaceOnUse">
      <!-- Full screen rect -->
      <rect x="0" y="0" width="100%" height="100%" />
      <!-- Spotlight cutout (subtracted via even-odd fill rule) -->
      <rect x={x} y={y} width={w} height={h} rx="6" ry="6" />
    </clipPath>
  </defs>
  <rect
    x="0" y="0" width="100%" height="100%"
    fill="rgba(0,0,0,0.65)"
    clipPath="url(#tutorial-spotlight-clip)"
    fillRule="evenodd"
  />
</svg>
```

The cutout rect dimensions come from `target.getBoundingClientRect()` plus `spotlightPadding` (default 8px) on all
sides.

**Why SVG over CSS clip-path:** SVG `clipPath` with `evenodd` fill rule is the most reliable cross-browser approach for
a rectangular "hole" in an overlay. CSS `clip-path: path()` is supported but less readable. The SVG approach also allows
smooth CSS transitions on the `x/y/width/height` attributes via CSS animation.

**Transition:** CSS `transition: x 300ms ease, y 300ms ease, width 300ms ease, height 300ms ease` on the cutout
`<rect>`. This animates the spotlight sliding from one target to another.

**Pointer events:** The SVG overlay has `pointer-events: all` to block clicks on non-spotlighted areas. The target
element itself must receive clicks — achieved by absolutely positioning a transparent passthrough `<div>` matching the
spotlight rect with `pointer-events: all; z-index: 10001`.

### 8.2 Info box

The info box is a `position: fixed` card (`z-index: 10003`). Position is calculated by `TutorialOverlay` using the
target element's `getBoundingClientRect()` plus `placement`:

| Placement | Info box anchor                                                   | Arrow        |
|-----------|-------------------------------------------------------------------|--------------|
| `right`   | `left: targetRect.right + arrowOffset + gap`                      | Points left  |
| `left`    | `right: window.innerWidth - targetRect.left + arrowOffset + gap`  | Points right |
| `bottom`  | `top: targetRect.bottom + arrowOffset + gap`                      | Points up    |
| `top`     | `bottom: window.innerHeight - targetRect.top + arrowOffset + gap` | Points down  |

`gap` = 16px. `arrowOffset` = 12px (half arrow height/width).

**Viewport overflow correction:** After calculating position, clamp `left` to
`[12, window.innerWidth - infoBoxWidth - 12]` and `top` to `[12, window.innerHeight - infoBoxHeight - 12]`.

**Info box dimensions:** `width: 320px; min-height: 140px`.

Info box structure:

```
┌──────────────────────────────────────────────┐
│  Step title (h3)                             │
│  Body text (p)                               │
│                                              │
│  ● ● ● ○ ○ ○ ○   [Back] [Next →] [Skip]    │
│  progress dots   navigation buttons          │
└──────────────────────────────────────────────┘
```

Progress indicator: row of small dots (6px circle), filled for completed steps, outlined for future, solid accent color
for current.

### 8.3 Arrow

A 12×12px CSS triangle (border trick) or an SVG arrowhead rendered next to the info box edge facing the target. Class
`.tutorial-arrow-left`, `.tutorial-arrow-right`, `.tutorial-arrow-top`, `.tutorial-arrow-bottom`. Arrow color matches
info box background.

### 8.4 Z-index strategy

Existing high z-indices in the codebase (verified by audit):

- `ContextMenu.css`, `PageModal.css`, `DragOverlayManager.css` → **9999**
- `AiProposalReviewPanel.css` → 20000 (AI only, not active during tutorial)
- `AboutAmagon.css` → 100000 (dialog, not active during tutorial)

The tutorial overlay must sit **above** context menus and drag overlays:

| Layer                                 | Z-index |
|---------------------------------------|---------|
| Normal app UI                         | 1–1100  |
| ContextMenu / PageModal / DragOverlay | 9999    |
| SVG spotlight overlay                 | 10000   |
| Tutorial spotlight passthrough div    | 10001   |
| Tutorial arrow                        | 10002   |
| Tutorial info box                     | 10003   |
| WelcomeTourDialog                     | 10004   |

### 8.5 Animations

| Event                         | Animation                                                                                                                                             |
|-------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| Overlay appears               | `tutorial-overlay-enter`: fade-in `opacity 0→1` over 250ms                                                                                            |
| Overlay exits                 | `tutorial-overlay-exit`: fade-out `opacity 1→0` over 200ms                                                                                            |
| Spotlight moves to new target | CSS transition `x/y/width/height 300ms ease` on SVG rect                                                                                              |
| Info box step change          | `tutorial-infobox-enter`: `opacity 0→1 + translateY(8px→0)` over 200ms                                                                                |
| Completion confetti           | `tutorial-confetti-fall`: keyframe translating 6–8 small colored dots from `top:-10px` to `top:60px` with varying delays (0–0.8s), 1.5s ease-in, once |

### 8.6 Dark mode

The tutorial overlay and info box use CSS variables so they respond to the `.dark` class on `document.body`:

```text
.tutorial-info-box {
  background: var(--tutorial-bg, #ffffff);
  color: var(--tutorial-fg, #111827);
  border: 1px solid var(--tutorial-border, #e5e7eb);
}

.dark .tutorial-info-box {
  --tutorial-bg: #1e1e2e;
  --tutorial-fg: #e2e8f0;
  --tutorial-border: #374151;
}
```

The SVG overlay fill (`rgba(0,0,0,0.65)`) works in both themes.

---

## 9. `data-tutorial` Attribute Map

Attributes to add in Phase 4. Listed here for reference during implementation of earlier phases.

| Selector                                | Placed on                                   | Phase that adds it |
|-----------------------------------------|---------------------------------------------|--------------------|
| `[data-tutorial="sidebar-tab-pages"]`   | Pages tab div in `Sidebar.tsx`              | 4                  |
| `[data-tutorial="sidebar-tab-widgets"]` | Widgets tab div                             | 4                  |
| `[data-tutorial="sidebar-tab-layers"]`  | Layers tab div                              | 4                  |
| `[data-tutorial="widget-grid"]`         | Widget grid container div                   | 4                  |
| `[data-tutorial="canvas"]`              | Canvas root container in `Canvas.tsx`       | 4                  |
| `[data-tutorial="inspector"]`           | Inspector root container in `Inspector.tsx` | 4                  |
| `[data-tutorial="toolbar-viewport"]`    | Viewport button group in `Toolbar.tsx`      | 4                  |
| `[data-tutorial="toolbar-undo-redo"]`   | Undo/Redo button group                      | 4                  |
| `[data-tutorial="toolbar-layout"]`      | Layout mode button group                    | 4                  |
| `[data-tutorial="toolbar-zoom"]`        | Zoom control group                          | 4                  |

---

## 10. Action Detection Design

Action detection runs as a Zustand subscription inside `tutorialStore`. When a step with a non-`none` action becomes
active, `startTutorial`/`nextStep` sets up the relevant subscription; `onExit` tears it down.

| Action type       | Detection mechanism                                                                                                          |
|-------------------|------------------------------------------------------------------------------------------------------------------------------|
| `drag-to-canvas`  | Subscribe to `editorStore.blocks` length; advance when `blocks.length` increases                                             |
| `select-block`    | Subscribe to `editorStore.selectedBlockId`; advance when it becomes non-null                                                 |
| `change-viewport` | Subscribe to `editorStore.viewportMode`; advance when it changes from `'desktop'`                                            |
| `edit-property`   | Subscribe to `editorStore.blocks` deep identity; advance on any block prop change (use a shallow hash or generation counter) |
| `click`           | Add a one-time click listener to the target element during `onEnter`, remove in `onExit`                                     |
| `none`            | No subscription; Next button always available                                                                                |

Implementation: use `editorStore.subscribe(selector, callback)` (Zustand selector subscriptions) rather than `useEffect`
to keep detection logic out of React render cycle.

---

## 11. Integration in `App.tsx`

Two additions:

```tsx
// 1. First-time detection
const isProjectLoaded = useProjectStore((s) => s.isProjectLoaded)
const tutorialEnabled = useAppSettingsStore((s) => s.tutorialEnabled)
const tutorialCompleted = useAppSettingsStore((s) => s.tutorialCompleted)
const [showWelcomeTour, setShowWelcomeTour] = useState(false)

useEffect(() => {
    if (isProjectLoaded && tutorialEnabled && !tutorialCompleted) {
        setShowWelcomeTour(true)
    }
}, [isProjectLoaded])

// 2. Overlay rendering
const isTutorialActive = useTutorialStore((s) => s.isActive)

// In JSX:
{
    showWelcomeTour && <WelcomeTourDialog onClose={() => setShowWelcomeTour(false)}/>
}
{
    isTutorialActive && <TutorialOverlay/>
}
```

`WelcomeTourDialog` closes itself by calling `onClose`. The dialog's "Yes" button also calls
`tutorialStore.startTutorial(tutorialSteps)`, which sets `isActive = true` and renders `TutorialOverlay`.

---

## 12. Responsive & Edge-Case Considerations

| Scenario                       | Handling                                                                                                    |
|--------------------------------|-------------------------------------------------------------------------------------------------------------|
| Target element not in DOM      | Skip step automatically (log warning); call `nextStep()`                                                    |
| Target scrolled out of view    | Call `target.scrollIntoView({ behavior: 'smooth', block: 'center' })` in `onEnter`                          |
| Window resize                  | `TutorialOverlay` listens to `window.resize` and recalculates `getBoundingClientRect()`                     |
| Sidebar toggle during tutorial | Subscribe to `editorStore.editorLayout` changes; recalculate positions                                      |
| Canvas is an iframe            | Spotlight only around the iframe's `getBoundingClientRect()` — do not attempt to pierce the iframe boundary |
| Info box overflow              | Clamp position (Section 8.2); auto-flip `placement` if clamped position would obscure the target            |
| Step on completion             | No spotlight; info box centered at `50vw / 50vh`                                                            |

---

## 13. Validation Checklist

- [ ] All interfaces compile with `npx tsc --noEmit`
- [ ] Target selectors in step table match elements present in the current codebase (verified by grep)
- [ ] No AI tab or publishing references in step sequence
- [ ] `data-tutorial` attribute map covers all 13 step targets
- [ ] Action detection covers all 5 interactive step types
- [ ] CSS z-index strategy doesn't conflict with existing modal z-indices
- [ ] Dark mode CSS variables cover all tutorial surfaces
