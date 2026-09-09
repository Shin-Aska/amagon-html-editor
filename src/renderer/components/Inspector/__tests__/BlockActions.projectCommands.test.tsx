import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import BlockActions from '../BlockActions'
import {useEditorStore} from '../../../store/editorStore'
import {useProjectStore} from '../../../store/projectStore'
import type {Block} from '../../../store/types'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const commands = vi.hoisted(() => ({
    save: vi.fn(async () => ({ok: true, value: undefined}))
}))

vi.mock('../../../project/projectCommands', () => ({projectCommands: commands}))

const heading: Block = {
    id: 'heading-1',
    type: 'heading',
    props: {text: 'Reusable heading'},
    styles: {},
    classes: [],
    children: []
}

function findButtonByText(container: HTMLElement, text: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((candidate) => {
        return candidate.textContent?.trim() === text
    });
    if (button === undefined) throw new Error(`Could not find ${text} button`)
    return button
}

describe('BlockActions project commands', () => {
    let container: HTMLDivElement | null = null;
    let root: ReturnType<typeof createRoot> | null = null;
    let customBlockCountWhenSaved = 0;

    beforeEach(() => {
        customBlockCountWhenSaved = 0;
        commands.save.mockReset();
        commands.save.mockImplementation(async () => {
            customBlockCountWhenSaved = useProjectStore.getState().userBlocks.length;
            return {ok: true, value: undefined}
        });
        useProjectStore.setState({userBlocks: []});
        useEditorStore.setState({blocks: [heading]});
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        act(() => root?.render(<BlockActions blockId={heading.id} blockType={heading.type}/>))
    });

    afterEach(() => {
        act(() => root?.unmount());
        container?.remove();
        root = null;
        container = null;
        useEditorStore.setState({blocks: []});
        useProjectStore.setState({userBlocks: []});
        vi.restoreAllMocks()
    });

    it('adds a reusable block before saving through the canonical command', async () => {
        // Given
        if (container === null) throw new Error('Block actions did not mount');
        const mountedContainer = container;

        // When
        act(() => findButtonByText(mountedContainer, 'Save as Custom Block').click());
        act(() => findButtonByText(mountedContainer, 'Save').click());

        // Then
        await vi.waitFor(() => expect(commands.save).toHaveBeenCalledOnce());
        expect(useProjectStore.getState().userBlocks).toHaveLength(1);
        expect(customBlockCountWhenSaved).toBe(1)
    })
})
