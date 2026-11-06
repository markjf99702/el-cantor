// The game's logic, checked without a browser:  node test/logic.mjs  (a few seconds; npm test runs it first)
// The juegos' rules across many names, every winning shape against a checker written out from the rules on the screen
// (with doubles, and a card called twice), when a printed tabla first won, the random tablas' rules, and the shuffle's
// fairness. It loads deck.js as the pages do, and takes the functions it checks out of the pages' own source.
// To run some of the checks only, name them:  node test/logic.mjs shuffle
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(root, f), 'utf8');
// A fresh deck.js each time, so a juego is built from nothing, as on a phone that just opened the page.
function loadDeck() {
  const box = { window: {}, document: { currentScript: null } };
  vm.runInNewContext(read('deck.js'), box);
  return box.window.Loteria;
}
// A named function's source, out of a page's script (up to its matching brace).
function fn(html, name) {
  const i = html.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'no function ' + name + ' in the page');
  for (let k = html.indexOf('{', i), depth = 0; k < html.length; k++) {
    if (html[k] === '{') depth++;
    else if (html[k] === '}' && !--depth) return html.slice(i, k + 1);
  }
  throw new Error('function ' + name + ' never ends');
}
const plain = x => JSON.parse(JSON.stringify(x)); // arrays made in the vm, as this file's own
// The same random numbers every run (mulberry32), so a failure can be run again.
function seeded(seed) {
  let a = seed;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const DECK = Array.from({ length: 54 }, (_, i) => i + 1);
// Chi-square to an approximate z (Wilson–Hilferty). A fair source gives |z| under 3 nearly always; the checks fail
// only past 5, so they never fail by chance, and a biased one lands in the hundreds.
const zOf = (x, df) => ((x / df) ** (1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));

const checks = [];
function check(name, run) { checks.push({ name, run }); }

// ---------------------------------------------------------------- juegos
// Every way to make Clásico: the rows, columns and diagonals, the corners, and the 2×2 blocks.
const FOURS = [];
for (let r = 0; r < 4; r++) FOURS.push([r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3]);
for (let c = 0; c < 4; c++) FOURS.push([c, c + 4, c + 8, c + 12]);
FOURS.push([0, 5, 10, 15], [3, 6, 9, 12], [0, 3, 12, 15]);
for (const b of [0, 1, 2, 4, 5, 6, 8, 9, 10]) FOURS.push([b, b + 1, b + 4, b + 5]);

check('juegos: 100 tablas each of 16 different cards, no two alike, every card as often as another, and no Clásico four printed twice', () => {
  const L = loadDeck();
  for (const name of ['CANELA', 'CAJETA', 'ELOTE', 'TAMAL', 'MARK', 'X', 'NAVIDAD2026']) {
    const J = plain(L.juego(name, 100)), sets = new Set(), fours = new Map();
    assert.equal(J.length, 100, name);
    J.forEach((t, i) => {
      const k = name + ' ' + (i + 1);
      assert.equal(t.length, 16, k + ' has ' + t.length + ' squares');
      assert.ok(t.every(n => Number.isInteger(n) && n >= 1 && n <= 54), k + ' has a card that isn’t one: ' + t);
      assert.equal(new Set(t).size, 16, k + ' has a card twice: ' + t);
      const set = t.slice().sort((a, b) => a - b).join();
      assert.ok(!sets.has(set), k + ' has the same cards as an earlier tabla');
      sets.add(set);
      // No four cards that make Clásico on this tabla make it on an earlier one too, so one call never wins twice.
      for (const s of FOURS) {
        const four = s.map(c => t[c]).sort((a, b) => a - b).join();
        assert.ok(!fours.has(four) || fours.get(four) === i, k + ' wins Clásico with the same four cards as tabla ' + (fours.get(four) + 1));
        fours.set(four, i);
      }
    });
    // The deck is dealt out evenly: over any first n tablas, no card is printed more than once more than another.
    for (const n of [27, 54, 100]) {
      const count = new Array(55).fill(0);
      J.slice(0, n).forEach(t => t.forEach(c => count[c]++));
      const c = count.slice(1);
      assert.ok(Math.max(...c) - Math.min(...c) <= 1, name + ' 1–' + n + ' prints a card ' + Math.max(...c) + ' times and another ' + Math.min(...c));
    }
  }
});

check('juegos: a tabla is the same however it’s asked for, and the name is read without accents, case or spaces', () => {
  const want = plain(loadDeck().juego('CAJETA', 20));
  const A = loadDeck(); // tabla by tabla, out of order
  for (const k of [20, 3, 13, 1, 7]) assert.deepEqual(plain(A.juegoTabla('CAJETA', k)), want[k - 1], 'CAJETA ' + k + ' asked for out of order');
  const B = loadDeck(); B.juego('CAJETA', 2); B.juego('CAJETA', 9); // grown in steps
  assert.deepEqual(plain(B.juego('CAJETA', 20)), want);
  const C = loadDeck(), t = C.juegoTabla('CAJETA', 7); t[0] = 99; C.juego('CAJETA', 20)[6][1] = 99; // changing what came back
  assert.deepEqual(plain(C.juegoTabla('CAJETA', 7)), want[6], 'a tabla handed out was changed through the copy');
  for (const [typed, name] of [['cajeta', 'CAJETA'], ['Cájeta', 'CAJETA'], [' ca je ta ', 'CAJETA'], ['Buñuelo', 'BUNUELO'], ['CANELA-1', 'CANELA1'], ['ABCDEFGHIJKLMNOP', 'ABCDEFGHIJKL']]) assert.equal(C.juegoName(typed), name, typed);
  assert.deepEqual(plain(C.juegoTabla('cájeta', 13)), want[12]);
  for (const k of [0, -1, 1000, NaN, null, undefined]) assert.equal(C.juegoTabla('CAJETA', k), null, 'tabla ' + k);
  for (const bad of ['', '!!!', '   ']) assert.equal(C.juego(bad, 3).length, 0, 'a juego named “' + bad + '”');
});

// ---------------------------------------------------------------- winning shapes
// Written out from the shapes as the game picker draws them, not from deck.js.
const R4 = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]], C4 = [[0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15]];
const SHAPES = {
  linea: [...R4, ...C4, [0, 5, 10, 15], [3, 6, 9, 12]], esquinas: [[0, 3, 12, 15]], centro: [[5, 6, 9, 10]],
  cuadro: [0, 1, 2, 4, 5, 6, 8, 9, 10].map(b => [b, b + 1, b + 4, b + 5]),
  ele: [[0, 4, 8, 12, 13, 14, 15]], equis: [[0, 5, 10, 15, 3, 6, 9, 12]], marco: [[0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15]],
  rieles: [[4, 5, 6, 7, 8, 9, 10, 11]], escalera: [[1, 2, 5, 6, 9, 10, 13, 14]], llena: [DECK.slice(0, 16).map(n => n - 1)],
};
// The shapes a tabla has made, and the fewest squares still to cover for any of them. Siete Loco is any seven squares.
function wins(t, called, ids) {
  const marked = t.map(called), won = new Set();
  for (const id of ids) {
    if (id === 'siete') { if (marked.filter(Boolean).length >= 7) won.add(id); }
    else if (SHAPES[id].some(s => s.every(c => marked[c]))) won.add(id);
  }
  return won;
}
function fewest(t, called, ids) {
  let need = Infinity;
  for (const id of ids) {
    if (id === 'siete') need = Math.min(need, Math.max(0, 7 - t.filter(called).length));
    else for (const s of SHAPES[id]) need = Math.min(need, s.filter(c => !called(t[c])).length);
  }
  return need;
}

check('shapes: Loteria.check and closest agree with the rules on every shape and mix, with doubles and a card called twice', () => {
  const L = loadDeck(), rnd = seeded(12345), ri = n => Math.floor(rnd() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const SINGLE = Object.keys(SHAPES).concat('siete');
  assert.deepEqual(plain(L.PATS.filter(p => !p.combo).map(p => p.id)).sort(), SINGLE.slice().sort(), 'the shapes in deck.js');
  const games = [plain(L.CLASICO), ...SINGLE.map(id => [id])];
  for (let i = 0; i < 40; i++) { games.push(shuffle(SINGLE).slice(0, 2 + ri(3))); games.push(plain(L.CLASICO).concat(shuffle(SINGLE.filter(id => L.CLASICO.indexOf(id) < 0)).slice(0, 1 + ri(2)))); }
  // A tabla with no double, one double anywhere, or two or three (the family rule allows a card twice).
  const tabla = kind => {
    const d = shuffle(DECK), t = d.slice(0, 16);
    if (kind === 1) { const at = ri(16); t.splice(at, 1); t.splice(ri(16), 0, t[ri(15)]); }
    if (kind === 2) { const sq = shuffle([...Array(16).keys()]); for (let k = 0; k < 2 + ri(2); k++) t[sq[2 * k]] = t[sq[2 * k + 1]]; }
    return t;
  };
  let cases = 0;
  for (let round = 0; round < 1500; round++) {
    const t = tabla(round % 3), out = shuffle(DECK).slice(0, ri(44));
    if (out.length && round % 5 === 0) out.push(out[0]); // read out twice
    const set = new Set(out), called = n => set.has(n);
    for (const ids of games) {
      cases++;
      const what = JSON.stringify({ tabla: t, called: out, game: ids });
      const hits = L.check(t, called, ids), want = wins(t, called, ids);
      assert.deepEqual(plain(hits.map(h => h.pat.id)).sort(), [...want].sort(), 'check: ' + what);
      for (const h of hits) {
        assert.ok(h.cells.every(c => called(t[c])), 'check names a square not called: ' + what);
        assert.ok(h.pat.id === 'siete' ? h.cells.length >= 7 : SHAPES[h.pat.id].some(s => s.join() === h.cells.join()), 'check names squares that aren’t the shape: ' + what);
      }
      const near = L.closest(t, called, ids);
      assert.equal(near.need, fewest(t, called, ids), 'closest: ' + what);
      assert.equal(near.need === 0, want.size > 0, 'closest and check disagree: ' + what);
      if (!near.pat.min) assert.deepEqual(plain(near.missing), plain(near.cells).filter(c => !called(t[c])), 'closest’s missing squares: ' + what);
    }
  }
  assert.ok(cases > 100000, cases + ' cases');
});

check('shapes: the fewest squares each game wins with, which card by card goes by', () => {
  // Every set of squares on a tabla of 16 different cards, the smallest that wins by the rules written out above.
  // Card by card says a tabla with fewer cards than half of these can't have won yet, a card covering two at most.
  const L = loadDeck(), t = DECK.slice(0, 16), SINGLE = Object.keys(SHAPES).concat('siete');
  const games = [plain(L.CLASICO), ...SINGLE.map(id => [id]), ['ele', 'llena'], ['marco', 'rieles'], ['siete', 'equis'], plain(L.CLASICO).concat('siete')];
  for (const ids of games) {
    let least = 99;
    for (let m = 1; m < 1 << 16; m++) {
      let k = 0; for (let b = m; b; b &= b - 1) k++;
      if (k < least && wins(t, n => m >> (n - 1) & 1, ids).size) least = k;
    }
    assert.equal(L.squaresNeeded(ids), least, JSON.stringify(ids));
  }
  assert.equal(L.squaresNeeded(['llena']), 16);
});

// ---------------------------------------------------------------- when a printed tabla first won
check('cantor: when a tabla first won is the card that finished its earliest shape, call by call', () => {
  const html = read('cantor.html'), L = loadDeck(), C = { order: [], pos: 0 };
  const page = new Function('C', 'L', [fn(html, 'orderOf'), fn(html, 'isOut'), fn(html, 'wonAt'), 'return { wonAt };'].join('\n'))(C, L);
  // As the checker does it (printed() in cantor.html): the earliest win among the game's shapes.
  const earliest = t => { let best = null; C.patterns.forEach(id => { const p = L.pat(id), w = page.wonAt(t, p); if (w && (!best || w.when < best.when)) best = { when: w.when, cells: w.cells, id }; }); return best; };
  const rnd = seeded(99), ri = n => Math.floor(rnd() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const SINGLE = L.PATS.filter(p => !p.combo).map(p => p.id), tablas = plain(L.juego('CANELA', 40).concat(L.juego('LAB', 40)));
  for (let round = 0; round < 4000; round++) {
    C.order = shuffle(DECK); C.pos = ri(55);
    C.patterns = round % 3 === 0 ? L.CLASICO.slice() : round % 3 === 1 ? [SINGLE[ri(SINGLE.length)]] : shuffle(SINGLE).slice(0, 2 + ri(3));
    let t = tablas[ri(tablas.length)];
    if (round % 4 === 0) { t = t.slice(); t[6] = t[5]; } // a double, as on a hand-made tabla
    // Call by call: the first card after which the tabla wins.
    let first = null;
    for (let k = 1; k <= C.pos && !first; k++) { const out = new Set(C.order.slice(0, k)), h = L.check(t, n => out.has(n), C.patterns); if (h.length) first = { when: k, ids: h.map(x => x.pat.id) }; }
    const got = earliest(t), what = JSON.stringify({ tabla: t, order: C.order, pos: C.pos, game: C.patterns });
    if (!first) { assert.equal(got, null, 'a win nobody made: ' + what); continue; }
    assert.ok(got, 'a win missed: ' + what);
    assert.equal(got.when, first.when, 'won on the wrong card: ' + what);
    assert.ok(first.ids.includes(got.id), 'won with a shape it didn’t make then: ' + what);
    assert.ok(got.cells.every(c => C.order.indexOf(t[c]) < got.when), 'outlines a square called later: ' + what);
  }
});

// ---------------------------------------------------------------- random tablas
check('random: My tablas’ Random tabla deals 16 different cards; Make tablas’ Random makes one like Mark’s four, and Fill the rest keeps what’s there', () => {
  const L = loadDeck(), CARDS = L.CARDS, board = read('board.html'), print = read('print.html');
  const randomBoard = new Function('CARDS', fn(board, 'uid') + fn(board, 'randomBoard') + 'return randomBoard;')(CARDS);
  const P = { set: { doubles: true } };
  const make = new Function('CARDS', 'P', ['uid', 'shuffle', 'deckNums', 'blank', 'filled', 'familyCards', 'fillTabla', 'randomTabla'].map(n => fn(print, n)).join('\n') + 'return { fillTabla, randomTabla, blank };')(CARDS, P);
  const N = 20000, square = Array.from({ length: 16 }, () => new Float64Array(55));
  for (let i = 0; i < N; i++) {
    const t = randomBoard('x').cards;
    assert.ok(t.length === 16 && new Set(t).size === 16 && t.every(n => n >= 1 && n <= 54), 'My tablas’ Random tabla: ' + t);
    t.forEach((n, k) => square[k][n]++);
  }
  let x = 0;
  for (let k = 0; k < 16; k++) for (let n = 1; n <= 54; n++) x += (square[k][n] - N / 54) ** 2 / (N / 54);
  assert.ok(Math.abs(zOf(x, 16 * 53)) < 5, 'My tablas’ Random tabla favours some cards in some squares (z=' + zOf(x, 16 * 53).toFixed(1) + ')');
  // Doubles on: 15 cards, one of them twice, side by side in the middle (squares 6 and 7, or 10 and 11), like Mark's.
  const doubled = new Float64Array(55), where = { 5: 0, 9: 0 };
  for (let i = 0; i < N; i++) {
    const t = make.randomTabla('x').cards, count = {};
    t.forEach(n => { count[n] = (count[n] || 0) + 1; });
    const twice = Object.keys(count).filter(n => count[n] === 2).map(Number);
    assert.ok(t.length === 16 && Object.keys(count).length === 15 && twice.length === 1 && t.every(n => n >= 1 && n <= 54), 'Make tablas’ Random: ' + t);
    const at = t.indexOf(twice[0]);
    assert.ok((at === 5 || at === 9) && t[at + 1] === twice[0], 'Make tablas’ Random put the double elsewhere: ' + t);
    where[at]++; doubled[twice[0]]++;
  }
  x = 0;
  for (let n = 1; n <= 54; n++) x += (doubled[n] - N / 54) ** 2 / (N / 54);
  assert.ok(Math.abs(zOf(x, 53)) < 5, 'Make tablas’ Random doubles some cards more than others');
  assert.ok(Math.abs(where[5] - where[9]) < 6 * Math.sqrt(N / 4), 'the double sits in one middle row far more than the other: ' + JSON.stringify(where));
  P.set.doubles = false;
  for (let i = 0; i < 2000; i++) assert.equal(new Set(make.randomTabla('x').cards).size, 16, 'Doubles off, and Random dealt a double');
  P.set.doubles = true;
  // Fill the rest: the cards already placed stay where they are, and only new cards fill the gaps.
  const rnd = seeded(7);
  for (let i = 0; i < 5000; i++) {
    const t = make.blank('x');
    for (let k = 1 + Math.floor(rnd() * 15); k > 0; k--) t.cards[Math.floor(rnd() * 16)] = 1 + Math.floor(rnd() * 10);
    const before = t.cards.slice(), had = new Set(before.filter(Boolean));
    make.fillTabla(t);
    assert.ok(t.cards.every(n => n >= 1 && n <= 54), 'Fill the rest left a gap: ' + t.cards);
    assert.ok(before.every((n, k) => !n || t.cards[k] === n), 'Fill the rest moved a card: ' + before + ' → ' + t.cards);
    const added = t.cards.filter((n, k) => !before[k]);
    assert.ok(added.every(n => !had.has(n)) && new Set(added).size === added.length, 'Fill the rest added a card again: ' + before + ' → ' + t.cards);
  }
});

// ---------------------------------------------------------------- the shuffle
check('shuffle: El Cantor deals every card in every place equally often, and the next card is never favoured', () => {
  const html = read('cantor.html'), L = loadDeck();
  const make = (window, src) => new Function('window', 'crypto', 'CARDS', src + '\nreturn shuffled;')(window, window.crypto, L.CARDS);
  const own = fn(html, 'rand') + '\n' + fn(html, 'shuffled');
  const score = shuffled => {
    const N = 6000, place = Array.from({ length: 55 }, () => new Float64Array(54)), next = Array.from({ length: 55 }, () => new Float64Array(55));
    for (let s = 0; s < N; s++) {
      const d = shuffled();
      assert.ok(d.length === 54 && new Set(d).size === 54, 'a shuffle that isn’t the whole deck');
      for (let i = 0; i < 54; i++) { place[d[i]][i]++; if (i < 53) next[d[i]][d[i + 1]]++; }
    }
    let x1 = 0, x2 = 0;
    for (let c = 1; c <= 54; c++) for (let i = 0; i < 54; i++) x1 += (place[c][i] - N / 54) ** 2 / (N / 54);
    for (let a = 1; a <= 54; a++) for (let b = 1; b <= 54; b++) if (a !== b) x2 += (next[a][b] - N / 54) ** 2 / (N / 54);
    return [zOf(x1, 53 * 53), zOf(x2, 54 * 53 - 1)];
  };
  for (const [what, shuffled] of [['with the browser’s crypto', make({ crypto: globalThis.crypto }, own)], ['with Math.random, where there’s no crypto', make({}, own)]]) {
    const [z1, z2] = score(shuffled);
    assert.ok(Math.abs(z1) < 5, 'El Cantor’s shuffle ' + what + ' favours some cards in some places (z=' + z1.toFixed(1) + ')');
    assert.ok(Math.abs(z2) < 5, 'El Cantor’s shuffle ' + what + ' favours some cards after others (z=' + z2.toFixed(1) + ')');
  }
  // The usual mistake (picking from the whole deck at every step) scores in the hundreds, so the check can tell.
  const [bad] = score(make({ crypto: globalThis.crypto }, own.replace('rand(i + 1)', 'rand(d.length)')));
  assert.ok(bad > 20, 'the check can’t tell a biased shuffle (z=' + bad.toFixed(1) + ')');
});

// ---------------------------------------------------------------- run them
const pick = process.argv.slice(2).map(s => s.toLowerCase());
let failed = 0, ran = 0;
for (const c of checks) {
  if (pick.length && !pick.some(w => c.name.toLowerCase().includes(w))) continue;
  ran++;
  try { await c.run(); console.log('ok    ' + c.name); }
  catch (e) { failed++; console.log('FAIL  ' + c.name + '\n      ' + String(e && e.message || e).split('\n').join('\n      ')); }
}
if (!ran) { console.log('no check matches ' + pick.join(' ')); process.exit(1); }
if (failed) { console.log(`${failed} of ${ran} failed`); process.exit(1); }
console.log(`all ${ran} good`);
