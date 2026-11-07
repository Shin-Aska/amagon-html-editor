# Amagon 1.11.1 release validation

Prepared 7 November 2026. Both npm manifests identify **1.11.1**. The release remains an unpublished draft; 1.11.0's release and tag have been withdrawn.

> A fresh Windows/Linux regression and installer build is required for the batch repair and cleanup changes. Final artifact identifiers and checksums will be recorded after the gates pass. The existing checksum manifest still describes the earlier installers.

## Reproduction and corrections

The packaged 1.11.0 application reproduced the reported legacy loading and media import failures. One supplied legacy project genuinely lacked a referenced image, but strict missing-file validation blocked the whole project. Import results also interpreted raw filesystem filenames as encoded references, causing errors or incorrect URLs for spaces and literal percent sequences.

Legacy open and low-level autosave now retain missing references with a persistent warning; bundle validation remains strict. Desktop manual Save and Save As open a guided repair/conversion dialog. Conversion requires repairing referenced missing assets, choosing a destination, and saving a portable `.amg`. The original JSON is preserved, and the full remaining asset library is copied. A separate Save As acknowledgement fix prevents a newly converted workspace's reset generation from falsely appearing stale after an import/autosave.

The review renders at most 25 entries and supports searching, pagination, and filename/folder-suffix batch repair with up to 10,000 replacements. Ambiguous matches remain unresolved and existing files cannot be overwritten. Large opening notices show a bounded summary instead of thousands of filenames.

Unused cleanup covers both unused files and missing, unapplied font entries. Usage checks consider all pages, themes, presets, saved blocks, templates and custom CSS. Linked resources, dynamic code and uncertain font usage are retained. Cleanup rechecks current references and workspace generation before moving selected files outside `assets/` into project trash. Associated unused font metadata is removed; session-scoped Undo restores the last cleanup without overwriting reimported files. Trash is excluded from bundles. The same review is available from Asset Manager.

Import, font persistence/export, archive compatibility, Monaco cancellation handling, widget previews, app themes and code-editor improvements remain covered. No dependency or background index was added.

## Completed local verification

- Production build and both application/build-configuration TypeScript checks passed.
- **70 focused checks passed**, including 10,000-entry matching/review/notification coverage, conservative usage detection, stale sessions/workspaces, exclusive repair, cleanup and Undo, metadata-only cleanup, and module architecture.
- The broad local run passed 1,218 tests and caught a newly added quoted-space-filename case before the final scan correction. The corrected scan and all focused checks then passed; a fresh complete Windows/Linux run is required below.
- **All 11 portable desktop workflows passed**: guided legacy repair, 50-file batch repair with reviewed cleanup/Undo/conversion/reopening, literal media filename round trips, conversion after autosave, imported font round trips/export/deletion, app themes/code editing, canvas/code layout and selection, both theme-transition formats, and widget controls.
- Edited copies of **all four supplied legacy projects converted and reopened**, preserving edits and original JSON bytes. **22 asset files were checked byte-for-byte**; the one genuinely absent image was repaired using a public replacement in a test copy. No private content was uploaded, and no renderer exceptions were observed.
- A fresh full npm audit reported **zero vulnerabilities**.

## Required release gates

The complete suite, process ownership checks and both TypeScript checks run on Windows and Linux. Release packaging additionally requires all Windows desktop cases and the 11 portable Linux cases; both verification jobs must pass before either platform uploads installers.

After packaging, download and independently verify all six installer/feed assets, validate update-feed SHA-512 hashes, replace the checksum manifest, and test the actual packaged AppImage (including version/packaged-state assertions, batch repair/cleanup, and all four private legacy project copies). Keep the release unpublished for owner review.

Public screenshots contain only synthetic fixtures: [canvas and code](canvas-code-ocean.png), [widget controls](widget-design.png), [app themes](app-themes.png), [theme creation](theme-creator.png), [legacy repair](legacy-repair.png), and [unused asset cleanup](asset-cleanup.png).
