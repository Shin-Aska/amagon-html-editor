export type AmgArchiveReaderErrorCode =
  | "invalid-archive"
  | "limit-exceeded"
  | "unsupported-feature"
  | "unsafe-entry"
  | "integrity"
  | "invalid-project";

export class AmgArchiveReaderError extends Error {
  readonly name = "AmgArchiveReaderError";

  constructor(
    readonly code: AmgArchiveReaderErrorCode,
    message: string,
    readonly originalError?: unknown,
  ) {
    super(message);
  }
}
