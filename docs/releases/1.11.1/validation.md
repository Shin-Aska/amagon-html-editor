# Amagon 1.11.1 release validation

Prepared 7 November 2026. Both npm manifests identify **1.11.1**. Application source and tag: `9d9d8f600f4e791af651cb3dba86ca0ca3e8a89f`. This is an **unpublished draft** containing all widget, theme, code-editor and asset improvements. The 1.11.0 release and tag were withdrawn.

## Reproduction and corrections

The packaged 1.11.0 application reproduced both reported legacy loading and media import failures. A genuinely absent image caused strict validation to block an entire legacy project. Import results also interpreted raw filesystem filenames as encoded references, causing errors or incorrect URLs for spaces and literal percent sequences.

Legacy open and low-level autosave now preserve missing references with a persistent warning; bundle validation remains strict. Desktop manual Save and Save As open a guided repair/conversion dialog. Conversion requires repairing referenced missing assets and choosing where to save a portable `.amg`. The original JSON is preserved, and the full remaining asset library is copied. Save As acknowledgements use the originating workspace generation before installing the new session, preventing false stale-save errors after import/autosave.

The review renders at most 25 rows, supports search and pagination, and repairs batches of up to 10,000 matching files using folder suffixes or unique filenames. Ambiguous matches remain unresolved; existing files cannot be overwritten. Large opening notices show a bounded summary instead of thousands of filenames.

Unused cleanup covers unused files and missing, unapplied font entries. It checks every page, theme, preset, saved block, template and custom CSS field, retaining linked-resource dependencies, dynamic references and uncertain font usage. Selected files move outside `assets/` to project trash, and associated unused font metadata is removed. Session-scoped Undo restores the last cleanup without overwriting reimported files. Trash is excluded from bundles. Current usage and workspace generation are rechecked before cleanup. The same review is available from Asset Manager. No dependency or background index was added.

Autosave ticks received during imports or save acknowledgements coalesce into one pending tick, scoped to the original project. It runs after the current operation and importer metadata updates settle. Completed native progress cannot strand the controller in a busy state. The queue uses no idle polling timer. Import, font persistence/export, archive compatibility, Monaco cancellation handling, widget previews, themes, code editing and canvas layouts remain covered.

## Regression evidence

- [Windows/Linux regression run 42370798093](https://github.com/Shin-Aska/amagon-html-editor/actions/runs/42370798093): **1,225 tests across 126 files passed on each platform**, plus **six process-ownership checks per platform** and both application/build-configuration TypeScript checks.
- [Release gate and packaging run 42370840666](https://github.com/Shin-Aska/amagon-html-editor/actions/runs/42370840666): repeated the complete regression checks and passed **all 40 Windows desktop cases and all 12 portable Linux desktop cases** before packaging began.
- The local production build, both TypeScript checks and **100 focused maintenance/architecture checks** passed. Coverage includes 10,000-entry matching, bounded rendering/notices, ambiguous matches, quoted and percent filenames, all project usage scopes, stale sessions/workspaces, exclusive repair, cleanup, metadata-only cleanup and Undo conflicts. The new quoted-space-path regression test failed before its scan correction and then passed. Two controller regressions also failed before the autosave queue correction, then passed with the fix. Windows process lookups now request exact PIDs while preserving timeout bounds and all process-identity checks; an earlier full-system lookup timed out before the first UI test began.
- **All 12 portable desktop workflows passed locally**: asset/font autosave; guided legacy repair; 50-file batch repair with reviewed cleanup, Undo, conversion and reopening; literal media filename round trips; conversion after autosave; imported font round trips/export/deletion; themes/code editing; canvas/code layout and selection; both theme-transition formats; and widget controls.
- Edited copies of **all four supplied legacy projects converted and reopened**, preserving edits and original JSON bytes. **22 asset files matched byte-for-byte**. The one genuinely absent image was repaired using a public replacement in a test copy. Original user files were untouched, no private content was uploaded, and there were no renderer exceptions.
- A fresh full npm audit reported **zero vulnerabilities**.

## Installer verification

All six newly uploaded installer/feed assets were downloaded independently. Their sizes and SHA-256 digests match GitHub's metadata; every asset ID differs from the previous draft build. Windows and Linux update-feed SHA-512 values also match their downloaded installer payloads, including the Debian package. See [SHA256SUMS.txt](SHA256SUMS.txt).

The downloaded AppImage was extracted and launched as the actual packaged application, with `app.isPackaged` and version **1.11.1** asserted. **Six packaged desktop workflows passed**, covering asset/font autosave, themes/code editing, guided legacy Save, batch repair/cleanup/Undo/conversion, conversion after autosave, and font import/save/reopen/export/delete. Edited copies of **all four private legacy projects** also passed conversion/reopening in that packaged binary; **22 asset files matched**, original JSON bytes were preserved, and there were no renderer exceptions.

The draft retains the Windows setup executable/blockmap, Linux AppImage/Debian package, both updater feeds and the replacement checksum manifest. Packaging requires both operating-system gates to succeed. The release remains unpublished for owner review.

Public screenshots contain only synthetic fixtures: [canvas and code](canvas-code-ocean.png), [widget controls](widget-design.png), [app themes](app-themes.png), [theme creation](theme-creator.png), [legacy repair](legacy-repair.png), and [unused asset cleanup](asset-cleanup.png).
