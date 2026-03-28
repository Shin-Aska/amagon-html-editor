import { create } from 'zustand'
import type { ReactNode } from 'react'
import { useAppSettingsStore } from './appSettingsStore'
import { useEditorStore } from './editorStore'
import { useAiStore } from './aiStore'
import { useProjectStore } from './projectStore'
import { getApi } from '../utils/api'

export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right'

export type TutorialActionType =
  | 'click'
  | 'drag-to-canvas'
  | 'select-block'
  | 'change-viewport'
  | 'edit-property'
  | 'add-class'
  | 'add-event'
  | 'ai-message-sent'
  | 'ai-message-reply-received'
  | 'open-event-editor'
  | 'open-theme-editor'
  | 'change-theme-color'
  | 'preset-created'
  | 'open-create-preset-modal'
  | 'open-ai-css-modal'
  | 'open-asset-manager-modal'
  | 'asset-manager-assets-increased'
  | 'asset-manager-closed'
  | 'open-publish-modal'
  | 'publish-provider-selected'
  | 'publish-validated'
  | 'publish-action-taken'
  | 'media-search-results-loaded'
  | 'css-file-changed'
  | 'ai-provider-configured'
  | 'none'

export interface TutorialAction {
  type: TutorialActionType
  targetValue?: string
}

export interface TutorialStep {
  id: string
  target: string | null
  additionalTargets?: string[]
  dynamicTarget?: string
  title: string
  body: string
  placement: TutorialPlacement
  spotlightPadding?: number
  arrowDirection: TutorialPlacement | 'none'
  action: TutorialAction
  autoAdvance: boolean
  onEnter?: () => void
  onExit?: () => void
  choices?: TutorialChoice[]
  hideSkip?: boolean
  hidePrimaryAction?: boolean
}

export interface TutorialChoice {
  id: string
  label: string
  description: string
  icon?: ReactNode
  steps: TutorialStep[]
}

interface TutorialState {
  isActive: boolean
  currentStepIndex: number
  steps: TutorialStep[]
  hasCompletedTutorial: boolean
  isTutorialEnabled: boolean
  branchLabel: string
  branchStartIndex: number | null
  branchStepCount: number
  isActionCompleted: boolean
}

interface TutorialActions {
  startTutorial: (steps: TutorialStep[]) => void
  nextStep: () => void
  prevStep: () => void
  skipTutorial: () => void
  completeTutorial: () => void
  setTutorialEnabled: (enabled: boolean) => void
  setTutorialCompleted: (completed: boolean) => void
  loadBranchSteps: (branchSteps: TutorialStep[], label?: string) => void
}

type TutorialStore = TutorialState & TutorialActions

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  isActive: false,
  currentStepIndex: 0,
  steps: [],
  hasCompletedTutorial: false,
  isTutorialEnabled: true,
  branchLabel: '',
  branchStartIndex: null,
  branchStepCount: 0,
  isActionCompleted: false,

  startTutorial: (steps: TutorialStep[]) => {
    if (steps.length === 0) {
      clearActionListener()
      set({
        isActive: false,
        currentStepIndex: 0,
        steps: [],
        branchLabel: '',
        branchStartIndex: null,
        branchStepCount: 0
      })
      return
    }

    steps[0].onEnter?.()
    set({
      isActive: true,
      currentStepIndex: 0,
      steps,
      branchLabel: '',
      branchStartIndex: null,
      branchStepCount: 0
    })
    startActionListener(steps[0])
  },

  nextStep: () => {
    const { steps, currentStepIndex } = get()
    if (!steps.length) return

    const currentStep = steps[currentStepIndex]
    currentStep?.onExit?.()

    if (currentStepIndex >= steps.length - 1) {
      get().completeTutorial()
      return
    }

    const nextIndex = currentStepIndex + 1
    steps[nextIndex]?.onEnter?.()
    set({ currentStepIndex: nextIndex })
    startActionListener(steps[nextIndex])
  },

  prevStep: () => {
    const { steps, currentStepIndex } = get()
    if (!steps.length || currentStepIndex <= 0) return

    const currentStep = steps[currentStepIndex]
    currentStep?.onExit?.()

    const prevIndex = currentStepIndex - 1
    steps[prevIndex]?.onEnter?.()
    set({ currentStepIndex: prevIndex })
    startActionListener(steps[prevIndex])
  },

  skipTutorial: () => {
    const { steps, currentStepIndex } = get()
    steps[currentStepIndex]?.onExit?.()
    clearActionListener()

    set({
      isActive: false,
      currentStepIndex: 0,
      steps: [],
      branchLabel: '',
      branchStartIndex: null,
      branchStepCount: 0
    })
  },

  completeTutorial: () => {
    const { steps, currentStepIndex } = get()
    steps[currentStepIndex]?.onExit?.()
    clearActionListener()

    set({
      isActive: false,
      currentStepIndex: 0,
      steps: [],
      hasCompletedTutorial: true,
      branchLabel: '',
      branchStartIndex: null,
      branchStepCount: 0
    })

    useAppSettingsStore.getState().setTutorialCompleted(true)
  },

  setTutorialEnabled: (enabled: boolean) => {
    set({ isTutorialEnabled: enabled })
  },

  setTutorialCompleted: (completed: boolean) => {
    set({ hasCompletedTutorial: completed })
  },

  loadBranchSteps: (branchSteps: TutorialStep[], label?: string) => {
    const { steps, currentStepIndex } = get()
    if (!steps.length || !branchSteps.length) return

    // Insert branch steps after the current step
    const newSteps = [
      ...steps.slice(0, currentStepIndex + 1),
      ...branchSteps,
      ...steps.slice(currentStepIndex + 1)
    ]
    set({
      steps: newSteps,
      branchLabel: label ?? '',
      branchStartIndex: currentStepIndex,
      branchStepCount: branchSteps.length
    })

    // Advance to the first branch step
    get().nextStep()
  }
}))

let actionListenerCleanup: (() => void) | null = null

function clearActionListener(): void {
  if (actionListenerCleanup) {
    actionListenerCleanup()
    actionListenerCleanup = null
  }
}

function startActionListener(step?: TutorialStep): void {
  clearActionListener()
  useTutorialStore.setState({ isActionCompleted: false })
  if (!step || step.action.type === 'none') return

  let handled = false
  const maybeAdvance = () => {
    if (handled) return
    handled = true
    const state = useTutorialStore.getState()
    const currentStep = state.steps[state.currentStepIndex]
    if (!state.isActive || !currentStep || currentStep.id !== step.id) return
    if (currentStep.autoAdvance) {
      state.nextStep()
    } else {
      useTutorialStore.setState({ isActionCompleted: true })
    }
  }

  switch (step.action.type) {
    case 'drag-to-canvas': {
      const baseline = useEditorStore.getState().blocks.length
      actionListenerCleanup = useEditorStore.subscribe((nextState) => {
        if (nextState.blocks.length > baseline) {
          maybeAdvance()
        }
      })
      return
    }
    case 'select-block': {
      const baseline = useEditorStore.getState().selectedBlockId
      actionListenerCleanup = useEditorStore.subscribe((nextState) => {
        if (nextState.selectedBlockId && nextState.selectedBlockId !== baseline) {
          maybeAdvance()
        }
      })
      return
    }
    case 'change-viewport': {
      const baseline = useEditorStore.getState().viewportMode
      const targetValue = step.action.targetValue
      actionListenerCleanup = useEditorStore.subscribe((nextState) => {
        if (targetValue) {
          if (nextState.viewportMode === targetValue) maybeAdvance()
          return
        }
        if (nextState.viewportMode !== baseline) maybeAdvance()
      })
      return
    }
    case 'edit-property': {
      const baseline = useEditorStore.getState().blocks
      actionListenerCleanup = useEditorStore.subscribe((nextState) => {
        if (nextState.blocks !== baseline) {
          maybeAdvance()
        }
      })
      return
    }
    case 'click': {
      if (!step.target) return
      const target = step.target
      const tryAttach = (): boolean => {
        const element = document.querySelector(target)
        if (!element) return false
        const handler = () => { maybeAdvance() }
        element.addEventListener('click', handler, { once: true })
        actionListenerCleanup = () => element.removeEventListener('click', handler)
        return true
      }
      if (tryAttach()) return
      // Target not in DOM yet (e.g. onEnter triggered a tab switch that hasn't rendered) — poll
      const pollId = window.setInterval(() => {
        if (tryAttach()) window.clearInterval(pollId)
      }, 100)
      actionListenerCleanup = () => window.clearInterval(pollId)
      return
    }
    case 'add-class': {
      const targetClass = step.action.targetValue?.trim()
      const hasClass = (): boolean => {
        const state = useEditorStore.getState()
        const selectedBlockId = state.selectedBlockId
        if (!selectedBlockId) return false
        const selectedBlock = state.getBlockById(selectedBlockId)
        if (!selectedBlock) return false
        if (!targetClass) return selectedBlock.classes.length > 0
        return selectedBlock.classes.includes(targetClass)
      }

      if (hasClass()) {
        maybeAdvance()
        return
      }

      actionListenerCleanup = useEditorStore.subscribe(() => {
        if (hasClass()) maybeAdvance()
      })
      return
    }
    case 'add-event': {
      const targetEvent = step.action.targetValue?.trim() || 'onclick'
      const hasEvent = (): boolean => {
        const state = useEditorStore.getState()
        const selectedBlockId = state.selectedBlockId

        if (selectedBlockId) {
          const selectedBlock = state.getBlockById(selectedBlockId)
          const eventCode = selectedBlock?.events?.[targetEvent]
          return typeof eventCode === 'string' && eventCode.trim().length > 0
        }

        return false
      }

      if (hasEvent()) {
        maybeAdvance()
        return
      }

      actionListenerCleanup = useEditorStore.subscribe(() => {
        if (hasEvent()) maybeAdvance()
      })
      return
    }
    case 'ai-message-sent': {
      const getUserMessageCount = () => {
        const messages = useAiStore.getState().messages
        return messages.filter((message) => message.role === 'user').length
      }

      const baseline = getUserMessageCount()
      actionListenerCleanup = useAiStore.subscribe((nextState) => {
        const nextCount = nextState.messages.filter((message) => message.role === 'user').length
        if (nextCount > baseline) {
          maybeAdvance()
        }
      })
      return
    }
    case 'ai-message-reply-received': {
      const getUserMessageCount = () => {
        const messages = useAiStore.getState().messages
        return messages.filter((message) => message.role === 'user').length
      }

      const baseline = getUserMessageCount()
      let userMessageSent = false
      let sawLoadingAfterSend = false

      actionListenerCleanup = useAiStore.subscribe((nextState) => {
        if (!userMessageSent) {
          const nextCount = nextState.messages.filter((message) => message.role === 'user').length
          if (nextCount > baseline) {
            userMessageSent = true
            if (nextState.isLoading) {
              sawLoadingAfterSend = true
            }
          }
          return
        }

        if (nextState.isLoading) {
          sawLoadingAfterSend = true
          return
        }

        if (sawLoadingAfterSend && !nextState.isLoading) {
          maybeAdvance()
        }
      })
      return
    }
    case 'open-theme-editor': {
      const isThemeEditorOpen = () => !!document.querySelector('.theme-editor-dialog')
      if (isThemeEditorOpen()) {
        maybeAdvance()
        return
      }

      const intervalId = window.setInterval(() => {
        if (isThemeEditorOpen()) {
          maybeAdvance()
        }
      }, 200)

      actionListenerCleanup = () => window.clearInterval(intervalId)
      return
    }
    case 'open-event-editor': {
      const isEventEditorOpen = () => !!document.querySelector('[data-tutorial="event-editor-modal"]')
      if (isEventEditorOpen()) {
        maybeAdvance()
        return
      }

      const intervalId = window.setInterval(() => {
        if (isEventEditorOpen()) {
          maybeAdvance()
        }
      }, 200)

      actionListenerCleanup = () => window.clearInterval(intervalId)
      return
    }
    case 'change-theme-color': {
      const baseline = { ...useProjectStore.getState().settings?.theme?.colors }
      actionListenerCleanup = useProjectStore.subscribe((nextState) => {
        const nextColors = nextState.settings?.theme?.colors
        if (!nextColors) return
        const keys = Object.keys(nextColors) as (keyof typeof nextColors)[]
        if (keys.some((key) => nextColors[key] !== baseline[key])) {
          maybeAdvance()
        }
      })
      return
    }
    case 'preset-created': {
      const baseline = useProjectStore.getState().customPresets.length
      actionListenerCleanup = useProjectStore.subscribe((nextState) => {
        if (nextState.customPresets.length > baseline) {
          maybeAdvance()
        }
      })
      return
    }
    case 'open-create-preset-modal': {
      const isOpen = () => !!document.querySelector('[data-tutorial="create-preset-dialog"]')
      if (isOpen()) { maybeAdvance(); return }
      const intervalId = window.setInterval(() => { if (isOpen()) maybeAdvance() }, 200)
      actionListenerCleanup = () => window.clearInterval(intervalId)
      return
    }
    case 'open-ai-css-modal': {
      const isOpen = () => !!document.querySelector('[data-tutorial="ai-css-assist-dialog"]')
      if (isOpen()) { maybeAdvance(); return }
      const intervalId = window.setInterval(() => { if (isOpen()) maybeAdvance() }, 200)
      actionListenerCleanup = () => window.clearInterval(intervalId)
      return
    }
    case 'open-asset-manager-modal': {
      const isOpen = () => !!document.querySelector('[data-tutorial="asset-manager-modal"]')
      if (isOpen()) { maybeAdvance(); return }
      const intervalId = window.setInterval(() => { if (isOpen()) maybeAdvance() }, 200)
      actionListenerCleanup = () => window.clearInterval(intervalId)
      return
    }
    case 'asset-manager-assets-increased': {
      const getAssetCount = () => document.querySelectorAll('.am-asset-item').length
      const baseline = getAssetCount()
      const intervalId = window.setInterval(() => {
        if (getAssetCount() > baseline) maybeAdvance()
      }, 200)
      actionListenerCleanup = () => window.clearInterval(intervalId)
      return
    }
    case 'asset-manager-closed': {
      const isClosed = () => !document.querySelector('[data-tutorial="asset-manager-modal"]')
      if (isClosed()) { maybeAdvance(); return }
      const intervalId = window.setInterval(() => {
        if (isClosed()) maybeAdvance()
      }, 200)
      actionListenerCleanup = () => window.clearInterval(intervalId)
      return
    }
    case 'open-publish-modal': {
      const isOpen = () => !!document.querySelector('[data-tutorial="publish-modal"]')
      if (isOpen()) { maybeAdvance(); return }
      const intervalId = window.setInterval(() => { if (isOpen()) maybeAdvance() }, 200)
      actionListenerCleanup = () => window.clearInterval(intervalId)
      return
    }
    case 'publish-provider-selected': {
      const isVisible = () => !!document.querySelector('[data-tutorial="publish-credentials"]')
      if (isVisible()) { maybeAdvance(); return }
      const intervalId = window.setInterval(() => { if (isVisible()) maybeAdvance() }, 200)
      actionListenerCleanup = () => window.clearInterval(intervalId)
      return
    }
    case 'publish-validated': {
      const tryAttach = (): boolean => {
        const el = document.querySelector('[data-tutorial="publish-validate-btn"]') as HTMLButtonElement | null
        if (!el) return false
        const handler = () => { maybeAdvance() }
        el.addEventListener('click', handler, { once: true })
        actionListenerCleanup = () => el.removeEventListener('click', handler)
        return true
      }
      if (tryAttach()) return
      const pollId = window.setInterval(() => { if (tryAttach()) window.clearInterval(pollId) }, 100)
      actionListenerCleanup = () => window.clearInterval(pollId)
      return
    }
    case 'publish-action-taken': {
      const tryAttach = (): boolean => {
        const el = document.querySelector('[data-tutorial="publish-action-btn"]') as HTMLButtonElement | null
        if (!el) return false
        const handler = () => { maybeAdvance() }
        el.addEventListener('click', handler, { once: true })
        actionListenerCleanup = () => el.removeEventListener('click', handler)
        return true
      }
      if (tryAttach()) return
      const pollId = window.setInterval(() => { if (tryAttach()) window.clearInterval(pollId) }, 100)
      actionListenerCleanup = () => window.clearInterval(pollId)
      return
    }
    case 'media-search-results-loaded': {
      const hasResults = () => document.querySelectorAll('[data-tutorial="media-search-result-item"]').length > 0
      if (hasResults()) {
        maybeAdvance()
        return
      }

      const intervalId = window.setInterval(() => {
        if (hasResults()) maybeAdvance()
      }, 200)
      actionListenerCleanup = () => window.clearInterval(intervalId)
      return
    }
    case 'ai-provider-configured': {
      const check = async () => {
        try {
          const result = await getApi().app.getCredentials()
          const credentials = Array.isArray(result?.credentials) ? result.credentials : []
          return credentials.some((c: any) => c?.source === 'ai' && c?.hasKey)
        } catch {
          return false
        }
      }
      const intervalId = window.setInterval(async () => {
        if (await check()) maybeAdvance()
      }, 1000)
      actionListenerCleanup = () => window.clearInterval(intervalId)
      // Also check immediately in case it's already set
      void check().then((has) => { if (has) maybeAdvance() })
      return
    }
    case 'css-file-changed': {
      const snapshot = () => {
        const files = useProjectStore.getState().settings?.theme?.customCssFiles ?? []
        return files.map((f) => f.css).join('\x00')
      }
      const baseline = snapshot()
      actionListenerCleanup = useProjectStore.subscribe(() => {
        if (snapshot() !== baseline) maybeAdvance()
      })
      return
    }
    default:
      return
  }
}
