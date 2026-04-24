import type {Block, FontAsset, FrameworkChoice, Page, PageFolder, ProjectData} from '../store/types'
import {themeToCSS} from '../store/types'
import {blockToHtml} from './blockToHtml'
import {getApi} from './api'

export interface ExportFile {
    path: string
    content: string | Uint8Array
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!)
    }
    return btoa(binary)
}

export interface ExportEngineOptions {
    assetsDir?: string
    resolveAsset?: (url: string) => Promise<ResolvedAsset | null>
    customCss?: string
    includeJs?: boolean
    minify?: boolean
    inlineCss?: boolean
    inlineAssets?: boolean
    onlyPageId?: string
}

export interface ResolvedAsset {
    bytes: Uint8Array
    mimeType?: string
    suggestedFileName?: string
}

interface BuildContext {
    assetsDir: string
    cssRules: Map<string, string> // className -> declarations
    googleFonts: Set<string>
    assetUrlToToken: Map<string, string>
    assetTokenToUrl: Map<string, string>
    assetTokenToPreferredName: Map<string, string>
    assetTokenToOutputPath: Map<string, string>
    assetTokenToRef: Map<string, string>
    pageIdToFileName: Map<string, string>
    pageSlugToFileName: Map<string, string>
    pageTitleToFileName: Map<string, string>
    usedAssetNames: Set<string>
    assetsToFetch: Set<string>
    assetSeq: number
}

const GENERIC_FONTS = new Set([
    'serif',
    'sans-serif',
    'monospace',
    'cursive',
    'fantasy',
    'system-ui',
    '-apple-system',
    'arial',
    'helvetica',
    'times new roman',
    'courier new',
    'verdana',
    'georgia',
    'trebuchet ms'
]);

const EXPORT_STYLESHEET_HREF = './styles.css'
const BOOTSTRAP_EXPORT_CSS_URL = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css'
const BOOTSTRAP_ICONS_EXPORT_CSS_URL = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
const BOOTSTRAP_EXPORT_JS_URL = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
const TAILWIND_EXPORT_JS_URL = 'https://cdn.tailwindcss.com'

export async function exportProject(
    project: ProjectData,
    options: ExportEngineOptions = {}
): Promise<ExportFile[]> {
    const exportFonts = normalizeFontsForExport(project.projectSettings.fonts);

    const pageIdToFileName = new Map<string, string>();
    const pageSlugToFileName = new Map<string, string>();
    const pageTitleToFileName = new Map<string, string>();

    for (const page of project.pages) {
        const base = sanitizeSlug(page.slug || page.title || 'index');
        const fileName = `${base}.html`;
        pageIdToFileName.set(page.id, fileName);
        const rawSlug = String(page.slug || '');
        const rawTitle = String(page.title || '');
        pageSlugToFileName.set(rawSlug, fileName);
        pageSlugToFileName.set(sanitizeSlug(rawSlug), fileName);
        pageSlugToFileName.set(base, fileName);
        pageTitleToFileName.set(rawTitle, fileName);
        pageTitleToFileName.set(sanitizeSlug(rawTitle), fileName)
    }

    const ctx: BuildContext = {
        assetsDir: options.assetsDir ?? 'assets',
        cssRules: new Map(),
        googleFonts: new Set(),
        assetUrlToToken: new Map(),
        assetTokenToUrl: new Map(),
        assetTokenToPreferredName: new Map(),
        assetTokenToOutputPath: new Map(),
        assetTokenToRef: new Map(),
        pageIdToFileName,
        pageSlugToFileName,
        pageTitleToFileName,
        usedAssetNames: new Set(),
        assetsToFetch: new Set(),
        assetSeq: 0
    };

    const pagesToExport = options.onlyPageId
        ? project.pages.filter((p) => p.id === options.onlyPageId)
        : project.pages;

    const exportPages = pagesToExport.map((page) => {
        const blocks = sanitizeAndTransformBlocks(page.blocks, ctx);
        return {
            ...page,
            blocks
        }
    });

    const resolveAsset = options.resolveAsset ?? createDefaultAssetResolver();
    const assetFiles = await buildAssetFiles(ctx, resolveAsset, Boolean(options.inlineAssets));
    const fontFiles = await buildFontFiles(exportFonts, resolveAsset);
    const selfHostedFamilies = getSelfHostedFontFamilies(exportFonts);

    const cssRaw = replaceAssetTokens(buildStylesCss(ctx, project, exportFonts, options.customCss), ctx);
    const css = options.minify ? minifyCss(cssRaw) : cssRaw;
    const hasCss = css.trim().length > 0;

    const files: ExportFile[] = [];

    if (hasCss && !options.inlineCss) {
        files.push({
            path: 'styles.css',
            content: css
        })
    }

    for (const page of exportPages) {
        const rawHtml = buildPageHtml({
            title: page.pageTitle || page.title,
            framework: project.projectSettings.framework,
            meta: page.meta,
            fullWidthFormControls: page.fullWidthFormControls,
            bodyBlocks: page.blocks,
            includeStylesheet: hasCss && !options.inlineCss,
            inlineCssText: hasCss && options.inlineCss ? css : null,
            googleFonts: ctx.googleFonts,
            selfHostedFamilies,
            includeJs: options.includeJs ?? true,
            pages: project.pages,
            folders: project.folders
        });

        const htmlRaw = replaceAssetTokens(rawHtml, ctx);
        const html = options.minify ? minifyHtml(htmlRaw) : htmlRaw;
        const fileName = `${sanitizeSlug(page.slug || page.title || 'index')}.html`;
        files.push({path: fileName, content: html})
    }

    if (!options.inlineAssets) {
        files.push(...assetFiles)
    }
    files.push(...fontFiles);
    return files
}

function sanitizeAndTransformBlocks(blocks: Block[], ctx: BuildContext): Block[] {
    return blocks.map((b) => sanitizeAndTransformBlock(b, ctx))
}

function sanitizeAndTransformBlock(block: Block, ctx: BuildContext): Block {
    const next: Block = {
        ...block,
        props: sanitizeProps(block.props),
        classes: sanitizeClasses(block.classes),
        styles: {...block.styles},
        children: block.children.map((c) => sanitizeAndTransformBlock(c, ctx))
    };

    // Asset rewrite in props (common cases)
    next.props = rewriteAssetUrlsInProps(next.props, ctx);

    // Internal page link rewrite in props
    next.props = rewriteInternalPageLinksInProps(next.props, ctx);

    // Asset rewrite inside raw HTML content blocks (scan HTML string)
    if (next.type === 'raw-html') {
        if (typeof next.content === 'string' && next.content.trim().length > 0) {
            next.content = rewriteInternalPageLinksInHtmlSnippet(
                rewriteAssetUrlsInHtmlSnippet(next.content, ctx),
                ctx
            )
        }
        const maybePropContent = next.props.content;
        if (typeof maybePropContent === 'string' && maybePropContent.trim().length > 0) {
            next.props = {
                ...next.props,
                content: rewriteInternalPageLinksInHtmlSnippet(
                    rewriteAssetUrlsInHtmlSnippet(maybePropContent, ctx),
                    ctx
                )
            }
        }
    }

    // Extract styles into CSS
    const extracted = extractStylesAsClass(next.styles, ctx);
    if (extracted.className) {
        next.classes = [...next.classes, extracted.className]
    }
    next.styles = extracted.remainingStyles;

    return next
}

function sanitizeProps(props: Record<string, unknown>): Record<string, unknown> {
    const next: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(props)) {
        const key = String(k);

        // Strip editor artifacts
        if (key === 'data-block-id') continue;
        if (key === 'dataBlockId') continue;
        if (key.toLowerCase().startsWith('data-editor')) continue;
        if (key.toLowerCase().startsWith('dataeditor')) continue;

        next[key] = v
    }

    return next
}

function sanitizeClasses(classes: string[]): string[] {
    return classes.filter((c) => {
        return Boolean(c)
            && !c.startsWith('html-editor-')
            && !c.startsWith('editor-')
            && !c.startsWith('canvas-')
    })
}

function extractStylesAsClass(
    styles: Record<string, string>,
    ctx: BuildContext
): { className: string | null; remainingStyles: Record<string, string> } {
    const entries = Object.entries(styles).filter(([, v]) => v !== undefined && v !== '');
    if (entries.length === 0) return {className: null, remainingStyles: {}};

    // Normalize order for deterministic hashing
    entries.sort(([a], [b]) => a.localeCompare(b));

    // Rewrite asset URLs inside style values (e.g., backgroundImage: url(...))
    const rewrittenEntries: Array<[string, string]> = entries.map(([k, v]) => {
        const rewritten = rewriteAssetUrlsInCssValue(v, ctx);
        return [k, rewritten]
    });

    // Collect Google Fonts
    const fontFamily = rewrittenEntries.find(([k]) => k === 'fontFamily')?.[1];
    if (fontFamily) {
        for (const family of extractFontFamilies(fontFamily)) {
            if (!GENERIC_FONTS.has(family.toLowerCase())) {
                ctx.googleFonts.add(family)
            }
        }
    }

    const decl = rewrittenEntries
        .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
        .join('; ');

    const hash = stableHash(decl);
    const className = `x-${hash}`;

    if (!ctx.cssRules.has(className)) {
        ctx.cssRules.set(className, decl)
    }

    return {className, remainingStyles: {}}
}

function rewriteAssetUrlsInProps(
    props: Record<string, unknown>,
    ctx: BuildContext
): Record<string, unknown> {
    return rewriteAssetUrlsDeep(props, ctx, []) as Record<string, unknown>
}

function rewriteInternalPageLinksInProps(
    props: Record<string, unknown>,
    ctx: BuildContext
): Record<string, unknown> {
    return rewriteInternalPageLinksDeep(props, ctx, []) as Record<string, unknown>
}

function rewriteInternalPageLinksDeep(value: unknown, ctx: BuildContext, keyPath: string[]): unknown {
    if (typeof value === 'string') {
        const lastKey = keyPath[keyPath.length - 1] || '';
        if (String(lastKey).toLowerCase() === 'href') {
            return rewriteInternalHref(value, ctx)
        }
        return value
    }

    if (Array.isArray(value)) {
        return value.map((v) => rewriteInternalPageLinksDeep(v, ctx, keyPath))
    }

    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
            out[k] = rewriteInternalPageLinksDeep(v, ctx, [...keyPath, k])
        }
        return out
    }

    return value
}

function rewriteInternalHref(href: string, ctx: BuildContext): string {
    const raw = href.trim();
    if (!raw) return href;

    const lower = raw.toLowerCase();
    if (
        lower.startsWith('http://') ||
        lower.startsWith('https://') ||
        lower.startsWith('mailto:') ||
        lower.startsWith('tel:') ||
        lower.startsWith('#') ||
        lower.startsWith('data:') ||
        lower.startsWith('blob:') ||
        lower.startsWith('file://') ||
        lower.startsWith('app-media://')
    ) {
        return href
    }

    const hashIdx = raw.indexOf('#');
    const qIdx = raw.indexOf('?');
    const cutIdx =
        hashIdx === -1
            ? qIdx
            : qIdx === -1
                ? hashIdx
                : Math.min(hashIdx, qIdx);

    const base = cutIdx === -1 ? raw : raw.slice(0, cutIdx);
    const suffix = cutIdx === -1 ? '' : raw.slice(cutIdx);

    const normalized = base.replace(/^\.[/\\]/, '').replace(/^\//, '').replace(/\.html?$/i, '');
    const normalizedSlug = sanitizeSlug(normalized);

    if (normalized.startsWith('page:')) {
        const id = normalized.slice('page:'.length);
        const file = ctx.pageIdToFileName.get(id);
        if (file) return `./${file}${suffix}`;
        return href
    }

    const bySlug = ctx.pageSlugToFileName.get(normalized);
    if (bySlug) return `./${bySlug}${suffix}`;

    const bySlugSanitized = ctx.pageSlugToFileName.get(normalizedSlug);
    if (bySlugSanitized) return `./${bySlugSanitized}${suffix}`;

    const byTitle = ctx.pageTitleToFileName.get(normalized);
    if (byTitle) return `./${byTitle}${suffix}`;

    const byTitleSanitized = ctx.pageTitleToFileName.get(normalizedSlug);
    if (byTitleSanitized) return `./${byTitleSanitized}${suffix}`;

    return href
}

function rewriteAssetUrlsDeep(value: unknown, ctx: BuildContext, keyPath: string[]): unknown {
    if (typeof value === 'string') {
        const lastKey = keyPath[keyPath.length - 1] || '';
        if (looksLikeAssetUrl(value, lastKey)) {
            return registerAsset(value, ctx)
        }
        return value
    }

    if (Array.isArray(value)) {
        return value.map((v) => rewriteAssetUrlsDeep(v, ctx, keyPath))
    }

    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
            out[k] = rewriteAssetUrlsDeep(v, ctx, [...keyPath, k])
        }
        return out
    }

    return value
}

function rewriteAssetUrlsInCssValue(value: string, ctx: BuildContext): string {
    // Replace url('...') and url("...") and url(...) patterns
    return value.replace(/url\(([^)]+)\)/g, (_m, inner) => {
        const raw = String(inner).trim().replace(/^['"]|['"]$/g, '');
        if (!looksLikeAssetUrl(raw)) {
            return `url(${inner})`
        }
        const rewritten = registerAsset(raw, ctx);
        return `url('${rewritten}')`
    })
}

function looksLikeAssetUrl(url: string, keyHint?: string): boolean {
    const u = url.trim();
    if (u.startsWith('http://') || u.startsWith('https://')) return false;

    const key = (keyHint || '').toLowerCase();
    const keyLooksLikeUrlTarget =
        key === 'src' ||
        key === 'href' ||
        key === 'poster' ||
        key === 'background' ||
        key === 'backgroundimage' ||
        key.endsWith('src') ||
        key.endsWith('href');

    if (u.startsWith('app-media://')) return true;
    if (u.startsWith('blob:')) return true;
    if (u.startsWith('data:')) return true;
    if (u.startsWith('file://')) return true;

    if (!keyLooksLikeUrlTarget) return false;

    return /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff)$/i.test(u)
}

function registerAsset(originalUrl: string, ctx: BuildContext): string {
    const existing = ctx.assetUrlToToken.get(originalUrl);
    if (existing) return existing;

    const token = `__HTML_EDITOR_ASSET_${ctx.assetSeq}__`;
    ctx.assetSeq++;

    ctx.assetUrlToToken.set(originalUrl, token);
    ctx.assetTokenToUrl.set(token, originalUrl);
    ctx.assetTokenToPreferredName.set(token, guessFileNameFromUrl(originalUrl));
    ctx.assetsToFetch.add(token);

    return token
}

function guessFileNameFromUrl(url: string): string {
    if (url.startsWith('data:') || url.startsWith('blob:')) {
        return 'asset'
    }
    try {
        const parsed = new URL(url);

        // app-media URLs carry a pathname we can use
        const base = parsed.pathname.split('/').filter(Boolean).pop();
        if (base) return sanitizeFileName(decodeURIComponent(base));

        return 'asset'
    } catch {
        // Non-absolute URL; fall back
        const trimmed = url.split('?')[0].split('#')[0];
        const parts = trimmed.split('/').filter(Boolean);
        const last = parts[parts.length - 1];
        return sanitizeFileName(last || 'asset')
    }
}

function makeUniqueAssetName(preferredName: string, desiredExt: string, ctx: BuildContext): string {
    const base = preferredName || 'asset';
    const {name, ext: preferredExt} = splitExt(base);
    const finalExt = preferredExt || desiredExt;

    let candidate = `${name}${finalExt}`;
    let i = 1;
    while (ctx.usedAssetNames.has(candidate)) {
        candidate = `${name}-${i}${finalExt}`;
        i++
    }

    ctx.usedAssetNames.add(candidate);
    return candidate
}

function splitExt(fileName: string): { name: string; ext: string } {
    const idx = fileName.lastIndexOf('.');
    if (idx <= 0 || idx === fileName.length - 1) return {name: fileName, ext: ''};
    return {name: fileName.slice(0, idx), ext: fileName.slice(idx)}
}

function sanitizeFileName(name: string): string {
    const trimmed = name.trim() || 'asset';
    return trimmed.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function sanitizeSlug(slug: string): string {
    const s = slug
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '');

    return s || 'index'
}

function buildStylesCss(
    ctx: BuildContext,
    project: ProjectData,
    exportFonts: FontAsset[],
    customCss?: string
): string {
    const lines: string[] = [];

    // Theme CSS variables and base styles (inserted first so everything else can override)
    const theme = project.projectSettings.theme;
    const themes = project.projectSettings.themes;
    if (theme && typeof theme === 'object' && theme.colors) {
        const themeCss = themeToCSS(theme, themes, exportFonts, {fontUrlPrefix: './'});
        if (themeCss.trim()) lines.push(themeCss.trim())
    }

    const globalStyles = buildGlobalStylesCss(project.projectSettings.globalStyles);
    if (globalStyles) lines.push(globalStyles);

    if (customCss && customCss.trim().length > 0) {
        lines.push(customCss.trim())
    }

    // Extracted class styles
    for (const [className, decl] of ctx.cssRules.entries()) {
        lines.push(`.${className} { ${decl}; }`)
    }

    return lines.join('\n')
}

function normalizeFontsForExport(fonts: FontAsset[] | undefined): FontAsset[] {
    if (!Array.isArray(fonts) || fonts.length === 0) return [];

    return fonts.map((font) => {
        const rawRel = String(font.relativePath || '')
            .replace(/^[/\\]+/, '')
            .replace(/\\/g, '/');

        const normalizedRel =
            rawRel.startsWith('assets/fonts/')
                ? rawRel
                : `assets/fonts/${sanitizeFileName(
                    font.fileName ||
                    (font.name ? `${font.name}.${font.format}` : `font.${font.format}`)
                )}`;

        return {...font, relativePath: normalizedRel}
    })
}

async function buildFontFiles(
    fonts: FontAsset[],
    resolveAsset: (url: string) => Promise<ResolvedAsset | null>
): Promise<ExportFile[]> {
    if (!fonts || fonts.length === 0) return [];

    const files: ExportFile[] = [];
    const written = new Set<string>();

    for (const font of fonts) {
        const rel = String(font.relativePath || '')
            .replace(/^[/\\]+/, '')
            .replace(/\\/g, '/');

        if (!rel) continue;
        if (!rel.startsWith('assets/fonts/')) continue;
        if (written.has(rel)) continue;

        const url = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rel)
            ? rel
            : `app-media://project-asset/${rel}`;

        const resolved = await resolveAsset(url);
        if (!resolved) continue;

        written.add(rel);
        files.push({path: rel, content: resolved.bytes})
    }

    return files
}

function buildGlobalStylesCss(globalStyles: Record<string, string> | undefined): string {
    if (!globalStyles) return '';

    const entries = Object.entries(globalStyles).filter(([, v]) => v !== undefined && v !== '');
    if (entries.length === 0) return '';

    const decl = entries
        .map(([k, v]) => `${camelToKebab(String(k))}: ${String(v)}`)
        .join('; ');

    return `:root { ${decl}; }`
}

function replaceAssetTokens(text: string, ctx: BuildContext): string {
    let out = text;
    for (const [token, ref] of ctx.assetTokenToRef.entries()) {
        out = out.split(token).join(ref)
    }
    return out
}

function rewriteInternalPageLinksInHtmlSnippet(html: string, ctx: BuildContext): string {
    let out = html;
    out = out.replace(/\bhref\s*=\s*(["'])([^"']*)\1/gi, (m, quote, value) => {
        const rewritten = rewriteInternalHref(String(value), ctx);
        if (rewritten === value) return m;
        return `href=${quote}${rewritten}${quote}`
    });
    out = out.replace(/\bhref\s*=\s*([^"'\s>]+)/gi, (m, value) => {
        const rewritten = rewriteInternalHref(String(value), ctx);
        if (rewritten === value) return m;
        return `href=${rewritten}`
    });
    return out
}

function rewriteAssetUrlsInHtmlSnippet(html: string, ctx: BuildContext): string {
    let out = html;

    // url(...) patterns in inline CSS / style tags
    out = rewriteAssetUrlsInCssValue(out, ctx);

    // src/href/poster="..." (quoted)
    out = out.replace(/\b(src|href|poster)\s*=\s*(["'])([^"']*)\2/gi, (m, attr, quote, value) => {
        const raw = String(value).trim();
        if (!looksLikeAssetUrl(raw, String(attr))) return m;
        const token = registerAsset(raw, ctx);
        return `${attr}=${quote}${token}${quote}`
    });

    // srcset="..." (quoted) — rewrite each URL token
    out = out.replace(/\bsrcset\s*=\s*(["'])([^"']*)\1/gi, (m, quote, value) => {
        const raw = String(value);
        const parts = raw
            .split(',')
            .map((p: string) => p.trim())
            .filter(Boolean);

        if (parts.length === 0) return m;

        const rewritten = parts
            .map((part: string) => {
                const segs = part.split(/\s+/).filter(Boolean);
                const url = segs[0] || '';
                const descriptor = segs.slice(1).join(' ');
                if (!looksLikeAssetUrl(url, 'src')) return part;
                const token = registerAsset(url, ctx);
                return descriptor ? `${token} ${descriptor}` : token
            })
            .join(', ');

        return `srcset=${quote}${rewritten}${quote}`
    });

    // Unquoted attributes (best-effort)
    out = out.replace(/\b(src|href|poster)\s*=\s*([^"'\s>]+)/gi, (m, attr, value) => {
        const raw = String(value).trim();
        if (!looksLikeAssetUrl(raw, String(attr))) return m;
        const token = registerAsset(raw, ctx);
        return `${attr}=${token}`
    });

    return out
}

function buildPageHtml(params: {
    title: string
    framework: FrameworkChoice
    meta: Record<string, string>
    bodyBlocks: Block[]
    includeStylesheet: boolean
    inlineCssText: string | null
    googleFonts: Set<string>
    selfHostedFamilies: Set<string>
    includeJs: boolean
    pages?: Page[]
    folders?: PageFolder[]
    fullWidthFormControls?: boolean
}): string {
    const bodyHtml = blockToHtml(params.bodyBlocks, {
        indent: 1,
        indentSize: 2,
        includeDataAttributes: false,
        pages: params.pages,
        folders: params.folders,
        framework: params.framework,
        fullWidthFormControls: params.fullWidthFormControls
    });

    const headParts: string[] = [];

    // Meta
    const charset = params.meta.charset || 'UTF-8';
    const viewport = params.meta.viewport || 'width=device-width, initial-scale=1.0';

    headParts.push(`    <meta charset="${escapeAttrValue(charset)}">`);
    headParts.push(`    <meta name="viewport" content="${escapeAttrValue(viewport)}">`);

    for (const [name, content] of Object.entries(params.meta)) {
        if (name === 'charset' || name === 'viewport') continue;
        headParts.push(
            `    <meta name="${escapeAttrValue(name)}" content="${escapeAttrValue(content)}">`
        )
    }

    headParts.push(`    <title>${escapeHtml(params.title)}</title>`);

    // Framework
    headParts.push(getFrameworkHead(params.framework, params.includeJs));

    // Google Fonts
    const googleFontLinks = buildGoogleFontsHead(params.googleFonts, params.selfHostedFamilies);
    if (googleFontLinks) {
        headParts.push(googleFontLinks)
    }

    // Stylesheet
    if (params.inlineCssText) {
        headParts.push(`    <style>\n${params.inlineCssText}\n    </style>`)
    } else if (params.includeStylesheet) {
        headParts.push(`    <link rel="stylesheet" href="${EXPORT_STYLESHEET_HREF}">`)
    }

    // Compact head formatting: framework head already contains newlines
    const head = headParts
        .filter(Boolean)
        .join('\n')
        .replace(/\n\n+/g, '\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
${head}
</head>
<body>
${bodyHtml}
</body>
</html>`
}

function getFrameworkHead(framework: FrameworkChoice, includeJs: boolean): string {
    switch (framework) {
        case 'bootstrap-5':
            return includeJs
                ? `    <link href="${BOOTSTRAP_EXPORT_CSS_URL}" rel="stylesheet">
    <link href="${BOOTSTRAP_ICONS_EXPORT_CSS_URL}" rel="stylesheet">
    <script src="${BOOTSTRAP_EXPORT_JS_URL}" defer><\/script>`
                : `    <link href="${BOOTSTRAP_EXPORT_CSS_URL}" rel="stylesheet">
    <link href="${BOOTSTRAP_ICONS_EXPORT_CSS_URL}" rel="stylesheet">`;
        case 'tailwind':
            return includeJs
                ? `    <link href="${BOOTSTRAP_ICONS_EXPORT_CSS_URL}" rel="stylesheet">
    <script src="${TAILWIND_EXPORT_JS_URL}"><\/script>`
                : `    <link href="${BOOTSTRAP_ICONS_EXPORT_CSS_URL}" rel="stylesheet">`;
        case 'vanilla':
        default:
            return ''
    }
}

function minifyCss(css: string): string {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}:;,])\s*/g, '$1')
        .trim()
}

function minifyHtml(html: string): string {
    return html
        .replace(/>\s+</g, '><')
        .replace(/\s{2,}/g, ' ')
        .trim()
}

function buildGoogleFontsHead(fonts: Set<string>, selfHostedFamilies: Set<string>): string {
    const families = Array.from(fonts)
        .map((f) => f.trim())
        .filter(Boolean)
        .filter((family) => !selfHostedFamilies.has(family.toLowerCase()));

    if (families.length === 0) return '';

    // Basic Google Fonts CSS2 link per family.
    // This won't handle weights/italics perfectly but satisfies the requirement.
    const links = families.map((family) => {
        const encoded = encodeURIComponent(family).replace(/%20/g, '+');
        return `    <link href="https://fonts.googleapis.com/css2?family=${encoded}&display=swap" rel="stylesheet">`
    });

    return links.join('\n')
}

function getSelfHostedFontFamilies(fonts: FontAsset[]): Set<string> {
    const families = new Set<string>();

    for (const font of fonts) {
        const relativePath = String(font.relativePath || '').trim();
        if (!relativePath) continue;
        families.add(String(font.name || '').trim().toLowerCase())
    }

    return families
}

function extractFontFamilies(fontFamily: string): string[] {
    // e.g. "'Helvetica Neue', Helvetica, sans-serif" -> [Helvetica Neue, Helvetica, sans-serif]
    return fontFamily
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
}

function camelToKebab(str: string): string {
    return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

function stableHash(input: string): string {
    // Small deterministic non-cryptographic hash (djb2)
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
        hash = (hash * 33) ^ input.charCodeAt(i)
    }
    // Convert to unsigned + base36
    return (hash >>> 0).toString(36)
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function escapeAttrValue(value: string): string {
    return escapeHtml(value)
}

function createDefaultAssetResolver(): (url: string) => Promise<ResolvedAsset | null> {
    return async (url: string) => {
        // Prefer Electron IPC bridge if this is an app-media URL
        if (url.startsWith('app-media://')) {
            const api = getApi();
            const result = await api.assets.readAsset(url);
            if (!result.success || !result.data) return null;

            const parsed = parseDataUrl(result.data);
            if (!parsed) return null;

            return {
                bytes: parsed.bytes,
                mimeType: parsed.mimeType,
                suggestedFileName: guessExtFromMime(parsed.mimeType)
                    ? `asset${guessExtFromMime(parsed.mimeType)}`
                    : undefined
            }
        }

        // data: URL
        if (url.startsWith('data:')) {
            const parsed = parseDataUrl(url);
            if (!parsed) return null;
            return {bytes: parsed.bytes, mimeType: parsed.mimeType}
        }

        // blob:, file:, relative, etc.
        const response = await fetch(url);
        if (!response.ok) return null;
        const buf = await response.arrayBuffer();
        const mimeType = response.headers.get('content-type') || undefined;

        return {bytes: new Uint8Array(buf), mimeType}
    }
}

async function buildAssetFiles(
    ctx: BuildContext,
    resolveAsset: (url: string) => Promise<ResolvedAsset | null>,
    inlineAssets: boolean
): Promise<ExportFile[]> {
    const files: ExportFile[] = [];

    for (const token of ctx.assetsToFetch) {
        const url = ctx.assetTokenToUrl.get(token);
        if (!url) continue;

        const preferredName = ctx.assetTokenToPreferredName.get(token) || 'asset';
        const resolved = await resolveAsset(url);
        if (!resolved) continue;

        const desiredExt = guessExtFromMime(resolved.mimeType) || '';
        const safeName = makeUniqueAssetName(preferredName, desiredExt, ctx);
        const outputPath = `${ctx.assetsDir}/${safeName}`;
        ctx.assetTokenToOutputPath.set(token, outputPath);

        if (inlineAssets) {
            const mimeType = resolved.mimeType || 'application/octet-stream';
            const b64 = bytesToBase64(resolved.bytes);
            ctx.assetTokenToRef.set(token, `data:${mimeType};base64,${b64}`)
        } else {
            const ref = `./${outputPath}`;
            ctx.assetTokenToRef.set(token, ref);
            files.push({path: outputPath, content: resolved.bytes})
        }
    }

    return files
}

function parseDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string } | null {
    const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if (!match) return null;

    const mimeType = match[1] || 'application/octet-stream';
    const isBase64 = Boolean(match[2]);
    const data = match[3] || '';

    if (isBase64) {
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
        }
        return {bytes, mimeType}
    }

    // Percent-encoded
    const text = decodeURIComponent(data);
    const bytes = new TextEncoder().encode(text);
    return {bytes, mimeType}
}

function guessExtFromMime(mimeType?: string): string | null {
    if (!mimeType) return null;
    const mime = mimeType.split(';')[0].trim().toLowerCase();

    switch (mime) {
        case 'image/png':
            return '.png';
        case 'image/jpeg':
            return '.jpg';
        case 'image/gif':
            return '.gif';
        case 'image/webp':
            return '.webp';
        case 'image/svg+xml':
            return '.svg';
        case 'image/bmp':
            return '.bmp';
        case 'image/x-icon':
            return '.ico';
        case 'image/tiff':
            return '.tiff';
        case 'font/woff':
            return '.woff';
        case 'font/woff2':
            return '.woff2';
        case 'font/ttf':
            return '.ttf';
        case 'font/otf':
            return '.otf';
        case 'text/css':
            return '.css';
        case 'application/javascript':
            return '.js';
        case 'text/html':
            return '.html';
        case 'application/json':
            return '.json';
        default:
            return null
    }
}
