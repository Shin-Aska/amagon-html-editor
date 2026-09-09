// @vitest-environment node

import { describe, expect, it } from "vitest";
import { assertTrustedMainFrame } from "./projectIpcSecurity";

const trustedSurface = () => {
  const mainFrame = {};
  const sender = { id: 7, mainFrame };
  return {
    window: { webContents: sender },
    event: { sender, senderFrame: mainFrame },
  };
};

describe("project resource IPC sender validation", () => {
  it("accepts only the active window's main frame", () => {
    // Given: the active BrowserWindow sender and its main frame.
    const trusted = trustedSurface();

    // When: the IPC boundary validates the event.
    const senderId = assertTrustedMainFrame(trusted.event, trusted.window);

    // Then: the trusted sender identity is returned for capability binding.
    expect(senderId).toBe(7);
  });

  it("rejects a different WebContents sender", () => {
    // Given: an event from a WebContents that does not own the active window.
    const trusted = trustedSurface();
    const forged = { sender: { id: 8, mainFrame: {} }, senderFrame: {} };

    // When/Then: the IPC boundary denies the sender.
    expect(() => assertTrustedMainFrame(forged, trusted.window)).toThrow("trusted application window");
  });

  it("rejects a child frame from the trusted WebContents", () => {
    // Given: the correct WebContents with a non-main sender frame.
    const trusted = trustedSurface();
    const childFrame = { sender: trusted.event.sender, senderFrame: {} };

    // When/Then: the IPC boundary denies the frame.
    expect(() => assertTrustedMainFrame(childFrame, trusted.window)).toThrow("main frame");
  });
});
