// Run with Electron so its existing image codecs produce deterministic size variants.
const {app, nativeImage} = require('electron');
const {readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync} = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const profile = mkdtempSync(path.join(os.tmpdir(), 'amagon-icon-generator-'));
app.setPath('userData', profile);
app.whenReady().then(async () => {
  const {LINUX_ICON_SIZES, pngSize, verifyIconSet} = await import('./linuxIconContract.mjs');
  const ico = readFileSync(path.resolve('assets/app.ico'));
  const frames = [];
  for (let index = 0; index < ico.readUInt16LE(4); index++) {
    const entry = 6 + index * 16;
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    const bytes = ico.subarray(offset, offset + length);
    if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) frames.push(bytes);
  }
  frames.sort((left, right) => pngSize(right).width - pngSize(left).width);
  const master = frames[0];
  if (!master || pngSize(master).width !== pngSize(master).height) throw new Error('The ICO must contain square PNG artwork');
  const image = nativeImage.createFromBuffer(master);
  if (image.isEmpty()) throw new Error('Could not decode the existing application icon');
  const directory = path.resolve('assets/icons');
  mkdirSync(directory, {recursive: true});
  for (const size of LINUX_ICON_SIZES) {
    const bytes = size === pngSize(master).width ? master : image.resize({width: size, height: size, quality: 'best'}).toPNG();
    writeFileSync(path.join(directory, `${size}x${size}.png`), bytes);
  }
  verifyIconSet(directory);
  console.log(`Generated ${LINUX_ICON_SIZES.length} transparent icons (${LINUX_ICON_SIZES.join(', ')} px) from the existing ${pngSize(master).width}px logo.`);
  rmSync(profile, {recursive: true, force: true});
  app.exit(0);
}).catch(error => {
  console.error(error);
  rmSync(profile, {recursive: true, force: true});
  app.exit(1);
});
