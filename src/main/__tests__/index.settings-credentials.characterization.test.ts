import { describe, expect, it } from "vitest";
import { handlerFor, loadCharacterizedEntrypoint } from "./indexCharacterizationHarness";

describe("settings and credential characterization", () => {
  it("preserves version and malformed settings fallback", async () => {
    await loadCharacterizedEntrypoint();
    expect(handlerFor("app:getVersion")()).toEqual({ success: true, version: "1.9.0-test" });
    await expect(handlerFor("app:getSettings")()).resolves.toEqual({ success: true, settings: null });
  });

  it("preserves missing credential values fallback shape", async () => {
    await loadCharacterizedEntrypoint();
    const result = await handlerFor("app:getCredentialValues")({}, "missing");
    expect(result).toEqual({ success: true, values: {} });
  });
});
