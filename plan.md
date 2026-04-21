# Google Fonts Browser (Bundled Catalog) — Execution Plan

> **Active Settings:** None
> **Generated:** 2026-04-21
> **Feature:** Option B — Bundled Google Fonts catalog with search, preview, and download-to-project for self-hosted font export

---

## Overview

Add a **Google Fonts browser** to the FontManager tab in the ThemeEditor, using a **bundled static catalog** (no API key required). Users can:

1. **Browse & search** ~1,500 Google Fonts by name, category, and popularity
2. **Preview** each font rendered in its own typeface (via temporary Google Fonts CDN stylesheet)
3. **Download** selected font files (`.woff2`) from `fonts.gstatic.com` directly into the project's `assets/fonts/`
4. **Automatically register** downloaded fonts as `FontAsset` entries in the project store (same as file import)

The downloaded fonts are then **fully self-hosted** in the exported site — no CDN dependency at runtime.

### Key Design Decisions

- **No API key**: The catalog JSON is bundled at build time; font files are fetched from the public `fonts.gstatic.com` CDN which requires no authentication
- **Offline browsing**: Catalog is local — users can browse and search without internet. Download requires internet.
- **Leverages existing infra**: Reuses `FontAsset` type, `addFonts()` store action, `assets/fonts/` directory convention, and `@font-face` injection in `themeToCSS()`
- **Mirrors Asset Manager UX**: A "Google Fonts" tab/section in FontManager, analogous to "Web Search" tab in AssetManager's MediaSearchPanel

---

## Phase 1 — Build Static Google Fonts Catalog

**Assigned Agent:** Gemini 2.5 Flash

### Goal
Create a Node.js script that fetches the Google Fonts metadata API and generates a static JSON catalog file to be bundled with the app. The catalog contains font family names, categories, variants, and the CDN URLs needed to download `.woff2` files.

### Context for Agent
- The Google Fonts CSS API v2 endpoint is `https://fonts.googleapis.com/css2?family=FAMILY:wght@WEIGHTS&display=swap` — it returns `@font-face` CSS with `fonts.gstatic.com` URLs
- The Google Fonts Developer API (`https://www.googleapis.com/webfonts/v1/webfonts?key=API_KEY`) returns structured metadata — but we'll generate the catalog **once at build time** so the API key is only needed by the developer running the script, not end users
- Alternative: Parse the open-source [google/fonts](https://github.com/google/fonts) repo's METADATA.pb files, or use the `fontsource` npm package's metadata
- The generated JSON should be small enough to bundle (~300-500KB for ~1,500 families)
- Output location: `src/renderer/data/google-fonts-catalog.json`
- The script should live at `scripts/generate-google-fonts-catalog.ts`

### Tasks

- [x] **1.1** Create `scripts/generate-google-fonts-catalog.ts` — a Node.js script that:
  - Fetches font metadata from the public Google Fonts API (using a developer-provided API key via `GOOGLE_FONTS_API_KEY` env var) OR from the `@fontsource-utils/fonts` npm package (no key needed)
  - Extracts for each font family: `family` (string), `category` (`sans-serif` | `serif` | `display` | `handwriting` | `monospace`), `variants` (array of `{weight, style}` objects), `popularity` (rank number), `subsets` (array of supported character sets), `lastModified` (date string)
  - Does NOT embed font file URLs in the catalog (those are derived at download time from the family name + weight)
  - Sorts by popularity (most popular first)
  - Writes the output to `src/renderer/data/google-fonts-catalog.json`
  - Logs a summary (e.g. "Generated catalog with 1,523 font families")
- [x] **1.2** Run the script and commit the generated `src/renderer/data/google-fonts-catalog.json` file
- [x] **1.3** Create `src/renderer/data/googleFontsCatalog.ts` — a typed module that:
  - Defines the `GoogleFontMeta` interface: `{ family: string; category: string; variants: { weight: string; style: string }[]; popularity: number; subsets: string[] }`
  - Imports and re-exports the JSON catalog as `GoogleFontMeta[]` with proper typing
  - Exports a helper `getGoogleFontPreviewUrl(family: string, weight?: string): string` that returns a Google Fonts CSS2 URL for loading the font in the browser (e.g. `https://fonts.googleapis.com/css2?family=Roboto:wght@400&display=swap`)
- [x] **1.4** Add a `generate:fonts` script entry in `package.json` that runs `npx tsx scripts/generate-google-fonts-catalog.ts`

### Acceptance Criteria

- [x] `src/renderer/data/google-fonts-catalog.json` exists and contains ≥1,000 font entries
- [x] Each entry has `family`, `category`, `variants`, `popularity`, `subsets` fields
- [x] `googleFontsCatalog.ts` exports the typed array and the preview URL helper
- [x] `npm run build` compiles without TS errors (the JSON import is valid)

### Validation Steps

- [x] Run `npx tsx scripts/generate-google-fonts-catalog.ts` — produces the JSON file
- [x] Inspect the JSON — first entry is a popular font (e.g. "Roboto" or "Open Sans"), each has expected fields
- [x] `import { default as catalog } from './google-fonts-catalog.json'` works in a TS file
- [x] `npm run build` — zero errors

---

## Phase 2 — Main Process: Font Download IPC Handler

**Assigned Agent:** GPT-5.3-Codex

### Goal
Add an IPC handler in the main process that downloads `.woff2` font files from Google Fonts CDN and saves them into the project's `assets/fonts/` directory, returning `FontAsset` metadata.

### Context for Agent
- Read `src/main/index.ts` lines 317–523 — existing `fonts:*` IPC handlers (follow the same patterns: `isPathSafe()`, `fs.mkdir`, dedup filenames, return `FontAsset` shape)
- Read `src/main/mediaSearchService.ts` function `downloadAndImportMedia()` (lines 360–411) — the download pattern using `net.fetch()`
- The download flow: renderer sends family name + weight → main process constructs the Google Fonts CSS2 URL → fetches the CSS → parses out the `src: url(...)` pointing to `fonts.gstatic.com` → fetches the `.woff2` binary → saves to `assets/fonts/` → returns `FontAsset`
- Important: set `User-Agent` header to a modern browser UA when fetching the Google Fonts CSS, so it returns `woff2` format (Google serves different formats based on UA)
- Read `src/preload/index.ts` — add the new channel to the `fonts` namespace
- Read `src/renderer/utils/api.ts` — add the typed wrapper

### Tasks

- [ ] **2.1** In `src/main/index.ts`, add IPC handler `fonts:downloadGoogleFont` that:
  - Accepts `{ family: string; variants: { weight: string; style: string }[] }` argument
  - Validates `currentProjectDir` is set
  - Creates `assets/fonts/` directory if needed
  - For each variant (weight/style pair):
    - Constructs the Google Fonts CSS2 URL: `https://fonts.googleapis.com/css2?family={encodedFamily}:ital,wght@{italic},{weight}&display=swap`
    - Fetches the CSS using `net.fetch()` with a modern Chrome User-Agent header (to get woff2)
    - Parses the CSS response to extract the `src: url(...)` value (regex: `/src:\s*url\(([^)]+)\)/`)
    - Fetches the `.woff2` binary from the extracted URL using `net.fetch()`
    - Saves to `<projectDir>/assets/fonts/<family>-<weight>-<style>.woff2` (sanitize family name: lowercase, replace spaces with hyphens)
    - Handles filename deduplication (same pattern as `fonts:importFile`)
  - Returns `{ success: boolean; fonts: FontAsset[]; errors?: string[] }` — one `FontAsset` per successfully downloaded variant, with `source: 'google-fonts'` and correct `relativePath`
- [ ] **2.2** In `src/preload/index.ts`, add `downloadGoogleFont` to the `fonts` namespace: `downloadGoogleFont: (args: { family: string; variants: { weight: string; style: string }[] }) => ipcRenderer.invoke('fonts:downloadGoogleFont', args)`
- [ ] **2.3** In `src/renderer/utils/api.ts` (or equivalent typed bridge), add the typed wrapper for `fonts.downloadGoogleFont()`
- [ ] **2.4** In `src/renderer/store/types.ts`, extend the `FontAsset` interface's `source` comment (or add `'google-fonts'` to the union if `source` is typed) — but keep backward compat (existing `'system'` | `'imported'` values still work)

### Acceptance Criteria

- [ ] `window.api.fonts.downloadGoogleFont({ family: 'Roboto', variants: [{ weight: '400', style: 'normal' }] })` downloads `roboto-400-normal.woff2` into `<project>/assets/fonts/`
- [ ] Returned `FontAsset` has correct `name: 'Roboto'`, `format: 'woff2'`, `relativePath: 'assets/fonts/roboto-400-normal.woff2'`
- [ ] Multiple variants download correctly (e.g. 400 normal + 700 bold + 400 italic)
- [ ] Path traversal is blocked (family names with `../` are sanitized)
- [ ] `npm run build` succeeds with zero TS errors

### Validation Steps

- [ ] In dev mode, call `window.api.fonts.downloadGoogleFont({ family: 'Roboto', variants: [{ weight: '400', style: 'normal' }] })` in DevTools console
- [ ] Verify `<project>/assets/fonts/roboto-400-normal.woff2` exists and is a valid woff2 file (non-zero bytes)
- [ ] Call with an invalid family name — returns error gracefully
- [ ] `npm run build` — no errors

---

## Phase 3 — Google Fonts Browser UI Component

**Assigned Agent:** Gemini 3.1 Pro Low

### Goal
Create the `GoogleFontBrowser` component — a searchable, filterable catalog panel with font previews rendered in their actual typefaces, and a download button for each font. Integrate it into the existing `FontManager.tsx` as a new section or toggle.

### Context for Agent
- Read `src/renderer/components/ThemeEditor/FontManager.tsx` — the current import-only font manager; the browser will be added as a section within this component or as a sibling tab
- Read `src/renderer/components/AssetManager/MediaSearchPanel.tsx` — the UX pattern to follow: search bar, paginated results grid, selection + action flow
- Read `src/renderer/data/googleFontsCatalog.ts` (from Phase 1) — the typed catalog and preview URL helper
- Read `src/renderer/components/ThemeEditor/FontManager.css` — follow existing `theme-font-*` CSS naming
- The component must load Google Fonts CSS for preview rendering via `<link>` tags injected per visible page of results (not all 1,500 at once)
- Use the `useProjectStore` hook to call `addFonts()` after successful download
- Use `useToastStore` for success/error notifications

### Tasks

- [ ] **3.1** Create `src/renderer/components/ThemeEditor/GoogleFontBrowser.tsx` that:
  - Imports the catalog from `googleFontsCatalog.ts`
  - Has a search input that filters fonts by family name (case-insensitive substring match)
  - Has a category filter bar: All | Sans Serif | Serif | Display | Handwriting | Monospace
  - Displays results in a paginated grid (8-12 fonts per page, with Previous/Next controls)
  - Each font card shows:
    - Font family name
    - Category badge (e.g. "Sans Serif")
    - Preview text ("The quick brown fox jumps over the lazy dog") rendered in the actual font via a `<link>` stylesheet from Google Fonts CDN
    - Number of available variants (e.g. "12 styles")
    - "Download" button (or "Downloaded ✓" if the font is already in `projectStore.fonts` by name)
  - When "Download" is clicked:
    - Shows a variant picker popover/modal with checkboxes for available weights/styles (default: select Regular 400 only)
    - User confirms → calls `window.api.fonts.downloadGoogleFont({ family, variants })`
    - On success, calls `addFonts()` with the returned `FontAsset[]` and shows a toast
    - On error, shows an error toast
  - Injects `<link>` tags only for the currently visible page of fonts (removes old links when paginating) to avoid loading all 1,500 font stylesheets
  - Shows a "Requires internet connection to preview and download" info note
- [ ] **3.2** Create `src/renderer/components/ThemeEditor/GoogleFontBrowser.css` with styles following the `theme-font-*` naming convention:
  - Search input styling consistent with ThemeEditor
  - Category filter pills
  - Font card grid with hover effects
  - Download button with loading state
  - Variant picker popover styling
  - Pagination controls
- [ ] **3.3** In `src/renderer/components/ThemeEditor/FontManager.tsx`, add a "Browse Google Fonts" button that toggles the `GoogleFontBrowser` component visibility (or integrate as a collapsible section below the import section)
- [ ] **3.4** In `src/renderer/components/ThemeEditor/FontManager.css`, add any additional layout styles needed to accommodate the browser section

### Acceptance Criteria

- [ ] Typing "rob" in the search box shows "Roboto", "Roboto Condensed", "Roboto Mono", etc.
- [ ] Clicking a category filter shows only fonts in that category
- [ ] Font previews render in their actual typeface (not the default font)
- [ ] Clicking "Download" opens variant picker; confirming downloads the `.woff2` file(s)
- [ ] Downloaded fonts appear in the "Imported Fonts" section of FontManager immediately
- [ ] Fonts already in the project show "Downloaded ✓" instead of a download button
- [ ] Pagination works correctly; only visible fonts' stylesheets are loaded
- [ ] No layout breaks in the existing FontManager UI

### Validation Steps

- [ ] Open ThemeEditor → Fonts tab → click "Browse Google Fonts" → search for "Inter"
- [ ] Click Download on "Inter" → select "Regular 400" → confirm → file downloads to `assets/fonts/inter-400-normal.woff2`
- [ ] Font card shows "Downloaded ✓" after download
- [ ] Use downloaded "Inter" in Typography tab → canvas renders correctly
- [ ] Navigate pages → no font stylesheet accumulation (check DevTools `<head>` links)
- [ ] `npm run build` — zero errors

---

## Phase 4 — Export Engine: Google Fonts Self-Hosting

**Assigned Agent:** GPT-5.4-mini

### Goal
Update the export engine so that when a project has downloaded Google Fonts (with `source: 'google-fonts'`), those fonts are exported as self-hosted files rather than CDN `<link>` tags. Fonts that are NOT downloaded (just typed by name in the typography picker) should continue to use Google Fonts CDN links.

### Context for Agent
- Read `src/renderer/utils/exportEngine.ts`:
  - `buildGoogleFontsHead()` (lines 792–807) — currently generates CDN `<link>` tags for all non-generic font families
  - `normalizeFontsForExport()` (lines 546–564) — normalizes `FontAsset.relativePath` for export
  - `buildFontFiles()` (lines 566–596) — copies font binaries using asset resolver
  - `GENERIC_FONTS` set (lines 53–68) — fonts excluded from Google Fonts linking
- The fix: `buildGoogleFontsHead()` must **exclude** font families that already have a corresponding `FontAsset` with a non-empty `relativePath` in the project fonts (since those are self-hosted via `@font-face`). Only families that are NOT self-hosted should get CDN `<link>` tags.
- Read `src/renderer/store/types.ts` `themeToCSS()` — already generates `@font-face` for all `FontAsset` entries with `relativePath`; no changes needed there

### Tasks

- [ ] **4.1** In `src/renderer/utils/exportEngine.ts`, modify `exportProject()` to pass the `exportFonts` list into `buildPageHtml()` call (alongside `googleFonts`)
- [ ] **4.2** In `src/renderer/utils/exportEngine.ts`, update `buildPageHtml()` to accept `fonts: FontAsset[]` (or `selfHostedFamilies: Set<string>`) parameter
- [ ] **4.3** In `src/renderer/utils/exportEngine.ts`, update `buildGoogleFontsHead()` to accept a `selfHostedFamilies: Set<string>` parameter and **filter out** any family that is already self-hosted — so it only generates CDN `<link>` tags for fonts that the user typed by name but didn't download
- [ ] **4.4** Write or update a Vitest test that verifies:
  - A font family present in `FontAsset[]` with a `relativePath` does NOT get a Google Fonts CDN `<link>`
  - A font family used in block styles but NOT in `FontAsset[]` still gets a Google Fonts CDN `<link>`
  - A generic font family (e.g. "sans-serif") gets neither

### Acceptance Criteria

- [ ] Exported HTML for a project with downloaded "Roboto" does NOT contain `<link href="https://fonts.googleapis.com/css2?family=Roboto...">` — uses self-hosted `@font-face` instead
- [ ] Exported HTML for a typed-only "Lato" (not downloaded) still has the Google Fonts CDN `<link>`
- [ ] Projects with zero fonts export identically to before (no regression)
- [ ] Unit test passes

### Validation Steps

- [ ] Download "Roboto" via Google Font Browser → export site → inspect exported HTML → no Roboto CDN link
- [ ] Type "Lato" in typography picker (without downloading) → export site → "Lato" CDN link present
- [ ] Run `npm test` — all tests pass
- [ ] `npm run build` — no errors

---

## Phase 5 — QA & Integration Review

**Assigned Agent:** Claude Sonnet 4.6

### Goal
Cross-cutting integration review: verify the full flow from catalog browsing → font download → store registration → canvas rendering → export bundling. Check for regressions, security, and edge cases.

### Context for Agent
- Read all changed files across Phases 1–4
- Focus on: download error handling (network failures, invalid responses), path safety for family names with special characters, font preview stylesheet cleanup (no memory leaks), catalog size impact on bundle, backward compat (projects without Google Fonts still work), export correctness (self-hosted vs CDN)

### Tasks

- [ ] **5.1** Verify the Google Fonts CSS parsing in `fonts:downloadGoogleFont` handles edge cases: fonts with spaces in names, fonts with only italic variants, fonts with 18+ weights, subset-specific URLs (ensure the regex extracts the correct `latin` subset URL)
- [ ] **5.2** Audit the font download handler for security: family name sanitization (reject or sanitize `../`, special chars), file writing stays within `assets/fonts/`, `isPathSafe()` used correctly
- [ ] **5.3** Test loading a project saved with Google Fonts `FontAsset` entries — verify the `source: 'google-fonts'` field doesn't break deserialization or any existing code that checks `source`
- [ ] **5.4** Verify font preview `<link>` stylesheet lifecycle in `GoogleFontBrowser`: links are added for visible page, removed when paginating, and fully cleaned up when the component unmounts (check for DOM leaks)
- [ ] **5.5** Confirm the export engine correctly differentiates between self-hosted (has `relativePath`) and CDN-only fonts — test with mixed scenarios (some downloaded, some typed)
- [ ] **5.6** Verify the bundled catalog size is acceptable for the Electron bundle (check if it impacts startup time)
- [ ] **5.7** Run the full test suite (`npm test`) — all existing tests pass
- [ ] **5.8** Run `npm run build` — zero TypeScript errors, zero warnings
- [ ] **5.9** Test the "Downloaded ✓" badge logic in GoogleFontBrowser: verify it checks by family name case-insensitively against `projectStore.fonts`

### Acceptance Criteria

- [ ] Full flow works: browse → search → download → font appears in FontManager → usable in Typography/Inspector → exported as self-hosted → rendered offline in browser
- [ ] No security issues with file path handling
- [ ] No DOM leaks from font preview stylesheets
- [ ] No regressions on existing font import, export, or theming
- [ ] All tests green, build clean

### Validation Steps

- [ ] Run `npm test` — all tests pass
- [ ] Run `npm run build` — no errors
- [ ] End-to-end manual test: browse Google Fonts → download "Playfair Display" 400+700 → use as heading font → export → open offline → heading renders in Playfair Display
- [ ] Open a legacy project (no `source` field on fonts) — loads without errors

---

## Phase 6 — Documentation Update

**Assigned Agent:** Claude Haiku 4.5

### Goal
Update `GUIDELINES.md` and `.aiassistant/rules/project-context.md` to document the Google Fonts browser feature.

### Context for Agent
- Read the current `GUIDELINES.md` — especially Section 13a (Font Management System) and the IPC Channels Reference
- Read changed files from Phases 1–5

### Tasks

- [ ] **6.1** In `GUIDELINES.md`, update the **Project Structure** tree to add `GoogleFontBrowser.tsx` and `GoogleFontBrowser.css` under `ThemeEditor/`, and `google-fonts-catalog.json` + `googleFontsCatalog.ts` under `renderer/data/`
- [ ] **6.2** In `GUIDELINES.md`, update **Section 13a (Font Management System)** to document the Google Fonts Browser: bundled catalog, download flow, self-hosted export, `source: 'google-fonts'` value
- [ ] **6.3** In `GUIDELINES.md`, update the **IPC Channels Reference** table to add `fonts:downloadGoogleFont` channel
- [ ] **6.4** In `GUIDELINES.md`, update the **FontManager Tab** subsection to mention the "Browse Google Fonts" feature as a companion to local file import
- [ ] **6.5** In `GUIDELINES.md`, update the **Export Bundling** subsection to clarify that Google-downloaded fonts are self-hosted (`@font-face` + bundled `.woff2`) while un-downloaded Google Fonts still use CDN `<link>` tags
- [ ] **6.6** Update the **Last updated** date in `GUIDELINES.md` to current date
- [ ] **6.7** Mirror key additions in `.aiassistant/rules/project-context.md` if that file exists

### Acceptance Criteria

- [ ] Documentation accurately describes the Google Fonts browser feature
- [ ] IPC channel reference includes `fonts:downloadGoogleFont`
- [ ] Export behavior (self-hosted vs CDN) is clearly documented
- [ ] No existing documentation removed or corrupted

### Validation Steps

- [ ] Read `GUIDELINES.md` — all new sections present
- [ ] No broken markdown

---

## Dependency Graph

```
Phase 1 (Catalog)
  └─► Phase 2 (Download IPC)
  └─► Phase 3 (Browser UI) ← also depends on Phase 2
        └─► Phase 4 (Export Engine)
              └─► Phase 5 (QA)
                    └─► Phase 6 (Docs)

Phase 1 must complete first (catalog data needed by both UI and download logic).
Phase 2 can start after Phase 1 (IPC handler references catalog types).
Phase 3 depends on BOTH Phase 1 (catalog data) and Phase 2 (download handler).
Phase 4 depends on Phase 2 (needs FontAsset source field) and Phase 3 (needs integration context).
Phase 5 requires Phases 1–4.
Phase 6 requires Phase 5.
```

---

## Recommended Execution Order

| Order | Phase | Agent | Can Parallel With |
|-------|-------|-------|-------------------|
| 1st | Phase 1 — Build Static Catalog | Gemini 2.5 Flash | — |
| 2nd | Phase 2 — Download IPC Handler | GPT-5.3-Codex | — |
| 3rd | Phase 3 — Browser UI Component | Gemini 3.1 Pro Low | Phase 4 (if Phase 2 is done) |
| 3rd | Phase 4 — Export Engine Update | GPT-5.4-mini | Phase 3 |
| 4th | Phase 5 — QA & Integration | Claude Sonnet 4.6 | — |
| 5th | Phase 6 — Documentation | Claude Haiku 4.5 | — |

---

## Handoff Prompts

> Echo to each agent at the start of their session.

**Phase 1 — Gemini 2.5 Flash**
```
Setting: None
Run /execute-plan Phase 1 — Build Static Google Fonts Catalog. Generate a script to fetch Google Fonts metadata and produce a bundled JSON catalog at src/renderer/data/google-fonts-catalog.json.
```

**Phase 2 — GPT-5.3-Codex**
```
Setting: None
Phase 1 is complete. Run /execute-plan Phase 2 — Main Process Font Download IPC Handler. Add fonts:downloadGoogleFont handler that fetches .woff2 from Google Fonts CDN and saves to assets/fonts/. Follow existing fonts:importFile IPC pattern in src/main/index.ts.
```

**Phase 3 — Gemini 3.1 Pro Low**
```
Setting: None
Phases 1–2 are complete. Run /execute-plan Phase 3 — Google Fonts Browser UI Component. Build GoogleFontBrowser.tsx in ThemeEditor/ with search, category filter, font previews, and download integration. Follow MediaSearchPanel.tsx UX pattern.
```

**Phase 4 — GPT-5.4-mini**
```
Setting: None
Phases 1–3 are complete. Run /execute-plan Phase 4 — Export Engine: Google Fonts Self-Hosting. Update exportEngine.ts to skip CDN <link> tags for fonts that have self-hosted FontAsset entries with relativePath.
```

**Phase 5 — Claude Sonnet 4.6**
```
Setting: None
Phases 1–4 are complete. Run /execute-plan Phase 5 — QA & Integration Review. Verify full flow: catalog → download → store → canvas → export. Check security, edge cases, regressions.
```

**Phase 6 — Claude Haiku 4.5**
```
Setting: None
All implementation phases are complete. Run /execute-plan Phase 6 — Documentation Update. Update GUIDELINES.md to document the Google Fonts browser feature, new IPC channel, and export behavior.
```
