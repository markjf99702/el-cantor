// Renders the README screenshots (docs/phone-*.png) and the link preview (og.png):  node tools/screenshots.mjs
// Each tool opens with saved tablas and a round under way, and Math.random is seeded, so the same pictures come
// out every time. og.png is drawn from the app's own pieces: the home screen's banderitas, its fonts, the line in
// index.html's og:description, and four of the cards, so it follows them when they change. Needs Playwright, and
// upng-js from `npm install`.
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

// A phone that has used the app: these saves in place, then the page. In English, whatever this computer's language.
async function open(path, saves) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-US', serviceWorkers: 'block' });
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
  await save(await page.screenshot(), join(root, 'docs', name));
  await page.context().close();
}
async function save(png, file) { // with 256 colours, a quarter of the size
  const img = UPNG.decode(png);
  await writeFile(file, Buffer.from(UPNG.encode(UPNG.toRGBA8(img), img.width, img.height, 256)));
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

// og.png, the link preview, 1200 x 630: the home screen's banderitas across the top, the name and the preview's line
// on the left, and La Luna, El Gallo, La Sirena and El Corazón fanned on the right.
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, locale: 'en-US', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await ctx.route(url => !url.href.startsWith(base), route => route.abort());
  const page = await ctx.newPage();
  await page.goto(base + 'index.html');
  const picado = await page.innerHTML('#picado'); // drawn for 1200 wide, still (no sway with reduced motion)
  const line = readFileSync(join(root, 'index.html'), 'utf8').match(/<meta property="og:description" content="([^"]*)">/)[1];
  const [first, ...rest] = line.split(/(?<=\.) (?=[A-Z])/); // the Spanish, then "In English too." on a line of its own
  const fan = [['La Luna', 676, 352, -14], ['El Gallo', 802, 292, -5], ['La Sirena', 934, 298, 5], ['El Corazón', 1060, 366, 14]];
  const card = name => 'cards/' + L.CARDS.filter(c => c.name === name)[0].f + '.jpg';
  await page.setContent(`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="fonts/fonts.css"><style>
    html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#F3E7CF;color:#2B221C}
    .picado{height:34px}.picado svg{display:block}.str{fill:none;stroke:#746453;stroke-width:1;opacity:.7}.fl{opacity:.94}
    .fa{fill:#B7332F}.fb{fill:#1F6F6D}.fc{fill:#D99A2B}.fd{fill:#3E7D4A}.fe{fill:#C2477A}
    .words{position:absolute;left:76px;top:150px;width:418px}
    h1{margin:0;font:400 128px/1 "Bree Serif",serif;color:#B7332F;letter-spacing:-1px}
    .eyebrow{margin:18px 0 0 4px;font:800 21px/1 "Nunito Sans",sans-serif;letter-spacing:.14em;color:#6A5A4C}
    p{margin:22px 0 0 2px;font:400 25px/1.45 "Nunito Sans",sans-serif}
    p span{display:block;margin-top:6px;color:#6A5A4C;font-style:italic}
    img{position:absolute;width:196px;height:321px;border-radius:9px;box-shadow:0 2px 3px rgba(43,34,28,.18),0 18px 34px -10px rgba(43,34,28,.45)}
  </style><div class="picado">${picado}</div><div class="words"><h1>Lotería</h1><div class="eyebrow">EL CANTOR</div>
    <p>${first}${rest.map(r => `<span>${r}</span>`).join('')}</p></div>
    ${fan.map(([name, x, y, turn]) => `<img src="${card(name)}" alt="" style="left:${x - 98}px;top:${y - 160}px;transform:rotate(${turn}deg)">`).join('')}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  await save(await page.screenshot(), join(root, 'og.png'));
  await ctx.close();
}

await browser.close();
server.close();
console.log('screenshots written to docs/, and og.png');
