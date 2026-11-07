/** Tiny bridge so page changes and saves can flush edits without importing Monaco. */
let flush: (() => void) | undefined;
let generation = 0;
export function registerCodeFlush(callback: () => void): () => void {
  flush = callback;
  return () => {
    if (flush === callback) flush = undefined;
  };
}
export function flushCodeEdits(): void {
  flush?.();
}
export function resetCodeSession(): void {
  flushCodeEdits();
  generation++;
}
export function codeSessionGeneration(): number {
  return generation;
}
