import { create } from 'zustand'
import { useAppSettingsStore } from './appSettingsStore'
import { useEditorStore } from './editorStore'

export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right'

export type TutorialActionType =
  | 'click'
  | 'drag-to-canvas'
  | 'select-block'
  | 'change-viewport'
  | 'edit-property'
  | 'none'

export interface TutorialAction {
  type: TutorialActionType
  targetValue?: string
}

export interface TutorialStep {
  id: string
  target: string | null
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
  icon?: string
  steps: TutorialStep[]
}

interface TutorialState {
  isActive: boolean
  currentStepIndex: number
  steps: TutorialStep[]
  hasCompletedTutorial: boolean
  isTutorialEnabled: boolean
}

interface TutorialActions {
  startTutorial: (steps: TutorialStep[]) => void
  nextStep: () => void
  prevStep: () => void
  skipTutorial: () => void
  completeTutorial: () => void
  setTutorialEnabled: (enabled: boolean) => void
  setTutorialCompleted: (completed: boolean) => void
  loadBranchSteps: (branchSteps: TutorialStep[]) => void
}

type TutorialStore = TutorialState & TutorialActions

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  isActive: false,
  currentStepIndex: 0,
  steps: [],
  hasCompletedTutorial: false,
  isTutorialEnabled: true,

  startTutorial: (steps: TutorialStep[]) => {
    if (steps.length === 0) {
      clearActionListener()
      set({
        isActive: false,
        currentStepIndex: 0,
        steps: []
      })
      return
    }

    steps[0].onEnter?.()
    set({
      isActive: true,
      currentStepIndex: 0,
      steps
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
      steps: []
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
      hasCompletedTutorial: true
    })

    useAppSettingsStore.getState().setTutorialCompleted(true)
  },

  setTutorialEnabled: (enabled: boolean) => {
    set({ isTutorialEnabled: enabled })
  },

  setTutorialCompleted: (completed: boolean) => {
    set({ hasCompletedTutorial: completed })
  },

  loadBranchSteps: (branchSteps: TutorialStep[]) => {
    const { steps, currentStepIndex } = get()
    if (!steps.length || !branchSteps.length) return

    // Insert branch steps after the current step
    const newSteps = [
      ...steps.slice(0, currentStepIndex + 1),
      ...branchSteps,
      ...steps.slice(currentStepIndex + 1)
    ]
    set({ steps: newSteps })

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
      const element = document.querySelector(step.target)
      if (!element) return
      const handler = () => {
        maybeAdvance()
      }
      element.addEventListener('click', handler, { once: true })
      actionListenerCleanup = () => element.removeEventListener('click', handler)
      return
    }
    default:
      return
  }
}
