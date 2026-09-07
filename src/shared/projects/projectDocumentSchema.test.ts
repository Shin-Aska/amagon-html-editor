import { describe, expect, it } from 'vitest'
import {
    AMG_ERROR_CODES,
    AmgContractError,
    PROJECT_SCHEMA_VERSION,
} from './amgContract'
import {
    parseLegacyProjectDocument,
    parseProjectDocumentV1,
} from './projectDocumentSchema'
import type { ProjectData } from '../../renderer/store/types'
import { createDefaultThemeVariants } from '../../renderer/store/types'

const createProject = (): ProjectData => ({
    customCss: '.plugin { color: rebeccapurple; }',
    projectSettings: {
        name: 'Dynamic project',
        framework: 'bootstrap-5',
        theme: {
            name: 'Default',
            colors: {
                primary: '#000000', secondary: '#111111', accent: '#222222',
                background: '#ffffff', surface: '#eeeeee', text: '#333333',
                textMuted: '#444444', border: '#555555', success: '#008000',
                warning: '#ffff00', danger: '#ff0000'
            },
            typography: {
                fontFamily: 'sans-serif', headingFontFamily: 'sans-serif',
                baseFontSize: '16px', lineHeight: '1.5', headingLineHeight: '1.2'
            },
            spacing: { baseUnit: '4px', scale: [1, 2, 4] },
            borders: { radius: '4px', width: '1px', color: '#555555' },
            customCss: ''
        },
        globalStyles: {}
    },
    pages: [{
        id: 'home', title: 'Home', slug: 'index', meta: {},
        blocks: [{
            id: 'plugin-block', type: 'third-party-widget',
            props: {
                pluginVersion: 7,
                nested: { enabled: true, labels: ['one', 'two'] }
            },
            styles: {}, classes: [], children: []
        }]
    }],
    userBlocks: []
})

describe('ProjectData characterization', () => {
    it('preserves dynamic block and plugin properties when serialized as current project JSON', () => {
        // Given
        const project = createProject()

        // When
        const roundTrip = JSON.parse(JSON.stringify(project))

        // Then
        expect(roundTrip).toEqual(project)
    })
})

describe('project document schema', () => {
    it.each([true, false])('preserves transition preference %s in legacy and AMG documents', (transitionEnabled) => {
        // Given
        const project = createProject();
        project.projectSettings.themes = {...createDefaultThemeVariants(), transitionEnabled};
        // When
        const legacy = parseLegacyProjectDocument(JSON.parse(JSON.stringify(project)));
        const amg = parseProjectDocumentV1({projectSchemaVersion: PROJECT_SCHEMA_VERSION, ...project});
        // Then
        expect(legacy.projectSettings.themes?.transitionEnabled).toBe(transitionEnabled);
        expect(amg.projectSettings.themes?.transitionEnabled).toBe(transitionEnabled);
    });

    it('rejects a non-boolean transition preference at the document boundary', () => {
        // Given
        const project = createProject();
        const document = {...project, projectSettings: {...project.projectSettings, themes: {...createDefaultThemeVariants(), transitionEnabled: 'yes'}}};
        // When / Then
        expect(() => parseLegacyProjectDocument(document)).toThrowError(AmgContractError);
    });

    it('parses a complete v1 project without stripping custom or dynamic properties', () => {
        // Given
        const project = {
            projectSchemaVersion: PROJECT_SCHEMA_VERSION,
            ...createProject(),
            pluginRegistry: { 'third-party-widget': { enabled: true } }
        }

        // When
        const parsed = parseProjectDocumentV1(project)

        // Then
        expect(parsed).toEqual(project)
        expect(parsed.customCss).toBe('.plugin { color: rebeccapurple; }')
    })

    it('defaults only an absent legacy customCss to an empty string', () => {
        // Given
        const { customCss: _customCss, ...legacyProject } = createProject()

        // When
        const parsed = parseLegacyProjectDocument(legacyProject)

        // Then
        expect(parsed.customCss).toBe('')
    })

    it('rejects a missing v1 customCss durable field', () => {
        // Given
        const { customCss: _customCss, ...project } = createProject()

        // When
        const parse = () => parseProjectDocumentV1({
            projectSchemaVersion: PROJECT_SCHEMA_VERSION,
            ...project
        })

        // Then
        expect(parse).toThrowError(AmgContractError)
        expect(parse).toThrowError(expect.objectContaining({
            code: AMG_ERROR_CODES.INVALID_PROJECT_DOCUMENT
        }))
    })

    it('rejects unsupported project schema versions before legacy migration', () => {
        // Given
        const project = { projectSchemaVersion: 2, ...createProject() }

        // When
        const parse = () => parseLegacyProjectDocument(project)

        // Then
        expect(parse).toThrowError(expect.objectContaining({
            code: AMG_ERROR_CODES.UNSUPPORTED_PROJECT_SCHEMA_VERSION
        }))
    })

    it('rejects embedded publisher credentials', () => {
        // Given
        const project = {
            projectSchemaVersion: PROJECT_SCHEMA_VERSION,
            ...createProject(),
            publisherConfig: { providerId: 'example', encryptedCredentials: 'secret' }
        }

        // When
        const parse = () => parseProjectDocumentV1(project)

        // Then
        expect(parse).toThrowError(expect.objectContaining({
            code: AMG_ERROR_CODES.CREDENTIALS_FORBIDDEN
        }))
    })

    it('rejects absent nested durable project fields', () => {
        // Given
        const project = {
            projectSchemaVersion: PROJECT_SCHEMA_VERSION,
            ...createProject(),
            pages: [{ id: 'home', title: 'Home', slug: 'index', meta: {} }]
        }

        // When
        const parse = () => parseProjectDocumentV1(project)

        // Then
        expect(parse).toThrowError(expect.objectContaining({
            code: AMG_ERROR_CODES.INVALID_PROJECT_DOCUMENT
        }))
    })
})
