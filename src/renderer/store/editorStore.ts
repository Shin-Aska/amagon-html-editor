import {create} from 'zustand'
import {useAppSettingsStore} from './appSettingsStore'
import type {Block, EditorActions, EditorState, HistoryEntry} from './types'

// Callback registered by projectStore to sync blocks on tab exit (avoids circular import)
let _onExitTabEditMode: ((blocks: Block[]) => void) | null = null;

export function setOnExitTabEditModeCallback(cb: (blocks: Block[]) => void) {
    _onExitTabEditMode = cb
}

const MAX_HISTORY = 50;

// ─── Deep clone helper ───────────────────────────────────────────────────────

function cloneBlocks(blocks: Block[]): Block[] {
    return JSON.parse(JSON.stringify(blocks))
}

// ─── Tree traversal helpers ──────────────────────────────────────────────────

function findBlockById(blocks: Block[], id: string): Block | null {
    for (const block of blocks) {
        if (block.id === id) return block;
        const found = findBlockById(block.children, id);
        if (found) return found
    }
    return null
}

function findBlockPath(blocks: Block[], id: string, path: string[] = []): string[] | null {
    for (const block of blocks) {
        if (block.id === id) return [...path, block.id];
        const found = findBlockPath(block.children, id, [...path, block.id]);
        if (found) return found
    }
    return null
}

function removeBlockFromTree(blocks: Block[], id: string): { tree: Block[]; removed: Block | null } {
    let removed: Block | null = null;

    const filter = (items: Block[]): Block[] => {
        return items.reduce<Block[]>((acc, block) => {
            if (block.id === id) {
                removed = block;
                return acc
            }
            acc.push({...block, children: filter(block.children)});
            return acc
        }, [])
    };

    return {tree: filter(blocks), removed}
}

function insertBlockInTree(
    blocks: Block[],
    block: Block,
    parentId: string | null,
    index: number
): Block[] {
    if (parentId === null) {
        const newBlocks = [...blocks];
        const clampedIndex = Math.max(0, Math.min(index, newBlocks.length));
        newBlocks.splice(clampedIndex, 0, block);
        return newBlocks
    }

    return blocks.map((b) => {
        if (b.id === parentId) {
            const newChildren = [...b.children];
            const clampedIndex = Math.max(0, Math.min(index, newChildren.length));
            newChildren.splice(clampedIndex, 0, block);
            return {...b, children: newChildren}
        }
        return {...b, children: insertBlockInTree(b.children, block, parentId, index)}
    })
}

const BUTTON_VARIANT_CLASSES = new Set([
    'btn-primary',
    'btn-secondary',
    'btn-success',
    'btn-danger',
    'btn-warning',
    'btn-info',
    'btn-light',
    'btn-dark',
    'btn-link'
]);

const BUTTON_SIZE_CLASSES = new Set(['btn-sm', 'btn-lg']);

function syncButtonClasses(
    block: Block,
    propPatch: Record<string, unknown> | undefined,
    nextProps: Record<string, unknown>,
    nextClasses: string[]
): string[] {
    if (block.type !== 'button') return nextClasses;

    const updatesVariant = !!propPatch && Object.prototype.hasOwnProperty.call(propPatch, 'variant');
    const updatesSize = !!propPatch && Object.prototype.hasOwnProperty.call(propPatch, 'size');

    const classes = nextClasses.filter((cls) => {
        return !(
            (updatesVariant && BUTTON_VARIANT_CLASSES.has(cls)) ||
            (updatesSize && BUTTON_SIZE_CLASSES.has(cls))
        )
    });

    const variant = updatesVariant && typeof nextProps.variant === 'string' ? nextProps.variant.trim() : '';
    const size = updatesSize && typeof nextProps.size === 'string' ? nextProps.size.trim() : '';

    if (variant) classes.push(variant);
    if (size) classes.push(size);

    return classes
}

function updateBlockInTree(
    blocks: Block[],
    id: string,
    patch: Partial<Omit<Block, 'id' | 'children' | 'props' | 'styles'>> & {
        props?: Record<string, unknown>;
        styles?: Record<string, string | undefined>
    }
): Block[] {
    return blocks.map((block) => {
        if (block.id === id) {
            const newProps = patch.props ? {...block.props, ...patch.props} : block.props;
            const newStyles = patch.styles ? {...block.styles, ...patch.styles} : block.styles;

            if (patch.props) {
                for (const key in newProps) {
                    if (newProps[key] === undefined) delete newProps[key]
                }
            }

            if (patch.styles) {
                for (const key in newStyles) {
                    if (newStyles[key] === undefined) delete newStyles[key]
                }
            }

            const newClasses = syncButtonClasses(
                block,
                patch.props,
                newProps as Record<string, unknown>,
                patch.classes ? [...patch.classes] : [...block.classes]
            );

            return {
                ...block,
                ...patch,
                props: newProps as Record<string, unknown>,
                styles: newStyles as Record<string, string>,
                classes: newClasses
            }
        }
        return {...block, children: updateBlockInTree(block.children, id, patch)}
    })
}

function isDescendantOf(blocks: Block[], ancestorId: string, descendantId: string): boolean {
    const ancestor = findBlockById(blocks, ancestorId);
    if (!ancestor) return false;
    return findBlockById(ancestor.children, descendantId) !== null
}

// ─── Form nesting prevention helpers ─────────────────────────────────────────

function isFormBlock(block: Block): boolean {
    return block.type === 'form' || (block.type === 'container' && block.props.isForm === true)
}

function isInsideForm(blocks: Block[], parentId: string | null): boolean {
    if (!parentId) return false;
    const path = findBlockPath(blocks, parentId);
    if (!path) return false;
    for (const id of path) {
        const b = findBlockById(blocks, id);
        if (b && isFormBlock(b)) return true
    }
    return false
}

function containsForm(block: Block): boolean {
    if (isFormBlock(block)) return true;
    for (const child of block.children) {
        if (containsForm(child)) return true
    }
    return false
}

// ─── Store ───────────────────────────────────────────────────────────────────

type EditorStore = EditorState & EditorActions

function createHistoryEntry(blocks: Block[]): HistoryEntry {
    return {
        blocks: cloneBlocks(blocks),
        timestamp: Date.now()
    }
}

export const useEditorStore = create<EditorStore>((set, get) => {
    // Push a snapshot onto the history stack, truncating any redo entries
    function pushHistory(currentBlocks: Block[]): { history: HistoryEntry[]; historyIndex: number } {
        const state = get();
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(createHistoryEntry(currentBlocks));

        // Cap at MAX_HISTORY
        if (newHistory.length > MAX_HISTORY) {
            newHistory.shift()
        }

        return {
            history: newHistory,
            historyIndex: newHistory.length - 1
        }
    }

    // ─── Restore persisted theme preference ──────────────────────────────
    // The initial theme is now managed by appSettingsStore.
    // We default to 'dark' here; appSettingsStore will update it on load if needed.
    const initialTheme: 'light' | 'dark' = 'dark';

    return {
        // ─── Initial State ─────────────────────────────────────────────────
        blocks: [],
        selectedBlockId: null,
        hoveredBlockId: null,
        history: [createHistoryEntry([])],
        historyIndex: 0,
        isDirty: false,

        isDragging: false,
        isTypingCode: false,

        customCss: '',

        viewportMode: 'desktop',
        zoom: 100,
        theme: initialTheme,
        showLayoutOutlines: true,
        editorLayout: 'standard',
        clipboard: null,

        activeTabEditBlockId: null,
        activeTabIndex: null,
        pageBlocksBackup: null,

        // ─── Block Mutations ───────────────────────────────────────────────

        addBlock: (block, parentId = null, index = -1) => {
            set((state) => {
                // Prevent form-inside-form nesting
                if (isFormBlock(block) && isInsideForm(state.blocks, parentId)) {
                    return state
                }
                // Prevent adding a block that contains a form inside a form
                if (containsForm(block) && parentId && isInsideForm(state.blocks, parentId)) {
                    return state
                }
                // Prevent adding any block inside a form if it contains a nested form
                if (parentId) {
                    const parent = findBlockById(state.blocks, parentId);
                    if (parent && isFormBlock(parent) && containsForm(block)) {
                        return state
                    }
                }

                const idx = index < 0 ? (parentId ? (findBlockById(state.blocks, parentId)?.children.length ?? 0) : state.blocks.length) : index;
                const newBlocks = insertBlockInTree(state.blocks, block, parentId, idx);
                return {
                    blocks: newBlocks,
                    isDirty: true,
                    ...pushHistory(newBlocks)
                }
            })
        },

        updateBlock: (id, patch: Partial<Omit<Block, 'id' | 'children' | 'props' | 'styles'>> & {
            props?: Record<string, unknown>;
            styles?: Record<string, string | undefined>
        }) => {
            set((state) => {
                const newBlocks = updateBlockInTree(state.blocks, id, patch);
                return {
                    blocks: newBlocks,
                    isDirty: true,
                    ...pushHistory(newBlocks)
                }
            })
        },

        moveBlock: (id, newParentId, newIndex) => {
            set((state) => {
                // Prevent moving a block into its own descendant
                if (newParentId && isDescendantOf(state.blocks, id, newParentId)) {
                    return state
                }

                // Prevent form-inside-form nesting on move
                const movingBlock = findBlockById(state.blocks, id);
                if (movingBlock) {
                    if (isFormBlock(movingBlock) && isInsideForm(state.blocks, newParentId)) {
                        return state
                    }
                    if (containsForm(movingBlock) && newParentId && isInsideForm(state.blocks, newParentId)) {
                        return state
                    }
                    if (newParentId) {
                        const parent = findBlockById(state.blocks, newParentId);
                        if (parent && isFormBlock(parent) && containsForm(movingBlock)) {
                            return state
                        }
                    }
                }

                const {tree, removed} = removeBlockFromTree(state.blocks, id);
                if (!removed) return state;

                const newBlocks = insertBlockInTree(tree, removed, newParentId, newIndex);
                return {
                    blocks: newBlocks,
                    isDirty: true,
                    ...pushHistory(newBlocks)
                }
            })
        },

        removeBlock: (id) => {
            set((state) => {
                const {tree} = removeBlockFromTree(state.blocks, id);
                const newSelectedId = state.selectedBlockId === id ? null : state.selectedBlockId;
                return {
                    blocks: tree,
                    selectedBlockId: newSelectedId,
                    isDirty: true,
                    ...pushHistory(tree)
                }
            })
        },

        setIsDragging: (value) => {
            set({isDragging: value})
        },

        setIsTypingCode: (value) => {
            set({isTypingCode: value})
        },

        setCustomCss: (css) => {
            set({customCss: css})
        },

        setViewportMode: (mode) => {
            set({viewportMode: mode})
        },

        setZoom: (zoom) => {
            set({zoom: Math.max(25, Math.min(200, zoom))})
        },

        setTheme: (theme) => {
            set({theme});
            useAppSettingsStore.getState().setTheme(theme)
        },

        setLayoutOutlines: (show) => {
            set({showLayoutOutlines: show})
        },

        setEditorLayout: (layout) => {
            set({editorLayout: layout});
            useAppSettingsStore.getState().setDefaultLayout(layout)
        },

        setClipboard: (block) => {
            set({clipboard: block})
        },

        setPageBlocks: (blocks) => {
            set(() => {
                const newBlocks = cloneBlocks(blocks);
                return {
                    blocks: newBlocks,
                    selectedBlockId: null,
                    hoveredBlockId: null,
                    isDirty: true,
                    ...pushHistory(newBlocks)
                }
            })
        },

        loadPageBlocks: (blocks) => {
            set((state) => {
                const newBlocks = cloneBlocks(blocks);
                return {
                    blocks: newBlocks,
                    selectedBlockId: null,
                    hoveredBlockId: null,
                    // Do not mark dirty on page load/switch
                    isDirty: state.isDirty,
                    // Reset history for the newly loaded page
                    history: [createHistoryEntry(newBlocks)],
                    historyIndex: 0
                }
            })
        },

        markDirty: () => {
            set({isDirty: true})
        },

        markSaved: () => {
            set({isDirty: false})
        },

        // ─── Selection ─────────────────────────────────────────────────────

        selectBlock: (id) => {
            set({selectedBlockId: id})
        },

        hoverBlock: (id) => {
            set({hoveredBlockId: id})
        },

        // ─── History ───────────────────────────────────────────────────────

        undo: () => {
            set((state) => {
                if (state.historyIndex <= 0) return state;
                const newIndex = state.historyIndex - 1;
                const entry = state.history[newIndex];
                return {
                    blocks: cloneBlocks(entry.blocks),
                    historyIndex: newIndex,
                    selectedBlockId: null,
                    hoveredBlockId: null
                }
            })
        },

        redo: () => {
            set((state) => {
                if (state.historyIndex >= state.history.length - 1) return state;
                const newIndex = state.historyIndex + 1;
                const entry = state.history[newIndex];
                return {
                    blocks: cloneBlocks(entry.blocks),
                    historyIndex: newIndex,
                    selectedBlockId: null,
                    hoveredBlockId: null
                }
            })
        },

        // ─── Utility ───────────────────────────────────────────────────────

        getBlockById: (id) => {
            return findBlockById(get().blocks, id)
        },

        getBlockPath: (id) => {
            return findBlockPath(get().blocks, id) ?? []
        },

        getFullBlocks: () => {
            const state = get();
            if (!state.activeTabEditBlockId || !state.pageBlocksBackup || state.activeTabIndex === null) {
                return state.blocks
            }

            // We are in tab edit mode, merge current blocks back into the backup tree
            const fullTree = cloneBlocks(state.pageBlocksBackup);
            const tabBlock = findBlockById(fullTree, state.activeTabEditBlockId);
            if (tabBlock && Array.isArray(tabBlock.props.tabs)) {
                const tabs = tabBlock.props.tabs as any[];
                if (tabs[state.activeTabIndex]) {
                    tabs[state.activeTabIndex] = {
                        ...tabs[state.activeTabIndex],
                        blocks: cloneBlocks(state.blocks)
                    }
                }
            }
            return fullTree
        },

        enterTabEditMode: (blockId, tabIndex) => {
            set((state) => {
                if (state.activeTabEditBlockId) return state; // Already in edit mode

                const tabBlock = findBlockById(state.blocks, blockId);
                if (!tabBlock || !Array.isArray(tabBlock.props.tabs)) return state;

                const tabs = tabBlock.props.tabs as any[];
                const targetTab = tabs[tabIndex];
                if (!targetTab) return state;

                // Initialize blocks if they don't exist
                let tabBlocks: Block[] = targetTab.blocks || [];
                if (tabBlocks.length === 0 && targetTab.content) {
                    tabBlocks = [
                        {
                            id: `${blockId}-tab-${tabIndex}-p`,
                            type: 'paragraph',
                            props: {text: targetTab.content, editable: true},
                            styles: {},
                            classes: [],
                            children: []
                        }
                    ]
                }

                return {
                    pageBlocksBackup: cloneBlocks(state.blocks),
                    activeTabEditBlockId: blockId,
                    activeTabIndex: tabIndex,
                    blocks: cloneBlocks(tabBlocks),
                    selectedBlockId: null,
                    hoveredBlockId: null,
                    history: [createHistoryEntry(tabBlocks)],
                    historyIndex: 0
                }
            })
        },

        exitTabEditMode: () => {
            // Compute the merged full tree BEFORE clearing state
            const currentState = get();
            if (!currentState.activeTabEditBlockId || !currentState.pageBlocksBackup || currentState.activeTabIndex === null) {
                return
            }

            const fullTree = currentState.getFullBlocks();

            // Immediately push merged tree to projectStore via callback so any
            // subsequent loadPageBlocks call reads the correct blocks, not a stale snapshot
            _onExitTabEditMode?.(fullTree);

            set({
                blocks: fullTree,
                pageBlocksBackup: null,
                activeTabEditBlockId: null,
                activeTabIndex: null,
                selectedBlockId: null,
                hoveredBlockId: null,
                isDirty: true,
                history: [createHistoryEntry(fullTree)],
                historyIndex: 0
            })
        }
    }
});
