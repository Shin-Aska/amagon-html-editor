import { mkdtemp, open, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createArchivePathIndex } from "./archivePath";
import { createOwnedWorkspaceCandidate } from "./projectWorkspace";
import { parseAmgManifest } from "../../shared/projects/amgContract";
import {
  AmgArchiveReaderError,
  extractAmgArchive,
  inspectAmgArchiveMetadata,
} from "./amgArchiveReader";
import {
  buildAmgFixture,
  growEntryCompressedRange,
  patchFirstAsciiByte,
  patchLastUint32,
  patchSignatureField,
  patchZip64EntryCount,
  replaceAsciiSameLength,
} from "./amgArchiveFixtures";

const roots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "amg-reader-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("AMG archive reader policy characterization", () => {
  it("rejects a portable-name collision before workspace initialization", async () => {
    // Given: a valid manifest-shaped boundary and a workspace initializer sentinel.
    const manifest = parseAmgManifest({
      marker: "amagon-project",
      formatVersion: 1,
      projectSchemaVersion: 1,
      projectPath: "project.json",
      entries: [
        {
          path: "project.json",
          uncompressedBytes: 0,
          sha256: "0".repeat(64),
          compression: "store",
        },
      ],
    });
    let initialized = false;

    // When: two archive spellings collide under the committed portability policy.
    const index = () =>
      createArchivePathIndex([
        "manifest.json",
        manifest.entries[0]?.path ?? "",
        "assets/PHOTO.png",
        "assets/photo.png",
      ]);

    // Then: collision rejection occurs before an owned candidate is initialized.
    expect(index).toThrow(/collides/u);
    expect(initialized).toBe(false);
    expect(typeof createOwnedWorkspaceCandidate).toBe("function");
  });
});

describe("AMG archive extraction", () => {
  it("extracts a forced-ZIP64 archive through a positional file handle", async () => {
    // Given: a forced-ZIP64 archive stored in a unique OS temporary root.
    const root = await createRoot();
    const fixture = await buildAmgFixture({ zip64: true });
    const archivePath = path.join(root, "fixture.amg");
    await writeFile(archivePath, fixture.archive);
    const archive = await open(archivePath, "r");

    // When: the archive is opened through the FileHandle-only reader boundary.
    const candidate = await extractAmgArchive({ archive, userDataPath: root });
    await archive.close();

    // Then: every declared byte is staged and the parsed project is returned.
    expect(await readFile(path.join(candidate.workspace.path, "project.json"))).toEqual(
      Buffer.from(fixture.projectBytes),
    );
    expect(await readFile(path.join(candidate.workspace.path, "assets/photo.txt"))).toEqual(
      Buffer.from(fixture.assetBytes),
    );
    expect(candidate.project.projectSettings.name).toBe("Archive fixture");
  });

  it("inspects recent metadata without creating a staging workspace", async () => {
    // Given: a valid forced-ZIP64 archive and no workspace root.
    const root = await createRoot();
    const fixture = await buildAmgFixture({ zip64: true });
    const archivePath = path.join(root, "recent.amg");
    await writeFile(archivePath, fixture.archive);
    const archive = await open(archivePath, "r");

    // When: only recent-project metadata is inspected.
    const metadata = await inspectAmgArchiveMetadata({ archive });
    await archive.close();

    // Then: bounded metadata is returned and no staging root is created.
    expect(metadata).toEqual({ name: "Archive fixture", framework: "bootstrap-5" });
    await expect(readdir(path.join(root, "amg-workspaces"))).rejects.toThrow();
  });

  it.each([
    ["traversal", (archive: Uint8Array) => replaceAsciiSameLength(archive, "assets/photo.txt", "assets/../bad.tx")],
    ["reserved name", (archive: Uint8Array) => replaceAsciiSameLength(archive, "assets/photo.txt", "assets/CON.....t")],
    ["unknown method", (archive: Uint8Array) => patchSignatureField(patchSignatureField(archive, 0x04034b50, 1, 8, 2, 99), 0x02014b50, 1, 10, 2, 99)],
    ["encryption", (archive: Uint8Array) => patchSignatureField(patchSignatureField(archive, 0x04034b50, 1, 6, 2, 1), 0x02014b50, 1, 8, 2, 1)],
    ["local mismatch", (archive: Uint8Array) => patchSignatureField(archive, 0x04034b50, 1, 8, 2, 99)],
    ["overlapping local ranges", (archive: Uint8Array) => growEntryCompressedRange(archive, 1, 1_000)],
    ["symbolic link", (archive: Uint8Array) => patchSignatureField(archive, 0x02014b50, 2, 38, 4, 0xa1ff0000)],
    ["directory", (archive: Uint8Array) => patchSignatureField(archive, 0x02014b50, 2, 38, 4, 0x10)],
    ["device", (archive: Uint8Array) => patchSignatureField(archive, 0x02014b50, 2, 38, 4, 0x21ff0000)],
    ["oversized central directory", (archive: Uint8Array) => patchLastUint32(archive, 0x06054b50, 12, 0xffffffff)],
  ])("rejects %s before creating staging", async (_name, mutate) => {
    // Given: a structurally hostile archive and an unrelated active-session sentinel.
    const root = await createRoot();
    const fixture = await buildAmgFixture();
    const archivePath = path.join(root, "hostile.amg");
    const activeSentinel = path.join(root, "active-session.txt");
    await writeFile(activeSentinel, "active-session-unchanged");
    await writeFile(archivePath, mutate(fixture.archive));
    const archive = await open(archivePath, "r");

    // When: extraction attempts to cross the hostile boundary.
    const extraction = extractAmgArchive({ archive, userDataPath: root });

    // Then: a typed rejection occurs with no staging or active-session mutation.
    await expect(extraction).rejects.toBeInstanceOf(Error);
    await archive.close();
    expect(await readFile(activeSentinel, "utf8")).toBe("active-session-unchanged");
    await expect(readdir(path.join(root, "amg-workspaces"))).rejects.toThrow();
  });

  it("rejects the ZIP64 entry-count limit before zip.js indexing", async () => {
    // Given: a small archive whose ZIP64 end record claims too many entries.
    const root = await createRoot();
    const fixture = await buildAmgFixture({ zip64: true });
    const archivePath = path.join(root, "entry-limit.amg");
    await writeFile(archivePath, patchZip64EntryCount(fixture.archive, 10_002));
    const archive = await open(archivePath, "r");

    // When: bounded positional preflight reads the archive count.
    const extraction = extractAmgArchive({ archive, userDataPath: root });

    // Then: the limit error occurs before a staging root or entry index exists.
    await expect(extraction).rejects.toMatchObject({ code: "limit-exceeded" });
    await archive.close();
    await expect(readdir(path.join(root, "amg-workspaces"))).rejects.toThrow();
  });

  it("rejects undeclared ZIP entries before staging", async () => {
    // Given: an archive with an asset omitted from its manifest.
    const root = await createRoot();
    const fixture = await buildAmgFixture({
      manifestTransform(manifest) {
        const entries = manifest["entries"];
        if (!Array.isArray(entries)) throw new TypeError("fixture entries missing");
        return { ...manifest, entries: entries.slice(0, 1) };
      },
    });
    const archivePath = path.join(root, "extra.amg");
    await writeFile(archivePath, fixture.archive);
    const archive = await open(archivePath, "r");

    // When: the manifest is reconciled with the bounded ZIP index.
    const extraction = extractAmgArchive({ archive, userDataPath: root });

    // Then: the extra entry is rejected before staging.
    await expect(extraction).rejects.toMatchObject({ code: "invalid-archive" });
    await archive.close();
    await expect(readdir(path.join(root, "amg-workspaces"))).rejects.toThrow();
  });

  it.each([
    ["missing payload", (entries: readonly unknown[]) => [
      ...entries,
      { path: "assets/zmissing.bin", uncompressedBytes: 0, sha256: "0".repeat(64), compression: "store" },
    ]],
    ["output quota", (entries: readonly unknown[]) => entries.map((entry, index) => (
      index === 0 && typeof entry === "object" && entry !== null
        ? { ...entry, uncompressedBytes: 4_294_967_297 }
        : entry
    ))],
  ])("rejects manifest %s before staging", async (_name, transformEntries) => {
    // Given: a manifest whose declared payload set violates extraction policy.
    const root = await createRoot();
    const fixture = await buildAmgFixture({
      manifestTransform(manifest) {
        const entries = manifest["entries"];
        if (!Array.isArray(entries)) throw new TypeError("fixture entries missing");
        return { ...manifest, entries: transformEntries(entries) };
      },
    });
    const archivePath = path.join(root, "manifest-policy.amg");
    await writeFile(archivePath, fixture.archive);
    const archive = await open(archivePath, "r");

    // When: the declared set is validated before extraction.
    const extraction = extractAmgArchive({ archive, userDataPath: root });

    // Then: no staging workspace is allocated.
    await expect(extraction).rejects.toBeInstanceOf(Error);
    await archive.close();
    await expect(readdir(path.join(root, "amg-workspaces"))).rejects.toThrow();
  });

  it("rejects portable case collisions before staging", async () => {
    // Given: two distinct ZIP names that collide on portable filesystems.
    const root = await createRoot();
    const project = new TextEncoder().encode(JSON.stringify({ projectSchemaVersion: 1 }));
    const fixture = await buildAmgFixture({
      payloads: [
        { path: "project.json", bytes: project },
        { path: "assets/PHOTO.txt", bytes: new Uint8Array([1]) },
        { path: "assets/photo.txt", bytes: new Uint8Array([2]) },
      ],
    });
    const archivePath = path.join(root, "collision.amg");
    await writeFile(archivePath, fixture.archive);
    const archive = await open(archivePath, "r");

    // When: archive names are indexed with the committed portable key.
    const extraction = extractAmgArchive({ archive, userDataPath: root });

    // Then: collision rejection precedes workspace creation.
    await expect(extraction).rejects.toThrow(/collides/u);
    await archive.close();
    await expect(readdir(path.join(root, "amg-workspaces"))).rejects.toThrow();
  });

  it("removes staging after a streamed payload integrity failure", async () => {
    // Given: a valid index whose later stored asset bytes were corrupted in place.
    const root = await createRoot();
    const fixture = await buildAmgFixture();
    const archivePath = path.join(root, "corrupt-payload.amg");
    await writeFile(archivePath, patchFirstAsciiByte(fixture.archive, "fixture asset bytes\n"));
    const archive = await open(archivePath, "r");

    // When: extraction fails after candidate creation while streaming the asset.
    const extraction = extractAmgArchive({ archive, userDataPath: root });

    // Then: the typed failure leaves the owned workspace root empty.
    await expect(extraction).rejects.toBeInstanceOf(Error);
    await archive.close();
    expect(await readdir(path.join(root, "amg-workspaces"))).toEqual([]);
  });

  it("rejects a manifest hash mismatch before staging", async () => {
    // Given: a manifest that declares the wrong project hash.
    const root = await createRoot();
    const fixture = await buildAmgFixture({
      manifestTransform(manifest) {
        const entries = manifest["entries"];
        if (!Array.isArray(entries)) throw new TypeError("fixture entries missing");
        return {
          ...manifest,
          entries: entries.map((entry, index) => index === 0 ? { ...entry, sha256: "f".repeat(64) } : entry),
        };
      },
    });
    const archivePath = path.join(root, "bad-hash.amg");
    await writeFile(archivePath, fixture.archive);
    const archive = await open(archivePath, "r");

    // When: manifest integrity is checked.
    const extraction = extractAmgArchive({ archive, userDataPath: root });

    // Then: integrity rejection happens before staging allocation.
    await expect(extraction).rejects.toMatchObject({ code: "integrity" } satisfies Partial<AmgArchiveReaderError>);
    await archive.close();
    await expect(readdir(path.join(root, "amg-workspaces"))).rejects.toThrow();
  });
});
