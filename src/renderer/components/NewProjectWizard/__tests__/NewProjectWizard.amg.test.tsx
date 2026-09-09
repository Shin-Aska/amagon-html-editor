import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const controller = vi.hoisted(() => ({ newProject: vi.fn() }));
const browser = vi.hoisted(() => ({ new: vi.fn() }));

vi.mock('../../../project/projectCommands', () => ({ projectCommands: controller }));
vi.mock('../../../utils/api', () => ({ getLegacyBrowserProjectApi: () => browser }));

import NewProjectWizard from '../NewProjectWizard';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function setElectronRuntime(enabled: boolean): void {
  if (enabled) {
    Object.defineProperty(window, 'api', { configurable: true, value: {} });
    return;
  }
  Reflect.deleteProperty(window, 'api');
}

async function renderWizard(onClose = vi.fn()): Promise<{ readonly container: HTMLDivElement; readonly onClose: ReturnType<typeof vi.fn>; readonly unmount: () => void }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement(NewProjectWizard, { onClose })); });
  return {
    container,
    onClose,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  controller.newProject.mockResolvedValue({ ok: true, value: undefined });
  browser.new.mockResolvedValue({ success: false, canceled: true });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'api');
  document.body.replaceChildren();
});

describe('NewProjectWizard AMG project UX', () => {
  it('describes one .amg target and sends the new-project request through the controller', async () => {
    setElectronRuntime(true);
    const wizard = await renderWizard();
    const create = wizard.container.querySelector<HTMLButtonElement>('.npw-btn-create');

    expect(wizard.container.textContent).toContain('Creates one portable .amg project file.');
    await act(async () => { create?.click(); });

    expect(controller.newProject).toHaveBeenCalledWith({ name: 'My Website', framework: 'bootstrap-5' });
    expect(browser.new).not.toHaveBeenCalled();
    expect(wizard.onClose).toHaveBeenCalledOnce();
    wizard.unmount();
  });

  it('keeps the modal open on a canceled new-project dialog', async () => {
    setElectronRuntime(true);
    controller.newProject.mockResolvedValue({
      ok: false,
      canceled: true,
      message: { tone: 'info', title: 'Operation canceled', detail: 'No project changes were applied.', locations: [] },
    });
    const wizard = await renderWizard();
    const create = wizard.container.querySelector<HTMLButtonElement>('.npw-btn-create');

    await act(async () => { create?.click(); });

    expect(wizard.onClose).not.toHaveBeenCalled();
    expect(wizard.container.querySelector('.npw-modal')).not.toBeNull();
    wizard.unmount();
  });

  it('contains keyboard focus, closes on Escape, and restores the prior focus', async () => {
    setElectronRuntime(true);
    const launcher = document.createElement('button');
    document.body.appendChild(launcher);
    launcher.focus();
    const wizard = await renderWizard();
    const dialog = wizard.container.querySelector<HTMLElement>('[role="dialog"]');
    const nameInput = wizard.container.querySelector<HTMLInputElement>('#new-project-name');
    const close = wizard.container.querySelector<HTMLButtonElement>('.npw-close-btn');
    const create = wizard.container.querySelector<HTMLButtonElement>('.npw-btn-create');
    const radios = wizard.container.querySelectorAll<HTMLInputElement>('.npw-hidden-radio');

    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('new-project-title');
    expect(document.activeElement).toBe(nameInput);
    expect(radios[0]?.tabIndex).toBe(0);

    create?.focus();
    await act(async () => {
      create?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
    });
    expect(document.activeElement).toBe(close);

    close?.focus();
    await act(async () => {
      close?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab', shiftKey: true }));
    });
    expect(document.activeElement).toBe(create);

    await act(async () => {
      dialog?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    });
    expect(wizard.onClose).toHaveBeenCalledOnce();

    wizard.unmount();
    expect(document.activeElement).toBe(launcher);
    launcher.remove();
  });

  it('labels browser development as legacy JSON while creating through the canonical session controller', async () => {
    setElectronRuntime(false);
    const wizard = await renderWizard();
    const create = wizard.container.querySelector<HTMLButtonElement>('.npw-btn-create');

    expect(wizard.container.textContent).toContain('Browser preview creates a legacy JSON project only.');
    await act(async () => { create?.click(); });

    expect(controller.newProject).toHaveBeenCalledWith({ name: 'My Website', framework: 'bootstrap-5' });
    expect(browser.new).not.toHaveBeenCalled();
    expect(wizard.onClose).toHaveBeenCalledOnce();
    wizard.unmount();
  });
});
