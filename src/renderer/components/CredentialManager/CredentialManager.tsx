import { useState, useEffect, useRef, useCallback } from 'react'
import { KeyRound, X, Trash2, ShieldCheck, ShieldAlert, Sparkles, Image as ImageIcon } from 'lucide-react'
import { getApi } from '../../utils/api'
import './CredentialManager.css'

interface Credential {
  id: string
  label: string
  source: string
  provider: string
  maskedKey: string
  hasKey: boolean
}

interface CredentialManagerProps {
  open: boolean
  onClose: () => void
}

export default function CredentialManager({ open, onClose }: CredentialManagerProps): JSX.Element | null {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [secure, setSecure] = useState(true)
  const [loading, setLoading] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const fetchCredentials = useCallback(async () => {
    setLoading(true)
    try {
      const api = getApi()
      const result = await api.app.getCredentials()
      if (result.success) {
        setCredentials(result.credentials || [])
        if (typeof result.secure === 'boolean') setSecure(result.secure)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) fetchCredentials()
  }, [open, fetchCredentials])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid the triggering click from closing immediately
    const timeout = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(timeout)
      document.removeEventListener('mousedown', handler)
    }
  }, [open, onClose])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleDelete = async (id: string) => {
    try {
      const api = getApi()
      const result = await api.app.deleteCredential(id)
      if (result.success) {
        await fetchCredentials()
      }
    } catch {
      // ignore
    }
  }

  if (!open) return null

  const sourceIcon = (source: string) => {
    switch (source) {
      case 'ai': return <Sparkles size={14} />
      case 'media-search': return <ImageIcon size={14} />
      default: return <KeyRound size={14} />
    }
  }

  return (
    <div className="cred-manager-popover" ref={popoverRef}>
      <div className="cred-manager-header">
        <h4><KeyRound size={13} /> Credentials</h4>
        <button className="cred-manager-close" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>

      <div className={`cred-manager-encryption ${secure ? 'secure' : 'degraded'}`}>
        {secure ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
        <span>
          {secure
            ? 'Keys encrypted via OS keyring'
            : 'Keys encrypted with machine-derived key (no OS keyring)'}
        </span>
      </div>

      <div className="cred-manager-list">
        {loading && credentials.length === 0 && (
          <div className="cred-manager-empty">Loading...</div>
        )}

        {!loading && credentials.length === 0 && (
          <div className="cred-manager-empty">No credentials configured.</div>
        )}

        {credentials.map((cred) => (
          <div key={cred.id} className="cred-item">
            <div className={`cred-item-icon ${cred.source}`}>
              {sourceIcon(cred.source)}
            </div>
            <div className="cred-item-details">
              <div className="cred-item-label">
                {cred.label}
                <span className="cred-item-provider">{cred.provider}</span>
              </div>
              <div className={`cred-item-key ${!cred.hasKey ? 'not-set' : ''}`}>
                {cred.hasKey ? cred.maskedKey : 'Not configured'}
              </div>
            </div>
            {cred.hasKey && (
              <div className="cred-item-actions">
                <button
                  className="cred-item-delete"
                  onClick={() => handleDelete(cred.id)}
                  title={`Delete ${cred.label} API key`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="cred-manager-footer">
        API keys are configured in each service's settings panel.
      </div>
    </div>
  )
}
