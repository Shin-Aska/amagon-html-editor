// ─── Public API for the publish subsystem ────────────────────────────────────

// Types
export type {
  PublisherExtensionVersion,
  ExportedFile,
  ValidationSeverity,
  ValidationIssue,
  ValidationResult,
  PublishCredentials,
  CredentialField,
  PublishProgress,
  PublishResult,
  ProviderMeta
} from './types/index'

export { PUBLISHER_EXTENSION_API_VERSION } from './types/index'

export type { PublisherExtension } from './types/PublisherExtension'

// Registry
export {
  registerPublisher,
  getPublisher,
  getAllPublishers,
  PublisherVersionMismatchError,
  DuplicatePublisherError
} from './registry'

// Validators
export { validateForProvider, UnknownProviderError } from './validators'
