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

const cliMocks = vi.hoisted(() => ({detectCli: vi.fn(async () => ({available: true})), spawnCliChat: vi.fn()}))

vi.mock('../cliHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../cliHelpers')>()),
    detectCli: cliMocks.detectCli,
    spawnCliChat: cliMocks.spawnCliChat
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

import {net} from 'electron'
import {chat, fetchModelsForProvider, PROVIDER_MODELS} from '../aiService'

describe('OpenAI and Codex integration regressions', () => {
    beforeEach(() => {
        vi.mocked(net.fetch).mockReset()
        cliMocks.spawnCliChat.mockReset()
    })

    it('loads modern text models while excluding non-chat endpoints, invalid entries and duplicates', async () => {
        vi.mocked(net.fetch).mockResolvedValue(new Response(JSON.stringify({data: [
            {id: 'gpt-6-sol'}, {id: 'gpt-5.4-mini'}, {id: 'o3'}, {id: 'gpt-4.1'},
            {id: 'gpt-5.4-mini'}, {id: null}, {}, {id: 'gpt-4o-realtime-preview'},
            {id: 'gpt-audio'}, {id: 'gpt-4o-mini-transcribe'}, {id: 'text-embedding-3-small'},
        ]})))
        expect(await fetchModelsForProvider('openai', 'test-key')).toEqual([
            'gpt-6-sol', 'gpt-5.4-mini', 'o3', 'gpt-4.1',
        ])
    })

    it('reports rejected credentials without echoing the key', async () => {
        vi.mocked(net.fetch).mockResolvedValue(new Response(JSON.stringify({error: {
            message: 'Incorrect API key provided: sk-test-secret',
        }}), {status: 401}))
        await expect(fetchModelsForProvider('openai', 'sk-test-secret')).rejects.toThrow(/401.*\[redacted\]/u)
    })

    it('reports model-list permission failures instead of a successful empty list', async () => {
        vi.mocked(net.fetch).mockResolvedValue(new Response(JSON.stringify({error: {
            message: 'Missing permissions: api.model.read',
        }}), {status: 403}))
        await expect(fetchModelsForProvider('openai', 'test-key')).rejects.toThrow(/403.*api.model.read/u)
    })

    it('uses Responses for modern models and reads all text output parts', async () => {
        vi.mocked(net.fetch).mockResolvedValue(new Response(JSON.stringify({output: [
            {type: 'reasoning', summary: []},
            {type: 'message', role: 'assistant', content: [{type: 'output_text', text: 'Hello'}, {type: 'output_text', text: ' world'}]},
        ]})))
        expect(await chat([{role: 'user', content: 'hello'}], {
            provider: 'openai', model: 'gpt-5.4-mini', apiKey: 'test-key',
        })).toEqual({content: 'Hello world'})
        const [url, options] = vi.mocked(net.fetch).mock.calls[0]
        expect(url).toBe('https://api.openai.com/v1/responses')
        const body = JSON.parse(String(options?.body))
        expect(body.input).toEqual([{role: 'user', content: 'hello'}])
        expect(body).not.toHaveProperty('temperature')
        expect(body).not.toHaveProperty('max_tokens')
    })

    it('runs Codex as a read-only completion provider outside Git repositories', async () => {
        cliMocks.spawnCliChat.mockResolvedValue({stdout: 'Hello', stderr: '', exitCode: 0})
        expect(await chat([{role: 'user', content: 'hello'}], {provider: 'codex-cli', model: 'chosen-model'})).toEqual({content: 'Hello'})
        expect(cliMocks.spawnCliChat.mock.calls[0][1]).toEqual([
            'exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--model', 'chosen-model', '-',
        ])
    })

    it('lets Codex use its configured model when none was selected in Amagon', async () => {
        cliMocks.spawnCliChat.mockResolvedValue({stdout: 'Hello', stderr: '', exitCode: 0})
        await chat([{role: 'user', content: 'hello'}], {provider: 'codex-cli', model: ''})
        expect(cliMocks.spawnCliChat.mock.calls[0][1]).not.toContain('--model')
    })
})

describe('fetchModelsForProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        cliMocks.detectCli.mockResolvedValue({available: true})
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

    it('returns no OpenCode fallback models when the service and executable are absent', async () => {
        // Given neither a running service nor an installed executable.
        cliMocks.detectCli.mockResolvedValue({available: false})

        // When Settings requests OpenCode models.
        const models = await fetchModelsForProvider('opencode', '')

        // Then the removed provider has no stale choices.
        expect(models).toEqual([])
        expect(cliMocks.detectCli).toHaveBeenCalledWith('opencode')
    })
})
