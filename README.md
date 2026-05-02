# Amagon HTML Editor

<p align="center">
  <img src="docs/images/logo.png" alt="Amagon Logo" width="200" />
</p>

Amagon is an offline desktop HTML editor for building block-based pages visually, then dropping to raw code when you need it.

[amagon.app](https://amagon.app)

![App Preview](docs/images/app.jpg)

## Features

- **AI assistant**: Generate blocks from plain-language prompts, work with multiple providers, and review AI edits in a Monaco diff before applying them.
- **Visual editing**: Build pages with drag and drop, inline text editing, reusable blocks, and responsive preview modes.
- **Code integration**: Switch to Monaco at any time and keep the visual canvas and HTML in sync in both directions.
- **Theme system**: Edit colors, typography, spacing, borders, and custom CSS from one place, backed by CSS variables.
- **Publish to web**: Publish directly to GitHub Pages, Cloudflare Pages, Neocities, or AWS S3, or add your own provider through `PublisherExtension`.
- **Project workflow**: Manage multi-page projects, assets, reusable blocks, and exports, with an interactive tutorial for first-time users.

## Getting Started

```bash
npm install
npm run dev
```

See [docs/development.md](docs/development.md) for the full development guide, build commands, and Linux sandbox setup.

New to the codebase? Start with [docs/getting-started-contributing.md](docs/getting-started-contributing.md) for a contributor-friendly tour of the architecture, conventions, and where to find things.

## System Requirements & Compatibility

Amagon targets standard Windows 10/11 and mainstream Linux distributions. See [docs/post-install.md](docs/post-install.md) for known compatibility issues and fixes (ReviOS, Ubuntu 24.04+ sandbox crash, etc.).

## AI Setup

Common setups:

| Provider | Setup |
|----------|-------|
| **OpenAI** | Enter your API key in the AI settings panel |
| **Anthropic** | Enter your API key in the AI settings panel |
| **Google (Gemini)** | Enter your API key in the AI settings panel |
| **Ollama** (local) | Install [Ollama](https://ollama.com/), pull a model, and it auto-connects at `localhost:11434` |
| **Codex CLI** | Install [Codex](https://github.com/openai/codex) and authenticate it locally |

Other supported providers include Mistral and several CLI-based tools (Claude CLI, Gemini CLI, GitHub Copilot CLI, Junie CLI, and Opencode CLI).

Open the AI panel from the sidebar, click the settings icon, choose a provider, and add credentials if needed. Ollama and the CLI providers use your local setup, and Amagon discovers available models automatically.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save project |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+O` | Open project |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | Copy selected block |
| `Ctrl+X` | Cut selected block |
| `Ctrl+V` | Paste block |
| `Ctrl+D` | Duplicate selected block |
| `Delete` / `Backspace` | Delete selected block |
| `Escape` | Deselect / Cancel drag |
| `Ctrl+E` | Toggle code editor |
| `Ctrl+\` | Toggle left sidebar |
| `Ctrl+/` | Toggle right sidebar |
| `Ctrl+K` | Open command palette |
| `Ctrl+?` | Show keyboard shortcuts |

## Project Structure

```text
src/
├── main/                 # Electron main process
│   ├── aiService.ts      # AI provider adapters + secure key storage
│   ├── credentialCatalog.ts  # Credential definition registry
│   └── publishCredentials.ts # Publish credential storage
├── preload/              # Electron preload scripts
├── preview/              # Canvas runtime (iframe content)
├── publish/              # Publish-to-web extension system
│   ├── registry.ts       # Publisher registration
│   ├── types/            # Extension API types
│   ├── providers/        # GitHub Pages, Cloudflare Pages, Neocities, AWS S3
│   └── validators/       # Per-provider validators
├── renderer/             # React app
│   ├── components/       # React components
│   │   ├── AiAssistant/  # AI chat panel + settings
│   │   ├── Canvas/       # Visual canvas
│   │   ├── CodeEditor/   # Monaco code editor
│   │   ├── ThemeEditor/  # Theme editing UI
│   │   ├── PublishDialog/ # Publish UI
│   │   └── ...           # Inspector, Toolbar, Sidebar, Tutorial, etc.
│   ├── hooks/            # Custom React hooks
│   ├── registry/         # Block definitions (50+ types)
│   ├── store/            # Zustand stores (includes tutorialStore)
│   ├── styles/           # CSS styles
│   └── utils/            # Utility functions
└── types/                # TypeScript types
```

## Tech Stack

- **App shell**: Electron
- **Build**: Vite
- **UI**: React, TypeScript, Zustand
- **Editing**: Monaco Editor, parse5, highlight.js
- **Interaction**: dnd-kit, react-resizable-panels
- **Styling**: Bootstrap 5, Lucide React

## Architecture

### State Management
- **EditorStore**: Current page blocks, selection, history (undo/redo), clipboard
- **ProjectStore**: Project settings, pages, user blocks, file paths, theme
- **AiStore**: Chat messages, AI configuration, model lists, provider state

### Canvas Rendering
The canvas runs in an isolated iframe. Blocks are rendered to HTML, sent with `postMessage`, and user interactions are relayed back.

### AI Pipeline
1. User sends a message from the AI chat panel
2. The renderer forwards the prompt, with block registry and theme context, to the main process via IPC
3. The main process builds a system prompt and dispatches it to the selected provider adapter
4. The response is parsed for JSON blocks or plain text and returned to the renderer
5. Generated blocks can be previewed inline and inserted into the canvas with one click

## Export

Projects export to clean HTML:
- No editor artifacts
- Optional inlined or external CSS
- Multi-page site or single self-contained HTML file
- Minification support and asset consolidation
- Standalone output ready for deployment

## License

This project is licensed under the **GNU General Public License v3.0**. See the [LICENSE.txt](LICENSE.txt) file for details.
