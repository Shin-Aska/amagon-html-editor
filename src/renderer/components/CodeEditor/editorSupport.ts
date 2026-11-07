import { parse, parseFragment, type DefaultTreeAdapterMap } from "parse5";
import type * as Monaco from "monaco-editor";
import type { AppPalette, AppMode } from "../../themes/appThemes";
import { themeToCSS } from "../../store/types";
import type { Block, Page, ProjectTheme } from "../../store/types";
export function monacoAppTheme(
  mode: AppMode,
  p: AppPalette,
): Monaco.editor.IStandaloneThemeData {
  return {
    base: mode === "dark" ? "vs-dark" : "vs",
    inherit: true,
    rules: [
      { token: "tag", foreground: p.syntaxTag.slice(1) },
      { token: "delimiter.html", foreground: p.syntaxTag.slice(1) },
      { token: "attribute.name", foreground: p.syntaxKeyword.slice(1) },
      { token: "attribute.value", foreground: p.syntaxString.slice(1) },
      { token: "string", foreground: p.syntaxString.slice(1) },
      { token: "comment", foreground: p.syntaxComment.slice(1) },
      { token: "keyword", foreground: p.syntaxKeyword.slice(1) },
      { token: "attribute.value.css", foreground: p.syntaxString.slice(1) },
    ],
    colors: {
      "editor.background": p.bgPrimary,
      "editor.foreground": p.textPrimary,
      "editorLineNumber.foreground": p.textMuted,
      "editorLineNumber.activeForeground": p.textPrimary,
      "editorCursor.foreground": p.accent,
      "editor.selectionBackground": p.selection,
      "editor.inactiveSelectionBackground": `${p.selection}88`,
      "editor.lineHighlightBackground": p.bgSecondary,
      "editorIndentGuide.background1": p.border,
      "editorIndentGuide.activeBackground1": p.accent,
      "editorError.foreground": p.danger,
      "editorWarning.foreground": p.warning,
      "editorWidget.background": p.bgSurface,
      "editorWidget.border": p.border,
      "editorSuggestWidget.background": p.bgSecondary,
      "editorSuggestWidget.foreground": p.textPrimary,
      "editorSuggestWidget.selectedBackground": p.selection,
      "editorSuggestWidget.border": p.border,
      "input.background": p.bgSecondary,
      "input.foreground": p.textPrimary,
      "input.border": p.border,
      focusBorder: p.accent,
      "list.hoverBackground": p.bgHover,
      "scrollbarSlider.background": `${p.border}99`,
    },
  };
}
export function projectClasses(blocks: Block[]): string[] {
  const names = new Set<string>();
  const walk = (items: Block[]) => {
    for (const b of items) {
      for (const cls of b.classes) names.add(cls);
      walk(b.children);
    }
  };
  walk(blocks);
  return [...names].sort();
}
export function projectThemeVariableNames(theme: ProjectTheme): string[] {
  return [
    ...new Set(themeToCSS(theme).match(/--theme-[\w-]+(?=\s*:)/g) ?? []),
  ].sort();
}
export function pageFilename(page: Pick<Page, "slug"> | null): string {
  return `${page?.slug || "index"}.html`;
}
/** Map a caret to its enclosing editor-metadata element, including nested widgets. */
export function blockIdAtOffset(html: string, offset: number): string | null {
  let result: string | null = null;
  let smallest = Infinity;
  for (const [id, range] of widgetHtmlRanges(html)) {
    if (
      range.start <= offset &&
      offset < range.end &&
      range.end - range.start < smallest
    ) {
      result = id;
      smallest = range.end - range.start;
    }
  }
  return result;
}
export interface WidgetHtmlRange {
  start: number;
  end: number;
}
const SOURCE_START = "amagon-source-start:";
const SOURCE_END = "amagon-source-end:";

/** Editor-only identities preserve export markup and cover widgets with multiple root elements. */
export function decorateWidgetHtml(html: string, block: Block): string {
  const fragment = parseFragment(html, { sourceCodeLocationInfo: true });
  const elements = fragment.childNodes.filter((node) => "attrs" in node);
  const root = elements[0];
  let decorated = html;
  if (root && !root.attrs.some((attr) => attr.name === "data-block-id")) {
    const offset = root.sourceCodeLocation?.startTag?.startOffset;
    if (offset !== undefined) {
      const tag = /^<[\w:-]+/.exec(html.slice(offset));
      if (tag) {
        const at = offset + tag[0].length;
        const escaped = block.id
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        decorated = `${html.slice(0, at)} data-block-id="${escaped}"${html.slice(at)}`;
      }
    }
  }
  const hasText = fragment.childNodes.some(
    (node) => node.nodeName === "#text" && "value" in node && node.value.trim(),
  );
  if (elements.length === 1 && !hasText) return decorated;
  const id = encodeURIComponent(block.id).replace(/-/g, "%2D");
  return `<!--${SOURCE_START}${id}-->${decorated}<!--${SOURCE_END}${id}-->`;
}

/** Keep offsets from the original source, including nesting, void tags and multipart widgets. */
export function widgetHtmlRanges(html: string): Map<string, WidgetHtmlRange> {
  const ranges = new Map<string, WidgetHtmlRange>();
  const boundaries: {
    id: string;
    start: boolean;
    offset: number;
    after: number;
  }[] = [];
  const visit = (node: DefaultTreeAdapterMap["node"]): void => {
    if ("attrs" in node) {
      const id = node.attrs.find(
        (attr) => attr.name === "data-block-id",
      )?.value;
      const location = node.sourceCodeLocation;
      if (id && location && !ranges.has(id))
        ranges.set(id, {
          start: location.startOffset,
          end: location.endOffset,
        });
      if ("content" in node) visit(node.content);
    }
    if (
      node.nodeName === "#comment" &&
      "data" in node &&
      node.sourceCodeLocation
    ) {
      const value = node.data.trim();
      const prefix = value.startsWith(SOURCE_START)
        ? SOURCE_START
        : value.startsWith(SOURCE_END)
          ? SOURCE_END
          : null;
      if (prefix) {
        try {
          boundaries.push({
            id: decodeURIComponent(value.slice(prefix.length)),
            start: prefix === SOURCE_START,
            offset: node.sourceCodeLocation.startOffset,
            after: node.sourceCodeLocation.endOffset,
          });
        } catch {
          /* An edited, malformed source marker must not interrupt selection. */ return;
        }
      }
    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  const starts = new Map<string, number[]>();
  for (const boundary of boundaries.sort((a, b) => a.offset - b.offset)) {
    if (boundary.start)
      starts.set(boundary.id, [
        ...(starts.get(boundary.id) ?? []),
        boundary.after,
      ]);
    else {
      let start = starts.get(boundary.id)?.pop();
      let end = boundary.offset;
      if (start === undefined) continue;
      while (start < end && /\s/.test(html[start])) start++;
      while (end > start && /\s/.test(html[end - 1])) end--;
      ranges.set(boundary.id, { start, end });
    }
  }
  return ranges;
}
