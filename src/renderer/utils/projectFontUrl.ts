import { AssetReferenceError, buildRuntimeAssetUrl, canonicalizePortablePath, encodeDurableAssetReference, parseRuntimeAssetUrl } from "../../shared/projects/assetReference";

export function projectFontUrl(relativePath: string, sessionId: string | undefined): string {
  return sessionId && relativePath.startsWith("assets/")
    ? buildRuntimeAssetUrl(sessionId, encodeDurableAssetReference(relativePath))
    : relativePath;
}

/** Convert a current-session font reference to the raw path expected by font IPC. */
export function projectFontAssetPath(reference: string, sessionId: string | undefined): string | undefined {
  try {
    const path = reference.startsWith("assets/fonts/")
      ? canonicalizePortablePath(reference)
      : (() => {
          const parsed = parseRuntimeAssetUrl(reference);
          return parsed.sessionId === sessionId ? parsed.assetPath : undefined;
        })();
    return path?.startsWith("assets/fonts/") ? path : undefined;
  } catch (error) {
    if (error instanceof AssetReferenceError) return undefined;
    throw error;
  }
}
