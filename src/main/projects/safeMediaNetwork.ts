import { lookup as resolveDns } from "node:dns/promises";
import { request as requestHttps } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

export type ResolvedAddress = {
  readonly address: string;
  readonly family: 4 | 6;
};

type SafeMediaFetcherDependencies = {
  readonly fetchPinned: (
    url: string,
    addresses: readonly ResolvedAddress[],
    signal?: AbortSignal,
  ) => Promise<Response>;
  readonly lookup: (hostname: string) => Promise<readonly ResolvedAddress[]>;
};

export type SafeMediaFetcher = (url: string, signal?: AbortSignal) => Promise<Response>;

export class MediaNetworkPolicyError extends Error {
  readonly name = "MediaNetworkPolicyError";
}

const blockedIpv4 = new BlockList();
const blockedIpv6 = new BlockList();

const addBlockedSubnet = (address: string, prefix: number, family: "ipv4" | "ipv6"): void => {
  const blockList = family === "ipv4" ? blockedIpv4 : blockedIpv6;
  blockList.addSubnet(address, prefix, family);
};

for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] satisfies readonly (readonly [string, number])[]) addBlockedSubnet(address, prefix, "ipv4");

for (const [address, prefix] of [
  ["::", 3], ["4000::", 2], ["8000::", 1],
  ["::", 128], ["::1", 128], ["::ffff:0:0", 96], ["64:ff9b:1::", 48],
  ["100::", 64], ["2001::", 23],
  ["2001:db8::", 32], ["2002::", 16], ["2620:4f:8000::", 48], ["3fff::", 20], ["fc00::", 7],
  ["fe80::", 10], ["ff00::", 8],
] satisfies readonly (readonly [string, number])[]) addBlockedSubnet(address, prefix, "ipv6");

const hostnameForIpCheck = (hostname: string): string => (
  hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname
);

const assertSafeUrl = (input: string): URL => {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new MediaNetworkPolicyError("media URL is invalid");
  }
  if (url.protocol !== "https:") throw new MediaNetworkPolicyError("media downloads require HTTPS");
  if (url.username !== "" || url.password !== "") throw new MediaNetworkPolicyError("media URL credentials are forbidden");
  if (url.port !== "" && url.port !== "443") throw new MediaNetworkPolicyError("media URL must use the standard HTTPS port");
  return url;
};

const resolveAddresses = async (
  hostname: string,
  lookup: SafeMediaFetcherDependencies["lookup"],
): Promise<readonly ResolvedAddress[]> => {
  const normalized = hostnameForIpCheck(hostname);
  const family = isIP(normalized);
  if (family === 4 || family === 6) return [{ address: normalized, family }];
  return lookup(normalized);
};

const assertPublicHost = async (
  url: URL,
  lookup: SafeMediaFetcherDependencies["lookup"],
): Promise<readonly ResolvedAddress[]> => {
  const addresses = await resolveAddresses(url.hostname, lookup);
  if (addresses.length === 0) throw new MediaNetworkPolicyError("media hostname did not resolve");
  for (const resolved of addresses) {
    const family = resolved.family === 4 ? "ipv4" : "ipv6";
    const blockList = resolved.family === 4 ? blockedIpv4 : blockedIpv6;
    if (blockList.check(resolved.address, family)) {
      throw new MediaNetworkPolicyError("media hostname must resolve only to the public network");
    }
  }
  return addresses;
};

const responseBody = (response: import("node:http").IncomingMessage): ReadableStream<Uint8Array> => {
  response.pause();
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      return new Promise<void>((resolve, reject) => {
        const cleanup = (): void => {
          response.off("data", onData);
          response.off("end", onEnd);
          response.off("error", onError);
        };
        const onData = (chunk: Buffer): void => {
          cleanup();
          response.pause();
          controller.enqueue(new Uint8Array(chunk));
          resolve();
        };
        const onEnd = (): void => {
          cleanup();
          controller.close();
          resolve();
        };
        const onError = (error: Error): void => {
          cleanup();
          controller.error(error);
          reject(error);
        };
        response.once("data", onData);
        response.once("end", onEnd);
        response.once("error", onError);
        response.resume();
      });
    },
    cancel() {
      response.destroy();
    },
  });
};

const responseHeaders = (headers: import("node:http").IncomingHttpHeaders): Headers => {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((item) => result.append(name, item));
    else result.set(name, value);
  }
  return result;
};

const requestPinnedAddress = (
  input: string,
  resolved: ResolvedAddress,
  signal?: AbortSignal,
): Promise<Response> => new Promise((resolve, reject) => {
  const url = new URL(input);
  const lookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all === true) callback(null, [resolved]);
    else callback(null, resolved.address, resolved.family);
  };
  const request = requestHttps(url, {
    headers: { Host: url.host },
    lookup,
    servername: hostnameForIpCheck(url.hostname),
    signal,
  }, (incoming) => {
    const status = incoming.statusCode ?? 500;
    const hasBody = status !== 204 && status !== 205 && status !== 304;
    resolve(new Response(hasBody ? responseBody(incoming) : null, {
      status,
      statusText: incoming.statusMessage,
      headers: responseHeaders(incoming.headers),
    }));
  });
  request.once("error", reject);
  request.end();
});

type PinnedAddressRequester = (
  input: string,
  resolved: ResolvedAddress,
  signal?: AbortSignal,
) => Promise<Response>;

export const createPinnedHttpsFetcher = (
  requestAddress: PinnedAddressRequester,
): SafeMediaFetcherDependencies["fetchPinned"] => async (input, addresses, signal) => {
  let lastError: Error = new MediaNetworkPolicyError("media hostname has no usable public address");
  for (const address of addresses) {
    if (signal?.aborted) throw new DOMException("Media download canceled", "AbortError");
    try {
      return await requestAddress(input, address, signal);
    } catch (error) {
      if (signal?.aborted) throw new DOMException("Media download canceled", "AbortError");
      lastError = error instanceof Error ? error : new Error("media connection failed");
    }
  }
  throw lastError;
};

export const fetchPinnedHttps = createPinnedHttpsFetcher(requestPinnedAddress);

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

export const createSafeMediaFetcher = (
  dependencies: SafeMediaFetcherDependencies,
): SafeMediaFetcher => async (input, signal) => {
  let current = assertSafeUrl(input);
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const addresses = await assertPublicHost(current, dependencies.lookup);
    const response = await dependencies.fetchPinned(current.toString(), addresses, signal);
    if (!REDIRECT_STATUSES.has(response.status)) return response;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (location === null) throw new MediaNetworkPolicyError("media redirect omitted its destination");
    if (redirectCount === MAX_REDIRECTS) throw new MediaNetworkPolicyError("media redirect limit exceeded");
    current = assertSafeUrl(new URL(location, current).toString());
  }
  throw new MediaNetworkPolicyError("media redirect limit exceeded");
};

export const safeMediaFetch = createSafeMediaFetcher({
  fetchPinned: fetchPinnedHttps,
  lookup: async (hostname) => (await resolveDns(hostname, { all: true, verbatim: true })).map((resolved) => {
    if (resolved.family !== 4 && resolved.family !== 6) throw new MediaNetworkPolicyError("media hostname resolved with an unsupported address family");
    return { address: resolved.address, family: resolved.family };
  }),
});
