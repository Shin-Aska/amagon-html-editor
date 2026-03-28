import type { TutorialStep } from '../../../store/tutorialStore'

const ensureToolbarMenuOpen = () => {
  if (!window.matchMedia('(max-width: 840px)').matches) return

  const toggleButton = document.querySelector('[aria-label="Toggle toolbar menu"]') as HTMLButtonElement | null
  const collapsible = document.querySelector('.toolbar-collapsible') as HTMLElement | null
  if (!toggleButton || !collapsible) return

  if (collapsible.classList.contains('open')) return
  toggleButton.click()
}

export const publishSteps: TutorialStep[] = [
  {
    id: 'publish-intro',
    target: null,
    title: 'Publish Your Site',
    body: 'Deploy your site to GitHub Pages, Cloudflare Pages, or Neocities - directly from Amagon.',
    placement: 'bottom',
    arrowDirection: 'none',
    action: { type: 'none' },
    autoAdvance: false
  },
  {
    id: 'publish-open',
    target: '[data-tutorial="publish-btn"]',
    dynamicTarget: '[data-tutorial="publish-modal"]',
    title: 'Open Publish',
    body: 'Click the Publish button to open the Publish dialog.',
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'open-publish-modal' },
    autoAdvance: true,
    onEnter: () => ensureToolbarMenuOpen()
  },
  {
    id: 'publish-provider',
    target: '[data-tutorial="publish-modal"]',
    title: 'Choose a Provider',
    body: "Select where you'd like to deploy your site — GitHub Pages, Cloudflare Pages, or Neocities.",
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'publish-provider-selected' },
    autoAdvance: true
  },
  {
    id: 'publish-credentials',
    target: '[data-tutorial="publish-modal"]',
    title: 'Enter Credentials',
    body: 'Fill in the required credentials for your chosen provider. These are stored securely on your machine.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'publish-validated' },
    autoAdvance: true
  },
  {
    id: 'publish-validate',
    target: '[data-tutorial="publish-modal"]',
    title: 'Validate & Publish',
    body: 'Click <strong>Validate</strong> to verify your credentials, then click <strong>Publish</strong> to deploy your site live.',
    placement: 'left',
    arrowDirection: 'left',
    action: { type: 'publish-action-taken' },
    autoAdvance: true
  },
  {
    id: 'completion',
    target: null,
    title: 'Publish Tutorial Complete!',
    body: 'You now know how to deploy your site. You can publish updates any time from the same dialog.',
    placement: 'bottom',
    arrowDirection: 'none',
    action: { type: 'none' },
    autoAdvance: false
  }
]
