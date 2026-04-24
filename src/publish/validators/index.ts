import type {ExportedFile, ValidationResult} from '../types'
import {CLOUDFLARE_PAGES_ALLOWED_EXTENSIONS, validateForCloudflarePages} from './cloudflareValidator'
import {validateForGithubPages} from './githubPagesValidator'
import {NEOCITIES_ALLOWED_EXTENSIONS, validateForNeocities} from './neocitiesValidator'
import {validateForAwsS3} from './awsS3Validator'

export { getFileExtension, isExternalUrl, extractExternalUrls } from './validationHelpers'
export { validateForNeocities, NEOCITIES_ALLOWED_EXTENSIONS } from './neocitiesValidator'
export {
  validateForCloudflarePages,
  CLOUDFLARE_PAGES_ALLOWED_EXTENSIONS
} from './cloudflareValidator'
export { validateForGithubPages } from './githubPagesValidator'
export { validateForAwsS3 } from './awsS3Validator'

export class UnknownProviderError extends Error {
  constructor(providerId: string) {
    super(`Unknown publish provider "${providerId}".`);
    this.name = 'UnknownProviderError'
  }
}

export function validateForProvider(providerId: string, files: ExportedFile[]): ValidationResult {
  switch (providerId) {
    case 'neocities':
      return validateForNeocities(files);
    case 'cloudflare-pages':
      return validateForCloudflarePages(files);
    case 'github-pages':
      return validateForGithubPages(files);
    case 'aws-s3':
      return validateForAwsS3(files);
    default:
      throw new UnknownProviderError(providerId)
  }
}

