# Post-Install Notes

## Windows

### Broken UI on debloated Windows builds (e.g. ReviOS)

Amagon targets standard Windows 10/11. Debloated builds like ReviOS aggressively remove system components that Electron/Chromium depends on — including Microsoft Edge, the WebView runtime, system fonts, and related services.

Symptoms on affected systems:

- Buttons or controls that don't respond to clicks
- Layout, fonts, or theming that look broken or incomplete
- Dialogs, external links, or embedded web content failing to open

**Fix:** Restore the missing components using the Revision Tool, paying particular attention to the Microsoft Edge/WebView runtime, system fonts, and GPU drivers. If the problem only appears on a debloated build but not on a standard Windows install, it is an OS-level issue outside Amagon's support scope.

---

## Linux

### Ubuntu 24.04 and later: Electron sandbox crash

Ubuntu 24.04 introduced a stricter AppArmor restriction on unprivileged user namespaces. Electron's sandbox requires this capability, so without a fix the AppImage will refuse to launch.

**Fix — apply once, persists across reboots:**

```bash
echo 'kernel.apparmor_restrict_unprivileged_userns=0' | sudo tee /etc/sysctl.d/60-apparmor-namespace.conf
sudo sysctl -p /etc/sysctl.d/60-apparmor-namespace.conf
```

This applies system-wide and covers all Electron-based apps (VS Code, etc.), not just Amagon.

#### Temporary workaround (until you apply the fix above)

Launch the AppImage with the `--no-sandbox` flag:

```bash
./Amagon-*.AppImage --no-sandbox
```

This is not recommended for regular use — it disables Chromium's renderer sandbox.

### Other Linux distributions

No additional steps are needed on most mainstream distributions. If you see a sandbox error similar to:

```
The SUID sandbox helper binary was found, but is not configured correctly.
```

...it means the `chrome-sandbox` binary does not have the correct ownership/permissions. This is uncommon with packaged releases but can happen on some configurations. In that case, contact support or file an issue.
