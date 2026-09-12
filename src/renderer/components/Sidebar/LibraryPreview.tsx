import {memo, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {useEditorStore} from '../../store/editorStore'
import {useProjectStore} from '../../store/projectStore'
import {themeToCSS, type Block, type Page} from '../../store/types'
import {buildDefaultBlockProps, type BlockDefinition} from '../../registry/ComponentRegistry'
import {getTemplateByWidgetType} from '../../templates/templateWidgets'
import {useProjectCommandState} from '../../project/projectCommands'
import {projectFontUrl} from '../../utils/projectFontUrl'
import {widgetPreviewBlocks} from './libraryPreviewSamples'
import {libraryPreviewDocument} from './libraryPreviewDocument'
import {useLibraryPreviewCache} from './LibraryPreviewCacheProvider'

type PreviewSource =
    | {readonly kind: 'page'; readonly page: Page}
    | {readonly kind: 'widget'; readonly widget: BlockDefinition}

const EMPTY_BLOCKS: Block[] = []
const UPDATE_DELAY = 150
const WIDGET_WIDTH = 220
const PAGE_WIDTH = 1024

function PreviewContent({source, width, target}: {
    readonly source: PreviewSource
    readonly width: number
    readonly target: HTMLDivElement
}): null {
    const cache = useLibraryPreviewCache()
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
        if (source.kind === 'widget') return EMPTY_BLOCKS
        return isCurrent ? useEditorStore.getState().getFullBlocks() : source.page.blocks
    }, [source, isCurrent, editedBlocks, pageBackup, activeTabIndex])
    const themeCss = useMemo(() => themeToCSS(settings.theme, settings.themes,
        fonts.map(font => ({...font, relativePath: projectFontUrl(font.relativePath, sessionId)})),
        {componentTokens: settings.componentTokens, motionPreviewMode: 'reduced'}),
    [settings.theme, settings.themes, settings.componentTokens, fonts, sessionId])
    const input = useMemo(() => {
        const widget = source.kind === 'widget' ? source.widget : undefined
        const content = widget ? saved?.content ?? getTemplateByWidgetType(widget.type)?.blocks ?? {
            type: widget.type, props: buildDefaultBlockProps(widget),
            classes: widget.defaultClasses, styles: widget.defaultStyles, children: widget.defaultChildren
        } : blocks
        const options = {
            blocks, themeCss, customCss, kind: source.kind,
            themeMode: settings.themes?.previewMode ?? 'device',
            renderOptions: {
                framework: settings.framework, pages, folders,
                fullWidthFormControls: source.kind === 'page' ? source.page.fullWidthFormControls : true
            },
            frameworkBase: window.location.protocol === 'file:' ? 'app-framework://asset/'
                : new URL('./frameworks/', window.location.href).href
        }
        return {options, widget, saved, revision: JSON.stringify({...options, blocks: content})}
    }, [blocks, themeCss, customCss, source, saved, settings.framework, settings.themes?.previewMode, pages, folders])
    const [settled, setSettled] = useState(input)
    useEffect(() => {
        const timer = window.setTimeout(() => setSettled(input), UPDATE_DELAY)
        return () => window.clearTimeout(timer)
    }, [input])
    const viewport = source.kind === 'page' || (source.kind === 'widget'
        && (source.widget.type.startsWith('template:') || source.widget.type.startsWith('user:')))
        ? PAGE_WIDTH : WIDGET_WIDTH
    const title = source.kind === 'page' ? source.page.title : source.widget.label
    const key = source.kind === 'page' ? `page:${source.page.id}` : `widget:${source.widget.type}`
    const sandbox = settled.options.renderOptions.framework === 'tailwind' ? 'allow-scripts' : ''
    useLayoutEffect(() => cache.show(key, target, {
        title: `${title} preview`, width, viewport, sandbox, revision: settled.revision,
        render: () => libraryPreviewDocument({...settled.options,
            blocks: settled.widget ? widgetPreviewBlocks(settled.widget, settled.saved) : settled.options.blocks})
    }), [cache, key, target, title, width, viewport, sandbox, settled])
    return null
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
        {visible && width > 0 && ref.current && <PreviewContent source={source} width={width} target={ref.current}/>}
    </div>
})
