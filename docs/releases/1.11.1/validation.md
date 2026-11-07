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

## Installer preparation

Windows x64 and Linux x64 installers will be built from the hotfix version tag using the existing release workflow. Build results, uploaded asset digests, and a downloaded packaged-app check will be recorded here after completion. The release remains a draft for owner review.

The release illustration reuses the public Ocean editor screenshot from 1.11.0. Private reproduction projects and screenshots are excluded.
