// Renders the README screenshots (docs/phone-*.png):  node tools/screenshots.mjs
// Each tool opens with saved tablas and a round under way, and Math.random is seeded, so the same pictures come
// out every time. Needs Playwright, and upng-js from `npm install`. og.png, the link preview, isn't drawn here.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const UPNG = require('upng-js');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/__blank') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>blank</title>'); return; }
  const file = path.endsWith('/') ? path + 'index.html' : path;
  let body;
  try { body = await readFile(join(root, file)); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(body);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const SEED = 7;

// The deck, for Mark's four and the card numbers.
const box = { window: {}, document: { currentScript: null } };
vm.runInNewContext(readFileSync(join(root, 'deck.js'), 'utf8'), box);
const L = box.window.Loteria, FOUR = L.originals(), CLASICO = ['linea', 'esquinas', 'cuadro'];
const n = name => L.CARDS.filter(c => c.name === name)[0].n;

const browser = await pw.chromium.launch();
await mkdir(join(root, 'docs'), { recursive: true });

// A phone that has used the app: these saves in place, then the page.
async function open(path, saves) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route(url => !url.href.startsWith(base), route => route.abort());
  const page = await ctx.newPage();
  await page.addInitScript(seed => {
    let a = seed; // mulberry32
    Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }, SEED);
  await page.goto(base + '__blank');
  await page.evaluate(s => { for (const k in s) localStorage.setItem(k, JSON.stringify(s[k])); }, saves);
  await page.goto(base + path);
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function shoot(page, name) {
  await page.waitForFunction(() => [...document.images].filter(i => i.getClientRects().length && i.getBoundingClientRect().top < innerHeight).every(i => i.complete), null, { timeout: 20000 }); // the ones on screen
  await page.waitForTimeout(700); // the card turning over, the beans dropping
  const img = UPNG.decode(await page.screenshot()); // saved with 256 colours, a quarter of the size
  await writeFile(join(root, 'docs', name), Buffer.from(UPNG.encode(UPNG.toRGBA8(img), img.width, img.height, 256)));
  await page.context().close();
}

// El Cantor, five cards into round 2: El Gallo showing, the four before it in a row underneath.
{
  const first = ['La Luna', 'La Sirena', 'El Corazón', 'La Rosa', 'El Gallo'].map(n);
  const order = first.concat(L.CARDS.map(c => c.n).filter(x => first.indexOf(x) < 0));
  const page = await open('cantor.html', {
    'loteria.cantor': { order, pos: 5, round: 2, patterns: CLASICO, juego: 'CANELA', wins: [{ round: 1, who: 'Abuela', how: 'Clásico', tabla: '', at: 17, t: 1 }], settings: { speak: true, style: 'name', voice: '', rate: 1, pace: 'normal', sound: true, awake: true, check: false } }
  });
  await shoot(page, 'phone-cantor.png');
}

// My tablas: Mark's four with beans on the called cards, and a línea on Tabla 1.
{
  const page = await open('board.html', {
    'loteria.v1': { players: [{ id: 'abuela', name: 'Abuela', boards: FOUR.map((cards, i) => ({ id: 't' + i, name: 'Tabla ' + (i + 1), cards })) }], current: 'abuela', patterns: CLASICO, settings: { marker: 'bean', sound: true, guide: true } },
    'loteria.game': { called: ['La Corona', 'La Luna', 'El Apache', 'El Melón', 'El Cotorro', 'La Rosa', 'La Campana', 'La Araña'].map(n), announced: {} }
  });
  await shoot(page, 'phone-board.png');
}

// Make tablas: Tabla 1 done, Tabla 2 nine cards in with its tenth square picked, and the deck underneath.
{
  const next = ['El Gallo', 'La Dama', 'El Catrín', 'La Sirena', 'La Luna', 'El Sol', 'La Estrella', 'El Corazón', 'La Chalupa'].map(n);
  const page = await open('print.html', {
    'loteria.print': { tablas: [{ id: 'a', name: 'Tabla 1', cards: FOUR[0] }, { id: 'b', name: 'Tabla 2', cards: next.concat([0, 0, 0, 0, 0, 0, 0]) }], set: { doubles: true, per: 2, paper: 'letter', names: true, who: '' } }
  });
  await page.locator('#tg .sq[data-t="b"][data-i="9"]').tap();
  await shoot(page, 'phone-print.png');
}

await browser.close();
server.close();
console.log('screenshots written to docs/');
