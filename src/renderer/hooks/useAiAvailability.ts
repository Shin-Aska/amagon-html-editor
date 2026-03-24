import { useCallback, useEffect, useState } from 'react'
import { getApi } from '../utils/api'

export const AI_AVAILABILITY_CHANGED_EVENT = 'hoarses:ai-availability-changed'
export const AI_API_KEY_REQUIRED_MESSAGE = 'Please add an API key to a supported Provider in the Global settings.'

export function dispatchAiAvailabilityChanged(): void {
  window.dispatchEvent(new Event(AI_AVAILABILITY_CHANGED_EVENT))
}

export function useAiAvailability(): { hasConfiguredAiProvider: boolean; checked: boolean; refresh: () => Promise<void> } {
  const [hasConfiguredAiProvider, setHasConfiguredAiProvider] = useState(false)
  const [checked, setChecked] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const api = getApi()
      const result = await api.app.getCredentials()
      const credentials = Array.isArray(result?.credentials) ? result.credentials : []
      const hasAiCredential = credentials.some((credential: any) => credential?.source === 'ai' && credential?.hasKey)
      setHasConfiguredAiProvider(hasAiCredential)
    } catch {
      setHasConfiguredAiProvider(false)
    } finally {
      setChecked(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const handleAvailabilityChanged = () => {
      void refresh()
    }
    const handleFocus = () => {
      void refresh()
    }

    window.addEventListener(AI_AVAILABILITY_CHANGED_EVENT, handleAvailabilityChanged)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener(AI_AVAILABILITY_CHANGED_EVENT, handleAvailabilityChanged)
      window.removeEventListener('focus', handleFocus)
    }
  }, [refresh])

  return { hasConfiguredAiProvider, checked, refresh }
}
