import {describe, expect, it} from 'vitest'
import {blockToHtml, pageToHtml} from '../blockToHtml'
import {htmlToBlocks} from '../htmlToBlocks'
import type {Block} from '../../store/types'
import {createBlock} from '../../store/types'

const hoverEffect: Block['hoverEffect'] = {preset: 'glow'}

describe('hover effect round-trip: blocks -> HTML -> blocks', () => {
    it('preserves hover effect on a button', () => {
        const original: Block[] = [
            createBlock('button', {
                props: {text: 'Go'},
                hoverEffect
            })
        ];

        const {blocks} = htmlToBlocks(blockToHtml(original));

        expect(blocks[0].hoverEffect).toEqual(hoverEffect)
    });

    it('preserves hover effect on a card', () => {
        const original: Block[] = [
            createBlock('card', {
                props: {title: 'Card'},
                hoverEffect: {preset: 'shadow'}
            })
        ];

        const {blocks} = htmlToBlocks(blockToHtml(original));

        expect(blocks[0].hoverEffect).toEqual({preset: 'shadow'})
    });

    it('does not restore hover effect on excluded types', () => {
        const original: Block[] = [
            createBlock('checkbox', {
                props: {label: 'Agree'},
                hoverEffect
            })
        ];

        const {blocks} = htmlToBlocks(blockToHtml(original));

        expect(blocks[0].hoverEffect).toBeUndefined()
    });

    it('strips hover classes from imported custom classes', () => {
        const original: Block[] = [
            createBlock('button', {
                props: {text: 'Go'},
                classes: ['btn-lg'],
                hoverEffect
            })
        ];

        const {blocks} = htmlToBlocks(blockToHtml(original));

        expect(blocks[0].classes).toContain('btn-lg');
        expect(blocks[0].classes).not.toContain('amagon-hover');
        expect(blocks[0].classes).not.toContain('amagon-hover-glow')
    });

    it('survives a full pageToHtml round-trip', () => {
        const original: Block[] = [
            createBlock('image', {
                props: {src: 'a.jpg', alt: 'A'},
                hoverEffect: {preset: 'grow'}
            })
        ];
        const html = pageToHtml(original, {title: 'Hover'});
        const {blocks} = htmlToBlocks(html);

        expect(blocks[0].hoverEffect).toEqual({preset: 'grow'});
        expect(html).toContain('.amagon-hover-grow:hover')
    })
});
