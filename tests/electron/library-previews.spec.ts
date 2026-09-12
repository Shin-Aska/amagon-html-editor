import {mkdtemp, readFile, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {expect, test, type Page} from '@playwright/test'
import {capture, launchAmagon, queueNativeDialogs, stopAmagon} from './electronHarness'
import {closeProjectThroughUi, createProjectThroughUi, setLibraryPreviewModeThroughUi, settleEditor} from './projectUi'

async function waitForThumbnails(page: Page): Promise<void> {
    await page.locator('.sidebar-tabs').evaluate(async node => {
        await Promise.all(node.getAnimations({subtree: true}).map(animation => animation.finished))
    })
    for (const frame of await page.locator('.sidebar .library-preview-frame').all()) {
        await expect(frame.contentFrame().locator('body > :not(style)').first()).toBeAttached()
        await expect.poll(() => frame.contentFrame().locator('body').evaluate(body => body.ownerDocument.readyState)).toBe('complete')
    }
}

test('live libraries update real content and Classic releases previews across tabs and restarts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-library-'))
    let harness = await launchAmagon(root)
    const page = harness.page
    try {
        // Given: a real saved project in the desktop editor.
        await harness.app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.setSize(1586, 1030))
        await createProjectThroughUi({harness, filePath: path.join(root, 'library.amg'), name: 'Test Site'})
        await page.getByTitle('Theme Editor', {exact: true}).click()
        await page.locator('.theme-workspace-preview').getByRole('button', {name: 'Dark', exact: true}).click()
        await page.getByRole('button', {name: 'Done', exact: true}).click()
        await settleEditor(harness)
        await expect(page.frameLocator('.canvas-iframe').getByRole('heading', {name: 'Welcome to Test Site'})).toBeVisible()
        const previews = page.locator('.sidebar .library-preview-frame')
        await page.getByTitle('Global Settings', {exact: true}).click()
        const settings = page.locator('.settings-dialog')
        const mode = settings.getByLabel('Preview mode', {exact: true})
        await expect(mode).toHaveValue('live')
        await settings.evaluate(async node => { await Promise.all(node.getAnimations({subtree: true}).map(animation => animation.finished)) })
        await capture(harness, 'library-settings-live.png', {actions: ['Open App Settings'], state: 'General contains the shared Preview mode preference'})
        await mode.focus()
        await expect(mode).toBeFocused()
        await page.keyboard.press('ArrowDown')
        await expect(mode).toHaveValue('classic')
        await expect(previews).toHaveCount(0)
        await capture(harness, 'library-settings-classic.png', {actions: ['Choose Classic with keyboard'], state: 'Classic applies immediately while App Settings is open'})
        await expect(page.locator('.library-preview-cache, .library-preview-frame')).toHaveCount(0)
        await page.keyboard.press('ArrowUp')
        await expect(mode).toHaveValue('live')
        await settings.getByRole('button', {name: 'Done', exact: true}).click()
        await expect(page.locator('.sidebar').getByText('Preview mode', {exact: true})).toHaveCount(0)
        await expect(previews.first()).toBeAttached()
        await expect.poll(() => previews.count()).toBeGreaterThan(3)
        const widgetCount = await page.locator('.widget-item').count()
        expect(await previews.count()).toBeLessThan(widgetCount)
        await expect(page.frameLocator('iframe[title="Heading preview"]').getByRole('heading', {name: 'Hello world'})).toBeVisible()
        await waitForThumbnails(page)
        await capture(harness, 'library-widgets-live.png', {actions: ['Create project'], state: 'Live widget samples and captions, with only visible frames mounted'})

        for (const label of ['Container', 'Row', 'Column', 'Spacer', 'Section', 'Heading', 'Paragraph', 'Blockquote', 'List', 'Code Block']) {
            const frame = page.frameLocator(`iframe[title="${label} preview"]`)
            await expect(frame.locator('body')).toBeVisible()
            expect(await frame.locator('body').evaluate(node => node.scrollHeight <= window.innerHeight), label).toBe(true)
        }
        await page.getByRole('button', {name: 'Layers', exact: true}).click()
        await expect(previews).toHaveCount(0)
        await expect(page.locator('.sidebar').getByRole('combobox', {name: 'Preview mode'})).toHaveCount(0)
        await page.getByRole('button', {name: 'Widgets', exact: true}).click()
        await expect(page.locator('.sidebar')).toHaveClass(/sidebar-live/)

        // When: switching the shared preference to Classic.
        await setLibraryPreviewModeThroughUi(page, 'classic')
        // Then: all preview frames are released; legacy icons and page rows remain.
        await expect(previews).toHaveCount(0)
        await expect(page.locator('.widget-icon').first()).toBeVisible()
        await waitForThumbnails(page)
        await capture(harness, 'library-widgets-classic.png', {actions: ['Choose Classic'], state: 'Original compact widget icon grid'})
        await page.getByRole('button', {name: 'Pages', exact: true}).click()
        await expect(page.locator('.sidebar')).toHaveClass(/sidebar-classic/)
        await expect(previews).toHaveCount(0)
        await waitForThumbnails(page)
        await capture(harness, 'library-pages-classic.png', {actions: ['Open Pages in Classic'], state: 'Original compact page list'})

        // When: enabling Live and editing the current canvas heading.
        await setLibraryPreviewModeThroughUi(page, 'live')
        const homePreview = page.frameLocator('.sidebar .library-preview-frame').first()
        await expect(homePreview.getByRole('heading', {name: 'Welcome to Test Site'})).toBeVisible()
        await page.frameLocator('.canvas-iframe').getByRole('heading', {name: 'Welcome to Test Site'}).click()
        await page.locator('.inspector input.inspector-input').first().fill('Updated live without saving')
        // Then: the page thumbnail reflects the unsaved editor state.
        await expect(homePreview.getByRole('heading', {name: 'Updated live without saving'})).toBeVisible()
        await waitForThumbnails(page)
        await capture(harness, 'library-pages-live.png', {actions: ['Enable Live', 'Edit heading in Inspector'], state: 'Current-page thumbnail updates before saving'})
        await page.getByRole('button', {name: 'Page options for Home'}).click()
        await expect(page.locator('.context-menu')).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(page.locator('.context-menu')).toHaveCount(0)
        await expect(page.getByRole('button', {name: 'Page options for Home'})).toBeFocused()
        await page.keyboard.press('Enter')
        await page.keyboard.press('ArrowDown')
        await expect(page.getByRole('menuitem', {name: 'Page Properties'})).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.locator('.page-modal')).toBeVisible()
        await page.locator('.page-modal').getByRole('button', {name: 'Cancel', exact: true}).click()

        // When: adding another page and returning to Home.
        await page.getByRole('button', {name: 'Add New Page', exact: true}).click()
        await page.locator('.page-modal input').first().fill('About')
        await page.locator('.page-modal').getByRole('button', {name: /Create/}).click()
        await page.getByRole('button', {name: 'Open Home', exact: true}).click()
        await expect(page.frameLocator('.canvas-iframe').getByRole('heading', {name: 'Updated live without saving'})).toBeVisible()

        // When: dragging a page card to another position and into a folder.
        const aboutCard = page.locator('.page-item').filter({has: page.getByRole('button', {name: 'Open About', exact: true})})
        const homeCard = page.locator('.page-item').filter({has: page.getByRole('button', {name: 'Open Home', exact: true})})
        await aboutCard.dragTo(homeCard, {targetPosition: {x: 20, y: 10}})
        await expect(page.locator('.page-item').first()).toContainText('About')
        await page.getByRole('button', {name: 'New Folder', exact: true}).click()
        await page.locator('.page-modal input').first().fill('Information')
        await page.locator('.page-modal').getByRole('button', {name: /Create/}).click()
        await aboutCard.dragTo(page.locator('.folder-header').filter({hasText: 'Information'}))
        await expect(page.locator('.folder-children .page-item')).toContainText('About')
        await page.locator('.folder-header').filter({hasText: 'Information'}).click()
        await expect(page.locator('.folder-children .library-preview-frame')).toHaveCount(0)

        // When: searching the library.
        await page.getByRole('button', {name: 'Widgets', exact: true}).click()
        await page.getByPlaceholder('Search widgets...').fill('Heading')
        // Then: only the matching tile is rendered and has real heading content.
        await expect(page.locator('.widget-item')).toHaveCount(1)
        await expect(page.frameLocator('.sidebar .library-preview-frame').getByRole('heading', {name: 'Hello world'})).toBeVisible()
        // The preview remains a draggable widget and inserts its real default content.
        const headingCount = await page.frameLocator('.canvas-iframe').locator('h1, h2, h3, h4, h5, h6').count()
        await page.locator('.widget-item').dragTo(page.locator('.canvas-iframe'), {targetPosition: {x: 60, y: 160}})
        await expect(page.frameLocator('.canvas-iframe').locator('h1, h2, h3, h4, h5, h6')).toHaveCount(headingCount + 1)
        await page.getByPlaceholder('Search widgets...').fill('')

        for (const size of [{width: 1000, height: 800}, {width: 1280, height: 900}]) {
            await harness.app.evaluate(({BrowserWindow}, bounds) => BrowserWindow.getAllWindows()[0]?.setSize(bounds.width, bounds.height), size)
            await settleEditor(harness)
            await expect(page.frameLocator('.canvas-iframe').locator('h1, h2, h3').first()).toBeVisible()
            await waitForThumbnails(page)
            await capture(harness, `library-widgets-${size.width}.png`, {actions: ['Resize editor'], state: 'Live widgets at compact desktop width'})
            await page.getByRole('button', {name: 'Pages', exact: true}).click()
            await waitForThumbnails(page)
            await capture(harness, `library-pages-${size.width}.png`, {actions: ['Open Pages'], state: 'Page thumbnails and pinned actions at compact desktop width'})
            expect(await page.locator('.sidebar').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
            await page.getByRole('button', {name: 'Widgets', exact: true}).click()
            if (size.width === 1000) {
                await page.getByTitle('Global Settings', {exact: true}).click()
                await expect(mode).toHaveValue('live')
                const content = settings.locator('.settings-workspace-content')
                expect(await content.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
                await settings.evaluate(async node => { await Promise.all(node.getAnimations({subtree: true}).map(animation => animation.finished)) })
                await capture(harness, 'library-settings-1000-dark.png', {actions: ['Open App Settings at compact width'], state: 'Preview mode aligns with existing General settings'})
                await content.evaluate(node => { node.scrollTop = node.scrollHeight })
                await capture(harness, 'library-settings-1000-bottom.png', {actions: ['Scroll General settings to bottom'], state: 'Remaining preferences and Done remain accessible'})
                await content.evaluate(node => { node.scrollTop = 0 })
                await settings.getByRole('button', {name: 'Light', exact: true}).click()
                await capture(harness, 'library-settings-1000-light.png', {actions: ['Choose Light app appearance'], state: 'Preview mode uses the shared light theme styles'})
                await settings.getByRole('button', {name: 'Dark', exact: true}).click()
                await settings.getByRole('button', {name: 'Done', exact: true}).click()
            }
        }

        // When: saving the device preference and restarting the application.
        await setLibraryPreviewModeThroughUi(page, 'classic')
        await expect.poll(async () => JSON.parse(await readFile(path.join(harness.profilePath, 'app-settings.json'), 'utf8')).libraryPreviewMode).toBe('classic')
        await closeProjectThroughUi(harness)
        expect(harness.pageErrors).toEqual([])
        await harness.app.close()
        await stopAmagon(harness, false)
        harness = await launchAmagon(root)
        // Then: a fresh application process restores Classic when reopening the project.
        await harness.page.getByRole('button', {name: /Test Site.*library.amg/}).click()
        await settleEditor(harness)
        await expect(harness.page.locator('.sidebar')).toHaveClass(/sidebar-classic/)
        await harness.page.getByTitle('Global Settings', {exact: true}).click()
        await expect(harness.page.locator('.settings-dialog').getByLabel('Preview mode', {exact: true})).toHaveValue('classic')
        await harness.page.locator('.settings-dialog').getByRole('button', {name: 'Done', exact: true}).click()
        await expect(harness.page.locator('.library-preview-frame')).toHaveCount(0)
        expect(harness.pageErrors).toEqual([])
        await closeProjectThroughUi(harness)
        await harness.app.close()
    } finally {
        await stopAmagon(harness)
        const resolved = path.resolve(root)
        if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Unexpected test cleanup path')
        await rm(resolved, {recursive: true, force: true})
    }
})

for (const framework of ['tailwind', 'vanilla'] as const) {
    test(`${framework} previews render with project theme changes and remain passive`, async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-library-framework-'))
        const harness = await launchAmagon(root)
        const page = harness.page
        try {
            // Given: a real project using another supported renderer.
            await queueNativeDialogs(harness.app, {saves: [path.join(root, 'framework.amg')]})
            await page.getByRole('button', {name: /New Project/}).click()
            await page.getByLabel('Project Name').fill('Framework Preview')
            await page.locator(`input[name="framework"][value="${framework}"]`).check()
            await page.getByRole('button', {name: 'Create Project'}).click()
            await settleEditor(harness)
            await page.getByPlaceholder('Search widgets...').fill('Button')
            const preview = page.frameLocator('iframe[title="Button preview"]')
            await expect(preview.locator('button')).toBeVisible()
            if (framework === 'tailwind') {
                await expect(preview.locator('button')).toHaveCSS('display', 'inline-flex')
                await expect(preview.locator('button')).toHaveCSS('padding', '8px 16px')
            }
            await expect.poll(() => preview.locator('button').evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')

            // When: changing the project preview theme.
            await page.getByTitle('Theme Editor', {exact: true}).click()
            await page.locator('.theme-workspace-preview').getByRole('button', {name: 'Dark', exact: true}).click()
            await page.getByRole('button', {name: 'Done', exact: true}).click()
            await settleEditor(harness)
            await expect(page.frameLocator('.canvas-iframe').getByRole('heading', {name: 'Welcome to Framework Preview'})).toBeVisible()
            // Then: the widget follows that theme.
            await expect(preview.locator('html')).toHaveAttribute('data-page-theme', 'dark')
            await waitForThumbnails(page)
            await capture(harness, `library-${framework}-dark-widget.png`, {actions: ['Create project', 'Search Button', 'Set page preview to Dark'], state: 'Bundled framework and project theme applied to passive widget'})

            await page.getByRole('button', {name: 'Pages', exact: true}).click()
            const home = page.frameLocator('.sidebar .library-preview-frame')
            await expect(home.getByRole('heading', {name: 'Welcome to Framework Preview'})).toBeVisible()
            await expect(home.locator('html')).toHaveAttribute('data-page-theme', 'dark')
            await waitForThumbnails(page)
            await capture(harness, `library-${framework}-dark-page.png`, {actions: ['Open Pages'], state: 'Live page uses selected framework and dark project theme'})
            await expect(page.locator('.sidebar .library-preview-frame')).not.toHaveAttribute('sandbox', /allow-same-origin/)
            expect(harness.pageErrors).toEqual([])
            await closeProjectThroughUi(harness)
            await harness.app.close()
        } finally {
            await stopAmagon(harness)
            const resolved = path.resolve(root)
            if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Unexpected test cleanup path')
            await rm(resolved, {recursive: true, force: true})
        }
    })
}
