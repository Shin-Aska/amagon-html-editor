import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { projectCommands } from "../../project/projectCommands";
import {
  PROJECT_ASSETS_REPAIRED_EVENT,
  useLegacyConversionPrompt,
} from "../../project/legacyConversionPrompt";
import type { ProjectPortabilityOffender } from "../../../shared/projects/projectPortability";
import "./LegacyProjectDialog.css";
import AssetReviewList from "./AssetReviewList";
import AssetCleanupPanel from "./AssetCleanupPanel";
import type { AssetUsageReview } from "../../../shared/projects/assetMaintenanceContract";

export default function LegacyProjectDialog(): JSX.Element {
  const request = useLegacyConversionPrompt((state) => state.request);
  const answer = useLegacyConversionPrompt((state) => state.answer);
  const cleanupMode = request?.mode === "cleanup";
  const [tab, setTab] = useState<"missing" | "unused">(
    cleanupMode ? "unused" : "missing",
  );
  const [review, setReview] = useState<AssetUsageReview>({
    candidates: [],
    explanation: null,
  });
  const [notice, setNotice] = useState("");
  const [canUndo, setCanUndo] = useState(() =>
    projectCommands.hasAssetCleanup(),
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [issues, setIssues] = useState<readonly ProjectPortabilityOffender[]>(
    [],
  );
  const [busy, setBusy] = useState(true);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const refresh = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError("");
    try {
      const result = await projectCommands.inspectConversion();
      const usage = await projectCommands.inspectUnusedAssets();
      if (!mounted.current) return false;
      setIssues(result.ok ? [] : result.offenders);
      setReview(usage);
      setChecked(true);
      return result.ok;
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not check project assets. Try again.",
        );
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const previousFocus =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : document.querySelector<HTMLButtonElement>(
            'button[aria-label="Save project"]',
          );
    const modal = dialog.current;
    modal?.showModal();
    void refresh();
    return () => {
      mounted.current = false;
      if (modal?.open) modal.close();
      requestAnimationFrame(() => {
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
          previousFocus.focus();
      });
    };
  }, [refresh]);
  const missing = useMemo(
    () => [
      ...new Set(
        issues
          .filter((issue) => issue.code === "missing-asset")
          .flatMap((issue) => (issue.reference ? [issue.reference] : [])),
      ),
    ],
    [issues],
  );
  const other = issues.filter((issue) => issue.code !== "missing-asset");
  const repair = async (relativePath: string): Promise<void> => {
    setBusy(true);
    setError("");
    try {
      const result = await projectCommands.repairAsset(relativePath);
      if (!mounted.current) return;
      if (result.ok) {
        window.dispatchEvent(new Event(PROJECT_ASSETS_REPAIRED_EVENT));
        await refresh();
      } else if (!result.canceled) setError(result.message.detail);
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not repair this asset.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const maintain = async (action: () => Promise<boolean>): Promise<boolean> => {
    setBusy(true);
    setError("");
    try {
      const changed = await action();
      if (changed && mounted.current) {
        window.dispatchEvent(new Event(PROJECT_ASSETS_REPAIRED_EVENT));
        await refresh();
      }
      return changed;
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not update project assets.",
        );
      return false;
    } finally {
      if (mounted.current) {
        setBusy(false);
        setCanUndo(projectCommands.hasAssetCleanup());
      }
    }
  };
  const batchRepair = () =>
    maintain(async () => {
      const result = await projectCommands.repairAssets(
        missing.slice(0, 10000),
      );
      if (!result.ok) {
        if (!result.canceled) setError(result.message.detail);
        return false;
      }
      setNotice(
        `Repaired ${result.value.repaired.length.toLocaleString()} files. ${result.value.unmatched.length.toLocaleString()} unmatched or ambiguous; ${result.value.failed.length.toLocaleString()} could not be copied. Remaining entries can be located individually or retried in another batch.`,
      );
      return true;
    });
  const cleanup = (keys: readonly string[]) =>
    maintain(async () => {
      const result = await projectCommands.cleanupAssets(keys);
      if (!result.ok) {
        setError(result.message.detail);
        return false;
      }
      setCanUndo(true);
      setNotice(
        `Moved ${result.value.paths.length.toLocaleString()} files to project trash; removed ${result.value.fontIds.length.toLocaleString()} unused font entries. ${result.value.failed.length.toLocaleString()} files could not be moved.`,
      );
      return true;
    });
  const undo = () =>
    maintain(async () => {
      const result = await projectCommands.undoAssetCleanup();
      if (!result.ok) {
        setError(result.message.detail);
        return false;
      }
      setCanUndo(result.value.remaining > 0);
      setNotice(
        result.value.remaining
          ? `${result.value.remaining} entries could not be restored. Undo never overwrites reimported files. Resolve the conflicts and retry.`
          : "Cleanup undone. Files and font entries were restored.",
      );
      return true;
    });
  return (
    <dialog
      ref={dialog}
      className="legacy-project-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) answer(false);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          if (!busy) answer(false);
        }
      }}
    >
      <h2 id={titleId}>
        {cleanupMode ? "Review project assets" : "Save legacy project as .amg"}
      </h2>
      {!cleanupMode && (
        <p>
          Your project will be converted to a portable <strong>.amg</strong>{" "}
          file containing its assets. You will choose where to save it.
          Conversion will not replace your original JSON file.
        </p>
      )}
      <p className="legacy-project-path">{request?.displayPath}</p>
      <nav className="asset-review-tabs" aria-label="Asset review">
        <button
          aria-pressed={tab === "missing"}
          disabled={busy}
          onClick={() => setTab("missing")}
        >
          Missing assets ({missing.length.toLocaleString()})
        </button>
        <button
          aria-pressed={tab === "unused"}
          disabled={busy}
          onClick={() => setTab("unused")}
        >
          Unused assets ({review.candidates.length.toLocaleString()})
        </button>
      </nav>
      <div aria-busy={busy}>
        {tab === "unused" && (
          <AssetCleanupPanel
            review={review}
            busy={busy}
            canUndo={canUndo}
            cleanup={cleanup}
            undo={() => void undo()}
          />
        )}
        {tab === "missing" && (
          <>
            {missing.length > 0 && (
              <>
                <h3>
                  Repair {missing.length} missing{" "}
                  {missing.length === 1 ? "asset" : "assets"} first
                </h3>
                <p>
                  Choose a replacement of the same file type. It will be copied
                  under the missing filename so your existing references keep
                  working.
                </p>
                <button disabled={busy} onClick={() => void batchRepair()}>
                  Locate multiple files…
                </button>
                <p className="legacy-project-path">
                  Matches exact filenames and folder suffixes. Duplicate or
                  ambiguous names stay unresolved. Up to 10,000 replacements per
                  batch.
                </p>
                <AssetReviewList
                  paths={missing}
                  label="Missing assets"
                  render={(relativePath) => (
                    <>
                      <span>{relativePath}</span>
                      <button
                        disabled={busy}
                        onClick={() => void repair(relativePath)}
                        aria-label={`Locate ${relativePath}`}
                      >
                        Locate file…
                      </button>
                    </>
                  )}
                />
              </>
            )}
            {other.length > 0 && (
              <div role="alert">
                <h3>Some references need updating</h3>
                <p>
                  Replace local files or invalid asset references using the
                  canvas or Asset Manager before converting.
                </p>
                <AssetReviewList
                  paths={[
                    ...new Set(
                      other.map(
                        (issue) =>
                          issue.reference ??
                          "A project reference needs updating",
                      ),
                    ),
                  ]}
                  label="Other references"
                  render={(reference) => reference}
                />
              </div>
            )}
            {checked && issues.length === 0 && !error && (
              <p className="legacy-project-ready">
                All referenced assets are available.
                {!cleanupMode && " Ready to save as .amg."}
              </p>
            )}
          </>
        )}
        {notice && <p role="status">{notice}</p>}
        {busy && (
          <p role="status">
            Checking or updating project assets. Large batches may take a
            moment…
          </p>
        )}
        {error && (
          <p role="alert" className="legacy-project-error">
            {error}
          </p>
        )}
      </div>
      {!cleanupMode && (
        <p>
          You can cancel and keep editing. Files you repair remain in your
          legacy project's assets folder.
        </p>
      )}
      <footer>
        <button disabled={busy} onClick={() => answer(false)}>
          {cleanupMode ? "Done" : "Cancel"}
        </button>
        <button disabled={busy} onClick={() => void refresh()}>
          Recheck assets
        </button>
        {!cleanupMode && (
          <button
            className="legacy-project-convert"
            disabled={busy || !checked || issues.length > 0 || Boolean(error)}
            onClick={() =>
              void refresh().then((ready) => {
                if (ready) answer(true);
              })
            }
          >
            Save as .amg
          </button>
        )}
      </footer>
    </dialog>
  );
}
