import {buildDefaultBlockProps, type BlockDefinition} from '../../registry/ComponentRegistry'
import {createBlock, type Block, type UserBlock} from '../../store/types'
import {getTemplateByWidgetType} from '../../templates/templateWidgets'

function fromDefinition(definition: Pick<Block, 'type'> & Partial<Block>): Block {
    return createBlock(definition.type, {
        ...definition,
        children: definition.children?.map(fromDefinition) ?? []
    })
}

const cell = (): Block => createBlock('container', {
    styles: {border: '1px solid var(--theme-border)', background: 'var(--theme-surface)', minHeight: '18px', flex: '1'}
})

export function widgetPreviewBlocks(widget: BlockDefinition, saved?: UserBlock): Block[] {
    if (saved) return [saved.content]
    const template = getTemplateByWidgetType(widget.type)
    if (template) return template.blocks

    const block = createBlock(widget.type, {
        props: buildDefaultBlockProps(widget),
        classes: [...(widget.defaultClasses ?? [])],
        styles: {...widget.defaultStyles},
        children: widget.defaultChildren?.map(fromDefinition) ?? []
    })
    switch (widget.type) {
        case 'container':
            block.classes = []
            block.styles = {border: '1px dashed var(--theme-border)', minHeight: '70px', padding: '12px'}
            break
        case 'row':
        case 'column':
            block.styles = {display: 'flex', flexDirection: widget.type === 'row' ? 'row' : 'column', gap: '6px', margin: '0'}
            block.children = [cell(), cell(), cell()]
            break
        case 'spacer':
            block.props.height = '36px'
            return [createBlock('container', {styles: {borderBlock: '1px dashed var(--theme-border)', background: 'var(--theme-surface)'}, children: [block]})]
        case 'section':
            block.classes = []
            block.styles = {padding: '8px', background: 'var(--theme-surface)'}
            block.children = [
                createBlock('heading', {props: {text: 'Section title', level: 3}, styles: {margin: '0 0 6px', fontSize: '18px', fontFamily: 'var(--theme-font-family)'}}),
                createBlock('paragraph', {props: {text: 'A section of content.'}, styles: {margin: '0', fontSize: '14px'}})
            ]
            break
        case 'heading':
            block.props = {...block.props, text: 'Hello world'}
            block.styles = {...block.styles, margin: '0'}
            break
        case 'code-block':
            block.classes = block.classes.filter(className => className !== 'p-3')
            block.props = {...block.props, code: 'hello()', showLineNumbers: false, copyButton: false, filename: ''}
            break
        case 'list':
            block.styles = {...block.styles, margin: '0', fontSize: '14px', lineHeight: '1.5'}
            break
        case 'blockquote':
            block.props = {...block.props, text: 'Good design builds trust.', footer: '', decorative: 'border-left'}
            block.styles = {...block.styles, margin: '0', fontSize: '18px'}
            break
        case 'paragraph':
            block.props = {...block.props, text: 'This is a sample paragraph with a few lines of text to show how it looks.'}
            block.styles = {...block.styles, margin: '0'}
            break
    }
    return [block]
}
