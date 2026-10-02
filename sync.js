/* Saving to Google Drive, so tablas follow a person from device to device.
   Every page keeps working from localStorage exactly as before. When someone turns this on,
   the parts worth keeping — My tablas, Make tablas, El Cantor's winners and juego — are copied
   into one small file in a "Lotería" folder in their own Google Drive, and what their other
   devices saved there is merged back in.
   Merging is three-way and item by item (a person, a tabla, a win): what this device changed
   since the last sync, what the Drive copy changed, and for an item changed on both, the
   newer change wins. Nothing about this shows away from junkdrawer.works. */
(function () {
  'use strict';
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
  var KEEP_GONE = 180 * 864e5, RETRY = { retry: true };

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
      }
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
      same: function (a, b) { return a.name === b.name && eq(a.cards, b.cards); }
    },
    wins: { // El Cantor's winners (cantor.html)
      key: 'loteria.cantor',
      read: function (o) {
        var items = {}, order = [];
        (o && Array.isArray(o.wins) ? o.wins : []).forEach(function (w) { if (w && w.t && !items['w' + w.t]) { items['w' + w.t] = w; order.push('w' + w.t); } });
        return { items: items, order: order };
      },
      write: function (o, c) { o = o || {}; o.wins = c.order.map(function (id) { return c.items[id]; }).sort(function (a, b) { return a.t - b.t; }); return o; }
    },
    juego: { // the juego El Cantor last printed, so any phone can add those tablas by number
      key: 'loteria.cantor',
      read: function (o) { return o && o.juego ? { items: { juego: { name: String(o.juego) } }, order: ['juego'] } : { items: {}, order: [] }; },
      write: function (o, c) { o = o || {}; o.juego = c.items.juego ? c.items.juego.name : ''; return o; },
      firstRemote: true // a device joining keeps the family's juego rather than its own
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

  // ---------- Google Drive ----------
  var st = Object.assign({ on: false, email: '', name: '', last: 0 }, get(KS) || {}), tok = get(KT);
  var status = 'off', note = '', busy = null, again = false, client = null, gisLoading = false, pushT = null, ups = [], watchers = [];
  function saveSt() { put(KS, st); }
  function live() { return !!(tok && tok.token && tok.exp - 60000 > Date.now() && String(tok.scope || '').indexOf(SCOPE) >= 0); }
  function setStatus(s, n) { status = s; note = n || ''; watchers = watchers.filter(function (f) { try { return f() !== false; } catch (e) { return false; } }); }
  function api(method, path, body, type) {
    if (!tok) return Promise.reject({ auth: true });
    var h = { Authorization: 'Bearer ' + tok.token }; if (type) h['Content-Type'] = type;
    return fetch(API + path, { method: method, headers: h, body: body }).then(function (r) {
      if (r.status === 401) { tok = null; put(KT, null); throw { auth: true }; }
      if (!r.ok) throw { http: r.status };
      return r.status === 204 ? null : r.json();
    });
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
    track();
    var seen = get(KN) || {}, base = get(KB), L = readLocal(), Lc = canon(L), L0 = JSON.parse(Lc), file; // L0: untouched, to see what changed
    return findFile().then(function (f) {
      file = f; return f ? api('GET', 'drive/v3/files/' + f.id + '?alt=media') : null;
    }).then(function (remote) {
      // The first sync on this device — or the Drive file is new or was deleted — merges without a
      // shared history, so nothing on either side counts as removed.
      var first = !base || !file || base.fileId !== file.id, M = { v: 1, at: Date.now(), cols: {} };
      if (first) samePeople(L, colOf(remote, 'people'));
      NAMES.forEach(function (n) { M.cols[n] = mergeCol(COLS[n], L[n], colOf(remote, n), first ? null : colOf(base, n), seen[n] && seen[n].t || {}, first); });
      var up = file && eq(M.cols, remote && remote.cols) ? Promise.resolve(file) : upload(file, M);
      return up.then(function (f2) {
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
        put(KB, { fileId: f2.id, cols: M.cols });
        lookNow();
        st.last = Date.now(); saveSt();
        return changed;
      });
    }).catch(function (e) {
      if (e === RETRY && tries < 4) return run(tries + 1);
      throw e;
    });
  }
  function sync() {
    if (!CLIENT_ID || !st.on) return Promise.resolve([]);
    if (!live()) { setStatus('tap'); return Promise.resolve([]); }
    if (busy) { again = true; return busy; }
    setStatus('busy');
    busy = run(0).then(function (changed) {
      setStatus('ok');
      if (changed.length) ups.forEach(function (f) { try { f(changed); } catch (e) { if (window.console) console.error("Loteria sync: applying synced data failed", e); } });
      return changed;
    }, function (e) {
      if (e && e.auth) setStatus('tap');
      else setStatus('error', e === RETRY ? 'Another device kept saving — try again in a moment.' : 'Couldn’t reach Google Drive. Check the connection and try again.');
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
    s.onload = init; s.onerror = function () { gisLoading = false; setStatus(st.on ? 'tap' : 'off', 'Google sign-in didn’t load. Check the connection.'); };
    document.head.appendChild(s);
  }
  function init() {
    if (client) return;
    client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPE, callback: gotToken,
      error_callback: function (e) { setStatus(st.on ? 'tap' : 'off', e && e.type === 'popup_closed' ? '' : 'Google sign-in didn’t finish.'); }
    });
    setStatus(status, note);
  }
  function gotToken(r) {
    if (!r || r.error || !google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) { setStatus(st.on ? 'tap' : 'off', 'Google Drive wasn’t allowed, so nothing was saved there.'); return; }
    tok = { token: r.access_token, exp: Date.now() + (+r.expires_in || 3600) * 1000, scope: r.scope || SCOPE, email: st.email || (tok && tok.email) || '' }; put(KT, tok);
    st.on = true; saveSt();
    (st.email ? Promise.resolve() : whoami()).then(sync);
  }
  // Turn it on. With a sign-in from any junkdrawer.works app still good, no Google window at all.
  function start() {
    if (!CLIENT_ID) return;
    if (!live()) { signIn(); return; }
    st.on = true; if (!st.email && tok.email) st.email = tok.email; saveSt();
    (st.email ? Promise.resolve() : whoami()).then(sync);
  }
  // Google only opens its window from a tap, so this has to run inside a click handler.
  function signIn() {
    if (!CLIENT_ID) return;
    if (!client) { loadGis(); setStatus(status, 'Google sign-in is still loading — tap again in a second.'); return; }
    var hint = st.email || (tok && tok.email) || '', o = { prompt: hint ? '' : 'select_account' }; if (hint) o.login_hint = hint;
    client.requestAccessToken(o);
  }
  // Stop on this device. The shared sign-in stays for the other apps, and nothing is revoked:
  // revoking cancels Google's permission for every app on this client.
  function disconnect() {
    st = { on: false, email: '', name: '', last: 0 };
    put(KB, null); put(KN, null); saveSt(); setStatus('off');
  }

  // ---------- the bits of page each tool shows ----------
  function ago(t) {
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function line() {
    return status === 'busy' ? 'Syncing…' : status === 'tap' ? 'Tap <b>Sync now</b> to get your latest tablas.' : status === 'error' ? esc(note) : st.last ? 'Last synced ' + ago(st.last) + '.' : '';
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
  function title() {
    return status === 'busy' ? 'Syncing with Google Drive…' : status === 'tap' ? 'Tap to sync your tablas with Google Drive' : status === 'error' ? note + ' Tap to try again.' : 'Synced with Google Drive' + (st.last ? ' ' + ago(st.last) : '') + ' — tap to sync now';
  }
  // A header button: a cloud with a dot (green synced, gold syncing, red needs a tap).
  function chip(btn) {
    if (!btn) return;
    if (!CLIENT_ID) { btn.hidden = true; return; }
    css(); btn.classList.add('lsync'); btn.innerHTML = CLOUD + '<i class="dot"></i>';
    btn.addEventListener('click', now);
    watch(function () { btn.hidden = !st.on; btn.dataset.s = status; btn.title = title(); btn.setAttribute('aria-label', title()); });
  }
  // A settings card: turn it on, see where it's saving, sync now, or stop.
  function card(host) {
    if (!host) return;
    if (!CLIENT_ID) { host.hidden = true; return; }
    css(); loadGis(); host.hidden = false; host.classList.add('lsync-card');
    var armed = false;
    function draw() {
      if (!host.isConnected) return false; // the sheet it was in has closed
      host.innerHTML = st.on
        ? '<div class="eyebrow">Saved to Google Drive</div><p class="note">Tablas are saved to <b>' + esc(st.email || 'your Google Drive') + '</b> and show up on every device where you turn this on. ' + line() + '</p>' +
          '<div class="row"><button class="btn sm" type="button" data-a="now"' + (status === 'busy' ? ' disabled' : '') + '>Sync now</button><button class="btn sec sm" type="button" data-a="off">' + (armed ? 'Tap again to stop' : 'Stop saving on this device') + '</button></div>'
        : '<div class="eyebrow">Save across devices</div><p class="note">Keep your tablas in your own Google Drive, and they’ll be on every phone, tablet and computer where you turn this on. They go in a “Lotería” folder that only the junkdrawer.works apps can open.' + (note ? ' ' + esc(note) : '') + '</p>' +
          '<div class="row"><button class="btn red sm" type="button" data-a="on">Save to Google Drive</button></div>';
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
  function watch(f) { watchers.push(f); f(); }
  function now() { if (!st.on) start(); else if (!live()) signIn(); else sync(); } // inside a tap
  function changed() { // a page saved something
    if (!CLIENT_ID || !st.on || !track()) return;
    clearTimeout(pushT);
    if (live()) pushT = setTimeout(sync, 1500); else setStatus('tap');
  }

  window.LoteriaSync = {
    ready: !!CLIENT_ID,
    isOn: function () { return !!CLIENT_ID && st.on; },
    connect: start, now: now, changed: changed, chip: chip, card: card,
    onUpdate: function (f) { ups.push(f); }, // f(keys): synced data landed in these localStorage keys
    _merge: mergeCol, _cols: COLS // for tests
  };

  if (!CLIENT_ID) return;
  if (st.on) {
    loadGis(); // ready before the first tap
    status = live() ? 'ok' : 'tap';
    if (live()) setTimeout(sync, 0);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && st.on && live() && Date.now() - st.last > 30000) sync(); });
  window.addEventListener('storage', function (e) { // another tab saved: pick it up here too
    if (e.key === KS || e.key === KT) { st = Object.assign({ on: false, email: '', name: '', last: 0 }, get(KS) || {}); tok = get(KT); setStatus(st.on ? (live() ? 'ok' : 'tap') : 'off'); return; }
    if (KEYS.indexOf(e.key) >= 0) ups.forEach(function (f) { try { f([e.key]); } catch (x) { } });
  });
})();
