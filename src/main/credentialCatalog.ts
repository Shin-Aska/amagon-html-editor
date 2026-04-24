import type {CredentialField, PublishCredentials} from '../publish'
import {getAllPublishers} from '../publish'
import {
    type AiProvider,
    clearApiKeyForProvider as clearAiApiKeyForProvider,
    loadAllProviderCredentials as loadAllAiProviderCredentials,
    loadApiKeyForProvider as loadAiApiKeyForProvider,
    maskApiKey,
    MASKED_KEY_PREFIX,
    saveApiKeyForProvider as saveAiApiKeyForProvider
} from './aiService'
import {
    clearApiKeyForProvider as clearMediaApiKeyForProvider,
    loadAllProviderCredentials as loadAllMediaProviderCredentials,
    loadApiKeyForProvider as loadMediaApiKeyForProvider,
    type MediaSearchProvider,
    saveApiKeyForProvider as saveMediaApiKeyForProvider
} from './mediaSearchService'
import {
    deletePublishCredentials,
    listConfiguredProviders,
    loadPublishCredentials,
    savePublishCredentials
} from './publishCredentials'

export type CredentialCategory = 'ai' | 'multimedia' | 'publisher'

export interface CredentialDefinition {
  id: string
  category: CredentialCategory
  categoryLabel: string
  providerId: string
  label: string
  description: string
  fields: CredentialField[]
}

export interface CredentialRecord {
  id: string
  category: CredentialCategory
  categoryLabel: string
  label: string
  source: CredentialCategory
  providerId: string
  provider: string
  description: string
  fields: CredentialField[]
  values: PublishCredentials
  maskedKey: string
  hasKey: boolean
}

const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  ollama: 'Ollama',
  mistral: 'Mistral',
  'claude-cli': 'Claude CLI',
  'codex-cli': 'Codex CLI',
  'gemini-cli': 'Gemini CLI',
  'github-cli': 'GitHub Copilot CLI',
  'junie-cli': 'Junie CLI',
  'opencode-cli': 'Opencode CLI'
};

const MEDIA_PROVIDER_LABELS: Record<MediaSearchProvider, string> = {
  unsplash: 'Unsplash',
  pexels: 'Pexels',
  pixabay: 'Pixabay'
};

function createDefinition(
  category: CredentialCategory,
  providerId: string,
  label: string,
  description: string,
  fields: CredentialField[]
): CredentialDefinition {
  const categoryLabel =
    category === 'ai' ? 'AI' : category === 'multimedia' ? 'Multimedia' : 'Publisher';

  return {
    id: `${category}:${providerId}`,
    category,
    categoryLabel,
    providerId,
    label,
    description,
    fields
  }
}

export function getCredentialDefinitions(): CredentialDefinition[] {
  const aiDefinitions: CredentialDefinition[] = (
    Object.entries(AI_PROVIDER_LABELS) as [AiProvider, string][]
  ).map(([providerId, label]) => {
    const isCliProvider = providerId.endsWith('-cli');
    return createDefinition(
      'ai',
      providerId,
      label,
      isCliProvider
        ? `Authenticated via the ${label}. No API key needed.`
        : `Credential for ${label} in the AI Assistant.`,
      isCliProvider
        ? []
        : [
            {
              key: 'apiKey',
              label: providerId === 'ollama' ? 'API Key (Optional)' : 'API Key',
              placeholder:
                providerId === 'ollama'
                  ? 'Leave blank if your Ollama server is open'
                  : 'Enter API key',
              sensitive: true
            }
          ]
    )
  });

  const mediaDefinitions: CredentialDefinition[] = (
    Object.entries(MEDIA_PROVIDER_LABELS) as [MediaSearchProvider, string][]
  ).map(([providerId, label]) =>
    createDefinition(
      'multimedia',
      providerId,
      label,
      `Credential for ${label} media search.`,
      [
        {
          key: 'apiKey',
          label: label === 'Unsplash' ? 'Access Key' : 'API Key',
          placeholder: `Enter ${label} API key`,
          sensitive: true
        }
      ]
    )
  );

  const publisherDefinitions: CredentialDefinition[] = getAllPublishers().map((publisher) =>
    createDefinition(
      'publisher',
      publisher.meta.id,
      publisher.meta.displayName,
      publisher.meta.description,
      publisher.credentialFields.map((field) => ({ ...field }))
    )
  );

  return [...aiDefinitions, ...mediaDefinitions, ...publisherDefinitions]
}

export function getCredentialDefinitionById(id: string): CredentialDefinition | undefined {
  return getCredentialDefinitions().find((definition) => definition.id === id)
}

function pickMaskedKey(fields: CredentialField[], values: PublishCredentials): string {
  const sensitiveField = fields.find((field) => field.sensitive && values[field.key]);
  return sensitiveField ? values[sensitiveField.key] ?? '' : ''
}

export async function listCredentialRecords(): Promise<CredentialRecord[]> {
  const definitions = getCredentialDefinitions();
  const aiCredentials = await loadAllAiProviderCredentials();
  const mediaCredentials = await loadAllMediaProviderCredentials();
  const publishProviders = await listConfiguredProviders();
  const publishRecords = await Promise.all(
    publishProviders.map(async (providerId): Promise<CredentialRecord | null> => {
      const definition = definitions.find((item) => item.id === `publisher:${providerId}`);
      if (!definition) return null;

      const stored = await loadPublishCredentials(providerId);
      const values = definition.fields.reduce<PublishCredentials>((acc, field) => {
        const value = stored[field.key] ?? '';
        acc[field.key] = field.sensitive ? maskApiKey(value) : value;
        return acc
      }, {});

      return {
        ...definition,
        source: definition.category,
        provider: definition.label,
        values,
        maskedKey: pickMaskedKey(definition.fields, values),
        hasKey: definition.fields.some((field) => Boolean(stored[field.key]))
      } satisfies CredentialRecord
    })
  );

  const aiRecords: CredentialRecord[] = aiCredentials
    .map((credential): CredentialRecord | null => {
      const definition = definitions.find((item) => item.id === `ai:${credential.provider}`);
      if (!definition) return null;
      const isCliProvider = credential.provider.endsWith('-cli');
      const values: PublishCredentials = { apiKey: credential.maskedKey };
      return {
        ...definition,
        source: definition.category,
        provider: definition.label,
        values,
        maskedKey: credential.maskedKey,
        hasKey: isCliProvider ? true : credential.hasKey
      } satisfies CredentialRecord
    })
    .filter((record): record is CredentialRecord => record !== null);

  const mediaRecords: CredentialRecord[] = mediaCredentials
    .map((credential): CredentialRecord | null => {
      const definition = definitions.find((item) => item.id === `multimedia:${credential.provider}`);
      if (!definition) return null;
      const values: PublishCredentials = { apiKey: credential.maskedKey };
      return {
        ...definition,
        source: definition.category,
        provider: definition.label,
        values,
        maskedKey: credential.maskedKey,
        hasKey: credential.hasKey
      } satisfies CredentialRecord
    })
    .filter((record): record is CredentialRecord => record !== null);

  return [...aiRecords, ...mediaRecords, ...publishRecords.filter((record): record is CredentialRecord => record !== null)]
}

export async function getCredentialValues(id: string): Promise<PublishCredentials> {
  const definition = getCredentialDefinitionById(id);
  if (!definition) return {};

  if (definition.category === 'publisher') {
    const stored = await loadPublishCredentials(definition.providerId);
    return definition.fields.reduce<PublishCredentials>((acc, field) => {
      const value = stored[field.key] ?? '';
      acc[field.key] = field.sensitive ? maskApiKey(value) : value;
      return acc
    }, {})
  }

  const records = await listCredentialRecords();
  const record = records.find((item) => item.id === id);
  return record?.values ?? {}
}

function mergeSensitiveFields(
  fields: CredentialField[],
  existing: PublishCredentials,
  incoming: PublishCredentials
): PublishCredentials {
  const merged: PublishCredentials = {};

  for (const field of fields) {
    const nextValue = incoming[field.key];
    if (field.sensitive && typeof nextValue === 'string' && nextValue.startsWith(MASKED_KEY_PREFIX)) {
      merged[field.key] = existing[field.key] ?? ''
    } else if (typeof nextValue === 'string') {
      merged[field.key] = nextValue
    } else {
      merged[field.key] = existing[field.key] ?? ''
    }
  }

  return merged
}

export async function saveCredentialRecord(id: string, values: PublishCredentials): Promise<void> {
  const definition = getCredentialDefinitionById(id);
  if (!definition) {
    throw new Error(`Unknown credential: ${id}`)
  }

  if (definition.category === 'ai') {
    if (definition.providerId.endsWith('-cli')) {
      return // No-op for CLI providers
    }
    const nextApiKey = typeof values.apiKey === 'string' ? values.apiKey : '';
    const existing = { apiKey: await loadAiApiKeyForProvider(definition.providerId as AiProvider) };
    const merged = mergeSensitiveFields(definition.fields, existing, { apiKey: nextApiKey });
    await saveAiApiKeyForProvider(definition.providerId as AiProvider, merged.apiKey ?? '');
    return
  }

  if (definition.category === 'multimedia') {
    const nextApiKey = typeof values.apiKey === 'string' ? values.apiKey : '';
    const existing = { apiKey: await loadMediaApiKeyForProvider(definition.providerId as MediaSearchProvider) };
    const merged = mergeSensitiveFields(definition.fields, existing, { apiKey: nextApiKey });
    await saveMediaApiKeyForProvider(definition.providerId as MediaSearchProvider, merged.apiKey ?? '');
    return
  }

  const existing = await loadPublishCredentials(definition.providerId);
  const merged = mergeSensitiveFields(definition.fields, existing, values);
  await savePublishCredentials(definition.providerId, merged)
}

export async function deleteCredentialRecord(id: string): Promise<void> {
  const definition = getCredentialDefinitionById(id);
  if (!definition) {
    throw new Error(`Unknown credential: ${id}`)
  }

  if (definition.category === 'ai') {
    if (definition.providerId.endsWith('-cli')) {
      return // No-op for CLI providers
    }
    await clearAiApiKeyForProvider(definition.providerId as AiProvider);
    return
  }

  if (definition.category === 'multimedia') {
    await clearMediaApiKeyForProvider(definition.providerId as MediaSearchProvider);
    return
  }

  await deletePublishCredentials(definition.providerId)
}

export function resolveSensitiveValues(
  fields: CredentialField[],
  stored: PublishCredentials,
  incoming: PublishCredentials = {}
): PublishCredentials {
  return mergeSensitiveFields(fields, stored, incoming)
}
