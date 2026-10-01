import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { capture, launchAmagon, stopAmagon } from './electronHarness';
import { createProjectThroughUi } from './projectUi';

test('AI settings removes and restores a local provider', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-provider-removal-'));
    const harness = await launchAmagon(root);
    const resize = async (width: number): Promise<void> => {
        await harness.app.evaluate(({ BrowserWindow }, request) => {
            const window = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.getURL() === request.url);
            if (!window) throw new TypeError('Missing AI settings test window');
            window.setMinimumSize(300, 400);
            window.setContentSize(request.width, 835);
        }, { url: harness.page.url(), width });
        await expect.poll(() => harness.page.evaluate(() => window.innerWidth)).toBe(width);
    };
    try {
        await createProjectThroughUi({ harness, filePath: path.join(root, 'workspace.amg'), name: 'Provider settings' });
        await harness.page.getByTitle('Global Settings', { exact: true }).click();
        const settings = harness.page.locator('.settings-dialog');
        await settings.getByRole('navigation').getByRole('button', { name: 'AI Assistant', exact: true }).click();
        const provider = settings.getByLabel('AI Provider', { exact: true });

        await provider.selectOption('opencode');
        await settings.getByRole('button', { name: 'Done', exact: true }).click();
        await harness.page.getByTitle('Global Settings', { exact: true }).click();
        await settings.getByRole('navigation').getByRole('button', { name: 'AI Assistant', exact: true }).click();
        await expect(provider).toHaveValue('opencode');
        await settings.getByRole('button', { name: 'Remove OpenCode', exact: true }).click();
        await expect(settings.getByText('Remove OpenCode from Amagon?', { exact: true })).toBeVisible();
        await capture(harness, 'ai-provider-remove-confirmation.png', {
            actions: ['Select OpenCode', 'Choose Remove OpenCode'],
            state: 'Inline confirmation explains that the installed tool is unaffected',
        });
        await resize(375);
        await capture(harness, 'ai-provider-remove-confirmation-375.png', {
            actions: ['Resize to 375px with removal confirmation open'],
            state: 'Confirmation copy and actions remain reachable without horizontal overflow',
        });
        const confirmationWidth = await settings.locator('.settings-workspace-content').evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            overflowing: [...element.querySelectorAll('*')]
                .map((child) => ({ className: child.className, right: child.getBoundingClientRect().right }))
                .filter((child) => child.right > element.getBoundingClientRect().right + 1)
                .slice(0, 8),
        }));
        expect(confirmationWidth.scrollWidth, JSON.stringify(confirmationWidth)).toBeLessThanOrEqual(confirmationWidth.clientWidth);
        await resize(1384);
        await settings.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(provider).toHaveValue('opencode');

        await settings.getByRole('button', { name: 'Remove OpenCode', exact: true }).click();
        await settings.getByRole('button', { name: 'Remove provider', exact: true }).click();
        await expect(provider).toHaveValue('openai');
        await expect(settings.getByText('Active provider: OpenAI', { exact: true })).toBeVisible();
        await expect(provider.locator('option[value="opencode"]')).toContainText('add again');
        await capture(harness, 'ai-provider-removed-settings.png', {
            actions: ['Confirm Remove provider'],
            state: 'OpenAI is active and OpenCode remains available to add again',
        });
        await resize(375);
        await capture(harness, 'ai-provider-removed-settings-375.png', {
            actions: ['Resize to 375px after removal'],
            state: 'Replacement provider and re-add menu remain accessible without horizontal overflow',
        });
        await expect.poll(() => settings.locator('.settings-workspace-content').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        await resize(1384);

        await settings.getByRole('button', { name: 'Done', exact: true }).click();
        await harness.page.getByTitle('Global Settings', { exact: true }).click();
        await settings.getByRole('navigation').getByRole('button', { name: 'AI Assistant', exact: true }).click();
        await expect(provider.locator('option[value="opencode"]')).toContainText('add again');
        await provider.selectOption('opencode');
        await expect(settings.getByRole('button', { name: 'Remove OpenCode', exact: true })).toBeVisible();
        await expect(provider.locator('option[value="opencode"]')).not.toContainText('add again');
    } finally {
        await stopAmagon(harness);
        await rm(root, { recursive: true, force: true });
    }
});
