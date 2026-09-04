import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import Sidebar from '../Sidebar'
import {useProjectStore} from '../../../store/projectStore'
import type {UserBlock} from '../../../store/types'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const commands = vi.hoisted(() => ({
    save: vi.fn(async () => ({ok: true, value: undefined}))
}))

vi.mock('../../../project/projectCommands', () => ({projectCommands: commands}))

const reusableBlock: UserBlock = {
    id: 'reusable-hero',
    label: 'Reusable Hero',
    icon: 'lucide:layout-template',
    category: 'Reusable',
    content: {
        id: 'reusable-hero-content',
        type: 'heading',
        props: {},
        styles: {},
        classes: [],
        children: []
    }
}

function findElementByText(container: HTMLElement, text: string): HTMLElement {
    const element = Array.from(container.querySelectorAll<HTMLElement>('*')).find((candidate) => {
        return candidate.textContent?.trim() === text
    });
    if (element === undefined) throw new Error(`Could not find ${text}`)
    return element
}

function findContextMenuAction(container: HTMLElement, text: string): HTMLElement {
    const action = Array.from(container.querySelectorAll<HTMLElement>('.context-menu-item')).find((candidate) => {
        return candidate.textContent?.trim() === text
    });
    if (action === undefined) throw new Error(`Could not find ${text} action`)
    return action
}

describe('Sidebar project commands', () => {
    let container: HTMLDivElement | null = null;
    let root: ReturnType<typeof createRoot> | null = null;
    let blockIdsWhenSaved: string[] = [];

    beforeEach(() => {
        blockIdsWhenSaved = [];
        commands.save.mockReset();
        commands.save.mockImplementation(async () => {
            blockIdsWhenSaved = useProjectStore.getState().userBlocks.map((block) => block.id);
            return {ok: true, value: undefined}
        });
        useProjectStore.setState({userBlocks: [reusableBlock]});
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        act(() => root?.render(<Sidebar/>))
    });

    afterEach(() => {
        act(() => root?.unmount());
        container?.remove();
        root = null;
        container = null;
        useProjectStore.setState({userBlocks: []});
        vi.restoreAllMocks()
    });

    it('removes a reusable block before saving through the canonical command', async () => {
        // Given
        if (container === null) throw new Error('Sidebar did not mount');
        const mountedContainer = container;
        const reusableWidget = Array.from(mountedContainer.querySelectorAll<HTMLElement>('.widget-item')).find((candidate) => {
            return candidate.textContent?.trim() === reusableBlock.label
        });
        if (reusableWidget === undefined) throw new Error('Reusable block widget did not render');
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        // When
        await act(async () => {
            reusableWidget.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, clientX: 12, clientY: 16}))
        });
        act(() => findContextMenuAction(mountedContainer, 'Remove custom block').click());

        // Then
        expect(useProjectStore.getState().userBlocks).toEqual([]);
        await vi.waitFor(() => expect(commands.save).toHaveBeenCalledOnce());
        expect(blockIdsWhenSaved).toEqual([])
    })
})
