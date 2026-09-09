// @vitest-environment node

import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {basename, join} from 'node:path'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {
    InvalidRecentProjectIdError,
    UnknownRecentProjectError,
    createRecentProjectsStore
} from './recentProjects'

const roots: string[] = []
const ids = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003'
] as const

afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(roots.splice(0).map((root) => rm(root, {recursive: true, force: true})))
})

async function makeRoot(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'amagon-recents-'))
    roots.push(root)
    return root
}

function sequentialIds(): () => string {
    let index = 0
    return () => {
        const id = ids[index]
        if (id === undefined) throw new TestFixtureError('ID fixture exhausted')
        index += 1
        return id
    }
}

class TestFixtureError extends Error {
    readonly name = 'TestFixtureError'
}

describe('recent project store', () => {
    it('reads string paths and migrates stable IDs on the next successful mutation', async () => {
        // Given
        const root = await makeRoot()
        const storagePath = join(root, 'recent-projects.json')
        const first = join(root, 'one.json')
        const second = join(root, 'two.AMG')
        const third = join(root, 'three.json')
        await writeFile(first, JSON.stringify({projectSettings: {name: 'One', framework: 'vanilla'}}))
        await writeFile(second, 'not inspected yet')
        await writeFile(third, JSON.stringify({projectSettings: {name: 'Three', framework: 'tailwind'}}))
        await writeFile(storagePath, JSON.stringify([first, second]))
        const store = createRecentProjectsStore({storagePath, createId: sequentialIds()})

        // When
        const before = await store.list()
        await store.add(third)
        const after = await store.list()

        // Then
        expect(before.map(({id}) => id)).toEqual([ids[0], ids[1]])
        expect(after.map(({id}) => id)).toEqual([ids[2], ids[0], ids[1]])
        expect(after.map(({name}) => name)).toEqual(['Three', 'One', 'two'])
        expect(JSON.parse(await readFile(storagePath, 'utf8'))).toEqual({
            version: 2,
            projects: [
                {id: ids[2], path: third},
                {id: ids[0], path: first},
                {id: ids[1], path: second}
            ]
        })
        const reopened = createRecentProjectsStore({storagePath})
        expect((await reopened.list()).map(({id}) => id)).toEqual([ids[2], ids[0], ids[1]])
    })

    it('resolves and removes entries only by a main-owned ID', async () => {
        // Given
        const root = await makeRoot()
        const storagePath = join(root, 'recent-projects.json')
        const projectPath = join(root, 'safe.json')
        await writeFile(projectPath, '{}')
        await writeFile(storagePath, JSON.stringify({
            version: 2,
            projects: [{id: ids[0], path: projectPath}]
        }))
        const store = createRecentProjectsStore({storagePath})

        // When
        const resolved = await store.resolvePath(ids[0])
        const remaining = await store.remove(ids[0])

        // Then
        expect(resolved).toBe(projectPath)
        expect(remaining).toEqual([])
    })

    it('rejects forged and unknown IDs before inspecting any project path', async () => {
        // Given
        const root = await makeRoot()
        const storagePath = join(root, 'recent-projects.json')
        await writeFile(storagePath, JSON.stringify({version: 2, projects: []}))
        const inspect = vi.fn(async (projectPath: string) => ({name: basename(projectPath)}))
        const store = createRecentProjectsStore({storagePath, inspect})

        // When
        const forged = store.resolvePath(join(root, 'forged.json'))
        const unknown = store.resolvePath(ids[0])

        // Then
        await expect(forged).rejects.toBeInstanceOf(InvalidRecentProjectIdError)
        await expect(unknown).rejects.toBeInstanceOf(UnknownRecentProjectError)
        expect(inspect).not.toHaveBeenCalled()
    })

    it('recovers from malformed persistence and uses a basename fallback for unreadable entries', async () => {
        // Given
        const root = await makeRoot()
        const storagePath = join(root, 'recent-projects.json')
        const unavailable = join(root, 'Unavailable.json')
        await writeFile(storagePath, '{malformed')
        const store = createRecentProjectsStore({storagePath, createId: sequentialIds()})

        // When
        await store.add(unavailable)
        const projects = await store.list()

        // Then
        expect(projects).toEqual([{
            id: ids[0],
            name: 'Unavailable',
            framework: undefined,
            displayPath: unavailable
        }])
    })

    it('does not advance in-memory state when atomic persistence fails', async () => {
        // Given
        const root = await makeRoot()
        const storagePath = join(root, 'recent-projects.json')
        const original = join(root, 'original.json')
        const replacement = join(root, 'replacement.json')
        await writeFile(storagePath, JSON.stringify({
            version: 2,
            projects: [{id: ids[0], path: original}]
        }))
        const persist = vi.fn(async () => {
            throw new TestFixtureError('injected persistence failure')
        })
        const store = createRecentProjectsStore({storagePath, persist, createId: sequentialIds()})

        // When
        const mutation = store.add(replacement)

        // Then
        await expect(mutation).rejects.toThrow(TestFixtureError)
        expect((await store.list()).map(({id, displayPath}) => ({id, displayPath}))).toEqual([
            {id: ids[0], displayPath: original}
        ])
        expect(JSON.parse(await readFile(storagePath, 'utf8'))).toEqual({
            version: 2,
            projects: [{id: ids[0], path: original}]
        })
    })

    it('assigns one stable ID when concurrent readers load a legacy list', async () => {
        // Given
        const root = await makeRoot()
        const storagePath = join(root, 'recent-projects.json')
        const projectPath = join(root, 'legacy.json')
        await writeFile(storagePath, JSON.stringify([projectPath]))
        const store = createRecentProjectsStore({storagePath, createId: sequentialIds()})

        // When
        const [first, second] = await Promise.all([store.list(), store.list()])

        // Then
        expect(first[0]?.id).toBe(ids[0])
        expect(second[0]?.id).toBe(ids[0])
    })
})
