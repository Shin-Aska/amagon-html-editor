import type {ExportedFile, ValidationIssue, ValidationResult} from '../types/index'
import {extractExternalUrls, getFileExtension, makeWarning} from './validationHelpers'

function isLikelyHtmlFile(filePath: string): boolean {
  const ext = getFileExtension(filePath)
  return ext === '.html' || ext === '.htm'
}

function hasRepositoryRiskyPath(filePath: string): boolean {
  return /[^A-Za-z0-9._/-]/.test(filePath)
}

export function validateForGithubPages(files: ExportedFile[]): ValidationResult {
  const issues: ValidationIssue[] = []
  const htmlFileCount = files.filter((file) => isLikelyHtmlFile(file.path)).length
  const hasCnameFile = files.some((file) => file.path.toUpperCase() === 'CNAME')

  if (htmlFileCount > 1 && !hasCnameFile) {
    issues.push(
      makeWarning(
        'No CNAME file found for a multi-page site. Add one if you plan to use a custom domain.',
        undefined,
        'Create a CNAME file containing your custom domain if needed.'
      )
    )
  }

  for (const file of files) {
    if (hasRepositoryRiskyPath(file.path)) {
      issues.push(
        makeWarning(
          'Path contains spaces or special characters that can cause repository URL/path issues.',
          file.path,
          'Rename files and folders using letters, numbers, dashes, underscores, dots, and slashes only.'
        )
      )
    }

    if (isLikelyHtmlFile(file.path) && typeof file.content === 'string') {
      const externalUrls = extractExternalUrls(file.content)
      for (const url of externalUrls) {
        issues.push(
          makeWarning(
            `External dependency detected: ${url}. Availability depends on a third-party host.`,
            file.path,
            'Vendor this asset locally if you need higher reliability.'
          )
        )
      }
    }
  }

  return {
    ok: true,
    issues
  }
}

