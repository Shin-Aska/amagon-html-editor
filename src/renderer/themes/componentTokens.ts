import type {ComponentTokens} from '../store/types'

export const defaultShadowTokens: NonNullable<ComponentTokens['shadows']> = {
    sm: '0 4px 12px rgba(15, 23, 42, 0.08)',
    md: '0 10px 30px rgba(15, 23, 42, 0.12)',
    lg: '0 18px 45px rgba(15, 23, 42, 0.16)',
    xl: '0 28px 60px rgba(15, 23, 42, 0.22)'
}

export const defaultButtonTokens: NonNullable<ComponentTokens['button']> = {
    borderRadius: '999px',
    padding: '0.75rem 1.25rem',
    fontWeight: '600',
    textTransform: 'none',
    shadow: defaultShadowTokens.sm
}

export const defaultCardTokens: NonNullable<ComponentTokens['card']> = {
    borderRadius: '20px',
    shadow: defaultShadowTokens.sm,
    borderWidth: '1px',
    padding: '1.5rem'
}

export const defaultHeadingTokens: NonNullable<ComponentTokens['headings']> = {
    fontWeight: '700',
    letterSpacing: '-0.02em'
}

export const defaultFormTokens: NonNullable<ComponentTokens['form']> = {
    inputBorderRadius: '14px',
    inputPadding: '0.8rem 1rem',
    focusRingColor: 'rgba(30, 102, 245, 0.2)'
}

export const defaultComponentTokens: ComponentTokens = {
    button: defaultButtonTokens,
    card: defaultCardTokens,
    headings: defaultHeadingTokens,
    form: defaultFormTokens,
    shadows: defaultShadowTokens
}

function mergePartial<T>(base: T, override?: Partial<T>): T {
    return {...base, ...override} as T
}

export function mergeComponentTokens(
    base: ComponentTokens,
    overrides?: ComponentTokens
): ComponentTokens {
    if (!overrides) {
        return {
            button: base.button ? {...base.button} : undefined,
            card: base.card ? {...base.card} : undefined,
            headings: base.headings ? {...base.headings} : undefined,
            form: base.form ? {...base.form} : undefined,
            shadows: base.shadows ? {...base.shadows} : undefined
        }
    }

    return {
        button: base.button || overrides.button
            ? mergePartial(base.button ?? defaultButtonTokens, overrides.button)
            : undefined,
        card: base.card || overrides.card
            ? mergePartial(base.card ?? defaultCardTokens, overrides.card)
            : undefined,
        headings: base.headings || overrides.headings
            ? mergePartial(base.headings ?? defaultHeadingTokens, overrides.headings)
            : undefined,
        form: base.form || overrides.form
            ? mergePartial(base.form ?? defaultFormTokens, overrides.form)
            : undefined,
        shadows: base.shadows || overrides.shadows
            ? mergePartial(base.shadows ?? defaultShadowTokens, overrides.shadows)
            : undefined
    }
}

export function createDefaultComponentTokens(overrides?: ComponentTokens): ComponentTokens {
    return mergeComponentTokens(defaultComponentTokens, overrides)
}
