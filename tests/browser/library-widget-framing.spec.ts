import {expect, test, type Locator, type Page} from '@playwright/test'
import {setLibraryPreviewModeThroughUi} from '../electron/projectUi'

async function preview(page: Page, label: string): Promise<Locator> {
    await page.getByPlaceholder('Search widgets...').fill(label)
    const tile = page.locator('.widget-item').filter({has: page.locator(`span:text-is("${label}")`)})
    await tile.scrollIntoViewIfNeeded()
    const frame = tile.locator('iframe')
    await expect.poll(() => frame.contentFrame().locator('html').evaluate(html => html.ownerDocument.readyState)).toBe('complete')
    await expect(frame.contentFrame().locator('[data-library-widget]')).toHaveAttribute('style', /scale\(/)
    return frame
}

async function expectContentToFit(frame: Locator): Promise<void> {
    await expect.poll(() => frame.contentFrame().locator('[data-library-widget]').evaluate(root => {
        const boxes = [...root.children].filter(child => {
            const style = getComputedStyle(child)
            return style.display !== 'none' && style.visibility !== 'hidden'
        }).map(child => child.getBoundingClientRect()).filter(box => box.width > 0 && box.height > 0)
        return boxes.length > 0 && boxes.every(box => box.left >= -1 && box.top >= -1
            && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1)
    })).toBe(true)
}

for (const framework of ['bootstrap-5', 'tailwind', 'vanilla'] as const) {
test(`${framework}: saved controls are legible and centered, and tall widgets fit without clipping`, async ({page}, testInfo) => {
    const pageErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    // Given: a button added and saved through the actual editor workflow.
    await page.setViewportSize({width: 1440, height: 1000})
    await page.goto('/')
    await page.getByRole('button', {name: /New Project/}).click()
    await page.getByLabel('Project Name').fill('Widget Previews')
    await page.locator(`input[name="framework"][value="${framework}"]`).check()
    await page.getByRole('button', {name: 'Create Project', exact: true}).click()
    await expect(page.locator('#html-editor-layout')).toBeVisible()
    const skip = page.getByRole('button', {name: 'Skip for now'})
    if (await skip.isVisible()) await skip.click()
    await page.getByPlaceholder('Search widgets...').fill('Button')
    await page.locator('.widget-item[aria-label="Button"]').dragTo(page.locator('.canvas-iframe'), {targetPosition: {x: 80, y: 200}})
    await page.getByRole('button', {name: 'Save as Custom Block', exact: true}).click()
    await page.locator('.scb-input').first().fill('Saved Button')
    await page.locator('.scb-modal').getByRole('button', {name: 'Save', exact: true}).click()

    // When: browsing the saved control at normal and compact desktop sizes.
    for (const width of [1440, 1000]) {
        await page.setViewportSize({width, height: 1000})
        const frame = await preview(page, 'Saved Button')
        await expectContentToFit(frame)
        // Then: the control occupies a useful portion of the tile, centered on both axes.
        const geometry = await frame.contentFrame().getByRole('button', {name: 'Button', exact: true}).evaluate(button => {
            const box = button.getBoundingClientRect()
            return {heightRatio: box.height / innerHeight,
                centerX: Math.abs(box.x + box.width / 2 - innerWidth / 2),
                centerY: Math.abs(box.y + box.height / 2 - innerHeight / 2)}
        })
        expect(geometry.heightRatio).toBeGreaterThan(0.15)
        expect(geometry.centerX).toBeLessThan(1)
        expect(geometry.centerY).toBeLessThan(1)
        await page.screenshot({path: testInfo.outputPath(`saved-button-${width}.png`)})
    }

    // When: rendering controls, taller panels, desktop sections, and fixed-position content.
    for (const label of ['Paragraph', 'Form', 'Card', 'Feature Card', 'Tabs', 'Pagination', 'Navbar', 'Team Grid', 'Centered Hero', 'Back to Top', 'Cookie Banner']) {
        const frame = await preview(page, label)
        // Then: the whole sample stays inside its preview, with scripts isolated from the editor.
        await expectContentToFit(frame)
        await expect(frame).toHaveAttribute('sandbox', 'allow-scripts')
        if (label === 'Pagination') {
            const right = await frame.contentFrame().getByText('Next', {exact: true}).evaluate(next => ({right: next.getBoundingClientRect().right, viewport: innerWidth}))
            expect(right.right).toBeLessThanOrEqual(right.viewport)
        }
        await page.locator('.sidebar').screenshot({path: testInfo.outputPath(`widget-${label.replaceAll(' ', '-').toLowerCase()}.png`)})
    }

    const offcanvas = await preview(page, 'Offcanvas')
    const trigger = offcanvas.contentFrame().getByRole('button', {name: 'Toggle panel'})
    const triggerCenter = await trigger.evaluate(button => {
        const box = button.getBoundingClientRect()
        return Math.abs(box.x + box.width / 2 - innerWidth / 2)
    })
    if (framework !== 'vanilla') expect(triggerCenter).toBeLessThan(1)
    else await expectContentToFit(offcanvas)
    await page.locator('.sidebar').screenshot({path: testInfo.outputPath('widget-offcanvas.png')})

    // When: revisiting a cached preview and resizing the panel.
    const frame = await preview(page, 'Saved Button')
    await frame.contentFrame().locator('html').evaluate(html => {html.dataset.framingProbe = 'retained'})
    await page.getByRole('button', {name: 'Layers', exact: true}).click()
    await page.getByRole('button', {name: 'Widgets', exact: true}).click()
    // Then: the cached document and its fitted geometry remain intact.
    await expect(frame.contentFrame().locator('html')).toHaveAttribute('data-framing-probe', 'retained')
    const handle = page.locator('.panel-resize-handle').first()
    const box = await handle.boundingBox()
    if (!box) throw new Error('Sidebar resize handle is missing')
    await page.mouse.move(box.x + box.width / 2, box.y + 100)
    await page.mouse.down()
    await page.mouse.move(box.x + 120, box.y + 100, {steps: 8})
    await page.mouse.up()
    await expectContentToFit(frame)
    await page.screenshot({path: testInfo.outputPath('saved-button-resized.png')})

    // When: saving authored HTML with a small control inside an unpainted wrapper.
    await page.getByPlaceholder('Search widgets...').fill('Raw HTML')
    await page.locator('.widget-item[aria-label="Raw HTML"]').dragTo(page.locator('.canvas-iframe'), {targetPosition: {x: 80, y: 200}})
    await page.locator('.inspector textarea').first().fill('<style>.saved-button{background:orange;color:black;border:0;padding:12px 24px;font:16px sans-serif}</style><button class="saved-button">Save changes</button>')
    await page.getByRole('button', {name: 'Save as Custom Block', exact: true}).click()
    await page.locator('.scb-input').first().fill('Saved HTML')
    await page.locator('.scb-modal').getByRole('button', {name: 'Save', exact: true}).click()
    // Then: framing trims the wrapper's empty width and keeps the authored styling.
    const rawFrame = await preview(page, 'Saved HTML')
    const rawButton = rawFrame.contentFrame().getByRole('button', {name: 'Save changes', exact: true})
    await expect(rawButton).toHaveCSS('background-color', 'rgb(255, 165, 0)')
    const rawGeometry = await rawButton.evaluate(button => {
        const box = button.getBoundingClientRect()
        return {widthRatio: box.width / innerWidth, center: Math.abs(box.x + box.width / 2 - innerWidth / 2)}
    })
    expect(rawGeometry.widthRatio).toBeGreaterThan(0.4)
    expect(rawGeometry.center).toBeLessThan(1)
    await page.screenshot({path: testInfo.outputPath('saved-html.png')})

    if (framework !== 'vanilla') {
        const social = await preview(page, 'Social Links')
        const icons = await social.contentFrame().locator('html').evaluate(async html => {
            const fonts = await html.ownerDocument.fonts.load('20px bootstrap-icons')
            return fonts.length > 0 && fonts.every(font => font.status === 'loaded')
        })
        expect(icons).toBe(true)
        await page.locator('.sidebar').screenshot({path: testInfo.outputPath('social-icons.png')})
    }
    await page.getByRole('button', {name: 'Pages', exact: true}).click()
    const home = page.locator('.sidebar iframe[title="Home preview"]')
    await expect(home).toHaveAttribute('sandbox', framework === 'tailwind' ? 'allow-scripts' : '')
    await expect(home.contentFrame().getByRole('heading', {name: 'Welcome to Widget Previews'})).toBeVisible()
    await setLibraryPreviewModeThroughUi(page, 'classic')
    await expect(page.locator('.library-preview-frame')).toHaveCount(0)
    expect(pageErrors).toEqual([])
})
}
