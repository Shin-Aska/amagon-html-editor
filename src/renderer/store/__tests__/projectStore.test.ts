import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from '../../store/projectStore'
import { createBlock, createDefaultTheme } from '../../store/types'
import type { UserBlock } from '../../store/types'

// Initial state for resetting store between tests
const initialProjectState = {
  settings: {
    name: 'Untitled Project',
    framework: 'bootstrap-5' as const,
    theme: createDefaultTheme(),
    globalStyles: {}
  },
  pages: [{
    id: 'default-page',
    title: 'Home',
    slug: 'index',
    blocks: [],
    meta: {
      description: '',
      charset: 'UTF-8',
      viewport: 'width=device-width, initial-scale=1.0'
    }
  }],
  userBlocks: [],
  currentPageId: 'default-page',
  filePath: null,
  isProjectLoaded: false
}

describe('projectStore', () => {
  let store: ReturnType<typeof useProjectStore.getState>
  const get = () => useProjectStore.getState()

  beforeEach(() => {
    useProjectStore.setState(initialProjectState)
    store = get()
  })

  describe('project settings', () => {
    it('updates project name', () => {
      store.updateSettings({ name: 'My Project' })
      expect(get().settings.name).toBe('My Project')
    })

    it('updates theme', () => {
      const darkTheme = { ...createDefaultTheme(), name: 'Dark' }
      store.updateSettings({ theme: darkTheme })
      expect(get().settings.theme.name).toBe('Dark')
    })

    it('updates framework', () => {
      store.setFramework('vanilla')
      expect(get().settings.framework).toBe('vanilla')
    })

    it('merges partial settings', () => {
      store.updateSettings({ name: 'New Name' })
      expect(get().settings.framework).toBe('bootstrap-5')
    })
  })

  describe('pages', () => {
    it('adds a new page', () => {
      const page = store.addPage('About')
      
      expect(get().pages).toHaveLength(2) // Default page + new page
      expect(page.title).toBe('About')
      expect(page.slug).toBe('about')
    })

    it('generates unique slugs for duplicate titles', () => {
      store.addPage('About')
      store.addPage('About')
      
      expect(get().pages[1].slug).toBe('about')
      expect(get().pages[2].slug).toBe('about-1')
    })

    it('removes a page', () => {
      const page = store.addPage('About')
      store.removePage(page.id)
      
      expect(get().pages.find((p) => p.id === page.id)).toBeUndefined()
    })

    it('prevents removing the last page', () => {
      const initialPages = store.pages.length
      store.removePage(store.pages[0].id)
      
      // Should create a new default page when removing the last one
      expect(get().pages).toHaveLength(1)
      expect(get().pages[0].title).toBe('Home')
    })

    it('switches current page', () => {
      const page = store.addPage('About')
      store.setCurrentPage(page.id)
      
      expect(get().currentPageId).toBe(page.id)
    })

    it('updates page blocks', () => {
      const block = createBlock('heading', { props: { text: 'Test', level: 1 } })
      store.updatePage(store.pages[0].id, { blocks: [block] })
      
      expect(get().pages[0].blocks).toHaveLength(1)
      expect(get().pages[0].blocks[0].type).toBe('heading')
    })

    it('updates page meta', () => {
      store.updatePage(store.pages[0].id, { 
        meta: { title: 'Custom Title', description: 'Desc' } 
      })
      
      expect(get().pages[0].meta.title).toBe('Custom Title')
      expect(get().pages[0].meta.description).toBe('Desc')
    })

    it('gets current page', () => {
      const current = store.getCurrentPage()
      expect(current).toBeDefined()
      expect(current?.id).toBe(get().currentPageId)
    })
  })

  describe('user blocks', () => {
    it('adds a user block', () => {
      const block = createBlock('container', { classes: ['my-component'] })
      const userBlock = { id: 'ub-1', label: 'My Component', content: block }
      store.addUserBlock(userBlock)
      
      expect(get().userBlocks).toHaveLength(1)
      expect(get().userBlocks[0].label).toBe('My Component')
    })

    it('removes a user block', () => {
      const block = createBlock('container')
      const userBlock = { id: 'ub-2', label: 'To Remove', content: block }
      store.addUserBlock(userBlock)
      
      store.removeUserBlock('ub-2')
      
      expect(get().userBlocks).toHaveLength(0)
    })
  })

  describe('project data import/export', () => {
    it('exports complete project data', () => {
      store.updateSettings({ name: 'Test Project' })
      store.addPage('About')
      
      const data = store.getProjectData()
      
      expect(data.projectSettings.name).toBe('Test Project')
      expect(data.pages).toHaveLength(2)
      expect(data.userBlocks).toEqual([])
    })

    it('imports project data', () => {
      const importData = {
        projectSettings: {
          name: 'Imported',
          framework: 'bootstrap-5' as const,
          theme: createDefaultTheme(),
          globalStyles: {}
        },
        pages: [
          {
            id: 'p-imported',
            title: 'Imported Page',
            slug: 'imported',
            meta: {},
            blocks: []
          }
        ],
        userBlocks: []
      }
      
      store.setProject(importData, '/path/to/project.hoarses')
      
      expect(get().settings.name).toBe('Imported')
      expect(get().pages).toHaveLength(1)
      expect(get().currentPageId).toBe('p-imported')
      expect(get().filePath).toBe('/path/to/project.hoarses')
    })

    it('creates default page when importing empty pages', () => {
      const importData = {
        projectSettings: {
          name: 'Empty',
          framework: 'vanilla' as const,
          theme: createDefaultTheme(),
          globalStyles: {}
        },
        pages: [],
        userBlocks: []
      }
      
      store.setProject(importData)
      
      expect(get().pages).toHaveLength(1)
      expect(get().pages[0].title).toBe('Home')
    })
  })

  describe('file path management', () => {
    it('sets file path', () => {
      store.setFilePath('/home/user/project.hoarses')
      expect(get().filePath).toBe('/home/user/project.hoarses')
    })

    it('marks project as loaded after import', () => {
      expect(get().isProjectLoaded).toBe(false)
      
      const importData = {
        projectSettings: {
          name: 'Test',
          framework: 'bootstrap-5' as const,
          theme: createDefaultTheme(),
          globalStyles: {}
        },
        pages: [{ id: 'p1', title: 'Page', slug: 'page', meta: {}, blocks: [] }],
        userBlocks: []
      }
      store.setProject(importData)
      
      expect(get().isProjectLoaded).toBe(true)
    })
  })
})
