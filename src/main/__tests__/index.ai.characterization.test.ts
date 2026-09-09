import { describe, expect, it } from "vitest";
import { handlerFor, loadCharacterizedEntrypoint, trustedEvent } from "./indexCharacterizationHarness";

const state = await loadCharacterizedEntrypoint();

describe("AI IPC characterization", () => {
  it("preserves chat failure shape for invalid input", async () => {
    const result = await handlerFor("ai:chat")(trustedEvent(), { messages: undefined });
    expect(result).toEqual(expect.objectContaining({ success: false }));
  });

  it("registers static-model fallback after config handlers", async () => {
    const channels = [...state.handlers.keys()];
    expect(channels.indexOf("ai:setConfig")).toBeLessThan(channels.indexOf("ai:getModels"));
    expect(channels.indexOf("ai:getModels")).toBeLessThan(channels.indexOf("ai:fetchModelsForProvider"));
  });
});
