// @vitest-environment node

import { mkdir, mkdtemp, open, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRuntimeAssetUrl } from "../../shared/projects/assetReference";
import {
  parseProjectSessionId,
  parseRecentProjectId,
  parseRendererGeneration,
} from "../../shared/projects/projectIpcContract";
import {
  parseLegacyProjectDocument,
  parseProjectDocumentV1,
  type LegacyProjectDocument,
  type ProjectDocumentV1,
} from "../../shared/projects/projectDocumentSchema";
import { buildProjectSnapshot } from "../../renderer/project/projectSnapshot";
import { createDefaultTheme, type ProjectData } from "../../renderer/store/types";
import { TEST_PROJECT } from "./amgArchiveFixtures.test";
import { extractAmgArchive } from "./amgArchiveReader";
import { writeAmgArchive } from "./amgArchiveWriter";
import { ProjectSessionRegistry } from "./projectSession";
import { createOwnedWorkspace } from "./projectWorkspace";
import { createRecentProjectsStore } from "./recentProjects";
import {
  createProjectService,
  type ProjectDialogPort,
  type ProjectServiceFiles,
} from "./projectService";

const RECENT_ID = "00000000-0000-4000-8000-000000000001";

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
};

const deferred = <T>(): Deferred<T> => {
  let release: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    release = resolve;
  });
  return { promise, resolve: release };
};

const legacyProject = (reference?: string): LegacyProjectDocument => ({
  ...structuredClone(TEST_PROJECT),
  pages: reference === undefined ? [] : [{
    id: "page",
    title: "Page",
    slug: "page",
    meta: {},
    blocks: [{
      id: "image",
      type: "image",
      props: { src: reference },
      styles: {},
      classes: [],
      children: [],
    }],
  }],
});

const rendererProject = (reference: string): ProjectData => ({
  customCss: "",
  projectSettings: {
    name: "Renderer snapshot",
    framework: "vanilla",
    theme: createDefaultTheme(),
    globalStyles: {},
  },
  pages: [{
    id: "page",
    title: "Page",
    slug: "page",
    meta: {},
    blocks: [{
      id: "image",
      type: "image",
      props: { src: reference },
      styles: {},
      classes: [],
      children: [],
    }],
  }],
  userBlocks: [],
});

type Harness = {
  readonly service: ReturnType<typeof createProjectService>;
  readonly dialogs: {
    readonly saves: Array<{ readonly canceled: boolean; readonly filePath?: string }>;
    readonly opens: Array<{ readonly canceled: boolean; readonly filePaths: readonly string[] }>;
    readonly requests: string[];
  };
  readonly calls: string[];
  readonly archives: Map<string, ProjectDocumentV1>;
  readonly legacy: Map<string, LegacyProjectDocument>;
  readonly workspaceAssets: Map<string, readonly string[]>;
  readonly files: ProjectServiceFiles;
  readonly sessions: ProjectSessionRegistry;
  readonly defaultWriter: ProjectServiceFiles["writeAmg"];
  readonly setWriter: (writer: ProjectServiceFiles["writeAmg"]) => void;
  readonly setRecentFailure: (fail: boolean) => void;
};

const createHarness = (): Harness => {
  const calls: string[] = [];
  const archives = new Map<string, ProjectDocumentV1>();
  const legacy = new Map<string, LegacyProjectDocument>();
  const workspaceAssets = new Map<string, readonly string[]>();
  let workspaceIndex = 0;
  const dialogs = {
    saves: [] as Array<{ readonly canceled: boolean; readonly filePath?: string }>,
    opens: [] as Array<{ readonly canceled: boolean; readonly filePaths: readonly string[] }>,
    requests: [] as string[],
  };
  const dialogPort: ProjectDialogPort = {
    showSave: async (request) => {
      dialogs.requests.push(`save:${request.defaultPath}`);
      return dialogs.saves.shift() ?? { canceled: true };
    },
    showOpen: async () => {
      dialogs.requests.push("open");
      return dialogs.opens.shift() ?? { canceled: true, filePaths: [] };
    },
  };
  const defaultWriter: ProjectServiceFiles["writeAmg"] = async ({ targetPath, project }) => {
    calls.push(`write-amg:${targetPath}`);
    archives.set(targetPath, project);
  };
  let writeAmg = defaultWriter;
  const files: ProjectServiceFiles = {
    openAmg: async (filePath) => {
      calls.push(`open-amg:${filePath}`);
      const project = archives.get(filePath);
      if (project === undefined) throw new TestFault("corrupt archive");
      const workspacePath = `C:\\owned\\opened-${workspaceIndex += 1}`;
      workspaceAssets.set(workspacePath, []);
      return {
        project,
        workspace: {
          path: workspacePath,
          rootPath: "C:\\owned",
          sentinelPath: `${workspacePath}\\.amagon-workspace.json`,
          ownership: "app",
        },
      };
    },
    readLegacy: async (filePath) => {
      calls.push(`read-legacy:${filePath}`);
      const project = legacy.get(filePath);
      if (project === undefined) throw new TestFault("missing legacy");
      return project;
    },
    writeAmg: (request) => writeAmg(request),
    writeLegacy: async (filePath, project) => {
      calls.push(`write-legacy:${filePath}`);
      legacy.set(filePath, project);
    },
    createWorkspace: async (_userDataPath, project, copy) => {
      const workspacePath = `C:\\owned\\candidate-${workspaceIndex += 1}`;
      calls.push(`create-workspace:${workspacePath}:${copy?.sourceWorkspacePath ?? "new"}`);
      workspaceAssets.set(workspacePath, copy?.assetPaths ?? []);
      return {
        path: workspacePath,
        rootPath: "C:\\owned",
        sentinelPath: `${workspacePath}\\.amagon-workspace.json`,
        ownership: "app",
      };
    },
    listAssetPaths: async (workspacePath) => workspaceAssets.get(workspacePath) ?? [],
    cleanupWorkspace: async (_userDataPath, workspacePath) => {
      calls.push(`cleanup:${workspacePath}`);
      workspaceAssets.delete(workspacePath);
    },
  };
  const recentPaths: string[] = [];
  let failRecentPersist = false;
  const recents = createRecentProjectsStore({
    storagePath: "C:\\user\\recent-projects.json",
    createId: () => RECENT_ID,
    persist: async (_storagePath, content) => {
      if (failRecentPersist) throw new TestFault("recent commit failed");
      calls.push("recent-commit");
      const parsed: unknown = JSON.parse(content);
      if (typeof parsed === "object" && parsed !== null) {
        const projects = Reflect.get(parsed, "projects");
        if (Array.isArray(projects)) {
          recentPaths.splice(0, recentPaths.length, ...projects.map((entry) => String(Reflect.get(entry, "path"))));
        }
      }
    },
    inspect: async (filePath) => {
      const project = archives.get(filePath) ?? legacy.get(filePath);
      return project === undefined ? {} : {
        name: project.projectSettings.name,
        framework: project.projectSettings.framework,
      };
    },
  });
  const sessions = new ProjectSessionRegistry();
  const service = createProjectService({
    userDataPath: "C:\\user",
    documentsPath: "C:\\documents",
    dialogs: dialogPort,
    recents,
    files,
    sessions,
  });
  return {
    service,
    dialogs,
    calls,
    archives,
    legacy,
    workspaceAssets,
    files,
    sessions,
    defaultWriter,
    setWriter: (writer) => { writeAmg = writer; },
    setRecentFailure: (fail) => { failRecentPersist = fail; },
  };
};

class TestFault extends Error {
  readonly name = "TestFault";
}

describe("project persistence service", () => {
  it("re-prompts conflicting extensions, appends .amg, commits, then records the recent", async () => {
    // Given: a conflicting target followed by an extensionless target.
    const harness = createHarness();
    harness.dialogs.saves.push(
      { canceled: false, filePath: "C:\\projects\\demo.json" },
      { canceled: false, filePath: "C:\\projects\\Demo Project" },
    );

    // When: a new project is created.
    const result = await harness.service.newProject({ name: "Demo Project", framework: "vanilla" });

    // Then: only the enforced archive is committed before recents and activated.
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.session.displayPath).toBe("C:\\projects\\Demo Project.amg");
    expect(harness.dialogs.requests).toEqual([
      "save:C:\\documents\\demo-project.amg",
      "save:C:\\documents\\demo-project.amg",
    ]);
    expect(harness.calls.filter((call) => call.startsWith("write-amg:"))).toEqual([
      "write-amg:C:\\projects\\Demo Project.amg",
    ]);
    expect(harness.calls.indexOf("recent-commit")).toBeGreaterThan(harness.calls.indexOf("write-amg:C:\\projects\\Demo Project.amg"));
    expect(JSON.stringify(harness.archives.get(result.session.displayPath))).not.toContain(result.session.sessionId);
  });

  it("preserves an uppercase .AMG target and cancellation leaves no session", async () => {
    // Given: one uppercase target and a later canceled dialog.
    const harness = createHarness();
    harness.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\DEMO.AMG" });

    // When: the first creation succeeds and a second is canceled.
    const created = await harness.service.newProject({ name: "Demo", framework: "vanilla" });
    harness.dialogs.saves.push({ canceled: true });
    const canceled = await harness.service.newProject({ name: "Other", framework: "vanilla" });

    // Then: casing is preserved and the active project is unchanged.
    expect(created.success && created.session.displayPath).toBe("C:\\projects\\DEMO.AMG");
    expect(canceled).toEqual({ success: false, canceled: true });
    expect((await harness.service.getDirectory()).directory).toContain("candidate-1");
  });

  it("opens, saves, saves-as, closes, and reopens under new session identities", async () => {
    // Given: one valid archive and a duplicate target.
    const harness = createHarness();
    harness.archives.set("C:\\projects\\source.amg", structuredClone(TEST_PROJECT));
    harness.dialogs.opens.push({ canceled: false, filePaths: ["C:\\projects\\source.amg"] });

    // When: the archive opens, saves, duplicates, closes, and reopens.
    const opened = await harness.service.openProject();
    if (!opened.success) throw new TestFault("open failed");
    const saved = await harness.service.save({
      expectedSessionId: opened.session.sessionId,
      rendererGeneration: parseRendererGeneration(2),
      snapshot: opened.session.data,
    });
    harness.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\copy.amg" });
    const duplicated = await harness.service.saveAs({
      expectedSessionId: opened.session.sessionId,
      rendererGeneration: parseRendererGeneration(2),
      snapshot: opened.session.data,
    });
    if (!duplicated.success) throw new TestFault("save as failed");
    const closed = await harness.service.close({
      expectedSessionId: duplicated.session.sessionId,
      rendererGeneration: parseRendererGeneration(2),
      snapshot: duplicated.session.data,
      dirtyChoice: "discard",
    });
    harness.dialogs.opens.push({ canceled: false, filePaths: ["C:\\projects\\copy.amg"] });
    const reopened = await harness.service.openProject();

    // Then: generations echo commits and durable bytes contain neither identity.
    expect(saved.success && saved.session.committedRendererGeneration).toBe(2);
    expect(duplicated.session.sessionId).not.toBe(opened.session.sessionId);
    expect(closed.success).toBe(true);
    expect(reopened.success).toBe(true);
    if (!reopened.success) return;
    expect(reopened.session.sessionId).not.toBe(duplicated.session.sessionId);
    const persisted = JSON.stringify(harness.archives.get("C:\\projects\\copy.amg"));
    expect(persisted).not.toContain(opened.session.sessionId);
    expect(persisted).not.toContain(duplicated.session.sessionId);
  });

  it.each([
    "C:\\legacy\\photo.png",
    "file:///C:/legacy/photo.png",
    "app-media://absolute/C:/legacy/photo.png",
  ])("preserves approved legacy external reference %s on Save and blocks conversion before writing", async (external) => {
    // Given: a loose legacy project with one approved external local reference.
    const harness = createHarness();
    const sourcePath = "C:\\legacy\\project.json";
    const original = legacyProject(external);
    harness.legacy.set(sourcePath, original);
    harness.dialogs.opens.push({ canceled: false, filePaths: [sourcePath] });

    // When: ordinary Save runs, then Save As is attempted before and after importing the reference.
    const opened = await harness.service.openProject();
    if (!opened.success) throw new TestFault("legacy open failed");
    const saved = await harness.service.save({
      expectedSessionId: opened.session.sessionId,
      rendererGeneration: parseRendererGeneration(1),
      snapshot: original,
    });
    harness.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\converted.amg" });
    const blocked = await harness.service.saveAs({
      expectedSessionId: opened.session.sessionId,
      rendererGeneration: parseRendererGeneration(1),
      snapshot: original,
    });
    harness.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\converted.amg" });
    const converted = await harness.service.saveAs({
      expectedSessionId: opened.session.sessionId,
      rendererGeneration: parseRendererGeneration(2),
      snapshot: { ...legacyProject(), projectSchemaVersion: 1 },
    });

    // Then: ordinary JSON is unchanged, the blocker precedes archive IO, and conversion owns a fresh workspace.
    expect(saved.success).toBe(true);
    expect(harness.legacy.get(sourcePath)).toEqual(original);
    expect(blocked).toMatchObject({ success: false, error: { code: "PROJECT_NOT_PORTABLE" } });
    expect(harness.calls.filter((call) => call === "write-amg:C:\\projects\\converted.amg")).toHaveLength(1);
    expect(converted.success).toBe(true);
    if (!converted.success) return;
    expect(converted.session.kind).toBe("amg");
    expect(converted.session.displayPath).toBe("C:\\projects\\converted.amg");
    expect((await harness.service.getDirectory()).directory).toMatch(/candidate-/u);
  });

  it("keeps the prior session and recents when open or archive commit fails", async () => {
    // Given: one active archive, one corrupt archive, and an injected writer failure.
    const harness = createHarness();
    harness.archives.set("C:\\projects\\good.amg", structuredClone(TEST_PROJECT));
    harness.dialogs.opens.push({ canceled: false, filePaths: ["C:\\projects\\good.amg"] });
    const good = await harness.service.openProject();
    if (!good.success) throw new TestFault("good open failed");
    harness.dialogs.opens.push({ canceled: false, filePaths: ["C:\\projects\\corrupt.amg"] });

    // When: corrupt open and a failing Save As are attempted.
    const corrupt = await harness.service.openProject();
    harness.setWriter(async () => { throw new TestFault("archive write failed"); });
    harness.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\failed.amg" });
    const failed = await harness.service.saveAs({
      expectedSessionId: good.session.sessionId,
      rendererGeneration: parseRendererGeneration(1),
      snapshot: good.session.data,
    });
    harness.setWriter(harness.defaultWriter);

    // Then: both failures leave the active workspace and prior recent untouched.
    expect(corrupt.success).toBe(false);
    expect(failed.success).toBe(false);
    expect((await harness.service.getDirectory()).directory).toContain("opened-1");
    const recents = await harness.service.getRecent();
    expect(recents.success && recents.projects).toHaveLength(1);
  });

  it("does not activate new, open, or legacy Save As candidates when recents persistence fails", async () => {
    // Given: an active archive and a recent store that begins failing after initial activation.
    const harness = createHarness();
    harness.archives.set("C:\\projects\\prior.amg", structuredClone(TEST_PROJECT));
    harness.dialogs.opens.push({ canceled: false, filePaths: ["C:\\projects\\prior.amg"] });
    const prior = await harness.service.openProject();
    if (!prior.success) throw new TestFault("prior open failed");
    const priorDirectory = (await harness.service.getDirectory()).directory;
    harness.setRecentFailure(true);

    // When: each transition commits/stages a candidate but cannot persist its recent entry.
    harness.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\new-failed.amg" });
    const failedNew = await harness.service.newProject({ name: "Failed", framework: "vanilla" });
    harness.archives.set("C:\\projects\\open-failed.amg", structuredClone(TEST_PROJECT));
    harness.dialogs.opens.push({ canceled: false, filePaths: ["C:\\projects\\open-failed.amg"] });
    const failedOpen = await harness.service.openProject();

    // Then: neither transition activates, and both owned candidates are cleaned.
    expect(failedNew.success).toBe(false);
    expect(failedOpen.success).toBe(false);
    expect((await harness.service.getDirectory()).directory).toBe(priorDirectory);
    expect(harness.sessions.active.id).toBe(prior.session.sessionId);
    expect(harness.calls).toContain("cleanup:C:\\owned\\candidate-2");
    expect(harness.calls).toContain("cleanup:C:\\owned\\opened-3");

    // Given: a legacy source selected after recents persistence resumes.
    harness.setRecentFailure(false);
    const legacyPath = "C:\\legacy\\project.json";
    harness.legacy.set(legacyPath, legacyProject());
    harness.dialogs.opens.push({ canceled: false, filePaths: [legacyPath] });
    const legacy = await harness.service.openProject();
    if (!legacy.success) throw new TestFault("legacy open failed");
    harness.setRecentFailure(true);
    harness.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\conversion-failed.amg" });

    // When: conversion archive commit succeeds but recent persistence fails.
    const failedSaveAs = await harness.service.saveAs({
      expectedSessionId: legacy.session.sessionId,
      rendererGeneration: parseRendererGeneration(1),
      snapshot: { ...legacyProject(), projectSchemaVersion: 1 },
    });

    // Then: the legacy session stays active and the fresh conversion workspace is discarded.
    expect(failedSaveAs.success).toBe(false);
    expect(harness.sessions.active.id).toBe(legacy.session.sessionId);
    expect((await harness.service.getDirectory()).directory).toBe("C:\\legacy");
    expect(harness.calls.some((call) => call.startsWith("cleanup:C:\\owned\\candidate-"))).toBe(true);
  });

  it("rejects forged recent authority before project filesystem access", async () => {
    // Given: an empty main-owned recent store.
    const harness = createHarness();

    // When: path-like and unknown UUID authorities are presented.
    const forged = await harness.service.openRecent("C:\\projects\\forged.amg");
    const unknown = await harness.service.openRecent(parseRecentProjectId(RECENT_ID));

    // Then: neither value reaches archive or legacy IO.
    expect(forged.success).toBe(false);
    expect(unknown.success).toBe(false);
    expect(harness.calls.some((call) => call.startsWith("open-amg:") || call.startsWith("read-legacy:"))).toBe(false);
  });

  it("resolves a main-owned recent ID and rematerializes it under a new session", async () => {
    // Given: a committed archive whose opaque ID is held by the recent store.
    const harness = createHarness();
    harness.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\recent.amg" });
    const created = await harness.service.newProject({ name: "Recent", framework: "vanilla" });
    if (!created.success) throw new TestFault("new failed");

    // When: the opaque authority is opened without presenting a path.
    const reopened = await harness.service.openRecent(parseRecentProjectId(RECENT_ID));

    // Then: the stored path is opened and a newly branded session is returned.
    expect(reopened.success).toBe(true);
    if (!reopened.success) return;
    expect(reopened.session.displayPath).toBe("C:\\projects\\recent.amg");
    expect(reopened.session.sessionId).not.toBe(created.session.sessionId);
    expect(harness.calls).toContain("open-amg:C:\\projects\\recent.amg");
  });

  it("blocks non-portable AMG Save before archive IO", async () => {
    // Given: an active archive and a snapshot containing an external local reference.
    const harness = createHarness();
    harness.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\portable.amg" });
    const created = await harness.service.newProject({ name: "Portable", framework: "vanilla" });
    if (!created.success) throw new TestFault("new failed");
    const writesBefore = harness.calls.filter((call) => call.startsWith("write-amg:")).length;

    // When: ordinary Save receives the non-portable durable snapshot.
    const blocked = await harness.service.save({
      expectedSessionId: created.session.sessionId,
      rendererGeneration: parseRendererGeneration(1),
      snapshot: { ...legacyProject("file:///C:/outside/photo.png"), projectSchemaVersion: 1 },
    });

    // Then: portability validation fails before another archive write.
    expect(blocked).toMatchObject({ success: false, error: { code: "PROJECT_NOT_PORTABLE" } });
    expect(harness.calls.filter((call) => call.startsWith("write-amg:")).length).toBe(writesBefore);
  });

  it("persists actual renderer-built durable snapshots and rejects direct runtime references", async () => {
    // Given: Todo 3 builds AMG Save and Save As requests from current-session runtime state.
    const amg = createHarness();
    amg.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\runtime.amg" });
    const created = await amg.service.newProject({ name: "Runtime", framework: "vanilla" });
    if (!created.success) throw new TestFault("new failed");
    const amgWorkspace = (await amg.service.getDirectory()).directory;
    if (amgWorkspace === null) throw new TestFault("AMG workspace missing");
    amg.workspaceAssets.set(amgWorkspace, ["assets/photo.png"]);
    const amgRuntime = buildRuntimeAssetUrl(created.session.sessionId, "assets/photo.png");
    const amgSaveSnapshot = buildProjectSnapshot({
      project: rendererProject(amgRuntime),
      currentPageId: null,
      flushedBlocks: [],
      customCss: "",
      sessionId: created.session.sessionId,
      sessionKind: "amg",
      operation: "save",
      availableAssetPaths: ["assets/photo.png"],
    });
    const amgSaveAsSnapshot = buildProjectSnapshot({
      project: rendererProject(amgRuntime),
      currentPageId: null,
      flushedBlocks: [],
      customCss: "",
      sessionId: created.session.sessionId,
      sessionKind: "amg",
      operation: "save-as",
      availableAssetPaths: ["assets/photo.png"],
    });
    if (!amgSaveSnapshot.ok || !amgSaveAsSnapshot.ok) throw new TestFault("AMG snapshot failed");

    // When: AMG Save and Save As persist the renderer snapshot.
    const saved = await amg.service.save({
      expectedSessionId: created.session.sessionId,
      rendererGeneration: parseRendererGeneration(1),
      snapshot: parseProjectDocumentV1(amgSaveSnapshot.project),
    });
    amg.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\runtime-copy.amg" });
    const duplicated = await amg.service.saveAs({
      expectedSessionId: created.session.sessionId,
      rendererGeneration: parseRendererGeneration(1),
      snapshot: parseProjectDocumentV1(amgSaveAsSnapshot.project),
    });

    // Then: both archives contain only the canonical durable reference.
    expect(saved.success).toBe(true);
    expect(duplicated.success).toBe(true);
    if (!duplicated.success) throw new TestFault("AMG duplication failed");
    for (const target of ["C:\\projects\\runtime.amg", "C:\\projects\\runtime-copy.amg"]) {
      const durableBytes = JSON.stringify(amg.archives.get(target));
      expect(durableBytes).toContain("assets/photo.png");
      expect(durableBytes).not.toContain(created.session.sessionId);
      expect(durableBytes).not.toContain(duplicated.session.sessionId);
      expect(durableBytes).not.toContain("app-media://project-asset");
    }

    // Given: Todo 3 builds equivalent legacy Save and conversion snapshots.
    const legacy = createHarness();
    const legacyPath = "C:\\legacy\\project.json";
    legacy.legacy.set(legacyPath, legacyProject());
    legacy.workspaceAssets.set("C:\\legacy", ["assets/photo.png"]);
    legacy.dialogs.opens.push({ canceled: false, filePaths: [legacyPath] });
    const opened = await legacy.service.openProject();
    if (!opened.success) throw new TestFault("legacy open failed");
    const legacyRuntime = buildRuntimeAssetUrl(opened.session.sessionId, "assets/photo.png");
    const legacySaveSnapshot = buildProjectSnapshot({
      project: rendererProject(legacyRuntime),
      currentPageId: null,
      flushedBlocks: [],
      customCss: "",
      sessionId: opened.session.sessionId,
      sessionKind: "legacy-json",
      operation: "save",
      availableAssetPaths: ["assets/photo.png"],
    });
    const legacyConversionSnapshot = buildProjectSnapshot({
      project: rendererProject(legacyRuntime),
      currentPageId: null,
      flushedBlocks: [],
      customCss: "",
      sessionId: opened.session.sessionId,
      sessionKind: "legacy-json",
      operation: "save-as",
      availableAssetPaths: ["assets/photo.png"],
    });
    if (!legacySaveSnapshot.ok || !legacyConversionSnapshot.ok) throw new TestFault("legacy snapshot failed");

    // When: ordinary legacy Save and conversion persist that renderer snapshot.
    const legacySaved = await legacy.service.save({
      expectedSessionId: opened.session.sessionId,
      rendererGeneration: parseRendererGeneration(1),
      snapshot: parseLegacyProjectDocument(legacySaveSnapshot.project),
    });
    legacy.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\legacy-converted.amg" });
    const converted = await legacy.service.saveAs({
      expectedSessionId: opened.session.sessionId,
      rendererGeneration: parseRendererGeneration(2),
      snapshot: parseProjectDocumentV1(legacyConversionSnapshot.project),
    });

    // Then: JSON and converted archive are session-neutral while approved externals remain covered separately.
    expect(legacySaved.success).toBe(true);
    expect(converted.success).toBe(true);
    if (!converted.success) throw new TestFault("legacy conversion failed");
    for (const durable of [legacy.legacy.get(legacyPath), legacy.archives.get("C:\\projects\\legacy-converted.amg")]) {
      const durableBytes = JSON.stringify(durable);
      expect(durableBytes).toContain("assets/photo.png");
      expect(durableBytes).not.toContain(opened.session.sessionId);
      expect(durableBytes).not.toContain(converted.session.sessionId);
      expect(durableBytes).not.toContain("app-media://project-asset");
    }

    // When: a malicious caller bypasses Todo 3 and submits a runtime URL directly.
    const writesBefore = legacy.calls.filter((call) => call.startsWith("write-amg:")).length;
    const rejected = await legacy.service.save({
      expectedSessionId: converted.session.sessionId,
      rendererGeneration: parseRendererGeneration(3),
      snapshot: {
        ...legacyProject(buildRuntimeAssetUrl(
          converted.session.sessionId,
          "assets/photo.png",
        )),
        projectSchemaVersion: 1,
      },
    });

    // Then: main rejects runtime identity before another archive write.
    expect(rejected).toMatchObject({ success: false, error: { code: "PROJECT_NOT_PORTABLE" } });
    expect(legacy.calls.filter((call) => call.startsWith("write-amg:")).length).toBe(writesBefore);

    // When: a different valid main-shaped session identity is supplied as stored data.
    const foreignIdentity = parseProjectSessionId("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
    const foreignRejected = await legacy.service.save({
      expectedSessionId: converted.session.sessionId,
      rendererGeneration: parseRendererGeneration(4),
      snapshot: { ...legacyProject(foreignIdentity), projectSchemaVersion: 1 },
    });

    // Then: complete foreign identity values are rejected without substring-scanning ordinary content.
    expect(foreignRejected).toMatchObject({ success: false, error: { code: "PROJECT_NOT_PORTABLE" } });
    expect(legacy.calls.filter((call) => call.startsWith("write-amg:")).length).toBe(writesBefore);
  });

  it("echoes the current workspace generation after a successful Save", async () => {
    // Given: an active archive with one main-owned workspace mutation.
    const harness = createHarness();
    harness.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\workspace.amg" });
    const created = await harness.service.newProject({ name: "Workspace", framework: "vanilla" });
    if (!created.success) throw new TestFault("new failed");
    harness.sessions.active.recordWorkspaceMutation(created.session.sessionId);

    // When: the renderer saves its current generation.
    const saved = await harness.service.save({
      expectedSessionId: created.session.sessionId,
      rendererGeneration: parseRendererGeneration(1),
      snapshot: created.session.data,
    });

    // Then: both committed authorities echo the state that was archived.
    expect(saved.success).toBe(true);
    if (!saved.success) return;
    expect(saved.session.committedRendererGeneration).toBe(1);
    expect(saved.session.committedWorkspaceGeneration).toBe(1);
  });

  it("drains queued work before replacing the active session", async () => {
    // Given: one save inside archive IO and a second save queued behind it.
    const harness = createHarness();
    harness.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\old.amg" });
    const old = await harness.service.newProject({ name: "Old", framework: "vanilla" });
    if (!old.success) throw new TestFault("new failed");
    const entered = deferred<void>();
    const release = deferred<void>();
    let writes = 0;
    harness.setWriter(async (request) => {
      writes += 1;
      if (writes === 1) {
        entered.resolve();
        await release.promise;
      }
      await harness.defaultWriter(request);
    });
    const inFlight = harness.service.save({
      expectedSessionId: old.session.sessionId,
      rendererGeneration: parseRendererGeneration(1),
      snapshot: old.session.data,
    });
    await entered.promise;
    const queued = harness.service.save({
      expectedSessionId: old.session.sessionId,
      rendererGeneration: parseRendererGeneration(2),
      snapshot: old.session.data,
    });

    // When: a validated archive waits for both queued saves before replacing the session.
    harness.archives.set("C:\\projects\\replacement.amg", structuredClone(TEST_PROJECT));
    harness.dialogs.opens.push({ canceled: false, filePaths: ["C:\\projects\\replacement.amg"] });
    const replacing = harness.service.openProject();
    release.resolve();
    const [replacement, firstResult, queuedResult] = await Promise.all([replacing, inFlight, queued]);

    // Then: both saves complete in FIFO order before the replacement becomes active.
    expect(replacement.success).toBe(true);
    expect(firstResult.success).toBe(true);
    expect(queuedResult.success).toBe(true);
    expect(writes).toBe(2);
  });

  it("revalidates a queued renderer generation before a second archive write", async () => {
    // Given: an active session whose first save holds the FIFO mutation queue.
    const harness = createHarness();
    harness.dialogs.saves.push({ canceled: false, filePath: "C:\\projects\\race.amg" });
    const created = await harness.service.newProject({ name: "Race", framework: "vanilla" });
    if (!created.success) throw new TestFault("new failed");
    const gate = deferred<void>();
    let writes = 0;
    harness.setWriter(async (request) => {
      writes += 1;
      if (writes === 1) await gate.promise;
      await harness.defaultWriter(request);
    });

    // When: generation two saves before a queued generation one request.
    const newer = harness.service.save({
      expectedSessionId: created.session.sessionId,
      rendererGeneration: parseRendererGeneration(2),
      snapshot: created.session.data,
    });
    const stale = harness.service.save({
      expectedSessionId: created.session.sessionId,
      rendererGeneration: parseRendererGeneration(1),
      snapshot: created.session.data,
    });
    gate.resolve();
    const [newerResult, staleResult] = await Promise.all([newer, stale]);

    // Then: only the current generation writes and its committed generations echo.
    expect(newerResult.success).toBe(true);
    expect(staleResult).toMatchObject({ success: false, error: { code: "STALE_RENDERER_GENERATION" } });
    expect(writes).toBe(1);
    if (!newerResult.success) return;
    expect(newerResult.session.committedRendererGeneration).toBe(2);
    expect(newerResult.session.committedWorkspaceGeneration).toBe(0);
  });

  it("rejects a real AMG candidate containing a foreign canonical session identity and cleans it", async () => {
    // Given: one active real project and a second archive containing another valid main-shaped identity.
    const root = await mkdtemp(path.join(tmpdir(), "amg-service-foreign-session-"));
    try {
      const userDataPath = path.join(root, "user-data");
      const priorPath = path.join(root, "prior.amg");
      const maliciousPath = path.join(root, "foreign.amg");
      await mkdir(userDataPath, { recursive: true });
      const saves = [{ canceled: false, filePath: priorPath }];
      const opens = [{ canceled: false, filePaths: [maliciousPath] }];
      const service = createProjectService({
        userDataPath,
        documentsPath: root,
        dialogs: {
          showSave: async () => saves.shift() ?? { canceled: true },
          showOpen: async () => opens.shift() ?? { canceled: true, filePaths: [] },
        },
        recents: createRecentProjectsStore({ storagePath: path.join(userDataPath, "recent-projects.json") }),
      });
      const prior = await service.newProject({ name: "Prior", framework: "vanilla" });
      if (!prior.success) throw new TestFault("prior creation failed");
      const priorDirectory = (await service.getDirectory()).directory;
      const foreignIdentity = parseProjectSessionId("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
      const authorWorkspace = await createOwnedWorkspace(path.join(root, "author-user-data"));
      const maliciousProject: ProjectDocumentV1 = {
        ...legacyProject(foreignIdentity),
        projectSchemaVersion: 1,
      };
      await writeAmgArchive({
        targetPath: maliciousPath,
        workspacePath: authorWorkspace.path,
        project: maliciousProject,
      });

      // When: the candidate is extracted and validated before activation.
      const rejected = await service.openProject();

      // Then: archive staging rejects it, prior stays active, and only its workspace remains.
      expect(rejected).toMatchObject({ success: false, error: { code: "ARCHIVE_INVALID" } });
      expect((await service.getDirectory()).directory).toBe(priorDirectory);
      expect(await readdir(path.join(userDataPath, "amg-workspaces"))).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("converts legacy JSON through a fresh owned workspace without mutating its source tree", async () => {
    // Given: a real legacy tree with one external blocker and one allowlisted asset.
    const root = await mkdtemp(path.join(tmpdir(), "amg-service-real-"));
    try {
      const userDataPath = path.join(root, "user-data");
      const documentsPath = path.join(root, "documents");
      const sourceRoot = path.join(root, "legacy");
      const sourcePath = path.join(sourceRoot, "project.json");
      const sourceAsset = path.join(sourceRoot, "assets", "photo.txt");
      const targetPath = path.join(root, "converted.amg");
      await mkdir(path.dirname(sourceAsset), { recursive: true });
      await mkdir(userDataPath, { recursive: true });
      await mkdir(documentsPath, { recursive: true });
      const external = "file:///C:/legacy/outside.png";
      await writeFile(sourcePath, JSON.stringify(legacyProject(external)));
      await writeFile(sourceAsset, "legacy asset bytes");
      const saves: Array<{ readonly canceled: boolean; readonly filePath?: string }> = [];
      const opens = [{ canceled: false, filePaths: [sourcePath] }];
      const service = createProjectService({
        userDataPath,
        documentsPath,
        dialogs: {
          showSave: async () => saves.shift() ?? { canceled: true },
          showOpen: async () => opens.shift() ?? { canceled: true, filePaths: [] },
        },
        recents: createRecentProjectsStore({ storagePath: path.join(userDataPath, "recent-projects.json") }),
      });

      // When: ordinary Save preserves the external reference, conversion blocks, then portable retry succeeds and mutates only its owned workspace.
      const opened = await service.openProject();
      if (!opened.success) throw new TestFault("real legacy open failed");
      await service.save({
        expectedSessionId: opened.session.sessionId,
        rendererGeneration: parseRendererGeneration(1),
        snapshot: legacyProject(external),
      });
      const sourceJsonAfterOrdinarySave = await readFile(sourcePath);
      const sourceAssetBeforeConversion = await readFile(sourceAsset);
      saves.push({ canceled: false, filePath: targetPath });
      const blocked = await service.saveAs({
        expectedSessionId: opened.session.sessionId,
        rendererGeneration: parseRendererGeneration(1),
        snapshot: { ...legacyProject(external), projectSchemaVersion: 1 },
      });
      const portable: ProjectDocumentV1 = {
        ...legacyProject("assets/photo.txt"),
        projectSchemaVersion: 1,
      };
      saves.push({ canceled: false, filePath: targetPath });
      const converted = await service.saveAs({
        expectedSessionId: opened.session.sessionId,
        rendererGeneration: parseRendererGeneration(2),
        snapshot: portable,
      });
      if (!converted.success) throw new TestFault("real conversion failed");
      const directory = (await service.getDirectory()).directory;
      if (directory === null) throw new TestFault("converted workspace missing");
      await writeFile(path.join(directory, "assets", "photo.txt"), "converted mutation");
      await service.save({
        expectedSessionId: converted.session.sessionId,
        rendererGeneration: parseRendererGeneration(3),
        snapshot: portable,
      });

      // Then: blocker precedes archive creation, the new session is owned, and both legacy source files remain byte-identical.
      expect(blocked).toMatchObject({ success: false, error: { code: "PROJECT_NOT_PORTABLE" } });
      expect(directory).not.toBe(sourceRoot);
      expect(await readFile(sourcePath)).toEqual(sourceJsonAfterOrdinarySave);
      expect(await readFile(sourceAsset)).toEqual(sourceAssetBeforeConversion);
      const archive = await open(targetPath, "r");
      const extracted = await extractAmgArchive({ archive, userDataPath });
      await archive.close();
      expect(await readFile(path.join(extracted.workspace.path, "assets", "photo.txt"), "utf8")).toBe("converted mutation");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
