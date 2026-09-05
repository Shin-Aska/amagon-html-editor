import { ProjectSessionIdSchema } from "./projectIpcContract";
import { isSensitiveProjectKey } from "./projectSensitiveKey";

type PersistenceOffenderCode = "credential" | "session-identity";

type ForbiddenPersistenceScan = {
  readonly persistenceMode: boolean;
  readonly sessionId: string;
  readonly addOffender: (code: PersistenceOffenderCode, location: string) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const propertyLocation = (base: string, key: string): string => (
  /^[A-Za-z_$][\w$]*$/u.test(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`
);

export const scanForbiddenPersistence = (
  value: unknown,
  location: string,
  scan: ForbiddenPersistenceScan,
): void => {
  if (typeof value === "string") {
    if (
      scan.persistenceMode
      && (value.includes(scan.sessionId) || ProjectSessionIdSchema.safeParse(value).success)
    ) scan.addOffender("session-identity", location);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenPersistence(item, `${location}[${index}]`, scan));
    return;
  }
  if (!isRecord(value)) return;
  for (const key of Object.keys(value).sort()) {
    const childLocation = propertyLocation(location, key);
    if (isSensitiveProjectKey(key)) scan.addOffender("credential", childLocation);
    if (
      scan.persistenceMode
      && (key.includes(scan.sessionId) || ProjectSessionIdSchema.safeParse(key).success)
    ) scan.addOffender("session-identity", childLocation);
    scanForbiddenPersistence(value[key], childLocation, scan);
  }
};
