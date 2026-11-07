import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import * as localMonaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/editor.all";
import "monaco-editor/esm/vs/basic-languages/html/html.contribution";
import "monaco-editor/esm/vs/basic-languages/css/css.contribution";
import "monaco-editor/esm/vs/language/html/monaco.contribution";
import "monaco-editor/esm/vs/language/css/monaco.contribution";
import { useEditorStore } from "../../store/editorStore";
import { useProjectStore } from "../../store/projectStore";
import { useAppSettingsStore } from "../../store/appSettingsStore";
import { pageToHtml } from "../../utils/blockToHtml";
import { htmlToBlocks } from "../../utils/htmlToBlocks";
import {
  codeSessionGeneration,
  registerCodeFlush,
} from "../../utils/codeEditingSession";
import {
  CANVAS_SELECTION_EVENT,
  revealCanvasBlock,
} from "../../utils/canvasNavigation";
import { commitPageCodeBlocks } from "../../utils/codePageCommit";
import { APP_CSS_TOKENS } from "../../themes/appThemes";
import type { AppPalette } from "../../themes/appThemes";
import type { Block, Page } from "../../store/types";
import {
  blockIdAtOffset,
  monacoAppTheme,
  pageFilename,
  projectClasses,
  projectThemeVariableNames,
  widgetHtmlRanges,
  decorateWidgetHtml,
  type WidgetHtmlRange,
} from "./editorSupport";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import "./CodeEditor.css";

(globalThis as unknown as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    if (["html", "handlebars", "razor"].includes(label))
      return new htmlWorker();
    if (["css", "scss", "less"].includes(label)) return new cssWorker();
    if (["typescript", "javascript"].includes(label)) return new tsWorker();
    return new editorWorker();
  },
};
// Load installed Monaco locally, only when this lazy panel opens. No CDN fetch.
loader.config({ monaco: localMonaco });

interface DocumentEntry {
  key: string;
  tab: string;
  pageId: string;
  model: Monaco.editor.ITextModel;
  listener: Monaco.IDisposable;
  source: string;
  dirty: boolean;
  invalid: boolean;
  view: Monaco.editor.ICodeEditorViewState | null;
  timer?: ReturnType<typeof setTimeout>;
}
interface Draft {
  text: string;
  source: string;
  invalid: boolean;
  view: Monaco.editor.ICodeEditorViewState | null;
}
// Text drafts survive closing the panel. Monaco models are released when it closes.
const drafts = new Map<string, Draft>();
let draftGeneration = -1;
const MAX_MODELS = 6;
function rememberDraft(key: string, draft: Draft): void {
  drafts.delete(key);
  drafts.set(key, draft);
  const clean = [...drafts.entries()].filter(([, value]) => !value.invalid);
  for (const [id] of clean.slice(0, Math.max(0, clean.length - MAX_MODELS)))
    drafts.delete(id);
}
function htmlFor(page: Page | null, blocks: Block[], css: string): string {
  const s = useProjectStore.getState();
  return pageToHtml(blocks, {
    framework: s.settings.framework,
    customCss: css,
    title: page?.title || "index",
    pageTitle: page?.pageTitle,
    fullWidthFormControls: page?.fullWidthFormControls,
    includeEditorMetadata: true,
    decorateBlock: decorateWidgetHtml,
  });
}
export default function CodeEditor(): JSX.Element {
  const blocks = useEditorStore((s) => s.blocks),
    css = useEditorStore((s) => s.customCss),
    dragging = useEditorStore((s) => s.isDragging);
  const selected = useEditorStore((s) => s.selectedBlockId);
  const page = useProjectStore((s) => s.getCurrentPage()),
    files = useProjectStore((s) => s.settings.theme.customCssFiles);
  const framework = useProjectStore((s) => s.settings.framework),
    loaded = useProjectStore((s) => s.isProjectLoaded);
  const preferences = useAppSettingsStore((s) => s.codePreferences);
  const mode = useAppSettingsStore((s) => s.theme),
    colorTheme = useAppSettingsStore((s) => s.appColorTheme),
    customThemes = useAppSettingsStore((s) => s.customAppThemes);
  const [tab, setTab] = useState("html"),
    [ready, setReady] = useState(false),
    [optionsOpen, setOptionsOpen] = useState(false),
    [problemsOpen, setProblemsOpen] = useState(false);
  const [problems, setProblems] = useState<Monaco.editor.IMarker[]>([]),
    [status, setStatus] = useState("Synced with canvas"),
    [formatting, setFormatting] = useState(false);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null),
    monacoRef = useRef<typeof Monaco | null>(null);
  const entries = useRef(new Map<string, DocumentEntry>()),
    suppress = useRef(false),
    generation = useRef(codeSessionGeneration());
  const visiblePage = useRef(page?.id),
    activeEntry = useRef<DocumentEntry | null>(null),
    disposables = useRef<Monaco.IDisposable[]>([]);
  const codeDecorations =
    useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const [canvasSelectionTick, setCanvasSelectionTick] = useState(0);
  const sourceRanges = useRef<{
    model: Monaco.editor.ITextModel;
    version: number;
    ranges: Map<string, WidgetHtmlRange>;
  } | null>(null);
  const visualHtml = useMemo(
    () =>
      htmlFor(
        page,
        visiblePage.current === page?.id ? blocks : (page?.blocks ?? []),
        css,
      ),
    [blocks, css, page, framework],
  );
  const currentKey =
    tab === "html" ? `html:${page?.id}` : tab === "css" ? "css" : `file:${tab}`;
  const latest = useRef({
    page,
    tab,
    visualHtml,
    css,
    files,
    currentKey,
    preferences,
  });
  latest.current = {
    page,
    tab,
    visualHtml,
    css,
    files,
    currentKey,
    preferences,
  };

  function updateStatus(): void {
    const entry = activeEntry.current;
    setStatus(
      entry?.dirty
        ? "Applying edits…"
        : entry?.invalid
          ? "Draft has errors · canvas unchanged"
          : "Synced with canvas",
    );
    if (monacoRef.current && entry)
      setProblems(
        monacoRef.current.editor.getModelMarkers({ resource: entry.model.uri }),
      );
  }
  function updateText(entry: DocumentEntry, value: string): void {
    if (entry.model.getValue() === value) return;
    suppress.current = true;
    try {
      const model = entry.model,
        old = model.getValue();
      let start = 0,
        endOld = old.length,
        endNew = value.length;
      while (start < endOld && start < endNew && old[start] === value[start])
        start++;
      while (
        endOld > start &&
        endNew > start &&
        old[endOld - 1] === value[endNew - 1]
      ) {
        endOld--;
        endNew--;
      }
      const a = model.getPositionAt(start),
        b = model.getPositionAt(endOld);
      // Model edit operations keep undo history for inactive tabs too.
      model.pushStackElement();
      model.pushEditOperations(
        [],
        [
          {
            range: {
              startLineNumber: a.lineNumber,
              startColumn: a.column,
              endLineNumber: b.lineNumber,
              endColumn: b.column,
            },
            text: value.slice(start, endNew),
          },
        ],
        () => null,
      );
      model.pushStackElement();
    } finally {
      suppress.current = false;
    }
  }
  function commit(entry: DocumentEntry): void {
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = undefined;
    }
    if (!entry.dirty) return;
    entry.dirty = false;
    const project = useProjectStore.getState(),
      editor = useEditorStore.getState(),
      text = entry.model.getValue();
    if (entry.tab === "html") {
      const target = project.pages.find((p) => p.id === entry.pageId);
      if (!target) return;
      const result = htmlToBlocks(text),
        monaco = monacoRef.current;
      if (monaco)
        monaco.editor.setModelMarkers(
          entry.model,
          "amagon-html",
          result.diagnostics.map((d) => ({
            ...d,
            severity:
              d.severity === "error"
                ? monaco.MarkerSeverity.Error
                : monaco.MarkerSeverity.Warning,
          })),
        );
      entry.invalid = result.diagnostics.some((d) => d.severity === "error");
      if (!entry.invalid) {
        const doc = new DOMParser().parseFromString(text, "text/html");
        const nextCss =
          doc.querySelector("style#html-editor-custom-css")?.textContent ?? "";
        entry.source = htmlFor(target, result.blocks, nextCss);
        commitPageCodeBlocks(entry.pageId, result.blocks);
        if (editor.customCss !== nextCss) editor.setCustomCss(nextCss);
      }
    } else if (entry.tab === "css") {
      entry.source = text;
      editor.setCustomCss(text);
    } else if (
      project.settings.theme.customCssFiles?.some((f) => f.id === entry.tab)
    ) {
      entry.source = text;
      project.updateCssFile(entry.tab, { css: text });
    }
    rememberDraft(entry.key, {
      text,
      source: entry.source,
      invalid: entry.invalid,
      view: entry.view,
    });
    editor.setIsTypingCode([...entries.current.values()].some((e) => e.dirty));
    updateStatus();
  }
  function flush(): void {
    for (const entry of entries.current.values()) commit(entry);
  }
  function saveView(): void {
    if (activeEntry.current)
      activeEntry.current.view = editorRef.current?.saveViewState() ?? null;
  }
  function disposeEntry(entry: DocumentEntry): void {
    commit(entry);
    rememberDraft(entry.key, {
      text: entry.model.getValue(),
      source: entry.source,
      invalid: entry.invalid,
      view: entry.view,
    });
    entry.listener.dispose();
    entry.model.dispose();
    entries.current.delete(entry.key);
  }
  function attach(): void {
    const editor = editorRef.current,
      monaco = monacoRef.current,
      { page, tab, currentKey, visualHtml, css, files } = latest.current;
    if (!editor || !monaco) return;
    saveView();
    if (generation.current !== codeSessionGeneration()) {
      for (const entry of [...entries.current.values()]) {
        entry.dirty = false;
        disposeEntry(entry);
      }
      entries.current.clear();
      drafts.clear();
      generation.current = codeSessionGeneration();
      activeEntry.current = null;
    }
    if (draftGeneration !== generation.current) {
      drafts.clear();
      draftGeneration = generation.current;
    }
    const source =
      tab === "html"
        ? visualHtml
        : tab === "css"
          ? css
          : files?.find((f) => f.id === tab)?.css;
    if (source === undefined) return;
    let entry = entries.current.get(currentKey);
    if (!entry) {
      while (entries.current.size >= MAX_MODELS) {
        const candidate = [...entries.current.values()].find(
          (e) => e !== activeEntry.current,
        );
        if (candidate) disposeEntry(candidate);
        else break;
      }
      const draft = drafts.get(currentKey),
        restore = draft && (draft.invalid || draft.source === source);
      const model = monaco.editor.createModel(
        restore ? draft.text : source,
        tab === "html" ? "html" : "css",
        monaco.Uri.parse(
          `inmemory://amagon/${generation.current}/${encodeURIComponent(currentKey)}.${tab === "html" ? "html" : "css"}`,
        ),
      );
      entry = {
        key: currentKey,
        tab,
        pageId: page?.id ?? "",
        model,
        source,
        dirty: false,
        invalid: !!restore && draft.invalid,
        view: restore ? draft.view : null,
        listener: { dispose: () => undefined },
      };
      const target = entry;
      entry.listener = model.onDidChangeContent(() => {
        if (suppress.current) return;
        target.dirty = true;
        target.invalid = false;
        useEditorStore.getState().setIsTypingCode(true);
        useEditorStore.getState().markDirty();
        if (target.timer) clearTimeout(target.timer);
        target.timer = setTimeout(
          () => commit(target),
          target.tab === "html" ? 650 : 400,
        );
        updateStatus();
      });
      entries.current.set(currentKey, entry);
      if (entry.invalid) {
        entry.dirty = true;
        commit(entry);
      }
    }
    // Refresh LRU order and sync visual changes without overwriting pending/invalid code.
    entries.current.delete(currentKey);
    entries.current.set(currentKey, entry);
    if (!entry.dirty && !entry.invalid && entry.source !== source) {
      updateText(entry, source);
      entry.source = source;
    }
    if (editor.getModel() !== entry.model) {
      editor.setModel(entry.model);
      if (entry.view) editor.restoreViewState(entry.view);
    }
    activeEntry.current = entry;
    visiblePage.current = page?.id;
    updateStatus();
  }
  function applyTheme(): void {
    const monaco = monacoRef.current;
    if (!monaco) return;
    const style = getComputedStyle(document.body),
      p = {} as AppPalette;
    for (const key of Object.keys(APP_CSS_TOKENS) as (keyof AppPalette)[])
      p[key] =
        style.getPropertyValue(`--color-${APP_CSS_TOKENS[key]}`).trim() ||
        "#808080";
    monaco.editor.defineTheme(
      "amagon-app",
      monacoAppTheme(
        document.body.classList.contains("dark") ? "dark" : "light",
        p,
      ),
    );
    monaco.editor.setTheme("amagon-app");
  }
  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    const initialModel = editor.getModel();
    attach();
    initialModel?.dispose();
    applyTheme();
    setReady(true);
    codeDecorations.current = editor.createDecorationsCollection();
    disposables.current.push(
      monaco.editor.onDidChangeMarkers(() => updateStatus()),
    );
    // Suggestions are generated on request from current project data, without indexing or a background service.
    for (const language of ["html", "css"])
      disposables.current.push(
        monaco.languages.registerCompletionItemProvider(language, {
          triggerCharacters: language === "css" ? ["-", "."] : ['"', " "],
          provideCompletionItems: (model, position) => {
            if (![...entries.current.values()].some((e) => e.model === model))
              return { suggestions: [] };
            const word = model.getWordUntilPosition(position),
              range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
              };
            const project = useProjectStore.getState(),
              allBlocks = project.pages.flatMap((p) =>
                p.id === project.currentPageId
                  ? useEditorStore.getState().blocks
                  : p.blocks,
              );
            const suggestions: Monaco.languages.CompletionItem[] = [];
            if (language === "css") {
              const prefix = model
                .getLineContent(position.lineNumber)
                .slice(0, position.column - 1);
              const cssRange = {
                ...range,
                startColumn: Math.max(
                  1,
                  range.startColumn -
                    (prefix.slice(0, word.startColumn - 1).endsWith("--")
                      ? 2
                      : 0),
                ),
              };
              for (const name of projectThemeVariableNames(
                project.settings.theme,
              ))
                suggestions.push({
                  label: name,
                  kind: monaco.languages.CompletionItemKind.Variable,
                  insertText: name,
                  detail: "Project theme variable",
                  range: cssRange,
                });
            }
            for (const name of projectClasses(allBlocks))
              suggestions.push({
                label: name,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: name,
                detail: "Project class",
                range,
              });
            if (language === "html") {
              for (const p of project.pages)
                suggestions.push({
                  label: pageFilename(p),
                  kind: monaco.languages.CompletionItemKind.File,
                  insertText: pageFilename(p),
                  detail: p.title,
                  range,
                });
              suggestions.push({
                label: "amagon-section",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText:
                  '<section class="${1:section}">\n  <h2>${2:Heading}</h2>\n  <p>${3:Content}</p>\n</section>',
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
                detail: "Section snippet",
              });
            }
            return { suggestions };
          },
        }),
      );
  };
  useEffect(() => {
    if (ready) attach();
  }, [ready, currentKey, visualHtml, css, files, loaded]);
  useEffect(() => {
    if (ready) applyTheme();
  }, [ready, mode, colorTheme, customThemes]);
  useEffect(() => {
    if (!ready) return;
    // Live custom-theme previews change body tokens, not saved settings.
    const observer = new MutationObserver(() => applyTheme());
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    return () => observer.disconnect();
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    const m = activeEntry.current?.model;
    m?.updateOptions({ tabSize: preferences.tabSize, insertSpaces: true });
  }, [ready, preferences.tabSize, currentKey]);
  useEffect(() => {
    const onCanvasSelection = (event: Event): void => {
      const blockId = (event as CustomEvent<{ blockId: string | null }>).detail
        ?.blockId;
      if (blockId) setTab("html");
      setCanvasSelectionTick((tick) => tick + 1);
    };
    window.addEventListener(CANVAS_SELECTION_EVENT, onCanvasSelection);
    return () =>
      window.removeEventListener(CANVAS_SELECTION_EVENT, onCanvasSelection);
  }, []);
  useEffect(() => {
    if (!ready) return;
    codeDecorations.current?.clear();
    if (tab !== "html" || !selected) return;
    const entry = activeEntry.current,
      editor = editorRef.current,
      monaco = monacoRef.current;
    if (!entry || entry.tab !== "html" || !editor || !monaco) return;
    const model = entry.model,
      version = model.getVersionId();
    if (
      sourceRanges.current?.model !== model ||
      sourceRanges.current.version !== version
    ) {
      sourceRanges.current = {
        model,
        version,
        ranges: widgetHtmlRanges(model.getValue()),
      };
    }
    const offsets = sourceRanges.current.ranges.get(selected);
    if (!offsets) return;
    const start = model.getPositionAt(offsets.start),
      end = model.getPositionAt(offsets.end);
    const range = new monaco.Range(
      start.lineNumber,
      start.column,
      end.lineNumber,
      end.column,
    );
    editor.revealLineInCenter(
      start.lineNumber,
      monaco.editor.ScrollType.Immediate,
    );
    codeDecorations.current?.set([
      {
        range,
        options: {
          isWholeLine: true,
          className: "amagon-code-selection",
          inlineClassName: "amagon-code-selection-text",
          stickiness:
            monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      },
    ]);
  }, [ready, selected, tab, visualHtml, currentKey, canvasSelectionTick]);
  useEffect(() => {
    const unregister = registerCodeFlush(flush);
    return () => {
      saveView();
      flush();
      unregister();
      for (const d of disposables.current) d.dispose();
      disposables.current = [];
      codeDecorations.current?.clear();
      sourceRanges.current = null;
      for (const entry of [...entries.current.values()]) disposeEntry(entry);
      // Keep only recent clean text snapshots. Invalid drafts stay until corrected or the project closes.
      const clean = [...drafts.entries()].filter(([, d]) => !d.invalid);
      for (const [key] of clean.slice(0, Math.max(0, clean.length - 6)))
        drafts.delete(key);
      useEditorStore.getState().setIsTypingCode(false);
    };
  }, []);
  useEffect(() => {
    if (tab !== "html" && tab !== "css" && !files?.some((f) => f.id === tab))
      setTab("html");
    for (const entry of [...entries.current.values()])
      if (
        entry.tab !== "html" &&
        entry.tab !== "css" &&
        !files?.some((f) => f.id === entry.tab)
      )
        disposeEntry(entry);
  }, [files, tab]);
  async function format(): Promise<void> {
    const entry = activeEntry.current;
    if (!entry || formatting) return;
    setFormatting(true);
    try {
      const prettier = await import("prettier/standalone"),
        plugin =
          entry.tab === "html"
            ? await import("prettier/plugins/html")
            : await import("prettier/plugins/postcss");
      if (entry.model.isDisposed()) return;
      const version = entry.model.getVersionId();
      const result = await prettier.format(entry.model.getValue(), {
        parser: entry.tab === "html" ? "html" : "css",
        plugins: [plugin],
        tabWidth: preferences.tabSize,
      });
      if (!entry.model.isDisposed() && entry.model.getVersionId() !== version) {
        setStatus("Code changed while formatting. Run Format again.");
        return;
      }
      if (!entry.model.isDisposed()) {
        // Formatting is a user edit: it must flow through the same sync/validation path.
        entry.model.pushStackElement();
        entry.model.pushEditOperations(
          [],
          [{ range: entry.model.getFullModelRange(), text: result }],
          () => null,
        );
        entry.model.pushStackElement();
        commit(entry);
      }
    } catch (error) {
      setStatus(
        `Format failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setFormatting(false);
    }
  }
  function revealCanvas(): void {
    const entry = activeEntry.current,
      pos = editorRef.current?.getPosition();
    if (!entry || !pos || entry.tab !== "html") return;
    commit(entry);
    if (entry.invalid) return;
    const id = blockIdAtOffset(
      entry.model.getValue(),
      entry.model.getOffsetAt(pos),
    );
    if (id && useEditorStore.getState().getBlockById(id)) {
      useEditorStore.getState().selectBlock(id);
      revealCanvasBlock(id);
      setStatus("Selected widget on canvas");
    } else setStatus("Place the cursor inside a widget to reveal it");
  }
  return (
    <div className="code-editor">
      <div className="code-editor-header">
        <div
          className="code-editor-tabs"
          role="tablist"
          aria-label="Code files"
        >
          {[
            { id: "html", name: pageFilename(page) },
            { id: "css", name: "styles.css" },
            ...(files ?? []).map((f) => ({ id: f.id, name: f.name })),
          ].map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={tab === f.id}
              type="button"
              className={`code-editor-tab ${tab === f.id ? "active" : ""}`}
              onClick={() => {
                flush();
                setTab(f.id);
              }}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>
      <div className="code-editor-tools">
        <button
          type="button"
          className="code-editor-action"
          disabled={!ready || formatting || dragging}
          onClick={() => void format()}
        >
          {formatting ? "Formatting…" : "Format"}
        </button>
        <button
          type="button"
          className="code-editor-action"
          disabled={!ready}
          onClick={() => {
            editorRef.current?.focus();
            void editorRef.current?.getAction("actions.find")?.run();
          }}
        >
          Find
        </button>
        <button
          type="button"
          className="code-editor-action"
          disabled={!ready}
          onClick={() => {
            editorRef.current?.focus();
            void editorRef.current
              ?.getAction("editor.action.startFindReplaceAction")
              ?.run();
          }}
        >
          Replace
        </button>
        {tab === "html" && (
          <button
            type="button"
            className="code-editor-action"
            disabled={!ready}
            onClick={revealCanvas}
          >
            Reveal on canvas
          </button>
        )}
        <button
          type="button"
          className="code-editor-action"
          aria-expanded={optionsOpen}
          onClick={() => setOptionsOpen(!optionsOpen)}
        >
          Editor options
        </button>
      </div>
      {optionsOpen && (
        <div className="code-editor-options">
          <label>
            Font size{" "}
            <select
              aria-label="Code font size"
              value={preferences.fontSize}
              onChange={(e) =>
                void useAppSettingsStore.getState().saveSettings({
                  codePreferences: {
                    ...preferences,
                    fontSize: Number(e.target.value),
                  },
                })
              }
            >
              {Array.from({ length: 15 }, (_, i) => i + 10).map((size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ))}
            </select>
          </label>
          <label>
            Indent{" "}
            <select
              aria-label="Code indentation"
              value={preferences.tabSize}
              onChange={(e) =>
                void useAppSettingsStore.getState().saveSettings({
                  codePreferences: {
                    ...preferences,
                    tabSize: Number(e.target.value),
                  },
                })
              }
            >
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
            </select>
          </label>
          {(["wordWrap", "minimap"] as const).map((key) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={preferences[key]}
                onChange={(e) =>
                  void useAppSettingsStore.getState().saveSettings({
                    codePreferences: {
                      ...preferences,
                      [key]: e.target.checked,
                    },
                  })
                }
              />
              {key === "wordWrap" ? "Word wrap" : "Minimap"}
            </label>
          ))}
        </div>
      )}
      <div className="code-editor-body">
        <Editor
          keepCurrentModel
          onMount={onMount}
          options={{
            readOnly: dragging,
            fontFamily: "var(--font-mono)",
            fontSize: preferences.fontSize,
            tabSize: preferences.tabSize,
            insertSpaces: true,
            wordWrap: preferences.wordWrap ? "on" : "off",
            minimap: { enabled: preferences.minimap },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderLineHighlight: "all",
            overviewRulerBorder: false,
          }}
        />
      </div>
      <div className="code-editor-status">
        <span role="status" title={status}>
          {status}
        </span>
        <button
          type="button"
          onClick={() => setProblemsOpen(!problemsOpen)}
          aria-expanded={problemsOpen}
        >
          Problems ({problems.length})
        </button>
      </div>
      {problemsOpen && (
        <div className="code-editor-problems" aria-label="Code problems">
          {!problems.length ? (
            <p>No problems in this file.</p>
          ) : (
            problems.map((p, i) => (
              <button
                type="button"
                key={i}
                onClick={() => {
                  editorRef.current?.setPosition({
                    lineNumber: p.startLineNumber,
                    column: p.startColumn,
                  });
                  editorRef.current?.revealLineInCenter(p.startLineNumber);
                  editorRef.current?.focus();
                }}
              >
                Line {p.startLineNumber}:{p.startColumn} · {p.message}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
