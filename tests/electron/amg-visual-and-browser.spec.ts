import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { TEST_PROJECT } from "../../src/main/projects/amgArchiveFixtures";
import { inspectAmgArchive } from "./archiveAssertions";
import { capture, launchAmagon, queueNativeDialogs, stopAmagon } from "./electronHarness";
import { materializeCurrentSession, openProjectThroughUi, saveProjectAsThroughBridge, settleEditor } from "./projectUi";

test("visible legacy open converts to AMG and mixed recents survive relaunch", async () => {
  // Given: a portable legacy JSON document and an isolated persistent profile.
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-conversion-"));
  const legacyPath = path.join(root, "legacy-visible.json");
  const convertedPath = path.join(root, "legacy-visible.amg");
  await writeFile(legacyPath, JSON.stringify({
    ...TEST_PROJECT,
    pages: [{
      id: "home",
      title: "Home",
      slug: "index",
      blocks: [{
        id: "legacy-heading",
        type: "heading",
        props: { text: "Converted legacy content", level: 1 },
        styles: {},
        classes: [],
        children: [],
      }],
      meta: {},
    }],
  }, null, 2));
  const first = await launchAmagon(root);
  try {
    // When: the user visibly opens JSON and invokes Save As to an AMG destination.
    await openProjectThroughUi({ harness: first, filePath: legacyPath });
    const legacySession = await materializeCurrentSession(first);
    await queueNativeDialogs(first.app, { saves: [convertedPath] });
    const converted = await saveProjectAsThroughBridge(
      first.page,
      {
        session: legacySession,
        rendererGeneration: legacySession.committedRendererGeneration + 1,
        snapshot: legacySession.data,
      },
    );
    expect(converted.success).toBe(true);
    await expect.poll(async () => readFile(convertedPath).then((bytes) => bytes.byteLength).catch(() => 0))
      .toBeGreaterThan(0);
    await settleEditor(first);

    // Then: the visible editor is backed by a valid converted archive.
    await inspectAmgArchive(convertedPath, "archive-visible-conversion.json");
    await first.page.reload();
    const convertedRecent = first.page.getByText("legacy-visible.amg", { exact: false });
    await expect(convertedRecent).toBeVisible();
    await convertedRecent.click();
    await settleEditor(first);
    await capture(first, "07-visible-legacy-converted-editor.png", {
      actions: ["Open Project", "select legacy-visible.json", "Save As legacy-visible.amg", "open converted recent"],
      state: "settled editor visibly converted from legacy JSON to AMG",
    });
    const recents = await first.page.evaluate(() => window.api.project.getRecent());
    expect(recents.success).toBe(true);
    if (!recents.success) throw new TypeError("mixed recents lookup failed");
    expect(recents.projects.map((recent) => recent.kind).sort()).toEqual(["amg", "legacy-json"]);
  } finally {
    await stopAmagon(first, false);
  }

  // When: Electron is relaunched with the same real user-data profile.
  const second = await launchAmagon(root);
  try {
    // Then: Welcome visibly renders both legacy and AMG recent entries.
    await expect(second.page.getByText("Loading...", { exact: true })).toHaveCount(0);
    await expect(second.page.getByText("legacy-visible.json", { exact: false })).toBeVisible();
    await expect(second.page.getByText("legacy-visible.amg", { exact: false })).toBeVisible();
    await capture(second, "08-mixed-recents-relaunch.png", {
      actions: ["exit", "relaunch same isolated profile"],
      state: "welcome screen shows persisted legacy JSON and AMG recents",
    });
  } finally {
    await stopAmagon(second);
    await rm(root, { recursive: true, force: true });
  }
});

test("web renderer uses legacy JSON fallback and packaging declares no OS association", async () => {
  // Given: the production web renderer loaded in a Chromium BrowserWindow without preload or Electron user agent.
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-browser-"));
  const harness = await launchAmagon(root);
  try {
    const browserWindow = harness.app.waitForEvent("window");
    await harness.app.evaluate(async ({ BrowserWindow }, rendererPath) => {
      const window = new BrowserWindow({
        width: 1100,
        height: 760,
        show: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false },
      });
      window.webContents.setUserAgent("Mozilla/5.0 Chrome/140 Safari/537.36");
      await window.loadFile(rendererPath);
    }, path.resolve("out/renderer/index.html"));
    const browserPage = await browserWindow;
    await browserPage.waitForLoadState("domcontentloaded");

    // When: a project is created through that real browser-mode surface.
    expect(await browserPage.evaluate(() => ({ api: window.api, userAgent: navigator.userAgent })))
      .toEqual({ api: undefined, userAgent: "Mozilla/5.0 Chrome/140 Safari/537.36" });
    await browserPage.getByRole("button", { name: /New Project/u }).click();
    await browserPage.getByLabel("Project Name").fill("Browser Legacy");
    await browserPage.getByRole("button", { name: "Create Project" }).click();

    // Then: the legacy JSON bridge opens an editor, while the desktop package registers no file association.
    await expect(browserPage.locator("#html-editor-layout")).toBeVisible();
    await settleEditor({ ...harness, page: browserPage });
    const packageJson: unknown = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
    if (typeof packageJson !== "object" || packageJson === null || !("build" in packageJson)) {
      throw new TypeError("package build configuration missing");
    }
    const build = packageJson.build;
    if (typeof build !== "object" || build === null) throw new TypeError("package build configuration invalid");
    expect("fileAssociations" in build).toBe(false);
    expect("protocols" in build).toBe(false);
    await capture({ ...harness, page: browserPage }, "09-browser-legacy-fallback.png", {
      actions: ["load web build without preload", "New Project", "create Browser Legacy"],
      state: "browser-mode editor created through legacy JSON fallback",
    });
  } finally {
    await stopAmagon(harness);
    await rm(root, { recursive: true, force: true });
  }
});
