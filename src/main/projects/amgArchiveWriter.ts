import { createHash } from "node:crypto";
import type { BigIntStats } from "node:fs";
import { lstat, open, readdir } from "node:fs/promises";
import path from "node:path";
import {
  AMG_FIXED_LIMITS,
  AMG_FORMAT_VERSION,
  AMG_MANIFEST_PATH,
  AMG_MARKER,
  AMG_PROJECT_PATH,
  PROJECT_SCHEMA_VERSION,
  parseAmgManifest,
  type AmgManifestEntryV1,
} from "../../shared/projects/amgContract";
import { parseProjectDocumentV1, type ProjectDocumentV1 } from "../../shared/projects/projectDocumentSchema";
import { ArchivePathError, canonicalizeArchivePath, createArchivePathIndex } from "./archivePath";
import { AtomicWriteError, atomicWriteFile, type AtomicFileSystem } from "./atomicFile";
import {
  amgArchiveEntryOptions,
  defaultAmgZipWriterFactory,
  type AmgZipWriter,
  type AmgZipWriterFactory,
} from "./amgArchiveZipWriter";

export type { AmgZipWriter, AmgZipWriterFactory } from "./amgArchiveZipWriter";

type WriterLimits = { readonly [Key in keyof typeof AMG_FIXED_LIMITS]: number };
type AssetStat = Pick<BigIntStats, "size" | "mtimeNs" | "ctimeNs" | "ino" | "dev">;
type AssetInventory = AssetStat & { readonly archivePath: string; readonly filePath: string };
type AssetLstat = (filePath: string) => Promise<BigIntStats>;

export type WriteAmgArchiveOptions = {
  readonly targetPath: string;
  readonly workspacePath: string;
  readonly project: ProjectDocumentV1;
  readonly limits?: Partial<WriterLimits>;
  readonly zipWriterFactory?: AmgZipWriterFactory;
  readonly atomicFileSystem?: AtomicFileSystem;
  readonly assetLstat?: AssetLstat;
};

export class AmgArchiveWriterError extends Error {
  readonly name = "AmgArchiveWriterError";
  constructor(readonly code: "capacity" | "unsafe-asset" | "changed-asset" | "stream", message: string, readonly cause?: unknown) { super(message); }
}

const encoder = new TextEncoder();
const nodeAssetLstat: AssetLstat = (filePath) => lstat(filePath, { bigint: true });

function statFields(stats: BigIntStats): AssetStat { return { size: stats.size, mtimeNs: stats.mtimeNs, ctimeNs: stats.ctimeNs, ino: stats.ino, dev: stats.dev }; }

function sameStat(left: AssetStat, right: AssetStat): boolean { return left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs && left.ino === right.ino && left.dev === right.dev; }

function isMissing(error: unknown): boolean { return error instanceof Error && "code" in error && error.code === "ENOENT"; }

function capacity(message: string): never { throw new AmgArchiveWriterError("capacity", message); }
async function lstatAsset(filePath: string, assetLstat: AssetLstat): Promise<BigIntStats> { try { return await assetLstat(filePath); } catch (error) { if (isMissing(error)) throw new AmgArchiveWriterError("changed-asset", "asset disappeared during inventory or write", error); throw error; } }
async function openAsset(filePath: string) { try { return await open(filePath, "r"); } catch (error) { if (isMissing(error)) throw new AmgArchiveWriterError("changed-asset", "asset disappeared before read", error); throw error; } }

async function inventoryAssets(workspacePath: string, limits: WriterLimits, assetLstat: AssetLstat): Promise<readonly AssetInventory[]> {
  const workspaceStats = await lstat(workspacePath, { bigint: true });
  if (workspaceStats.isSymbolicLink() || !workspaceStats.isDirectory()) throw new AmgArchiveWriterError("unsafe-asset", "workspace must be a regular directory");
  const assetRoot = path.join(workspacePath, "assets");
  const assets: AssetInventory[] = [];
  async function walk(directory: string, relativeDirectory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = relativeDirectory.length === 0 ? entry.name : `${relativeDirectory}/${entry.name}`;
      const filePath = path.join(directory, entry.name);
      const stats = await lstatAsset(filePath, assetLstat);
      if (stats.isSymbolicLink()) throw new AmgArchiveWriterError("unsafe-asset", "asset links and reparse points are forbidden");
      if (stats.isDirectory()) {
        await walk(filePath, relativePath);
      } else if (stats.isFile()) {
        const archivePath = canonicalizeArchivePath(`assets/${relativePath}`);
        if (stats.size > BigInt(limits.assetBytes)) capacity(`${archivePath} exceeds the asset limit`);
        assets.push({ archivePath, filePath, ...statFields(stats) });
      } else {
        throw new AmgArchiveWriterError("unsafe-asset", "only regular asset files are allowed");
      }
    }
  }
  let rootStats: BigIntStats;
  try { rootStats = await assetLstat(assetRoot); } catch (error) { if (isMissing(error)) return assets; throw error; }
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) throw new AmgArchiveWriterError("unsafe-asset", "assets must be a regular directory");
  try { await walk(assetRoot, ""); } catch (error) { if (isMissing(error)) throw new AmgArchiveWriterError("changed-asset", "asset directory disappeared during traversal", error); throw error; }
  assets.sort((left, right) => left.archivePath < right.archivePath ? -1 : left.archivePath > right.archivePath ? 1 : 0);
  createArchivePathIndex([AMG_PROJECT_PATH, ...assets.map((asset) => asset.archivePath), AMG_MANIFEST_PATH]);
  return assets;
}

function byteStream(bytes: Uint8Array, chunkBytes: number, hash: ReturnType<typeof createHash>): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset === bytes.byteLength) {
        controller.close();
        return;
      }
      const chunk = bytes.subarray(offset, Math.min(offset + chunkBytes, bytes.byteLength));
      offset += chunk.byteLength;
      hash.update(chunk);
      controller.enqueue(chunk);
    },
  });
}

async function assetStream(asset: AssetInventory, limits: WriterLimits, hash: ReturnType<typeof createHash>, assetLstat: AssetLstat): Promise<ReadableStream<Uint8Array>> {
  const before = await lstatAsset(asset.filePath, assetLstat);
  if (!before.isFile() || before.isSymbolicLink() || !sameStat(asset, statFields(before))) {
    throw new AmgArchiveWriterError("changed-asset", `${asset.archivePath} changed after inventory`);
  }
  const handle = await openAsset(asset.filePath);
  let offset = 0;
  let closed = false;
  const close = async (): Promise<void> => {
    if (!closed) {
      closed = true;
      await handle.close();
    }
  };
  return new ReadableStream({
    async pull(controller) {
      const chunk = new Uint8Array(Math.min(limits.streamChunkBytes, Number(asset.size) - offset));
      if (chunk.byteLength === 0) {
        await close();
        const after = await lstatAsset(asset.filePath, assetLstat);
        if (!after.isFile() || after.isSymbolicLink() || !sameStat(asset, statFields(after))) {
          controller.error(new AmgArchiveWriterError("changed-asset", `${asset.archivePath} changed while writing`));
          return;
        }
        controller.close();
        return;
      }
      const result = await handle.read(chunk, 0, chunk.byteLength, offset);
      if (result.bytesRead === 0) {
        await close();
        controller.error(new AmgArchiveWriterError("changed-asset", `${asset.archivePath} ended while writing`));
        return;
      }
      const output = chunk.subarray(0, result.bytesRead);
      offset += result.bytesRead;
      hash.update(output);
      controller.enqueue(output);
    },
    async cancel() {
      await close();
    },
  });
}

async function packArchive(
  zip: AmgZipWriter,
  workspacePath: string,
  projectBytes: Uint8Array,
  inventory: readonly AssetInventory[],
  limits: WriterLimits,
  assetLstat: AssetLstat,
): Promise<void> {
  const entries: AmgManifestEntryV1[] = [];
  const projectHash = createHash("sha256");
  await zip.add(AMG_PROJECT_PATH, byteStream(projectBytes, limits.streamChunkBytes, projectHash), amgArchiveEntryOptions("deflate", projectBytes.byteLength));
  entries.push({ path: AMG_PROJECT_PATH, uncompressedBytes: projectBytes.byteLength, sha256: projectHash.digest("hex"), compression: "deflate" });
  for (const asset of inventory) {
    const hash = createHash("sha256");
    await zip.add(asset.archivePath, await assetStream(asset, limits, hash, assetLstat), amgArchiveEntryOptions("store", Number(asset.size)));
    entries.push({ path: asset.archivePath, uncompressedBytes: Number(asset.size), sha256: hash.digest("hex"), compression: "store" });
  }
  const after = await inventoryAssets(workspacePath, limits, assetLstat);
  if (after.length !== inventory.length || after.some((asset, index) => {
    const original = inventory[index];
    return original === undefined || asset.archivePath !== original.archivePath || !sameStat(asset, original);
  })) throw new AmgArchiveWriterError("changed-asset", "asset inventory changed while writing");
  const manifest = parseAmgManifest({
    marker: AMG_MARKER,
    formatVersion: AMG_FORMAT_VERSION,
    projectSchemaVersion: PROJECT_SCHEMA_VERSION,
    projectPath: AMG_PROJECT_PATH,
    entries,
  });
  const manifestBytes = encoder.encode(JSON.stringify(manifest));
  if (manifestBytes.byteLength > limits.manifestJsonBytes) capacity("manifest.json exceeds its limit");
  await zip.add(AMG_MANIFEST_PATH, byteStream(manifestBytes, limits.streamChunkBytes, createHash("sha256")), amgArchiveEntryOptions("deflate", manifestBytes.byteLength));
  await zip.close(undefined, { zip64: true });
}

async function* archiveSource(options: WriteAmgArchiveOptions, projectBytes: Uint8Array, inventory: readonly AssetInventory[], limits: WriterLimits): AsyncGenerator<Uint8Array> {
  const output = new TransformStream<Uint8Array, Uint8Array>(
    { transform(chunk, controller) {
      if (chunk.byteLength > limits.streamChunkBytes) throw new AmgArchiveWriterError("stream", "zip output chunk exceeds the stream limit");
      controller.enqueue(chunk);
    } },
    { highWaterMark: 1, size: () => 1 },
    { highWaterMark: limits.queuedStreamBytes - (limits.streamChunkBytes * 2), size: (chunk) => chunk.byteLength },
  );
  const reader = output.readable.getReader();
  const packing = packArchive((options.zipWriterFactory ?? defaultAmgZipWriterFactory)(output.writable), options.workspacePath, projectBytes, inventory, limits, options.assetLstat ?? nodeAssetLstat)
    .then(() => ({ ok: true } as const), (error: unknown) => ({ ok: false, error } as const));
  let settled = false;
  while (true) {
    const result = settled ? { kind: "read" as const, value: await reader.read() } : await Promise.race([
      reader.read().then((value) => ({ kind: "read" as const, value })),
      packing.then((value) => ({ kind: "pack" as const, value })),
    ]);
    if (result.kind === "pack") {
      if (!result.value.ok) {
        await reader.cancel(result.value.error);
        throw result.value.error;
      }
      settled = true;
    } else if (result.value.done) {
      const packed = await packing;
      if (!packed.ok) throw packed.error;
      return;
    } else {
      yield result.value.value;
    }
  }
}

export async function writeAmgArchive(options: WriteAmgArchiveOptions): Promise<void> {
  const limits: WriterLimits = { ...AMG_FIXED_LIMITS, ...options.limits };
  if (limits.streamChunkBytes < 1 || limits.queuedStreamBytes < limits.streamChunkBytes * 2) capacity("stream limits are invalid");
  const projectBytes = encoder.encode(JSON.stringify(parseProjectDocumentV1(options.project)));
  if (projectBytes.byteLength > limits.projectJsonBytes) capacity("project.json exceeds its limit");
  const inventory = await inventoryAssets(options.workspacePath, limits, options.assetLstat ?? nodeAssetLstat);
  if (inventory.length + 1 > limits.payloadEntries || inventory.length + 2 > limits.totalZipEntries) capacity("entry count exceeds its limit");
  const payloadBytes = inventory.reduce((total, asset) => total + Number(asset.size), projectBytes.byteLength);
  if (payloadBytes > limits.totalUncompressedPayloadBytes) capacity("payload bytes exceed the aggregate limit");
  try {
    await atomicWriteFile(options.targetPath, archiveSource(options, projectBytes, inventory, limits), {
      maxBytes: limits.archiveBytes,
      fileSystem: options.atomicFileSystem,
    });
  } catch (error) {
    if (error instanceof AtomicWriteError && error.originalError instanceof AmgArchiveWriterError) throw error.originalError;
    if (error instanceof ArchivePathError) throw new AmgArchiveWriterError("unsafe-asset", error.message, error);
    throw error;
  }
}
