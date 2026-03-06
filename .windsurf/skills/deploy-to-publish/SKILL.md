---
name: deploy-to-publish
description: Bumps the git tag using semantic-version rules before publishing
---

Use this skill whenever you need to publish a new build and the version tag must be incremented.

### Inputs
- **bumpType**: `patch` (default), `minor`, or `major`.

### Steps
1. Fetch the latest tags so you have the newest state:
   - `git fetch --tags`
2. Get the most recent tag (falls back to `0.0.0` if none exist):
   - `git describe --tags --abbrev=0`
3. Parse the tag into `MAJOR.MINOR.PATCH` numbers.
4. Depending on `bumpType`, update the numbers:
   - `patch` (or unspecified): increment PATCH only, e.g. `1.0.10 -> 1.0.11`.
   - `minor`: increment MINOR, reset PATCH to `0`, e.g. `1.2.5 -> 1.3.0`.
   - `major`: increment MAJOR, reset MINOR and PATCH to `0`, e.g. `1.2.5 -> 2.0.0`.
5. Create the new tag locally:
   - `git tag <newVersion>`
6. Push the tag:
   - `git push origin <newVersion>`
7. Announce the new version or run any follow-up publish steps that depend on the bumped tag.
