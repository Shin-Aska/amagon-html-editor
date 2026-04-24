import {createElement} from 'react'
import {Bot, Image, Rocket} from 'lucide-react'
import type {TutorialStep} from '../../store/tutorialStore'
import {useEditorStore} from '../../store/editorStore'
import {OPEN_KEYBOARD_SHORTCUTS_EVENT} from '../../constants/tutorialEvents'
import {aiAssistanceSteps} from './branches/aiAssistanceTutorial'
import {publishSteps} from './branches/publishTutorial'
import {webMediaSearchSteps} from './branches/webMediaSearchTutorial'

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

let keyboardShortcutsLinkCleanup: (() => void) | null = null;

const clearKeyboardShortcutsLinkHandler = () => {
  if (!keyboardShortcutsLinkCleanup) return;
  keyboardShortcutsLinkCleanup();
  keyboardShortcutsLinkCleanup = null
};

const installKeyboardShortcutsLinkHandler = () => {
  clearKeyboardShortcutsLinkHandler();

  const handler = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const link = target?.closest('[data-action="open-shortcuts"]') as HTMLAnchorElement | null;
    if (!link) return;
    event.preventDefault();
    window.dispatchEvent(new CustomEvent(OPEN_KEYBOARD_SHORTCUTS_EVENT))
  };

  document.addEventListener('click', handler);
  keyboardShortcutsLinkCleanup = () => document.removeEventListener('click', handler)
};

export const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to Amagon!',
    body: "Let's take a quick tour of the editor. It takes about 2 minutes. You can skip at any time.",
    placement: 'bottom',
    arrowDirection: 'none',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => {
      ensureStandardLayout()
    }
  },
  {
    id: 'canvas-intro',
    target: '[data-tutorial="canvas"]',
    title: 'The Canvas',
    body: "This is the canvas — the main editing area where your page comes to life. You'll drag widgets here, select blocks, and see your design in real time.",
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'none' },
    autoAdvance: false,
    spotlightPadding: 0,
    onEnter: () => ensureStandardLayout()
  },
  {
    id: 'sidebar-pages',
    target: '[data-tutorial="sidebar-tab-pages"]',
    title: 'Pages',
    body: "Manage your site's pages here. Create new pages, organize them into folders, and switch between them.",
    placement: 'right',
    arrowDirection: 'right',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => openSidebarTab('[data-tutorial="sidebar-tab-pages"]')
  },
  {
    id: 'page-context-menu',
    target: '[data-tutorial="page-list-item"]',
    title: 'Page options',
    body: 'You can right-click any page to see options like Page Properties, Move to Folder, and more. Try it after the tutorial!',
    placement: 'right',
    arrowDirection: 'right',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => openSidebarTab('[data-tutorial="sidebar-tab-pages"]')
  },
  {
    id: 'sidebar-widgets',
    target: '[data-tutorial="sidebar-tab-widgets"]',
    title: 'Widgets',
    body: 'Browse all available building blocks. Drag any widget onto the canvas to add it to your page.',
    placement: 'right',
    arrowDirection: 'right',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => openSidebarTab('[data-tutorial="sidebar-tab-widgets"]')
  },
  {
    id: 'drag-widget',
    target: '[data-tutorial="widget-grid"]',
    additionalTargets: ['[data-tutorial="canvas"]'],
    title: 'Drag a widget to the canvas',
    body: "Grab any widget from the list and drag it onto the highlighted canvas area. If the widget appears on the page, you're good to go!",
    placement: 'right',
    arrowDirection: 'right',
    action: { type: 'drag-to-canvas' },
    autoAdvance: true,
    onEnter: () => {
      ensureStandardLayout();
      openSidebarTab('[data-tutorial="sidebar-tab-widgets"]')
    }
  },
  {
    id: 'canvas-select',
    target: '[data-tutorial="canvas"]',
    title: 'Select a block',
    body: 'Click any block on the canvas to select it. The block will be highlighted with a blue outline.',
    placement: 'top',
    arrowDirection: 'top',
    action: { type: 'select-block' },
    autoAdvance: true,
    onEnter: () => {
      ensureStandardLayout();
      useEditorStore.getState().selectBlock(null)
    }
  },
  {
    id: 'inspector',
    target: '[data-tutorial="inspector"]',
    title: 'Edit properties',
    body: 'The Inspector shows all properties for the selected block. You can change text, colors, spacing, and more. Click Next to continue.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => ensureStandardLayout()
  },
  {
    id: 'sidebar-layers',
    target: '[data-tutorial="sidebar-tab-layers"]',
    title: 'Layers panel',
    body: 'The Layers panel shows a tree of all blocks on the page. Use it to select, reorder, and nest blocks.',
    placement: 'right',
    arrowDirection: 'right',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => openSidebarTab('[data-tutorial="sidebar-tab-layers"]')
  },
  {
    id: 'toolbar-viewport',
    target: '[data-tutorial="toolbar-viewport"]',
    title: 'Responsive preview',
    body: 'Switch between Desktop, Tablet, and Mobile views to see how your page looks at each breakpoint. Click Next to continue.',
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => ensureToolbarMenuOpen()
  },
  {
    id: 'toolbar-undo-redo',
    target: '[data-tutorial="toolbar-undo-redo"]',
    title: 'Undo and Redo',
    body: 'Made a mistake? Use <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd> or these buttons to step through your history.',
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => ensureToolbarMenuOpen()
  },
  {
    id: 'toolbar-layout',
    target: '[data-tutorial="toolbar-layout"]',
    title: 'Layout modes',
    body: 'Toggle the sidebar and inspector panels, or enter focus mode. Choose the layout that fits your workflow.',
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => ensureToolbarMenuOpen()
  },
  {
    id: 'toolbar-zoom',
    target: '[data-tutorial="toolbar-zoom"]',
    title: 'Zoom controls',
    body: 'Use the zoom controls to get a closer look at your design, or zoom out to see the full page.',
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => ensureToolbarMenuOpen()
  },
  {
    id: 'keyboard-shortcuts',
    target: '[data-tutorial="help-menu-btn"]',
    title: 'Keyboard shortcuts',
    body: "Click <strong>Help &rarr; Keyboard Shortcuts</strong> to view all shortcuts. <a href='#' data-action='open-shortcuts'>Open Keyboard Shortcuts</a>",
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'none' },
    autoAdvance: false,
    onEnter: () => {
      ensureToolbarMenuOpen();
      installKeyboardShortcutsLinkHandler()
    },
    onExit: () => {
      clearKeyboardShortcutsLinkHandler()
    }
  },
  {
    id: 'branch-choice',
    target: null,
    title: "You're all set with the basics!",
    body: 'Amagon offers more. Want to dive deeper into one of these features?',
    placement: 'bottom',
    arrowDirection: 'none',
    action: { type: 'none' },
    autoAdvance: false,
    hideSkip: true,
    hidePrimaryAction: true,
    choices: [
      {
        id: 'ai-assistance',
        label: 'AI Assistance',
        description: 'Learn to use AI providers for chat, code generation, and styling',
        icon: createElement(Bot, { size: 24 }),
        steps: aiAssistanceSteps
      },
      {
        id: 'web-media-search',
        label: 'Web Media Search',
        description: 'Search and import images from Unsplash, Pexels, and Pixabay',
        icon: createElement(Image, { size: 24 }),
        steps: webMediaSearchSteps
      },
      {
        id: 'publish',
        label: 'Publish Your Site',
        description: 'Deploy to GitHub Pages, Cloudflare, or Neocities',
        icon: createElement(Rocket, { size: 24 }),
        steps: publishSteps
      }
    ]
  }
];

export const completionStep: TutorialStep = {
  id: 'completion',
  target: null,
  title: 'Tutorial complete!',
  body: "You've finished the tutorial. You can restart any tutorial from Settings → General.",
  placement: 'bottom',
  arrowDirection: 'none',
  action: { type: 'none' },
  autoAdvance: false
};
