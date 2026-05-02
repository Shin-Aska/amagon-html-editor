/**
 * CSS measurement unit utilities.
 *
 * Provides parsing, validation, and conversion for CSS length values.
 * All conversions assume a base font-size of 16px (1rem = 16px, 1pt = 1.333px).
 */

const UNIT_PATTERN = /^([+-]?(?:\d*\.)?\d+)(px|pt|rem|em|%|vw|vh|vmin|vmax|ex|ch|cm|mm|in|pc)$/i;

export interface ParsedMeasurement {
    value: number;
    unit: string;
}

/**
 * Parse a CSS measurement string into numeric value and unit.
 * Returns null if the value is not a valid measurement.
 */
export function parseMeasurement(value: string | number | undefined): ParsedMeasurement | null {
    if (value === undefined || value === null || value === '') return null;
    const str = String(value).trim();
    if (str === '0' || str === '0px' || str === '0rem' || str === '0em' || str === '0pt') {
        return {value: 0, unit: 'px'};
    }
    const match = str.match(UNIT_PATTERN);
    if (!match) return null;
    const num = parseFloat(match[1]);
    if (!Number.isFinite(num)) return null;
    return {value: num, unit: match[2].toLowerCase()};
}

/**
 * Check if a value is a valid CSS measurement.
 */
export function isValidMeasurement(value: string | number | undefined): boolean {
    return parseMeasurement(value) !== null;
}

/**
 * Strip the unit from a measurement string, returning just the numeric value.
 * Returns NaN if the value is not a valid measurement.
 */
export function stripUnit(value: string | number | undefined): number {
    const parsed = parseMeasurement(value);
    return parsed ? parsed.value : NaN;
}

/**
 * Convert any measurement to rem.
 * Assumes base font-size of 16px.
 * Returns the original string if conversion is not possible.
 */
export function toRem(value: string | number | undefined, baseFontSizePx = 16): string {
    const parsed = parseMeasurement(value);
    if (!parsed) return String(value ?? '');
    const {value: num, unit} = parsed;
    let pxValue: number;
    switch (unit) {
        case 'px':
            pxValue = num;
            break;
        case 'pt':
            pxValue = num * (4 / 3);
            break;
        case 'rem':
        case 'em':
            return `${num}rem`;
        case '%':
            return `${num}%`;
        case 'vw':
        case 'vh':
        case 'vmin':
        case 'vmax':
            return `${num}${unit}`;
        default:
            return `${num}${unit}`;
    }
    const remValue = pxValue / baseFontSizePx;
    // Avoid excessive precision
    const rounded = Math.round(remValue * 1000) / 1000;
    return `${rounded}rem`;
}

/**
 * Convert any measurement to pt.
 * Assumes 1pt = 1.333px.
 * Returns the original string if conversion is not possible.
 */
export function toPt(value: string | number | undefined): string {
    const parsed = parseMeasurement(value);
    if (!parsed) return String(value ?? '');
    const {value: num, unit} = parsed;
    let pxValue: number;
    switch (unit) {
        case 'px':
            pxValue = num;
            break;
        case 'pt':
            return `${num}pt`;
        case 'rem':
        case 'em':
            pxValue = num * 16;
            break;
        case '%':
            return `${num}%`;
        case 'vw':
        case 'vh':
        case 'vmin':
        case 'vmax':
            return `${num}${unit}`;
        default:
            return `${num}${unit}`;
    }
    const ptValue = pxValue * (3 / 4);
    const rounded = Math.round(ptValue * 100) / 100;
    return `${rounded}pt`;
}

/**
 * Convert any measurement to px.
 * Returns the original string if conversion is not possible.
 */
export function toPx(value: string | number | undefined, baseFontSizePx = 16): string {
    const parsed = parseMeasurement(value);
    if (!parsed) return String(value ?? '');
    const {value: num, unit} = parsed;
    switch (unit) {
        case 'px':
            return `${num}px`;
        case 'pt':
            return `${Math.round(num * (4 / 3) * 100) / 100}px`;
        case 'rem':
        case 'em':
            return `${Math.round(num * baseFontSizePx * 100) / 100}px`;
        default:
            return `${num}${unit}`;
    }
}

/**
 * Convert a measurement to a target unit.
 * Supported target units: px, pt, rem, em.
 * Relative units (% , vw, vh, etc.) are returned as-is.
 */
export function convertUnit(
    value: string | number | undefined,
    targetUnit: 'px' | 'pt' | 'rem' | 'em',
    baseFontSizePx = 16
): string {
    switch (targetUnit) {
        case 'px':
            return toPx(value, baseFontSizePx);
        case 'pt':
            return toPt(value);
        case 'rem':
        case 'em':
            return toRem(value, baseFontSizePx);
        default:
            return String(value ?? '');
    }
}

/**
 * Get just the unit suffix from a measurement string.
 * Returns empty string if no valid unit is found.
 */
export function getUnit(value: string | number | undefined): string {
    const parsed = parseMeasurement(value);
    return parsed ? parsed.unit : '';
}

/**
 * Round a measurement to a given number of decimal places.
 */
export function roundMeasurement(value: string | number | undefined, decimals = 3): string {
    const parsed = parseMeasurement(value);
    if (!parsed) return String(value ?? '');
    const rounded = Math.round(parsed.value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    return `${rounded}${parsed.unit}`;
}
