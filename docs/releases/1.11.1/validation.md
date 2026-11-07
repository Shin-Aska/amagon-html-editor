# Amagon 1.11.1 hotfix validation

Prepared 7 November 2026 on `main`. Both npm manifests identify version **1.11.1**. This patch release fixes project asset handling without changing dependencies or adding background services. The published 1.11.0 release remains intact; 1.11.1 is prepared as a separate draft.

## Reproduction and changes

The packaged 1.11.0 application reproduced both reported failures. A legacy project with one genuinely absent in-project image could not open because missing-file diagnostics were fatal. Media import copied files first, then interpreted raw filesystem filenames as encoded asset references, producing errors for spaces and percent signs or an incorrect URL for a literal `%20` filename.

Legacy open and ordinary Save now opt into missing-file warnings while retaining unresolved references for repair. Strict validation remains the default; bundle open/save and legacy-to-bundle conversion still reject missing assets, and invalid paths remain blocking. Import results encode filesystem-relative paths before building session URLs while retaining raw paths for filesystem operations.

## Source verification

- Added **14 regression cases**, including all three media pickers, spaces, Unicode, `#`, literal `%`, `%20`, `%2F`, legacy staging/save/reopen, renderer warnings, and strict bundle/path checks.
- The full source run completed **1,158 of 1,160 tests successfully** across 121 files. Two unchanged preview tests exceeded their five-second limits while type checking overlapped the run. An isolated rerun of both preview files passed **all 19 tests** without changing their timeouts or assertions. Every new regression passed in the full run.
- TypeScript checking and the production build passed on the fixed application source.
- After the version bump, all **70 focused checks** across five asset/legacy/renderer test files passed.
- The rebuilt Electron application opened all four supplied legacy projects. Existing images loaded; the genuinely absent file was identified in a warning. The original private archive was unchanged and is not included in this repository or the release.
- Imports named `plain.png`, `with space.png`, `100%.png`, and `literal%20name.png` displayed without error and survived an actual `.amg` save/close/reopen round trip, with zero renderer page errors.

## Built installers

[GitHub Actions run 42345677471](https://github.com/Shin-Aska/amagon-html-editor/actions/runs/42345677471) **succeeded on Windows and Linux**, including clean dependency installs, production builds, TypeScript checks, packaging, and draft uploads. Both jobs built tag `v1.11.1` at application commit `9cf7f7532dd4253d6650e41a6e58924f8e37270c`. The subsequent verification commit changes release records only.

The [1.11.1 draft on the Releases page](https://github.com/Shin-Aska/amagon-html-editor/releases) contains seven assets: the Windows x64 installer, its blockmap and update feed; the Linux x64 AppImage, Debian package and update feed; and [SHA256SUMS.txt](SHA256SUMS.txt). The manifest records GitHub's SHA-256 upload digests for all six build files. Its uploaded digest also matches the committed manifest.

The downloaded AppImage, Windows installer, blockmap, and both update feeds independently match their SHA-256 upload digests and declared sizes. Both feeds identify version 1.11.1; their SHA-512 checksums match the downloaded Windows installer and Linux AppImage respectively.

The downloaded and extracted AppImage reports `app.isPackaged === true` and version `1.11.1`. In that packaged application, fresh temporary copies of **all four supplied legacy projects opened, Saved, and reopened**. Existing images loaded, and the genuinely absent image remained a repairable warning. The four filename import cases also passed in the packaged application and survived `.amg` save/close/reopen, with zero renderer page errors. Private project files and screenshots were not uploaded.

Windows packaging is verified by CI and downloaded-file integrity checks; a Windows runtime launch was not performed on this Linux machine. The release remains a draft for owner review. The published 1.11.0 release and its assets were verified unchanged.

The release illustration reuses the public Ocean editor screenshot from 1.11.0. Private reproduction projects and screenshots are excluded.
