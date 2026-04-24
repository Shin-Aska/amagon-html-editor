import type {TutorialStep} from '../../../store/tutorialStore'
import {useTutorialStore} from '../../../store/tutorialStore'
import {useEditorStore} from '../../../store/editorStore'
import {useProjectStore} from '../../../store/projectStore'
import {getApi} from '../../../utils/api'
import {openGlobalSettings} from '../../../utils/settingsNavigation'

const ensureStandardLayout = () => {
  useEditorStore.getState().setEditorLayout('standard')
};

const clickTarget = (selector: string) => {
  const element = document.querySelector(selector) as HTMLElement | null;
  if (element) element.click()
};

const openSidebarTab = (selector: string) => {
  ensureStandardLayout();
  window.setTimeout(() => clickTarget(selector), 0)
};

const ensureToolbarMenuOpen = () => {
  if (!window.matchMedia('(max-width: 840px)').matches) return;

  const toggleButton = document.querySelector('[aria-label="Toggle toolbar menu"]') as HTMLButtonElement | null;
  const collapsible = document.querySelector('.toolbar-collapsible') as HTMLElement | null;
  if (!toggleButton || !collapsible) return;

  if (collapsible.classList.contains('open')) return;
  toggleButton.click()
};

const hasConfiguredAiProvider = async (): Promise<boolean> => {
  try {
    const api = getApi();
    const result = await api.app.getCredentials();
    const credentials = Array.isArray(result?.credentials) ? result.credentials : [];
    return credentials.some((credential: any) => credential?.source === 'ai' && credential?.hasKey)
  } catch {
    return false
  }
};

let aiKeyLinkCleanup: (() => void) | null = null;

const clearAiKeyLinkHandler = () => {
  if (!aiKeyLinkCleanup) return;
  aiKeyLinkCleanup();
  aiKeyLinkCleanup = null
};

const installAiKeyLinkHandler = () => {
  clearAiKeyLinkHandler();

  const handler = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const link = target?.closest('[data-action="open-ai-keys"]') as HTMLAnchorElement | null;
    if (!link) return;
    event.preventDefault();
    openGlobalSettings({ tab: 'keys' })
  };

  document.addEventListener('click', handler);
  aiKeyLinkCleanup = () => document.removeEventListener('click', handler)
};

export const aiAssistanceSteps: TutorialStep[] = [
  {
    id: 'ai-introduction',
    target: null,
    title: 'AI Assistance',
    body: 'Amagon supports multiple AI providers (OpenAI, Anthropic, Google, Mistral, Ollama). You can use AI for chat-based code generation, styling assistance, and more.',
    placement: 'bottom',
    arrowDirection: 'none',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => {
      ensureStandardLayout()
    }
  },
  {
    id: 'ai-api-key-check',
    target: '[data-tutorial="global-settings-btn"]',
    dynamicTarget: '[data-tutorial="settings-dialog"]',
    title: 'Set up an AI Provider',
    body: "To use AI features, you need an API key. Click the settings button, go to the <strong>Credentials</strong> tab, and add a key for any AI provider. The tutorial will continue automatically once a key is saved.",
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'ai-provider-configured' },
    autoAdvance: true,
    onEnter: () => {
      ensureToolbarMenuOpen();
      installAiKeyLinkHandler()
    },
    onExit: () => {
      clearAiKeyLinkHandler()
    }
  },
  {
    id: 'ai-open-chat',
    target: '[data-tutorial="sidebar-tab-ai"]',
    title: 'Open AI Chat',
    body: 'Click the AI tab to open the AI assistant.',
    placement: 'right',
    arrowDirection: 'right',
    action: { type: 'click' },
    autoAdvance: true,
    onEnter: () => openSidebarTab('[data-tutorial="sidebar-tab-ai"]')
  },
  {
    id: 'ai-send-message',
    target: '[data-tutorial="ai-input"]',
    title: 'Send a Prompt',
    body: 'Ask AI to create something, like: <code>Create a hero section with a heading and a call-to-action button</code>. Send your message and wait for the AI to reply.',
    placement: 'right',
    arrowDirection: 'right',
    action: { type: 'ai-message-reply-received' },
    autoAdvance: false,
    onEnter: () => openSidebarTab('[data-tutorial="sidebar-tab-ai"]')
  },
  {
    id: 'ai-insert-blocks',
    target: '[data-tutorial="ai-insert-blocks-btn"]',
    title: 'Insert AI-Generated Blocks',
    body: 'Click the <strong>Insert</strong> button on the AI response to add the generated blocks to your canvas.',
    placement: 'right',
    arrowDirection: 'right',
    action: { type: 'click' },
    autoAdvance: true,
    onEnter: () => openSidebarTab('[data-tutorial="sidebar-tab-ai"]')
  },
  {
    id: 'ai-drag-button',
    target: '[data-tutorial="widget-grid"]',
    title: 'Add a Button',
    body: 'Switch back to Widgets and drag a Button widget onto the canvas.',
    placement: 'right',
    arrowDirection: 'right',
    action: { type: 'drag-to-canvas' },
    autoAdvance: true,
    onEnter: () => openSidebarTab('[data-tutorial="sidebar-tab-widgets"]')
  },
  {
    id: 'ai-add-class',
    target: '[data-tutorial="css-classes-editor"]',
    title: 'Add a CSS Class',
    body: 'In the CSS Classes field, type <code>ai-button-demo</code> and press Enter.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'add-class', targetValue: 'ai-button-demo' },
    autoAdvance: true,
    onEnter: () => {
      ensureStandardLayout()
    }
  },
  {
    id: 'ai-open-event-editor',
    target: '[data-tutorial="event-actions-editor"]',
    title: 'Add an Event',
    body: 'Click <strong>+ Add Event</strong> and choose <strong>On Click</strong>.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'open-event-editor' },
    autoAdvance: true,
    spotlightPadding: 220,
    dynamicTarget: '[data-tutorial="event-editor-modal"]',
    onEnter: () => {
      ensureStandardLayout()
    }
  },
  {
    id: 'ai-event-use-assist',
    target: '[data-tutorial="event-ai-assist-btn"]',
    title: 'Use AI Code Assist',
    body: 'Click the <strong>AI Code Assist</strong> button to generate event code with AI. Try: <code>I want to notify with a popup hello world</code>.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'click' },
    autoAdvance: true,
    onEnter: () => {
      ensureStandardLayout()
    }
  },
  {
    id: 'ai-event-save',
    target: '[data-tutorial="event-editor-modal"]',
    title: 'Apply and Save',
    body: 'Once AI generates the code, click <strong>Apply</strong> to accept it, then click <strong>Save</strong> to save the event.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'add-event', targetValue: 'onclick' },
    autoAdvance: true,
    spotlightPadding: 220,
    onEnter: () => {
      ensureStandardLayout()
    }
  },
  {
    id: 'ai-open-theme-editor',
    target: '[data-tutorial="theme-editor-btn"]',
    title: 'Theme Designer',
    body: "Open the Theme Designer to redesign your site's colors.",
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'open-theme-editor' },
    autoAdvance: true,
    onEnter: () => {
      ensureToolbarMenuOpen()
    }
  },
  {
    id: 'ai-theme-presets-tab',
    target: '[data-tutorial="theme-presets-tab"]',
    title: 'Presets',
    body: 'Click the <strong>Presets</strong> tab to browse built-in palettes and create AI-generated ones.',
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'click' },
    autoAdvance: true
  },
  {
    id: 'ai-create-preset-btn',
    target: '[data-tutorial="preset-create-btn"]',
    title: 'Create a Color Preset',
    body: 'Click <strong>Create Preset</strong> to design a new color palette with AI.',
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'open-create-preset-modal' },
    autoAdvance: true,
    onEnter: () => {
      const tab = document.querySelector('[data-tutorial="theme-presets-tab"]') as HTMLElement;
      tab?.click()
    }
  },
  {
    id: 'ai-create-preset-flow',
    target: '[data-tutorial="create-preset-dialog"]',
    title: 'Generate Colors with AI',
    body: 'Describe your color scheme (e.g., <code>Ocean breeze</code> or <code>Dark cyberpunk</code>), click <strong>Generate Colors</strong>, then name it and click <strong>Save Preset</strong>.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'preset-created' },
    autoAdvance: true
  },
  {
    id: 'ai-css-create-file',
    target: '[data-tutorial="css-add-file-btn"]',
    title: 'Create a CSS File',
    body: 'Click the <strong>+</strong> button to create a new CSS file. This is where you\'ll write custom styles for your site.',
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'click' },
    autoAdvance: true,
    onEnter: () => {
      const tab = document.querySelector('[data-tutorial="theme-custom-css-tab"]') as HTMLElement;
      tab?.click();
      // Skip this step if a CSS file already exists
      window.setTimeout(() => {
        const files = useProjectStore.getState().settings?.theme?.customCssFiles ?? [];
        if (files.length === 0) return;
        const state = useTutorialStore.getState();
        const currentStep = state.steps[state.currentStepIndex];
        if (state.isActive && currentStep?.id === 'ai-css-create-file') {
          state.nextStep()
        }
      }, 150)
    }
  },
  {
    id: 'ai-css-open-assist',
    target: '[data-tutorial="css-ai-assist-btn"]',
    title: 'Use AI for Custom CSS',
    body: 'Click the <strong>AI Assist</strong> button (sparkles icon) to open the AI CSS generator.',
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'open-ai-css-modal' },
    autoAdvance: true,
    onEnter: () => {
      const tab = document.querySelector('[data-tutorial="theme-custom-css-tab"]') as HTMLElement;
      tab?.click()
    }
  },
  {
    id: 'ai-css-describe',
    target: '[data-tutorial="theme-editor-dialog"]',
    dynamicTarget: '[data-tutorial="ai-css-assist-dialog"]',
    title: 'Describe What to Generate',
    body: 'Describe the CSS you need (e.g., <code>Style .ai-button-demo as a red button with white text and rounded corners</code>), click <strong>Generate</strong>, review the result, then click <strong>Accept</strong> to apply it.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'css-file-changed' },
    autoAdvance: true,
    onEnter: () => {
      const tab = document.querySelector('[data-tutorial="theme-custom-css-tab"]') as HTMLElement;
      tab?.click()
    }
  },
  {
    id: 'completion',
    target: null,
    title: 'AI Assistance Tutorial Complete!',
    body: "You've learned how to use AI for code generation, styling, and theme customization.",
    placement: 'bottom',
    arrowDirection: 'none',
    action: { type: 'none' },
    autoAdvance: false
  }
];
