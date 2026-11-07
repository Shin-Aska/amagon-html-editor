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

test("legacy Save repairs missing assets interactively before conversion and preserves edits and source JSON", async ({}, testInfo) => {
  test.setTimeout(180_000);
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-legacy-repair-"));
  const harness = await launchPortableEditor(root);
  const {page} = harness;
  try {
    const bytes = await readFile(path.resolve("docs/images/logo.png"));
    const legacyPath = path.join(root, "project.json");
    const target = path.join(root, "repaired.amg");
    await mkdir(path.join(root, "assets", "nested"), {recursive: true});
    await writeFile(path.join(root, "assets", "nested", "Existing Image.png"), bytes);
    await writeFile(path.join(root, "assets", "unused-library.png"), bytes);
    const {projectSchemaVersion: ignoredVersion, ...legacy} = structuredClone(TEST_PROJECT);
    void ignoredVersion;
    const project = {...legacy, pages: [{id: "home", title: "Home", slug: "index", meta: {}, blocks: [
      {id: "existing", type: "image", props: {src: "app-media://project-asset/assets/nested/Existing Image.png", alt: "Existing image"}, styles: {}, classes: [], children: []},
      {id: "missing", type: "image", props: {src: "app-media://project-asset/assets/Missing Image.png", alt: "Missing image"}, styles: {}, classes: [], children: []},
    ]}]};
    const originalJson = JSON.stringify(project);
    await writeFile(legacyPath, originalJson);
    await openProjectThroughUi({harness, filePath: legacyPath});
    await expect(page.locator(".toast")).toContainText("assets/Missing Image.png");
    const canvas = page.frameLocator(".canvas-iframe");
    await expect.poll(() => canvas.getByAltText("Existing image").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await canvas.getByAltText("Existing image").click();
    await page.locator(".inspector").getByRole("tab", {name: "Content", exact: true}).click();
    await page.locator(".inspector").getByRole("textbox", {name: "Alt Text", exact: true}).fill("Edited legacy image");
    await page.getByRole("button", {name: "Save project", exact: true}).click();
    const dialog = page.getByRole("dialog", {name: "Save legacy project as .amg", exact: true});
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Conversion will not replace your original JSON file");
    await expect(dialog.getByRole("button", {name: /^Locate assets\//})).toHaveCount(1);
    await expect(dialog.getByRole("button", {name: "Save as .amg", exact: true})).toBeDisabled();
    await page.screenshot({path: testInfo.outputPath("legacy-repair-dialog.png")});
    await dialog.screenshot({path: testInfo.outputPath("legacy-repair-dialog-detail.png")});
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", {name: "Save project", exact: true})).toBeFocused();
    expect(await readFile(legacyPath, "utf8")).toBe(originalJson);
    await expect(canvas.getByAltText("Edited legacy image")).toBeVisible();

    await page.keyboard.press("Control+s");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", {name: "Recheck assets", exact: true}).click();
    await queueNativeDialogs(harness.app, {opens: [[]]});
    await dialog.getByRole("button", {name: "Locate assets/Missing Image.png", exact: true}).click();
    await expect(dialog.getByRole("button", {name: "Save as .amg", exact: true})).toBeDisabled();
    const replacement = path.join(root, "different-replacement.png");
    await writeFile(replacement, bytes);
    await queueNativeDialogs(harness.app, {opens: [[replacement]]});
    await dialog.getByRole("button", {name: "Locate assets/Missing Image.png", exact: true}).click();
    await expect(dialog).toContainText("All referenced assets are available");
    await expect(dialog.getByRole("button", {name: "Save as .amg", exact: true})).toBeEnabled();
    await canvas.getByAltText("Missing image").evaluate((image: HTMLImageElement) => {image.loading = "eager";});
    await expect.poll(() => canvas.getByAltText("Missing image").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect(await readFile(path.join(root, "assets", "Missing Image.png"))).toEqual(bytes);
    expect(await readFile(legacyPath, "utf8")).toBe(originalJson);
    await queueNativeDialogs(harness.app, {saves: [null]});
    await dialog.getByRole("button", {name: "Save as .amg", exact: true}).click();
    await expect(page.locator(".toast")).toContainText("Save canceled");
    await expect(page.locator(".toast-error")).toHaveCount(0);
    await page.keyboard.press("Control+s");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("All referenced assets are available");
    await queueNativeDialogs(harness.app, {saves: [target]});
    await dialog.getByRole("button", {name: "Save as .amg", exact: true}).click();
    await expect.poll(() => access(target).then(() => true, () => false)).toBe(true);
    await expect(page.getByRole("button", {name: "Save project", exact: true})).toBeEnabled();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => canvas.getByAltText("Missing image").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await closeProjectThroughUi(harness);
    await openProjectThroughUi({harness, filePath: target});
    await expect(canvas.getByAltText("Edited legacy image")).toBeVisible();
    await canvas.getByAltText("Missing image").scrollIntoViewIfNeeded();
    await expect.poll(() => canvas.getByAltText("Missing image").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await page.getByTitle("Asset Manager", {exact: true}).click();
    await expectLoadedImage(page, "unused-library.png");
    expect(await readFile(legacyPath, "utf8")).toBe(originalJson);
    expect(harness.pageErrors).toEqual([]);
  } finally {
    await stopPortableEditor(harness);
    await rm(root, {recursive: true, force: true});
  }
});

test("legacy conversion succeeds after autosave commits an imported asset", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-legacy-autosave-convert-"));
  const harness = await launchPortableEditor(root);
  const {page} = harness;
  try {
    const {projectSchemaVersion: ignoredVersion, ...legacy} = structuredClone(TEST_PROJECT);
    void ignoredVersion;
    const source = path.join(root, "project.json");
    const target = path.join(root, "converted.amg");
    await writeFile(source, JSON.stringify({...legacy, pages: [{id: "home", title: "Home", slug: "index", meta: {}, blocks: []}]}));
    const input = path.join(root, "imported.png");
    await writeFile(input, await readFile(path.resolve("docs/images/logo.png")));
    await openProjectThroughUi({harness, filePath: source});
    await importMediaThroughUi({harness, filePaths: [input], kind: "image"});
    await harness.app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.webContents.send("auto-save-tick"));
    await expect(page.locator(".status-icon").filter({hasText: /^Saved$/})).toBeVisible();
    const savedLegacy = await readFile(source);
    await page.getByRole("button", {name: "Save project", exact: true}).click();
    const dialog = page.getByRole("dialog", {name: "Save legacy project as .amg"});
    await expect(dialog).toContainText("All referenced assets are available");
    await queueNativeDialogs(harness.app, {saves: [target]});
    await dialog.getByRole("button", {name: "Save as .amg", exact: true}).click();
    await expect(page.locator(".toast")).toContainText("Project saved as .amg");
    await expect(page.locator(".toast-error")).toHaveCount(0);
    await expect(page.getByRole("button", {name: "Save project", exact: true})).toBeEnabled();
    await closeProjectThroughUi(harness);
    await openProjectThroughUi({harness, filePath: target});
    await page.getByTitle("Asset Manager", {exact: true}).click();
    await expectLoadedImage(page, "imported.png");
    expect(await readFile(source)).toEqual(savedLegacy);
    expect(harness.pageErrors).toEqual([]);
  } finally {
    await stopPortableEditor(harness);
    await rm(root, {recursive: true, force: true});
  }
});

test('legacy batch repair and unused cleanup support review, Undo and portable conversion', async ({}, testInfo) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-batch-repair-cleanup-'));
  const harness = await launchPortableEditor(root);
  const {page} = harness;
  try {
    const bytes = await readFile(path.resolve('docs/images/logo.png'));
    await mkdir(path.join(root, 'assets'));
    await mkdir(path.join(root, 'replacements'));
    await writeFile(path.join(root, 'assets/used.png'), bytes);
    await writeFile(path.join(root, 'assets/unused.png'), bytes);
    const inputs = await Promise.all(Array.from({length: 50}, async (_, index) => {
      const file = path.join(root, 'replacements', `image-${index}.png`);
      await writeFile(file, bytes);
      return file;
    }));
    const {projectSchemaVersion: ignoredVersion, ...legacy} = structuredClone(TEST_PROJECT);
    void ignoredVersion;
    const source = path.join(root, 'legacy.json');
    const target = path.join(root, 'repaired.amg');
    const original = JSON.stringify({...legacy,
      customCss: inputs.map((_, index) => `.fixture-${index} {background:url(assets/image-${index}.png)}`).join('\n'),
      projectSettings: {...legacy.projectSettings, fonts: [{id: 'unused-font', name: 'Unapplied Family', fileName: 'unapplied.woff2', relativePath: 'assets/fonts/unapplied.woff2', format: 'woff2', source: 'imported'}]},
      pages: [{id: 'home', title: 'Home', slug: 'index', meta: {}, blocks: [{id: 'used-image', type: 'image', props: {src: 'assets/used.png', alt: 'Used image'}, styles: {}, classes: [], children: []}]}],
    });
    await writeFile(source, original);
    await openProjectThroughUi({harness, filePath: source});
    await page.getByRole('button', {name: 'Save project', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Save legacy project as .amg', exact: true});
    await expect(dialog.getByRole('button', {name: 'Save as .amg', exact: true})).toBeDisabled();
    const missing = dialog.getByRole('region', {name: 'Missing assets', exact: true});
    await expect(missing.locator('li')).toHaveCount(25);
    await missing.getByRole('searchbox').fill('image-49.png');
    await expect(missing.locator('li')).toHaveCount(1);
    await expect(missing).toContainText('image-49.png');
    await missing.getByRole('searchbox').fill('');
    await queueNativeDialogs(harness.app, {opens: [[]]});
    await dialog.getByRole('button', {name: 'Locate multiple files…', exact: true}).click();
    await expect(missing.locator('li')).toHaveCount(25);
    await queueNativeDialogs(harness.app, {opens: [inputs]});
    await dialog.getByRole('button', {name: 'Locate multiple files…', exact: true}).click();
    await expect(dialog).toContainText('Repaired 50 files.');
    await expect(dialog.getByRole('button', {name: 'Missing assets (1)', exact: true})).toBeEnabled();
    await dialog.getByRole('button', {name: 'Unused assets (2)', exact: true}).click();
    const cleanup = dialog.getByRole('region', {name: 'Unused asset cleanup', exact: true});
    await expect(cleanup).not.toContainText('assets/used.png');
    await cleanup.getByRole('button', {name: 'Select all', exact: true}).click();
    await cleanup.getByRole('button', {name: 'Review cleanup…', exact: true}).click();
    await page.screenshot({path: testInfo.outputPath('asset-cleanup-review.png')});
    await cleanup.getByRole('button', {name: 'Keep assets', exact: true}).click();
    expect(await readFile(path.join(root, 'assets/unused.png'))).toEqual(bytes);
    await cleanup.getByRole('button', {name: 'Review cleanup…', exact: true}).click();
    await cleanup.getByRole('button', {name: 'Confirm cleanup', exact: true}).click();
    await expect(dialog.getByRole('button', {name: 'Save as .amg', exact: true})).toBeEnabled();
    await expect(cleanup).toContainText('0 unused files and missing entries');
    await expect(readFile(path.join(root, 'assets/unused.png'))).rejects.toMatchObject({code: 'ENOENT'});
    await cleanup.getByRole('button', {name: 'Undo cleanup', exact: true}).click();
    await expect(dialog.getByRole('button', {name: 'Save as .amg', exact: true})).toBeDisabled();
    await expect(cleanup).toContainText('2 unused files and missing entries');
    expect(await readFile(path.join(root, 'assets/unused.png'))).toEqual(bytes);
    await cleanup.getByRole('button', {name: 'Select all', exact: true}).click();
    await cleanup.getByRole('button', {name: 'Review cleanup…', exact: true}).click();
    await cleanup.getByRole('button', {name: 'Confirm cleanup', exact: true}).click();
    await expect(dialog.getByRole('button', {name: 'Save as .amg', exact: true})).toBeEnabled();
    await queueNativeDialogs(harness.app, {saves: [target]});
    await dialog.getByRole('button', {name: 'Save as .amg', exact: true}).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Save project', exact: true})).toBeEnabled();
    expect(await readFile(source, 'utf8')).toBe(original);
    await closeProjectThroughUi(harness);
    await openProjectThroughUi({harness, filePath: target});
    await expect(page.frameLocator('.canvas-iframe').getByAltText('Used image')).toBeVisible();
    const {createDefaultProjectServiceFiles} = await import('../../src/main/projects/projectServiceFiles');
    const files = createDefaultProjectServiceFiles();
    const inspected = await files.openAmg(target, path.join(root, 'inspection'));
    expect(inspected.project.projectSettings.fonts).toEqual([]);
    const paths = await files.listAssetPaths(inspected.workspace.path);
    expect(paths).toHaveLength(51);
    expect(paths).not.toContain('assets/unused.png');
    await page.getByTitle('Asset Manager', {exact: true}).click();
    await page.getByRole('button', {name: 'Review unused assets', exact: true}).click();
    const review = page.getByRole('dialog', {name: 'Review project assets', exact: true});
    await expect(review).toContainText('0 unused files and missing entries');
    await review.getByRole('button', {name: 'Done', exact: true}).click();
    expect(harness.pageErrors).toEqual([]);
  } finally {
    await stopPortableEditor(harness);
    await rm(root, {recursive: true, force: true});
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
