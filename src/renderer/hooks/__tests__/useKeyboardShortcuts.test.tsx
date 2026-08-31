import {act, createElement} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {useKeyboardShortcuts} from '../useKeyboardShortcuts'

(globalThis as unknown as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

interface ShortcutHarnessProps {
    enabled: boolean
    onNewProject: () => void
    onOpen: () => void
}

function ShortcutHarness({enabled, onNewProject, onOpen}: ShortcutHarnessProps): null {
    useKeyboardShortcuts({
        enabled,
        onSave: vi.fn(),
        onSaveAs: vi.fn(),
        onOpen,
        onExport: vi.fn(),
        onToggleCodeEditor: vi.fn(),
        onToggleLeftPanel: vi.fn(),
        onToggleRightPanel: vi.fn(),
        leftPanelOpen: true,
        rightPanelOpen: true,
        codeEditorOpen: false,
        onNewProject
    });
    return null
}

function renderHarness(props: ShortcutHarnessProps): () => void {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(createElement(ShortcutHarness, props)));
    return () => {
        act(() => root.unmount());
        container.remove()
    }
}

afterEach(() => {
    document.body.replaceChildren()
});

describe('useKeyboardShortcuts', () => {
    it('keeps New and Open shortcuts active when editor shortcuts are disabled', () => {
        const onNewProject = vi.fn();
        const onOpen = vi.fn();
        const unmount = renderHarness({enabled: false, onNewProject, onOpen});

        const newProjectEvent = new KeyboardEvent('keydown', {
            key: 'n',
            ctrlKey: true,
            cancelable: true
        });
        const openEvent = new KeyboardEvent('keydown', {
            key: 'o',
            ctrlKey: true,
            cancelable: true
        });
        act(() => {
            window.dispatchEvent(newProjectEvent);
            window.dispatchEvent(openEvent)
        });

        expect(newProjectEvent.defaultPrevented).toBe(true);
        expect(openEvent.defaultPrevented).toBe(true);
        expect(onNewProject).toHaveBeenCalledOnce();
        expect(onOpen).toHaveBeenCalledOnce();
        unmount()
    });

    it('leaves native Tab navigation alone when editor shortcuts are disabled', () => {
        const unmount = renderHarness({
            enabled: false,
            onNewProject: vi.fn(),
            onOpen: vi.fn()
        });
        const event = new KeyboardEvent('keydown', {
            key: 'Tab',
            cancelable: true
        });

        act(() => window.dispatchEvent(event));

        expect(event.defaultPrevented).toBe(false);
        unmount()
    })
});
