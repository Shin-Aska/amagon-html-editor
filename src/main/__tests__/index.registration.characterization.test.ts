import { describe, expect, it } from "vitest";
import { loadCharacterizedEntrypoint } from "./indexCharacterizationHarness";

const state = await loadCharacterizedEntrypoint();

const LEGACY_CHANNELS = [
  "menu:setProjectLoaded",
  "fonts:listSystem",
  "fonts:fetchGoogleFontCss",
  "fonts:fetchGoogleFontFile",
  "fonts:checkFileExists",
  "fonts:listProject",
  "project:exportHtml",
  "project:exportSite",
  "project:openInBrowser",
  "assets:list",
  "assets:readFileAsBase64",
  "assets:readAsset",
  "autosave:start",
  "autosave:stop",
  "app:getVersion",
  "app:getSettings",
  "app:saveSettings",
  "app:isEncryptionSecure",
  "app:getCredentials",
  "app:getCredentialDefinitions",
  "app:getCredentialValues",
  "app:saveCredential",
  "app:deleteCredential",
  "publish:getProviders",
  "publish:getCredentials",
  "publish:saveCredentials",
  "publish:deleteCredentials",
  "publish:validate",
  "publish:publish",
  "ai:chat",
  "ai:checkCliAvailability",
  "ai:getConfig",
  "ai:setConfig",
  "ai:getModels",
  "ai:fetchModelsForProvider",
] as const;

describe("main entrypoint registration characterization", () => {
  it("captures import, ready, protocol, IPC, window, and lifecycle order", async () => {
    expect(state.sequence[0]).toBe("protocol:privileged");
    expect(state.sequence.indexOf("cleanup:stale")).toBeLessThan(state.sequence.indexOf("protocol:app-framework"));
    expect(state.protocols).toEqual(["app-framework", "app-media"]);
    const channels = [...state.handlers.keys()];
    expect(channels.slice(0, LEGACY_CHANNELS.length)).toEqual(LEGACY_CHANNELS);
    expect(channels[channels.length - 1]).toBe("project:finish-lifecycle-close");
    expect(state.sequence.indexOf("protocol:app-media")).toBeLessThan(state.sequence.indexOf(`ipc:${LEGACY_CHANNELS[0]}`));
    expect(state.sequence.indexOf(`ipc:${LEGACY_CHANNELS[0]}`)).toBeLessThan(state.sequence.indexOf("window:create"));
    expect([...state.appListeners.keys()]).toEqual(["second-instance", "before-quit", "window-all-closed", "activate"]);
  });
});
