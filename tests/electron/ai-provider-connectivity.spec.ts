import {mkdtemp, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {expect, test} from '@playwright/test'
import {launchPortableEditor, stopPortableEditor} from './portableEditorHarness'

test('OpenAI credentials load modern models and surface recoverable API errors in Settings', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-ai-models-'))
    const harness = await launchPortableEditor(root)
    try {
        await harness.app.evaluate(({net}) => {
            const fetch = net.fetch.bind(net)
            Reflect.set(globalThis, 'amagonOpenAiTestMode', 'ok')
            Reflect.set(net, 'fetch', async (...args: Parameters<typeof net.fetch>) => {
                if (String(args[0]) !== 'https://api.openai.com/v1/models') return fetch(...args)
                if (Reflect.get(globalThis, 'amagonOpenAiTestMode') === 'unauthorized') {
                    return new Response(JSON.stringify({error: {message: 'Incorrect API key: sk-model-list-test'}}), {status: 401})
                }
                return new Response(JSON.stringify({data: [
                    {id: 'gpt-6-sol'}, {id: 'gpt-5.4-mini'}, {id: 'gpt-4o-realtime-preview'},
                ]}))
            })
        })
        const {page} = harness
        await page.evaluate(() => window.api.ai.setConfig({provider: 'openai', model: 'retired-test-model'}))
        await page.getByRole('button', {name: /Settings/u}).click()
        const settings = page.locator('.settings-dialog')
        await settings.getByRole('button', {name: 'Credentials', exact: true}).click()
        await settings.getByRole('button', {name: 'Add Credential', exact: true}).click()
        await page.getByPlaceholder('Enter API key', {exact: true}).fill('sk-model-list-test')
        await page.getByRole('button', {name: 'Save Credential', exact: true}).click()
        await expect(page.getByRole('button', {name: 'Save Credential', exact: true})).toHaveCount(0)
        await settings.getByRole('button', {name: 'AI Assistant', exact: true}).click()
        const model = settings.getByLabel('Model', {exact: true})
        await expect(model.locator('option')).toHaveText(['gpt-6-sol', 'gpt-5.4-mini'])
        await expect(model).toHaveValue('gpt-5.4-mini')

        await harness.app.evaluate(() => {Reflect.set(globalThis, 'amagonOpenAiTestMode', 'unauthorized')})
        await settings.getByRole('button', {name: 'Refresh Models List', exact: true}).click()
        await expect(settings.getByText('OpenAI API error (401): Incorrect API key: [redacted]', {exact: true})).toBeVisible()
        await expect(settings).not.toContainText('sk-model-list-test')

        await harness.app.evaluate(() => {Reflect.set(globalThis, 'amagonOpenAiTestMode', 'ok')})
        await settings.getByRole('button', {name: 'Refresh Models List', exact: true}).click()
        await expect(settings.getByText('Loaded 2 models from openai.', {exact: true})).toBeVisible()
        await expect(model.locator('option')).toHaveText(['gpt-6-sol', 'gpt-5.4-mini'])
        expect(harness.pageErrors).toEqual([])
    } finally {
        await stopPortableEditor(harness)
        await rm(root, {recursive: true, force: true})
    }
})
