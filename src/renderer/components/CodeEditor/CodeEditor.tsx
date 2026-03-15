import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type OnChange, type OnMount } from '@monaco-editor/react'
import './CodeEditor.css'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { pageToHtml } from '../../utils/blockToHtml'
import { htmlToBlocks, type HtmlDiagnostic } from '../../utils/htmlToBlocks'
import type * as MonacoType from 'monaco-editor'

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

;(globalThis as unknown as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  }
}

type ActiveTab = 'html' | 'css'

function CodeEditor(): JSX.Element {
  const blocks = useEditorStore((s) => s.blocks)
  const setPageBlocks = useEditorStore((s) => s.setPageBlocks)
  const isDragging = useEditorStore((s) => s.isDragging)
  const setIsTypingCode = useEditorStore((s) => s.setIsTypingCode)
  const customCss = useEditorStore((s) => s.customCss)
  const setCustomCss = useEditorStore((s) => s.setCustomCss)
  const framework = useProjectStore((s) => s.settings.framework)

  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof MonacoType | null>(null)
  const htmlModelRef = useRef<MonacoType.editor.ITextModel | null>(null)
  const cssModelRef = useRef<MonacoType.editor.ITextModel | null>(null)

  const [activeTab, setActiveTab] = useState<ActiveTab>('html')

  const applyingVisualUpdateRef = useRef(false)
  const lastUserHtmlEditAtRef = useRef(0)
  const lastUserCssEditAtRef = useRef(0)
  const lastCommitFromCodeRef = useRef(false)
  const htmlParseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cssDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const visualHtml = useMemo(() => {
    return pageToHtml(blocks, { framework, customCss })
  }, [blocks, customCss, framework])

  const getHtmlModel = (): MonacoType.editor.ITextModel | null => {
    return htmlModelRef.current
  }

  const getCssModel = (): MonacoType.editor.ITextModel | null => {
    return cssModelRef.current
  }

  const applyTextToModel = (model: MonacoType.editor.ITextModel, nextText: string): void => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    const prevText = model.getValue()
    if (prevText === nextText) return

    if (editor.getModel() !== model) {
      model.setValue(nextText)
      return
    }

    let start = 0
    const prevLen = prevText.length
    const nextLen = nextText.length
    while (start < prevLen && start < nextLen && prevText.charCodeAt(start) === nextText.charCodeAt(start)) start++

    let endPrev = prevLen
    let endNext = nextLen
    while (
      endPrev > start &&
      endNext > start &&
      prevText.charCodeAt(endPrev - 1) === nextText.charCodeAt(endNext - 1)
    ) {
      endPrev--
      endNext--
    }

    const startPos = model.getPositionAt(start)
    const endPrevPos = model.getPositionAt(endPrev)
    const range = new monaco.Range(startPos.lineNumber, startPos.column, endPrevPos.lineNumber, endPrevPos.column)

    const inserted = nextText.slice(start, endNext)
    const removedLen = endPrev - start
    const delta = inserted.length - removedLen

    const oldSelections = editor.getSelections() ?? []

    const shiftOffset = (offset: number): number => {
      if (offset <= start) return offset
      if (offset >= endPrev) return Math.max(0, offset + delta)
      return start + inserted.length
    }

    const newSelections = oldSelections.map((sel) => {
      const startOffset = model.getOffsetAt({ lineNumber: sel.selectionStartLineNumber, column: sel.selectionStartColumn })
      const posOffset = model.getOffsetAt({ lineNumber: sel.positionLineNumber, column: sel.positionColumn })

      const nextStart = model.getPositionAt(shiftOffset(startOffset))
      const nextPos = model.getPositionAt(shiftOffset(posOffset))
      return new monaco.Selection(nextStart.lineNumber, nextStart.column, nextPos.lineNumber, nextPos.column)
    })

    applyingVisualUpdateRef.current = true
    model.pushEditOperations(oldSelections, [{ range, text: inserted }], () => newSelections)
    applyingVisualUpdateRef.current = false
  }

  const setHtmlMarkers = (diagnostics: HtmlDiagnostic[]): void => {
    const monaco = monacoRef.current
    const model = getHtmlModel()
    if (!monaco || !model) return

    const markers: MonacoType.editor.IMarkerData[] = diagnostics.map((d) => ({
      severity: d.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
      message: d.message,
      startLineNumber: d.startLineNumber,
      startColumn: d.startColumn,
      endLineNumber: d.endLineNumber,
      endColumn: Math.max(d.endColumn, d.startColumn + 1)
    }))

    monaco.editor.setModelMarkers(model, 'html-editor', markers)
  }

  const extractCustomCssFromHtml = (html: string): string | null => {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const style = doc.querySelector('style#html-editor-custom-css') ?? doc.querySelector('head style')
      return style?.textContent ?? ''
    } catch {
      return null
    }
  }

  const formatHtml = async (): Promise<void> => {
    const model = getHtmlModel()
    if (!model) return

    try {
      const prettierModule = await import('prettier/standalone')
      const htmlPluginModule = await import('prettier/plugins/html')
      const prettier = prettierModule as unknown as { format: (input: string, opts: Record<string, unknown>) => Promise<string> }
      const htmlPlugin = (htmlPluginModule as unknown as { default?: unknown }).default ?? htmlPluginModule

      const formatted = await prettier.format(model.getValue(), {
        parser: 'html',
        plugins: [htmlPlugin]
      })

      applyTextToModel(model, formatted)
    } catch (err) {
      setHtmlMarkers([
        {
          message: `Format failed: ${String(err)}`,
          severity: 'error',
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1
        }
      ])
    }
  }

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    const htmlUri = monaco.Uri.parse('inmemory://model/index.html')
    const cssUri = monaco.Uri.parse('inmemory://model/styles.css')

    const htmlModel = monaco.editor.createModel('', 'html', htmlUri)
    const cssModel = monaco.editor.createModel('', 'css', cssUri)
    htmlModelRef.current = htmlModel
    cssModelRef.current = cssModel

    editor.setModel(htmlModel)

    editor.updateOptions({
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      minimap: { enabled: false },
      wordWrap: 'on',
      tabSize: 2,
      insertSpaces: true,
      automaticLayout: true
    })

    applyTextToModel(htmlModel, visualHtml)
    cssModel.setValue(customCss)
  }

  const onChange: OnChange = (value) => {
    if (applyingVisualUpdateRef.current) return
    const editor = editorRef.current
    const currentModel = editor?.getModel()
    if (!currentModel) return

    const nextValue = value ?? ''
    setIsTypingCode(true)

    if (currentModel === getHtmlModel()) {
      lastUserHtmlEditAtRef.current = Date.now()

      if (htmlParseTimerRef.current) {
        clearTimeout(htmlParseTimerRef.current)
        htmlParseTimerRef.current = null
      }

      htmlParseTimerRef.current = setTimeout(() => {
        const result = htmlToBlocks(nextValue)
        setHtmlMarkers(result.diagnostics)

        const hasErrors = result.diagnostics.some((d) => d.severity === 'error')
        if (hasErrors) {
          setIsTypingCode(false)
          return
        }

        lastCommitFromCodeRef.current = true
        setPageBlocks(result.blocks)

        const extractedCss = extractCustomCssFromHtml(nextValue)
        if (extractedCss !== null && extractedCss !== customCss) {
          setCustomCss(extractedCss)
        }

        setIsTypingCode(false)
      }, 800)
      return
    }

    if (currentModel === getCssModel()) {
      lastUserCssEditAtRef.current = Date.now()

      if (cssDebounceTimerRef.current) {
        clearTimeout(cssDebounceTimerRef.current)
        cssDebounceTimerRef.current = null
      }

      cssDebounceTimerRef.current = setTimeout(() => {
        setCustomCss(nextValue)
        setIsTypingCode(false)
      }, 500)
    }
  }

  useEffect(() => {
    const htmlModel = getHtmlModel()
    if (!htmlModel) return
    if (isDragging) return

    if (lastCommitFromCodeRef.current) {
      lastCommitFromCodeRef.current = false
      return
    }

    const msSinceType = Date.now() - lastUserHtmlEditAtRef.current
    if (msSinceType < 1200) return

    applyTextToModel(htmlModel, visualHtml)
  }, [isDragging, visualHtml])

  useEffect(() => {
    const cssModel = getCssModel()
    if (!cssModel) return

    const msSinceType = Date.now() - lastUserCssEditAtRef.current
    if (msSinceType < 1200) return

    if (cssModel.getValue() !== customCss) {
      cssModel.setValue(customCss)
    }
  }, [customCss])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const nextModel = activeTab === 'css' ? getCssModel() : getHtmlModel()
    if (!nextModel) return
    if (editor.getModel() === nextModel) return
    editor.setModel(nextModel)
  }, [activeTab])

  useEffect(() => {
    return () => {
      if (htmlParseTimerRef.current) {
        clearTimeout(htmlParseTimerRef.current)
        htmlParseTimerRef.current = null
      }
      if (cssDebounceTimerRef.current) {
        clearTimeout(cssDebounceTimerRef.current)
        cssDebounceTimerRef.current = null
      }

      const htmlModel = getHtmlModel()
      const cssModel = getCssModel()
      htmlModelRef.current = null
      cssModelRef.current = null
      htmlModel?.dispose()
      cssModel?.dispose()
      setIsTypingCode(false)
    }
  }, [setIsTypingCode])

  return (
    <div className="code-editor">
      <div className="code-editor-header">
        <span className={`code-editor-tab ${activeTab === 'html' ? 'active' : ''}`} onClick={() => setActiveTab('html')}>
          index.html
        </span>
        <span className={`code-editor-tab ${activeTab === 'css' ? 'active' : ''}`} onClick={() => setActiveTab('css')}>
          styles.css
        </span>
        <div className="code-editor-header-spacer" />
        {activeTab === 'html' && (
          <button type="button" className="code-editor-action" onClick={() => void formatHtml()}>
            Format
          </button>
        )}
      </div>
      <div className="code-editor-body">
        <Editor
          defaultLanguage={activeTab === 'css' ? 'css' : 'html'}
          theme="vs-dark"
          onMount={onMount}
          onChange={onChange}
          options={{
            readOnly: isDragging,
            scrollBeyondLastLine: false,
            renderLineHighlight: 'all',
            overviewRulerBorder: false
          }}
        />
      </div>
    </div>
  )
}

export default CodeEditor
