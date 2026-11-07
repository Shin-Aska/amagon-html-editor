import {
  canonicalizePortablePath,
  decodeDurableAssetReference,
} from "./assetReference";
import type { AssetUsageReview } from "./assetMaintenanceContract";
import type { DurableProjectData } from "./projectIpcContract";
import { scanProjectPortability } from "./projectPortability";

/** Conservative, on-demand analysis of every page, preset, template and code field. */
export function reviewProjectAssetUsage(
  project: DurableProjectData,
  availablePaths: readonly string[],
  sessionId: string,
): AssetUsageReview {
  const fonts = project.projectSettings.fonts ?? [];
  const withoutFontLibrary = {
    ...project,
    projectSettings: { ...project.projectSettings, fonts: [] },
  };
  const scan = scanProjectPortability(withoutFontLibrary, {
    mode: "legacy-stored",
    allowMissingLegacyAssets: true,
    sessionId,
    availableAssetPaths: availablePaths,
  });
  const usedPaths = new Set(scan.referencedAssetPaths);
  const available = new Set(availablePaths);
  const words = new Set<string>();
  let uncertainCode = false;
  let uncertainFonts = false;
  const retainLiteral = (reference: string): void => {
    let decoded: string;
    try {
      decoded = decodeDurableAssetReference(reference);
    } catch {
      decoded = reference;
    } // Extension code may contain raw filenames.
    try {
      // Keep both interpretations of a literal percent sequence in unknown fields.
      usedPaths.add(canonicalizePortablePath(decoded));
      usedPaths.add(canonicalizePortablePath(reference));
    } catch {
      uncertainCode = true;
    }
  };
  const collect = (value: unknown, key = ""): void => {
    if (typeof value === "string") {
      // Include extension fields and literal paths in custom code as well as standard references.
      for (const word of value.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [])
        words.add(word);
      const direct = value.replace(/^\.\//u, "");
      if (direct.startsWith("assets/")) retainLiteral(direct);
      for (const match of value.matchAll(/assets\/[^\s"'`()<>{};]+/gu))
        retainLiteral(match[0]);
      for (const match of value.matchAll(/(["'])(?:\.\/)?(assets\/.*?)\1/gu))
        retainLiteral(match[2] ?? "");
      if (
        (/font/iu.test(key) && /var\(|\\|\$\{|\+/u.test(value)) ||
        /font(?:-family)?\s*:[^;}]*(?:var\(|\\)|@import\b/iu.test(value)
      )
        uncertainFonts = true;
      if (
        (/^(?:events|on[a-z]+|(?:custom)?(?:java)?script|(?:custom)?js|code)$/iu.test(
          key,
        ) &&
          value.trim()) ||
        /<script\b|\bon[a-z]+\s*=|javascript:|\$\{|assets\/['"`]\s*\+/iu.test(
          value,
        )
      )
        uncertainCode = true;
    } else if (Array.isArray(value))
      value.forEach((item) => collect(item, key));
    else if (value !== null && typeof value === "object") {
      for (const [childKey, child] of Object.entries(value))
        collect(child, key === "events" ? "events" : childKey);
    }
  };
  collect(withoutFontLibrary);
  // A linked stylesheet, SVG, HTML or other resource may itself reference more files.
  const linkedResources = [...usedPaths].some(
    (asset) =>
      (available.has(asset) || /\.[a-z0-9]+$/iu.test(asset)) &&
      !/\.(?:png|jpe?g|gif|webp|avif|apng|bmp|ico|tiff?|mp4|webm|og[gv]|mov|m4v|wav|mp3|flac|aac|woff2?|ttf|otf)$/iu.test(
        asset,
      ),
  );
  // Unknown code can compute a filename at runtime. Keep those assets for manual review.
  if (uncertainCode || linkedResources || scan.offenders.length > 0)
    return {
      candidates: [],
      explanation:
        "Automatic cleanup is unavailable because linked resources, custom code or unresolved references may use assets dynamically. Review these references manually first.",
    };
  const removableFonts = new Map<string, string[]>();
  for (const font of fonts) {
    let relativePath: string;
    try {
      relativePath = decodeDurableAssetReference(font.relativePath);
    } catch {
      continue;
    } // External/system fonts cannot be removed by project cleanup.
    const nameWords = font.name.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
    if (
      uncertainFonts ||
      nameWords.length === 0 ||
      nameWords.every((word) => words.has(word))
    )
      usedPaths.add(relativePath);
    else {
      const ids = removableFonts.get(relativePath) ?? [];
      ids.push(font.id);
      removableFonts.set(relativePath, ids);
    }
  }
  const candidates: AssetUsageReview["candidates"][number][] = [];
  for (const relativePath of [...available].sort()) {
    if (!usedPaths.has(relativePath))
      candidates.push({
        key: `file:${relativePath}`,
        kind: "file",
        relativePath,
        fontIds: removableFonts.get(relativePath) ?? [],
      });
  }
  for (const [relativePath, fontIds] of removableFonts) {
    if (!available.has(relativePath) && !usedPaths.has(relativePath))
      candidates.push({
        key: `missing:${relativePath}`,
        kind: "missing-entry",
        relativePath,
        fontIds,
      });
  }
  return {
    candidates,
    explanation: uncertainFonts
      ? "Fonts governed by CSS variables, escapes or imported stylesheets are kept because their usage cannot be established safely."
      : null,
  };
}
