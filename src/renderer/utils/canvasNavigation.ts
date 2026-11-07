export const REVEAL_CANVAS_BLOCK_EVENT = "amagon:reveal-canvas-block";
export function revealCanvasBlock(blockId: string): void {
  window.dispatchEvent(
    new CustomEvent(REVEAL_CANVAS_BLOCK_EVENT, { detail: { blockId } }),
  );
}

export const CANVAS_SELECTION_EVENT = "amagon:canvas-selection";
export function notifyCanvasSelection(blockId: string | null): void {
  window.dispatchEvent(
    new CustomEvent(CANVAS_SELECTION_EVENT, { detail: { blockId } }),
  );
}
