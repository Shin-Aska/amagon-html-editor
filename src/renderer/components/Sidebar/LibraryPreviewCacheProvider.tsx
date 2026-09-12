import {createContext, useContext, useLayoutEffect, useState, type ReactNode} from 'react'
import {useAppSettingsStore} from '../../store/appSettingsStore'
import {useProjectCommandState} from '../../project/projectCommands'
import {LibraryPreviewCache} from './libraryPreviewCache'

const CacheContext = createContext<LibraryPreviewCache | null>(null)

function ProjectPreviewCache({children}: {readonly children: ReactNode}): JSX.Element {
    const capacity = useAppSettingsStore(state => state.libraryPreviewCacheSlots)
    const mode = useAppSettingsStore(state => state.libraryPreviewMode)
    const [cache] = useState(() => new LibraryPreviewCache(capacity))
    useLayoutEffect(() => {
        cache.setCapacity(capacity)
        if (mode === 'classic') cache.clear()
    }, [cache, capacity, mode])
    useLayoutEffect(() => () => cache.clear(), [cache])
    return <CacheContext.Provider value={cache}>{children}</CacheContext.Provider>
}

export function LibraryPreviewCacheProvider({children}: {readonly children: ReactNode}): JSX.Element {
    const sessionId = useProjectCommandState().session?.sessionId
    return <ProjectPreviewCache key={sessionId ?? 'no-project'}>{children}</ProjectPreviewCache>
}

export function useLibraryPreviewCache(): LibraryPreviewCache {
    const cache = useContext(CacheContext)
    if (!cache) throw new Error('Library previews require a project cache provider')
    return cache
}
