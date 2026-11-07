// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseFontMetadata } from './google-fonts-metadata';

const font = {
  family: 'Inter', category: 'sans-serif', weights: [400, '700'],
  styles: ['normal', 'italic'], subsets: ['latin'], lastModified: '2026-11-01',
  variants: { unnecessary: 'large download information' },
};

describe('upstream font metadata', () => {
  it('accepts APIv2 families and keeps only fields consumed by the catalog', () => {
    const parsed = parseFontMetadata({ inter: font });
    expect(parsed.inter.weights).toEqual([400, '700']);
    expect(parsed.inter).not.toHaveProperty('variants');
  });

  it('rejects missing, empty, or incompatible metadata before writing a catalog', () => {
    for (const value of [null, {}, [], { inter: { ...font, weights: '400' } }, { inter: { ...font, family: '' } }]) {
      expect(() => parseFontMetadata(value)).toThrow();
    }
  });
});
