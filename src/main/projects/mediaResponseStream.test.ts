// @vitest-environment node

import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";

vi.mock("node:https", () => ({ request: (_url: URL, _options: unknown, callback: (response: PassThrough) => void) => {
  const request = new EventEmitter();
  Reflect.set(request, "end", () => {
    const response = Object.assign(new PassThrough(), {
      statusCode: 200, statusMessage: "OK", headers: { "content-type": "video/mp4" },
    });
    callback(response);
    response.end(Buffer.from("complete video bytes"));
  });
  return request;
} }));

import { fetchPinnedHttps } from "./safeMediaNetwork";

it("finishes reading a media response that ends after its last chunk", async () => {
  const response = await fetchPinnedHttps("https://media.example/video.mp4", [{ address: "93.184.216.34", family: 4 }]);
  expect(await response.text()).toBe("complete video bytes");
}, 1000);
