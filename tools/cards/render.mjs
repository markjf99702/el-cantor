// Turn tools/cards/build/cards.json (from build.py) into cards/<File>.jpg, 400 x 656, with Chromium.
//   npm i playwright && node tools/cards/render.mjs
// The names use Bree Serif from Google Fonts. To render offline, point FONT_CSS at a local
// copy of the font's CSS; the font files it names are read from beside it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const cards = JSON.parse(fs.readFileSync(path.join(HERE, 'build', 'cards.json'), 'utf8'));
const OUT = path.join(HERE, '..', '..', 'cards');
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 400, height: 656 } })).newPage();
let css = 'https://fonts.googleapis.com/css2?family=Bree+Serif&display=swap';
if (process.env.FONT_CSS) {
  const dir = path.dirname(path.resolve(process.env.FONT_CSS));
  css = 'http://fonts.local/' + path.basename(process.env.FONT_CSS);
  await page.route('http://fonts.local/**', r => {
    const f = decodeURIComponent(new URL(r.request().url()).pathname).slice(1);
    r.fulfill({ status: 200, contentType: f.endsWith('.css') ? 'text/css' : 'font/woff2', body: fs.readFileSync(path.join(dir, f)) });
  });
}
for (const [n, { file, svg }] of Object.entries(cards)) {
  await page.setContent(`<!doctype html><link rel="stylesheet" href="${css}"><style>body{margin:0;background:#FBF4E4}svg{display:block}</style>${svg}`);
  await page.evaluate(() => document.fonts.load('400 40px "Bree Serif"', 'ÁÉÍÓÚÑ0123'));
  await page.evaluate(() => document.fonts.ready);
  if (!(await page.evaluate(() => document.fonts.check('400 40px "Bree Serif"')))) throw new Error('Bree Serif did not load');
  await page.locator('svg').screenshot({ path: path.join(OUT, file + '.jpg'), type: 'jpeg', quality: 90 });
  console.log(n, file);
}
await browser.close();
