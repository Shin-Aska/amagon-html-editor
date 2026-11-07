import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  launchPortableEditor,
  stopPortableEditor,
} from "./portableEditorHarness";
import {
  closeProjectThroughUi,
  createProjectThroughUi,
  openProjectThroughUi,
} from "./projectUi";

async function assertSplit(page: Page): Promise<void> {
  await expect(page.locator(".canvas-iframe")).toBeVisible();
  await expect(page.locator(".code-editor .monaco-editor")).toBeVisible({
    timeout: 60000,
  });
  await expect(page.locator("#panel-left, #panel-right")).toHaveCount(0);
  await expect
    .poll(async () => {
      const canvas = await page.locator("#panel-canvas").boundingBox(),
        code = await page.locator("#panel-code").boundingBox();
      return (
        !!canvas &&
        !!code &&
        canvas.x + canvas.width <= code.x + 8 &&
        Math.abs(canvas.y - code.y) < 3 &&
        Math.abs(canvas.height - code.height) < 3 &&
        canvas.width > 200 &&
        code.width > 200
      );
    })
    .toBe(true);
}

test("Canvas + Code opens side by side, resizes, toggles and restores as the default layout", async ({}, testInfo) => {
  test.setTimeout(180000);
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-canvas-code-"));
  const harness = await launchPortableEditor(root),
    { page } = harness;
  try {
    const filePath = path.join(root, "split.amg");
    await createProjectThroughUi({
      harness,
      filePath,
      name: "Canvas and Code",
    });
    await expect(
      page.getByRole("button", { name: "Open app appearance", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Change editor layout", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Canvas + Code", exact: true })
      .click();
    await assertSplit(page);
    const canvas = page.locator("#panel-canvas"),
      before = (await canvas.boundingBox())!.width;
    const divider = page.getByRole("separator", {
      name: "Resize canvas and code",
    });
    await divider.focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => Math.abs((await canvas.boundingBox())!.width - before))
      .toBeGreaterThan(10);
    const afterKeyboard = (await canvas.boundingBox())!.width;
    const grip = await divider.boundingBox();
    if (!grip) throw new Error("Missing divider");
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x - 50, grip.y + grip.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect
      .poll(async () =>
        Math.abs((await canvas.boundingBox())!.width - afterKeyboard),
      )
      .toBeGreaterThan(10);
    await page
      .getByRole("button", { name: "Toggle code editor panel", exact: true })
      .click();
    await expect(page.locator(".code-editor")).toHaveCount(0);
    await expect(page.locator(".canvas-iframe")).toBeVisible();
    await page
      .getByRole("button", { name: "Toggle code editor panel", exact: true })
      .click();
    await assertSplit(page);
    await page
      .getByRole("button", { name: "Open global settings", exact: true })
      .click();
    const settings = page.locator(".settings-dialog");
    await expect(
      settings.getByLabel("Default Layout", { exact: true }),
    ).toHaveValue("canvas-code");
    await settings.getByRole("button", { name: /Appearance/ }).click();
    await settings.getByRole("button", { name: "Ocean", exact: true }).click();
    await settings.getByRole("button", { name: "Done", exact: true }).click();
    await closeProjectThroughUi(harness);
    await openProjectThroughUi({ harness, filePath });
    await assertSplit(page);
    await page.screenshot({
      path: testInfo.outputPath("canvas-code-ocean.png"),
    });
    expect(harness.pageErrors).toEqual([]);
  } finally {
    await stopPortableEditor(harness);
    await rm(root, { recursive: true, force: true });
  }
});
