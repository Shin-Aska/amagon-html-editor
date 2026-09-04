// -----------------------------------------------------------------------------
// Media Search Service — handles configuration for web image/video search
// -----------------------------------------------------------------------------

import * as path from 'path'
import * as fs from 'fs/promises'
import {app} from 'electron'
import {decryptApiKey, encryptApiKey, maskApiKey, MASKED_KEY_PREFIX} from './cryptoHelpers'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type MediaSearchProvider = 'unsplash' | 'pexels' | 'pixabay'

export interface MediaSearchConfig {
    enabled: boolean
    provider: MediaSearchProvider
    apiKey: string
}

/** Shape of the config as persisted to disk (API key is encrypted). */
interface PersistedMediaSearchConfig {
    enabled: boolean
    provider: MediaSearchProvider
    encryptedApiKeys?: Partial<Record<MediaSearchProvider, string>>
    encryptedApiKey?: string
    apiKey?: string // legacy plaintext
}

// -----------------------------------------------------------------------------
// Default configuration
// -----------------------------------------------------------------------------

const DEFAULT_CONFIG: MediaSearchConfig = {
    enabled: false,
    provider: 'unsplash',
    apiKey: ''
};

// Re-export crypto helpers so existing imports from mediaSearchService still work
export {encryptApiKey, decryptApiKey, maskApiKey, MASKED_KEY_PREFIX} from './cryptoHelpers'

// -----------------------------------------------------------------------------
// Config persistence
// -----------------------------------------------------------------------------

function getConfigPath(): string {
    return path.join(app.getPath('userData'), 'media-search-config.json')
}

export async function loadConfig(): Promise<MediaSearchConfig> {
    try {
        const raw = await fs.readFile(getConfigPath(), 'utf-8');
        const parsed = JSON.parse(raw) as PersistedMediaSearchConfig;
        const provider = parsed.provider ?? DEFAULT_CONFIG.provider;
        const encryptedApiKeys = {...(parsed.encryptedApiKeys ?? {})};

        let apiKey = '';

        if (!encryptedApiKeys[provider]) {
            if (parsed.encryptedApiKey) {
                encryptedApiKeys[provider] = parsed.encryptedApiKey
            } else if (parsed.apiKey) {
                encryptedApiKeys[provider] = encryptApiKey(parsed.apiKey)
            }
        }

        if (encryptedApiKeys[provider]) {
            apiKey = decryptApiKey(encryptedApiKeys[provider]!)
        }

        if (
            parsed.apiKey !== undefined ||
            parsed.encryptedApiKey !== undefined ||
            Object.keys(parsed.encryptedApiKeys ?? {}).length === 0
        ) {
            const migrated: PersistedMediaSearchConfig = {
                enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
                provider,
                encryptedApiKeys
            };
            await fs.writeFile(getConfigPath(), JSON.stringify(migrated, null, 2), 'utf-8')
        }

        return {
            enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
            provider,
            apiKey
        }
    } catch {
        return {...DEFAULT_CONFIG}
    }
}

export async function saveConfig(config: Partial<MediaSearchConfig>): Promise<MediaSearchConfig> {
    const current = await loadConfig();
    const merged: MediaSearchConfig = {...current, ...config};
    const raw = await loadPersistedConfig();
    const encryptedApiKeys = {...raw.encryptedApiKeys};

    if (config.apiKey !== undefined) {
        if (merged.apiKey) {
            encryptedApiKeys[merged.provider] = encryptApiKey(merged.apiKey)
        } else {
            delete encryptedApiKeys[merged.provider]
        }
    }

    const persisted: PersistedMediaSearchConfig = {
        enabled: merged.enabled,
        provider: merged.provider,
        encryptedApiKeys
    };

    await fs.writeFile(getConfigPath(), JSON.stringify(persisted, null, 2), 'utf-8');
    return merged
}

async function loadPersistedConfig(): Promise<{
    persisted: PersistedMediaSearchConfig
    encryptedApiKeys: Partial<Record<MediaSearchProvider, string>>
}> {
    try {
        const raw = await fs.readFile(getConfigPath(), 'utf-8');
        const parsed = JSON.parse(raw) as PersistedMediaSearchConfig;
        const provider = parsed.provider ?? DEFAULT_CONFIG.provider;
        const encryptedApiKeys = {...(parsed.encryptedApiKeys ?? {})};

        if (!encryptedApiKeys[provider]) {
            if (parsed.encryptedApiKey) {
                encryptedApiKeys[provider] = parsed.encryptedApiKey
            } else if (parsed.apiKey) {
                encryptedApiKeys[provider] = encryptApiKey(parsed.apiKey)
            }
        }

        return {
            persisted: {
                enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
                provider,
                encryptedApiKeys
            },
            encryptedApiKeys
        }
    } catch {
        return {
            persisted: {
                enabled: DEFAULT_CONFIG.enabled,
                provider: DEFAULT_CONFIG.provider,
                encryptedApiKeys: {}
            },
            encryptedApiKeys: {}
        }
    }
}

export async function loadAllProviderCredentials(): Promise<{
    provider: MediaSearchProvider;
    hasKey: boolean;
    maskedKey: string
}[]> {
    const {encryptedApiKeys} = await loadPersistedConfig();
    const providers: MediaSearchProvider[] = ['unsplash', 'pexels', 'pixabay'];
    const result: { provider: MediaSearchProvider; hasKey: boolean; maskedKey: string }[] = [];

    for (const provider of providers) {
        const encrypted = encryptedApiKeys[provider];
        if (!encrypted) continue;
        const key = decryptApiKey(encrypted);
        if (!key) continue;
        result.push({
            provider,
            hasKey: true,
            maskedKey: maskApiKey(key)
        })
    }

    return result
}

export async function loadApiKeyForProvider(provider: MediaSearchProvider): Promise<string> {
    const {encryptedApiKeys} = await loadPersistedConfig();
    const encrypted = encryptedApiKeys[provider];
    return encrypted ? decryptApiKey(encrypted) : ''
}

function getFirstConfiguredMediaProvider(
    encryptedApiKeys: Partial<Record<MediaSearchProvider, string>>
): MediaSearchProvider | null {
    const providers: MediaSearchProvider[] = ['unsplash', 'pexels', 'pixabay'];
    return providers.find((provider) => Boolean(encryptedApiKeys[provider])) ?? null
}

export async function saveApiKeyForProvider(provider: MediaSearchProvider, apiKey: string): Promise<void> {
    const {persisted, encryptedApiKeys} = await loadPersistedConfig();
    const updatedKeys = {...encryptedApiKeys};
    const currentProvider = persisted.provider ?? DEFAULT_CONFIG.provider;
    const shouldPromoteProvider = Boolean(apiKey) && (!updatedKeys[currentProvider] || currentProvider === provider);

    if (apiKey) {
        updatedKeys[provider] = encryptApiKey(apiKey)
    } else {
        delete updatedKeys[provider]
    }

    const nextProvider = shouldPromoteProvider
        ? provider
        : getFirstConfiguredMediaProvider(updatedKeys) ?? currentProvider;
    const nextEnabled = Object.keys(updatedKeys).length > 0
        ? persisted.enabled || shouldPromoteProvider
        : false;

    await fs.writeFile(getConfigPath(), JSON.stringify({
        enabled: nextEnabled,
        provider: nextProvider,
        encryptedApiKeys: updatedKeys
    }, null, 2), 'utf-8')
}

export async function clearApiKeyForProvider(provider: MediaSearchProvider): Promise<void> {
    await saveApiKeyForProvider(provider, '')
}
