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

    it.each([undefined, null, -1, 1.5, '64', Infinity, NaN])('defaults invalid cache capacity %j to 64', async value => {
        api.getSettings.mockResolvedValue({success: true, settings: {libraryPreviewCacheSlots: value}})
        await useAppSettingsStore.getState().loadSettings()
        expect(useAppSettingsStore.getState().libraryPreviewCacheSlots).toBe(64)
    })

    it.each([0, 16, 64, 128])('restores and preserves a cache capacity of %i', async value => {
        api.getSettings.mockResolvedValue({success: true, settings: {libraryPreviewCacheSlots: value}})
        await useAppSettingsStore.getState().loadSettings()
        await useAppSettingsStore.getState().saveSettings({theme: 'light'})
        expect(useAppSettingsStore.getState().libraryPreviewCacheSlots).toBe(value)
        expect(api.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({libraryPreviewCacheSlots: value}))
    })

    it('persists capacity changes immediately', async () => {
        await useAppSettingsStore.getState().saveSettings({libraryPreviewCacheSlots: 32})
        expect(useAppSettingsStore.getState().libraryPreviewCacheSlots).toBe(32)
        expect(api.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({libraryPreviewCacheSlots: 32}))
    })
})
