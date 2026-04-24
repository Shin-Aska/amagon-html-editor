// ─── Publisher Extension Types ───────────────────────────────────────────────

/** Semver-style version string for the publisher extension API. */
export type PublisherExtensionVersion = '1.0'

/** Current API version all extensions must match to register. */
export const PUBLISHER_EXTENSION_API_VERSION: PublisherExtensionVersion = '1.0';

// Re-export ExportFile so publisher code can reference it without reaching
// into renderer internals.  The shape is intentionally duplicated here to
// keep the publish package self-contained; the renderer export engine also
// exports this identical interface.
export interface ExportedFile {
  path: string
  content: string | Uint8Array
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  severity: ValidationSeverity
  filePath?: string
  message: string
  suggestion?: string
}

export interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
}

// ─── Credentials ─────────────────────────────────────────────────────────────

/** Generic key-value bag for provider tokens / API keys. */
export type PublishCredentials = Record<string, string>

export interface CredentialField {
  key: string
  label: string
  placeholder?: string
  helpUrl?: string
  sensitive: boolean
}

// ─── Progress & Result ───────────────────────────────────────────────────────

export interface PublishProgress {
  phase: 'validating' | 'exporting' | 'uploading' | 'done'
  percent: number
  message: string
}

export interface PublishResult {
  success: boolean
  url?: string
  error?: string
  warnings: ValidationIssue[]
}

// ─── Provider Metadata ───────────────────────────────────────────────────────

export interface ProviderMeta {
  id: string
  displayName: string
  websiteUrl: string
  description: string
}
