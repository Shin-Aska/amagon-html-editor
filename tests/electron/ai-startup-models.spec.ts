import {mkdtemp, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {expect, test} from '@playwright/test'
import {capture, launchAmagon, stopAmagon} from './electronHarness'
import {createProjectThroughUi} from './projectUi'

test('AI sidebar loads saved provider models without opening Settings', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-ai-startup-models-'))
    const harness = await launchAmagon(root)
    try {
        const saved = await harness.page.evaluate(() => window.api.ai.setConfig({
            provider: 'anthropic',
            apiKey: 'startup-model-test-key'
        }))
        expect(saved.success).toBe(true)

        await harness.page.reload()
        const catalog = await harness.page.evaluate(() => window.api.ai.getModels())
        expect(catalog.success).toBe(true)
        expect(catalog.models.anthropic).toContain('claude-sonnet-4-20250514')
        await createProjectThroughUi({
            harness,
            filePath: path.join(root, 'startup-models.amg'),
            name: 'AI startup models'
        })
        await harness.page.getByRole('button', {name: 'AI', exact: true}).click()

        const modelSelect = harness.page.locator('select[title="AI Model"]')
        await expect(modelSelect).toBeEnabled()
        await expect(modelSelect.locator('option')).toContainText(['claude-sonnet-4-20250514'])
        await capture(harness, 'ai-startup-models-ready.png', {
            actions: ['Restart with a saved AI provider', 'Create a project', 'Open the AI sidebar'],
            state: 'Saved provider models are ready without opening Settings'
        })
    } finally {
        await stopAmagon(harness)
        await rm(root, {recursive: true, force: true})
    }
})
