import {beforeEach, describe, expect, it} from 'vitest'
import {useEditorStore} from '../../store/editorStore'
import {useProjectStore} from '../../store/projectStore'
import {type Block, createBlock, createDefaultTheme, type ProjectData} from '../../store/types'
import {exportProject} from '../../utils/exportEngine'

/**
 * Integration tests for core workflows.
 * 
 * Note: These tests use the actual Zustand stores. Due to Zustand's closure-based
 * architecture, store state persists between tests. Tests are designed to be
 * independent but may show ordering dependencies.
 */

describe('Integration: Code Editor ↔ Canvas Sync', () => {
  beforeEach(() => {
    // Reset stores to known state
    useEditorStore.setState({
      blocks: [],
      selectedBlockId: null,
      hoveredBlockId: null,
      history: [{ blocks: [], timestamp: Date.now() }],
      historyIndex: 0,
      isDirty: false,
      isDragging: false,
      isTypingCode: false,
      customCss: '',
      viewportMode: 'desktop',
      zoom: 100,
      theme: 'dark',
      clipboard: null
    })
  });

  it('setPageBlocks updates canvas state', () => {
    const store = useEditorStore.getState();
    const blocks: Block[] = [
      createBlock('heading', { props: { text: 'Hello', level: 1 } }),
      createBlock('paragraph', { props: { text: 'World' } })
    ];
    
    store.setPageBlocks(blocks);
    
    const updated = useEditorStore.getState();
    expect(updated.blocks).toHaveLength(2);
    expect(updated.blocks[0].type).toBe('heading');
    expect(updated.blocks[1].type).toBe('paragraph');
    expect(updated.isDirty).toBe(true)
  });

  it('block operations create history entries', () => {
    const store = useEditorStore.getState();
    
    // Initial history has one entry
    expect(store.history).toHaveLength(1);
    
    // Add a block
    const block = createBlock('container');
    store.addBlock(block);
    
    const afterAdd = useEditorStore.getState();
    expect(afterAdd.history.length).toBeGreaterThan(0);
    expect(afterAdd.isDirty).toBe(true)
  })
});

describe('Integration: Save/Load Round-trip', () => {
  beforeEach(() => {
    useProjectStore.setState({
      settings: {
        name: 'Test Project',
        framework: 'bootstrap-5',
        theme: createDefaultTheme(),
        globalStyles: {}
      },
      pages: [{
        id: 'page-1',
        title: 'Home',
        slug: 'index',
        blocks: [],
        meta: {}
      }],
      userBlocks: [],
      currentPageId: 'page-1',
      filePath: null,
      isProjectLoaded: true
    });
    
    useEditorStore.setState({
      blocks: [createBlock('heading', { props: { text: 'Saved', level: 1 } })],
      selectedBlockId: null,
      hoveredBlockId: null,
      history: [{ blocks: [], timestamp: Date.now() }],
      historyIndex: 0,
      isDirty: false,
      isDragging: false,
      isTypingCode: false,
      customCss: 'body { margin: 0; }',
      viewportMode: 'desktop',
      zoom: 100,
      theme: 'dark',
      clipboard: null
    })
  });

  it('exports complete project data including custom CSS', () => {
    const projectStore = useProjectStore.getState();
    const editorStore = useEditorStore.getState();
    
    // Update page with current blocks
    projectStore.updatePage('page-1', { blocks: editorStore.blocks });
    
    const data = projectStore.getProjectData();
    
    expect(data.projectSettings.name).toBe('Test Project');
    expect(data.pages).toHaveLength(1);
    expect(data.pages[0].blocks).toHaveLength(1);
    expect(data.pages[0].blocks[0].type).toBe('heading')
  });

  it('imports project and restores state', () => {
    const projectData: ProjectData = {
      projectSettings: {
        name: 'Imported',
        framework: 'bootstrap-5',
        theme: createDefaultTheme(),
        globalStyles: { 'body-font': 'Arial' }
      },
      pages: [
        {
          id: 'imported-page',
          title: 'Imported Page',
          slug: 'imported',
          blocks: [createBlock('paragraph', { props: { text: 'Imported content' } })],
          meta: { title: 'Page Title' }
        }
      ],
      userBlocks: []
    };
    
    const projectStore = useProjectStore.getState();
    projectStore.setProject(projectData, '/path/to/file.hoarses');
    
    const afterImport = useProjectStore.getState();
    expect(afterImport.settings.name).toBe('Imported');
    expect(afterImport.pages).toHaveLength(1);
    expect(afterImport.currentPageId).toBe('imported-page');
    expect(afterImport.filePath).toBe('/path/to/file.hoarses');
    expect(afterImport.isProjectLoaded).toBe(true)
  })
});

describe('Integration: Export Engine', () => {
  it('exports clean HTML without editor artifacts', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Export Test',
        framework: 'vanilla',
        theme: createDefaultTheme(),
        globalStyles: {}
      },
      pages: [
        {
          id: 'p1',
          title: 'Index',
          slug: 'index',
          blocks: [
            createBlock('heading', { props: { text: 'Title', level: 1 }, classes: ['main-title'] }),
            createBlock('paragraph', { props: { text: 'Content' } })
          ],
          meta: {}
        }
      ],
      userBlocks: []
    };
    
    const files = await exportProject(project);
    
    const htmlFile = files.find(f => f.path === 'index.html');
    expect(htmlFile).toBeDefined();
    expect(typeof htmlFile?.content).toBe('string');
    
    const html = htmlFile?.content as string;
    
    // Should contain the content
    expect(html).toContain('Title');
    expect(html).toContain('Content');
    expect(html).toContain('main-title');
    
    // Should NOT contain editor artifacts
    expect(html).not.toContain('data-block-id');
    expect(html).not.toContain('editor-overlay')
  });

  it('handles custom CSS in export', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'CSS Test',
        framework: 'vanilla',
        theme: createDefaultTheme(),
        globalStyles: {}
      },
      pages: [{
        id: 'p1',
        title: 'Index',
        slug: 'index',
        blocks: [createBlock('container')],
        meta: {}
      }],
      userBlocks: []
    };
    
    const files = await exportProject(project, {
      customCss: 'body { background: red; }'
    });
    
    // Custom CSS is included in the external styles.css alongside theme CSS
    const cssFile = files.find(f => f.path === 'styles.css');
    expect(cssFile).toBeDefined();
    const css = cssFile?.content as string;
    expect(css).toContain('body { background: red; }');
    // Theme variables should also be present
    expect(css).toContain('--theme-primary');
    
    // HTML should reference the stylesheet
    const htmlFile = files.find(f => f.path === 'index.html');
    const html = htmlFile?.content as string;
    expect(html).toContain('styles.css')
  })
});

describe('Integration: Multi-page Workflow', () => {
  beforeEach(() => {
    useProjectStore.setState({
      settings: {
        name: 'Multi-page',
        framework: 'bootstrap-5',
        theme: createDefaultTheme(),
        globalStyles: {}
      },
      pages: [
        { id: 'home', title: 'Home', slug: 'index', blocks: [], meta: {} },
        { id: 'about', title: 'About', slug: 'about', blocks: [], meta: {} }
      ],
      userBlocks: [],
      currentPageId: 'home',
      filePath: null,
      isProjectLoaded: true
    })
  });

  it('switches between pages', () => {
    const store = useProjectStore.getState();
    
    expect(store.currentPageId).toBe('home');
    
    store.setCurrentPage('about');
    
    const afterSwitch = useProjectStore.getState();
    expect(afterSwitch.currentPageId).toBe('about');
    expect(afterSwitch.getCurrentPage()?.title).toBe('About')
  });

  it('maintains separate blocks per page', () => {
    const projectStore = useProjectStore.getState();
    const homeBlocks = [createBlock('heading', { props: { text: 'Home Page' } })];
    const aboutBlocks = [createBlock('heading', { props: { text: 'About Page' } })];
    
    projectStore.updatePage('home', { blocks: homeBlocks });
    projectStore.updatePage('about', { blocks: aboutBlocks });
    
    const updated = useProjectStore.getState();
    expect(updated.pages[0].blocks[0].props.text).toBe('Home Page');
    expect(updated.pages[1].blocks[0].props.text).toBe('About Page')
  })
});
