// @vitest-environment node

import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("electron", () => ({
  app: { getPath: () => os.tmpdir() },
  net: { fetch: fetchMock },
  safeStorage: { isEncryptionAvailable: () => false },
}));

import { downloadAndImportMedia } from "../mediaDownload";
import { createSafeMediaFetcher } from "./safeMediaNetwork";
import { buildRuntimeAssetUrl } from "../../shared/projects/assetReference";
import { createProjectSaveCoordinator } from "../../renderer/project/projectSaveCoordinator";
import { buildProjectSnapshot } from "../../renderer/project/projectSnapshot";
import { ProjectDocumentV1Schema } from "../../shared/projects/projectDocumentSchema";
import { parseProjectSessionId } from "../../shared/projects/projectIpcContract";
import { createDefaultTheme, type ProjectData } from "../../renderer/store/types";
import { createProjectService, type ProjectDialogPort } from "./projectService";
import { inventoryWithHashes, runProjectMutation } from "./projectMutation";
import { runMutationBoundary } from "./projectMutationBoundary";
import { ProjectSessionRegistry } from "./projectSession";
import { createProjectTransferRegistry, runCancellableTransferBatch } from "./projectTransferRegistry";
import { createRecentProjectsStore } from "./recentProjects";

const roots: string[] = [];
const testMediaFetch = createSafeMediaFetcher({
  fetchPinned: (url, _addresses, signal) => fetchMock(url, { signal }),
  lookup: async () => [{ address: "8.8.8.8", family: 4 }],
});
afterEach(async () => {
  fetchMock.mockReset();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const projectRoot = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-stream-"));
  roots.push(root);
  return root;
};

const persistenceHarness = async () => {
  const root = await projectRoot();
  const targetPath = path.join(root, "streamed.amg");
  const saves = [{ canceled: false, filePath: targetPath }];
  const opens: Array<{ canceled: boolean; filePaths: readonly string[] }> = [];
  const dialogs: ProjectDialogPort = {
    showSave: async () => saves.shift() ?? { canceled: true },
    showOpen: async () => opens.shift() ?? { canceled: true, filePaths: [] },
  };
  const sessions = new ProjectSessionRegistry();
  const transfers = createProjectTransferRegistry();
  const service = createProjectService({
    userDataPath: path.join(root, "user-data"),
    documentsPath: root,
    dialogs,
    recents: createRecentProjectsStore({
      storagePath: path.join(root, "recents.json"),
      inspect: async () => ({ name: "Streamed", framework: "vanilla" }),
    }),
    sessions,
    abortSessionTransfers: transfers.abortSession,
  });
  return { root, targetPath, opens, sessions, transfers, service };
};

describe("media import streaming", () => {
  it("streams chunks directly to an atomically promoted project asset", async () => {
    const root = await projectRoot();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("first-"));
        controller.enqueue(new TextEncoder().encode("second"));
        controller.close();
      },
    });
    const response = new Response(body, { status: 200, headers: { "content-type": "video/mp4" } });
    const arrayBuffer = vi.spyOn(response, "arrayBuffer");
    fetchMock.mockResolvedValue(response);

    const result = await downloadAndImportMedia({ url: "https://media.example/video", projectDir: root, filename: "clip", maxBytes: 32, fetcher: testMediaFetch });

    expect(result).toMatchObject({ success: true, relativePath: "assets/clip.mp4" });
    expect(await readFile(path.join(root, "assets", "clip.mp4"), "utf8")).toBe("first-second");
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect((await readdir(path.join(root, "assets"))).some((name) => name.includes("partial"))).toBe(false);
  });

  it("removes the exclusive partial file when the streamed quota is exceeded", async () => {
    const root = await projectRoot();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
        controller.enqueue(new Uint8Array(8));
        controller.close();
      },
    });
    fetchMock.mockResolvedValue(new Response(body, { status: 200, headers: { "content-type": "image/png" } }));

    const result = await downloadAndImportMedia({ url: "https://media.example/image", projectDir: root, filename: "oversize", maxBytes: 10, fetcher: testMediaFetch });

    expect(result.success).toBe(false);
    expect(await readdir(path.join(root, "assets"))).toEqual([]);
  });

  it("cancels before allocation without leaving a partial file", async () => {
    const root = await projectRoot();
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException("canceled", "AbortError"));

    const result = await downloadAndImportMedia({ url: "https://media.example/image", projectDir: root, filename: "canceled", signal: controller.signal, fetcher: testMediaFetch });

    expect(result.success).toBe(false);
    await expect(readdir(path.join(root, "assets"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("cleans the partial file when cancellation arrives mid-stream", async () => {
    const root = await projectRoot();
    const abort = new AbortController();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(4));
        if (pulls === 1) abort.abort();
      },
    });
    fetchMock.mockResolvedValue(new Response(body, { status: 200, headers: { "content-type": "image/png" } }));

    const result = await downloadAndImportMedia({ url: "https://media.example/image", projectDir: root, filename: "mid-cancel", signal: abort.signal, fetcher: testMediaFetch });

    expect(result.success).toBe(false);
    expect(await readdir(path.join(root, "assets"))).toEqual([]);
  });

  it("aborts a production-scoped streamed mutation before service close drains it", async () => {
    const harness = await persistenceHarness();
    const created = await harness.service.newProject({ name: "Cancel transfer", framework: "vanilla" });
    if (!created.success) throw new Error("project creation failed");
    const workspace = (await harness.service.getDirectory()).directory;
    if (workspace === null) throw new Error("workspace missing");
    let observedSignal: AbortSignal | undefined;
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4));
      },
    }), { status: 200, headers: { "content-type": "image/png" } });
    fetchMock.mockImplementation(async (_url, options) => {
      observedSignal = options?.signal;
      return response;
    });

    const running = harness.sessions.runMutation(created.session.sessionId, () => harness.transfers.run(
      created.session.sessionId,
      (signal) => downloadAndImportMedia({ url: "https://media.example/blocked", projectDir: workspace, filename: "blocked", signal, fetcher: testMediaFetch }),
    ));
    while (harness.transfers.activeCount(created.session.sessionId) === 0 || observedSignal === undefined) await Promise.resolve();
    const staleClosing = await harness.service.close({
      expectedSessionId: parseProjectSessionId("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"),
      rendererGeneration: created.session.committedRendererGeneration,
      snapshot: created.session.data,
      dirtyChoice: "discard",
    });
    expect(staleClosing).toMatchObject({ success: false, error: { code: "STALE_SESSION" } });
    expect(observedSignal?.aborted).toBe(false);
    const closing = harness.service.close({
      expectedSessionId: created.session.sessionId,
      rendererGeneration: created.session.committedRendererGeneration,
      snapshot: created.session.data,
      dirtyChoice: "discard",
    });

    expect(await running).toMatchObject({ success: false, error: expect.stringContaining("canceled") });
    expect((await closing).success).toBe(true);
    expect(observedSignal?.aborted).toBe(true);
    expect(harness.transfers.activeCount(created.session.sessionId)).toBe(0);
  });

  it("keeps the production transfer lease across variants so close prevents the next request", async () => {
    const harness = await persistenceHarness();
    const created = await harness.service.newProject({ name: "Cancel font batch", framework: "vanilla" });
    if (!created.success) throw new Error("project creation failed");
    let releaseFirstVariant: (() => void) | undefined;
    let firstVariantStarted: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => { firstVariantStarted = resolve; });
    const releaseFirst = new Promise<void>((resolve) => { releaseFirstVariant = resolve; });
    const networkRequests: string[] = [];

    const running = harness.sessions.runMutation(created.session.sessionId, () => harness.transfers.run(
      created.session.sessionId,
      (signal) => runCancellableTransferBatch(signal, ["regular", "bold"], async (variant) => {
        networkRequests.push(variant);
        if (variant === "regular") {
          firstVariantStarted?.();
          await releaseFirst;
        }
        return variant;
      }),
    )).then(
      () => new Error("font batch unexpectedly completed"),
      (error: unknown) => error,
    );
    await firstStarted;

    const closing = harness.service.close({
      expectedSessionId: created.session.sessionId,
      rendererGeneration: created.session.committedRendererGeneration,
      snapshot: created.session.data,
      dirtyChoice: "discard",
    });
    releaseFirstVariant?.();

    expect(await running).toMatchObject({ name: "AbortError" });
    expect((await closing).success).toBe(true);
    expect(networkRequests).toEqual(["regular"]);
    expect(harness.transfers.activeCount(created.session.sessionId)).toBe(0);
  });

  it("streams a media-only mutation through autosave, close, and reopen with a new URL", async () => {
    const harness = await persistenceHarness();
    const created = await harness.service.newProject({ name: "Persist stream", framework: "vanilla" });
    if (!created.success) throw new Error("project creation failed");
    const workspace = (await harness.service.getDirectory()).directory;
    if (workspace === null) throw new Error("workspace missing");
    fetchMock.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("persisted-media"));
        controller.close();
      },
    }), { status: 200, headers: { "content-type": "image/png" } }));
    const listInventory = async () => {
      const names = await readdir(path.join(workspace, "assets")).catch(() => [] as string[]);
      return inventoryWithHashes(workspace, names.map((name) => `assets/${name}`));
    };
    const mutation = await runMutationBoundary(harness.sessions, { expectedSessionId: created.session.sessionId }, async (expectedSessionId) => (
      runProjectMutation({ sessions: harness.sessions, expectedSessionId, listInventory }, async () => {
        const downloaded = await harness.transfers.run(expectedSessionId, (signal) => (
          downloadAndImportMedia({ url: "https://media.example/persist", projectDir: workspace, filename: "persist", signal, fetcher: testMediaFetch })
        ));
        if (!downloaded.success || downloaded.relativePath === undefined) throw new Error("download failed");
        return downloaded.relativePath;
      })
    ));
    expect(mutation).toMatchObject({ success: true, changed: true, workspaceGeneration: 1 });
    if (!mutation.success) throw new Error("mutation failed");

    const rendererData: ProjectData = {
      customCss: "",
      projectSettings: { name: "Persist stream", framework: "vanilla", theme: createDefaultTheme(), globalStyles: {} },
      pages: [{ id: "home", title: "Home", slug: "index", blocks: [], meta: {} }],
      userBlocks: [],
    };
    const coordinator = createProjectSaveCoordinator({
      sessionId: created.session.sessionId,
      rendererGeneration: created.session.committedRendererGeneration,
      committedRendererGeneration: created.session.committedRendererGeneration,
      workspaceGeneration: created.session.committedWorkspaceGeneration,
      committedWorkspaceGeneration: created.session.committedWorkspaceGeneration,
      createSnapshot: () => buildProjectSnapshot({
        project: rendererData,
        currentPageId: rendererData.pages[0]?.id ?? null,
        flushedBlocks: rendererData.pages[0]?.blocks ?? [],
        customCss: rendererData.customCss,
        operation: "save",
        sessionId: created.session.sessionId,
        sessionKind: "amg",
        availableAssetPaths: [mutation.value],
      }),
      executeSave: async (invocation) => {
        const saved = await harness.service.save({
          expectedSessionId: invocation.expectedSessionId,
          rendererGeneration: invocation.rendererGeneration,
          snapshot: ProjectDocumentV1Schema.parse(invocation.snapshot),
        });
        return saved.success ? {
          success: true,
          sessionId: saved.session.sessionId,
          rendererGeneration: saved.session.committedRendererGeneration,
          workspaceGeneration: saved.session.committedWorkspaceGeneration,
        } : { success: false, error: { code: "error" in saved ? saved.error.code : "CANCELED", message: "autosave failed" } };
      },
    });
    expect(coordinator.recordMutation(mutation)).toEqual({ accepted: true });
    expect((await coordinator.requestAutosave()).success).toBe(true);
    const oldUrl = buildRuntimeAssetUrl(created.session.sessionId, mutation.value);

    const closed = await harness.service.close({
      expectedSessionId: created.session.sessionId,
      rendererGeneration: coordinator.state.rendererGeneration,
      snapshot: created.session.data,
      dirtyChoice: "discard",
    });
    expect(closed.success).toBe(true);
    harness.opens.push({ canceled: false, filePaths: [harness.targetPath] });
    const reopened = await harness.service.openProject();
    if (!reopened.success) throw new Error("reopen failed");
    expect(reopened.session.sessionId).not.toBe(created.session.sessionId);
    await expect(harness.service.resolveAssetRead(oldUrl)).rejects.toThrow("another session");

    const newUrl = buildRuntimeAssetUrl(reopened.session.sessionId, mutation.value);
    const readable = await harness.service.resolveAssetRead(newUrl);
    try {
      expect(await readFile(readable.filePath, "utf8")).toBe("persisted-media");
    } finally {
      readable.release();
    }
  });
});
