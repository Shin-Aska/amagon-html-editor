import { APIv2 } from 'google-font-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const processFonts = (): GoogleFontMeta[] => {
  const fonts: GoogleFontMeta[] = [];

  for (const fontId in APIv2) {
    const font = APIv2[fontId];

    const processedVariants: { weight: string; style: string }[] = [];
    for (const weight of font.weights) {
      for (const style of font.styles) {
        // Map 'normal' to '400' if weight is 'regular' or empty, otherwise use the actual weight.
        // The style 'normal' is explicitly handled.
        // If a font has a 'regular' style, it typically means 400.
        const actualWeight = (weight === 'regular' || weight === '') ? '400' : String(weight);
        const actualStyle = style === 'italic' ? 'italic' : 'normal'; // Ensure style is 'normal' or 'italic'
        processedVariants.push({ weight: actualWeight, style: actualStyle });
      }
    }

    fonts.push({
      family: font.family,
      category: font.category,
      variants: processedVariants,
      popularity: font._popularity,
      subsets: font.subsets,
      lastModified: font.lastModified,
    });
  }

  // Sort by popularity (lower number is more popular)
  return fonts.sort((a, b) => a.popularity - b.popularity);
};

const generateCatalog = async () => {
  try {
    const catalog = processFonts();
    const jsonContent = JSON.stringify(catalog, null, 2);

    console.log(`__dirname: ${__dirname}`);
    console.log(`Calculated outputPath: ${outputPath}`);

    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.promises.mkdir(outputDir, { recursive: true });

    await fs.promises.writeFile(outputPath, jsonContent, 'utf8');

    console.log(`Generated catalog with ${catalog.length} font families.`);
    console.log(`Catalog written to ${outputPath}`);
  } catch (error) {
    console.error('Error generating Google Fonts catalog:', error);
    process.exit(1);
  }
};

generateCatalog();