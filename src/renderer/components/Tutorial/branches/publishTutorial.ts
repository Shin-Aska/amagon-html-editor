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
    title: 'Open Publish',
    body: 'Click to open the Publish dialog.',
    placement: 'bottom',
    arrowDirection: 'bottom',
    action: { type: 'click' },
    autoAdvance: true,
    onEnter: () => ensureToolbarMenuOpen()
  },
  {
    id: 'publish-provider',
    target: '[data-tutorial="publish-providers"]',
    title: 'Choose a Provider',
    body: "Select where you'd like to deploy your site. Each provider has different features and requirements.",
    placement: 'right',
    arrowDirection: 'right',
    action: { type: 'none' },
    autoAdvance: false
  },
  {
    id: 'publish-credentials',
    target: '[data-tutorial="publish-credentials"]',
    title: 'Enter Credentials',
    body: 'Fill in the required credentials for your chosen provider. These are stored securely on your machine.',
    placement: 'right',
    arrowDirection: 'right',
    action: { type: 'none' },
    autoAdvance: false
  },
  {
    id: 'publish-validate',
    target: '[data-tutorial="publish-validate-btn"]',
    title: 'Validate',
    body: 'Click Validate to check that your credentials and configuration are correct before publishing.',
    placement: 'top',
    arrowDirection: 'top',
    action: { type: 'none' },
    autoAdvance: false
  },
  {
    id: 'publish-action',
    target: '[data-tutorial="publish-action-btn"]',
    title: 'Publish!',
    body: "When ready, click Publish to deploy your site. You'll see a progress bar and get a live URL when it's done.",
    placement: 'top',
    arrowDirection: 'top',
    action: { type: 'none' },
    autoAdvance: false
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
