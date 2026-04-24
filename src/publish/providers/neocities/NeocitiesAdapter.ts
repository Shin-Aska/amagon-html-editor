import {net} from 'electron'
import type {
    ExportedFile,
    PublishCredentials,
    PublishProgress,
    PublishResult,
    ValidationIssue,
    ValidationResult
} from '../../types/index'
import {PUBLISHER_EXTENSION_API_VERSION} from '../../types/index'
import type {PublisherExtension} from '../../types/PublisherExtension'
import {validateForNeocities} from '../../validators/neocitiesValidator'
import {makeError} from '../../validators/validationHelpers'

const API_BASE_URL = 'https://neocities.org/api';
const INFO_ENDPOINT = `${API_BASE_URL}/info`;
const UPLOAD_ENDPOINT = `${API_BASE_URL}/upload`;
const UPLOAD_BATCH_SIZE = 10;

interface NeocitiesApiResponse {
  result?: 'success' | 'error'
  message?: string
  info?: {
    sitename?: string
  }
}

function chunkFiles(files: ExportedFile[], size: number): ExportedFile[][] {
  const chunks: ExportedFile[][] = [];
  for (let i = 0; i < files.length; i += size) {
    chunks.push(files.slice(i, i + size))
  }
  return chunks
}

function toArrayBuffer(content: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(content.byteLength);
  new Uint8Array(buffer).set(content);
  return buffer
}

function toBlob(content: string | Uint8Array): Blob {
  if (typeof content === 'string') {
    return new Blob([content])
  }
  return new Blob([toArrayBuffer(content)])
}

async function readJsonSafe(response: Response): Promise<NeocitiesApiResponse | null> {
  try {
    return (await response.json()) as NeocitiesApiResponse
  } catch {
    return null
  }
}

function formatApiError(response: Response, payload: NeocitiesApiResponse | null): string {
  if (payload?.message) {
    return payload.message
  }
  return `Neocities API request failed (${response.status} ${response.statusText})`
}

function progressUpdate(
  onProgress: (progress: PublishProgress) => void,
  percent: number,
  message: string
): void {
  onProgress({ phase: 'uploading', percent, message })
}

export class NeocitiesAdapter implements PublisherExtension {
  readonly apiVersion = PUBLISHER_EXTENSION_API_VERSION;

  readonly meta = {
    id: 'neocities',
    displayName: 'Neocities',
    websiteUrl: 'https://neocities.org',
    description: 'Indie-friendly static site hosting with a simple upload API'
  };

  readonly credentialFields = [
    {
      key: 'apiKey',
      label: 'API Key',
      placeholder: 'your-neocities-api-key',
      helpUrl: 'https://neocities.org/settings#api_key',
      sensitive: true
    }
  ];

  async validate(
    files: ExportedFile[],
    credentials: PublishCredentials
  ): Promise<ValidationResult> {
    const result = validateForNeocities(files);
    const issues: ValidationIssue[] = [...result.issues];

    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      issues.push(
        makeError(
          'Neocities API key is required to publish.',
          undefined,
          'Add your API key from Neocities account settings.'
        )
      )
    }

    const errorCount = issues.filter((issue) => issue.severity === 'error').length;
    return {
      ok: errorCount === 0,
      issues
    }
  }

  async publish(
    files: ExportedFile[],
    credentials: PublishCredentials,
    onProgress: (progress: PublishProgress) => void
  ): Promise<PublishResult> {
    onProgress({ phase: 'validating', percent: 0, message: 'Validating files...' });
    const validation = await this.validate(files, credentials);
    if (!validation.ok) {
      return {
        success: false,
        error: 'Validation failed',
        warnings: validation.issues
      }
    }

    const apiKey = credentials.apiKey.trim();
    onProgress({ phase: 'uploading', percent: 5, message: 'Connecting to Neocities...' });

    const infoResponse = await net.fetch(INFO_ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    const infoPayload = await readJsonSafe(infoResponse);
    if (!infoResponse.ok || infoPayload?.result === 'error') {
      return {
        success: false,
        error: formatApiError(infoResponse, infoPayload),
        warnings: []
      }
    }

    const sitename = infoPayload?.info?.sitename;
    if (!sitename) {
      return {
        success: false,
        error: 'Neocities did not return a sitename for this API key.',
        warnings: []
      }
    }

    const totalFiles = files.length;
    let uploadedFiles = 0;

    for (const batch of chunkFiles(files, UPLOAD_BATCH_SIZE)) {
      const form = new FormData();
      for (const file of batch) {
        form.append(file.path, toBlob(file.content), file.path)
      }

      const uploadResponse = await net.fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: form
      });

      const uploadPayload = await readJsonSafe(uploadResponse);
      if (!uploadResponse.ok || uploadPayload?.result === 'error') {
        return {
          success: false,
          error: formatApiError(uploadResponse, uploadPayload),
          warnings: []
        }
      }

      uploadedFiles += batch.length;
      if (totalFiles > 0) {
        const percent = Math.min(95, Math.round((uploadedFiles / totalFiles) * 90 + 5));
        progressUpdate(onProgress, percent, `Uploaded ${uploadedFiles} of ${totalFiles} files...`)
      }
    }

    onProgress({ phase: 'done', percent: 100, message: 'Published!' });

    return {
      success: true,
      url: `https://${sitename}.neocities.org`,
      warnings: validation.issues
    }
  }
}
