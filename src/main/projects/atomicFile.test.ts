// @vitest-environment node

import {mkdtemp, open, readFile, readdir, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, describe, expect, it} from 'vitest'
import {
    AtomicWriteError,
    type AtomicFileHandle,
    type AtomicFileSystem,
    atomicWriteFile
} from './atomicFile'

const roots: string[] = []

async function makeRoot(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'amagon-atomic-'))
    roots.push(root)
    return root
}

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, {recursive: true, force: true})))
})

function faultingFileSystem(stage: 'write' | 'sync' | 'close' | 'rename'): AtomicFileSystem {
    return {
        open: async (filePath, flags, mode) => {
            const handle = await open(filePath, flags, mode)
            const wrapped: AtomicFileHandle = {
                write: async (buffer) => {
                    if (stage === 'write') throw new TestFaultError(stage)
                    return handle.write(buffer)
                },
                sync: async () => {
                    if (stage === 'sync') throw new TestFaultError(stage)
                    await handle.sync()
                },
                close: async () => {
                    if (stage === 'close') {
                        await handle.close()
                        throw new TestFaultError(stage)
                    }
                    await handle.close()
                }
            }
            return wrapped
        },
        rename: async (source, target) => {
            if (stage === 'rename') throw new TestFaultError(stage)
            const fs = await import('node:fs/promises')
            await fs.rename(source, target)
        },
        unlink: async (filePath) => {
            const fs = await import('node:fs/promises')
            await fs.unlink(filePath)
        }
    }
}

class TestFaultError extends Error {
    readonly name = 'TestFaultError'

    constructor(readonly stage: string) {
        super(`injected ${stage} fault`)
    }
}

describe('atomicWriteFile', () => {
    it('replaces the target from a bounded stream when every stage succeeds', async () => {
        // Given
        const root = await makeRoot()
        const target = join(root, 'project.json')
        await writeFile(target, 'old bytes')
        async function* chunks(): AsyncGenerator<Uint8Array> {
            yield Buffer.from('new ')
            yield Buffer.from('bytes')
        }

        // When
        await atomicWriteFile(target, chunks(), {maxBytes: 9})

        // Then
        expect(await readFile(target, 'utf8')).toBe('new bytes')
        expect(await readdir(root)).toEqual(['project.json'])
    })

    it.each(['write', 'sync', 'close', 'rename'] as const)(
        'keeps the prior target and cleans the sibling temp when %s fails',
        async (stage) => {
            // Given
            const root = await makeRoot()
            const target = join(root, 'project.json')
            const original = Buffer.from('last known good')
            await writeFile(target, original)

            // When
            const action = atomicWriteFile(target, Buffer.from('replacement'), {
                maxBytes: 64,
                fileSystem: faultingFileSystem(stage),
                createId: () => 'fixed-id'
            })

            // Then
            await expect(action).rejects.toMatchObject({name: 'AtomicWriteError', stage})
            expect(await readFile(target)).toEqual(original)
            expect(await readdir(root)).toEqual(['project.json'])
        }
    )

    it('rejects a stream above the byte limit without replacing the target', async () => {
        // Given
        const root = await makeRoot()
        const target = join(root, 'project.json')
        await writeFile(target, 'old')

        // When
        const action = atomicWriteFile(target, Buffer.from('too large'), {maxBytes: 3})

        // Then
        await expect(action).rejects.toBeInstanceOf(AtomicWriteError)
        expect(await readFile(target, 'utf8')).toBe('old')
        expect(await readdir(root)).toEqual(['project.json'])
    })

    it('never reuses or removes a stale sibling temp from an interrupted writer', async () => {
        // Given
        const root = await makeRoot()
        const target = join(root, 'project.json')
        const staleTemp = `${target}.fixed-id.tmp`
        await writeFile(target, 'old')
        await writeFile(staleTemp, 'stale partial')

        // When
        const action = atomicWriteFile(target, 'new', {maxBytes: 3, createId: () => 'fixed-id'})

        // Then
        await expect(action).rejects.toMatchObject({name: 'AtomicWriteError', stage: 'allocate'})
        expect(await readFile(target, 'utf8')).toBe('old')
        expect(await readFile(staleTemp, 'utf8')).toBe('stale partial')
    })
})
