// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parseProjectSessionId } from "../../shared/projects/projectIpcContract";
import { createMediaDownloadCapabilityRegistry } from "./mediaDownloadCapability";

const sessionA = parseProjectSessionId("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
const sessionB = parseProjectSessionId("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");

describe("media download capabilities", () => {
  it("issues an opaque result and consumes it exactly once", () => {
    // Given: one provider-owned HTTPS result bound to a session and sender.
    const registry = createMediaDownloadCapabilityRegistry();
    const issued = registry.issue(sessionA, 7, {
      id: "provider-result",
      url: "https://cdn.provider.example/image.png",
      thumbUrl: "https://cdn.provider.example/thumb.png",
      previewUrl: "https://cdn.provider.example/preview.png",
      alt: "fixture",
    });

    // When: the opaque identifier is consumed by the same session and sender.
    const url = registry.consume(issued.downloadId, sessionA, 7);

    // Then: only the registry reveals the provider URL, and reuse is denied.
    expect(url).toBe("https://cdn.provider.example/image.png");
    expect(issued).not.toHaveProperty("url");
    expect(() => registry.consume(issued.downloadId, sessionA, 7)).toThrow("invalid or expired");
  });

  it("rejects forged, wrong-session, and sender-mismatched identifiers", () => {
    // Given: separately issued capabilities for each adversarial attempt.
    const registry = createMediaDownloadCapabilityRegistry();
    const wrongSession = registry.issue(sessionA, 7, {
      id: "session-bound",
      url: "https://cdn.provider.example/session.png",
      thumbUrl: "https://cdn.provider.example/thumb.png",
      previewUrl: "https://cdn.provider.example/preview.png",
      alt: "fixture",
    });
    const wrongSender = registry.issue(sessionA, 7, {
      id: "sender-bound",
      url: "https://cdn.provider.example/sender.png",
      thumbUrl: "https://cdn.provider.example/thumb.png",
      previewUrl: "https://cdn.provider.example/preview.png",
      alt: "fixture",
    });

    // When/Then: forged authority and mismatched bindings never reveal a URL.
    expect(() => registry.consume("A".repeat(43), sessionA, 7)).toThrow("invalid or expired");
    expect(() => registry.consume(wrongSession.downloadId, sessionB, 7)).toThrow("another project session");
    expect(() => registry.consume(wrongSender.downloadId, sessionA, 8)).toThrow("another application sender");
    expect(() => registry.consume(wrongSession.downloadId, sessionA, 7)).toThrow("invalid or expired");
    expect(() => registry.consume(wrongSender.downloadId, sessionA, 7)).toThrow("invalid or expired");
  });
});
