import {app} from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import {decryptApiKey, encryptApiKey} from './cryptoHelpers'
import type {PublishCredentials} from '../publish'

type StoredProviderCredentials = Record<string, string>

interface StoredPublishConfigFile {
  version: 1
  providers: Record<string, StoredProviderCredentials>
}

const PUBLISH_CONFIG_FILENAME = 'publish-config.json';

function getPublishConfigPath(): string {
  return path.join(app.getPath('userData'), PUBLISH_CONFIG_FILENAME)
}

function normalizeStoredConfig(raw: unknown): StoredPublishConfigFile {
  if (!raw || typeof raw !== 'object') {
    return { version: 1, providers: {} }
  }

  const record = raw as Record<string, unknown>;
  const providersSource =
    record.providers && typeof record.providers === 'object'
      ? (record.providers as Record<string, unknown>)
      : record;

  const providers: Record<string, StoredProviderCredentials> = {};
  for (const [providerId, value] of Object.entries(providersSource)) {
    if (!value || typeof value !== 'object') continue;

    const providerCredentials: StoredProviderCredentials = {};
    for (const [key, encodedValue] of Object.entries(value as Record<string, unknown>)) {
      if (typeof encodedValue === 'string') {
        providerCredentials[key] = encodedValue
      }
    }
    providers[providerId] = providerCredentials
  }

  return { version: 1, providers }
}

async function readStoredConfig(): Promise<StoredPublishConfigFile> {
  try {
    const raw = await fs.readFile(getPublishConfigPath(), 'utf-8');
    return normalizeStoredConfig(JSON.parse(raw))
  } catch {
    return { version: 1, providers: {} }
  }
}

async function writeStoredConfig(config: StoredPublishConfigFile): Promise<void> {
  await fs.writeFile(
    getPublishConfigPath(),
    JSON.stringify(config, null, 2),
    'utf-8'
  )
}

export async function loadPublishCredentials(providerId: string): Promise<PublishCredentials> {
  const config = await readStoredConfig();
  const stored = config.providers[providerId] ?? {};
  const credentials: PublishCredentials = {};

  for (const [key, encodedValue] of Object.entries(stored)) {
    credentials[key] = decryptApiKey(encodedValue)
  }

  return credentials
}

export async function savePublishCredentials(
  providerId: string,
  credentials: PublishCredentials
): Promise<void> {
  const config = await readStoredConfig();
  const encrypted: StoredProviderCredentials = {};

  for (const [key, value] of Object.entries(credentials)) {
    encrypted[key] = encryptApiKey(value ?? '')
  }

  config.providers[providerId] = encrypted;
  await writeStoredConfig(config)
}

export async function deletePublishCredentials(providerId: string): Promise<void> {
  const config = await readStoredConfig();
  delete config.providers[providerId];
  await writeStoredConfig(config)
}

export async function listConfiguredProviders(): Promise<string[]> {
  const config = await readStoredConfig();
  return Object.entries(config.providers)
    .filter(([, credentials]) => Object.values(credentials).some((value) => Boolean(value)))
    .map(([providerId]) => providerId)
}
