import {useEffect, useState} from 'react'
import {projectCommands} from '../../project/projectCommands'
import {getApi, getLegacyBrowserProjectApi} from '../../utils/api'
import {
    normalizeBrowserRecentProjects,
    type RecentProjectView,
} from './welcomeRecentModel'

export function useWelcomeLaunchMetadata(isElectron: boolean) {
    const api = getApi()
    const legacyProjectApi = getLegacyBrowserProjectApi()
    const [recentProjects, setRecentProjects] = useState<RecentProjectView[]>([])
    const [appVersion, setAppVersion] = useState('')

    useEffect(() => {
        async function loadRecent(): Promise<void> {
            if (isElectron) {
                const result = await projectCommands.getRecent()
                if (result.success) {
                    setRecentProjects(result.projects.map((project) => ({source: 'electron', project})))
                }
                return
            }

            const result = await legacyProjectApi.getRecent()
            if (result.success && result.projects) {
                setRecentProjects(normalizeBrowserRecentProjects(result.projects).map((project) => ({source: 'browser', project})))
            }
        }

        void loadRecent()
    }, [])

    useEffect(() => {
        async function loadAppVersion(): Promise<void> {
            const result = await api.app.getVersion()
            if (result.success && typeof result.version === 'string') {
                setAppVersion(result.version)
            }
        }

        void loadAppVersion()
    }, [])

    return {appVersion, legacyProjectApi, recentProjects, setRecentProjects}
}
