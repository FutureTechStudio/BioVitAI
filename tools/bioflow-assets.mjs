import fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';
import ts from 'typescript';
const compiled = ts.transpileModule(
  await fs.readFile('shared/design-tokens/src/index.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
).outputText;
const { bioflow } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
const leaf =
  '<path d="M27 1C34 20 9 21 8 42 0 30 0 18 14 12c6-3 9-5 13-11Z" fill="currentColor"/>';
const svg = (background, mono = false) =>
  `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">${background ? `<rect width="1024" height="1024" fill="${bioflow.color.canvas}"/>` : ''}<g transform="translate(295 190) scale(13)" color="${mono ? bioflow.color.ink : bioflow.color.teal}">${leaf}</g></svg>`;
for (const [name, bg, mono] of [
  ['icon', true, false],
  ['android-icon-foreground', false, false],
  ['android-icon-monochrome', false, true],
  ['splash-icon', false, false],
])
  await sharp(Buffer.from(svg(bg, mono)))
    .png()
    .toFile(`apps/mobile/assets/${name}.png`);
await sharp({
  create: {
    width: 1024,
    height: 1024,
    channels: 4,
    background: bioflow.color.canvas,
  },
})
  .png()
  .toFile('apps/mobile/assets/android-icon-background.png');
await sharp(Buffer.from(svg(true)))
  .resize(64, 64)
  .png()
  .toFile('apps/mobile/assets/favicon.png');
await fs.writeFile('apps/web/app/icon.svg', svg(true));
const app = JSON.parse(await fs.readFile('apps/mobile/app.json', 'utf8'));
app.expo.splash.backgroundColor = bioflow.color.canvas;
app.expo.android.adaptiveIcon.backgroundColor = bioflow.color.canvas;
await fs.writeFile('apps/mobile/app.json', JSON.stringify(app, null, 2) + '\n');
