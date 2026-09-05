import { createServer, type Server } from "node:http";
import { access, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  TEST_PROJECT,
  buildAmgFixture,
  growEntryCompressedRange,
  patchFirstAsciiByte,
  patchZip64EntryCount,
  replaceAsciiSameLength,
} from "../../src/main/projects/amgArchiveFixtures";
import { capture, launchAmagon, queueNativeDialogs, stopAmagon } from "./electronHarness";
import {
  answerConfirmations,
  closeProjectThroughBridge,
  createProjectThroughUi,
  loadProjectThroughBridge,
  materializeCurrentSession,
  openRecentThroughBridge,
  saveProjectAsThroughBridge,
  saveProjectThroughBridge,
  settleEditor,
} from "./projectUi";
import { openRecentRequest, saveRequest, sessionAfterWorkspaceMutation } from "./projectTransitionRequests";

const encoder = new TextEncoder();

test("Save As rematerializes identity and serialization rejects stale cross-session work", async () => {
  // Given: an active archive, a destination, and a queued second-file import failure.
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-identity-"));
  const original = path.join(root, "original.amg");
  const copy = path.join(root, "copy.amg");
  const validImage = path.join(root, "first.png");
  const missingImage = path.join(root, "missing.png");
  await writeFile(validImage, new Uint8Array([137, 80, 78, 71]));
  const harness = await launchAmagon(root);
  try {
    await createProjectThroughUi({ harness, filePath: original, name: "Identity Matrix" });
    await harness.page.evaluate(() => window.api.autosave.stop());
    const first = await materializeCurrentSession(harness);

    // When: Save As commits through the shipped bridge.
    await queueNativeDialogs(harness.app, { saves: [copy] });
    const savedAs = await saveProjectAsThroughBridge(
      harness.page,
      { session: first, rendererGeneration: first.committedRendererGeneration + 1, snapshot: first.data },
    );

    // Then: the destination gets a fresh identity and the old session is stale.
    expect(savedAs.success).toBe(true);
    if (!savedAs.success) throw new TypeError("Save As failed");
    expect(savedAs.session.sessionId).not.toBe(first.sessionId);
    expect(savedAs.session.displayPath).toBe(copy);
    // When: a two-file mutation fails on the second selected source.
    await queueNativeDialogs(harness.app, { opens: [[validImage, missingImage]] });
    const batch = await harness.page.evaluate((expectedSessionId) => (
      window.api.assets.selectImage({ expectedSessionId })
    ), savedAs.session.sessionId);

    // Then: the mutation rolls back and does not advance the workspace generation.
    expect(batch.success).toBe(false);
    expect(batch.changed).toBe(false);
    expect(batch.workspaceGeneration).toBe(savedAs.session.committedWorkspaceGeneration);
    const listed = await harness.page.evaluate(() => window.api.assets.list());
    expect(listed.success).toBe(true);
    expect(listed.assets?.map((asset) => asset.relativePath) ?? []).not.toContain("assets/first.png");

    // When: save and reopen are initiated concurrently.
    const recents = await harness.page.evaluate(() => window.api.project.getRecent());
    if (!recents.success) throw new TypeError("recents failed");
    const copyRecent = recents.projects.find((recent) => recent.displayPath === copy);
    if (copyRecent === undefined) throw new TypeError("Save As recent missing");
    const race = await harness.page.evaluate(async ({ save, openRecent }) => Promise.all([
      window.api.project.save(save),
      window.api.project.openRecent(openRecent),
    ]), {
      save: saveRequest(savedAs.session, savedAs.session.committedRendererGeneration + 2, savedAs.session.data),
      openRecent: openRecentRequest(copyRecent.id, savedAs.session),
    });
    expect(race.filter((result) => result.success)).toHaveLength(1);
    expect(race[0].success).toBe(false);
    if (!race[0].success && !race[0].canceled) expect(["BUSY", "INTERNAL"]).toContain(race[0].error.code);
    if (!race[1].success) throw new TypeError("serialized reopen failed");
    expect(race[1].session.sessionId).not.toBe(savedAs.session.sessionId);
    const rematerialized = await openRecentThroughBridge(harness.page, copyRecent.id, race[1].session);
    if (!rematerialized.success) throw new TypeError("post-race rematerialization failed");
    expect(rematerialized.session.sessionId).not.toBe(savedAs.session.sessionId);
    expect(rematerialized.session.displayPath).toBe(copy);
  } finally {
    await stopAmagon(harness);
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid, overlapping, oversized, traversal, and non-portable archives preserve the prior session", async () => {
  // Given: an active project and small synthetic hostile archives.
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-hostile-"));
  const activePath = path.join(root, "active.amg");
  const base = await buildAmgFixture({ zip64: true });
  const nonPortableProject = encoder.encode(JSON.stringify({
    ...TEST_PROJECT,
    pages: [{ id: "home", title: "Home", slug: "index", blocks: [{
      id: "outside", type: "image", props: { src: path.join(root, "outside.png") }, styles: {}, classes: [], children: [],
    }], meta: {} }],
  }));
  const nonPortable = await buildAmgFixture({ payloads: [{ path: "project.json", bytes: nonPortableProject }] });
  const fixtures = [
    ["corrupt.amg", patchFirstAsciiByte(base.archive, "fixture asset bytes")],
    ["overlap.amg", growEntryCompressedRange(base.archive, 1, 100_000)],
    ["oversize.amg", patchZip64EntryCount(base.archive, 100_001)],
    ["traversal.amg", replaceAsciiSameLength(base.archive, "assets/photo.txt", "assets/../bad.tx")],
    ["nonportable.amg", nonPortable.archive],
  ] as const;
  for (const [name, bytes] of fixtures) await writeFile(path.join(root, name), bytes);
  const outsideSentinel = path.join(root, "bad.tx");
  const harness = await launchAmagon(root);
  try {
    await createProjectThroughUi({ harness, filePath: activePath, name: "Preserved Session" });
    let active = await materializeCurrentSession(harness);

    // When: every invalid archive is opened through the production IPC surface.
    for (const [name] of fixtures) {
      await queueNativeDialogs(harness.app, { opens: [[path.join(root, name)]] });
      const rejected = await loadProjectThroughBridge(harness.page, active);
      expect(rejected.success, name).toBe(false);
      if (!rejected.success && !rejected.canceled) {
        expect(["ARCHIVE_INVALID", "ARCHIVE_LIMIT_EXCEEDED", "ARCHIVE_INTEGRITY_FAILED"]).toContain(rejected.error.code);
      }
      const preserved = await saveProjectThroughBridge(
        harness.page,
        { session: active, rendererGeneration: active.committedRendererGeneration + 1, snapshot: active.data },
      );
      expect(preserved.success, name).toBe(true);
      if (!preserved.success) throw new TypeError("preserved session save failed");
      active = preserved.session;
    }

    // Then: no traversal target is written and visible open reports failure over the preserved editor.
    await expect(access(outsideSentinel)).rejects.toThrow();
    await harness.page.reload();
    await expect(harness.page.getByText("Loading...", { exact: true })).toHaveCount(0);
    await harness.page.getByText("Preserved Session", { exact: true }).click();
    await settleEditor(harness);
    await queueNativeDialogs(harness.app, { opens: [[path.join(root, "nonportable.amg")]] });
    answerConfirmations(harness.page, [false, true]);
    await harness.page.getByTitle("Open Project (Ctrl+O)").click();
    await expect(harness.page.getByText("Project is corrupted", { exact: true })).toBeVisible();
    await expect(harness.page.locator("#html-editor-layout")).toBeVisible();
    await capture(harness, "06-malicious-open-preserves-editor.png", {
      actions: ["open corrupt/overlap/oversize/traversal archives", "open non-portable archive from toolbar"],
      state: "readable rejection while the prior editor remains visible and responsive",
    });
  } finally {
    await stopAmagon(harness);
    await rm(root, { recursive: true, force: true });
  }
});

test("startup removes verified owned stale workspaces but preserves forged directories", async () => {
  // Given: one valid ownership sentinel and one forged workspace-like directory.
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-stale-"));
  const workspaceRoot = path.join(root, "profile", "amg-workspaces");
  const owned = path.join(workspaceRoot, "session-owned-stale");
  const forged = path.join(workspaceRoot, "session-forged-stale");
  await mkdir(owned, { recursive: true });
  await mkdir(forged, { recursive: true });
  await writeFile(path.join(owned, ".amagon-workspace.json"), JSON.stringify({
    marker: "amagon-owned-workspace", version: 1, workspaceName: "session-owned-stale",
  }));
  await writeFile(path.join(forged, ".amagon-workspace.json"), JSON.stringify({
    marker: "forged", version: 1, workspaceName: "session-forged-stale",
  }));

  // When: the built app starts with that profile.
  const harness = await launchAmagon(root);
  try {
    // Then: cleanup is proof-of-ownership gated.
    await expect(access(owned)).rejects.toThrow();
    await expect(access(forged)).resolves.toBeUndefined();
  } finally {
    await stopAmagon(harness);
    await rm(root, { recursive: true, force: true });
  }
});

const listen = async (server: Server): Promise<number> => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (address === null || typeof address === "string") reject(new TypeError("HTTP test server has no TCP port"));
    else resolve(address.port);
  });
});

test("forged media download authority cannot reach loopback or create partial files", async () => {
  // Given: a loopback listener and no main-issued provider capability.
  let requests = 0;
  const server = createServer((_request, response) => {
    requests += 1;
    response.writeHead(200, { "content-type": "image/png" });
    response.end(new Uint8Array([1, 2, 3]));
  });
  const port = await listen(server);
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-download-"));
  const harness = await launchAmagon(root);
  try {
    await createProjectThroughUi({ harness, filePath: path.join(root, "downloads.amg"), name: "Downloads" });
    const session = await materializeCurrentSession(harness);

    // When: a forged token is paired with a renderer-supplied loopback URL.
    const denied = await harness.page.evaluate(({ expectedSessionId, url }) => Reflect.apply(
      window.api.mediaSearch.downloadAndImport,
      window.api.mediaSearch,
      [{ expectedSessionId, downloadId: "A".repeat(43), url }],
    ), { expectedSessionId: session.sessionId, url: `http://127.0.0.1:${port}/media.png` });
    expect(denied.success).toBe(false);
    expect(denied.changed).toBe(false);
    const closed = await closeProjectThroughBridge(harness.page, session, "discard");
    expect(closed.success).toBe(true);

    // Then: no network request occurs and no partial file is allocated.
    expect(requests).toBe(0);
    const workspaceRoot = path.join(root, "profile", "amg-workspaces");
    const remaining = await readdir(workspaceRoot, { recursive: true }).catch(() => []);
    expect(remaining.some((entry) => entry.includes(".amagon-partial-"))).toBe(false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await stopAmagon(harness);
    await rm(root, { recursive: true, force: true });
  }
});

test("close waits for an active app-media read lease and cleans after cancellation", async () => {
  // Given: an imported project asset served by the registered app-media protocol.
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-read-lease-"));
  const target = path.join(root, "read-lease.amg");
  const mediaPath = path.join(root, "large.mp4");
  const mediaBytes = Buffer.alloc(8 * 1024 * 1024, 128);
  mediaBytes.write("RIFF", 0, "ascii");
  mediaBytes.writeUInt32LE(mediaBytes.byteLength - 8, 4);
  mediaBytes.write("WAVEfmt ", 8, "ascii");
  mediaBytes.writeUInt32LE(16, 16);
  mediaBytes.writeUInt16LE(1, 20);
  mediaBytes.writeUInt16LE(1, 22);
  mediaBytes.writeUInt32LE(8_000, 24);
  mediaBytes.writeUInt32LE(8_000, 28);
  mediaBytes.writeUInt16LE(1, 32);
  mediaBytes.writeUInt16LE(8, 34);
  mediaBytes.write("data", 36, "ascii");
  mediaBytes.writeUInt32LE(mediaBytes.byteLength - 44, 40);
  await writeFile(mediaPath, mediaBytes);
  const harness = await launchAmagon(root);
  try {
    await createProjectThroughUi({ harness, filePath: target, name: "Read Lease" });
    const session = await materializeCurrentSession(harness);
    await queueNativeDialogs(harness.app, { opens: [[mediaPath]] });
    const importedBatch = await harness.page.evaluate(
      (expectedSessionId) => window.api.assets.selectVideo({ expectedSessionId }),
      session.sessionId,
    );
    if (!importedBatch.success || importedBatch.value[0] === undefined) throw new TypeError("media import failed");
    const imported = importedBatch.value[0];
    const activeSession = sessionAfterWorkspaceMutation(session, importedBatch.workspaceGeneration);

    // When: close begins after one stream chunk while the renderer deliberately holds the reader.
    const observed = await harness.page.evaluate(async ({ active, mediaUrl }) => {
      const audio = new Audio();
      audio.muted = true;
      audio.preload = "auto";
      audio.src = mediaUrl;
      document.body.append(audio);
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
        audio.addEventListener("error", () => reject(new TypeError("app-media playback failed")), { once: true });
        audio.load();
      });
      await audio.play();
      let settled = false;
      const close = window.api.project.close({
        expectedSessionId: active.sessionId,
        rendererGeneration: active.committedRendererGeneration,
        workspaceGeneration: active.committedWorkspaceGeneration,
        snapshot: null,
        dirtyChoice: "discard",
      }).then((result) => {
        settled = true;
        return result;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const deferredWhileHeld = !settled;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.remove();
      return { deferredWhileHeld, close: await close };
    }, { active: activeSession, mediaUrl: imported.path });

    // Then: the read lease defers close until cancellation and cleanup removes the session workspace.
    expect(observed.deferredWhileHeld).toBe(true);
    expect(observed.close.success).toBe(true);
    const workspaceEntries = await readdir(path.join(root, "profile", "amg-workspaces")).catch(() => []);
    expect(workspaceEntries).toHaveLength(0);
  } finally {
    await stopAmagon(harness);
    await rm(root, { recursive: true, force: true });
  }
});
