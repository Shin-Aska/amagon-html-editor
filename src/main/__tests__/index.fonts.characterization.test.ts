import { describe, expect, it } from "vitest";
import { handlerFor, loadCharacterizedEntrypoint, untrustedEvent } from "./indexCharacterizationHarness";

const state = await loadCharacterizedEntrypoint();

describe("font IPC characterization", () => {
  it("rejects untrusted font queries before fallback conversion", async () => {
    await expect(handlerFor("fonts:listSystem")(untrustedEvent())).rejects.toMatchObject({ name: "ProjectIpcSecurityError" });
  });

  it("preserves required-field failure shape", async () => {
    const window = state.windows[0];
    if (window === undefined) throw new Error("expected main window");
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    await expect(handlerFor("fonts:fetchGoogleFontCss")(event, { family: "", weight: "400", style: "normal" })).resolves.toEqual({ success: false, error: "family required", css: "" });
  });
});
