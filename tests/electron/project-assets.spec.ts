import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { MENU_ACTION_CHANNEL } from "../../src/shared/menuContract";
import { TEST_PROJECT } from "../../src/main/projects/amgArchiveFixtures";
import { queueNativeDialogs, type AmagonHarness } from "./electronHarness";
import { launchPortableEditor, stopPortableEditor } from "./portableEditorHarness";
import { closeProjectThroughUi, createProjectThroughUi, importMediaThroughUi, openProjectThroughUi } from "./projectUi";

const filenames = [
  ["plain.png", "plain.png"],
  ["with space.png", "with%20space.png"],
  ["100%.png", "100%25.png"],
  ["literal name.png", "literal%20name.png"],
  ["literal%20name.png", "literal%2520name.png"],
  ["literal%2Fname.png", "literal%252Fname.png"],
  ["café.png", "caf%C3%A9.png"],
  ["hash#name.png", "hash%23name.png"],
] as const;

async function expectLoadedImage(page: Page, name: string): Promise<void> {
  const image = page.getByRole("img", { name, exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
}

async function saveAsThroughMenu(harness: AmagonHarness, target: string): Promise<void> {
  await queueNativeDialogs(harness.app, { saves: [target] });
  await harness.app.evaluate(({ BrowserWindow }, channel) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window === undefined) throw new Error("Editor window is missing");
    window.webContents.send(channel, "save-as");
  }, MENU_ACTION_CHANNEL);
}

test("literal media filenames display and survive a portable project round trip", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-asset-filenames-"));
  const harness = await launchPortableEditor(root);
  const { page } = harness;
  try {
    const bytes = await readFile(path.resolve("docs/images/logo.png"));
    const inputs = await Promise.all(filenames.map(async ([name]) => {
      const file = path.join(root, name);
      await writeFile(file, bytes);
      return file;
    }));
    const target = path.join(root, "filenames.amg");
    await createProjectThroughUi({ harness, filePath: target, name: "Asset filenames" });
    await importMediaThroughUi({ harness, filePaths: inputs, kind: "image" });
    await expect(page.locator(".toast-error")).toHaveCount(0);
    await page.getByTitle("Asset Manager", { exact: true }).click();
    for (const [name, encodedName] of filenames) {
      await expectLoadedImage(page, name);
      expect((await page.getByRole("img", { name, exact: true }).getAttribute("src"))?.endsWith(`/assets/${encodedName}`)).toBe(true);
    }
    await page.locator(".am-close-btn").click();
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.locator(".status-icon").filter({ hasText: /^Saved$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save project", exact: true })).toBeEnabled();
    await closeProjectThroughUi(harness);
    await openProjectThroughUi({ harness, filePath: target });
    await page.getByTitle("Asset Manager", { exact: true }).click();
    for (const [name] of filenames) await expectLoadedImage(page, name);
    const listed = await page.evaluate(() => window.api.assets.list());
    expect(listed.success).toBe(true);
    expect(listed.assets.map((asset: { relativePath: string }) => asset.relativePath).sort())
      .toEqual(filenames.map(([name]) => `assets/${name}`).sort());
    // A literal percent sequence must never delete its space-named neighbour.
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator(".am-asset-item").filter({
      has: page.getByRole("img", { name: "literal%20name.png", exact: true }),
    }).getByTitle("Delete asset", { exact: true }).click();
    await expect(page.getByRole("img", { name: "literal%20name.png", exact: true })).toHaveCount(0);
    await expectLoadedImage(page, "literal name.png");
    await page.locator(".am-close-btn").click();
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.locator(".status-icon").filter({ hasText: /^Saved$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save project", exact: true })).toBeEnabled();
    await closeProjectThroughUi(harness);
    await openProjectThroughUi({ harness, filePath: target });
    await page.getByTitle("Asset Manager", { exact: true }).click();
    await expect(page.getByRole("img", { name: "literal%20name.png", exact: true })).toHaveCount(0);
    await expectLoadedImage(page, "literal name.png");
    expect(harness.pageErrors).toEqual([]);
  } finally {
    await stopPortableEditor(harness);
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy missing assets stay repairable while portable conversion requires their bytes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-legacy-repair-"));
  const harness = await launchPortableEditor(root);
  const { page } = harness;
  try {
    const bytes = await readFile(path.resolve("docs/images/logo.png"));
    const legacyPath = path.join(root, "project.json");
    const target = path.join(root, "repaired.amg");
    await mkdir(path.join(root, "assets"));
    await writeFile(path.join(root, "assets", "Existing Image.png"), bytes);
    const { projectSchemaVersion: ignoredVersion, ...legacy } = structuredClone(TEST_PROJECT);
    void ignoredVersion;
    const project = {
      ...legacy,
      pages: [{ id: "home", title: "Home", slug: "index", meta: {}, blocks: [
        { id: "existing", type: "image", props: { src: "app-media://project-asset/assets/Existing Image.png", alt: "Existing image" }, styles: {}, classes: [], children: [] },
        { id: "missing", type: "image", props: { src: "app-media://project-asset/assets/Missing Image.png", alt: "Missing image" }, styles: {}, classes: [], children: [] },
      ] }],
    };
    await writeFile(legacyPath, JSON.stringify(project));
    await expect(page.getByRole("button", { name: /Open Project/u })).toBeVisible();
    await openProjectThroughUi({ harness, filePath: legacyPath });
    await expect(page.locator(".toast")).toContainText("Project opened with missing assets");
    await expect(page.locator(".toast")).toContainText("assets/Missing Image.png");
    await page.locator(".toast").getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(page.locator(".toast")).toHaveCount(0);
    const canvas = page.frameLocator(".canvas-iframe");
    await expect.poll(() => canvas.getByAltText("Existing image").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect.poll(() => readFile(legacyPath, "utf8")).toContain("assets/Missing%20Image.png");
    await expect(page.getByRole("button", { name: "Save project", exact: true })).toBeEnabled();
    await closeProjectThroughUi(harness);
    await openProjectThroughUi({ harness, filePath: legacyPath });
    const savedLegacy = await readFile(legacyPath, "utf8");
    await saveAsThroughMenu(harness, target);
    await expect(page.locator(".toast-error")).toContainText("Project contains non-portable references");
    expect(await access(target).then(() => true, () => false)).toBe(false);
    await expect(page.locator("#html-editor-layout")).toBeVisible();

    // Repair through the real picker, then repeat the same conversion.
    const replacement = path.join(root, "Missing Image.png");
    await writeFile(replacement, bytes);
    await importMediaThroughUi({ harness, filePaths: [replacement], kind: "image" });
    await saveAsThroughMenu(harness, target);
    await expect.poll(() => access(target).then(() => true, () => false)).toBe(true);
    await expect(page.getByRole("button", { name: "Save project", exact: true })).toBeEnabled();
    await closeProjectThroughUi(harness);
    await openProjectThroughUi({ harness, filePath: target });
    await canvas.getByAltText("Missing image").scrollIntoViewIfNeeded();
    await expect.poll(() => canvas.getByAltText("Missing image").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect(await readFile(legacyPath, "utf8")).toBe(savedLegacy);
    expect(await readFile(path.join(root, "assets", "Existing Image.png"))).toEqual(bytes);
    expect(harness.pageErrors).toEqual([]);
  } finally {
    await stopPortableEditor(harness);
    await rm(root, { recursive: true, force: true });
  }
});

test("imported font filenames save, export and delete after reopening", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-font-filenames-"));
  const harness = await launchPortableEditor(root);
  const {page} = harness;
  try {
    const fileName = "My Font%20.woff2";
    const input = path.join(root, fileName);
    const bytes = await readFile(path.resolve("public/frameworks/google-fonts/Inter/inter-v20-1.woff2"));
    await writeFile(input, bytes);
    const target = path.join(root, "fonts.amg");
    await createProjectThroughUi({harness, filePath: target, name: "Font round trip"});
    await page.getByTitle("Theme Editor", {exact: true}).click();
    await page.getByRole("button", {name: "Typography", exact: true}).click();
    await queueNativeDialogs(harness.app, {opens: [[input]]});
    await page.getByRole("button", {name: /Import Font File/u}).click();
    await expect(page.getByText("Imported 1 font file", {exact: true})).toBeVisible();
    await page.getByRole("button", {name: "Done", exact: true}).click();
    await page.getByRole("button", {name: "Save project", exact: true}).click();
    await expect(page.locator(".status-icon").filter({hasText: /^Saved$/})).toBeVisible();
    await expect(page.getByRole("button", {name: "Save project", exact: true})).toBeEnabled();
    await closeProjectThroughUi(harness);
    await openProjectThroughUi({harness, filePath: target});
    await page.getByRole("button", {name: "Export project", exact: true}).click();
    await queueNativeDialogs(harness.app, {opens: [[root]]});
    await page.locator(".export-modal").getByRole("button", {name: "Export", exact: true}).click();
    await expect(page.getByText("Export complete", {exact: true})).toBeVisible();
    const output = path.join(root, "Font round trip");
    expect(await readFile(path.join(output, "assets/fonts/My_Font_20.woff2"))).toEqual(bytes);
    expect(await readFile(path.join(output, "styles.css"), "utf8")).toContain('./assets/fonts/My_Font_20.woff2');
    await page.locator(".export-modal").getByRole("button", {name: "Close", exact: true}).click();
    await page.getByTitle("Theme Editor", {exact: true}).click();
    await page.getByRole("button", {name: "Typography", exact: true}).click();
    const remove = page.locator('button[title^="Delete "]').filter({has: page.locator('svg')});
    await expect(remove).toHaveCount(1);
    await remove.click();
    await expect(remove).toHaveCount(0);
    await page.getByRole("button", {name: "Done", exact: true}).click();
    await page.getByRole("button", {name: "Save project", exact: true}).click();
    await expect(page.locator(".status-icon").filter({hasText: /^Saved$/})).toBeVisible();
    await expect(page.getByRole("button", {name: "Save project", exact: true})).toBeEnabled();
    await closeProjectThroughUi(harness);
    await openProjectThroughUi({harness, filePath: target});
    const listed = await page.evaluate(() => window.api.fonts.listProject());
    expect(listed).toMatchObject({success: true, fonts: []});
    expect(harness.pageErrors).toEqual([]);
  } finally {
    await stopPortableEditor(harness);
    await rm(root, {recursive: true, force: true});
  }
});
