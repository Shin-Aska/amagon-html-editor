import {zipSync} from 'fflate'
import type {
    CredentialField,
    ExportedFile,
    ProviderMeta,
    PublishCredentials,
    PublishProgress,
    PublishResult,
    ValidationIssue,
    ValidationResult
} from '../../types/index'
import {PUBLISHER_EXTENSION_API_VERSION} from '../../types/index'
import type {PublisherExtension} from '../../types/PublisherExtension'
import {validateForCloudflarePages} from '../../validators/cloudflareValidator'

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4'
const MAX_POLL_ATTEMPTS = 12
const POLL_INTERVAL_MS = 2500

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.?\//, '')
}

function toBytes(content: string | Uint8Array): Uint8Array {
  if (content instanceof Uint8Array) {
    return content
  }
  return new TextEncoder().encode(content)
}

function toArrayBuffer(content: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(content.byteLength)
  new Uint8Array(buffer).set(content)
  return buffer
}

function createZip(files: ExportedFile[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  for (const file of files) {
    const safePath = normalizePath(file.path)
    entries[safePath] = toBytes(file.content)
  }
  return zipSync(entries, { level: 6 })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function credentialIssue(label: string): ValidationIssue {
  return {
    severity: 'error',
    message: `${label} is required to publish to Cloudflare Pages.`
  }
}

export class CloudflarePagesAdapter implements PublisherExtension {
  readonly apiVersion = PUBLISHER_EXTENSION_API_VERSION

  readonly meta: ProviderMeta = {
    id: 'cloudflare-pages',
    displayName: 'Cloudflare Pages',
    websiteUrl: 'https://pages.cloudflare.com',
    description: 'Fast, scalable static hosting with global CDN'
  }

  readonly credentialFields: CredentialField[] = [
    { key: 'apiToken', label: 'API Token', sensitive: true },
    { key: 'accountId', label: 'Account ID', sensitive: false },
    { key: 'projectName', label: 'Project Name', sensitive: false }
  ]

  async validate(
    files: ExportedFile[],
    credentials: PublishCredentials
  ): Promise<ValidationResult> {
    const baseResult = validateForCloudflarePages(files)
    const issues: ValidationIssue[] = [...baseResult.issues]

    if (!credentials.apiToken) {
      issues.push(credentialIssue('API Token'))
    }
    if (!credentials.accountId) {
      issues.push(credentialIssue('Account ID'))
    }
    if (!credentials.projectName) {
      issues.push(credentialIssue('Project Name'))
    }

    const ok = issues.every((issue) => issue.severity !== 'error')
    return { ok, issues }
  }

  async publish(
    files: ExportedFile[],
    credentials: PublishCredentials,
    onProgress: (progress: PublishProgress) => void
  ): Promise<PublishResult> {
    onProgress({
      phase: 'validating',
      percent: 0,
      message: 'Validating files...'
    })

    const validation = await this.validate(files, credentials)
    if (!validation.ok) {
      return {
        success: false,
        error: 'Validation failed',
        warnings: validation.issues
      }
    }

    onProgress({
      phase: 'uploading',
      percent: 10,
      message: 'Creating deployment...'
    })

    const zipData = createZip(files)
    const form = new FormData()
    form.append(
      'file',
      new Blob([toArrayBuffer(zipData)], { type: 'application/zip' }),
      'site.zip'
    )

    const apiToken = credentials.apiToken
    const accountId = credentials.accountId
    const projectName = credentials.projectName
    const url = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects/${projectName}/deployments`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`
      },
      body: form
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.success === false) {
      const apiMessage =
        payload?.errors?.[0]?.message ||
        payload?.message ||
        response.statusText ||
        'Cloudflare Pages upload failed'
      return { success: false, error: apiMessage, warnings: [] }
    }

    const deploymentId = payload?.result?.id as string | undefined
    if (deploymentId) {
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        await sleep(POLL_INTERVAL_MS)
        const pollResponse = await fetch(
          `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects/${projectName}/deployments/${deploymentId}`,
          {
            headers: {
              Authorization: `Bearer ${apiToken}`
            }
          }
        )

        const pollPayload = await pollResponse.json().catch(() => null)
        const status =
          pollPayload?.result?.status ||
          pollPayload?.result?.deployment_status ||
          'unknown'

        const percent =
          20 + Math.round(((attempt + 1) / MAX_POLL_ATTEMPTS) * 70)
        onProgress({
          phase: 'uploading',
          percent,
          message: `Deploying... (${status})`
        })

        if (status === 'success' || status === 'active' || status === 'ready') {
          break
        }
        if (status === 'failed' || status === 'error') {
          return {
            success: false,
            error: `Deployment failed: ${status}`,
            warnings: []
          }
        }
      }
    }

    onProgress({ phase: 'done', percent: 100, message: 'Published!' })
    return {
      success: true,
      url: `https://${projectName}.pages.dev`,
      warnings: validation.issues
    }
  }
}
