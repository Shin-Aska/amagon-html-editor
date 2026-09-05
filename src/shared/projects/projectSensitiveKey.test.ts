import { describe, expect, it } from "vitest";
import { createBlock, createDefaultTheme, type ProjectData } from "../../renderer/store/types";
import { scanProjectPortability } from "./projectPortability";

const projectWithNestedKey = (key: string): ProjectData => ({
  customCss: "",
  projectSettings: {
    name: "Sensitive-key fixture",
    framework: "vanilla",
    theme: createDefaultTheme(),
    globalStyles: {},
  },
  pages: [{
    id: "page",
    title: "Page",
    slug: "page",
    meta: {},
    blocks: [createBlock("html", { props: { nested: [{ [key]: "value" }] } })],
  }],
  userBlocks: [],
});

const scanKey = (key: string) => scanProjectPortability(projectWithNestedKey(key), {
  mode: "bundle-stored",
  sessionId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  availableAssetPaths: [],
});

describe("project sensitive-key classification", () => {
  it.each([
    "accessToken",
    "ACCESS_TOKEN",
    "access-token",
    "refreshToken",
    "auth.token",
    "bearer token",
    "apiToken",
    "clientSecret",
    "client_secret",
    "client:secret",
    "secretAccessKey",
    "privateKey",
    "apiKey",
    "api/key",
    "credential",
    "Credentials",
    "pass_word",
    "passwords",
    "TOKEN",
    "secret",
    "encrypted_credentials",
  ])("rejects normalized sensitive key %s at a nested persistence location", (key) => {
    // Given: an otherwise valid project with a sensitive field nested inside an array and object.
    const keyLocation = /^[A-Za-z_$][\w$]*$/u.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
    const expectedLocation = `$.pages[0].blocks[0].props.nested[0]${keyLocation}`;

    // When: the shared persistence preflight scans the project.
    const scan = scanKey(key);

    // Then: the field is classified as a credential at its exact location.
    expect(scan.offenders).toContainEqual({ code: "credential", location: expectedLocation });
  });

  it.each([
    "tokenCount",
    "secretName",
    "publicKey",
    "credentialId",
    "keyCount",
    "apiKeyLabel",
  ])("preserves benign metadata key %s", (key) => {
    // Given: an otherwise valid project with benign metadata nested at the same boundary.

    // When: the shared persistence preflight scans the project.
    const scan = scanKey(key);

    // Then: no credential offender is reported for the benign field.
    expect(scan.offenders.filter((offender) => offender.code === "credential")).toEqual([]);
  });
});
