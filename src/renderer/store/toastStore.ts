import { create } from 'zustand'

export type ToastType = 'success' | 'error'

export interface ToastState {
  toast: { message: string; type: ToastType } | null
  showToast: (message: string, type: ToastType) => void
  clearToast: () => void
}

export const useToastStore = create<ToastState>((set) => {
  return {
    toast: null,
    showToast: (message, type) => set({ toast: { message, type } }),
    clearToast: () => set({ toast: null })
  }
})
