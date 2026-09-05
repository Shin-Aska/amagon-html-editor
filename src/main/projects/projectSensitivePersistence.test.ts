// @vitest-environment node

import { mkdir, mkdtemp, open, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AMG_ERROR_CODES } from "../../shared/projects/amgContract";
import {
  parseProjectSessionId,
  parseRendererGeneration,
  parseWorkspaceGeneration,
} from "../../shared/projects/projectIpcContract";
import type { ProjectDocumentV1 } from "../../shared/projects/projectDocumentSchema";
import { buildAmgFixture, TEST_PROJECT } from "./amgArchiveFixtures";
import { extractAmgArchive } from "./amgArchiveReader";
import { writeAmgArchive } from "./amgArchiveWriter";
import { LegacyProjectValidationError, saveLegacyJsonProject } from "./legacyJsonProject";
import { ProjectSession, ProjectSessionRegistry } from "./projectSession";
import { persistActiveProject, saveActiveProjectAs } from "./projectServiceSave";
import type { ProjectServiceFiles } from "./projectServiceFiles";
import type { ActiveProjectState, ProjectServiceRuntime } from "./projectServiceTypes";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const projectWithAccessToken = (): ProjectDocumentV1 => ({
  ...structuredClone(TEST_PROJECT),
  extensionState: { nested: [{ accessToken: "must-not-persist" }] },
});

const activeAmgState = (workspacePath: string, sourcePath: string): ActiveProjectState => ({
  session: ProjectSession.createAmg({ workspacePath, sourcePath }),
  data: structuredClone(TEST_PROJECT),
  approvedExternalReferences: [],
});

const saveRequest = (state: ActiveProjectState) => {
  const sessionId = state.session.id;
  if (sessionId === null) throw new TestFixtureError("fixture session must be active");
  return {
    expectedSessionId: parseProjectSessionId(sessionId),
    rendererGeneration: parseRendererGeneration(0),
    workspaceGeneration: parseWorkspaceGeneration(0),
    snapshot: projectWithAccessToken(),
  };
};

class TestFixtureError extends Error {
  readonly name = "TestFixtureError";
}

const runtimeHarness = (): {
  readonly runtime: ProjectServiceRuntime;
  readonly beginTargetTransaction: ReturnType<typeof vi.fn<ProjectServiceFiles["beginTargetTransaction"]>>;
  readonly writeAmg: ReturnType<typeof vi.fn<ProjectServiceFiles["writeAmg"]>>;
} => {
  const beginTargetTransaction = vi.fn<ProjectServiceFiles["beginTargetTransaction"]>(async () => ({
    commit: async () => undefined,
    rollback: async () => undefined,
  }));
  const writeAmg = vi.fn<ProjectServiceFiles["writeAmg"]>(async () => undefined);
  const files: ProjectServiceFiles = {
    openAmg: async () => { throw new TestFixtureError("unused openAmg"); },
    readLegacy: async () => { throw new TestFixtureError("unused readLegacy"); },
    writeAmg,
    writeLegacy: async () => undefined,
    beginTargetTransaction,
    createWorkspace: async () => { throw new TestFixtureError("unused createWorkspace"); },
    listAssetPaths: async () => [],
    cleanupWorkspace: async () => undefined,
  };
  return {
    runtime: {
      userDataPath: "C:\\user",
      files,
      sessions: new ProjectSessionRegistry(),
    },
    beginTargetTransaction,
    writeAmg,
  };
};

describe("compound secret persistence boundaries", () => {
  it("rejects AMG Save before archive target mutation", async () => {
    // Given: an active AMG project and a renderer snapshot containing a nested compound secret key.
    const state = activeAmgState("C:\\workspace", "C:\\projects\\original.amg");
    const request = saveRequest(state);
    const harness = runtimeHarness();

    // When: AMG Save receives the snapshot.
    const save = persistActiveProject(state, harness.runtime, request);

    // Then: it rejects before writing the archive target.
    await expect(save).rejects.toMatchObject({ code: AMG_ERROR_CODES.CREDENTIALS_FORBIDDEN });
    expect(harness.beginTargetTransaction).not.toHaveBeenCalled();
    expect(harness.writeAmg).not.toHaveBeenCalled();
  });

  it("rejects AMG Save As before beginning a target transaction", async () => {
    // Given: an active AMG project and a renderer snapshot containing a nested compound secret key.
    const state = activeAmgState("C:\\workspace", "C:\\projects\\original.amg");
    const request = saveRequest(state);
    const harness = runtimeHarness();

    // When: AMG Save As receives the snapshot.
    const saveAs = saveActiveProjectAs(state, harness.runtime, request, "C:\\projects\\copy.amg");

    // Then: it rejects before beginning or writing any archive target transaction.
    await expect(saveAs).rejects.toMatchObject({ code: AMG_ERROR_CODES.CREDENTIALS_FORBIDDEN });
    expect(harness.beginTargetTransaction).not.toHaveBeenCalled();
    expect(harness.writeAmg).not.toHaveBeenCalled();
  });

  it("preserves an existing legacy JSON target when nested compound credentials are rejected", async () => {
    // Given: an existing target and a legacy-shaped project containing a nested compound secret key.
    const root = await mkdtemp(path.join(tmpdir(), "amagon-secret-legacy-"));
    roots.push(root);
    const targetPath = path.join(root, "project.json");
    const original = "existing-target-bytes";
    await writeFile(targetPath, original, "utf8");
    const project = projectWithAccessToken();
    Reflect.deleteProperty(project, "projectSchemaVersion");

    // When: legacy persistence attempts to replace the target.
    const save = saveLegacyJsonProject(targetPath, project);

    // Then: preflight rejects and the target remains byte-identical.
    await expect(save).rejects.toMatchObject({
      name: LegacyProjectValidationError.name,
      reason: "schema",
      originalError: { code: AMG_ERROR_CODES.CREDENTIALS_FORBIDDEN },
    });
    await expect(readFile(targetPath, "utf8")).resolves.toBe(original);
  });

  it("preserves an existing AMG target when its writer receives nested compound credentials", async () => {
    // Given: an existing AMG target and a valid workspace for a project containing a compound secret key.
    const root = await mkdtemp(path.join(tmpdir(), "amagon-secret-writer-"));
    roots.push(root);
    const workspacePath = path.join(root, "source");
    const targetPath = path.join(root, "project.amg");
    const original = Buffer.from("existing-amg-target");
    await mkdir(path.join(workspacePath, "assets"), { recursive: true });
    await writeFile(targetPath, original);

    // When: the direct AMG writer receives the unsafe project.
    const save = writeAmgArchive({ targetPath, workspacePath, project: projectWithAccessToken() });

    // Then: preflight rejects before mutating the target bytes.
    await expect(save).rejects.toMatchObject({ code: AMG_ERROR_CODES.CREDENTIALS_FORBIDDEN });
    await expect(readFile(targetPath)).resolves.toEqual(original);
  });

  it("rejects a malicious AMG archive without leaving a workspace candidate", async () => {
    // Given: a structurally valid archive whose project JSON contains a nested compound secret key.
    const root = await mkdtemp(path.join(tmpdir(), "amagon-secret-open-"));
    roots.push(root);
    const workspacePath = path.join(root, "source");
    const userDataPath = path.join(root, "user-data");
    const targetPath = path.join(root, "malicious.amg");
    await mkdir(userDataPath, { recursive: true });
    const projectBytes = new TextEncoder().encode(JSON.stringify(projectWithAccessToken()));
    const fixture = await buildAmgFixture({
      payloads: [{ path: "project.json", bytes: projectBytes, compression: "deflate" }],
    });
    await writeFile(targetPath, fixture.archive);
    const archive = await open(targetPath, "r");

    // When: the archive reader validates and attempts to extract it.
    try {
      const extraction = extractAmgArchive({ archive, userDataPath });

      // Then: validation rejects before a workspace survives extraction.
      await expect(extraction).rejects.toMatchObject({ code: AMG_ERROR_CODES.CREDENTIALS_FORBIDDEN });
    } finally {
      await archive.close();
    }
    await expect(readdir(userDataPath)).resolves.toEqual([]);
  });
});
