/* Saving to Google Drive, so tablas follow a person from device to device.
   Every page keeps working from localStorage exactly as before. When someone turns this on,
   the parts worth keeping — My tablas, Make tablas, El Cantor's winners and juegos — are copied
   into one small file in a "Lotería" folder in their own Google Drive, and what their other
   devices saved there is merged back in.
   Merging is three-way and item by item (a person, a tabla, a win): what this device changed
   since the last sync, what the Drive copy changed, and for an item changed on both, the
   newer change wins. Nothing about this shows away from junkdrawer.works.
   Its words come from strings.js, which every page loads first, in the language chosen there. */
(function () {
  'use strict';
  var T = window.T;
  // The junkdrawer.works OAuth client, shared with Shelfmark and Terraville (README, "Saving to
  // Google Drive"). Google only accepts it from these addresses, so elsewhere nothing shows.
  // El Cantor lives at its own address now; junkdrawer.works/el-cantor/ forwards there.
  var ORIGINS = ['https://el-cantor.junkdrawer.works', 'https://junkdrawer.works'];
  var CLIENT_ID = ORIGINS.indexOf(location.origin) >= 0 ? '897653851078-p5jrh2bto6h3bj0lc4jist3k1vsc1pj4.apps.googleusercontent.com' : '';
  // drive.file, like every junkdrawer.works app: Google lets the apps on this client see only the
  // files they made. Ours are a "Lotería" folder and one file in it, found by their appProperties.
  var SCOPE = 'https://www.googleapis.com/auth/drive.file', API = 'https://www.googleapis.com/';
  var FOLDER = { name: 'Lotería', mimeType: 'application/vnd.google-apps.folder', appProperties: { loteria: 'folder' } };
  var FILE = { name: 'Lotería tablas.json', mimeType: 'application/json', appProperties: { loteria: 'sync' } };
  // KT is the key every junkdrawer.works app keeps its sign-in under: good for an hour, and it remembers the account.
  var KS = 'loteria.sync', KT = 'junkdrawer.google', KB = 'loteria.sync.base', KN = 'loteria.sync.seen';
  var KEEP_GONE = 180 * 864e5, RETRY = { retry: true }, NEWER = { newer: true }, STOPPED = { stopped: true };
  var VERSION = 1; // the Drive file's shape; a file with a higher v was saved by a newer El Cantor

  function get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function put(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function canon(x) { // JSON with sorted keys, so the same data always compares equal
    if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
    if (x && typeof x === 'object') return '{' + Object.keys(x).sort().filter(function (k) { return x[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + canon(x[k]); }).join(',') + '}';
    return x === undefined ? 'null' : JSON.stringify(x);
  }
  function eq(a, b) { return a === undefined || b === undefined ? a === b : canon(a) === canon(b); }
  function low(s) { return String(s || '').trim().toLowerCase(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function okCards(c) { return Array.isArray(c) && c.length === 16 && c.every(function (n) { return n === (n | 0) && n >= 0 && n <= 54; }); }
  function tabla(b) { return { id: b.id, name: String(b.name || ''), cards: b.cards.slice() }; }
  function players(o) { return (o && Array.isArray(o.players) ? o.players : []).filter(function (p, i, a) { return p && p.id && a.findIndex(function (q) { return q && q.id === p.id; }) === i; }); }

  // ---------- what gets saved, and where each page keeps it ----------
  var COLS = {
    people: { // My tablas (board.html): who plays on the device…
      key: 'loteria.v1',
      read: function (o) {
        var items = {}, order = [];
        players(o).forEach(function (p) { items[p.id] = { name: String(p.name || '') }; order.push(p.id); });
        return { items: items, order: order };
      },
      write: function (o, c) {
        o = o || {};
        var old = {}, was = null;
        players(o).forEach(function (p) { old[p.id] = p; if (p.id === o.current) was = p; });
        o.players = c.order.map(function (id) { return { id: id, name: c.items[id].name, boards: old[id] ? old[id].boards : [] }; });
        if (!o.players.some(function (p) { return p.id === o.current; })) {
          var same = was && o.players.filter(function (p) { return low(p.name) === low(was.name); })[0];
          o.current = same ? same.id : o.players.length ? o.players[0].id : undefined;
        }
        return o;
      },
      ok: function (v) { return !!v && typeof v.name === 'string'; },
      firstRemote: true // someone set up as "mark" on a device joining keeps the family's "Mark"
    },
    boards: { // …and each of their tablas, merged one tabla at a time
      key: 'loteria.v1',
      read: function (o) {
        var items = {}, order = [];
        players(o).forEach(function (p) {
          (Array.isArray(p.boards) ? p.boards : []).forEach(function (b) {
            if (!b || !b.id || items[b.id] || !okCards(b.cards)) return;
            items[b.id] = { p: p.id, name: String(b.name || ''), cards: b.cards.slice() }; order.push(b.id);
          });
        });
        return { items: items, order: order };
      },
      write: function (o, c) {
        o = o || {}; o.players = players(o);
        o.players.forEach(function (p) { p.boards = []; });
        c.order.forEach(function (id) { var b = c.items[id], p = o.players.filter(function (x) { return x.id === b.p; })[0]; if (p) p.boards.push({ id: id, name: b.name, cards: b.cards }); });
        return o;
      },
      ok: function (v) { return !!v && v.p != null && typeof v.name === 'string' && okCards(v.cards); },
      same: function (a, b) { return a.p === b.p && a.name === b.name && eq(a.cards, b.cards); } // the same tabla on two devices before they first synced
    },
    tablas: { // Make tablas (print.html)
      key: 'loteria.print',
      read: function (o) {
        var items = {}, order = [];
        (o && Array.isArray(o.tablas) ? o.tablas : []).forEach(function (t) { if (!t || !t.id || items[t.id] || !okCards(t.cards)) return; var v = tabla(t); delete v.id; items[t.id] = v; order.push(t.id); });
        return { items: items, order: order };
      },
      write: function (o, c) { o = o || {}; o.tablas = c.order.map(function (id) { return { id: id, name: c.items[id].name, cards: c.items[id].cards }; }); return o; },
      ok: function (v) { return !!v && typeof v.name === 'string' && okCards(v.cards); },
      same: function (a, b) { return a.name === b.name && eq(a.cards, b.cards); }
    },
    wins: { // El Cantor's winners (cantor.html)
      key: 'loteria.cantor',
      read: function (o) {
        var items = {}, order = [];
        (o && Array.isArray(o.wins) ? o.wins : []).forEach(function (w) { if (w && w.t && !items['w' + w.t]) { items['w' + w.t] = w; order.push('w' + w.t); } });
        return { items: items, order: order };
      },
      write: function (o, c) { o = o || {}; o.wins = c.order.map(function (id) { return c.items[id]; }).sort(function (a, b) { return a.t - b.t; }); return o; },
      ok: function (v) { return !!v && typeof v.t === 'number'; }
    },
    juego: { // the juego El Cantor last printed or checked, so any phone can add those tablas by number
      key: 'loteria.cantor',
      read: function (o) { return o && o.juego ? { items: { juego: { name: String(o.juego) } }, order: ['juego'] } : { items: {}, order: [] }; },
      write: function (o, c) { o = o || {}; o.juego = c.items.juego ? c.items.juego.name : ''; return o; },
      ok: function (v) { return !!v && typeof v.name === 'string'; },
      firstRemote: true // a device joining keeps the family's juego rather than its own
    },
    printed: { // how many tablas El Cantor printed of each juego, so its checker knows a number past them is misheard
      key: 'loteria.cantor',
      read: function (o) {
        var items = {}, order = [], p = o && o.printed && typeof o.printed === 'object' ? o.printed : {};
        Object.keys(p).forEach(function (name) { var n = p[name]; if (n === (n | 0) && n > 0) { items['j:' + name] = { name: name, count: n }; order.push('j:' + name); } });
        return { items: items, order: order };
      },
      write: function (o, c) { o = o || {}; o.printed = {}; c.order.forEach(function (id) { o.printed[c.items[id].name] = c.items[id].count; }); return o; },
      ok: function (v) { return !!v && typeof v.name === 'string' && v.count === (v.count | 0) && v.count > 0; },
      later: true // came after the Drive file's first shape: a copy saved without it isn't damaged
    }
  };
  var NAMES = Object.keys(COLS), KEYS = NAMES.map(function (n) { return COLS[n].key; }).filter(function (k, i, a) { return a.indexOf(k) === i; });

  function readLocal() {
    var raw = {}, out = {};
    KEYS.forEach(function (k) { raw[k] = get(k); });
    NAMES.forEach(function (n) { out[n] = COLS[n].read(raw[COLS[n].key]); });
    return out;
  }
  // Remember when each item last changed on this device, by comparing with the last look.
  function track() {
    if (!st.on) return false;
    var seen = get(KN) || {}, now = Date.now(), loc = readLocal(), dirty = false;
    NAMES.forEach(function (n) {
      var s = seen[n] || (seen[n] = { v: {}, t: {} }), items = loc[n].items, ids = {};
      Object.keys(items).concat(Object.keys(s.v)).forEach(function (id) { ids[id] = 1; });
      Object.keys(ids).forEach(function (id) {
        var j = items[id] === undefined ? undefined : canon(items[id]);
        if (j === s.v[id]) return;
        if (j === undefined) delete s.v[id]; else s.v[id] = j;
        s.t[id] = now; dirty = true;
      });
    });
    if (dirty) put(KN, seen);
    return dirty;
  }
  function lookNow() { // after a sync: what's on this device is what was synced
    var loc = readLocal(), seen = {};
    NAMES.forEach(function (n) { seen[n] = { v: {}, t: {} }; Object.keys(loc[n].items).forEach(function (id) { seen[n].v[id] = canon(loc[n].items[id]); }); });
    put(KN, seen);
  }

  // ---------- the merge ----------
  // L: this device {items, order}. R and B: {items: {id: {v, t}}, order, gone: {id: t}}, the Drive
  // copy now and as of this device's last sync (B is null the first time). T: when items changed here.
  function mergeCol(c, L, R, B, T, first) {
    var now = Date.now(), loc = {}, order = L.order.slice(), out = { items: {}, order: [], gone: {} };
    Object.keys(L.items).forEach(function (id) { loc[id] = L.items[id]; });
    if (first && c.same) Object.keys(loc).forEach(function (id) {
      if (R.items[id]) return;
      var match = Object.keys(R.items).filter(function (rid) { return !loc[rid] && c.same(loc[id], R.items[rid].v); })[0];
      if (!match) return;
      loc[match] = R.items[match].v; delete loc[id];
      order = order.map(function (x) { return x === id ? match : x; });
    });
    var ids = {};
    [loc, R.items, B ? B.items : {}, R.gone].forEach(function (o) { Object.keys(o).forEach(function (id) { ids[id] = 1; }); });
    Object.keys(ids).forEach(function (id) {
      var l = loc[id], r = R.items[id], rv = r ? r.v : undefined, rt = r ? r.t : R.gone[id] || 0;
      var bv = B && B.items[id] ? B.items[id].v : undefined, lt = T[id] || now, take;
      var lc = !eq(l, bv), rc = !eq(rv, bv);
      if (!lc) take = 'r';
      else if (!rc) take = 'l';
      else if (eq(l, rv)) take = 'r';
      else if (first) take = c.firstRemote && rv !== undefined ? 'r' : l !== undefined ? 'l' : 'r';
      else take = lt >= rt ? 'l' : 'r';
      if (take === 'r') { if (r) out.items[id] = r; else if (R.gone[id] && now - R.gone[id] < KEEP_GONE) out.gone[id] = R.gone[id]; }
      else if (l !== undefined) out.items[id] = { v: l, t: lt };
      else out.gone[id] = lt;
    });
    var has = {};
    function add(id) { if (out.items[id] && !has[id]) { has[id] = 1; out.order.push(id); } }
    order.forEach(add); R.order.forEach(add); Object.keys(out.items).forEach(add);
    return out;
  }
  // Before a device's first sync, someone set up under the same name on another device is the
  // same person: use the Drive copy's id for them, so their tablas from both devices sit together.
  function samePeople(L, R) {
    Object.keys(L.people.items).forEach(function (id) {
      if (R.items[id]) return;
      var match = Object.keys(R.items).filter(function (rid) { return !L.people.items[rid] && low(R.items[rid].v.name) === low(L.people.items[id].name); })[0];
      if (!match) return;
      L.people.items[match] = L.people.items[id]; delete L.people.items[id];
      L.people.order = L.people.order.map(function (x) { return x === id ? match : x; });
      Object.keys(L.boards.items).forEach(function (b) { if (L.boards.items[b].p === id) L.boards.items[b].p = match; });
    });
  }
  function colOf(file, n) { var c = file && file.cols && file.cols[n] || {}; return { items: c.items || {}, order: c.order || [], gone: c.gone || {} }; }
  // The Drive copy as this version reads it. A damaged one (empty, cut short, a part missing or not what it should be)
  // gives what can be kept of it and says it was damaged, so a missing part is never read as everything in it removed.
  // One saved by a newer El Cantor, which this version can't read, is left alone.
  function readDrive(text) {
    var o = null; try { o = JSON.parse(text); } catch (e) { }
    var whole = !!o && typeof o === 'object' && !Array.isArray(o), damaged = !whole || o.v !== VERSION, out = { v: VERSION, gen: whole && typeof o.gen === 'string' ? o.gen : undefined, cols: {} };
    if (whole && typeof o.v === 'number' && o.v > VERSION) return { newer: true };
    var cols = whole && o.cols && typeof o.cols === 'object' ? o.cols : {};
    NAMES.forEach(function (n) {
      var c = cols[n], col = out.cols[n] = { items: {}, order: [], gone: {} };
      if (!c && COLS[n].later) return;
      if (!c || typeof c !== 'object' || !c.items || typeof c.items !== 'object' || !Array.isArray(c.order) || !c.gone || typeof c.gone !== 'object') { damaged = true; return; }
      Object.keys(c.items).forEach(function (id) { var it = c.items[id]; if (it && typeof it.t === 'number' && COLS[n].ok(it.v)) col.items[id] = it; else damaged = true; });
      c.order.forEach(function (id) { if (col.items[id] && col.order.indexOf(id) < 0) col.order.push(id); });
      Object.keys(c.gone).forEach(function (id) { if (typeof c.gone[id] === 'number') col.gone[id] = c.gone[id]; });
    });
    return { file: out, damaged: damaged };
  }
  function newGen() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // ---------- Google Drive ----------
  var st = Object.assign({ on: false, email: '', name: '', last: 0 }, get(KS) || {}), tok = get(KT);
  var status = 'off', note = '', busy = null, again = false, client = null, gisLoading = false, gisFailed = false, pushT = null, ups = [], watchers = [], says = [], waits = [];
  var asked = false, busyT = null, busyTried = false, era = 0; // era: one more each Stop, so a sync begun before it writes nothing
  function saveSt() { put(KS, st); }
  function live() { return !!(tok && tok.token && tok.exp - 60000 > Date.now() && String(tok.scope || '').indexOf(SCOPE) >= 0); }
  // note is a key in strings.js, so it's said in the language the page is in when it's drawn. When a tap (☁, Sync
  // now, Save to Google Drive) ends with something gone wrong, the page says it too: a phone never shows the ☁
  // button's title. Sign-in still loading is said, and the tap waits for what comes of it.
  function setStatus(s, n) {
    status = s; note = n || '';
    watchers = watchers.filter(function (f) { try { return f() !== false; } catch (e) { return false; } });
    if (!asked || s === 'busy') return;
    if (note && s !== 'ok') says.forEach(function (f) { try { f(T(note)); } catch (e) { } });
    if (note !== 'sync.stillLoading') asked = false;
  }
  function api(method, path, body, type, text) { // text: the answer as it came, for a file's contents
    if (!tok) return Promise.reject({ auth: true });
    var h = { Authorization: 'Bearer ' + tok.token }; if (type) h['Content-Type'] = type;
    return fetch(API + path, { method: method, headers: h, body: body }).then(function (r) {
      if (r.status === 401) { tok = null; put(KT, null); throw { auth: true }; }
      if (!r.ok) return r.json().then(null, function () { return null; }).then(function (b) { throw { http: r.status, reason: reason(b) }; });
      return r.status === 204 ? null : text ? r.text() : r.json();
    }, function () { throw { net: true }; }); // no answer at all: no connection
  }
  // Why Drive said no, as Google's guide "Resolve errors" lists it: {error: {errors: [{reason: 'storageQuotaExceeded'}]}}.
  function reason(b) { var e = b && b.error, x = e && e.errors && e.errors[0]; return x && x.reason || e && e.status || ''; }
  // A sync that went wrong says what happened. A busy Drive (429, a 5xx, or a 403 rate limit; Google's guide says
  // to try those again a little later) gets one more try by itself, a minute on.
  function failed(e) {
    if (e && e.auth) return setStatus('tap');
    if (e === RETRY) return setStatus('error', 'sync.busyAgain');
    if (e === NEWER) return setStatus('error', 'sync.newer');
    if (e && e.net) return setStatus('error', 'sync.offline');
    if (e && e.http === 403 && e.reason === 'storageQuotaExceeded') return setStatus('error', 'sync.full');
    if (e && (e.http === 429 || e.http >= 500 || e.http === 403 && /^(user)?[rR]ateLimitExceeded$/.test(e.reason))) {
      if (busyTried) return setStatus('error', 'sync.stillBusy');
      if (!busyT) busyT = setTimeout(function () { busyT = null; busyTried = true; sync(); }, 60000);
      return setStatus('error', 'sync.busy');
    }
    setStatus('error', 'sync.noReach');
  }
  function find(meta, fields) {
    var k = Object.keys(meta.appProperties)[0], q = "appProperties has { key='" + k + "' and value='" + meta.appProperties[k] + "' } and trashed=false";
    return api('GET', 'drive/v3/files?spaces=drive&orderBy=createdTime&pageSize=10&fields=' + encodeURIComponent('files(' + fields + ')') + '&q=' + encodeURIComponent(q))
      .then(function (x) { return x && x.files && x.files[0] || null; });
  }
  function findFile() { return find(FILE, 'id,version'); }
  function folder() { // the "Lotería" folder in their Drive, made the first time
    return find(FOLDER, 'id').then(function (f) {
      return f ? f.id : api('POST', 'drive/v3/files?fields=id', JSON.stringify(FOLDER), 'application/json').then(function (x) { return x.id; });
    });
  }
  function upload(file, data) {
    var body = JSON.stringify(data);
    if (!file) return folder().then(function (dir) {
      var b = 'loteria-' + Date.now().toString(36), meta = Object.assign({ parents: [dir] }, FILE);
      return api('POST', 'upload/drive/v3/files?uploadType=multipart&fields=id,version',
        '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
        '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + body + '\r\n--' + b + '--', 'multipart/related; boundary=' + b);
    });
    // Another device may have saved since we read the file; then start over with its version.
    return api('GET', 'drive/v3/files/' + file.id + '?fields=version').then(function (x) {
      if (String(x.version) !== String(file.version)) throw RETRY;
      return api('PATCH', 'upload/drive/v3/files/' + file.id + '?uploadType=media&fields=id,version', body, 'application/json');
    });
  }
  function whoami() {
    return api('GET', 'drive/v3/about?fields=' + encodeURIComponent('user(displayName,emailAddress)')).then(function (x) {
      st.email = x && x.user && x.user.emailAddress || ''; st.name = x && x.user && x.user.displayName || ''; saveSt();
      if (tok) { tok.email = st.email; put(KT, tok); } // so the next junkdrawer.works app can skip the account chooser
    }, function () { });
  }

  function run(tries) {
    var mine = era;
    function still(x) { if (mine !== era) throw STOPPED; return x; } // Stop was tapped meanwhile: this sync goes no further
    track();
    var seen = get(KN) || {}, base = get(KB), L = readLocal(), Lc = canon(L), L0 = JSON.parse(Lc), file; // L0: untouched, to see what changed
    return findFile().then(still).then(function (f) {
      file = f; return f ? api('GET', 'drive/v3/files/' + f.id + '?alt=media', null, null, true) : null;
    }).then(still).then(function (text) {
      var got = file ? readDrive(text) : { file: null, damaged: false }, remote = got.file;
      if (got.newer) throw NEWER; // nothing read, nothing written over: the newer El Cantor saved it
      // The first sync on this device — or the Drive file is new, was deleted or was damaged — merges without a
      // shared history, so nothing on either side counts as removed. A damaged file is put right from this device
      // under a new gen, which tells every other device to merge that way once too, so none of them loses tablas
      // the damage hid.
      var first = !base || !file || base.fileId !== file.id || got.damaged || (base.gen || '') !== (remote.gen || '');
      var M = { v: VERSION, gen: !file || got.damaged ? newGen() : remote.gen, at: Date.now(), cols: {} };
      if (first) samePeople(L, colOf(remote, 'people'));
      NAMES.forEach(function (n) { M.cols[n] = mergeCol(COLS[n], L[n], colOf(remote, n), first ? null : colOf(base, n), seen[n] && seen[n].t || {}, first); });
      var up = file && !got.damaged && eq(M.cols, remote.cols) ? Promise.resolve(file) : upload(file, M).then(still);
      return up.then(still).then(function (f2) {
        if (canon(readLocal()) !== Lc) throw RETRY; // changed here meanwhile: merge again
        var objs = {}, changed = [];
        NAMES.forEach(function (n) {
          var c = COLS[n], m = { items: {}, order: M.cols[n].order };
          m.order.forEach(function (id) { m.items[id] = M.cols[n].items[id].v; });
          if (eq(m, L0[n])) return;
          if (!(c.key in objs)) objs[c.key] = get(c.key);
          objs[c.key] = c.write(objs[c.key], m);
          if (changed.indexOf(c.key) < 0) changed.push(c.key);
        });
        changed.forEach(function (k) { put(k, objs[k]); });
        put(KB, { fileId: f2.id, gen: M.gen, cols: M.cols });
        lookNow();
        st.last = Date.now(); saveSt();
        return changed;
      });
    }).catch(function (e) {
      if (e === RETRY && tries < 4) { still(); return run(tries + 1); } // unless Stop was tapped meanwhile: a fresh try would sync after all
      throw e;
    });
  }
  function sync() {
    if (!CLIENT_ID || !st.on) return Promise.resolve([]);
    if (!live()) { setStatus('tap'); return Promise.resolve([]); }
    if (busy) { again = true; return busy; }
    setStatus('busy');
    busy = run(0).then(function (changed) {
      clearTimeout(busyT); busyT = null; busyTried = false;
      setStatus('ok'); lapse();
      if (changed.length) ups.forEach(function (f) { try { f(changed); } catch (e) { if (window.console) console.error("Loteria sync: applying synced data failed", e); } });
      return changed;
    }, function (e) {
      if (e !== STOPPED) failed(e);
      return [];
    }).then(function (changed) {
      busy = null;
      if (again) { again = false; return sync(); }
      return changed;
    });
    return busy;
  }

  // ---------- signing in (Google Identity Services, in a popup) ----------
  function loadGis() {
    if (!CLIENT_ID || client) return;
    if (window.google && google.accounts && google.accounts.oauth2) { init(); return; }
    if (gisLoading) return;
    gisLoading = true;
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = init; s.onerror = function () { gisLoading = false; gisFailed = true; setStatus(st.on ? 'tap' : 'off', 'sync.gisLoad'); };
    document.head.appendChild(s);
  }
  function init() {
    if (client) return;
    client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPE, callback: gotToken,
      error_callback: function (e) { var closed = e && e.type === 'popup_closed'; setStatus(st.on ? 'tap' : 'off', closed ? '' : 'sync.gisDone'); } // closed by hand: nothing to say
    });
    gisFailed = false;
    setStatus(status, note === 'sync.gisLoad' || note === 'sync.stillLoading' ? '' : note); // it has loaded now
  }
  function gotToken(r) {
    if (!r || r.error || !google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) { setStatus(st.on ? 'tap' : 'off', 'sync.denied'); return; }
    var picked = st.pick; // the account may be another one: who it is comes from Drive
    tok = { token: r.access_token, exp: Date.now() + (+r.expires_in || 3600) * 1000, scope: r.scope || SCOPE, email: picked ? '' : st.email || (tok && tok.email) || '' }; put(KT, tok);
    st.on = true; delete st.pick; saveSt();
    (st.email ? Promise.resolve() : whoami()).then(sync);
  }
  // Turn it on. With a sign-in from any junkdrawer.works app still good, no Google window at all.
  function start() {
    if (!CLIENT_ID) return;
    asked = true;
    if (!live() || st.pick) { signIn(); return; }
    st.on = true; if (!st.email && tok.email) st.email = tok.email; saveSt();
    (st.email ? Promise.resolve() : whoami()).then(sync);
  }
  // Google only opens its window from a tap, so this has to run inside a click handler.
  function signIn() {
    if (!CLIENT_ID) return;
    // Not loaded yet: it's still on its way, or it didn't come at all (and is asked for again).
    if (!client) { var lost = gisFailed; loadGis(); setStatus(status, lost ? 'sync.gisLoad' : 'sync.stillLoading'); return; }
    // After Stop saving, Google asks which account, so a family tablet can move to someone else's Drive.
    var hint = st.pick ? '' : st.email || (tok && tok.email) || '', o = { prompt: hint ? '' : 'select_account' }; if (hint) o.login_hint = hint;
    client.requestAccessToken(o);
  }
  // Stop on this device. The shared sign-in stays for the other apps, and nothing is revoked:
  // revoking cancels Google's permission for every app on this client.
  // A sync still under way stops where it is and leaves nothing behind, and turning it on again asks which account.
  function disconnect() {
    era++; clearTimeout(pushT); pushT = null; clearTimeout(busyT); busyT = null; busyTried = false; clearTimeout(lapseT); lapseT = null;
    st = { on: false, email: '', name: '', last: 0, pick: true };
    put(KB, null); put(KN, null); saveSt(); setStatus('off');
  }

  // ---------- the bits of page each tool shows ----------
  function ago(t) { // the date in the language shown, not the device's
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return T('sync.justNow');
    if (s < 3600) return T('sync.minAgo', { n: Math.round(s / 60) });
    if (s < 86400) return T('sync.hAgo', { n: Math.round(s / 3600) });
    return T('sync.onDate', { date: new Date(t).toLocaleDateString(T.locale, { month: 'short', day: 'numeric' }) });
  }
  // Something saved on this device since the last sync, still to go to Drive.
  function waiting() {
    var base = get(KB), loc = readLocal();
    return !base || NAMES.some(function (n) { var b = colOf(base, n).items, v = {}; Object.keys(b).forEach(function (id) { v[id] = b[id].v; }); return !eq(v, loc[n].items); });
  }
  // El Cantor (cantor) has no ☁ button and no tablas of its own: after the hour, its card says whether what it saved waits here.
  function line(cantor) {
    return status === 'busy' ? esc(T('sync.syncing')) : status === 'tap' ? (note ? esc(T(note)) + ' ' : '') + (cantor ? T.html(waiting() ? 'sync.c.wait_html' : 'sync.c.tapNow_html') : T.html('sync.tapNow_html')) : status === 'error' ? esc(T(note)) + (WHOLE[note] ? '' : ' ' + esc(T('sync.tryNow'))) : st.last ? esc(T('sync.last', { ago: ago(st.last) })) : '';
  }
  var CLOUD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18.5h10.5a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.7 9.1 4.7 4.7 0 0 0 7 18.5z"/></svg>';
  function css() {
    if (document.getElementById('lsync-css')) return;
    var s = document.createElement('style'); s.id = 'lsync-css';
    s.textContent = '.lsync{position:relative}.lsync svg{width:18px;height:18px;display:block}' +
      '.lsync .dot{position:absolute;right:2px;top:2px;width:9px;height:9px;border-radius:50%;background:#3E7D4A;box-shadow:0 0 0 2px var(--paper,#FBF4E4)}' +
      '.lsync[data-s=busy] .dot{background:#D99A2B;animation:lsyncp .8s ease-in-out infinite alternate}' +
      '.lsync[data-s=tap] .dot,.lsync[data-s=error] .dot{background:#B7332F}' +
      '@keyframes lsyncp{from{opacity:.25}to{opacity:1}}@media (prefers-reduced-motion:reduce){.lsync .dot{animation:none!important}}' +
      '.lsync-card .row{margin-top:8px}.lsync-card p{margin:6px 0 0}';
    document.head.appendChild(s);
  }
  // The notes say what happened; "try again" is added once, by the ☁ button's title and the card, unless a note
  // already says what comes next.
  var WHOLE = { 'sync.full': 1, 'sync.busy': 1, 'sync.stillBusy': 1, 'sync.stillLoading': 1, 'sync.newer': 1 };
  function title() {
    if (status === 'busy') return T('sync.t.busy');
    if ((status === 'tap' || status === 'error') && note) return WHOLE[note] ? T(note) : T('sync.t.error', { note: T(note) });
    return status === 'tap' ? T('sync.t.tap') : st.last ? T('sync.t.okAgo', { ago: ago(st.last) }) : T('sync.t.ok');
  }
  // A header button: a cloud with a dot (green synced, gold syncing, red needs a tap).
  function chip(btn) {
    if (!btn) return;
    if (!CLIENT_ID) { btn.hidden = true; return; }
    css(); btn.classList.add('lsync'); btn.innerHTML = CLOUD + '<i class="dot"></i>';
    btn.addEventListener('click', now);
    watch(function () { btn.hidden = !st.on; btn.dataset.s = status; btn.title = title(); btn.setAttribute('aria-label', title()); });
  }
  // A settings card: turn it on, see where it's saving, sync now, or stop. El Cantor's (cantor) says what it saves.
  function card(host, cantor) {
    if (!host) return;
    if (!CLIENT_ID) { host.hidden = true; return; }
    css(); loadGis(); host.hidden = false; host.classList.add('lsync-card');
    var armed = false;
    function draw() {
      if (!host.isConnected) return false; // the sheet it was in has closed
      var wrong = status === 'error' || cantor && status === 'tap' && waiting(); // then it doesn't say "Saved to", nor while El Cantor's winner waits here
      host.innerHTML = st.on
        ? '<div class="eyebrow">' + T(wrong ? 'sync.errH' : 'sync.savedH') + '</div><p class="note">' + T.html(cantor ? 'sync.c.savedTo_html' : 'sync.savedTo_html', { email: st.email || T('sync.yourDrive') }) + ' ' + line(cantor) + '</p>' +
          '<div class="row"><button class="btn sm" type="button" data-a="now"' + (status === 'busy' ? ' disabled' : '') + '>' + T('sync.now') + '</button><button class="btn sec sm" type="button" data-a="off">' + T(armed ? 'sync.stopAgain' : 'sync.stop') + '</button></div>'
        : '<div class="eyebrow">' + T('sync.offH') + '</div><p class="note">' + esc(T(cantor ? 'sync.c.offNote' : 'sync.offNote')) + (note ? ' ' + esc(T(note)) : '') + '</p>' +
          '<div class="row"><button class="btn red sm" type="button" data-a="on">' + T('sync.on') + '</button></div>';
      host.querySelectorAll('button[data-a]').forEach(function (b) {
        b.addEventListener('click', function () {
          var a = b.dataset.a;
          if (a === 'on') start();
          else if (a === 'now') now();
          else if (!armed) { armed = true; draw(); }
          else { armed = false; disconnect(); }
        });
      });
    }
    watch(draw);
  }
  // ---------- keeping tablas in a Safari tab ----------
  // Safari deletes everything a website saved after seven days of Safari use without a visit, while a web app on the
  // Home Screen keeps its own count (WebKit blog, "Full Third-Party Cookie Blocking and More", 24 March 2020). So in a
  // Safari tab on an iPhone or iPad, with Drive saving off, My tablas and Make tablas say how to keep the tablas, in a
  // line that goes once it's dismissed (remembered on the device). Every page also asks the browser to keep its saves,
  // which Safari 17 grants on signs like being opened from the Home Screen (WebKit blog, "Updates to Storage Policy",
  // 10 August 2023). Firefox would ask the person with a prompt, so it isn't asked there.
  var KK = 'loteria.keepNote', persisting = false;
  function ios() { var ua = navigator.userAgent || ''; return /iPhone|iPad|iPod/.test(ua) || /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; } // an iPad asks for the computer site
  function homeScreen() { return navigator.standalone === true || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
  function safariTab() {
    var ua = navigator.userAgent || '';
    return ios() && !homeScreen() && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua); // Safari itself, not another browser
  }
  function persist() {
    var s = navigator.storage;
    if (persisting || !s || !s.persist || /Firefox\//.test(navigator.userAgent)) return;
    persisting = true;
    (s.persisted ? s.persisted() : Promise.resolve(false)).then(function (yes) { return yes || s.persist(); }).catch(function () { });
  }
  // host: an empty element for the line. moved(): the line came or went, for a page that fits itself to the room left.
  function keep(host, moved) {
    if (!host) return;
    if (!safariTab()) { host.hidden = true; return; }
    host.classList.add('lkeep'); keepCss();
    host.innerHTML = '<span>' + esc(T(CLIENT_ID ? 'keep.drive' : 'keep.home')) + '</span><button type="button" aria-label="' + esc(T('keep.dismiss')) + '" title="' + esc(T('keep.dismiss')) + '">×</button>';
    function draw() { var was = host.hidden; host.hidden = !!get(KK) || !!(CLIENT_ID && st.on); if (was !== host.hidden && moved) moved(); }
    host.querySelector('button').addEventListener('click', function () { put(KK, Date.now()); draw(); });
    host.hidden = true; watch(draw);
  }
  function keepCss() {
    if (document.getElementById('lkeep-css')) return;
    var s = document.createElement('style'); s.id = 'lkeep-css';
    s.textContent = '.lkeep{display:flex;gap:6px;align-items:flex-start;background:var(--gold-soft,#F6E3B4);border:1px solid var(--line2,#C4AE84);border-radius:12px;padding:7px 4px 7px 12px;font-size:12.5px;line-height:1.35;color:var(--ink,#2B221C)}' +
      '.lkeep span{flex:1;min-width:0}.lkeep button{flex:none;background:none;border:0;width:30px;height:30px;margin:-5px 0;border-radius:999px;font-size:18px;line-height:1;color:var(--ink2,#6A5A4C)}';
    document.head.appendChild(s);
  }

  // ---------- keeping the screen on ----------
  // Screen Wake Lock, which El Cantor and My tablas ask for while there's a game to see. An iPhone or iPad app on the
  // Home Screen couldn't keep its screen on before iOS 18.4: the request succeeds there and the screen sleeps anyway
  // (MDN browser-compat-data, api.WakeLock, Safari on iOS 16.4–18.3: "Does not work in standalone Home Screen Web
  // Apps", WebKit bug 254545). An iPhone says its iOS version; an iPad doesn't, so there window.cookieStore, which came
  // in the same iOS 18.4 (MDN browser-compat-data, api.CookieStore), says it.
  function canWake() {
    if (!navigator.wakeLock) return false;
    if (!ios() || !homeScreen()) return true;
    var v = /OS (\d+)_(\d+)/.exec(navigator.userAgent || '');
    return v ? +v[1] > 18 || (+v[1] === 18 && +v[2] >= 4) : 'cookieStore' in window;
  }
  // want(): whether the page wants its screen on now. The page calls hold() whenever that may have changed; coming back
  // into sight asks again by itself, as the browser lets go of the screen while the page is out of sight. When the
  // device won't keep it on, why() says what to do instead (empty when it will), and cant() hears it the first time.
  function screenOn(want, cant) {
    var lock = null, refused = false, told = false;
    function why() { return canWake() && !refused ? '' : T(ios() ? 'awake.cantIos' : 'awake.cant'); }
    function no() { if (!told) { told = true; if (cant) cant(why()); } }
    function hold() {
      var on = !!want() && document.visibilityState === 'visible';
      if (on && !canWake()) { no(); return; }
      if (on && !lock) {
        lock = 'asking';
        navigator.wakeLock.request('screen').then(function (l) {
          lock = l; refused = false;
          l.addEventListener('release', function () { if (lock === l) lock = null; });
          hold(); // let go again if it isn't wanted any more
        }, function () { lock = null; if (document.visibilityState === 'visible') { refused = true; no(); } }); // not when it went out of sight meanwhile
      } else if (!on && lock && lock !== 'asking') { var l = lock; lock = null; l.release().catch(function () { }); }
    }
    document.addEventListener('visibilitychange', hold);
    return { hold: hold, why: why, held: function () { return !!lock && lock !== 'asking'; } };
  }

  function watch(f) { watchers.push(f); f(); }
  function now() { if (!st.on) { start(); return; } asked = true; if (!live()) signIn(); else sync(); } // inside a tap
  function changed() { // a page saved something
    if (!CLIENT_ID || !st.on || !track()) return;
    clearTimeout(pushT);
    if (live()) pushT = setTimeout(function () { pushT = null; sync(); }, 1500);
    else { setStatus('tap'); waits.forEach(function (f) { try { f(); } catch (e) { } }); }
  }
  // Leaving the page (another app, the phone locked, the tab closed) sends a change still waiting to go now: a phone
  // stops a page's timers once it's out of sight, and the change would wait until El Cantor was opened again.
  function leaving() { if (pushT && st.on) { clearTimeout(pushT); pushT = null; if (live()) sync(); } }
  // The hour runs out with a page open: the dot turns red then, not at the next change.
  var lapseT = null;
  function lapse() {
    clearTimeout(lapseT); lapseT = null;
    if (!st.on || !tok || !tok.token) return;
    var ms = tok.exp - 60000 - Date.now(); // live() stops trusting a token a minute early
    if (ms > 0) lapseT = setTimeout(lapse, Math.min(ms + 100, 864e5));
    else if (status === 'ok') setStatus('tap');
  }

  window.LoteriaSync = {
    ready: !!CLIENT_ID,
    isOn: function () { return !!CLIENT_ID && st.on; },
    connect: start, now: now, changed: changed, chip: chip, card: card, keep: keep,
    safariTab: safariTab, // a Safari tab on an iPhone or iPad, not the Home Screen app
    screenOn: screenOn, // keeping the screen on: screenOn(want, cant) gives { hold, why, held }
    onUpdate: function (f) { ups.push(f); }, // f(keys): synced data landed in these localStorage keys
    onNote: function (f) { says.push(f); }, // f(text): what went wrong after a tap, to show for a few seconds
    onWait: function (f) { waits.push(f); }, // f(): something was saved here after the hour, and waits for a tap to go to Drive
    _merge: mergeCol, _cols: COLS, _read: readDrive // for tests
  };

  persist();
  if (!CLIENT_ID) return;
  if (st.on) {
    loadGis(); // ready before the first tap
    status = live() ? 'ok' : 'tap';
    if (live()) { setTimeout(sync, 0); lapse(); }
  }
  document.addEventListener('visibilitychange', function () {
    if (!st.on) return;
    if (document.hidden) leaving();
    else if (!live()) lapse(); // back after the hour: red, as it would have turned had the phone been awake
    else if (Date.now() - st.last > 30000) sync();
  });
  window.addEventListener('pagehide', leaving);
  window.addEventListener('online', function () { if (st.on && live() && status === 'error') sync(); }); // back from no connection
  window.addEventListener('storage', function (e) { // another tab saved: pick it up here too
    if (e.key === KS || e.key === KT) { st = Object.assign({ on: false, email: '', name: '', last: 0 }, get(KS) || {}); tok = get(KT); setStatus(st.on ? (live() ? 'ok' : 'tap') : 'off'); lapse(); return; }
    if (KEYS.indexOf(e.key) >= 0) ups.forEach(function (f) { try { f([e.key]); } catch (x) { } });
  });
})();
