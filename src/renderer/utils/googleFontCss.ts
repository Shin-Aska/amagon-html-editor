const GSTATIC_URL_RE = /url\(\s*(['"]?)(https:\/\/fonts\.gstatic\.com\/[^'"\s]+)\1\s*\)/g;
const LATIN_FONT_FACE_RE = /\/\*\s*latin\s*\*\/\s*@font-face\s*\{[\s\S]*?\}/i;
const FIRST_FONT_FACE_RE = /@font-face\s*\{[\s\S]*?\}/i;
const MAX_CACHED_PREVIEWS = 100;
const MAX_CONCURRENT_PREVIEWS = 2;

export interface GoogleFontPreviewRequest {
  family: string;
  weight: string;
  style: string;
}

export interface GoogleFontPreviewResult {
  success: boolean;
  css?: string;
  error?: string;
}

interface GoogleFontPreviewTransport {
  fetchGoogleFontCss: (
    request: GoogleFontPreviewRequest,
  ) => Promise<GoogleFontPreviewResult>;
  fetchGoogleFontFile: (
    url: string,
  ) => Promise<{ success: boolean; dataUri?: string; error?: string }>;
}

const previewCache = new Map<string, GoogleFontPreviewResult>();
const inFlightPreviews = new Map<string, Promise<GoogleFontPreviewResult>>();
const queuedPreviewTasks: Array<() => void> = [];
let activePreviewTasks = 0;

function getPreviewCacheKey({ family, weight, style }: GoogleFontPreviewRequest): string {
  return `${family}\u0000${weight}\u0000${style}`;
}

function cachePreview(key: string, result: GoogleFontPreviewResult): void {
  previewCache.delete(key);
  previewCache.set(key, result);
  if (previewCache.size > MAX_CACHED_PREVIEWS) {
    const oldestKey = previewCache.keys().next().value;
    if (oldestKey) previewCache.delete(oldestKey);
  }
}

function runPreviewTask<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = () => {
      activePreviewTasks++;
      task()
        .then(resolve, reject)
        .finally(() => {
          activePreviewTasks--;
          queuedPreviewTasks.shift()?.();
        });
    };

    if (activePreviewTasks < MAX_CONCURRENT_PREVIEWS) {
      start();
    } else {
      queuedPreviewTasks.push(start);
    }
  });
}

export function extractLatinFontFaceBlock(css: string): string {
  return css.match(LATIN_FONT_FACE_RE)?.[0] ?? css.match(FIRST_FONT_FACE_RE)?.[0] ?? css;
}

export async function rewriteGoogleFontCssWithLocalFiles(
  css: string,
  options: {
    fetchFile: (url: string) => Promise<{ success: boolean; dataUri?: string; error?: string }>;
  },
): Promise<string> {
  const matches = Array.from(css.matchAll(GSTATIC_URL_RE));
  const uniqueUrls = Array.from(new Set(matches.map((match) => match[2])));
  const urlToDataUri = new Map<string, string>();

  await Promise.all(
    uniqueUrls.map(async (url) => {
      const result = await options.fetchFile(url);
      if (!result.success || !result.dataUri) {
        throw new Error(result.error || `Failed to fetch Google Font file: ${url}`);
      }
      urlToDataUri.set(url, result.dataUri);
    }),
  );

  return css.replace(GSTATIC_URL_RE, (match, quote, url) => {
    const dataUri = urlToDataUri.get(url);
    if (!dataUri) return match;
    return `url(${quote}${dataUri}${quote})`;
  });
}

export function getPreviewFontIdForFamily(family: string): string {
  return `__gfont_preview_${family.replace(/\s+/g, "_")}`;
}

function scopePreviewCss(family: string, css: string): string {
  const escapedFamily = family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.replace(
    new RegExp(`font-family:\\s*['"]?${escapedFamily}['"]?`, "g"),
    `font-family: "${getPreviewFontIdForFamily(family)}"`,
  );
}

export function fetchGoogleFontPreviewCss(
  request: GoogleFontPreviewRequest,
  transport: GoogleFontPreviewTransport,
): Promise<GoogleFontPreviewResult> {
  const key = getPreviewCacheKey(request);
  const cached = previewCache.get(key);
  if (cached) {
    cachePreview(key, cached);
    return Promise.resolve(cached);
  }

  const inFlight = inFlightPreviews.get(key);
  if (inFlight) return inFlight;

  const previewPromise = runPreviewTask(async () => {
    const cssResult = await transport.fetchGoogleFontCss(request);
    if (!cssResult.success || typeof cssResult.css !== "string") {
      return {
        success: false,
        error: cssResult.error || "Failed to fetch font preview CSS",
      };
    }

    try {
      const css = await rewriteGoogleFontCssWithLocalFiles(
        extractLatinFontFaceBlock(cssResult.css),
        { fetchFile: transport.fetchGoogleFontFile },
      );
      const result = { success: true, css: scopePreviewCss(request.family, css) };
      cachePreview(key, result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }).finally(() => {
    inFlightPreviews.delete(key);
  });

  inFlightPreviews.set(key, previewPromise);
  return previewPromise;
}

export function applyGoogleFontPreviewStyle(
  family: string,
  css: string,
  cancellation: { cancelled: boolean },
): (() => void) | undefined {
  if (cancellation.cancelled || typeof document === "undefined") return undefined;

  const previewId = getPreviewFontIdForFamily(family);
  if (document.getElementById(previewId)) return undefined;

  const style = document.createElement("style");
  style.id = previewId;
  style.setAttribute("data-gfont-preview", "true");
  style.textContent = css;
  document.head.appendChild(style);

  return () => style.remove();
}

export function clearGoogleFontPreviewCache(): void {
  previewCache.clear();
  inFlightPreviews.clear();
  queuedPreviewTasks.length = 0;
  activePreviewTasks = 0;
}
