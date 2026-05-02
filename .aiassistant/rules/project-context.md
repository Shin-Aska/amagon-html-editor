---
apply: always
---

# Amagon Project Context

Amagon is an offline, AI-powered visual HTML editor built with Electron, React, and TypeScript.

For deeper context on architecture, data models, IPC channels, and conventions, see `GUIDELINES.md` at the repo root.

## Tech Stack

- Electron, Vite, React, TypeScript, Zustand, Monaco Editor, Bootstrap 5

## Project Structure

```text
src/
├── main/                 # Electron main process
│   ├── aiService.ts      # AI provider adapters + secure key storage
│   ├── cliHelpers.ts     # CLI provider discovery and model probing
│   ├── credentialCatalog.ts  # Credential definition registry for all providers
│   └── publishCredentials.ts # Publish credential storage helpers
├── preload/              # Electron preload scripts
├── preview/              # Canvas runtime (iframe content)
├── publish/              # Publish-to-web extension system
│   ├── registry.ts       # Publisher registration and lookup
│   ├── types/            # PublisherExtension API types (versioned)
│   ├── providers/        # GitHub Pages, Cloudflare Pages, Neocities, AWS S3 adapters
│   └── validators/       # Per-provider credential + file validators
├── renderer/             # React app
│   ├── components/       # AiAssistant, Canvas, CodeEditor, Inspector, ThemeEditor,
│   │                        # FontManager (import fonts), GoogleFontBrowser (search & download),
│   │                        # FontPickerField (per-block), TypographyFontPicker (theme-level),
│   │                        # ThemeGallery/ThemeMiniPreview (live theme previews),
│   │                        # PublishDialog, Tutorial (interactive onboarding overlay)
│   ├── hooks/            # Custom React hooks
│   ├── registry/         # Block definitions (63 types across 7 categories)
│   ├── store/            # Zustand stores (EditorStore, ProjectStore, AiStore,
│   │                     # TutorialStore, AppSettingsStore, ToastStore)
│   ├── themes/           # Theme packs, gallery registry, component tokens, preview blocks
│   ├── templates/        # Page templates and section templates (reusable layouts)
│   ├── styles/           # CSS styles
│   └── utils/            # Utility functions
└── types/                # TypeScript types
```

## Key Systems

- **Publish-to-web** (`src/publish/`): Versioned `PublisherExtension` API with built-in GitHub Pages, Cloudflare Pages, Neocities, and AWS S3 providers. IPC namespace: `publish`. Credentials stored encrypted via `src/main/publishCredentials.ts`.
- **Tutorial system** (`src/renderer/components/Tutorial/` + `src/renderer/store/tutorialStore.ts`): Spotlight-driven onboarding with branching paths (AI Assistance, Publish Workflow, Web Media Search). Steps auto-advance via `dispatchTutorialAction()`. UI elements are marked with `data-tutorial="<marker>"` attributes.
- **Credential catalog** (`src/main/credentialCatalog.ts`): Central registry of credential field definitions for all providers; drives the new credential edit modal in Settings.
- **Font management system**: `FontAsset` model stored in `projectStore.fonts` with `source` field (`'system'`, `'imported'`, or `'google-fonts'`). `FontManager.tsx` handles file import AND Google Fonts browsing via `GoogleFontBrowser.tsx` (search, filter, download). `TypographyFontPicker.tsx` (theme-wide) and `FontPickerField.tsx` (per-block) provide visual button-trigger dropdowns with portal rendering. `themeToCSS()` generates `@font-face` rules; `exportEngine.ts` bundles font files automatically. **Export behavior**: Downloaded Google Fonts are self-hosted (no CDN); typed-only fonts use CDN links. IPC namespace: `fonts` (`listSystem`, `importFile`, `copySystemFont`, `deleteFont`, `listProject`, `downloadGoogleFont`). Static catalog at `src/renderer/data/google-fonts-catalog.json`. See section 13a of GUIDELINES.md for full details.
- **Theme gallery & theme packs**: Browsable gallery of pre-built themes with categories, tags, and dark variants. `ThemePack` definitions in `src/renderer/themes/themePacks.ts`, gallery registry in `themeGalleryRegistry.ts`, live mini preview via `ThemeMiniPreview.tsx`. Themes include `ComponentTokens` for consistent button/card/heading/form styling. Applied through `ThemeEditor`.
- **Page & section templates**: Reusable, theme-aware layout templates. `PageTemplate` and `SectionTemplate` types in `src/renderer/templates/templateTypes.ts` with categories (landing, portfolio, hero, pricing, testimonials, etc.). Built-in templates in `pageTemplates.ts` and `sectionTemplates.ts`. Inserted via sidebar template gallery UI.

## Hard Constraints

- Never use `as any`, `@ts-ignore`, `@ts-expect-error` for type suppression.
- Never use empty catch blocks.
- Never delete failing tests to force pass.
- Never commit unless explicitly requested.
- Never leave code in broken state after failures.
