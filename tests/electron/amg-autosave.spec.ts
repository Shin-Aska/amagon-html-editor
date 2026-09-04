import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { inspectAmgArchive, readArchivePaths } from "./archiveAssertions";
import { capture, launchAmagon, stopAmagon } from "./electronHarness";
import { createProjectThroughUi, importFontThroughUi, importMediaThroughUi } from "./projectUi";

test("asset-only and font-only mutations autosave without an explicit Save command", async () => {
  // Given: a real editor session with fast production autosave ticks and local import files.
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-autosave-"));
  const target = path.join(root, "autosave.amg");
  const imagePath = path.join(root, "pixel.png");
  const fontPath = path.join(root, "fixture.woff2");
  await writeFile(imagePath, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
  await writeFile(fontPath, new Uint8Array([119, 79, 70, 50, 0, 0, 0, 0]));
  const harness = await launchAmagon(root);
  try {
    await createProjectThroughUi({ harness, filePath: target, name: "Autosave Matrix" });

    // When: media is imported through the visible Asset Manager.
    await importMediaThroughUi({ harness, filePaths: [imagePath], kind: "image" });
    const afterImageList = await harness.page.evaluate(() => window.api.assets.list());
    expect(afterImageList.success).toBe(true);
    const imageRelativePath = afterImageList.assets?.find((asset) => asset.name === "pixel.png")?.relativePath;
    if (imageRelativePath === undefined) throw new TypeError("imported image is missing from workspace inventory");
    await harness.app.evaluate(({ BrowserWindow }) => (
      BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().includes("index.html"))
        ?.webContents.send("auto-save-tick")
    ));

    // Then: the archive gains the asset solely from an autosave tick.
    await expect.poll(async () => (await readArchivePaths(target)).includes(imageRelativePath))
      .toBe(true);
    const afterAsset = await inspectAmgArchive(target, "archive-after-asset-autosave.json");
    expect(afterAsset.paths).toContain(imageRelativePath);

    // When: a font is imported through Theme Editor without invoking Save.
    await importFontThroughUi({ harness, filePath: fontPath });
    const afterFontList = await harness.page.evaluate(() => window.api.fonts.listProject());
    const fontRelativePath = afterFontList.fonts?.find((font) => font.fileName === "fixture.woff2")?.relativePath;
    if (fontRelativePath === undefined) throw new TypeError("imported font is missing from workspace inventory");
    await harness.page.waitForTimeout(500);
    await harness.app.evaluate(({ BrowserWindow }) => (
      BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().includes("index.html"))
        ?.webContents.send("auto-save-tick")
    ));
    await harness.page.waitForTimeout(500);
    const fontAlerts = await harness.page.locator('[role="alert"]').allTextContents();
    if (fontAlerts.length > 0) throw new TypeError(fontAlerts.join(" | "));

    // Then: a later autosave packs the font and its renderer metadata.
    await expect.poll(async () => (await readArchivePaths(target)).includes(fontRelativePath))
      .toBe(true);
    const afterFont = await inspectAmgArchive(target, "archive-after-font-autosave.json");
    expect(afterFont.paths).toContain(fontRelativePath);
    expect(afterFont.projectText).toContain("fixture.woff2");
    await capture(harness, "04-autosave-settled-editor.png", {
      actions: ["Asset Manager import", "autosave tick", "Theme Editor font import", "autosave tick"],
      state: "settled editor after asset-only and font-only autosaves",
    });
    expect(harness.pageErrors).toEqual([]);
  } finally {
    await harness.page.evaluate(() => window.api.autosave.stop()).catch((error: unknown) => {
      if (error instanceof Error && error.message.includes("closed")) return;
      throw error;
    });
    await stopAmagon(harness);
    await rm(root, { recursive: true, force: true });
  }
});
