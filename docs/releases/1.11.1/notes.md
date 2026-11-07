![Amagon canvas and code editor in Ocean](../1.11.0/canvas-code-ocean.png)

Amagon 1.11.1 fixes legacy project loading and media imports, so a missing image or a filename containing spaces no longer interrupts your work.

## Keep working on legacy projects

Legacy JSON projects now open and Save even when a referenced project asset is missing. A notice identifies the missing file so you can restore it or replace its reference while continuing to edit the rest of the project.

Converting to a portable `.amg` project still requires the referenced assets to exist. Unsafe paths and invalid asset references remain blocked.

## Reliable image and video imports

Media imports now preserve filenames containing spaces, Unicode, `#`, and literal `%` characters. This fixes percent-encoding errors shown after a file had already been copied, and incorrect returned URLs for filenames containing sequences such as `%20` or `%2F`.

The correction applies to Asset Manager imports and the image, single-image, and video pickers. Imported files remain available after saving and reopening the project.

## Downloads

| Platform | Download |
| --- | --- |
| Windows x64 | [Windows installer](https://github.com/Shin-Aska/amagon-html-editor/releases/download/v1.11.1/Amagon-HTML-Editor-Setup-1.11.1.exe) |
| Linux x64 | [AppImage](https://github.com/Shin-Aska/amagon-html-editor/releases/download/v1.11.1/Amagon-HTML-Editor-1.11.1.AppImage) · [Debian / Ubuntu](https://github.com/Shin-Aska/amagon-html-editor/releases/download/v1.11.1/hoarses-html-editor_1.11.1_amd64.deb) |

[SHA-256 checksums](https://github.com/Shin-Aska/amagon-html-editor/releases/download/v1.11.1/SHA256SUMS.txt)

macOS binaries are not included in this release.

**Full changelog:** [v1.11.0 → v1.11.1](https://github.com/Shin-Aska/amagon-html-editor/compare/v1.11.0...v1.11.1)

**Validation:** [Hotfix verification](https://github.com/Shin-Aska/amagon-html-editor/blob/main/docs/releases/1.11.1/validation.md)
