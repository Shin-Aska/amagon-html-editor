import {beforeAll, describe, expect, it} from 'vitest'
import {buildDefaultBlockProps, componentRegistry} from '../ComponentRegistry'
import {registerBlocks} from '../registerBlocks'
import {getWidgetDesignPresets, resetWidgetStyles, widgetDesignProfiles, widgetPresetStyles} from '../widgetDesigns'
import {blockToHtml} from '../../utils/blockToHtml'
import type {Block} from '../../store/types'

beforeAll(() => registerBlocks());

describe('widget customization coverage', () => {
    it('assigns an explicit design profile to every registered widget', () => {
        expect(Object.keys(widgetDesignProfiles).sort()).toEqual(componentRegistry.getAll().map(def => def.type).sort())
    });

    for (const framework of ['bootstrap-5', 'tailwind', 'vanilla'] as const) {
        it(`${framework}: every widget exports its selected preset and custom appearance`, () => {
            const failures: string[] = [];
            for (const definition of componentRegistry.getAll()) {
                for (const preset of getWidgetDesignPresets(definition.type)) {
                    const block: Block = {id: 'design-test', type: definition.type, props: buildDefaultBlockProps(definition),
                        styles: {...preset.styles, opacity: '0.85'}, classes: definition.defaultClasses || [], children: []};
                    for (const includeDataAttributes of [false, true]) {
                    const document = new DOMParser().parseFromString(blockToHtml([block], {framework, includeDataAttributes}), 'text/html');
                    for (const [key, value] of Object.entries(block.styles)) {
                        const cssKey = key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);
                        const hasStyle = [...document.querySelectorAll('[style]')].some(element =>
                            element.getAttribute('style')?.includes(`${cssKey}: ${value}`));
                        if (!hasStyle) failures.push(`${block.type}/${preset.id}/${includeDataAttributes ? 'preview' : 'export'}: missing ${key}`)
                    }
                    }
                }
            }
            expect(failures).toEqual([])
        }, 30_000)
    }

    it('lets explicit spacing and theme colors override Bootstrap utilities without deleting classes', () => {
        const block: Block = {id: 'section', type: 'section', props: {}, children: [], classes: ['py-5', 'bg-light'],
            styles: {paddingTop: '1rem', backgroundColor: 'var(--theme-primary)'}};
        const html = blockToHtml([block], {framework: 'bootstrap-5'});
        const document = new DOMParser().parseFromString(html, 'text/html');
        const section = document.querySelector('section')!;
        expect(section.style.getPropertyPriority('padding-top')).toBe('important');
        expect(section.getAttribute('style')).toContain('background-color: var(--theme-primary) !important');
        expect(section.classList.contains('py-5')).toBe(true);
        expect(block.styles.paddingTop).toBe('1rem')
    });

    for (const framework of ['bootstrap-5', 'vanilla'] as const) {
        it(`${framework}: every widget retains explicit width priority over a width utility`, () => {
            const failures: string[] = [];
            for (const definition of componentRegistry.getAll()) {
                const block: Block = {id: 'width-test', type: definition.type, props: buildDefaultBlockProps(definition),
                    styles: {width: '101px'}, classes: [...(definition.defaultClasses || []), 'w-100'], children: []};
                const document = new DOMParser().parseFromString(blockToHtml([block], {framework}), 'text/html');
                if (![...document.querySelectorAll<HTMLElement>('[style]')].some(element => element.style.width === '101px'
                    && element.style.getPropertyPriority('width') === 'important')) failures.push(definition.type)
            }
            expect(failures).toEqual([])
        }, 30_000)
    }

    it('changes only preset-owned styles and resets style overrides without changing authored content', () => {
        const preset = getWidgetDesignPresets('button')[1];
        const block: Block = {id: 'button', type: 'button', props: {text: 'Buy now', href: '/checkout'}, styles: {width: '100%', color: 'red'},
            classes: ['my-button'], events: {onclick: 'track()'}, children: []};
        const original = structuredClone(block);
        expect({...block.styles, ...widgetPresetStyles(block.type, preset)}).toMatchObject({width: '100%', color: 'red'});
        expect(resetWidgetStyles(block)).toEqual({width: undefined, color: undefined});
        expect(block).toEqual(original)
    });

    it('lets design overrides take precedence over a container background property', () => {
        const block: Block = {id: 'container', type: 'container', props: {bgColor: 'red', bgImage: 'old.png'},
            styles: {backgroundColor: 'var(--theme-primary)', backgroundImage: 'linear-gradient(red, blue)'}, classes: [], children: []};
        const html = blockToHtml([block]);
        expect(html).toContain('background-color: var(--theme-primary)');
        expect(html).toContain('background-image: linear-gradient(red, blue)');
        expect(html).not.toContain("url('old.png')");
        expect(block.props.bgImage).toBe('old.png')
    })
});
