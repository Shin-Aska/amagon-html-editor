export const OPEN_GLOBAL_SETTINGS_EVENT = 'hoarses:open-global-settings';

export type GlobalSettingsTab = 'general' | 'keys'

export interface OpenGlobalSettingsDetail {
    tab?: GlobalSettingsTab
}

export function openGlobalSettings(detail: OpenGlobalSettingsDetail = {}): void {
    window.dispatchEvent(new CustomEvent<OpenGlobalSettingsDetail>(OPEN_GLOBAL_SETTINGS_EVENT, {detail}))
}
