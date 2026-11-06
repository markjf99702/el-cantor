// Turn tools/cards/build/cards.json (from build.py) into cards/<File>.jpg, 400 x 656, with Chromium.
//   python3 tools/cards/build.py && node tools/cards/render.mjs     (needs Playwright)
// The names use Bree Serif from the repo's own fonts/fonts.css, read from disk, so the cards come out the same with no
// network. FONT_CSS=path/to/fonts.css uses another copy of the font's CSS; the font files it names are read from beside
// it. It stops if Bree Serif didn't load, rather than draw the names in a stand-in serif. (CARDS_JSON and CARDS_OUT,
// for npm test, read other cards and write them elsewhere.)
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let pw;
if (process.env.PLAYWRIGHT) pw = await import(process.env.PLAYWRIGHT);
else try { pw = require('playwright'); } catch { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const cards = JSON.parse(fs.readFileSync(process.env.CARDS_JSON || path.join(HERE, 'build', 'cards.json'), 'utf8'));
const OUT = process.env.CARDS_OUT || path.join(HERE, '..', '..', 'cards');
const FONT_CSS = path.resolve(process.env.FONT_CSS || path.join(HERE, '..', '..', 'fonts', 'fonts.css'));

const browser = await pw.chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 656 } });
  // The font's CSS and files come from disk through fonts.local, and nothing else is fetched.
  const dir = path.dirname(FONT_CSS);
  await ctx.route(() => true, r => {
    const url = new URL(r.request().url());
    if (url.host !== 'fonts.local') return r.abort();
    const f = path.join(dir, decodeURIComponent(url.pathname).slice(1));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: f.endsWith('.css') ? 'text/css' : 'font/woff2', body: fs.readFileSync(f) });
  });
  const page = await ctx.newPage();
  const css = 'http://fonts.local/' + path.basename(FONT_CSS);
  for (const [n, { file, svg }] of Object.entries(cards)) {
    await page.setContent(`<!doctype html><link rel="stylesheet" href="${css}"><style>body{margin:0;background:#FBF4E4}svg{display:block}</style>${svg}`);
    await page.evaluate(() => document.fonts.load('400 40px "Bree Serif"', 'ÁÉÍÓÚÑ0123'));
    await page.evaluate(() => document.fonts.ready);
    // document.fonts.check() says yes even when no Bree Serif was declared at all, so look for a face that loaded.
    const loaded = await page.evaluate(() => [...document.fonts].some(f => f.family.replace(/["']/g, '') === 'Bree Serif' && f.status === 'loaded'));
    if (!loaded) throw new Error('Bree Serif did not load from ' + FONT_CSS + ', so the names would be drawn in another font');
    await page.locator('svg').screenshot({ path: path.join(OUT, file + '.jpg'), type: 'jpeg', quality: 90 });
    console.log(n, file);
  }
} finally { await browser.close(); }
