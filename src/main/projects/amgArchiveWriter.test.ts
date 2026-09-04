// @vitest-environment node

import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, open, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ZipWriter } from "@zip.js/zip.js";
import { afterEach, describe, expect, it } from "vitest";
import { AMG_FIXED_LIMITS, parseAmgManifest } from "../../shared/projects/amgContract";
import type { AtomicFileHandle, AtomicFileSystem } from "./atomicFile";
import { preflightAmgArchive } from "./amgArchivePreflight";
import { extractAmgArchive } from "./amgArchiveReader";
import { openValidatedZip, readEntryBounded } from "./amgArchiveZip";
import { TEST_PROJECT } from "./amgArchiveFixtures";
import {
  AmgArchiveWriterError,
  writeAmgArchive,
  type AmgZipWriter,
  type AmgZipWriterFactory,
} from "./amgArchiveWriter";

const roots: string[] = [];
const decoder = new TextDecoder();

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "amg-writer-"));
  roots.push(root);
  await mkdir(path.join(root, "workspace", "assets"), { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function signatureCount(bytes: Uint8Array, signature: number): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let count = 0;
  for (let offset = 0; offset <= bytes.byteLength - 4; offset += 1) {
    if (view.getUint32(offset, true) === signature) count += 1;
  }
  return count;
}

async function inspectArchive(archivePath: string): Promise<{
  readonly paths: readonly string[];
  readonly methods: readonly number[];
  readonly manifestText: string;
}> {
  const archive = await open(archivePath, "r");
  try {
    const preflight = await preflightAmgArchive(archive);
    const zip = await openValidatedZip(archive, preflight);
    try {
      const manifest = zip.entries.get("manifest.json");
      if (manifest === undefined) throw new TypeError("manifest missing");
      const manifestText = decoder.decode(await readEntryBounded(manifest, AMG_FIXED_LIMITS.manifestJsonBytes));
      return {
        paths: preflight.entries.map((entry) => entry.filename),
        methods: preflight.entries.map((entry) => entry.compressionMethod),
        manifestText,
      };
    } finally {
      await zip.reader.close();
    }
  } finally {
    await archive.close();
  }
}

class TestFaultError extends Error {
  readonly name = "TestFaultError";
  constructor(readonly stage: string) {
    super(`injected ${stage} fault`);
  }
}

function faultingFileSystem(stage: "write" | "sync" | "close" | "rename"): AtomicFileSystem {
  return {
    open: async (filePath, flags, mode) => {
      const handle = await open(filePath, flags, mode);
      const wrapped: AtomicFileHandle = {
        write: async (buffer) => {
          if (stage === "write") throw new TestFaultError(stage);
          return handle.write(buffer);
        },
        sync: async () => {
          if (stage === "sync") throw new TestFaultError(stage);
          await handle.sync();
        },
        close: async () => {
          await handle.close();
          if (stage === "close") throw new TestFaultError(stage);
        },
      };
      return wrapped;
    },
    rename: async (source, target) => {
      if (stage === "rename") throw new TestFaultError(stage);
      const fileSystem = await import("node:fs/promises");
      await fileSystem.rename(source, target);
    },
    unlink: async (filePath) => {
      const fileSystem = await import("node:fs/promises");
      await fileSystem.unlink(filePath);
    },
  };
}

describe("AMG archive writer", () => {
  it("writes deterministic forced-ZIP64 payloads, hashes, order, and compression", async () => {
    // Given: nested assets whose extensions must not affect compression policy.
    const root = await createRoot();
    const workspace = path.join(root, "workspace");
    await mkdir(path.join(workspace, "assets", "nested"));
    await writeFile(path.join(workspace, "assets", "z-compressible.txt"), "same text ".repeat(100));
    await writeFile(path.join(workspace, "assets", "nested", "a-photo.png"), Buffer.from([137, 80, 78, 71]));
    const first = path.join(root, "first.amg");
    const second = path.join(root, "second.amg");

    // When: the same immutable workspace is packed twice.
    await writeAmgArchive({ targetPath: first, workspacePath: workspace, project: TEST_PROJECT });
    await writeAmgArchive({ targetPath: second, workspacePath: workspace, project: TEST_PROJECT });

    // Then: layout, bytes, ZIP64 records, compression, and manifest integrity are deterministic.
    const firstBytes = await readFile(first);
    expect(await readFile(second)).toEqual(firstBytes);
    expect(signatureCount(firstBytes, 0x06064b50)).toBe(1);
    expect(signatureCount(firstBytes, 0x07064b50)).toBe(1);
    const inspected = await inspectArchive(first);
    expect(inspected.paths).toEqual([
      "project.json",
      "assets/nested/a-photo.png",
      "assets/z-compressible.txt",
      "manifest.json",
    ]);
    expect(inspected.methods).toEqual([8, 0, 0, 8]);
    const manifest = parseAmgManifest(inspected.manifestText);
    expect(manifest.entries.map((entry) => entry.path)).toEqual(inspected.paths.slice(0, -1));
    const projectBytes = new TextEncoder().encode(JSON.stringify(TEST_PROJECT));
    expect(manifest.entries[0]?.sha256).toBe(createHash("sha256").update(projectBytes).digest("hex"));
    expect(manifest.entries[1]?.sha256).toBe(createHash("sha256").update(Buffer.from([137, 80, 78, 71])).digest("hex"));
    const archive = await open(first, "r");
    const extracted = await extractAmgArchive({ archive, userDataPath: root });
    await archive.close();
    expect(extracted.project.customCss).toBe(TEST_PROJECT.customCss);
    expect(await readFile(path.join(extracted.workspace.path, "assets", "z-compressible.txt"), "utf8"))
      .toBe("same text ".repeat(100));
  });

  it("passes zip64 at every entry and the exact two-argument close boundary", async () => {
    // Given: an adapter that records the immutable zip.js control contract.
    const root = await createRoot();
    const workspace = path.join(root, "workspace");
    await writeFile(path.join(workspace, "assets", "one.bin"), "one");
    const entryZip64: boolean[] = [];
    const closeCalls: Array<readonly [Uint8Array | undefined, boolean | undefined]> = [];
    const factory: AmgZipWriterFactory = (writable) => {
      const delegate = new ZipWriter(writable);
      return {
        async add(filename, source, options) {
          entryZip64.push(options.zip64 === true);
          await delegate.add(filename, source, options);
        },
        async close(comment, options) {
          closeCalls.push([comment, options.zip64]);
          await delegate.close(comment, options);
        },
      };
    };

    // When: a small archive is written through the observing adapter.
    await writeAmgArchive({
      targetPath: path.join(root, "forced.amg"),
      workspacePath: workspace,
      project: TEST_PROJECT,
      zipWriterFactory: factory,
    });

    // Then: omitting either force point would make these independent controls fail.
    expect(entryZip64).toEqual([true, true, true]);
    expect(closeCalls).toEqual([[undefined, true]]);
  });

  it("enforces exact project, asset, entry, aggregate, and archive limits", async () => {
    // Given: a one-asset workspace and its exact serialized project size.
    const root = await createRoot();
    const workspace = path.join(root, "workspace");
    await writeFile(path.join(workspace, "assets", "asset.bin"), "1234");
    const projectBytes = new TextEncoder().encode(JSON.stringify(TEST_PROJECT)).byteLength;
    const target = path.join(root, "limits.amg");

    // When/Then: exact limits pass and each limit plus one fails without a replacement.
    await writeAmgArchive({
      targetPath: target,
      workspacePath: workspace,
      project: TEST_PROJECT,
      limits: { projectJsonBytes: projectBytes, assetBytes: 4, payloadEntries: 2, totalUncompressedPayloadBytes: projectBytes + 4 },
    });
    const original = await readFile(target);
    const manifestBytes = new TextEncoder().encode((await inspectArchive(target)).manifestText).byteLength;
    await writeAmgArchive({
      targetPath: target,
      workspacePath: workspace,
      project: TEST_PROJECT,
      limits: {
        projectJsonBytes: projectBytes,
        manifestJsonBytes: manifestBytes,
        assetBytes: 4,
        payloadEntries: 2,
        totalZipEntries: 3,
        totalUncompressedPayloadBytes: projectBytes + 4,
        archiveBytes: original.byteLength,
      },
    });
    expect(await readFile(target)).toEqual(original);
    for (const limits of [
      { projectJsonBytes: projectBytes - 1 },
      { manifestJsonBytes: manifestBytes - 1 },
      { assetBytes: 3 },
      { payloadEntries: 1 },
      { totalZipEntries: 2 },
      { totalUncompressedPayloadBytes: projectBytes + 3 },
      { archiveBytes: original.byteLength - 1 },
    ]) {
      await expect(writeAmgArchive({ targetPath: target, workspacePath: workspace, project: TEST_PROJECT, limits }))
        .rejects.toBeInstanceOf(Error);
      expect(await readFile(target)).toEqual(original);
    }
  });

  it("rejects links, non-regular assets, and files changed during streaming", async () => {
    // Given: a valid asset plus injectable archive consumption that mutates it after inventory.
    const root = await createRoot();
    const workspace = path.join(root, "workspace");
    const assetPath = path.join(workspace, "assets", "mutable.bin");
    await writeFile(assetPath, "before");
    let mutated = false;
    const factory: AmgZipWriterFactory = (writable) => {
      const delegate = new ZipWriter(writable);
      return {
        async add(filename, source, options) {
          if (filename === "project.json" && !mutated) {
            mutated = true;
            await writeFile(assetPath, "after mutation");
          }
          await delegate.add(filename, source, options);
        },
        async close(comment, options) {
          await delegate.close(comment, options);
        },
      };
    };

    // When/Then: inventory mutation is rejected before target promotion.
    await expect(writeAmgArchive({
      targetPath: path.join(root, "changed.amg"), workspacePath: workspace, project: TEST_PROJECT, zipWriterFactory: factory,
    })).rejects.toMatchObject({ name: "AmgArchiveWriterError" });

    const outside = path.join(root, "outside-assets");
    await mkdir(outside);
    await writeFile(path.join(outside, "outside.bin"), "outside");
    await rm(assetPath);
    await symlink(outside, assetPath, "junction");
    await expect(writeAmgArchive({
      targetPath: path.join(root, "link.amg"), workspacePath: workspace, project: TEST_PROJECT,
    })).rejects.toBeInstanceOf(AmgArchiveWriterError);
  });

  it("rejects a child that disappears between enumeration and stat", async () => {
    // Given: a prior target and an lstat seam that removes the enumerated child on its first probe.
    const root = await createRoot();
    const workspace = path.join(root, "workspace");
    const target = path.join(root, "disappearing.amg");
    const assetPath = path.join(workspace, "assets", "disappearing.bin");
    const original = Buffer.from("last known good archive");
    await writeFile(target, original);
    await writeFile(assetPath, "transient asset");
    let removed = false;

    // When: traversal has enumerated the child but its lstat observes ENOENT.
    const action = writeAmgArchive({
      targetPath: target,
      workspacePath: workspace,
      project: TEST_PROJECT,
      async assetLstat(filePath) {
        if (filePath === assetPath && !removed) {
          removed = true;
          await rm(assetPath);
        }
        return lstat(filePath, { bigint: true });
      },
    });

    // Then: disappearance is typed as a change and no partial archive or sibling temp is promoted.
    await expect(action).rejects.toMatchObject({ name: "AmgArchiveWriterError", code: "changed-asset" });
    expect(await readFile(target)).toEqual(original);
    expect(await readdir(root)).toEqual(["disappearing.amg", "workspace"]);
  });

  it("bounds input chunks and output pending writes under delayed backpressure", async () => {
    // Given: a real atomic sink held on its first write and a multi-chunk archive producer.
    const root = await createRoot();
    const workspace = path.join(root, "workspace");
    await writeFile(path.join(workspace, "assets", "large.bin"), Buffer.alloc(129, 7));
    let largestInput = 0;
    let outputAttempts = 0;
    let outputSettled = 0;
    let releaseSink = (): void => undefined;
    let reportSecondAttempt = (): void => undefined;
    let reportSinkStart = (): void => undefined;
    const sinkRelease = new Promise<void>((resolve) => { releaseSink = resolve; });
    const secondAttempt = new Promise<void>((resolve) => { reportSecondAttempt = resolve; });
    const sinkStarted = new Promise<void>((resolve) => { reportSinkStart = resolve; });
    const factory: AmgZipWriterFactory = (writable) => {
      const output = writable.getWriter();
      const fake: AmgZipWriter = {
        async add(_filename, source) {
          for await (const chunk of source) {
            largestInput = Math.max(largestInput, chunk.byteLength);
          }
        },
        async close() {
          for (let index = 0; index < 10; index += 1) {
            outputAttempts += 1;
            if (outputAttempts === 2) reportSecondAttempt();
            await output.write(new Uint8Array(16));
            outputSettled += 1;
          }
          await output.close();
        },
      };
      return fake;
    };
    const slowFileSystem: AtomicFileSystem = {
      open: async (filePath, flags, mode) => {
        const handle = await open(filePath, flags, mode);
        return {
          async write(buffer) {
            reportSinkStart();
            await sinkRelease;
            return handle.write(buffer);
          },
          sync: async () => handle.sync(),
          close: async () => handle.close(),
        };
      },
      rename: async (source, target) => {
        const fileSystem = await import("node:fs/promises");
        await fileSystem.rename(source, target);
      },
      unlink: async (filePath) => {
        const fileSystem = await import("node:fs/promises");
        await fileSystem.unlink(filePath);
      },
    };

    // When: output production reaches the configured 32-byte pipeline bound.
    const action = writeAmgArchive({
      targetPath: path.join(root, "bounded.amg"), workspacePath: workspace, project: TEST_PROJECT,
      limits: { streamChunkBytes: 16, queuedStreamBytes: 32 }, zipWriterFactory: factory, atomicFileSystem: slowFileSystem,
    });
    await sinkStarted;
    await secondAttempt;

    // Then: one active and one pending chunk consume the bound; a third cannot settle until release.
    const attemptsAtBound = outputAttempts;
    const settledAtBound = outputSettled;
    releaseSink();
    await action;
    expect(attemptsAtBound).toBe(2);
    expect(settledAtBound).toBe(1);
    expect(largestInput).toBeLessThanOrEqual(16);
    expect(outputAttempts).toBe(10);
    expect(outputSettled).toBe(10);
  });

  it("rejects an oversized output chunk and cleans the atomic temp", async () => {
    // Given: an adversarial ZIP adapter that emits one byte above the configured chunk maximum.
    const root = await createRoot();
    const target = path.join(root, "oversized-output.amg");
    await writeFile(target, "last known good");
    const factory: AmgZipWriterFactory = (writable) => {
      const output = writable.getWriter();
      return {
        async add(_filename, source) { for await (const _chunk of source) {} },
        async close() {
          await output.write(new Uint8Array(17));
          await output.close();
        },
      };
    };

    // When: the output crosses a 16-byte stream boundary.
    const action = writeAmgArchive({
      targetPath: target,
      workspacePath: path.join(root, "workspace"),
      project: TEST_PROJECT,
      limits: { streamChunkBytes: 16, queuedStreamBytes: 32 },
      zipWriterFactory: factory,
    });

    // Then: the typed stream failure leaves only the byte-identical prior target.
    await expect(action).rejects.toMatchObject({ name: "AmgArchiveWriterError", code: "stream" });
    expect(await readFile(target, "utf8")).toBe("last known good");
    expect(await readdir(root)).toEqual(["oversized-output.amg", "workspace"]);
  });

  it.each(["write", "sync", "close", "rename"] as const)(
    "preserves the prior target when atomic %s fails",
    async (stage) => {
      // Given: an existing last-known-good archive target.
      const root = await createRoot();
      const target = path.join(root, "atomic.amg");
      const original = Buffer.from("last known good");
      await writeFile(target, original);

      // When: one atomic replacement stage fails.
      const action = writeAmgArchive({
        targetPath: target,
        workspacePath: path.join(root, "workspace"),
        project: TEST_PROJECT,
        atomicFileSystem: faultingFileSystem(stage),
      });

      // Then: target bytes remain exact and the sibling temp is cleaned.
      await expect(action).rejects.toBeInstanceOf(Error);
      expect(await readFile(target)).toEqual(original);
      expect(await readdir(root)).toEqual(["atomic.amg", "workspace"]);
    },
  );
});
