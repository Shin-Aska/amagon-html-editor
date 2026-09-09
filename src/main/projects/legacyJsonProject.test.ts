// @vitest-environment node

import {mkdtemp, readFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, describe, expect, it} from 'vitest'
import {
    LegacyProjectValidationError,
    parseLegacyJsonProject,
    readLegacyJsonProject,
    saveLegacyJsonProject
} from './legacyJsonProject'
import {createDefaultTheme} from '../../renderer/store/types'

type FixtureProject = {
    readonly projectSettings: {readonly name: string; readonly framework: string}
    readonly pages: readonly unknown[]
    readonly customCss: string
}

const roots: string[] = []

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, {recursive: true, force: true})))
})

function validateFixture(value: unknown): FixtureProject {
    if (typeof value !== 'object' || value === null) throw new TestValidationError()
    const projectSettings = Reflect.get(value, 'projectSettings')
    const pages = Reflect.get(value, 'pages')
    const customCss = Reflect.get(value, 'customCss')
    if (typeof projectSettings !== 'object' || projectSettings === null) throw new TestValidationError()
    const name = Reflect.get(projectSettings, 'name')
    const framework = Reflect.get(projectSettings, 'framework')
    if (typeof name !== 'string' || typeof framework !== 'string') throw new TestValidationError()
    if (!Array.isArray(pages) || typeof customCss !== 'string') throw new TestValidationError()
    return {projectSettings: {name, framework}, pages, customCss}
}

class TestValidationError extends Error {
    readonly name = 'TestValidationError'
    constructor() {
        super('invalid fixture')
    }
}

describe('legacy JSON project persistence', () => {
    it('uses the shared legacy document contract by default', () => {
        // Given
        const source = JSON.stringify({
            projectSettings: {
                name: 'Shared contract',
                framework: 'vanilla',
                theme: createDefaultTheme(),
                globalStyles: {}
            },
            pages: [],
            userBlocks: []
        })

        // When
        const project = parseLegacyJsonProject(source)

        // Then
        expect(project.customCss).toBe('')
        expect(project.projectSettings.name).toBe('Shared contract')
    })

    it('normalizes an absent top-level customCss before validation', () => {
        // Given
        const source = JSON.stringify({
            projectSettings: {name: 'Legacy', framework: 'vanilla'},
            pages: []
        })

        // When
        const project = parseLegacyJsonProject(source, validateFixture)

        // Then
        expect(project.customCss).toBe('')
    })

    it('atomically saves in place and reopens the validated project', async () => {
        // Given
        const root = await mkdtemp(join(tmpdir(), 'amagon-legacy-'))
        roots.push(root)
        const target = join(root, 'legacy.json')
        const project: FixtureProject = {
            projectSettings: {name: 'Round Trip', framework: 'bootstrap-5'},
            pages: [],
            customCss: '.hero { color: red; }'
        }

        // When
        await saveLegacyJsonProject(target, project, validateFixture)
        const reopened = await readLegacyJsonProject(target, validateFixture)

        // Then
        expect(reopened).toEqual(project)
        expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(project)
    })

    it('reports malformed or invalid input as typed validation errors', () => {
        // Given
        const malformed = '{'
        const invalid = JSON.stringify({pages: []})

        // When
        const parseMalformed = () => parseLegacyJsonProject(malformed, validateFixture)
        const parseInvalid = () => parseLegacyJsonProject(invalid, validateFixture)

        // Then
        expect(parseMalformed).toThrow(LegacyProjectValidationError)
        expect(parseInvalid).toThrow(LegacyProjectValidationError)
    })
})
