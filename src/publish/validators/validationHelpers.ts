import type {ValidationIssue} from '../types/index'

export function getFileExtension(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const fileName = normalizedPath.split('/').pop() ?? ''
  const lastDotIndex = fileName.lastIndexOf('.')

  if (lastDotIndex <= 0) {
    return ''
  }

  return fileName.slice(lastDotIndex).toLowerCase()
}

export function isExternalUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase()
  return (
    trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')
  )
}

export function extractExternalUrls(htmlContent: string): string[] {
  const attrRegex = /\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi
  const urls = new Set<string>()
  let match: RegExpExecArray | null = attrRegex.exec(htmlContent)

  while (match) {
    const candidate = (match[1] ?? match[2] ?? match[3] ?? '').trim()
    if (candidate && isExternalUrl(candidate)) {
      urls.add(candidate)
    }
    match = attrRegex.exec(htmlContent)
  }

  return Array.from(urls)
}

export function makeError(message: string, filePath?: string, suggestion?: string): ValidationIssue {
  return {
    severity: 'error',
    message,
    filePath,
    suggestion
  }
}

export function makeWarning(message: string, filePath?: string, suggestion?: string): ValidationIssue {
  return {
    severity: 'warning',
    message,
    filePath,
    suggestion
  }
}

