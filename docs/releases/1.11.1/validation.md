# Amagon 1.11.1 release validation

Prepared 8 November 2026. Both npm manifests identify **1.11.1**. Application source and tag: `6be612cbfe9dde26826cf4f9d617e362b5ff378e`. The release is an **unpublished draft** containing all widget, theme, code-editor, asset and AI-provider improvements. The 1.11.0 release and tag remain withdrawn.

## AI-provider corrections

Codex completion requests now run outside Git repositories with `--skip-git-repo-check` and a read-only sandbox. They retain an explicit selected model or use the CLI's configured default when none is selected. No Git initialization or user trust-configuration change is required.

OpenAI discovery accepts modern GPT and reasoning families, removes duplicates and malformed/specialized model entries, and respects announced shutdown dates. Manual model refresh surfaces authentication, permission, timeout and malformed-response errors in Settings with API keys redacted. Modern GPT and o-series generation use Responses; older GPT models retain Chat Completions compatibility. Text extraction preserves multiple output parts and refusals and reports empty/incomplete output. Credential replacement preserves a valid selected model; discovery repairs an unavailable saved OpenAI selection so the picker and subsequent requests agree. No dependency or background service was added.

## Reproduction and corrections

The packaged 1.11.0 application reproduced both reported legacy loading and media import failures. A genuinely absent image caused strict validation to block an entire legacy project. Import results also interpreted raw filesystem filenames as encoded references, causing errors or incorrect URLs for spaces and literal percent sequences.

Legacy open and low-level autosave now preserve missing references with a persistent warning; bundle validation remains strict. Desktop manual Save and Save As open a guided repair/conversion dialog. Conversion requires repairing referenced missing assets and choosing where to save a portable `.amg`. The original JSON is preserved, and the full remaining asset library is copied. Save As acknowledgements use the originating workspace generation before installing the new session, preventing false stale-save errors after import/autosave.

The review renders at most 25 rows, supports search and pagination, and repairs batches of up to 10,000 matching files using folder suffixes or unique filenames. Ambiguous matches remain unresolved; existing files cannot be overwritten. Large opening notices show a bounded summary instead of thousands of filenames.

Unused cleanup covers unused files and missing, unapplied font entries. It checks every page, theme, preset, saved block, template and custom CSS field, retaining linked-resource dependencies, dynamic references and uncertain font usage. Selected files move outside `assets/` to project trash, and associated unused font metadata is removed. Session-scoped Undo restores the last cleanup without overwriting reimported files. Trash is excluded from bundles. Current usage and workspace generation are rechecked before cleanup. The same review is available from Asset Manager. No dependency or background index was added.

Autosave ticks received during imports or save acknowledgements coalesce into one pending tick, scoped to the original project. It runs after the current operation and importer metadata updates settle. Completed native progress cannot strand the controller in a busy state. The queue uses no idle polling timer. Import, font persistence/export, archive compatibility, Monaco cancellation handling, widget previews, themes, code editing and canvas layouts remain covered.

## Current regression evidence

- [Windows/Linux regression run 42392467617](https://github.com/Shin-Aska/amagon-html-editor/actions/runs/42392467617): **1,252 tests across 128 files on each platform**, **six process-ownership checks per platform**, and both application/build-configuration TypeScript checks passed.
- [Release and packaging run 42392502489](https://github.com/Shin-Aska/amagon-html-editor/actions/runs/42392502489): repeated the complete checks and passed **41 Windows desktop cases and 13 portable Linux desktop cases** before building installers. The Linux packaging job also checked the actual Debian archive's icons and desktop identity.
- Local verification passed **1,252 tests across 128 files**, both TypeScript checks, the production build, and the new real-Settings desktop workflow. That workflow uses fake credentials and intercepted model responses to check modern models, recovery from an unavailable saved model, a rejected key with redacted error feedback, and a successful refresh afterward. The final local checks ran sequentially for memory use on the development laptop.
- Live verification used a key entered directly in the app: **46 OpenAI models loaded**, the picker selected an available model, and a Responses request returned `AMAGON_OK`. Codex returned `AMAGON_CODEX_OK` through Amagon, including from an application launched in a non-Git working directory. No key was copied into source, screenshots, logs or release assets.
- A fresh full npm audit reported **zero vulnerabilities**. Package dependencies and the lockfile were unchanged by the AI correction; both manifests remain at 1.11.1.

## Linux launcher correction

The previous Debian archive installed only a 676×369 PNG under a 676×676 icon directory. Icon-theme lookup failed to find that entry. The replacement installs 13 transparent square PNGs at 16, 22, 24, 32, 48, 64, 96, 128, 192, 256, 512, 1024 and 2048 pixels. Existing 512px square ICO artwork is preserved; larger variants are upscaled. Committed PNGs total approximately 2.6 MB, and the running window uses the 512px asset. No runtime dependency was added.

The launcher filename, Electron desktopName, and StartupWMClass now agree. New source tests require the square size set and platform-specific window icon; the release workflow also extracts and checks the actual Debian archive. The old archive fails that check; the new archive passes. Icon regeneration uses Electron's existing image codecs (`npm run generate:icons`), and `npm run check:linux-package` verifies package contents.

The freshly downloaded draft Debian package was extracted and launched with an isolated profile. All 13 requested icon sizes resolved through the system icon-theme loader with transparency. The packaged 1.11.1 window exposed the expected `hoarses-html-editor` WM_CLASS and a 512×512 _NET_WM_ICON, with no renderer exceptions. This checks real icon lookup and an X11 window; a visual KDE/Wayland session was not available in this environment.

## Installer verification

All six newly uploaded installer/feed files were downloaded independently with two bounded download workers. Their sizes and SHA-256 digests match GitHub's metadata, and each asset ID differs from the preceding draft build. Windows and Linux updater SHA-512 values match their downloaded installers, including the Debian package. See [SHA256SUMS.txt](SHA256SUMS.txt).

The downloaded AppImage was extracted and launched as the actual packaged application, with `app.isPackaged` and version **1.11.1** asserted. The new Settings model-discovery/error-recovery workflow passed against that binary. It covers modern model options, unavailable-selection repair, rejected credentials with redaction, and recovery without using a real API key or incurring generation requests. The downloaded Debian archive passed static checks and a native window smoke check with all 13 requested icon sizes, expected WM_CLASS, a 512px window icon, and no renderer exceptions. Temporary installer-test applications were closed and their extracted working directories removed.

## Earlier compatibility evidence retained

The preceding icon/asset build, source `8d51ac932ad30f252e0ffc7e8539360b8d5b0160`, passed [release run 42381825689](https://github.com/Shin-Aska/amagon-html-editor/actions/runs/42381825689) with all 40 Windows and 12 portable Linux desktop cases. Earlier local maintenance checks included 100 focused cases for 10,000-entry matching, bounded rendering, ambiguous filenames, usage scopes, stale workspaces, exclusive repair, cleanup and Undo; icon-specific verification added 11 focused checks.

Against that preceding packaged build, edited copies of **all four supplied private legacy projects** converted and reopened with their original JSON bytes preserved, and **22 asset files matched byte-for-byte**. The one genuinely absent image was repaired only in a test copy. Six packaged desktop workflows covered asset/font autosave, themes/code editing, guided legacy Save, batch repair/cleanup/Undo/conversion, conversion after autosave, and font round trips. Five passed in the initial local run; the font case passed on a targeted repeat after a Playwright inspector-promise failure while mocking a file dialog. A stalled earlier Windows CI attempt was cancelled and replaced with a successful fresh run. These are historical compatibility checks; the current build's full CI desktop gates above recheck these feature paths alongside the new AI workflow.

The draft retains the Windows setup executable/blockmap, Linux AppImage/Debian package, both updater feeds and the replacement checksum manifest. It remains unpublished for owner review. Public screenshots use only synthetic fixtures: [canvas and code](canvas-code-ocean.png), [widget controls](widget-design.png), [app themes](app-themes.png), [theme creation](theme-creator.png), [legacy repair](legacy-repair.png), and [unused asset cleanup](asset-cleanup.png).
