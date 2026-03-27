import { useEffect, useState } from 'react'
import { getApi } from '../../utils/api'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { exportProject } from '../../utils/exportEngine'
import type { ExportedFile, PublishProgress, PublishResult, ValidationResult } from '../../../publish/types'
import './PublishDialog.css'

interface PublishDialogProps {
  open: boolean
  onClose: () => void
}

type Step = 'select' | 'credentials' | 'validating' | 'validated' | 'publishing' | 'result'

export default function PublishDialog({ open, onClose }: PublishDialogProps): JSX.Element | null {
  const api = getApi()

  const [step, setStep] = useState<Step>('select')
  const [providers, setProviders] = useState<PublishProviderInfo[]>([])
  const [selectedProvider, setSelectedProvider] = useState<PublishProviderInfo | null>(null)
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [storedCredentialHints, setStoredCredentialHints] = useState<Record<string, string>>({})
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)
  const [progress, setProgress] = useState<PublishProgress | null>(null)
  const [exportedFiles, setExportedFiles] = useState<ExportedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [bindToProject, setBindToProject] = useState(false)
  const [saveCredentialToApp, setSaveCredentialToApp] = useState(false)

  const getProjectData = useProjectStore((s) => s.getProjectData)
  const updatePage = useProjectStore((s) => s.updatePage)
  const currentPageId = useProjectStore((s) => s.currentPageId)
  const boundPublisherId = useProjectStore((s) => s.boundPublisherId)
  const setPublisherBinding = useProjectStore((s) => s.setPublisherBinding)
  const setPublishResultInStore = useProjectStore((s) => s.setPublishResult)
  const editorBlocks = useEditorStore((s) => s.blocks)
  const customCss = useEditorStore((s) => s.customCss)

  useEffect(() => {
    if (!open) return

    setStep('select')
    setSelectedProvider(null)
    setCredentials({})
    setStoredCredentialHints({})
    setValidationResult(null)
    setPublishResult(null)
    setProgress(null)
    setExportedFiles([])
    setError(null)
    setBindToProject(Boolean(boundPublisherId))
    setSaveCredentialToApp(false)

    api.publish.getProviders().then((list) => {
      setProviders(list)
    })
  }, [open, boundPublisherId])

  useEffect(() => {
    const handler = (nextProgress: PublishProgress) => setProgress(nextProgress)
    const cleanup = api.publish.onProgress(handler)
    return () => {
      cleanup()
    }
  }, [])

  const handleSelectProvider = async (provider: PublishProviderInfo): Promise<void> => {
    setSelectedProvider(provider)
    setError(null)

    const stored = await api.publish.getCredentials(provider.id)
    const initial: Record<string, string> = {}
    const hints: Record<string, string> = {}

    for (const field of provider.credentialFields) {
      const storedValue = stored[field.key] ?? ''
      initial[field.key] = field.sensitive ? '' : storedValue
      hints[field.key] = storedValue
    }

    setCredentials(initial)
    setStoredCredentialHints(hints)
    setBindToProject(boundPublisherId === provider.id)
    setSaveCredentialToApp(false)
    setStep('credentials')
  }

  const buildCredentialPayload = (): Record<string, string> => {
    if (!selectedProvider) return {}

    return selectedProvider.credentialFields.reduce<Record<string, string>>((acc, field) => {
      const value = credentials[field.key] ?? ''
      const storedValue = storedCredentialHints[field.key] ?? ''

      if (field.sensitive && value === '' && storedValue) {
        return acc
      }

      acc[field.key] = value
      return acc
    }, {})
  }

  const buildExportedFiles = async (): Promise<ExportedFile[]> => {
    if (currentPageId) {
      updatePage(currentPageId, { blocks: editorBlocks })
    }

    const projectData = getProjectData()
    const files = await exportProject(projectData, {
      customCss,
      inlineCss: false,
      inlineAssets: false,
      minify: false
    })

    setExportedFiles(files)
    return files
  }

  const handleValidate = async (): Promise<void> => {
    if (!selectedProvider) return

    setStep('validating')
    setError(null)

    try {
      const files = await buildExportedFiles()
      const result = await api.publish.validate(selectedProvider.id, files, buildCredentialPayload())
      setValidationResult(result)
      setStep('validated')
    } catch (err) {
      setError(String(err))
      setStep('credentials')
    }
  }

  const handlePublish = async (): Promise<void> => {
    if (!selectedProvider) return

    setStep('publishing')
    setProgress(null)
    setError(null)

    try {
      const credentialPayload = buildCredentialPayload()

      setPublisherBinding(bindToProject ? selectedProvider.id : null)
      if (bindToProject && saveCredentialToApp) {
        await api.publish.saveCredentials(selectedProvider.id, credentialPayload)
      }

      const files = exportedFiles.length > 0 ? exportedFiles : await buildExportedFiles()
      const result = await api.publish.publish(selectedProvider.id, files, credentialPayload)
      if (result.success && result.url) {
        setPublishResultInStore(result.url, new Date().toISOString())
      }
      setPublishResult(result)
      setStep('result')
    } catch (err) {
      setPublishResult({ success: false, error: String(err), warnings: [] })
      setStep('result')
    }
  }

  const handleCopyUrl = (url: string): void => {
    navigator.clipboard.writeText(url).catch(() => {})
  }

  const handleOpenUrl = (url: string): void => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!open) return null

  const hasErrors = validationResult
    ? validationResult.issues.some((issue) => issue.severity === 'error')
    : false

  return (
    <div className="publish-overlay" onClick={onClose}>
      <div className="publish-modal" onClick={(e) => e.stopPropagation()}>
        <div className="publish-header">
          <h2>Publish to Web</h2>
          <button className="publish-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="publish-content">
          {step === 'select' && (
            <div className="publish-step">
              <p className="publish-step-hint">Choose a hosting provider:</p>
              <div className="publish-provider-list">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    className={`publish-provider-card ${boundPublisherId === provider.id ? 'is-bound' : ''}`}
                    onClick={() => handleSelectProvider(provider)}
                  >
                    <div className="publish-provider-name-row">
                      <div className="publish-provider-name">{provider.displayName}</div>
                      {boundPublisherId === provider.id && (
                        <span className="publish-provider-badge">Bound</span>
                      )}
                    </div>
                    <div className="publish-provider-desc">{provider.description}</div>
                  </button>
                ))}
                {providers.length === 0 && (
                  <p className="publish-empty">Loading providers...</p>
                )}
              </div>
            </div>
          )}

          {step === 'credentials' && selectedProvider && (
            <div className="publish-step">
              <p className="publish-step-hint">
                Enter credentials for <strong>{selectedProvider.displayName}</strong>:
              </p>
              <div className="publish-fields">
                {selectedProvider.credentialFields.map((field) => (
                  <div key={field.key} className="publish-field-row">
                    <label className="publish-field-label">
                      {field.label}
                      {field.helpUrl && (
                        <a
                          className="publish-field-help"
                          href={field.helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          ?
                        </a>
                      )}
                    </label>
                    <input
                      className="publish-field-input"
                      type={field.sensitive ? 'password' : 'text'}
                      placeholder={
                        field.sensitive && storedCredentialHints[field.key]
                          ? `Saved ${storedCredentialHints[field.key]}`
                          : (field.placeholder ?? '')
                      }
                      value={credentials[field.key] ?? ''}
                      onChange={(e) =>
                        setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="publish-binding-card">
                <label className="publish-checkbox-row">
                  <input
                    type="checkbox"
                    checked={bindToProject}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setBindToProject(checked)
                      if (!checked) setSaveCredentialToApp(false)
                    }}
                  />
                  <span>Bind this provider to this project</span>
                </label>
                <p className="publish-binding-copy">
                  Keep this publishing destination attached to the current project so the workflow opens with the right provider next time.
                </p>
                <label className={`publish-checkbox-row ${!bindToProject ? 'disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={saveCredentialToApp}
                    disabled={!bindToProject}
                    onChange={(e) => setSaveCredentialToApp(e.target.checked)}
                  />
                  <span>Save credentials securely to the app</span>
                </label>
                <p className="publish-binding-copy">
                  Saved credentials will appear in Credentials and Global Settings for reuse across projects.
                </p>
              </div>

              {error && <div className="publish-error">{error}</div>}
            </div>
          )}

          {step === 'validating' && (
            <div className="publish-step publish-center">
              <div className="publish-spinner" />
              <p className="publish-step-hint">Validating...</p>
            </div>
          )}

          {step === 'validated' && validationResult && (
            <div className="publish-step">
              {validationResult.issues.length === 0 ? (
                <p className="publish-step-hint publish-ok">All checks passed. Ready to publish.</p>
              ) : (
                <>
                  <p className="publish-step-hint">Validation issues:</p>
                  <ul className="publish-issues">
                    {validationResult.issues.map((issue, index) => (
                      <li key={index} className={`publish-issue publish-issue--${issue.severity}`}>
                        <span className="publish-issue-badge">{issue.severity}</span>
                        {issue.filePath && (
                          <span className="publish-issue-file">{issue.filePath}</span>
                        )}
                        <span className="publish-issue-msg">{issue.message}</span>
                        {issue.suggestion && (
                          <span className="publish-issue-suggestion">{issue.suggestion}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {step === 'publishing' && (
            <div className="publish-step">
              <p className="publish-step-hint">{progress?.message ?? 'Publishing...'}</p>
              <div className="publish-progress-bar-track">
                <div
                  className="publish-progress-bar-fill"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                />
              </div>
              <p className="publish-progress-pct">{progress?.percent ?? 0}%</p>
            </div>
          )}

          {step === 'result' && publishResult && (
            <div className="publish-step publish-center">
              {publishResult.success ? (
                <>
                  <div className="publish-result-icon publish-result-icon--success">✓</div>
                  <p className="publish-result-title">Published successfully.</p>
                  {publishResult.url && (
                    <div className="publish-result-url-row">
                      <span className="publish-result-url">{publishResult.url}</span>
                      <button
                        className="publish-btn-secondary"
                        onClick={() => handleCopyUrl(publishResult.url!)}
                      >
                        Copy
                      </button>
                      <button
                        className="publish-btn-secondary"
                        onClick={() => handleOpenUrl(publishResult.url!)}
                      >
                        Open
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="publish-result-icon publish-result-icon--error">✕</div>
                  <p className="publish-result-title">Publish failed</p>
                  {publishResult.error && (
                    <p className="publish-error">{publishResult.error}</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="publish-footer">
          {(step === 'credentials' || step === 'validated') && (
            <button
              className="publish-btn-secondary"
              onClick={() => {
                if (step === 'credentials') setStep('select')
                if (step === 'validated') setStep('credentials')
              }}
            >
              Back
            </button>
          )}

          {step === 'result' && !publishResult?.success && (
            <button className="publish-btn-secondary" onClick={() => setStep('credentials')}>
              Back
            </button>
          )}

          <div style={{ flex: 1 }} />

          {step === 'result' && (
            <button className="publish-btn-secondary" onClick={onClose}>
              Close
            </button>
          )}

          {step === 'credentials' && (
            <button className="publish-btn-primary" onClick={handleValidate}>
              Validate
            </button>
          )}

          {step === 'validated' && (
            <button
              className="publish-btn-primary"
              onClick={handlePublish}
              disabled={hasErrors}
            >
              Publish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
