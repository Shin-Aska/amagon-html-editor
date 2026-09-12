import {beforeEach, describe, expect, it, vi} from 'vitest'
import {useAppSettingsStore} from '../appSettingsStore'

const api = vi.hoisted(() => ({
    getSettings: vi.fn(),
    saveSettings: vi.fn(async () => ({success: true}))
}))
vi.mock('../../utils/api', () => ({getApi: () => ({app: api})}))

describe('library preview preference', () => {
    beforeEach(() => {
        api.saveSettings.mockClear()
    })

    it.each([null, {}, {libraryPreviewMode: 'invalid'}])('defaults to Live for missing or invalid settings %j', async (settings) => {
        // Given
        api.getSettings.mockResolvedValue({success: true, settings})
        // When
        await useAppSettingsStore.getState().loadSettings()
        // Then
        expect(Reflect.get(useAppSettingsStore.getState(), 'libraryPreviewMode')).toBe('live')
    })

    it('restores Classic from application settings', async () => {
        // Given
        api.getSettings.mockResolvedValue({success: true, settings: {libraryPreviewMode: 'classic'}})
        // When
        await useAppSettingsStore.getState().loadSettings()
        await useAppSettingsStore.getState().saveSettings({theme: 'light'})
        // Then
        expect(api.saveSettings).toHaveBeenCalledWith(expect.objectContaining({libraryPreviewMode: 'classic'}))
    })
})
