// Uses the Lotería tools in Chromium through the real pages:  node test/e2e.mjs  (needs Playwright)
// El Cantor deals and checks a printed tabla, My tablas plays a round, Make tablas fills a tabla, two devices
// share tablas through a stand-in Google Drive, and every page works offline.
// To run some of the checks only, name them:  node test/e2e.mjs cantor print
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fakeGoogle } from './fake-google.mjs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/__blank') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>blank</title>'); return; } // for putting saves in place before a page opens
  const file = path.endsWith('/') ? path + 'index.html' : path;
  let body;
  try { body = await readFile(join(root, file)); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(body);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const origin = base.slice(0, -1);

const browser = await pw.chromium.launch();
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 800 } };

// A fresh browser profile: nothing saved, service workers off unless asked for, and nothing reaches the internet.
async function context(kind = PHONE, extra = {}) {
  const ctx = await browser.newContext({ ...kind, serviceWorkers: 'block', ...extra });
  await ctx.route(url => !url.href.startsWith(base), route => route.abort());
  return ctx;
}
// Everything that went wrong on a page: errors, missing files, and requests that left the site.
function watch(page, allow = []) {
  const problems = [];
  page.on('pageerror', e => problems.push('error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) problems.push(r.status() + ' ' + r.url()); });
  page.on('request', r => {
    const u = r.url();
    if (u.startsWith(base) || /^(data|blob):/.test(u) || allow.some(h => u.startsWith(h))) return;
    problems.push('left the site: ' + u);
  });
  return problems;
}
// Puts saves in localStorage before the first page opens, the way a device that has used the app would have them.
async function seed(page, data) {
  await page.goto(base + '__blank');
  await page.evaluate(d => { for (const k in d) localStorage.setItem(k, typeof d[k] === 'string' ? d[k] : JSON.stringify(d[k])); }, data);
}
const saved = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), key);
const sheetTitle = page => page.evaluate(() => { const h = document.querySelector('#sheet:not([hidden]) .sheet h2'); return h ? h.textContent : null; });
async function noSideways(page, what) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), what + ' scrolls sideways');
}
// Waits for fn to be true in the page; on a timeout, says what it was waiting for.
const until = (page, fn, arg, ms = 20000) => page.waitForFunction(fn, arg, { timeout: ms }).catch(e => { throw new Error('waited ' + ms / 1000 + 's for ' + String(fn).replace(/\s+/g, ' ').slice(0, 160) + (e.message.indexOf('Timeout') >= 0 ? '' : '\n' + e.message)); });

// Cards by number (deck.js): 1 El Gallo, 2 El Diablito, … 23 La Luna, … 54 La Rana.
const run = (from, n = 16) => Array.from({ length: n }, (_, i) => from + i);
function people(boards, extra = {}) {
  return { players: [{ id: 'ana', name: 'Ana', boards }], current: 'ana', patterns: ['linea', 'esquinas', 'cuadro'], settings: { marker: 'bean', sound: false, guide: true }, ...extra };
}
const ANA = people([{ id: 'm1', name: 'Mine 1', cards: run(1) }, { id: 'm2', name: 'Mine 2', cards: run(17) }]);
const DRIVE_ON = () => ({
  'loteria.sync': { on: true, email: 'mark@gmail.com', name: 'mark', last: 0 },
  'junkdrawer.google': { token: 'tok-mark', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/drive.file', email: 'mark@gmail.com' }
});

const checks = [];
function check(name, fn) { checks.push({ name, fn }); }

// ---------------------------------------------------------------- the home screen
check('home: the three tools, at phone and desktop width', async () => {
  for (const kind of [PHONE, DESKTOP]) {
    const ctx = await context(kind);
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await page.goto(base);
      await page.evaluate(() => document.fonts.ready);
      assert.deepEqual(await page.$$eval('nav.tiles a', as => as.map(a => a.getAttribute('href'))), ['cantor.html', 'board.html', 'print.html']);
      await noSideways(page, 'the home screen');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('fonts: every page has Bree Serif and Nunito Sans, served from here', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    for (const p of ['', 'cantor.html', 'board.html', 'print.html']) {
      await page.goto(base + p);
      await page.evaluate(() => document.fonts.ready);
      const faces = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '') + ' ' + f.style));
      for (const f of ['Bree Serif normal', 'Nunito Sans normal']) assert.ok(faces.indexOf(f) >= 0, (p || 'index.html') + ' has no ' + f + ' (it has ' + faces.join(', ') + ')');
    }
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('colours: the light palette’s muted text reads at 4.5:1 on every page', async () => {
  // --ink3 is the eyebrows, BEFORE, the sábana counts, the tabla labels, “Nothing called yet” and the footer.
  const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const ctx = await context(PHONE, { colorScheme: 'light' });
  try {
    const page = await ctx.newPage(), problems = watch(page);
    for (const p of ['', 'cantor.html', 'board.html', 'print.html']) {
      await page.goto(base + p);
      const [ink3, ...under] = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return ['--ink3', '--bg', '--paper'].map(k => s.getPropertyValue(k).trim()); });
      for (const bg of under) assert.ok(ratio(ink3, bg) >= 4.5, `${p || 'index.html'}: ${ink3} on ${bg} is ${ratio(ink3, bg).toFixed(2)}:1`);
    }
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('toasts: on a phone a toast uses the width of the screen before it wraps', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    for (const p of ['cantor.html', 'board.html', 'print.html']) {
      await page.goto(base + p);
      await page.evaluate(() => document.fonts.ready);
      const shown = text => page.evaluate(text => {
        const t = document.getElementById('toast'), r = document.createRange();
        t.textContent = text; t.classList.add('show');
        r.selectNodeContents(t);
        return { lines: new Set([...r.getClientRects()].map(x => Math.round(x.top))).size, width: t.getBoundingClientRect().width };
      }, text);
      const short = await shown('Put it back — La Sirena is showing'), long = await shown('Paused — another window turned a card, so this one stopped calling and shows that card');
      assert.equal(short.lines, 1, `${p}: a short toast wraps (${JSON.stringify(short)})`);
      assert.ok(long.lines === 2 && long.width > 0.85 * 390 && long.width <= 0.9 * 390 + 0.5, `${p}: a long toast (${JSON.stringify(long)})`);
      await noSideways(page, p + ' with a toast up');
    }
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('no JavaScript: every page says what it needs it for', async () => {
  assert.ok(existsSync(join(root, '.nojekyll')), 'no .nojekyll, so GitHub Pages runs Jekyll over the site');
  const ctx = await context(PHONE, { javaScriptEnabled: false });
  try {
    const page = await ctx.newPage();
    const SAYS = { '': 'El Cantor, My tablas and Make tablas all need JavaScript to work.', 'cantor.html': 'El Cantor needs JavaScript to shuffle and call the cards.', 'board.html': 'My tablas needs JavaScript to mark your tablas as the cards are called.', 'print.html': 'Make tablas needs JavaScript to put cards on tablas and print them.' };
    for (const p in SAYS) {
      await page.goto(base + p);
      const n = page.locator('.noscript');
      assert.ok(await n.count() && await n.isVisible(), (p || 'index.html') + ' says nothing without JavaScript');
      assert.equal(await n.textContent(), SAYS[p]);
    }
  } finally { await ctx.close(); }
});

// ---------------------------------------------------------------- El Cantor
check('cantor: deals cards and keeps the round through a reload', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'cantor.html');
    assert.match(await page.textContent('#cap h2'), /Ready when you are/);
    for (let i = 0; i < 5; i++) await page.click('#nextBtn');
    await until(page, () => document.getElementById('sub').textContent === 'Round 1 · 5 of 54');
    const c = await saved(page, 'loteria.cantor');
    assert.equal(c.pos, 5);
    assert.deepEqual(c.order.slice().sort((a, b) => a - b), run(1, 54), 'the deck is all 54 cards, shuffled');
    const fifth = await page.getAttribute('#bigImg', 'alt');
    await page.reload();
    await until(page, () => document.getElementById('sub').textContent === 'Round 1 · 5 of 54');
    assert.equal(await page.getAttribute('#bigImg', 'alt'), fifth, 'the same card is showing after a reload');
    await noSideways(page, 'El Cantor');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: two windows on one device follow each other instead of calling a card twice', async () => {
  // The installed app and a browser tab share one save. A known deck, read as Adivinanza so each call takes a few seconds.
  const order = run(1, 54).reverse();
  const ctx = await context(DESKTOP), calls = [];
  // Every card either window announces, through reloads too.
  await ctx.exposeBinding('noteCall', (src, name) => calls.push(name));
  await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => { const l = document.getElementById('live'); if (l) new MutationObserver(() => window.noteCall(l.textContent)).observe(l, { childList: true }); }));
  try {
    const A = await ctx.newPage(), problems = watch(A);
    await seed(A, { 'loteria.cantor': { order, pos: 0, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false, awake: false, check: false, style: 'riddle', pace: 'fast' } } });
    await A.goto(base + 'cantor.html');
    const B = await ctx.newPage(), problemsB = watch(B);
    await B.goto(base + 'cantor.html');
    const names = await A.evaluate(() => Loteria.CARDS.map(c => c.name)), name = n => names[n - 1];
    const at = (p, pos) => until(p, s => document.getElementById('sub').textContent === s, 'Round 1 · ' + pos + ' of 54');
    const stat = p => p.textContent('#stat');
    // B is calling on its own, first in its opening line and then in the middle of a card, when A turns one by hand.
    for (const busy of ['Here we go…', 'Reading…']) {
      await B.click('#playBtn');
      await until(B, s => document.getElementById('stat').textContent === s, busy);
      await B.evaluate(() => { document.getElementById('toast').textContent = ''; });
      await A.click('#nextBtn');
      const pos = (await saved(A, 'loteria.cantor')).pos;
      await at(B, pos);
      assert.equal(await stat(B), 'Paused', busy + ': B kept calling after A turned a card');
      assert.equal(await B.textContent('#cap h2'), name(order[pos - 1]), busy + ': B isn’t showing the card A turned');
      assert.equal(await B.textContent('#toast'), 'Paused — another window turned a card');
      await B.waitForTimeout(2500);
      assert.equal((await saved(B, 'loteria.cantor')).pos, pos, busy + ': B called a card on its own after stopping');
      assert.equal(await stat(B), 'Paused', busy + ': B is stuck');
      await B.click('#playBtn'); // ▶ carries on from A's card
      await at(B, pos + 1);
      await at(A, pos + 1);
      await B.click('#playBtn'); // pause
    }
    // The lab's order: B sits idle while A turns three cards, then B turns the next one.
    const p0 = (await saved(A, 'loteria.cantor')).pos;
    await until(B, () => document.getElementById('stat').textContent === 'Paused');
    for (let i = 1; i <= 3; i++) await A.click('#nextBtn');
    await at(B, p0 + 3);
    await B.click('#nextBtn');
    await at(A, p0 + 4);
    assert.equal(await A.getAttribute('#bigImg', 'alt'), name(order[p0 + 3]));
    await A.reload();
    await at(A, p0 + 4);
    // Back from the browser's history, a page picks up what was saved while it was away.
    await A.evaluate(() => { const c = JSON.parse(localStorage.getItem('loteria.cantor')); c.pos += 2; localStorage.setItem('loteria.cantor', JSON.stringify(c)); dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
    await at(A, p0 + 6);
    await at(B, p0 + 6);
    assert.deepEqual(calls, order.slice(0, p0 + 4).map(name), 'the cards called in the two windows');
    assert.deepEqual(problems.concat(problemsB), []);
  } finally { await ctx.close(); }
});

check('cantor: Escape on the ¡Lotería! box keeps calling, as Keep calling does, and the next one cheers again', async () => {
  const ctx = await context(DESKTOP);
  await ctx.addInitScript(() => { // counts the notes played: a fanfare is six
    window.__notes = 0; const AC = window.AudioContext; if (!AC) return;
    const make = AC.prototype.createOscillator; AC.prototype.createOscillator = function () { window.__notes++; return make.apply(this, arguments); };
  });
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 5, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: true, awake: false, check: false, pace: 'slow' } } });
    await page.goto(base + 'cantor.html');
    const calling = async () => await page.getAttribute('#playBtn', 'aria-label') === 'Pause', fanfares = () => page.evaluate(() => window.__notes / 6);
    await page.click('#playBtn');
    assert.ok(await calling());
    await page.click('#lotBtn');
    await page.waitForSelector('#winbox .winc #clBack');
    assert.equal(await fanfares(), 1);
    assert.ok(!(await calling()), 'calling goes on under the ¡Lotería! box');
    await page.keyboard.press('Escape');
    assert.ok(await page.isHidden('#winbox'));
    assert.ok(await calling(), 'Escape left calling paused');
    await page.click('#lotBtn'); // somebody else shouts
    await page.waitForSelector('#winbox .winc #clBack');
    assert.equal(await fanfares(), 2, 'the second ¡Lotería! was silent');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: checks a printed tabla by juego and number (CANELA 7 never changes)', async () => {
  // Printed sheets outlive code: tabla 7 of juego CANELA must always be these cards.
  const CANELA7 = [21, 51, 23, 6, 16, 33, 8, 4, 14, 20, 9, 40, 29, 41, 13, 25];
  const ctx = await context(DESKTOP);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'cantor.html');
    // A round where the top row of CANELA 7 has just been called.
    await page.evaluate(top => {
      const rest = Loteria.CARDS.map(c => c.n).filter(n => top.indexOf(n) < 0);
      localStorage.setItem('loteria.cantor', JSON.stringify({ order: top.concat(rest), pos: 4, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: 'CANELA', wins: [], settings: { speak: false, check: true } }));
    }, CANELA7.slice(0, 4));
    await page.reload();
    await page.click('#lotBtn');
    assert.equal(await sheetTitle(page), '¡Lotería! — check it');
    assert.equal(await page.inputValue('#vfJ'), 'CANELA');
    await page.fill('#vfN', '7');
    assert.equal(await page.textContent('#vfV h3'), '¡Buena! Línea');
    assert.match(await page.textContent('#vfV p'), /CANELA No\. 7 — It finished on the card just called, La Sirena\./);
    const names = await page.$$eval('#vfTabla .cell img', ims => ims.map(i => i.alt.replace(', called', '')));
    assert.deepEqual(names, await page.evaluate(t => t.map(n => Loteria.card(n).name), CANELA7));
    await page.fill('#vfN', '8');
    assert.equal(await page.textContent('#vfV h3'), 'Not yet');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: checking card by card keeps a card read out twice, and a chip takes a card back off', async () => {
  // Mark's Tabla 2 has La Corona twice in its second row, read out square by square: El Cazo, La Corona, La Corona, El Negrito.
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'cantor.html');
    const N = await page.evaluate(() => Object.fromEntries(Loteria.CARDS.map(c => [c.name, c.n])));
    async function checkAfter(called) {
      const first = called.map(n => N[n]);
      await page.evaluate(s => localStorage.setItem('loteria.cantor', JSON.stringify(s)), { order: first.concat(run(1, 54).filter(n => first.indexOf(n) < 0)), pos: first.length, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false, check: true } });
      await page.reload();
      await page.click('#lotBtn');
      for (const c of ['El Cazo', 'La Corona', 'La Corona', 'El Negrito']) await page.locator('#vfPick .pk', { has: page.locator('.n', { hasText: new RegExp('^' + c + '$') }) }).click();
    }
    const verdict = async () => [await page.textContent('#vfV h3'), await page.textContent('#vfV p')];
    const chips = () => page.$$eval('#vfChips .chip', bs => bs.map(b => b.textContent));
    await checkAfter(['El Cazo', 'El Negrito', 'La Corona']);
    assert.deepEqual(await verdict(), ['All 3 are out', 'If they make the shape — Clásico — it’s good. It finished on the card just called, La Corona.']);
    assert.deepEqual(await chips(), ['El Cazo · #1 ✕', 'La Corona · #3 ✕', 'El Negrito · #2 ✕']);
    await checkAfter(['El Cazo', 'El Negrito', 'El Gallo']); // La Corona not called yet: the second tap took it off, and the tabla passed
    assert.deepEqual(await verdict(), ['Not yet', 'La Corona hasn’t been called.']);
    await page.locator('#vfChips .chip', { hasText: 'La Corona' }).click();
    assert.deepEqual(await chips(), ['El Cazo · #1 ✕', 'El Negrito · #2 ✕']);
    assert.equal((await verdict())[0], 'All 2 are out');
    assert.equal(await page.locator('#vfPick .pk.no').count(), 0, 'La Corona is still picked in the deck');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

// ---------------------------------------------------------------- My tablas
check('board: a first visit picks a player, then plays a round to a ¡Lotería!', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'board.html');
    assert.equal(await sheetTitle(page), 'Who’s playing on this device?');
    assert.equal(await saved(page, 'loteria.v1'), null, 'nothing is saved before someone is picked');
    await page.fill('#wName', 'Ana');
    await page.click('#wMark');
    const v1 = await saved(page, 'loteria.v1');
    assert.deepEqual(v1.players.map(p => p.name + ':' + p.boards.length), ['Ana:4']);
    // Mark's four: Tabla 1's top row is El Melón, El Cotorro, La Campana, La Araña.
    await page.click('#callBtn');
    for (const q of ['melon', 'cotorro', 'campana']) { await page.fill('#pkq', q); await page.press('#pkq', 'Enter'); }
    assert.ok(await page.isHidden('#winbox .winc'), 'no win after three cards');
    await page.fill('#pkq', 'arana'); await page.press('#pkq', 'Enter');
    await page.waitForSelector('#winbox .winc');
    assert.equal(await page.textContent('#winbox h2'), '¡Lotería!');
    assert.match(await page.textContent('#winbox p'), /Tabla 1 · Línea/);
    await page.click('#winOk');
    await page.click('#pkx');
    assert.equal(await page.locator('#boards .tabla').first().locator('.cell.marked').count(), 4);
    await page.reload();
    assert.equal(await page.locator('#boards .tabla').first().locator('.cell.marked').count(), 4, 'the called cards survive a reload');
    await noSideways(page, 'My tablas');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: Escape leaves the first-visit sheet up, and saves nobody', async () => {
  const ctx = await context(DESKTOP);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'board.html');
    assert.equal(await sheetTitle(page), 'Who’s playing on this device?');
    await page.keyboard.press('Escape');
    assert.equal(await sheetTitle(page), 'Who’s playing on this device?', 'Escape closed it');
    await page.mouse.click(640, 30); // outside the sheet
    assert.equal(await sheetTitle(page), 'Who’s playing on this device?');
    assert.equal(await saved(page, 'loteria.v1'), null);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: a shared link on a new device makes that person its player, and saves no stand-in Mark', async () => {
  const CARDS1 = '1.2.3.4.5.6.7.8.9.a.b.c.d.e.f.g', who = async page => (await saved(page, 'loteria.v1') || { players: [] }).players.map(p => p.name + ':' + p.boards.length);
  for (const step of ['add', 'no thanks', 'mark', 'set up']) {
    const ctx = await context(PHONE);
    try {
      const page = await ctx.newPage(), problems = watch(page);
      if (step === 'set up') await seed(page, { 'loteria.v1': ANA });
      await page.goto(base + 'board.html#t=' + (step === 'mark' ? 'Mark' : step === 'set up' ? 'Ana' : 'Mom') + '~Tabla%201:' + CARDS1);
      assert.match(await sheetTitle(page), /^Tablas from /, step);
      if (step !== 'set up') assert.deepEqual(await who(page), [], step + ': saved a player before anyone chose');
      if (step === 'add') {
        await page.click('#imOk');
        assert.deepEqual(await who(page), ['Mom:1']);
        assert.equal((await saved(page, 'loteria.v1')).current, (await saved(page, 'loteria.v1')).players[0].id);
      } else if (step === 'no thanks') {
        await page.keyboard.press('Escape');
        assert.equal(await sheetTitle(page), 'Tablas from Mom', 'Escape closed it');
        await page.click('#imNo');
        assert.equal(await sheetTitle(page), 'Who’s playing on this device?');
        assert.deepEqual(await who(page), []);
      } else if (step === 'mark') {
        assert.equal(await page.textContent('#imOk'), 'Add and use', 'a new phone already “has” a Mark');
        await page.click('#imOk');
        assert.deepEqual(await who(page), ['Mark:1']);
      } else {
        assert.equal(await page.textContent('#imOk'), 'Replace and use', 'a device that has Ana replaces her tablas');
        await page.click('#imOk');
        assert.deepEqual(await who(page), ['Ana:1']);
      }
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('board: a share link carries a ~ in a name, and a broken link doesn’t stop the board', async () => {
  let url;
  for (const step of ['share', 'open', 'broken']) {
    const ctx = await context(PHONE);
    try {
      const page = await ctx.newPage(), problems = watch(page);
      if (step === 'share') {
        await seed(page, { 'loteria.v1': { ...people([{ id: 'm1', name: 'Mía ~ la buena', cards: run(1) }]), players: [{ id: 'tl', name: 'Tía~Lupe', boards: [{ id: 'm1', name: 'Mía ~ la buena', cards: run(1) }] }], current: 'tl' } });
        await page.goto(base + 'board.html');
        await page.click('#tablasBtn'); await page.click('#tbShare');
        url = await page.inputValue('#shUrl');
      } else if (step === 'open') { // on another phone
        await page.goto(url);
        assert.equal(await sheetTitle(page), 'Tablas from Tía~Lupe');
        await page.click('#imOk');
        const v1 = await saved(page, 'loteria.v1');
        assert.deepEqual([v1.players[0].name, v1.players[0].boards[0].name, v1.players[0].boards[0].cards], ['Tía~Lupe', 'Mía ~ la buena', run(1)]);
      } else { // cut off in the middle of an accented letter
        await page.goto(base + 'board.html#t=Mam%C3~Tabla%201:1.2.3.4.5.6.7.8.9.a.b.c.d.e.f.g');
        assert.equal(await sheetTitle(page), 'Who’s playing on this device?');
        await page.evaluate(() => { location.hash = '#t=Mom~Tabla%201:1.2.3.4.5.6.7.8.9.a.b.c.d.e.f.g'; });
        await until(page, () => (document.querySelector('#sheet h2') || {}).textContent === 'Tablas from Mom');
      }
      assert.deepEqual(problems, [], step);
    } finally { await ctx.close(); }
  }
});

check('board: calling a card from Cantaron… doesn’t put a phone’s keyboard up; a computer keeps typing', async () => {
  for (const kind of [PHONE, DESKTOP]) {
    const ctx = await context(kind);
    try {
      const page = await ctx.newPage(), problems = watch(page), phone = kind === PHONE;
      await seed(page, { 'loteria.v1': ANA });
      await page.goto(base + 'board.html');
      await page.click('#callBtn');
      const focused = () => page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.className));
      assert.equal(await focused(), phone ? 'sheet' : 'pkq', phone ? 'the sheet doesn’t have the focus' : 'the search box isn’t ready to type in');
      const first = page.locator('#pk .pk').first();
      if (phone) await first.tap(); else await first.click();
      assert.deepEqual((await saved(page, 'loteria.game')).called, [1]);
      assert.equal(await page.getAttribute('#pkq', 'placeholder'), 'Name or number… “luna”, 23', 'the picker stays open');
      if (phone) assert.notEqual(await focused(), 'pkq', 'the search box took focus, which puts the keyboard up');
      else assert.equal(await focused(), 'pkq', 'the search box is ready for the next card');
      // Typed, then called: a phone shows the whole deck again under the empty box, a computer the card it just called.
      await page.fill('#pkq', 'luna');
      if (phone) await page.locator('#pk .pk').first().tap(); else await page.press('#pkq', 'Enter');
      assert.deepEqual((await saved(page, 'loteria.game')).called, [1, 23]);
      assert.equal(await page.inputValue('#pkq'), '');
      assert.equal(await page.locator('#pk .pk').count(), phone ? 54 : 1, phone ? 'the cards stayed filtered to La Luna under an empty box' : 'La Luna went out of view');
      if (phone) assert.notEqual(await focused(), 'pkq'); else assert.equal(await focused(), 'pkq');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('board: a card picked again in Cantaron… stays called, and taking one back says so', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': ANA });
    await page.goto(base + 'board.html');
    const called = async () => (await saved(page, 'loteria.game')).called;
    const toast = t => until(page, t => document.getElementById('toast').textContent === t, t);
    await page.click('#callBtn');
    for (const n of [1, 2, 3, 4]) { await page.fill('#pkq', String(n)); await page.press('#pkq', 'Enter'); }
    await page.waitForSelector('#winbox .winc'); // Mine 1's top row
    await page.click('#winOk');
    await page.fill('#pkq', '3'); await page.press('#pkq', 'Enter'); // the caller says La Dama again
    await toast('La Dama is already called');
    assert.deepEqual(await called(), [1, 2, 3, 4], 'picking La Dama again took it back off');
    await page.click('#pkx');
    assert.equal(await page.locator('#boards .tabla.win').count(), 1, 'Mine 1 lost its win');
    await page.locator('#boards .tabla').first().locator('.cell').first().tap(); // El Gallo's bean
    await toast('Took El Gallo back off');
    assert.deepEqual(await called(), [2, 3, 4]);
    await page.locator('#hist .h', { hasText: 'La Dama' }).tap();
    await toast('Took La Dama back off');
    assert.deepEqual(await called(), [2, 4]);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: two windows on one device keep the cards each other calls', async () => {
  // The installed app and a browser tab share one save, and each used to write its own whole round on every call.
  const ctx = await context(DESKTOP);
  try {
    const A = await ctx.newPage(), problems = watch(A);
    await seed(A, { 'loteria.v1': ANA });
    await A.goto(base + 'board.html');
    const B = await ctx.newPage(), problemsB = watch(B);
    await B.goto(base + 'board.html'); // open before A calls anything
    const called = async () => (await saved(A, 'loteria.game')).called;
    const beans = (p, n) => until(p, n => document.querySelectorAll('#boards .cell.marked').length === n, n);
    await A.click('#callBtn');
    for (const n of [1, 2]) { await A.fill('#pkq', String(n)); await A.press('#pkq', 'Enter'); }
    await A.click('#pkx');
    await beans(B, 2);
    await B.locator('#boards .tabla').first().locator('.cell').nth(2).click(); // B calls La Dama from her square
    assert.deepEqual(await called(), [1, 2, 3], 'B put its own older round back');
    await beans(A, 3);
    await A.locator('#hist .h', { hasText: 'El Gallo' }).click(); // and A takes El Gallo back off
    assert.deepEqual(await called(), [2, 3]);
    await beans(B, 2);
    await A.reload();
    await beans(A, 2);
    // A tabla renamed in one window shows in the other: away from El Cantor's address there's no sync.js to pass it on.
    await B.click('#tablasBtn');
    await B.locator('#edb input').first().fill('Mía');
    await B.locator('#edb input').first().dispatchEvent('change');
    await until(A, () => document.querySelector('#boards .tabla .lbl .k').textContent.indexOf('Mía') === 0);
    // Back from the browser's history, a page picks up what was saved while it was away.
    await A.evaluate(() => { const g = JSON.parse(localStorage.getItem('loteria.game')); g.called.push(4); localStorage.setItem('loteria.game', JSON.stringify(g)); dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
    await beans(A, 3);
    await beans(B, 3);
    assert.deepEqual(await called(), [2, 3, 4]);
    assert.deepEqual((await saved(A, 'loteria.v1')).players[0].boards.map(b => b.name), ['Mía', 'Mine 2']);
    assert.deepEqual(problems.concat(problemsB), []);
  } finally { await ctx.close(); }
});

check('board: the Tablas sheet stays where it was after a square is changed', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': people([1, 2, 3].map(k => ({ id: 'm' + k, name: 'Mine ' + k, cards: run(1 + (k - 1) * 16) }))) });
    await page.goto(base + 'board.html');
    await page.click('#tablasBtn');
    const scroll = () => page.evaluate(() => document.querySelector('#sheet .bd').scrollTop);
    await page.evaluate(() => { const b = document.querySelector('#sheet .bd'); b.scrollTop = b.scrollHeight; });
    const square = page.locator('#edb > div').nth(2).locator('.eg .cell').nth(5);
    await square.scrollIntoViewIfNeeded();
    const before = await scroll();
    assert.ok(before > 500, 'scrolled down to the third tabla');
    await square.click();
    await page.fill('#pkq', '54'); await page.press('#pkq', 'Enter');
    assert.equal((await saved(page, 'loteria.v1')).players[0].boards[2].cards[5], 54);
    assert.ok(Math.abs(await scroll() - before) <= 2, `the sheet went from ${before} to ${await scroll()}`);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: a card goes on a tabla twice but not three times, as in Make tablas', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    const mine = run(1); mine[5] = 5; // El Paraguas twice, side by side, like Mark's four
    await seed(page, { 'loteria.v1': people([{ id: 'm1', name: 'Mine 1', cards: mine }]) });
    await page.goto(base + 'board.html');
    await page.click('#tablasBtn');
    const cards = async () => (await saved(page, 'loteria.v1')).players[0].boards[0].cards;
    const put = async (square, n) => { await page.locator('#edb .eg .cell').nth(square).click(); await page.fill('#pkq', String(n)); await page.press('#pkq', 'Enter'); };
    await put(0, 5);
    await until(page, () => document.getElementById('toast').textContent === 'El Paraguas is already on Mine 1 twice');
    assert.equal(await page.getAttribute('#pkq', 'placeholder'), 'Pick a card for this square', 'the picker closed instead of letting another card be picked');
    await page.fill('#pkq', '23'); await page.press('#pkq', 'Enter'); // La Luna instead
    assert.deepEqual((await cards()).slice(0, 6), [23, 2, 3, 4, 5, 5]);
    await put(1, 23);
    assert.deepEqual((await cards()).slice(0, 6), [23, 23, 3, 4, 5, 5], 'a second La Luna is fine');
    await put(2, 23);
    await until(page, () => document.getElementById('toast').textContent === 'La Luna is already on Mine 1 twice');
    await page.click('#pkx');
    assert.deepEqual((await cards()).slice(0, 6), [23, 23, 3, 4, 5, 5]);
    await page.click('#tablasBtn');
    await put(4, 5); // the same card on its own square changes nothing
    assert.deepEqual((await cards()).slice(0, 6), [23, 23, 3, 4, 5, 5]);
    assert.equal(await page.textContent('#edb .warn'), 'Twice: El Paraguas, La Luna');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: a tabla saved with a card three times stays as it is, and says how many', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    const old = run(1); old[0] = old[1] = old[2] = 23; old[5] = 5; // from before the family rule: La Luna three times, El Paraguas twice
    await seed(page, { 'loteria.v1': people([{ id: 'm1', name: 'Mine 1', cards: old }]) });
    await page.goto(base + 'board.html');
    await page.click('#tablasBtn');
    assert.equal(await page.textContent('#edb .warn'), 'Twice: El Paraguas · 3×: La Luna');
    const cards = async () => (await saved(page, 'loteria.v1')).players[0].boards[0].cards;
    const put = async (square, n) => { await page.locator('#edb .eg .cell').nth(square).click(); await page.fill('#pkq', String(n)); await page.press('#pkq', 'Enter'); };
    await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
    await put(1, 23); // La Luna for one of its own squares: nothing to refuse
    assert.equal(await sheetTitle(page), null);
    assert.equal(await page.isVisible('#edb .warn'), true, 'the Tablas sheet came back');
    assert.equal(await page.textContent('#toast'), '', 'La Luna was refused for the square it was already in');
    assert.deepEqual(await cards(), old);
    await put(3, 23); // a fourth La Luna
    await until(page, () => document.getElementById('toast').textContent === 'La Luna is already on Mine 1 twice');
    await page.click('#pkx');
    assert.deepEqual(await cards(), old, 'the saved tabla changed');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: the game picker works from the keyboard as well as by tapping', async () => {
  const ctx = await context(DESKTOP);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': ANA });
    await page.goto(base + 'board.html');
    const game = async () => (await saved(page, 'loteria.v1')).patterns;
    const shape = name => page.locator('#pats .pat', { hasText: name }).first();
    await page.click('#patBtn');
    // Clásico's little picture: the top row, a whole square in the middle, and the corners.
    assert.deepEqual(await shape('Clásico').locator('.mini i').evaluateAll(is => is.flatMap((i, k) => i.className ? [k] : [])), [0, 1, 2, 3, 5, 6, 9, 10, 12, 15]);
    await shape('Esquinas').focus(); await page.keyboard.press('Enter');
    assert.deepEqual(await game(), ['esquinas'], 'Enter on Esquinas');
    await shape('Centro').focus(); await page.keyboard.press(' ');
    assert.deepEqual(await game(), ['centro'], 'Space on Centro');
    await shape('La Ele').focus(); await page.keyboard.press('Shift+Enter');
    assert.deepEqual(await game(), ['centro', 'ele'], 'Shift+Enter adds a shape, like holding it');
    await shape('Clásico').click();
    assert.deepEqual(await game(), ['linea', 'esquinas', 'cuadro'], 'a click still picks');
    assert.equal(await page.textContent('#patBtn'), 'Clásico ▾');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('games: holding a shape adds it to the game, with a mouse or a finger, in My tablas and El Cantor', async () => {
  const CANTOR = { order: run(1, 54), pos: 0, round: 1, patterns: ['esquinas'], juego: '', wins: [], settings: { speak: false, sound: false, awake: false, check: false } };
  for (const [tool, key, data] of [['board.html', 'loteria.v1', { ...ANA, patterns: ['esquinas'] }], ['cantor.html', 'loteria.cantor', CANTOR]]) {
    for (const kind of [DESKTOP, PHONE]) {
      const ctx = await context(kind);
      try {
        const page = await ctx.newPage(), problems = watch(page), what = tool + (kind === PHONE ? ', a finger' : ', a mouse');
        await seed(page, { [key]: data });
        await page.goto(base + tool);
        await page.click('#patBtn');
        assert.match(await page.textContent('#sheet .note'), /add it on top of what’s (selected|picked)(, and|;) a tabla wins on any one of them\./, what + ': the sheet doesn’t say either shape wins');
        const shape = name => page.locator('#pats .pat', { has: page.locator('b', { hasText: new RegExp('^' + name + '$') }) });
        const box = await shape('Centro').boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
        const cdp = kind === PHONE ? await ctx.newCDPSession(page) : null;
        if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); else { await page.mouse.move(x, y); await page.mouse.down(); }
        await until(page, () => document.getElementById('toast').textContent === 'Centro added');
        if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
        assert.deepEqual((await saved(page, key)).patterns, ['esquinas', 'centro'], what + ': letting go left only the held shape');
        assert.equal(await page.textContent('#patBtn'), 'Esquinas · Centro ▾', what);
        if (cdp) await shape('La Ele').tap(); else await shape('La Ele').click(); // a quick tap still picks one shape
        assert.deepEqual((await saved(page, key)).patterns, ['ele'], what + ': a tap after a hold');
        assert.deepEqual(problems, [], what);
      } finally { await ctx.close(); }
    }
  }
});

check('board: a long game name in the header doesn’t paint over the Lotería title', async () => {
  for (const [w, pats] of [[360, ['equis', 'marco']], [390, ['equis', 'marco']], [360, ['llena']], [390, ['linea', 'esquinas', 'cuadro']]]) {
    const ctx = await context({ ...PHONE, viewport: { width: w, height: 780 } });
    try {
      const page = await ctx.newPage(), problems = watch(page), what = `${w}px, ${pats.join('+')}`;
      await seed(page, { 'loteria.v1': { ...ANA, patterns: pats } });
      await page.goto(base + 'board.html');
      await page.evaluate(() => document.fonts.ready);
      const r = await page.evaluate(() => {
        const t = document.querySelector('.top h1 .t'), cs = getComputedStyle(t), box = t.getBoundingClientRect();
        return { right: box.right, width: box.width, shown: cs.display !== 'none', chip: document.getElementById('patBtn').getBoundingClientRect().left, clips: cs.overflow === 'hidden', cut: t.scrollWidth > t.clientWidth };
      });
      assert.ok(!r.shown || (r.right <= r.chip && r.clips), `${what}: the title runs under the game chip (${JSON.stringify(r)})`);
      assert.ok(!r.shown || r.width >= 35, `${what}: the title is cut to a sliver instead of “Lo…” or nothing (${JSON.stringify(r)})`);
      if (pats.length === 3) assert.ok(!r.cut, what + ': Clásico leaves room for the whole title');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('board: a tabla’s label stays on one line above its grid, and its win always shows in full', async () => {
  const FOUR = [[11, 24, 43, 33, 16, 51, 29, 52, 26, 31, 31, 49, 22, 19, 44, 50], [45, 38, 4, 32, 36, 47, 47, 26, 5, 9, 35, 28, 20, 12, 8, 37], [1, 39, 2, 21, 35, 48, 48, 13, 3, 14, 23, 34, 18, 38, 6, 30], [15, 25, 34, 17, 40, 41, 41, 7, 46, 12, 42, 53, 54, 10, 27, 38]];
  const marks = FOUR.map((cards, i) => ({ id: 't' + i, name: 'Tabla ' + (i + 1), cards }));
  const cases = [
    { w: 390, h: 844, boards: [{ id: 'm1', name: 'La tabla de Mamá Lupe', cards: run(1) }, { id: 'm2', name: 'Mine 2', cards: run(17) }], pats: ['linea', 'esquinas', 'cuadro'], called: [1, 2, 3, 4], win: '· ¡línea!' },
    { w: 375, h: 667, boards: marks, pats: ['esquinas'], called: [11, 33, 22, 50], win: '· ¡esquinas!' },
    { w: 360, h: 780, boards: marks, pats: ['llena'], called: FOUR[0], win: '· ¡tabla llena!' },
    { w: 360, h: 780, boards: marks.concat(marks.slice(0, 2).map((b, i) => ({ ...b, id: 'x' + i, name: 'Otra ' + (i + 1) }))), pats: ['llena'], called: FOUR[0], win: '· ¡tabla llena!', narrow: true },
  ];
  for (const c of cases) {
    const ctx = await context({ ...PHONE, viewport: { width: c.w, height: c.h } });
    try {
      const page = await ctx.newPage(), problems = watch(page), what = `${c.w}x${c.h} ${c.win}`;
      await seed(page, { 'loteria.v1': { ...people(c.boards), patterns: c.pats }, 'loteria.game': { called: c.called, announced: {} } });
      await page.goto(base + 'board.html');
      await page.evaluate(() => document.fonts.ready);
      const l = await page.evaluate(() => {
        const t = document.querySelector('#boards .tabla'), lbl = t.querySelector('.lbl'), k = lbl.querySelector('.k'), z = lbl.querySelector('.z'), w = k.querySelector('.w'), R = e => e.getBoundingClientRect();
        let box = null, full = null; // the win's box, and how wide it is when nothing holds it in
        if (w) { box = R(w).width; const was = w.style.cssText; w.style.cssText = 'flex:none;max-width:none'; full = R(w).width; w.style.cssText = was; }
        return { text: k.textContent, k: R(k).height, bottom: R(k).bottom, grid: R(t.querySelector('.grid')).top, right: R(k).right, z: R(z).left, zEnd: R(z).right, end: R(lbl).right, box, full, cut: w ? full > box + 0.01 : null };
      });
      assert.ok(l.k <= 16 && l.bottom <= l.grid, `${what}: the label wraps onto the grid (${JSON.stringify(l)})`);
      assert.ok(l.text.endsWith(c.win), what + ': ' + l.text);
      assert.ok(l.right <= l.z + 0.5 && l.zEnd <= l.end + 0.5, `${what}: the label runs past its tabla (${JSON.stringify(l)})`);
      if (!c.narrow) assert.equal(l.cut, false, what + ': the win is cut off');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('board: Settings keeps each On/Off beside its words on a phone', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': ANA });
    await page.goto(base + 'board.html');
    await page.evaluate(() => document.fonts.ready);
    await page.click('#setBtn');
    for (const id of ['sndBtn', 'gdBtn']) {
      const r = await page.evaluate(id => { const b = document.getElementById(id), t = b.previousElementSibling.getBoundingClientRect(), c = b.getBoundingClientRect(); return { textRight: t.right, textTop: t.top, textBottom: t.bottom, chipLeft: c.left, chipMiddle: (c.top + c.bottom) / 2 }; }, id);
      assert.ok(r.chipLeft >= r.textRight && r.chipMiddle > r.textTop && r.chipMiddle < r.textBottom, `#${id} isn't beside its words (${JSON.stringify(r)})`);
    }
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: Restore the original four, Remove and Random tabla ask for a second tap', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': people([1, 2, 3, 4, 5].map(k => ({ id: 'm' + k, name: 'Mine ' + k, cards: run(1 + (k - 1) * 7) }))) });
    await page.goto(base + 'board.html');
    const names = async () => (await saved(page, 'loteria.v1')).players[0].boards.map(b => b.name);
    await page.click('#tablasBtn');
    await page.click('#tbOrig');
    assert.deepEqual(await names(), ['Mine 1', 'Mine 2', 'Mine 3', 'Mine 4', 'Mine 5'], 'one tap replaced the tablas');
    assert.equal(await page.textContent('#tbOrig'), 'Tap again to replace all 5 tablas');
    await page.click('#tbOrig');
    assert.deepEqual(await names(), ['Tabla 1', 'Tabla 2', 'Tabla 3', 'Tabla 4']);
    assert.equal(await page.textContent('#tbOrig'), 'Restore the original four');
    await page.click('#tbOrig'); // already Mark's four: nothing to lose, so no second tap
    assert.equal(await page.textContent('#tbOrig'), 'Restore the original four');
    const del = page.locator('#edb [data-a="del"]').first();
    await del.click();
    assert.deepEqual(await names(), ['Tabla 1', 'Tabla 2', 'Tabla 3', 'Tabla 4'], 'one tap removed a tabla');
    assert.equal(await del.textContent(), 'Tap again to remove Tabla 1');
    await del.click();
    assert.deepEqual(await names(), ['Tabla 2', 'Tabla 3', 'Tabla 4']);
    assert.equal(await page.locator('#edb [data-a="del"]').first().textContent(), 'Remove', 'the next Remove asks again');
    // Random tabla deals Tabla 3 sixteen new cards, which may have been picked by hand.
    const third = async () => (await saved(page, 'loteria.v1')).players[0].boards[1].cards, was = await third(), rnd = page.locator('#edb [data-a="rnd"]').nth(1);
    await rnd.click();
    assert.deepEqual(await third(), was, 'one tap replaced Tabla 3’s cards');
    assert.equal(await rnd.textContent(), 'Tap again to replace Tabla 3’s cards');
    await rnd.click();
    assert.notDeepEqual(await third(), was);
    assert.equal(await page.locator('#edb [data-a="rnd"]').nth(1).textContent(), 'Random tabla', 'the next Random tabla asks again');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

// ---------------------------------------------------------------- Make tablas
check('print: tap a square, then tap cards to fill it in order; a third copy is refused', async () => {
  const ctx = await context(DESKTOP);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'print.html');
    await page.click('#tg .sq[data-i="0"]');
    await page.click('#dg .dk[data-n="23"]');
    await page.click('#dg .dk[data-n="23"]');
    await page.click('#dg .dk[data-n="23"]');
    await until(page, () => document.getElementById('toast').textContent === 'La Luna is already on Tabla 1 twice');
    await page.click('#dg .dk[data-n="1"]');
    const p = await saved(page, 'loteria.print');
    assert.deepEqual(p.tablas[0].cards.slice(0, 4), [23, 23, 1, 0]);
    await noSideways(page, 'Make tablas');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('print: on an iPhone the deck’s last row clears the home indicator', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, topMax: 47, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 } });
    await page.goto(base + 'print.html');
    const pad = await page.evaluate(() => { const g = document.getElementById('dg'); g.scrollTop = g.scrollHeight; const last = [...g.querySelectorAll('.dk')].pop().getBoundingClientRect(); return { pad: getComputedStyle(g).paddingBottom, bottom: last.bottom }; });
    assert.equal(pad.pad, '44px', 'the deck pads 10px plus the 34px home indicator');
    assert.ok(pad.bottom <= 844 - 34, `the last row ends at ${pad.bottom}, under the home indicator`);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('print: two per page prints every tabla whole (Letter and A4, names on and off)', async () => {
  const ctx = await context(DESKTOP);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'print.html');
    await page.click('#tg button[data-a="preset"][data-k="0"]'); // Mark's four
    await page.click('#tg button[data-a="rnd"]'); // and a fifth, alone on the last page
    for (const paper of ['letter', 'a4']) for (const names of ['1', '0']) {
      const what = `${paper}, names ${names === '1' ? 'on' : 'off'}`;
      await page.click('#printBtn');
      await page.click('#pers .per[data-v="2"]');
      await page.click(`#paperSeg button[data-v="${paper}"]`);
      await page.click(`#nameSeg button[data-v="${names}"]`);
      assert.equal(await page.textContent('#psum'), '5 tablas on 3 pages — cut along the gap between them.');
      await page.click('#pdx');
      await page.emulateMedia({ media: 'print' });
      // Where each tabla's box sits before it's turned sideways. Chromium splits whatever runs off the
      // bottom of a page onto the next one, which tore the lower tabla on every page but the last.
      const boxes = await page.evaluate(() => [...document.querySelectorAll('#printout .page')].map(pg => [...pg.querySelectorAll('.pt')].map(pt => {
        const slot = pt.parentElement, top = slot.offsetTop - pg.offsetTop + pt.offsetTop, left = slot.offsetLeft - pg.offsetLeft + pt.offsetLeft;
        return { top, bottom: top + pt.offsetHeight, left, right: left + pt.offsetWidth, w: pg.offsetWidth, h: pg.offsetHeight, name: pt.querySelector('img') && pt.querySelector('img').getAttribute('src') };
      })));
      assert.deepEqual(boxes.map(p => p.length), [2, 2, 1], what);
      boxes.forEach((p, i) => p.forEach((b, j) => {
        assert.ok(b.top >= -1 && b.bottom <= b.h + 1 && b.left >= -1 && b.right <= b.w + 1, `${what}: tabla ${2 * i + j + 1} runs off page ${i + 1} (${JSON.stringify(b)})`);
      }));
      const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString('latin1');
      assert.equal((pdf.match(/\/Type\s*\/Page\b(?!s)/g) || []).length, 3, what + ': the PDF has 3 pages');
      await page.emulateMedia({ media: null });
    }
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

// ---------------------------------------------------------------- the keyboard and screen readers
check('sheets: a sheet takes the focus when it opens, with no phone keyboard, and gives it back when it closes', async () => {
  const CANTOR = { order: run(1, 54), pos: 3, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false, awake: false, check: false } };
  for (const [tool, key, data, openers] of [['cantor.html', 'loteria.cantor', CANTOR, ['setBtn', 'patBtn', 'sabBtn', 'printBtn']], ['board.html', 'loteria.v1', ANA, ['tablasBtn', 'patBtn', 'setBtn', 'callBtn']]]) {
    for (const kind of [PHONE, DESKTOP]) {
      const ctx = await context(kind);
      try {
        const page = await ctx.newPage(), problems = watch(page), phone = kind === PHONE;
        await seed(page, { [key]: data });
        await page.goto(base + tool);
        const active = () => page.evaluate(() => { const a = document.activeElement; return a.id || a.className; });
        for (const id of openers) {
          if (!(await page.isVisible('#' + id))) continue; // the sábana has a button only on a phone
          const what = `${tool}, ${phone ? 'phone' : 'computer'}, #${id}`;
          await page.focus('#' + id); await page.keyboard.press('Enter');
          await until(page, () => !document.getElementById('sheet').hidden);
          // Cantaron… on a computer goes straight to its search box, to type the card's name.
          assert.equal(await active(), id === 'callBtn' && !phone ? 'pkq' : 'sheet', what + ': the focus stayed behind the sheet');
          assert.equal(await page.getAttribute('#sheet .sheet', 'role'), 'dialog', what);
          await page.keyboard.press('Escape');
          assert.ok(await page.evaluate(() => document.getElementById('sheet').hidden), what + ': Escape didn’t close it');
          assert.equal(await active(), id, what + ': the focus didn’t come back');
        }
        assert.deepEqual(problems, []);
      } finally { await ctx.close(); }
    }
  }
});

// ---------------------------------------------------------------- damaged saves
check('saves: a damaged save opens with what can be kept, instead of a blank page or an error', async () => {
  for (const tool of ['board', 'cantor', 'print']) {
    const ctx = await context(PHONE);
    try {
      const page = await ctx.newPage(), problems = watch(page);
      if (tool === 'board') {
        // A square with no card (0), a person with no tablas at all, a game that isn't a list, and calls that aren't cards.
        await seed(page, {
          'loteria.v1': { ...people([]), patterns: 'linea', players: [{ id: 'ana', name: 'Ana', boards: [{ id: 'm1', name: 'Mine 1', cards: [0].concat(run(2, 15)) }] }, { id: 'bo', name: 'Bo' }] },
          'loteria.game': { called: [5, null, 99, 6], announced: null }
        });
        await page.goto(base + 'board.html');
        assert.equal(await page.locator('#boards .tabla .cell').count(), 16);
        assert.equal(await page.locator('#boards .tabla .cell.marked').count(), 2);
        assert.equal(await page.textContent('#hist .cnt'), '2 called');
        assert.equal(await page.textContent('#patBtn'), 'Clásico ▾');
        await page.click('#tablasBtn');
        await page.locator('#edb .eg .cell').first().click(); // the empty square can still be given a card
        await page.fill('#pkq', '1'); await page.press('#pkq', 'Enter');
        assert.deepEqual((await saved(page, 'loteria.v1')).players[0].boards[0].cards, run(1));
        await page.click('#tbx');
        await page.click('#setBtn');
        await page.locator('#plist .chip', { hasText: 'Bo' }).click(); // Bo has no tablas, and that's all right
        await page.click('#stx');
        assert.equal(await page.locator('#boards .tabla').count(), 0);
      } else if (tool === 'cantor') {
        await seed(page, { 'loteria.cantor': { wins: [null, { round: 1, who: 'Ana', how: 'Línea', tabla: '', at: 9, t: 1 }] } });
        await page.goto(base + 'cantor.html');
        await page.click('#setBtn');
        assert.match(await page.textContent('#winsCard'), /Ana · 1/);
        await page.click('#stx');
        await page.click('#lotBtn');
        await page.waitForSelector('#winbox .winc');
        assert.equal(await page.textContent('#clNames .chip'), 'Ana');
      } else {
        await seed(page, { 'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: run(1) }], set: { doubles: true, per: 3, paper: 'legal', names: true, who: '' } } });
        await page.goto(base + 'print.html');
        await page.click('#printBtn');
        assert.equal(await page.textContent('#psum'), '1 tabla on 1 page — cut along the gap between them.');
        assert.equal(await page.textContent('#pers .per.on b'), '2 per page');
        assert.equal(await page.textContent('#paperSeg button.on'), 'Letter');
      }
      assert.deepEqual(problems, [], tool);
    } finally { await ctx.close(); }
  }
});

// ---------------------------------------------------------------- Google Drive (a stand-in for it)
async function driveDevice(g, data) {
  const ctx = await context(PHONE);
  await g.install(ctx, {
    rewrite: {
      '**/sync.js': s => {
        const t = s.replace(/var ORIGINS = \[[^\]]*\];/, `var ORIGINS = ['${origin}'];`);
        if (t === s) throw new Error('sync.js has no ORIGINS list to point at the test server');
        return t;
      }
    }
  });
  const page = await ctx.newPage(), problems = watch(page, ['https://accounts.google.com/', 'https://www.googleapis.com/']);
  await seed(page, { ...DRIVE_ON(), ...data });
  return { ctx, page, problems };
}
const synced = (page, after = 0) => until(page, t => { const s = JSON.parse(localStorage.getItem('loteria.sync') || '{}'); return s.last > t && localStorage.getItem('loteria.sync.base'); }, after, 30000);

check('drive: a second device gets the tablas, and a rename comes back to the first', async () => {
  const g = fakeGoogle();
  const A = await driveDevice(g, { 'loteria.v1': ANA });
  const B = await driveDevice(g, {});
  try {
    await A.page.goto(base + 'board.html');
    await synced(A.page);
    assert.equal(g.files().filter(f => (f.appProperties || {}).loteria === 'sync').length, 1, 'one file in Drive');
    await B.page.goto(base + 'board.html'); // a new phone: the welcome sheet, until Drive brings Ana over
    await until(B.page, () => { const o = JSON.parse(localStorage.getItem('loteria.v1') || 'null'); return o && o.players.some(p => p.name === 'Ana'); }, null, 30000);
    await until(B.page, () => document.getElementById('sheet').hidden);
    assert.deepEqual((await saved(B.page, 'loteria.v1')).players[0].boards.map(b => b.name), ['Mine 1', 'Mine 2']);
    const t = (await saved(B.page, 'loteria.sync')).last;
    await B.page.click('#tablasBtn');
    await B.page.locator('#edb input').first().fill('Mía');
    await B.page.locator('#edb input').first().dispatchEvent('change');
    await synced(B.page, t);
    await A.page.evaluate(() => LoteriaSync.now());
    await until(A.page, () => JSON.parse(localStorage.getItem('loteria.v1')).players[0].boards[0].name === 'Mía', null, 30000);
    assert.deepEqual((await saved(A.page, 'loteria.v1')).players[0].boards.map(b => b.name), ['Mía', 'Mine 2']);
    await until(A.page, () => document.querySelector('#boards .tabla .lbl .k').textContent.indexOf('Mía') === 0);
    assert.deepEqual(A.problems, []); assert.deepEqual(B.problems, []);
  } finally { await A.ctx.close(); await B.ctx.close(); }
});

check('drive: a new phone that set up “ana” keeps the family’s “Ana”, with the tablas from both', async () => {
  const g = fakeGoogle();
  const A = await driveDevice(g, { 'loteria.v1': ANA });
  const B = await driveDevice(g, { 'loteria.v1': { ...ANA, players: [{ id: 'b', name: 'ana', boards: [{ id: 'b1', name: 'Mía', cards: run(30) }] }], current: 'b' } });
  const who = async d => (await saved(d.page, 'loteria.v1')).players.map(p => p.name + ': ' + p.boards.map(b => b.name).sort().join(', '));
  try {
    await A.page.goto(base + 'board.html'); await synced(A.page);
    await B.page.goto(base + 'board.html'); await synced(B.page); // B's first sync: its “ana” is A's Ana
    assert.deepEqual(await who(B), ['Ana: Mine 1, Mine 2, Mía'], 'the new phone’s spelling won');
    await until(B.page, () => document.getElementById('who').textContent === 'Ana');
    const file = JSON.parse(g.files().filter(f => (f.appProperties || {}).loteria === 'sync')[0].body);
    assert.deepEqual(Object.values(file.cols.people.items).map(i => i.v.name), ['Ana'], 'Drive has the new phone’s spelling');
    const t = (await saved(A.page, 'loteria.sync')).last;
    await A.page.evaluate(() => LoteriaSync.now()); await synced(A.page, t);
    assert.deepEqual(await who(A), ['Ana: Mine 1, Mine 2, Mía']);
    assert.deepEqual(A.problems, []); assert.deepEqual(B.problems, []);
  } finally { await A.ctx.close(); await B.ctx.close(); }
});

check('drive: a shared link on a new phone that saves to Drive asks again once the Drive tablas land', async () => {
  const g = fakeGoogle();
  const A = await driveDevice(g, { 'loteria.v1': ANA });
  const B = await driveDevice(g, {});
  try {
    await A.page.goto(base + 'board.html');
    await synced(A.page);
    await B.page.goto(base + 'board.html#t=Ana~Tabla%201:1.2.3.4.5.6.7.8.9.a.b.c.d.e.f.g');
    await synced(B.page);
    assert.equal(await sheetTitle(B.page), 'Tablas from Ana', 'the import was dropped when Drive landed');
    assert.equal(await B.page.textContent('#imOk'), 'Replace and use');
    await B.page.click('#imOk');
    assert.deepEqual((await saved(B.page, 'loteria.v1')).players.map(p => p.name + ':' + p.boards.length), ['Ana:1']);
    assert.deepEqual(A.problems, []); assert.deepEqual(B.problems, []);
  } finally { await A.ctx.close(); await B.ctx.close(); }
});

check('drive: the Tablas sheet, a card being picked and a printed tabla being typed in all survive a sync landing meanwhile', async () => {
  const g = fakeGoogle();
  const A = await driveDevice(g, { 'loteria.v1': ANA });
  const B = await driveDevice(g, { 'loteria.v1': ANA });
  const last = async d => (await saved(d.page, 'loteria.sync')).last;
  async function renameOnA(i, name) { // A renames a tabla and it reaches Drive; then B syncs
    const ta = await last(A);
    await A.page.click('#tablasBtn');
    await A.page.locator('#edb input').nth(i).fill(name);
    await A.page.locator('#edb input').nth(i).dispatchEvent('change');
    await A.page.click('#tbx');
    await synced(A.page, ta);
    await B.page.evaluate(() => LoteriaSync.now()); // if B is still syncing its own change, it syncs again straight after
    await until(B.page, name => JSON.parse(localStorage.getItem('loteria.v1')).players[0].boards.some(b => b.name === name), name, 30000);
  }
  try {
    await A.page.goto(base + 'board.html'); await synced(A.page);
    await B.page.goto(base + 'board.html'); await synced(B.page);
    // B is scrolled down the Tablas sheet when A's rename lands: the sheet is drawn again, in the same place.
    await B.page.click('#tablasBtn');
    const top = await B.page.evaluate(() => { const b = document.querySelector('#sheet .bd'); b.scrollTop = b.scrollHeight; return b.scrollTop; });
    await renameOnA(1, 'Otra');
    assert.equal(await B.page.inputValue('#edb > div:nth-child(2) input'), 'Otra');
    assert.ok(Math.abs(await B.page.evaluate(() => document.querySelector('#sheet .bd').scrollTop) - top) <= 2, 'the Tablas sheet went back to the top');
    // B is picking a card for square 1 of Mine 1 when A's next rename lands.
    await B.page.locator('#edb .eg .cell').first().click();
    await renameOnA(1, 'Otro');
    assert.equal(await B.page.getAttribute('#pkq', 'placeholder'), 'Pick a card for this square', 'the picker stays open');
    await B.page.fill('#pkq', '54'); await B.page.press('#pkq', 'Enter');
    let mine = (await saved(B.page, 'loteria.v1')).players[0].boards;
    assert.equal(mine[0].cards[0], 54, 'the picked card was lost');
    assert.equal(mine[1].name, 'Otro');
    // B is typing in a printed tabla when A's next rename lands.
    await B.page.click('#tbPrinted');
    await B.page.fill('#ptJ', 'CANELA'); await B.page.fill('#ptN', '7');
    await renameOnA(1, 'Segunda'); // another tabla: the same one changed on both would go to the newer change
    assert.equal(await sheetTitle(B.page), 'Add a printed tabla', 'the printed tabla sheet was swapped for Tablas');
    assert.equal(await B.page.inputValue('#ptJ'), 'CANELA'); assert.equal(await B.page.inputValue('#ptN'), '7');
    await B.page.click('#ptAdd');
    mine = (await saved(B.page, 'loteria.v1')).players[0].boards;
    assert.deepEqual(mine.map(b => b.name), ['Mine 1', 'Segunda', 'CANELA 7']);
    assert.equal(mine[0].cards[0], 54);
    assert.deepEqual(A.problems, []); assert.deepEqual(B.problems, []);
  } finally { await A.ctx.close(); await B.ctx.close(); }
});

// ---------------------------------------------------------------- offline
check('offline: every page opens with no network once it has been opened, and sw.js keeps every file they load', async () => {
  const sw = await readFile(join(root, 'sw.js'), 'utf8'), box = { self: { addEventListener() { } } };
  vm.runInNewContext(sw + '\n;this.out = { SHELL, CARDS };', box);
  const kept = box.out.SHELL.concat(box.out.CARDS);
  for (const f of kept) assert.ok(f === './' || existsSync(join(root, f)), 'sw.js keeps a file that isn’t there: ' + f);
  const ctx = await context(PHONE, { serviceWorkers: 'allow' });
  try {
    const page = await ctx.newPage(), problems = watch(page), loaded = new Set();
    page.on('request', r => { if (r.url().startsWith(base)) loaded.add(r.url().slice(base.length).split(/[?#]/)[0] || './'); });
    const PAGES = { '': 'nav.tiles', 'cantor.html': '#playBtn', 'board.html': '#callBtn', 'print.html': '#printBtn' };
    for (const p in PAGES) {
      await page.goto(base + p);
      await page.waitForSelector(PAGES[p]);
      await until(page, () => navigator.serviceWorker && navigator.serviceWorker.controller, null, 30000);
    }
    for (const f of loaded) {
      if (f === 'sw.js' || /^audio\/.+\.mp3$/.test(f)) continue; // the voices are kept as they play
      assert.ok(kept.indexOf(f) >= 0, 'sw.js doesn’t keep ' + f + ', so it won’t open offline');
    }
    await ctx.setOffline(true);
    for (const p in PAGES) {
      await page.goto(base + p);
      await page.waitForSelector(PAGES[p]);
      // The board shows its tablas behind the welcome sheet, with the card pictures from the offline copy.
      if (p === 'board.html') await until(page, () => [...document.querySelectorAll('#boards .cell img')].some(i => i.complete && i.naturalWidth > 0));
    }
    await ctx.setOffline(false);
    assert.deepEqual(problems.filter(p => !/ERR_INTERNET_DISCONNECTED/.test(p)), []);
  } finally { await ctx.close(); }
});

// ---------------------------------------------------------------- run them
const pick = process.argv.slice(2).map(s => s.toLowerCase());
let failed = 0, ran = 0;
try {
  for (const c of checks) {
    if (pick.length && !pick.some(w => c.name.toLowerCase().includes(w))) continue;
    ran++;
    let timer;
    try {
      await Promise.race([c.fn(), new Promise((_, no) => { timer = setTimeout(() => no(new Error('took longer than 3 minutes')), 180000); })]);
      console.log('ok    ' + c.name);
    } catch (e) {
      failed++;
      console.log('FAIL  ' + c.name + '\n      ' + String(e && e.message || e).split('\n').join('\n      '));
    } finally { clearTimeout(timer); }
  }
} finally {
  await browser.close();
  server.close();
}
if (!ran) { console.log('no check matches ' + pick.join(' ')); process.exit(1); }
if (failed) { console.log(`${failed} of ${ran} failed`); process.exit(1); }
console.log(`all ${ran} good`);
