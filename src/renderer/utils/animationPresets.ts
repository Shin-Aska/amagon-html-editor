import type {AnimationEasing, AnimationPreset, Block, BlockAnimation} from '../store/types'
import {buildReducedMotionStyles, type MotionPreviewMode} from './motionPreview'

export const ANIMATION_CLASS_PREFIX = 'amagon-enter'
export const AMAGON_ANIMATION_CSS_ID = 'amagon-enter-animations'
export const AMAGON_ANIMATION_STYLE_PREFIX = '--amagon-enter-'

export const AMAGON_ANIMATION_VARIABLES = new Set([
    `${AMAGON_ANIMATION_STYLE_PREFIX}duration`,
    `${AMAGON_ANIMATION_STYLE_PREFIX}delay`,
    `${AMAGON_ANIMATION_STYLE_PREFIX}easing`
])

export const PRESET_LABELS: Record<AnimationPreset, string> = {
    fade: 'Fade',
    'slide-up': 'Slide Up',
    'slide-left': 'Slide Left',
    'slide-right': 'Slide Right',
    scale: 'Scale',
    zoom: 'Zoom',
    bounce: 'Bounce'
}

export const PRESETS: readonly AnimationPreset[] = [
    'fade',
    'slide-up',
    'slide-left',
    'slide-right',
    'scale',
    'zoom',
    'bounce'
]

export const EASING_OPTIONS: readonly AnimationEasing[] = [
    'linear',
    'ease',
    'ease-in',
    'ease-out',
    'ease-in-out'
]

export const DEFAULT_DURATION_MS = 600
export const DEFAULT_DELAY_MS = 0
export const DEFAULT_EASING: AnimationEasing = 'ease-out'

const MIN_DURATION_MS = 100
const MAX_DURATION_MS = 3000
const MIN_DELAY_MS = 0
const MAX_DELAY_MS = 2000

const EXCLUDED_BLOCK_TYPES: ReadonlySet<string> = new Set([
    'raw-html',
    'spacer',
    'divider',
    'modal',
    'offcanvas',
    'carousel',
    'spinner',
    'progress',
    'input',
    'textarea',
    'select',
    'checkbox',
    'radio',
    'range',
    'file-input',
    'breadcrumb',
    'pagination'
])

export function isBlockEligibleForAnimation(type: string): boolean {
    if (!type || typeof type !== 'string') return false;
    const normalized = type.trim().toLowerCase();
    if (!normalized) return false;
    if (EXCLUDED_BLOCK_TYPES.has(normalized)) return false;
    return normalized !== 'icon'
}

export function clampDurationMs(value: number | undefined | string): number {
    const n = typeof value === 'string' ? Number(value) : value ?? DEFAULT_DURATION_MS;
    if (!Number.isFinite(n)) return DEFAULT_DURATION_MS;
    return Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, n))
}

export function clampDelayMs(value: number | undefined | string): number {
    const n = typeof value === 'string' ? Number(value) : value ?? DEFAULT_DELAY_MS;
    if (!Number.isFinite(n)) return DEFAULT_DELAY_MS;
    return Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, n))
}

export function normalizeEasing(value: string | undefined | null): AnimationEasing {
    if (!value) return DEFAULT_EASING;
    const v = String(value).trim().toLowerCase();
    if (EASING_OPTIONS.includes(v as AnimationEasing)) return v as AnimationEasing;
    return DEFAULT_EASING
}

export function normalizeAnimationPreset(value: string | undefined | null): AnimationPreset | undefined {
    if (!value) return undefined;
    const v = String(value).trim().toLowerCase();
    if (PRESETS.includes(v as AnimationPreset)) return v as AnimationPreset;
    return undefined
}

export function defaultAnimation(preset: AnimationPreset): BlockAnimation {
    return {
        preset,
        durationMs: DEFAULT_DURATION_MS,
        delayMs: DEFAULT_DELAY_MS,
        easing: DEFAULT_EASING
    }
}

export function buildBlockAnimation(
    preset: AnimationPreset,
    durationMs?: number | string,
    delayMs?: number | string,
    easing?: string | null
): BlockAnimation {
    return {
        preset,
        durationMs: clampDurationMs(durationMs),
        delayMs: clampDelayMs(delayMs),
        easing: normalizeEasing(easing)
    }
}

export function buildAnimationStyleVariables(animation: BlockAnimation): Record<string, string> {
    return {
        [`${AMAGON_ANIMATION_STYLE_PREFIX}duration`]: `${clampDurationMs(animation.durationMs)}ms`,
        [`${AMAGON_ANIMATION_STYLE_PREFIX}delay`]: `${clampDelayMs(animation.delayMs)}ms`,
        [`${AMAGON_ANIMATION_STYLE_PREFIX}easing`]: normalizeEasing(animation.easing)
    }
}

export function animationClassForPreset(preset: AnimationPreset): string {
    return `${ANIMATION_CLASS_PREFIX}-${preset}`
}

export function getAnimationClasses(animation: BlockAnimation | undefined): string[] {
    if (!animation) return [];
    const preset = normalizeAnimationPreset(animation.preset);
    if (!preset) return [];
    return [animationClassForPreset(preset), ANIMATION_CLASS_PREFIX]
}

export function buildAnimationStylesCss(motionPreviewMode: MotionPreviewMode = 'system'): string {
    const dur = `${AMAGON_ANIMATION_STYLE_PREFIX}duration`;
    const delay = `${AMAGON_ANIMATION_STYLE_PREFIX}delay`;
    const easing = `${AMAGON_ANIMATION_STYLE_PREFIX}easing`;
    const reducedMotionStyles = `.${ANIMATION_CLASS_PREFIX},
.${ANIMATION_CLASS_PREFIX}-fade,
.${ANIMATION_CLASS_PREFIX}-slide-up,
.${ANIMATION_CLASS_PREFIX}-slide-left,
.${ANIMATION_CLASS_PREFIX}-slide-right,
.${ANIMATION_CLASS_PREFIX}-scale,
.${ANIMATION_CLASS_PREFIX}-zoom,
.${ANIMATION_CLASS_PREFIX}-bounce {
  animation: none !important;
  opacity: 1 !important;
  translate: 0 0 !important;
  scale: 1 !important;
}`;

    return `/* Amagon entrance animation presets */
.${ANIMATION_CLASS_PREFIX} {
  animation-duration: var(${dur}, ${DEFAULT_DURATION_MS}ms);
  animation-delay: var(${delay}, ${DEFAULT_DELAY_MS}ms);
  animation-timing-function: var(${easing}, ${DEFAULT_EASING});
  animation-fill-mode: both;
}

.${ANIMATION_CLASS_PREFIX}-fade {
  animation-name: amagon-enter-fade;
}

.${ANIMATION_CLASS_PREFIX}-slide-up {
  animation-name: amagon-enter-slide-up;
}

.${ANIMATION_CLASS_PREFIX}-slide-left {
  animation-name: amagon-enter-slide-left;
}

.${ANIMATION_CLASS_PREFIX}-slide-right {
  animation-name: amagon-enter-slide-right;
}

.${ANIMATION_CLASS_PREFIX}-scale {
  animation-name: amagon-enter-scale;
}

.${ANIMATION_CLASS_PREFIX}-zoom {
  animation-name: amagon-enter-zoom;
}

.${ANIMATION_CLASS_PREFIX}-bounce {
  animation-name: amagon-enter-bounce;
}

@keyframes amagon-enter-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes amagon-enter-slide-up {
  from { opacity: 0; translate: 0 1.5rem; }
  to { opacity: 1; translate: 0 0; }
}

@keyframes amagon-enter-slide-left {
  from { opacity: 0; translate: 1.5rem 0; }
  to { opacity: 1; translate: 0 0; }
}

@keyframes amagon-enter-slide-right {
  from { opacity: 0; translate: -1.5rem 0; }
  to { opacity: 1; translate: 0 0; }
}

@keyframes amagon-enter-scale {
  from { opacity: 0; scale: 0.92; }
  to { opacity: 1; scale: 1; }
}

@keyframes amagon-enter-zoom {
  from { opacity: 0; scale: 0.75; }
  to { opacity: 1; scale: 1; }
}

@keyframes amagon-enter-bounce {
  0% { opacity: 0; translate: 0 -1.5rem; }
  60% { opacity: 1; translate: 0 0.5rem; }
  100% { opacity: 1; translate: 0 0; }
}

${buildReducedMotionStyles(reducedMotionStyles, motionPreviewMode)}`
}

export function stripLegacyAnimationStyles(
    styles: Record<string, string>
): Record<string, string> {
    const next: Record<string, string> = {};
    const legacyKeys = new Set([
        'animation',
        'animationName',
        'animationDuration',
        'animationTimingFunction',
        'animationDelay',
        'animationIterationCount',
        'animationDirection',
        'animationFillMode',
        'animationPlayState'
    ]);
    for (const [k, v] of Object.entries(styles)) {
        if (legacyKeys.has(k)) continue;
        next[k] = v
    }
    return next
}

export function stripAnimationTokens(
    classes: string[],
    styles: Record<string, string>
): {classes: string[]; styles: Record<string, string>} {
    const animationClassSet = new Set([
        ANIMATION_CLASS_PREFIX,
        ...PRESETS.map((p) => animationClassForPreset(p))
    ]);
    const nextClasses = classes.filter((cls) => !animationClassSet.has(cls));
    const nextStyles: Record<string, string> = {};
    for (const [k, v] of Object.entries(styles)) {
        if (!AMAGON_ANIMATION_VARIABLES.has(k)) nextStyles[k] = v
    }
    return {classes: nextClasses, styles: nextStyles}
}

export function clearAnimationFromBlock(block: Block): Partial<Block> {
    const stripped = stripAnimationTokens(block.classes, block.styles);
    return {
        classes: stripped.classes,
        styles: stripLegacyAnimationStyles(stripped.styles),
        animation: undefined
    }
}

export function getAnimationPresentation(block: Block): {classes: string[]; styles: Record<string, string>} {
    if (!block.animation || !isBlockEligibleForAnimation(block.type)) {
        return {classes: [], styles: {}}
    }
    return {
        classes: getAnimationClasses(block.animation),
        styles: buildAnimationStyleVariables(block.animation)
    }
}

export function animationFromClassNameAndStyles(
    classes: string[],
    styles: Record<string, string>
): BlockAnimation | undefined {
    const presetClass = classes.find((cls) => cls.startsWith(`${ANIMATION_CLASS_PREFIX}-`) && cls !== ANIMATION_CLASS_PREFIX);
    const preset = presetClass ? normalizeAnimationPreset(presetClass.replace(`${ANIMATION_CLASS_PREFIX}-`, '')) : undefined;
    if (!preset) return undefined;

    const durationRaw = styles[`${AMAGON_ANIMATION_STYLE_PREFIX}duration`];
    const delayRaw = styles[`${AMAGON_ANIMATION_STYLE_PREFIX}delay`];
    const easingRaw = styles[`${AMAGON_ANIMATION_STYLE_PREFIX}easing`];

    return {
        preset,
        durationMs: durationRaw ? parseDurationMs(durationRaw) : DEFAULT_DURATION_MS,
        delayMs: delayRaw ? parseDelayMs(delayRaw) : DEFAULT_DELAY_MS,
        easing: normalizeEasing(easingRaw)
    }
}

function parseCssTimeMs(value: string): number | undefined {
    const v = String(value).trim().toLowerCase();
    if (!v || v === '0' || v === '0s' || v === '0ms') return 0;
    const msMatch = v.match(/^([\d.]+)\s*ms$/);
    if (msMatch) {
        const n = Number(msMatch[1]);
        return Number.isFinite(n) ? n : undefined
    }
    const sMatch = v.match(/^([\d.]+)\s*s$/);
    if (sMatch) {
        const n = Number(sMatch[1]);
        return Number.isFinite(n) ? n * 1000 : undefined
    }
    const bare = Number(v);
    if (Number.isFinite(bare)) return bare;
    return undefined
}

function parseDurationMs(value: string): number {
    const ms = parseCssTimeMs(value);
    return ms !== undefined ? clampDurationMs(ms) : DEFAULT_DURATION_MS
}

function parseDelayMs(value: string): number {
    const ms = parseCssTimeMs(value);
    return ms !== undefined ? clampDelayMs(ms) : DEFAULT_DELAY_MS
}
