import { net } from "electron";
import { z } from "zod";
import type { MediaSearchConfig, MediaSearchProvider } from "./mediaSearchService";

export type ProviderMediaSearchResult = {
  readonly id: string;
  readonly url: string;
  readonly thumbUrl: string;
  readonly previewUrl: string;
  readonly alt: string;
  readonly photographer?: string;
  readonly sourceUrl?: string;
};

export type MediaSearchOptions = {
  readonly query: string;
  readonly perPage?: number;
  readonly page?: number;
  readonly type?: "image" | "video";
};

const optionalText = z.string().optional();
const mediaId = z.union([z.string(), z.number()]).transform(String);
const unsplashResponse = z.object({
  results: z.array(z.object({
    id: mediaId,
    links: z.object({ download: optionalText, html: optionalText }).optional(),
    urls: z.object({ full: optionalText, regular: optionalText, small: optionalText, thumb: optionalText }).optional(),
    alt_description: optionalText,
    description: optionalText,
    user: z.object({ name: optionalText }).optional(),
  }).passthrough()).default([]),
}).passthrough();
const pexelsPhotoResponse = z.object({
  photos: z.array(z.object({
    id: mediaId,
    src: z.object({ original: optionalText, large: optionalText, medium: optionalText, small: optionalText }).optional(),
    alt: optionalText,
    photographer: optionalText,
    url: optionalText,
  }).passthrough()).default([]),
}).passthrough();
const pexelsVideoResponse = z.object({
  videos: z.array(z.object({
    id: mediaId,
    image: optionalText,
    url: optionalText,
    video_files: z.array(z.object({ link: optionalText }).passthrough()).optional(),
    user: z.object({ name: optionalText }).optional(),
  }).passthrough()).default([]),
}).passthrough();
const pixabayResponse = z.object({
  hits: z.array(z.object({
    id: mediaId,
    largeImageURL: optionalText,
    webformatURL: optionalText,
    previewURL: optionalText,
    tags: optionalText,
    user: optionalText,
    pageURL: optionalText,
    videos: z.object({
      large: z.object({ url: optionalText }).optional(),
      medium: z.object({ url: optionalText }).optional(),
      small: z.object({ url: optionalText }).optional(),
      tiny: z.object({ url: optionalText }).optional(),
    }).optional(),
  }).passthrough()).default([]),
}).passthrough();

const requiredMediaUrl = (value: string | undefined, provider: MediaSearchProvider): string => {
  if (value === undefined || value === "") throw new TypeError(`${provider} returned a media result without a URL`);
  return value;
};

export const searchUnsplash = async (options: MediaSearchOptions, apiKey: string): Promise<ProviderMediaSearchResult[]> => {
  const { query, perPage = 20, page = 1 } = options;
  const response = await net.fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`, {
    headers: { Authorization: `Client-ID ${apiKey}` },
  });
  if (!response.ok) throw new TypeError(`Unsplash API error: ${response.status}`);
  return unsplashResponse.parse(await response.json()).results.map((item) => ({
    id: item.id,
    url: requiredMediaUrl(item.links?.download ?? item.urls?.full ?? item.urls?.regular, "unsplash"),
    thumbUrl: requiredMediaUrl(item.urls?.small ?? item.urls?.thumb, "unsplash"),
    previewUrl: requiredMediaUrl(item.urls?.regular ?? item.urls?.small, "unsplash"),
    alt: item.alt_description ?? item.description ?? "Unsplash image",
    ...(item.user?.name === undefined ? {} : { photographer: item.user.name }),
    ...(item.links?.html === undefined ? {} : { sourceUrl: item.links.html }),
  }));
};

export const searchPexels = async (options: MediaSearchOptions, apiKey: string): Promise<ProviderMediaSearchResult[]> => {
  const { query, perPage = 20, page = 1, type = "image" } = options;
  const endpoint = type === "video" ? "videos" : "search";
  const response = await net.fetch(`https://api.pexels.com/v1/${endpoint}?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`, {
    headers: { Authorization: apiKey },
  });
  if (!response.ok) throw new TypeError(`Pexels API error: ${response.status}`);
  if (type === "video") {
    return pexelsVideoResponse.parse(await response.json()).videos.map((item) => ({
      id: item.id,
      url: requiredMediaUrl(item.video_files?.[0]?.link ?? item.url, "pexels"),
      thumbUrl: requiredMediaUrl(item.image, "pexels"),
      previewUrl: requiredMediaUrl(item.image, "pexels"),
      alt: "Pexels video",
      ...(item.user?.name === undefined ? {} : { photographer: item.user.name }),
      ...(item.url === undefined ? {} : { sourceUrl: item.url }),
    }));
  }
  return pexelsPhotoResponse.parse(await response.json()).photos.map((item) => ({
    id: item.id,
    url: requiredMediaUrl(item.src?.original ?? item.src?.large, "pexels"),
    thumbUrl: requiredMediaUrl(item.src?.medium ?? item.src?.small, "pexels"),
    previewUrl: requiredMediaUrl(item.src?.large ?? item.src?.medium, "pexels"),
    alt: item.alt ?? "Pexels image",
    ...(item.photographer === undefined ? {} : { photographer: item.photographer }),
    ...(item.url === undefined ? {} : { sourceUrl: item.url }),
  }));
};

export const searchPixabay = async (options: MediaSearchOptions, apiKey: string): Promise<ProviderMediaSearchResult[]> => {
  const { query, perPage = 20, page = 1, type = "image" } = options;
  const response = await net.fetch(`https://pixabay.com/api/${type === "video" ? "videos/" : ""}?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&safesearch=true`);
  if (!response.ok) throw new TypeError(`Pixabay API error: ${response.status}`);
  return pixabayResponse.parse(await response.json()).hits.map((item) => ({
    id: item.id,
    url: requiredMediaUrl(type === "video" ? item.videos?.large?.url ?? item.videos?.medium?.url ?? item.videos?.small?.url : item.largeImageURL ?? item.webformatURL, "pixabay"),
    thumbUrl: requiredMediaUrl(type === "video" ? item.videos?.tiny?.url ?? item.videos?.small?.url : item.webformatURL, "pixabay"),
    previewUrl: requiredMediaUrl(type === "video" ? item.videos?.medium?.url ?? item.videos?.small?.url : item.previewURL, "pixabay"),
    alt: item.tags ?? `Pixabay ${type}`,
    ...(item.user === undefined ? {} : { photographer: item.user }),
    ...(item.pageURL === undefined ? {} : { sourceUrl: item.pageURL }),
  }));
};

export const searchMedia = async (
  options: MediaSearchOptions,
  config: MediaSearchConfig,
): Promise<{ readonly results: readonly ProviderMediaSearchResult[]; readonly error?: string }> => {
  if (!config.enabled) return { results: [], error: "Media search is disabled" };
  if (!config.apiKey) return { results: [], error: `No API key configured for ${config.provider}` };
  try {
    if (config.provider === "unsplash") {
      if (options.type === "video") return { results: [], error: "Unsplash does not support video search. Please use Pexels or Pixabay." };
      return { results: await searchUnsplash(options, config.apiKey) };
    }
    if (config.provider === "pexels") return { results: await searchPexels(options, config.apiKey) };
    return { results: await searchPixabay(options, config.apiKey) };
  } catch (error) {
    return { results: [], error: error instanceof Error ? error.message : "Media search failed" };
  }
};
