import {APIv2} from 'google-font-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

interface GoogleFontMeta {
  family: string;
  category: string;
  variants: { weight: string; style: string }[];
  popularity: number;
  subsets: string[];
  lastModified: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.join(__dirname, '../src/renderer/data/google-fonts-catalog.json');

/**
 * Fetch popularity ranks from the public Google Fonts metadata endpoint.
 * Returns a map of { [familyName.toLowerCase()]: popularityRank }.
 * No API key required — this endpoint is the same one powering fonts.google.com.
 */
async function fetchPopularityMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await fetch('https://fonts.google.com/metadata/fonts');
    if (!res.ok) {
      console.warn(`Warning: Could not fetch popularity data (${res.status}). Falling back to alphabetical order.`);
      return map;
    }
    // Google prepends a XSSI guard: )]}'\n — strip it before parsing
    const raw = await res.text();
    const json = raw.replace(/^\)\]\}'\n?/, '');
    const data = JSON.parse(json) as { familyMetadataList?: { family: string; popularity?: number }[] };
    for (const entry of data.familyMetadataList ?? []) {
      if (entry.family && typeof entry.popularity === 'number') {
        map.set(entry.family.toLowerCase(), entry.popularity);
      }
    }
    console.log(`Fetched popularity ranks for ${map.size} font families.`);
  } catch (err) {
    console.warn('Warning: Failed to fetch popularity data:', (err as Error).message);
    console.warn('Falling back to alphabetical order.');
  }
  return map;
}

const processFonts = (popularityMap: Map<string, number>): GoogleFontMeta[] => {
  const fonts: GoogleFontMeta[] = [];

  for (const fontId in APIv2) {
    const font = APIv2[fontId];

    const processedVariants: { weight: string; style: string }[] = [];
    for (const weight of font.weights) {
      for (const style of font.styles) {
        const actualWeight = (weight === 'regular' || weight === '') ? '400' : String(weight);
        const actualStyle = style === 'italic' ? 'italic' : 'normal';
        processedVariants.push({ weight: actualWeight, style: actualStyle });
      }
    }

    // Popularity: lower number = more popular (rank 1 is most popular).
    // Use a large fallback so un-ranked fonts sort to the end alphabetically.
    const popularity = popularityMap.get(font.family.toLowerCase()) ?? 99999;

    fonts.push({
      family: font.family,
      category: font.category,
      variants: processedVariants,
      popularity,
      subsets: font.subsets,
      lastModified: font.lastModified,
    });
  }

  // Sort by popularity rank (1 = most popular), un-ranked fonts at the end
  return fonts.sort((a, b) => a.popularity - b.popularity);
};

const generateCatalog = async () => {
  try {
    const popularityMap = await fetchPopularityMap();
    const catalog = processFonts(popularityMap);
    const jsonContent = JSON.stringify(catalog, null, 2);

    const outputDir = path.dirname(outputPath);
    await fs.promises.mkdir(outputDir, { recursive: true });

    await fs.promises.writeFile(outputPath, jsonContent, 'utf8');

    const ranked = catalog.filter((f) => f.popularity < 99999).length;
    console.log(`Generated catalog with ${catalog.length} font families (${ranked} with popularity rank).`);
    console.log(`Most popular: ${catalog.slice(0, 5).map((f) => `${f.family} (#${f.popularity})`).join(', ')}`);
    console.log(`Catalog written to ${outputPath}`);
  } catch (error) {
    console.error('Error generating Google Fonts catalog:', error);
    process.exit(1);
  }
};

generateCatalog();