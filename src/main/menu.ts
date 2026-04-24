import {type BrowserWindow, Menu} from 'electron'

const isMac = process.platform === 'darwin';
const mod = isMac ? 'Cmd' : 'Ctrl';

export function buildAppMenu(mainWindow: BrowserWindow, isProjectLoaded: boolean = false): Menu {
    const send = (action: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('menu:action', action)
        }
    };

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
                    enabled: isProjectLoaded,
                    click: () => send('close-project')
                },
                {type: 'separator'},
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    enabled: isProjectLoaded,
                    click: () => send('save')
                },
                {
                    label: 'Save As',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    enabled: isProjectLoaded,
                    click: () => send('save-as')
                },
                {type: 'separator'},
                {
                    label: 'Export',
                    accelerator: 'CmdOrCtrl+E',
                    enabled: isProjectLoaded,
                    click: () => send('export')
                },
                {
                    label: 'Publish to Web...',
                    accelerator: 'CmdOrCtrl+Shift+P',
                    enabled: isProjectLoaded,
                    click: () => send('publish')
                },
                {type: 'separator'},
                isMac ? {role: 'close'} : {role: 'quit'}
            ]
        },

        // ── Edit ────────────────────────────────────────────────
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: 'CmdOrCtrl+Z',
                    enabled: isProjectLoaded,
                    click: () => send('undo')
                },
                {
                    label: 'Redo',
                    accelerator: 'CmdOrCtrl+Shift+Z',
                    enabled: isProjectLoaded,
                    click: () => send('redo')
                },
                {type: 'separator'},
                {
                    label: 'Cut',
                    accelerator: 'CmdOrCtrl+X',
                    enabled: isProjectLoaded,
                    click: () => send('cut')
                },
                {
                    label: 'Copy',
                    accelerator: 'CmdOrCtrl+C',
                    enabled: isProjectLoaded,
                    click: () => send('copy')
                },
                {
                    label: 'Paste',
                    accelerator: 'CmdOrCtrl+V',
                    enabled: isProjectLoaded,
                    click: () => send('paste')
                },
                {
                    label: 'Duplicate',
                    accelerator: 'CmdOrCtrl+D',
                    enabled: isProjectLoaded,
                    click: () => send('duplicate')
                },
                {type: 'separator'},
                {
                    label: 'Delete',
                    accelerator: 'Delete',
                    enabled: isProjectLoaded,
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
                    enabled: isProjectLoaded,
                    click: () => send('toggle-sidebar')
                },
                {
                    label: 'Toggle Inspector',
                    accelerator: 'CmdOrCtrl+/',
                    enabled: isProjectLoaded,
                    click: () => send('toggle-inspector')
                },
                {
                    label: 'Toggle Code Editor',
                    accelerator: 'CmdOrCtrl+E',
                    enabled: isProjectLoaded,
                    click: () => send('toggle-code-editor')
                },
                {type: 'separator'},
                {
                    label: 'Command Palette',
                    accelerator: 'CmdOrCtrl+K',
                    enabled: isProjectLoaded,
                    click: () => send('command-palette')
                },
                {type: 'separator'},
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
                {type: 'separator'},
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
                {type: 'separator'},
                {
                    label: 'Toggle Developer Tools',
                    role: 'toggleDevTools'
                },
                {
                    label: 'About Amagon',
                    click: () => send('about')
                }
            ]
        }
    ];

    // macOS: prepend app menu
    if (isMac) {
        template.unshift({
            label: 'Amagon',
            submenu: [
                {role: 'about'},
                {type: 'separator'},
                {role: 'services'},
                {type: 'separator'},
                {role: 'hide'},
                {role: 'hideOthers'},
                {role: 'unhide'},
                {type: 'separator'},
                {role: 'quit'}
            ]
        })
    }

    return Menu.buildFromTemplate(template)
}
