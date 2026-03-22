import { create } from 'zustand'
import { getApi } from '../utils/api'
import type { EditorLayout } from './types'

export interface AppSettings {
  theme: 'light' | 'dark'
  defaultLayout: EditorLayout
  showTabChildSelectionWarning: boolean
}

interface AppSettingsState extends AppSettings {
  loaded: boolean
}

interface AppSettingsActions {
  loadSettings: () => Promise<void>
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>
  setTheme: (theme: 'light' | 'dark') => void
  setDefaultLayout: (layout: EditorLayout) => void
  setShowTabChildSelectionWarning: (show: boolean) => void
}

type AppSettingsStore = AppSettingsState & AppSettingsActions

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultLayout: 'standard',
  showTabChildSelectionWarning: true
}

export const useAppSettingsStore = create<AppSettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  loadSettings: async () => {
    try {
      const api = getApi()
      const result = await api.app.getSettings()
      if (result.success && result.settings) {
        set({ ...DEFAULT_SETTINGS, ...result.settings, loaded: true })
      } else {
        set({ ...DEFAULT_SETTINGS, loaded: true })
      }
    } catch {
      set({ ...DEFAULT_SETTINGS, loaded: true })
    } finally {
      // Regardless of load success, apply the resolved theme
      const theme = get().theme
      if (theme === 'dark') {
        document.body.classList.add('dark')
      } else {
        document.body.classList.remove('dark')
      }
    }
  },

  saveSettings: async (patch: Partial<AppSettings>) => {
    const current = get()
    const nextSettings: AppSettings = {
      theme: patch.theme ?? current.theme,
      defaultLayout: patch.defaultLayout ?? current.defaultLayout,
      showTabChildSelectionWarning: patch.showTabChildSelectionWarning ?? current.showTabChildSelectionWarning
    }
    set({ ...nextSettings })

    try {
      const api = getApi()
      await api.app.saveSettings(nextSettings)
    } catch (err) {
      console.error('Failed to save app settings', err)
    }
  },

  setTheme: (theme: 'light' | 'dark') => {
    set({ theme })
    if (theme === 'dark') {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
    get().saveSettings({ theme })
  },

  setDefaultLayout: (layout: EditorLayout) => {
    set({ defaultLayout: layout })
    get().saveSettings({ defaultLayout: layout })
  },

  setShowTabChildSelectionWarning: (show: boolean) => {
    set({ showTabChildSelectionWarning: show })
    get().saveSettings({ showTabChildSelectionWarning: show })
  }
}))
