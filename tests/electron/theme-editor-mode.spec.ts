import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { capture, launchAmagon, stopAmagon } from "./electronHarness";
import { createProjectThroughUi } from "./projectUi";

test("preset selectors and application targets stay aligned across consecutive selections", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-theme-mode-"));
  const harness = await launchAmagon(root);
  try {
    await createProjectThroughUi({ harness, filePath: path.join(root, "mode.amg"), name: "Theme Mode Check" });
    await harness.page.getByTitle("Theme Editor", { exact: true }).click();
    await harness.page.getByRole("button", { name: "Presets", exact: true }).click();
    const dark = harness.page.getByRole("button", { name: "Dark Page", exact: true });
    const light = harness.page.getByRole("button", { name: "Light Page", exact: true });
    await dark.click();
    const cards = harness.page.locator(".theme-preset-card-built-in");
    await cards.nth(0).click();
    await capture(harness, "theme-mode-dark-first.png", { actions: ["Select Dark Page", "Apply first preset"], state: "Editing selector after applying first dark preset" });
    await expect(dark).toHaveClass(/theme-btn-primary/);
    await expect(light).not.toHaveClass(/theme-btn-primary/);
    await expect(harness.page.locator(".theme-section-header")).toContainText("Theme Presets for Dark Page");
    await cards.nth(1).click();
    await expect(dark).toHaveClass(/theme-btn-primary/);
    await capture(harness, "theme-mode-dark-second.png", { actions: ["Apply second dark preset without reselecting Dark Page"], state: "Dark Page remains selected after consecutive presets" });
    await harness.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1000, 800));
    await capture(harness, "theme-mode-dark-compact.png", { actions: ["Resize compact desktop"], state: "Persistent dark selector in compact layout" });
    await light.click();
    await expect(harness.page.locator(".theme-section-header")).toContainText("Theme Presets for Light Page");
    await cards.nth(0).click();
    await expect(harness.page.locator(".toast-message")).toHaveText(/to light page$/);
    await cards.nth(1).click();
    await expect(harness.page.locator(".toast-message")).toHaveText(/to light page$/);
    await expect(light).toHaveClass(/theme-btn-primary/);
    await expect(dark).not.toHaveClass(/theme-btn-primary/);
    await expect(harness.page.locator(".theme-section-header")).toContainText("Theme Presets for Light Page");
    await capture(harness, "theme-mode-light.png", { actions: ["Select Light Page", "Apply two light presets"], state: "Explicit Light Page selection persists" });
    await dark.click();
    await harness.page.getByRole("button", { name: "Colors", exact: true }).click();
    await expect(dark).toHaveClass(/theme-btn-primary/);
    await harness.page.locator(".theme-editor-close").click();
    await expect(harness.page.locator(".theme-editor-dialog")).toHaveCount(0);
    await harness.page.getByTitle("Theme Editor", { exact: true }).click();
    await expect(light).toHaveClass(/theme-btn-primary/);
    await capture(harness, "theme-mode-reopened.png", { actions: ["Switch to Colors while Dark is selected", "Close with the close button", "Reopen editor"], state: "New editor session retains existing default Light Page behavior" });
  } finally {
    await stopAmagon(harness);
    await rm(root, { recursive: true, force: true });
  }
});
