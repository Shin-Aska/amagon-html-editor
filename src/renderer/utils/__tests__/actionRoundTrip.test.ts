import {describe, expect, it} from 'vitest'
import {createBlock, type Block} from '../../store/types'
import {blockToHtml, pageToHtml} from '../blockToHtml'
import {htmlToBlocks} from '../htmlToBlocks'

const actionEffect: Block['actionEffect'] = {preset: 'pulse'};

describe('action effect round-trip: blocks -> HTML -> blocks', () => {
    it('preserves an action effect on a button', () => {
        const original = [createBlock('button', {props: {text: 'Go'}, actionEffect})];

        const {blocks} = htmlToBlocks(blockToHtml(original));

        expect(blocks[0].actionEffect).toEqual(actionEffect)
    });

    it('does not restore an action effect on an excluded type', () => {
        const original = [createBlock('image', {props: {src: 'a.jpg'}, actionEffect})];

        const {blocks} = htmlToBlocks(blockToHtml(original));

        expect(blocks[0].actionEffect).toBeUndefined()
    });

    it('strips generated action classes from imported custom classes', () => {
        const original = [createBlock('link', {
            props: {text: 'Read', href: '#'},
            classes: ['fw-bold'],
            actionEffect
        })];

        const {blocks} = htmlToBlocks(blockToHtml(original));

        expect(blocks[0].classes).toContain('fw-bold');
        expect(blocks[0].classes).not.toContain('amagon-action');
        expect(blocks[0].classes).not.toContain('amagon-action-pulse')
    });

    it('survives a full page round-trip and includes the action runtime', () => {
        const original = [createBlock('button', {props: {text: 'Go'}, actionEffect: {preset: 'pop'}})];
        const html = pageToHtml(original, {title: 'Action'});
        const {blocks} = htmlToBlocks(html);

        expect(blocks[0].actionEffect).toEqual({preset: 'pop'});
        expect(html).toContain('.amagon-action-pop.amagon-action-active');
        expect(html).toContain("addEventListener('pointerdown'")
    })
});
