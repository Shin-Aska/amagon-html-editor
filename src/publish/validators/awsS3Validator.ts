import type { ExportedFile, ValidationIssue, ValidationResult } from '../types/index'
import {
  extractExternalUrls,
  getFileExtension,
  makeError,
  makeWarning
} from './validationHelpers'

const MAX_FILE_BYTES = 50 * 1024 * 1024
const MAX_KEY_LENGTH = 1024

function getByteSize(content: string | Uint8Array): number {
  if (typeof content === 'string') {
    return new TextEncoder().encode(content).length
  }
  return content.byteLength
}

export function validateForAwsS3(files: ExportedFile[]): ValidationResult {
  const issues: ValidationIssue[] = []

  for (const file of files) {
    const size = getByteSize(file.content)
    if (size > MAX_FILE_BYTES) {
      issues.push(
        makeError(
          `File exceeds 50 MB limit (${(size / 1024 / 1024).toFixed(2)} MB).`,
          file.path,
          'Compress this file or host it externally.'
        )
      )
    }

    if (file.path.length > MAX_KEY_LENGTH) {
      issues.push(
        makeError(
          `S3 object key exceeds ${MAX_KEY_LENGTH} character limit.`,
          file.path,
          'Shorten the file path.'
        )
      )
    }

    const extension = getFileExtension(file.path)
    if ((extension === '.html' || extension === '.htm') && typeof file.content === 'string') {
      const externalUrls = extractExternalUrls(file.content)
      for (const url of externalUrls) {
        issues.push(
          makeWarning(
            `External dependency detected: ${url}. Availability depends on a third-party host.`,
            file.path,
            'Prefer local assets for predictable site reliability.'
          )
        )
      }
    }
  }

  const errorCount = issues.filter((issue) => issue.severity === 'error').length
  return {
    ok: errorCount === 0,
    issues
  }
}
