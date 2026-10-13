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
// Google Fonts still come from Google until the fonts are served from here.
const STILL_FROM_GOOGLE = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

// A fresh browser profile: nothing saved, service workers off unless asked for, and nothing reaches the internet.
async function context(kind = PHONE, extra = {}) {
  const ctx = await browser.newContext({ ...kind, serviceWorkers: 'block', ...extra });
  await ctx.route(url => !url.href.startsWith(base), route => {
    const u = route.request().url();
    if (STILL_FROM_GOOGLE.some(h => u.startsWith(h))) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
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
    if (u.startsWith(base) || /^(data|blob):/.test(u) || allow.concat(STILL_FROM_GOOGLE).some(h => u.startsWith(h))) return;
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

check('board: Restore the original four and Remove a tabla ask for a second tap', async () => {
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
    const ta = (await saved(A.page, 'loteria.sync')).last;
    await A.page.evaluate(() => LoteriaSync.now());
    await synced(A.page, ta);
    assert.deepEqual((await saved(A.page, 'loteria.v1')).players[0].boards.map(b => b.name), ['Mía', 'Mine 2']);
    await until(A.page, () => document.querySelector('#boards .tabla .lbl .k').textContent.indexOf('Mía') === 0);
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
