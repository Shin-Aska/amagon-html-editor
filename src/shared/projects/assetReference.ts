const MAX_ARCHIVE_PATH_BYTES = 1_024;
const ILLEGAL_WINDOWS_CHARACTERS = /[<>:"|?*]/u;
const CONTROL_CHARACTERS = /\p{Cc}/u;
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
const OPAQUE_SESSION_ID = /^[A-Za-z0-9_-]{8,128}$/u;

export class AssetReferenceError extends Error {
  readonly name = "AssetReferenceError";

  constructor(
    readonly code:
      | "invalid-path"
      | "invalid-encoding"
      | "invalid-reference"
      | "invalid-session",
    message: string,
  ) {
    super(message);
  }
}

export function canonicalizePortablePath(input: string): string {
  if (input.length === 0 || input.startsWith("/") || input.startsWith("\\")) {
    throw new AssetReferenceError("invalid-path", "path must be relative");
  }
  if (input.includes("\\") || CONTROL_CHARACTERS.test(input)) {
    throw new AssetReferenceError(
      "invalid-path",
      "path contains a forbidden character",
    );
  }
  if (input !== input.normalize("NFC")) {
    throw new AssetReferenceError(
      "invalid-path",
      "path must use NFC normalization",
    );
  }
  if (new TextEncoder().encode(input).byteLength > MAX_ARCHIVE_PATH_BYTES) {
    throw new AssetReferenceError(
      "invalid-path",
      "path exceeds 1024 UTF-8 bytes",
    );
  }

  const segments = input.split("/");
  for (const segment of segments) {
    if (segment.length === 0 || segment === "." || segment === "..") {
      throw new AssetReferenceError(
        "invalid-path",
        "path contains an empty or dot segment",
      );
    }
    if (
      ILLEGAL_WINDOWS_CHARACTERS.test(segment) ||
      segment.endsWith(".") ||
      segment.endsWith(" ") ||
      WINDOWS_DEVICE_NAME.test(segment)
    ) {
      throw new AssetReferenceError(
        "invalid-path",
        "path segment is not portable",
      );
    }
  }
  return input;
}

export function encodeDurableAssetReference(assetPath: string): string {
  const canonical = canonicalizePortablePath(assetPath);
  if (!canonical.startsWith("assets/")) {
    throw new AssetReferenceError(
      "invalid-reference",
      "asset reference must be beneath assets",
    );
  }
  return canonical.split("/").map(encodeURIComponent).join("/");
}

export function decodeDurableAssetReference(reference: string): string {
  if (!reference.startsWith("assets/")) {
    throw new AssetReferenceError(
      "invalid-reference",
      "asset reference must be beneath assets",
    );
  }
  const rawSegments = reference.split("/");
  const decodedSegments = rawSegments.map((segment) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch (error) {
      if (error instanceof URIError) {
        throw new AssetReferenceError(
          "invalid-encoding",
          "asset reference has invalid percent encoding",
        );
      }
      throw error;
    }
    if (decoded.includes("/") || decoded.includes("\\")) {
      throw new AssetReferenceError(
        "invalid-encoding",
        "encoded path separators are forbidden",
      );
    }
    return decoded;
  });
  const decodedPath = canonicalizePortablePath(decodedSegments.join("/"));
  if (!decodedPath.startsWith("assets/")) {
    throw new AssetReferenceError(
      "invalid-reference",
      "asset reference must be beneath assets",
    );
  }
  const canonicalReference = decodedPath
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  if (canonicalReference !== reference) {
    throw new AssetReferenceError(
      "invalid-encoding",
      "asset reference is not canonically percent encoded",
    );
  }
  return decodedPath;
}

export function buildRuntimeAssetUrl(
  sessionId: string,
  durableReference: string,
): string {
  if (!OPAQUE_SESSION_ID.test(sessionId)) {
    throw new AssetReferenceError(
      "invalid-session",
      "session identity is not opaque URL-safe data",
    );
  }
  const canonicalReference = encodeDurableAssetReference(
    decodeDurableAssetReference(durableReference),
  );
  return `app-media://project-asset/${sessionId}/${canonicalReference}`;
}

export type ParsedRuntimeAssetUrl = {
  readonly sessionId: string;
  readonly durableReference: string;
  readonly assetPath: string;
};

export function parseRuntimeAssetUrl(
  runtimeUrl: string,
): ParsedRuntimeAssetUrl {
  const match = /^app-media:\/\/project-asset\/([^/?#]+)\/(.+)$/u.exec(
    runtimeUrl,
  );
  const sessionId = match?.[1];
  const durableReference = match?.[2];
  if (
    sessionId === undefined ||
    durableReference === undefined ||
    !OPAQUE_SESSION_ID.test(sessionId)
  ) {
    throw new AssetReferenceError(
      "invalid-reference",
      "runtime asset URL has an invalid form",
    );
  }
  const assetPath = decodeDurableAssetReference(durableReference);
  return {
    sessionId,
    durableReference: encodeDurableAssetReference(assetPath),
    assetPath,
  };
}
