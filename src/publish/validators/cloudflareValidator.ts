import type {ExportedFile, ValidationIssue, ValidationResult} from '../types/index'
import {extractExternalUrls, getFileExtension, makeError, makeWarning} from './validationHelpers'

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_FILE_COUNT = 500

export const CLOUDFLARE_PAGES_ALLOWED_EXTENSIONS: readonly string[] = [
  '.html',
  '.htm',
  '.css',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.map',
  '.txt',
  '.md',
  '.xml',
  '.csv',
  '.tsv',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  '.ico',
  '.webp',
  '.avif',
  '.bmp',
  '.tiff',
  '.ttf',
  '.woff',
  '.woff2',
  '.otf',
  '.eot',
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.ogg',
  '.ogv',
  '.mp3',
  '.wav',
  '.m4a',
  '.aac',
  '.flac',
  '.pdf'
]

function getByteSize(content: string | Uint8Array): number {
  if (typeof content === 'string') {
    return new TextEncoder().encode(content).length
  }
  return content.byteLength
}

export function validateForCloudflarePages(files: ExportedFile[]): ValidationResult {
  const issues: ValidationIssue[] = []

  if (files.length > MAX_FILE_COUNT) {
    issues.push(
      makeError(
        `Project has ${files.length} files, exceeding Cloudflare Pages free-tier limit of ${MAX_FILE_COUNT}.`,
        undefined,
        'Reduce exported file count or split assets across providers.'
      )
    )
  }

  for (const file of files) {
    const size = getByteSize(file.content)
    if (size > MAX_FILE_BYTES) {
      issues.push(
        makeError(
          `File exceeds 25 MB limit (${(size / 1024 / 1024).toFixed(2)} MB).`,
          file.path,
          'Compress this file or host it externally.'
        )
      )
    }

    const extension = getFileExtension(file.path)
    if ((extension === '.html' || extension === '.htm') && typeof file.content === 'string') {
      const externalUrls = extractExternalUrls(file.content)
      for (const url of externalUrls) {
        issues.push(
          makeWarning(
            `External dependency detected: ${url}. External hosts can fail independently of your deployment.`,
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

