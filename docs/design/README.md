# Amagon Design Handoff

This folder is the design-facing handoff for Claude-driven design exploration and testing.
It summarizes the current product surface, available visual assets, UI constraints, and
scenario checks without requiring Claude to read the entire codebase first.

## Documents

- [Product Design Brief](./product-design-brief.md) - product goals, primary workflows, information architecture, and visual direction.
- [Asset Manifest](./asset-manifest.md) - local screenshots, logo/app imagery, dimensions, and recommended usage.
- [Claude Design Test Brief](./claude-design-test-brief.md) - design-test prompts, evaluation scenarios, and acceptance criteria.

## Source Of Truth

Use these repo files when implementation details need verification:

- `GUIDELINES.md` for architecture, conventions, and major feature inventory.
- `README.md` for public positioning and current feature claims.
- `src/renderer/styles/global.css` for editor shell tokens.
- `src/renderer/components/*/*.css` for component-level interaction patterns.
- `src/renderer/components/Tutorial/DESIGN.md` for the tutorial system specification.

## Existing Asset Policy

The current repo already includes usable product screenshots and app imagery under:

- `docs/images/`
- `assets/`

Do not introduce external image dependencies for tests unless a design task explicitly needs
new reference material. Prefer the local screenshots in the asset manifest so tests are
repeatable and do not depend on network availability.
