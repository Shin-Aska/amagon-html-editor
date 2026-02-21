# Hoarses

Hoarses is an **offline visual HTML project editor** (in the spirit of Pingendo and Mobirise) built with **Electron + Vite + React + TypeScript**.

It lets you build pages from reusable blocks, edit styles and properties, manage assets locally, and export clean HTML.

## Features

- Visual drag-and-drop page builder
- Multi-page projects (page manager)
- Inspector for block properties and styles
- Monaco-powered code editor (optional panel)
- Asset manager (import/list/delete project assets)
- Export pipeline (single-page or multi-page export)
- Dark/light UI theme

## Tech Stack

- Electron (main + preload + renderer)
- Vite + React 18
- TypeScript
- Zustand (state management)
- Monaco Editor (code editor)
- dnd-kit (drag and drop)

## Getting Started

### Prerequisites

- Node.js (recommended: current LTS)
- npm

### Install

```bash
npm install
```

### Run (Electron)

```bash
npm run dev
```

### Run (Web-only / Renderer in browser)

```bash
npm run dev:web
```

### Build

```bash
npm run build
```

### Build (web renderer only)

```bash
npm run build:web
```

### Tests

```bash
npm test
```

## Project Structure (high level)

- `src/main/` Electron main process
- `src/preload/` contextBridge API for renderer -> Electron IPC
- `src/renderer/` React UI
- `src/preview/` iframe runtime for the canvas

## Notes

- Projects are stored as JSON files.
- Recent projects are stored in the OS userData directory.

## License

Private / internal project.
