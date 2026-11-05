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
// The keys whose Spanish reads the same as the English (the language switch's labels by design); every other key's
// Spanish is a translation.
const SAME = ['lang.label', 'lang.en', 'lang.es', 'tablas', 'pace.normal', 'cantor.rate.normal', 'cantor.goodLine', 'print.mini'];
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
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 54, 101, 111].map(E.ord), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '54th', '101st', '111th']);
  assert.deepEqual([1, 5, 22].map(S.ord), ['1.ª', '5.ª', '22.ª']);
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
      assert.equal(await sheetTitle(page), '¡Lotería! — a revisar');
      await page.fill('#vfN', '7');
      assert.equal(await page.textContent('#vfV h3'), 'Todavía no');
      assert.match(await page.textContent('#vfV p'), /^(CANELA|CAPIROTADA) No\. 7 va más cerca de \S.* y le faltan? .+\. Las casillas con borde rojo todavía no salen\.$/);
      assert.equal(await page.textContent('#vfWin'), 'Darla por buena');
      assert.deepEqual(await english(page), [], where + 'English on Not yet');
      await page.click('#vfSeg [data-v="cards"]');
      assert.deepEqual(await english(page), [], where + 'English in Card by card');
      const pick = name => page.locator('#vfPick .pk', { has: page.locator('.n', { hasText: new RegExp('^' + name + '$') }) }).click();
      await pick('El Gallo'); await pick('La Luna');
      assert.deepEqual([await page.textContent('#vfV h3'), await page.textContent('#vfV p')], ['Todavía no', 'La Luna todavía no sale.']);
      await page.locator('#vfChips .chip', { hasText: 'La Luna' }).click();
      assert.deepEqual([await page.textContent('#vfV h3'), await page.textContent('#vfV p')], ['Ya salió', 'Si forman la figura — Clásico — es buena. Ya estaba completa desde hace 4 cartas: El Gallo, la 1.ª en salir.']);
      assert.equal(await page.textContent('#vfWin'), '¡Buena! Ronda nueva');
      assert.deepEqual(await english(page), [], where + 'English on ¡Buena!');
      await page.fill('#vfWho', 'Tía Lupe');
      await page.click('#vfWin');
      await page.waitForSelector('#winbox .winc #celOk');
      assert.equal(await page.textContent('#winbox .winc p'), 'Tía Lupe gana la ronda 2 con 5 cartas.');
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
      assert.equal(await page.textContent('#edb .warn'), 'Dos veces: El Gallo');
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
      assert.equal(await sheetTitle(page), 'Ronda nueva — ¿a qué jugamos?');
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

check('espanol: Make tablas in Spanish, with Print… and Play these in the app…', async () => {
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
      assert.equal(await page.textContent('#dnote'), 'Tabla 1 ya está llena — toca una casilla para cambiarla, o arrastra.');
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
      assert.equal(await page.textContent('#pwarn'), 'Con casillas vacías, que salen en blanco: Tabla 2 (7)');
      const right = await page.$$eval('#paperSeg, #nameSeg', ss => ss.map(s => Math.round(s.getBoundingClientRect().right)));
      assert.equal(right[0], right[1], 'Sí / No isn’t on the right of its row');
      await clean('Print…');
      await page.click('#pdx');
      // Play these in the app…: a link with no name typed goes as Familia.
      await page.click('#appBtn');
      assert.equal(await page.textContent('#dlg h2'), 'Jugar estas en la app');
      assert.equal(await page.textContent('#dlg .note'), 'Hace una liga que abre Mis tablas con estas 4 tablas para quien tú digas. Ábrela aquí o mándala al teléfono o iPad donde se va a jugar. 1 tabla todavía no está llena y se queda.');
      await clean('Play these in the app…');
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

check('cantor: a winner’s name goes from the ¡Lotería! box to the checker, and the tally counts a name once, whatever its capitals', async () => {
  const ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    // Two rounds won by Tío Beto, typed two ways on two phones before.
    const win = (round, who) => ({ round, who, how: 'Clásico', tabla: '', at: 9, t: round });
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
    assert.deepEqual(await verdict(), ['All 3 are out', 'If they make the shape — Clásico — it’s good. It finished on the card just called, La Corona.']);
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
    assert.equal(await page.textContent('#vfV h3'), 'It’s out');
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
    await page.click('#appBtn');
    assert.match(await page.textContent('#dlg .note'), /^Makes a link that opens My tablas with this tabla for whoever you name\./);
    await page.goto(base + 'board.html');
    assert.equal(await page.title(), 'Lotería · My tablas');
    await page.click('#tablasBtn'); await page.click('#tbShare');
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

check('espanol: on a first visit, English | Español on the shared-link sheet keeps the link, and on Who’s playing the name typed', async () => {
  // A phone in English, opening a link with two tablas for Mamá: Español there brings the same offer back in Spanish.
  let ctx = await context(PHONE);
  try {
    const page = await ctx.newPage(), problems = watch(page);
    await page.goto(base + 'board.html#t=Mam%C3%A1~Tabla%201:1.2.3.4.5.6.7.8.9.a.b.c.d.e.f.g~Tabla%202:h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w');
    assert.equal(await sheetTitle(page), 'Tablas from Mamá');
    assert.equal(await page.getAttribute('#shLang [lang="en"]', 'aria-pressed'), 'true');
    await Promise.all([page.waitForEvent('load'), page.click('#shLang [lang="es"]')]);
    await until(page, () => (document.querySelector('#sheet h2') || {}).textContent === 'Tablas de Mamá');
    assert.equal(await page.getAttribute('html', 'lang'), 'es-MX');
    assert.equal(await page.textContent('#sheet .note'), 'Esta liga trae 2 tablas para “Mamá”.');
    assert.equal(await page.evaluate(() => location.hash), '', 'the link was left in the address');
    assert.equal(await saved(page, 'loteria.v1'), null, 'a player was saved before anyone chose');
    await page.click('#imOk');
    assert.deepEqual((await saved(page, 'loteria.v1')).players.map(p => [p.name, p.boards.map(b => b.name + ':' + b.cards.join('.'))]), [['Mamá', ['Tabla 1:' + run(1).join('.'), 'Tabla 2:' + run(17).join('.')]]]);
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
    await page.locator('#pk .pk', { hasText: 'La Rana' }).focus(); await page.keyboard.press(' ');
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
        await page.click('#nextBtn'); // a card first: with nothing called, ¡Lotería! only says ▶ starts the round
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
  // A phone in Spanish, a day after the last sync: "Last synced Nov 5." in English, "el 5 nov." in Spanish.
  const t0 = new Date('2026-11-05T18:00:00Z').getTime();
  for (const [lang, says] of [['en', /Last synced Nov 5\.$/], ['es', /Última sincronización: el 5 nov\.?\.$/]]) {
    const A = await driveDevice(fakeGoogle(), { 'loteria.v1': ANA, 'loteria.lang': lang, 'junkdrawer.google': { token: 'tok-mark', exp: t0 + 3600e3, scope: 'https://www.googleapis.com/auth/drive.file', email: 'mark@gmail.com' } }, { locale: 'es-MX', timezoneId: 'America/Mexico_City' });
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

check('drive: on a phone, a tap on ☁ or Sync now says what went wrong, in English and in Spanish', async () => {
  // Drive's answer when the account's storage is full, as Google's guide "Resolve errors" gives it (403 errors,
  // storageQuotaExceeded); a busy Drive answers 503, and Google says to try those again a little later.
  const FULL = { error: { errors: [{ domain: 'global', reason: 'storageQuotaExceeded', message: 'The user\'s Drive storage quota has been exceeded.' }], code: 403, message: 'The user\'s Drive storage quota has been exceeded.' } };
  const SAYS = {
    en: { offline: 'No connection — your tablas are saved on this device and will sync when you’re back online.', full: 'Your Google Drive is full, so nothing new was saved there. Free some space and tap Sync now.', busy: 'Google Drive is busy — trying again in a minute.', gis: 'Google sign-in didn’t load. Check the connection.' },
    es: { offline: 'Sin conexión — tus tablas están guardadas en este dispositivo y se sincronizan cuando vuelvas a tener conexión.', full: 'Tu Google Drive está lleno, así que no se guardó nada nuevo ahí. Libera espacio y toca Sincronizar ahora.', busy: 'Google Drive está ocupado — se vuelve a intentar en un minuto.', gis: 'No cargó el inicio de sesión de Google. Revisa la conexión.' }
  };
  const answer = (route, status, body) => route.request().method() === 'OPTIONS' ? route.fallback() : route.fulfill({ status, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const said = (page, text) => until(page, t => { const e = document.getElementById('toast'); return e.textContent === t && e.classList.contains('show'); }, text, 8000);
  for (const lang of ['en', 'es']) for (const what of ['offline', 'full', 'busy', 'gis']) {
    const g = fakeGoogle(), expired = what === 'gis', says = SAYS[lang][what], where = lang + ', ' + what + ': ';
    const A = await driveDevice(g, { 'loteria.v1': ANA, 'loteria.print': { tablas: [{ id: 't1', name: 'Tabla 1', cards: run(1) }] }, ...(expired ? { 'junkdrawer.google': { token: 'tok-mark', exp: Date.now() - 60e3, scope: 'https://www.googleapis.com/auth/drive.file', email: 'mark@gmail.com' } } : {}) }, { locale: lang === 'es' ? 'es-MX' : 'en-US' });
    const { ctx, page } = A;
    try {
      const cut = r => r.abort('internetdisconnected'), busy = r => answer(r, 503, { error: { code: 503, message: 'Service Unavailable' } });
      if (what === 'offline') await ctx.route('https://www.googleapis.com/**', cut);
      if (what === 'full') await ctx.route('https://www.googleapis.com/upload/**', r => answer(r, 403, FULL));
      if (what === 'busy') { await ctx.route('https://www.googleapis.com/**', busy); await page.clock.install(); }
      if (what === 'gis') await ctx.route('https://accounts.google.com/gsi/client', r => r.abort());
      const gisFailed = expired && page.waitForEvent('requestfailed', r => r.url().includes('gsi/client'));
      await page.goto(base + (what === 'full' ? 'print.html' : 'board.html'));
      // The sync as the page opens goes wrong quietly; a tap on ☁ says what happened.
      if (expired) await gisFailed; else await until(page, () => document.getElementById('syncBtn').dataset.s === 'error');
      assert.equal(await page.evaluate(() => document.getElementById('toast').classList.contains('show')), false, where + 'a toast without a tap');
      await page.click('#syncBtn');
      await said(page, says).catch(async e => { throw new Error(where + 'the toast says “' + await page.textContent('#toast') + '”, not “' + says + '”'); });
      if (what === 'full') {
        assert.ok(!g.files().some(f => (f.appProperties || {}).loteria === 'sync'), 'a full Drive got the file');
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
  // Offline, checked the junkdrawer house kit's way, from a server that answers like GitHub Pages: a browser may keep
// each file for ten minutes, and asks again by its ETag. `net` is the connection: 'up', 'down' (the server drops every
// connection) or 'stalled' (a plane's or a train's wifi: it takes each request and holds on to it). With `release`
// set it serves the next release. The server's own switches are needed because the browser's offline switch can't
// make a stall, and in some Chromium builds it doesn't stop the service worker's own requests.
{
  const { createServer } = await import('node:http');
  const { readFile } = await import('node:fs/promises');
  const { join, extname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { createHash } = await import('node:crypto');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
  let net = 'up', release = false;
  const held = [];
  const server = createServer((req, res) => {
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
  const base = `http://localhost:${server.address().port}/`;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: 'en-US' });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(e.message));
  await page.goto(base);
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
  await ctx.close();
  server.close();

  // sw.js changes whenever a file it keeps does, so a release replaces the whole offline copy at once: FILES in sw.js
  // is a fingerprint of every file in SHELL (sha1 of each, in the list's order, an address like './' read as its
  // index.html; the first 8 hex of the sha1 of those).
  const sw = await readFile(join(root, 'sw.js'), 'utf8');
  const shell = [...sw.match(/SHELL = \[([^\]]*)\]/)[1].replace(/\/\/.*/g, '').matchAll(/'([^']*)'/g)].map(m => m[1]);
  const all = createHash('sha1');
  for (const f of shell) all.update(createHash('sha1').update(await readFile(join(root, f.endsWith('/') ? f + 'index.html' : f))).digest());
  const files = all.digest('hex').slice(0, 8);
  assert.equal(sw.match(/const FILES = '([0-9a-f]*)'/)?.[1], files, `a file sw.js keeps for offline has changed: set FILES in sw.js to '${files}'`);
}

await browser.close();
  server.close();
}
if (!ran) { console.log('no check matches ' + pick.join(' ')); process.exit(1); }
if (failed) { console.log(`${failed} of ${ran} failed`); process.exit(1); }
console.log(`all ${ran} good`);
