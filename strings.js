// Every word the app shows, in English and in Spanish, and the English / Español setting.
//
// The language is kept per device, in localStorage 'loteria.lang' ('en' or 'es'; Google Drive doesn't carry it).
// With nothing chosen, a device whose first language is Spanish gets Español, and every other one English.
// <html lang> follows the language shown. The card names, verses, shape names and recorded voices are Spanish in both.
//
// Each page loads this in <head>, so the words are ready before anything is drawn:
//   T(key, vars)       the text, with {name} filled in from vars. A count's text is { one, other }, picked by vars.n.
//   T.html(key, vars)  the same for a key ending _html: its own <b> and <a> stay, and the values are escaped.
//                      A key missing in Spanish falls back to English, then to the key itself.
//   T.list(names)      'A, B and C' / 'A, B y C'.        T.ord(5)    '5th' / '5.ª'.
//   T.locale           'en-US' / 'es-MX', for dates.     T.lang      'en' / 'es'.
//   T.apply(root)      fills in markup: data-t (its text), data-t-html, data-t-aria (aria-label), data-t-title
//                      (title) and data-t-ph (placeholder). The markup keeps its English, and a page runs
//                      T.apply(document) right after it, so English never flashes up first.
//   T.switch(host, reopen)  draws the English | Español control. A tap saves the choice and reloads the page; reopen
//                      ('settings') is left in sessionStorage 'loteria.reopen' so the page opens that sheet again.
// test/e2e.mjs's 'strings' check fails when a key is missing in either language, a {value} or a plural form is
// missing on one side, or a key is used nowhere. Change a wording in both languages.
//
// Spanish: Mexican, with tú. One word for each thing:
//   card carta · deck baraja · shuffle barajar · call cantar, a called card una carta cantada (or que ya salió)
//   round ronda · square casilla · bean frijol · shape figura · a printed set juego (only that: never "game")
//   "what are we playing" ¿A qué jugamos? / Elige a qué jugar · Settings Ajustes · Done Listo · link liga
//   printed page hoja · on / off Sí / No · My tablas Mis tablas · Make tablas Hacer tablas
//   Letter paper, beside a count of cards or tablas, is "tamaño carta", so it isn't read as a lotería card.
//   The iPhone's own Settings app is Configuración (Apple's Spanish support pages call it that).
// Spoken Spanish stays as it is: "Felicidades, …", the opening line, and La Luna in Try it.
(function () {
  'use strict';
  var S = {
    en: {
      'lang.label': 'Idioma · Language',
      'lang.en': 'English',
      'lang.es': 'Español',
      'and': ' and ',
      'tool.board': 'My tablas',
      'tool.print': 'Make tablas',
      'foot.part': 'Part of junkdrawer.works',
      'foot.privacy': 'Privacy',

      // the home screen
      'home.sub': 'Call the game, play along, or make your own tablas.',
      'home.nav': 'Lotería tools',
      'home.cantor.eyebrow': 'Call the game',
      'home.cantor.text': 'Shuffles the deck and calls each card aloud in Spanish. For the phone or tablet at the head of the table; it checks a ¡Lotería! too.',
      'home.cantor.go': 'Start calling →',
      'home.board.eyebrow': 'Play along',
      'home.board.text': 'Your tablas on your own phone. Tap the card that was called and it marks itself, with a cheer when you win.',
      'home.board.go': 'Open my tablas →',
      'home.print.eyebrow': 'Print',
      'home.print.text': 'Drag and drop cards onto your own tablas, doubles and all, and print them 1, 2 or 4 to a page.',
      'home.print.go': 'Make tablas →',
      'home.privacy': 'Everything stays on this device: no accounts, nothing sent anywhere.',
      'home.privacyDrive': 'Everything stays on this device unless you save to Google Drive, which keeps your tablas in a Lotería folder in your own Drive.',
      'home.juegos_html': 'Numbered juegos that El Cantor checks by number print from El Cantor’s <b>Print tablas</b>.'
    },
    es: {
      'lang.label': 'Idioma · Language',
      'lang.en': 'English',
      'lang.es': 'Español',
      'and': ' y ',
      'tool.board': 'Mis tablas',
      'tool.print': 'Hacer tablas',
      'foot.part': 'Parte de junkdrawer.works',
      'foot.privacy': 'Privacidad',

      // the home screen
      'home.sub': 'Canta la lotería, juega en tu teléfono o haz tus propias tablas.',
      'home.nav': 'Herramientas de lotería',
      'home.cantor.eyebrow': 'Canta la lotería',
      'home.cantor.text': 'Baraja las cartas y canta cada una en voz alta. Para el teléfono o la tableta en la cabecera de la mesa; también revisa una ¡Lotería!',
      'home.cantor.go': 'Empezar a cantar →',
      'home.board.eyebrow': 'Juega',
      'home.board.text': 'Tus tablas en tu propio teléfono. Toca la carta que cantaron y se marca sola, con festejo cuando ganas.',
      'home.board.go': 'Abrir mis tablas →',
      'home.print.eyebrow': 'Imprime',
      'home.print.text': 'Arrastra cartas a tus propias tablas, con dobles y todo, e imprímelas de 1, 2 o 4 por hoja.',
      'home.print.go': 'Hacer tablas →',
      'home.privacy': 'Todo se queda en este dispositivo: sin cuentas, nada se manda a ningún lado.',
      'home.privacyDrive': 'Todo se queda en este dispositivo, a menos que guardes en Google Drive: ahí tus tablas van a una carpeta Lotería en tu propio Drive.',
      'home.juegos_html': 'Los juegos numerados, que El Cantor revisa por número, se imprimen desde <b>Imprimir tablas</b> en El Cantor.'
    }
  };

  var KEY = 'loteria.lang', nav = window.navigator || {};
  function chosen() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) { }
    if (v === 'en' || v === 'es') return v;
    var first = nav.languages && nav.languages.length ? nav.languages[0] : nav.language || '';
    return /^es(-|$)/i.test(first) ? 'es' : 'en';
  }
  var lang = chosen();
  try { document.documentElement.lang = lang === 'es' ? 'es-MX' : 'en'; } catch (e) { }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function text(key, vars, html) {
    var v = S[lang][key];
    if (v == null) v = S.en[key];
    if (v == null) return key;
    if (typeof v === 'object') v = vars && vars.n === 1 ? v.one : v.other;
    return v.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? (html ? esc(vars[k]) : String(vars[k])) : m; });
  }
  function T(key, vars) { return text(key, vars, false); }
  T.html = function (key, vars) { return text(key, vars, true); };
  T.lang = lang;
  T.locale = lang === 'es' ? 'es-MX' : 'en-US';
  T.list = function (names) { return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + T('and') + names[names.length - 1]; };
  T.ord = function (n) {
    if (lang === 'es') return n + '.ª'; // la 5.ª carta: a card is feminine
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  T.apply = function (root) {
    function each(attr, f) { var els = root.querySelectorAll('[' + attr + ']'); for (var i = 0; i < els.length; i++) f(els[i], els[i].getAttribute(attr)); }
    each('data-t', function (el, k) { el.textContent = T(k); });
    each('data-t-html', function (el, k) { el.innerHTML = T.html(k); });
    each('data-t-aria', function (el, k) { el.setAttribute('aria-label', T(k)); });
    each('data-t-title', function (el, k) { el.title = T(k); });
    each('data-t-ph', function (el, k) { el.placeholder = T(k); });
  };
  T.set = function (to, reopen) {
    if (to === lang || !S[to]) return;
    try { localStorage.setItem(KEY, to); } catch (e) { }
    try { if (reopen) sessionStorage.setItem('loteria.reopen', reopen); } catch (e) { }
    location.reload();
  };
  // Each label in its own language (the same in both tables), so someone who reads only one of them can find it.
  T.switch = function (host, reopen) {
    var label = { en: T('lang.en'), es: T('lang.es') };
    host.innerHTML = '<div class="seg lang" role="group" aria-label="' + esc(T('lang.label')) + '">' + ['en', 'es'].map(function (l) {
      return '<button type="button" lang="' + l + '" data-lang="' + l + '" aria-pressed="' + (l === lang) + '"' + (l === lang ? ' class="on"' : '') + '>' + esc(label[l]) + '</button>';
    }).join('') + '</div>';
    var bs = host.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) bs[i].addEventListener('click', function () { T.set(this.getAttribute('data-lang'), reopen); });
  };
  T.S = S; // the tables, for test/e2e.mjs
  window.T = T;
})();
