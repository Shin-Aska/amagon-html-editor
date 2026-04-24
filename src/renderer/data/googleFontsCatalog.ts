import catalog from './google-fonts-catalog.json';

export interface GoogleFontMeta {
    family: string;
    category: string;
    variants: { weight: string; style: string }[];
    popularity: number;
    subsets: string[];
    lastModified: string;
}

export const googleFontsCatalog: GoogleFontMeta[] = catalog;

/**
 * Generates a Google Fonts CSS2 URL for previewing a font.
 * @param family The font family name (e.g., "Roboto").
 * @param weight The font weight (e.g., "400", "700"). Defaults to "400".
 * @param style The font style (e.g., "normal", "italic"). Defaults to "normal".
 * @returns A URL to the Google Fonts CSS2 API.
 */
export function getGoogleFontPreviewUrl(family: string, weight: string = '400', style: string = 'normal'): string {
    const encodedFamily = family.replace(/ /g, '+');
    const variantString = style === 'italic'
        ? `ital,wght@1,${weight}`
        : `wght@${weight}`;

    return `https://fonts.googleapis.com/css2?family=${encodedFamily}:${variantString}&display=swap`;
}
