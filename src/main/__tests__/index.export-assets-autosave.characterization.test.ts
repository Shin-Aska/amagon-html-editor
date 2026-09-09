import { describe, expect, it } from "vitest";
import { handlerFor, loadCharacterizedEntrypoint, trustedEvent, untrustedEvent } from "./indexCharacterizationHarness";

await loadCharacterizedEntrypoint();

describe("export, asset, and autosave characterization", () => {
  it("preserves export cancellation failure shape", async () => {
    await expect(handlerFor("project:exportHtml")(trustedEvent(), { html: "<p>x</p>" })).resolves.toEqual({ success: false, canceled: true });
  });

  it("rejects untrusted asset reads before fallback conversion", async () => {
    await expect(handlerFor("assets:readAsset")(untrustedEvent(), "assets/x.png")).rejects.toMatchObject({ name: "ProjectIpcSecurityError" });
  });

  it("preserves autosave success shapes", async () => {
    expect(handlerFor("autosave:start")(trustedEvent(), 50)).toEqual({ success: true });
    expect(handlerFor("autosave:stop")(trustedEvent())).toEqual({ success: true });
  });
});
