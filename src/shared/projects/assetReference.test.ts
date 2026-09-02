import { describe, expect, it } from "vitest";
import {
  AssetReferenceError,
  buildRuntimeAssetUrl,
  decodeDurableAssetReference,
  encodeDurableAssetReference,
  parseRuntimeAssetUrl,
} from "./assetReference";

describe("current project-asset URL characterization", () => {
  it("decodes the URL pathname once after parsing the project-asset host", () => {
    // Given: the project-asset URL shape currently emitted by the main process.
    const url = new URL(
      "app-media://project-asset/assets/images/My%20Photo.png",
    );

    // When: the existing protocol-handler parsing sequence is applied.
    const relativePath = decodeURIComponent(url.pathname).replace(/^\//, "");

    // Then: the host selects the project root and the path is decoded once.
    expect({ host: url.hostname, relativePath }).toEqual({
      host: "project-asset",
      relativePath: "assets/images/My Photo.png",
    });
  });
});

describe("asset reference codec", () => {
  it("round-trips a session-neutral encoded nested asset", () => {
    // Given: a canonical decoded archive asset path.
    const assetPath = "assets/images/Horse Show/éclair.png";

    // When: it is persisted, materialized for one session, and parsed again.
    const durable = encodeDurableAssetReference(assetPath);
    const runtime = buildRuntimeAssetUrl("session_A1-b", durable);
    const parsed = parseRuntimeAssetUrl(runtime);

    // Then: only the runtime form contains the opaque session identity.
    expect(durable).toBe("assets/images/Horse%20Show/%C3%A9clair.png");
    expect(durable).not.toContain("session_A1-b");
    expect(parsed).toEqual({
      sessionId: "session_A1-b",
      durableReference: durable,
      assetPath,
    });
    expect(decodeDurableAssetReference(durable)).toBe(assetPath);
  });

  it.each([
    "assets/%2e%2e/secret.txt",
    "assets/images%2Fsecret.png",
    "assets/images%5Csecret.png",
    "assets/%00.png",
    "assets/%E0%A4%A.png",
    "assets/Horse Show/photo.png",
    "assets/%c3%a9clair.png",
  ])("rejects unsafe encoded reference %s", (reference) => {
    // Given: one encoded path that could become ambiguous after decoding.
    // When: the durable boundary decodes it exactly once.
    const decode = () => decodeDurableAssetReference(reference);
    // Then: it fails closed with the codec's typed error.
    expect(decode).toThrow(AssetReferenceError);
  });

  it.each([
    "app-media://absolute/session/assets/x.png",
    "app-media://project-asset/session/assets/x.png?download=1",
    "app-media://project-asset/session/assets/x.png#fragment",
    "app-media://project-asset/session/%2e%2e/x.png",
  ])("rejects a non-exact runtime URL %s", (runtimeUrl) => {
    // Given: a URL outside the one supported runtime form.
    // When: the runtime boundary parses it.
    const parse = () => parseRuntimeAssetUrl(runtimeUrl);
    // Then: it cannot be mistaken for a current-session asset.
    expect(parse).toThrow(AssetReferenceError);
  });
});
