import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {extractFile} from '@electron/asar';
import {LINUX_ICON_SIZES, pngSize} from './linuxIconContract.mjs';

const candidates = process.argv[2] ? [process.argv[2]] : readdirSync('release').filter(file => file.endsWith('.deb')).map(file => path.join('release', file));
assert.equal(candidates.length, 1, 'Specify exactly one Debian package to verify');
const deb = candidates[0];
assert(deb?.endsWith('.deb'), 'Usage: node scripts/check-linux-package.mjs [path/to/package.deb]');
const root = mkdtempSync(path.join(os.tmpdir(), 'amagon-deb-check-'));
try {
  execFileSync('dpkg-deb', ['--extract', path.resolve(deb), root]);
  const applications = path.join(root, 'usr/share/applications');
  const entries = readdirSync(applications).filter(file => file.endsWith('.desktop'));
  assert.equal(entries.length, 1, 'Expected exactly one application desktop entry');
  const desktopName = entries[0];
  const desktop = Object.fromEntries(readFileSync(path.join(applications, desktopName), 'utf8').split(/\r?\n/u).filter(line => /^[A-Za-z]/u.test(line) && line.includes('=')).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  const id = desktopName.slice(0, -'.desktop'.length);
  assert.equal(desktop.Type, 'Application');
  assert.equal(desktop.Icon, id, 'Launcher icon name must match the application identity');
  for (const size of LINUX_ICON_SIZES) {
    const file = path.join(root, `usr/share/icons/hicolor/${size}x${size}/apps/${desktop.Icon}.png`);
    assert(existsSync(file), `Package is missing the ${size}px launcher icon`);
    assert.deepEqual(pngSize(readFileSync(file)), {width: size, height: size}, `Packaged ${size}px icon has incorrect dimensions`);
  }
  assert.equal(desktop.StartupWMClass, id, 'Running windows must associate with the installed desktop entry');
  const executable = /^"([^"]+)"(?:\s|$)|^(\S+)/u.exec(desktop.Exec ?? '');
  assert(executable, 'Desktop entry must have an executable');
  const program = executable[1] ?? executable[2];
  assert(program.startsWith('/opt/') && !program.split('/').includes('..'), 'Expected an installed application under /opt');
  assert(existsSync(path.join(root, program.slice(1))), 'Desktop entry points to a missing executable');
  const archive = path.join(root, path.dirname(program).slice(1), 'resources/app.asar');
  const metadata = JSON.parse(extractFile(archive, 'package.json').toString());
  assert.equal(metadata.desktopName, desktopName, 'Electron desktopName must match the launcher for X11/Wayland association');
  console.log(JSON.stringify({package: path.basename(deb), desktopName, icon: desktop.Icon, sizes: LINUX_ICON_SIZES, windowAssociation: 'matched', version: metadata.version}));
} finally {
  rmSync(root, {recursive: true, force: true});
}
