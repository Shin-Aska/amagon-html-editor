import type { ExportedFile, ValidationResult } from '../types/index'
import { validateForCloudflarePages, CLOUDFLARE_PAGES_ALLOWED_EXTENSIONS } from './cloudflareValidator'
import { validateForGithubPages } from './githubPagesValidator'
import { validateForNeocities, NEOCITIES_ALLOWED_EXTENSIONS } from './neocitiesValidator'

export { getFileExtension, isExternalUrl, extractExternalUrls } from './validationHelpers'
export { validateForNeocities, NEOCITIES_ALLOWED_EXTENSIONS } from './neocitiesValidator'
export {
  validateForCloudflarePages,
  CLOUDFLARE_PAGES_ALLOWED_EXTENSIONS
} from './cloudflareValidator'
export { validateForGithubPages } from './githubPagesValidator'

export class UnknownProviderError extends Error {
  constructor(providerId: string) {
    super(`Unknown publish provider "${providerId}".`)
    this.name = 'UnknownProviderError'
  }
}

export function validateForProvider(providerId: string, files: ExportedFile[]): ValidationResult {
  switch (providerId) {
    case 'neocities':
      return validateForNeocities(files)
    case 'cloudflare-pages':
      return validateForCloudflarePages(files)
    case 'github-pages':
      return validateForGithubPages(files)
    default:
      throw new UnknownProviderError(providerId)
  }
}

