# Asset Manifest

These assets are already present in the repository and are safe to use for design review,
Claude prompts, docs, and visual regression setup.

## Product Screenshots

| Asset | Dimensions | Format | Recommended Use |
|-------|------------|--------|-----------------|
| `docs/images/app.jpg` | 830 x 610 | JPEG | Overall app layout, landing docs, high-level visual references |
| `docs/images/visual-editing.jpg` | 862 x 386 | JPEG | Canvas editing, drag/drop, inspector/sidebar workflow references |
| `docs/images/code-editor.jpg` | 847 x 466 | JPEG | Monaco editor, code sync, split-view workflow references |
| `docs/images/ai.jpg` | 1278 x 748 | JPEG | AI assistant panel, proposal flow, assistant UX references |
| `docs/images/theme-editor.jpg` | 632 x 368 | JPEG | Theme editor and design-token editing references |

## Brand And App Assets

| Asset | Dimensions | Format | Recommended Use |
|-------|------------|--------|-----------------|
| `docs/images/logo.png` | 640 x 640 | JPEG data with `.png` extension | Brand mark in docs and design boards |
| `assets/app.png` | 676 x 369 | PNG | App packaging and store-facing composition references |
| `assets/app.ico` | Multi-size Windows icon | ICO | Windows package icon; do not use as design mock source |

## Notes For Claude Design Work

- Treat screenshots as references for current state, not as final design requirements.
- Keep screenshot-relative language concrete: "toolbar", "left block library", "canvas", "right inspector", "bottom status bar".
- When prompting visual redesign tasks, include the specific screenshot path so Claude can target the correct surface.
- Do not assume `docs/images/logo.png` is a true PNG internally; tooling may report JPEG image data despite the file extension.

## Asset Gaps

The repo does not currently include:

- Empty-state artwork for new projects.
- Provider logos for publish targets.
- Tutorial illustrations.
- High-resolution app-window mockups for app stores.
- Design-token swatches as standalone images.

If a design test needs these, prefer documenting the desired asset rather than adding remote assets directly.
