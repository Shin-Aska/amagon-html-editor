// @vitest-environment node
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {expect, it} from 'vitest';
import {LINUX_ICON_SIZES, pngSize, verifyIconSet} from './linuxIconContract.mjs';

it('provides square transparent Linux icons from 2048px down to 16px', () => {
  expect(LINUX_ICON_SIZES[0]).toBe(16);
  expect(LINUX_ICON_SIZES.at(-1)).toBe(2048);
  verifyIconSet(path.resolve('assets/icons'));
  for (const size of LINUX_ICON_SIZES) {
    const bytes = readFileSync(path.resolve(`assets/icons/${size}x${size}.png`));
    expect(bytes[25], `${size}px icon retains an alpha channel`).toBe(6);
  }
});

it('rejects the old non-square logo as a launcher icon source', () => {
  const old = pngSize(readFileSync(path.resolve('assets/app.png')));
  expect(old.width).not.toBe(old.height);
  const config = JSON.parse(readFileSync('package.json', 'utf8'));
  expect(config.build.linux.icon).not.toBe('assets/app.png');
});

it('keeps the launcher filename and Electron X11/Wayland identity synchronized', () => {
  const config = JSON.parse(readFileSync('package.json', 'utf8'));
  expect(config.desktopName).toBe(`${config.name}.desktop`);
  expect(config.build.linux.syncDesktopName).toBe(true);
  expect(config.build.linux.icon).toBe('assets/icons');
});
