import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type * as Monaco from "monaco-editor";
import {
  launchPortableEditor,
  stopPortableEditor,
} from "./portableEditorHarness";
import {
  createProjectThroughUi,
  closeProjectThroughUi,
  settleEditor,
  openProjectThroughUi,
} from "./projectUi";
import {
  BUILTIN_APP_THEMES,
  serializeAppTheme,
} from "../../src/renderer/themes/appThemes";

const documentHtml = (text: string) =>
  `<!doctype html>\n<html><head><title>Editor check</title><style id="html-editor-custom-css"></style></head><body><h1 data-block-id="code-test-title" data-block-type="heading">${text}</h1></body></html>`;
async function editorValue(page: Page): Promise<string> {
  return page.evaluate(() => {
    const monaco = Reflect.get(window, "monaco") as typeof Monaco;
    return (
      monaco.editor
        .getEditors()
        .find((e) => e.getDomNode()?.closest(".code-editor"))
        ?.getModel()
        ?.getValue() ?? ""
    );
  });
}
async function replaceCode(page: Page, text: string): Promise<void> {
  await page
    .locator(".code-editor .monaco-editor")
    .click({ position: { x: 100, y: 30 } });
  await page.keyboard.press("Control+A");
  // Use Monaco's real paste path: insertText emulates typing and invokes selection-surround shortcuts.
  await page.evaluate((text) => {
    const m = Reflect.get(window, "monaco") as typeof Monaco;
    m.editor
      .getEditors()
      .find((e) => e.getDomNode()?.closest(".code-editor"))
      ?.trigger("test", "paste", { text });
  }, text);
}

test("app themes and code editing stay independent, reliable and bounded", async ({}, testInfo) => {
  test.setTimeout(300_000);
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-appearance-code-"));
  const harness = await launchPortableEditor(root),
    { page } = harness;
  try {
    await createProjectThroughUi({
      harness,
      filePath: path.join(root, "studio.amg"),
      name: "Theme Studio",
    });
    const canvas = page.frameLocator(".canvas-iframe");
    const originalColor = await canvas
      .getByRole("heading", { name: "Welcome to Theme Studio" })
      .evaluate((el) => getComputedStyle(el).color);
    await page
      .getByRole("button", { name: "Open global settings", exact: true })
      .click();
    const settings = page.locator(".settings-dialog");
    await settings.getByRole("button", {name:/Appearance/}).click();
    await settings.getByRole("button", { name: "Ocean", exact: true }).click();
    await settings.getByRole("button", { name: "Light", exact: true }).click();
    await expect
      .poll(() =>
        page
          .locator("body")
          .evaluate((el) => el.style.getPropertyValue("--color-accent")),
      )
      .toBe(BUILTIN_APP_THEMES[2].light.accent);
    expect(
      await canvas
        .getByRole("heading", { name: "Welcome to Theme Studio" })
        .evaluate((el) => getComputedStyle(el).color),
    ).toBe(originalColor);
    await page.screenshot({ path: testInfo.outputPath("app-themes.png") });
    await settings
      .getByRole("button", { name: "Customize Forest", exact: true })
      .click();
    await expect
      .poll(() =>
        page
          .locator("body")
          .evaluate((el) => el.style.getPropertyValue("--color-accent")),
      )
      .toBe(BUILTIN_APP_THEMES[3].light.accent);
    await settings.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect
      .poll(() =>
        page
          .locator("body")
          .evaluate((el) => el.style.getPropertyValue("--color-accent")),
      )
      .toBe(BUILTIN_APP_THEMES[2].light.accent);
    await settings.locator("input[type=file]").setInputFiles({
      name: "studio.amagon-ui-theme.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        serializeAppTheme({ ...BUILTIN_APP_THEMES[4], name: "Studio Rose" }),
      ),
    });
    await settings
      .getByRole("button", { name: "Save theme", exact: true })
      .click();
    await expect(
      settings.getByRole("button", { name: "Studio Rose", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await settings.getByRole("button", { name: "Dark", exact: true }).click();
    await settings.getByRole("button", { name: "Done", exact: true }).click();
    await closeProjectThroughUi(harness);
    await page.reload();
    // Appearance is restored through application settings, independently of project reload behavior.
    await expect
      .poll(() =>
        page
          .locator("body")
          .evaluate((el) => el.style.getPropertyValue("--color-accent")),
      )
      .toBe(BUILTIN_APP_THEMES[4].dark.accent);
    await page.locator(".recent-item").filter({ hasText: "Theme Studio" }).click();
    await settleEditor(harness);
    await page.getByRole("button", { name: "Pages", exact: true }).click();
    await page
      .getByRole("button", { name: "Add New Page", exact: true })
      .click();
    await page.locator(".page-modal input").first().fill("About");
    await page
      .getByRole("button", { name: "Create Page", exact: true })
      .click();
    await page
      .locator(".page-item")
      .filter({ has: page.locator(".page-name", { hasText: /^Home$/ }) })
      .click();
    // Monaco supports this standard debugging flag; it exposes the real editor for assertions only.
    await page.evaluate(() =>
      Reflect.set(globalThis, "MonacoEnvironment", { globalAPI: true }),
    );
    await page
      .getByRole("button", { name: "Toggle code editor panel", exact: true })
      .click();
    await expect(page.locator(".code-editor .monaco-editor")).toBeVisible({
      timeout: 60_000,
    });
    await expect
      .poll(() => editorValue(page))
      .toContain("Welcome to Theme Studio");
    await page.getByRole("button", { name: "Find", exact: true }).click();
    await expect(page.locator(".code-editor .find-widget")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Replace", exact: true }).click();
    await expect(page.locator(".code-editor .find-widget")).toBeVisible();
    await expect(page.locator(".code-editor .find-widget").getByRole("textbox", { name: "Replace", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await replaceCode(page, documentHtml("Home draft"));
    await expect.poll(() => editorValue(page)).toBe(documentHtml("Home draft"));
    // Switch immediately: delayed parsing must flush to Home, never About.
    await page
      .locator(".page-item")
      .filter({ has: page.locator(".page-name", { hasText: /^About$/ }) })
      .click();
    await expect(
      page.getByRole("tab", { name: "about.html", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => editorValue(page)).not.toContain("Home draft");
    await page
      .locator(".page-item")
      .filter({ has: page.locator(".page-name", { hasText: /^Home$/ }) })
      .click();
    await expect.poll(() => editorValue(page)).toContain("Home draft");
    await expect(
      canvas.getByRole("heading", { name: "Home draft" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Format", exact: true }).click();
    await expect.poll(() => editorValue(page)).toContain("\n  <head>");
    await page.evaluate(() => {
      const m = Reflect.get(window, "monaco") as typeof Monaco;
      m.editor
        .getEditors()
        .find((e) => e.getDomNode()?.closest(".code-editor"))
        ?.setPosition({ lineNumber: 5, column: 3 });
    });
    await page.getByRole("tab", { name: "styles.css", exact: true }).click();
    await replaceCode(page, ".hero-title{color:rebeccapurple;margin:0}");
    await page.getByRole("button", { name: "Format", exact: true }).click();
    await expect
      .poll(() => editorValue(page))
      .toContain("color: rebeccapurple;");
    await page.getByRole("tab", { name: "index.html", exact: true }).click();
    expect(
      await page.evaluate(() => {
        const m = Reflect.get(window, "monaco") as typeof Monaco;
        return m.editor
          .getEditors()
          .find((e) => e.getDomNode()?.closest(".code-editor"))
          ?.getPosition();
      }),
    ).toMatchObject({ lineNumber: 5, column: 3 });
    // Undo the external CSS synchronization and then HTML formatting; both histories survive tab changes.
    for (
      let i = 0;
      i < 2 && (await editorValue(page)) !== documentHtml("Home draft");
      i++
    ) {
      await page.evaluate(() => {
        const m = Reflect.get(window, "monaco") as typeof Monaco;
        m.editor
          .getEditors()
          .find((e) => e.getDomNode()?.closest(".code-editor"))
          ?.trigger("test", "undo", null);
      });
    }
    await expect.poll(() => editorValue(page)).toBe(documentHtml("Home draft"));
    // Invalid source remains a draft and leaves the canvas intact, including after closing/reopening.
    await replaceCode(
      page,
      "<!doctype html><html><body><h1/>broken</body></html>",
    );
    await expect(
      page.getByRole("status").filter({ hasText: "Draft has errors" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("heading", { name: "Home draft" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Problems \(/ }).click();
    await expect(
      page.locator(".code-editor-problems button").first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Toggle code editor panel", exact: true })
      .click();
    expect(
      await page.evaluate(() => {
        const m = Reflect.get(window, "monaco") as typeof Monaco;
        return m.editor.getModels().filter((x) => x.uri.authority === "amagon")
          .length;
      }),
    ).toBe(0);
    await page
      .getByRole("button", { name: "Toggle code editor panel", exact: true })
      .click();
    await expect.poll(() => editorValue(page)).toContain("broken");
    await replaceCode(page, documentHtml("Recovered draft"));
    await expect(
      canvas.getByRole("heading", { name: "Recovered draft" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Format", exact: true }).click();
    await expect.poll(() => editorValue(page)).toContain("\n  <head>");
    await page.evaluate(() => {
      const m = Reflect.get(window, "monaco") as typeof Monaco;
      const e = m.editor
          .getEditors()
          .find((e) => e.getDomNode()?.closest(".code-editor")),
        model = e?.getModel();
      if (model)
        e?.setPosition(
          model.getPositionAt(model.getValue().indexOf("Recovered draft") + 3),
        );
    });
    await page
      .getByRole("button", { name: "Reveal on canvas", exact: true })
      .click();
    await expect(page.locator(".inspector")).toContainText("Heading");
    await page
      .getByRole("button", { name: "Editor options", exact: true })
      .click();
    await expect(page.getByLabel("Minimap", { exact: true })).not.toBeChecked();
    await page.getByLabel("Code font size", { exact: true }).selectOption("15");
    await page
      .getByLabel("Code indentation", { exact: true })
      .selectOption("4");
    const divider = await page
      .locator(".panel-resize-handle-horizontal")
      .boundingBox();
    if (!divider) throw new Error("Missing canvas/code divider");
    await page.mouse.move(
      divider.x + divider.width / 2,
      divider.y + divider.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(divider.x + divider.width / 2, divider.y - 120, {
      steps: 6,
    });
    await page.mouse.up();
    await page.screenshot({
      path: testInfo.outputPath("polished-code-editor.png"),
    });
    for (let i = 0; i < 7; i++) {
      await page
        .getByRole("button", { name: "Add New Page", exact: true })
        .click();
      await page.locator(".page-modal input").first().fill(`Cache ${i}`);
      await page
        .getByRole("button", { name: "Create Page", exact: true })
        .click();
      await expect(
        page.getByRole("tab", { name: `cache-${i}.html`, exact: true }),
      ).toHaveAttribute("aria-selected", "true");
    }
    expect(
      await page.evaluate(() => {
        const m = Reflect.get(window, "monaco") as typeof Monaco;
        return m.editor
          .getModels()
          .filter((model) => model.uri.authority === "amagon").length;
      }),
    ).toBeLessThanOrEqual(6);
    // Rapid real page selections exercise worker cancellation and model eviction.
    await page.evaluate(async () => {
      const pages = [...document.querySelectorAll<HTMLElement>(".page-item")];
      for (let pass = 0; pass < 3; pass++) {
        for (const item of pages) {
          item.click();
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      }
    });
    expect(await page.evaluate(() => {
      const m = Reflect.get(window, "monaco") as typeof Monaco;
      return m.editor.getModels().filter(model => model.uri.authority === "amagon").length;
    })).toBeLessThanOrEqual(6);
    await page
      .locator(".page-item")
      .filter({ has: page.locator(".page-name", { hasText: /^Home$/ }) })
      .click();
    await expect.poll(() => editorValue(page)).toContain("Recovered draft");
    // A save immediately after paste must include the pending edit, and reopening must read it from disk.
    await replaceCode(page, documentHtml("Saved code"));
    await page.keyboard.press("Control+s");
    await expect(page.locator(".status-bar").getByText("Saved",{exact:true})).toBeVisible();
    await closeProjectThroughUi(harness);
    await openProjectThroughUi({
      harness,
      filePath: path.join(root, "studio.amg"),
    });
    await expect(
      canvas.getByRole("heading", { name: "Saved code" }),
    ).toBeVisible();
    expect(harness.pageErrors).toEqual([]);
  } finally {
    await stopPortableEditor(harness);
    await rm(root, { recursive: true, force: true });
  }
});
