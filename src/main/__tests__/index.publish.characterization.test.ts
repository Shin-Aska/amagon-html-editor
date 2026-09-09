import { describe, expect, it } from "vitest";
import { handlerFor, loadCharacterizedEntrypoint, trustedEvent } from "./indexCharacterizationHarness";

await loadCharacterizedEntrypoint();

describe("publish IPC characterization", () => {
  it("preserves unknown-provider validation failure shape", async () => {
    await expect(handlerFor("publish:validate")(trustedEvent(), { providerId: "missing", files: [] })).resolves.toEqual({
      ok: false,
      issues: [{ severity: "error", message: "Unknown publish provider: missing" }],
    });
  });

  it("preserves unknown-provider publish fallback", async () => {
    await expect(handlerFor("publish:publish")(trustedEvent(), { providerId: "missing", files: [] })).resolves.toEqual({
      success: false,
      error: "Unknown publish provider: missing",
      warnings: [],
    });
  });
});
