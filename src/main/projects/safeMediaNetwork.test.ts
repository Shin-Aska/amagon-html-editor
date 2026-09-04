// @vitest-environment node

import { createServer } from "node:net";
import { describe, expect, it, vi } from "vitest";
import { createPinnedHttpsFetcher, createSafeMediaFetcher, fetchPinnedHttps } from "./safeMediaNetwork";

const signal = new AbortController().signal;

describe("safe media network", () => {
  it.each([
    ["loopback IPv4", "127.0.0.1"],
    ["private IPv4", "10.2.3.4"],
    ["link-local IPv4", "169.254.1.2"],
    ["loopback IPv6", "::1"],
    ["unique-local IPv6", "fd00::1"],
    ["link-local IPv6", "fe80::1"],
    ["documentation IPv6", "2001:db8::1"],
    ["multicast IPv6", "ff02::1"],
  ])("blocks %s DNS destinations before fetch", async (_name, address) => {
    // Given: an HTTPS provider hostname resolving to a non-public address.
    const fetch = vi.fn();
    const safeFetch = createSafeMediaFetcher({
      fetchPinned: fetch,
      lookup: async () => [{ address, family: address.includes(":") ? 6 : 4 }],
    });

    // When/Then: policy rejects before a request is sent.
    await expect(safeFetch("https://provider.example/media", signal)).rejects.toThrow("public network");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("revalidates a redirect target and blocks a redirect to private DNS", async () => {
    // Given: a public provider response redirecting to an internal hostname.
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { location: "https://internal.example/secret" },
    }));
    const safeFetch = createSafeMediaFetcher({
      fetchPinned: fetch,
      lookup: async (hostname) => [{ address: hostname === "provider.example" ? "8.8.8.8" : "192.168.1.2", family: 4 }],
    });

    // When/Then: the first hop occurs but the private redirect is never requested.
    await expect(safeFetch("https://provider.example/media", signal)).rejects.toThrow("public network");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("allows an HTTPS provider on the standard port and preserves cancellation", async () => {
    // Given: a public provider endpoint and an already canceled request signal.
    const response = new Response("media", { status: 200 });
    const fetch = vi.fn().mockResolvedValue(response);
    const safeFetch = createSafeMediaFetcher({
      fetchPinned: fetch,
      lookup: async () => [{ address: "8.8.8.8", family: 4 }],
    });

    // When: the validated endpoint is requested.
    const result = await safeFetch("https://provider.example/media", signal);

    // Then: the response is returned and the same signal is passed to the network layer.
    expect(result).toBe(response);
    expect(fetch).toHaveBeenCalledWith(
      "https://provider.example/media",
      [{ address: "8.8.8.8", family: 4 }],
      signal,
    );
  });

  it.each([
    "http://provider.example/media",
    "https://user:password@provider.example/media",
    "https://provider.example:8443/media",
  ])("rejects unsafe URL authority %s", async (url) => {
    // Given: a renderer-obtained capability whose provider URL has unsafe authority.
    const fetch = vi.fn();
    const safeFetch = createSafeMediaFetcher({
      fetchPinned: fetch,
      lookup: async () => [{ address: "8.8.8.8", family: 4 }],
    });

    // When/Then: URL policy rejects before DNS-backed fetch.
    await expect(safeFetch(url, signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("pins the validated DNS result when a later answer changes to loopback", async () => {
    // Given: DNS changes from public to loopback and a private listener owns the HTTPS port.
    let privateConnections = 0;
    const server = createServer((socket) => {
      privateConnections += 1;
      socket.destroy();
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(443, "127.0.0.1", () => resolve());
    });
    let resolution = 0;
    const lookup = vi.fn(async () => {
      resolution += 1;
      return resolution === 1
        ? [{ address: "1.1.1.1", family: 4 as const }]
        : [{ address: "127.0.0.1", family: 4 as const }];
    });
    const requestAbort = new AbortController();
    const abortTimer = setTimeout(() => requestAbort.abort(), 500);

    try {
      // When: the real HTTPS connector attempts the policy-approved address.
      const safeFetch = createSafeMediaFetcher({ fetchPinned: fetchPinnedHttps, lookup });
      await expect(safeFetch("https://provider.example/media", requestAbort.signal)).rejects.toThrow();

      // Then: it never asks DNS again or opens a socket to the later loopback answer.
      expect(lookup).toHaveBeenCalledTimes(1);
      expect(privateConnections).toBe(0);
    } finally {
      clearTimeout(abortTimer);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("passes every validated public IPv4 and IPv6 address to the pinned connector", async () => {
    // Given: a provider hostname with multiple public address families.
    const addresses = [
      { address: "8.8.8.8", family: 4 as const },
      { address: "2606:4700:4700::1111", family: 6 as const },
    ];
    const fetchPinned = vi.fn().mockResolvedValue(new Response("media", { status: 200 }));
    const safeFetch = createSafeMediaFetcher({ fetchPinned, lookup: async () => addresses });

    // When: the host is approved for connection.
    await safeFetch("https://provider.example/media", signal);

    // Then: fallback selection is limited to the exact validated multi-address set.
    expect(fetchPinned).toHaveBeenCalledWith("https://provider.example/media", addresses, signal);
  });

  it("falls back across only the validated addresses, including IPv6", async () => {
    // Given: the first validated address fails and the second is public IPv6.
    const addresses = [
      { address: "8.8.8.8", family: 4 as const },
      { address: "2606:4700:4700::1111", family: 6 as const },
    ];
    const requestAddress = vi.fn()
      .mockRejectedValueOnce(new Error("IPv4 unavailable"))
      .mockResolvedValueOnce(new Response("IPv6 media", { status: 200 }));
    const fetchPinned = createPinnedHttpsFetcher(requestAddress);

    // When: the pinned connector selects an address.
    const response = await fetchPinned("https://provider.example/media", addresses, signal);

    // Then: fallback uses the exact validated order and reaches the IPv6 candidate.
    expect(await response.text()).toBe("IPv6 media");
    expect(requestAddress.mock.calls.map((call) => call[1])).toEqual(addresses);
  });
});
