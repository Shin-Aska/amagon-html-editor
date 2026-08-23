import {describe, expect, it} from 'vitest'
import {blockToHtml, pageToHtml} from '../blockToHtml'
import type {Block} from '../../store/types'
import {createBlock} from '../../store/types'

const hoverEffect: Block['hoverEffect'] = {preset: 'lift'}

function parseRootElement(html: string): Element {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) throw new Error('No root element found in rendered HTML');
    return root
}

function expectRootHover(root: Element, preset = 'lift'): void {
    expect(Array.from(root.classList)).toContain(`amagon-hover-${preset}`);
    expect(Array.from(root.classList)).toContain('amagon-hover');

    for (const child of root.querySelectorAll('*')) {
        const childClasses = Array.from(child.classList).filter((cls) => cls.includes('amagon-hover'));
        expect(childClasses).toEqual([])
    }
}

function expectNoHover(html: string): void {
    expect(html).not.toContain('amagon-hover')
}

describe('blockToHtml hover effect rendering', () => {
    it('applies hover classes to a button root', () => {
        const root = parseRootElement(blockToHtml([
            createBlock('button', {
                props: {text: 'Go'},
                hoverEffect
            })
        ]));

        expect(root.tagName.toLowerCase()).toBe('button');
        expectRootHover(root)
    });

    it('applies hover classes to a card root', () => {
        const root = parseRootElement(blockToHtml([
            createBlock('card', {
                props: {title: 'Card'},
                hoverEffect: {preset: 'shadow'}
            })
        ]));

        expect(root.tagName.toLowerCase()).toBe('div');
        expectRootHover(root, 'shadow')
    });

    it('applies hover classes to image roots and caption figures', () => {
        const plain = parseRootElement(blockToHtml([
            createBlock('image', {
                props: {src: 'a.jpg', alt: 'A'},
                hoverEffect: {preset: 'grow'}
            })
        ]));
        const captioned = parseRootElement(blockToHtml([
            createBlock('image', {
                props: {src: 'b.jpg', alt: 'B', caption: 'Photo'},
                hoverEffect: {preset: 'glow'}
            })
        ]));

        expect(plain.tagName.toLowerCase()).toBe('img');
        expectRootHover(plain, 'grow');
        expect(captioned.tagName.toLowerCase()).toBe('figure');
        expectRootHover(captioned, 'glow')
    });

    it('does not apply hover classes to excluded controls', () => {
        const blocks: Block[] = [
            createBlock('heading', {props: {text: 'Title'}, hoverEffect}),
            createBlock('input', {props: {label: 'Name'}, hoverEffect}),
            createBlock('checkbox', {props: {label: 'Agree'}, hoverEffect}),
            createBlock('breadcrumb', {props: {items: [{label: 'Home', href: '#', active: true}]}, hoverEffect}),
            createBlock('pagination', {props: {pages: 3}, hoverEffect})
        ];

        expectNoHover(blockToHtml(blocks))
    });

    it('omits hover classes when includeHoverEffects is false', () => {
        const html = blockToHtml([
            createBlock('button', {
                props: {text: 'Go'},
                hoverEffect
            })
        ], {includeHoverEffects: false});

        expectNoHover(html)
    });

    it('includes hover effect CSS in full page HTML', () => {
        const html = pageToHtml([
            createBlock('button', {
                props: {text: 'Go'},
                hoverEffect
            })
        ], {title: 'Hover'});

        expect(html).toContain('amagon-hover-effects');
        expect(html).toContain('.amagon-hover-lift:hover')
    })
});
