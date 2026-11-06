// Uses the Lotería tools in Chromium through the real pages:  node test/e2e.mjs  (needs Playwright)
// El Cantor deals and checks a printed tabla, My tablas plays a round, Make tablas fills a tabla, two devices
// share tablas through a stand-in Google Drive, and every page works offline.
// To run some of the checks only, name them:  node test/e2e.mjs cantor print
import { createRequire } from 'node:module';
import { execSync, execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
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
// Its language is US English whatever this computer's is, since a phone in Spanish opens the app in Spanish.
async function context(kind = PHONE, extra = {}) {
  const ctx = await browser.newContext({ ...kind, locale: 'en-US', serviceWorkers: 'block', ...extra });
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
// A phone's keyboard px tall coming up: the visible part of the screen (visualViewport) loses that much at the bottom,
// and the page itself stays as tall, as on an iPhone and in Chrome on Android.
async function keyboardUp(page, px) {
  await page.evaluate(px => { const vv = visualViewport, h = innerHeight - px; Object.defineProperty(vv, 'height', { configurable: true, get: () => h }); vv.dispatchEvent(new Event('resize')); }, px);
}
const rect = (page, sel) => page.$eval(sel, el => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) }; });
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

// ---------------------------------------------------------------- the deck, without a browser
async function loadDeck() {
  const box = { window: {}, document: { currentScript: null } };
  vm.runInNewContext(await readFile(join(root, 'deck.js'), 'utf8'), box);
  return box.window.Loteria;
}
const plain = x => JSON.parse(JSON.stringify(x)); // arrays made in the vm, as this file's own

check('deck: the juego generator never changes', async () => {
  // Printed tablas outlive the code (deck.js), so these are written out as they were at aae7748. CANELA 1–12 take the
  // generator's plain path. CAJETA 13 is the first here that needed another layout, so that no Clásico four on it is the
  // same four cards as on an earlier tabla. On J19X355 861 none of the 24 layouts tried was clear, and the first was
  // kept. The fingerprint is the sha256 of JSON.stringify(juego('CANELA', 100)).
  const L = await loadDeck();
  assert.deepEqual(plain(L.juego('CANELA', 12)), [
    [18, 24, 9, 36, 51, 50, 22, 34, 54, 38, 41, 25, 47, 2, 8, 42], // 1
    [52, 1, 6, 12, 30, 29, 35, 33, 48, 31, 16, 11, 32, 27, 3, 43], // 2
    [39, 46, 13, 53, 49, 4, 40, 7, 45, 44, 17, 21, 23, 19, 5, 28], // 3
    [18, 42, 14, 9, 26, 10, 45, 15, 50, 30, 37, 34, 17, 20, 1, 38], // 4
    [24, 15, 31, 44, 27, 3, 49, 16, 28, 48, 46, 7, 6, 2, 19, 37], // 5
    [5, 39, 43, 36, 47, 11, 54, 35, 26, 52, 53, 10, 20, 32, 22, 12], // 6
    [21, 51, 23, 6, 16, 33, 8, 4, 14, 20, 9, 40, 29, 41, 13, 25], // 7
    [34, 13, 33, 22, 35, 43, 2, 5, 26, 48, 28, 40, 3, 14, 51, 30], // 8
    [54, 21, 44, 12, 45, 50, 39, 25, 1, 38, 49, 42, 52, 27, 18, 4], // 9
    [15, 8, 37, 24, 29, 32, 41, 19, 47, 17, 23, 10, 7, 36, 53, 31], // 10
    [48, 22, 46, 29, 50, 14, 4, 27, 12, 34, 19, 11, 1, 26, 20, 28], // 11
    [54, 39, 5, 42, 9, 41, 7, 40, 43, 52, 36, 24, 11, 49, 10, 51] // 12
  ], 'CANELA 1–12');
  assert.deepEqual(plain(L.juegoTabla('CAJETA', 13)), [41, 8, 38, 50, 30, 48, 25, 37, 1, 43, 17, 6, 54, 36, 39, 26], 'CAJETA 13, another layout');
  assert.deepEqual(plain(L.juegoTabla('J19X355', 861)), [22, 30, 15, 44, 29, 4, 14, 6, 36, 16, 52, 5, 35, 38, 39, 32], 'J19X355 861, the first of 24 layouts');
  assert.equal(createHash('sha256').update(JSON.stringify(L.juego('CANELA', 100))).digest('hex'), '21071b06ce6c859639716856ffe35117501be108b4d13880e561ae3b3e4d62b3', 'CANELA 1–100');
});

check('deck: Clásico already wins with every shape but Siete Loco, and a game’s name says when it has both', async () => {
  const L = await loadDeck();
  // Each way to make each shape holds a Clásico four (a row, column or diagonal, the corners, or a 2×2), except Siete
  // Loco's any seven. So holding a shape on Clásico keeps the game as it is, and only Siete Loco goes on top.
  const fours = ['linea', 'esquinas', 'cuadro'].flatMap(id => L.pat(id).sets);
  for (const p of L.PATS) {
    if (p.combo) continue;
    assert.equal(!!p.sets && p.sets.every(set => fours.some(f => f.every(c => set.includes(c)))), p.id !== 'siete', p.name);
    const ids = L.CLASICO.slice();
    L.holdShape(ids, p.id);
    assert.deepEqual(plain(ids), p.id === 'siete' ? ['linea', 'esquinas', 'cuadro', 'siete'] : ['linea', 'esquinas', 'cuadro'], 'holding ' + p.name + ' on Clásico');
  }
  assert.equal(L.gameName(['linea', 'esquinas', 'cuadro']), 'Clásico');
  assert.equal(L.gameName(L.CLASICO.concat('siete')), 'Clásico + Siete Loco');
  assert.equal(L.gameName(['esquinas', 'centro']), 'Esquinas · Centro');
  assert.equal(L.gameName(['equis', 'marco', 'ele']), 'La Equis +2');
  assert.equal(L.gameName([]), 'Pick a game');
});

// ---------------------------------------------------------------- the words, without a browser
// The keys whose Spanish reads the same as the English (the language switch's labels by design, and names); every other key's
// Spanish is a translation.
const SAME = ['lang.label', 'lang.en', 'lang.es', 'tablas', 'pace.normal', 'cantor.rate.normal', 'cantor.goodLine', 'print.mini', 'sync.errH'];
// strings.js as a page loads it on a device in this language, with this choice saved (or none).
async function loadStrings(language = 'en-US', chosen = null) {
  const box = { navigator: { language, languages: [language] }, document: { documentElement: {} }, localStorage: { getItem: k => k === 'loteria.lang' ? chosen : null } };
  box.window = box;
  vm.runInNewContext(await readFile(join(root, 'strings.js'), 'utf8'), box);
  return { T: box.T, lang: box.document.documentElement.lang };
}

check('strings: every word is there in English and in Spanish, with the same {values}, and each one is used', async () => {
  const { T } = await loadStrings(), { en, es } = T.S;
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort(), 'English and Spanish have different keys');
  const holes = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const k in en) {
    const a = en[k], b = es[k], count = typeof a === 'object';
    assert.equal(typeof b, typeof a, k + ': a count in one language only');
    if (count) for (const v of [a, b]) assert.deepEqual(Object.keys(v).sort(), ['one', 'other'], k + ': a count needs its one and other forms');
    for (const f of count ? ['one', 'other'] : [null]) {
      const x = f ? a[f] : a, y = f ? b[f] : b, what = k + (f ? '.' + f : '');
      assert.ok(typeof x === 'string' && x.trim() && typeof y === 'string' && y.trim(), what + ' is empty');
      assert.deepEqual(holes(y), holes(x), what + ': English and Spanish fill in different {values}');
      if (!/_html$/.test(k)) assert.ok(!/[<>&]/.test(x + y), what + ' holds markup, but its key doesn’t end _html');
    }
  }
  // Each key a page uses is there, and each key there is used. A key is used as data-t…="key", in the first
  // argument of T( or T.html(, which may pick one of a few: T(on ? 'on' : 'off'), or as the note in sync.js's
  // setStatus(status, note), which it says later. 'prefix.' + id there uses every key starting prefix., and each
  // shape, voice and pace then needs its own.
  const used = new Set(), prefixes = new Set();
  for (const f of ['index.html', 'cantor.html', 'board.html', 'print.html', 'sync.js', 'deck.js', 'strings.js']) {
    const src = await readFile(join(root, f), 'utf8');
    for (const m of src.matchAll(/\b(T(?:\.html)?|setStatus)\(/g)) {
      let arg = '', depth = 0, nth = m[1] === 'setStatus' ? 1 : 0;
      for (let i = m.index + m[0].length; i < src.length; i++) {
        const c = src[i];
        if (c === "'") { const j = src.indexOf("'", i + 1); if (!nth) arg += src.slice(i, j + 1); i = j; continue; }
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c) && !depth--) break;
        else if (c === ',' && !depth && !nth--) break;
        if (!nth) arg += c;
      }
      for (const q of arg.matchAll(/'([\w.]+)'(\s*\+)?/g)) (q[2] ? prefixes : used).add(q[1]);
    }
    for (const m of src.matchAll(/\bdata-t(?:-html|-aria|-title|-ph)?="([\w.]+)"/g)) used.add(m[1]);
  }
  for (const k of used) assert.ok(k in en, k + ' is used but isn’t in strings.js');
  for (const k in en) assert.ok(used.has(k) || [...prefixes].some(p => k.startsWith(p)), k + ' is in strings.js, but nothing uses it');
  const L = await loadDeck(), voices = JSON.parse(await readFile(join(root, 'audio/voices.json'), 'utf8')).voices;
  assert.deepEqual([...prefixes].sort(), ['pace.', 'pat.', 'voice.']);
  for (const id of L.PATS.map(p => p.id)) assert.ok('pat.' + id in en, 'no words for the shape ' + id);
  for (const v of voices) assert.ok('voice.' + v.id in en, 'no words for the voice ' + v.id);
  for (const v of ['slow', 'normal', 'fast']) assert.ok('pace.' + v in en, 'no word for the pace ' + v);
  // The Spanish is a translation: only these read the same in both (the language switch's labels by design).
  assert.deepEqual(Object.keys(en).filter(k => JSON.stringify(es[k]) === JSON.stringify(en[k])), SAME, 'Spanish left the same as the English');
});

check('strings: Spanish for a device in Spanish until a language is chosen, and counts, lists and ordinals in each', async () => {
  for (const [device, chosen, lang] of [['es-MX', null, 'es-MX'], ['es', null, 'es-MX'], ['es-419', null, 'es-MX'], ['es-US', null, 'es-MX'], ['ES-es', null, 'es-MX'], ['en-US', null, 'en'], ['fr-FR', null, 'en'], ['', null, 'en'], ['es-MX', 'en', 'en'], ['en-US', 'es', 'es-MX'], ['en-US', 'fr', 'en']]) {
    const got = await loadStrings(device, chosen);
    assert.deepEqual([got.lang, got.T.lang, got.T.locale], [lang, lang === 'en' ? 'en' : 'es', lang === 'en' ? 'en-US' : 'es-MX'], `a device in “${device}” with ${chosen || 'nothing'} chosen`);
  }
  const { T: E } = await loadStrings('en-US'), { T: S } = await loadStrings('es-MX');
  // Made-up keys, put in the tables the two loaded copies read.
  for (const T of [E, S]) {
    Object.assign(T.S.en, { 'x.n': { one: '1 card', other: '{n} cards' }, 'x_html': '<b>{who}</b> won', 'x.amp': 'A & B' }); // x.amp only in English
    Object.assign(T.S.es, { 'x.n': { one: '1 carta', other: '{n} cartas' }, 'x_html': '<b>{who}</b> ganó' });
  }
  assert.deepEqual([E('x.n', { n: 1 }), E('x.n', { n: 0 }), E('x.n', { n: 12 }), S('x.n', { n: 1 }), S('x.n', { n: 2 })], ['1 card', '0 cards', '12 cards', '1 carta', '2 cartas']);
  assert.equal(S('x.amp'), 'A & B', 'a key missing in Spanish shows its English');
  assert.equal(S('no.such.key'), 'no.such.key');
  assert.equal(E.html('x_html', { who: '<Tía & Lupe>' }), '<b>&lt;Tía &amp; Lupe&gt;</b> won');
  assert.equal(E('x_html', { who: '<i>' }), '<b><i></b> won', 'T leaves text as it is (it goes in with textContent)');
  assert.deepEqual([E.list(['El Gallo']), E.list(['El Gallo', 'La Luna']), E.list(['El Gallo', 'La Luna', 'La Rosa'])], ['El Gallo', 'El Gallo and La Luna', 'El Gallo, La Luna and La Rosa']);
  assert.equal(S.list(['El Gallo', 'La Luna', 'La Rosa']), 'El Gallo, La Luna y La Rosa');
  // A round won with the cards called so far, not with that many on the tabla.
  assert.deepEqual([E('cantor.wonNobody', { r: 2, n: 1 }), S('cantor.wonNobody', { r: 2, n: 1 }), S.html('cantor.won_html', { who: 'Tía Lupe', r: 2, n: 6 })], ['Round 2 is won after 1 card.', 'Se ganó la ronda 2 con 1 carta cantada.', '<b>Tía Lupe</b> gana la ronda 2 con 6 cartas cantadas.']);
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 54, 101, 111].map(E.ord), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '54th', '101st', '111th']);
  assert.deepEqual([1, 5, 22].map(S.ord), ['1.ª', '5.ª', '22.ª']);
  // The Spanish read through by a native ear: everyday word order, the shapes named as the picker names them, tú
  // and one person where it's one person.
  assert.deepEqual([S('newRound'), S('cantor.shuffleNew'), S('cantor.buenaNew'), S('board.newRoundWhat')], ['Nueva ronda', 'Barajar — nueva ronda', '¡Buena! Nueva ronda', 'Nueva ronda — ¿a qué jugamos?']);
  assert.deepEqual([S('shapeAdded', { shape: 'Esquinas' }), S('pat.siete'), S('pat.clasico'), S('pat.cuadro')], ['Ahora también se gana con Esquinas', 'siete casillas, las que sean', 'línea, esquinas o cuadrito', 'cualquier cuadrito de 2×2']);
  for (const k of ['cantor.patsNote_html', 'board.patsNote_html']) assert.match(S(k), /<b>Clásico<\/b> es lo de siempre — (una tabla gana con )?línea, esquinas o cuadrito\./, k);
  assert.deepEqual([S('cantor.startRoundNote', { n: 1 }), S('cantor.startRoundNote', { n: 6 })].map(t => t.split('. ')[0]), ['La carta que ya salió regresa a la baraja y se vuelve a barajar', 'Las 6 cartas que ya salieron regresan a la baraja y se vuelve a barajar']);
  assert.deepEqual([S('cantor.checkIt'), S('cantor.trust'), S('cantor.check'), S('cantor.prMaking'), S('cantor.prHowMany')], ['¡Lotería! — a ver', 'Le creemos', 'Revisamos la tabla', 'Haciendo el PDF…', '¿Cuántas?']);
  for (const k of ['board.aboutDrive', 'board.aboutLocal']) assert.match(S(k), /^Todo se guarda en este dispositivo/, k);
  assert.equal(S('board.soundsNote'), 'Suena un frijol al marcar y una fanfarria cuando ganas.');
  // A tabla not full, one or two of them, in each language.
  assert.deepEqual([E('print.notFull', { n: 1, list: 'T' }), E('print.notFull', { n: 2, list: 'T' }), S('print.notFull', { n: 1, list: 'T' }), S('print.notFull', { n: 2, list: 'T' })], ['Not full yet, its empty squares print blank: T', 'Not full yet, empty squares print blank: T', 'Todavía no está llena; sus casillas vacías salen en blanco: T', 'Todavía no están llenas; las casillas vacías salen en blanco: T']);
});

// A page's words a person can see or hear, swept for English: visible text, the options in a list, and every
// aria-label, title and placeholder. The language switch's English and junkdrawer.works are left out. An English word is one strings.js's English uses and its Spanish never does
// (nor the cards' names and verses), or one of a few more that a page might say.
let ENGLISH;
async function englishWords() {
  if (ENGLISH) return ENGLISH;
  const { T } = await loadStrings(), L = await loadDeck();
  const words = list => new Set(list.join(' ').replace(/<[^>]*>|\{\w+\}/g, ' ').toLowerCase().match(/\p{L}+/gu) || []);
  const flat = o => Object.values(o).flatMap(v => typeof v === 'object' ? [v.one, v.other] : [v]);
  const translated = Object.keys(T.S.es).filter(k => SAME.includes(k) || JSON.stringify(T.S.es[k]) !== JSON.stringify(T.S.en[k])).map(k => T.S.es[k]);
  const not = words(flat(translated).concat(L.CARDS.map(c => c.name + ' ' + c.verse), L.PATS.map(p => p.name)));
  const more = 'the and or to of is it on off in with your this that tap card cards round settings done print copy link called keep clear remove share undo sync saved player winner winners next previous start shuffle game home tools privacy play along open'.split(' ');
  const en = [...words(flat(T.S.en))].filter(w => w.length > 1 && !not.has(w)).concat(more);
  return (ENGLISH = '(?<!\\p{L})(' + [...new Set(en)].join('|') + ')(?!\\p{L})');
}
const english = async page => page.evaluate(src => {
  const EN = new RegExp(src, 'iu'), bad = [], skip = el => el.closest('[lang="en"], script, style, noscript');
  const seen = el => el.checkVisibility() || el.closest('select');
  const say = (t, where) => { t = String(t || '').replace(/junkdrawer\.works/g, ''); if (EN.test(t)) bad.push(where + t.trim()); };
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) { const el = n.parentElement; if (el && !skip(el) && seen(el)) say(n.textContent, ''); }
  for (const el of document.body.querySelectorAll('[aria-label], [title], [placeholder], optgroup')) {
    if (skip(el) || !seen(el)) continue;
    for (const a of ['aria-label', 'title', 'placeholder', 'label']) if (el.hasAttribute(a) && (a !== 'label' || el.tagName === 'OPTGROUP')) say(el.getAttribute(a), a + ': ');
  }
  say(document.title, 'title: ');
  return bad;
}, await englishWords());

check('espanol: a phone in Spanish opens the home screen in Spanish, and English / Español changes it and stays', async () => {
  for (const kind of [PHONE, { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, DESKTOP]) {
    const ctx = await context(kind, { locale: 'es-MX' });
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await page.goto(base);
      assert.equal(await page.getAttribute('html', 'lang'), 'es-MX');
      assert.equal(await page.getAttribute('html', 'translate'), 'no', 'the browser offers to translate Spanish it put there itself');
      assert.equal(await page.textContent('header p'), 'Canta la lotería, juega en tu teléfono o haz tus propias tablas.');
      assert.deepEqual(await english(page), [], 'English on the home screen in Spanish');
      assert.deepEqual(await page.$$eval('#langSw button', bs => bs.map(b => [b.textContent, b.lang, b.getAttribute('aria-pressed')])), [['English', 'en', 'false'], ['Español', 'es', 'true']]);
      assert.equal(await page.getAttribute('#langSw .seg', 'aria-label'), 'Idioma · Language');
      await noSideways(page, 'the home screen in Spanish');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
  // A phone in English opens it in English; Español is a tap away, and it stays chosen.
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base);
    assert.equal(await page.getAttribute('html', 'lang'), 'en');
    assert.equal(await page.textContent('header p'), 'Call the game, play along, or make your own tablas.');
    await Promise.all([page.waitForEvent('load'), page.click('#langSw [lang="es"]')]);
    assert.equal(await page.getAttribute('html', 'lang'), 'es-MX');
    assert.equal(await page.textContent('.tile [data-t="tool.board"]'), 'Mis tablas');
    assert.equal(await page.evaluate(() => localStorage.getItem('loteria.lang')), 'es');
    await page.reload();
    assert.equal(await page.getAttribute('html', 'lang'), 'es-MX', 'Español didn’t stay chosen');
    assert.deepEqual(await english(page), []);
    await Promise.all([page.waitForEvent('load'), page.click('#langSw [lang="en"]')]);
    assert.equal(await page.getAttribute('html', 'lang'), 'en');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('loteria.reopen')), null, 'the home screen asks a page to open its Settings');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('espanol: El Cantor in Spanish, every sheet and the ¡Lotería! box, and the PDF it prints', async () => {
  const CANTOR = { order: run(1, 54), pos: 5, round: 2, patterns: ['linea', 'esquinas', 'cuadro'], juego: 'CANELA', wins: [{ round: 1, who: 'Abuela', how: 'Clásico', tabla: 'CANELA 7', at: 17, t: 1 }], print: { name: 'CAPIROTADA', count: 2, per: 1, paper: 'letter' }, settings: { speak: true, sound: false, awake: false, check: false, pace: 'slow' } };
  for (const kind of [PHONE, DESKTOP]) {
    const ctx = await context(kind, { locale: 'es-MX' });
    try {
      const page = await ctx.newPage(), problems = watch(page), phone = kind === PHONE, where = phone ? 'phone: ' : 'computer: ';
      await seed(page, { 'loteria.cantor': CANTOR });
      await page.goto(base + 'cantor.html');
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.getAttribute('html', 'lang'), 'es-MX');
      assert.deepEqual([await page.textContent('#cap .no'), await page.textContent('#sabCount'), await page.textContent('#sub')], ['No. 5 · 5.ª en salir', '5 cantadas · faltan 49', 'Ronda 2 · 5 de 54']);
      assert.deepEqual(await english(page), [], where + 'English on El Cantor');
      const sheet = async (open, what) => {
        await page.click(open);
        await until(page, () => !document.getElementById('sheet').hidden);
        assert.deepEqual(await english(page), [], where + 'English in ' + what);
        await noSideways(page, what + ' in Spanish');
      };
      // Settings: the language comes first, with Español on; the voices are in Spanish, under their headings.
      await sheet('#setBtn', 'Settings');
      assert.equal(await sheetTitle(page), 'Ajustes');
      assert.equal(await page.textContent('#sheet .bd > .card:first-child .eyebrow'), 'Idioma · Language');
      assert.equal(await page.getAttribute('#langSw [lang="es"]', 'aria-pressed'), 'true');
      await until(page, () => document.querySelectorAll('#vSel option').length >= 3);
      assert.deepEqual(await page.$$eval('#vSel optgroup', gs => gs.map(g => [g.label, [...g.children].map(o => o.textContent)])).then(gs => gs.slice(0, 1)), [['Voces grabadas', ['Dora · voz de mujer', 'Alex · voz de hombre', 'Santa · voz de hombre más grave']]]);
      assert.deepEqual(await english(page), [], where + 'English in Settings');
      await page.click('#stx');
      // The game picker, and what holding a shape says.
      await sheet('#patBtn', 'the game picker');
      assert.equal(await sheetTitle(page), '¿A qué jugamos?');
      await page.locator('#pats .pat', { hasText: 'La Ele' }).press('Shift+Enter');
      assert.equal(await page.textContent('#toast'), 'Clásico ya gana con La Ele');
      await page.click('#ptx');
      if (phone) { await sheet('#sabBtn', 'the sábana'); await page.click('#ssx'); }
      await sheet('#newBtn', 'a new round');
      assert.equal(await sheetTitle(page), '¿Empezar la ronda 3?');
      await page.click('#nrNo');
      // Print tablas, and the PDF: its footer is in Spanish (the writer leaves the page's words uncompressed).
      await sheet('#printBtn', 'Print tablas');
      assert.equal(await page.textContent('#prInfo'), '2 tablas del juego CAPIROTADA · 2 hojas, tamaño carta');
      if (!phone) {
        const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#prGo')]);
        const pdf = await readFile(await dl.path(), 'latin1');
        assert.ok(pdf.includes('Juego CAPIROTADA · Tabla 2 · El Cantor puede revisar esta tabla por su número'.replace('·', '·')), 'the PDF’s footer isn’t in Spanish');
        assert.ok(!/check this tabla/.test(pdf), 'the PDF still has the English footer');
        await until(page, () => document.getElementById('toast').textContent.indexOf('Descargado') === 0);
        assert.deepEqual(await english(page), [], where + 'English after the PDF');
      }
      await page.click('#prx');
      // ¡Lotería!: the box, then the checker in both modes, Not yet and ¡Buena!. (On the computer the checker opens on
      // the juego just printed.)
      await page.click('#lotBtn');
      await page.waitForSelector('#winbox .winc #clCheck');
      assert.deepEqual(await english(page), [], where + 'English in the ¡Lotería! box');
      await page.click('#clCheck');
      await until(page, () => !document.getElementById('sheet').hidden);
      assert.equal(await sheetTitle(page), '¡Lotería! — a ver');
      await page.fill('#vfN', '7');
      assert.equal(await page.textContent('#vfV h3'), 'Todavía no');
      assert.match(await page.textContent('#vfV p'), /^(CANELA|CAPIROTADA) No\. 7 va más cerca de \S.* y le faltan? .+\. Las casillas con borde rojo todavía no salen\.$/);
      assert.equal(await page.textContent('#vfWin'), 'Darla por buena');
      assert.deepEqual(await english(page), [], where + 'English on Not yet');
      await page.click('#vfSeg [data-v="cards"]');
      assert.equal(await page.textContent('#vfV p'), 'Pídele que te lea sus cartas ganadoras y toca cada una abajo. Así funciona con una tabla de la tienda o de otro juego.');
      assert.deepEqual(await english(page), [], where + 'English in Card by card');
      const pick = name => page.locator('#vfPick .pk', { has: page.locator('.n', { hasText: new RegExp('^' + name + '$') }) }).click();
      await pick('El Gallo'); await pick('La Luna');
      assert.deepEqual([await page.textContent('#vfV h3'), await page.textContent('#vfV p')], ['Todavía no', 'La Luna todavía no sale.']);
      // A called card's place in the order, the Spanish way: la 1.ª, not #1.
      assert.deepEqual(await page.$$eval('#vfChips .chip', bs => bs.map(b => b.textContent)), ['El Gallo · 1.ª ✕', 'La Luna · todavía no ✕']);
      assert.deepEqual(await page.$$eval('#vfPick .pk .st', ss => ss.map(s => s.textContent)), ['1.ª', '✕']);
      await page.locator('#vfChips .chip', { hasText: 'La Luna' }).click();
      assert.equal(await page.textContent('#vfV'), 'Clásico necesita 4 casillas — hasta ahora te leyó 1 carta. Sigue tocando.'); // one card can't make four squares
      await pick('El Diablito');
      assert.deepEqual([await page.textContent('#vfV h3'), await page.textContent('#vfV p')], ['Ya salieron las 2', 'Si forman la figura — Clásico — con dobles en su tabla, es buena. Ya estaba completa desde hace 3 cartas: El Diablito, la 2.ª en salir.']);
      assert.equal(await page.textContent('#vfWin'), '¡Buena! Nueva ronda');
      assert.deepEqual(await english(page), [], where + 'English on ¡Buena!');
      await page.fill('#vfWho', 'Tía Lupe');
      await page.click('#vfWin');
      await page.waitForSelector('#winbox .winc #celOk');
      assert.equal(await page.textContent('#winbox .winc p'), 'Tía Lupe gana la ronda 2 con 5 cartas cantadas.');
      assert.deepEqual(await english(page), [], where + 'English in the celebration');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
  // A phone in English opens El Cantor in English. Español chosen on the home screen carries over and stays; English
  // chosen in El Cantor's Settings brings Settings back up in English.
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'cantor.html');
    assert.equal(await page.getAttribute('html', 'lang'), 'en');
    assert.match(await page.textContent('#cap h2'), /Ready when you are/);
    await page.goto(base);
    await Promise.all([page.waitForEvent('load'), page.click('#langSw [lang="es"]')]);
    await page.goto(base + 'cantor.html');
    assert.equal(await page.getAttribute('html', 'lang'), 'es-MX');
    assert.equal(await page.textContent('#cap h2'), 'Cuando quieras');
    await page.reload();
    assert.equal(await page.textContent('#cap h2'), 'Cuando quieras', 'Español didn’t stay chosen');
    await page.click('#setBtn');
    await Promise.all([page.waitForEvent('load'), page.click('#langSw [lang="en"]')]);
    await until(page, () => !document.getElementById('sheet').hidden);
    assert.equal(await sheetTitle(page), 'Settings', 'Settings didn’t come back after the language changed');
    assert.equal(await page.getAttribute('html', 'lang'), 'en');
    await page.reload();
    assert.ok(await page.evaluate(() => document.getElementById('sheet').hidden), 'Settings opens on every reload');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('espanol: My tablas in Spanish, from the first visit and a shared link to Settings, Tablas, Share, Cantaron… and a ¡Lotería!', async () => {
  for (const kind of [PHONE, DESKTOP]) {
    const ctx = await context(kind, { locale: 'es-MX' });
    try {
      const page = await ctx.newPage(), problems = watch(page), where = kind === PHONE ? 'phone: ' : 'computer: ';
      const clean = async what => { assert.deepEqual(await english(page), [], where + 'English in ' + what); await noSideways(page, what + ' in Spanish'); };
      const toast = text => until(page, t => document.getElementById('toast').textContent === t && document.getElementById('toast').classList.contains('show'), text);
      await page.goto(base + 'board.html');
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.getAttribute('html', 'lang'), 'es-MX');
      assert.equal(await page.title(), 'Lotería · Mis tablas');
      assert.equal(await sheetTitle(page), '¿Quién juega en este dispositivo?');
      await page.click('#wRandom'); // no name yet
      assert.equal(await page.textContent('#wNeed'), 'Primero tu nombre');
      await clean('the first visit');
      // A shared link with one tabla, El Gallo on it twice.
      await page.goto(base + 'board.html#t=Mam%C3%A1~Tabla%201:1.1.3.4.5.6.7.8.9.a.b.c.d.e.f.g');
      await until(page, () => (document.querySelector('#sheet h2') || {}).textContent === 'Tablas de Mamá');
      assert.equal(await page.textContent('#sheet .note'), 'Esta liga trae 1 tabla para “Mamá”.');
      await clean('a shared link');
      await page.click('#imOk');
      await toast('Juegas como Mamá');
      assert.equal(await page.textContent('#hist'), 'Aquí salen las cartas cantadas');
      await clean('My tablas');
      // Settings: the language first, with Español on; someone added gets two tablas.
      await page.click('#setBtn');
      assert.equal(await sheetTitle(page), 'Ajustes');
      assert.equal(await page.textContent('#sheet .bd > .card:first-child .eyebrow'), 'Idioma · Language');
      assert.equal(await page.getAttribute('#langSw [lang="es"]', 'aria-pressed'), 'true');
      assert.deepEqual([await page.textContent('#sndBtn'), await page.textContent('#gdBtn')], ['Sí', 'Sí']);
      await clean('Settings');
      await page.fill('#pnew', 'Beto'); await page.click('#padd');
      await toast('Beto empieza con dos tablas al azar — cámbialas en Tablas');
      assert.deepEqual([await page.textContent('#plBtn'), await page.textContent('#who')], ['Beto', '2 tablas']);
      await page.locator('#plist .chip', { hasText: 'Mamá' }).click();
      assert.deepEqual([await page.textContent('#plBtn'), await page.textContent('#who')], ['Mamá', '1 tabla']);
      await page.click('#stx');
      // Tablas: the double, a second tap, a printed tabla, and Share.
      await page.click('#tablasBtn');
      assert.equal(await page.textContent('#edb .dups'), 'Dos veces: El Gallo');
      assert.match(await page.textContent('#sheet .bd > .note'), /\(regla de la familia\)/);
      await page.click('#tbOrig');
      assert.equal(await page.textContent('#tbOrig'), 'Toca otra vez para reemplazar tu tabla');
      await clean('Tablas');
      await page.click('#tbPrinted');
      assert.equal(await sheetTitle(page), 'Agregar una tabla impresa');
      await page.fill('#ptJ', 'CANELA'); await page.fill('#ptN', '7');
      await clean('a printed tabla');
      await page.click('#ptx');
      await page.click('#tbShare');
      assert.equal(await sheetTitle(page), 'Compartir las tablas de Mamá');
      assert.match(await page.textContent('#sheet .note'), /^Quien abra esta liga recibe una copia de esta tabla en su dispositivo, con el nombre “Mamá”\./);
      await clean('Share');
      await page.click('#shx');
      // Cantaron…: El Gallo, La Dama and El Catrín finish the top row; the ¡Lotería! box, then a new round.
      await page.click('#callBtn');
      await clean('Cantaron…');
      for (const n of ['1', '3', '4']) { await page.fill('#pkq', n); await page.press('#pkq', 'Enter'); }
      await page.waitForSelector('#winbox .winc');
      assert.equal(await page.textContent('#winbox .note'), '¡Grítala antes que nadie!');
      await clean('the ¡Lotería! box');
      await page.click('#winOk');
      if (kind === PHONE) await page.click('#callBtn'); // a phone closed Cantaron… to show the winning tabla
      await page.fill('#pkq', '1'); await page.press('#pkq', 'Enter');
      await toast('El Gallo ya salió');
      await page.fill('#pkq', 'zz');
      assert.equal(await page.textContent('#pk'), 'Ninguna carta coincide con “zz”.');
      await page.click('#pkx');
      assert.equal(await page.textContent('#hist .cnt'), '3 cantadas');
      await page.click('#clearBtn');
      assert.equal(await sheetTitle(page), '¿Limpiar la ronda?');
      await clean('Clear the round?');
      await page.click('#clOk');
      assert.equal(await sheetTitle(page), 'Nueva ronda — ¿a qué jugamos?');
      await page.locator('#pats .pat', { hasText: 'La Ele' }).press('Shift+Enter');
      await toast('Clásico ya gana con La Ele');
      await clean('the game picker');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
  // English chosen in My tablas' Settings brings Settings back up in English, and only that once.
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': ANA, 'loteria.lang': 'es' });
    await page.goto(base + 'board.html');
    assert.equal(await page.textContent('#hist'), 'Aquí salen las cartas cantadas');
    await page.click('#setBtn');
    await Promise.all([page.waitForEvent('load'), page.click('#langSw [lang="en"]')]);
    await until(page, () => !document.getElementById('sheet').hidden);
    assert.equal(await sheetTitle(page), 'Settings', 'Settings didn’t come back after the language changed');
    assert.equal(await page.getAttribute('html', 'lang'), 'en');
    assert.equal(await page.title(), 'Lotería · My tablas');
    await page.reload();
    assert.ok(await page.evaluate(() => document.getElementById('sheet').hidden), 'Settings opens on every reload');
    assert.equal(await page.textContent('#hist'), 'Called cards show up here');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('espanol: Make tablas in Spanish, with Print… and Play these in My tablas…', async () => {
  // Tabla 1 full, with El Gallo twice; Tabla 2 nine cards in. Ana's two tablas from My tablas are there to copy in.
  const PRINT = { tablas: [{ id: 't1', name: 'Tabla 1', cards: [1].concat(run(1, 15)) }, { id: 't2', name: 'Tabla 2', cards: run(20, 9).concat([0, 0, 0, 0, 0, 0, 0]) }], set: { doubles: true, per: 2, paper: 'letter', names: true, who: '' } };
  for (const kind of [PHONE, { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, DESKTOP]) {
    const ctx = await context(kind, { locale: 'es-MX' });
    try {
      const page = await ctx.newPage(), problems = watch(page), where = kind.viewport.width + ': ';
      const clean = async what => { assert.deepEqual(await english(page), [], where + 'English in ' + what); await noSideways(page, what + ' in Spanish'); };
      const toast = text => until(page, t => document.getElementById('toast').textContent === t && document.getElementById('toast').classList.contains('show'), text);
      await seed(page, { 'loteria.v1': ANA, 'loteria.print': PRINT });
      await page.goto(base + 'print.html');
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.getAttribute('html', 'lang'), 'es-MX');
      assert.equal(await page.title(), 'Lotería · Hacer tablas');
      assert.deepEqual([await page.textContent('#dblBtn'), await page.textContent('.tb .tbn')], ['Dobles ✓', 'Dos veces: El Gallo']);
      assert.equal(await page.textContent('#dnote'), 'Toca una carta para ponerla en Tabla 2, casilla 10 — o arrástrala a donde quieras.'); // Tabla 1 is full
      await clean('Make tablas');
      await page.locator('.addt .chip', { hasText: 'Tablas de Ana (2)' }).click();
      await toast('Se agregaron 2 tablas');
      await page.click('.tb[data-t="t1"] [data-a="dup"]');
      assert.ok(await page.evaluate(() => [...document.querySelectorAll('#tg .nm')].some(i => i.value === 'Tabla 1 (copia)')), 'a copy isn’t named “Tabla 1 (copia)”');
      await page.click('#dblBtn');
      await toast('Sin dobles — si sueltas una carta que ya está, se mueve');
      assert.equal(await page.locator('.tb .tbn').first().textContent(), 'Dos veces: El Gallo — no se permiten dobles');
      await page.click('#dblBtn');
      await clean('Make tablas, with tablas copied in');
      // Print…: the sizes in pulgadas, and each Sí / No on the right of its row, even when its label wraps.
      await page.click('#printBtn');
      assert.equal(await page.textContent('#dlg h2'), 'Imprimir tablas');
      assert.match(await page.textContent('#pers .per.on small'), /^Normal · cartas de \d\.\d\d × \d\.\d\d\u00a0pulg\.$/);
      assert.equal(await page.textContent('#pwarn'), 'Todavía no está llena; sus casillas vacías salen en blanco: Tabla 2 (faltan\u00a07)');
      const right = await page.$$eval('#paperSeg, #nameSeg', ss => ss.map(s => Math.round(s.getBoundingClientRect().right)));
      assert.equal(right[0], right[1], 'Sí / No isn’t on the right of its row');
      await clean('Print…');
      await page.click('#pdx');
      // Play these in My tablas…: a link with no name typed goes as Familia.
      await page.click('#appBtn');
      assert.equal(await page.textContent('#appBtn'), 'Jugar estas en Mis tablas…');
      assert.equal(await page.textContent('#dlg h2'), 'Jugar estas en Mis tablas');
      assert.equal(await page.textContent('#apOpen'), 'Abrir en Mis tablas');
      assert.equal(await page.textContent('#dlg .note'), 'Hace una liga que abre Mis tablas con estas 4 tablas para quien tú digas. Ábrela aquí o mándala al teléfono o iPad donde se va a jugar. 1 tabla todavía no está llena y se queda.');
      await clean('Play these in My tablas…');
      await Promise.all([page.waitForURL(/board\.html#t=Familia~/), page.click('#apOpen')]);
      await until(page, () => (document.querySelector('#sheet h2') || {}).textContent === 'Tablas de Familia');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
  // English chosen at the foot of Make tablas: the page comes back in English, with the switch in view.
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.print': PRINT, 'loteria.lang': 'es' });
    await page.goto(base + 'print.html');
    assert.equal(await page.textContent('#printBtn'), 'Imprimir…');
    assert.equal(await page.getAttribute('#langSw [lang="es"]', 'aria-pressed'), 'true');
    await page.locator('#langSw').scrollIntoViewIfNeeded();
    await Promise.all([page.waitForEvent('load'), page.click('#langSw [lang="en"]')]);
    assert.equal(await page.getAttribute('html', 'lang'), 'en');
    assert.equal(await page.textContent('#printBtn'), 'Print…');
    await until(page, () => { const r = document.getElementById('langSw').getBoundingClientRect(), t = document.getElementById('tablas').getBoundingClientRect(); return r.top >= t.top && r.bottom <= t.bottom; });
    assert.equal(await page.evaluate(() => sessionStorage.getItem('loteria.reopen')), null);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

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

check('home: El Cantor is the one that prints numbered tablas and Make tablas is by hand, and My tablas’ About says a refresh keeps the round', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base);
    // Someone who wants tablas for tonight finds the numbered set, not a blank tabla to fill by hand.
    assert.deepEqual(await page.$$eval('.tile h2 small', s => s.map(e => e.textContent)), ['Call the game', 'Play along', 'By hand']);
    assert.equal(await page.textContent('.tile[href="cantor.html"] p'), 'Shuffles the deck and calls each card aloud in Spanish, prints numbered tablas, and checks a ¡Lotería!');
    assert.equal(await page.textContent('footer:has(#privacy)'), 'Everything stays on this device: no accounts, nothing sent anywhere. Need tablas for tonight? El Cantor’s Print tablas makes a numbered set it can check by number.');
    assert.equal(await page.textContent('footer:has(#privacy) b'), 'Print tablas');
    await page.click('#langSw [lang="es"]');
    await page.waitForLoadState();
    await until(page, () => document.documentElement.lang === 'es-MX');
    assert.deepEqual(await page.$$eval('.tile h2 small', s => s.map(e => e.textContent)), ['Canta la lotería', 'Juega', 'A mano']);
    assert.equal(await page.textContent('.tile[href="cantor.html"] p'), 'Baraja las cartas, canta cada una en voz alta, imprime tablas numeradas y revisa una ¡Lotería!');
    assert.equal(await page.textContent('footer:has(#privacy) b'), 'Imprimir tablas');
    await page.click('#langSw [lang="en"]');
    await page.waitForLoadState();
    await until(page, () => document.documentElement.lang === 'en');
    // El Cantor's pace note names → for the next card, as a phone shows it (it hides the words Next card).
    await page.goto(base + 'cantor.html');
    await page.click('#setBtn');
    assert.equal(await page.locator('#paceSeg').locator('xpath=../..').locator('.note').textContent(), 'Counted after the card is read. ▶ turns the next card automatically; → turns it now.');
    await seed(page, { 'loteria.v1': ANA });
    await page.goto(base + 'board.html');
    await page.click('#setBtn');
    assert.equal(await page.locator('#sheet .card', { hasText: 'About' }).locator('.note').textContent(), 'Everything lives on this device — nothing is sent anywhere. A refresh keeps the round.');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('install: the icon is named El Cantor whichever page it was added from, as the manifest names it', async () => {
  // An iPhone names a Home Screen icon after the page's apple-mobile-web-app-title; Android and computers after the
  // manifest. So every page says El Cantor, and two cousins never end up with two names for one app.
  const manifest = JSON.parse(await readFile(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.deepEqual([manifest.name, manifest.short_name], ['El Cantor', 'El Cantor']);
  for (const f of ['index.html', 'cantor.html', 'board.html', 'print.html']) {
    const html = await readFile(join(root, f), 'utf8'), m = [...html.matchAll(/<meta name="apple-mobile-web-app-title" content="([^"]*)">/g)].map(x => x[1]);
    assert.deepEqual(m, ['El Cantor'], f + ' names the icon ' + m.join(', '));
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

check('fonts: the card drawing tool writes the names in the repo’s own Bree Serif, and stops when it didn’t load', async () => {
  // tools/cards/render.mjs on one card with a name, into a folder of its own: with fonts/fonts.css, then with a font
  // stylesheet that declares nothing, where a stand-in serif would draw the name.
  const dir = await mkdtemp(join(tmpdir(), 'el-cantor-render-'));
  try {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 656" width="400" height="656"><text x="200" y="600" font-family="Bree Serif" font-size="40" text-anchor="middle">EL CAMARÓN</text></svg>';
    await writeFile(join(dir, 'cards.json'), JSON.stringify({ 8: { file: 'ElCamaron', svg } }));
    await writeFile(join(dir, 'none.css'), '/* no fonts */');
    const render = (env = {}) => new Promise(done => execFile(process.execPath, [join(root, 'tools/cards/render.mjs')], { env: { ...process.env, CARDS_JSON: join(dir, 'cards.json'), CARDS_OUT: dir, ...env }, timeout: 90000 }, (err, stdout, stderr) => done({ code: err ? err.code || 1 : 0, out: stdout + stderr })));
    const ok = await render();
    assert.equal(ok.code, 0, 'the tool failed with the repo’s fonts:\n' + ok.out);
    assert.ok(existsSync(join(dir, 'ElCamaron.jpg')), 'no card was written');
    await unlink(join(dir, 'ElCamaron.jpg'));
    const none = await render({ FONT_CSS: join(dir, 'none.css') });
    assert.notEqual(none.code, 0, 'the tool drew the card without Bree Serif');
    assert.match(none.out, /Bree Serif did not load/);
    assert.ok(!existsSync(join(dir, 'ElCamaron.jpg')), 'a card was written without Bree Serif');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

check('colours: the muted text reads at 4.5:1 on every page, light and dark', async () => {
  // --ink3 is the eyebrows, BEFORE, the sábana counts, the tabla labels, “Nothing called yet” and the footer: 4.5:1 is
  // WCAG 2.2 success criterion 1.4.3 (Contrast, Minimum) for text this size. Make tablas' “No card matches” sits on
  // the deck's darker paper.
  const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const hex = rgb => '#' + rgb.match(/\d+/g).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
  for (const colorScheme of ['light', 'dark']) {
    const ctx = await context(PHONE, { colorScheme });
    try {
      const page = await ctx.newPage(), problems = watch(page);
      for (const p of ['', 'cantor.html', 'board.html', 'print.html']) {
        await page.goto(base + p);
        const [ink3, ...under] = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return ['--ink3', '--bg', '--paper'].map(k => s.getPropertyValue(k).trim()); });
        for (const bg of under) assert.ok(ratio(ink3, bg) >= 4.5, `${colorScheme}, ${p || 'index.html'}: ${ink3} on ${bg} is ${ratio(ink3, bg).toFixed(2)}:1`);
      }
      await page.fill('#q', 'zz');
      const [fg, bg] = await page.evaluate(() => [getComputedStyle(document.querySelector('#dg .dempty')).color, getComputedStyle(document.getElementById('deck')).backgroundColor]);
      assert.ok(ratio(hex(fg), hex(bg)) >= 4.5, `${colorScheme}, Make tablas’ “No card matches”: ${fg} on ${bg} is ${ratio(hex(fg), hex(bg)).toFixed(2)}:1`);
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('colours: in dark, the words on teal, green and red read at 4.5:1, and every page’s scrollbars are dark', async () => {
  // The dark theme lightens the teal, green and red, so what's written on them turns dark (WCAG 2.1, 1.4.3: 4.5:1
  // for text this size). The game chip, the checker's ✓ and ✕, Cantaron…'s ✓, the deck's ×1 and a refused drag.
  const lum = rgb => { const c = rgb.match(/\d+/g).slice(0, 3).map(v => +v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const ON = {
    'cantor.html': [['#patBtn'], ['.pk.yes .st', '<div class="pk yes"><span class="st">✓</span></div>'], ['.pk.no .st', '<div class="pk no"><span class="st">✕</span></div>']],
    'board.html': [['#patBtn'], ['.pk.called', '<div class="pk called"></div>', '::after']],
    'print.html': [['.dk.has .x', '<div class="dk has"><span class="x">×1</span></div>'], ['.ghost.bad .gt', '<div class="ghost bad"><span class="gt">3×</span></div>']]
  };
  for (const scheme of ['dark', 'light']) {
    const ctx = await context(PHONE, { colorScheme: scheme });
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await seed(page, { 'loteria.v1': ANA });
      for (const p of ['', 'cantor.html', 'board.html', 'print.html']) {
        await page.goto(base + p);
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), scheme === 'dark' ? 'dark' : 'normal', (p || 'index.html') + ' in ' + scheme + ': its scrollbars and controls');
        for (const [sel, html, pseudo] of ON[p] || []) {
          const [fg, bg] = await page.evaluate(([sel, html, pseudo]) => {
            if (html) document.body.insertAdjacentHTML('beforeend', html);
            const s = getComputedStyle(document.querySelector(sel), pseudo || null);
            return [s.color, s.backgroundColor];
          }, [sel, html, pseudo]);
          assert.ok(ratio(fg, bg) >= 4.5, `${p}, ${scheme}: ${sel}${pseudo || ''} is ${fg} on ${bg}, ${ratio(fg, bg).toFixed(2)}:1`);
        }
      }
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
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
    // In English and Spanish, one under the other: the language setting needs JavaScript too.
    const SAYS = {
      '': ['El Cantor, My tablas and Make tablas all need JavaScript to work.', 'El Cantor, Mis tablas y Hacer tablas necesitan JavaScript para funcionar.'],
      'cantor.html': ['El Cantor needs JavaScript to shuffle and call the cards.', 'El Cantor necesita JavaScript para barajar y cantar las cartas.'],
      'board.html': ['My tablas needs JavaScript to mark your tablas as the cards are called.', 'Mis tablas necesita JavaScript para marcar tus tablas mientras cantan las cartas.'],
      'print.html': ['Make tablas needs JavaScript to put cards on tablas and print them.', 'Hacer tablas necesita JavaScript para poner cartas en las tablas e imprimirlas.']
    };
    for (const p in SAYS) {
      await page.goto(base + p);
      const n = page.locator('.noscript');
      assert.ok(await n.count() && await n.isVisible(), (p || 'index.html') + ' says nothing without JavaScript');
      assert.deepEqual(await n.locator('span').evaluateAll(ss => ss.map(s => [s.textContent, s.lang])), [[SAYS[p][0], ''], [SAYS[p][1], 'es']]);
      const [en, es] = await n.locator('span').evaluateAll(ss => ss.map(s => s.getBoundingClientRect().top));
      assert.ok(es > en, (p || 'index.html') + ': the Spanish isn’t under the English');
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

check('cantor: a recorded voice reads each card, and a clip that won’t load falls back without holding up the round', async () => {
  // Every voice in voices.json has its 54 card clips, the opening line and ¡Lotería!, and says where each verse ends.
  const { voices } = JSON.parse(await readFile(join(root, 'audio/voices.json'), 'utf8'));
  assert.ok(voices.length >= 1, 'voices.json lists no voices');
  for (const v of voices) {
    const clips = run(1, 54).map(n => String(n).padStart(2, '0')).concat(['open', 'loteria']);
    const missing = clips.filter(c => !existsSync(join(root, 'audio', v.id, c + '.' + (v.ext || 'mp3'))));
    assert.deepEqual(missing, [], v.id + ' has no clip for ' + missing.join(', '));
    for (const n of run(1, 54)) assert.ok(v.cards[n] && v.cards[n][0] < v.cards[n][1], v.id + ' doesn’t say where card ' + n + '’s verse ends and its name starts');
  }
  // Dora reading names at the fast pace, with card 3's clip gone: card 3 is read by the device's voice, if it has one,
  // and the round goes on.
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page), asked = new Set();
    await page.addInitScript(() => {
      window.__played = 0; // clips of a voice started, not the card's snap
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function () { if (this.buffer && this.buffer.duration > 0.3) window.__played++; return start.apply(this, arguments); };
    });
    page.on('request', r => { const m = /audio\/dora\/(\w+)\.mp3$/.exec(r.url()); if (m) asked.add(m[1]); });
    await ctx.route(base + 'audio/dora/03.mp3', r => r.fulfill({ status: 404, body: '' }));
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 0, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], wins: [], settings: { speak: true, style: 'name', voice: 'pack:dora', rate: 1, pace: 'fast', sound: false, awake: false, check: false } } });
    await page.goto(base + 'cantor.html');
    const t0 = Date.now();
    await page.click('#playBtn');
    await until(page, () => JSON.parse(localStorage.getItem('loteria.cantor')).pos >= 5 && window.__played >= 5, null, 40000);
    const took = Date.now() - t0;
    assert.ok(took < 30000, 'five cards took ' + took + ' ms');
    for (const c of ['open', '01', '02', '03', '04', '05']) assert.ok(asked.has(c), 'Dora’s ' + c + ' clip was never asked for');
    // The opening line, then cards 1, 2, 4 and 5 from Dora's clips; card 3 from the device.
    assert.equal(await page.evaluate(() => window.__played), 5);
    assert.deepEqual(problems.filter(p => !/^404 .*audio\/dora\/03\.mp3$|^console: Failed to load resource: .* 404/.test(p)), []);
  } finally { await ctx.close(); }
});

// A stand-in for the device's own voice: it says each line at once, and keeps what it said and when.
const FAKE_TTS = () => {
  window.__said = [];
  const s = window.speechSynthesis;
  s.speak = u => { window.__said.push({ text: u.text, at: performance.now() }); setTimeout(() => { if (u.onend) u.onend(); }, 30); };
  s.cancel = () => { };
  for (const k of ['speaking', 'pending']) Object.defineProperty(s, k, { get: () => false, configurable: true });
};
// When each card was turned (#live says its name), and every toast shown.
const DEALS = () => {
  window.__dealt = []; window.__toasts = [];
  addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('live')) return; // not El Cantor
    new MutationObserver(() => window.__dealt.push({ name: document.getElementById('live').textContent, at: performance.now() })).observe(document.getElementById('live'), { childList: true, characterData: true, subtree: true });
    new MutationObserver(() => window.__toasts.push(document.getElementById('toast').textContent)).observe(document.getElementById('toast'), { childList: true, characterData: true, subtree: true });
  });
};

check('cantor: a clip that hasn’t come in 3 seconds is read by the device’s voice, the cards after it don’t wait, and one note says so', async () => {
  // Dora reading names at the fast pace. Card 3's clip never comes, and card 4's takes 6 seconds: card 3 waits 3
  // seconds and is read by the device's voice, card 4 is read by it straight away, and card 5, here in time, is Dora's.
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.addInitScript(FAKE_TTS);
    await page.addInitScript(DEALS);
    await page.addInitScript(() => {
      window.__played = [];
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function () { if (this.buffer && this.buffer.duration > 0.3) window.__played.push(performance.now()); return start.apply(this, arguments); };
    });
    await ctx.route(base + 'audio/dora/03.mp3', () => { }); // never answers
    await ctx.route(base + 'audio/dora/04.mp3', r => setTimeout(() => r.continue().catch(() => { }), 6000));
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 0, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], wins: [], settings: { speak: true, style: 'name', voice: 'pack:dora', rate: 1, pace: 'fast', sound: false, awake: false, check: false } } });
    await page.goto(base + 'cantor.html');
    await page.click('#playBtn');
    await until(page, () => window.__dealt.length >= 6, null, 40000);
    await page.click('#playBtn'); // pause
    const r = await page.evaluate(() => ({ dealt: window.__dealt, said: window.__said, toasts: window.__toasts, played: window.__played }));
    assert.deepEqual(r.dealt.slice(0, 5).map(d => d.name), ['El Gallo', 'El Diablito', 'La Dama', 'El Catrín', 'El Paraguas']);
    assert.deepEqual(r.said.map(s => s.text), ['La Dama', 'El Catrín'], 'the device’s voice read other cards than 3 and 4');
    const wait3 = r.said[0].at - r.dealt[2].at, wait4 = r.said[1].at - r.dealt[3].at;
    assert.ok(wait3 > 2700 && wait3 < 4500, 'card 3 waited ' + Math.round(wait3) + ' ms for its clip, not 3 s');
    assert.ok(wait4 < 800, 'card 4 waited ' + Math.round(wait4) + ' ms for its clip, after card 3’s didn’t come');
    assert.ok(r.played.some(t => t > r.dealt[4].at && t < r.dealt[5].at), 'card 5, here in time, wasn’t Dora’s');
    assert.equal(r.toasts.filter(t => t === 'The recorded voice isn’t loading — using this device’s voice').length, 1, 'the note: ' + JSON.stringify(r.toasts));
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: calling with a recorded voice brings the rest of it down for a game with no signal, unless the phone asks to save data', async () => {
  const seedCantor = { 'loteria.cantor': { order: run(1, 54), pos: 0, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], wins: [], settings: { speak: true, style: 'name', voice: 'pack:alex', rate: 1, pace: 'slow', sound: false, awake: false, check: false } } };
  const clips = run(1, 54).map(n => String(n).padStart(2, '0')).concat(['open', 'loteria']).sort();
  // Alex's clips in the offline copy, by name.
  const keptClips = page => page.evaluate(() => caches.keys().then(ks => Promise.all(ks.map(k => caches.open(k).then(c => c.keys())))).then(ls => ls.flat().map(r => (/audio\/alex\/(\w+)\.mp3$/.exec(r.url) || [])[1]).filter(Boolean).sort()));
  for (const saveData of [false, true]) {
    const ctx = await context(PHONE, { serviceWorkers: 'allow' });
    try {
      const page = await ctx.newPage(), problems = watch(page);
      if (saveData) await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { get: () => ({ saveData: true }), configurable: true }));
      await page.addInitScript(FAKE_TTS);
      await seed(page, seedCantor);
      await page.goto(base + 'cantor.html');
      await until(page, () => navigator.serviceWorker && navigator.serviceWorker.controller, null, 30000);
      await page.click('#nextBtn');
      if (saveData) {
        await page.waitForTimeout(3000);
        const kept = await keptClips(page);
        assert.ok(kept.length <= 2, 'with Save data on it brought down ' + kept.join(' '));
      } else {
        for (let t = Date.now(); (await keptClips(page)).length < clips.length && Date.now() - t < 60000;) await page.waitForTimeout(250);
        assert.deepEqual(await keptClips(page), clips);
        // With no signal, the cards still to come are Alex's, from the copy.
        await ctx.setOffline(true);
        await page.reload();
        await page.waitForSelector('#playBtn');
        assert.ok(await page.evaluate(() => fetch('audio/alex/54.mp3').then(r => r.ok, () => false)), 'the last card’s clip isn’t kept for a night with no signal');
        await ctx.setOffline(false);
      }
      assert.deepEqual(problems.filter(p => !/ERR_INTERNET_DISCONNECTED/.test(p)), []);
    } finally { await ctx.close(); }
  }
});

// The page's screen off (or another app) and back on.
const seen = (page, on) => page.evaluate(v => { Object.defineProperty(document, 'hidden', { value: !v, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: v ? 'visible' : 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, on);

check('cantor: the screen off mid-round pauses calling and says so when it’s back, and every sound sets an iPhone to play on silent', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.addInitScript(() => { navigator.audioSession = { type: 'auto' }; }); // an iPhone's, as Safari 17 has it
    await page.addInitScript(DEALS);
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 3, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], wins: [], settings: { speak: false, style: 'name', voice: '', rate: 1, pace: 'fast', sound: true, awake: false, check: false } } });
    await page.goto(base + 'cantor.html');
    // ¡Lotería! is the first tap: its cheer plays on silent too, as ▶ and Next card do.
    await page.click('#lotBtn');
    await until(page, () => !document.getElementById('winbox').hidden);
    assert.equal(await page.evaluate(() => navigator.audioSession.type), 'playback', 'the cheer would be silent with an iPhone’s ring switch on silent');
    await page.click('#clBack');
    await page.evaluate(() => { navigator.audioSession.type = 'auto'; });
    await page.click('#setBtn');
    await page.click('#sndBtn'); await page.click('#sndBtn'); // Sounds off and on again: a snap
    assert.equal(await page.evaluate(() => navigator.audioSession.type), 'playback', 'Sounds On’s snap');
    await page.click('#stx');
    // Calling, then the screen goes off.
    await page.click('#playBtn');
    await until(page, () => JSON.parse(localStorage.getItem('loteria.cantor')).pos >= 4);
    await seen(page, false);
    const pos = (await saved(page, 'loteria.cantor')).pos;
    await page.waitForTimeout(3500); // past the fast pace's 2 seconds
    assert.equal((await saved(page, 'loteria.cantor')).pos, pos, 'it kept calling with the screen off');
    await seen(page, true);
    await until(page, () => document.getElementById('toast').classList.contains('show'));
    assert.equal(await page.textContent('#toast'), 'Paused while the screen was off — tap the card to keep calling');
    assert.equal(await page.getAttribute('#playBtn', 'aria-label'), 'Keep calling');
    await page.click('#flip');
    await until(page, p => JSON.parse(localStorage.getItem('loteria.cantor')).pos > p, pos);
    // Paused by hand, the screen off and on says nothing.
    await page.click('#playBtn');
    await page.evaluate(() => { window.__toasts = []; });
    await seen(page, false); await seen(page, true);
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => window.__toasts.filter(t => /screen was off/.test(t))), []);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: a tap on the card’s name, or R, says it again and then waits its usual time; Adivinanza says the verse and the name', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.addInitScript(FAKE_TTS);
    await page.addInitScript(DEALS);
    const said = () => page.evaluate(() => window.__said.map(s => s.text));
    const settings = style => ({ speak: true, style, voice: 'dev:none', rate: 1, pace: 'normal', sound: false, awake: false, check: false });
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 0, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], wins: [], settings: settings('name') } });
    await page.goto(base + 'cantor.html');
    await page.click('#nextBtn');
    await until(page, () => window.__said.length === 1);
    await page.click('#cap h2 button');
    await until(page, () => window.__said.length === 2);
    await page.waitForTimeout(800);
    assert.deepEqual(await said(), ['El Gallo', 'El Gallo'], 'paused, the name tapped is said once more and nothing else');
    assert.equal(await page.getAttribute('#playBtn', 'aria-label'), 'Keep calling', 'it started calling');
    // Calling at the normal pace (4 seconds): the name tapped halfway through the wait, and the next card waits 4
    // seconds from then. R does the same.
    await page.click('#playBtn');
    await until(page, () => window.__said.length === 3, null, 10000);
    await page.waitForTimeout(1500);
    await page.click('#cap h2 button');
    await until(page, () => window.__said.length === 4);
    await until(page, () => window.__dealt.length === 3, null, 10000);
    let r = await page.evaluate(() => ({ said: window.__said, dealt: window.__dealt }));
    assert.deepEqual(r.said.slice(0, 4).map(s => s.text), ['El Gallo', 'El Gallo', 'El Diablito', 'El Diablito']);
    assert.ok(r.dealt[2].at - r.said[3].at > 3900, 'the next card came ' + Math.round(r.dealt[2].at - r.said[3].at) + ' ms after the card said again, not 4 s');
    await until(page, () => window.__said.length === 5);
    await page.waitForTimeout(1000);
    await page.keyboard.press('r');
    await until(page, () => window.__said.length === 6);
    assert.deepEqual((await said()).slice(4), ['La Dama', 'La Dama']);
    await page.click('#playBtn'); // pause
    // Adivinanza: the verse face down, then the name; said again face up, the verse and the name.
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 0, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], wins: [], settings: settings('riddle') } });
    await page.goto(base + 'cantor.html');
    await page.click('#nextBtn');
    await until(page, () => window.__said.length === 2);
    await page.click('#cap h2 button');
    await until(page, () => window.__said.length === 4);
    assert.deepEqual(await said(), ['El que le cantó a San Pedro no le volverá a cantar.', 'El Gallo', 'El que le cantó a San Pedro no le volverá a cantar.', 'El Gallo']);
    // The keyboard line in Settings says so, in both languages.
    await page.click('#setBtn');
    assert.match(await page.textContent('#sheet'), /R says the card again \(or tap its name\)/);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

// A stand-in for Screen Wake Lock: window.__held is how many screen locks the page holds. refuse: every request fails,
// as a browser that won't keep the screen on does.
const FAKE_WAKE = refuse => {
  window.__held = 0;
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request() {
    if (refuse) return Promise.reject(new DOMException('no', 'NotAllowedError'));
    const l = new EventTarget(); window.__held++;
    l.release = () => { if (!l.released) { l.released = true; window.__held--; l.dispatchEvent(new Event('release')); } return Promise.resolve(); };
    return Promise.resolve(l);
  } } });
};
const IPHONE_APP = v => ({ userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS ${v} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148` });

check('awake: El Cantor keeps the screen on from the first card, between rounds too, and says so when a phone can’t', async () => {
  const CANTOR = { order: run(1, 54), pos: 0, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], wins: [], settings: { speak: false, sound: false, awake: true, check: false, pace: 'slow' } };
  const held = page => page.evaluate(() => window.__held);
  let ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.addInitScript(FAKE_WAKE, false);
    await seed(page, { 'loteria.cantor': CANTOR });
    await page.goto(base + 'cantor.html');
    assert.equal(await held(page), 0, 'on before a card was called');
    await page.click('#nextBtn');
    await until(page, () => window.__held === 1);
    // A new round: the screen stays on while the beans come off and the next game is picked.
    await page.click('#newBtn'); await page.click('#nrOk');
    await page.waitForTimeout(300);
    assert.equal(await held(page), 1, 'the screen was let go between rounds');
    await page.click('#ptx');
    await page.click('#setBtn');
    assert.equal(await page.textContent('#awBtn'), 'On');
    assert.equal(await page.locator('#awCant').count(), 0, 'a phone that keeps its screen on was told it can’t');
    await page.click('#awBtn');
    await until(page, () => window.__held === 0);
    await page.click('#awBtn');
    await until(page, () => window.__held === 1);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
  // An iPhone app on the Home Screen before iOS 18.4 can't, though its request succeeds: El Cantor says so once, and so
  // does Settings. From iOS 18.4 it can. An iPad says it's a Mac, with no iOS version: window.cookieStore, which came in
  // the same iOS 18.4, says which, and the line names the iPad. A browser that refuses says it in its own words.
  const IPAD_APP = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)' };
  for (const [v, says] of [['17_5', 'This phone won’t stay awake on its own — set Auto-Lock longer for game night, in Settings › Display and Brightness'], ['18_4', ''], ['iPad 17', 'This iPad won’t stay awake on its own — set Auto-Lock longer for game night, in Settings › Display and Brightness'], ['iPad 18.4', ''], [null, 'This device won’t stay awake on its own — set its screen to stay on longer for game night']]) {
    const ipad = /^iPad/.test(v || '');
    ctx = await context(PHONE, ipad ? IPAD_APP : v ? IPHONE_APP(v) : {});
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await page.addInitScript(FAKE_WAKE, !v);
      if (ipad) await page.addInitScript(old => { Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 5, configurable: true }); if (old) { delete window.cookieStore; delete Window.prototype.cookieStore; } }, v === 'iPad 17');
      await page.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }); window.__toasts = []; addEventListener('DOMContentLoaded', () => { const t = document.getElementById('toast'); if (t) new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); }); });
      await seed(page, { 'loteria.cantor': CANTOR });
      await page.goto(base + 'cantor.html');
      await page.click('#nextBtn'); await page.click('#nextBtn');
      await page.waitForTimeout(400);
      assert.deepEqual(await page.evaluate(() => window.__toasts.filter(t => /awake/.test(t))), says ? [says] : [], 'iOS ' + v);
      if (v) assert.equal(await held(page), says ? 0 : 1, 'iOS ' + v);
      await page.click('#setBtn');
      assert.equal(await page.locator('#awCant').count() ? await page.textContent('#awCant') : '', says, 'Settings, iOS ' + v);
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('awake: My tablas keeps the screen on while a round is being played, with its own Keep the screen on', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.addInitScript(FAKE_WAKE, false);
    await seed(page, { 'loteria.v1': ANA });
    await page.goto(base + 'board.html');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__held), 0, 'on with no card called');
    await page.click('#callBtn');
    await page.fill('#pkq', '40'); await page.press('#pkq', 'Enter');
    await page.click('#pkx');
    await until(page, () => window.__held === 1);
    await page.click('#setBtn');
    assert.match(await page.textContent('#sheet'), /Keep the screen on\s*While a round is being played/);
    assert.equal(await page.textContent('#awBtn'), 'On');
    await page.click('#awBtn');
    await until(page, () => window.__held === 0);
    assert.equal((await saved(page, 'loteria.v1')).settings.awake, false);
    await page.click('#awBtn');
    await until(page, () => window.__held === 1);
    await page.click('#stx');
    await page.click('#clearBtn'); // a new round, with one card called: no question
    await until(page, () => window.__held === 0);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: Full screen in Settings, and F, hide the browser’s bars where the browser allows it, and not on an iPhone', async () => {
  let ctx = await context(DESKTOP);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'cantor.html');
    const full = () => page.evaluate(() => !!document.fullscreenElement);
    await page.click('#setBtn');
    assert.equal(await page.textContent('#fsBtn'), 'Off');
    await page.click('#fsBtn');
    await until(page, () => !!document.fullscreenElement);
    await until(page, () => document.getElementById('fsBtn').textContent === 'On');
    await page.click('#fsBtn');
    await until(page, () => !document.fullscreenElement);
    await page.click('#stx');
    await page.keyboard.press('f');
    await until(page, () => !!document.fullscreenElement);
    await page.keyboard.press('F');
    await until(page, () => !document.fullscreenElement);
    assert.equal(await full(), false);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
  // An iPhone's Safari can't put a page full screen: no switch, and F does nothing.
  ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.addInitScript(() => { for (const k of ['fullscreenEnabled', 'webkitFullscreenEnabled']) Object.defineProperty(Document.prototype, k, { get: () => false, configurable: true }); });
    await page.goto(base + 'cantor.html');
    await page.click('#setBtn');
    assert.equal(await page.locator('#fsBtn').count(), 0, 'Full screen where the browser can’t');
    await page.click('#stx');
    await page.keyboard.press('f');
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: on a phone turned sideways the card is on the left, as tall as the room, with its name and the cards before it on the right', async () => {
  // An iPhone 14 on its side (47 px of notch each side, the home bar below) and an iPhone SE on its side. Before, the
  // card sat above its name and came out a 26 px thumbnail.
  for (const [width, height, side, bottom] of [[844, 390, 47, 21], [667, 375, 0, 0]]) {
    const ctx = await context({ ...PHONE, viewport: { width, height } });
    try {
      const page = await ctx.newPage(), problems = watch(page), at = width + '×' + height + ': ';
      await (await ctx.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets: { left: side, right: side, top: 0, bottom } });
      await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 6, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false, awake: false, check: false } } });
      await page.goto(base + 'cantor.html');
      await until(page, () => document.getElementById('flip').getBoundingClientRect().width > 60, null, 5000).catch(() => { });
      const card = await rect(page, '#flip'), name = await rect(page, '#cap h2'), before = await rect(page, '#antes'), bar = await rect(page, '.bar');
      assert.ok(card.width >= 120, at + `the card is ${card.width} px wide`);
      assert.ok(card.right < name.left && card.right < before.left, at + 'the card isn’t on the left of its name and the cards before it');
      assert.ok(card.height >= (bar.top - 120) * 0.9 && card.bottom <= bar.top, at + `the card is ${card.height} px tall, in ${bar.top} px above the bar`);
      assert.ok(card.left >= side, at + 'the card is in the notch');
      assert.equal(await page.isVisible('#sabBtn'), true, at + 'no Sábana button for the sábana');
      assert.equal(await page.textContent('#cap h2'), 'La Sirena');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
  // Upright, and on a computer, it is as it was.
  for (const [kind, mode] of [[PHONE, 'compact'], [DESKTOP, 'wide']]) {
    const ctx = await context(kind);
    try {
      const page = await ctx.newPage();
      await page.goto(base + 'cantor.html');
      assert.equal(await page.getAttribute('#app', 'class'), 'app ' + mode);
    } finally { await ctx.close(); }
  }
});

check('cantor: the card called is the card itself, edge to edge on its own cream paper, with no white mat round it', async () => {
  // The cards are drawn on cream (#FBF4E4) with their own rounded frame; a white mat round them made a second frame,
  // and the brightest thing on a dark screen.
  for (const scheme of ['light', 'dark']) {
    const ctx = await context(PHONE, { colorScheme: scheme });
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await page.goto(base + 'cantor.html');
      await page.click('#nextBtn');
      await until(page, () => document.getElementById('bigImg').complete && document.getElementById('bigImg').naturalWidth > 0);
      const f = await page.evaluate(() => {
        const face = document.querySelector('.face.front'), img = document.getElementById('bigImg'), a = face.getBoundingClientRect(), b = img.getBoundingClientRect();
        return { bg: getComputedStyle(face).backgroundColor, inset: [b.left - a.left, b.top - a.top, a.right - b.right, a.bottom - b.bottom].map(Math.round), back: getComputedStyle(document.querySelector('.face.back')).backgroundColor };
      });
      assert.deepEqual(f, { bg: 'rgb(251, 244, 228)', inset: [0, 0, 0, 0], back: 'rgb(251, 244, 228)' }, scheme);
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
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
    assert.ok(await page.evaluate(() => document.getElementById('winbox').hidden), 'the ¡Lotería! box is still up');
    assert.ok(await calling(), 'Escape left calling paused');
    await page.click('#lotBtn'); // somebody else shouts
    await page.waitForSelector('#winbox .winc #clBack');
    assert.equal(await fanfares(), 2, 'the second ¡Lotería! was silent');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: ¡Lotería! before the first card says ▶ starts the round, with no cheer and no winner', async () => {
  for (const lang of ['en', 'es']) {
    const ctx = await context(DESKTOP);
    await ctx.addInitScript(() => { // counts the notes played: a fanfare is six
      window.__notes = 0; const AC = window.AudioContext; if (!AC) return;
      const make = AC.prototype.createOscillator; AC.prototype.createOscillator = function () { window.__notes++; return make.apply(this, arguments); };
    });
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await seed(page, { 'loteria.lang': lang, 'loteria.cantor': { order: run(1, 54), pos: 0, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: true, awake: false, check: false, pace: 'slow' } } });
      await page.goto(base + 'cantor.html');
      const says = lang === 'en' ? 'No cards called yet — ▶ starts the round' : 'Todavía no sale ninguna carta — ▶ empieza la ronda';
      for (const how of ['the button', 'L']) {
        await page.evaluate(() => { const t = document.getElementById('toast'); t.textContent = ''; t.classList.remove('show'); });
        if (how === 'L') { await page.locator('body').focus(); await page.keyboard.press('l'); } else await page.click('#lotBtn');
        await until(page, t => document.getElementById('toast').textContent === t, says);
        assert.ok(await page.evaluate(() => document.getElementById('winbox').hidden), lang + ', ' + how + ': the ¡Lotería! box opened with nothing called');
        assert.ok(await page.evaluate(() => document.getElementById('sheet').hidden), lang + ', ' + how + ': a sheet opened with nothing called');
        assert.equal(await page.evaluate(() => window.__notes), 0, lang + ', ' + how + ': the fanfare played with nothing called');
      }
      // Even set to check a tabla first, nothing opens.
      await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('loteria.cantor')); s.settings.check = true; localStorage.setItem('loteria.cantor', JSON.stringify(s)); });
      await page.reload();
      await page.click('#lotBtn');
      await until(page, t => document.getElementById('toast').textContent === t, says);
      assert.ok(await page.evaluate(() => document.getElementById('sheet').hidden && document.getElementById('winbox').hidden), lang + ': the checker opened with nothing called');
      assert.deepEqual((await saved(page, 'loteria.cantor')).wins, [], lang + ': a win was saved with nothing called');
      // One card in, it's a ¡Lotería! as ever.
      await page.click('#nextBtn');
      await page.click('#lotBtn');
      await page.waitForSelector('#sheet:not([hidden]) #vfWin');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('cantor: Space starts and pauses after a sheet closed with the mouse, and presses a button the keyboard is on', async () => {
  const ctx = await context(DESKTOP);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 3, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false, awake: false, check: false, pace: 'slow' } } });
    await page.goto(base + 'cantor.html');
    const calling = async () => await page.getAttribute('#playBtn', 'aria-label') === 'Pause';
    const sheetUp = () => page.evaluate(() => !document.getElementById('sheet').hidden);
    // A closed sheet gives the focus back to its button; with the mouse, Space still starts and pauses (README).
    for (const [open, close] of [['#patBtn', '#ptx'], ['#setBtn', 'outside']]) {
      await page.click(open);
      if (close === 'outside') await page.mouse.click(640, 6); else await page.click(close);
      assert.ok(!(await sheetUp()), `${open}'s sheet didn't close`);
      const was = await calling();
      await page.keyboard.press(' ');
      assert.ok(!(await sheetUp()), `Space opened ${open}'s sheet again`);
      assert.equal(await calling(), !was, `Space didn't ${was ? 'pause' : 'start'} calling after ${open}'s sheet`);
    }
    // With the keyboard on a button, Space presses it.
    await page.focus('#setBtn'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'setBtn');
    await page.keyboard.press(' ');
    assert.equal(await sheetTitle(page), 'Settings', 'Space on Settings from the keyboard didn’t open it');
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
    // The winning line is outlined in gold over the card pictures, as a square still needed is in red.
    assert.deepEqual(await page.$$eval('#vfTabla .cell', cs => cs.flatMap((c, i) => c.classList.contains('hit') ? [i] : [])), [0, 1, 2, 3]);
    assert.notEqual(await page.$eval('#vfTabla .cell.hit', c => getComputedStyle(c, '::after').boxShadow), 'none', 'the winning line has no outline over its pictures');
    const names = await page.$$eval('#vfTabla .cell img', ims => ims.map(i => i.alt.replace(', called', '')));
    assert.deepEqual(names, await page.evaluate(t => t.map(n => Loteria.card(n).name), CANELA7));
    await page.fill('#vfN', '8');
    assert.equal(await page.textContent('#vfV h3'), 'Not yet');
    // Not yet: Keep calling is the main button, and the caller can still count it, with no tabla to its name.
    const buttons = () => page.$$eval('.vfwin button', bs => bs.filter(b => b.offsetParent).map(b => b.textContent + (b.classList.contains('red') ? ' (main)' : '')));
    assert.deepEqual(await buttons(), ['Keep calling (main)', 'Count it anyway']);
    await page.fill('#vfN', '7');
    assert.deepEqual(await buttons(), ['¡Buena! New round (main)']);
    await page.fill('#vfN', '8');
    await page.fill('#vfWho', 'Tío Beto');
    await page.click('#vfWin');
    assert.deepEqual((await saved(page, 'loteria.cantor')).wins.map(w => [w.round, w.who, w.tabla]), [[1, 'Tío Beto', '']], 'a win counted anyway kept the tabla that wasn’t good');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: house rules: a late ¡Lotería! counts until Too late is chosen, then two cards after its tabla was good it’s too late', async () => {
  const CANELA7 = [21, 51, 23, 6, 16, 33, 8, 4, 14, 20, 9, 40, 29, 41, 13, 25], top = CANELA7.slice(0, 4);
  const order = top.concat(run(1, 54).filter(n => top.indexOf(n) < 0)); // CANELA 7's top row, done on the 4th card, La Sirena
  for (const lang of ['en', 'es']) {
    const W = { en: { rules: 'House rules', two: 'Two ¡Lotería!s on the same card', late: 'A late ¡Lotería!', counts: 'Counts', strict: 'Too late after the next card', too: 'Too late', good: 'It was good on La Sirena, 2 cards ago.', cards: 'The last of their cards, La Sirena, was called 2 cards ago.', buena: '¡Buena! Línea', keep: 'Keep calling', anyway: 'Count it anyway' },
      es: { rules: 'Reglas de la casa', two: 'Dos ¡Loterías! con la misma carta', late: 'Una ¡Lotería! tarde', counts: 'Cuenta', strict: 'Ya no cuenta después de la siguiente carta', too: 'Llegó tarde', good: 'Ya estaba completa con La Sirena, hace 2 cartas.', cards: 'La última de sus cartas, La Sirena, salió hace 2 cartas.', buena: '¡Buena! Línea', keep: 'Seguir cantando', anyway: 'Darla por buena' } }[lang];
    const ctx = await context(PHONE);
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await seed(page, { 'loteria.lang': lang, 'loteria.cantor': { order, pos: 6, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: 'CANELA', wins: [], settings: { speak: false, sound: false, check: true } } });
      await page.goto(base + 'cantor.html');
      const buttons = () => page.$$eval('.vfwin button', bs => bs.filter(b => b.offsetParent).map(b => b.textContent + (b.classList.contains('red') ? ' (main)' : '')));
      // Counts, to start with: good two cards back is good.
      await page.click('#lotBtn');
      await page.fill('#vfN', '7');
      assert.equal(await page.textContent('#vfV h3'), W.buena, lang + ': Counts said it was late');
      await page.click('#vfx');
      // The house rules in Settings, Counts chosen, and Too late a tap away.
      await page.click('#setBtn');
      assert.equal(await page.textContent('#rulesCard .eyebrow'), W.rules);
      assert.deepEqual(await page.$$eval('#rulesCard .rule > b', bs => bs.map(b => b.textContent)), [W.two, W.late]);
      assert.deepEqual(await page.$$eval('#lateOpts .opt', bs => bs.map(b => b.querySelector('b').textContent + (b.classList.contains('on') ? ' (on)' : ''))), [W.counts + ' (on)', W.strict]);
      await page.click('#lateOpts [data-v=strict]');
      assert.equal((await saved(page, 'loteria.cantor')).settings.late, 'strict');
      await noSideways(page, lang + ': Settings with the house rules');
      await page.click('#stx');
      // Too late: the tabla was good on the 4th card and the 6th is showing. Keep calling is the main button.
      await page.click('#lotBtn');
      await page.fill('#vfN', '7');
      assert.equal(await page.textContent('#vfV h3'), W.too);
      assert.equal(await page.textContent('#vfV p'), W.good);
      assert.deepEqual(await buttons(), [W.keep + ' (main)', W.anyway]);
      assert.deepEqual(await page.$$eval('#vfTabla .cell', cs => cs.flatMap((c, i) => c.classList.contains('hit') ? [i] : [])), [0, 1, 2, 3], lang + ': the line it was good with isn’t outlined');
      // Card by card goes by the last of the cards read out.
      await page.click('#vfSeg [data-v=cards]');
      for (const n of top) { await page.fill('#vfQ', String(n)); await page.press('#vfQ', 'Enter'); }
      assert.equal(await page.textContent('#vfV h3'), W.too);
      assert.equal(await page.textContent('#vfV p'), W.cards);
      assert.deepEqual(await buttons(), [W.keep + ' (main)', W.anyway]);
      await page.click('#vfx');
      // One card back is still in time: the card just called and the one before it count, for the pace.
      await page.click('#backBtn');
      await page.click('#lotBtn');
      await page.click('#vfSeg [data-v=printed]');
      await page.fill('#vfN', '7');
      assert.equal(await page.textContent('#vfV h3'), W.buena, lang + ': the card before the one just called was too late');
      // Count it anyway, on a tabla too late, keeps the tabla it was good with.
      await page.click('#vfx'); await page.click('#nextBtn');
      await page.click('#lotBtn'); await page.fill('#vfN', '7');
      assert.equal(await page.textContent('#vfV h3'), W.too);
      await page.fill('#vfWho', 'Abuela');
      await page.click('#vfWin');
      assert.deepEqual((await saved(page, 'loteria.cantor')).wins.map(w => [w.who, w.how, w.tabla]), [['Abuela', 'Línea', 'CANELA 7']]);
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

// Two ¡Lotería!s on the card just called: CANELA 7's top row was done on the 4th card and CANELA 1's on the 8th. Then
// El Gallo is on neither tabla, the 10th card on both, and the 11th on CANELA 1 only.
const TIE = (() => { const top7 = [21, 51, 23, 6], top1 = [18, 24, 9, 36], next = [1, 41, 50]; const first = top7.concat(top1, next); return first.concat(run(1, 54).filter(n => first.indexOf(n) < 0)); })();
const cantorSave = (extra = {}, settings = {}) => ({ order: TIE, pos: 8, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: 'CANELA', wins: [], ...extra, settings: { speak: false, sound: false, check: false, ...settings } });

check('cantor: two ¡Lotería!s on one card, checked: the next card decides by itself, from the tablas it was shown', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.cantor': cantorSave({}, { check: true }) });
    await page.goto(base + 'cantor.html');
    const box = () => page.$eval('#winbox', b => b.hidden ? '' : b.querySelector('.winc > p').textContent);
    const wins = async () => (await saved(page, 'loteria.cantor')).wins.map(w => [w.who, w.tabla]);
    // The first ¡Buena! is saved at once, as ever, with Another winner on this card under it.
    await page.click('#lotBtn');
    await page.fill('#vfN', '7'); await page.fill('#vfWho', 'Ana'); await page.click('#vfWin');
    assert.equal(await box(), 'Ana wins round 1 after 8 cards.');
    assert.deepEqual(await wins(), [['Ana', 'CANELA 7']]);
    await page.click('#celMore');
    // Another winner: the checker opens again, saying who's in, and Ana waits for the house rule.
    assert.equal(await page.textContent('#sheet .conote'), 'Another winner on this card, with Ana.');
    assert.deepEqual(await wins(), [], 'Ana was saved before the house rule settled the round');
    await page.fill('#vfN', '1'); await page.fill('#vfWho', 'Beto'); await page.click('#vfWin');
    assert.equal(await box(), 'Ana and Beto are tied on round 1. The next card on one of their tablas wins it.');
    assert.equal(await page.textContent('#celOk'), 'Keep calling — the next card decides');
    await page.keyboard.press('Escape');
    assert.ok(await page.evaluate(() => !document.getElementById('winbox').hidden), 'Escape put away a box whose winners aren’t saved');
    await page.click('#celOk');
    const bar = () => page.$eval('#tieBar', b => b.hidden ? '' : b.textContent);
    assert.equal(await bar(), 'Ana and Beto are tied: the next card on their tablas wins');
    assert.deepEqual(await wins(), []);
    // The tie-break outlasts a reload.
    await page.reload();
    assert.equal(await bar(), 'Ana and Beto are tied: the next card on their tablas wins');
    const upTo = n => until(page, n => JSON.parse(localStorage.getItem('loteria.cantor')).tie.upTo === n, n);
    // ¡Lotería! with no card called since the tie says what's going on.
    await page.click('#lotBtn');
    await until(page, t => document.getElementById('toast').textContent === t, 'Ana and Beto are tied: the next card on their tablas wins');
    // El Gallo is on neither tabla: El Cantor knows both, so it says nothing and the tie goes on.
    await page.click('#nextBtn'); await upTo(9);
    assert.equal(await box(), '');
    // Someone shouts anyway: ¡Lotería! asks who has the card, with what El Cantor knows set (here, nobody).
    await page.click('#lotBtn');
    assert.deepEqual(await page.$$eval('#winbox .tied .chip', bs => bs.map(b => b.textContent + (b.classList.contains('on') ? ' (on)' : ''))), ['Ana', 'Beto']);
    assert.equal(await page.textContent('#askOk'), 'Neither, keep calling');
    await page.click('#askOk');
    // The next card is on both: still tied.
    await page.click('#nextBtn'); await upTo(10);
    await until(page, t => document.getElementById('toast').textContent === t, (await page.evaluate(() => Loteria.card(41).name)) + ' is on Ana and Beto’s tablas — still tied');
    assert.equal(await box(), '');
    // The one after is on Beto's only: Beto wins, with his tabla.
    await page.click('#nextBtn');
    await until(page, () => !document.getElementById('winbox').hidden);
    assert.equal(await box(), 'Beto had ' + await page.evaluate(() => Loteria.card(50).name) + ' and wins round 1.');
    assert.deepEqual(await wins(), [['Beto', 'CANELA 1']]);
    assert.equal(await bar(), '');
    assert.equal((await saved(page, 'loteria.cantor')).tie, null);
    await page.click('#celOk');
    assert.equal(await sheetTitle(page), 'Round 2 — what are we playing?');
    await noSideways(page, 'El Cantor after a tie-break');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: two ¡Lotería!s on one card, taken on their word: it asks who has each card; or they share; or the first wins', async () => {
  for (const lang of ['en', 'es']) {
    const W = {
      en: { more: '+ Another winner on this card', tieGo: 'Keep calling — the next card decides', bar: 'Ana and Beto are tied: the next card on their tablas wins', who: 'Who has El Gallo?', neither: 'Neither, keep calling', beto: 'Beto wins round 1', both: 'Ana and Beto: still tied, keep calling', won: c => 'Beto had ' + c + ' and wins round 1.', shareGo: 'They share it — shuffle for round 2', tonight: 'Ana 1 · Beto 1 tonight', row: 'Round 1Ana and Betoshared · Clásico · 8 cards' },
      es: { more: '+ Otro ganador con esta carta', tieGo: 'Seguir cantando — decide la siguiente carta', bar: 'Empate entre Ana y Beto: gana el primero al que le salga una carta', who: '¿Quién tiene El Gallo?', neither: 'Ninguno, seguir cantando', beto: 'Beto gana la ronda 1', both: 'Ana y Beto: siguen empatados, seguir cantando', won: c => 'Beto tenía ' + c + ' y gana la ronda 1.', shareGo: 'Comparten — barajar para la ronda 2', tonight: 'Esta noche: Ana 1 · Beto 1', row: 'Ronda 1Ana y Betocompartida · Clásico · 8 cartas' }
    }[lang];
    const ctx = await context(PHONE);
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await seed(page, { 'loteria.lang': lang, 'loteria.cantor': cantorSave() });
      await page.goto(base + 'cantor.html');
      const wins = async () => (await saved(page, 'loteria.cantor')).wins.map(w => w.who + (w.share ? ' (shared)' : ''));
      // Keep calling, the next card decides, the start: names typed one after the other.
      await page.click('#lotBtn');
      assert.ok(await page.isDisabled('#clMore'), lang + ': Another winner with no name typed');
      await page.fill('#clWho', 'Ana'); await page.click('#clMore');
      assert.equal(await page.textContent('#winbox .co .chip'), 'Ana ✕');
      assert.equal(await page.inputValue('#clWho'), '');
      assert.ok(await page.evaluate(() => document.getElementById('clBack').hidden), lang + ': Keep calling beside a winner in');
      await page.fill('#clWho', 'Beto');
      assert.equal(await page.textContent('#clNew'), W.tieGo);
      await page.click('#clNew');
      assert.equal(await page.$eval('#tieBar', b => b.textContent), W.bar);
      // Store-bought tablas: El Cantor asks, card by card. Neither has El Gallo.
      await page.click('#nextBtn');
      await until(page, () => !!document.querySelector('#winbox:not([hidden]) #askOk'));
      assert.equal(await page.textContent('#winbox h2'), W.who);
      assert.deepEqual(await page.$$eval('#winbox .tied .chip', bs => bs.map(b => b.textContent)), ['Ana', 'Beto']);
      assert.equal(await page.textContent('#askOk'), W.neither);
      await page.keyboard.press('Escape');
      assert.ok(await page.evaluate(() => !document.getElementById('winbox').hidden), lang + ': Escape put the question away');
      await page.click('#askOk');
      assert.deepEqual(await wins(), []);
      // Both have the next one: they stay tied. Then Beto has the one after, and wins.
      await page.click('#nextBtn');
      await until(page, () => !!document.querySelector('#winbox:not([hidden]) #askOk'));
      await page.click('#winbox .tied .chip >> nth=0'); await page.click('#winbox .tied .chip >> nth=1');
      assert.equal(await page.textContent('#askOk'), W.both);
      await page.click('#askOk');
      assert.equal(await page.$eval('#tieBar', b => b.hidden ? '' : b.textContent), W.bar);
      await page.click('#nextBtn');
      await until(page, () => !!document.querySelector('#winbox:not([hidden]) #askOk'));
      await page.click('#winbox .tied .chip >> nth=1');
      assert.equal(await page.textContent('#askOk'), W.beto);
      await page.click('#askOk');
      assert.equal(await page.textContent('#winbox .winc > p'), W.won(await page.evaluate(() => Loteria.card(50).name)));
      assert.deepEqual(await wins(), ['Beto']);
      await noSideways(page, lang + ': the tie-break');
      // They share the round: each gets it, and Settings lists the round once with both.
      await page.evaluate(s => localStorage.setItem('loteria.cantor', JSON.stringify(s)), cantorSave({}, { two: 'share' }));
      await page.reload();
      await page.click('#lotBtn');
      await page.fill('#clWho', 'Ana'); await page.click('#clMore'); await page.fill('#clWho', 'Beto');
      assert.equal(await page.textContent('#clNew'), W.shareGo);
      assert.equal(await page.textContent('#clTonight'), W.tonight);
      await page.click('#clNew'); await page.click('#ptx');
      assert.deepEqual(await wins(), ['Ana (shared)', 'Beto (shared)']);
      await page.click('#setBtn');
      assert.deepEqual(await page.$$eval('#winsCard .wins:not(.nights) div', ds => ds.map(d => d.textContent)), [W.row]);
      assert.deepEqual(await page.$$eval('#twoOpts .opt', bs => bs.map(b => b.dataset.v + (b.classList.contains('on') ? ' (on)' : ''))), ['next', 'share (on)', 'first']);
      // First to shout wins: one winner, as before, and no Another winner.
      await page.click('#twoOpts [data-v=first]'); await page.click('#stx');
      await page.click('#nextBtn'); await page.click('#lotBtn');
      assert.equal(await page.$('#clMore'), null, lang + ': Another winner under First to shout wins');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('cantor: a second check closed with no winner brings back the first, and Tabla Llena or the deck’s end shares a tie', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.cantor': cantorSave({}, { check: true }) });
    await page.goto(base + 'cantor.html');
    const box = () => page.$eval('#winbox', b => b.hidden ? '' : b.querySelector('.winc > p').textContent);
    const wins = async () => (await saved(page, 'loteria.cantor')).wins.map(w => w.who + (w.share ? ' (shared)' : ''));
    await page.click('#lotBtn');
    await page.fill('#vfN', '7'); await page.fill('#vfWho', 'Ana'); await page.click('#vfWin');
    await page.click('#celMore');
    await page.fill('#vfN', '2'); // not good
    await page.click('#vfBack');
    assert.equal(await box(), 'Ana wins round 1 after 8 cards.', 'the first winner’s box didn’t come back');
    assert.deepEqual(await wins(), [], 'Ana is saved twice over, or not waiting');
    await page.click('#celOk');
    assert.deepEqual(await wins(), ['Ana']);
    await page.click('#ptx');
    // Tabla Llena: no card still to come can be on a full tabla, so a tie is shared.
    await page.evaluate(s => localStorage.setItem('loteria.cantor', JSON.stringify(s)), cantorSave({ patterns: ['llena'], wins: [] }, { check: false }));
    await page.reload();
    await page.click('#lotBtn');
    await page.fill('#clWho', 'Ana'); await page.click('#clMore'); await page.fill('#clWho', 'Beto');
    assert.equal(await page.textContent('#clNew'), 'They share it — shuffle for round 2');
    assert.ok(await page.isVisible('#clWhy'), 'Tabla Llena didn’t say why they share');
    await page.click('#clNew'); await page.click('#ptx');
    assert.deepEqual(await wins(), ['Ana (shared)', 'Beto (shared)']);
    // The deck runs out under a tie-break: they share it.
    await page.evaluate(s => localStorage.setItem('loteria.cantor', JSON.stringify(s)), cantorSave({ pos: 53, wins: [], tie: { round: 1, at: 53, upTo: 53, who: [{ who: 'Ana', cards: TIE.slice(0, 16) }, { who: 'Beto', cards: TIE.slice(0, 16) }] } }));
    await page.reload();
    await page.click('#nextBtn');
    await until(page, () => !document.getElementById('winbox').hidden);
    assert.equal(await box(), 'Ana and Beto share round 1 after 54 cards. No card left on their tablas can break the tie, so they share it.');
    assert.deepEqual(await wins(), ['Ana (shared)', 'Beto (shared)']);
    // Clear in Settings starts the rounds again at 1, and a tie-break under way in round 3 goes on in round 1.
    await page.evaluate(s => localStorage.setItem('loteria.cantor', JSON.stringify(s)), cantorSave({ round: 3, wins: [{ round: 1, who: 'Ana', how: 'Clásico', tabla: '', at: 9, t: Date.now() - 3600e3 }], tie: { round: 3, at: 8, upTo: 8, who: [{ who: 'Ana' }, { who: 'Beto' }] } }));
    await page.reload();
    await page.click('#setBtn'); await page.click('#wClr'); await page.click('#wClr'); await page.click('#stx');
    assert.equal(await page.textContent('#sub'), 'Round 1 · 8 of 54');
    await page.click('#nextBtn');
    await until(page, () => !!document.querySelector('#winbox:not([hidden]) #askOk'), null, 10000);
    assert.equal((await saved(page, 'loteria.cantor')).tie.round, 1, 'Clear ended the tie-break');
    // Putting cards back past the tied card calls the tie off.
    await page.evaluate(s => localStorage.setItem('loteria.cantor', JSON.stringify(s)), cantorSave({ pos: 9, wins: [], tie: { round: 1, at: 8, upTo: 9, who: [{ who: 'Ana' }, { who: 'Beto' }] } }));
    await page.reload();
    assert.ok(await page.isVisible('#tieBar'));
    await page.click('#backBtn');
    assert.ok(await page.isVisible('#tieBar'), 'back to the tied card called the tie off');
    await page.click('#backBtn');
    assert.ok(!(await page.isVisible('#tieBar')), 'back past the tied card kept the tie');
    assert.equal((await saved(page, 'loteria.cantor')).tie, null);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: on a short phone a printed tabla’s verdict shows above the winner row', async () => {
  const ctx = await context({ ...PHONE, viewport: { width: 360, height: 740 } });
  try {
    const page = await ctx.newPage(), problems = watch(page);
    const win = (round, who) => ({ round, who, how: 'Clásico', tabla: '', at: 9, t: round });
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 6, round: 3, patterns: ['linea', 'esquinas', 'cuadro'], juego: 'CANELA', wins: [win(1, 'Abuela'), win(2, 'Tío Beto')], settings: { speak: false, sound: false, check: true } } });
    await page.goto(base + 'cantor.html');
    await page.click('#lotBtn');
    await page.fill('#vfN', '3');
    const seen = sel => page.$eval(sel, el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); });
    assert.equal(await page.textContent('#vfV h3'), 'Not yet');
    assert.ok(await seen('#vfV h3'), 'the winner row covers the verdict');
    assert.ok(await seen('#vfBack'), 'Keep calling is off the screen');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: the juego of a tabla checked once is ready at the next ¡Lotería!', async () => {
  // The usual table: the tablas were printed on the laptop, and the caller's phone has never made a PDF.
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 6, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false, check: true } } });
    await page.goto(base + 'cantor.html');
    const mode = () => page.textContent('#vfSeg button.on');
    await page.click('#lotBtn');
    assert.equal(await mode(), 'Card by card');
    await page.click('#vfSeg [data-v=printed]');
    assert.match(await page.textContent('#vfV'), /make a set under Print tablas/);
    await page.fill('#vfJ', 'canela');
    await page.fill('#vfN', '3');
    assert.equal(await page.textContent('#vfV h3'), 'Not yet');
    await page.click('#vfx');
    assert.equal((await saved(page, 'loteria.cantor')).juego, 'CANELA');
    await page.click('#lotBtn');
    assert.equal(await mode(), 'Printed tabla', 'the next check opened on Card by card');
    assert.equal(await page.inputValue('#vfJ'), 'CANELA');
    assert.equal(await page.inputValue('#vfN'), '');
    assert.doesNotMatch(await page.textContent('#vfV'), /make a set/);
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'DIV', 'a box took the focus and put the phone’s keyboard up');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: the checker says to check a number past the tablas printed of a juego, in English and in Spanish', async () => {
  for (const [lang, says] of [['en', 'CANELA was printed with 12 tablas — check the number'], ['es', 'CANELA se imprimió con 12 tablas — revisa el número']]) {
    const ctx = await context(PHONE);
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await seed(page, { 'loteria.lang': lang, 'loteria.cantor': { order: run(1, 54), pos: 6, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: 'CANELA', printed: { CANELA: 12, DULCE: 'mucho' }, wins: [], settings: { speak: false, sound: false, check: true } } });
      await page.goto(base + 'cantor.html');
      await page.click('#lotBtn');
      const warn = () => page.$$eval('#vfV .vfwarn', ps => ps.map(p => p.textContent));
      await page.fill('#vfN', '12'); // dieciséis, heard right
      assert.deepEqual(await warn(), [], lang + ': the last tabla printed got the line');
      await page.fill('#vfN', '60'); // dieciséis, heard as sesenta
      assert.deepEqual(await warn(), [says], lang + ': tabla 60 of 12');
      assert.match(await page.textContent('#vfV h3'), lang === 'en' ? /^Not yet$/ : /^Todavía no$/);
      assert.ok(await page.$eval('#vfV .vfwarn', el => { const r = el.getBoundingClientRect(); return r.bottom <= document.querySelector('.vfwin').getBoundingClientRect().top; }), lang + ': the winner row covers the line');
      await page.fill('#vfJ', 'DULCE'); // a juego with no count to go by (here a damaged one) says nothing
      assert.deepEqual(await warn(), [], lang + ': a juego with no count said how many');
      await noSideways(page, 'the checker with the line');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('cantor: a winner’s name goes from the ¡Lotería! box to the checker, and the tally counts a name once, whatever its capitals', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    // Two rounds won by Tío Beto tonight, typed two ways on two phones.
    const win = (round, who) => ({ round, who, how: 'Clásico', tabla: '', at: 9, t: Date.now() - 3600e3 + round });
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 6, round: 3, patterns: ['equis'], juego: '', wins: [win(1, 'Tío Beto'), win(2, 'tío beto')], settings: { speak: false, sound: false, check: false } } });
    await page.goto(base + 'cantor.html');
    const chips = sel => page.$$eval(sel + ' .chip', bs => bs.map(b => b.textContent + (b.classList.contains('on') ? ' (on)' : '')));
    const wins = async () => (await saved(page, 'loteria.cantor')).wins.map(w => w.round + ' ' + w.who);
    await page.click('#lotBtn');
    assert.deepEqual(await chips('#clNames'), ['tío beto']);
    await page.fill('#clWho', 'Abuela');
    await page.click('#clCheck');
    assert.equal(await page.inputValue('#vfWho'), 'Abuela', 'Check a tabla first lost the name');
    assert.deepEqual(await chips('#vfNames'), ['tío beto'], 'the checker has no past winners to tap');
    await page.click('#vfNames .chip');
    assert.equal(await page.inputValue('#vfWho'), 'tío beto');
    await page.fill('#vfWho', 'Abuela');
    await page.click('#vfWin');
    await page.click('#celOk');
    assert.equal(await sheetTitle(page), 'Round 4 — what are we playing?');
    await page.click('#ptx');
    // Take their word: a name typed the way a past winner's is goes in as theirs, and Shuffle asks what's next, as above.
    await page.click('#nextBtn'); // a card into the new round: before one, ¡Lotería! only says ▶ starts the round
    await page.click('#lotBtn');
    assert.deepEqual(await chips('#clNames'), ['Abuela', 'tío beto']);
    await page.fill('#clWho', 'abuela ');
    assert.deepEqual(await chips('#clNames'), ['Abuela (on)', 'tío beto']);
    await page.click('#clNew');
    assert.equal(await sheetTitle(page), 'Round 5 — what are we playing?', 'take their word’s Shuffle didn’t ask what we’re playing');
    await page.click('#ptx');
    assert.deepEqual((await saved(page, 'loteria.cantor')).patterns, ['equis'], 'Done changed the game');
    assert.deepEqual(await wins(), ['1 Tío Beto', '2 tío beto', '3 Abuela', '4 Abuela']);
    await page.click('#setBtn');
    assert.deepEqual(await chips('#winsCard'), ['tío beto · 2', 'Abuela · 2']);
    await page.click('#stx');
    // A spelling with no capitals gives way to one typed with them, so the tally can be put right.
    await page.click('#nextBtn');
    await page.click('#lotBtn');
    await page.fill('#clWho', 'Tío Beto');
    await page.click('#clNew');
    await page.click('#ptx');
    assert.deepEqual((await wins()).slice(-1), ['5 Tío Beto'], 'a name typed with capitals was saved without them');
    await page.click('#setBtn');
    assert.deepEqual(await chips('#winsCard'), ['Tío Beto · 3', 'Abuela · 2']);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: tonight’s standings under the winner in both ¡Lotería! boxes, earlier nights by date, and a new night starts at round 1', async () => {
  const H = 3600e3, now = Date.now(), win = (round, who, t, tabla = '') => ({ round, who, how: 'Clásico', tabla, at: 9, t });
  const CANELA7 = [21, 51, 23, 6, 16, 33, 8, 4, 14, 20, 9, 40, 29, 41, 13, 25];
  // Last Saturday's three rounds, and the first round tonight. Less than six hours apart is one night.
  const WINS = [win(1, 'Abuela', now - 30 * H), win(2, 'Mark', now - 28 * H), win(3, 'Abuela', now - 25 * H), win(1, 'Abuela', now - H)];
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    const order = CANELA7.slice(0, 4).concat(run(1, 54).filter(n => CANELA7.slice(0, 4).indexOf(n) < 0));
    await seed(page, { 'loteria.cantor': { order, pos: 4, round: 2, last: now - H / 2, patterns: ['linea', 'esquinas', 'cuadro'], juego: 'CANELA', wins: WINS, settings: { speak: false, sound: false, check: false } } });
    await page.goto(base + 'cantor.html');
    const line = sel => page.$eval(sel, el => el.offsetParent ? el.textContent : '');
    // Take their word: the line follows the name typed, counted the way the win will be.
    await page.click('#lotBtn');
    assert.equal(await line('#clTonight'), 'Abuela 1 tonight');
    await page.fill('#clWho', 'mark');
    assert.equal(await line('#clTonight'), 'Abuela 1 · Mark 1 tonight', 'a past winner typed without capitals');
    await page.click('#clNames .chip:text-is("Abuela")');
    assert.equal(await line('#clTonight'), 'Abuela 2 tonight', 'a tap on a past winner');
    await page.click('#clNew');
    await page.click('#ptx');
    assert.equal(await page.textContent('#sub'), 'Round 3 · 0 of 54');
    // Checked: the box after ¡Buena! has it too, with the win in it.
    await page.evaluate(o => { const c = JSON.parse(localStorage.getItem('loteria.cantor')); c.order = o; c.pos = 4; c.settings.check = true; localStorage.setItem('loteria.cantor', JSON.stringify(c)); }, order);
    await page.reload();
    await page.click('#lotBtn');
    await page.fill('#vfN', '7');
    await page.fill('#vfWho', 'Mark');
    await page.click('#vfWin');
    assert.equal(await line('#winbox p.tonight'), 'Abuela 2 · Mark 1 tonight');
    await page.click('#celOk'); await page.click('#ptx');
    // Settings: tonight's tally and rounds, then the nights before by date.
    await page.click('#setBtn');
    assert.deepEqual(await page.$$eval('#winsCard > .chips .chip', cs => cs.map(c => c.textContent)), ['Abuela · 2', 'Mark · 1']);
    assert.deepEqual(await page.$$eval('#winsCard .wins:not(.nights) b', bs => bs.map(b => b.textContent)), ['Mark', 'Abuela', 'Abuela']);
    const sat = await page.evaluate(t => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), now - 30 * H);
    assert.deepEqual(await page.$$eval('#winsCard .nights div', ds => ds.map(d => d.textContent)), [sat + 'Abuela 2 · Mark 1']);
    await noSideways(page, 'the Winners card');
    // Clear empties the winners and starts the rounds again at 1.
    await page.click('#wClr'); await page.click('#wClr');
    assert.equal(await page.textContent('#sub'), 'Round 1 · 0 of 54', 'Clear kept the round count');
    assert.deepEqual((await saved(page, 'loteria.cantor')).wins, []);
    await page.click('#stx');
    // A new night: El Cantor last used seven hours ago, on round 14 with ten cards out. The round shows as 1, and
    // shuffled before a card of it is called, the new one is round 1 too; the next is 2.
    await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('loteria.cantor')); c.round = 14; c.pos = 10; c.last = Date.now() - 7 * 3600e3; c.tie = { round: 14, at: 9, upTo: 10, who: [{ who: 'Ana' }, { who: 'Beto' }] }; localStorage.setItem('loteria.cantor', JSON.stringify(c)); });
    await page.reload();
    assert.equal(await page.textContent('#sub'), 'Round 1 · 10 of 54', 'a new night kept last night’s round');
    assert.ok(!(await page.isVisible('#tieBar')), 'a tie-break left from last night is still on');
    await page.click('#newBtn');
    assert.equal(await sheetTitle(page), 'Start round 1?', 'the first shuffle of the night asked for round 2');
    await page.click('#nrOk'); await page.click('#ptx');
    assert.equal(await page.textContent('#sub'), 'Round 1 · 0 of 54', 'the first shuffle of the night made round 2');
    await page.click('#nextBtn');
    await page.click('#newBtn'); await page.click('#nrOk'); await page.click('#ptx');
    assert.equal(await page.textContent('#sub'), 'Round 2 · 0 of 54');
    // A ¡Lotería! on the round left from last night makes it tonight's round 1: the next is round 2, as its button says.
    await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('loteria.cantor')); c.round = 14; c.pos = 10; c.wins = []; c.settings.check = false; c.last = Date.now() - 7 * 3600e3; localStorage.setItem('loteria.cantor', JSON.stringify(c)); });
    await page.reload();
    await page.click('#lotBtn'); await page.fill('#clWho', 'Ana');
    assert.equal(await page.textContent('#clNew'), 'Shuffle for round 2');
    await page.click('#clNew');
    assert.equal(await sheetTitle(page), 'Round 2 — what are we playing?', 'a win on last night’s round left the next one round 1');
    await page.click('#ptx');
    assert.deepEqual((await saved(page, 'loteria.cantor')).wins.map(w => [w.round, w.who]), [[1, 'Ana']]);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
  // In Spanish, with the date in Spanish.
  const es = await context(PHONE);
  try {
    const page = await es.newPage(), problems = watch(page);
    await seed(page, { 'loteria.lang': 'es', 'loteria.cantor': { order: run(1, 54), pos: 4, round: 2, last: now - H / 2, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: WINS, settings: { speak: false, sound: false, check: false } } });
    await page.goto(base + 'cantor.html');
    await page.click('#lotBtn');
    assert.equal(await page.textContent('#clTonight'), 'Esta noche: Abuela 1');
    await page.keyboard.press('Escape');
    await page.click('#setBtn');
    const sab = await page.evaluate(t => new Date(t).toLocaleDateString('es-MX', { weekday: 'short', month: 'short', day: 'numeric' }), now - 30 * H);
    assert.deepEqual(await page.$$eval('#winsCard .nights div', ds => ds.map(d => d.textContent)), [sab + 'Abuela 2 · Mark 1']);
    assert.match(await page.textContent('#winsCard'), /^Ganadores · Esta noche/);
    assert.deepEqual(problems, []);
  } finally { await es.close(); }
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
    // The winner row stays on the phone's screen below the 54 cards, with nothing over it.
    const inView = sel => page.$eval(sel, b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && b.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); });
    await checkAfter(['El Cazo', 'El Negrito', 'La Corona']);
    assert.deepEqual(await verdict(), ['All 3 are out', 'If they make the shape — Clásico — with doubles on their tabla, it’s good. It finished on the card just called, La Corona.']); // 3 cards for 4 squares
    assert.deepEqual(await chips(), ['El Cazo · #1 ✕', 'La Corona · #3 ✕', 'El Negrito · #2 ✕']);
    assert.ok(await inView('#vfWin'), '¡Buena! New round is off the screen after four cards are picked');
    await checkAfter(['El Cazo', 'El Negrito', 'El Gallo']); // La Corona not called yet: the second tap took it off, and the tabla passed
    assert.deepEqual(await verdict(), ['Not yet', 'La Corona hasn’t been called.']);
    assert.ok(await inView('#vfBack'), 'Keep calling is off the screen');
    assert.equal(await page.textContent('#vfWin'), 'Count it anyway');
    await page.locator('#vfChips .chip', { hasText: 'La Corona' }).click();
    assert.deepEqual(await chips(), ['El Cazo · #1 ✕', 'El Negrito · #2 ✕']);
    assert.equal((await verdict())[0], 'All 2 are out');
    assert.equal(await page.locator('#vfPick .pk.no').count(), 0, 'La Corona is still picked in the deck');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: card by card, too few cards for the game aren’t “already good”, and fewer than its squares are good with doubles', async () => {
  // Tabla Llena covers 16 squares, and a card two at most (a double): 2 cards can't have won it, and 8 only with doubles.
  for (const locale of ['en-US', 'es-MX']) {
    const ctx = await context(PHONE, { locale });
    try {
      const page = await ctx.newPage(), problems = watch(page), es = locale === 'es-MX';
      await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 9, round: 1, patterns: ['llena'], juego: '', wins: [], settings: { speak: false, sound: false, check: true } } });
      await page.goto(base + 'cantor.html');
      await page.click('#lotBtn');
      const tap = async n => page.click(`#vfPick .pk:nth-child(${n})`);
      await tap(3); await tap(7);
      assert.equal(await page.textContent('#vfV'), es ? 'Tabla Llena necesita 16 casillas — hasta ahora te leyó 2 cartas. Sigue tocando.' : 'Tabla Llena needs 16 squares — they’ve read out 2 cards so far. Keep tapping.');
      assert.equal(await page.getAttribute('#vfV', 'class'), 'verdict', 'two cards of Tabla Llena show as good');
      assert.equal(await page.textContent('#vfWin'), es ? 'Darla por buena' : 'Count it anyway');
      for (const n of [1, 2, 4, 5, 6, 8]) await tap(n);
      assert.equal(await page.getAttribute('#vfV', 'class'), 'verdict ok');
      assert.match(await page.textContent('#vfV p'), es ? /con dobles en su tabla, es buena/ : /with doubles on their tabla, it’s good/);
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('cantor: Print tablas starts on Letter for a phone in plain or Latin American Spanish, and A4 for Spain', async () => {
  for (const [locale, paper] of [['es', 'letter'], ['es-419', 'letter'], ['es-MX', 'letter'], ['es-ES', 'a4'], ['en-GB', 'a4'], ['en-US', 'letter']]) {
    const ctx = await context(PHONE, { locale });
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await page.goto(base + 'cantor.html');
      await page.click('#printBtn');
      assert.equal((await saved(page, 'loteria.cantor')).print.paper, paper, locale);
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

// A PDF from El Cantor's writer, read back: its pages' drawing (left uncompressed), in order, with the card pictures each
// page draws, as card numbers, in the order drawn; and its page sizes.
async function readPdf(file) {
  const pdf = await readFile(file), text = pdf.toString('latin1');
  const L = await loadDeck(), byBytes = new Map();
  for (const c of L.CARDS) byBytes.set(createHash('sha1').update(await readFile(join(root, 'cards', c.f + '.jpg'))).digest('hex'), c.n);
  const images = {};
  for (const m of text.matchAll(/(\d+) 0 obj\n<< \/Type \/XObject \/Subtype \/Image [^>]*?\/Length (\d+) >>\nstream\n/g)) {
    const at = m.index + m[0].length;
    images['Im' + m[1]] = byBytes.get(createHash('sha1').update(pdf.subarray(at, at + Number(m[2]))).digest('hex')) || null;
  }
  const pages = [...text.matchAll(/<< \/Length \d+ >>\nstream\n([\s\S]*?)\nendstream/g)].map(m => m[1]);
  return {
    head: text.slice(0, 8),
    pages,
    cards: pages.map(p => [...p.matchAll(/\/(Im\d+) Do/g)].map(m => images[m[1]]).filter(n => n)),
    sizes: [...text.matchAll(/\/Type \/Page \/Parent \d+ 0 R \/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(m => m[1] + 'x' + m[2]),
  };
}

check('cantor: Print tablas makes the PDF it says, with CANELA 7 square for square as the checker has it', async () => {
  const ctx = await context(DESKTOP, { acceptDownloads: true });
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'cantor.html');
    await page.click('#printBtn');
    await page.fill('#prName', 'CANELA');
    await page.fill('#prCount', '12'); await page.press('#prCount', 'Tab');
    await page.click('#prPer [data-v="1"]'); await page.click('#prPaper [data-v="letter"]');
    assert.equal(await page.textContent('#prInfo'), '12 tablas from juego CANELA · 12 pages, Letter');
    let [dl] = await Promise.all([page.waitForEvent('download'), page.click('#prGo')]);
    assert.equal(dl.suggestedFilename(), 'loteria-canela-12.pdf');
    await until(page, () => /^Downloaded — 12 tablas, [\d.]+ MB\. Keep the name CANELA\.$/.test(document.getElementById('toast').textContent));
    let pdf = await readPdf(await dl.path());
    assert.equal(pdf.head, '%PDF-1.4');
    assert.deepEqual(pdf.sizes, Array(12).fill('612x792'), 'twelve Letter pages, upright');
    pdf.pages.forEach((p, i) => assert.ok(p.includes('(JUEGO CANELA) Tj') && p.includes('(' + (i + 1) + ') Tj'), 'page ' + (i + 1) + ' is headed JUEGO CANELA No. ' + (i + 1)));
    // The cards printed on tabla 7, in reading order, as test 'deck: the juego generator never changes' has them.
    assert.deepEqual(pdf.cards[6], [21, 51, 23, 6, 16, 33, 8, 4, 14, 20, 9, 40, 29, 41, 13, 25]);
    const L = await loadDeck();
    assert.deepEqual(pdf.cards, plain(L.juego('CANELA', 12)), 'every printed tabla is the juego’s');
    // Two per page on A4, three tablas: two pages turned sideways.
    await page.fill('#prCount', '3'); await page.press('#prCount', 'Tab');
    await page.click('#prPer [data-v="2"]'); await page.click('#prPaper [data-v="a4"]');
    [dl] = await Promise.all([page.waitForEvent('download'), page.click('#prGo')]);
    assert.equal(dl.suggestedFilename(), 'loteria-canela-3.pdf');
    assert.deepEqual((await saved(page, 'loteria.cantor')).printed, { CANELA: 12 }, 'three printed after twelve forgot the twelve');
    pdf = await readPdf(await dl.path());
    assert.deepEqual(pdf.sizes, ['841.89x595.28', '841.89x595.28']);
    assert.deepEqual(pdf.cards, [L.juego('CANELA', 3)[0].concat(L.juego('CANELA', 3)[1]), plain(L.juego('CANELA', 3)[2])].map(plain));
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: Print tablas prints the deck too: 54 cards to cut out, 9 to a page with a grid to cut along, in either language', async () => {
  for (const [locale, words] of [['en-US', { deck: 'The deck', info: 'The deck: 54 cards to cut out · 6 pages, Letter', file: 'loteria-deck.pdf', done: /^Downloaded — the deck, 54 cards on 6 pages, [\d.]+ MB\.$/, foot: '(El Cantor · The deck · Page 1 of 6 · Cut along the grey lines) Tj' }],
    ['es-MX', { deck: 'La baraja', info: 'La baraja: 54 cartas para recortar · 6 hojas, tamaño carta', file: 'loteria-baraja.pdf', done: /^Descargado — la baraja, 54 cartas en 6 hojas, [\d.]+ MB\.$/, foot: '(El Cantor · La baraja · Hoja 1 de 6 · Corta por las l\xedneas grises) Tj' }]]) {
    const ctx = await context(DESKTOP, { acceptDownloads: true, locale });
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 3, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: 'CANELA', wins: [], print: { name: 'CANELA', count: 12, per: 2, paper: 'letter' } } });
      await page.goto(base + 'cantor.html');
      await page.click('#printBtn');
      assert.deepEqual(await page.$$eval('#prPer button', bs => bs.map(b => b.textContent)).then(l => l[2]), words.deck);
      await page.click('#prPer [data-v="deck"]');
      // A deck has no juego name and no count; what it prints shows below, the 54 cards.
      assert.equal(await page.textContent('#prInfo'), words.info);
      assert.ok(await page.isHidden('#prName') && await page.isHidden('#prCount'), 'the juego name and the count still show for the deck');
      assert.equal(await page.locator('#prGrid .g img').count(), 54);
      await noSideways(page, 'Print tablas with the deck');
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#prGo')]);
      assert.equal(dl.suggestedFilename(), words.file);
      await until(page, re => new RegExp(re).test(document.getElementById('toast').textContent), words.done.source);
      const pdf = await readPdf(await dl.path());
      assert.deepEqual(pdf.sizes, Array(6).fill('612x792'), 'six Letter pages');
      assert.deepEqual(pdf.cards, [0, 1, 2, 3, 4, 5].map(p => run(1 + 9 * p, 9)), 'the 54 cards in order, 9 to a page');
      assert.ok(pdf.pages[0].includes(words.foot), 'page 1’s footer');
      // The grid to cut along: 4 lines down and 4 across, the card's own size apart (2 in, and 2 in × 656/400).
      const lines = [...pdf.pages[0].matchAll(/([\d.]+) ([\d.]+) m ([\d.]+) ([\d.]+) l/g)].map(m => m.slice(1).map(Number));
      const xs = lines.filter(l => l[0] === l[2]).map(l => l[0]), ys = lines.filter(l => l[1] === l[3]).map(l => l[1]);
      assert.deepEqual(xs.map(x => x - xs[0]), [0, 144, 288, 432]);
      assert.deepEqual(ys.map(y => Math.round((ys[0] - y) * 100) / 100), [0, 236.16, 472.32, 708.48]);
      // It leaves the tablas' settings and the juego as they were, and choosing Two again brings the tablas back.
      const c = await saved(page, 'loteria.cantor');
      assert.deepEqual([c.juego, c.print.name, c.print.count, c.print.per, c.print.deck], ['CANELA', 'CANELA', 12, 2, true]);
      await page.click('#prPer [data-v="2"]');
      assert.ok(await page.isVisible('#prName'), 'the juego name didn’t come back');
      assert.equal(await page.locator('#prGrid .prt').count(), 12);
      assert.equal((await saved(page, 'loteria.cantor')).print.deck, false);
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('cantor: on a phone, the PDF made goes to the phone’s share sheet with Print or send…, and Download still saves it', async () => {
  // A stand-in for the share sheet: it keeps what it was handed. cancel: the person closes it without picking.
  const SHARE = () => {
    window.__shared = []; window.__cancel = false;
    navigator.canShare = d => !!(d && d.files && d.files.every(f => f instanceof File));
    navigator.share = d => { window.__shared.push(d.files.map(f => ({ name: f.name, type: f.type, size: f.size }))); return window.__cancel ? Promise.reject(new DOMException('closed', 'AbortError')) : Promise.resolve(); };
  };
  for (const kind of [PHONE, DESKTOP]) {
    const ctx = await context(kind, { acceptDownloads: true });
    try {
      const page = await ctx.newPage(), problems = watch(page), phone = kind === PHONE;
      await page.addInitScript(SHARE);
      let downloads = 0; page.on('download', () => downloads++);
      await page.goto(base + 'cantor.html');
      await page.click('#printBtn');
      await page.fill('#prName', 'CANELA');
      await page.fill('#prCount', '3'); await page.press('#prCount', 'Tab');
      if (!phone) { // a computer saves it straight away, as before, and has nothing to share
        const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#prGo')]);
        assert.equal(dl.suggestedFilename(), 'loteria-canela-3.pdf');
        assert.equal(await page.textContent('#prGo'), 'Make the PDF');
        assert.ok(await page.isHidden('#prDl'));
        assert.deepEqual(await page.evaluate(() => window.__shared), []);
        assert.deepEqual(problems, []);
        continue;
      }
      await page.click('#prGo');
      await until(page, () => document.getElementById('prGo').textContent === 'Print or send…');
      assert.match(await page.textContent('#toast'), /^Ready — 3 tablas, [\d.]+ MB\. Keep the name CANELA\.$/);
      assert.equal(downloads, 0, 'the phone downloaded it as well');
      assert.ok(await page.isVisible('#prDl'), 'no Download');
      assert.equal((await saved(page, 'loteria.cantor')).printed.CANELA, 3, 'the checker doesn’t know 3 were printed');
      // Closed without picking anything: nothing else happens, and it's there for another go.
      await page.evaluate(() => { window.__cancel = true; });
      await page.click('#prGo');
      await page.evaluate(() => { window.__cancel = false; });
      await page.click('#prGo');
      const shared = await page.evaluate(() => window.__shared);
      assert.equal(shared.length, 2);
      assert.deepEqual(shared[1].map(f => [f.name, f.type]), [['loteria-canela-3.pdf', 'application/pdf']]);
      assert.ok(shared[1][0].size > 20000, 'the PDF handed over is ' + shared[1][0].size + ' bytes');
      assert.equal(downloads, 0, 'closing the share sheet downloaded it');
      // Download: today's way.
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#prDl')]);
      assert.equal(dl.suggestedFilename(), 'loteria-canela-3.pdf');
      const bytes = await readFile(await dl.path());
      assert.equal(bytes.length, shared[1][0].size, 'Download saved another PDF than the one shared');
      // A choice changed: the PDF is made again.
      await page.click('#prPer [data-v="2"]');
      assert.equal(await page.textContent('#prGo'), 'Make the PDF');
      assert.ok(await page.isHidden('#prDl'));
      // The deck too.
      await page.click('#prPer [data-v="deck"]');
      await page.click('#prGo');
      await until(page, () => document.getElementById('prGo').textContent === 'Print or send…', null, 60000);
      await page.click('#prGo');
      assert.deepEqual((await page.evaluate(() => window.__shared))[2].map(f => f.type), ['application/pdf']);
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('cantor: Print tablas at two per page draws the cut line between two tablas, and none beside a lone one', async () => {
  // 3 tablas, 2 per page: page 1 has two side by side and a dashed line down the middle; page 2 has tabla 3 alone.
  const ctx = await context(DESKTOP, { acceptDownloads: true });
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'cantor.html');
    await page.click('#printBtn');
    await page.fill('#prName', 'CANELA');
    await page.fill('#prCount', '3'); await page.press('#prCount', 'Tab');
    await page.click('#prPer [data-v="2"]');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#prGo')]);
    const pdf = await readFile(await dl.path(), 'latin1');
    // The pages' drawing, in order (left uncompressed); the images are the streams with a /Filter.
    const pages = [...pdf.matchAll(/<< \/Length \d+ >>\nstream\n([\s\S]*?)\nendstream/g)].map(m => m[1]);
    assert.equal(pages.length, 2, 'the PDF has 2 pages');
    const cut = c => /\[4 3\] 0 d/.test(c);
    assert.deepEqual(pages.map(cut), [true, false], 'the dashed cut line, page by page');
    assert.ok(/Tabla 3/.test(pages[1]), 'page 2 holds tabla 3');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: on a phone the Sábana sheet shows all 54 cards at once, upright or sideways', async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }, { width: 844, height: 390 }]) {
    const ctx = await context({ ...PHONE, viewport });
    try {
      const page = await ctx.newPage(), problems = watch(page), at = viewport.width + '×' + viewport.height + ': ';
      await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 20, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false, check: false } } });
      await page.goto(base + 'cantor.html');
      await page.click('#sabBtn');
      const fit = await page.evaluate(() => { const g = document.getElementById('ssgrid'), bd = g.parentNode, last = g.lastElementChild.getBoundingClientRect(); return { n: g.children.length, last: last.bottom, edge: bd.getBoundingClientRect().bottom, scrolls: bd.scrollHeight > bd.clientHeight + 1, tile: last.width }; });
      assert.equal(fit.n, 54);
      assert.ok(!fit.scrolls && fit.last <= fit.edge, at + `the last row ends at ${fit.last}, past the sheet’s ${fit.edge}`);
      assert.ok(fit.tile >= 38, at + `the cards are only ${fit.tile} px wide`);
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('badges: the sábana’s call order and a double’s ×2 sit at the top right, off the card’s printed name', async () => {
  // The cards print their number in a tag at the top left and their name along the bottom.
  const high = (page, sel, box) => page.$$eval(sel, (els, box) => els.map(e => { const c = e.closest(box).getBoundingClientRect(), r = e.getBoundingClientRect(); return (r.bottom - c.top) / c.height; }), box);
  const ctx = await context(DESKTOP);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    const first = [1, 2, 3, 23, 27];
    await seed(page, { 'loteria.cantor': { order: first.concat(run(1, 54).filter(n => first.indexOf(n) < 0)), pos: 5, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false } } });
    await page.goto(base + 'cantor.html');
    const sab = await high(page, '#sbgrid .sb .o', '.sb');
    assert.equal(sab.length, 5);
    for (const h of sab) assert.ok(h < 0.35, 'the sábana’s call order reaches ' + Math.round(h * 100) + '% down the card');
    await seed(page, { 'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: [31, 31].concat(run(1, 14)) }], set: { doubles: true, per: 1, paper: 'letter', names: true, who: '' } } });
    await page.goto(base + 'print.html');
    const two = await high(page, '#tablas .sq .two', '.sq');
    assert.equal(two.length, 2);
    for (const h of two) assert.ok(h < 0.35, 'a double’s ×2 reaches ' + Math.round(h * 100) + '% down the card');
    await page.goto(base);
    const home = await page.$eval('.mini .d', d => { const c = d.getBoundingClientRect(), s = getComputedStyle(d, '::after'); return (parseFloat(s.top) + parseFloat(s.height)) / c.height; });
    assert.ok(home < 0.35, 'the home screen’s ×2 reaches ' + Math.round(home * 100) + '% down the card');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('cantor: one card called reads as one, in ↺ and when checking card by card', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 1, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false, awake: false, check: true } } });
    await page.goto(base + 'cantor.html');
    await page.click('#newBtn');
    assert.equal(await page.textContent('#sheet .note'), 'The 1 card called so far goes back in the deck and it gets shuffled. Tell everyone to clear their tablas.');
    await page.click('#nrNo');
    await page.click('#lotBtn');
    await page.click('#vfSeg [data-v="cards"]');
    await page.locator('#vfPick .pk', { has: page.locator('.n', { hasText: /^El Gallo$/ }) }).click();
    assert.equal(await page.textContent('#vfV'), 'Clásico needs 4 squares — they’ve read out 1 card so far. Keep tapping.');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('names: El Cantor and Make tablas call My tablas by its name, and its Share says “this tabla” for one', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 0, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false } }, 'loteria.v1': people([{ id: 'm1', name: 'Mine 1', cards: run(1) }]), 'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: run(1) }], set: { doubles: true, per: 2, paper: 'letter', names: true, who: '' } } });
    await page.goto(base + 'cantor.html');
    await page.click('#setBtn');
    // A plain link, in the same window: a second window would take the caller out of the installed app.
    const link = page.locator('#sheet a', { hasText: 'My tablas' });
    assert.equal(await link.count(), 1, 'Settings has no link named My tablas');
    assert.deepEqual([await link.getAttribute('href'), await link.getAttribute('target')], ['board.html', null]);
    assert.doesNotMatch(await page.textContent('#sheet'), /Lotería board/);
    await page.goto(base + 'print.html');
    assert.equal(await page.textContent('#appBtn'), 'Play these in My tablas…');
    await page.click('#appBtn');
    assert.match(await page.textContent('#dlg .note'), /^Makes a link that opens My tablas with this tabla for whoever you name\./);
    assert.deepEqual([await page.textContent('#dlg h2'), await page.textContent('#apOpen')], ['Play these in My tablas', 'Open in My tablas']);
    assert.doesNotMatch(await page.textContent('#dlg'), /the app/, 'Play these calls My tablas “the app”');
    await page.click('#apx');
    await page.click('.tb [data-a="clear"]');
    await page.click('#appBtn');
    assert.equal(await page.textContent('#toast'), 'Fill a tabla all the way first — My tablas needs all 16 squares');
    await page.goto(base + 'board.html');
    assert.equal(await page.title(), 'Lotería · My tablas');
    await page.click('#tablasBtn');
    await page.click('#tbDel'); // the only person
    assert.equal(await page.textContent('#toast'), 'There has to be one person — add someone else first');
    await page.click('#tbShare');
    assert.match(await page.textContent('#sheet .note'), /^Anyone who opens this link gets a copy of this tabla on their own device/);
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
    assert.ok(await page.evaluate(() => document.getElementById('sheet').hidden), 'Cantaron… stayed open under the ¡Lotería!');
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

check('board: behind Who’s playing a new device shows no tablas and no name, as behind a shared link’s offer', async () => {
  // On a computer the header shows whose tablas they are beside the title; behind the question nobody is set up yet.
  const ctx = await context(DESKTOP);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'board.html');
    assert.equal(await sheetTitle(page), 'Who’s playing on this device?');
    assert.equal(await page.locator('#boards .tabla').count(), 0, 'Mark’s four show behind Who’s playing');
    assert.equal(await page.textContent('#who'), '', 'the header names someone behind Who’s playing');
    // No thanks on a shared link's offer goes on to Who's playing, over the same empty board.
    await page.goto(base + 'board.html#t=Mom~Tabla%201:1.2.3.4.5.6.7.8.9.a.b.c.d.e.f.g');
    await page.click('#imNo');
    assert.equal(await sheetTitle(page), 'Who’s playing on this device?');
    assert.deepEqual([await page.locator('#boards .tabla').count(), await page.textContent('#who')], [0, '']);
    await page.fill('#wName', 'Ana');
    await page.click('#wMark');
    assert.equal(await page.locator('#boards .tabla').count(), 4);
    assert.equal(await page.textContent('#who'), 'Ana');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: Who’s playing waits for a name, so nobody is saved as Mark or as Player', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'board.html');
    // Either start button, or Enter, with the box empty or only spaces: the box takes the focus and says why.
    for (const [how, typed] of [['#wMark', ''], ['#wRandom', ''], ['Enter', ''], ['#wMark', '   ']]) {
      await page.fill('#wName', typed);
      await page.evaluate(() => document.activeElement.blur());
      if (how === 'Enter') await page.press('#wName', 'Enter'); else await page.click(how);
      assert.equal(await sheetTitle(page), 'Who’s playing on this device?', how);
      assert.equal(await saved(page, 'loteria.v1'), null, how + ' saved someone');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'wName', how + ' left the focus off the name box');
      assert.ok(await page.isVisible('#wNeed'), how + ' didn’t say a name is needed');
      assert.equal(await page.textContent('#wNeed'), 'Your name first');
    }
    await page.fill('#wName', 'Lupe');
    assert.ok(await page.isHidden('#wNeed'), 'the note stayed once a name was typed');
    await page.click('#wRandom');
    await until(page, () => document.getElementById('toast').textContent === 'Playing as Lupe — tap Tablas to change any square');
    assert.deepEqual((await saved(page, 'loteria.v1')).players.map(p => p.name + ':' + p.boards.length), ['Lupe:2']);
    // Set up now: a link for someone else, opened in the same page, adds them beside Lupe.
    await page.evaluate(() => { location.hash = '#t=Mom~Tabla%201:1.2.3.4.5.6.7.8.9.a.b.c.d.e.f.g'; });
    await until(page, () => (document.querySelector('#sheet h2') || {}).textContent === 'Tablas from Mom');
    assert.equal(await page.locator('#shLang').count(), 0, 'the link was offered as if nobody were set up');
    await page.click('#imOk');
    assert.deepEqual((await saved(page, 'loteria.v1')).players.map(p => p.name + ':' + p.boards.length), ['Lupe:2', 'Mom:1']);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: Not now on Who’s playing goes to the home screen and saves nobody, so it asks again next time', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'board.html');
    assert.equal(await sheetTitle(page), 'Who’s playing on this device?');
    await page.fill('#wName', 'Lupe'); // typed, but not chosen
    await Promise.all([page.waitForURL(base), page.click('#wLater')]);
    assert.equal(await page.title(), 'Lotería');
    assert.equal(await saved(page, 'loteria.v1'), null, 'Not now saved someone');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('loteria.wName')), null);
    await page.goto(base + 'board.html');
    assert.equal(await sheetTitle(page), 'Who’s playing on this device?', 'it didn’t ask again');
    assert.equal(await page.inputValue('#wName'), '');
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
      if (step !== 'set up') assert.equal(await page.locator('#boards .tabla').count(), 0, step + ': the stand-in tablas show behind the offer');
      if (step === 'add') {
        assert.equal(await page.inputValue('#imName'), 'Mom');
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
        assert.equal(await page.textContent('#imOk'), 'Add to Ana’s tablas', 'a device that has Ana doesn’t offer to add to hers');
        await page.click('#imAlt'); await page.click('#imAlt'); // Replace, on a second tap
        assert.deepEqual(await who(page), ['Ana:1']);
      }
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('board: a shared link on a new phone shows its tablas, and asks whose they are', async () => {
  // Six tablas for Mom, Tabla 1 to 6, each a run of 16 cards starting 7 further on.
  const SIX = Array.from({ length: 6 }, (_, k) => Array.from({ length: 16 }, (_, i) => (k * 7 + i) % 54 + 1));
  const link = (name, tablas) => base + 'board.html#t=' + name + '~' + tablas.map((c, k) => 'Tabla%20' + (k + 1) + ':' + c.map(n => n.toString(36)).join('.')).join('~');
  let ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(link('Mom', SIX));
    assert.equal(await sheetTitle(page), 'Tablas from Mom');
    // Each of the six, with its name and its 16 cards in order, two to a row.
    const grids = await page.$$eval('#sheet .ims .tabla', ts => ts.map(t => [t.querySelector('.k').textContent, [...t.querySelectorAll('img')].map(i => i.getAttribute('src')), Math.round(t.getBoundingClientRect().top)]));
    assert.deepEqual(grids.map(g => g[0]), ['Tabla 1', 'Tabla 2', 'Tabla 3', 'Tabla 4', 'Tabla 5', 'Tabla 6']);
    assert.deepEqual(grids.map(g => g[1]), await page.evaluate(six => six.map(c => c.map(n => Loteria.src(n))), SIX), 'the grids aren’t the link’s cards');
    assert.deepEqual(grids.map(g => g[2]).map((t, i, a) => t === a[i - (i % 2)]), [true, true, true, true, true, true], 'not two to a row');
    assert.ok(grids[2][2] > grids[0][2]);
    // Behind it, no stand-in tablas and no stand-in name.
    assert.equal(await page.locator('#boards .tabla').count(), 0);
    assert.equal(await page.textContent('#who'), '');
    assert.equal(await page.inputValue('#imName'), 'Mom');
    assert.equal(await page.textContent('#imName + .note'), 'Change the name if these tablas are for you.');
    await noSideways(page, 'the offer');
    await page.fill('#imName', ' Ana ');
    await page.click('#imOk');
    await until(page, () => document.getElementById('toast').textContent === 'Playing as Ana');
    const v1 = await saved(page, 'loteria.v1');
    assert.deepEqual(v1.players.map(p => [p.name, p.boards.map(b => b.name + ':' + b.cards.join('.'))]), [['Ana', SIX.map((c, k) => 'Tabla ' + (k + 1) + ':' + c.join('.'))]]);
    assert.equal(await page.locator('#boards .tabla').count(), 6);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
  // An empty box keeps the link's name; and a name typed, then No thanks, carries on to Who's playing.
  for (const step of ['empty', 'no thanks']) {
    ctx = await context(PHONE);
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await page.goto(link('Mom', SIX.slice(0, 1)));
      assert.equal(await page.textContent('#imName + .note'), 'Change the name if this tabla is for you.');
      if (step === 'empty') {
        await page.fill('#imName', '');
        assert.equal(await page.getAttribute('#imName', 'placeholder'), 'Mom');
        await page.press('#imName', 'Enter');
        assert.deepEqual((await saved(page, 'loteria.v1')).players.map(p => p.name + ':' + p.boards.length), ['Mom:1']);
      } else {
        await page.fill('#imName', 'Ana');
        await page.click('#imNo');
        assert.equal(await sheetTitle(page), 'Who’s playing on this device?');
        assert.equal(await page.inputValue('#wName'), 'Ana');
        assert.equal(await saved(page, 'loteria.v1'), null);
        assert.equal(await page.locator('#boards .tabla').count(), 0, 'the stand-in tablas came back behind Who’s playing');
      }
      assert.deepEqual(problems, [], step);
    } finally { await ctx.close(); }
  }
});

check('board: a link for someone already on the phone adds to their tablas, up to six, and replaces them only on a second tap', async () => {
  const mk = k => Array.from({ length: 16 }, (_, i) => (k * 5 + i * 3) % 54 + 1);
  const link = (name, tablas) => base + 'board.html#t=' + name + '~' + tablas.map(([t, k]) => encodeURIComponent(t) + ':' + mk(k).map(n => n.toString(36)).join('.')).join('~');
  const HOME = { ...ANA, players: [ANA.players[0], { id: 'ab', name: 'Abuela', boards: [1, 2, 3].map(k => ({ id: 'a' + k, name: 'Mine ' + k, cards: mk(k) })) }] }; // Ana is up
  const abuela = async page => (await saved(page, 'loteria.v1')).players[1].boards.map(b => b.name);
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    const offer = async (url, note) => {
      await page.goto(url);
      await until(page, () => /^Tablas from /.test((document.querySelector('#sheet h2') || {}).textContent));
      assert.equal(await page.textContent('#imNote'), note);
    };
    const tapped = async (id, said) => {
      await page.click(id);
      await until(page, t => document.getElementById('toast').textContent === t, said);
      assert.ok(await page.evaluate(() => document.getElementById('sheet').hidden));
    };
    await seed(page, { 'loteria.v1': HOME });
    // Two new tablas for "abuela": added after her three.
    await offer(link('abuela', [['New 1', 7], ['New 2', 8]]), 'This link carries 2 tablas for “abuela”. Abuela is already on this device with 3 tablas.');
    assert.deepEqual(await page.$$eval('#imBtns button', bs => bs.map(b => b.textContent)), ['Add to Abuela’s tablas', 'Replace Abuela’s 3 tablas', 'No thanks']);
    assert.equal(await page.locator('#imName').count(), 0, 'a device already set up asks for a name');
    await noSideways(page, 'the offer for someone already here');
    await tapped('#imOk', 'Added 2 tablas to Abuela');
    assert.deepEqual(await abuela(page), ['Mine 1', 'Mine 2', 'Mine 3', 'New 1', 'New 2']);
    assert.equal((await saved(page, 'loteria.v1')).current, 'ab', 'Abuela isn’t up');
    // The same link again adds none.
    await offer(link('abuela', [['New 1', 7], ['New 2', 8]]), 'This link carries 2 tablas for “abuela”. Abuela is already on this device with 5 tablas.');
    await tapped('#imOk', 'Abuela already has these tablas');
    assert.deepEqual(await abuela(page), ['Mine 1', 'Mine 2', 'Mine 3', 'New 1', 'New 2']);
    // One she has, then two new ones: the first new one makes six, and the other stays out.
    await offer(link('Abuela', [['New 2', 8], ['New 3', 9], ['New 4', 10]]), 'This link carries 3 tablas for “Abuela”. Abuela is already on this device with 5 tablas.');
    await tapped('#imOk', 'Added 1 — Abuela has six now, the most');
    assert.deepEqual(await abuela(page), ['Mine 1', 'Mine 2', 'Mine 3', 'New 1', 'New 2', 'New 3']);
    await offer(link('ABUELA', [['New 4', 10]]), 'This link carries 1 tabla for “ABUELA”. Abuela is already on this device with 6 tablas.');
    await tapped('#imOk', 'Abuela already has six tablas, the most');
    // Replace asks for a second tap, and nothing changes before it.
    await offer(link('abuela', [['New 1', 7], ['New 2', 8]]), 'This link carries 2 tablas for “abuela”. Abuela is already on this device with 6 tablas.');
    await page.click('#imAlt');
    assert.equal(await page.textContent('#imAlt'), 'Tap again to replace Abuela’s 6 tablas');
    assert.equal((await abuela(page)).length, 6, 'one tap replaced her tablas');
    await tapped('#imAlt', 'Playing as Abuela');
    assert.deepEqual(await abuela(page), ['New 1', 'New 2']);
    assert.deepEqual((await saved(page, 'loteria.v1')).players.map(p => p.name), ['Ana', 'Abuela']);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
  // The same offer in Spanish.
  const es = await context(PHONE, { locale: 'es-MX' });
  try {
    const page = await es.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': { ...HOME, players: [ANA.players[0], { ...HOME.players[1], name: 'Tía Lupe' }] } });
    // Its one tabla is named like one of hers, with other cards: it comes in under the next Tabla number.
    await page.goto(link('t%C3%ADa%20lupe', [['Mine 2', 7]]));
    await until(page, () => (document.querySelector('#sheet h2') || {}).textContent === 'Tablas de tía lupe');
    assert.equal(await page.textContent('#imNote'), 'Esta liga trae 1 tabla para “tía lupe”. Tía Lupe ya está en este dispositivo con 3 tablas.');
    assert.deepEqual(await page.$$eval('#imBtns button', bs => bs.map(b => b.textContent)), ['Agregar a las tablas de Tía Lupe', 'Reemplazar las 3 tablas de Tía Lupe', 'No, gracias']);
    assert.deepEqual(await english(page), [], 'English in the offer');
    await noSideways(page, 'the offer in Spanish');
    await page.click('#imAlt');
    assert.equal(await page.textContent('#imAlt'), 'Toca otra vez para reemplazar las 3 tablas de Tía Lupe');
    await page.click('#imOk');
    await until(page, () => document.getElementById('toast').textContent === 'Se le agregó 1 tabla a Tía Lupe');
    assert.deepEqual((await saved(page, 'loteria.v1')).players[1].boards.map(b => b.name), ['Mine 1', 'Mine 2', 'Mine 3', 'Tabla 4'], 'two of her tablas have one name');
    assert.deepEqual(problems, []);
  } finally { await es.close(); }
});

check('board: a link with more than six tablas brings the first six, and says so', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    const EIGHT = Array.from({ length: 8 }, (_, k) => Array.from({ length: 16 }, (_, i) => (k * 5 + i) % 54 + 1));
    await page.goto(base + 'board.html#t=Beto~' + EIGHT.map((c, k) => 'T' + (k + 1) + ':' + c.map(n => n.toString(36)).join('.')).join('~'));
    assert.equal(await page.textContent('#imNote'), 'This link carries 8 tablas for “Beto”; My tablas keeps six per person, so the first six come in.');
    assert.deepEqual(await page.$$eval('#sheet .ims .k', ks => ks.map(k => k.textContent)), ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']);
    await page.click('#imOk');
    assert.deepEqual((await saved(page, 'loteria.v1')).players.map(p => [p.name, p.boards.map(b => b.name + ':' + b.cards.join('.'))]), [['Beto', EIGHT.slice(0, 6).map((c, k) => 'T' + (k + 1) + ':' + c.join('.'))]]);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('espanol: on a first visit, English | Español on the shared-link sheet keeps the link, and on Who’s playing the name typed', async () => {
  // A phone in English, opening a link with two tablas for Mamá: Español there brings the same offer back in Spanish.
  let ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'board.html#t=Mam%C3%A1~Tabla%201:1.2.3.4.5.6.7.8.9.a.b.c.d.e.f.g~Tabla%202:h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w');
    assert.equal(await sheetTitle(page), 'Tablas from Mamá');
    assert.equal(await page.getAttribute('#shLang [lang="en"]', 'aria-pressed'), 'true');
    await page.fill('#imName', 'Abuela'); // the tablas are for whoever holds the phone
    await Promise.all([page.waitForEvent('load'), page.click('#shLang [lang="es"]')]);
    await until(page, () => (document.querySelector('#sheet h2') || {}).textContent === 'Tablas de Mamá');
    assert.equal(await page.getAttribute('html', 'lang'), 'es-MX');
    assert.equal(await page.textContent('#sheet .note'), 'Esta liga trae 2 tablas para “Mamá”.');
    assert.equal(await page.inputValue('#imName'), 'Abuela', 'the name typed was lost');
    assert.equal(await page.locator('#sheet .ims .tabla').count(), 2);
    assert.equal(await page.evaluate(() => location.hash), '', 'the link was left in the address');
    assert.equal(await saved(page, 'loteria.v1'), null, 'a player was saved before anyone chose');
    await page.click('#imOk');
    assert.deepEqual((await saved(page, 'loteria.v1')).players.map(p => [p.name, p.boards.map(b => b.name + ':' + b.cards.join('.'))]), [['Abuela', ['Tabla 1:' + run(1).join('.'), 'Tabla 2:' + run(17).join('.')]]]);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('loteria.imName')), null);
    // Set up now: a link for someone else asks without the switch, which is in Settings.
    await page.goto(base + 'board.html#t=Beto~Tabla%201:1.2.3.4.5.6.7.8.9.a.b.c.d.e.f.g');
    await until(page, () => (document.querySelector('#sheet h2') || {}).textContent === 'Tablas de Beto');
    assert.equal(await page.locator('#shLang').count(), 0);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
  // Who's playing: a name typed comes back in the new language, and nobody is saved meanwhile.
  ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'board.html');
    assert.equal(await sheetTitle(page), 'Who’s playing on this device?');
    await page.fill('#wName', 'Tía Lupe');
    await Promise.all([page.waitForEvent('load'), page.click('#shLang [lang="es"]')]);
    await until(page, () => (document.querySelector('#sheet h2') || {}).textContent === '¿Quién juega en este dispositivo?');
    assert.equal(await page.inputValue('#wName'), 'Tía Lupe');
    assert.equal(await saved(page, 'loteria.v1'), null);
    await page.click('#wMark');
    assert.deepEqual((await saved(page, 'loteria.v1')).players.map(p => p.name), ['Tía Lupe']);
    await page.reload();
    assert.ok(await page.evaluate(() => document.getElementById('sheet').hidden && sessionStorage.getItem('loteria.wName') === null));
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: a share link pasted in Settings, or the whole message it came in, is offered as a tapped link is, and on a first visit too', async () => {
  const cards = from => run(from).map(n => n.toString(36)).join('.');
  const link = base + 'board.html#t=Mom\'s%20tablas~Tabla%201:' + cards(1) + '~Tabla%202:' + cards(17);
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': ANA });
    await page.goto(base + 'board.html');
    await page.click('#setBtn');
    assert.equal(await page.textContent('#lnkAdd'), 'Add');
    await page.fill('#lnk', 'hello there');
    await page.click('#lnkAdd');
    await until(page, t => document.getElementById('toast').textContent === t, 'There’s no My tablas share link in that — paste the whole link');
    assert.equal(await sheetTitle(page), 'Settings');
    // The whole message, as Messages would paste it: words before the link and a full stop after it.
    await page.fill('#lnk', 'For game night 🎉 ' + link + '. See you there!');
    await page.click('#lnkAdd');
    assert.equal(await sheetTitle(page), 'Tablas from Mom\'s tablas');
    assert.equal(await page.locator('#sheet .ims .tabla').count(), 2);
    await page.click('#imOk');
    assert.deepEqual((await saved(page, 'loteria.v1')).players.map(p => p.name + ':' + p.boards.map(b => b.cards[0]).join(',')), ['Ana:1,17', 'Mom\'s tablas:1,17']);
    // A new device: Who's playing has a way to paste it too, as Settings can't be reached before someone is set up.
    await page.evaluate(() => localStorage.clear());
    await page.goto(base + 'board.html');
    assert.equal(await sheetTitle(page), 'Who’s playing on this device?');
    assert.equal(await page.textContent('#wPaste'), 'Got a share link? Paste it here');
    await page.click('#wPaste');
    await page.fill('#lnk', link);
    await page.press('#lnk', 'Enter');
    assert.equal(await sheetTitle(page), 'Tablas from Mom\'s tablas');
    await page.fill('#imName', 'Lupe');
    await page.click('#imOk');
    assert.deepEqual((await saved(page, 'loteria.v1')).players.map(p => p.name + ':' + p.boards.length), ['Lupe:2']);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('safari: in a Safari tab, a shared link’s offer says how to take it to El Cantor on the Home Screen, with Copy link', async () => {
  const hash = '#t=Mam%C3%A1~Tabla%201:' + run(1).map(n => n.toString(36)).join('.');
  const HINT = {
    en: 'Playing from El Cantor on your Home Screen? It keeps its own tablas — copy this link, open El Cantor there, and paste it in My tablas under ⋯.',
    es: '¿Juegas desde El Cantor en tu pantalla de inicio? Guarda sus propias tablas aparte — copia esta liga, abre El Cantor desde ahí y pégala en Mis tablas, en ⋯.'
  };
  const hint = page => page.evaluate(() => { const b = document.getElementById('imCopy'); return b ? b.closest('.card').querySelector('.note').textContent : null; });
  for (const [what, extra, data] of [['a new phone', {}, {}], ['a phone with Ana', {}, { 'loteria.v1': ANA }], ['en español', { locale: 'es-MX' }, {}]]) {
    const ctx = await context(PHONE, { userAgent: SAFARI, ...extra });
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await seed(page, data);
      await page.goto(base + 'board.html' + hash);
      assert.equal(await hint(page), HINT[extra.locale ? 'es' : 'en'], what);
      if (extra.locale) assert.deepEqual(await english(page), [], 'English in the offer');
      await page.evaluate(() => { window.__copied = null; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied = t; return Promise.resolve(); } } }); });
      await page.click('#imCopy');
      assert.equal(await page.evaluate(() => window.__copied), base + 'board.html' + hash, what + ': Copy link copied something else');
      await until(page, t => document.getElementById('toast').textContent === t, extra.locale ? 'Liga copiada' : 'Link copied');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
  // Not in the Home Screen app itself, nor on a computer.
  for (const [extra, init] of [[{ userAgent: SAFARI }, () => { Object.defineProperty(navigator, 'standalone', { value: true }); }], [{}]]) {
    const ctx = await context(PHONE, extra);
    try {
      if (init) await ctx.addInitScript(init);
      const page = await ctx.newPage();
      await page.goto(base + 'board.html' + hash);
      assert.equal(await sheetTitle(page), 'Tablas from Mamá');
      assert.equal(await hint(page), null, 'the hint shows outside a Safari tab');
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

check('board: a share link with a full stop after it, or its ~ turned to %7E, still opens; one cut short says so', async () => {
  const good = '#t=Ana~Tabla%201:' + run(1).map(n => n.toString(36)).join('.') + '~Tabla%202:' + run(17).map(n => n.toString(36)).join('.');
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': people([{ id: 'm1', name: 'Mine 1', cards: run(30, 16) }]) });
    // As chat and mail apps pass them on: the end of a sentence after it, a bracket, and every ~ as %7E.
    for (const h of [good + '.', good + ').', good.replace(/~/g, '%7E')]) {
      await page.goto(base + '__blank'); // a fresh page each time, not a change of the address's #
      await page.goto(base + 'board.html' + h);
      assert.equal(await sheetTitle(page), 'Tablas from Ana', h.slice(-12) + ': the link didn’t open');
      assert.equal(await page.locator('#sheet .edb.ims .tabla').count(), 2);
    }
    // Cut 9 characters short: it says so, and the address loses the broken link.
    await page.goto(base + '__blank');
    await page.goto(base + 'board.html' + good.slice(0, -9));
    await until(page, () => document.getElementById('toast').classList.contains('show'));
    assert.equal(await page.textContent('#toast'), 'This link didn’t come through whole — ask for it to be sent again.');
    assert.equal(await page.evaluate(() => location.hash), '');
    assert.equal(await sheetTitle(page), null, 'a sheet opened for a broken link');
    // And on a new phone, over Who's playing.
    const fresh = await ctx.newPage();
    await fresh.goto(base + '__blank'); await fresh.evaluate(() => localStorage.clear());
    await fresh.goto(base + 'board.html' + good.slice(0, -9));
    assert.equal(await sheetTitle(fresh), 'Who’s playing on this device?');
    await until(fresh, () => document.getElementById('toast').textContent.indexOf('didn’t come through whole') >= 0);
    // Make tablas' Play these in My tablas… keeps a ~ in a name, as My tablas' Share does.
    await seed(page, { 'loteria.print': { tablas: [{ id: 't1', name: 'Mía ~ la buena', cards: run(1) }], set: { doubles: true, per: 2, paper: 'letter', names: true, who: '' } } });
    await page.goto(base + 'print.html');
    await page.click('#appBtn');
    await page.fill('#apName', 'Tía ~ Lupe');
    await page.click('#apOpen');
    await until(page, () => (document.querySelector('#sheet h2') || {}).textContent === 'Tablas from Tía ~ Lupe');
    assert.equal(await page.textContent('#sheet .edb.ims .tabla .k'), 'Mía ~ la buena');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: Share’s Copy link says “Link copied” only when it copied, and leaves the link selected when it couldn’t', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': ANA });
    await page.goto(base + 'board.html');
    await page.click('#tablasBtn'); await page.click('#tbShare');
    const url = await page.inputValue('#shUrl');
    // The clipboard copies, refuses (no permission, an installed app, a page without the focus) or isn't there; the
    // browser's older copy command, tried after it, copies what's selected or refuses too.
    const copy = async (clip, old) => {
      await page.evaluate(([clip, old]) => {
        window.__copied = null;
        const writeText = clip === 'copies' ? t => { window.__copied = t; return Promise.resolve(); } : () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'));
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clip === 'none' ? undefined : { writeText } });
        document.execCommand = c => { const i = document.activeElement; if (c !== 'copy' || old === 'refuses' || !i || i.id !== 'shUrl') return false; window.__copied = i.value.slice(i.selectionStart, i.selectionEnd); return true; };
        document.getElementById('toast').textContent = '';
      }, [clip, old]);
      await page.click('#shCopy');
      await until(page, () => document.getElementById('toast').textContent !== '');
      await page.waitForTimeout(100); // a toast that's taken back
      return [await page.textContent('#toast'), await page.evaluate(() => window.__copied)];
    };
    assert.deepEqual(await copy('copies', 'copies'), ['Link copied', url]);
    assert.deepEqual(await copy('refuses', 'copies'), ['Link copied', url], 'the clipboard refused and nothing else copied it');
    assert.deepEqual(await copy('none', 'copies'), ['Link copied', url]);
    assert.deepEqual(await copy('refuses', 'refuses'), ['Select the link and copy it', null], 'it said it copied when nothing did');
    assert.deepEqual(await page.evaluate(() => { const i = document.activeElement; return [i.id, i.selectionStart, i.selectionEnd]; }), ['shUrl', 0, url.length], 'the link isn’t left selected to copy by hand');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
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

check('board: Cantaron… on a phone shows four cards to a row, named once, by their pictures, with nothing over their numbers', async () => {
  for (const width of [390, 360]) {
    const ctx = await context({ ...PHONE, viewport: { width, height: 800 } });
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await seed(page, { 'loteria.v1': ANA });
      await page.goto(base + 'board.html');
      await page.click('#callBtn');
      const tops = await page.$$eval('#pk .pk', els => els.slice(0, 5).map(el => Math.round(el.getBoundingClientRect().top)));
      assert.deepEqual(tops.slice(1, 4), [tops[0], tops[0], tops[0]], width + ': fewer than four cards to a row');
      assert.notEqual(tops[4], tops[0], width + ': more than four cards to a row');
      assert.equal(await page.locator('#pk .pk .n, #pk .pk .num').count(), 0, width + ': a card is named again under its picture, or a badge covers its number');
      assert.equal(await page.getAttribute('#pk .pk[data-n="23"]', 'aria-label'), 'La Luna');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('search: Enter picks El Sol for “sol” and La Rana for “rana”, in Cantaron…, the checker and Make tablas', async () => {
  // El Soldado holds "sol" and La Araña "rana", so each search finds two cards, the one it names first.
  const ctx = await context(DESKTOP);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': ANA });
    await page.goto(base + 'board.html');
    await page.click('#callBtn');
    await page.fill('#pkq', 'sol');
    assert.deepEqual(await page.$$eval('#pk .pk', ps => ps.map(p => p.getAttribute('aria-label'))), ['El Sol', 'El Soldado']);
    await page.press('#pkq', 'Enter');
    await page.fill('#pkq', 'rana'); await page.press('#pkq', 'Enter');
    assert.deepEqual((await saved(page, 'loteria.game')).called, [46, 54], 'Cantaron…');
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 54, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false, check: true } } });
    await page.goto(base + 'cantor.html');
    await page.click('#lotBtn');
    await page.fill('#vfQ', 'el sol'); await page.press('#vfQ', 'Enter');
    await page.fill('#vfQ', 'rana'); await page.press('#vfQ', 'Enter');
    assert.deepEqual(await page.$$eval('#vfChips .chip', bs => bs.map(b => b.textContent.split(' · ')[0])), ['El Sol', 'La Rana'], 'the checker');
    await seed(page, { 'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: Array(16).fill(0) }] } });
    await page.goto(base + 'print.html');
    await page.fill('#q', 'rana');
    assert.deepEqual(await page.$$eval('#dg .dk:not([hidden])', ds => ds.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(d => d.getAttribute('aria-label'))), ['La Rana', 'La Araña']);
    await page.press('#q', 'Enter');
    await page.fill('#q', 'sol'); await page.press('#q', 'Enter');
    assert.deepEqual((await saved(page, 'loteria.print')).tablas[0].cards.slice(0, 3), [54, 46, 0], 'Make tablas');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
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
    await page.click('#callBtn'); // the ¡Lotería! closed Cantaron… on a phone, to show the winning tabla
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

check('board: back from the browser’s history, a window keeps the cards another one called while it changed a tabla', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': ANA, 'loteria.game': { called: [1], announced: {} } });
    await page.goto(base + 'board.html');
    await until(page, () => document.querySelectorAll('#boards .cell.marked').length === 1);
    // Meanwhile the other window renamed Mine 2 and called El Diablito and La Dama. Saved from this page, so it hears
    // nothing, the way a page in the back/forward cache doesn't.
    await page.evaluate(() => {
      const o = JSON.parse(localStorage.getItem('loteria.v1')); o.players[0].boards[1].name = 'Mía'; localStorage.setItem('loteria.v1', JSON.stringify(o));
      localStorage.setItem('loteria.game', JSON.stringify({ called: [1, 2, 3], announced: {} }));
      dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    assert.deepEqual((await saved(page, 'loteria.game')).called, [1, 2, 3], 'it put its own older round back over the other window’s calls');
    await until(page, () => document.querySelectorAll('#boards .cell.marked').length === 3);
    await until(page, () => document.querySelectorAll('#boards .tabla .lbl .k')[1].textContent.indexOf('Mía') === 0);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: on a phone the Tablas sheet shows two tablas to a row, under + Add a tabla and + A printed tabla', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': people([1, 2, 3, 4].map(i => ({ id: 'm' + i, name: 'Mine ' + i, cards: run(i) }))) });
    await page.goto(base + 'board.html');
    await page.click('#tablasBtn');
    const eds = await page.$$eval('#edb > div', els => els.map(el => Math.round(el.getBoundingClientRect().top)));
    assert.deepEqual([eds[1], eds[3]], [eds[0], eds[2]], 'the tablas aren’t two to a row');
    for (const b of ['#tbAdd', '#tbPrinted']) {
      const r = await rect(page, b);
      assert.ok(r.bottom < eds[0] && r.bottom <= 844, b + ' isn’t above the tablas, on the first screen');
    }
    await page.click('#tbAdd');
    assert.equal((await saved(page, 'loteria.v1')).players[0].boards.length, 5);
    await until(page, () => { const r = document.querySelector('#edb > div:last-child').getBoundingClientRect(); return r.bottom <= document.querySelector('#sheet .bd').getBoundingClientRect().bottom + 1; }, null, 3000);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: the Tablas sheet stays where it was after a square is changed', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': people([1, 2, 3, 4, 5, 6].map(k => ({ id: 'm' + k, name: 'Mine ' + k, cards: run(k * 3) }))) });
    await page.goto(base + 'board.html');
    await page.click('#tablasBtn');
    const scroll = () => page.evaluate(() => document.querySelector('#sheet .bd').scrollTop);
    await page.evaluate(() => { const b = document.querySelector('#sheet .bd'); b.scrollTop = b.scrollHeight; });
    const square = page.locator('#edb > div').nth(4).locator('.eg .cell').nth(5); // two to a row on a phone: the third row
    await square.scrollIntoViewIfNeeded();
    const before = await scroll();
    assert.ok(before > 500, 'scrolled down to the fifth tabla');
    await square.click();
    await page.fill('#pkq', '54'); await page.press('#pkq', 'Enter');
    assert.equal((await saved(page, 'loteria.v1')).players[0].boards[4].cards[5], 54);
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
    assert.equal(await page.textContent('#edb .dups'), 'Twice: El Paraguas, La Luna');
    assert.match(await page.textContent('#sheet .bd > .note'), /^Tap any square to change its card\. Doubles are fine \(family rule\)/, 'the rule is named as Make tablas names it');
    // A double is allowed, so it's said in the plain grey of the notes, not in red as if it were a mistake.
    assert.equal(await page.$eval('#edb .dups', e => getComputedStyle(e).color), 'rgb(106, 90, 76)', 'the doubles line isn’t in --ink2');
    assert.equal(await page.locator('#edb .dups .warn').count(), 0, 'a double is marked as a warning');
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
    assert.equal(await page.textContent('#edb .dups'), 'Twice: El Paraguas · 3×: La Luna');
    assert.equal(await page.textContent('#edb .dups .warn'), '3×: La Luna', 'only three of a card is said in red');
    assert.deepEqual(await page.$$eval('#edb .dups, #edb .dups .warn', es => es.map(e => getComputedStyle(e).color)), ['rgb(106, 90, 76)', 'rgb(183, 51, 47)'], 'Twice in --ink2, 3× in --red');
    const cards = async () => (await saved(page, 'loteria.v1')).players[0].boards[0].cards;
    const put = async (square, n) => { await page.locator('#edb .eg .cell').nth(square).click(); await page.fill('#pkq', String(n)); await page.press('#pkq', 'Enter'); };
    await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
    await put(1, 23); // La Luna for one of its own squares: nothing to refuse
    assert.equal(await sheetTitle(page), null);
    assert.equal(await page.isVisible('#edb .dups'), true, 'the Tablas sheet came back');
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
        const cdp = kind === PHONE ? await ctx.newCDPSession(page) : null;
        // Holds a shape until the toast says what it did, then lets go.
        async function hold(name, says) {
          await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
          const box = await shape(name).boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
          if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); else { await page.mouse.move(x, y); await page.mouse.down(); }
          await until(page, s => document.getElementById('toast').textContent === s, says);
          if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
        }
        const tap = name => cdp ? shape(name).tap() : shape(name).click();
        const game = async () => (await saved(page, key)).patterns;
        const lit = () => page.$$eval('#pats .pat.on b', bs => bs.map(b => b.textContent));
        await hold('Centro', 'Centro added');
        assert.deepEqual(await game(), ['esquinas', 'centro'], what + ': letting go left only the held shape');
        assert.equal(await page.textContent('#patBtn'), 'Esquinas · Centro ▾', what);
        await tap('La Ele'); // a quick tap still picks one shape
        assert.deepEqual(await game(), ['ele'], what + ': a tap after a hold');
        // Clásico already wins with every shape but Siete Loco, so holding one keeps Clásico; Siete Loco goes on top.
        await tap('Clásico');
        await hold('Centro', 'Clásico already wins with Centro');
        assert.deepEqual(await game(), ['linea', 'esquinas', 'cuadro'], what + ': holding Centro on Clásico');
        assert.deepEqual(await lit(), ['Clásico'], what);
        await hold('Siete Loco', 'Siete Loco added');
        assert.deepEqual(await game(), ['linea', 'esquinas', 'cuadro', 'siete'], what + ': holding Siete Loco on Clásico');
        assert.deepEqual(await lit(), ['Clásico', 'Siete Loco'], what);
        assert.equal(await page.textContent('#patBtn'), 'Clásico + Siete Loco ▾', what);
        await hold('Siete Loco', 'Siete Loco is already in the game');
        await hold('Línea', 'Clásico already wins with Línea');
        assert.deepEqual(await game(), ['linea', 'esquinas', 'cuadro', 'siete'], what + ': holding a shape already in the game');
        assert.deepEqual(problems, [], what);
      } finally { await ctx.close(); }
    }
  }
});

check('board: a long game name in the header doesn’t paint over the Lotería title, or over whose tablas they are', async () => {
  // With two people on the device the title is the name of the one playing (Mateo), at every width, ☁ or not. A long
  // name gives way to the game's.
  const two = name => ({ ...ANA, players: [ANA.players[0], { id: 'mt', name, boards: [{ id: 'm9', name: 'Tabla 1', cards: run(30) }] }], current: 'mt' });
  const TWO = two('Mateo'), LONG = two('Abuela Lupita');
  for (const [w, pats] of [[360, ['equis', 'marco']], [390, ['equis', 'marco']], [360, ['llena']], [390, ['linea', 'esquinas', 'cuadro']], [360, ['linea', 'esquinas', 'cuadro']], [360, ['linea', 'esquinas', 'cuadro', 'siete']]]) {
    for (const [who, cloud] of [[ANA, false], [ANA, true], [TWO, false], [TWO, true], [LONG, false], [LONG, true]]) {
      const ctx = await context({ ...PHONE, viewport: { width: w, height: 780 } });
      try {
        const page = await ctx.newPage(), problems = watch(page), two = who !== ANA, what = `${w}px, ${pats.join('+')}, ${two ? 'two people, ' + who.players[1].name : 'one person'}${cloud ? ', ☁' : ''}`;
        await seed(page, { 'loteria.v1': { ...who, patterns: pats } });
        await page.goto(base + 'board.html');
        await page.evaluate(() => document.fonts.ready);
        if (cloud) await page.evaluate(() => { document.getElementById('syncBtn').hidden = false; }); // as when saving to Google Drive
        const r = await page.evaluate(() => {
          const pl = document.getElementById('plBtn'), t = pl.hidden ? document.querySelector('.top h1 .t') : pl, cs = getComputedStyle(t), box = t.getBoundingClientRect();
          const name = pl.querySelector('span'), items = [...document.querySelectorAll('.top > *')].filter(e => !e.hidden).map(e => e.getBoundingClientRect());
          return {
            right: box.right, width: box.width, shown: cs.display !== 'none', chip: document.getElementById('patBtn').getBoundingClientRect().left, clips: cs.overflow === 'hidden' || !!name, cut: (name || t).scrollWidth > (name || t).clientWidth,
            text: t.textContent, height: document.querySelector('.top').getBoundingClientRect().height, icons: [...document.querySelectorAll('.top .chip.ic:not([hidden])')].map(e => e.getBoundingClientRect().width),
            overlap: items.some((b, i) => i && b.left < items[i - 1].right - 0.5), sideways: document.documentElement.scrollWidth > innerWidth,
            game: (s => { const c = s.cloneNode(true); c.style.cssText = 'position:absolute;visibility:hidden'; s.parentNode.appendChild(c); const full = c.getBoundingClientRect().width; c.remove(); return s.getBoundingClientRect().width >= full - 0.01; })(document.querySelector('#patBtn span'))
          };
        });
        assert.ok(!r.shown || (r.right <= r.chip && r.clips), `${what}: the title runs under the game chip (${JSON.stringify(r)})`);
        assert.ok(!r.shown || r.width >= 35, `${what}: the title is cut to a sliver instead of “Lo…” or nothing (${JSON.stringify(r)})`);
        if (pats.length === 3 && !cloud && !two) assert.ok(!r.cut, what + ': Clásico leaves room for the whole title');
        if (two) {
          assert.ok(r.shown && r.text === who.players[1].name && r.width >= 55, `${what}: whose tablas these are doesn't show (${JSON.stringify(r)})`);
          if (pats.length === 3 && who === TWO) assert.ok(!r.cut, `${what}: Clásico leaves room for all of “Mateo” (${JSON.stringify(r)})`);
          if (pats.length === 3) assert.ok(r.game, `${what}: Clásico is cut short for the name (${JSON.stringify(r)})`);
        }
        assert.ok(!r.overlap && !r.sideways, `${what}: the header's buttons run into each other (${JSON.stringify(r)})`);
        assert.equal(r.height, 48, what + ': the header grew');
        if (two) assert.ok(r.icons.every(x => x === 34), `${what}: a round button is squeezed (${JSON.stringify(r)})`);
        assert.deepEqual(problems, []);
      } finally { await ctx.close(); }
    }
  }
});

check('board: with two people on a phone, the header says whose tablas are up, and a tap on it switches people', async () => {
  for (const lang of ['en', 'es']) {
    const ctx = await context({ ...PHONE, viewport: { width: 360, height: 740 } });
    try {
      const page = await ctx.newPage(), problems = watch(page), es = lang === 'es';
      // Lupe has Mine 1; Mateo has two tablas, and the cards called make a línea on his first.
      const TWO = { ...people([{ id: 'l1', name: 'Mine 1', cards: run(1) }]), players: [{ id: 'lp', name: 'Lupe', boards: [{ id: 'l1', name: 'Mine 1', cards: run(1) }] }, { id: 'mt', name: 'Mateo', boards: [{ id: 'm1', name: 'Tabla 1', cards: run(30) }, { id: 'm2', name: 'Tabla 2', cards: run(17) }] }], current: 'lp' };
      await seed(page, { 'loteria.v1': TWO, 'loteria.lang': lang, 'loteria.game': { called: [30, 31, 32, 33], announced: {} } });
      await page.goto(base + 'board.html');
      const head = () => page.evaluate(() => { const b = document.getElementById('plBtn'), r = b.getBoundingClientRect(); return { name: b.hidden ? null : b.textContent, seen: !b.hidden && r.width > 0 && r.top >= 0, title: getComputedStyle(document.querySelector('.top h1 .t')).display !== 'none', tablas: [...document.querySelectorAll('#boards .tabla')].map(t => t.dataset.id) }; });
      assert.deepEqual(await head(), { name: 'Lupe', seen: true, title: false, tablas: ['l1'] });
      await page.tap('#plBtn');
      assert.equal(await sheetTitle(page), es ? '¿Quién juega?' : 'Who’s playing?');
      assert.deepEqual(await page.$$eval('#wplist .chip', cs => cs.map(c => c.textContent + (c.classList.contains('on') ? ' ✓' : ''))), ['Lupe ✓', 'Mateo']);
      await page.locator('#wplist .chip', { hasText: 'Mateo' }).tap();
      assert.ok(await page.evaluate(() => document.getElementById('sheet').hidden), 'picking a person left the sheet open');
      assert.deepEqual(await head(), { name: 'Mateo', seen: true, title: false, tablas: ['m1', 'm2'] }, 'the header or the tablas didn’t follow');
      assert.equal((await saved(page, 'loteria.v1')).current, 'mt');
      assert.equal(await page.locator('#boards .tabla.win').count(), 1, 'Mateo’s línea isn’t outlined');
      assert.ok(await page.evaluate(() => document.getElementById('winbox').hidden), 'switching people cheered a win nobody called a card for');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'plBtn');
      // An enlarged tabla goes back to all of them on a switch.
      await page.locator('#boards .tabla[data-id="m2"] .z').tap();
      await page.tap('#plBtn'); await page.locator('#wplist .chip', { hasText: 'Lupe' }).tap();
      await page.tap('#plBtn'); await page.locator('#wplist .chip', { hasText: 'Mateo' }).tap();
      assert.deepEqual((await head()).tablas, ['m1', 'm2']);
      // Done leaves things as they were; Settings' list moves the header too.
      await page.tap('#plBtn'); await page.tap('#wpx');
      assert.equal((await head()).name, 'Mateo');
      await page.tap('#setBtn'); await page.locator('#plist .chip', { hasText: 'Lupe' }).tap(); await page.tap('#stx');
      assert.equal((await head()).name, 'Lupe');
      // Back to one person, the header is Lotería again.
      await page.tap('#tablasBtn'); await page.tap('#tbDel'); await page.tap('#tbDel');
      assert.deepEqual(await head(), { name: null, seen: false, title: true, tablas: ['m1', 'm2'] });
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('board: “not on your tablas” shows whole on a line of its own under the card called, at every width', async () => {
  // El Violoncello, the longest name, isn't on Mine 1; La Dama is.
  const ONE = people([{ id: 'm1', name: 'Mine 1', cards: run(1) }]);
  for (const [w, h] of [[360, 740], [390, 844], [1280, 800]]) for (const lang of ['en', 'es']) {
    const ctx = await context(w > 500 ? { viewport: { width: w, height: h } } : { ...PHONE, viewport: { width: w, height: h } });
    try {
      const page = await ctx.newPage(), problems = watch(page), what = `${w}px, ${lang}`;
      const strip = () => page.evaluate(() => {
        const q = s => document.querySelector(s), off = q('#last .off'), n = q('#last .n'), v = q('#last .v'), last = q('#last').getBoundingClientRect();
        const box = off && off.getBoundingClientRect();
        return {
          off: off && { text: off.textContent, whole: off.scrollWidth <= off.clientWidth && box.height > 0 && box.top >= n.getBoundingClientRect().bottom - 1 && box.bottom <= last.bottom },
          name: n.textContent, oneLine: n.getBoundingClientRect().height < 25, nameWhole: n.scrollWidth <= n.clientWidth, verse: getComputedStyle(v).display !== 'none', height: Math.round(last.height)
        };
      });
      await seed(page, { 'loteria.v1': ONE, 'loteria.lang': lang, 'loteria.game': { called: [3], announced: {} } });
      await page.goto(base + 'board.html');
      await page.evaluate(() => document.fonts.ready);
      const on = await strip();
      assert.equal(on.off, null, what + ': La Dama is on Mine 1');
      await seed(page, { 'loteria.v1': ONE, 'loteria.lang': lang, 'loteria.game': { called: [3, 18], announced: {} } });
      await page.goto(base + 'board.html');
      await page.evaluate(() => document.fonts.ready);
      const s = await strip();
      assert.ok(s.off, what + ': nothing says El Violoncello isn’t on the tablas');
      assert.equal(s.off.text, lang === 'en' ? 'not on your tablas' : 'no está en tus tablas');
      assert.ok(s.off.whole, `${what}: “${s.off.text}” is cut off or out of the strip (${JSON.stringify(s)})`);
      assert.equal(s.name, '18El Violoncello');
      assert.ok(s.oneLine && s.nameWhole, `${what}: El Violoncello's name doesn't fit on one line (${JSON.stringify(s)})`);
      assert.equal(s.verse, w > 520, what + (w > 520 ? ': the verse went' : ': the verse shows on a phone'));
      assert.equal(s.height, on.height, what + ': the strip changed height for a card that isn’t on the tablas');
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

// Safari on an iPhone, and Chrome on one (CriOS), as their user agents read in iOS 18.
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1';
check('safari: in a Safari tab, My tablas and Make tablas say how to keep the tablas, until it’s dismissed, and every page asks to keep its saves', async () => {
  const LINE = {
    en: 'Safari clears what a website saves after a week without a visit. Add El Cantor to your Home Screen (Share → Add to Home Screen) to keep these tablas.',
    es: 'Safari borra lo que guarda un sitio web después de una semana sin visitarlo. Agrega El Cantor a tu pantalla de inicio (Compartir → Agregar a Inicio) para no perder estas tablas.',
    drive: 'Safari clears what a website saves after a week without a visit. Add El Cantor to your Home Screen (Share → Add to Home Screen), or save to Google Drive, to keep these tablas.'
  };
  const line = page => page.evaluate(() => { const e = document.getElementById('keepNote'); return e.checkVisibility() ? e.querySelector('span').textContent : null; });
  for (const lang of ['en', 'es']) {
    const ctx = await context(PHONE, { userAgent: SAFARI });
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await seed(page, { 'loteria.v1': ANA, 'loteria.lang': lang });
      await page.goto(base + 'board.html');
      assert.equal(await line(page), LINE[lang], lang + ': My tablas in a Safari tab');
      if (lang === 'es') assert.deepEqual(await english(page), [], 'English in the line');
      const bw = () => page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('boards')).getPropertyValue('--bw')));
      const before = await bw();
      await page.goto(base + 'print.html');
      assert.equal(await line(page), LINE[lang], lang + ': Make tablas in a Safari tab');
      if (lang === 'en') {
        await page.goto(base + 'board.html');
        await page.click('#keepNote button');
        assert.equal(await line(page), null, 'the line stayed after ×');
        assert.ok(await bw() > before, 'the tablas didn’t take the room the line left');
        await noSideways(page, 'My tablas');
        await page.reload();
        assert.equal(await line(page), null, 'the line came back after it was dismissed');
        await page.goto(base + 'print.html');
        assert.equal(await line(page), null, 'Make tablas has the line after My tablas’ was dismissed');
      }
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
  // Not in the Home Screen app, another browser on an iPhone, or a computer.
  for (const [what, extra, init] of [['the Home Screen app', { userAgent: SAFARI }, () => { Object.defineProperty(navigator, 'standalone', { value: true }); }], ['Chrome on an iPhone', { userAgent: CHROME_IOS }], ['a computer', {}]]) {
    const ctx = await context(PHONE, extra);
    try {
      if (init) await ctx.addInitScript(init);
      const page = await ctx.newPage();
      await ctx.addInitScript(() => { const s = navigator.storage; if (!s) return; s.persisted = () => Promise.resolve(false); s.persist = () => { window.__persist = (window.__persist || 0) + 1; return Promise.resolve(true); }; });
      await seed(page, { 'loteria.v1': ANA });
      for (const p of ['board.html', 'print.html', 'cantor.html', '']) {
        await page.goto(base + p);
        if (/board|print/.test(p)) assert.equal(await line(page), null, 'the line shows in ' + what + ' on ' + p);
        await until(page, () => window.__persist === 1); // and each page asks the browser to keep what it saves
      }
    } finally { await ctx.close(); }
  }
  // With Google Drive saving on there's no line; with it off, the line names Drive too.
  const A = await driveDevice(fakeGoogle(), { 'loteria.v1': ANA }, { userAgent: SAFARI });
  try {
    await A.page.goto(base + 'board.html'); await synced(A.page);
    assert.equal(await line(A.page), null, 'the line shows with Drive saving on');
    await A.page.click('#setBtn');
    await A.page.click('#syncCard [data-a="off"]'); await A.page.click('#syncCard [data-a="off"]');
    await A.page.click('#stx');
    assert.equal(await line(A.page), LINE.drive);
    assert.deepEqual(A.problems, []);
  } finally { await A.ctx.close(); }
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
check('safe areas: on a phone turned sideways, no page puts a button in the notch or the rounded corners', async () => {
  // An iPhone 15 on its side: 59 px of notch and rounded corner at each side, and the home bar along the bottom.
  const W = 852, IN = 59, ctx = await context({ ...PHONE, viewport: { width: W, height: 393 } });
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await (await ctx.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets: { left: IN, right: IN, top: 0, bottom: 21 } });
    // Each button, link and box on the screen and not covered, that reaches into either side's inset.
    const inNotch = what => page.evaluate(([W, IN]) => [...document.querySelectorAll('button, a, input, [role=button]')].filter(el => {
      const r = el.getBoundingClientRect(); if (!r.width || r.bottom <= 0 || r.top >= innerHeight) return false;
      const h = document.elementFromPoint(r.left + r.width / 2, Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
      return !!h && (h === el || el.contains(h)) && (r.left < IN - 0.5 || r.right > W - IN + 0.5);
    }).map(el => (el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 16)) + ' ' + Math.round(el.getBoundingClientRect().left) + '–' + Math.round(el.getBoundingClientRect().right)), [W, IN]).then(out => assert.deepEqual(out, [], what + ': in the notch or a corner'));
    await seed(page, {
      'loteria.cantor': { order: run(1, 54), pos: 6, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false, awake: false, check: false } },
      'loteria.v1': ANA, 'loteria.game': { called: [1, 2, 3], announced: {} },
      'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: run(1) }], set: { doubles: true, per: 2, paper: 'letter', names: true, who: '' } }
    });
    await page.goto(base); await inNotch('the home screen');
    await page.goto(base + 'cantor.html'); await inNotch('El Cantor');
    await page.click('#setBtn'); await inNotch('El Cantor’s Settings'); await page.click('#stx');
    await page.click('#lotBtn'); await inNotch('El Cantor’s ¡Lotería! box');
    await page.goto(base + 'board.html'); await inNotch('My tablas');
    await page.click('#callBtn'); await inNotch('Cantaron…');
    await page.goto(base + 'print.html'); await inNotch('Make tablas');
    await page.click('#printBtn'); await inNotch('Make tablas’ Print…');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

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

check('print: on a phone a tapped card goes to the tabla in view, and on past a full one', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    const full = run(1), part = (n, from) => run(from, n).concat(Array(16 - n).fill(0));
    const tablas = list => ({ 'loteria.print': { tablas: list.map((cards, i) => ({ id: 't' + (i + 1), name: 'Tabla ' + (i + 1), cards })), set: { doubles: true, per: 2, paper: 'letter', names: true, who: '' } } });
    const cards = async i => (await saved(page, 'loteria.print')).tablas[i].cards;
    // Tabla 1 full and the one being made: the card goes on to Tabla 2, with no “Tabla 1 is full”.
    await seed(page, tablas([full, part(2, 30)]));
    await page.goto(base + 'print.html');
    await page.click('.tb[data-t="t1"] .cnt'); // Tabla 1 is the one being made
    assert.match(await page.textContent('#dnote'), /Tabla 2.*square 3/, 'the deck doesn’t say a tap goes to Tabla 2: ' + await page.textContent('#dnote'));
    await page.locator('#dg .dk[data-n="40"]').tap();
    assert.deepEqual((await cards(1)).slice(0, 3), [30, 31, 40], 'the card didn’t go on to Tabla 2');
    assert.equal(await page.evaluate(() => document.getElementById('toast').classList.contains('show')), false, 'a toast said Tabla 1 is full');
    // Tabla 1 has a square to fill, but Tabla 3 is the one on the screen: the card goes on Tabla 3.
    await seed(page, tablas([part(15, 1), run(17), part(2, 30)]));
    await page.goto(base + 'print.html');
    assert.match(await page.textContent('#dnote'), /Tabla 1.*square 16/);
    await page.evaluate(() => document.querySelector('.tb[data-t="t3"]').scrollIntoView({ block: 'end' }));
    await until(page, () => /Tabla 3/.test(document.getElementById('dnote').textContent), null, 3000);
    await page.locator('#dg .dk[data-n="40"]').tap();
    assert.deepEqual((await cards(2)).slice(0, 3), [30, 31, 40], 'the card didn’t go on Tabla 3, the one on the screen');
    assert.equal((await cards(0))[15], 0, 'the card went on Tabla 1, off the screen');
    // Opened again with Tabla 1 and 2 full, a tap fills Tabla 3, the first with a square to fill, and brings it into
    // view: on a phone it opens below Tabla 1 and 2.
    await seed(page, tablas([full, run(17), part(2, 30)]));
    await page.goto(base + 'print.html');
    const shown = () => page.evaluate(() => { const p = document.getElementById('tablas').getBoundingClientRect(), r = document.querySelector('.tb[data-t="t3"]').getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, p.bottom) - Math.max(r.top, p.top)) / r.height; });
    assert.ok(await shown() < 0.5, 'Tabla 3 is in view as the page opens, so this proves nothing');
    await page.locator('#dg .dk[data-n="40"]').tap();
    assert.equal((await cards(2))[2], 40);
    await until(page, () => { const p = document.getElementById('tablas').getBoundingClientRect(), r = document.querySelector('.tb[data-t="t3"]').getBoundingClientRect(); return r.top >= p.top - 1 && r.bottom <= p.bottom + 1; }, null, 3000).catch(async () => assert.fail(`the card went on Tabla 3 out of view: ${(await shown()).toFixed(2)} of it shows`));
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('print: Play these sends six full tablas at most, picked with Which tablas', async () => {
  // Eight full tablas, Tabla 1 to 8, and a ninth nine cards in.
  const EIGHT = Array.from({ length: 8 }, (_, k) => ({ id: 't' + (k + 1), name: 'Tabla ' + (k + 1), cards: Array.from({ length: 16 }, (_, i) => (k * 5 + i) % 54 + 1) }));
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.print': { tablas: EIGHT.concat([{ id: 't9', name: 'Tabla 9', cards: run(1, 9).concat([0, 0, 0, 0, 0, 0, 0]) }]), set: { doubles: true, per: 2, paper: 'letter', names: true, who: '' } } });
    await page.goto(base + 'print.html');
    await page.click('#appBtn');
    const chips = () => page.$$eval('#achips .chip', bs => bs.map(b => b.textContent));
    // The tablas a link carries, from Copy link.
    const carried = async () => {
      await page.evaluate(() => { window.__copied = null; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied = t; return Promise.resolve(); } } }); });
      await page.click('#apCopy');
      const url = await page.evaluate(() => window.__copied);
      return url.split('#t=')[1].split('~').slice(1).map(t => decodeURIComponent(t.split(':')[0]));
    };
    assert.deepEqual(await chips(), ['✓ Tabla 1', '✓ Tabla 2', '✓ Tabla 3', '✓ Tabla 4', '✓ Tabla 5', '✓ Tabla 6', 'Tabla 7', 'Tabla 8'], 'the full tablas, the first six on');
    assert.equal(await page.textContent('#apNote'), 'Makes a link that opens My tablas with these 6 tablas for whoever you name. Open it here, or send it to the phone or iPad that will play. 1 tabla isn’t full yet and stays behind. My tablas keeps six per person, so pick up to six.');
    assert.deepEqual(await carried(), ['Tabla 1', 'Tabla 2', 'Tabla 3', 'Tabla 4', 'Tabla 5', 'Tabla 6']);
    await page.locator('#achips .chip', { hasText: 'Tabla 7' }).click(); // a seventh
    await until(page, () => document.getElementById('toast').textContent === 'Six tablas per person is the most My tablas holds');
    assert.equal((await chips())[6], 'Tabla 7');
    for (const t of ['Tabla 1', 'Tabla 2', 'Tabla 3']) await page.locator('#achips .chip', { hasText: t }).click();
    assert.match(await page.textContent('#apNote'), /^Makes a link that opens My tablas with these 3 tablas /);
    for (const t of ['Tabla 7', 'Tabla 8']) await page.locator('#achips .chip', { hasText: t }).click();
    assert.match(await page.textContent('#apNote'), /^Makes a link that opens My tablas with these 5 tablas /);
    assert.deepEqual(await carried(), ['Tabla 4', 'Tabla 5', 'Tabla 6', 'Tabla 7', 'Tabla 8']);
    // None picked: nothing to send.
    await page.click('#apx'); await page.click('#appBtn'); // the choice stays while the page is open
    assert.deepEqual(await chips(), ['Tabla 1', 'Tabla 2', 'Tabla 3', '✓ Tabla 4', '✓ Tabla 5', '✓ Tabla 6', '✓ Tabla 7', '✓ Tabla 8']);
    for (const t of ['Tabla 4', 'Tabla 5', 'Tabla 6', 'Tabla 7', 'Tabla 8']) await page.locator('#achips .chip', { hasText: t }).click();
    assert.match(await page.textContent('#apNote'), /^Pick at least one tabla\. /);
    assert.ok(await page.isDisabled('#apOpen') && await page.isDisabled('#apCopy'));
    await page.locator('#achips .chip', { hasText: 'Tabla 8' }).click();
    // And My tablas offers just the one.
    await Promise.all([page.waitForURL(/board\.html#t=Family~Tabla%208:/), page.click('#apOpen')]);
    await until(page, () => (document.querySelector('#sheet h2') || {}).textContent === 'Tablas from Family');
    assert.deepEqual(await page.$$eval('#sheet .ims .k', ks => ks.map(k => k.textContent)), ['Tabla 8']);
    await noSideways(page, 'My tablas');
    // Taken, it is Family's Tabla 8, square for square as Make tablas had it.
    await page.click('#imOk');
    assert.deepEqual((await saved(page, 'loteria.v1')).players.map(p => [p.name, p.boards.map(b => [b.name, b.cards])]), [['Family', [['Tabla 8', EIGHT[7].cards]]]]);
    await until(page, () => document.querySelectorAll('#boards .cell img').length === 16);
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

check('print: Print… says how many squares of a tabla print blank, and has nothing to cut for a lone tabla', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: run(1, 15).concat([0]) }, { id: 't2', name: 'Tabla 2', cards: run(20, 9).concat([0, 0, 0, 0, 0, 0, 0]) }], set: { doubles: true, per: 2, paper: 'letter', names: true, who: '' } } });
    await page.goto(base + 'print.html');
    await page.click('#printBtn');
    assert.equal(await page.textContent('#pwarn'), 'Not full yet, empty squares print blank: Tabla 1 (1\u00a0empty), Tabla 2 (7\u00a0empty)');
    assert.equal(await page.textContent('#psum'), '2 tablas on 1 page — cut along the gap between them.');
    await page.locator('#tchips .chip', { hasText: 'Tabla 1' }).click();
    assert.equal(await page.textContent('#psum'), '1 tabla on 1 page.');
    await page.click('#pers .per[data-v="4"]');
    assert.equal(await page.textContent('#psum'), '1 tabla on 1 page.');
    assert.equal(await page.textContent('#pwarn'), 'Not full yet, its empty squares print blank: Tabla 2 (7\u00a0empty)');
    await page.locator('#tchips .chip', { hasText: 'Tabla 1' }).click();
    assert.equal(await page.textContent('#psum'), '2 tablas on 1 page — cut along the gap between them.');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
  const es = await context(PHONE, { locale: 'es-MX' });
  try {
    const page = await es.newPage(), problems = watch(page);
    await seed(page, { 'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: run(1, 15).concat([0]) }], set: { doubles: true, per: 2, paper: 'letter', names: true, who: '' } } });
    await page.goto(base + 'print.html');
    await page.click('#printBtn');
    assert.deepEqual([await page.textContent('#psum'), await page.textContent('#pwarn')], ['1 tabla en 1 hoja.', 'Todavía no está llena; sus casillas vacías salen en blanco: Tabla 1 (falta\u00a01)']);
    assert.deepEqual(problems, []);
  } finally { await es.close(); }
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

check('keyboard: Enter (a phone’s Go) does the main thing in the name and number boxes', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    const wins = async () => (await saved(page, 'loteria.cantor')).wins.map(w => w.round + ' ' + w.who);
    const cantor = extra => ({ order: run(1, 54), pos: 6, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false, awake: false, check: false }, ...extra });
    // El Cantor, taking their word: Enter is Shuffle for round 2.
    await seed(page, { 'loteria.cantor': cantor() });
    await page.goto(base + 'cantor.html');
    await page.click('#lotBtn');
    await page.fill('#clWho', 'Abuela');
    await page.press('#clWho', 'Enter');
    assert.deepEqual(await wins(), ['1 Abuela'], 'Enter in Who won? didn’t count the win');
    assert.equal(await sheetTitle(page), 'Round 2 — what are we playing?');
    // The checker: Enter is ¡Buena! New round, but not on a Not yet, where it only puts the keyboard away.
    await seed(page, { 'loteria.cantor': cantor({ round: 3, settings: { speak: false, sound: false, awake: false, check: true } }) });
    await page.goto(base + 'cantor.html');
    await page.click('#lotBtn');
    await page.locator('#vfPick .pk', { has: page.locator('.n', { hasText: /^La Rana$/ }) }).click();
    await page.fill('#vfWho', 'Tío Beto');
    await page.press('#vfWho', 'Enter');
    assert.equal(await page.textContent('#vfV h3'), 'Not yet');
    assert.deepEqual(await wins(), [], 'Enter counted a tabla that isn’t good');
    assert.notEqual(await page.evaluate(() => document.activeElement.id), 'vfWho', 'Enter left the keyboard up');
    await page.click('#vfChips .chip');
    await page.press('#vfWho', 'Enter');
    assert.deepEqual(await wins(), ['3 Tío Beto']);
    assert.ok(await page.isVisible('#celOk'), 'no celebration');
    assert.equal(await page.textContent('#winbox .winc p'), 'Tío Beto wins round 3 after 6 cards.');
    // My tablas: Add a person, and the No. box of a printed tabla.
    await seed(page, { 'loteria.v1': ANA });
    await page.goto(base + 'board.html');
    await page.click('#setBtn');
    await page.fill('#pnew', 'Tía Rosa');
    await page.press('#pnew', 'Enter');
    assert.deepEqual((await saved(page, 'loteria.v1')).players.map(p => p.name), ['Ana', 'Tía Rosa'], 'Enter in Add a person');
    await page.click('#stx');
    await page.click('#tablasBtn'); await page.click('#tbPrinted');
    await page.fill('#ptJ', 'CANELA');
    await page.press('#ptN', 'Enter'); // no number yet: nothing to add
    await page.fill('#ptN', '7');
    await page.press('#ptN', 'Enter');
    const rosa = (await saved(page, 'loteria.v1')).players[1];
    assert.deepEqual(rosa.boards.map(b => b.name).slice(2), ['CANELA 7'], 'Enter in the No. box');
    // Make tablas: Whose tablas are these? opens them in the app.
    await seed(page, { 'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: run(1) }], set: { doubles: true, per: 2, paper: 'letter', names: true, who: '' } } });
    await page.goto(base + 'print.html');
    await page.click('#appBtn');
    await page.fill('#apName', 'Abuela');
    await page.press('#apName', 'Enter');
    await page.waitForURL(/board\.html#t=Abuela~/);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('keyboard: a phone’s keyboard leaves the box and what it finds in view, in Cantaron…, the checker and Make tablas', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page), KB = 336, seen = 844 - KB; // an iPhone 14's keyboard
    // Cantaron…: the box stays where it was as the cards narrow down, and the matches sit above the keyboard.
    await seed(page, { 'loteria.v1': ANA });
    await page.goto(base + 'board.html');
    await page.click('#callBtn');
    const top = (await rect(page, '#pkq')).top;
    await page.focus('#pkq'); await keyboardUp(page, KB);
    await page.fill('#pkq', 'lu');
    assert.equal((await rect(page, '#pkq')).top, top, 'Cantaron…’s box jumped down the screen as the cards narrowed down');
    assert.ok((await rect(page, '#sheet .sheet')).bottom <= seen, 'Cantaron… sits under the keyboard');
    assert.ok((await rect(page, '#pk .pk')).bottom <= seen, 'Cantaron…’s first match is under the keyboard');
    // The checker: the verdict right under the number typed, and the winner row above the keyboard.
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 6, round: 3, patterns: ['linea', 'esquinas', 'cuadro'], juego: 'CANELA', wins: [], settings: { speak: false, sound: false, check: true } } });
    await page.goto(base + 'cantor.html');
    await page.click('#lotBtn');
    await page.focus('#vfN'); await keyboardUp(page, KB);
    await page.fill('#vfN', '7');
    const n = await rect(page, '#vfN'), v = await rect(page, '#vfV'), row = await rect(page, '.vfwin');
    assert.ok(n.top >= 0 && v.top > n.bottom && v.bottom <= row.top + 12, `the verdict isn’t in view under the number: number ${n.top}–${n.bottom}, verdict ${v.top}–${v.bottom}, winner row from ${row.top}`);
    assert.ok(row.bottom <= seen, 'the winner row is under the keyboard');
    // Card by card: the box stays put, with the first match above the keyboard.
    await page.click('#vfSeg button[data-v="cards"]');
    const q = (await rect(page, '#vfQ')).top;
    await page.fill('#vfQ', 'ra');
    assert.equal((await rect(page, '#vfQ')).top, q, 'the checker’s card box moved as the cards narrowed down');
    assert.ok((await rect(page, '#vfPick .pk')).bottom <= seen, 'the checker’s first match is under the keyboard');
    // Make tablas: the deck’s matches above the keyboard, and Play these in My tablas…’s buttons too.
    await seed(page, { 'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: run(1) }] } });
    await page.goto(base + 'print.html');
    await page.focus('#q'); await keyboardUp(page, KB);
    await page.fill('#q', 'lu');
    assert.ok((await rect(page, '#dg .dk:not([hidden])')).bottom <= seen + 1, 'Make tablas’ first match is under the keyboard');
    await page.goto(base + 'print.html');
    await page.click('#appBtn');
    await page.focus('#apName'); await keyboardUp(page, KB);
    assert.ok((await rect(page, '#dlg .sheet')).bottom <= seen, 'Play these in My tablas… sits under the keyboard');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('taps: on a phone the small buttons take a tap 44 px tall, and a tabla’s ⤢ in My tablas one 24 px each way', async () => {
  // How far a tap can land from each control and still press it (WCAG 2.2 success criteria 2.5.5 and 2.5.8): its tap
  // area, measured with elementFromPoint from its middle, and what it shows. They look the same as they did.
  const taps = (page, sel) => page.$$eval(sel, els => els.map(el => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const on = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)); };
    const reach = (dx, dy) => { let k = 0; while (k < 30 && on(cx + dx * (k + 1), cy + dy * (k + 1))) k++; return k; };
    return on(cx, cy) && { name: (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 20), shows: Math.round(r.height), tall: reach(0, -1) + reach(0, 1) + 1, wide: reach(-1, 0) + reach(1, 0) + 1 };
  }).filter(Boolean)); // the ones on the screen
  const tall = async (page, sel, what) => { const all = await taps(page, sel); assert.ok(all.length, what + ': nothing found'); for (const t of all) assert.ok(t.tall >= 44, `${what}: “${t.name}” shows ${t.shows} px and takes a tap ${t.tall} px tall`); };
  const ctx = await context({ ...PHONE, viewport: { width: 360, height: 740 } });
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 6, round: 3, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false, check: false } } });
    await page.goto(base + 'cantor.html');
    await tall(page, '.top .chip:not([hidden]), .bar .cbtn, .bar .nextb, .bar .pacec', 'El Cantor');
    await page.click('#setBtn');
    await tall(page, '.sheet .hd .btn, .sheet .seg button, .sheet .row.sp .chip', 'El Cantor’s Settings');
    const SIX = people([1, 2, 3, 4, 5, 6].map(i => ({ id: 'm' + i, name: 'Mine ' + i, cards: run(i) })));
    await seed(page, { 'loteria.v1': SIX, 'loteria.game': { called: [1, 2], announced: {} } });
    await page.goto(base + 'board.html');
    await tall(page, '.top .chip:not([hidden]), .last .undo', 'My tablas');
    for (const t of await taps(page, '.tabla .lbl .z')) assert.ok(t.tall >= 24 && t.wide >= 24, `My tablas: a tabla’s ⤢ takes a tap ${t.wide}×${t.tall}`);
    await page.click('#setBtn');
    await tall(page, '.sheet .hd .btn, .sheet .seg button, .sheet .row.sp .chip', 'My tablas’ Settings');
    await seed(page, { 'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: run(1) }] } });
    await page.goto(base + 'print.html');
    await tall(page, '.top .chip, .top .btn', 'Make tablas');
    for (const t of await taps(page, '.tba button')) assert.ok(t.tall >= 36, `Make tablas: “${t.name}” takes a tap ${t.tall} px tall`);
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('keyboard: name boxes start each word with a capital, and the search boxes have a phone’s Search key', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    const attrs = sel => page.$eval(sel, i => [i.type, i.getAttribute('autocapitalize'), i.getAttribute('enterkeyhint')].join(' '));
    await seed(page, { 'loteria.cantor': { order: run(1, 54), pos: 6, round: 1, patterns: ['linea', 'esquinas', 'cuadro'], juego: '', wins: [], settings: { speak: false, sound: false, check: false } } });
    await page.goto(base + 'cantor.html');
    await page.click('#lotBtn');
    assert.equal(await attrs('#clWho'), 'text words go');
    await page.click('#clCheck');
    assert.equal(await attrs('#vfWho'), 'text words go');
    assert.equal(await attrs('#vfQ'), 'search  search');
    await page.goto(base + 'board.html');
    assert.equal(await attrs('#wName'), 'text words ');
    await page.fill('#wName', 'Ana'); await page.click('#wRandom');
    await page.click('#setBtn');
    assert.equal(await attrs('#pnew'), 'text words done');
    await page.keyboard.press('Escape');
    await page.click('#tablasBtn');
    assert.equal(await attrs('#tbName'), 'text words ');
    await page.click('#tbPrinted');
    assert.equal(await attrs('#ptN'), 'text  done');
    await page.keyboard.press('Escape');
    await page.click('#callBtn');
    assert.equal(await attrs('#pkq'), 'search  search');
    await page.goto(base + 'print.html');
    await page.evaluate(() => { localStorage.setItem('loteria.print', JSON.stringify({ tablas: [{ id: 't1', name: 'Tabla 1', cards: Array.from({ length: 16 }, (_, i) => i + 1) }] })); });
    await page.reload();
    await page.click('#appBtn');
    assert.equal(await attrs('#apName'), 'text words go');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: the squares, the Tablas sheet and Cantaron… work from the keyboard', async () => {
  const ctx = await context(DESKTOP);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': ANA });
    await page.goto(base + 'board.html');
    const active = () => page.evaluate(() => { const a = document.activeElement; return a.getAttribute('aria-label') || a.id || a.className; });
    const called = async () => ((await saved(page, 'loteria.game')) || { called: [] }).called;
    // A square on Mine 1 (El Gallo, El Diablito, La Dama, El Catrín along the top): Enter calls it, Space takes it back.
    await page.locator('#boards .tabla').first().locator('.cell').nth(2).focus();
    assert.equal(await active(), 'La Dama', 'a square can’t take the focus');
    await page.keyboard.press('Enter');
    assert.deepEqual(await called(), [3]);
    assert.equal(await active(), 'La Dama, called', 'the focus left the square');
    await page.keyboard.press(' ');
    assert.deepEqual(await called(), []);
    await page.keyboard.press('Tab');
    assert.equal(await active(), 'El Catrín');
    // The top row from the keyboard: the ¡Lotería! takes the focus, so Enter can't tap the square under it, and gives it back.
    for (const k of [0, 1, 2]) { await page.locator('#boards .tabla').first().locator('.cell').nth(k).focus(); await page.keyboard.press('Enter'); }
    await page.locator('#boards .tabla').first().locator('.cell').nth(3).focus(); await page.keyboard.press('Enter');
    await page.waitForSelector('#winbox .winc');
    assert.equal(await active(), 'winOk');
    await page.keyboard.press('Enter'); // Keep playing
    assert.ok(await page.evaluate(() => document.getElementById('winbox').hidden), 'the ¡Lotería! box is still up');
    assert.deepEqual(await called(), [1, 2, 3, 4], 'Enter on the ¡Lotería! tapped a square');
    assert.equal(await active(), 'El Catrín, called');
    // The Tablas sheet: Enter on a square opens the picker, Space on a card puts it there, and the focus comes back to the square.
    await page.focus('#tablasBtn'); await page.keyboard.press('Enter');
    await page.locator('#edb .eg').first().locator('.cell').nth(5).focus();
    assert.equal(await active(), 'La Sirena');
    await page.keyboard.press('Enter');
    assert.equal(await page.getAttribute('#pkq', 'placeholder'), 'Pick a card for this square');
    await page.locator('#pk .pk[aria-label="La Rana"]').focus(); await page.keyboard.press(' ');
    assert.equal((await saved(page, 'loteria.v1')).players[0].boards[0].cards[5], 54);
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelectorAll('#edb .eg')[0].querySelectorAll('.cell')[5]), true, 'the focus isn’t on the square that changed');
    assert.equal(await active(), 'La Rana');
    await page.keyboard.press('Escape');
    assert.equal(await active(), 'tablasBtn');
    // Cantaron…: Tab past the search box and Done to the cards, and Enter calls one.
    await page.focus('#callBtn'); await page.keyboard.press('Enter');
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    assert.equal(await active(), 'El Gallo, called');
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab'); // past El Diablito, La Dama and El Catrín, called too
    assert.equal(await active(), 'El Paraguas');
    await page.keyboard.press('Enter');
    assert.deepEqual(await called(), [1, 2, 3, 4, 5]);
    // A win typed in the search box (Esquinas, with El Gorrito and La Bandera): the same Enter doesn't close it, and
    // Keep playing goes back to the box for the next card.
    for (const n of ['13', '16']) { await page.fill('#pkq', n); await page.press('#pkq', 'Enter'); }
    await page.waitForSelector('#winbox .winc');
    await until(page, () => document.activeElement.id === 'winOk');
    await page.keyboard.press('Enter');
    assert.ok(await page.evaluate(() => document.getElementById('winbox').hidden), 'the ¡Lotería! box is still up');
    assert.equal(await active(), 'pkq');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: a ¡Lotería! from a card picked in Cantaron… gives the keyboard back to the search box on a computer', async () => {
  const ctx = await context(DESKTOP);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await seed(page, { 'loteria.v1': ANA, 'loteria.game': { called: [1, 2, 3], announced: {} } });
    await page.goto(base + 'board.html');
    await page.focus('#callBtn'); await page.keyboard.press('Enter');
    await page.fill('#pkq', 'catr'); // El Catrín, the last of Mine 1's top row
    await page.locator('#pk .pk').first().focus(); await page.keyboard.press('Enter');
    await until(page, () => document.activeElement && document.activeElement.id === 'winOk');
    await page.keyboard.press('Enter'); // Keep playing
    assert.ok(await page.evaluate(() => document.getElementById('winbox').hidden), 'Keep playing didn’t close the ¡Lotería!');
    assert.deepEqual((await saved(page, 'loteria.game')).called, [1, 2, 3, 4]);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'pkq', 'the focus was dropped');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

check('board: on a phone, a ¡Lotería! picked in Cantaron… closes the cards, so Keep playing or a tap outside lands on the winning tabla', async () => {
  for (const how of ['Keep playing', 'a tap outside', 'enlarged']) {
    const ctx = await context(PHONE);
    try {
      const page = await ctx.newPage(), problems = watch(page);
      await seed(page, { 'loteria.v1': ANA, 'loteria.game': { called: [1, 2, 3], announced: {} } });
      await page.goto(base + 'board.html');
      if (how === 'enlarged') await page.locator('#boards .tabla[data-id="m2"] .z').tap(); // Mine 2 enlarged, and Mine 1 wins
      await page.tap('#callBtn');
      await page.locator('#pk .pk[data-n="4"]').tap(); // El Catrín, the last of Mine 1's top row
      await page.waitForSelector('#winbox .winc');
      assert.ok(await page.evaluate(() => document.getElementById('sheet').hidden), how + ': the ¡Lotería! box is over Cantaron…’s cards');
      if (how === 'a tap outside') await page.touchscreen.tap(10, 10); else await page.tap('#winOk');
      assert.ok(await page.evaluate(() => document.getElementById('winbox').hidden), how + ': the ¡Lotería! box is still up');
      assert.ok(await page.evaluate(() => document.getElementById('sheet').hidden), how + ': Cantaron… is still open over the tablas');
      const win = await page.evaluate(() => {
        const t = document.querySelector('#boards .tabla[data-id="m1"]'), r = t && t.getBoundingClientRect();
        return t && { win: t.classList.contains('win'), hits: t.querySelectorAll('.cell.hit').length, seen: r.top >= 0 && r.bottom <= innerHeight && r.width > 0 };
      });
      assert.deepEqual(win, { win: true, hits: 4, seen: true }, how + ': the winning tabla isn’t showing, outlined');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'callBtn', how + ': the focus didn’t go back to Cantaron…');
      // The next card is picked as before, and the picker stays open for the one after.
      await page.tap('#callBtn');
      await page.locator('#pk .pk[data-n="5"]').tap();
      assert.deepEqual((await saved(page, 'loteria.game')).called, [1, 2, 3, 4, 5]);
      assert.ok(!(await page.evaluate(() => document.getElementById('sheet').hidden)), how + ': Cantaron… closed after a card that didn’t win');
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('board: the ¡Lotería! box’s New round asks “Clear the round?” first, as ↺ does', async () => {
  for (const kind of [PHONE, DESKTOP]) {
    const ctx = await context(kind);
    try {
      const page = await ctx.newPage(), problems = watch(page), where = kind === PHONE ? 'phone: ' : 'computer: ';
      await seed(page, { 'loteria.v1': ANA, 'loteria.game': { called: [9, 1, 2, 3], announced: {} } });
      await page.goto(base + 'board.html');
      await page.click('#callBtn');
      await page.locator('#pk .pk[data-n="4"]').click(); // El Catrín finishes Mine 1's top row
      await page.waitForSelector('#winbox .winc');
      await page.click('#winClear');
      assert.ok(await page.evaluate(() => document.getElementById('winbox').hidden), where + 'the ¡Lotería! box is still up');
      assert.equal(await sheetTitle(page), 'Clear the round?', where + 'New round cleared the round without asking');
      assert.deepEqual((await saved(page, 'loteria.game')).called, [9, 1, 2, 3, 4], where + 'the called cards went before anyone said so');
      await page.click('#clNo'); // Keep playing
      assert.ok(await page.evaluate(() => document.getElementById('sheet').hidden));
      assert.deepEqual((await saved(page, 'loteria.game')).called, [9, 1, 2, 3, 4], where + 'Keep playing cleared the round');
      assert.equal(await page.locator('#boards .tabla.win .cell.hit').count(), 4, where + 'the win went');
      await page.reload();
      assert.equal(await page.locator('#boards .tabla .cell.marked').count(), 5, where + 'the beans went after a reload');
      // And the other way: clear it, then pick the game for the new round.
      await page.click('#clearBtn');
      assert.equal(await sheetTitle(page), 'Clear the round?');
      await page.click('#clOk');
      assert.equal(await sheetTitle(page), 'New round — what are we playing?');
      assert.deepEqual((await saved(page, 'loteria.game')).called, []);
      assert.deepEqual(problems, []);
    } finally { await ctx.close(); }
  }
});

check('board: the ¡Lotería! box says who won and what to tell the caller: a printed tabla’s juego and number, or the winning cards', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    const box = () => page.evaluate(() => [...document.querySelectorAll('#winbox p')].map(p => p.textContent.replace(/ /g, ' ')));
    // Cards picked one after another in Cantaron…; the last one wins.
    async function win(cards) {
      await page.click('#callBtn');
      for (const n of cards) await page.locator(`#pk .pk[data-n="${n}"]`).tap();
      await page.waitForSelector('#winbox .winc');
      const said = await box();
      await page.tap('#winOk');
      return said;
    }
    // A first visit with Mark's four, and CANELA 7 added with + A printed tabla: La Mano, La Palma, La Luna and La
    // Sirena along its top.
    await page.goto(base + 'board.html');
    await page.fill('#wName', 'Ana'); await page.click('#wMark');
    await page.click('#tablasBtn'); await page.click('#tbPrinted');
    await page.fill('#ptJ', 'canela'); await page.fill('#ptN', '7'); await page.click('#ptAdd');
    await page.click('#tbx');
    assert.deepEqual(await win([21, 51, 23, 6]), ['CANELA 7 · Línea', 'Shout it before somebody else does.', 'Tell the caller: juego CANELA, tabla 7']);
    // Mark's Tabla 1 by its cards, in tabla order: its top row, then its third row, where Las Jaras is twice.
    await page.click('#clearBtn'); await page.click('#clOk'); await page.click('#ptx');
    assert.deepEqual((await win([33, 43, 24, 11]))[2], 'Read them out: El Melón · El Cotorro · La Campana · La Araña');
    await page.click('#clearBtn'); await page.click('#clOk'); await page.click('#ptx');
    assert.deepEqual((await win([49, 31, 26]))[2], 'Read them out: El Negrito · Las Jaras · El Pino', 'a double named twice, or out of order');
    // A tabla named like a printed one, but with other cards, is read out card by card.
    const v1 = await saved(page, 'loteria.v1');
    v1.players[0].boards[0].name = 'CANELA 8';
    await page.evaluate(v => localStorage.setItem('loteria.v1', JSON.stringify(v)), v1);
    await page.evaluate(() => localStorage.setItem('loteria.game', JSON.stringify({ called: [], announced: {} })));
    await page.reload();
    assert.deepEqual((await win([11, 24, 43, 33]))[2], 'Read them out: El Melón · El Cotorro · La Campana · La Araña', 'a hand-made tabla was taken for CANELA 8');
    // Tabla Llena is too many to list; with two people on the device, the winner's name comes first.
    v1.players.push({ id: 'mt', name: 'Mateo', boards: [{ id: 'mm', name: 'Tabla 1', cards: run(1) }] });
    v1.current = 'mt'; v1.patterns = ['llena'];
    await page.evaluate(v => { localStorage.setItem('loteria.v1', JSON.stringify(v)); localStorage.setItem('loteria.game', JSON.stringify({ called: Array.from({ length: 15 }, (_, i) => i + 2), announced: {} })); }, v1);
    await page.reload();
    assert.deepEqual(await win([1]), ['Mateo · Tabla 1 · Tabla Llena', 'Shout it before somebody else does.', 'Read out the cards with a bean']);
    // In Spanish.
    v1.current = v1.players[0].id; v1.patterns = ['linea', 'esquinas', 'cuadro'];
    await page.evaluate(v => { localStorage.setItem('loteria.v1', JSON.stringify(v)); localStorage.setItem('loteria.lang', 'es'); localStorage.setItem('loteria.game', JSON.stringify({ called: [], announced: {} })); }, v1);
    await page.reload();
    assert.deepEqual(await win([21, 51, 23, 6]), ['Ana · CANELA 7 · Línea', '¡Grítala antes que nadie!', 'Dile a quien canta: juego CANELA, tabla 7']);
    await page.click('#clearBtn'); await page.click('#clOk'); await page.click('#ptx');
    assert.deepEqual((await win([11, 24, 43, 33]))[2], 'Léelas en voz alta: El Melón · El Cotorro · La Campana · La Araña');
    await page.click('#clearBtn'); await page.click('#clOk'); await page.click('#ptx');
    await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('loteria.v1')); v.patterns = ['llena']; v.current = 'mt'; localStorage.setItem('loteria.v1', JSON.stringify(v)); localStorage.setItem('loteria.game', JSON.stringify({ called: Array.from({ length: 15 }, (_, i) => i + 2), announced: {} })); });
    await page.reload();
    assert.deepEqual((await win([1]))[2], 'Lee en voz alta las cartas con frijol');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

// ---------------------------------------------------------------- damaged saves
check('saves: a browser that keeps nothing says so once on each page, and Make tablas and My tablas don’t say it saves', async () => {
  const NO = 'This browser isn’t keeping what you do here (private browsing, or its storage is off or full), so it will be gone when you close it.';
  const ctx = await context(PHONE);
  try {
    await ctx.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); }; });
    const page = await ctx.newPage(), problems = watch(page);
    // How many times the toast has said it: once a page, however many saves fail.
    const said = () => page.evaluate(no => window.__said || 0, NO);
    const count = () => page.evaluate(no => { window.__said = 0; new MutationObserver(rs => { for (const r of rs) for (const n of r.addedNodes) if (n.textContent === no) window.__said++; }).observe(document.getElementById('toast'), { childList: true }); }, NO);
    await page.goto(base + 'board.html');
    await count();
    await page.fill('#wName', 'Ana'); await page.click('#wRandom');
    await until(page, no => document.getElementById('toast').textContent === no, NO); // after the toast that welcomes Ana, not hidden by it
    await page.locator('#boards .cell').first().click();
    await page.locator('#boards .cell').nth(5).click();
    assert.equal(await said(), 1, 'My tablas');
    await page.click('#setBtn');
    assert.ok((await page.textContent('#sheet')).includes(NO), 'My tablas’ About still says a refresh keeps the round');
    await page.goto(base + 'print.html');
    await count();
    assert.equal(await page.textContent('.foot .note'), NO, 'Make tablas still says it saves as you go');
    await page.locator('#dg .dk[data-n="23"]').tap();
    await page.locator('#dg .dk[data-n="24"]').tap();
    assert.equal(await said(), 1, 'Make tablas');
    await page.goto(base + 'cantor.html');
    await count();
    await page.click('#nextBtn'); await page.click('#nextBtn');
    assert.equal(await said(), 1, 'El Cantor');
    assert.deepEqual(problems, []);
  } finally { await ctx.close(); }
});

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
        assert.match(await page.textContent('#winsCard .nights'), /Ana 1/);
        await page.click('#stx');
        await page.click('#nextBtn'); // a card first: with nothing called, ¡Lotería! only says ▶ starts the round
        await page.click('#lotBtn');
        await page.waitForSelector('#winbox .winc');
        assert.equal(await page.textContent('#clNames .chip'), 'Ana');
      } else {
        await seed(page, { 'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: run(1) }], set: { doubles: true, per: 3, paper: 'legal', names: true, who: '' } } });
        await page.goto(base + 'print.html');
        await page.click('#printBtn');
        assert.equal(await page.textContent('#psum'), '1 tabla on 1 page.');
        assert.equal(await page.textContent('#pers .per.on b'), '2 per page');
        assert.equal(await page.textContent('#paperSeg button.on'), 'Letter');
      }
      assert.deepEqual(problems, [], tool);
    } finally { await ctx.close(); }
  }
});

// ---------------------------------------------------------------- Google Drive (a stand-in for it)
async function driveDevice(g, data, extra = {}) {
  const ctx = await context(PHONE, extra);
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

check('drive: a damaged Drive copy is put right with no device losing a tabla, and one from a newer El Cantor is left alone', async () => {
  const g = fakeGoogle();
  const A = await driveDevice(g, { 'loteria.v1': ANA, 'loteria.print': { tablas: [{ id: 't1', name: 'Hecha a mano', cards: run(1) }] } });
  const B = await driveDevice(g, {});
  const file = () => g.files().filter(f => (f.appProperties || {}).loteria === 'sync')[0];
  const damage = body => { const f = g.drive.files[file().id]; f.body = typeof body === 'function' ? body(JSON.parse(f.body)) : body; f.version++; };
  const names = async d => (await saved(d.page, 'loteria.v1')).players.flatMap(p => p.boards.map(b => b.name)).sort();
  const made = async d => ((await saved(d.page, 'loteria.print')) || { tablas: [] }).tablas.map(t => t.name);
  const sync = async d => { const t = (await saved(d.page, 'loteria.sync')).last; await d.page.evaluate(() => LoteriaSync.now()); await synced(d.page, t); };
  const whole = d => d.page.evaluate(b => !LoteriaSync._read(b).damaged, file().body);
  try {
    await A.page.goto(base + 'board.html'); await synced(A.page);
    await B.page.goto(base + 'board.html'); await synced(B.page);
    await until(B.page, () => document.getElementById('sheet').hidden);
    const gen = JSON.parse(file().body).gen;
    // B adds a tabla, which reaches Drive; A hasn't synced since. Syncs as usual keep the file whole, under one gen.
    const t = (await saved(B.page, 'loteria.sync')).last;
    await B.page.click('#tablasBtn'); await B.page.click('#tbAdd'); await B.page.click('#tbx');
    await synced(B.page, t);
    assert.ok(await whole(B), 'a file saved as usual reads as damaged');
    assert.equal(JSON.parse(file().body).gen, gen, 'a sync as usual changed the gen');
    // A file that reads as JSON but holds nothing ("null") used to read as every tabla removed, on every device.
    damage('null');
    await sync(A);
    assert.deepEqual(await names(A), ['Mine 1', 'Mine 2'], 'A lost tablas to a damaged file');
    assert.deepEqual(await made(A), ['Hecha a mano'], 'A lost Make tablas to a damaged file');
    assert.ok(await whole(A), 'the Drive copy is still damaged');
    assert.notEqual(JSON.parse(file().body).gen, gen, 'the file was put right under the same gen');
    assert.equal(await A.page.getAttribute('#syncBtn', 'data-s'), 'ok');
    // B still has the tabla A never saw, and brings it back to Drive and on to A.
    await sync(B);
    assert.deepEqual(await names(B), ['Mine 1', 'Mine 2', 'Tabla 3'], 'B lost the tabla the damage hid');
    await sync(A);
    assert.deepEqual(await names(A), ['Mine 1', 'Mine 2', 'Tabla 3']);
    // An empty file, and one missing a part, sync again straight away and keep what this device has.
    damage('');
    await sync(A);
    assert.ok(await whole(A), 'an empty Drive copy wasn’t put right');
    damage(o => { delete o.cols.tablas; return JSON.stringify(o); });
    await sync(A);
    assert.deepEqual(await made(A), ['Hecha a mano'], 'a file missing Make tablas’ part took them off A');
    assert.deepEqual(Object.values(JSON.parse(file().body).cols.tablas.items).map(i => i.v.name), ['Hecha a mano']);
    // A file a newer El Cantor saved is neither read nor written over, and a tap says what to do.
    damage(o => JSON.stringify({ ...o, v: 2, cols: { people: 'a shape this version can’t read' } }));
    const kept = file().body;
    await A.page.click('#syncBtn');
    await until(A.page, () => document.getElementById('syncBtn').dataset.s === 'error');
    await until(A.page, t => document.getElementById('toast').textContent === t, 'Google Drive has tablas from a newer El Cantor. Close it and open it again to update, and it’ll sync.');
    assert.equal(file().body, kept, 'the newer El Cantor’s file was written over');
    assert.deepEqual(await names(A), ['Mine 1', 'Mine 2', 'Tabla 3']);
    assert.equal(await A.page.getAttribute('#syncBtn', 'title'), 'Google Drive has tablas from a newer El Cantor. Close it and open it again to update, and it’ll sync.', 'a note that says what’s next gets no “try again”');
    assert.deepEqual(A.problems, []); assert.deepEqual(B.problems, []);
  } finally { await A.ctx.close(); await B.ctx.close(); }
});

check('drive: the dot turns red when the hour runs out with a page open, and a change made just before leaving goes as the page is left', async () => {
  // The sign-in has a little over a minute left as the page opens; sync.js stops trusting it a minute early.
  const g = fakeGoogle();
  const A = await driveDevice(g, { 'loteria.v1': ANA, 'junkdrawer.google': { token: 'tok-mark', exp: Date.now() + 66e3, scope: 'https://www.googleapis.com/auth/drive.file', email: 'mark@gmail.com' } });
  try {
    await A.page.goto(base + 'board.html'); await synced(A.page);
    assert.equal(await A.page.getAttribute('#syncBtn', 'data-s'), 'ok');
    await until(A.page, () => document.getElementById('syncBtn').dataset.s === 'tap', null, 15000);
    assert.equal(await A.page.getAttribute('#syncBtn', 'title'), 'Tap to sync your tablas with Google Drive');
    assert.deepEqual(A.problems, []);
  } finally { await A.ctx.close(); }
  // A phone stops a page's timers once it's out of sight, so here the few seconds a change waits before it syncs never end.
  const B = await driveDevice(g, { 'loteria.v1': ANA });
  await B.ctx.addInitScript(() => { const later = window.setTimeout; window.setTimeout = (f, ms, ...a) => String(f).includes('pushT') ? 1e9 : later(f, ms, ...a); });
  const file = () => JSON.parse(g.files().filter(f => (f.appProperties || {}).loteria === 'sync')[0].body);
  try {
    await B.page.goto(base + 'board.html'); await synced(B.page);
    const t = (await saved(B.page, 'loteria.sync')).last;
    await B.page.click('#tablasBtn');
    await B.page.locator('#edb input').first().fill('Antes de irme');
    await B.page.locator('#edb input').first().dispatchEvent('change');
    await B.page.waitForTimeout(500);
    assert.ok(!Object.values(file().cols.boards.items).some(i => i.v.name === 'Antes de irme'), 'the change went before the page was left');
    await B.page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await synced(B.page, t);
    assert.ok(Object.values(file().cols.boards.items).some(i => i.v.name === 'Antes de irme'), 'the change made just before leaving waited');
    assert.deepEqual(B.problems, []);
  } finally { await B.ctx.close(); }
});

check('drive: Stop saving during a sync leaves nothing of it behind, and turning it on again asks which Google account', async () => {
  const g = fakeGoogle();
  const A = await driveDevice(g, { 'loteria.v1': ANA });
  const { page, ctx } = A;
  try {
    await page.goto(base + 'board.html'); await synced(page);
    // Drive holds its answer to the next sync's read until Stop has been tapped twice.
    let answer; const held = new Promise(r => { answer = r; });
    await ctx.route('https://www.googleapis.com/drive/v3/files/*', async route => { if (route.request().url().includes('alt=media')) await held; await route.fallback(); });
    await page.click('#setBtn');
    await page.click('#syncCard [data-a="now"]');
    await until(page, () => document.getElementById('syncBtn').dataset.s === 'busy');
    await page.click('#syncCard [data-a="off"]'); await page.click('#syncCard [data-a="off"]');
    const read = page.waitForResponse(r => r.url().includes('alt=media'));
    answer(); await read;
    await page.waitForTimeout(1500); // what that sync would have done next
    assert.deepEqual(await saved(page, 'loteria.sync'), { on: false, email: '', name: '', last: 0, pick: true }, 'Stop kept the sync’s history');
    assert.equal(await saved(page, 'loteria.sync.base'), null, 'the Drive copy as last synced stayed');
    assert.equal(await saved(page, 'loteria.sync.seen'), null, 'what this device last synced stayed');
    assert.ok(await page.evaluate(() => document.getElementById('syncBtn').hidden), 'the ☁ button is still up');
    assert.equal(await page.textContent('#syncCard [data-a="on"]'), 'Save to Google Drive');
    // On again, with the sign-in from before still good for the hour: Google asks which account, and Lupe's is picked.
    await page.evaluate(() => localStorage.setItem('__who', 'lupe'));
    await page.click('#syncCard [data-a="on"]');
    await synced(page);
    assert.deepEqual(await page.evaluate(() => window.__prompts), [{ prompt: 'select_account' }], 'no account chooser, or it was told whose account to use');
    assert.equal((await saved(page, 'loteria.sync')).email, 'lupe@gmail.com');
    const files = g.files().filter(f => (f.appProperties || {}).loteria === 'sync');
    assert.deepEqual(files.map(f => f.owner).sort(), ['lupe', 'mark']);
    assert.deepEqual(Object.values(JSON.parse(files.find(f => f.owner === 'lupe').body).cols.boards.items).map(i => i.v.name).sort(), ['Mine 1', 'Mine 2'], 'the tablas didn’t go to Lupe’s Drive');
    // The next sign-in on this device remembers Lupe's account.
    assert.equal(await saved(page, 'junkdrawer.google').then(t => t.email), 'lupe@gmail.com');
    assert.deepEqual(A.problems, []);
  } finally { await ctx.close(); }
});

check('drive: Stop saving while another device’s save sends a sync back to start leaves nothing of it behind either', async () => {
  const g = fakeGoogle();
  const A = await driveDevice(g, { 'loteria.v1': ANA });
  const { page, ctx } = A, file = () => g.files().filter(f => (f.appProperties || {}).loteria === 'sync')[0];
  try {
    await page.goto(base + 'board.html'); await synced(page);
    // A rename goes to Drive. Drive holds its answer to the write's version check until Stop has been tapped twice,
    // and meanwhile another device saves, so the sync would go back to the start and merge again.
    let answer; const held = new Promise(r => { answer = r; });
    await ctx.route('https://www.googleapis.com/drive/v3/files/*', async route => { if (route.request().url().includes('fields=version')) await held; await route.fallback(); });
    const asked = page.waitForRequest(r => r.url().includes('fields=version'));
    await page.click('#tablasBtn');
    await page.locator('#edb input').first().fill('Renamed');
    await page.locator('#edb input').first().dispatchEvent('change');
    await page.click('#tbx');
    await asked;
    g.drive.files[file().id].version++;
    await page.click('#setBtn');
    await page.click('#syncCard [data-a="off"]'); await page.click('#syncCard [data-a="off"]');
    const done = page.waitForResponse(r => r.url().includes('fields=version'));
    answer(); await done;
    await page.waitForTimeout(1500); // what that sync would have done next
    assert.deepEqual(await saved(page, 'loteria.sync'), { on: false, email: '', name: '', last: 0, pick: true }, 'the sync went on after Stop');
    assert.equal(await saved(page, 'loteria.sync.base'), null, 'the Drive copy as last synced came back');
    assert.equal(await saved(page, 'loteria.sync.seen'), null, 'what this device last synced came back');
    assert.ok(!Object.values(JSON.parse(file().body).cols.boards.items).some(i => i.v.name === 'Renamed'), 'the rename went to Drive after Stop');
    assert.deepEqual(A.problems, []);
  } finally { await ctx.close(); }
});

check('drive: a shared link on a new phone that saves to Drive asks again once the Drive tablas land', async () => {
  const g = fakeGoogle();
  const A = await driveDevice(g, { 'loteria.v1': ANA });
  const B = await driveDevice(g, {});
  try {
    await A.page.goto(base + 'board.html');
    await synced(A.page);
    let land; const held = new Promise(r => { land = r; }); // Drive answers once a name is typed
    await B.ctx.route('https://www.googleapis.com/**', async route => { await held; await route.fallback(); });
    await B.page.goto(base + 'board.html#t=Ana~Tabla%201:1.2.3.4.5.6.7.8.9.a.b.c.d.e.f.g');
    await B.page.fill('#imName', 'Beto');
    land();
    await synced(B.page);
    assert.equal(await sheetTitle(B.page), 'Tablas from Ana', 'the import was dropped when Drive landed');
    assert.equal(await B.page.inputValue('#imName'), 'Beto', 'the name typed was dropped when Drive landed');
    assert.equal(await B.page.textContent('#imOk'), 'Add and use');
    await B.page.fill('#imName', ''); // the link's own name, which Drive has now brought here
    assert.equal(await B.page.textContent('#imNote'), 'This link carries 1 tabla for “Ana”. Ana is already on this device with 2 tablas.');
    assert.equal(await B.page.textContent('#imOk'), 'Add to Ana’s tablas');
    await B.page.click('#imOk');
    await until(B.page, () => document.getElementById('toast').textContent === 'Ana already has this tabla'); // it's her Mine 1
    assert.deepEqual((await saved(B.page, 'loteria.v1')).players.map(p => p.name + ':' + p.boards.length), ['Ana:2']);
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

check('espanol: Google Drive’s card and ☁ button in Spanish on every page', async () => {
  const A = await driveDevice(fakeGoogle(), { 'loteria.v1': ANA, 'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: run(1) }] } }, { locale: 'es-MX' });
  const { page } = A, card = () => page.textContent('#syncCard .note');
  try {
    await page.goto(base + 'board.html');
    await synced(page);
    await until(page, () => document.getElementById('syncBtn').dataset.s === 'ok');
    assert.equal(await page.getAttribute('#syncBtn', 'title'), 'Sincronizado con Google Drive hace un momento — toca para sincronizar ahora');
    await page.click('#setBtn');
    assert.equal(await card(), 'Las tablas se guardan en mark@gmail.com y aparecen en cada dispositivo donde actives esto. Última sincronización: hace un momento.');
    assert.deepEqual(await english(page), [], 'English in My tablas’ Settings');
    for (const [p, open] of [['', null], ['cantor.html', '#setBtn'], ['print.html', null]]) {
      await page.goto(base + p);
      if (open) await page.click(open);
      await until(page, () => /Última sincronización/.test(document.querySelector('#syncCard .note').textContent));
      assert.deepEqual(await english(page), [], 'English on ' + (p || 'the home screen'));
    }
    assert.equal(await page.textContent('#syncCard [data-a="now"]'), 'Sincronizar ahora');
    await page.click('#syncCard [data-a="off"]');
    assert.equal(await page.textContent('#syncCard [data-a="off"]'), 'Toca otra vez para dejar de guardar');
    await page.click('#syncCard [data-a="off"]');
    assert.deepEqual([await page.textContent('#syncCard .eyebrow'), await page.textContent('#syncCard [data-a="on"]')], ['Guardar en todos tus dispositivos', 'Guardar en Google Drive']);
    assert.deepEqual(await english(page), [], 'English in the card that turns it on');
    assert.deepEqual(A.problems, []);
  } finally { await A.ctx.close(); }
});

check('espanol: the day Drive last synced is written in the language shown, not the phone’s', async () => {
  // A phone in Spanish, a day after the last sync: "Last synced Nov 5." in English, "el 5 nov." in Spanish. The sign-in
  // here outlasts the day, as the card says "Tap Sync now" in place of the date once Google's hour runs out.
  const t0 = new Date('2026-11-05T18:00:00Z').getTime();
  for (const [lang, says] of [['en', /Last synced Nov 5\.$/], ['es', /Última sincronización: el 5 nov\.?\.$/]]) {
    const A = await driveDevice(fakeGoogle(), { 'loteria.v1': ANA, 'loteria.lang': lang, 'junkdrawer.google': { token: 'tok-mark', exp: t0 + 27 * 3600e3, scope: 'https://www.googleapis.com/auth/drive.file', email: 'mark@gmail.com' } }, { locale: 'es-MX', timezoneId: 'America/Mexico_City' });
    try {
      await A.page.clock.install({ time: t0 });
      await A.page.goto(base + 'board.html');
      await synced(A.page);
      await A.page.waitForTimeout(2500); // the sync a save at the start asks for, a moment later
      await until(A.page, () => document.getElementById('syncBtn').dataset.s === 'ok');
      await A.page.clock.fastForward('26:00:00');
      await A.page.click('#setBtn');
      assert.match(await A.page.textContent('#syncCard .note'), says, lang);
      assert.deepEqual(A.problems, []);
    } finally { await A.ctx.close(); }
  }
});

check('drive: El Cantor, with no ☁ button, says a winner saved after Google’s hour waits for Sync now, and its card speaks of winners', async () => {
  for (const lang of ['en', 'es']) {
    const SAYS = {
      en: { saved: 'El Cantor’s winners and the last juego it printed or checked are saved to mark@gmail.com, with your tablas, and show up on every device where you turn this on.', tap: 'Tap Sync now to get the winners from your other devices.', wait: 'Saved here — tap Sync now to send it to Google Drive.', toast: 'Saved here — tap Sync now in Settings (⋯) to send it to Google Drive.', off: /^Keep El Cantor’s winners and the last juego/ },
      es: { saved: 'Los ganadores de El Cantor y el último juego que imprimió o revisó se guardan en mark@gmail.com, junto con tus tablas, y aparecen en cada dispositivo donde actives esto.', tap: 'Toca Sincronizar ahora para traer los ganadores de tus otros dispositivos.', wait: 'Guardado aquí — toca Sincronizar ahora para mandarlo a Google Drive.', toast: 'Guardado aquí — toca Sincronizar ahora en Ajustes (⋯) para mandarlo a Google Drive.', off: /^Guarda los ganadores de El Cantor y el último juego/ }
    }[lang];
    // The sign-in has a little over a minute left as the page opens; sync.js stops trusting it a minute early.
    const g = fakeGoogle();
    const A = await driveDevice(g, { 'loteria.lang': lang, 'junkdrawer.google': { token: 'tok-mark', exp: Date.now() + 68e3, scope: 'https://www.googleapis.com/auth/drive.file', email: 'mark@gmail.com' } });
    const { page } = A, note = () => page.textContent('#syncCard .note'), wins = () => JSON.parse(g.files().filter(f => (f.appProperties || {}).loteria === 'sync')[0].body).cols.wins.items;
    try {
      await page.goto(base + 'cantor.html'); await synced(page);
      await page.click('#setBtn');
      assert.match(await note(), new RegExp('^' + SAYS.saved.replace(/[.()?]/g, '\\$&') + ' '), lang + ': the card speaks of tablas El Cantor doesn’t save');
      await until(page, t => document.querySelector('#syncCard .note').textContent.endsWith(t), SAYS.tap, 15000); // the hour is out
      await page.click('#stx');
      await page.click('#nextBtn'); await page.click('#nextBtn');
      await page.click('#lotBtn');
      await page.fill('#clWho', 'Abuela');
      await page.click('#clNew');
      await until(page, t => { const e = document.getElementById('toast'); return e.textContent === t && e.classList.contains('show'); }, SAYS.toast, 5000);
      await page.click('#ptx');
      await page.click('#setBtn');
      assert.ok((await note()).endsWith(SAYS.wait), lang + ': the card says “' + await note() + '”');
      assert.equal(await page.textContent('#syncCard .eyebrow'), 'Google Drive', lang + ': the card is headed “Saved to Google Drive” over “Saved here”');
      assert.deepEqual(Object.keys(wins()), [], 'the win went to Drive after the hour');
      await page.click('#syncCard [data-a="now"]'); // signs in again (here with no Google window) and syncs
      await until(page, () => Object.keys(JSON.parse(localStorage.getItem('loteria.sync.base')).cols.wins.items).length === 1, null, 15000);
      assert.deepEqual(Object.values(wins()).map(w => w.v.who), ['Abuela']);
      if (lang === 'en') { // how many tablas a juego was printed with goes with the winners, and a copy saved before it had them is whole
        await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('loteria.cantor')); o.printed = { CANELA: 12 }; localStorage.setItem('loteria.cantor', JSON.stringify(o)); });
        const t = (await saved(page, 'loteria.sync')).last;
        await page.evaluate(() => LoteriaSync.now()); await synced(page, t);
        const file = () => JSON.parse(g.files().filter(f => (f.appProperties || {}).loteria === 'sync')[0].body);
        assert.deepEqual(Object.values(file().cols.printed.items).map(i => i.v), [{ name: 'CANELA', count: 12 }]);
        const before = file(); delete before.cols.printed;
        assert.equal(await page.evaluate(b => LoteriaSync._read(b).damaged, JSON.stringify(before)), false, 'a copy saved before the printed counts reads as damaged');
        const B = await driveDevice(g, {});
        try {
          await B.page.goto(base + 'cantor.html'); await synced(B.page);
          assert.deepEqual((await saved(B.page, 'loteria.cantor')).printed, { CANELA: 12 }, 'the count didn’t reach another device');
          assert.deepEqual(B.problems, []);
        } finally { await B.ctx.close(); }
      }
      await page.click('#syncCard [data-a="off"]'); await page.click('#syncCard [data-a="off"]');
      assert.match(await note(), SAYS.off, lang + ': the card that turns it on speaks of tablas El Cantor doesn’t save');
      assert.deepEqual(A.problems, []);
    } finally { await A.ctx.close(); }
  }
});

check('drive: on a phone, a tap on ☁ or Sync now says what went wrong, in English and in Spanish, and “try again” only once', async () => {
  // Drive's answer when the account's storage is full, as Google's guide "Resolve errors" gives it (403 errors,
  // storageQuotaExceeded); a busy Drive answers 503, and Google says to try those again a little later.
  const FULL = { error: { errors: [{ domain: 'global', reason: 'storageQuotaExceeded', message: 'The user\'s Drive storage quota has been exceeded.' }], code: 403, message: 'The user\'s Drive storage quota has been exceeded.' } };
  const SAYS = {
    en: { offline: 'No connection — your tablas are saved on this device and will sync when you’re back online.', full: 'Your Google Drive is full, so nothing new was saved there. Free some space and tap Sync now.', busy: 'Google Drive is busy — trying again in a minute.', gis: 'Google sign-in didn’t load. Check the connection.', reach: 'Couldn’t reach Google Drive. Check the connection.' },
    es: { offline: 'Sin conexión — tus tablas están guardadas en este dispositivo y se sincronizan cuando vuelvas a tener conexión.', full: 'Tu Google Drive está lleno, así que no se guardó nada nuevo ahí. Libera espacio y toca Sincronizar ahora.', busy: 'Google Drive está ocupado — se vuelve a intentar en un minuto.', gis: 'No cargó el inicio de sesión de Google. Revisa la conexión.', reach: 'No se pudo conectar con Google Drive. Revisa la conexión.' }
  };
  // What the ☁ button's title (a screen reader's label) and the Settings card add to a note that doesn't say what's next.
  const AGAIN = { en: { title: ' Tap to try again.', card: ' Tap Sync now to try again.', head: 'Google Drive' }, es: { title: ' Toca para intentarlo otra vez.', card: ' Toca Sincronizar ahora para intentarlo otra vez.', head: 'Google Drive' } };
  const answer = (route, status, body) => route.request().method() === 'OPTIONS' ? route.fallback() : route.fulfill({ status, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const said = (page, text) => until(page, t => { const e = document.getElementById('toast'); return e.textContent === t && e.classList.contains('show'); }, text, 8000);
  for (const lang of ['en', 'es']) for (const what of ['offline', 'full', 'busy', 'gis', 'reach']) {
    const g = fakeGoogle(), expired = what === 'gis', says = SAYS[lang][what], where = lang + ', ' + what + ': ';
    const A = await driveDevice(g, { 'loteria.v1': ANA, 'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: run(1) }] }, ...(expired ? { 'junkdrawer.google': { token: 'tok-mark', exp: Date.now() - 60e3, scope: 'https://www.googleapis.com/auth/drive.file', email: 'mark@gmail.com' } } : {}) }, { locale: lang === 'es' ? 'es-MX' : 'en-US' });
    const { ctx, page } = A;
    try {
      const cut = r => r.abort('internetdisconnected'), busy = r => answer(r, 503, { error: { code: 503, message: 'Service Unavailable' } });
      if (what === 'offline') await ctx.route('https://www.googleapis.com/**', cut);
      if (what === 'full') await ctx.route('https://www.googleapis.com/upload/**', r => answer(r, 403, FULL));
      if (what === 'busy') { await ctx.route('https://www.googleapis.com/**', busy); await page.clock.install(); }
      if (what === 'gis') await ctx.route('https://accounts.google.com/gsi/client', r => r.abort());
      if (what === 'reach') await ctx.route('https://www.googleapis.com/**', r => answer(r, 400, { error: { code: 400, message: 'Bad Request' } }));
      const gisFailed = expired && page.waitForEvent('requestfailed', r => r.url().includes('gsi/client'));
      await page.goto(base + (what === 'full' ? 'print.html' : 'board.html'));
      // The sync as the page opens goes wrong quietly; a tap on ☁ says what happened.
      if (expired) await gisFailed; else await until(page, () => document.getElementById('syncBtn').dataset.s === 'error');
      assert.equal(await page.evaluate(() => document.getElementById('toast').classList.contains('show')), false, where + 'a toast without a tap');
      await page.click('#syncBtn');
      await said(page, says).catch(async e => { throw new Error(where + 'the toast says “' + await page.textContent('#toast') + '”, not “' + says + '”'); });
      if (what === 'reach') { // the note says what happened once, and the title and the card say "try again" once each
        assert.equal(await page.getAttribute('#syncBtn', 'title'), says + AGAIN[lang].title, where + 'the ☁ button’s title');
        assert.equal(await page.getAttribute('#syncBtn', 'aria-label'), says + AGAIN[lang].title, where + 'the ☁ button’s label');
        await page.click('#setBtn');
        assert.equal(await page.textContent('#syncCard .eyebrow'), AGAIN[lang].head, where + 'the card’s heading says it saved');
        assert.ok((await page.textContent('#syncCard .note')).endsWith(says + AGAIN[lang].card), where + 'the card says “' + await page.textContent('#syncCard .note') + '”');
      }
      if (what === 'full') {
        assert.ok(!g.files().some(f => (f.appProperties || {}).loteria === 'sync'), 'a full Drive got the file');
        assert.equal(await page.getAttribute('#syncBtn', 'title'), says, where + 'a note that says what’s next gets no “try again”');
        assert.ok((await page.textContent('#syncCard .note')).endsWith(says), where + 'the card doesn’t say so');
      }
      if (what === 'offline') { // Sync now says it too; back online, it syncs by itself
        await page.click('#setBtn');
        await page.evaluate(() => { document.getElementById('toast').classList.remove('show'); });
        await page.click('#syncCard [data-a="now"]');
        await said(page, says);
        await ctx.unroute('https://www.googleapis.com/**', cut);
        await page.evaluate(() => dispatchEvent(new Event('online')));
        await synced(page);
      }
      if (what === 'busy') { // a minute later it tries again by itself
        await ctx.unroute('https://www.googleapis.com/**', busy);
        await page.clock.fastForward('01:01');
        await synced(page);
      }
      assert.deepEqual(A.problems.filter(p => !/googleapis\.com|accounts\.google\.com|Failed to load resource/.test(p)), [], where);
    } finally { await ctx.close(); }
  }
});

// ---------------------------------------------------------------- the move from junkdrawer.works/el-cantor/
// carry.js, with both addresses served here: el-cantor.junkdrawer.works from this folder, and junkdrawer.works with a
// carry.html that answers as the real one does (junkdrawer.works/carry.html hands each project its own keys only).
const CARRY_HTML = String.raw`<!doctype html><script>
const PROJECTS = { 'el-cantor': { local: ['loteria.', 'junkdrawer.google'] }, 'patience': { local: ['patience.'] } };
addEventListener('message', e => {
  const m = /^https:\/\/([a-z0-9-]+)\.junkdrawer\.works$/.exec(e.origin), project = m && PROJECTS[m[1]];
  if (!project || !e.data || e.data.carry !== true) return;
  const local = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (project.local.some(p => k === p || (/[.:/]$/.test(p) && k.startsWith(p)))) local[k] = localStorage.getItem(k); }
  e.source.postMessage({ carried: { local, idb: [] } }, e.origin);
});
</script>`;
async function movedContext(carryPage = true) {
  const ctx = await browser.newContext({ ...PHONE, locale: 'en-US', serviceWorkers: 'block' });
  await ctx.route(() => true, async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'https://junkdrawer.works') {
      if (url.pathname === '/carry.html') return carryPage ? route.fulfill({ status: 200, contentType: 'text/html', body: CARRY_HTML }) : route.fulfill({ status: 404, contentType: 'text/html', body: 'Not found' });
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>blank</title>' });
    }
    if (url.origin === 'https://el-cantor.junkdrawer.works') {
      if (url.pathname === '/__blank') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>blank</title>' });
      const file = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
      try { return route.fulfill({ status: 200, contentType: TYPES[extname(file)] || 'application/octet-stream', body: await readFile(join(root, decodeURIComponent(file))) }); } catch { return route.fulfill({ status: 404, body: '' }); }
    }
    return route.abort();
  });
  return ctx;
}
const loads = page => { const n = { count: 0 }; page.on('request', r => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) n.count++; }); return n; };

check('carry: the first visit brings the tablas saved at junkdrawer.works/el-cantor/, and only El Cantor’s', async () => {
  const OLD = 'https://junkdrawer.works/el-cantor/', NEW = 'https://el-cantor.junkdrawer.works/';
  const errors = [];
  const ctx = await movedContext();
  try {
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(OLD);
    await page.evaluate(a => {
      localStorage.setItem('loteria.v1', JSON.stringify(a));
      localStorage.setItem('loteria.lang', 'es');
      localStorage.setItem('junkdrawer.google', JSON.stringify({ email: 'mark@gmail.com' }));
      localStorage.setItem('patience.v1', '{"games":3}');
    }, ANA);
    // Something already saved at the new address stays as it is.
    await page.goto(NEW + '__blank');
    await page.evaluate(() => localStorage.setItem('loteria.lang', 'en'));
    const n = loads(page);
    await page.goto(NEW + 'board.html');
    await until(page, () => [...document.querySelectorAll('#boards .cell img')].length > 0 && localStorage.getItem('junkdrawer.carried'), null, 15000);
    assert.equal(n.count, 2, 'the first visit loads the page twice: stopped, then with the saves');
    const got = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
    assert.deepEqual(JSON.parse(got['loteria.v1']).players.map(p => p.name), ['Ana'], 'Ana’s tablas came along');
    assert.equal(got['loteria.lang'], 'en', 'a save already at the new address was written over');
    assert.ok(got['junkdrawer.google'], 'the Google sign-in didn’t come along');
    assert.ok(!('patience.v1' in got), 'another project’s save came along');
    assert.match(await page.textContent('#boards'), /Mine 1/);
    n.count = 0;
    await page.reload();
    await page.waitForSelector('#callBtn');
    assert.equal(n.count, 1, 'a later visit loads once');
  } finally { await ctx.close(); }
  assert.deepEqual(errors, []);
  // With carry.html not there, the page still opens, after a short wait, and tries again next time.
  const gone = await movedContext(false);
  try {
    const page = await gone.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const t0 = Date.now();
    await page.goto(NEW + 'cantor.html');
    await page.waitForSelector('#playBtn', { timeout: 15000 });
    await until(page, () => localStorage.getItem('junkdrawer.carry-tries') === '1', null, 15000);
    assert.ok(Date.now() - t0 < 10000, 'El Cantor took ' + (Date.now() - t0) + ' ms to open without carry.html');
    assert.equal(await page.evaluate(() => localStorage.getItem('junkdrawer.carried')), null);
    assert.deepEqual(errors, []);
  } finally { await gone.close(); }
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
      if (f === 'sw.js' || /^audio\/.+\.mp3$/.test(f)) continue; // a voice is kept as El Cantor fetches it
      assert.ok(kept.indexOf(f) >= 0, 'sw.js doesn’t keep ' + f + ', so it won’t open offline');
    }
    // Someone is set up by now, so My tablas has tablas to show, with the card pictures from the offline copy (a new
    // device asks who's playing over an empty board).
    await page.evaluate(a => localStorage.setItem('loteria.v1', JSON.stringify(a)), ANA);
    await ctx.setOffline(true);
    for (const p in PAGES) {
      await page.goto(base + p);
      await page.waitForSelector(PAGES[p]);
      if (p === 'board.html') await until(page, () => [...document.querySelectorAll('#boards .cell img')].some(i => i.complete && i.naturalWidth > 0));
    }
    await ctx.setOffline(false);
    assert.deepEqual(problems.filter(p => !/ERR_INTERNET_DISCONNECTED/.test(p)), []);
  } finally { await ctx.close(); }
});

// Offline, checked the junkdrawer house kit's way, from a server that answers like GitHub Pages: a browser may keep
// each file for ten minutes, and asks again by its ETag. `net` is the connection: 'up', 'down' (the server drops every
// connection) or 'stalled' (a plane's or a train's wifi: it takes each request and holds on to it). With `release`
// set it serves the next release. The server's own switches are needed because the browser's offline switch can't
// make a stall, and in some Chromium builds it doesn't stop the service worker's own requests.
check('offline: opens with the server down and on a stalled connection, and a new release replaces the copy', async () => {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
  let net = 'up', release = false;
  const held = [];
  const pages = createServer((req, res) => {
    if (net === 'down') { req.socket.destroy(); return; }
    if (net === 'stalled') { held.push([req, res]); return; }
    serve(req, res);
  }).listen(0);
  async function serve(req, res) {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    let body;
    try { body = await readFile(join(root, path)); } catch { res.writeHead(404); res.end(); return; }
    if (release && path === '/sw.js') body = Buffer.from(String(body).replace(/const FILES = '[0-9a-f]*'/, "const FILES = 'next'"));
    if (release && path === '/index.html') body = Buffer.concat([body, Buffer.from('<!-- the next release -->\n')]);
    const etag = `"${createHash('sha1').update(body).digest('hex').slice(0, 16)}"`;
    const head = { etag, 'cache-control': 'max-age=600', 'content-type': TYPES[extname(path)] || 'text/html' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); res.end(); return; }
    res.writeHead(200, head);
    res.end(body);
  }
  const at = `http://localhost:${pages.address().port}/`;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: 'en-US' });
  try {
    const page = await ctx.newPage();
    const problems = [];
    page.on('pageerror', e => problems.push(e.message));
    await page.goto(at);
    await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 15000 });
    const title = await page.title();

    // Works offline once it has been opened.
    net = 'down';
    await ctx.setOffline(true);
    await page.reload();
    assert.equal(await page.title(), title, 'the page did not open offline');
    await ctx.setOffline(false);

    // On a connection that's up but not answering, it opens from the copy too, after the worker's few seconds' wait for
    // the network: the page and every file it loads (were any of them left waiting on the network, it wouldn't open).
    net = 'stalled';
    const t0 = Date.now();
    await page.reload({ timeout: 10000 }).catch(() => {});
    const took = Date.now() - t0;
    assert.ok(took < 8000, `the page took ${took} ms to open on a stalled connection`);
    assert.equal(await page.title(), title, 'the page did not open on a stalled connection');
    net = 'up';
    for (const [req, res] of held.splice(0)) serve(req, res);

    // A new release: every file in the new copy comes from the server, though the browser still has its own copies of
    // the old ones for ten minutes. (The next release changes index.html, and so FILES in sw.js, as a real one does.)
    release = true;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    for (const end = Date.now() + 10000; !(await page.evaluate(async () => !!(await (await caches.match('index.html'))?.text())?.includes('<!-- the next release -->')));) {
      assert.ok(Date.now() < end, "the new release's offline copy kept the old index.html");
      await new Promise(r => setTimeout(r, 100));
    }
    assert.deepEqual(problems, [], 'problems while offline or on a stalled connection');
  } finally {
    net = 'up';
    for (const [req, res] of held.splice(0)) serve(req, res);
    await ctx.close();
    pages.close();
  }
});

check('offline: from a server that drops .html from addresses, as `npx serve` does, every page still opens offline', async () => {
  // Such a server answers cantor.html with a redirect to /cantor, so the offline copy is filled with redirected
  // answers, and a page load can't be answered with one of those.
  let down = false;
  const pages = createServer(async (req, res) => {
    if (down) { req.socket.destroy(); return; }
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('.html')) { res.writeHead(301, { location: path.slice(0, -5).replace(/\/index$/, '/') }); res.end(); return; }
    if (path.endsWith('/')) path += 'index';
    if (!extname(path)) path += '.html';
    let body;
    try { body = await readFile(join(root, path)); } catch { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' })[extname(path)] || 'application/octet-stream' });
    res.end(body);
  }).listen(0);
  const at = `http://localhost:${pages.address().port}/`;
  const ctx = await browser.newContext({ ...PHONE, locale: 'en-US' });
  try {
    const page = await ctx.newPage(), problems = [];
    page.on('pageerror', e => problems.push(e.message));
    await page.goto(at);
    await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 15000 });
    await page.evaluate(a => localStorage.setItem('loteria.v1', JSON.stringify(a)), ANA);
    await page.goto(at + 'cantor.html');
    await page.waitForSelector('#playBtn');
    down = true;
    await ctx.setOffline(true);
    const PAGES = { 'cantor.html': '#playBtn', 'board.html': '#callBtn', 'print.html': '#printBtn', 'index.html': 'nav.tiles' };
    for (const p in PAGES) {
      await page.goto(at + p).catch(e => assert.fail(p + ' didn’t open offline: ' + e.message.split('\n')[0]));
      await page.waitForSelector(PAGES[p], { timeout: 5000 });
    }
    assert.deepEqual(problems, []);
  } finally {
    await ctx.setOffline(false);
    await ctx.close();
    pages.close();
  }
});

check('offline: FILES in sw.js is the fingerprint of the files it keeps, the card pictures too', async () => {
  // sw.js changes whenever a file it keeps does, so a release replaces the whole offline copy at once: FILES in sw.js
  // is a fingerprint of every file in SHELL and CARDS, the card pictures included (sha1 of each, in the lists' order,
  // an address like './' read as its index.html; the first 8 hex of the sha1 of those).
  const sw = await readFile(join(root, 'sw.js'), 'utf8'), box = { self: { addEventListener() { } } };
  vm.runInNewContext(sw + '\n;this.out = { SHELL, CARDS };', box);
  const kept = box.out.SHELL.concat(box.out.CARDS);
  const all = createHash('sha1');
  for (const f of kept) all.update(createHash('sha1').update(await readFile(join(root, f.endsWith('/') ? f + 'index.html' : f))).digest());
  const files = all.digest('hex').slice(0, 8);
  assert.equal(sw.match(/const FILES = '([0-9a-f]*)'/)?.[1], files, `a file sw.js keeps for offline has changed: set FILES in sw.js to '${files}'`);
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
