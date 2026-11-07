import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { inspectAmgArchive, readArchivePaths } from "./archiveAssertions";
import { capture, sendAutosaveTick, type AmagonHarness } from "./electronHarness";
import {launchPortableEditor, stopPortableEditor} from "./portableEditorHarness";
import { createProjectThroughUi, importFontThroughUi, importMediaThroughUi } from "./projectUi";

const archivePollTimeoutMs = 15_000;

const waitForArchivePath = async (archivePath: string, expectedPath: string): Promise<void> => {
  await expect.poll(async () => {
    try {
      return (await readArchivePaths(archivePath)).includes(expectedPath);
    } catch (error) {
      if (error instanceof Error) return false;
      throw error;
    }
  }, { timeout: archivePollTimeoutMs }).toBe(true);
};

test("asset-only and font-only mutations autosave without an explicit Save command", async ({}, testInfo) => {
  // Given: a real editor session with fast production autosave ticks and local import files.
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-autosave-"));
  const target = path.join(root, "autosave.amg");
  const imagePath = path.join(root, "pixel.png");
  const fontPath = path.join(root, "fixture.woff2");
  await writeFile(imagePath, await readFile(path.resolve("docs/images/logo.png")));
  await writeFile(fontPath, await readFile(path.resolve("public/frameworks/google-fonts/Inter/inter-v20-1.woff2")));
  let harness: AmagonHarness | null = null;
  let primaryError: unknown;
  try {
    harness = await launchPortableEditor(root);
    await createProjectThroughUi({ harness, filePath: target, name: "Autosave Matrix" });

    // When: media is imported through the visible Asset Manager.
    await importMediaThroughUi({ harness, filePaths: [imagePath], kind: "image" });
    const afterImageList = await harness.page.evaluate(() => window.api.assets.list());
    expect(afterImageList.success).toBe(true);
    const imageRelativePath = afterImageList.assets?.find((asset) => asset.name === "pixel.png")?.relativePath;
    if (imageRelativePath === undefined) throw new TypeError("imported image is missing from workspace inventory");
    await sendAutosaveTick(harness);

    // Then: the archive gains the asset solely from an autosave tick.
    await waitForArchivePath(target, imageRelativePath);
    const afterAsset = await inspectAmgArchive(target, "archive-after-asset-autosave.json");
    expect(afterAsset.paths).toContain(imageRelativePath);

    // When: a font is imported through Theme Editor without invoking Save.
    await importFontThroughUi({ harness, filePath: fontPath });
    const afterFontList = await harness.page.evaluate(() => window.api.fonts.listProject());
    const fontRelativePath = afterFontList.fonts?.find((font) => font.fileName === "fixture.woff2")?.relativePath;
    if (fontRelativePath === undefined) throw new TypeError("imported font is missing from workspace inventory");
    await sendAutosaveTick(harness);
    const fontAlerts = await harness.page.locator('[role="alert"]').allTextContents();
    if (fontAlerts.length > 0) throw new TypeError(fontAlerts.join(" | "));

    // Then: a later autosave packs the font and its renderer metadata.
    await waitForArchivePath(target, fontRelativePath);
    const afterFont = await inspectAmgArchive(target, "archive-after-font-autosave.json");
    expect(afterFont.paths).toContain(fontRelativePath);
    expect(afterFont.projectText).toContain("fixture.woff2");
    await capture(harness, "04-autosave-settled-editor.png", {
      actions: ["Asset Manager import", "autosave tick", "Theme Editor font import", "autosave tick"],
      state: "settled editor after asset-only and font-only autosaves",
    });
    expect(harness.pageErrors).toEqual([]);
  } catch (error) {
    primaryError = error;
    if (harness) {
      try {
        const state = await harness.page.evaluate(async () => ({
          status: document.querySelector('.status-icon')?.textContent,
          toast: document.querySelector('.toast')?.textContent,
          fonts: await window.api.fonts.listProject(),
          saveDisabled: document.querySelector<HTMLButtonElement>('button[aria-label="Save project"]')?.disabled,
        }));
        const archive = await readArchivePaths(target).catch(cause => [String(cause)]);
        await testInfo.attach('autosave-failure-state', {body: JSON.stringify({state, archive, pageErrors: harness.pageErrors}, null, 2), contentType: 'application/json'});
        await harness.page.screenshot({path: testInfo.outputPath('autosave-failure.png')});
      } catch (diagnosticError) {
        await testInfo.attach('autosave-diagnostic-error', {body: String(diagnosticError), contentType: 'text/plain'});
      }
    }
    throw error;
  } finally {
    const cleanupErrors: unknown[] = [];
    try {
      if (harness !== null) {
        try {
          await harness.page.evaluate(() => window.api.autosave.stop());
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("closed")) cleanupErrors.push(error);
        }
        try {
          await stopPortableEditor(harness);
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
    } finally {
      try {
        await rm(root, {
          force: true,
          maxRetries: 5,
          recursive: true,
          retryDelay: 100,
        });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (primaryError === undefined && cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, "autosave test cleanup failed");
    }
  }
});
