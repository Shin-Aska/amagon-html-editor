import {mkdtemp, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {expect, test} from '@playwright/test'
import {MENU_ACTION_CHANNEL, type MenuAction} from '../../src/shared/menuContract'
import {capture, launchAmagon, stopAmagon} from './electronHarness'

const releaseChannel = 'amagon-e2e:release-ai-models'
const requestSeenKey = '__amagonE2eAiModelsRequested'

function contrastRatio(foreground: string, background: string): number {
    const luminance = (color: string): number => {
        const channels = color.match(/\d+(?:\.\d+)?/gu)?.map(Number)
        if (channels?.length !== 3) throw new TypeError(`Expected an opaque RGB color, got ${color}`)
        const [red, green, blue] = channels.map((channel) => {
            const linear = channel / 255
            return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4
        })
        if (red === undefined || green === undefined || blue === undefined) throw new TypeError(`Incomplete RGB color: ${color}`)
        return red * 0.2126 + green * 0.7152 + blue * 0.0722
    }
    const first = luminance(foreground)
    const second = luminance(background)
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

test('welcome blocks project creation while the AI engine initializes', async () => {
    // Given an isolated Electron profile whose AI model request cannot finish yet.
    const root = await mkdtemp(path.join(os.tmpdir(), 'amagon-welcome-ai-initialization-'))
    const harness = await launchAmagon(root)
    let released = false
    const resize = async (width: number): Promise<void> => {
        await harness.app.evaluate(({BrowserWindow}, request) => {
            const window = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.getURL() === request.url)
            if (window === undefined) throw new TypeError('Missing welcome initialization test window')
            window.setMinimumSize(300, 400)
            window.setContentSize(request.width, 760)
        }, {url: harness.page.url(), width})
        await expect.poll(() => harness.page.evaluate(() => window.innerWidth)).toBe(width)
    }
    const sendMenuAction = async (action: MenuAction): Promise<void> => {
        await harness.page.evaluate((expected) => {
            const menu = window.api?.menu
            if (menu === undefined) throw new TypeError('Electron menu API is unavailable')
            const unsubscribe = menu.onAction((received) => {
                if (received !== expected) return
                Reflect.set(globalThis, '__amagonE2eMenuActionSeen', received)
                unsubscribe()
            })
        }, action)
        await harness.app.evaluate(({BrowserWindow}, request) => {
            const window = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.getURL() === request.url)
            if (window === undefined) throw new TypeError('Missing welcome initialization test window')
            window.webContents.send(request.channel, request.action)
        }, {url: harness.page.url(), channel: MENU_ACTION_CHANNEL, action})
        await expect.poll(() => harness.page.evaluate(() => Reflect.get(globalThis, '__amagonE2eMenuActionSeen'))).toBe(action)
        await harness.page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    }
    try {
        const modelResponse = await harness.page.evaluate(() => {
            const ai = window.api?.ai
            if (ai === undefined) throw new TypeError('Electron AI API is unavailable')
            return ai.getModels()
        })
        expect(modelResponse.success).toBe(true)
        await harness.app.evaluate(({ipcMain}, response) => {
            ipcMain.removeHandler('ai:getModels')
            const release = new Promise<void>((resolve) => {
                ipcMain.once('amagon-e2e:release-ai-models', () => resolve())
            })
            ipcMain.handle('ai:getModels', async () => {
                Reflect.set(globalThis, '__amagonE2eAiModelsRequested', true)
                await release
                return response
            })
        }, modelResponse)

        // When the welcome screen loads while the model request remains pending.
        await harness.page.emulateMedia({reducedMotion: 'no-preference'})
        await harness.page.reload()
        await expect.poll(() => harness.app.evaluate(() => Reflect.get(globalThis, '__amagonE2eAiModelsRequested') === true)).toBe(true)
        const initializing = harness.page.getByRole('dialog', {name: /App is initializing/u})
        const welcomeContent = harness.page.locator('.welcome-startup-content')
        await expect(initializing).toBeVisible()
        await expect(initializing).toBeFocused()
        await expect(welcomeContent).toHaveAttribute('inert', '')
        await expect(welcomeContent).toHaveAttribute('aria-hidden', 'true')
        expect(await initializing.locator('*').evaluateAll((elements) => elements.some((element) => (
            getComputedStyle(element).animationName !== 'none'
        )))).toBe(true)

        await harness.page.keyboard.press('ControlOrMeta+N')
        await harness.page.keyboard.press('ControlOrMeta+K')
        await harness.page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
        await expect(harness.page.getByRole('dialog', {name: 'New Project'})).toHaveCount(0)
        await expect(harness.page.locator('.command-palette-overlay')).toHaveCount(0)
        await sendMenuAction('new-project')
        await sendMenuAction('command-palette')
        await expect(harness.page.getByRole('dialog', {name: 'New Project'})).toHaveCount(0)
        await expect(harness.page.locator('.command-palette-overlay')).toHaveCount(0)
        await expect(initializing).toBeFocused()

        const newProjectWhileBusy = harness.page.locator('button.welcome-btn.primary-action')
        const bounds = await newProjectWhileBusy.boundingBox()
        expect(bounds).not.toBeNull()
        if (bounds === null) throw new TypeError('New Project button has no bounds')
        await harness.page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
        await expect(harness.page.getByRole('dialog', {name: 'New Project'})).toHaveCount(0)
        await capture(harness, 'welcome-ai-initializing.png', {
            actions: ['Hold the AI model request during welcome startup', 'Click the New Project position'],
            state: 'Animated AI initialization dialog blocks project creation'
        })

        await resize(768)
        await expect(initializing).toBeVisible()
        await capture(harness, 'welcome-ai-initializing-768.png', {
            actions: ['Resize the waiting welcome screen to 768px'],
            state: 'AI initialization dialog remains centered at medium width'
        })

        await resize(375)
        await expect(initializing).toBeVisible()
        await capture(harness, 'welcome-ai-initializing-375.png', {
            actions: ['Resize the waiting welcome screen to 375px'],
            state: 'AI initialization dialog remains visible and readable at compact width'
        })

        await harness.page.emulateMedia({reducedMotion: 'reduce'})
        await expect.poll(() => initializing.evaluate((dialog) => (
            [dialog, ...dialog.querySelectorAll('*')].every((element) => getComputedStyle(element).animationName === 'none')
        ))).toBe(true)
        await capture(harness, 'welcome-ai-initializing-reduced-motion.png', {
            actions: ['Choose reduced motion while AI initialization is pending'],
            state: 'The initialization dialog and progress dots remain still'
        })

        await harness.page.emulateMedia({reducedMotion: 'no-preference'})
        await harness.page.evaluate(() => { document.body.classList.remove('dark') })
        await expect.poll(() => harness.page.evaluate(() => document.body.classList.contains('dark'))).toBe(false)
        await expect.poll(() => initializing.evaluate((dialog) => getComputedStyle(dialog).opacity)).toBe('1')
        const lightColors = await initializing.evaluate((dialog) => {
            const selectors = ['.welcome-initialization-kicker', '.welcome-initialization-copy p', '.welcome-initialization-status']
            const textColors = selectors.map((selector) => {
                const element = dialog.querySelector(selector)
                if (element === null) throw new TypeError(`Missing initialization text: ${selector}`)
                return getComputedStyle(element).color
            })
            return {surface: getComputedStyle(dialog).backgroundColor, textColors}
        })
        for (const color of lightColors.textColors) expect(contrastRatio(color, lightColors.surface)).toBeGreaterThanOrEqual(4.5)
        await capture(harness, 'welcome-ai-initializing-light-375.png', {
            actions: ['Switch the waiting welcome screen to Light at 375px'],
            state: 'Small initialization text has readable contrast on the light modal surface'
        })
        await harness.page.evaluate(() => { document.body.classList.add('dark') })

        // Then the modal clears and the same project action works once models settle.
        await harness.app.evaluate(({ipcMain}, channel) => { ipcMain.emit(channel) }, releaseChannel)
        released = true
        await expect(initializing).toBeHidden()
        await expect.poll(() => welcomeContent.evaluate((element) => element.hasAttribute('inert'))).toBe(false)
        await expect(welcomeContent).toHaveAttribute('aria-hidden', 'false')
        const newProject = harness.page.getByRole('button', {name: /New Project/u})
        await expect(newProject).toBeFocused()
        await newProject.click()
        await expect(harness.page.getByRole('dialog', {name: 'New Project'})).toBeVisible()
    } finally {
        try {
            if (!released) await harness.app.evaluate(({ipcMain}, channel) => { ipcMain.emit(channel) }, releaseChannel)
            await harness.app.evaluate((_, key) => { Reflect.deleteProperty(globalThis, key) }, requestSeenKey)
            await harness.page.evaluate(() => { Reflect.deleteProperty(globalThis, '__amagonE2eMenuActionSeen') })
        } finally {
            try {
                await stopAmagon(harness)
            } finally {
                await rm(root, {recursive: true, force: true})
            }
        }
    }
})
