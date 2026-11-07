import {mkdtemp, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {expect, test} from '@playwright/test'
import {launchPortableEditor,stopPortableEditor} from './portableEditorHarness'
import {createProjectThroughUi} from './projectUi'

test('widget content, presets, theme colors, search and reset work in the desktop editor', async ({}, testInfo) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-widget-experience-'));
    const harness = await launchPortableEditor(root);
    const {page} = harness;
    try {
        await createProjectThroughUi({harness, filePath: path.join(root, 'widgets.amg'), name: 'Widget Studio'});
        const canvas = page.frameLocator('.canvas-iframe');
        await expect.poll(() => canvas.locator('body').evaluate(async (element) => {
            const fonts = element.ownerDocument.fonts;
            const loaded = await fonts.load('16px bootstrap-icons');
            return loaded.length > 0 && fonts.check('16px bootstrap-icons');
        })).toBe(true);
        await canvas.getByRole('heading', {name: 'Welcome to Widget Studio'}).click();
        const inspector = page.locator('.inspector');
        await inspector.getByRole('textbox', {name: 'Text', exact: true}).fill('Make it yours');
        await expect(canvas.getByRole('heading', {name: 'Make it yours'})).toBeVisible();
        await page.screenshot({path: testInfo.outputPath('widget-content.png')});

        await inspector.getByRole('tab', {name: 'Design', exact: true}).click();
        const alignment = inspector.getByRole('combobox', {name: 'Alignment', exact: true});
        await expect(alignment).toHaveValue('');
        await alignment.selectOption('text-start');
        await expect(canvas.getByRole('heading', {name: 'Make it yours'})).toHaveCSS('text-align', 'left');
        await inspector.getByRole('button', {name: 'Editorial', exact: true}).click();
        await expect.poll(() => canvas.getByRole('heading', {name: 'Make it yours'}).evaluate(element => {
            const style = getComputedStyle(element);
            return Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize)
        })).toBeCloseTo(1.8);
        await inspector.getByRole('button', {name: 'Theme colors', exact: true}).click();
        await inspector.getByLabel('Text color', {exact: true}).selectOption('var(--theme-primary)');
        await expect.poll(() => canvas.getByRole('heading', {name: 'Make it yours'}).evaluate(element => {
            const probe = document.createElement('span'); probe.style.color = 'var(--theme-primary)'; document.body.append(probe);
            const expected = getComputedStyle(probe).color; probe.remove();
            return getComputedStyle(element).color === expected
        })).toBe(true);
        await page.screenshot({path: testInfo.outputPath('widget-design.png')});

        await inspector.getByRole('searchbox', {name: 'Search widget settings'}).fill('opacity');
        await expect(inspector.getByLabel('Opacity', {exact: true})).toBeVisible();
        await inspector.getByLabel('Opacity', {exact: true}).fill('0.5');
        await expect(canvas.getByRole('heading', {name: 'Make it yours'})).toHaveCSS('opacity', '0.5');
        await inspector.getByRole('searchbox').clear();
        await inspector.getByRole('button', {name: 'Reset style overrides', exact: true}).click();
        await expect(canvas.getByRole('heading', {name: 'Make it yours'})).toHaveCSS('opacity', '1');
        await expect(canvas.getByRole('heading', {name: 'Make it yours'})).toHaveCSS('max-width', 'none');
        await expect(canvas.getByRole('heading', {name: 'Make it yours'})).toHaveCSS('text-align', 'left');

        // A compact window keeps navigation and settings inside the panel.
        await harness.app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.setSize(1000, 800));
        await expect.poll(() => inspector.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        await page.screenshot({path: testInfo.outputPath('widget-compact.png')});
        expect(harness.pageErrors).toEqual([])
    } finally {
        await stopPortableEditor(harness);
        await rm(root, {recursive: true, force: true})
    }
});
