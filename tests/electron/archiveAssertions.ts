import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js";
import { expect } from "@playwright/test";
import { AmgManifestV1Schema } from "../../src/shared/projects/amgContract";
import { EVIDENCE_ROOT } from "./electronHarness";

const digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

export type ArchiveInspection = {
  readonly paths: readonly string[];
  readonly manifest: unknown;
  readonly projectText: string;
};

export const readArchivePaths = async (archivePath: string): Promise<readonly string[]> => {
  const reader = new ZipReader(new Uint8ArrayReader(await readFile(archivePath)));
  try {
    return (await reader.getEntries()).filter((entry) => !entry.directory).map((entry) => entry.filename).sort();
  } finally {
    await reader.close();
  }
};

export const inspectAmgArchive = async (
  archivePath: string,
  artifactName: string,
): Promise<ArchiveInspection> => {
  const reader = new ZipReader(new Uint8ArrayReader(await readFile(archivePath)));
  try {
    const entries = await reader.getEntries();
    const files = entries.filter((entry) => !entry.directory);
    const content = new Map<string, Uint8Array>();
    for (const entry of files) {
      if (entry.getData === undefined) throw new TypeError(`archive entry ${entry.filename} cannot be read`);
      content.set(entry.filename, await entry.getData(new Uint8ArrayWriter()));
    }
    const manifestBytes = content.get("manifest.json");
    const projectBytes = content.get("project.json");
    if (manifestBytes === undefined || projectBytes === undefined) {
      throw new TypeError("archive is missing manifest.json or project.json");
    }
    const manifest = AmgManifestV1Schema.parse(JSON.parse(new TextDecoder().decode(manifestBytes)));
    const paths = [...content.keys()].sort();
    expect(paths).toEqual(["manifest.json", ...manifest.entries.map((entry) => entry.path)].sort());
    for (const record of manifest.entries) {
      const bytes = content.get(record.path);
      expect(bytes, record.path).toBeDefined();
      if (bytes === undefined) continue;
      expect(bytes.byteLength, record.path).toBe(record.uncompressedBytes);
      expect(digest(bytes), record.path).toBe(record.sha256);
    }
    const projectText = new TextDecoder().decode(projectBytes);
    await writeFile(path.join(EVIDENCE_ROOT, artifactName), JSON.stringify({
      archivePath,
      paths,
      manifest,
      project: JSON.parse(projectText),
    }, null, 2));
    return { paths, manifest, projectText };
  } finally {
    await reader.close();
  }
};
