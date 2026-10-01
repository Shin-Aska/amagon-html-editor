import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => ({ content: '', exists: false }))

vi.mock('fs/promises', () => ({
    readFile: vi.fn(async () => {
        if (!storage.exists) throw new Error('ENOENT')
        return storage.content
    }),
    writeFile: vi.fn(async (_path: string, content: string) => {
        storage.content = content
        storage.exists = true
    })
}))

vi.mock('electron', () => ({
    app: { getPath: vi.fn(() => 'C:\\amagon-ai-config-test') },
    net: { fetch: vi.fn() },
    safeStorage: {
        isEncryptionAvailable: vi.fn(() => false),
        encryptString: vi.fn(),
        decryptString: vi.fn()
    }
}))

import {
    clearApiKeyForProvider,
    loadAllProviderCredentials,
    loadConfig,
    removeProvider,
    saveApiKeyForProvider,
    saveConfig
} from '../aiService'

const persisted = (): Record<string, unknown> => JSON.parse(storage.content)

describe('AI provider removal persistence', () => {
    beforeEach(() => {
        storage.exists = false
        storage.content = ''
    })

    it('defaults provider preference lists for older config files', async () => {
        // Given an older config without provider preference fields.
        storage.content = JSON.stringify({provider: 'opencode', model: 'opencode/gpt-5', encryptedApiKeys: {}, ollamaUrl: 'http://localhost:11434'})
        storage.exists = true

        // When it is loaded.
        const config = await loadConfig()

        // Then both lists are available to Settings.
        expect(config.dismissedMissingProviders).toEqual([])
        expect(config.removedProviders).toEqual([])
    })

    it('removes the active provider and selects a configured provider with its default model', async () => {
        // Given an active OpenCode configuration, a stored Google key, and a dismissed warning.
        storage.content = JSON.stringify({
            provider: 'opencode',
            model: 'opencode/gpt-5',
            encryptedApiKeys: {google: Buffer.from('__PLAIN__google-key').toString('base64')},
            ollamaUrl: 'http://localhost:11434',
            dismissedMissingProviders: ['opencode'],
            removedProviders: []
        })
        storage.exists = true

        // When OpenCode is removed.
        const config = await removeProvider('opencode')

        // Then it is marked removed, its warning is cleared, and Google becomes active.
        expect(config).toMatchObject({provider: 'google', model: 'gemini-2.5-flash-preview-05-20', removedProviders: ['opencode'], dismissedMissingProviders: []})
        expect(persisted()).toMatchObject({provider: 'google', removedProviders: ['opencode'], dismissedMissingProviders: []})
    })

    it('clears a removed provider key and restores it only when explicitly selected', async () => {
        // Given an active key-based provider.
        storage.content = JSON.stringify({
            provider: 'openai', model: 'gpt-4o',
            encryptedApiKeys: {openai: Buffer.from('__PLAIN__secret').toString('base64')},
            ollamaUrl: 'http://localhost:11434'
        })
        storage.exists = true

        // When it is removed.
        const removed = await removeProvider('openai')

        // Then its key is deleted and the provider is marked removed.
        expect(removed.apiKey).toBe('')
        expect(removed.provider).not.toBe('openai')
        expect(removed.removedProviders).not.toContain(removed.provider)
        expect(persisted().encryptedApiKeys).toEqual({})
        expect(removed.removedProviders).toEqual(['openai'])

        // When a different preference is saved, then removal remains in force.
        await saveConfig({dismissedMissingProviders: ['opencode']})
        expect((await loadConfig()).removedProviders).toEqual(['openai'])

        // When the user selects OpenAI, then it is restored.
        const selected = await saveConfig({provider: 'openai'})
        expect(selected.removedProviders).toEqual([])
        expect(selected.dismissedMissingProviders).toEqual(['opencode'])
    })

    it('preserves provider preferences through credential writes and migration', async () => {
        // Given a legacy key and persisted provider preferences.
        storage.content = JSON.stringify({
            provider: 'google', model: 'gemini-2.0-flash', apiKey: 'legacy-key',
            ollamaUrl: 'http://localhost:11434',
            dismissedMissingProviders: ['junie-cli'],
            removedProviders: ['opencode', 'junie-cli']
        })
        storage.exists = true

        // When migration and credential updates run.
        await loadConfig()
        await saveApiKeyForProvider('anthropic', 'new-key')
        await clearApiKeyForProvider('anthropic')

        // Then both preferences survive every write.
        expect(persisted()).toMatchObject({
            dismissedMissingProviders: ['junie-cli'], removedProviders: ['opencode', 'junie-cli']
        })
        expect((await loadAllProviderCredentials()).some((entry) => entry.provider === 'junie-cli')).toBe(false)
    })
})
