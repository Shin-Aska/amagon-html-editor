// @vitest-environment node
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ArchivePathError,
  canonicalizeArchivePath,
  createArchivePathIndex,
  resolveArchivePath,
  resolveExistingArchiveFile,
} from "./archivePath";

describe("portable archive path policy", () => {
  it("accepts an NFC relative POSIX asset path", () => {
    // Given: a portable nested path.
    const input = "assets/images/éclair.png";
    // When: the archive boundary canonicalizes it.
    const canonical = canonicalizeArchivePath(input);
    // Then: the canonical path is unchanged.
    expect(canonical).toBe(input);
  });

  it.each([
    "",
    "/assets/x.png",
    "C:/assets/x.png",
    "//server/share/x.png",
    "assets\\x.png",
    "assets//x.png",
    "assets/./x.png",
    "assets/../x.png",
    "assets/x:.png",
    "assets/x?.png",
    "assets/x*.png",
    "assets/x<.png",
    'assets/x".png',
    "assets/x>.png",
    "assets/x|.png",
    "assets/trailing. ",
    "assets/CON",
    "assets/com1.txt",
    "assets/LPT9.png",
    "assets/control\u0001.png",
    "assets/e\u0301.png",
  ])("rejects non-portable path %j", (input) => {
    // Given: an archive name that is not portable.
    // When: the archive boundary canonicalizes it.
    const canonicalize = () => canonicalizeArchivePath(input);
    // Then: it fails with a typed path error.
    expect(canonicalize).toThrow(ArchivePathError);
  });

  it("rejects a path beyond 1024 UTF-8 bytes", () => {
    // Given: an otherwise valid path over the byte limit.
    const input = `assets/${"a".repeat(1018)}`;
    // When: the boundary counts UTF-8 bytes.
    const canonicalize = () => canonicalizeArchivePath(input);
    // Then: it rejects the over-limit name.
    expect(canonicalize).toThrow(ArchivePathError);
  });

  it.each([
    ["assets/Foo.png", "assets/foo.png"],
    ["assets/É.png", "assets/é.png"],
    ["assets/Σ.txt", "assets/ς.txt"],
    ["assets/ß.txt", "assets/SS.txt"],
    ["assets/x.png", "assets/x.png"],
  ])("rejects duplicate or portable-colliding names", (first, second) => {
    // Given: two names that collide on a portable filesystem.
    // When: the archive index is built.
    const index = () => createArchivePathIndex([first, second]);
    // Then: the ambiguity is rejected before extraction.
    expect(index).toThrow(ArchivePathError);
  });

  it("resolves a regular file without escaping through a symlink", async () => {
    // Given: a real asset plus a sibling symlink pointing outside the root.
    const root = await mkdtemp(path.join(tmpdir(), "amg-archive-path-"));
    const outside = await mkdtemp(path.join(tmpdir(), "amg-archive-outside-"));
    await mkdir(path.join(root, "assets"));
    await writeFile(path.join(root, "assets", "safe.txt"), "safe");
    await writeFile(path.join(outside, "secret.txt"), "secret");
    await symlink(outside, path.join(root, "assets", "linked"), "junction");

    // When: regular and linked paths are resolved through the security boundary.
    const safe = await resolveExistingArchiveFile(
      root,
      canonicalizeArchivePath("assets/safe.txt"),
    );
    const linked = resolveExistingArchiveFile(
      root,
      canonicalizeArchivePath("assets/linked/secret.txt"),
    );

    // Then: containment resolves the regular file and rejects the reparse path.
    expect(safe).toBe(resolveArchivePath(root, "assets/safe.txt"));
    await expect(linked).rejects.toThrow(ArchivePathError);
  });
});
