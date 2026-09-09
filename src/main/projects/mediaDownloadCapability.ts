import { randomBytes } from "node:crypto";
import {
  parseMediaDownloadId,
  type MediaDownloadId,
  type MediaSearchResult,
  type ProjectSessionId,
} from "../../shared/projects/projectIpcContract";
import type { ProviderMediaSearchResult } from "../mediaProviderSearch";

type Capability = {
  readonly sessionId: ProjectSessionId;
  readonly senderId: number;
  readonly url: string;
};

export class MediaDownloadCapabilityError extends Error {
  readonly name = "MediaDownloadCapabilityError";
}

export type MediaDownloadCapabilityRegistry = {
  readonly issue: (
    sessionId: ProjectSessionId,
    senderId: number,
    result: ProviderMediaSearchResult,
  ) => MediaSearchResult;
  readonly consume: (
    downloadId: unknown,
    sessionId: ProjectSessionId,
    senderId: number,
  ) => string;
  readonly clearSession: (sessionId: ProjectSessionId) => void;
};

export const createMediaDownloadCapabilityRegistry = (): MediaDownloadCapabilityRegistry => {
  const active = new Map<MediaDownloadId, Capability>();

  return {
    issue(sessionId, senderId, result) {
      const downloadId = parseMediaDownloadId(randomBytes(32).toString("base64url"));
      active.set(downloadId, { sessionId, senderId, url: result.url });
      const { url: _url, ...visible } = result;
      return { ...visible, downloadId };
    },
    consume(downloadIdInput, sessionId, senderId) {
      let downloadId: MediaDownloadId;
      try {
        downloadId = parseMediaDownloadId(downloadIdInput);
      } catch {
        throw new MediaDownloadCapabilityError("media download capability is invalid or expired");
      }
      const capability = active.get(downloadId);
      active.delete(downloadId);
      if (capability === undefined) {
        throw new MediaDownloadCapabilityError("media download capability is invalid or expired");
      }
      if (capability.sessionId !== sessionId) {
        throw new MediaDownloadCapabilityError("media download capability belongs to another project session");
      }
      if (capability.senderId !== senderId) {
        throw new MediaDownloadCapabilityError("media download capability belongs to another application sender");
      }
      return capability.url;
    },
    clearSession(sessionId) {
      for (const [downloadId, capability] of active) {
        if (capability.sessionId === sessionId) active.delete(downloadId);
      }
    },
  };
};
