import { describe, expect, it } from "vitest";
import { handlerFor, loadCharacterizedEntrypoint } from "./indexCharacterizationHarness";

describe("AI IPC characterization", () => {
  it("preserves chat failure shape for invalid input", async () => {
    await loadCharacterizedEntrypoint();
    const result = await handlerFor("ai:chat")({}, { messages: undefined });
    expect(result).toEqual(expect.objectContaining({ success: false }));
  });

  it("registers static-model fallback after config handlers", async () => {
    const state = await loadCharacterizedEntrypoint();
    const channels = [...state.handlers.keys()];
    expect(channels.indexOf("ai:setConfig")).toBeLessThan(channels.indexOf("ai:getModels"));
    expect(channels.indexOf("ai:getModels")).toBeLessThan(channels.indexOf("ai:fetchModelsForProvider"));
  });
});
