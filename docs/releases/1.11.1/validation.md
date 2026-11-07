# Amagon 1.11.1 release validation

Prepared 7 November 2026. Both npm manifests identify **1.11.1**. Application source: `152c599363582910ee74ce48d960b9536edc717f`. The replacement draft combines all widget, theme, and code-editor improvements with the asset fixes, complete feature notes, and four public screenshots. The 1.11.0 release and tag were withdrawn. Version 1.11.1 remains unpublished.

## Reproduction and fixes

The packaged 1.11.0 application reproduced both reported failures. One supplied legacy project referenced a genuinely absent in-project image; missing-file diagnostics prevented the entire project from opening. Media import copied files before interpreting raw filesystem filenames as encoded references, causing errors for spaces and percent characters and incorrect URLs for literal `%20` names.

Legacy open and ordinary Save now report missing-file warnings while retaining references for repair. The notice persists until dismissed. Bundle open/save and conversion remain strict about missing bytes. Unsafe paths, traversal, and stale session references remain blocked. Legacy external strings can be preserved without granting local-file read authority; conversion requires explicit import.

Import results encode raw filesystem paths once when constructing session URLs. Font imports now receive the same treatment at the renderer persistence boundary. Font existence checks and deletion convert only current-session font URLs back to raw paths. Export retains the original scoped source URL for reading bytes and uses safe, distinct output filenames, including when sanitized names collide.

The broader desktop gate also reproduced unhandled Monaco 0.54 word-highlighter cancellation during rapid model switching. A scoped Vite transform attaches Monaco's cancellation-aware error handler to the affected promises in production and development prebundling. Highlighting remains enabled and unexpected errors remain reportable. Tests execute the installed highlighter and Delayer code, verify real-error reporting, and guard against unreviewed upstream source changes. See [upstream issue #5294](https://github.com/microsoft/monaco-editor/issues/5294).

Empty layout-widget preview documents now fill the iframe viewport. Desktop test helpers wait for the welcome screen before opening projects, reload tests await recent-project entries, and settings tests use the current Appearance tab. No failing test was removed or uncaught renderer error filtered out.

## Regression evidence

- [Cross-platform regression run 42354517381](https://github.com/Shin-Aska/amagon-html-editor/actions/runs/42354517381): **1,179 tests across 122 files passed on both Windows and Linux**, plus **five process-ownership checks per platform** and both application/build-configuration TypeScript checks.
- The local production build and TypeScript checks pass. All **44 focused font, snapshot, and export tests** pass; seven font failures were reproduced before their fixes.
- All **seven portable desktop workflows pass locally and in Linux CI**: themes/code editing with rapid model switching and bounded model count; canvas/code layout; canvas-to-HTML selection; widget content/design/reset; eight literal media filenames; legacy missing-file repair/conversion; and font import/save/reopen/export/delete.
- Media coverage includes spaces, Unicode, `#`, literal `%`, `%20`, and `%2F`. Deleting a literal `%20` filename preserves its space-named neighbour through another saved round trip.
- The font desktop workflow exports through the real native bridge and compares the emitted font bytes with the original public font fixture, then deletes the reopened font and verifies another saved round trip.
- A fresh full npm audit reports **zero vulnerabilities**. No dependency was added for these fixes.

## Release gates

Code changes on main and all pull requests run the complete regression suite, ownership checks, and both TypeScript checks on Windows and Linux. Release packaging additionally requires **all 38 Windows desktop workflows and all seven portable Linux workflows**. Both platforms must finish verification before either packaging job can upload installers. Each test run uses one worker; failures retain synthetic-fixture screenshots and traces for diagnosis.

[Release workflow 42354525667](https://github.com/Shin-Aska/amagon-html-editor/actions/runs/42354525667) **passed both platform gates and both installer builds**, using the exact application commit above. Windows passed all **38 desktop workflows**; Linux passed all **seven**. Both jobs used clean dependency installs, production builds, TypeScript checks, packaging, and draft uploads.

The compact editor case now runs at 1008 × 660 and verifies real text focus after clicking the measured code viewport. Its local run passes. Mouse and keyboard divider resizing were independently reproduced successfully. The complete preview preference/restart workflow also passes locally through the portable harness.

## Installer verification

The draft contains **seven fresh assets**: the Windows x64 installer, blockmap, and update feed; the Linux x64 AppImage, Debian package, and update feed; and [SHA256SUMS.txt](SHA256SUMS.txt). All seven asset IDs differ from the initial draft build. Every downloaded build file independently matches its SHA-256 upload digest and declared size, including the Debian package. Both feeds identify version 1.11.1; all referenced installer/package SHA-512 digests and sizes match the downloaded files. The uploaded checksum manifest also matches the committed file.

The downloaded, extracted AppImage reports `app.isPackaged === true` and version `1.11.1`. Fresh temporary copies of **all four supplied legacy projects opened, Saved, and reopened**. Nine existing local images loaded successfully; the one genuinely absent image remained a repairable warning. Image references survived saving and reopening. Imports named `plain.png`, `with space.png`, `100%.png`, and `literal%20name.png` displayed correctly and survived an actual `.amg` save/close/reopen round trip. All of these checks recorded zero renderer errors.

The same downloaded application's `resources/app.asar` passed **two additional desktop workflows** with packaged/version/path assertions: the complete compact theme/code-editor case (including rapid model switching, bounded model count, recovery, formatting, undo, and saved-code reopening), and the font import/save/reopen/export/delete case. The latter compares exported font bytes with the original fixture and verifies that deletion survives another saved round trip. Both recorded zero renderer errors.

Windows runtime workflows pass in CI; the downloaded Windows installer was integrity-checked on Linux. A Windows installer installation was not performed on this machine. The release remains a draft for owner review.

The private reproduction archive and screenshots are excluded from the repository, release, and CI. Packaged-app checks use fresh temporary copies; the original archive remains untouched. Release illustrations are the four public feature screenshots under this directory.
