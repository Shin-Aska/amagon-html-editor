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
| Welcome title | 32px | 700 | 1.1 | -0.5px | Product name on the launcher |
| Welcome promise | 15px | 400 | 1.5 | 0 | Capability-specific launcher copy |
| Panel title | 14px | 600 | 1.3 | 0 | Inspector and toolbar headings |
| Control text | 13px | 400 | 1.4 | 0 | Inputs and selects |
| Field label | 12px | 400 | 1.4 | 0 | Inspector labels |
| Group title | 12px | 600 | 1.3 | 0.5px | Uppercase inspector groups |
| Micro label | 11px | 500 | 1.4 | 0 | Helper text and preset buttons |
| Tiny control | 10px | 600 | 1.2 | 0 | Mode toggles and badges |
| Beacon code | 9px | 500 | 1.2 | 0 | Decorative code strip and live state |
| Beacon annotation | 8px | 700 | 1.2 | 0 | Decorative selection and inspector labels |

CSS type primitives: `--font-size-tiny`, `--welcome-beacon-code-size`, and `--welcome-beacon-label-size` expose the 10px, 9px, and 8px launcher levels to components.

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
| `--space-5` | 20px | Welcome card rhythm and comfortable control gaps |
| `--space-6` | 24px | Inspector group separation |
| `--space-7` | 28px | Welcome section separation |
| `--space-8` | 32px | Welcome card padding and desktop grid gap |

### Welcome Geometry Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--welcome-max-width` | 960px | Desktop launcher card |
| `--welcome-compact-max-width` | 868px | 900px Electron window launcher card |
| `--welcome-beacon-min-width` | 340px | Desktop Beacon column |
| `--welcome-beacon-compact-width` | 320px | Compact Beacon column |
| `--welcome-brand-max-width` | 420px | Product promise line length |
| `--welcome-body-height` | 252px | Desktop action/recent row |
| `--welcome-body-compact-height` | 232px | Compact action/recent row |
| `--welcome-action-step` | 16px | Compact horizontal rise between successive launcher actions |
| `--welcome-action-width-trim` | 32px | Keeps the three cascaded actions equal-width inside the left column |
| `--welcome-action-start` | 0px | Anchors New Project to the left-column edge |
| `--welcome-beacon-rail-width` | 32px | Beacon block rail |
| `--welcome-beacon-inspector-width` | 84px | Beacon inspector |
| `--welcome-beacon-workspace-height` | 132px | Desktop Beacon workspace |
| `--welcome-beacon-workspace-compact-height` | 108px | Compact Beacon workspace |
| `--welcome-beacon-page-height` | 84px | Desktop Beacon page |
| `--welcome-beacon-page-compact-height` | 64px | Compact Beacon page |

### Grid

- App shell: fixed toolbar plus resizable left, center, and right panels.
- Inspector controls: single-column fields, two-column rows only when labels remain readable.
- Welcome launcher: the header and body share one two-column grid so the Workbench Beacon and Recent Projects panel form a strict vertical edge. The three equal-size actions form a controlled 16px cascade from the left-column edge; hierarchy comes from surface weight rather than exaggerated displacement. Below 980px or 720px height, tighten the Beacon and grid gap without clipping either column.
- At phone widths, the Inspector overlays the canvas at a usable width instead of compressing controls into unreadable columns.
- Breakpoints follow the app shell rather than document-style section layout.

### Rules

- Controls use stable sizes and avoid layout shift between states.
- Cards are not nested in cards; inspector groups are unframed sections.

## 5. Components

### Pages and Widgets Library (1.9.2)

- Approved references: `exec-2028e82c-c899-4e7b-819b-94ad430cf810.png` (Widgets) and `exec-01c6b9bf-78b8-46c4-9bed-04e349f040ca.png` (Pages), generated September 12, 2026. Preserve the existing editor shell; reference page content is illustrative, not seeded project data.
- App Settings → General contains the “Preview mode” select with “Live” and “Classic” options for both pages and widgets. Live is the default; the preference persists with application settings, across projects. The sidebar has no mode control, preview-status text, or resource-use footer text.
- Live widget tiles use a two-column grid with real rendered component samples, a bordered thumbnail, and a separate name below. Live page cards use one column with a rendered page viewport above a caption containing name, slug, tags, and an accessible menu button. Classic retains compact widget icons and page rows.
- Local `--library-*` tokens define geometry: widget preview aspect ratio 2 / 1, page preview aspect ratio 2 / 1, 28px mode controls, 12px grid gaps, 4px preview radius, and 11px widget captions / 13px page names. Reuse `--space-*`, `--radius-*`, and `--color-*` for spacing, corners, color, and focus. Match the current project theme inside previews; editor controls retain the application theme.
- Previews are passive, isolated HTML frames, rendered by the existing block renderer. Names and actions stay outside the frames and remain keyboard accessible. Empty layout widgets use sample children or dashed boundaries to show their structure. Saved blocks and templates show their actual content.
- The sidebar owns library scrolling; page creation actions stay pinned. Thumbnails scale with the resizable panel, with a 240px minimum sidebar width to keep two-column samples legible on compact desktops. Long names truncate with full titles available; tags wrap within the caption. Selection uses an accent border with a quiet surface rather than filling the screenshot.
- Only viewed previews render. App Settings → General has “Preview cache slots”, default 64; 0 disables retention. Keep recently viewed rendered frames in RAM with least-recently-used eviction, shared between Pages and Widgets. Visible frames stay usable even below the visible count; evicted active frames release when hidden. Classic and project close/switch clear the cache. Cache contents last for the project session; the slot-count preference persists across restarts. No cache-status footer in the sidebar.
- Reuse cached documents without navigation when their content and styling are unchanged. Edits coalesce over 150ms; stale cached previews refresh when shown, while visible previews update live. No autoplay, embedded third-party frames, project scripts, or editor-selection overlays run in thumbnails. No decorative preview animation.
- Validate current-page edits, nested-tab edits, theme and custom CSS updates, search, page switching, folders/reordering, saved blocks/templates, persistence, and complete frame teardown in Classic. Test the running desktop editor at normal and compact sizes plus resized sidebar widths.

### Settings Workspace

- Theme Editor and App Settings share a fixed frame: 960px maximum width, 848px maximum height, and 24px viewport clearance. Header, navigation, scope label, and footer never resize when sections change; only the content pane scrolls, retaining each section's scroll position while open.
- Use the approved settings-workspace concept's sidebar, blue selection rail, outline icons, quiet dividers, and grouped fields, expressed with the existing `--color-*` and `--space-*` tokens. Desktop sidebar is 184px; body padding is 32px. Below 700px, use a horizontal navigation strip and 16px body padding; below 480px, stack fields and control rows.
- The shared stylesheet owns local `--settings-*` type, frame/control geometry, divider, focus, selection-rail, and shadow tokens; routine spacing and corner radii reuse the application tokens. Custom CSS stacks its file list above its editor below 820px. Font dropdowns keep keyboard focus within the popup until a choice or Escape, then restore focus to their trigger.
- Header identifies scope: “Theme Editor / Website theme · [project]” versus “App Settings / Applies across projects”. Sidebar scope is “Saved with this project” versus “This application”. Done closes the live editor; it does not claim the project was saved to disk.
- Theme sections: Presets, Colors, Typography, Spacing, Borders, Custom CSS. Editing target remains distinct from Page preview. Group all existing colors into Brand, Page, and Feedback; retain Secondary, Success, Warning, and Danger even though the concept omits them. Keep Reset rather than introducing a nonfunctional Undo action.
- App sections retain General, Credentials, AI Assistant, and Media Search, including credential deep links and immediate persistence. Density, app-wide reduced motion, text size, storage, and about controls in the concept are illustrative, not new functionality in this layout pass.
- Native buttons expose selected state; the dialog has an accessible name, initial focus, keyboard focus containment, and focus restoration. Existing nested dialogs and portalled font/color pickers remain operable. No content-size animation or decorative background from the concept board is used.

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

### Welcome Workbench Beacon

- **Structure**: a miniature block rail, canvas, inspector, and code strip that mirrors the editor's real split-pane workflow.
- **Variants**: one compact launcher variant; it may reduce detail at short window heights but must remain recognizable.
- **Spacing**: 8px internal gaps on a 4px grid; one strong selected block, no nested card stack.
- **States**: continuously animated ambient composition with drifting grid, floating aurora, pulsing grid glow and dot fields, a periodic scanline sweep, and one controlled Beacon selection pulse.
- **Accessibility**: decorative and `aria-hidden`; the adjacent product promise carries the meaning in text.
- **Motion**: ambient layers use slow, independently phased transform and opacity loops inspired by beui.dev's shader-background freeze mechanism; `prefers-reduced-motion: reduce` is the sole switch that freezes every continuous launcher effect into its stable resting state.
- **Layout**: paired with the brand promise on desktop and locked to the same right-column edge as Recent Projects; compressed in place at compact Electron sizes.

### Welcome Action Group

- **Structure**: New Project, Open Project, and Settings actions followed by the recent-project list.
- **Variants**: primary creation action, secondary open action, quiet utility action, and recent-project row.
- **States**: default, fine-pointer hover, pressed, and conspicuous `:focus-visible` accent ring.
- **Accessibility**: every row is a native button; labels describe the action and helper text never replaces the accessible name.
- **Motion**: explicit transform, border, surface, and shadow transitions only; pressed feedback stays under 2% scale change.
- **Layout**: the three equal-size rows form a compact 16px cascade from New Project through Settings, while the Beacon and Recent Projects surfaces remain precisely column-aligned. The primary action is visually dominant at rest; Settings uses a quiet contained surface so it remains recognizable as an action without competing with creation.

## 6. Motion & Interaction

### Page Theme Transition

- Add a native, label-wrapped "Smooth transition" checkbox to the Theme Editor mode bar, between Editing and Page Preview. Use existing control typography, accent, and spacing tokens; allow the groups to wrap at compact widths.
- The setting belongs to the project, defaults off, and applies to both page preview and exported theme CSS. Editing Light/Dark chooses a theme to edit, not a preview destination.
- Smoothly interpolate the shared theme color tokens on the page root using registered CSS color properties, with `--theme-transition-duration: 200ms` and `ease-in-out`. This adapts beui.dev's theme-toggle state-change intent to the existing CSS-only, device-aware theme system without an overlay, animation dependency, or overriding individual widgets' transitions.
- Only palette colors interpolate; typography and layout never animate. Rapid switches retarget the native transition. Canvas follows its existing System/Full/Reduced motion preview setting; exports always follow the visitor preference via `prefers-reduced-motion: no-preference` gating. Older browsers without registered-property interpolation retain an immediate theme switch.
- Native checkbox semantics provide keyboard/Space operation and checked-state announcements. Tooltip explains that the setting affects page colors, including exports. No extra app-shell motion is introduced.

### Internet Font Preview Feedback

- The Name column identifies each font; the Preview column never shows a misleading fallback name while loading or after a failure.
- Reserve one 140px-wide, 24px-high preview slot (constrained by its column). Loading shows a 70%-width, 12px-high rounded skeleton using the muted text token; failure shows a 16px warning icon with a descriptive tooltip. Ready shows only the real 16px font sample at 1.5 line height.
- Adapt beui.dev's loader opacity feedback to CSS only: `--font-preview-pulse-duration: 1400ms`, ease-in-out, opacity 0.35–0.75. Ready samples fade in for `--font-preview-reveal-duration: 120ms` with ease-out. No layout animation, timers, or additional dependencies.
- Reduced motion freezes the skeleton at 0.55 opacity and disables the ready fade. Maintain the same slot geometry in all states, with no extra status line.
- Announce the family and status politely through an accessible label, mark only the preview slot busy, and keep the icon decorative. Preview status is separate from project download/import status and never disables the download action.

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
- Respect `prefers-reduced-motion: reduce` by disabling entrance, hover, action, and continuous ambient transforms/filters while keeping stable final state.
- The launcher normally runs its full ambient stack: grid drift, aurora float, grid-glow pulse, scanline sweep, dot-field pulses, and the Welcome Workbench Beacon selection pulse. No app mode or layout breakpoint disables these effects; only the visitor's `prefers-reduced-motion: reduce` preference stops them.
- Keep every ambient layer inside one isolated, paint-contained background stacking context beneath the launcher surface so filtered and transformed effects cannot invalidate foreground rendering.
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
- Reduced motion must be honored for entrance, hover, Beacon, and every continuous welcome-background effect.
- Hover-only effects must not be the only indicator of meaning.

### Accepted Debt

| Item | Location | Why accepted | Owner / Exit |
|------|----------|--------------|--------------|
| Full primitive showcase absent | Existing app | The project predates this design-system file; current work preserves established components and verifies in the running editor. | Add a focused showcase when shared primitives are extracted. |
