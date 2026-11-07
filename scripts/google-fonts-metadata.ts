import { z } from 'zod';

// The same APIv2 data previously imported from google-font-metadata, without
// installing its unused generation CLI and browser automation dependencies.
export const METADATA_URL = 'https://raw.githubusercontent.com/fontsource/google-font-metadata/13b377dee7c5cfab786f4949953f770f4862368b/data/google-fonts-v2.json';

const fontSchema = z.object({
  family: z.string().min(1),
  category: z.string().min(1),
  weights: z.array(z.union([z.number(), z.string()])),
  styles: z.array(z.string()),
  subsets: z.array(z.string()),
  lastModified: z.string(),
});

export function parseFontMetadata(value: unknown) {
  return z.record(z.string(), fontSchema).refine(
    (fonts) => Object.keys(fonts).length > 0,
    'Font metadata must contain at least one family',
  ).parse(value);
}

export async function fetchFontMetadata() {
  const response = await fetch(METADATA_URL, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Could not fetch font metadata (${response.status})`);
  return parseFontMetadata(await response.json());
}
