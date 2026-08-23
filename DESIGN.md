# Amagon Design System

## 1. Atmosphere & Identity

Amagon is a compact visual editor: dense, practical, and calm. The signature is a split-pane workshop with clear tokenized surfaces, small controls, and immediate canvas feedback rather than decorative chrome.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/base | `--color-bg-primary` | `#eff1f5` | `#1e1e2e` | Main app background |
| Surface/sidebar | `--color-bg-secondary` | `#e6e9ef` | `#181825` | Sidebar and inspector bodies |
| Surface/elevated | `--color-bg-surface` | `#dce0e8` | `#313244` | Headers, panels, inputs |
| Surface/hover | `--color-bg-hover` | `#bcc0cc` | `#45475a` | Hover state fills |
| Text/primary | `--color-text-primary` | `#4c4f69` | `#cdd6f4` | Main labels and content |
| Text/secondary | `--color-text-secondary` | `#6c6f85` | `#a6adc8` | Secondary labels and group titles |
| Text/muted | `--color-text-muted` | `#9ca0b0` | `#6c7086` | Disabled and helper text |
| Border/default | `--color-border` | `#ccd0da` | `#45475a` | Panel and control borders |
| Accent/default | `--color-accent` | `#1e66f5` | `#89b4fa` | Selected controls, focus, primary action |
| Accent/hover | `--color-accent-hover` | `#7287fd` | `#74c7ec` | Secondary accent hover |
| Status/danger | `--color-danger` | `#d20f39` | `#f38ba8` | Destructive actions |
| Status/success | `--color-success` | `#40a02b` | `#a6e3a1` | Success state |
| Status/warning | `--color-warning` | `#df8e1d` | `#fab387` | Warning state |

### Rules

- Use existing CSS variables before adding colors.
- Accent is for selection, focus, and primary action state.
- Exported page theme variables use `--theme-*`; editor UI uses `--color-*`.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Panel title | 14px | 600 | 1.3 | 0 | Inspector and toolbar headings |
| Control text | 13px | 400 | 1.4 | 0 | Inputs and selects |
| Field label | 12px | 400 | 1.4 | 0 | Inspector labels |
| Group title | 12px | 600 | 1.3 | 0.5px | Uppercase inspector groups |
| Micro label | 11px | 500 | 1.4 | 0 | Helper text and preset buttons |
| Tiny control | 10px | 600 | 1.2 | 0 | Mode toggles and badges |

### Font Stack

- Primary: `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif`
- Mono: `Fira Code, Cascadia Code, JetBrains Mono, Consolas, Courier New, monospace`

### Rules

- Inspector UI is compact and readable; do not use display-scale type inside panels.
- Monospace is reserved for IDs, code, and generated technical labels.

## 4. Spacing & Layout

### Base Unit

All spacing derives from 4px.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Field internals, small gaps |
| `--space-2` | 8px | Inline control gaps |
| `--space-3` | 12px | Group label spacing, compact padding |
| `--space-4` | 16px | Inspector panel padding |
| `--space-6` | 24px | Inspector group separation |

### Grid

- App shell: fixed toolbar plus resizable left, center, and right panels.
- Inspector controls: single-column fields, two-column rows only when labels remain readable.
- At phone widths, the Inspector overlays the canvas at a usable width instead of compressing controls into unreadable columns.
- Breakpoints follow the app shell rather than document-style section layout.

### Rules

- Controls use stable sizes and avoid layout shift between states.
- Cards are not nested in cards; inspector groups are unframed sections.

## 5. Components

### Inspector Group

- **Structure**: uppercase `h4` title, optional circular help marker, then a compact control stack.
- **Variants**: property group, style group, action group.
- **Spacing**: 12px title gap, 24px group separation, 16px panel padding.
- **States**: default, hover for help affordances, focused child controls.
- **Accessibility**: title names the group; tooltips are concise title text.
- **Motion**: color and border transitions only.
- **Layout**: vertical stack inside the right sidebar scroll owner.

### Preset Radio Grid

- **Structure**: label row, grid of label-wrapped radio inputs using visually hidden native inputs.
- **Variants**: entrance, hover, and action-effect presets.
- **Spacing**: 6px grid gap, 6px by 4px button padding.
- **States**: default, hover, active, focus via native radio, disabled/ineligible note.
- **Accessibility**: `radiogroup` with labelled native radios and arrow-key support.
- **Motion**: 200ms color/background/border transitions.
- **Layout**: four compact columns when space allows.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 120ms | `ease-out` | Hover and press feedback |
| Standard | 200ms | `ease-in-out` | Inspector control transitions |
| Entrance | 600ms | `ease-out` | Page-load entrance presets |

### Rules

- Hover effects are affordance feedback for interactive or media/content widgets, not decoration on every block.
- Action effects replay on pointer or keyboard activation for genuinely activatable widgets only. Presets use a short press, pop, pulse, or shake response inspired by beui.dev's spring-press button mechanism, adapted to CSS keyframes.
- The Inspector presents Entrance, Hover, and Action as subsections of one Animations group.
- Use CSS-only `transform`, `opacity`, `filter`, `box-shadow`, and color changes; never animate layout properties.
- Respect `(hover: hover) and (pointer: fine)` to avoid sticky hover on touch.
- Respect `prefers-reduced-motion: reduce` by disabling entrance, hover, and action transforms/filters while keeping stable final state.
- The toolbar offers System, Full, and Reduced motion previews for the editor canvas only; exported sites always retain the visitor-facing reduced-motion media query.

## 7. Depth & Surface

### Strategy

Mixed: editor structure uses borders and tonal shifts; exported hover effects may use modest shadow/glow when selected by the user.

| Level | Value | Usage |
|-------|-------|-------|
| Control border | `1px solid var(--color-border)` | Inputs, segmented controls |
| Compact radius | `4px` | Inspector buttons and fields |
| Medium radius | `6px` | Existing compact panels |
| Large radius | `8px` | Larger repeated items only |

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- WCAG target: 2.2 AA for editor UI.
- Every interactive Inspector control must be keyboard reachable.
- Reduced motion must be honored for entrance and hover effects.
- Hover-only effects must not be the only indicator of meaning.

### Accepted Debt

| Item | Location | Why accepted | Owner / Exit |
|------|----------|--------------|--------------|
| Full primitive showcase absent | Existing app | The project predates this design-system file; current work preserves established components and verifies in the running editor. | Add a focused showcase when shared primitives are extracted. |
