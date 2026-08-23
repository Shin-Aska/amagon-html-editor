export const MOTION_PREVIEW_MODES = ['system', 'full', 'reduced'] as const

export type MotionPreviewMode = typeof MOTION_PREVIEW_MODES[number]

export function isMotionPreviewMode(value: unknown): value is MotionPreviewMode {
    return value === 'system' || value === 'full' || value === 'reduced'
}

export function buildReducedMotionStyles(rules: string, mode: MotionPreviewMode): string {
    const normalizedRules = rules.trim();
    if (mode === 'full') return '';
    if (mode === 'reduced') return `${normalizedRules}\n`;

    const indentedRules = normalizedRules
        .split('\n')
        .map((line) => line ? `  ${line}` : line)
        .join('\n');
    return `@media (prefers-reduced-motion: reduce) {\n${indentedRules}\n}\n`
}
