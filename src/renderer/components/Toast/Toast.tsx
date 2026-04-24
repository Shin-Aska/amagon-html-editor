import {useEffect} from 'react'
import {useToastStore} from '../../store/toastStore'
import './Toast.css'

export default function Toast(): JSX.Element | null {
    const toast = useToastStore((s) => s.toast);
    const clearToast = useToastStore((s) => s.clearToast);

    useEffect(() => {
        if (!toast) return;
        if (toast.autoCloseMs === null || (toast.actions && toast.actions.length > 0)) return;
        const t = setTimeout(() => {
            clearToast()
        }, toast.autoCloseMs ?? 2200);
        return () => clearTimeout(t)
    }, [toast, clearToast]);

    if (!toast) return null;

    return (
        <div className={`toast toast-${toast.type} toast-${toast.position ?? 'bottom-right'}`} role="status"
             aria-live="polite">
            <div className="toast-message">{toast.message}</div>
            {toast.actions && toast.actions.length > 0 && (
                <div className="toast-actions">
                    {toast.actions.map((action) => (
                        <button
                            key={action.label}
                            className="toast-action-btn"
                            onClick={action.onClick}
                            type="button"
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
