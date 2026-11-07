import { useMemo, useState } from "react";
import type { AssetUsageReview } from "../../../shared/projects/assetMaintenanceContract";
import AssetReviewList from "./AssetReviewList";

export default function AssetCleanupPanel({
  review,
  busy,
  canUndo,
  cleanup,
  undo,
}: {
  readonly review: AssetUsageReview;
  readonly busy: boolean;
  readonly canUndo: boolean;
  readonly cleanup: (keys: readonly string[]) => Promise<boolean>;
  readonly undo: () => void;
}): JSX.Element {
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const byKey = useMemo(
    () =>
      new Map(review.candidates.map((candidate) => [candidate.key, candidate])),
    [review],
  );
  const keys = useMemo(
    () => review.candidates.map((candidate) => candidate.key),
    [review],
  );
  const selected = [...selection].filter((key) => byKey.has(key));
  const fileCount = selected.filter(
    (key) => byKey.get(key)?.kind === "file",
  ).length;
  return (
    <section aria-label="Unused asset cleanup">
      <h3>
        {review.candidates.length.toLocaleString()} unused files and missing
        entries
      </h3>
      <p>
        Usage is checked across all pages, themes, saved blocks, templates and
        custom CSS. Unapplied font entries can be removed too. Referenced
        missing images must be repaired.
      </p>
      {review.explanation && <p role="status">{review.explanation}</p>}
      <p>
        Files move to <code>.amagon-unused-assets</code> in this project's
        workspace and are excluded from .amg exports. Undo restores the most
        recent cleanup until you leave or convert this project. Cleanup changes
        are saved with your next Save.
      </p>
      {canUndo && (
        <button disabled={busy} onClick={undo}>
          Undo cleanup
        </button>
      )}
      {keys.length > 0 && (
        <>
          <div className="asset-review-actions">
            <button
              disabled={busy || confirming}
              onClick={() => setSelection(new Set(keys.slice(0, 10000)))}
            >
              Select all{keys.length > 10000 ? " (first 10,000)" : ""}
            </button>
            <button
              disabled={busy || confirming}
              onClick={() => setSelection(new Set())}
            >
              Clear selection
            </button>
            <span>{selected.length.toLocaleString()} selected</span>
          </div>
          <AssetReviewList
            paths={keys}
            label="Unused assets"
            render={(key) => {
              const item = byKey.get(key);
              return (
                <label className="asset-review-entry">
                  <input
                    type="checkbox"
                    disabled={busy || confirming}
                    checked={selection.has(key)}
                    onChange={(event) =>
                      setSelection((previous) => {
                        const next = new Set(previous);
                        if (event.target.checked && next.size < 10000)
                          next.add(key);
                        else next.delete(key);
                        return next;
                      })
                    }
                  />
                  <span>
                    {item?.relativePath}
                    <small>
                      {item?.kind === "file"
                        ? "Unused file"
                        : "Unused missing font entry"}
                      {item?.fontIds.length
                        ? ` · ${item.fontIds.length} font ${item.fontIds.length === 1 ? "entry" : "entries"}`
                        : ""}
                    </small>
                  </span>
                </label>
              );
            }}
          />
          {!confirming ? (
            <button
              disabled={busy || !selected.length}
              onClick={() => setConfirming(true)}
            >
              Review cleanup…
            </button>
          ) : (
            <div
              className="asset-review-confirm"
              role="group"
              aria-label="Confirm cleanup"
            >
              <p>
                Move {fileCount.toLocaleString()} unused files to project trash
                and remove the selected unused font entries? No used references
                will be removed.
              </p>
              <button disabled={busy} onClick={() => setConfirming(false)}>
                Keep assets
              </button>{" "}
              <button
                disabled={busy}
                onClick={() =>
                  void cleanup(selected).then((ok) => {
                    if (ok) {
                      setSelection(new Set());
                      setConfirming(false);
                    }
                  })
                }
              >
                Confirm cleanup
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
