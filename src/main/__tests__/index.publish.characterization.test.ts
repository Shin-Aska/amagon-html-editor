import { describe, expect, it } from "vitest";
import { handlerFor, loadCharacterizedEntrypoint } from "./indexCharacterizationHarness";

await loadCharacterizedEntrypoint();

describe("publish IPC characterization", () => {
  it("preserves unknown-provider validation failure shape", async () => {
    await expect(handlerFor("publish:validate")({}, { providerId: "missing", files: [] })).resolves.toEqual({
      ok: false,
      issues: [{ severity: "error", message: "Unknown publish provider: missing" }],
    });
  });

  it("preserves unknown-provider publish fallback", async () => {
    const event = { sender: { send: () => undefined } };
    await expect(handlerFor("publish:publish")(event, { providerId: "missing", files: [] })).resolves.toEqual({
      success: false,
      error: "Unknown publish provider: missing",
      warnings: [],
    });
  });
});
