import { buildRuntimeAssetUrl, encodeDurableAssetReference } from "../../shared/projects/assetReference";

export function projectFontUrl(relativePath: string, sessionId: string | undefined): string {
  return sessionId && relativePath.startsWith("assets/")
    ? buildRuntimeAssetUrl(sessionId, encodeDurableAssetReference(relativePath))
    : relativePath;
}
