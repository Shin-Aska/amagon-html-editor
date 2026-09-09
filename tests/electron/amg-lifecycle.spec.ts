import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { readArchivePaths } from "./archiveAssertions";
import { capture, launchAmagon, stopAmagon, type AmagonHarness } from "./electronHarness";
import { answerConfirmations, createProjectThroughUi, importMediaThroughUi } from "./projectUi";

const dirtyProject = async (root: string, label: string): Promise<{ harness: AmagonHarness; target: string; assetName: string }> => {
  const target = path.join(root, `${label}.amg`);
  const assetName = `${label.toLowerCase().replaceAll(" ", "-")}.png`;
  const imagePath = path.join(root, assetName);
  await writeFile(imagePath, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
  const harness = await launchAmagon(root);
  try {
    await createProjectThroughUi({ harness, filePath: target, name: label });
    await importMediaThroughUi({ harness, filePaths: [imagePath], kind: "image" });
    return { harness, target, assetName };
  } catch (error) {
    try {
      await stopAmagon(harness);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
    throw error;
  }
};

const requestWindowClose = async (harness: AmagonHarness): Promise<void> => {
  await harness.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
};

const requestQuit = async (harness: AmagonHarness): Promise<void> => {
  await harness.app.evaluate(({ app }) => app.quit()).catch((error: unknown) => {
    if (error instanceof Error && /closed|destroyed/u.test(error.message)) return;
    throw error;
  });
};

test.describe.serial("native dirty lifecycle", () => {
  test("window-close Cancel retains the dirty editor", async () => {
    // Given: a real dirty Electron window.
    const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-close-cancel-"));
    const { harness } = await dirtyProject(root, "Close Cancel");
    try {
      // When: both Save and Discard confirmations are declined.
      answerConfirmations(harness.page, [false, false]);
      await requestWindowClose(harness);

      // Then: the lifecycle controller cancels the native close.
      await expect(harness.page.locator("#html-editor-layout")).toBeVisible();
      expect(harness.app.windows()).toHaveLength(1);
    } finally {
      await stopAmagon(harness);
      await rm(root, { recursive: true, force: true });
    }
  });

  test("window-close Save persists the asset and closes", async () => {
    // Given: a real dirty Electron window.
    const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-close-save-"));
    const { harness, target, assetName } = await dirtyProject(root, "Close Save");
    try {
      // When: the Save confirmation is accepted.
      answerConfirmations(harness.page, [true]);
      await requestWindowClose(harness);

      // Then: the archive is committed before the BrowserWindow closes.
      await expect.poll(() => harness.app.windows().length).toBe(0);
      expect(await readArchivePaths(target)).toContain(`assets/${assetName}`);
    } finally {
      await stopAmagon(harness);
      await rm(root, { recursive: true, force: true });
    }
  });

  test("window-close Discard closes without persisting the dirty asset", async () => {
    // Given: a dirty editor and an archive that predates the asset mutation.
    const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-close-discard-"));
    const { harness, target, assetName } = await dirtyProject(root, "Close Discard");
    try {
      // When: Save is declined and Discard is accepted on BrowserWindow.close().
      answerConfirmations(harness.page, [false, true]);
      await requestWindowClose(harness);

      // Then: the window closes and the unsaved asset was not packed.
      await expect.poll(() => harness.app.windows().length).toBe(0);
      expect(await readArchivePaths(target)).not.toContain(`assets/${assetName}`);
    } finally {
      await stopAmagon(harness);
      await rm(root, { recursive: true, force: true });
    }
  });

  test("failed window-close Save retains a readable dirty editor", async () => {
    // Given: the active archive target becomes an unwritable directory after a dirty mutation.
    const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-close-fail-"));
    const { harness, target } = await dirtyProject(root, "Close Failure");
    try {
      await rm(target, { force: true });
      await mkdir(target);

      // When: Save is selected from the actual window close prompt.
      answerConfirmations(harness.page, [true]);
      await requestWindowClose(harness);

      // Then: failed persistence vetoes close and leaves the prior editor visible.
      await expect(harness.page.locator("#html-editor-layout")).toBeVisible();
      await expect(harness.page.getByText("Project operation failed", { exact: true })).toBeVisible();
      expect(harness.app.windows()).toHaveLength(1);
      await capture(harness, "05-failed-save-retains-editor.png", {
        actions: ["import asset", "close window", "choose Save", "atomic target failure"],
        state: "save error is readable and the dirty editor remains open",
      });
    } finally {
      await stopAmagon(harness);
      await rm(root, { recursive: true, force: true });
    }
  });

  test("app-quit Cancel retains the dirty editor", async () => {
    // Given: a dirty editor and the operating-system quit path.
    const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-quit-cancel-"));
    const { harness } = await dirtyProject(root, "Quit Cancel");
    try {
      // When: the user declines both Save and Discard.
      answerConfirmations(harness.page, [false, false]);
      await requestQuit(harness);

      // Then: before-quit is vetoed and the editor remains responsive.
      await expect(harness.page.locator("#html-editor-layout")).toBeVisible();
      expect(harness.app.windows()).toHaveLength(1);
    } finally {
      await stopAmagon(harness);
      await rm(root, { recursive: true, force: true });
    }
  });

  test("app-quit Save persists the asset and exits", async () => {
    // Given: a real dirty Electron window and the operating-system quit path.
    const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-quit-save-"));
    const { harness, target, assetName } = await dirtyProject(root, "Quit Save");
    try {
      // When: Save is accepted on app.quit().
      answerConfirmations(harness.page, [true]);
      await requestQuit(harness);

      // Then: the archive is committed before Electron exits.
      await expect.poll(() => harness.app.windows().length).toBe(0);
      expect(await readArchivePaths(target)).toContain(`assets/${assetName}`);
    } finally {
      await stopAmagon(harness);
      await rm(root, { recursive: true, force: true });
    }
  });

  test("app-quit Discard closes without persisting the dirty asset", async () => {
    // Given: a dirty editor and an archive that predates the asset mutation.
    const root = await mkdtemp(path.join(os.tmpdir(), "amagon-e2e-quit-discard-"));
    const { harness, target, assetName } = await dirtyProject(root, "Quit Discard");
    try {
      // When: Save is declined and Discard is accepted on app.quit().
      answerConfirmations(harness.page, [false, true]);
      await requestQuit(harness);

      // Then: Electron exits and the unsaved asset was not packed.
      await expect.poll(() => harness.app.windows().length).toBe(0);
      expect(await readArchivePaths(target)).not.toContain(`assets/${assetName}`);
    } finally {
      await stopAmagon(harness);
      await rm(root, { recursive: true, force: true });
    }
  });
});
