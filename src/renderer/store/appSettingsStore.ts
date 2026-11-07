import {create} from 'zustand'
import {getApi} from '../utils/api'
import {applyAppPalette, normalizeCustomAppThemes, resolveAppTheme, type AppColorTheme} from '../themes/appThemes'
import {DEFAULT_CODE_PREFERENCES, normalizeCodePreferences, type CodePreferences} from '../utils/codePreferences'
import type {EditorLayout} from './types'
import {isMotionPreviewMode, type MotionPreviewMode} from '../utils/motionPreview'

export interface AppSettings {
    theme: 'light' | 'dark'
    appColorTheme: string
    customAppThemes: AppColorTheme[]
    codePreferences: CodePreferences
    defaultLayout: EditorLayout
    showTabChildSelectionWarning: boolean
    tutorialEnabled: boolean
    tutorialCompleted: boolean
    enableDangerousFeatures: boolean
    showRestartTutorialButton: boolean
    libraryPreviewMode: 'live' | 'classic'
    libraryPreviewCacheSlots: number
    motionPreviewMode: MotionPreviewMode
}

interface AppSettingsState extends AppSettings {
    loaded: boolean
}

interface AppSettingsActions {
    loadSettings: () => Promise<void>
    saveSettings: (patch: Partial<AppSettings>) => Promise<boolean>
    setTheme: (theme: 'light' | 'dark') => void
    setDefaultLayout: (layout: EditorLayout) => void
    setShowTabChildSelectionWarning: (show: boolean) => void
    setTutorialEnabled: (enabled: boolean) => void
    setTutorialCompleted: (completed: boolean) => void
    setEnableDangerousFeatures: (enabled: boolean) => void
    setShowRestartTutorialButton: (show: boolean) => void
    setMotionPreviewMode: (mode: MotionPreviewMode) => void
}

type AppSettingsStore = AppSettingsState & AppSettingsActions

const DEFAULT_SETTINGS: AppSettings = {
    theme: 'dark',
    appColorTheme: 'classic',
    customAppThemes: [],
    codePreferences: DEFAULT_CODE_PREFERENCES,
    defaultLayout: 'standard',
    showTabChildSelectionWarning: true,
    tutorialEnabled: true,
    tutorialCompleted: false,
    enableDangerousFeatures: false,
    showRestartTutorialButton: true,
    libraryPreviewMode: 'live',
    libraryPreviewCacheSlots: 64,
    motionPreviewMode: 'system'
};

const normalizePreviewCacheSlots = (value: unknown): number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
        ? value : DEFAULT_SETTINGS.libraryPreviewCacheSlots
);

export const useAppSettingsStore = create<AppSettingsStore>((set, get) => ({
    ...DEFAULT_SETTINGS,
    loaded: false,

    loadSettings: async () => {
        try {
            const api = getApi();
            const result = await api.app.getSettings();
            if (result.success && result.settings) {
                const motionPreviewMode = isMotionPreviewMode(result.settings.motionPreviewMode)
                    ? result.settings.motionPreviewMode
                    : DEFAULT_SETTINGS.motionPreviewMode;
                const libraryPreviewMode = result.settings.libraryPreviewMode === 'classic' ? 'classic' : 'live';
                const libraryPreviewCacheSlots = normalizePreviewCacheSlots(result.settings.libraryPreviewCacheSlots);
                const customAppThemes = normalizeCustomAppThemes(result.settings.customAppThemes);
                const appColorTheme = resolveAppTheme(result.settings.appColorTheme, customAppThemes).id;
                const theme = result.settings.theme === 'light' ? 'light' : 'dark';
                const codePreferences = normalizeCodePreferences(result.settings.codePreferences);
                set({...DEFAULT_SETTINGS, ...result.settings, theme, customAppThemes, appColorTheme, codePreferences, motionPreviewMode, libraryPreviewMode, libraryPreviewCacheSlots, loaded: true})
            } else {
                set({...DEFAULT_SETTINGS, loaded: true})
            }
        } catch {
            set({...DEFAULT_SETTINGS, loaded: true})
        } finally {
            const state = get();
            applyAppPalette(state.theme, resolveAppTheme(state.appColorTheme,state.customAppThemes)[state.theme]);
        }
    },

    saveSettings: async (patch: Partial<AppSettings>) => {
        const current = get();
        const nextSettings: AppSettings = {
            theme: patch.theme ?? current.theme,
            appColorTheme: patch.appColorTheme ?? current.appColorTheme,
            customAppThemes: normalizeCustomAppThemes(patch.customAppThemes ?? current.customAppThemes),
            codePreferences: normalizeCodePreferences(patch.codePreferences ?? current.codePreferences),
            defaultLayout: patch.defaultLayout ?? current.defaultLayout,
            showTabChildSelectionWarning: patch.showTabChildSelectionWarning ?? current.showTabChildSelectionWarning,
            tutorialEnabled: patch.tutorialEnabled ?? current.tutorialEnabled,
            tutorialCompleted: patch.tutorialCompleted ?? current.tutorialCompleted,
            enableDangerousFeatures: patch.enableDangerousFeatures ?? current.enableDangerousFeatures,
            showRestartTutorialButton: patch.showRestartTutorialButton ?? current.showRestartTutorialButton,
            libraryPreviewMode: patch.libraryPreviewMode ?? current.libraryPreviewMode,
            libraryPreviewCacheSlots: normalizePreviewCacheSlots(patch.libraryPreviewCacheSlots ?? current.libraryPreviewCacheSlots),
            motionPreviewMode: patch.motionPreviewMode ?? current.motionPreviewMode
        };
        nextSettings.appColorTheme = resolveAppTheme(nextSettings.appColorTheme,nextSettings.customAppThemes).id;
        set({...nextSettings});
        applyAppPalette(nextSettings.theme,resolveAppTheme(nextSettings.appColorTheme,nextSettings.customAppThemes)[nextSettings.theme]);

        try {
            const api = getApi();
            const result = await api.app.saveSettings(nextSettings);
            if (!result.success) throw new Error(result.error || 'Could not persist app settings');
            return true
        } catch (err) {
            console.error('Failed to save app settings', err);
            return false
        }
    },

    setTheme: (theme: 'light' | 'dark') => {
        void get().saveSettings({theme})
    },

    setDefaultLayout: (layout: EditorLayout) => {
        set({defaultLayout: layout});
        get().saveSettings({defaultLayout: layout})
    },

    setShowTabChildSelectionWarning: (show: boolean) => {
        set({showTabChildSelectionWarning: show});
        get().saveSettings({showTabChildSelectionWarning: show})
    },

    setTutorialEnabled: (enabled: boolean) => {
        set({tutorialEnabled: enabled});
        get().saveSettings({tutorialEnabled: enabled})
    },

    setTutorialCompleted: (completed: boolean) => {
        set({tutorialCompleted: completed});
        get().saveSettings({tutorialCompleted: completed})
    },

    setEnableDangerousFeatures: (enabled: boolean) => {
        set({enableDangerousFeatures: enabled});
        get().saveSettings({enableDangerousFeatures: enabled})
    },

    setShowRestartTutorialButton: (show: boolean) => {
        set({showRestartTutorialButton: show});
        get().saveSettings({showRestartTutorialButton: show})
    },

    setMotionPreviewMode: (mode: MotionPreviewMode) => {
        set({motionPreviewMode: mode});
        get().saveSettings({motionPreviewMode: mode})
    }
}));
