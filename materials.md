# Publishing Materials

## Overview

This document captures the current findings for adding a "Publish to Website" feature to Amagon.

Amagon is already in a strong position for publishing support because it exports static website output:

- HTML pages
- CSS
- image/font/document assets
- optional JavaScript

That means the first publish integrations should target static hosting providers that accept prebuilt files or folders.

## Codebase Findings

### Current export model

The current export flow already produces deployable static sites.

Relevant files:

- `src/renderer/components/ExportDialog/ExportDialog.tsx`
- `src/renderer/utils/exportEngine.ts`
- `src/main/index.ts`

What the export system already does:

- Exports one or more `.html` files
- Emits `styles.css` when CSS is not inlined
- Can inline CSS and assets for single-page export
- Rewrites internal page links for exported output
- Writes assets into an `assets/` folder when not inlined
- Supports optional JavaScript in exported pages

### Why this matters

Because the app already exports clean static output, a publish feature does not need a build server. It mainly needs:

- provider authentication
- upload/deploy adapter per host
- export validation before upload
- progress/error reporting in the UI

## Hosting Options Reviewed

### 1. Cloudflare Pages

Why it fits:

- Good match for prebuilt static exports
- Supports direct upload workflows
- Good default choice for general users
- Supports custom domains

Strengths:

- Strong static hosting platform
- More scalable than hobby-only hosts
- Good long-term default target

Potential downside:

- Slightly more "platform" oriented than a very simple file-uploader experience

Recommendation:

- Strong candidate for first-party publishing support

### 2. Neocities

Why it fits:

- Very compatible with static HTML/CSS/JS sites
- Has an upload API
- Strong fit for creative, personal, indie, and hobby websites
- Simpler mental model for users than git-based deployment

Strengths:

- Friendly for simple static websites
- API-based upload is possible from Electron
- Aligns with exported folder structure

Potential downside:

- Free accounts restrict allowed file types
- External hotlinking protections can affect linked assets from other sites

Recommendation:

- Strong candidate for early support, especially if paired with export validation

### 3. Netlify

Why it fits:

- Good support for static site deploys
- Mature deploy APIs and manual upload flows
- Good custom-domain story

Strengths:

- Well-known platform
- Good API options
- Good for users who may later want more advanced workflows

Potential downside:

- Free-plan usage limits may introduce friction for some users

Recommendation:

- Good second-wave provider if we want a broader mainstream set

### 4. Firebase Hosting

Why it fits:

- Supports static hosting
- Has API/CLI deployment flows

Strengths:

- Reliable platform
- Extensible if future features need more backend integration

Potential downside:

- More operational complexity than simpler static hosts

Recommendation:

- Viable, but likely not the best first target

### 5. GitHub Pages

Why it fits:

- Common for docs, portfolios, and open-source project sites

Strengths:

- Familiar to technical users
- Free for many static use cases

Potential downside:

- More repository-centric than "upload this exported site"
- Less ideal for a non-technical one-click publish workflow

Recommendation:

- Better as a later advanced option than a first publish target

## Recommended First Providers

Best initial pair:

- Cloudflare Pages
- Neocities

Reasoning:

- Both align well with static exports
- They cover two useful user profiles
- Neocities is simple and creative-friendly
- Cloudflare Pages is more mainstream and scalable

## Neocities Compatibility Notes

Neocities is mostly compatible with Amagon exports, but not universally compatible with every project this editor can create.

### What is compatible

Neocities supports a broad range of static website file types, including the kinds of files Amagon commonly exports:

- `.html`, `.htm`
- `.css`
- `.js`, `.json`
- `.jpg`, `.jpeg`, `.png`, `.gif`, `.svg`, `.ico`, `.webp`, `.avif`
- `.md`, `.markdown`
- `.txt`, `.csv`, `.tsv`
- `.xml`
- font formats such as `.ttf`, `.woff`, `.woff2`, `.otf`, `.eot`
- `.pdf`

For typical static-site output, this is a strong match.

### Main incompatibility

The current codebase supports video assets, but Neocities' allowed file list discussed in research does not include the common video formats currently supported by Amagon.

Video-related support in this codebase includes:

- video blocks
- video asset picking/import
- video file handling for formats like `.mp4`, `.webm`, `.ogv`, `.ogg`, `.mov`, `.m4v`

This means:

- Many projects will publish cleanly to Neocities
- Projects containing local video files may fail validation or upload

### Practical conclusion

Neocities should be treated as:

- compatible for most static projects
- conditionally incompatible for projects containing unsupported media types

## Challenges And Possible Solutions

### Challenge 1: Unsupported file types on Neocities

Problem:

- Users can create/export projects with assets that Neocities free accounts may reject
- Video is the clearest known example

Possible solutions:

- Add a pre-publish file-extension validator before upload
- Show a clear list of blocked files and why they are blocked
- Offer provider-specific guidance, such as:
  - remove the file
  - host the file elsewhere
  - choose a different provider
- Disable the "Publish" confirm action until blocking issues are resolved

Best approach:

- Provider-specific validation before any upload begins

### Challenge 2: Hotlinked external assets

Problem:

- Neocities mentions measures against hotlinking from non-Neocities sites
- Exported HTML may reference external media or third-party assets
- A published page may partially work but still show broken assets

Possible solutions:

- Detect external asset URLs during validation
- Warn users when a project depends on remote files
- Encourage importing external assets into the local project before publishing
- Keep remote links allowed, but classify them as warnings instead of hard errors where appropriate

Best approach:

- Mixed validation model:
  - blocking errors for unsupported uploaded file types
  - warnings for risky remote dependencies

### Challenge 3: Provider-specific rules and future drift

Problem:

- Hosting limits and supported workflows can change over time
- Hardcoding assumptions in UI text can become inaccurate

Possible solutions:

- Keep provider adapters isolated from general export logic
- Store provider validation rules in dedicated config/modules
- Write provider notes in a way that can be updated independently of core export code
- Add lightweight documentation for each provider integration

Best approach:

- Create a provider adapter architecture with separate validation logic per provider

### Challenge 4: Authentication inside Electron

Problem:

- Each provider has different auth methods
- Token storage must be safe and understandable

Possible solutions:

- Reuse the secure credential-storage patterns already present in the app
- Support token-based auth first before more complex OAuth flows
- Keep provider credential screens simple and provider-specific

Best approach:

- Start with the simplest secure authentication path each provider supports

### Challenge 5: Upload progress and partial failure handling

Problem:

- Publishing can fail midway through an upload
- Users need visibility into what happened

Possible solutions:

- Report progress at file level
- Surface the first clear actionable error
- Preserve logs or a publish result summary
- Separate export errors from network/provider errors

Best approach:

- Build publishing UX around explicit states:
  - validating
  - exporting
  - uploading
  - success
  - failed

### Challenge 6: User expectation of "one click"

Problem:

- Some providers are naturally more complex than others
- A flow that feels easy for Neocities may feel harder for GitHub Pages

Possible solutions:

- Start with the providers that best support direct file upload
- Present advanced providers later
- Tailor the UI copy and steps per provider instead of forcing one generic flow

Best approach:

- Optimize the first shipping version for direct-upload hosts

## Suggested Product Direction

### Phase 1

Implement publishing support for:

- Neocities
- Cloudflare Pages

Add:

- provider-specific validation
- credentials/settings UI
- publish progress UI
- success screen with published URL

### Phase 2

Consider adding:

- Netlify
- Firebase Hosting

### Phase 3

Consider more advanced workflows:

- GitHub Pages
- git-based deploys
- CI-connected publishing

## Suggested Technical Shape

One clean architecture would be:

- `publish/validators/`
- `publish/providers/`
- `publish/types/`

Possible responsibilities:

- export step stays in existing export engine
- validation step scans exported files and project references
- provider adapter uploads validated output
- UI orchestrates provider selection, credentials, progress, and results

Example conceptual interfaces:

- `validateForProvider(provider, files, project)`
- `publishToProvider(provider, files, credentials)`

## Implementation Notes

Important implementation detail:

- Validation should run against the actual exported file list, not only editor state

Why:

- The exported output is the true deployment artifact
- This avoids false assumptions about what will really be uploaded

Also useful:

- retain provider warnings in the publish result
- distinguish blocking errors vs non-blocking warnings
- make validation messages human-readable

## Summary

Key conclusion:

- Amagon is already technically well-positioned for website publishing support because it exports static sites cleanly.

Best starting providers:

- Neocities
- Cloudflare Pages

Main Neocities caveat:

- unsupported file types, especially local video assets

Best mitigation:

- provider-specific validation before upload, with clear warnings and recovery guidance
