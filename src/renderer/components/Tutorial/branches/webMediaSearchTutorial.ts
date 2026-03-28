import type { TutorialStep } from '../../../store/tutorialStore'
import { useTutorialStore } from '../../../store/tutorialStore'
import { useEditorStore } from '../../../store/editorStore'
import { getApi } from '../../../utils/api'

const ensureStandardLayout = () => {
  useEditorStore.getState().setEditorLayout('standard')
}

const clickTarget = (selector: string) => {
  const element = document.querySelector(selector) as HTMLElement | null
  if (element) element.click()
}

const openSidebarTab = (selector: string) => {
  ensureStandardLayout()
  window.setTimeout(() => clickTarget(selector), 0)
}

const ensureToolbarMenuOpen = () => {
  if (!window.matchMedia('(max-width: 840px)').matches) return

  const toggleButton = document.querySelector('[aria-label="Toggle toolbar menu"]') as HTMLButtonElement | null
  const collapsible = document.querySelector('.toolbar-collapsible') as HTMLElement | null
  if (!toggleButton || !collapsible) return

  if (collapsible.classList.contains('open')) return
  toggleButton.click()
}

const maybeSkipMediaKeyStep = async (stepId: string) => {
  const api = getApi()
  try {
    const result = await api.mediaSearch.getConfig()
    const config = result?.config as any
    if (!config) return

    const hasApiKey = Boolean(config.apiKey)
    const encryptedKeys = config.encryptedApiKeys
    const provider = config.provider
    const hasEncryptedKey = Boolean(
      encryptedKeys && (
        (provider && encryptedKeys[provider]) ||
        Object.values(encryptedKeys).some(Boolean)
      )
    )

    if (config.enabled && (hasApiKey || hasEncryptedKey)) {
      const state = useTutorialStore.getState()
      const currentStep = state.steps[state.currentStepIndex]
      if (state.isActive && currentStep?.id === stepId) {
        state.nextStep()
      }
    }
  } catch (err) {
    console.warn('Failed to check media search config', err)
  }
}

export const webMediaSearchSteps: TutorialStep[] = [
  {
    id: 'web-media-intro',
    target: null,
    title: 'Web Media Search',
    body: "Search for images from Unsplash, Pexels, and Pixabay - right from Amagon. Let's try it out.",
    placement: 'bottom',
    arrowDirection: 'none',
    action: { type: 'none' },
    autoAdvance: false
  },
  {
    id: 'open-asset-manager',
    target: '[data-tutorial="asset-manager-btn"]',
    dynamicTarget: '[data-tutorial="asset-manager-modal"]',
    title: 'Open Asset Manager',
    body: 'Click to open the Asset Manager where you can browse and import media.',
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'open-asset-manager-modal' },
    autoAdvance: true,
    onEnter: () => ensureToolbarMenuOpen()
  },
  {
    id: 'asset-manager-web-search',
    target: '[data-tutorial="asset-manager-modal"]',
    title: 'Web Search',
    body: 'Click the <strong>Web Search</strong> tab to search for images online.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'click' },
    autoAdvance: true
  },
  {
    id: 'media-search-key-check',
    target: '[data-tutorial="asset-manager-modal"]',
    title: 'Configure Media Search',
    body: 'Set up an API key for your preferred image provider (Unsplash, Pexels, or Pixabay). Click the settings icon to configure.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => {
      void maybeSkipMediaKeyStep('media-search-key-check')
    }
  },
  {
    id: 'media-search-dog',
    target: '[data-tutorial="asset-manager-modal"]',
    title: 'Search for Images',
    body: 'Type <code>dog</code> in the search box and click Search.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'media-search-results-loaded' },
    autoAdvance: true
  },
  {
    id: 'media-search-select',
    target: '[data-tutorial="asset-manager-modal"]',
    title: 'Select Images',
    body: 'Click on a few images, then click <strong>Insert Selected</strong> to import them into your project assets.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'asset-manager-assets-increased' },
    autoAdvance: true
  },
  {
    id: 'close-asset-manager',
    target: '.am-close-btn',
    title: 'Close Asset Manager',
    body: 'Close the Asset Manager to return to the editor.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'asset-manager-closed' },
    autoAdvance: true
  },
  {
    id: 'drag-carousel-widget',
    target: '[data-tutorial="sidebar-tab-widgets"]',
    dynamicTarget: '[data-tutorial="widget-grid"]',
    title: 'Add a Carousel',
    body: 'Drag a Carousel widget onto the canvas.',
    placement: 'right',
    arrowDirection: 'right',
    action: { type: 'drag-to-canvas' },
    autoAdvance: true,
    onEnter: () => openSidebarTab('[data-tutorial="sidebar-tab-widgets"]')
  },
  {
    id: 'assign-carousel-images',
    target: '[data-tutorial="carousel-field"]',
    title: 'Add Images to Carousel',
    body: 'Select the carousel in the canvas, then click <strong>+ Add Slides</strong> and choose the images you imported.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => ensureStandardLayout()
  },
  {
    id: 'completion',
    target: null,
    title: 'Web Media Search Tutorial Complete!',
    body: "You've learned how to search, import, and use web images in your projects.",
    placement: 'bottom',
    arrowDirection: 'none',
    action: { type: 'none' },
    autoAdvance: false
  }
]
