// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("electron", () => ({ net: { fetch: provider.fetch } }));

import { searchPixabay } from "./mediaProviderSearch";

beforeEach(() => provider.fetch.mockReset());

describe("Pixabay provider results", () => {
  it("keeps image search URLs and metadata", async () => {
    provider.fetch.mockResolvedValue(Response.json({ hits: [{
      id: 195893, largeImageURL: "https://pixabay.com/get/image.jpg",
      webformatURL: "https://pixabay.com/get/image_640.jpg",
      previewURL: "https://cdn.pixabay.com/photo/image_150.jpg", tags: "flowers",
    }] }));
    const results = await searchPixabay({ query: "flowers", type: "image" }, "test-key");
    expect(results[0]).toMatchObject({ id: "195893", url: "https://pixabay.com/get/image.jpg", alt: "flowers" });
  });

  it("falls back from an unavailable large video and uses image posters", async () => {
    provider.fetch.mockResolvedValue(Response.json({ hits: [{
      id: 125, tags: "flowers", videos: {
        large: { url: "", size: 0 },
        medium: { url: "https://cdn.pixabay.com/video/medium.mp4", thumbnail: "https://cdn.pixabay.com/video/medium.jpg" },
        small: { url: "https://cdn.pixabay.com/video/small.mp4", thumbnail: "https://cdn.pixabay.com/video/small.jpg" },
        tiny: { url: "https://cdn.pixabay.com/video/tiny.mp4", thumbnail: "https://cdn.pixabay.com/video/tiny.jpg" },
      },
    }] }));
    const results = await searchPixabay({ query: "flowers", type: "video" }, "test-key");
    expect(results[0]).toMatchObject({
      url: "https://cdn.pixabay.com/video/medium.mp4",
      thumbUrl: "https://cdn.pixabay.com/video/tiny.jpg",
      previewUrl: "https://cdn.pixabay.com/video/medium.jpg",
    });
  });
});
