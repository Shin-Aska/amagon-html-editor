import { Menu, type BrowserWindow } from 'electron'

const isMac = process.platform === 'darwin'
const mod = isMac ? 'Cmd' : 'Ctrl'

export function buildAppMenu(mainWindow: BrowserWindow): Menu {
  const send = (action: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('menu:action', action)
    }
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    // ── File ────────────────────────────────────────────────
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('new-project')
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: () => send('open-project')
        },
        {
          label: 'Close Project',
          accelerator: `${mod}+W`,
          click: () => send('close-project')
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('save')
        },
        {
          label: 'Save As',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send('save-as')
        },
        { type: 'separator' },
        {
          label: 'Export',
          accelerator: 'CmdOrCtrl+E',
          click: () => send('export')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },

    // ── Edit ────────────────────────────────────────────────
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => send('undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => send('redo')
        },
        { type: 'separator' },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => send('cut')
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => send('copy')
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => send('paste')
        },
        {
          label: 'Duplicate',
          accelerator: 'CmdOrCtrl+D',
          click: () => send('duplicate')
        },
        { type: 'separator' },
        {
          label: 'Delete',
          accelerator: 'Delete',
          click: () => send('delete')
        }
      ]
    },

    // ── View ────────────────────────────────────────────────
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+\\',
          click: () => send('toggle-sidebar')
        },
        {
          label: 'Toggle Inspector',
          accelerator: 'CmdOrCtrl+/',
          click: () => send('toggle-inspector')
        },
        {
          label: 'Toggle Code Editor',
          accelerator: 'CmdOrCtrl+E',
          click: () => send('toggle-code-editor')
        },
        { type: 'separator' },
        {
          label: 'Command Palette',
          accelerator: 'CmdOrCtrl+K',
          click: () => send('command-palette')
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          role: 'zoomIn'
        },
        {
          label: 'Zoom Out',
          role: 'zoomOut'
        },
        {
          label: 'Reset Zoom',
          role: 'resetZoom'
        },
        { type: 'separator' },
        {
          label: 'Toggle Full Screen',
          role: 'togglefullscreen'
        }
      ]
    },

    // ── Help ────────────────────────────────────────────────
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+?',
          click: () => send('keyboard-shortcuts')
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          role: 'toggleDevTools'
        },
        {
          label: 'About Hoarses',
          click: () => send('about')
        }
      ]
    }
  ]

  // macOS: prepend app menu
  if (isMac) {
    template.unshift({
      label: 'Hoarses',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  return Menu.buildFromTemplate(template)
}
