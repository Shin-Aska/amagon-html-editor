import {memo, useEffect, useMemo, useRef, useState} from 'react'
import {useEditorStore} from '../../store/editorStore'
import {useProjectStore} from '../../store/projectStore'
import {themeToCSS, type Block, type Page} from '../../store/types'
import type {BlockDefinition} from '../../registry/ComponentRegistry'
import {useProjectCommandState} from '../../project/projectCommands'
import {projectFontUrl} from '../../utils/projectFontUrl'
import {widgetPreviewBlocks} from './libraryPreviewSamples'
import {libraryPreviewDocument} from './libraryPreviewDocument'

type PreviewSource =
    | {readonly kind: 'page'; readonly page: Page}
    | {readonly kind: 'widget'; readonly widget: BlockDefinition}

const EMPTY_BLOCKS: Block[] = []
const UPDATE_DELAY = 150
const WIDGET_WIDTH = 220
const PAGE_WIDTH = 1024

function PreviewContent({source, width}: {readonly source: PreviewSource; readonly width: number}): JSX.Element {
    const settings = useProjectStore(s => s.settings)
    const fonts = useProjectStore(s => s.fonts)
    const pages = useProjectStore(s => s.pages)
    const folders = useProjectStore(s => s.folders)
    const currentPageId = useProjectStore(s => s.currentPageId)
    const saved = useProjectStore(s => source.kind === 'widget'
        ? s.userBlocks.find(block => `user:${block.id}` === source.widget.type) : undefined)
    const isCurrent = source.kind === 'page' && source.page.id === currentPageId
    const editedBlocks = useEditorStore(s => isCurrent ? s.blocks : EMPTY_BLOCKS)
    const pageBackup = useEditorStore(s => isCurrent ? s.pageBlocksBackup : null)
    const activeTabIndex = useEditorStore(s => isCurrent ? s.activeTabIndex : null)
    const customCss = useEditorStore(s => s.customCss)
    const sessionId = useProjectCommandState().session?.sessionId
    const blocks = useMemo(() => {
        if (source.kind === 'widget') return widgetPreviewBlocks(source.widget, saved)
        return isCurrent ? useEditorStore.getState().getFullBlocks() : source.page.blocks
    }, [source, saved, isCurrent, editedBlocks, pageBackup, activeTabIndex])
    const themeCss = useMemo(() => themeToCSS(settings.theme, settings.themes,
        fonts.map(font => ({...font, relativePath: projectFontUrl(font.relativePath, sessionId)})),
        {componentTokens: settings.componentTokens, motionPreviewMode: 'reduced'}),
    [settings.theme, settings.themes, settings.componentTokens, fonts, sessionId])
    const input = useMemo(() => ({
        blocks, themeCss, customCss, kind: source.kind,
        themeMode: settings.themes?.previewMode ?? 'device',
        renderOptions: {
            framework: settings.framework, pages, folders,
            fullWidthFormControls: source.kind === 'page' ? source.page.fullWidthFormControls : true
        },
        frameworkBase: window.location.protocol === 'file:' ? 'app-framework://asset/'
            : new URL('./frameworks/', window.location.href).href
    }), [blocks, themeCss, customCss, source, settings.framework, settings.themes?.previewMode, pages, folders])
    const [settled, setSettled] = useState(input)
    useEffect(() => {
        const timer = window.setTimeout(() => setSettled(input), UPDATE_DELAY)
        return () => window.clearTimeout(timer)
    }, [input])
    const srcDoc = useMemo(() => libraryPreviewDocument(settled), [settled])
    const viewport = source.kind === 'page' || (source.kind === 'widget'
        && (source.widget.type.startsWith('template:') || source.widget.type.startsWith('user:')))
        ? PAGE_WIDTH : WIDGET_WIDTH
    const title = source.kind === 'page' ? source.page.title : source.widget.label
    return <iframe className="library-preview-frame" title={`${title} preview`}
        srcDoc={srcDoc} sandbox={settings.framework === 'tailwind' ? 'allow-scripts' : ''}
        tabIndex={-1} aria-hidden="true" referrerPolicy="no-referrer"
        style={{width: viewport, height: viewport / 2, transform: `scale(${width / viewport})`}}/>
}

export const LibraryPreview = memo(function LibraryPreview(source: PreviewSource): JSX.Element {
    const ref = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)
    const [width, setWidth] = useState(0)
    useEffect(() => {
        const target = ref.current
        if (!target || typeof ResizeObserver === 'undefined' || typeof IntersectionObserver === 'undefined') return
        const resize = (): void => setWidth(target.getBoundingClientRect().width)
        resize()
        const resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(target)
        const intersectionObserver = new IntersectionObserver(entries => {
            setVisible(entries.some(entry => entry.isIntersecting))
        })
        intersectionObserver.observe(target)
        return () => {
            resizeObserver.disconnect()
            intersectionObserver.disconnect()
        }
    }, [])
    return <div className="library-preview" ref={ref} aria-hidden="true">
        {visible && width > 0 && <PreviewContent source={source} width={width}/>}
    </div>
})
