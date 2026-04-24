import {create} from 'zustand'
import type {
  CssFile,
  FontAsset,
  FrameworkChoice,
  Page,
  PageFolder,
  PageThemeMode,
  PageThemePreviewMode,
  ProjectData,
  ProjectSettings,
  ProjectTheme,
  ProjectThemeVariants,
  UserBlock
} from './types'
import {
  cloneTheme,
  createDefaultDarkTheme,
  createDefaultTheme,
  createDefaultThemeVariants,
  generateBlockId
} from './types'
import {createPageHeaderBlock} from '../../shared/welcomeBlocks'
import {setOnExitTabEditModeCallback, useEditorStore} from './editorStore'

// ─── Project State ───────────────────────────────────────────────────────────

interface ProjectState {
    settings: ProjectSettings
    pages: Page[]
    folders: PageFolder[]
    userBlocks: UserBlock[]
    customPresets: ProjectTheme[]  // user-created custom theme presets
    fonts: FontAsset[]
    metaKeyCounts: Record<string, number>
    uniqueMetaKeys: string[]
    currentPageId: string | null
    filePath: string | null
    isProjectLoaded: boolean
    boundPublisherId?: string
    lastPublishedUrl?: string
    lastPublishedAt?: string
}

interface ProjectActions {
    // Project-level
    setProject: (data: ProjectData, filePath?: string) => void
    closeProject: () => void
    updateSettings: (patch: Partial<ProjectSettings>) => void
    setFramework: (framework: FrameworkChoice) => void
    setFilePath: (path: string | null) => void
    setPublisherBinding: (providerId: string | null) => void
    setPublishResult: (url: string, date: string) => void
    getProjectData: () => ProjectData

    // Theme management
    setProjectTheme: (theme: ProjectTheme, mode?: PageThemeMode) => void
    updateProjectTheme: (patch: Partial<ProjectTheme>, mode?: PageThemeMode) => void
    updateThemeColors: (patch: Partial<ProjectTheme['colors']>, mode?: PageThemeMode) => void
    updateThemeTypography: (patch: Partial<ProjectTheme['typography']>, mode?: PageThemeMode) => void
    updateThemeSpacing: (patch: Partial<ProjectTheme['spacing']>, mode?: PageThemeMode) => void
    updateThemeBorders: (patch: Partial<ProjectTheme['borders']>, mode?: PageThemeMode) => void
    setThemeCustomCss: (css: string) => void
    setThemePreviewMode: (mode: PageThemePreviewMode) => void

    // Custom preset management
    addCustomPreset: (preset: ProjectTheme) => void
    updateCustomPreset: (name: string, patch: Partial<ProjectTheme>) => void
    deleteCustomPreset: (name: string) => void

    // Font management
    addFonts: (assets: FontAsset[]) => void
    removeFont: (id: string) => void
    setFonts: (assets: FontAsset[]) => void

    // CSS file management
    addCssFile: (name: string) => CssFile
    removeCssFile: (id: string) => void
    updateCssFile: (id: string, patch: Partial<Omit<CssFile, 'id'>>) => void
    reorderCssFiles: (fromIndex: number, toIndex: number) => void
    toggleCssFile: (id: string) => void

    // Page management
    addPage: (title: string, slug?: string) => Page
    removePage: (id: string) => void
    updatePage: (id: string, patch: Partial<Omit<Page, 'id'>>) => void
    setCurrentPage: (id: string) => void
    getCurrentPage: () => Page | null
    reorderPages: (fromIndex: number, toIndex: number) => void

    // Folder management
    addFolder: (name: string, tags?: string[]) => PageFolder
    removeFolder: (id: string) => void
    updateFolder: (id: string, patch: Partial<Omit<PageFolder, 'id'>>) => void

    // Effective tags (page own tags + folder inherited tags)
    getEffectiveTags: (page: Page) => string[]

    // User Blocks
    addUserBlock: (block: UserBlock) => void
    removeUserBlock: (id: string) => void
}

type ProjectStore = ProjectState & ProjectActions

// ─── Defaults ────────────────────────────────────────────────────────────────

function createDefaultSettings(): ProjectSettings {
    const theme = createDefaultTheme();
    return {
        name: 'Untitled Project',
        framework: 'bootstrap-5',
        theme,
        themes: createDefaultThemeVariants(theme),
        globalStyles: {}
    }
}

function formatDateYYYYMMDD(d: Date): string {
    return d.toISOString().slice(0, 10)
}

function createDefaultPage(title = 'Home', slug = 'index'): Page {
    return {
        id: generateBlockId(),
        title,
        slug,
        blocks: [],
        meta: {
            description: '',
            charset: 'UTF-8',
            viewport: 'width=device-width, initial-scale=1.0',
            author: '',
            keywords: '',
            robots: 'index, follow',
            datePublished: formatDateYYYYMMDD(new Date())
        },
        fullWidthFormControls: true
    }
}

function normalizeSlug(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
}

function ensureUniqueSlug(baseSlug: string, pages: Page[]): string {
    const existing = new Set(pages.map((p) => p.slug));
    if (!existing.has(baseSlug)) return baseSlug;

    let i = 1;
    while (existing.has(`${baseSlug}-${i}`)) i++;
    return `${baseSlug}-${i}`
}

function addMetaKeysToCounts(counts: Record<string, number>, meta: Record<string, string> | undefined): void {
    if (!meta) return;
    for (const k of Object.keys(meta)) {
        counts[k] = (counts[k] || 0) + 1
    }
}

function removeMetaKeysFromCounts(counts: Record<string, number>, meta: Record<string, string> | undefined): void {
    if (!meta) return;
    for (const k of Object.keys(meta)) {
        const next = (counts[k] || 0) - 1;
        if (next <= 0) delete counts[k];
        else counts[k] = next
    }
}

function buildMetaKeyCounts(pages: Page[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const p of pages) addMetaKeysToCounts(counts, p.meta);
    return counts
}

function sortedMetaKeysFromCounts(counts: Record<string, number>): string[] {
    return Object.keys(counts).sort()
}

function normalizeThemeVariants(
    variants: ProjectThemeVariants | undefined,
    fallbackTheme: ProjectTheme
): ProjectThemeVariants {
    if (!variants) return createDefaultThemeVariants(fallbackTheme);

    return {
        light: cloneTheme(variants.light ?? fallbackTheme),
        dark: cloneTheme(variants.dark ?? createDefaultDarkTheme()),
        previewMode: variants.previewMode ?? 'device'
    }
}

function syncLegacyTheme(settings: ProjectSettings): ProjectSettings {
    const variants = normalizeThemeVariants(settings.themes, settings.theme);
    return {
        ...settings,
        theme: cloneTheme(variants.light),
        themes: variants
    }
}

function markProjectDirty(): void {
    useEditorStore.getState().markDirty()
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStore>((set, get) => {
    const defaultPage = createDefaultPage();
    const initialMetaCounts = buildMetaKeyCounts([defaultPage]);

    return {
        settings: createDefaultSettings(),
        pages: [defaultPage],
        folders: [],
        userBlocks: [],
        customPresets: [],
        fonts: [],
        metaKeyCounts: initialMetaCounts,
        uniqueMetaKeys: sortedMetaKeysFromCounts(initialMetaCounts),
        currentPageId: defaultPage.id,
        filePath: null,
        isProjectLoaded: false,
        boundPublisherId: undefined,
        lastPublishedUrl: undefined,
        lastPublishedAt: undefined,

        // ─── Project-level ───────────────────────────────────────────────

        setProject: (data, filePath) => {
            // Backward compatibility: migrate old string theme to ProjectTheme object
            const incoming = data.projectSettings;
            const fallbackTheme =
                incoming?.theme && typeof incoming.theme === 'object' && (incoming.theme as ProjectTheme).colors
                    ? (incoming.theme as ProjectTheme)
                    : createDefaultTheme();
            const migratedSettings = {
                ...createDefaultSettings(),
                ...incoming,
                theme: cloneTheme(fallbackTheme),
                themes: normalizeThemeVariants(incoming?.themes, fallbackTheme)
            };
            const normalizedSettings = syncLegacyTheme(migratedSettings);

            // Migrate legacy customCss string to customCssFiles
            const sharedCssFiles = (() => {
                const lightTheme = normalizedSettings.themes?.light;
                if (lightTheme?.customCssFiles && lightTheme.customCssFiles.length > 0) {
                    return lightTheme.customCssFiles.map((file) => ({...file}))
                }
                if (lightTheme?.customCss && lightTheme.customCss.trim().length > 0) {
                    return [{
                        id: generateBlockId(),
                        name: 'Custom Styles',
                        css: lightTheme.customCss,
                        enabled: true
                    }]
                }
                return []
            })();

            const themes = normalizedSettings.themes;
            if (themes) {
                themes.light.customCssFiles = sharedCssFiles.map((file) => ({...file}));
                themes.dark.customCssFiles = sharedCssFiles.map((file) => ({...file}));
                normalizedSettings.theme = cloneTheme(themes.light)
            }

            const nextPages = data.pages.length > 0 ? data.pages : [createDefaultPage()];
            const counts = buildMetaKeyCounts(nextPages);

            set({
                settings: normalizedSettings,
                pages: nextPages,
                folders: data.folders || [],
                userBlocks: data.userBlocks || [],
                customPresets: data.customPresets || [],
                fonts: data.projectSettings?.fonts || [],
                metaKeyCounts: counts,
                uniqueMetaKeys: sortedMetaKeysFromCounts(counts),
                currentPageId: data.pages.length > 0 ? data.pages[0].id : null,
                filePath: filePath ?? null,
                isProjectLoaded: true,
                boundPublisherId: data.publisherConfig?.providerId,
                lastPublishedUrl: data.publisherConfig?.lastPublishedUrl,
                lastPublishedAt: data.publisherConfig?.lastPublishedAt
            })
        },

        closeProject: () => {
            const newDefault = createDefaultPage();
            const counts = buildMetaKeyCounts([newDefault]);
            set({
                settings: createDefaultSettings(),
                pages: [newDefault],
                folders: [],
                userBlocks: [],
                customPresets: [],
                fonts: [],
                metaKeyCounts: counts,
                uniqueMetaKeys: sortedMetaKeysFromCounts(counts),
                currentPageId: newDefault.id,
                filePath: null,
                isProjectLoaded: false,
                boundPublisherId: undefined,
                lastPublishedUrl: undefined,
                lastPublishedAt: undefined
            })
        },

        updateSettings: (patch) => {
            set((state) => ({
                settings: syncLegacyTheme({...state.settings, ...patch})
            }));
            markProjectDirty()
        },

        setFramework: (framework) => {
            set((state) => ({
                settings: {...state.settings, framework}
            }));
            markProjectDirty()
        },

        setFilePath: (path) => {
            set({filePath: path})
        },

        setPublisherBinding: (providerId) => {
            set({
                boundPublisherId: providerId ?? undefined
            });
            markProjectDirty()
        },

        setPublishResult: (url, date) => {
            set({
                lastPublishedUrl: url,
                lastPublishedAt: date
            });
            markProjectDirty()
        },

        getProjectData: () => {
            const state = get();
            return {
                projectSettings: {
                    ...syncLegacyTheme(state.settings),
                    fonts: state.fonts
                },
                pages: state.pages,
                folders: state.folders,
                userBlocks: state.userBlocks,
                customPresets: state.customPresets,
                publisherConfig:
                    state.boundPublisherId || state.lastPublishedUrl || state.lastPublishedAt
                        ? {
                            providerId: state.boundPublisherId ?? '',
                            lastPublishedUrl: state.lastPublishedUrl,
                            lastPublishedAt: state.lastPublishedAt
                        }
                        : undefined
            }
        },

        // ─── Theme management ─────────────────────────────────────────────

        setProjectTheme: (theme, mode = 'light') => {
            set((state) => {
                const variants = normalizeThemeVariants(state.settings.themes, state.settings.theme);
                const nextTheme = cloneTheme(theme);
                const nextVariants = {
                    ...variants,
                    [mode]: nextTheme
                };
                return {
                    settings: syncLegacyTheme({
                        ...state.settings,
                        theme: mode === 'light' ? cloneTheme(nextTheme) : state.settings.theme,
                        themes: nextVariants
                    })
                }
            });
            markProjectDirty()
        },

        updateProjectTheme: (patch, mode = 'light') => {
            set((state) => {
                const variants = normalizeThemeVariants(state.settings.themes, state.settings.theme);
                const current = mode === 'dark' ? variants.dark : variants.light;
                const nextTheme: ProjectTheme = {
                    ...current,
                    ...patch
                };
                const nextVariants = {
                    ...variants,
                    [mode]: nextTheme
                };
                return {
                    settings: syncLegacyTheme({
                        ...state.settings,
                        theme: mode === 'light' ? cloneTheme(nextTheme) : state.settings.theme,
                        themes: nextVariants
                    })
                }
            });
            markProjectDirty()
        },

        updateThemeColors: (patch, mode = 'light') => {
            set((state) => {
                const variants = normalizeThemeVariants(state.settings.themes, state.settings.theme);
                const current = mode === 'dark' ? variants.dark : variants.light;
                const nextTheme: ProjectTheme = {
                    ...current,
                    colors: {...current.colors, ...patch}
                };
                const nextVariants = {
                    ...variants,
                    [mode]: nextTheme
                };
                return {
                    settings: syncLegacyTheme({
                        ...state.settings,
                        theme: mode === 'light' ? cloneTheme(nextTheme) : state.settings.theme,
                        themes: nextVariants
                    })
                }
            });
            markProjectDirty()
        },

        updateThemeTypography: (patch, mode = 'light') => {
            set((state) => {
                const variants = normalizeThemeVariants(state.settings.themes, state.settings.theme);
                const current = mode === 'dark' ? variants.dark : variants.light;
                const nextTheme: ProjectTheme = {
                    ...current,
                    typography: {...current.typography, ...patch}
                };
                const nextVariants = {
                    ...variants,
                    [mode]: nextTheme
                };
                return {
                    settings: syncLegacyTheme({
                        ...state.settings,
                        theme: mode === 'light' ? cloneTheme(nextTheme) : state.settings.theme,
                        themes: nextVariants
                    })
                }
            });
            markProjectDirty()
        },

        updateThemeSpacing: (patch, mode = 'light') => {
            set((state) => {
                const variants = normalizeThemeVariants(state.settings.themes, state.settings.theme);
                const current = mode === 'dark' ? variants.dark : variants.light;
                const nextTheme: ProjectTheme = {
                    ...current,
                    spacing: {...current.spacing, ...patch}
                };
                const nextVariants = {
                    ...variants,
                    [mode]: nextTheme
                };
                return {
                    settings: syncLegacyTheme({
                        ...state.settings,
                        theme: mode === 'light' ? cloneTheme(nextTheme) : state.settings.theme,
                        themes: nextVariants
                    })
                }
            });
            markProjectDirty()
        },

        updateThemeBorders: (patch, mode = 'light') => {
            set((state) => {
                const variants = normalizeThemeVariants(state.settings.themes, state.settings.theme);
                const current = mode === 'dark' ? variants.dark : variants.light;
                const nextTheme: ProjectTheme = {
                    ...current,
                    borders: {...current.borders, ...patch}
                };
                const nextVariants = {
                    ...variants,
                    [mode]: nextTheme
                };
                return {
                    settings: syncLegacyTheme({
                        ...state.settings,
                        theme: mode === 'light' ? cloneTheme(nextTheme) : state.settings.theme,
                        themes: nextVariants
                    })
                }
            });
            markProjectDirty()
        },

        setThemeCustomCss: (css) => {
            set((state) => {
                const variants = normalizeThemeVariants(state.settings.themes, state.settings.theme);
                const nextVariants = {
                    ...variants,
                    light: {...variants.light, customCss: css},
                    dark: {...variants.dark, customCss: css}
                };
                return {
                    settings: syncLegacyTheme({
                        ...state.settings,
                        theme: {...nextVariants.light},
                        themes: nextVariants
                    })
                }
            });
            markProjectDirty()
        },

        setThemePreviewMode: (mode) => {
            set((state) => {
                const variants = normalizeThemeVariants(state.settings.themes, state.settings.theme);
                return {
                    settings: syncLegacyTheme({
                        ...state.settings,
                        themes: {...variants, previewMode: mode}
                    })
                }
            });
            markProjectDirty()
        },

        // ─── Custom preset management ────────────────────────────────────

        addCustomPreset: (preset) => {
            set((state) => {
                const index = state.customPresets.findIndex((p) => p.name === preset.name);
                if (index >= 0) {
                    const next = [...state.customPresets];
                    next[index] = {...next[index], ...preset, isCustom: true};
                    return {customPresets: next}
                }
                return {customPresets: [...state.customPresets, {...preset, isCustom: true}]}
            });
            markProjectDirty()
        },

        updateCustomPreset: (name, patch) => {
            set((state) => ({
                customPresets: state.customPresets.map((p) =>
                    p.name === name ? {...p, ...patch, isCustom: true} : p
                )
            }));
            markProjectDirty()
        },

        deleteCustomPreset: (name) => {
            set((state) => ({
                customPresets: state.customPresets.filter((p) => p.name !== name)
            }));
            markProjectDirty()
        },

        // ─── Font management ─────────────────────────────────────────────

        addFonts: (assets) => {
            set((state) => {
                const next = [...state.fonts];
                for (const asset of assets) {
                    if (!next.some((f) => f.id === asset.id)) {
                        next.push(asset)
                    }
                }
                return {fonts: next}
            });
            markProjectDirty()
        },

        removeFont: (id) => {
            set((state) => ({
                fonts: state.fonts.filter((f) => f.id !== id)
            }));
            markProjectDirty()
        },

        setFonts: (assets) => {
            set({fonts: assets});
            markProjectDirty()
        },

        // ─── CSS file management ─────────────────────────────────────────

        addCssFile: (name) => {
            const file: CssFile = {
                id: generateBlockId(),
                name,
                css: '',
                enabled: true
            };
            set((state) => ({
                settings: {
                    ...state.settings,
                    theme: {
                        ...state.settings.theme,
                        customCssFiles: [...(state.settings.theme.customCssFiles || []), file]
                    },
                    themes: {
                        ...normalizeThemeVariants(state.settings.themes, state.settings.theme),
                        light: {
                            ...normalizeThemeVariants(state.settings.themes, state.settings.theme).light,
                            customCssFiles: [...(normalizeThemeVariants(state.settings.themes, state.settings.theme).light.customCssFiles || []), file]
                        },
                        dark: {
                            ...normalizeThemeVariants(state.settings.themes, state.settings.theme).dark,
                            customCssFiles: [...(normalizeThemeVariants(state.settings.themes, state.settings.theme).dark.customCssFiles || []), {...file}]
                        }
                    }
                }
            }));
            markProjectDirty();
            return file
        },

        removeCssFile: (id) => {
            set((state) => ({
                settings: {
                    ...state.settings,
                    theme: {
                        ...state.settings.theme,
                        customCssFiles: (state.settings.theme.customCssFiles || []).filter((f) => f.id !== id)
                    },
                    themes: {
                        ...normalizeThemeVariants(state.settings.themes, state.settings.theme),
                        light: {
                            ...normalizeThemeVariants(state.settings.themes, state.settings.theme).light,
                            customCssFiles: (normalizeThemeVariants(state.settings.themes, state.settings.theme).light.customCssFiles || []).filter((f) => f.id !== id)
                        },
                        dark: {
                            ...normalizeThemeVariants(state.settings.themes, state.settings.theme).dark,
                            customCssFiles: (normalizeThemeVariants(state.settings.themes, state.settings.theme).dark.customCssFiles || []).filter((f) => f.id !== id)
                        }
                    }
                }
            }));
            markProjectDirty()
        },

        updateCssFile: (id, patch) => {
            set((state) => ({
                settings: {
                    ...state.settings,
                    theme: {
                        ...state.settings.theme,
                        customCssFiles: (state.settings.theme.customCssFiles || []).map((f) =>
                            f.id === id ? {...f, ...patch} : f
                        )
                    },
                    themes: {
                        ...normalizeThemeVariants(state.settings.themes, state.settings.theme),
                        light: {
                            ...normalizeThemeVariants(state.settings.themes, state.settings.theme).light,
                            customCssFiles: (normalizeThemeVariants(state.settings.themes, state.settings.theme).light.customCssFiles || []).map((f) =>
                                f.id === id ? {...f, ...patch} : f
                            )
                        },
                        dark: {
                            ...normalizeThemeVariants(state.settings.themes, state.settings.theme).dark,
                            customCssFiles: (normalizeThemeVariants(state.settings.themes, state.settings.theme).dark.customCssFiles || []).map((f) =>
                                f.id === id ? {...f, ...patch} : f
                            )
                        }
                    }
                }
            }));
            markProjectDirty()
        },

        reorderCssFiles: (fromIndex, toIndex) => {
            set((state) => {
                const variants = normalizeThemeVariants(state.settings.themes, state.settings.theme);
                const reorder = (files: CssFile[]) => {
                    const next = [...files];
                    const [moved] = next.splice(fromIndex, 1);
                    next.splice(toIndex, 0, moved);
                    return next
                };
                const files = reorder(state.settings.theme.customCssFiles || []);
                return {
                    settings: {
                        ...state.settings,
                        theme: {...state.settings.theme, customCssFiles: files},
                        themes: {
                            ...variants,
                            light: {...variants.light, customCssFiles: reorder(variants.light.customCssFiles || [])},
                            dark: {...variants.dark, customCssFiles: reorder(variants.dark.customCssFiles || [])}
                        }
                    }
                }
            });
            markProjectDirty()
        },

        toggleCssFile: (id) => {
            set((state) => ({
                settings: {
                    ...state.settings,
                    theme: {
                        ...state.settings.theme,
                        customCssFiles: (state.settings.theme.customCssFiles || []).map((f) =>
                            f.id === id ? {...f, enabled: !f.enabled} : f
                        )
                    },
                    themes: {
                        ...normalizeThemeVariants(state.settings.themes, state.settings.theme),
                        light: {
                            ...normalizeThemeVariants(state.settings.themes, state.settings.theme).light,
                            customCssFiles: (normalizeThemeVariants(state.settings.themes, state.settings.theme).light.customCssFiles || []).map((f) =>
                                f.id === id ? {...f, enabled: !f.enabled} : f
                            )
                        },
                        dark: {
                            ...normalizeThemeVariants(state.settings.themes, state.settings.theme).dark,
                            customCssFiles: (normalizeThemeVariants(state.settings.themes, state.settings.theme).dark.customCssFiles || []).map((f) =>
                                f.id === id ? {...f, enabled: !f.enabled} : f
                            )
                        }
                    }
                }
            }));
            markProjectDirty()
        },

        // ─── Page management ─────────────────────────────────────────────

        addPage: (title, slug) => {
            const state = get();
            const base = normalizeSlug(slug ?? title) || 'page';
            const unique = ensureUniqueSlug(base, state.pages);
            const created = createDefaultPage(title, unique);
            created.blocks = createPageHeaderBlock(title) as any;

            set((s) => {
                const counts = {...s.metaKeyCounts};
                addMetaKeysToCounts(counts, created.meta);
                return {
                    pages: [...s.pages, created],
                    currentPageId: created.id,
                    metaKeyCounts: counts,
                    uniqueMetaKeys: sortedMetaKeysFromCounts(counts)
                }
            });

            return created
        },

        removePage: (id) => {
            set((state) => {
                const removed = state.pages.find((p) => p.id === id);
                const filtered = state.pages.filter((p) => p.id !== id);
                if (filtered.length === 0) {
                    const newPage = createDefaultPage();
                    const counts = buildMetaKeyCounts([newPage]);
                    return {
                        pages: [newPage],
                        currentPageId: newPage.id,
                        metaKeyCounts: counts,
                        uniqueMetaKeys: sortedMetaKeysFromCounts(counts)
                    }
                }
                const newCurrentId = state.currentPageId === id ? filtered[0].id : state.currentPageId;
                const counts = {...state.metaKeyCounts};
                if (removed) removeMetaKeysFromCounts(counts, removed.meta);
                return {
                    pages: filtered,
                    currentPageId: newCurrentId,
                    metaKeyCounts: counts,
                    uniqueMetaKeys: sortedMetaKeysFromCounts(counts)
                }
            })
        },

        updatePage: (id, patch) => {
            set((state) => {
                if (!patch.meta) {
                    return {
                        pages: state.pages.map((p) => (p.id === id ? {...p, ...patch} : p))
                    }
                }

                const counts = {...state.metaKeyCounts};

                const pages = state.pages.map((p) => {
                    if (p.id !== id) return p;
                    removeMetaKeysFromCounts(counts, p.meta);
                    addMetaKeysToCounts(counts, patch.meta);
                    return {...p, ...patch}
                });

                return {
                    pages,
                    metaKeyCounts: counts,
                    uniqueMetaKeys: sortedMetaKeysFromCounts(counts)
                }
            })
        },

        setCurrentPage: (id) => {
            set({currentPageId: id})
        },

        getCurrentPage: () => {
            const state = get();
            return state.pages.find((p) => p.id === state.currentPageId) ?? null
        },

        reorderPages: (fromIndex, toIndex) => {
            set((state) => {
                const pages = [...state.pages];
                const [moved] = pages.splice(fromIndex, 1);
                pages.splice(toIndex, 0, moved);
                return {pages}
            })
        },

        // ─── Folder management ───────────────────────────────────────────

        addFolder: (name, tags) => {
            const folder: PageFolder = {
                id: generateBlockId(),
                name,
                tags: tags && tags.length > 0 ? tags : undefined
            };
            set((state) => ({
                folders: [...state.folders, folder]
            }));
            return folder
        },

        removeFolder: (id) => {
            set((state) => ({
                folders: state.folders.filter((f) => f.id !== id),
                // Unset folderId on pages that belonged to this folder
                pages: state.pages.map((p) =>
                    p.folderId === id ? {...p, folderId: undefined} : p
                )
            }))
        },

        updateFolder: (id, patch) => {
            set((state) => ({
                folders: state.folders.map((f) => (f.id === id ? {...f, ...patch} : f))
            }))
        },

        getEffectiveTags: (page) => {
            const state = get();
            const ownTags = page.tags ?? [];
            if (!page.folderId) return ownTags;

            const folder = state.folders.find((f) => f.id === page.folderId);
            if (!folder || !folder.tags || folder.tags.length === 0) return ownTags;

            // Merge and deduplicate
            return Array.from(new Set([...ownTags, ...folder.tags]))
        },

        // ─── User Blocks ─────────────────────────────────────────────────

        addUserBlock: (block) => {
            set((state) => ({
                userBlocks: [...state.userBlocks, block]
            }))
        },

        removeUserBlock: (id) => {
            set((state) => ({
                userBlocks: state.userBlocks.filter((b) => b.id !== id)
            }))
        }
    }
});

// When the user exits tab edit mode in the editor, immediately flush the merged
// block tree back into projectStore so App.tsx cannot reload a stale snapshot.
setOnExitTabEditModeCallback((mergedBlocks) => {
    const ps = useProjectStore.getState();
    if (ps.currentPageId) {
        ps.updatePage(ps.currentPageId, {blocks: mergedBlocks})
    }
});
