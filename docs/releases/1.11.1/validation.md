# Amagon 1.11.1 release validation

Prepared 7 November 2026. Both npm manifests identify **1.11.1**. Application source and tag: `8d51ac932ad30f252e0ffc7e8539360b8d5b0160`. This is an **unpublished draft** containing all widget, theme, code-editor and asset improvements. The 1.11.0 release and tag were withdrawn.

## Reproduction and corrections

The packaged 1.11.0 application reproduced both reported legacy loading and media import failures. A genuinely absent image caused strict validation to block an entire legacy project. Import results also interpreted raw filesystem filenames as encoded references, causing errors or incorrect URLs for spaces and literal percent sequences.

Legacy open and low-level autosave now preserve missing references with a persistent warning; bundle validation remains strict. Desktop manual Save and Save As open a guided repair/conversion dialog. Conversion requires repairing referenced missing assets and choosing where to save a portable `.amg`. The original JSON is preserved, and the full remaining asset library is copied. Save As acknowledgements use the originating workspace generation before installing the new session, preventing false stale-save errors after import/autosave.

The review renders at most 25 rows, supports search and pagination, and repairs batches of up to 10,000 matching files using folder suffixes or unique filenames. Ambiguous matches remain unresolved; existing files cannot be overwritten. Large opening notices show a bounded summary instead of thousands of filenames.

Unused cleanup covers unused files and missing, unapplied font entries. It checks every page, theme, preset, saved block, template and custom CSS field, retaining linked-resource dependencies, dynamic references and uncertain font usage. Selected files move outside `assets/` to project trash, and associated unused font metadata is removed. Session-scoped Undo restores the last cleanup without overwriting reimported files. Trash is excluded from bundles. Current usage and workspace generation are rechecked before cleanup. The same review is available from Asset Manager. No dependency or background index was added.

Autosave ticks received during imports or save acknowledgements coalesce into one pending tick, scoped to the original project. It runs after the current operation and importer metadata updates settle. Completed native progress cannot strand the controller in a busy state. The queue uses no idle polling timer. Import, font persistence/export, archive compatibility, Monaco cancellation handling, widget previews, themes, code editing and canvas layouts remain covered.

## Regression evidence

- [Windows/Linux regression run 42379724372](https://github.com/Shin-Aska/amagon-html-editor/actions/runs/42379724372): **1,231 tests across 127 files passed on each platform**, plus **six process-ownership checks per platform** and both application/build-configuration TypeScript checks.
- [Release gate and packaging run 42381825689](https://github.com/Shin-Aska/amagon-html-editor/actions/runs/42381825689): repeated the complete regression checks and passed **all 40 Windows desktop cases and all 12 portable Linux desktop cases** before packaging began.
- For the Linux icon update, the local production build, both TypeScript checks and **11 focused icon/window/architecture checks** passed. Earlier maintenance verification passed **100 focused checks**. Coverage includes 10,000-entry matching, bounded rendering/notices, ambiguous matches, quoted and percent filenames, all project usage scopes, stale sessions/workspaces, exclusive repair, cleanup, metadata-only cleanup and Undo conflicts. The new quoted-space-path regression test failed before its scan correction and then passed.
- **All 12 portable desktop workflows passed locally during the preceding maintenance verification**: guided legacy repair; 50-file batch repair with reviewed cleanup, Undo, conversion and reopening; literal media filename round trips; conversion after autosave; imported font round trips/export/deletion; themes/code editing; canvas/code layout and selection; both theme-transition formats; and widget controls.
- Edited copies of **all four supplied legacy projects converted and reopened**, preserving edits and original JSON bytes. **22 asset files matched byte-for-byte**. The one genuinely absent image was repaired using a public replacement in a test copy. Original user files were untouched, no private content was uploaded, and there were no renderer exceptions.
- A fresh full npm audit reported **zero vulnerabilities**.

The first icon-build attempt, [run 42379754364](https://github.com/Shin-Aska/amagon-html-editor/actions/runs/42379754364), stalled in the Windows desktop step and was cancelled. GitHub did not provide that job’s log archive. The final release run above used the same application commit and passed all gates on fresh runners.

## Linux launcher correction

The previous Debian archive installed only a 676×369 PNG under a 676×676 icon directory. Icon-theme lookup failed to find that entry. The replacement installs 13 transparent square PNGs at 16, 22, 24, 32, 48, 64, 96, 128, 192, 256, 512, 1024 and 2048 pixels. Existing 512px square ICO artwork is preserved; larger variants are upscaled. Committed PNGs total approximately 2.6 MB, and the running window uses the 512px asset. No runtime dependency was added.

The launcher filename, Electron desktopName, and StartupWMClass now agree. New source tests require the square size set and platform-specific window icon; the release workflow also extracts and checks the actual Debian archive. The old archive fails that check; the new archive passes. Icon regeneration uses Electron's existing image codecs (`npm run generate:icons`), and `npm run check:linux-package` verifies package contents.

The freshly downloaded draft Debian package was extracted and launched with an isolated profile. All 13 requested icon sizes resolved through the system icon-theme loader with transparency. The packaged 1.11.1 window exposed the expected `hoarses-html-editor` WM_CLASS and a 512×512 _NET_WM_ICON, with no renderer exceptions. This checks real icon lookup and an X11 window; a visual KDE/Wayland session was not available in this environment.

## Installer verification

All six newly uploaded installer/feed assets were downloaded independently. Their sizes and SHA-256 digests match GitHub's metadata; every asset ID differs from the previous draft build. Windows and Linux update-feed SHA-512 values also match their downloaded installer payloads, including the Debian package. See [SHA256SUMS.txt](SHA256SUMS.txt).

The downloaded AppImage was extracted and launched as the actual packaged application, with `app.isPackaged` and version **1.11.1** asserted. **Six packaged desktop workflows passed**, covering asset/font autosave, themes/code editing, guided legacy Save, batch repair/cleanup/Undo/conversion, conversion after autosave, and font import/save/reopen/export/delete. Edited copies of **all four private legacy projects** also passed conversion/reopening in that packaged binary; **22 asset files matched**, original JSON bytes were preserved, and there were no renderer exceptions.

The first local packaged pass completed five workflows, then Playwright lost an inspector promise while mocking the next native dialog in the font workflow. The trace shows the preceding Save and Close completed; the next Open action had not been dispatched. A targeted repeat of that same font workflow passed against the unchanged downloaded binary. The initial trace and targeted result were retained locally; no application change or blanket test retry was used. CI had independently passed the complete Windows and Linux desktop suites.

The draft retains the Windows setup executable/blockmap, Linux AppImage/Debian package, both updater feeds and the replacement checksum manifest. Packaging requires both operating-system gates to succeed. The release remains unpublished for owner review.

Public screenshots contain only synthetic fixtures: [canvas and code](canvas-code-ocean.png), [widget controls](widget-design.png), [app themes](app-themes.png), [theme creation](theme-creator.png), [legacy repair](legacy-repair.png), and [unused asset cleanup](asset-cleanup.png).
