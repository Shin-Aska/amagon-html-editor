import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { capture, launchAmagon, queueNativeDialogs, stopAmagon } from './electronHarness';
import { closeProjectThroughUi, createProjectThroughUi, openProjectThroughUi } from './projectUi';
import { inspectAmgArchive } from './archiveAssertions';
import { parseLegacyProjectDocument } from '../../src/shared/projects/projectDocumentSchema';
import { createBlock, createDefaultTheme, createDefaultThemeVariants, type ProjectData } from '../../src/renderer/store/types';

for (const format of ['amg', 'json'] as const) {
    test(`smooth theme transitions persist and render for ${format} projects`, async () => {
        // Given: an isolated real project with the transition initially off.
        const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-theme-transition-'));
        const filePath = path.join(root, `transition.${format}`);
        const harness = await launchAmagon(root);
        try {
            await harness.page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
            if (format === 'amg') {
                await createProjectThroughUi({ harness, filePath, name: 'Transition Check' });
            } else {
                const project: ProjectData = {
                    customCss: '', userBlocks: [],
                    projectSettings: { name: 'Transition Check', framework: 'vanilla', theme: createDefaultTheme(), themes: createDefaultThemeVariants(), globalStyles: {} },
                    pages: [{ id: 'home', title: 'Home', slug: 'index', meta: {}, blocks: [createBlock('paragraph', { props: { text: 'Light and dark page transition' } })] }],
                };
                await writeFile(filePath, JSON.stringify(project));
                await openProjectThroughUi({ harness, filePath });
            }
            await harness.page.getByTitle('Theme Editor', { exact: true }).click();
            const checkbox = harness.page.getByRole('checkbox', { name: 'Smooth transition' });
            await expect(checkbox).not.toBeChecked();
            await capture(harness, `transition-${format}-off.png`, { actions: ['Open theme settings'], state: 'Existing projects default to an unchecked option' });

            // When: enable with the keyboard and save through the actual application.
            await checkbox.focus();
            await checkbox.press('Space');
            await expect(checkbox).toBeChecked();
            await capture(harness, `transition-${format}-settings.png`, { actions: ['Enable Smooth transition with Space'], state: 'Checked checkbox in the existing theme mode bar' });
            await harness.page.getByRole('button', { name: 'Light', exact: true }).click();
            await harness.page.locator('.theme-editor-close').click();
            await harness.page.getByRole('button', { name: 'Save project', exact: true }).click();
            await expect(harness.page.getByText('Saved', { exact: true })).toBeVisible();
            const serialized = format === 'amg'
                ? (await inspectAmgArchive(filePath, 'transition-archive.json')).projectText
                : await readFile(filePath, 'utf8');
            const saved = parseLegacyProjectDocument(JSON.parse(serialized));
            expect(saved.projectSettings.themes?.transitionEnabled).toBe(true);
            await closeProjectThroughUi(harness);
            await openProjectThroughUi({ harness, filePath });
            await harness.page.getByTitle('Theme Editor', { exact: true }).click();
            await expect(checkbox).toBeChecked();
            await harness.app.evaluate(({ BrowserWindow }, url) => {
                const window = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.getURL() === url);
                if (!window) throw new TypeError('Missing editor window');
                window.setSize(1000, 800);
            }, harness.page.url());
            await expect.poll(() => harness.page.evaluate(() => window.innerWidth)).toBe(984);
            await capture(harness, `transition-${format}-compact.png`, { actions: ['Save and reopen', 'Resize to compact desktop'], state: 'Persisted checkbox and readable wrapped controls' });
            await harness.page.locator('.theme-editor-close').click();

            // Then: real generated palette animations have distinct start/middle/end colors.
            const frame = await harness.page.locator('iframe[title="Page Preview"]').elementHandle().then((element) => element?.contentFrame());
            if (!frame) throw new TypeError('Missing page preview frame');
            await expect(frame.locator('html')).toHaveAttribute('data-page-theme', 'light');
            const before = await frame.evaluate(() => getComputedStyle(document.body).backgroundColor);
            await capture(harness, `transition-${format}-start.png`, { actions: ['Preview light page'], state: 'Transition start' });
            await frame.evaluate(() => document.documentElement.addEventListener('transitionrun', () => {
                for (const animation of document.documentElement.getAnimations()) animation.pause();
            }, { once: true }));
            await harness.page.getByRole('button', { name: 'Preview page with dark theme', exact: true }).click();
            await expect.poll(() => frame.evaluate(() => document.documentElement.getAnimations().length)).toBeGreaterThan(0);
            const middle = await frame.evaluate(async () => {
                for (const animation of document.documentElement.getAnimations()) animation.currentTime = 100;
                await new Promise(requestAnimationFrame);
                return getComputedStyle(document.body).backgroundColor;
            });
            await capture(harness, `transition-${format}-middle.png`, { actions: ['Switch to Dark', 'Hold native animation at 100ms'], state: 'Real interpolated midpoint' });
            const after = await frame.evaluate(async () => {
                for (const animation of document.documentElement.getAnimations()) animation.finish();
                await new Promise(requestAnimationFrame);
                return getComputedStyle(document.body).backgroundColor;
            });
            expect(middle).not.toBe(before);
            expect(middle).not.toBe(after);
            expect(after).not.toBe(before);
            await capture(harness, `transition-${format}-end.png`, { actions: ['Finish native transition'], state: 'Settled dark page' });
            await harness.page.getByRole('button', { name: 'Preview reduced motion', exact: true }).click();
            await expect(frame.locator('html')).toHaveCSS('transition-duration', '0s');
            await harness.page.getByRole('button', { name: 'Preview page with light theme', exact: true }).click();
            await expect(frame.locator('body')).toHaveCSS('background-color', before);
            expect(await frame.evaluate(() => document.documentElement.getAnimations().length)).toBe(0);
            await capture(harness, `transition-${format}-reduced.png`, { actions: ['Choose Reduced motion while OS allows motion', 'Switch to light'], state: 'Toolbar override prevents palette animation' });
            await harness.page.emulateMedia({ reducedMotion: 'reduce' });
            await harness.page.getByRole('button', { name: 'Preview full motion', exact: true }).click();
            await expect(frame.locator('html')).toHaveCSS('transition-duration', /0\.2s/);
            await frame.evaluate(() => document.documentElement.addEventListener('transitionrun', () => {
                for (const animation of document.documentElement.getAnimations()) animation.pause();
            }, { once: true }));
            await harness.page.getByRole('button', { name: 'Preview page with dark theme', exact: true }).click();
            await expect.poll(() => frame.evaluate(() => document.documentElement.getAnimations().length)).toBeGreaterThan(0);
            await frame.evaluate(() => {
                for (const animation of document.documentElement.getAnimations()) animation.finish();
            });
            await expect(frame.locator('body')).toHaveCSS('background-color', after);
            await capture(harness, `transition-${format}-full.png`, { actions: ['Choose Full motion while OS reduces motion', 'Switch to dark and finish native transition'], state: 'Toolbar override enables palette animation' });
            await harness.page.getByRole('button', { name: 'Preview motion using the system preference', exact: true }).click();
            await expect(frame.locator('html')).toHaveCSS('transition-duration', '0s');
            await harness.page.getByRole('button', { name: 'Preview page with light theme', exact: true }).click();
            await expect(frame.locator('html')).toHaveAttribute('data-page-theme', 'light');
            expect(await frame.evaluate(() => document.documentElement.getAnimations().length)).toBe(0);
            await expect(frame.locator('body')).toHaveCSS('background-color', before);

            const exportBase = path.join(root, 'export');
            await mkdir(exportBase);
            await queueNativeDialogs(harness.app, { opens: [[exportBase]] });
            await harness.page.getByTitle('Export', { exact: true }).click();
            await harness.page.getByRole('radio', { name: 'Single HTML (current page)', exact: true }).check();
            await harness.page.getByRole('checkbox', { name: 'Include JS (framework scripts)', exact: true }).uncheck();
            await harness.page.locator('.export-btn-primary').click();
            await expect(harness.page.getByText('Export complete', { exact: true })).toBeVisible();
            const exportDirectory = await harness.page.locator('.export-success-path').textContent();
            if (!exportDirectory) throw new TypeError('Missing export output directory');
            const html = await readFile(path.join(exportDirectory, 'index.html'), 'utf8');
            await harness.page.locator('.export-close-btn').click();
            await harness.page.getByTitle('Theme Editor', { exact: true }).click();
            await checkbox.uncheck();
            await harness.page.locator('.theme-editor-close').click();
            await harness.page.emulateMedia({ reducedMotion: 'no-preference' });
            await expect.poll(() => frame.evaluate(() => getComputedStyle(document.documentElement).transitionDuration)).toBe('0s');

            // The actual export pipeline preserves the same device-aware CSS without editor code.
            await harness.page.setContent(html);
            await harness.page.emulateMedia({ colorScheme: 'light' });
            await expect(harness.page.locator('html')).toHaveCSS('transition-duration', /0\.2s/);
            await harness.page.emulateMedia({ colorScheme: 'dark' });
            await expect(harness.page.locator('body')).toHaveCSS('background-color', after);
            await harness.page.emulateMedia({ reducedMotion: 'reduce' });
            await expect(harness.page.locator('html')).toHaveCSS('transition-duration', '0s');
            await capture(harness, `transition-${format}-export.png`, { actions: ['Export Single HTML through the app', 'Render output with dark device preference and reduced motion'], state: 'Exported page reaches the same dark palette without animation under reduced motion' });
        } finally {
            await stopAmagon(harness);
            await rm(root, { recursive: true, force: true });
        }
    });
}
