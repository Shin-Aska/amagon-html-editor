import type {ActionEffectPreset, Block, BlockActionEffect} from '../store/types'
import {buildReducedMotionStyles, type MotionPreviewMode} from './motionPreview'

export const ACTION_EFFECT_CLASS_PREFIX = 'amagon-action'
export const ACTION_EFFECT_ACTIVE_CLASS = 'amagon-action-active'
export const AMAGON_ACTION_EFFECT_CSS_ID = 'amagon-action-effects'

const ACTION_EFFECT_CLEANUP_DELAY_MS = 400
const actionEffectRunIds = new WeakMap<HTMLElement, number>()

export const ACTION_EFFECT_LABELS: Record<ActionEffectPreset, string> = {
    press: 'Press',
    pop: 'Pop',
    pulse: 'Pulse',
    shake: 'Shake'
}

export const ACTION_EFFECT_PRESETS: readonly ActionEffectPreset[] = [
    'press',
    'pop',
    'pulse',
    'shake'
]

const ELIGIBLE_BLOCK_TYPES: ReadonlySet<string> = new Set([
    'button',
    'link',
    'social-links',
    'back-to-top'
]);

export function isBlockEligibleForActionEffect(type: string): boolean {
    if (!type || typeof type !== 'string') return false;
    return ELIGIBLE_BLOCK_TYPES.has(type.trim().toLowerCase())
}

export function normalizeActionEffectPreset(value: string | undefined | null): ActionEffectPreset | undefined {
    if (!value) return undefined;
    const normalized = value.trim().toLowerCase();
    for (const preset of ACTION_EFFECT_PRESETS) {
        if (preset === normalized) return preset
    }
    return undefined
}

export function actionEffectClassForPreset(preset: ActionEffectPreset): string {
    return `${ACTION_EFFECT_CLASS_PREFIX}-${preset}`
}

export function getActionEffectClasses(effect: BlockActionEffect | undefined): string[] {
    if (!effect) return [];
    const preset = normalizeActionEffectPreset(effect.preset);
    if (!preset) return [];
    return [actionEffectClassForPreset(preset), ACTION_EFFECT_CLASS_PREFIX]
}

export function stripActionEffectTokens(classes: string[]): string[] {
    const actionClassSet = new Set([
        ACTION_EFFECT_CLASS_PREFIX,
        ACTION_EFFECT_ACTIVE_CLASS,
        ...ACTION_EFFECT_PRESETS.map(actionEffectClassForPreset)
    ]);
    return classes.filter((className) => !actionClassSet.has(className))
}

export function clearActionEffectFromBlock(block: Block): Partial<Block> {
    return {
        classes: stripActionEffectTokens(block.classes),
        actionEffect: undefined
    }
}

export function actionEffectFromClassNames(classes: string[]): BlockActionEffect | undefined {
    const presetClass = classes.find((className) => className.startsWith(`${ACTION_EFFECT_CLASS_PREFIX}-`));
    const presetName = presetClass?.replace(`${ACTION_EFFECT_CLASS_PREFIX}-`, '');
    const preset = normalizeActionEffectPreset(presetName);
    return preset ? {preset} : undefined
}

export function triggerActionEffectFromTarget(target: EventTarget | null): void {
    if (!(target instanceof Element)) return;
    const element = target.closest<HTMLElement>(`.${ACTION_EFFECT_CLASS_PREFIX}`);
    if (!element) return;

    const runId = (actionEffectRunIds.get(element) ?? 0) + 1;
    actionEffectRunIds.set(element, runId);

    const cleanup = () => {
        if (actionEffectRunIds.get(element) !== runId) return;
        element.classList.remove(ACTION_EFFECT_ACTIVE_CLASS)
    };

    element.classList.remove(ACTION_EFFECT_ACTIVE_CLASS);
    void element.offsetWidth;
    element.classList.add(ACTION_EFFECT_ACTIVE_CLASS);
    setTimeout(cleanup, ACTION_EFFECT_CLEANUP_DELAY_MS);

    const animationName = getComputedStyle(element).animationName;
    if (!animationName || animationName === 'none') queueMicrotask(cleanup)
}

export function buildActionEffectRuntimeScript(): string {
    return `(function(){
	  var selector = '.${ACTION_EFFECT_CLASS_PREFIX}';
	  var activeClass = '${ACTION_EFFECT_ACTIVE_CLASS}';
	  var cleanupDelay = ${ACTION_EFFECT_CLEANUP_DELAY_MS};
	  var runIds = new WeakMap();
	  function trigger(target) {
	    var element = target instanceof Element ? target.closest(selector) : null;
	    if (!element) return;
	    var runId = (runIds.get(element) || 0) + 1;
	    runIds.set(element, runId);
	    function cleanup() {
	      if (runIds.get(element) !== runId) return;
	      element.classList.remove(activeClass);
	    }
	    element.classList.remove(activeClass);
	    void element.offsetWidth;
	    element.classList.add(activeClass);
	    setTimeout(cleanup, cleanupDelay);
	    var animationName = getComputedStyle(element).animationName;
	    if (!animationName || animationName === 'none') queueMicrotask(cleanup);
	  }
  document.addEventListener('pointerdown', function(event){ trigger(event.target); }, true);
  document.addEventListener('keydown', function(event){
    if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
    trigger(event.target);
  }, true);
  document.addEventListener('click', function(event){
    if (event.detail !== 0) return;
    trigger(event.target);
  }, true);
})();`
}

export function buildActionEffectStylesCss(motionPreviewMode: MotionPreviewMode = 'system'): string {
    const reducedMotionStyles = `.${ACTION_EFFECT_CLASS_PREFIX},
.${ACTION_EFFECT_CLASS_PREFIX}.${ACTION_EFFECT_ACTIVE_CLASS} {
  animation: none !important;
  transform: none !important;
  opacity: 1 !important;
}`;

    return `/* Amagon action effect presets */
.${ACTION_EFFECT_CLASS_PREFIX} {
  transform-origin: center;
}

.${ACTION_EFFECT_CLASS_PREFIX}-press.${ACTION_EFFECT_ACTIVE_CLASS} {
  animation: amagon-action-press 180ms ease-out;
}

.${ACTION_EFFECT_CLASS_PREFIX}-pop.${ACTION_EFFECT_ACTIVE_CLASS} {
  animation: amagon-action-pop 240ms ease-out;
}

.${ACTION_EFFECT_CLASS_PREFIX}-pulse.${ACTION_EFFECT_ACTIVE_CLASS} {
  animation: amagon-action-pulse 320ms ease-in-out;
}

.${ACTION_EFFECT_CLASS_PREFIX}-shake.${ACTION_EFFECT_ACTIVE_CLASS} {
  animation: amagon-action-shake 320ms ease-in-out;
}

@keyframes amagon-action-press {
  0%, 100% { transform: scale(1); }
  45% { transform: scale(0.94); }
}

@keyframes amagon-action-pop {
  0%, 100% { transform: scale(1); }
  45% { transform: scale(1.07); }
}

@keyframes amagon-action-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  45% { transform: scale(0.96); opacity: 0.72; }
}

@keyframes amagon-action-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  50% { transform: translateX(4px); }
  75% { transform: translateX(-2px); }
}

${buildReducedMotionStyles(reducedMotionStyles, motionPreviewMode)}`
}
