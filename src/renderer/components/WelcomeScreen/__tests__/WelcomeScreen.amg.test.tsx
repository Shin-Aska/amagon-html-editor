import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseRecentProjectId } from '../../../../shared/projects/projectIpcContract';
import {createDefaultTheme} from '../../../store/types';
import {parseBrowserRecentProject} from '../welcomeRecentModel';

const controller = vi.hoisted(() => ({
  getRecent: vi.fn(),
  openProject: vi.fn(),
  openRecent: vi.fn(),
  removeRecent: vi.fn(),
  commandState: { session: null, busy: null as null | 'open', progress: null, dirty: false, message: null },
}));
const browser = vi.hoisted(() => ({
  getRecent: vi.fn(),
  load: vi.fn(),
  loadFile: vi.fn(),
  removeRecent: vi.fn(),
}));

vi.mock('../../../project/projectCommands', () => ({
  projectCommands: controller,
  useProjectCommandState: () => controller.commandState,
}));
vi.mock('../../../utils/api', () => ({
  getApi: () => ({ app: { getVersion: async () => ({ success: true, version: '1.9.0' }) } }),
  getLegacyBrowserProjectApi: () => browser,
}));

import WelcomeScreen from '../WelcomeScreen';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const RECENT_AMG = parseRecentProjectId('11111111-1111-4111-8111-111111111111');
const RECENT_JSON = parseRecentProjectId('22222222-2222-4222-8222-222222222222');

function setElectronRuntime(enabled: boolean): void {
  if (enabled) {
    Object.defineProperty(window, 'api', { configurable: true, value: {} });
    return;
  }
  Reflect.deleteProperty(window, 'api');
}

async function settle(): Promise<void> {
  await act(async () => { await Promise.resolve(); });
}

async function renderWelcome(): Promise<{ readonly container: HTMLDivElement; readonly unmount: () => void }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement(WelcomeScreen)); });
  await settle();
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  controller.getRecent.mockResolvedValue({ success: true, projects: [] });
  controller.openProject.mockResolvedValue({ ok: true, value: undefined });
  controller.openRecent.mockResolvedValue({ ok: true, value: undefined });
  controller.removeRecent.mockImplementation(async (id) => ({ success: true, removedId: id }));
  controller.commandState = { session: null, busy: null, progress: null, dirty: false, message: null };
  browser.getRecent.mockResolvedValue({ success: true, projects: [] });
  browser.load.mockResolvedValue({ success: false, canceled: true });
  browser.loadFile.mockResolvedValue({ success: false, canceled: true });
  browser.removeRecent.mockResolvedValue({ success: true, projects: [] });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'api');
  document.body.replaceChildren();
});

describe('WelcomeScreen AMG project UX', () => {
  it('normalizes browser legacy content through the typed project boundary', () => {
    const project = parseBrowserRecentProject({
      projectSettings: {
        name: 'Browser Project',
        framework: 'vanilla',
        theme: createDefaultTheme(),
        globalStyles: {},
      },
      pages: [],
      userBlocks: [],
    });

    expect(project.customCss).toBe('');
    expect(project.projectSettings.name).toBe('Browser Project');
  });

  it('renders mixed metadata and sends only opaque IDs to Electron recent actions', async () => {
    setElectronRuntime(true);
    controller.getRecent.mockResolvedValue({
      success: true,
      projects: [
        { id: RECENT_AMG, name: 'Bundled', framework: 'vanilla', kind: 'amg', displayPath: 'C:\\work\\Bundled.amg' },
        { id: RECENT_JSON, name: 'Legacy', framework: 'bootstrap-5', kind: 'legacy-json', displayPath: 'C:\\work\\legacy.json' },
      ],
    });
    const screen = await renderWelcome();

    expect(screen.container.textContent).toContain('Bundled');
    expect(screen.container.textContent).toContain('C:\\work\\Bundled.amg');
    expect(screen.container.textContent).toContain('Legacy');
    expect(screen.container.textContent).toContain('C:\\work\\legacy.json');

    const rows = Array.from(screen.container.querySelectorAll<HTMLButtonElement>('.recent-item'));
    const removeButtons = Array.from(screen.container.querySelectorAll<HTMLButtonElement>('.recent-item-remove'));
    await act(async () => { rows[0]?.click(); });
    await act(async () => { removeButtons[1]?.click(); });

    expect(controller.openRecent).toHaveBeenCalledWith(RECENT_AMG);
    expect(controller.removeRecent).toHaveBeenCalledWith(RECENT_JSON);
    expect(controller.openRecent).not.toHaveBeenCalledWith('C:\\work\\Bundled.amg');
    expect(controller.removeRecent).not.toHaveBeenCalledWith('C:\\work\\legacy.json');
    screen.unmount();
  });

  it('keeps an unavailable recent visible with a removal affordance and never removes it automatically', async () => {
    setElectronRuntime(true);
    controller.getRecent.mockResolvedValue({
      success: true,
      projects: [{ id: RECENT_AMG, name: 'Unavailable', framework: 'vanilla', kind: 'amg', displayPath: 'C:\\gone\\Unavailable.amg' }],
    });
    controller.openRecent.mockResolvedValue({
      ok: false,
      canceled: false,
      message: { tone: 'error', title: 'Recent project not found', detail: 'Remove the missing entry or open the project manually.', locations: [] },
    });
    const screen = await renderWelcome();
    const recent = screen.container.querySelector<HTMLButtonElement>('.recent-item');

    await act(async () => { recent?.click(); });

    expect(recent?.disabled).toBe(true);
    expect(screen.container.textContent).toContain('Unavailable. Remove it from recents to dismiss this entry.');
    expect(controller.removeRecent).not.toHaveBeenCalled();
    screen.unmount();
  });

  it('leaves the current view unchanged when opening is canceled', async () => {
    setElectronRuntime(true);
    controller.openProject.mockResolvedValue({
      ok: false,
      canceled: true,
      message: { tone: 'info', title: 'Operation canceled', detail: 'No project changes were applied.', locations: [] },
    });
    const screen = await renderWelcome();
    const openButton = Array.from(screen.container.querySelectorAll<HTMLButtonElement>('.welcome-btn'))
      .find((button) => button.textContent?.includes('Open Project'));

    await act(async () => { openButton?.click(); });

    expect(screen.container.textContent).not.toContain('No project changes were applied.');
    screen.unmount();
  });

  it('opens browser JSON through the canonical controller so it owns the active session', async () => {
    setElectronRuntime(false);
    const screen = await renderWelcome();
    const openButton = Array.from(screen.container.querySelectorAll<HTMLButtonElement>('.welcome-btn'))
      .find((button) => button.textContent?.includes('Open Project'));

    await act(async () => { openButton?.click(); });

    expect(controller.openProject).toHaveBeenCalledOnce();
    expect(browser.load).not.toHaveBeenCalled();
    screen.unmount();
  });

  it('disables project activation controls while a canonical operation is busy', async () => {
    setElectronRuntime(true);
    controller.commandState = { session: null, busy: 'open', progress: null, dirty: false, message: null };
    controller.getRecent.mockResolvedValue({
      success: true,
      projects: [{ id: RECENT_AMG, name: 'Bundled', framework: 'vanilla', kind: 'amg', displayPath: 'C:\\work\\Bundled.amg' }],
    });
    const screen = await renderWelcome();
    const actions = Array.from(screen.container.querySelectorAll<HTMLButtonElement>('.welcome-btn'));
    const recent = screen.container.querySelector<HTMLButtonElement>('.recent-item');

    expect(actions.find((button) => button.textContent?.includes('New Project'))?.disabled).toBe(true);
    expect(actions.find((button) => button.textContent?.includes('Open Project'))?.disabled).toBe(true);
    expect(recent?.disabled).toBe(true);
    expect(screen.container.querySelector('.welcome-actions')?.getAttribute('aria-busy')).toBe('true');
    await act(async () => { actions[0]?.click(); });
    expect(screen.container.querySelector('[role="dialog"]')).toBeNull();
    screen.unmount();
  });

  it('uses the clearly labelled legacy JSON browser fallback without Electron authority', async () => {
    setElectronRuntime(false);
    browser.getRecent.mockResolvedValue({
      success: true,
      projects: [{ path: 'browser-project.json', name: 'Browser Project', framework: 'tailwind' }],
    });
    const screen = await renderWelcome();
    const recent = screen.container.querySelector<HTMLButtonElement>('.recent-item');

    await act(async () => { recent?.click(); });

    expect(browser.loadFile).toHaveBeenCalledWith('browser-project.json');
    expect(controller.openRecent).not.toHaveBeenCalled();
    screen.unmount();
  });
});
