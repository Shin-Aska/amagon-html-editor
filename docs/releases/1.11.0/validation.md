> Historical preparation record: the 1.11.0 release and tag were withdrawn. Use the [complete 1.11.1 release](../1.11.1/notes.md) and [current validation](../1.11.1/validation.md).

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

### Initial broad-suite limitations

The full one-worker Linux / Node 22.17.1 run completed: **1,132 passed, 14 failed across six files** (1,146 tests; 121 files). This initial run was not green; the post-merge follow-up below resolves all 14 failures. At that point, the failures were in the archive/path/privileged-port areas already recorded during the widget goal; no failing tests were deleted or weakened.

| File under `src/main/projects/` | Failed checks | Observed failure |
| --- | ---: | --- |
| `amgArchiveReader.test.ts` | 4 | Archive extraction/integrity operations time out at 30 seconds |
| `amgArchiveWriter.test.ts` | 2 | Archive writing/limit operations time out at 30 seconds |
| `mediaImportStreaming.test.ts` | 1 | Archive-backed autosave/reopen times out at 30 seconds |
| `projectSensitivePersistence.test.ts` | 1 | Archive-backed candidate rejection times out at 30 seconds |
| `projectService.test.ts` | 5 | Three Windows-path fixture expectations on Linux; two archive-backed operations time out |
| `safeMediaNetwork.test.ts` | 1 | The local test server cannot bind privileged port 443 (`EACCES`) |

The 266 feature-focused checks are green, including every new renderer test file. All 18 follow-up protocol/lifecycle checks and the native font-loading regression check pass, validating the framework registration fix separately. These were review items in the initial draft; the post-merge source verification below records their resolution. npm audit success is not treated as proof that all tests pass.

### Post-merge backend follow-up

After PR #20 merged, the 14 failures were traced to three causes: ten archive read/readback operations received raw `ArrayBuffer` chunks that hang on Node 22.17.1; three fixture cases assumed Windows filesystem paths on Linux; and one transport test required binding privileged port 443.

The reader now retains ArrayBuffer-backed `Uint8Array` chunks, the fixtures use host-native paths, and the transport test executes the production connector's pinned lookup callbacks through an observed HTTPS request boundary. Existing archive integrity/size checks remain in place. These backend files were already present in 1.10.1.

Verification on the post-merge source: **1,146 tests pass across all 121 files**, including all 110 checks in the six previously failing files. TypeScript and the main-process build pass. Real archive extraction and writing also succeed under Node 22.17.1 and Electron's Node 24.19.0. See [backend test portability](../../development.md#backend-test-portability) for the runtime and fixture conventions.

The Windows/Linux installers have been rebuilt from the post-merge fixes, with refreshed checksums and a passing packaged-app archive round trip.

### Rebuilt installers from main

[GitHub Actions run 42329767378](https://github.com/Shin-Aska/amagon-html-editor/actions/runs/42329767378) **succeeded on Windows and Linux**, including clean installs, production builds, TypeScript checks, packaging, and replacement uploads. The rebuilt application source is commit `344aac2960ec56e1c9ba30e9f4d6db4fa3aaf20a`. The subsequent checksum/verification commit changes release records only.

All six build files have fresh uploaded asset IDs in the existing **1.11.0 draft**: Windows installer, blockmap and update feed; Linux AppImage, Debian package and update feed. [SHA256SUMS.txt](SHA256SUMS.txt) now records the replacement upload digests. Both update feeds identify version 1.11.0 and reference the fresh file sizes; the Linux feed's SHA-512 matches the downloaded AppImage.

The downloaded AppImage matches GitHub's SHA-256 digest. Inspection of its packaged main-process code confirms that the typed-byte-array archive fix is present. A smoke check of the **rebuilt packaged application** passes version detection, project creation, archive close/reopen, bundled-font loading, canvas/code layout, selected widget HTML highlighting, local editor workers, and zero renderer page errors. Windows packaging is verified by CI; a Windows runtime launch was not performed on this Linux machine.

The complete source test suite remains green: **1,146 passed, zero failed**. Fresh full and production-only npm audits both report zero vulnerabilities. The release remains unpublished and no version tag has been pushed.

### Initial installer preparation

[GitHub Actions run 42325429867](https://github.com/Shin-Aska/amagon-html-editor/actions/runs/42325429867) **succeeded on Windows and Linux**: clean npm installs, production builds, TypeScript checks, packaging, and draft asset uploads. The artifacts were built from application commit `d0d81719f67acccbf443c285156c4500b4968cd1`; the follow-up verification commit changes release documentation only.

The [1.11.0 draft on the Releases page](https://github.com/Shin-Aska/amagon-html-editor/releases) initially contained:

- Windows x64 installer, blockmap, and `latest.yml`.
- Linux x64 AppImage, Debian package, and `latest-linux.yml`.
- [Initial checksums](https://github.com/Shin-Aska/amagon-html-editor/blob/c79d6cbfce93279ac3bb317ff0bedb15cfe2e441/docs/releases/1.11.0/SHA256SUMS.txt), using GitHub's upload digests for the original six build files.

The downloaded AppImage's SHA-256 matches its recorded upload digest. A smoke check of the extracted **packaged** application confirms `app.isPackaged === true`, version `1.11.0`, project creation, actual bundled-font loading, the canvas/code layout, selected widget HTML highlighting, locally loaded editor workers, and no renderer page errors. Windows packaging is verified by CI; a Windows runtime launch was not performed on this Linux machine.

[PR #20](https://github.com/Shin-Aska/amagon-html-editor/pull/20) introduced the widget, theme, and editor changes and has been merged. The post-merge follow-up above records the resolved test failures. The release remains a draft.

## Review and publication

Publishing the draft release and pushing the version tag remain reserved for owner review. PR #20 has already been merged. Windows x64 and Linux x64 match the previous release platform set; macOS binaries are not included.

## Screenshots

Captured from the built Electron app with Ocean dark mode, a temporary profile, and a disposable project:

- [Canvas and linked widget HTML](canvas-code-ocean.png)
- [Widget design inspector](widget-design.png)
- [Built-in app themes](app-themes.png)
- [Custom theme creator](theme-creator.png)
