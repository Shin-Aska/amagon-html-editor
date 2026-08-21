import {describe, expect, it} from 'vitest'
import {blockToHtml, pageToHtml} from '../blockToHtml'
import {htmlToBlocks} from '../htmlToBlocks'
import type {Block} from '../../store/types'
import {createBlock} from '../../store/types'

const animation: Block['animation'] = {preset: 'slide-up', durationMs: 500, delayMs: 100, easing: 'ease-in'}

describe('animation round-trip: blocks → HTML → blocks', () => {
    it('preserves animation on a heading', () => {
        const original: Block[] = [
            createBlock('heading', {
                props: {text: 'Hello', level: 2},
                animation
            })
        ];
        const html = blockToHtml(original);
        const {blocks} = htmlToBlocks(html);

        expect(blocks[0].animation).toEqual(animation)
    });

    it('preserves animation on a button', () => {
        const original: Block[] = [
            createBlock('button', {
                props: {text: 'Go'},
                animation
            })
        ];
        const html = blockToHtml(original);
        const {blocks} = htmlToBlocks(html);

        expect(blocks[0].animation).toEqual(animation)
    });

    it('preserves animation on a card', () => {
        const original: Block[] = [
            createBlock('card', {
                props: {title: 'Card'},
                animation
            })
        ];
        const html = blockToHtml(original);
        const {blocks} = htmlToBlocks(html);

        expect(blocks[0].animation).toEqual(animation)
    });

    it('preserves animation on an image with caption', () => {
        const original: Block[] = [
            createBlock('image', {
                props: {src: 'a.jpg', alt: 'A', caption: 'Photo'},
                animation
            })
        ];
        const html = blockToHtml(original);
        const {blocks} = htmlToBlocks(html);

        expect(blocks[0].animation).toEqual(animation)
    });

    it('does not restore animation on excluded types', () => {
        const original: Block[] = [
            createBlock('spacer', {
                props: {height: '2rem'},
                animation
            })
        ];
        const html = blockToHtml(original);
        const {blocks} = htmlToBlocks(html);

        expect(blocks[0].animation).toBeUndefined()
    });

    it('strips animation classes and variables from the imported result', () => {
        const original: Block[] = [
            createBlock('paragraph', {
                props: {text: 'Body'},
                animation
            })
        ];
        const html = blockToHtml(original);
        const {blocks} = htmlToBlocks(html);

        expect(blocks[0].classes).not.toContain('amagon-enter');
        expect(blocks[0].classes).not.toContain('amagon-enter-slide-up');
        expect(blocks[0].styles['--amagon-enter-duration']).toBeUndefined();
        expect(blocks[0].styles['--amagon-enter-delay']).toBeUndefined();
        expect(blocks[0].styles['--amagon-enter-easing']).toBeUndefined()
    });

    it('survives a full pageToHtml round-trip', () => {
        const original: Block[] = [
            createBlock('heading', {
                props: {text: 'Page title', level: 1},
                animation
            })
        ];
        const html = pageToHtml(original, {title: 'Page'});
        const {blocks} = htmlToBlocks(html);

        expect(blocks[0].animation).toEqual(animation);
        expect(html).toContain('@keyframes amagon-enter-slide-up')
    });

    it('strips legacy animation styles when importing a recognized preset', () => {
        const original: Block[] = [
            createBlock('paragraph', {
                props: {text: 'Body'},
                animation,
                styles: {
                    animationName: 'old-fade',
                    animationDuration: '0.6s',
                    animationTimingFunction: 'ease-in',
                    animationDelay: '0.1s',
                    color: 'red'
                }
            })
        ];
        const html = blockToHtml(original);
        const {blocks} = htmlToBlocks(html);

        expect(blocks[0].animation).toEqual(animation);
        expect(blocks[0].styles).toEqual({color: 'red'})
    });

    it('parses seconds correctly during import round-trip', () => {
        const original: Block[] = [
            createBlock('paragraph', {
                props: {text: 'Body'},
                animation: {...animation, durationMs: 1200, delayMs: 250}
            })
        ];
        const html = blockToHtml(original);
        const {blocks} = htmlToBlocks(html);

        expect(blocks[0].animation?.durationMs).toBe(1200);
        expect(blocks[0].animation?.delayMs).toBe(250)
    })
});
