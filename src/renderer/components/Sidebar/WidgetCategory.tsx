import {useDraggable} from '@dnd-kit/core'
import type {MouseEvent} from 'react'
import {useEditorStore} from '../../store/editorStore'
import {useAppSettingsStore} from '../../store/appSettingsStore'
import type {BlockDefinition} from '../../registry/ComponentRegistry'
import BlockIcon from '../BlockIcon/BlockIcon'
import {LibraryPreview} from './LibraryPreview'

function WidgetItem({widget, onContextMenu}: {
    widget: BlockDefinition;
    onContextMenu?: (e: MouseEvent, widget: BlockDefinition) => void
}): JSX.Element {
    const mode = useAppSettingsStore(s => s.libraryPreviewMode);
    const isTypingCode = useEditorStore((s) => s.isTypingCode);
    const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({
        id: `widget:${widget.type}`,
        disabled: isTypingCode,
        data: {widgetType: widget.type, label: widget.label, icon: widget.icon}
    });

    const iconString = typeof widget.icon === 'string' ? widget.icon.trim() : '';
    const isBadIconGlyph = (s: string): boolean => {
        if (!s) return true;
        if (s.startsWith('lucide:')) return false;
        if (/^[\u2500-\u257F\u2580-\u259F\u25A0-\u25FF]$/.test(s)) return true;
        return (
            s === '☐' ||
            s === '☑' ||
            s === '▢' ||
            s === '▣' ||
            s === '▭' ||
            s === '🔲' ||
            s === '🔳'
        )
    };

    const isTemplateWidget = widget.type.startsWith('template:');
    const shouldUseExplicitIcon = widget.type.startsWith('user:') || isTemplateWidget;

    const style = transform ? {} : undefined;

    return (
        <div
            ref={setNodeRef}
            className={`widget-item ${widget.type.startsWith('user:') ? 'custom' : ''} ${isDragging ? 'dragging' : ''}`}
            style={style}
            title={widget.label}
            aria-label={widget.label}
            {...attributes}
            {...listeners}
            onContextMenu={(e) => onContextMenu?.(e, widget)}
        >
            {mode === 'live' ? <LibraryPreview kind="widget" widget={widget}/> : <div className="widget-icon">
                {shouldUseExplicitIcon ? (
                    iconString && iconString.startsWith('lucide:') ? (
                        <BlockIcon name={iconString.replace(/^lucide:/, '')}/>
                    ) : iconString && !isBadIconGlyph(iconString) ? (
                        iconString
                    ) : (
                        <BlockIcon name={isTemplateWidget ? 'layout-template' : 'user-block'}/>
                    )
                ) : (
                    <BlockIcon name={widget.type}/>
                )}
            </div>}
            <span>{widget.label}</span>
        </div>
    )
}

export function WidgetCategory({
                            title,
                            widgets,
                            onWidgetContextMenu
                        }: {
    title: string
    widgets: BlockDefinition[]
    onWidgetContextMenu?: (e: MouseEvent, widget: BlockDefinition) => void
}): JSX.Element {
    if (widgets.length === 0) return <></>;

    return (
        <div className="widget-category">
            <div className="category-title">{title}</div>
            <div className="widget-grid">
                {widgets.map((w) => (
                    <WidgetItem key={w.type} widget={w} onContextMenu={onWidgetContextMenu}/>
                ))}
            </div>
        </div>
    )
}
