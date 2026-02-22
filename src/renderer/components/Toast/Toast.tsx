import { useEffect } from 'react'
import { useToastStore } from '../../store/toastStore'
import './Toast.css'

export default function Toast(): JSX.Element | null {
  const toast = useToastStore((s) => s.toast)
  const clearToast = useToastStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => {
      clearToast()
    }, 2200)
    return () => clearTimeout(t)
  }, [toast, clearToast])

  if (!toast) return null

  return (
    <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  )
}
