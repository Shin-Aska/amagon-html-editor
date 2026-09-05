import type { Block, ProjectData, ProjectTheme } from "../../renderer/store/types";
import { AssetReferenceError, buildRuntimeAssetUrl, decodeDurableAssetReference, encodeDurableAssetReference, isRelativePathTraversalReference, parseRuntimeAssetUrl } from "./assetReference";
import type { LegacyProjectDocument, ProjectDocumentV1 } from "./projectDocumentSchema";
import { ProjectSessionIdSchema } from "./projectIpcContract";
import { isSensitiveProjectKey } from "./projectSensitiveKey";

export type ProjectPortabilityMode = "bundle-durable" | "bundle-runtime" | "bundle-stored" | "conversion-durable" | "legacy-durable" | "legacy-runtime" | "legacy-stored";

export type ProjectPortabilityOffenderCode = "blob" | "credential" | "external-local" | "invalid-reference" | "missing-asset" | "session-identity" | "stale-session" | "system-font" | "unexpected-reference-form";

export type ProjectPortabilityOffender = {
  readonly code: ProjectPortabilityOffenderCode;
  readonly location: string;
  readonly reference?: string;
};

export type ProjectPortabilityOptions = {
  readonly mode: ProjectPortabilityMode;
  readonly sessionId: string;
  readonly availableAssetPaths: readonly string[];
  readonly approvedExternalReferences?: readonly string[];
};

export type ProjectPortabilityScan = {
  readonly offenders: readonly ProjectPortabilityOffender[];
  readonly referencedAssetPaths: readonly string[];
};

export type ProjectPortabilityResult<Project extends PortabilityProject = PortabilityProject> =
  | ({
      readonly ok: true;
      readonly project: Project;
    } & ProjectPortabilityScan)
  | ({ readonly ok: false } & ProjectPortabilityScan);

type ScanState = {
  readonly options: ProjectPortabilityOptions;
  readonly available: ReadonlySet<string>;
  readonly approvedExternal: ReadonlySet<string>;
  readonly offenders: ProjectPortabilityOffender[];
  readonly referencedAssets: Set<string>;
};

export type PortabilityProject = ProjectData | ProjectDocumentV1 | LegacyProjectDocument;
type PortabilityBlock = Block | ProjectDocumentV1["pages"][number]["blocks"][number];
type PortabilityTheme = ProjectTheme | ProjectDocumentV1["projectSettings"]["theme"];

const CSS_URL = /(url\(\s*)(["']?)([^"')]*?)(\2\s*\))/giu;
const HTML_ATTRIBUTE = /(\b(?:src|href|poster)\s*=\s*)(["'])(.*?)\2/giu;
const HTML_SRCSET = /(\bsrcset\s*=\s*)(["'])(.*?)\2/giu;
const HTML_UNQUOTED = /(\b(src|href|poster|srcset)\s*=\s*)([^\s"'=<>`]+)/giu;
const DRIVE_PATH = /^[A-Za-z]:[\\/]/u,
  RUNTIME_PREFIX = "app-media://project-asset/";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const propertyLocation = (base: string, key: string): string => (/^[A-Za-z_$][\w$]*$/u.test(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`);

const addOffender = (state: ScanState, code: ProjectPortabilityOffenderCode, location: string, reference?: string): void => {
  state.offenders.push(reference === undefined ? { code, location } : { code, location, reference });
};

const isExternalLocalReference = (value: string): boolean => value.toLowerCase().startsWith("file:") || value.toLowerCase().startsWith("app-media://absolute") || value.startsWith("\\\\") || value.startsWith("/") || DRIVE_PATH.test(value);

const recordAsset = (assetPath: string, location: string, state: ScanState): void => {
  state.referencedAssets.add(assetPath);
  if (!state.available.has(assetPath)) addOffender(state, "missing-asset", location, assetPath);
};

const transformReference = (value: string, location: string, state: ScanState): string => {
  if (isRelativePathTraversalReference(value)) { addOffender(state, "invalid-reference", location, value); return value; }
  if (/^https?:\/\//iu.test(value)) {
    if (/^https?:\/\/[^/@\s]+@/iu.test(value)) addOffender(state, "credential", location);
    return value;
  }
  if (value.toLowerCase().startsWith("data:")) return value;
  if (value.toLowerCase().startsWith("blob:")) {
    addOffender(state, "blob", location, value);
    return value;
  }
  if (isExternalLocalReference(value)) {
    const legacyMode = state.options.mode === "legacy-durable"
      || state.options.mode === "legacy-runtime"
      || state.options.mode === "legacy-stored";
    if (!legacyMode || !state.approvedExternal.has(value)) addOffender(state, "external-local", location, value);
    return value;
  }

  if (value.toLowerCase().startsWith(RUNTIME_PREFIX)) {
    if (!value.startsWith(RUNTIME_PREFIX)) {
      addOffender(state, "invalid-reference", location, value);
      return value;
    }
    if (state.options.mode.endsWith("-stored")) {
      addOffender(state, "unexpected-reference-form", location, value);
      return value;
    }
    const legacyReference = value.slice(RUNTIME_PREFIX.length);
    if (legacyReference.startsWith("assets/")) {
      if (state.options.mode === "bundle-durable") {
        addOffender(state, "unexpected-reference-form", location, value);
        return value;
      }
      return transformDurableReference(legacyReference, location, state);
    }
    try {
      const parsed = parseRuntimeAssetUrl(value);
      if (state.options.mode === "bundle-runtime" || state.options.mode === "legacy-runtime") {
        addOffender(state, "unexpected-reference-form", location, value);
        return value;
      }
      if (parsed.sessionId !== state.options.sessionId) {
        addOffender(state, "stale-session", location, value);
        return value;
      }
      recordAsset(parsed.assetPath, location, state);
      return parsed.durableReference;
    } catch (error) {
      if (error instanceof AssetReferenceError) {
        addOffender(state, "invalid-reference", location, value);
        return value;
      }
      throw error;
    }
  }

  if (value.toLowerCase().startsWith("app-media:")) {
    addOffender(state, "invalid-reference", location, value);
    return value;
  }

  if (value.startsWith("assets/")) {
    if (state.options.mode === "bundle-durable") {
      addOffender(state, "unexpected-reference-form", location, value);
      return value;
    }
    return transformDurableReference(value, location, state);
  }
  return value;
};

const transformDurableReference = (value: string, location: string, state: ScanState): string => {
  try {
    const assetPath = decodeDurableAssetReference(value);
    const canonical = encodeDurableAssetReference(assetPath);
    if (state.options.mode.endsWith("-stored") && canonical !== value) {
      addOffender(state, "invalid-reference", location, value);
    }
    recordAsset(assetPath, location, state);
    if (state.options.mode === "bundle-runtime" || state.options.mode === "legacy-runtime") {
      return buildRuntimeAssetUrl(state.options.sessionId, canonical);
    }
    return canonical;
  } catch (error) {
    if (error instanceof AssetReferenceError) {
      addOffender(state, "invalid-reference", location, value);
      return value;
    }
    throw error;
  }
};

const transformCss = (css: string, location: string, state: ScanState): string => css.replace(CSS_URL, (whole, prefix: string, quote: string, reference: string, suffix: string) => `${prefix}${quote}${transformReference(reference.trim(), location, state)}${suffix}`);

const transformSrcset = (value: string, location: string, state: ScanState): string =>
  value
    .split(",")
    .map((candidate) => {
      const match = /^(\s*)(\S+)(.*)$/u.exec(candidate);
      return match ? `${match[1]}${transformReference(match[2] ?? "", location, state)}${match[3]}` : candidate;
    })
    .join(",");

const transformHtml = (html: string, location: string, state: ScanState): string =>
  html
    .replace(HTML_SRCSET, (whole, prefix: string, quote: string, value: string) => `${prefix}${quote}${transformSrcset(value, location, state)}${quote}`)
    .replace(HTML_ATTRIBUTE, (whole, prefix: string, quote: string, value: string) => `${prefix}${quote}${transformReference(value, location, state)}${quote}`)
    .replace(HTML_UNQUOTED, (whole, prefix: string, name: string, value: string) => `${prefix}${name.toLowerCase() === "srcset" ? transformSrcset(value, location, state) : transformReference(value, location, state)}`);

const transformPropValue = (value: unknown, location: string, state: ScanState): unknown => {
  if (typeof value === "string") return transformHtml(transformCss(transformReference(value, location, state), location, state), location, state);
  if (Array.isArray(value)) return value.map((item, index) => transformPropValue(item, `${location}[${index}]`, state));
  if (!isRecord(value)) return value;
  for (const key of Object.keys(value).sort()) {
    value[key] = transformPropValue(value[key], propertyLocation(location, key), state);
  }
  return value;
};

const transformBlock = (block: PortabilityBlock, location: string, state: ScanState): void => {
  transformPropValue(block.props, `${location}.props`, state);
  for (const key of Object.keys(block.styles).sort()) {
    Reflect.set(block.styles, key, transformCss(block.styles[key] ?? "", propertyLocation(`${location}.styles`, key), state));
  }
  if (typeof block.content === "string") Reflect.set(block, "content", transformHtml(transformCss(block.content, `${location}.content`, state), `${location}.content`, state));
  block.children.forEach((child, index) => transformBlock(child, `${location}.children[${index}]`, state));
};

const transformTheme = (theme: PortabilityTheme, location: string, state: ScanState): void => {
  Reflect.set(theme, "customCss", transformCss(theme.customCss, `${location}.customCss`, state));
  theme.customCssFiles?.forEach((file, index) => {
    Reflect.set(file, "css", transformCss(file.css, `${location}.customCssFiles[${index}].css`, state));
  });
};

const scanForbiddenPersistence = (value: unknown, location: string, state: ScanState): void => {
  const persistenceMode = state.options.mode.endsWith("-durable") || state.options.mode.endsWith("-stored");
  if (typeof value === "string") {
    if (
      persistenceMode
      && (value.includes(state.options.sessionId) || ProjectSessionIdSchema.safeParse(value).success)
    ) addOffender(state, "session-identity", location);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenPersistence(item, `${location}[${index}]`, state));
    return;
  }
  if (!isRecord(value)) return;
  for (const key of Object.keys(value).sort()) {
    const childLocation = propertyLocation(location, key);
    if (isSensitiveProjectKey(key)) addOffender(state, "credential", childLocation);
    if (
      persistenceMode
      && (key.includes(state.options.sessionId) || ProjectSessionIdSchema.safeParse(key).success)
    ) addOffender(state, "session-identity", childLocation);
    scanForbiddenPersistence(value[key], childLocation, state);
  }
};

const scanClone = (clone: PortabilityProject, options: ProjectPortabilityOptions): ProjectPortabilityScan => {
  const state: ScanState = {
    options,
    available: new Set(options.availableAssetPaths),
    approvedExternal: new Set(options.approvedExternalReferences ?? []),
    offenders: [],
    referencedAssets: new Set(),
  };
  Reflect.set(clone, "customCss", transformCss(clone.customCss, "$.customCss", state));
  transformTheme(clone.projectSettings.theme, "$.projectSettings.theme", state);
  if (clone.projectSettings.themes) {
    transformTheme(clone.projectSettings.themes.light, "$.projectSettings.themes.light", state);
    transformTheme(clone.projectSettings.themes.dark, "$.projectSettings.themes.dark", state);
  }
  clone.customPresets?.forEach((theme, index) => transformTheme(theme, `$.customPresets[${index}]`, state));
  for (const key of Object.keys(clone.projectSettings.globalStyles).sort()) {
    Reflect.set(clone.projectSettings.globalStyles, key, transformCss(clone.projectSettings.globalStyles[key] ?? "", propertyLocation("$.projectSettings.globalStyles", key), state));
  }
    clone.projectSettings.fonts?.forEach((font, index) => {
      const location = `$.projectSettings.fonts[${index}].relativePath`;
      if (font.source === "system" && font.relativePath && !options.mode.startsWith("legacy-")) {
        addOffender(state, "system-font", location);
      }
      if (font.relativePath) {
        Reflect.set(font, "relativePath", options.mode === "bundle-durable" && font.relativePath.startsWith("assets/") ? transformDurableReference(font.relativePath, location, state) : transformReference(font.relativePath, location, state));
      }
    });
  clone.pages.forEach((page, pageIndex) => page.blocks.forEach((block, blockIndex) => transformBlock(block, `$.pages[${pageIndex}].blocks[${blockIndex}]`, state)));
  clone.userBlocks.forEach((userBlock, index) => transformBlock(userBlock.content, `$.userBlocks[${index}].content`, state));
  scanForbiddenPersistence(clone, "$", state);

  const offenders = state.offenders.sort((left, right) => (left.location === right.location ? (left.code < right.code ? -1 : left.code > right.code ? 1 : 0) : left.location < right.location ? -1 : 1));
  const referencedAssetPaths = [...state.referencedAssets].sort();
  return { offenders, referencedAssetPaths };
};

const runPortability = <Project extends PortabilityProject>(
  project: Project,
  options: ProjectPortabilityOptions,
): ProjectPortabilityResult<Project> => {
  const clone = structuredClone(project);
  const scan = scanClone(clone, options);
  return scan.offenders.length === 0 ? { ok: true, project: clone, ...scan } : { ok: false, ...scan };
};

export const transformProjectPortability = runPortability;

export const scanProjectPortability = (project: PortabilityProject, options: ProjectPortabilityOptions): ProjectPortabilityScan => scanClone(structuredClone(project), options);
