// -----------------------------------------------------------------------------
// Media Search Service — handles configuration for web image/video search
// -----------------------------------------------------------------------------

import * as path from 'path'
import * as fs from 'fs/promises'
import { app, net } from 'electron'
import { encryptApiKey, decryptApiKey, maskApiKey, MASKED_KEY_PREFIX } from './cryptoHelpers'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type MediaSearchProvider = 'unsplash' | 'pexels' | 'pixabay'

export interface MediaSearchConfig {
  enabled: boolean
  provider: MediaSearchProvider
  apiKey: string
}

export interface MediaSearchResult {
  id: string
  url: string
  thumbUrl: string
  previewUrl: string
  alt: string
  photographer?: string
  sourceUrl?: string
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
}

// Re-export crypto helpers so existing imports from mediaSearchService still work
export { encryptApiKey, decryptApiKey, maskApiKey, MASKED_KEY_PREFIX } from './cryptoHelpers'

// -----------------------------------------------------------------------------
// Config persistence
// -----------------------------------------------------------------------------

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'media-search-config.json')
}

export async function loadConfig(): Promise<MediaSearchConfig> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw) as PersistedMediaSearchConfig
    const provider = parsed.provider ?? DEFAULT_CONFIG.provider
    const encryptedApiKeys = { ...(parsed.encryptedApiKeys ?? {}) }

    let apiKey = ''

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
      }
      await fs.writeFile(getConfigPath(), JSON.stringify(migrated, null, 2), 'utf-8')
    }

    return {
      enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
      provider,
      apiKey
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function saveConfig(config: Partial<MediaSearchConfig>): Promise<MediaSearchConfig> {
  const current = await loadConfig()
  const merged: MediaSearchConfig = { ...current, ...config }
  const raw = await loadPersistedConfig()
  const encryptedApiKeys = { ...raw.encryptedApiKeys }

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
  }

  await fs.writeFile(getConfigPath(), JSON.stringify(persisted, null, 2), 'utf-8')
  return merged
}

async function loadPersistedConfig(): Promise<{
  persisted: PersistedMediaSearchConfig
  encryptedApiKeys: Partial<Record<MediaSearchProvider, string>>
}> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw) as PersistedMediaSearchConfig
    const provider = parsed.provider ?? DEFAULT_CONFIG.provider
    const encryptedApiKeys = { ...(parsed.encryptedApiKeys ?? {}) }

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

export async function loadAllProviderCredentials(): Promise<{ provider: MediaSearchProvider; hasKey: boolean; maskedKey: string }[]> {
  const { encryptedApiKeys } = await loadPersistedConfig()
  const providers: MediaSearchProvider[] = ['unsplash', 'pexels', 'pixabay']
  const result: { provider: MediaSearchProvider; hasKey: boolean; maskedKey: string }[] = []

  for (const provider of providers) {
    const encrypted = encryptedApiKeys[provider]
    if (!encrypted) continue
    const key = decryptApiKey(encrypted)
    if (!key) continue
    result.push({
      provider,
      hasKey: true,
      maskedKey: maskApiKey(key)
    })
  }

  return result
}

export async function loadApiKeyForProvider(provider: MediaSearchProvider): Promise<string> {
  const { encryptedApiKeys } = await loadPersistedConfig()
  const encrypted = encryptedApiKeys[provider]
  return encrypted ? decryptApiKey(encrypted) : ''
}

function getFirstConfiguredMediaProvider(
  encryptedApiKeys: Partial<Record<MediaSearchProvider, string>>
): MediaSearchProvider | null {
  const providers: MediaSearchProvider[] = ['unsplash', 'pexels', 'pixabay']
  return providers.find((provider) => Boolean(encryptedApiKeys[provider])) ?? null
}

export async function saveApiKeyForProvider(provider: MediaSearchProvider, apiKey: string): Promise<void> {
  const { persisted, encryptedApiKeys } = await loadPersistedConfig()
  const updatedKeys = { ...encryptedApiKeys }
  const currentProvider = persisted.provider ?? DEFAULT_CONFIG.provider
  const shouldPromoteProvider = Boolean(apiKey) && (!updatedKeys[currentProvider] || currentProvider === provider)

  if (apiKey) {
    updatedKeys[provider] = encryptApiKey(apiKey)
  } else {
    delete updatedKeys[provider]
  }

  const nextProvider = shouldPromoteProvider
    ? provider
    : getFirstConfiguredMediaProvider(updatedKeys) ?? currentProvider
  const nextEnabled = Object.keys(updatedKeys).length > 0
    ? persisted.enabled || shouldPromoteProvider
    : false

  await fs.writeFile(getConfigPath(), JSON.stringify({
    enabled: nextEnabled,
    provider: nextProvider,
    encryptedApiKeys: updatedKeys
  }, null, 2), 'utf-8')
}

export async function clearApiKeyForProvider(provider: MediaSearchProvider): Promise<void> {
  await saveApiKeyForProvider(provider, '')
}

// -----------------------------------------------------------------------------
// Search API implementations
// -----------------------------------------------------------------------------

interface SearchOptions {
  query: string
  perPage?: number
  page?: number
  type?: 'image' | 'video'
}

export async function searchUnsplash(options: SearchOptions, apiKey: string): Promise<MediaSearchResult[]> {
  const { query, perPage = 20, page = 1 } = options
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`

  const response = await net.fetch(url, {
    headers: { Authorization: `Client-ID ${apiKey}` }
  })

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.status}`)
  }

  const data = await response.json() as any
  return (data.results || []).map((item: any) => ({
    id: String(item.id),
    url: item.links?.download || item.urls?.full || item.urls?.regular,
    thumbUrl: item.urls?.small || item.urls?.thumb,
    previewUrl: item.urls?.regular || item.urls?.small,
    alt: item.alt_description || item.description || 'Unsplash image',
    photographer: item.user?.name,
    sourceUrl: item.links?.html
  }))
}

export async function searchPexels(options: SearchOptions, apiKey: string): Promise<MediaSearchResult[]> {
  const { query, perPage = 20, page = 1, type = 'image' } = options
  const endpoint = type === 'video' ? 'videos' : 'search'
  const url = `https://api.pexels.com/v1/${endpoint}?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`

  const response = await net.fetch(url, {
    headers: { Authorization: apiKey }
  })

  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.status}`)
  }

  const data = await response.json() as any
  const results = type === 'video' ? (data.videos || []) : (data.photos || [])
  
  return results.map((item: any) => ({
    id: String(item.id),
    url: type === 'video' ? (item.video_files?.[0]?.link || item.url) : (item.src?.original || item.src?.large),
    thumbUrl: type === 'video' ? item.image : (item.src?.medium || item.src?.small),
    previewUrl: type === 'video' ? item.image : (item.src?.large || item.src?.medium),
    alt: item.alt || `Pexels ${type}`,
    photographer: item.photographer || item.user?.name,
    sourceUrl: item.url
  }))
}

export async function searchPixabay(options: SearchOptions, apiKey: string): Promise<MediaSearchResult[]> {
  const { query, perPage = 20, page = 1, type = 'image' } = options
  const mediaType = type === 'video' ? 'videos' : 'images'
  const url = `https://pixabay.com/api/${type === 'video' ? 'videos/' : ''}?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&safesearch=true`

  const response = await net.fetch(url)

  if (!response.ok) {
    throw new Error(`Pixabay API error: ${response.status}`)
  }

  const data = await response.json() as any
  const results = data.hits || []
  
  return results.map((item: any) => ({
    id: String(item.id),
    url: type === 'video' ? item.videos?.large?.url || item.videos?.medium?.url || item.videos?.small?.url : item.largeImageURL || item.webformatURL,
    thumbUrl: type === 'video' ? item.videos?.tiny?.url || item.videos?.small?.url : item.webformatURL,
    previewUrl: type === 'video' ? item.videos?.medium?.url || item.videos?.small?.url : item.previewURL,
    alt: type === 'video' ? item.tags : item.tags,
    photographer: item.user,
    sourceUrl: item.pageURL
  }))
}

export async function searchMedia(
  options: SearchOptions,
  config: MediaSearchConfig
): Promise<{ results: MediaSearchResult[]; error?: string }> {
  if (!config.enabled) {
    return { results: [], error: 'Media search is disabled' }
  }

  if (!config.apiKey) {
    return { results: [], error: `No API key configured for ${config.provider}` }
  }

  try {
    let results: MediaSearchResult[] = []
    
    switch (config.provider) {
      case 'unsplash':
        if (options.type === 'video') {
          return { results: [], error: 'Unsplash does not support video search. Please use Pexels or Pixabay.' }
        }
        results = await searchUnsplash(options, config.apiKey)
        break
      case 'pexels':
        results = await searchPexels(options, config.apiKey)
        break
      case 'pixabay':
        results = await searchPixabay(options, config.apiKey)
        break
      default:
        return { results: [], error: `Unknown provider: ${config.provider}` }
    }

    return { results }
  } catch (err: any) {
    return { results: [], error: err.message }
  }
}

// -----------------------------------------------------------------------------
// Download and import helper
// -----------------------------------------------------------------------------

export async function downloadAndImportMedia(
  url: string,
  projectDir: string,
  filename?: string
): Promise<{ success: boolean; path?: string; relativePath?: string; error?: string }> {
  try {
    const response = await net.fetch(url)
    if (!response.ok) {
      return { success: false, error: `Download failed: ${response.status}` }
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const buffer = Buffer.from(await response.arrayBuffer())

    // Determine extension from content type or URL
    let ext = '.bin'
    if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) ext = '.jpg'
    else if (contentType.includes('image/png')) ext = '.png'
    else if (contentType.includes('image/gif')) ext = '.gif'
    else if (contentType.includes('image/webp')) ext = '.webp'
    else if (contentType.includes('video/mp4')) ext = '.mp4'
    else if (contentType.includes('video/webm')) ext = '.webm'
    else if (contentType.includes('video/ogg')) ext = '.ogv'

    // Generate filename if not provided
    const baseName = filename || `web-${Date.now()}`
    let finalName = `${baseName}${ext}`

    const assetsDir = path.join(projectDir, 'assets')
    await fs.mkdir(assetsDir, { recursive: true })

    // Handle duplicate names
    let destPath = path.join(assetsDir, finalName)
    let counter = 1
    while (await fs.access(destPath).then(() => true).catch(() => false)) {
      finalName = `${baseName}-${counter}${ext}`
      destPath = path.join(assetsDir, finalName)
      counter++
    }

    await fs.writeFile(destPath, buffer)
    const relativePath = path.relative(projectDir, destPath)

    return {
      success: true,
      path: `app-media://project-asset/${relativePath}`,
      relativePath
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
