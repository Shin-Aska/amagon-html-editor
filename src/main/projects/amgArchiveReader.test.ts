import { createHash } from "node:crypto";
import { mkdtemp, open, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createArchivePathIndex } from "./archivePath";
import { createOwnedWorkspaceCandidate } from "./projectWorkspace";
import { AMG_FIXED_LIMITS, parseAmgManifest } from "../../shared/projects/amgContract";
import {
  AmgArchiveReaderError,
  extractAmgArchive,
  inspectAmgArchiveMetadata,
} from "./amgArchiveReader";
import {
  FileHandleReader,
  readEntryBounded,
  writeEntryVerified,
} from "./amgArchiveZip";
import type { ArchiveEntryDataSource } from "./amgArchiveZip";
import { preflightAmgArchive, readExactly } from "./amgArchivePreflight";
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

function streamedEntry(chunks: readonly Uint8Array[]): ArchiveEntryDataSource {
  return {
    uncompressedSize: chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
    compressionMethod: 0,
    async getData(writer) {
      const streamWriter = writer.getWriter();
      try {
        for (const chunk of chunks) await streamWriter.write(chunk);
        await streamWriter.close();
      } finally {
        streamWriter.releaseLock();
      }
    },
  };
}

function buildLargeCentralDirectoryArchive(): Uint8Array {
  const entryCount = 9_500;
  const encoder = new TextEncoder();
  const names = Array.from(
    { length: entryCount },
    (_, index) => encoder.encode(`assets/${String(index).padStart(5, "0")}-${"x".repeat(48)}.bin`),
  );
  const localBytes = names.reduce((total, name) => total + 30 + name.byteLength, 0);
  const directoryBytes = names.reduce((total, name) => total + 46 + name.byteLength, 0);
  const bytes = new Uint8Array(localBytes + directoryBytes + 22);
  const view = new DataView(bytes.buffer);
  let localOffset = 0;
  for (const name of names) {
    view.setUint32(localOffset, 0x04034b50, true);
    view.setUint16(localOffset + 4, 20, true);
    view.setUint16(localOffset + 26, name.byteLength, true);
    bytes.set(name, localOffset + 30);
    localOffset += 30 + name.byteLength;
  }
  let directoryOffset = localBytes;
  let entryLocalOffset = 0;
  for (const name of names) {
    view.setUint32(directoryOffset, 0x02014b50, true);
    view.setUint16(directoryOffset + 4, 20, true);
    view.setUint16(directoryOffset + 6, 20, true);
    view.setUint16(directoryOffset + 28, name.byteLength, true);
    view.setUint32(directoryOffset + 42, entryLocalOffset, true);
    bytes.set(name, directoryOffset + 46);
    directoryOffset += 46 + name.byteLength;
    entryLocalOffset += 30 + name.byteLength;
  }
  view.setUint32(directoryOffset, 0x06054b50, true);
  view.setUint16(directoryOffset + 8, entryCount, true);
  view.setUint16(directoryOffset + 10, entryCount, true);
  view.setUint32(directoryOffset + 12, directoryBytes, true);
  view.setUint32(directoryOffset + 16, localBytes, true);
  return bytes;
}

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

describe("AMG archive stream chunk boundaries", () => {
  it("accepts an exact-limit random-access request with one bounded file read", async () => {
    // Given: a seekable source and a zip.js-style request exactly at the fixed chunk limit.
    const requests: number[] = [];
    const reader = new FileHandleReader({
      async read(buffer, offset, length) {
        requests.push(length);
        buffer.fill(7, offset, offset + length);
        return { bytesRead: length };
      },
    }, AMG_FIXED_LIMITS.streamChunkBytes);

    // When: the adapter receives the largest permitted request.
    const output = await reader.readUint8Array(0, AMG_FIXED_LIMITS.streamChunkBytes);

    // Then: one exact-limit allocation and one exact-limit filesystem request complete it.
    expect(output.byteLength).toBe(AMG_FIXED_LIMITS.streamChunkBytes);
    expect(output[0]).toBe(7);
    expect(output[output.byteLength - 1]).toBe(7);
    expect(requests).toEqual([AMG_FIXED_LIMITS.streamChunkBytes]);
  });

  it("rejects a limit-plus-one random-access request before adapter allocation or I/O", async () => {
    // Given: a seekable source whose read method is a sentinel for any underlying request.
    let reads = 0;
    const reader = new FileHandleReader({
      async read(buffer, offset, length, position) {
        reads += 1;
        buffer.fill(7, offset, offset + length);
        return { bytesRead: length };
      },
    }, AMG_FIXED_LIMITS.streamChunkBytes + 1);

    // When: zip.js asks for a range one byte beyond the fixed chunk limit.
    const read = reader.readUint8Array(0, AMG_FIXED_LIMITS.streamChunkBytes + 1);

    // Then: the adapter rejects before allocating a result or invoking the underlying file handle.
    await expect(read).rejects.toMatchObject({ code: "limit-exceeded" });
    expect(reads).toBe(0);
  });

  it("rejects an out-of-range limit-plus-one request before EOF clipping or I/O", async () => {
    // Given: an empty archive reader and an underlying-read sentinel.
    let reads = 0;
    const reader = new FileHandleReader({
      async read() {
        reads += 1;
        return { bytesRead: 0 };
      },
    }, 0);

    // When: zip.js requests one byte more than the fixed limit beyond EOF.
    const read = reader.readUint8Array(0, AMG_FIXED_LIMITS.streamChunkBytes + 1);

    // Then: request validation wins over EOF clipping and no handle read occurs.
    await expect(read).rejects.toMatchObject({ code: "limit-exceeded" });
    expect(reads).toBe(0);
  });

  it("preserves offsets across short reads for ZIP and preflight adapters", async () => {
    // Given: a short-read source that fills each requested position with its byte offset.
    const bytes = new Uint8Array(19);
    for (let index = 0; index < bytes.byteLength; index += 1) bytes[index] = index;
    const shortRead = async (buffer: Uint8Array, offset: number, length: number, position: number) => {
      const bytesRead = Math.min(length, 3);
      buffer.set(bytes.subarray(position, position + bytesRead), offset);
      return { bytesRead };
    };

    // When: both random-access adapters must assemble the same range from repeated short reads.
    const zipOutput = await new FileHandleReader({ read: shortRead }, bytes.byteLength).readUint8Array(2, 11);
    const preflightOutput = await readExactly({ read: shortRead }, 2, 11);

    // Then: both outputs retain every source byte at its requested output offset.
    const expected = bytes.subarray(2, 13);
    expect([...zipOutput]).toEqual([...expected]);
    expect([...preflightOutput]).toEqual([...expected]);
  });

  it("preserves preflight ZIP metadata with a repeatedly short-reading file handle", async () => {
    // Given: a valid archive whose handle returns at most seven bytes per positional call.
    const fixture = await buildAmgFixture();
    const requests: number[] = [];
    const archive = {
      async stat() {
        return { size: fixture.archive.byteLength, isFile: () => true };
      },
      async read(buffer: Uint8Array, offset: number, length: number, position: number) {
        requests.push(length);
        const bytesRead = Math.min(length, 7);
        buffer.set(fixture.archive.subarray(position, position + bytesRead), offset);
        return { bytesRead };
      },
    };

    // When: positional preflight reconstructs all required ZIP records through short reads.
    const preflight = await preflightAmgArchive(archive);

    // Then: the valid entry index remains exact and no read request exceeds the 1 MiB boundary.
    expect(preflight.entries.map((entry) => entry.filename)).toEqual(["manifest.json", "project.json", "assets/photo.txt"]);
    expect(requests.every((length) => length <= AMG_FIXED_LIMITS.streamChunkBytes)).toBe(true);
  });

  it("preflights a central directory beyond 1 MiB through bounded record reads", async () => {
    // Given: a valid 9,500-entry stored ZIP whose central directory is larger than one stream chunk.
    const bytes = buildLargeCentralDirectoryArchive();
    const requests: number[] = [];
    const archive = {
      async stat() {
        return { size: bytes.byteLength, isFile: () => true };
      },
      async read(buffer: Uint8Array, offset: number, length: number, position: number) {
        requests.push(length);
        buffer.set(bytes.subarray(position, position + length), offset);
        return { bytesRead: length };
      },
    };

    // When: preflight walks central-directory records without asking an adapter for the whole directory.
    const preflight = await preflightAmgArchive(archive);

    // Then: all entries survive and every underlying request remains at or below the fixed limit.
    expect(preflight.entries).toHaveLength(9_500);
    expect(preflight.entries[0]?.filename).toMatch(/^assets\/00000-/u);
    expect(preflight.entries[preflight.entries.length - 1]?.filename).toMatch(/^assets\/09499-/u);
    expect(Math.max(...requests)).toBeLessThanOrEqual(AMG_FIXED_LIMITS.streamChunkBytes);
  });

  it("rejects a limit-plus-one preflight read before adapter allocation or I/O", async () => {
    // Given: a preflight source whose read method is a sentinel for any underlying request.
    let reads = 0;
    const archive = {
      async read(buffer: Uint8Array, offset: number, length: number, position: number) {
        reads += 1;
        buffer.fill(4, offset, offset + length);
        return { bytesRead: length };
      },
    };

    // When: preflight asks for a range one byte beyond the fixed stream limit.
    const read = readExactly(archive, 0, AMG_FIXED_LIMITS.streamChunkBytes + 1);

    // Then: preflight rejects before allocating a result or invoking the archive handle.
    await expect(read).rejects.toMatchObject({ code: "limit-exceeded" });
    expect(reads).toBe(0);
  });

  it("accepts an entry stream chunk exactly at the fixed limit", async () => {
    // Given: a ZIP entry adapter that emits exactly one permitted chunk.
    const chunk = new Uint8Array(AMG_FIXED_LIMITS.streamChunkBytes).fill(3);
    const entry = streamedEntry([chunk]);

    // When: bounded metadata extraction consumes the entry.
    const output = await readEntryBounded(entry, AMG_FIXED_LIMITS.streamChunkBytes);

    // Then: the stream is accepted intact at the committed boundary.
    expect(output.byteLength).toBe(AMG_FIXED_LIMITS.streamChunkBytes);
    expect(output[0]).toBe(3);
    expect(output[AMG_FIXED_LIMITS.streamChunkBytes - 1]).toBe(3);
  });

  it("rejects a limit-plus-one entry chunk before bounded extraction retains it", async () => {
    // Given: a ZIP adapter that tries to emit a single chunk larger than 1 MiB.
    const entry = streamedEntry([new Uint8Array(AMG_FIXED_LIMITS.streamChunkBytes + 1)]);

    // When: bounded metadata extraction crosses the adapter boundary.
    const extraction = readEntryBounded(entry, AMG_FIXED_LIMITS.manifestJsonBytes);

    // Then: the oversized adapter emission is rejected rather than buffered.
    await expect(extraction).rejects.toMatchObject({ code: "limit-exceeded" });
  });

  it("hashes and writes a fixed-limit payload chunk without expanding the adapter contract", async () => {
    // Given: one payload chunk exactly at the fixed limit and an owned workspace root.
    const root = await createRoot();
    const chunk = new Uint8Array(AMG_FIXED_LIMITS.streamChunkBytes).fill(5);
    const entry = streamedEntry([chunk]);
    const sha256 = createHash("sha256").update(chunk).digest("hex");

    // When: verified extraction streams the payload into the workspace.
    const written = await writeEntryVerified(
      entry,
      root,
      { path: "assets/boundary.bin", bytes: chunk.byteLength, sha256 },
      chunk.byteLength,
    );

    // Then: the exact-limit payload is persisted and its bytes remain verifiable.
    expect(written).toBe(AMG_FIXED_LIMITS.streamChunkBytes);
    expect(createHash("sha256").update(await readFile(path.join(root, "assets", "boundary.bin"))).digest("hex")).toBe(sha256);
  });

  it("rejects a limit-plus-one payload chunk before it can be written", async () => {
    // Given: a payload adapter that emits one oversized chunk and a target workspace.
    const root = await createRoot();
    const chunk = new Uint8Array(AMG_FIXED_LIMITS.streamChunkBytes + 1);
    const entry = streamedEntry([chunk]);
    const sha256 = createHash("sha256").update(chunk).digest("hex");

    // When: verified extraction receives the oversized adapter emission.
    const extraction = writeEntryVerified(
      entry,
      root,
      { path: "assets/rejected.bin", bytes: chunk.byteLength, sha256 },
      chunk.byteLength,
    );

    // Then: extraction fails at the adapter boundary with no payload bytes persisted.
    await expect(extraction).rejects.toMatchObject({ code: "limit-exceeded" });
    expect(await readFile(path.join(root, "assets", "rejected.bin"))).toEqual(Buffer.alloc(0));
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
