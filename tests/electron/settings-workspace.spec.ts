import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { capture, launchAmagon, stopAmagon } from './electronHarness';
import { createProjectThroughUi } from './projectUi';

test('settings dialogs keep a stable frame across every section', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-settings-workspace-'));
    const harness = await launchAmagon(root);
    const resize = async (width: number): Promise<void> => {
        await harness.app.evaluate(({ BrowserWindow }, request) => {
            const window = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.getURL() === request.url);
            if (!window) throw new TypeError('Missing settings test window');
            window.setMinimumSize(300, 400);
            window.setContentSize(request.width, 835);
        }, { url: harness.page.url(), width });
        await expect.poll(() => harness.page.evaluate(() => window.innerWidth)).toBe(width);
    };
    try {
        await createProjectThroughUi({ harness, filePath: path.join(root, 'workspace.amg'), name: 'Settings Workspace' });
        await harness.page.getByTitle('Theme Editor', { exact: true }).click();
        const theme = harness.page.locator('.theme-editor-dialog');
        const initialBounds = await theme.boundingBox();
        await harness.page.getByRole('button', { name: 'Presets', exact: true }).click();
        await expect.poll(() => theme.boundingBox()).toEqual(initialBounds);
        const themeSections = ['Colors', 'Presets', 'Typography', 'Spacing', 'Borders', 'Custom CSS'];
        const appSections = ['General', 'Credentials', 'AI Assistant', 'Media Search'];
        for (const width of [1384, 768, 375]) {
            await resize(width);
            const bounds = await theme.boundingBox();
            for (const section of themeSections) {
                await theme.getByRole('navigation').getByRole('button', { name: section, exact: true }).click();
                await expect(theme.getByRole('checkbox', { name: 'Smooth transition', exact: true })).toHaveCount(section === 'Colors' ? 1 : 0);
                await expect.poll(() => theme.boundingBox()).toEqual(bounds);
                const content = theme.locator('.settings-workspace-content');
                await expect.poll(() => content.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
                await content.evaluate((element) => { element.scrollTop = 0; });
                if (section === 'Presets') {
                    await expect(theme.frameLocator('.theme-gallery-preview-frame').first().getByText('Theme Preview', { exact: true })).toBeVisible();
                }
                await capture(harness, `settings-theme-${width}-${section.replaceAll(' ', '-')}.png`, {
                    actions: [`Select ${section}`, `Resize to ${width}px`], state: 'Fixed frame, section top',
                });
                if (await content.evaluate((element) => element.scrollHeight > element.clientHeight)) {
                    await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
                    if (section === 'Presets') {
                        await expect(theme.frameLocator('.theme-gallery-preview-frame').last().getByText('Theme Preview', { exact: true })).toBeVisible();
                    }
                    await capture(harness, `settings-theme-${width}-${section.replaceAll(' ', '-')}-bottom.png`, {
                        actions: [`Scroll ${section} to bottom`], state: 'Bottom controls accessible; header and footer stay fixed',
                    });
                }
            }
            await resize(1384);
            await theme.getByRole('button', { name: 'Done', exact: true }).click();
            await harness.page.getByTitle('Global Settings', { exact: true }).click();
            await resize(width);
            const app = harness.page.locator('.settings-dialog');
            await expect(app).toHaveAttribute('role', 'dialog');
            await expect.poll(() => app.boundingBox()).toEqual(bounds);
            for (const section of appSections) {
                await app.getByRole('navigation').getByRole('button', { name: section, exact: true }).click();
                await expect.poll(() => app.boundingBox()).toEqual(bounds);
                const content = app.locator('.settings-workspace-content');
                await expect.poll(() => content.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
                await capture(harness, `settings-app-${width}-${section.replaceAll(' ', '-')}.png`, {
                    actions: [`Select ${section}`, `Resize to ${width}px`], state: 'App settings use the same fixed frame',
                });
                if (await content.evaluate((element) => element.scrollHeight > element.clientHeight)) {
                    await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
                    await capture(harness, `settings-app-${width}-${section.replaceAll(' ', '-')}-bottom.png`, {
                        actions: [`Scroll ${section} to bottom`], state: 'All settings reachable with fixed navigation and Done',
                    });
                }
            }
            await resize(1384);
            await app.getByRole('button', { name: 'Done', exact: true }).click();
            await harness.page.getByTitle('Theme Editor', { exact: true }).click();
        }
    } finally {
        await stopAmagon(harness);
        await rm(root, { recursive: true, force: true });
    }
});

test('settings preserve keyboard, nested dialogs, editing target, and preferences', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-settings-interactions-'));
    const harness = await launchAmagon(root);
    try {
        await createProjectThroughUi({ harness, filePath: path.join(root, 'settings.amg'), name: 'Website · 日本語 한국어 中文' });
        const opener = harness.page.getByTitle('Theme Editor', { exact: true });
        await opener.click();
        const theme = harness.page.locator('.theme-editor-dialog');
        const close = theme.getByRole('button', { name: 'Close', exact: true });
        const done = theme.getByRole('button', { name: 'Done', exact: true });
        await expect(close).toBeFocused();
        await close.press('Shift+Tab');
        await expect(done).toBeFocused();
        await done.press('Tab');
        await expect(close).toBeFocused();
        await theme.getByRole('button', { name: 'Dark Page', exact: true }).click();
        await theme.getByLabel('Primary hex', { exact: true }).fill('#123456');
        await theme.getByLabel('Smooth transition', { exact: true }).check();
        const content = theme.locator('.settings-workspace-content');
        await content.evaluate((element) => { element.scrollTop = 250; });
        await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBe(250);
        await theme.getByRole('navigation').getByRole('button', { name: 'Spacing', exact: true }).click();
        await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBe(0);
        await theme.getByRole('navigation').getByRole('button', { name: 'Colors', exact: true }).click();
        await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBe(250);
        await expect(theme.getByRole('button', { name: 'Dark Page', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(theme.getByLabel('Primary hex', { exact: true })).toHaveValue('#123456');
        await theme.getByRole('button', { name: 'Light', exact: true }).click();
        await expect(theme.getByRole('button', { name: 'Dark Page', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await capture(harness, 'settings-theme-editing-preview-independent.png', {
            actions: ['Edit Dark Page', 'Switch sections and restore scroll', 'Choose Light preview'],
            state: 'Editing target, color value, and preview remain independent',
        });
        await theme.getByRole('navigation').getByRole('button', { name: 'Typography', exact: true }).click();
        await theme.locator('.tfp-trigger').first().click();
        const search = harness.page.locator('.tfp-search-input');
        await search.fill('System Serif');
        await expect(harness.page.locator('.tfp-option-name').filter({ hasText: 'System Serif' })).toBeVisible();
        await capture(harness, 'settings-font-picker-portal.png', {
            actions: ['Open Body Font dropdown', 'Search System Serif'], state: 'Portalled font picker remains interactive above the workspace',
        });
        const option = harness.page.locator('.tfp-option').filter({ hasText: 'System Serif' });
        await search.press('Shift+Tab');
        await expect(option).toBeFocused();
        await option.press('Tab');
        await expect(search).toBeFocused();
        await search.press('Shift+Tab');
        await option.press('Enter');
        await expect(harness.page.locator('.tfp-dropdown')).toHaveCount(0);
        await expect(theme.locator('.tfp-trigger').first()).toBeFocused();
        await expect(theme.locator('.tfp-trigger').first()).toContainText('System Serif');
        await theme.locator('.tfp-trigger').first().click();
        await search.press('Escape');
        await expect(harness.page.locator('.tfp-dropdown')).toHaveCount(0);
        await expect(theme).toBeVisible();
        await done.click();
        await expect(opener).toBeFocused();
        const appOpener = harness.page.getByTitle('Global Settings', { exact: true });
        await appOpener.click();
        const app = harness.page.locator('.settings-dialog');
        await app.getByLabel('Default Layout', { exact: true }).selectOption('zen');
        await app.getByRole('button', { name: 'Light', exact: true }).click();
        await expect(harness.page.locator('body')).not.toHaveClass(/dark/);
        await capture(harness, 'settings-app-light.png', { actions: ['Select Light app theme', 'Choose Zen default layout'], state: 'Light token variant and live preferences' });
        await app.getByRole('button', { name: 'Done', exact: true }).click();
        await opener.click();
        await theme.getByRole('button', { name: 'Colors', exact: true }).click();
        await capture(harness, 'settings-theme-light.png', { actions: ['Open Theme Editor with Light app appearance'], state: 'Theme controls use the light application tokens independently of Dark Page editing' });
        await done.click();
        await appOpener.click();
        await expect(app.getByLabel('Default Layout', { exact: true })).toHaveValue('zen');
        await app.getByRole('button', { name: 'Dark', exact: true }).click();
        await app.getByRole('button', { name: 'Credentials', exact: true }).click();
        await app.getByRole('button', { name: 'Add Credential', exact: true }).click();
        await expect(harness.page.locator('.cred-modal')).toBeVisible();
        await capture(harness, 'settings-nested-credential.png', { actions: ['Open Add Credential'], state: 'Nested credential editor remains available' });
        await harness.page.keyboard.press('Escape');
        await expect(harness.page.locator('.cred-modal')).toHaveCount(0);
        await expect(app).toBeVisible();
        await app.getByRole('button', { name: 'Media Search', exact: true }).click();
        await app.getByRole('button', { name: 'Credentials tab', exact: true }).click();
        await expect(app.getByRole('navigation').getByRole('button', { name: 'Credentials', exact: true })).toHaveAttribute('aria-current', 'page');
        await app.getByRole('button', { name: 'Done', exact: true }).click();
        await opener.click();
        await harness.page.emulateMedia({ reducedMotion: 'reduce' });
        await theme.getByRole('button', { name: 'Colors', exact: true }).click();
        await capture(harness, 'settings-theme-cjk-reduced.png', { actions: ['Reopen Theme Editor', 'Use reduced motion'], state: 'CJK project name and reduced-motion resting state' });
    } finally {
        await stopAmagon(harness);
        await rm(root, { recursive: true, force: true });
    }
});
