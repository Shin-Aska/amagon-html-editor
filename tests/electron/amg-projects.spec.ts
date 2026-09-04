import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { TEST_PROJECT, buildAmgFixture, replaceAsciiSameLength } from "../../src/main/projects/amgArchiveFixtures";
import { inspectAmgArchive } from "./archiveAssertions";
import { capture, launchAmagon, queueNativeDialogs, stopAmagon } from "./electronHarness";
import { openProjectThroughUi } from "./projectUi";

const projectWithReference = (reference: string) => ({
  ...TEST_PROJECT,
  pages: [{
    id: "home",
    title: "Home",
    slug: "index",
    blocks: [{
      id: "hero-image",
      type: "image",
      props: { src: reference },
      styles: {},
      classes: [],
      children: [],
    }],
    meta: {},
  }],
});

const waveBytes = (): Uint8Array => {
  const bytes = new Uint8Array(44 + 8_000);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8_000, true);
  view.setUint32(28, 8_000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, "data");
  view.setUint32(40, 8_000, true);
  bytes.fill(128, 44);
  return bytes;
};

test.describe.serial("AMG desktop project format", () => {
  test("creates, inspects, reopens, streams, and closes a portable project", async () => {
    // Given: a real built Electron app with an isolated profile and native dialog responses.
    const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-new-"));
    const target = path.join(root, "Portable Site.amg");
    const audioPath = path.join(root, "tone.wav");
    const stalePath = path.join(root, "profile", "amg-workspaces", "session-stale-fixture");
    await mkdir(stalePath, { recursive: true });
    await writeFile(path.join(stalePath, ".amagon-workspace.json"), JSON.stringify({
      marker: "amagon-owned-workspace", version: 1, workspaceName: "session-stale-fixture",
    }));
    await writeFile(audioPath, waveBytes());
    const harness = await launchAmagon(root);
    try {
      expect(path.resolve(await harness.app.evaluate(({ app }) => app.getPath("userData"))))
        .toBe(path.resolve(path.join(root, "profile")));
      await expect(access(stalePath)).rejects.toThrow();
      await expect(harness.page.getByText("Loading...", { exact: true })).toHaveCount(0);
      await capture(harness, "01-welcome.png", { actions: ["launch isolated profile"], state: "settled welcome" });
      await queueNativeDialogs(harness.app, { saves: [path.join(root, "wrong.json"), target] });

      // When: the user creates a named project and the first invalid extension is re-prompted.
      await harness.page.getByRole("button", { name: /New Project/u }).click();
      await harness.page.getByLabel("Project Name").fill("Portable Site");
      await harness.page.getByRole("button", { name: "Create Project" }).click();
      await expect(harness.page.locator("#html-editor-layout")).toBeVisible();
      const onboarding = harness.page.getByRole("button", { name: "Skip for now" });
      if (await onboarding.isVisible()) await onboarding.click();
      await expect(harness.page.getByText("Loading...", { exact: true })).toHaveCount(0);
      await capture(harness, "02-new-amg-editor.png", {
        actions: ["New Project", "enter Portable Site", "Create Project", "dismiss onboarding"],
        state: "settled AMG editor",
      });

      // Then: the archive is allowlisted, hash-consistent, and represented by an opaque recent ID.
      const initial = await inspectAmgArchive(target, "archive-initial.json");
      expect(initial.paths).toEqual(["manifest.json", "project.json"]);
      expect(initial.projectText).not.toContain("app-media://");
      const recents = await harness.page.evaluate(() => window.api.project.getRecent());
      expect(recents.success).toBe(true);
      if (!recents.success) throw new TypeError("recent-project lookup failed");
      expect(recents.projects).toHaveLength(1);
      expect(recents.projects[0]?.displayPath).toBe(target);
      expect(recents.projects[0]?.id).not.toBe(target);
      const recentId = recents.projects[0]?.id;
      if (recentId === undefined) throw new TypeError("recent-project ID is missing");

      // When: the recent is opened, a media-only mutation is saved, then opened again.
      const firstOpen = await harness.page.evaluate((id) => window.api.project.openRecent(id), recentId);
      expect(firstOpen.success).toBe(true);
      if (!firstOpen.success) throw new TypeError("first recent open failed");
      const imported = await harness.page.evaluate(
        ({ expectedSessionId, srcPath }) => window.api.assets.import({ expectedSessionId, srcPath }),
        { expectedSessionId: firstOpen.session.sessionId, srcPath: audioPath },
      );
      expect(imported.success && imported.changed).toBe(true);
      if (!imported.success) throw new TypeError("media import failed");
      const saved = await harness.page.evaluate(
        ({ session, rendererGeneration }) => window.api.project.save({
          expectedSessionId: session.sessionId,
          rendererGeneration,
          snapshot: session.data,
        }),
        { session: firstOpen.session, rendererGeneration: firstOpen.session.committedRendererGeneration + 1 },
      );
      expect(saved.success).toBe(true);
      const afterMedia = await inspectAmgArchive(target, "archive-after-media.json");
      expect(afterMedia.paths).toContain("assets/tone.wav");
      expect(afterMedia.projectText).not.toContain(firstOpen.session.sessionId);

      const secondOpen = await harness.page.evaluate((id) => window.api.project.openRecent(id), recentId);
      expect(secondOpen.success).toBe(true);
      if (!secondOpen.success) throw new TypeError("second recent open failed");
      expect(secondOpen.session.sessionId).not.toBe(firstOpen.session.sessionId);
      const currentUrl = imported.value.path.replace(firstOpen.session.sessionId, secondOpen.session.sessionId);
      const media = await harness.page.evaluate(async ({ currentUrl, staleUrl }) => {
        const waitFor = (element: HTMLMediaElement, event: "loadedmetadata" | "seeked" | "error") => (
          new Promise<void>((resolve) => element.addEventListener(event, () => resolve(), { once: true }))
        );
        const current = new Audio();
        current.muted = true;
        current.src = currentUrl;
        const loaded = waitFor(current, "loadedmetadata");
        current.load();
        await loaded;
        await current.play();
        current.currentTime = 0.5;
        await waitFor(current, "seeked");
        current.pause();
        const stale = new Audio();
        const rejected = waitFor(stale, "error");
        stale.src = staleUrl;
        stale.load();
        await rejected;
        return { duration: current.duration, currentTime: current.currentTime, staleCode: stale.error?.code ?? 0 };
      }, { currentUrl, staleUrl: imported.value.path });
      expect(media.duration).toBeCloseTo(1, 1);
      expect(media.currentTime).toBeCloseTo(0.5, 1);
      expect(media.staleCode).not.toBe(0);

      // Then: Cancel preserves the session and Discard returns to the welcome surface.
      const canceled = await harness.page.evaluate((session) => window.api.project.close({
        expectedSessionId: session.sessionId,
        rendererGeneration: session.committedRendererGeneration,
        snapshot: session.data,
        dirtyChoice: "cancel",
      }), secondOpen.session);
      expect(canceled.success).toBe(false);
      const closed = await harness.page.evaluate((session) => window.api.project.close({
        expectedSessionId: session.sessionId,
        rendererGeneration: session.committedRendererGeneration,
        snapshot: session.data,
        dirtyChoice: "discard",
      }), secondOpen.session);
      expect(closed.success).toBe(true);
      expect(harness.pageErrors).toEqual([]);
    } finally {
      await stopAmagon(harness);
      await rm(root, { recursive: true, force: true });
    }
  });

  test("preserves legacy sources and rolls back malicious archive opens", async () => {
    // Given: one legacy project with an external reference and valid/invalid synthetic AMG fixtures.
    const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-legacy-"));
    const externalPath = path.join(root, "external.png");
    const legacyPath = path.join(root, "legacy.json");
    const convertedPath = path.join(root, "converted.amg");
    const forcedZip64Path = path.join(root, "forced-zip64.amg");
    const corruptPath = path.join(root, "traversal.amg");
    await writeFile(externalPath, new Uint8Array([137, 80, 78, 71]));
    await writeFile(legacyPath, JSON.stringify(projectWithReference(externalPath), null, 2));
    const forcedZip64 = await buildAmgFixture({ zip64: true });
    await writeFile(forcedZip64Path, forcedZip64.archive);
    await writeFile(corruptPath, replaceAsciiSameLength(forcedZip64.archive, "assets/photo.txt", "assets/../bad.tx"));
    const harness = await launchAmagon(root);
    try {
      await queueNativeDialogs(harness.app, { opens: [[legacyPath]] });

      // When: legacy JSON is opened and saved in place.
      const opened = await harness.page.evaluate(() => window.api.project.load());
      expect(opened.success).toBe(true);
      if (!opened.success) throw new TypeError("legacy open failed");
      expect(opened.session.kind).toBe("legacy-json");
      const legacySnapshot = { ...opened.session.data, customCss: ".legacy-roundtrip { color: blue; }" };
      const ordinarySave = await harness.page.evaluate(
        ({ session, snapshot }) => window.api.project.save({
          expectedSessionId: session.sessionId,
          rendererGeneration: session.committedRendererGeneration + 1,
          snapshot,
        }),
        { session: opened.session, snapshot: legacySnapshot },
      );
      expect(ordinarySave.success).toBe(true);
      const legacyAfterOrdinarySave = await readFile(legacyPath);

      // Then: conversion rejects the external path, succeeds after explicit import, and leaves the source unchanged.
      await queueNativeDialogs(harness.app, { saves: [convertedPath] });
      const rejected = await harness.page.evaluate(
        ({ session, snapshot }) => window.api.project.saveAs({
          expectedSessionId: session.sessionId,
          rendererGeneration: session.committedRendererGeneration + 2,
          snapshot: { ...snapshot, projectSchemaVersion: 1 },
        }),
        { session: opened.session, snapshot: legacySnapshot },
      );
      expect(rejected.success).toBe(false);
      if (!rejected.success && !rejected.canceled) expect(rejected.error.code).toBe("PROJECT_NOT_PORTABLE");
      const imported = await harness.page.evaluate(
        ({ expectedSessionId, srcPath }) => window.api.assets.import({ expectedSessionId, srcPath }),
        { expectedSessionId: opened.session.sessionId, srcPath: externalPath },
      );
      expect(imported.success).toBe(true);
      if (!imported.success) throw new TypeError("legacy asset import failed");
      await queueNativeDialogs(harness.app, { saves: [convertedPath] });
      const portable = projectWithReference(imported.value.relativePath);
      const converted = await harness.page.evaluate(
        ({ session, snapshot }) => window.api.project.saveAs({
          expectedSessionId: session.sessionId,
          rendererGeneration: session.committedRendererGeneration + 3,
          snapshot,
        }),
        { session: opened.session, snapshot: portable },
      );
      expect(converted.success).toBe(true);
      if (!converted.success) throw new TypeError("legacy conversion failed");
      expect(await readFile(legacyPath)).toEqual(legacyAfterOrdinarySave);
      await inspectAmgArchive(convertedPath, "archive-legacy-conversion.json");

      await queueNativeDialogs(harness.app, { opens: [[forcedZip64Path]] });
      const forcedOpen = await harness.page.evaluate(() => window.api.project.load());
      expect(forcedOpen.success).toBe(true);
      if (!forcedOpen.success) throw new TypeError("forced-ZIP64 open failed");
      await openProjectThroughUi({ harness, filePath: forcedZip64Path });

      // When: an archive with a traversal entry is selected over the active forced-ZIP64 session.
      await queueNativeDialogs(harness.app, { opens: [[corruptPath]] });
      await harness.page.getByTitle("Open Project (Ctrl+O)").click();
      await expect(harness.page.getByText("Project is corrupted", { exact: true })).toBeVisible();
      await expect(harness.page.locator("#html-editor-layout")).toBeVisible();

      // Then: a second process exits while the first instance remains authoritative.
      const executablePath = await harness.app.evaluate(() => process.execPath);
      const secondExit = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(executablePath, [path.resolve("out/main/index.js"), `--user-data-dir=${harness.profilePath}`], { stdio: "ignore" });
        const timeout = setTimeout(() => {
          child.kill();
          reject(new Error("second Electron instance did not exit"));
        }, 15_000);
        child.once("error", reject);
        child.once("exit", (code) => {
          clearTimeout(timeout);
          resolve(code);
        });
      });
      expect(secondExit).toBe(0);
      expect(harness.app.windows()).toHaveLength(1);
      await capture(harness, "03-backend-rollback-session.png", {
        actions: ["open forced ZIP64 in editor", "reject traversal archive from toolbar", "launch second instance"],
        state: "readable archive rejection over the retained active editor",
      });
      expect(harness.pageErrors).toEqual([]);
    } finally {
      await stopAmagon(harness);
      await rm(root, { recursive: true, force: true });
    }
  });
});
