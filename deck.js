/* Lotería deck: the cards, their verses, the winning shapes and the juego generator.
   The play-along board (markjf99702/loteria-cards) carries the same file; keep the two
   in step so printed tablas and wins agree. Card images are found beside the page, or
   wherever the script tag points: <script src="deck.js" data-cards="cards/">. */
(function () {
  'use strict';
  var me = document.currentScript, DIR = (me && me.getAttribute('data-cards')) || '';

  function fold(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ''); }

  var CARDS = [
    ['ElGallo', 'El Gallo', 'El que le cantó a San Pedro no le volverá a cantar.'],
    ['ElDiablito', 'El Diablito', 'Pórtate bien cuatito, si no te lleva el coloradito.'],
    ['LaDama', 'La Dama', 'Puliendo el paso, por toda la calle real.'],
    ['ElCatrin', 'El Catrín', 'Don Ferruco en la alameda, su bastón quería tirar.'],
    ['ElParaguas', 'El Paraguas', 'Para el sol y para el agua.'],
    ['LaSirena', 'La Sirena', 'Con los cantos de sirena, no te vayas a marear.'],
    ['LaEscalera', 'La Escalera', 'Súbeme paso a pasito, no quieras pegar brinquitos.'],
    ['LaBotella', 'La Botella', 'La herramienta del borracho.'],
    ['ElBarril', 'El Barril', 'Tanto bebió el albañil, que quedó como barril.'],
    ['ElArbol', 'El Árbol', 'El que a buen árbol se arrima, buena sombra le cobija.'],
    ['ElMelon', 'El Melón', 'Me lo das o me lo quitas.'],
    ['ElValiente', 'El Valiente', 'Por qué le corres cobarde, trayendo tan buen puñal.'],
    ['ElGorrito', 'El Gorrito', 'Ponle su gorrito al nene, no se nos vaya a resfriar.'],
    ['LaMuerte', 'La Muerte', 'La muerte tilica y flaca.'],
    ['LaPera', 'La Pera', 'El que espera, desespera.'],
    ['LaBandera', 'La Bandera', 'Verde, blanco y colorado, la bandera del soldado.'],
    ['ElBandolon', 'El Bandolón', 'Tocando su bandolón, está el mariachi Simón.'],
    ['ElVioloncello', 'El Violoncello', 'Creciendo se fue hasta el cielo, y como no fue violín, tuvo que ser violoncello.'],
    ['LaGarza', 'La Garza', 'Al otro lado del río tengo mi banco de arena, donde se sienta mi chata, pico de garza morena.'],
    ['ElPajaro', 'El Pájaro', 'Tú me traes a puros brincos, como pájaro en la rama.'],
    ['LaMano', 'La Mano', 'La mano de un criminal.'],
    ['LaBota', 'La Bota', 'Una bota igual que la otra.'],
    ['LaLuna', 'La Luna', 'El farol de los enamorados.'],
    ['ElCotorro', 'El Cotorro', 'Cotorro, cotorro, saca la pata y empiézame a platicar.'],
    ['ElBorracho', 'El Borracho', 'A qué borracho tan necio, ya no lo puedo aguantar.'],
    ['ElNegrito', 'El Negrito', 'El que se comió el azúcar.'],
    ['ElCorazon', 'El Corazón', 'No me extrañes, corazón, que regreso en el camión.'],
    ['LaSandia', 'La Sandía', 'La barriga que Juan tenía, era empacho de sandía.'],
    ['ElTambor', 'El Tambor', 'No te arrugues, cuero viejo, que te quiero pa’ tambor.'],
    ['ElCamaron', 'El Camarón', 'Camarón que se duerme, se lo lleva la corriente.'],
    ['LasJaras', 'Las Jaras', 'Las jaras del indio Adán, donde pegan, dan.'],
    ['ElMusico', 'El Músico', 'El músico trompas de hule, ya no me quiere tocar.'],
    ['LaArana', 'La Araña', 'Atarántamela a palos, no me la dejes llegar.'],
    ['ElSoldado', 'El Soldado', 'Uno, dos y tres, el soldado p’al cuartel.'],
    ['LaEstrella', 'La Estrella', 'La guía de los marineros.'],
    ['ElCazo', 'El Cazo', 'El caso que te hago es poco.'],
    ['ElMundo', 'El Mundo', 'Este mundo es una bola, y nosotros un bolón.'],
    ['ElApache', 'El Apache', '¡Ah, Chihuahua! Cuánto apache con pantalón y huarache.'],
    ['ElNopal', 'El Nopal', 'Al nopal lo van a ver, nomás cuando tiene tunas.'],
    ['ElAlacran', 'El Alacrán', 'El que con la cola pica, le dan una paliza.'],
    ['LaRosa', 'La Rosa', 'Rosita, Rosaura, ven que te quiero ahora.'],
    ['LaCalavera', 'La Calavera', 'Al pasar por el panteón, me encontré un calaverón.'],
    ['LaCampana', 'La Campana', 'Tú con la campana y yo con tu hermana.'],
    ['ElCantarito', 'El Cantarito', 'Tanto va el cántaro al agua, que se quiebra y te moja las enaguas.'],
    ['ElVenado', 'El Venado', 'Saltando va buscando, pero no ve nada.'],
    ['ElSol', 'El Sol', 'La cobija de los pobres.'],
    ['LaCorona', 'La Corona', 'El sombrero de los reyes.'],
    ['LaChalupa', 'La Chalupa', 'Rema que rema Lupita, sentada en su chalupita.'],
    ['ElPino', 'El Pino', 'Fresco y oloroso, en todo tiempo hermoso.'],
    ['ElPescado', 'El Pescado', 'El que por la boca muere, aunque mudo fuere.'],
    ['LaPalma', 'La Palma', 'Palmero, sube a la palma y bájame un coco real.'],
    ['LaMaceta', 'La Maceta', 'El que nace pa’ maceta, no sale del corredor.'],
    ['ElArpa', 'El Arpa', 'Arpa vieja de mi suegra, ya no sirves pa’ tocar.'],
    ['LaRana', 'La Rana', 'Al ver a la verde rana, qué brinco pegó tu hermana.']
  ].map(function (c, i) { return { n: i + 1, f: c[0], name: c[1], verse: c[2], key: fold(c[1]) }; });
  var BYFILE = {}; CARDS.forEach(function (c) { BYFILE[c.f] = c.n; });
  function card(n) { return CARDS[n - 1]; }
  function src(n) { return DIR + card(n).f + '.jpg'; }

  // ---------- patterns (squares are numbered 0–15, row by row) ----------
  function rows() { var o = []; for (var r = 0; r < 4; r++) o.push([r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3]); return o; }
  function cols() { var o = []; for (var c = 0; c < 4; c++) o.push([c, c + 4, c + 8, c + 12]); return o; }
  var SQ = [0, 1, 2, 4, 5, 6, 8, 9, 10].map(function (b) { return [b, b + 1, b + 4, b + 5]; });
  var ALL = []; for (var i = 0; i < 16; i++) ALL.push(i);
  var PATS = [
    { id: 'clasico', name: 'Clásico', sub: '4 in a row, 4 corners, or 4 in a square', combo: ['linea', 'esquinas', 'cuadro'], show: [0, 1, 2, 3, 12, 15, 9, 10] },
    { id: 'linea', name: 'Línea', sub: 'any row, column or diagonal', sets: rows().concat(cols(), [[0, 5, 10, 15], [3, 6, 9, 12]]), show: [0, 1, 2, 3] },
    { id: 'esquinas', name: 'Esquinas', sub: 'the four corners', sets: [[0, 3, 12, 15]] },
    { id: 'centro', name: 'Centro', sub: 'the middle four', sets: [[5, 6, 9, 10]] },
    { id: 'cuadro', name: 'Cuadrito', sub: 'any 2×2 block', sets: SQ, show: [5, 6, 9, 10] },
    { id: 'ele', name: 'La Ele', sub: 'left column + bottom row', sets: [[0, 4, 8, 12, 13, 14, 15]] },
    { id: 'equis', name: 'La Equis', sub: 'both diagonals', sets: [[0, 5, 10, 15, 3, 6, 9, 12]] },
    { id: 'marco', name: 'El Marco', sub: 'the outer ring', sets: [[0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15]] },
    { id: 'rieles', name: 'Rieles', sub: 'the two middle rows', sets: [[4, 5, 6, 7, 8, 9, 10, 11]] },
    { id: 'escalera', name: 'Escalera', sub: 'the two middle columns', sets: [[1, 2, 5, 6, 9, 10, 13, 14]] },
    { id: 'siete', name: 'Siete Loco', sub: 'any seven, anywhere', min: 7, show: [0, 5, 6, 9, 10, 15, 3] },
    { id: 'llena', name: 'Tabla Llena', sub: 'every card', sets: [ALL] }
  ];
  var CLASICO = ['linea', 'esquinas', 'cuadro'];
  function pat(id) { return PATS.filter(function (p) { return p.id === id; })[0]; }
  function isClasico(ids) { return ids.length === 3 && CLASICO.every(function (x) { return ids.indexOf(x) >= 0; }); }
  function gameName(ids) { if (isClasico(ids)) return 'Clásico'; var names = ids.map(function (id) { var q = pat(id); return q ? q.name : id; }); return names.length ? (names.length > 2 ? names[0] + ' +' + (names.length - 1) : names.join(' · ')) : 'Pick a game'; }

  // Which patterns a tabla has completed. `called(n)` says whether card n is out.
  function check(cards, called, ids) {
    var m = []; cards.forEach(function (n, i) { if (called(n)) m.push(i); });
    var hits = [];
    ids.forEach(function (pid) {
      var p = pat(pid); if (!p) return;
      if (p.min) { if (m.length >= p.min) hits.push({ pat: p, cells: m.slice() }); return; }
      for (var i = 0; i < p.sets.length; i++) { var s = p.sets[i]; if (s.every(function (c) { return m.indexOf(c) >= 0; })) { hits.push({ pat: p, cells: s }); return; } }
    });
    return hits;
  }
  // The pattern a tabla is nearest to finishing, with the squares it still needs.
  function closest(cards, called, ids) {
    var best = null;
    ids.forEach(function (pid) {
      var p = pat(pid); if (!p) return;
      if (p.min) {
        var open = []; cards.forEach(function (n, i) { if (!called(n)) open.push(i); });
        var need = Math.max(0, p.min - (16 - open.length));
        if (!best || need < best.need) best = { pat: p, need: need, cells: [], missing: need ? open : [] };
        return;
      }
      p.sets.forEach(function (s) {
        var miss = s.filter(function (c) { return !called(cards[c]); });
        if (!best || miss.length < best.need) best = { pat: p, need: miss.length, cells: s, missing: miss };
      });
    });
    return best;
  }

  // ---------- printed juegos ----------
  // A juego is a numbered set of tablas made from a name, so anyone with the
  // name can rebuild tabla 7 without the paper. Tabla k depends only on the
  // name and on tablas 1…k-1, never on how many were printed. Printed sheets
  // outlive code: never change anything below, add a v2 beside it instead.
  function juegoName(s) { return fold(s).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); }
  function seed(str) { // cyrb128
    var h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (var i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }
  function sfc32(s) {
    var a = s[0], b = s[1], c = s[2], d = s[3];
    var next = function () {
      a |= 0; b |= 0; c |= 0; d |= 0;
      var t = (a + b | 0) + d | 0;
      d = d + 1 | 0; a = b ^ b >>> 9; b = c + (c << 3) | 0; c = (c << 21 | c >>> 11); c = c + t | 0;
      return (t >>> 0) / 4294967296;
    };
    for (var i = 0; i < 12; i++) next();
    return next;
  }
  function shuffleWith(rnd, arr) { var d = arr.slice(); for (var i = d.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = d[i]; d[i] = d[j]; d[j] = t; } return d; }
  var FOURS = PATS[1].sets.concat(PATS[2].sets, SQ); // the Clásico shapes
  function fourKeys(cards) { return FOURS.map(function (s) { return s.map(function (c) { return cards[c]; }).sort(function (x, y) { return x - y; }).join('.'); }); }
  var CACHE = {};
  function juego(name, count) {
    var key = juegoName(name); if (!key) return [];
    var st = CACHE[key];
    if (!st) st = CACHE[key] = { rnd: sfc32(seed('loteria-juego-v1:' + key)), shoe: [], seen: {}, tablas: [] };
    var deck = CARDS.map(function (c) { return c.n; });
    while (st.tablas.length < count) {
      // Deal 16 from a shoe of shuffled decks, so every card is used evenly
      // across the juego. A card already on this tabla waits for the next one.
      var pick = [], held = [];
      while (pick.length < 16) {
        if (!st.shoe.length) st.shoe = shuffleWith(st.rnd, deck);
        var c = st.shoe.pop();
        if (pick.indexOf(c) >= 0) held.push(c); else pick.push(c);
      }
      for (var h = held.length - 1; h >= 0; h--) st.shoe.push(held[h]);
      // Lay it out so no Clásico shape holds the same four cards as a shape
      // on an earlier tabla — two tablas never win on the same call that way.
      var best = null;
      for (var t = 0; t < 24; t++) {
        var lay = shuffleWith(st.rnd, pick), ks = fourKeys(lay);
        if (!best) best = { lay: lay, ks: ks };
        if (!ks.some(function (k) { return st.seen[k]; })) { best = { lay: lay, ks: ks }; break; }
      }
      best.ks.forEach(function (k) { st.seen[k] = 1; });
      st.tablas.push(best.lay);
    }
    return st.tablas.slice(0, count).map(function (t) { return t.slice(); });
  }
  function juegoTabla(name, k) { return k >= 1 && k <= 999 ? juego(name, k)[k - 1] || null : null; }
  var WORDS = ['CANELA', 'CAJETA', 'ELOTE', 'TAMAL', 'ATOLE', 'POZOLE', 'MANGO', 'PAPAYA', 'JICAMA', 'GUAYABA', 'LIMON', 'NIEVE', 'CHURRO', 'CONCHA', 'PAMBAZO', 'TEJOCOTE', 'COMAL', 'MOLCAJETE', 'PIPIAN', 'HORCHATA', 'TAMARINDO', 'CHAYOTE', 'CAPIROTADA', 'BUNUELO'];
  function randomJuego(not) { var w; do { w = WORDS[Math.floor(Math.random() * WORDS.length)]; } while (w === not); return w; }

  window.Loteria = {
    CARDS: CARDS, BYFILE: BYFILE, card: card, src: src, fold: fold,
    PATS: PATS, CLASICO: CLASICO, ALL: ALL, pat: pat, isClasico: isClasico, gameName: gameName, check: check, closest: closest,
    juegoName: juegoName, juego: juego, juegoTabla: juegoTabla, randomJuego: randomJuego
  };
})();
