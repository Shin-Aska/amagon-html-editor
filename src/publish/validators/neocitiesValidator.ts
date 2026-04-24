import type {ExportedFile, ValidationIssue, ValidationResult} from '../types/index'
import {extractExternalUrls, getFileExtension, makeError, makeWarning} from './validationHelpers'

export const NEOCITIES_ALLOWED_EXTENSIONS: readonly string[] = [
  '.html',
  '.htm',
  '.css',
  '.js',
  '.json',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  '.ico',
  '.webp',
  '.avif',
  '.md',
  '.markdown',
  '.txt',
  '.csv',
  '.tsv',
  '.xml',
  '.ttf',
  '.woff',
  '.woff2',
  '.otf',
  '.eot',
  '.pdf'
];

export function validateForNeocities(files: ExportedFile[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const file of files) {
    const extension = getFileExtension(file.path);

    if (!NEOCITIES_ALLOWED_EXTENSIONS.includes(extension)) {
      issues.push(
        makeError(
          `Unsupported file type "${extension || '(no extension)'}" for Neocities.`,
          file.path,
          'Remove this file, replace it with a supported type, or host it on another provider.'
        )
      )
    }

    if ((extension === '.html' || extension === '.htm') && typeof file.content === 'string') {
      const externalUrls = extractExternalUrls(file.content);
      for (const url of externalUrls) {
        issues.push(
          makeWarning(
            `External dependency detected: ${url}. Neocities may block or throttle hotlinked assets.`,
            file.path,
            'Import this asset into your project and reference it locally when possible.'
          )
        )
      }
    }
  }

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  return {
    ok: errorCount === 0,
    issues
  }
}

