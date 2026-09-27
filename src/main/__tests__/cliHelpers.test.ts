import { describe, expect, it, vi } from 'vitest'

vi.mock('child_process', async (importOriginal) => {
    const original = await importOriginal<typeof import('child_process')>();
    const execFile = vi.fn((binary: string, _args: string[], _options: unknown, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
        const locator = binary === 'where.exe' || binary === 'which';
        process.nextTick(() => {
            if (locator) {
                callback(null, 'C:\\Users\\test\\.bun\\bin\\opencode.exe\n', '');
            } else {
                callback(Object.assign(new Error('broken shim'), {code: 1}), '', 'error: bin executable does not exist on disk');
            }
        });
        return {stdin: {on: vi.fn(), end: vi.fn()}, kill: vi.fn()}
    });
    return {...original, default: {...original, execFile}, execFile}
})

import { detectCli } from '../cliHelpers'

describe('CLI availability', () => {
    it('reports OpenCode unavailable when a located shim cannot run', async () => {
        // Given a locator result pointing to a broken Bun shim.
        // When Amagon checks the executable.
        const status = await detectCli('opencode')

        // Then the failed version probe means the provider is unavailable.
        expect(status).toEqual({available: false})
    })
})
