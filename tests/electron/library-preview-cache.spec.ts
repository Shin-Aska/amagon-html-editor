import {mkdtemp, readFile, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {expect, test, type Locator, type Page} from '@playwright/test'
import {z} from 'zod'
import {capture, launchAmagon, stopAmagon} from './electronHarness'
import {closeProjectThroughUi, createProjectThroughUi, openProjectThroughUi, setLibraryPreviewModeThroughUi, settleEditor} from './projectUi'

async function setSlots(page: Page, slots: number): Promise<void> {
    await page.getByTitle('Global Settings', {exact: true}).click()
    const settings = page.locator('.settings-dialog')
    const input = settings.getByLabel('Preview cache slots', {exact: true})
    await input.fill(String(slots))
    await input.press('Enter')
    await expect(input).toHaveValue(String(slots))
    await settings.getByRole('button', {name: 'Done', exact: true}).click()
}

async function widget(page: Page, name: string): Promise<Locator> {
    await page.getByPlaceholder('Search widgets...').fill(name)
    await expect(page.locator('.widget-item')).toHaveCount(1)
    const frame = page.locator(`.sidebar iframe[title="${name} preview"]`)
    await expect(frame.contentFrame().locator('body > :not(style)').first()).toBeAttached()
    await expect.poll(() => frame.contentFrame().locator('html').evaluate(node => node.ownerDocument.readyState)).toBe('complete')
    return frame
}

async function markDocument(frame: Locator, marker: string): Promise<number> {
    return frame.contentFrame().locator('html').evaluate((html, value) => {
        html.dataset.cacheProbe = value
        return performance.timeOrigin
    }, marker)
}

test('rendered previews survive cache hits, evict least recently used entries, and persist the slot preference', async ({}, testInfo) => {
    test.setTimeout(150_000)
    const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-preview-cache-'))
    const filePath = path.join(root, 'cache.amg')
    let harness = await launchAmagon(root)
    try {
        const {page} = harness
        await harness.app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.setSize(1586, 1030))
        await createProjectThroughUi({harness, filePath, name: 'Preview Cache'})
        expect(await page.evaluate(() => typeof Element.prototype.moveBefore)).toBe('function')
        await page.getByTitle('Global Settings', {exact: true}).click()
        const settings = page.locator('.settings-dialog')
        await expect(settings.getByLabel('Preview cache slots', {exact: true})).toHaveValue('64')
        await settings.evaluate(async node => { await Promise.all(node.getAnimations({subtree: true}).map(animation => animation.finished)) })
        await capture(harness, 'library-cache-settings-default.png', {actions: ['Open App Settings'], state: 'Preview cache slots defaults to 64 beside the existing Preview mode setting'})
        await settings.getByRole('button', {name: 'Done', exact: true}).click()
        await setSlots(page, 2)
        await expect.poll(async () => z.object({libraryPreviewCacheSlots: z.number()}).parse(JSON.parse(
            await readFile(path.join(harness.profilePath, 'app-settings.json'), 'utf8'))).libraryPreviewCacheSlots).toBe(2)
        await setLibraryPreviewModeThroughUi(page, 'classic')
        await page.getByPlaceholder('Search widgets...').fill('Heading')
        await setLibraryPreviewModeThroughUi(page, 'live')
        const heading = await widget(page, 'Heading')
        const firstTimeOrigin = await markDocument(heading, 'heading-warm')
        await page.getByRole('button', {name: 'Pages', exact: true}).click()
        await expect(page.locator('.sidebar iframe[title="Home preview"]').contentFrame().getByRole('heading', {name: 'Welcome to Preview Cache'})).toBeVisible()
        await page.getByRole('button', {name: 'Widgets', exact: true}).click()
        await expect(heading.contentFrame().locator('html')).toHaveAttribute('data-cache-probe', 'heading-warm')
        await expect(heading.contentFrame().getByRole('heading', {name: 'Hello world'})).toBeVisible()
        const cachedTimeOrigin = await heading.contentFrame().locator('html').evaluate(() => performance.timeOrigin)
        expect(cachedTimeOrigin).toBe(firstTimeOrigin)
        await testInfo.attach('preserved-document.json', {body: JSON.stringify({firstTimeOrigin, cachedTimeOrigin}), contentType: 'application/json'})

        const paragraph = await widget(page, 'Paragraph')
        await markDocument(paragraph, 'paragraph-old')
        await widget(page, 'Heading')
        await widget(page, 'Blockquote')
        await expect(page.locator('iframe[title="Paragraph preview"]')).toHaveCount(0)
        await expect(page.locator('.library-preview-cache iframe[title="Heading preview"]')).toHaveCount(1)
        await widget(page, 'Heading')
        await expect(heading.contentFrame().locator('html')).toHaveAttribute('data-cache-probe', 'heading-warm')
        await widget(page, 'Paragraph')
        await expect(paragraph.contentFrame().locator('html')).not.toHaveAttribute('data-cache-probe')
        await setSlots(page, 1)
        await expect(page.locator('.library-preview-frame')).toHaveCount(1)
        await markDocument(paragraph, 'uncached')
        await setSlots(page, 0)
        await page.getByRole('button', {name: 'Pages', exact: true}).click()
        await page.getByRole('button', {name: 'Widgets', exact: true}).click()
        await widget(page, 'Paragraph')
        await expect(paragraph.contentFrame().locator('html')).not.toHaveAttribute('data-cache-probe')
        await expect(page.locator('.library-preview-cache iframe')).toHaveCount(0)
        await setSlots(page, 2)
        await setLibraryPreviewModeThroughUi(page, 'classic')
        await expect(page.locator('.library-preview-cache, .library-preview-frame')).toHaveCount(0)
        expect(harness.pageErrors).toEqual([])
        await closeProjectThroughUi(harness)
        await harness.app.close()
        await stopAmagon(harness, false)
        harness = await launchAmagon(root)
        await openProjectThroughUi({harness, filePath})
        await expect(harness.page.locator('.sidebar')).toHaveClass(/sidebar-classic/)
        await expect(harness.page.locator('.library-preview-cache, .library-preview-frame')).toHaveCount(0)
        await harness.page.getByTitle('Global Settings', {exact: true}).click()
        await expect(harness.page.getByLabel('Preview cache slots', {exact: true})).toHaveValue('2')
        await harness.page.getByRole('button', {name: 'Done', exact: true}).click()
        expect(harness.pageErrors).toEqual([])
    } finally {
        try {
            if (await harness.page.locator('#html-editor-layout').isVisible()) await closeProjectThroughUi(harness)
            await harness.app.close()
        } finally {
            await stopAmagon(harness)
            const resolved = path.resolve(root)
            if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Unexpected test cleanup path')
            await rm(resolved, {recursive: true, force: true})
        }
    }
})

test('parked previews refresh after content and theme edits and clear on project close', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-preview-refresh-'))
    const harness = await launchAmagon(root)
    const {page} = harness
    try {
        await createProjectThroughUi({harness, filePath: path.join(root, 'refresh.amg'), name: 'Cache Refresh'})
        await widget(page, 'Heading')
        await page.getByRole('button', {name: 'Pages', exact: true}).click()
        const home = page.locator('.sidebar iframe[title="Home preview"]')
        await expect(home.contentFrame().getByRole('heading', {name: 'Welcome to Cache Refresh'})).toBeVisible()
        await markDocument(home, 'before-edit')
        await page.getByRole('button', {name: 'Widgets', exact: true}).click()
        await page.frameLocator('.canvas-iframe').getByRole('heading', {name: 'Welcome to Cache Refresh'}).click()
        await page.locator('.inspector input.inspector-input').first().fill('Cached page updated')
        const parkedHome = page.locator('.library-preview-cache iframe[title="Home preview"]')
        await expect(parkedHome.contentFrame().locator('html')).toHaveAttribute('data-cache-probe', 'before-edit')
        await page.getByRole('button', {name: 'Pages', exact: true}).click()
        await expect(home.contentFrame().getByRole('heading', {name: 'Cached page updated'})).toBeVisible()
        await expect(home.contentFrame().locator('html')).not.toHaveAttribute('data-cache-probe')
        await markDocument(home, 'before-theme')
        await page.getByRole('button', {name: 'Widgets', exact: true}).click()
        await page.getByTitle('Theme Editor', {exact: true}).click()
        await page.locator('.theme-workspace-preview').getByRole('button', {name: 'Dark', exact: true}).click()
        await page.getByRole('button', {name: 'Done', exact: true}).click()
        await settleEditor(harness)
        await page.getByRole('button', {name: 'Pages', exact: true}).click()
        await expect(home.contentFrame().locator('html')).toHaveAttribute('data-page-theme', 'dark')
        await expect(home.contentFrame().getByRole('heading', {name: 'Cached page updated'})).toBeVisible()
        await expect(home.contentFrame().locator('html')).not.toHaveAttribute('data-cache-probe')
        await page.locator('.sidebar-tabs').evaluate(async node => { await Promise.all(node.getAnimations({subtree: true}).map(animation => animation.finished)) })
        await capture(harness, 'library-cache-refreshed-page.png', {actions: ['Cache Home', 'Edit heading while parked', 'Change page theme', 'Revisit Home'], state: 'Cached page refreshes to current content and theme'})
        await closeProjectThroughUi(harness)
        await expect(page.locator('.library-preview-cache, .library-preview-frame')).toHaveCount(0)
        expect(harness.pageErrors).toEqual([])
    } finally {
        try {
            if (await page.locator('#html-editor-layout').isVisible()) await closeProjectThroughUi(harness)
            await harness.app.close()
        } finally {
            await stopAmagon(harness)
            const resolved = path.resolve(root)
            if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Unexpected test cleanup path')
            await rm(resolved, {recursive: true, force: true})
        }
    }
})
