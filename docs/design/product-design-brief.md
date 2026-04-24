# Product Design Brief

## Product Positioning

Amagon is an offline, AI-powered visual HTML editor for desktop. It sits between
drag-and-drop site builders and code-first HTML editors:

- Visual editing for non-linear page assembly.
- Monaco code editing for direct HTML/CSS control.
- Theme-aware AI generation for structured page blocks.
- Static export and direct publishing for finished sites.

The design should feel like a capable desktop creative tool, closer to an IDE or design
editor than a marketing website builder.

## Primary Users

- Designers who want fast static-page assembly without surrendering HTML output.
- Developers who want a visual layer over clean exportable markup.
- Indie makers who want AI-assisted layouts, themes, and publishing in one local app.
- Users who need offline-first project work with optional AI/provider integrations.

## Core Workflows

### 1. Create Or Open Project

Users start from the welcome screen, choose a framework, and enter a project with at least
one page. The design goal is fast orientation: recent projects, create/open actions, and
first-use tutorial access should be obvious without over-explaining the product.

### 2. Build Visually

Users drag blocks from the left sidebar to the canvas, select elements, and edit details in
the inspector. The shell should preserve spatial memory:

- Left side: discovery and structure.
- Center: canvas and preview.
- Right side: properties and fine-grained edits.
- Top: project, viewport, layout, save/export/publish actions.
- Bottom: status and contextual feedback.

### 3. Edit Code

Users can open Monaco to edit raw HTML/CSS and see changes reflected in the visual model.
The split view must make mode changes clear without making visual editing feel secondary.

### 4. Customize Theme

Users edit colors, typography, spacing, borders, and custom CSS in the theme editor. The
experience should frame theme changes as system-level decisions that cascade through blocks.

### 5. Use AI

Users ask the AI assistant to generate blocks, modify styles, or propose code changes. AI
output should be reviewed before insertion or application, especially when it touches CSS
files or event handlers.

### 6. Export Or Publish

Users export static HTML/CSS/assets or publish through supported providers. Publishing is a
confidence workflow: validation, credential clarity, progress, and final URL feedback matter
more than visual flair.

## Current Visual Language

The editor shell uses a compact desktop UI:

- Font size baseline: `13px`.
- Toolbar height: `44px`.
- Left sidebar width: `260px`.
- Right inspector width: `300px`.
- Code editor height: `250px`.
- Radius scale: `4px`, `6px`, `8px`.
- Components are mostly flat surfaces with borders, hover fills, and concise labels.

### Light Theme Tokens

| Token | Value |
|-------|-------|
| Background primary | `#eff1f5` |
| Background secondary | `#e6e9ef` |
| Surface | `#dce0e8` |
| Hover | `#bcc0cc` |
| Text primary | `#4c4f69` |
| Text secondary | `#6c6f85` |
| Border | `#ccd0da` |
| Accent | `#1e66f5` |

### Dark Theme Tokens

| Token | Value |
|-------|-------|
| Background primary | `#1e1e2e` |
| Background secondary | `#181825` |
| Surface | `#313244` |
| Hover | `#45475a` |
| Text primary | `#cdd6f4` |
| Text secondary | `#a6adc8` |
| Border | `#45475a` |
| Accent | `#89b4fa` |

## Design Principles

### Preserve Tool Density

This is a desktop editor. Avoid oversized SaaS-dashboard spacing. Use compact controls,
clear grouping, and progressive disclosure where detail is heavy.

### Make The Canvas The Center

The canvas is the user's object of work. Panels should support it, not compete with it.
When adding affordances, keep the canvas readable and interaction targets stable.

### Keep AI Reviewable

AI should feel powerful but inspectable. Generated blocks, CSS changes, and event handlers
need previews, diffs, or clear apply/discard states.

### Prefer Stable Layouts

Toolbars, sidebars, inspector groups, and dialogs should not jump when labels, states, or
loading text change. Define stable dimensions for fixed controls.

### Use Native Desktop Cues

The app is Electron, not a web SaaS page. Menus, panels, resizable splitters, shortcut
discovery, and keyboard-first actions are expected.

## Interaction Requirements

- Selection state must be visible on the canvas and reflected in the inspector.
- Drag/drop must expose a clear drop target and avoid hiding the insertion point.
- Undo/redo state should be easy to understand from toolbar or status feedback.
- Viewport switching must communicate the active device size.
- Publish/export errors must be written for repair, not blame.
- Credential UI must distinguish AI keys from publish credentials.
- Tutorial spotlight targets should use stable `data-tutorial` markers.

## Accessibility And Usability Targets

- Keyboard shortcuts need visible discoverability through the help dialog and command palette.
- Focus rings must remain visible in both light and dark themes.
- Text should fit within controls without relying on viewport-scaled font sizes.
- Icon-only buttons need labels through tooltip, aria-label, or adjacent text.
- Modal workflows should restore focus when dismissed.

## High-Risk Design Areas

- AI proposal review: users need to understand what will change before applying it.
- Theme editor: changes are global, so previews and grouping must be unambiguous.
- Publish dialog: credential mistakes, provider constraints, and upload failures must be recoverable.
- Tutorial overlay: spotlight and instruction card must not obscure the target action.
- Asset manager/media search: imported files need source, naming, and project-scope clarity.

## Open Design Questions

- Should the welcome screen be more project-manager-oriented or tutorial-oriented?
- Should AI generation live primarily in a side panel, command palette, or contextual inspector action?
- Should theme presets preview against the current page or a fixed sample board?
- Should publish validation run continuously as project assets change or only on demand?
- Should the code editor be treated as a lower split panel or a first-class layout mode?
