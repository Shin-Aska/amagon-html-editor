import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type * as Monaco from "monaco-editor";
import {
  launchPortableEditor,
  stopPortableEditor,
} from "./portableEditorHarness";
import { createProjectThroughUi } from "./projectUi";

async function selectedMarkup(page: Page) {
  return page.evaluate(() => {
    const m = Reflect.get(window, "monaco") as typeof Monaco;
    const e = m.editor
      .getEditors()
      .find((editor) => editor.getDomNode()?.closest(".code-editor"));
    const model = e?.getModel(),
      decoration = model
        ?.getAllDecorations()
        .find((d) => d.options.className === "amagon-code-selection");
    if (!e || !model || !decoration) return null;
    return {
      html: model.getValueInRange(decoration.range),
      visible: e
        .getVisibleRanges()
        .some(
          (r) =>
            r.startLineNumber <= decoration.range.startLineNumber &&
            r.endLineNumber >= decoration.range.startLineNumber,
        ),
      focused: e.hasTextFocus(),
    };
  });
}

test("canvas clicks reveal and highlight complete widget HTML, including repeated clicks and CSS tabs", async ({}, testInfo) => {
  test.setTimeout(180000);
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-widget-code-"));
  const harness = await launchPortableEditor(root),
    { page } = harness;
  try {
    await createProjectThroughUi({
      harness,
      filePath: path.join(root, "navigation.amg"),
      name: "Linked HTML",
    });
    await page.evaluate(() =>
      Reflect.set(globalThis, "MonacoEnvironment", { globalAPI: true }),
    );
    await page
      .getByRole("button", { name: "Change editor layout", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Canvas + Code", exact: true })
      .click();
    await expect(page.locator(".code-editor .monaco-editor")).toBeVisible({
      timeout: 60000,
    });
    const canvas = page.frameLocator(".canvas-iframe"),
      heading = canvas.getByRole("heading", {
        name: "Welcome to Linked HTML",
        exact: true,
      });
    await heading.click();
    await expect
      .poll(() => selectedMarkup(page))
      .toMatchObject({ visible: true, focused: false });
    const first = await selectedMarkup(page);
    expect(first?.html).toContain("Welcome to Linked HTML");
    expect(first?.html).toMatch(/^<h1\b/);
    expect(first?.html).toMatch(/<\/h1>$/);
    await page.evaluate(() => {
      const m = Reflect.get(window, "monaco") as typeof Monaco;
      m.editor
        .getEditors()
        .find((e) => e.getDomNode()?.closest(".code-editor"))
        ?.setScrollTop(0);
    });
    await heading.click();
    await expect
      .poll(() => selectedMarkup(page))
      .toMatchObject({ visible: true, html: first?.html });
    await page.getByRole("tab", { name: "styles.css", exact: true }).click();
    await heading.click();
    await expect(
      page.getByRole("tab", { name: "index.html", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect
      .poll(() => selectedMarkup(page))
      .toMatchObject({ visible: true, html: first?.html });
    const section = canvas.locator("section[data-block-id]").first(),
      id = await section.getAttribute("data-block-id");
    await section.click({ position: { x: 25, y: 25 } });
    await expect
      .poll(async () => {
        const result = await selectedMarkup(page);
        return (
          result?.visible &&
          result.html.startsWith("<section") &&
          result.html.includes(`data-block-id="${id}"`) &&
          result.html.includes("Welcome to Linked HTML") &&
          result.html.endsWith("</section>")
        );
      })
      .toBe(true);
    await heading.click();
    await page.screenshot({
      path: testInfo.outputPath("canvas-widget-html-highlight.png"),
    });
    expect(harness.pageErrors).toEqual([]);
  } finally {
    await stopPortableEditor(harness);
    await rm(root, { recursive: true, force: true });
  }
});
