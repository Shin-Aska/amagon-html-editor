import { useCallback, useEffect, useId, useRef, useState } from "react";
import { projectCommands } from "../../project/projectCommands";
import {
  PROJECT_ASSETS_REPAIRED_EVENT,
  useLegacyConversionPrompt,
} from "../../project/legacyConversionPrompt";
import type { ProjectPortabilityOffender } from "../../../shared/projects/projectPortability";
import "./LegacyProjectDialog.css";

export default function LegacyProjectDialog(): JSX.Element {
  const request = useLegacyConversionPrompt((state) => state.request);
  const answer = useLegacyConversionPrompt((state) => state.answer);
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
      if (!mounted.current) return false;
      setIssues(result.ok ? [] : result.offenders);
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
    const previousFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : document.querySelector<HTMLButtonElement>('button[aria-label="Save project"]');
    const modal = dialog.current;
    modal?.showModal();
    void refresh();
    return () => {
      mounted.current = false;
      if (modal?.open) modal.close();
      requestAnimationFrame(() => {
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      });
    };
  }, [refresh]);
  const missing = [
    ...new Set(
      issues
        .filter((issue) => issue.code === "missing-asset")
        .flatMap((issue) => (issue.reference ? [issue.reference] : [])),
    ),
  ];
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
      <h2 id={titleId}>Save legacy project as .amg</h2>
      <p>
        Your project will be converted to a portable <strong>.amg</strong> file
        containing its assets. You will choose where to save it. Conversion will
        not replace your original JSON file.
      </p>
      <p className="legacy-project-path">{request?.displayPath}</p>
      <div aria-live="polite" aria-busy={busy}>
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
            <ul>
              {missing.map((relativePath) => (
                <li key={relativePath}>
                  <span>{relativePath}</span>
                  <button
                    disabled={busy}
                    onClick={() => void repair(relativePath)}
                    aria-label={`Locate ${relativePath}`}
                  >
                    Locate file…
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {other.length > 0 && (
          <div role="alert">
            <h3>Some references need updating</h3>
            <p>
              Replace local files or invalid asset references using the canvas
              or Asset Manager before converting.
            </p>
            <ul>
              {[
                ...new Set(
                  other.map(
                    (issue) =>
                      issue.reference ?? "A project reference needs updating",
                  ),
                ),
              ].map((reference) => (
                <li key={reference}>{reference}</li>
              ))}
            </ul>
          </div>
        )}
        {checked && issues.length === 0 && !error && (
          <p className="legacy-project-ready">
            All referenced assets are available. Ready to save as .amg.
          </p>
        )}
        {busy && <p role="status">Checking or repairing project assets…</p>}
        {error && (
          <p role="alert" className="legacy-project-error">
            {error}
          </p>
        )}
      </div>
      <p>
        You can cancel and keep editing. Files you repair remain in your legacy
        project's assets folder.
      </p>
      <footer>
        <button disabled={busy} onClick={() => answer(false)}>
          Cancel
        </button>
        <button disabled={busy} onClick={() => void refresh()}>
          Recheck assets
        </button>
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
      </footer>
    </dialog>
  );
}
