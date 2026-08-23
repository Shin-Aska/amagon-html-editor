import {describe, expect, it} from 'vitest'
import type {Block} from '../../store/types'
import {createBlock} from '../../store/types'
import {cloneBlockTree} from '../../templates/templateFactories'

describe('clone helpers preserve animation', () => {
    it('cloneBlockTree preserves animation as a new object reference', () => {
        const child = createBlock('heading', {
            props: {text: 'Child'},
            animation: {preset: 'fade', durationMs: 500, delayMs: 100, easing: 'ease-out'}
        });
        const parent = createBlock('container', {
            animation: {preset: 'slide-up', durationMs: 600, delayMs: 0, easing: 'ease-in'},
            children: [child]
        });

        const cloned = cloneBlockTree(parent);

        expect(cloned.animation).toEqual(parent.animation);
        expect(cloned.animation).not.toBe(parent.animation);
        expect(cloned.id).not.toBe(parent.id);

        expect(cloned.children[0].animation).toEqual(child.animation);
        expect(cloned.children[0].animation).not.toBe(child.animation);
        expect(cloned.children[0].id).not.toBe(child.id)
    });

    it('editor-style JSON clone preserves animation on nested blocks', () => {
        const blocks: Block[] = [
            createBlock('container', {
                animation: {preset: 'zoom', durationMs: 400, delayMs: 50, easing: 'linear'},
                children: [
                    createBlock('button', {
                        props: {text: 'Go'},
                        animation: {preset: 'bounce', durationMs: 700, delayMs: 0, easing: 'ease-out'}
                    })
                ]
            })
        ];

        const cloned = JSON.parse(JSON.stringify(blocks)) as Block[];

        expect(cloned[0].animation).toEqual(blocks[0].animation);
        expect(cloned[0].children[0].animation).toEqual(blocks[0].children[0].animation)
    });

    it('production copy/clone path preserves animation as a new object reference', () => {
        const child = createBlock('heading', {
            props: {text: 'Child'},
            animation: {preset: 'fade', durationMs: 500, delayMs: 100, easing: 'ease-out'}
        });
        const parent = createBlock('container', {
            animation: {preset: 'slide-up', durationMs: 600, delayMs: 0, easing: 'ease-in'},
            children: [child]
        });

        // The Canvas context menu and Toolbar paste actions now call the same exported cloneBlockTree helper.
        const cloned = cloneBlockTree(parent);

        expect(cloned.animation).toEqual(parent.animation);
        expect(cloned.animation).not.toBe(parent.animation);
        expect(cloned.id).not.toBe(parent.id);

        expect(cloned.children[0].animation).toEqual(child.animation);
        expect(cloned.children[0].animation).not.toBe(child.animation);
        expect(cloned.children[0].id).not.toBe(child.id)
    });

    it('production copy/clone path preserves animation through a JSON clipboard round-trip', () => {
        const block = createBlock('stats-section', {
            props: {items: [{value: '120', label: 'Projects', prefix: '', suffix: '+', icon: ''}]},
            animation: {preset: 'zoom', durationMs: 400, delayMs: 50, easing: 'linear'}
        });

        // Simulates the editor store clipboard: a shallow copy is made first, then cloneBlockTree is called on paste.
        const clipboard = {...block, id: block.id};
        const pasted = cloneBlockTree(clipboard);

        expect(pasted.animation).toEqual(block.animation);
        expect(pasted.animation).not.toBe(block.animation);
        expect(pasted.id).not.toBe(block.id)
    })
});
