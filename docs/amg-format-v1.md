# Amagon project bundle format v1

An `.amg` file is a ZIP64-capable, self-contained Amagon project. It is the default desktop project format. The format is intentionally small: a valid archive contains exactly one `manifest.json`, one `project.json`, and zero or more regular files below `assets/`.

## Package layout

```text
portfolio.amg
├── manifest.json
├── project.json
└── assets/
    ├── hero.webp
    └── fonts/inter.woff2
```

No other top-level entry, directory entry, link, device, encrypted entry, or undeclared payload is valid. Writers create a sibling temporary archive, flush and close it, then atomically replace the destination; they never mutate an archive in place.

## Manifest

`manifest.json` is UTF-8 JSON with this strict shape:

```json
{
  "marker": "amagon-project",
  "formatVersion": 1,
  "projectSchemaVersion": 1,
  "projectPath": "project.json",
  "entries": [
    {
      "path": "project.json",
      "uncompressedBytes": 1234,
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "compression": "deflate"
    }
  ]
}
```

The ordered `entries` array declares every payload except the manifest itself. Each SHA-256 is lowercase hexadecimal and covers the uncompressed bytes. Readers compare the declared and streamed byte counts and hashes before activating the extracted session.

`project.json` is the version-1 project document. New writers include `projectSchemaVersion: 1` and top-level `customCss` (including the empty string). Dynamic block/plugin properties are preserved, while publisher credentials are forbidden.

## Portable paths and references

Archive paths are NFC-normalized, UTF-8, relative POSIX paths. They use `/`, contain no empty, `.` or `..` segments, and reject controls, backslashes, absolute/drive/UNC paths, Windows-illegal characters, trailing dots/spaces, reserved device names, duplicate normalized names, and portable case collisions.

Durable bundled references are percent-encoded, session-neutral `assets/**` paths. Runtime media uses `app-media://project-asset/<opaque-session-id>/assets/**`; that URL is never persisted. The main process validates the session before acquiring a read lease, so an old URL cannot read a newly opened project. HTTP and HTTPS references remain literal and are never fetched for bundling.

Legacy `.json` projects may retain their already-approved absolute, `file:`, or legacy absolute `app-media` references during ordinary Save. Converting with Save As rejects those references until the user explicitly imports the files. Conversion and later bundle edits do not rewrite or delete the legacy source.

## Fixed limits

| Control | Limit |
| --- | ---: |
| Payload entries (`project.json` plus `assets/**`) | 10,000 |
| Total ZIP entries including the manifest | 10,001 |
| `project.json` UTF-8 bytes | 16,777,216 |
| `manifest.json` UTF-8 bytes | 8,388,608 |
| One asset, uncompressed | 2,147,483,648 |
| Total uncompressed payload/staging output | 4,294,967,296 |
| Compressed archive input/output | 4,362,076,160 |
| Central directory | 16,777,216 |
| One archive path, UTF-8 | 1,024 |
| Stream chunk | 1,048,576 |
| Aggregate queued stream data | 16,777,216 |
| Concurrent payload streams | 1 |

Limits are checked against declared metadata and actual streamed writes. The reader finds EOCD/ZIP64 records with bounded positional tail reads and validates counts, offsets, lengths, local headers, and non-overlapping ranges before extraction.

## Compatibility and migration

- Desktop New Project and Save As write `.amg`; a conflicting extension is rejected and the save dialog is shown again.
- Existing legacy `.json` projects still open and Save atomically in place. They are never converted silently.
- Save As from legacy JSON creates a new `.amg` and switches sessions only after the archive and recent-project record commit.
- Browser development remains legacy-JSON-only. Version 1 adds no browser bundle reader, OS file association, command-line/open-file routing, recovery UI, encryption, or signing.

## Failures and security model

The UI maps failures to stable codes: `ARCHIVE_INVALID`, `ARCHIVE_LIMIT_EXCEEDED`, `ARCHIVE_INTEGRITY_FAILED`, `PROJECT_NOT_PORTABLE`, `STALE_SESSION`, `STALE_RENDERER_GENERATION`, `BUSY`, `RECENT_NOT_FOUND`, `PATH_AUTHORITY_FORBIDDEN`, and `INTERNAL`. A failed open or Save As leaves the prior session and last valid target intact. Workspace cleanup applies only to unpredictable app-owned directories with a valid ownership sentinel and waits for active media leases.

SHA-256 detects accidental or malicious payload changes after the manifest was produced, but v1 is not signed or encrypted and does not establish author identity. Treat every `.amg` file as untrusted input.

## Fixture examples

The automated regression suites create fixtures at runtime: a small forced-ZIP64 valid archive, a same-length traversal-name mutation, corrupt/overlapping-range archives, and synthetic limit streams. This exercises ZIP64 and error boundaries without committing multi-gigabyte files. Run the real Electron matrix with:

```bash
npm run build
npm run test:e2e:electron -- --project=amg
```

## Dependencies and licenses

- `@zip.js/zip.js` 2.9.x, BSD-3-Clause: streaming ZIP/ZIP64 read and write support.
- Zod 4.x, MIT: runtime parsing at file and IPC trust boundaries.
- `@playwright/test` 1.62.x, Apache-2.0: development-only Electron regression automation and traces.

Amagon itself remains GPL-3.0-or-later. Dependency license texts and notices are distributed according to their respective packages.
