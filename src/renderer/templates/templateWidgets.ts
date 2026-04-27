import type {BlockDefinition} from '../registry/ComponentRegistry'

import {builtInPageTemplates} from './pageTemplates'
import {builtInSectionTemplates} from './sectionTemplates'
import type {PageTemplate, SectionTemplate} from './templateTypes'

const TEMPLATE_WIDGET_PREFIX = 'template:'

export type TemplateWidgetTemplate =
    | (SectionTemplate & {type: 'section'})
    | (PageTemplate & {type: 'page'; blocks: PageTemplate['page']['blocks']})

const templateWidgetTemplates: TemplateWidgetTemplate[] = [
    ...builtInSectionTemplates.map((template) => ({
        ...template,
        type: 'section' as const
    })),
    ...builtInPageTemplates.map((template) => ({
        ...template,
        type: 'page' as const,
        blocks: template.page.blocks
    }))
]

const templateWidgetTemplateMap = new Map(
    templateWidgetTemplates.map((template) => [template.id, template])
)

export function getTemplateWidgetDefinitions(): BlockDefinition[] {
    return templateWidgetTemplates.map((template) => ({
        type: `${TEMPLATE_WIDGET_PREFIX}${template.id}`,
        label: template.name,
        category: 'Templates',
        icon: template.type === 'section' ? 'lucide:layout-template' : 'lucide:file-plus',
        propsSchema: {}
    }))
}

export function isTemplateWidgetType(type: string): boolean {
    return type.startsWith(TEMPLATE_WIDGET_PREFIX)
}

export function getTemplateByWidgetType(type: string): TemplateWidgetTemplate | undefined {
    if (!isTemplateWidgetType(type)) return undefined;
    return templateWidgetTemplateMap.get(type.slice(TEMPLATE_WIDGET_PREFIX.length))
}
