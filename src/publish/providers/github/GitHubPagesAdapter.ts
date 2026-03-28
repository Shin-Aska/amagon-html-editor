import { PUBLISHER_EXTENSION_API_VERSION, type ExportedFile, type PublishCredentials, type PublishProgress, type PublishResult, type ValidationIssue, type ValidationResult } from '../../types/index'
import type { PublisherExtension } from '../../types/PublisherExtension'
import { validateForGithubPages } from '../../validators/githubPagesValidator'
import { makeError } from '../../validators/validationHelpers'

const GITHUB_API_BASE_URL = 'https://api.github.com'
const COMMIT_MESSAGE = 'Publish via Amagon'

interface GitHubUserResponse {
  login: string
}

interface GitHubRepoResponse {
  default_branch: string
}

interface GitHubRefResponse {
  object?: {
    sha?: string
  }
}

interface GitHubContentResponse {
  sha?: string
}

interface GitHubApiErrorPayload {
  message?: string
}

interface GitHubApiSuccess<T> {
  ok: true
  data: T
}

interface GitHubApiFailure {
  ok: false
  status: number
  message: string
}

type GitHubApiResult<T> = GitHubApiSuccess<T> | GitHubApiFailure

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function encodeGitHubContentPath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function toBase64Content(file: ExportedFile): string {
  if (typeof file.content === 'string') {
    return Buffer.from(file.content, 'utf8').toString('base64')
  }

  return Buffer.from(file.content).toString('base64')
}

function getValidationErrors(credentials: PublishCredentials): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isNonEmptyString(credentials.pat)) {
    issues.push(makeError('GitHub Personal Access Token is required.', undefined, 'Provide a token with repository write access.'))
  }
  if (!isNonEmptyString(credentials.owner)) {
    issues.push(makeError('GitHub owner is required.', undefined, 'Enter the GitHub username or organization that owns the repository.'))
  }
  if (!isNonEmptyString(credentials.repo)) {
    issues.push(makeError('GitHub repository name is required.', undefined, 'Enter the target repository name.'))
  }
  if (!isNonEmptyString(credentials.branch)) {
    issues.push(makeError('GitHub branch is required.', undefined, 'Enter the branch that GitHub Pages should publish from, such as gh-pages.'))
  }

  return issues
}

async function parseGitHubResponse<T>(response: Response): Promise<GitHubApiResult<T>> {
  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    const message = typeof payload === 'string'
      ? payload
      : (payload as GitHubApiErrorPayload)?.message ?? `GitHub API request failed with status ${response.status}.`

    return {
      ok: false,
      status: response.status,
      message
    }
  }

  return {
    ok: true,
    data: payload as T
  }
}

async function githubRequest<T>(
  path: string,
  pat: string,
  init: RequestInit = {}
): Promise<GitHubApiResult<T>> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/vnd.github+json')
  headers.set('Authorization', `token ${pat}`)
  headers.set('User-Agent', 'Amagon-HTML-Editor')
  headers.set('X-GitHub-Api-Version', '2022-11-28')

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
    ...init,
    headers
  })

  return parseGitHubResponse<T>(response)
}

export class GitHubPagesAdapter implements PublisherExtension {
  readonly apiVersion = PUBLISHER_EXTENSION_API_VERSION

  readonly meta = {
    id: 'github-pages',
    displayName: 'GitHub Pages',
    websiteUrl: 'https://pages.github.com',
    description: 'Free static hosting from a GitHub repository branch'
  }

  readonly credentialFields = [
    { key: 'pat', label: 'Personal Access Token', sensitive: true },
    { key: 'owner', label: 'GitHub Username / Org', sensitive: false },
    { key: 'repo', label: 'Repository Name', sensitive: false },
    { key: 'branch', label: 'Branch (e.g. gh-pages)', sensitive: false }
  ]

  async validate(files: ExportedFile[], credentials: PublishCredentials): Promise<ValidationResult> {
    const baseResult = validateForGithubPages(files)
    const credentialIssues = getValidationErrors(credentials)
    const issues = [...baseResult.issues, ...credentialIssues]

    return {
      ok: credentialIssues.length === 0,
      issues
    }
  }

  async publish(
    files: ExportedFile[],
    credentials: PublishCredentials,
    onProgress: (progress: PublishProgress) => void
  ): Promise<PublishResult> {
    onProgress({
      phase: 'validating',
      percent: 0,
      message: 'Validating files and credentials...'
    })

    const validation = await this.validate(files, credentials)
    if (!validation.ok) {
      return {
        success: false,
        error: 'Validation failed',
        warnings: validation.issues
      }
    }

    const pat = credentials.pat.trim()
    const owner = credentials.owner.trim()
    const repo = credentials.repo.trim()
    const branch = credentials.branch.trim()

    onProgress({
      phase: 'uploading',
      percent: 5,
      message: 'Connecting to GitHub...'
    })

    try {
      const userResult = await githubRequest<GitHubUserResponse>('/user', pat)
      if (!userResult.ok) {
        return {
          success: false,
          error: userResult.message,
          warnings: validation.issues
        }
      }

      const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
      const repoResult = await githubRequest<GitHubRepoResponse>(repoPath, pat)
      if (!repoResult.ok) {
        return {
          success: false,
          error: repoResult.message,
          warnings: validation.issues
        }
      }

      const branchRefPath = `${repoPath}/git/ref/heads/${encodeURIComponent(branch)}`
      const branchRefResult = await githubRequest<GitHubRefResponse>(branchRefPath, pat)

      if (!branchRefResult.ok) {
        if (branchRefResult.status !== 404) {
          return {
            success: false,
            error: branchRefResult.message,
            warnings: validation.issues
          }
        }

        const defaultBranch = repoResult.data.default_branch
        const defaultBranchRefResult = await githubRequest<GitHubRefResponse>(
          `${repoPath}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
          pat
        )

        if (!defaultBranchRefResult.ok) {
          return {
            success: false,
            error: defaultBranchRefResult.message,
            warnings: validation.issues
          }
        }

        const baseSha = defaultBranchRefResult.data.object?.sha
        if (!baseSha) {
          return {
            success: false,
            error: `Could not determine the HEAD SHA for the default branch "${defaultBranch}".`,
            warnings: validation.issues
          }
        }

        const createBranchResult = await githubRequest<{ ref: string }>(
          `${repoPath}/git/refs`,
          pat,
          {
            method: 'POST',
            body: JSON.stringify({
              ref: `refs/heads/${branch}`,
              sha: baseSha
            })
          }
        )

        if (!createBranchResult.ok) {
          return {
            success: false,
            error: createBranchResult.message,
            warnings: validation.issues
          }
        }
      }

      const totalFiles = files.length

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const encodedPath = encodeGitHubContentPath(file.path)
        const contentPath = `${repoPath}/contents/${encodedPath}`

        const existingFileResult = await githubRequest<GitHubContentResponse>(
          `${contentPath}?ref=${encodeURIComponent(branch)}`,
          pat
        )

        if (!existingFileResult.ok && existingFileResult.status !== 404) {
          return {
            success: false,
            error: existingFileResult.message,
            warnings: validation.issues
          }
        }

        const existingSha = existingFileResult.ok ? existingFileResult.data.sha : undefined
        const uploadResult = await githubRequest<{ content: { path: string } }>(
          contentPath,
          pat,
          {
            method: 'PUT',
            body: JSON.stringify({
              message: COMMIT_MESSAGE,
              content: toBase64Content(file),
              sha: existingSha,
              branch
            })
          }
        )

        if (!uploadResult.ok) {
          return {
            success: false,
            error: uploadResult.message,
            warnings: validation.issues
          }
        }

        const progressPercent = totalFiles === 0
          ? 95
          : Math.round(((index + 1) / totalFiles) * 90) + 5

        onProgress({
          phase: 'uploading',
          percent: Math.min(progressPercent, 95),
          message: `Uploaded ${index + 1} of ${totalFiles} files to ${owner}/${repo}.`
        })
      }

      onProgress({
        phase: 'done',
        percent: 100,
        message: `Published as ${userResult.data.login}.`
      })

      return {
        success: true,
        url: `https://${owner}.github.io/${repo}`,
        warnings: validation.issues
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected GitHub Pages publish failure.',
        warnings: validation.issues
      }
    }
  }
}
