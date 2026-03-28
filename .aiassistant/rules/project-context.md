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
│   ├── credentialCatalog.ts  # Credential definition registry for all providers
│   └── publishCredentials.ts # Publish credential storage helpers
├── preload/              # Electron preload scripts
├── preview/              # Canvas runtime (iframe content)
├── publish/              # Publish-to-web extension system
│   ├── registry.ts       # Publisher registration and lookup
│   ├── types/            # PublisherExtension API types (versioned)
│   ├── providers/        # GitHub Pages, Cloudflare Pages, Neocities adapters
│   └── validators/       # Per-provider credential + file validators
├── renderer/             # React app
│   ├── components/       # AiAssistant, Canvas, CodeEditor, Inspector, ThemeEditor,
│   │                     # PublishDialog, Tutorial (interactive onboarding overlay)
│   ├── hooks/            # Custom React hooks
│   ├── registry/         # Block definitions (50+ types)
│   ├── store/            # Zustand stores (EditorStore, ProjectStore, AiStore,
│   │                     # TutorialStore, AppSettingsStore, ToastStore)
│   ├── styles/           # CSS styles
│   └── utils/            # Utility functions
└── types/                # TypeScript types
```

## Key New Systems (v1.7.0)

- **Publish-to-web** (`src/publish/`): Versioned `PublisherExtension` API with built-in GitHub Pages, Cloudflare Pages, and Neocities providers. IPC namespace: `publish`. Credentials stored encrypted via `src/main/publishCredentials.ts`.
- **Tutorial system** (`src/renderer/components/Tutorial/` + `src/renderer/store/tutorialStore.ts`): Spotlight-driven onboarding with branching paths (AI Assistance, Publish Workflow, Web Media Search). Steps auto-advance via `dispatchTutorialAction()`. UI elements are marked with `data-tutorial="<marker>"` attributes.
- **Credential catalog** (`src/main/credentialCatalog.ts`): Central registry of credential field definitions for all providers; drives the new credential edit modal in Settings.

## Hard Constraints

- Never use `as any`, `@ts-ignore`, `@ts-expect-error` for type suppression.
- Never use empty catch blocks.
- Never delete failing tests to force pass.
- Never commit unless explicitly requested.
- Never leave code in broken state after failures.
