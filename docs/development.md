# Development Guide

## Prerequisites

- Node.js 22.12+ (required by Electron 42)
- npm

## Install & Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build        # Full Electron build
npm run build:web    # Web-only build
npm test             # Run tests
```

## Distributable Packages

```bash
npm run dist:linux   # AppImage + .deb
npm run dist:mac     # .dmg (x64 + arm64)
npm run dist:win     # NSIS installer (x64)
```

---

## Linux: Electron Sandbox Setup

### Ubuntu 24.04 and later

Ubuntu 24.04 introduced a stricter AppArmor restriction on unprivileged user namespaces, which Electron's sandbox relies on. Without a fix, the app will crash at startup with:

```
FATAL: The SUID sandbox helper binary was found, but is not configured correctly.
```

Apply this fix once to resolve it permanently for both dev mode and packaged builds:

```bash
echo 'kernel.apparmor_restrict_unprivileged_userns=0' | sudo tee /etc/sysctl.d/60-apparmor-namespace.conf
sudo sysctl -p /etc/sysctl.d/60-apparmor-namespace.conf
```

This takes effect immediately and persists across reboots.

### Other Linux distributions

On distributions that use the SUID sandbox (non-Ubuntu), fix the sandbox binary permissions after `npm install`:

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

Note: this needs to be re-run after any `npm install` that updates the `electron` package.


## Font catalog and release preparation

`npm run generate:fonts` downloads Fontsource APIv2 metadata from a pinned upstream commit, validates its shape, and fetches optional Google Fonts popularity ranks. The shipped editor continues to use the checked-in catalog offline. To verify generation without changing that catalog, run `npm run generate:fonts -- --output /tmp/amagon-fonts.json`. Update `METADATA_URL` in `scripts/google-fonts-metadata.ts` when intentionally refreshing the upstream snapshot.

For 1.11.0 screenshots, build first and run `npx tsx scripts/capture-release-screenshots.ts`. Capture uses a disposable Electron profile and project. See [release validation](releases/1.11.0/validation.md) for dependency compatibility decisions and check results.
