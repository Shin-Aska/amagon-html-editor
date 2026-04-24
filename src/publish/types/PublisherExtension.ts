import type {
    CredentialField,
    ExportedFile,
    ProviderMeta,
    PublishCredentials,
    PublisherExtensionVersion,
    PublishProgress,
    PublishResult,
    ValidationResult
} from './index'

/**
 * The interface every publisher extension must implement.
 *
 * Both first-party adapters (Neocities, Cloudflare Pages, GitHub Pages) and
 * user-created extensions implement this interface.  The `apiVersion` field
 * is checked at registration time — a mismatch prevents the extension from
 * loading, protecting against breakage when the host API evolves.
 */
export interface PublisherExtension {
  /** Must equal PUBLISHER_EXTENSION_API_VERSION at registration time. */
  readonly apiVersion: PublisherExtensionVersion

  /** Display metadata shown in the Publish dialog. */
  readonly meta: ProviderMeta

  /** Describes the credential fields the provider needs from the user. */
  readonly credentialFields: CredentialField[]

  /**
   * Validate exported files and credentials before publishing.
   * Returns blocking errors and/or non-blocking warnings.
   */
  validate(
    files: ExportedFile[],
    credentials: PublishCredentials
  ): Promise<ValidationResult>

  /**
   * Upload the exported site to the provider.
   * Must call `onProgress` at least once for the UI to reflect state changes.
   */
  publish(
    files: ExportedFile[],
    credentials: PublishCredentials,
    onProgress: (progress: PublishProgress) => void
  ): Promise<PublishResult>
}
