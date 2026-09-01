import { beforeEach, describe, expect, it, vi } from 'vitest'

const opencodeMocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    createServer: vi.fn(),
    listProviders: vi.fn()
}))

vi.mock('@opencode-ai/sdk', () => ({
    createOpencodeClient: opencodeMocks.createClient,
    createOpencode: opencodeMocks.createServer
}))

vi.mock('electron', () => ({
    app: { getPath: vi.fn(() => 'C:\\amagon-test-user-data') },
    net: { fetch: vi.fn() },
    safeStorage: {
        isEncryptionAvailable: vi.fn(() => false),
        encryptString: vi.fn(),
        decryptString: vi.fn()
    }
}))

import { fetchModelsForProvider, PROVIDER_MODELS } from '../aiService'

describe('fetchModelsForProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        opencodeMocks.createClient.mockReturnValue({
            provider: { list: opencodeMocks.listProviders }
        })
        opencodeMocks.listProviders.mockRejectedValue(new Error('OpenCode service is offline'))
        opencodeMocks.createServer.mockResolvedValue({
            client: {
                provider: {
                    list: vi.fn().mockResolvedValue({ data: { connected: [], all: [] } })
                }
            },
            server: { close: vi.fn() }
        })
    })

    it('does not start an OpenCode service when Settings discovers models', async () => {
        // Given: no OpenCode service is listening.

        // When: Settings requests the available OpenCode models.
        const models = await fetchModelsForProvider('opencode', '')

        // Then: discovery uses fallbacks without spawning a background service.
        expect(models).toEqual(PROVIDER_MODELS.opencode)
        expect(opencodeMocks.createServer).not.toHaveBeenCalled()
    })
})
