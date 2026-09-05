const SENSITIVE_PROJECT_KEYS: ReadonlySet<string> = new Set([
  "accesstoken",
  "refreshtoken",
  "authtoken",
  "bearertoken",
  "apitoken",
  "clientsecret",
  "secretaccesskey",
  "privatekey",
  "apikey",
  "credential",
  "credentials",
  "password",
  "passwords",
  "token",
  "secret",
  "encryptedcredentials",
]);

const KEY_SEPARATOR = /[^a-z0-9]+/gu;

export const isSensitiveProjectKey = (key: string): boolean => (
  SENSITIVE_PROJECT_KEYS.has(key.normalize("NFKC").toLowerCase().replace(KEY_SEPARATOR, ""))
);
