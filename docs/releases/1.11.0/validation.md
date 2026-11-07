# Amagon 1.11.0 release validation

Prepared 7 November 2026 on `feat/1.11.0`; this is a minor release in the Amagon 1.x series. The GitHub PR and release remain drafts for owner review.

## Dependency compatibility

Updated direct dependency minimums in both `package.json` and `package-lock.json`, rather than updating only the lockfile. Node.js remains 22.12+. Node type definitions follow the supported Node 22 runtime. No forced audit downgrade was used.

| Package | Release minimum |
| --- | --- |
| `@dnd-kit/core` | `^6.3.1` |
| `@dnd-kit/sortable` | `^10.0.0` |
| `@dnd-kit/utilities` | `^3.2.2` |
| `@monaco-editor/react` | `^4.7.0` |
| `@opencode-ai/sdk` | `^1.19.5` |
| `@zip.js/zip.js` | `^2.24.0` |
| `bootstrap` | `^5.3.8` |
| `bootstrap-icons` | `^1.13.2` |
| `fflate` | `^0.8.3` |
| `font-list` | `^2.1.0` |
| `highlight.js` | `^11.12.0` |
| `lucide-react` | `^1.70.0` |
| `monaco-editor` | `^0.54.0` |
| `parse5` | `^8.1.0` |
| `prettier` | `^3.9.10` |
| `react` | `^19.3.1` |
| `react-dom` | `^19.3.1` |
| `react-resizable-panels` | `^4.19.1` |
| `tailwindcss` | `^3.4.19` |
| `zod` | `^4.6.7` |
| `zustand` | `^5.1.0` |
| `@playwright/test` | `^1.65.0` |
| `@testing-library/user-event` | `^14.6.8` |
| `@types/node` | `^22.20.5` |
| `@types/react` | `^19.3.0` |
| `@types/react-dom` | `^19.3.0` |
| `@vitejs/plugin-react` | `^5.2.0` |
| `electron` | `^42.11.18` |
| `electron-builder` | `^26.18.0` |
| `electron-vite` | `^5.0.0` |
| `jsdom` | `^29.1.1` |
| `tsx` | `^4.23.15` |
| `typescript` | `^6.0.3` |
| `vite` | `^7.3.7` |
| `vitest` | `^4.1.12` |

### Reviewed version limits

- Electron 42.11.18 is the latest patch in the existing major. [Newer majors change native window controls, dialogs, clipboard APIs, sandboxed preload behavior, and supported operating systems](https://www.electronjs.org/docs/latest/breaking-changes). A broader runtime migration is deferred.
- Monaco 0.54.0 is the additive update before the [0.55 namespace and 0.56 ESM module layout changes](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md). A scoped override selects [DOMPurify 3.4.17](https://github.com/cure53/DOMPurify/releases/tag/3.4.17), preserving the major-3 sanitizer API while resolving the audit findings.
- Vite 7 / electron-vite 5 / React plugin 5 / Vitest 4 remain a compatible build/test set. [Vite 8 changes the bundler and transformer](https://vite.dev/guide/migration.html); the associated major upgrades are deferred.
- Tailwind 3 and TypeScript 6 receive their latest compatible patches; [Tailwind 4](https://tailwindcss.com/docs/upgrade-guide) and [TypeScript 7](https://devblogs.microsoft.com/typescript/) need separate migration review.

### Audit and offline resources

`npm audit fix` was run without `--force`. The font-generator dependency chain had no safe automatic fix, so the generator now downloads the same upstream APIv2 data from a pinned Fontsource commit and validates it using existing Zod. The editor still ships its offline catalog. This removed 39 packages during the initial update; adding the patched sanitizer resulted in a final audited tree of 504 packages.

Bundled Bootstrap 5.3.8, Bootstrap Icons 1.13.2, and Highlight.js 11.12.0 files and URLs are updated together, including export paths and icon font references. A real Electron font-load assertion caught missing framework scheme registration; startup now registers both schemes in one pre-ready call, enabling relative asset URLs and font CORS as required by the [Electron protocol API](https://www.electronjs.org/docs/latest/api/protocol).

## Verification

- Clean `npm ci` succeeds; both full and production-only npm audits report **0 vulnerabilities**. The full machine-readable audit is in [npm-audit.json](npm-audit.json).
- TypeScript and the production Electron build pass.
- **266 feature-focused unit tests across 15 files pass**, including the inspector for all 63 widgets, presets across Bootstrap/Tailwind/vanilla, theme persistence and creation, source identities/export preservation, source-range matching, code commits, shortcuts, preview documents, export asset paths, and upstream font metadata validation.
- **Four Electron integration tests pass**: widget experience, appearance/code reliability, side-by-side layout, and canvas-to-HTML selection. The appearance/code test also passes again after the toolbar focus update, exercising HTML/CSS formatting, find/replace, drafts, page switches, persistence, save/close flushing, and bounded model retention.
- The font generator succeeds against the pinned upstream metadata, writing 1,960 families (1,959 ranked) to a temporary output without changing the bundled catalog.
- Four real Electron screenshots are captured and visually checked.
- A final registry check found the compatible react-resizable-panels 4.19.1 patch. Its manifest/lockfile update and follow-up layout and HTML-selection checks pass.

### Broad-suite limitations

The full one-worker Linux / Node 22.17.1 run completed: **1,132 passed, 14 failed across six files** (1,146 tests; 121 files). This is not a green full suite. The remaining failures are in the archive/path/privileged-port areas already recorded during the widget goal; no failing tests were deleted or weakened.

| File under `src/main/projects/` | Failed checks | Observed failure |
| --- | ---: | --- |
| `amgArchiveReader.test.ts` | 4 | Archive extraction/integrity operations time out at 30 seconds |
| `amgArchiveWriter.test.ts` | 2 | Archive writing/limit operations time out at 30 seconds |
| `mediaImportStreaming.test.ts` | 1 | Archive-backed autosave/reopen times out at 30 seconds |
| `projectSensitivePersistence.test.ts` | 1 | Archive-backed candidate rejection times out at 30 seconds |
| `projectService.test.ts` | 5 | Three Windows-path fixture expectations on Linux; two archive-backed operations time out |
| `safeMediaNetwork.test.ts` | 1 | The local test server cannot bind privileged port 443 (`EACCES`) |

The 266 feature-focused checks are green, including every new renderer test file. All 18 follow-up protocol/lifecycle checks and the native font-loading regression check pass, validating the framework registration fix separately. These known broad-suite limitations remain review items for the draft; npm audit success is not being treated as proof that all tests pass.

### Installer preparation

The release workflow performs clean npm installs, production builds, TypeScript checks, and Windows/Linux packaging. It explicitly uploads to a **draft** release. Packaging status, the exact workflow run, and downloads are recorded in the GitHub draft PR/release; the [workflow history](https://github.com/Shin-Aska/amagon-html-editor/actions/workflows/release.yml) remains available for inspection.

## Review and publication

Publishing the draft release, merging the PR, and pushing the version tag are reserved for owner review. Windows x64 and Linux x64 match the previous release platform set; macOS binaries are not included.

## Screenshots

Captured from the built Electron app with Ocean dark mode, a temporary profile, and a disposable project:

- [Canvas and linked widget HTML](canvas-code-ocean.png)
- [Widget design inspector](widget-design.png)
- [Built-in app themes](app-themes.png)
- [Custom theme creator](theme-creator.png)
