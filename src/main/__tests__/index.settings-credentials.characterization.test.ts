import { describe, expect, it } from "vitest";
import { handlerFor, loadCharacterizedEntrypoint, trustedEvent } from "./indexCharacterizationHarness";

await loadCharacterizedEntrypoint();

describe("settings and credential characterization", () => {
  it("preserves version and malformed settings fallback", async () => {
    expect(handlerFor("app:getVersion")(trustedEvent())).toEqual({ success: true, version: "1.9.0-test" });
    await expect(handlerFor("app:getSettings")(trustedEvent())).resolves.toEqual({ success: true, settings: null });
  });

  it("preserves missing credential values fallback shape", async () => {
    const result = await handlerFor("app:getCredentialValues")(trustedEvent(), "missing");
    expect(result).toEqual({ success: true, values: {} });
  });
});
