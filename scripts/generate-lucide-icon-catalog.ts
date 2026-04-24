import dynamicIconImports from 'lucide-react/dynamicIconImports.mjs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.join(__dirname, '../src/renderer/data/lucideIconCatalog.json');

async function generate() {
  const entries = Object.entries(dynamicIconImports);
  console.log(`Generating catalog for ${entries.length} icons...`);

  const catalog: Record<string, [string, Record<string, string>][]> = {};

  for (const [name, loader] of entries) {
    try {
      const mod = await loader();
      if (mod.__iconNode) {
        catalog[name] = mod.__iconNode;
      }
    } catch (err) {
      console.warn(`Failed to load icon "${name}":`, (err as Error).message);
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2));

  console.log(`Wrote ${Object.keys(catalog).length} icons to ${outputPath}`);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
