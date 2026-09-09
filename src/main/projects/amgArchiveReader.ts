import { createHash } from "node:crypto";
import type { FileHandle } from "node:fs/promises";
import {
  AMG_FIXED_LIMITS,
  AMG_MANIFEST_PATH,
  AMG_PROJECT_PATH,
  AmgContractError,
  parseAmgManifest,
} from "../../shared/projects/amgContract";
import type { AmgManifestV1 } from "../../shared/projects/amgContract";
import { parseProjectDocumentV1 } from "../../shared/projects/projectDocumentSchema";
import type { ProjectDocumentV1 } from "../../shared/projects/projectDocumentSchema";
import { scanProjectPortability } from "../../shared/projects/projectPortability";
import { ArchivePathError, createArchivePathIndex } from "./archivePath";
import { preflightAmgArchive } from "./amgArchivePreflight";
import { AmgArchiveReaderError } from "./amgArchiveReaderError";
import { openValidatedZip, readEntryBounded, writeEntryVerified } from "./amgArchiveZip";
import type { ArchiveEntryDataSource } from "./amgArchiveZip";
import type { OwnedWorkspace } from "./projectWorkspace";
import { createOwnedWorkspaceCandidate, ProjectWorkspaceError } from "./projectWorkspace";

export { AmgArchiveReaderError } from "./amgArchiveReaderError";

export type AmgArchiveCandidate = {
  readonly workspace: OwnedWorkspace;
  readonly manifest: AmgManifestV1;
  readonly project: ProjectDocumentV1;
};

export type AmgArchiveMetadata = {
  readonly name: string;
  readonly framework: ProjectDocumentV1["projectSettings"]["framework"];
};

type ValidatedContents = {
  readonly entries: ReadonlyMap<string, ArchiveEntryDataSource>;
  readonly manifest: AmgManifestV1;
  readonly project: ProjectDocumentV1;
};

function parseJson(bytes: Uint8Array, filename: string): unknown {
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new AmgArchiveReaderError("invalid-project", `${filename} is not valid UTF-8`, error);
    }
    throw error;
  }
  try {
    const parsed: unknown = JSON.parse(source);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AmgArchiveReaderError("invalid-project", `${filename} is not valid JSON`, error);
    }
    throw error;
  }
}

function requireEntry(entries: ReadonlyMap<string, ArchiveEntryDataSource>, filename: string): ArchiveEntryDataSource {
  const entry = entries.get(filename);
  if (entry === undefined) throw new AmgArchiveReaderError("invalid-archive", `${filename} is missing`);
  return entry;
}

function verifyManifestIndex(manifest: AmgManifestV1, entries: ReadonlyMap<string, ArchiveEntryDataSource>): void {
  createArchivePathIndex([AMG_MANIFEST_PATH, ...manifest.entries.map((entry) => entry.path)]);
  if (entries.size !== manifest.entries.length + 1) {
    throw new AmgArchiveReaderError("invalid-archive", "archive has missing or undeclared entries");
  }
  for (const declared of manifest.entries) {
    const entry = requireEntry(entries, declared.path);
    const expectedMethod = declared.compression === "store" ? 0 : 8;
    if (entry.compressionMethod !== expectedMethod || entry.uncompressedSize !== declared.uncompressedBytes) {
      throw new AmgArchiveReaderError("integrity", "manifest metadata disagrees with ZIP metadata");
    }
  }
}

function verifyProjectHash(bytes: Uint8Array, manifest: AmgManifestV1): void {
  const declared = manifest.entries[0];
  if (
    declared === undefined ||
    bytes.byteLength !== declared.uncompressedBytes ||
    createHash("sha256").update(bytes).digest("hex") !== declared.sha256
  ) {
    throw new AmgArchiveReaderError("integrity", "project.json size or SHA-256 does not match manifest");
  }
}

function verifyPortability(project: ProjectDocumentV1, manifest: AmgManifestV1): void {
  const scan = scanProjectPortability(project, {
    mode: "conversion-durable",
    sessionId: "archive_reader",
    availableAssetPaths: manifest.entries.slice(1).map((entry) => entry.path),
  });
  if (scan.offenders.length > 0) {
    throw new AmgArchiveReaderError("invalid-project", "project.json contains non-portable references", scan.offenders);
  }
}

async function validateContents(archive: FileHandle): Promise<ValidatedContents> {
  const preflight = await preflightAmgArchive(archive);
  const opened = await openValidatedZip(archive, preflight);
  try {
    const manifestBytes = await readEntryBounded(
      requireEntry(opened.entries, AMG_MANIFEST_PATH),
      AMG_FIXED_LIMITS.manifestJsonBytes,
    );
    const manifest = parseAmgManifest(parseJson(manifestBytes, AMG_MANIFEST_PATH));
    verifyManifestIndex(manifest, opened.entries);
    const projectBytes = await readEntryBounded(
      requireEntry(opened.entries, AMG_PROJECT_PATH),
      AMG_FIXED_LIMITS.projectJsonBytes,
    );
    verifyProjectHash(projectBytes, manifest);
    const project = parseProjectDocumentV1(parseJson(projectBytes, AMG_PROJECT_PATH));
    verifyPortability(project, manifest);
    return { ...opened, manifest, project };
  } catch (error) {
    if (
      error instanceof AmgArchiveReaderError ||
      error instanceof AmgContractError ||
      error instanceof ArchivePathError
    ) {
      throw error;
    }
    throw new AmgArchiveReaderError("invalid-archive", "archive content validation failed", error);
  }
}

export async function extractAmgArchive(request: {
  readonly archive: FileHandle;
  readonly userDataPath: string;
}): Promise<AmgArchiveCandidate> {
  const contents = await validateContents(request.archive);
  try {
    const workspace = await createOwnedWorkspaceCandidate(request.userDataPath, async (candidate) => {
      let remaining = AMG_FIXED_LIMITS.totalUncompressedPayloadBytes;
      for (const declared of contents.manifest.entries) {
        const written = await writeEntryVerified(
          requireEntry(contents.entries, declared.path),
          candidate.path,
          { path: declared.path, bytes: declared.uncompressedBytes, sha256: declared.sha256 },
          remaining,
        );
        remaining -= written;
      }
    });
    return { workspace, manifest: contents.manifest, project: contents.project };
  } catch (error) {
    if (
      error instanceof AmgArchiveReaderError ||
      error instanceof AmgContractError ||
      error instanceof ArchivePathError ||
      error instanceof ProjectWorkspaceError
    ) {
      throw error;
    }
    throw new AmgArchiveReaderError("integrity", "payload extraction failed", error);
  }
}

export async function inspectAmgArchiveMetadata(request: {
  readonly archive: FileHandle;
}): Promise<AmgArchiveMetadata> {
  const contents = await validateContents(request.archive);
  return {
    name: contents.project.projectSettings.name,
    framework: contents.project.projectSettings.framework,
  };
}
