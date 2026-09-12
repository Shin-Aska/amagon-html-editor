import {access, copyFile, mkdtemp, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {expect, test} from '@playwright/test'
import {z} from 'zod'
import {capture, launchAmagon, queueNativeDialogs, stopAmagon} from './electronHarness'
import {closeProjectThroughUi, createProjectThroughUi, setLibraryPreviewModeThroughUi, settleEditor} from './projectUi'

test('imported font files load in opaque widget and page previews and Classic releases the frames', async ({}, testInfo) => {
    test.setTimeout(120_000)
    const fontPath = 'C:/Windows/Fonts/arial.ttf'
    await access(fontPath)
    const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-library-fonts-'))
    const importedFileName = 'library-preview-font.ttf'
    const importPath = path.join(root, importedFileName)
    await copyFile(fontPath, importPath)
    const harness = await launchAmagon(root)
    const {page} = harness
    const fontErrors: string[] = []
    const fontRequests: {readonly url: string; readonly origin?: string; readonly allowOrigin?: string; readonly status?: number}[] = []
    page.on('request', request => {
        if (request.url().startsWith('app-media:') && request.url().includes(importedFileName)) {
            fontRequests.push({url: request.url(), origin: request.headers()['origin']})
        }
    })
    page.on('response', response => {
        if (response.url().startsWith('app-media:') && response.url().includes(importedFileName)) {
            fontRequests.push({url: response.url(), status: response.status(), allowOrigin: response.headers()['access-control-allow-origin']})
        }
    })
    page.on('console', message => {
        if (message.type() === 'error' && /font|cors|app-media:/i.test(message.text())) fontErrors.push(message.text())
    })
    try {
        // Given: a real font imported through the project's Theme Editor.
        await createProjectThroughUi({harness, filePath: path.join(root, 'fonts.amg'), name: 'Library Fonts'})
        await queueNativeDialogs(harness.app, {opens: [[importPath]]})
        await page.getByTitle('Theme Editor', {exact: true}).click()
        await page.getByRole('button', {name: 'Typography', exact: true}).click()
        await page.getByRole('button', {name: /Import Font File/}).click()
        await expect(page.getByText(/Imported 1 font file/)).toBeVisible()
        const inventory = z.object({
            success: z.literal(true),
            fonts: z.array(z.object({name: z.string(), fileName: z.string(), relativePath: z.string().min(1)}))
        }).parse(await page.evaluate(() => {
            if (!window.api) throw new Error('Electron bridge missing')
            return window.api.fonts.listProject()
        }))
        const imported = inventory.fonts.find(font => font.fileName === importedFileName)
        expect(imported, 'Arial must be backed by an imported project file').toBeDefined()
        if (!imported) throw new Error('Imported Arial file missing')
        await page.locator('.tfp-field').filter({has: page.getByText('Heading Font', {exact: true})}).locator('.tfp-trigger').click()
        await page.locator('#tfp-dropdown-portal').getByRole('button', {name: imported.name, exact: true}).click()
        await page.locator('.theme-workspace-preview').getByRole('button', {name: 'Light', exact: true}).click()
        await page.getByRole('button', {name: 'Done', exact: true}).click()
        await settleEditor(harness)
        await page.getByPlaceholder('Search widgets...').fill('Heading')

        for (const kind of ['widget', 'page'] as const) {
            if (kind === 'page') await page.getByRole('button', {name: 'Pages', exact: true}).click()
            const frame = page.locator(kind === 'widget'
                ? 'iframe[title="Heading preview"]' : 'iframe[title="Home preview"]')
            const body = frame.contentFrame().locator('body')
            const heading = body.getByRole('heading', {name: kind === 'widget' ? 'Hello world' : 'Welcome to Library Fonts'})
            await expect(heading).toBeVisible()
            await expect(heading).toHaveCSS('font-family', imported.name)
            await expect(frame).toHaveAttribute('sandbox', '')
            await expect.poll(() => body.evaluate((body, family) =>
                [...body.ownerDocument.fonts].some(face => face.family.replace(/^["']|["']$/g, '') === family),
            imported.name)).toBe(true)

            // When: loading the registered file-backed face, not a system-font fallback.
            const state = await body.evaluate(async (body, family) => {
                const doc = body.ownerDocument
                const face = [...doc.fonts].find(candidate => candidate.family.replace(/^["']|["']$/g, '') === family)
                if (!face) throw new Error('Imported font face missing')
                let loadError: string | null = null
                try {
                    await face.load()
                } catch (error) {
                    if (!(error instanceof Error) && !(error instanceof DOMException)) throw error
                    loadError = error.message
                }
                const rules = [...doc.styleSheets].flatMap(sheet => {
                    if (!(sheet.ownerNode instanceof HTMLStyleElement)) return []
                    return [...sheet.cssRules].filter(rule => rule instanceof CSSFontFaceRule)
                        .map(rule => rule.cssText.replace(/data:[^"')\s]+/g, 'data:[redacted]'))
                })
                return {family: face.family, status: face.status, origin: window.origin, loadError, rules}
            }, imported.name)
            await testInfo.attach(`${kind}-font-load.json`, {body: JSON.stringify(state, null, 2), contentType: 'application/json'})

            // Then: each opaque preview successfully decodes the actual imported file.
            expect.soft(state, `${kind} imported font load`).toMatchObject({status: 'loaded', origin: 'null', loadError: null})
            await expect(page.frameLocator('.canvas-iframe').getByRole('heading', {name: 'Welcome to Library Fonts'})).toBeVisible()
            await expect(page.frameLocator('.canvas-iframe').getByRole('heading', {name: 'Welcome to Library Fonts'})).toBeVisible()
            await page.locator('.sidebar-tabs').evaluate(async node => {
                await Promise.all(node.getAnimations({subtree: true}).map(animation => animation.finished))
            })
            await capture(harness, `library-font-${kind}.png`, {actions: ['Import real font', 'Apply heading font', 'Load file-backed font face'], state: 'Imported project font renders in an opaque live preview'})
        }

        // When: disabling Live in the shared preference.
        await setLibraryPreviewModeThroughUi(page, 'classic')
        // Then: both libraries release their preview documents.
        await expect(page.locator('.library-preview-frame')).toHaveCount(0)
        await page.getByRole('button', {name: 'Widgets', exact: true}).click()
        await expect(page.locator('.sidebar')).toHaveClass(/sidebar-classic/)
        await expect(page.locator('.library-preview-frame')).toHaveCount(0)
        expect(harness.pageErrors).toEqual([])
    } finally {
        await testInfo.attach('font-network.json', {body: JSON.stringify(fontRequests, null, 2), contentType: 'application/json'})
        await testInfo.attach('font-console-errors.json', {body: JSON.stringify(fontErrors, null, 2), contentType: 'application/json'})
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
