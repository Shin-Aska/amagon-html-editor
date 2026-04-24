import {create} from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastPayload {
  message: string
  type: ToastType
  actions?: ToastAction[]
  autoCloseMs?: number | null
  position?: 'bottom-right' | 'bottom-center'
}

export interface ToastState {
  toast: ToastPayload | null
  showToast: (message: string, type: ToastType, options?: Omit<ToastPayload, 'message' | 'type'>) => void
  clearToast: () => void
}

export const useToastStore = create<ToastState>((set) => {
  return {
    toast: null,
    showToast: (message, type, options) => set({ toast: { message, type, ...options } }),
    clearToast: () => set({ toast: null })
  }
})
