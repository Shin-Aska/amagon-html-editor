import assert from "node:assert/strict";
import test from "node:test";
import {
  canTerminateCapturedProcess,
  isExactProfileOwner,
  isTrustedMainProcess,
  normalizeUserDataDir,
  selectLiveCapturedProcesses,
  type ProcessIdentity,
} from "./processOwnership";

const profilePath = "C:\\Users\\Orill\\AppData\\Local\\Temp\\amagon-e2e-reuse\\profile";

const capturedElectron: ProcessIdentity = {
  commandLine: `electron.exe --user-data-dir=${profilePath}`,
  creationTime: "134018632000000000",
  executablePath: "C:\\Development\\hoarses-html-editor\\node_modules\\electron\\dist\\electron.exe",
  name: "electron.exe",
  pid: 19724,
};

const reusedDiscordProcess: ProcessIdentity = {
  commandLine: "DiscordSystemHelper.exe --type=utility",
  creationTime: "134018633000000000",
  executablePath: "C:\\Users\\Orill\\AppData\\Local\\Discord\\app.exe",
  name: "DiscordSystemHelper.exe",
  pid: 19724,
};

test("reused PID is treated as exited and is never eligible for Electron termination", () => {
  assert.deepEqual(selectLiveCapturedProcesses([capturedElectron], [reusedDiscordProcess]), []);
  assert.equal(canTerminateCapturedProcess(capturedElectron, reusedDiscordProcess, profilePath), false);
});

test("executable mismatch is treated as a different process despite matching PID metadata", () => {
  const wrongExecutable: ProcessIdentity = {
    ...capturedElectron,
    executablePath: "C:\\Users\\Orill\\AppData\\Local\\Discord\\DiscordSystemHelper.exe",
  };
  assert.deepEqual(selectLiveCapturedProcesses([capturedElectron], [wrongExecutable]), []);
  assert.equal(canTerminateCapturedProcess(capturedElectron, wrongExecutable, profilePath), false);
});

test("user-data-dir ownership requires an exactly normalized profile path", () => {
  const prefixedProfile = `${profilePath}-other`;
  const profileSuperset: ProcessIdentity = {
    ...capturedElectron,
    commandLine: `electron.exe --user-data-dir="${prefixedProfile}"`,
  };
  assert.equal(isExactProfileOwner(profileSuperset, profilePath), false);
  assert.equal(normalizeUserDataDir("C:/Users/Orill/AppData/Local/Temp/amagon-e2e-reuse/profile/"), normalizeUserDataDir(profilePath));
});

test("whole-argument quotes identify the trusted main and reject the Playwright cmd wrapper", () => {
  const token = "e2e-token";
  const trustedMain: ProcessIdentity = {
    ...capturedElectron,
    commandLine: `electron.exe "--user-data-dir=${profilePath}" "--amagon-e2e-token=${token}"`,
  };
  const wrapper: ProcessIdentity = {
    ...trustedMain,
    executablePath: "C:\\Windows\\System32\\cmd.exe",
    name: "cmd.exe",
  };
  assert.equal(isExactProfileOwner(trustedMain, profilePath), true);
  assert.equal(isTrustedMainProcess(wrapper, profilePath, token), false);
  assert.equal(isTrustedMainProcess(trustedMain, profilePath, token), true);
  assert.equal(isTrustedMainProcess(trustedMain, profilePath, "different-token"), false);
});
