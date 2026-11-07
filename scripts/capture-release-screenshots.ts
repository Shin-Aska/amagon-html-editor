import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect } from '@playwright/test';
import { launchPortableEditor, stopPortableEditor } from '../tests/electron/portableEditorHarness';
import { createProjectThroughUi } from '../tests/electron/projectUi';

// Run after npm run build. Uses a disposable profile and project, never user data.
const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-release-capture-'));
const output = path.resolve('docs/releases/1.11.0');
await mkdir(output, { recursive: true });
const harness = await launchPortableEditor(root);
const { page } = harness;
const capture = async (name: string) => {
  await page.mouse.move(700, 5);
  await page.screenshot({ path: path.join(output, name) });
};
try {
  await harness.app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.unmaximize();
    window.setSize(1440, 900);
  });
  await createProjectThroughUi({ harness, filePath: path.join(root, 'studio.amg'), name: 'Amagon Studio' });
  const skip = page.getByRole('button', { name: 'Skip for now' });
  try { await skip.waitFor({ state: 'visible', timeout: 2500 }); await skip.click(); }
  catch (error) { if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error; }
  const canvas = page.frameLocator('.canvas-iframe');
  await canvas.getByRole('heading', { name: 'Welcome to Amagon Studio' }).click();
  const inspector = page.locator('.inspector');
  await inspector.getByRole('textbox', { name: 'Text', exact: true }).fill('Make something yours.');
  await inspector.getByRole('tab', { name: 'Design', exact: true }).click();
  await inspector.getByRole('button', { name: 'Editorial', exact: true }).click();

  await page.getByRole('button', { name: 'Open global settings', exact: true }).click();
  const settings = page.locator('.settings-dialog');
  await settings.getByRole('button', { name: /Appearance/ }).click();
  await settings.getByRole('button', { name: 'Ocean', exact: true }).click();
  await settings.getByRole('button', { name: 'Dark', exact: true }).click();
  await capture('app-themes.png');
  await settings.getByRole('button', { name: 'Customize Ocean', exact: true }).click();
  await settings.getByLabel('Theme name', { exact: true }).fill('Ocean Dusk');
  await capture('theme-creator.png');
  await settings.getByRole('button', { name: 'Cancel', exact: true }).click();
  await settings.getByRole('button', { name: 'Done', exact: true }).click();
  await inspector.getByRole('button', { name: 'Theme colors', exact: true }).click();
  await capture('widget-design.png');

  await page.getByRole('button', { name: 'Change editor layout', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Canvas + Code', exact: true }).click();
  await expect(page.locator('.code-editor .monaco-editor')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Editor options', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Word wrap', exact: true }).check();
  await page.getByRole('button', { name: 'Editor options', exact: true }).click();
  await canvas.getByRole('heading', { name: 'Make something yours.', exact: true }).click();
  await expect(page.locator('.code-editor .amagon-code-selection').first()).toBeVisible();
  await capture('canvas-code-ocean.png');
  if (harness.pageErrors.length) throw new Error(harness.pageErrors.join('\n'));
  console.log(`Captured four release screenshots in ${output}`);
} finally {
  await stopPortableEditor(harness);
  await rm(root, { recursive: true, force: true });
}
