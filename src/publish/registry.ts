import type {PublisherExtension} from './types/PublisherExtension'
import {PUBLISHER_EXTENSION_API_VERSION} from './types/index'

// ─── Errors ──────────────────────────────────────────────────────────────────

export class PublisherVersionMismatchError extends Error {
  constructor(providerId: string, received: string) {
    super(
      `Publisher "${providerId}" has apiVersion "${received}" but the host ` +
      `requires "${PUBLISHER_EXTENSION_API_VERSION}". ` +
      `Update the extension to match the current API version.`
    )
    this.name = 'PublisherVersionMismatchError'
  }
}

export class DuplicatePublisherError extends Error {
  constructor(providerId: string) {
    super(`A publisher with id "${providerId}" is already registered.`)
    this.name = 'DuplicatePublisherError'
  }
}

// ─── Registry ────────────────────────────────────────────────────────────────

const publishers = new Map<string, PublisherExtension>()

/**
 * Register a publisher extension.
 *
 * Throws `PublisherVersionMismatchError` if the extension's `apiVersion` does
 * not match `PUBLISHER_EXTENSION_API_VERSION`.
 *
 * Throws `DuplicatePublisherError` if an extension with the same `meta.id` is
 * already registered.
 */
export function registerPublisher(ext: PublisherExtension): void {
  if (ext.apiVersion !== PUBLISHER_EXTENSION_API_VERSION) {
    throw new PublisherVersionMismatchError(ext.meta.id, ext.apiVersion)
  }
  if (publishers.has(ext.meta.id)) {
    throw new DuplicatePublisherError(ext.meta.id)
  }
  publishers.set(ext.meta.id, ext)
}

/** Return a registered publisher by its `meta.id`, or `undefined`. */
export function getPublisher(id: string): PublisherExtension | undefined {
  return publishers.get(id)
}

/** Return all registered publishers. */
export function getAllPublishers(): PublisherExtension[] {
  return Array.from(publishers.values())
}
