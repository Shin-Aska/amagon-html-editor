import {useEffect, useState} from 'react'
import {getApi} from '../../utils/api'
import {useProjectStore} from '../../store/projectStore'
import {useEditorStore} from '../../store/editorStore'
import {exportProject} from '../../utils/exportEngine'
import type {ExportedFile, PublishProgress, PublishResult, ValidationResult} from '../../../publish/types'
import './PublishDialog.css'

interface PublishDialogProps {
  open: boolean
  onClose: () => void
}

type Step = 'select' | 'credentials' | 'validating' | 'validated' | 'publishing' | 'result'

const STEPPER_LABELS = ['Select', 'Configure', 'Validate', 'Publish']
const STEP_TO_INDEX: Record<Step, number> = {
  select: 0,
  credentials: 1,
  validating: 2,
  validated: 2,
  publishing: 3,
  result: 3,
}

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
    api.project.openInBrowser(url).catch(() => {})
  }

  if (!open) return null

  const hasErrors = validationResult
    ? validationResult.issues.some((issue) => issue.severity === 'error')
    : false

  const activeStepIndex = STEP_TO_INDEX[step]

  return (
    <div className="publish-overlay" onClick={onClose}>
      <div className="publish-modal" data-tutorial="publish-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="publish-header">
          <h2 className="publish-header-title">Publish to Web</h2>
          <button className="publish-close-btn" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="14" y2="14" /><line x1="14" y1="2" x2="2" y2="14" />
            </svg>
          </button>
        </div>

        {/* ── Step progress indicator ── */}
        <div className="publish-stepper">
          {STEPPER_LABELS.map((label, i) => (
            <div key={label} className={`publish-stepper-item${i < activeStepIndex ? ' is-done' : ''}${i === activeStepIndex ? ' is-current' : ''}`}>
              {i > 0 && <div className={`publish-stepper-connector${i <= activeStepIndex ? ' is-active' : ''}`} />}
              <div className="publish-stepper-bubble">
                {i < activeStepIndex ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1,5 4,8 9,2" />
                  </svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span className="publish-stepper-label">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="publish-content">

          {/* Step: Select provider */}
          {step === 'select' && (
            <div className="publish-step">
              <p className="publish-step-hint">Choose a hosting provider to publish your project:</p>
              <div className="publish-provider-grid" data-tutorial="publish-providers">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    className={`publish-provider-card${boundPublisherId === provider.id ? ' is-bound' : ''}`}
                    onClick={() => handleSelectProvider(provider)}
                  >
                    <div className="publish-provider-icon-area">
                      <div className="publish-provider-icon-placeholder">
                        {provider.displayName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="publish-provider-body">
                      <div className="publish-provider-name-row">
                        <span className="publish-provider-name">{provider.displayName}</span>
                        {boundPublisherId === provider.id && (
                          <span className="publish-provider-badge">Bound</span>
                        )}
                      </div>
                      <p className="publish-provider-desc">{provider.description}</p>
                    </div>
                  </button>
                ))}
                {providers.length === 0 && (
                  <p className="publish-empty">Loading providers…</p>
                )}
              </div>
            </div>
          )}

          {/* Step: Credentials */}
          {step === 'credentials' && selectedProvider && (
            <div className="publish-step">
              <p className="publish-step-hint">
                Enter credentials for <strong>{selectedProvider.displayName}</strong>:
              </p>
              <div className="publish-fields" data-tutorial="publish-credentials">
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
                          title="Help"
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
                <label className="publish-checkbox-styled">
                  <input
                    type="checkbox"
                    checked={bindToProject}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setBindToProject(checked)
                      if (!checked) setSaveCredentialToApp(false)
                    }}
                  />
                  <span className="publish-checkbox-mark" />
                  <span className="publish-checkbox-text">Bind this provider to this project</span>
                </label>
                <p className="publish-binding-copy">
                  Keep this publishing destination attached to the current project so the workflow opens with the right provider next time.
                </p>
                <div className="publish-binding-separator" />
                <label className={`publish-checkbox-styled publish-checkbox-indented${!bindToProject ? ' is-disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={saveCredentialToApp}
                    disabled={!bindToProject}
                    onChange={(e) => setSaveCredentialToApp(e.target.checked)}
                  />
                  <span className="publish-checkbox-mark" />
                  <span className="publish-checkbox-text">Save credentials securely to the app</span>
                </label>
                <p className="publish-binding-copy">
                  Saved credentials will appear in Credentials and Global Settings for reuse across projects.
                </p>
              </div>

              {error && <div className="publish-error">{error}</div>}
            </div>
          )}

          {/* Step: Validating */}
          {step === 'validating' && (
            <div className="publish-step publish-center">
              <div className="publish-spinner-wrap">
                <div className="publish-spinner" />
              </div>
              <p className="publish-validating-label">
                Validating with {selectedProvider?.displayName ?? 'provider'}
                <span className="publish-validating-dots" />
              </p>
            </div>
          )}

          {/* Step: Validated */}
          {step === 'validated' && validationResult && (
            <div className="publish-step">
              {validationResult.issues.length === 0 ? (
                <div className="publish-success-banner">
                  <svg className="publish-success-banner-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2,9 7,14 16,4" />
                  </svg>
                  <span>All checks passed — ready to publish.</span>
                </div>
              ) : (
                <>
                  <p className="publish-step-hint">Validation issues found:</p>
                  <ul className="publish-issues">
                    {validationResult.issues.map((issue, index) => (
                      <li key={index} className={`publish-issue publish-issue--${issue.severity}`}>
                        <div className="publish-issue-header">
                          <span className={`publish-issue-pill publish-issue-pill--${issue.severity}`}>
                            {issue.severity}
                          </span>
                          {issue.filePath && (
                            <span className="publish-issue-file">{issue.filePath}</span>
                          )}
                        </div>
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

          {/* Step: Publishing */}
          {step === 'publishing' && (
            <div className="publish-step publish-center">
              <p className="publish-step-hint">{progress?.message ?? 'Publishing…'}</p>
              <div className="publish-progress-track">
                <div
                  className="publish-progress-fill"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                />
                <span className="publish-progress-pct-label">
                  {progress?.percent ?? 0}%
                </span>
              </div>
            </div>
          )}

          {/* Step: Result */}
          {step === 'result' && publishResult && (
            <div className="publish-step publish-center" data-tutorial="publish-result">
              {publishResult.success ? (
                <>
                  <div className="publish-result-circle publish-result-circle--success">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6,16 13,23 26,9" />
                    </svg>
                  </div>
                  <p className="publish-result-heading">Published Successfully</p>
                  {publishResult.url && (
                    <>
                      <div className="publish-result-url-pill">
                        <span className="publish-result-url-text">{publishResult.url}</span>
                      </div>
                      <div className="publish-result-actions">
                        <button
                          className="publish-btn-secondary"
                          onClick={() => handleCopyUrl(publishResult.url!)}
                        >
                          Copy URL
                        </button>
                        <button
                          className="publish-btn-secondary"
                          onClick={() => handleOpenUrl(publishResult.url!)}
                        >
                          Open in Browser
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="publish-result-circle publish-result-circle--error">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="10" y1="10" x2="22" y2="22" /><line x1="22" y1="10" x2="10" y2="22" />
                    </svg>
                  </div>
                  <p className="publish-result-heading">Publish Failed</p>
                  {publishResult.error && (
                    <div className="publish-error publish-result-error">{publishResult.error}</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
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
              Try Again
            </button>
          )}

          <div className="publish-footer-spacer" />

          {step === 'result' && (
            <button className="publish-btn-secondary" onClick={onClose}>
              Done
            </button>
          )}

          {step === 'credentials' && (
            <button className="publish-btn-primary" onClick={handleValidate} data-tutorial="publish-validate-btn">
              Validate
            </button>
          )}

          {step === 'validated' && (
            <button
              className={`publish-btn-primary${hasErrors ? ' is-disabled' : ''}`}
              onClick={handlePublish}
              disabled={hasErrors}
              data-tutorial="publish-action-btn"
            >
              Publish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
