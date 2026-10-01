import {expect, it, vi} from 'vitest'

const events = vi.hoisted((): string[] => [])

vi.mock('../registry/registerBlocks', () => ({
    registerBlocks: () => {events.push('blocks')}
}))
vi.mock('../store/appSettingsStore', () => ({
    useAppSettingsStore: {getState: () => ({loadSettings: () => {events.push('settings')}})}
}))
vi.mock('../aiBootstrap', () => ({
    preloadAiModels: () => {events.push('ai-preload'); return Promise.resolve()}
}))
vi.mock('../App', () => ({default: () => null}))
vi.mock('react-dom/client', () => ({
    default: {createRoot: () => ({render: () => {events.push('render')}})}
}))

it('starts AI preprocessing before rendering the welcome screen', async () => {
    document.body.innerHTML = '<div id="root"></div>'
    await import('../main')

    expect(events).toEqual(['blocks', 'settings', 'ai-preload', 'render'])
})
