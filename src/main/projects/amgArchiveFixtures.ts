import { createHash } from "node:crypto";
import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipWriter,
} from "@zip.js/zip.js";
import type { ProjectDocumentV1 } from "../../shared/projects/projectDocumentSchema";

const encoder = new TextEncoder();

export const TEST_PROJECT: ProjectDocumentV1 = {
  projectSchemaVersion: 1,
  customCss: ".fixture { color: green; }",
  projectSettings: {
    name: "Archive fixture",
    framework: "bootstrap-5",
    theme: {
      name: "Fixture",
      colors: {
        primary: "#000",
        secondary: "#111",
        accent: "#222",
        background: "#fff",
        surface: "#eee",
        text: "#333",
        textMuted: "#444",
        border: "#555",
        success: "#080",
        warning: "#ff0",
        danger: "#f00",
      },
      typography: {
        fontFamily: "sans-serif",
        headingFontFamily: "sans-serif",
        baseFontSize: "16px",
        lineHeight: "1.5",
        headingLineHeight: "1.2",
      },
      spacing: { baseUnit: "4px", scale: [1, 2, 4] },
      borders: { radius: "4px", width: "1px", color: "#555" },
      customCss: "",
    },
    globalStyles: {},
  },
  pages: [],
  userBlocks: [],
};

export type FixturePayload = {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly compression?: "store" | "deflate";
};

export type AmgFixture = {
  readonly archive: Uint8Array;
  readonly projectBytes: Uint8Array;
  readonly assetBytes: Uint8Array;
};

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

export async function buildAmgFixture(options?: {
  readonly zip64?: boolean;
  readonly payloads?: readonly FixturePayload[];
  readonly manifestTransform?: (
    manifest: Readonly<Record<string, unknown>>,
  ) => Readonly<Record<string, unknown>>;
}): Promise<AmgFixture> {
  const projectBytes = encoder.encode(JSON.stringify(TEST_PROJECT));
  const assetBytes = encoder.encode("fixture asset bytes\n");
  const payloads = options?.payloads ?? [
    { path: "project.json", bytes: projectBytes, compression: "deflate" },
    { path: "assets/photo.txt", bytes: assetBytes, compression: "store" },
  ];
  const baseManifest: Readonly<Record<string, unknown>> = {
    marker: "amagon-project",
    formatVersion: 1,
    projectSchemaVersion: 1,
    projectPath: "project.json",
    entries: payloads.map((payload) => ({
      path: payload.path,
      uncompressedBytes: payload.bytes.byteLength,
      sha256: sha256(payload.bytes),
      compression: payload.compression ?? "deflate",
    })),
  };
  const manifest = options?.manifestTransform?.(baseManifest) ?? baseManifest;
  const writer = new Uint8ArrayWriter();
  const zip = new ZipWriter(writer);
  await zip.add(
    "manifest.json",
    new Uint8ArrayReader(encoder.encode(JSON.stringify(manifest))),
    { compressionMethod: 0, zip64: options?.zip64 ?? false },
  );
  for (const payload of payloads) {
    await zip.add(payload.path, new Uint8ArrayReader(payload.bytes), {
      compressionMethod: payload.compression === "store" ? 0 : 8,
      zip64: options?.zip64 ?? false,
    });
  }
  return {
    archive: await zip.close(undefined, { zip64: options?.zip64 ?? false }),
    projectBytes,
    assetBytes,
  };
}

export function replaceAsciiSameLength(
  archive: Uint8Array,
  from: string,
  to: string,
): Uint8Array {
  if (from.length !== to.length) {
    throw new RangeError("fixture replacements must preserve byte length");
  }
  const copy = archive.slice();
  const source = encoder.encode(from);
  const replacement = encoder.encode(to);
  for (let index = 0; index <= copy.byteLength - source.byteLength; index += 1) {
    if (source.every((byte, offset) => copy[index + offset] === byte)) {
      copy.set(replacement, index);
    }
  }
  return copy;
}

export function patchLastUint32(
  archive: Uint8Array,
  signature: number,
  fieldOffset: number,
  value: number,
): Uint8Array {
  const copy = archive.slice();
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  let found = -1;
  for (let index = 0; index <= copy.byteLength - 4; index += 1) {
    if (view.getUint32(index, true) === signature) found = index;
  }
  if (found < 0) throw new RangeError("fixture ZIP signature was not found");
  view.setUint32(found + fieldOffset, value, true);
  return copy;
}

export function patchSignatureField(
  archive: Uint8Array,
  signature: number,
  occurrence: number,
  fieldOffset: number,
  width: 2 | 4,
  value: number,
): Uint8Array {
  const copy = archive.slice();
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  let seen = 0;
  for (let index = 0; index <= copy.byteLength - 4; index += 1) {
    if (view.getUint32(index, true) !== signature) continue;
    if (seen === occurrence) {
      if (width === 2) view.setUint16(index + fieldOffset, value, true);
      else view.setUint32(index + fieldOffset, value, true);
      return copy;
    }
    seen += 1;
  }
  throw new RangeError("fixture ZIP signature occurrence was not found");
}

export function patchFirstAsciiByte(archive: Uint8Array, value: string): Uint8Array {
  const copy = archive.slice();
  const source = encoder.encode(value);
  for (let index = 0; index <= copy.byteLength - source.byteLength; index += 1) {
    if (source.every((byte, offset) => copy[index + offset] === byte)) {
      copy[index] = (copy[index] ?? 0) ^ 1;
      return copy;
    }
  }
  throw new RangeError("fixture ASCII payload was not found");
}

export function patchZip64EntryCount(archive: Uint8Array, count: number): Uint8Array {
  const copy = archive.slice();
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  for (let index = 0; index <= copy.byteLength - 56; index += 1) {
    if (view.getUint32(index, true) === 0x06064b50) {
      view.setBigUint64(index + 24, BigInt(count), true);
      view.setBigUint64(index + 32, BigInt(count), true);
      return copy;
    }
  }
  throw new RangeError("fixture ZIP64 end record was not found");
}

export function growEntryCompressedRange(
  archive: Uint8Array,
  occurrence: number,
  increment: number,
): Uint8Array {
  const copy = archive.slice();
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  let localSeen = 0;
  let centralSeen = 0;
  for (let index = 0; index <= copy.byteLength - 4; index += 1) {
    const signature = view.getUint32(index, true);
    if (signature === 0x04034b50) {
      if (localSeen === occurrence) {
        view.setUint32(index + 18, view.getUint32(index + 18, true) + increment, true);
      }
      localSeen += 1;
    }
    if (signature === 0x02014b50) {
      if (centralSeen === occurrence) {
        view.setUint32(index + 20, view.getUint32(index + 20, true) + increment, true);
      }
      centralSeen += 1;
    }
  }
  return copy;
}
