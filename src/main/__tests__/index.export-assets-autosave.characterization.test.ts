import { describe, expect, it } from "vitest";
import { handlerFor, loadCharacterizedEntrypoint, untrustedEvent } from "./indexCharacterizationHarness";

describe("export, asset, and autosave characterization", () => {
  it("preserves export cancellation failure shape", async () => {
    await loadCharacterizedEntrypoint();
    await expect(handlerFor("project:exportHtml")({}, { html: "<p>x</p>" })).resolves.toEqual({ success: false, canceled: true });
  });

  it("rejects untrusted asset reads before fallback conversion", async () => {
    await loadCharacterizedEntrypoint();
    await expect(handlerFor("assets:readAsset")(untrustedEvent(), "assets/x.png")).rejects.toMatchObject({ name: "ProjectIpcSecurityError" });
  });

  it("preserves autosave success shapes", async () => {
    await loadCharacterizedEntrypoint();
    expect(handlerFor("autosave:start")({}, 50)).toEqual({ success: true });
    expect(handlerFor("autosave:stop")()).toEqual({ success: true });
  });
});
