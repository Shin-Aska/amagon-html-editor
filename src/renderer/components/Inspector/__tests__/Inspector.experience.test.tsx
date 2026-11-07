import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach, beforeAll, describe, expect, it} from 'vitest'
import userEvent from '@testing-library/user-event'
import Inspector from '../Inspector'
import ArrayField from '../ArrayField'
import {componentRegistry, buildDefaultBlockProps} from '../../../registry/ComponentRegistry'
import {registerBlocks} from '../../../registry/registerBlocks'
import {widgetDesignProfiles} from '../../../registry/widgetDesigns'
import {useEditorStore} from '../../../store/editorStore'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
let root: ReturnType<typeof createRoot> | undefined;
let container: HTMLDivElement;
beforeAll(() => registerBlocks());
afterEach(() => {act(() => root?.unmount()); container?.remove(); useEditorStore.setState({blocks: [], selectedBlockId: null})});

function mount(element: React.ReactNode) {
    container = document.createElement('div'); document.body.append(container);
    root = createRoot(container); act(() => root?.render(element))
}
function select(type: string, props: Record<string, unknown> = {}) {
    const definition = componentRegistry.get(type)!;
    act(() => useEditorStore.setState({selectedBlockId: 'test-widget', blocks: [{id: 'test-widget', type,
        props: {...buildDefaultBlockProps(definition), ...props}, styles: {}, classes: definition.defaultClasses || [], children: []}]}))
}
function button(text: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find(el => el.textContent?.trim() === text || el.getAttribute('aria-label') === text);
    if (!found) throw new Error(`Missing button: ${text}`);
    return found
}

describe('widget inspector experience', () => {
    it.each(Object.keys(widgetDesignProfiles))('%s has reachable Content, Design, and Advanced controls', type => {
        mount(<Inspector/>);
        expect(componentRegistry.getAll()).toHaveLength(63);
        select(type);
        for (const tab of ['Content', 'Design', 'Advanced']) {
            act(() => button(tab).click());
            expect(container.querySelector('[role="tabpanel"]')).not.toBeNull();
            expect(container.textContent).not.toContain('Unsupported type:');
            expect(button(tab).getAttribute('aria-selected')).toBe('true')
        }
    });

    it('searches across tabs, resets a property, and updates immediately after undo', async () => {
        select('heading', {text: 'Custom title'}); mount(<Inspector/>);
        expect(container.querySelector('[aria-label="Text"]')).not.toBeNull();
        act(() => useEditorStore.getState().updateBlock('test-widget', {props: {text: 'Custom title'}}));
        act(() => button('Reset Text').click());
        expect(useEditorStore.getState().blocks[0].props.text).toBe('Heading');
        act(() => useEditorStore.getState().undo());
        expect(useEditorStore.getState().blocks[0].props.text).toBe('Custom title');
        act(() => useEditorStore.getState().selectBlock('test-widget'));
        expect(container.querySelector<HTMLInputElement>('input[aria-label="Text"]')?.value).toBe('Custom title');
        const user = userEvent.setup();
        await act(async () => user.type(container.querySelector('input[type="search"]')!, 'font'));
        expect(container.textContent).toContain('Typography');
        expect(container.querySelector('[aria-label="Reset Text"]')).toBeNull()
    });

    it('hides dependent fields without erasing their values', () => {
        select('button', {loading: false, loadingText: 'Please wait'}); mount(<Inspector/>);
        act(() => button('Advanced').click());
        expect(container.querySelector('input[aria-label="Loading Text"]')).toBeNull();
        act(() => container.querySelector<HTMLInputElement>('input[aria-label="Loading State"]')!.click());
        expect(container.querySelector<HTMLInputElement>('input[aria-label="Loading Text"]')?.value).toBe('Please wait')
    });

    it('keeps numeric select values typed and preserves complex CSS measurements', async () => {
        select('heading'); mount(<Inspector/>);
        const user = userEvent.setup();
        await act(async () => user.selectOptions(container.querySelector('select[aria-label="Level"]')!, '3'));
        expect(useEditorStore.getState().blocks[0].props.level).toBe(3);
        act(() => button('Design').click());
        const alignment = container.querySelector<HTMLSelectElement>('select[aria-label="Alignment"]')!;
        expect(alignment.value).toBe('');
        expect(alignment.selectedOptions[0].textContent).toBe('Widget default');
        await act(async () => user.selectOptions(alignment, 'text-start'));
        expect(useEditorStore.getState().blocks[0].props.alignment).toBe('text-start');
        select('map-embed', {height: 'clamp(15rem, 50vh, 35rem)'});
        act(() => button('Design').click());
        expect(container.querySelector<HTMLInputElement>('input[aria-label="Height"]')?.value).toBe('clamp(15rem, 50vh, 35rem)')
    });

    it('duplicates nested items independently and preserves the default tab when removing', () => {
        const items = [{label: 'First', content: 'One', blocks: [{id: 'tab-block', type: 'container', props: {}, styles: {}, classes: [],
            children: [{id: 'nested-heading', type: 'heading', props: {text: 'Original'}, styles: {}, classes: [], children: []}]}]},
            {label: 'Second', content: 'Two', blocks: []}];
        let result = items; let selected = 1;
        mount(<ArrayField value={items} itemType="tab" defaultIndex={1} onChange={() => {throw new Error('Expected atomic update')}}
            onChangeBoth={(next, index) => {result = next as typeof items; selected = index}}/>);
        act(() => container.querySelector<HTMLButtonElement>('[title="Duplicate item"]')!.click());
        expect(result.map(item => item.label)).toEqual(['First', 'First', 'Second']); expect(selected).toBe(2);
        result[1].label = 'Copy'; expect(items[0].label).toBe('First');
        expect(result[1].blocks[0].id).not.toBe(items[0].blocks[0].id);
        expect(result[1].blocks[0].children[0].id).not.toBe(items[0].blocks[0].children[0].id);
        result[1].blocks[0].children[0].props.text = 'Edited';
        expect(items[0].blocks[0].children[0].props.text).toBe('Original');
        act(() => container.querySelector<HTMLButtonElement>('[title="Remove"]')!.click());
        expect(result.map(item => item.label)).toEqual(['Second']); expect(selected).toBe(0)
    })
});
