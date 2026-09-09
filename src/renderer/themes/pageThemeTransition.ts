import type { MotionPreviewMode } from '../utils/motionPreview';

const paletteProperties = [
    'primary', 'secondary', 'accent', 'bg', 'surface', 'text', 'text-muted',
    'border', 'success', 'warning', 'danger', 'border-color',
] as const;

const paletteDefinitions = paletteProperties.map((name) => `@property --theme-${name} {
  syntax: "<color>";
  inherits: true;
  initial-value: transparent;
}`).join('\n');
const paletteTransition = `
  :root {
    --theme-transition-duration: 200ms;
    transition: ${paletteProperties.map((name) => `--theme-${name} var(--theme-transition-duration) ease-in-out`).join(',\n      ')};
  }
`;

export const PAGE_THEME_TRANSITION_CSS = {
    system: `${paletteDefinitions}\n@media (prefers-reduced-motion: no-preference) {\n${paletteTransition}\n}`,
    full: `${paletteDefinitions}\n${paletteTransition}`,
    reduced: '',
} as const satisfies Record<MotionPreviewMode, string>;
