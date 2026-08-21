import type {Block, BlockHoverEffect, HoverEffectPreset} from '../store/types'

export const HOVER_EFFECT_CLASS_PREFIX = 'amagon-hover'
export const AMAGON_HOVER_EFFECT_CSS_ID = 'amagon-hover-effects'

export const HOVER_EFFECT_LABELS: Record<HoverEffectPreset, string> = {
    lift: 'Lift',
    grow: 'Grow',
    glow: 'Glow',
    shadow: 'Shadow',
    fade: 'Fade',
    underline: 'Underline',
    dim: 'Dim'
}

export const HOVER_EFFECT_PRESETS: readonly HoverEffectPreset[] = [
    'lift',
    'grow',
    'glow',
    'shadow',
    'fade',
    'underline',
    'dim'
]

const ELIGIBLE_BLOCK_TYPES: ReadonlySet<string> = new Set([
    'button',
    'link',
    'card',
    'image',
    'icon',
    'social-links',
    'back-to-top'
])

export function isBlockEligibleForHoverEffect(type: string): boolean {
    if (!type || typeof type !== 'string') return false;
    return ELIGIBLE_BLOCK_TYPES.has(type.trim().toLowerCase())
}

export function normalizeHoverEffectPreset(value: string | undefined | null): HoverEffectPreset | undefined {
    if (!value) return undefined;
    const normalized = value.trim().toLowerCase();
    for (const preset of HOVER_EFFECT_PRESETS) {
        if (preset === normalized) return preset
    }
    return undefined
}

export function defaultHoverEffect(preset: HoverEffectPreset): BlockHoverEffect {
    return {preset}
}

export function hoverEffectClassForPreset(preset: HoverEffectPreset): string {
    return `${HOVER_EFFECT_CLASS_PREFIX}-${preset}`
}

export function getHoverEffectClasses(effect: BlockHoverEffect | undefined): string[] {
    if (!effect) return [];
    const preset = normalizeHoverEffectPreset(effect.preset);
    if (!preset) return [];
    return [hoverEffectClassForPreset(preset), HOVER_EFFECT_CLASS_PREFIX]
}

export function stripHoverEffectTokens(classes: string[]): string[] {
    const hoverClassSet = new Set([
        HOVER_EFFECT_CLASS_PREFIX,
        ...HOVER_EFFECT_PRESETS.map((preset) => hoverEffectClassForPreset(preset))
    ]);
    return classes.filter((cls) => !hoverClassSet.has(cls))
}

export function clearHoverEffectFromBlock(block: Block): Partial<Block> {
    return {
        classes: stripHoverEffectTokens(block.classes),
        hoverEffect: undefined
    }
}

export function hoverEffectFromClassNames(classes: string[]): BlockHoverEffect | undefined {
    const presetClass = classes.find((cls) => cls.startsWith(`${HOVER_EFFECT_CLASS_PREFIX}-`));
    const presetName = presetClass?.replace(`${HOVER_EFFECT_CLASS_PREFIX}-`, '');
    const preset = normalizeHoverEffectPreset(presetName);
    return preset ? {preset} : undefined
}

export function buildHoverEffectStylesCss(): string {
    return `/* Amagon hover effect presets */
@media (hover: hover) and (pointer: fine) {
  .${HOVER_EFFECT_CLASS_PREFIX} {
    transition-property: transform, opacity, filter, box-shadow, color, background-color, border-color;
    transition-duration: 120ms;
    transition-timing-function: ease-out;
  }

  .${HOVER_EFFECT_CLASS_PREFIX}-lift:hover {
    transform: translateY(-3px);
  }

  .${HOVER_EFFECT_CLASS_PREFIX}-grow:hover {
    transform: scale(1.03);
  }

  .${HOVER_EFFECT_CLASS_PREFIX}-glow:hover {
    filter: drop-shadow(0 0 18px color-mix(in srgb, var(--theme-accent, currentColor) 42%, transparent));
  }

  .${HOVER_EFFECT_CLASS_PREFIX}-shadow:hover {
    box-shadow: 0 12px 28px rgb(0 0 0 / 18%);
  }

  .${HOVER_EFFECT_CLASS_PREFIX}-fade:hover {
    opacity: 0.72;
  }

  .${HOVER_EFFECT_CLASS_PREFIX}-underline {
    text-decoration-line: underline;
    text-decoration-thickness: 0.08em;
    text-decoration-color: transparent;
    text-underline-offset: 0.22em;
  }

  .${HOVER_EFFECT_CLASS_PREFIX}-underline:hover {
    color: var(--theme-accent, currentColor);
    text-decoration-color: currentColor;
  }

  .${HOVER_EFFECT_CLASS_PREFIX}-dim:hover {
    filter: brightness(0.88);
  }
}

@media (prefers-reduced-motion: reduce) {
  .${HOVER_EFFECT_CLASS_PREFIX},
  .${HOVER_EFFECT_CLASS_PREFIX}-lift,
  .${HOVER_EFFECT_CLASS_PREFIX}-grow,
  .${HOVER_EFFECT_CLASS_PREFIX}-glow,
  .${HOVER_EFFECT_CLASS_PREFIX}-shadow,
  .${HOVER_EFFECT_CLASS_PREFIX}-fade,
  .${HOVER_EFFECT_CLASS_PREFIX}-underline,
  .${HOVER_EFFECT_CLASS_PREFIX}-dim {
    transition-duration: 0.01ms !important;
    transform: none !important;
    filter: none !important;
  }
}
`
}
