/* Leonux OS 2.1 — Live store repositories (LX.repos).
   The App Store is web-based and "live": any static host (GitHub, raw.githubusercontent,
   GitHub Pages, any web server) that serves a repo.json manifest can be added as a source.
   Items — apps, themes, widgets and sound packs — download from the repository, install
   into the OS, persist in local storage, and keep working fully offline afterwards.
   The OS itself stays a separate body from the store. */
(function () {
  'use strict';
  const H = LX.h;

  const LKEY = 'repos.list';        // registered repos [{id,name,url,home,maintainer,desc,version,bundled,addedAt,lastSync,error}]
  const CKEY = 'repos.catalogs';    // { repoId: repoJson }  (offline cache of live catalogs)
  const IKEY = 'repos.items';       // installed { 'type:id': {type,id,repoId,version,t,def} }
  const DIR = '/usr/store';

  let repos = LX.store.get(LKEY, []);
  let caches = LX.store.get(CKEY, {});
  let items = LX.store.get(IKEY, {});

  const saveList = () => LX.store.set(LKEY, repos);
  const saveCaches = () => LX.store.set(CKEY, caches);
  const saveItems = () => LX.store.set(IKEY, items);
  const emit = () => LX.bus.emit('repos:change', {});
  const keyOf = (type, id) => type + ':' + id;
  const appIdOf = (id) => 'rp_' + String(id).toLowerCase().replace(/[^a-z0-9-]/g, '_');

  function bumpCmp(a, b) {
    const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x < y ? -1 : 1; }
    return 0;
  }

  // ---------------- URL detection ----------------
  /* accepts:
     https://github.com/owner/repo
     https://github.com/owner/repo/tree/branch[/subdir]
     https://github.com/owner/repo/blob/branch/path/repo.json
     https://raw.githubusercontent.com/owner/repo/branch/repo.json
     owner/repo shorthand · any URL ending with repo.json · any base URL (tries /repo.json) */
  function candidates(input) {
    const s = String(input || '').trim().replace(/\s+/g, '');
    if (!s) return [];
    const out = [];
    let m;
    if ((m = s.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)\/blob\/([^/\s#?]+)\/(.+)$/i))) {
      out.push('https://raw.githubusercontent.com/' + m[1] + '/' + m[2].replace(/\.git$/, '') + '/' + m[3] + '/' + m[4]);
    } else if ((m = s.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)(?:\/tree\/([^/\s#?]+)(?:\/([^\s#?]*))?)?\/?$/i))) {
      const owner = m[1], repo = m[2].replace(/\.git$/, '');
      const sub = (m[4] ? m[4].replace(/\/+$/, '') + '/' : '');
      const branches = m[3] ? [m[3]] : ['main', 'master', 'gh-pages'];
      branches.forEach((b) => out.push('https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + b + '/' + sub + 'repo.json'));
    } else if ((m = s.match(/^([\w.-]+)\/([\w.-]+)$/)) && !/^https?:/i.test(s) && s.indexOf('.') > 0 === false) {
      ['main', 'master', 'gh-pages'].forEach((b) => out.push('https://raw.githubusercontent.com/' + m[1] + '/' + m[2] + '/' + b + '/repo.json'));
    } else if ((m = s.match(/^https?:\/\/raw\.githubusercontent\.com\/.+\.json$/i)) || /\.json$/i.test(s) && /^https?:/i.test(s)) {
      out.push(s);
    }
    if (!out.length && /^https?:\/\//i.test(s)) {
      const base = s.replace(/\/+$/, '');
      out.push(base + '/repo.json', base + '/store/repo.json');
    }
    return out;
  }

  // ---------------- bundled starter store (file:// support) ----------------
  /* From file:// browsers refuse fetch(); the bundled store is therefore also shipped as
     store/starter.js (window.LX_STARTER, built by scripts/build_starter.py) which is loaded
     lazily via a <script> tag whenever the built-in store cannot be fetched. */
  const IS_FILE = location.protocol === 'file:';
  let starterP = null;
  function loadStarter() {
    if (window.LX_STARTER) return Promise.resolve(window.LX_STARTER);
    if (starterP) return starterP;
    starterP = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = location.pathname.replace(/[^/]*$/, '') + 'store/starter.js';
      if (IS_FILE) s.src = new URL('store/starter.js', location.href).href;
      s.onload = () => window.LX_STARTER ? resolve(window.LX_STARTER) : (starterP = null, reject(new Error('Starter store is empty')));
      s.onerror = () => { starterP = null; s.remove(); reject(new Error('Starter store bundle is unavailable')); };
      document.head.appendChild(s);
    });
    return starterP;
  }
  // relative path inside store/ for same-origin built-in URLs ('repo.json', 'apps/x.json', 'apps/x.zip'), else null
  function starterRel(url) {
    const u = String(url || '').split('?')[0].split('#')[0];
    if (/^https?:/i.test(u) && u.indexOf(location.origin) !== 0) return null;
    const m = u.match(/(?:^|\/)store\/(repo\.json|apps\/[^/]+\.(?:json|zip))$/);
    return m ? m[1] : null;
  }
  function starterJSON(rel) {
    return loadStarter().then((S) => {
      if (rel === 'repo.json') return S.repo;
      const m = rel.match(/^apps\/([^/]+)\.json$/);
      if (m && S.apps && S.apps[m[1]]) return S.apps[m[1]];
      throw new Error('Not in the bundled store: ' + rel);
    });
  }
  function b64bytes(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  function starterZip(rel) {
    const m = rel && rel.match(/^apps\/([^/]+)\.zip$/);
    if (!m) return Promise.reject(new Error('Not a bundled package'));
    return loadStarter().then((S) => { if (!S.zips || !S.zips[m[1]]) throw new Error('Package not in the bundled store'); return b64bytes(S.zips[m[1]]); });
  }

  function fetchJSON(url, ms) {
    const rel = starterRel(url);
    if (rel && IS_FILE) return starterJSON(rel);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || 12000);
    return fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + '_lx=' + Date.now(), { signal: ctl.signal, cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then((txt) => { let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('Not valid JSON'); } if (!j || typeof j !== 'object') throw new Error('Not a manifest'); return j; })
      .catch((e) => { if (rel) return starterJSON(rel).catch(() => { throw e; }); throw e; })
      .finally(() => clearTimeout(t));
  }
  function validManifest(j) { return !!(j && (j.sections && typeof j.sections === 'object' || Array.isArray(j.items))); }

  function countsOf(json) {
    const s = (json && json.sections) || {};
    return { apps: (s.apps || []).length, themes: (s.themes || []).length, widgets: (s.widgets || []).length, soundpacks: (s.soundpacks || []).length };
  }

  // ---------------- repo registry ----------------
  function add(input, opts) {
    opts = opts || {};
    const urls = candidates(input);
    if (!urls.length) return Promise.reject(new Error('That does not look like a repository URL. Paste a GitHub repo link (github.com/owner/repo), a raw repo.json URL, or any base URL.'));
    let tried = 0, lastErr = null;
    return new Promise((resolve, reject) => {
      const attempt = () => {
        if (tried >= urls.length) {
          reject(new Error(lastErr === 'Not a manifest'
            ? 'Found a file, but it is not a Leonux store manifest (missing "sections").'
            : 'Could not reach a repo.json at that address (tried ' + urls.length + ' candidate location' + (urls.length > 1 ? 's' : '') + '). Check the link, the branch (main/master), and your connection.'));
          return;
        }
        const url = urls[tried++];
        fetchJSON(url, 10000).then((json) => {
          if (!validManifest(json)) { lastErr = 'Not a manifest'; attempt(); return; }
          let id = String(json.id || 'repo').toLowerCase().replace(/[^a-z0-9-]/g, '_').slice(0, 40) || 'repo';
          let base = id, n = 2;
          while (repos.some((r) => r.id === id)) id = base + '-' + (n++);
          const rec = {
            id, name: String(json.name || 'Repository').slice(0, 60), url,
            home: json.website || (url.indexOf('raw.githubusercontent.com') >= 0 ? 'https://github.com/' + url.split('raw.githubusercontent.com/')[1].split('/').slice(0, 2).join('/') : ''),
            maintainer: String(json.maintainer || 'unknown').slice(0, 60), desc: String(json.description || '').slice(0, 300),
            version: String(json.version || '1.0'), bundled: !!opts.bundled, addedAt: Date.now(), lastSync: Date.now(),
          };
          repos.push(rec); caches[id] = json;
          saveList(); saveCaches(); emit();
          resolve(rec);
        }).catch((e) => { lastErr = e && e.message === 'Not a manifest' ? 'Not a manifest' : 'net'; attempt(); });
      };
      attempt();
    });
  }

  function remove(id) {
    const r = repos.find((x) => x.id === id);
    if (!r) return false;
    repos = repos.filter((x) => x.id !== id);
    delete caches[id];
    saveList(); saveCaches();
    // installed items stay on the device (they were downloaded) — but forget their repo link for updates
    Object.keys(items).forEach((k) => { if (items[k].repoId === id) { items[k].repoId = null; } });
    saveItems(); emit();
    return true;
  }

  function refresh(id) {
    const r = repos.find((x) => x.id === id);
    if (!r) return Promise.reject(new Error('No such repository'));
    return fetchJSON(r.url, 12000).then((json) => {
      if (!validManifest(json)) throw new Error('Repository manifest changed and is no longer valid');
      caches[id] = json;
      r.lastSync = Date.now();
      if (json.version) r.version = String(json.version);
      if (json.name) r.name = String(json.name).slice(0, 60);
      saveList(); saveCaches(); emit();
      return r;
    });
  }
  function refreshAll() { return Promise.all(repos.filter((r) => !r.bundled).map((r) => refresh(r.id).catch(() => null))); }

  // ---------------- catalog ----------------
  const SECTIONS = [['apps', 'app'], ['themes', 'theme'], ['widgets', 'widget'], ['soundpacks', 'soundpack']];
  function catalog() {
    const out = [];
    repos.forEach((r) => {
      const json = caches[r.id];
      if (!json) return;
      const secs = json.sections || {};
      SECTIONS.forEach(([sec, type]) => {
        (secs[sec] || []).forEach((meta) => {
          if (!meta || !meta.id) return;
          out.push(normalize(meta, type, r));
        });
      });
      // flat "items" form: [{type:'app',...}]
      if (Array.isArray(json.items)) json.items.forEach((meta) => { if (meta && meta.id && meta.type) out.push(normalize(meta, meta.type, r)); });
    });
    return out;
  }
  function normalize(meta, type, repo) {
    const size = meta.size != null ? meta.size : (meta.path || meta.package ? 14 : Math.max(2, Math.round((JSON.stringify(meta).length) / 1024) || 2));
    const pkg = meta.package || null;
    const zip = !!(pkg && /\.zip$/i.test(String(pkg))) || meta.format === 'zip';
    return {
      key: keyOf(type, meta.id), type, id: String(meta.id), repoId: repo.id, repo,
      name: String(meta.name || meta.id), icon: meta.icon || (type === 'theme' ? 'palette' : type === 'widget' ? 'grid' : type === 'soundpack' ? 'volume' : 'package'),
      color: /^#[0-9a-f]{3,8}$/i.test(meta.color || '') ? meta.color : ['#7EE787', '#5B9DFA', '#F6C177', '#CBA6F7', '#F48FB1', '#4DD0E1'][LX.hash(meta.id + type, 6)],
      desc: String(meta.desc || ''), long: String(meta.long || meta.desc || ''),
      version: String(meta.version || '1.0'), category: meta.category || (type === 'app' ? 'Apps' : type === 'theme' ? 'Themes' : type === 'widget' ? 'Widgets' : 'Sound Packs'),
      developer: String(meta.developer || repo.maintainer || 'Community'), size: Number(size) || 2,
      rating: meta.rating != null ? Number(meta.rating) : +(3.9 + LX.hash01('rt:' + type + meta.id) * 1.05).toFixed(1),
      downloads: meta.downloads != null ? Number(meta.downloads) : 80 + LX.hash(type + meta.id + 'dl', 5200),
      path: meta.path || null, package: pkg, zip, files: meta.files != null ? Number(meta.files) : null,
      sha256: meta.sha256 ? String(meta.sha256).toLowerCase() : null, window: meta.window || null,
      inline: !meta.path && !pkg, changelog: meta.changelog || '',
      updated: meta.updated || 'Recently', raw: meta,
    };
  }
  function item(repoId, type, id) { return catalog().find((e) => e.repoId === repoId && e.type === type && e.id === id) || null; }

  // resolve a repo-relative item path against the repo.json URL (handles http, absolute and relative bases)
  function resolveUrl(path, base) {
    try {
      if (/^https?:/i.test(base)) return new URL(path, base).href;
      return new URL(path, new URL(base, location.href)).href;
    } catch (e) { return base; }
  }

  // ---------------- install / uninstall / update ----------------
  const active = {}; // key -> {pct, cancel}

  /* Multi-file ZIP package: download with real byte progress, verify checksum,
     unzip, store every file on-device, and return a compact def for the registry. */
  function zipDef(entry, rec) {
    const base = resolveUrl(entry.package, entry.repo.url);
    // cache-bust by checksum/version: a repo update must not be shadowed by the
    // service worker's cached copy of the previous package
    const bust = String(entry.sha256 || entry.version || Date.now()).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'x';
    const url = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'lxv=' + bust;
    const prog = (pct, mb) => {
      rec.real = true; // real byte progress — stop the cosmetic ticker
      rec.pct = Math.max(rec.pct, pct);
      LX.bus.emit('repos:progress', { key: entry.key, pct: Math.round(rec.pct), rate: 0, mb: mb });
    };
    const srel = starterRel(base);
    const fromStarter = () => starterZip(srel).then((buf) => { prog(96, buf.byteLength / 1048576); return buf; });
    const grab = (u) => (srel && IS_FILE ? fromStarter() : LX.zapps.fetchZip(u, prog, rec)).catch((e) => {
      if (rec.cancel) throw e;
      if (u !== base && !IS_FILE) return LX.zapps.fetchZip(base, prog, rec).catch((e2) => srel ? fromStarter().catch(() => { throw e2; }) : Promise.reject(e2)); // offline fallback: precached package URL
      if (srel && !IS_FILE) return fromStarter().catch(() => { throw e; });
      throw e;
    });
    return grab(url).then((buf) => {
      if (rec.cancel) throw new Error('cancelled');
      if (!LX.zapps || !LX.zapps.unpack) throw new Error('App engine unavailable');
      if (entry.sha256) {
        return LX.zapps.sha256(buf).then((h) => {
          if (h && h !== entry.sha256) throw new Error('Checksum mismatch — the package did not download cleanly. Try again.');
          return buf;
        });
      }
      return buf;
    }).then((buf) => LX.zapps.unpack(buf)).then((z) => {
      if (rec.cancel) throw new Error('cancelled');
      const m = z.manifest || {};
      const def = {
        zipApp: true, id: entry.id, type: entry.type,
        name: String(m.name || entry.name), version: String(m.version || entry.version),
        icon: m.icon || entry.icon, color: /^#[0-9a-f]{3,8}$/i.test(m.color || '') ? m.color : (/^#[0-9a-f]{3,8}$/i.test(entry.color || '') ? entry.color : '#5B9DFA'),
        category: m.category || entry.category, desc: m.desc || entry.desc, long: m.long || entry.long,
        window: m.window || entry.window || null, entry: z.entry, files: z.files,
        sizeKB: Math.max(1, Math.round(z.total / 1024)),
      };
      if (typeof def.icon !== 'string' || !def.icon) def.icon = 'package';
      const appId = appIdOf(entry.id);
      return LX.zapps.writeApp(appId, z.entries, { name: def.name, version: def.version, entry: z.entry }).then(() => def);
    });
  }

  function install(entry) {
    if (!entry || !entry.key) return Promise.reject(new Error('Bad entry'));
    if (items[entry.key]) return Promise.resolve({ already: true });
    if (active[entry.key]) return Promise.reject(new Error('Already downloading'));
    const rec = active[entry.key] = { pct: 0, cancel: false, started: Date.now() };
    const sizeMB = Math.max(0.01, entry.size / 1024);
    // animate progress while the fetch runs (real byte progress replaces it for zip packages)
    const tick = setInterval(() => {
      if (rec.cancel || rec.real) return;
      rec.pct = Math.min(92, rec.pct + 1.5 + Math.random() * 4);
      LX.bus.emit('repos:progress', { key: entry.key, pct: Math.round(rec.pct), rate: (sizeMB * rec.pct / 100) / Math.max(0.2, (Date.now() - rec.started) / 1000) });
    }, 90);

    const finish = (def) => {
      clearInterval(tick);
      LX.bus.emit('repos:progress', { key: entry.key, pct: 100 });
      items[entry.key] = { type: entry.type, id: entry.id, repoId: entry.repoId, version: entry.version, t: Date.now(), def };
      saveItems();
      try { applyItem(items[entry.key]); } catch (e) { console.error('[repos] apply', e); }
      // delightful defaults: themes & sound packs apply immediately after install
      let body = 'Ready to launch from the launcher or dock.', appId = appIdOf(entry.id), sArgs;
      if (def.zipApp) body = LX.plural(def.files ? def.files.length : 0, 'file') + ' unpacked and stored on-device — ready to launch.';
      if (entry.type === 'theme') { try { LX.theme.applyDynamic(entry.id); } catch (e) {} body = 'Applied — tap to open Appearance settings.'; appId = 'settings'; sArgs = { page: 'appearance' }; }
      else if (entry.type === 'soundpack') { LX.settings.set('soundPack', entry.id); body = 'Now your active sound pack — tap to open Sound settings.'; appId = 'settings'; sArgs = { page: 'sound' }; }
      else if (entry.type === 'widget') body = 'Live on your desktop — right-click it to remove.';
      writeManifest(entry, def);
      delete active[entry.key];
      emit();
      LX.audio.event('install');
      LX.notify({ title: (def.name || entry.name) + ' installed', body, icon: entry.icon, appId, args: sArgs });
      return { ok: true };
    };

    const load = entry.zip && entry.package
      ? zipDef(entry, rec)
      : entry.path
        ? new Promise((resolve, reject) => {
          const url = resolveUrl(entry.path, entry.repo.url);
          fetchJSON(url, 20000).then(resolve).catch(reject);
        })
        : Promise.resolve(entry.raw || entry);

    return load.then((def) => {
      if (rec.cancel) { clearInterval(tick); delete active[entry.key]; LX.bus.emit('repos:progress', { key: entry.key, pct: 0, cancelled: true }); return { cancelled: true }; }
      const err = validate(entry.type, def);
      if (err) { clearInterval(tick); delete active[entry.key]; throw new Error(err); }
      return finish(def);
    }).catch((e) => { clearInterval(tick); delete active[entry.key]; throw e; });
  }

  function validate(type, def) {
    if (!def || typeof def !== 'object') return 'Downloaded item is not valid.';
    if (def.zipApp) return null; // zip packages were validated file-by-file during unpack
    if (type === 'app' && !def.html) return 'App has no "html" payload.';
    if (type === 'widget' && !def.html) return 'Widget has no "html" payload.';
    if (type === 'theme' && !def.wallpaper) return 'Theme has no "wallpaper" definition.';
    if (type === 'soundpack' && !def.sounds) return 'Sound pack has no "sounds".';
    if (String(def.html || '').length > 400000) return 'Item too large (400 KB limit).';
    return null;
  }

  function applyItem(rec) {
    const def = rec.def;
    if (rec.type === 'app') registerDynamicApp(def, rec);
    else if (rec.type === 'theme') LX.theme.addDynamic(def);
    else if (rec.type === 'widget') renderDynamicWidgets();
    else if (rec.type === 'soundpack') LX.audio.addPack(def);
  }

  function uninstall(type, id, opts) {
    const key = keyOf(type, id);
    const rec = items[key];
    if (!rec) return false;
    opts = opts || {};
    const wasZip = !!(rec.def && rec.def.zipApp);
    if (type === 'app') {
      const rid = appIdOf(id);
      LX.wm.list().filter((w) => w.appId === rid).forEach((w) => { w.closeHandlers = []; w.close(); });
      LX.apps.unregister(rid);
      const pin = (LX.settings.get('pinned') || []).filter((x) => x !== rid);
      if (pin.length !== (LX.settings.get('pinned') || []).length) LX.settings.set('pinned', pin);
    } else if (type === 'theme') {
      LX.theme.removeDynamic(id);
    } else if (type === 'widget') {
      const host = document.getElementById('widgets');
      if (host) { const el = host.querySelector('[data-wid="' + key + '"]'); if (el) el.remove(); }
    } else if (type === 'soundpack') {
      LX.audio.removePack(id);
    }
    if (wasZip && LX.zapps) { try { LX.zapps.deleteApp(appIdOf(id)).catch(() => {}); } catch (e) {} } // remove unpacked files
    delete items[key]; saveItems();
    removeManifest(type, id);
    emit();
    if (!opts.silent) LX.notify({ title: rec.def.name + ' removed', body: 'You can reinstall it from the App Store any time.', icon: 'trash', appId: 'softwarecenter' });
    return true;
  }

  function update(entry) {
    const key = entry.key;
    if (!items[key]) return Promise.reject(new Error('Not installed'));
    if (items[key].updating) return Promise.reject(new Error('Already updating'));
    items[key].updating = true; saveItems();
    LX.notify({ title: 'Updating ' + entry.name, body: 'Fetching v' + entry.version + ' from ' + (entry.repo ? entry.repo.name : 'repository') + '…', icon: 'refresh2', timeout: 2500 });
    return reinstall(entry).then((r) => { delete items[key].updating; saveItems();
      LX.notify({ title: entry.name + ' updated', body: 'Now running v' + entry.version, icon: 'check-circle', timeout: 3500 });
      return r;
    }).catch((e) => { delete items[key].updating; saveItems(); throw e; });
  }
  function reinstall(entry) {
    const key = entry.key;
    const rec = items[key];
    if (!rec) return Promise.reject(new Error('Not installed'));
    const load = entry.zip && entry.package
      ? zipDef(entry, { pct: 0, cancel: false })
      : entry.path ? (() => { const url = resolveUrl(entry.path, entry.repo.url); return fetchJSON(url, 20000); })()
        : Promise.resolve(entry.raw || entry);
    return load.then((def) => {
      const err = validate(entry.type, def);
      if (err) throw new Error(err);
      // uninstall old (silent) then apply fresh def
      if (entry.type === 'app') { const rid = appIdOf(entry.id); LX.wm.list().filter((w) => w.appId === rid).forEach((w) => { w.closeHandlers = []; w.close(); }); LX.apps.unregister(rid); }
      if (!def.zipApp && rec.def && rec.def.zipApp && LX.zapps) { try { LX.zapps.deleteApp(appIdOf(entry.id)).catch(() => {}); } catch (e) {} } // switching formats
      rec.def = def; rec.version = entry.version; rec.t = Date.now(); rec.repoId = entry.repoId;
      saveItems(); applyItem(rec); writeManifest(entry, def);
      emit();
      return { ok: true };
    });
  }

  function updates() {
    const out = [];
    Object.keys(items).forEach((k) => {
      const rec = items[k];
      if (!rec || !rec.repoId) return;
      const e = item(rec.repoId, rec.type, rec.id);
      if (e && bumpCmp(e.version, rec.version) > 0) out.push(e);
    });
    return out;
  }

  // ---------------- dynamic content runtime ----------------
  function registerDynamicApp(def, rec) {
    const rid = appIdOf(def.id);
    LX.apps.unregister(rid);
    const win = def.window || {};
    LX.apps.register({
      id: rid, name: String(def.name || def.id), icon: def.icon || 'package', color: /^#[0-9a-f]{3,8}$/i.test(def.color || '') ? def.color : '#5B9DFA',
      category: def.category || 'Apps', desc: def.desc || 'Installed from a store repository.', longDesc: def.long || def.desc || '',
      dynamic: true, repoApp: true, zipApp: !!def.zipApp,
      width: win.width || 640, height: win.height || 520, minWidth: win.minWidth || 300, minHeight: win.minHeight || 240,
      open(w) {
        w.body.classList.add('dyn-body');
        const fr = document.createElement('iframe');
        fr.className = 'dyn-frame';
        if (def.zipApp && LX.zapps) {
          // multi-file app: the service worker serves its files from IndexedDB.
          // allow-same-origin is required — browsers don't let service workers
          // control sandboxed iframes with opaque origins, so without it the
          // app's requests would bypass the SW and 404.
          fr.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-pointer-lock allow-downloads allow-same-origin');
          fr.setAttribute('title', def.name || 'App');
          LX.zapps.mount(rid, def.entry || 'index.html', fr);
        } else {
          fr.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-pointer-lock allow-downloads');
          fr.setAttribute('title', def.name || 'App');
          fr.srcdoc = def.html;
        }
        w.body.appendChild(fr);
        const onMsg = (ev) => {
          if (ev.source !== fr.contentWindow || !ev.data || ev.data.lx == null) return;
          const m = ev.data;
          if (m.lx === 'title' && typeof m.value === 'string') w.setTitle(m.value.slice(0, 90));
          else if (m.lx === 'close') w.close();
        };
        window.addEventListener('message', onMsg);
        w.onClose(() => window.removeEventListener('message', onMsg));
      },
    });
    return rid;
  }

  function widgetDefs() { return Object.keys(items).filter((k) => items[k].type === 'widget').map((k) => ({ key: k, def: items[k].def })); }

  function renderDynamicWidgets() {
    const host = document.getElementById('widgets');
    if (!host) return;
    LX.$$('.wg-dyn', host).forEach((n) => n.remove());
    const defs = widgetDefs();
    defs.forEach(({ key, def }) => {
      const size = def.size || { h: 200 };
      const fr = document.createElement('iframe');
      fr.className = 'dyn-wframe';
      fr.setAttribute('title', def.name || 'Widget');
      fr.style.height = Math.min(420, Math.max(90, size.h || 200)) + 'px';
      if (def.zipApp && LX.zapps) {
        fr.setAttribute('sandbox', 'allow-scripts allow-modals allow-same-origin');
        fr.src = LX.zapps.url(appIdOf(def.id), def.entry || 'index.html');
      } else {
        fr.setAttribute('sandbox', 'allow-scripts allow-modals');
        fr.srcdoc = def.html;
      }
      const card = H('div', { class: 'widget wg-dyn', dataset: { wid: key }, title: def.name + ' — right-click to remove' }, fr);
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        LX.menu.show(e.clientX, e.clientY, [
          { label: def.name, icon: 'grid', disabled: true },
          { separator: true },
          { label: 'Remove widget', icon: 'trash', action: () => uninstall('widget', def.id) },
        ]);
      });
      host.appendChild(card);
    });
  }

  // ---------------- VFS manifests ----------------
  function writeManifest(entry, def) {
    try {
      LX.vfs.mkdir(DIR + '/' + entry.type + 's');
      LX.vfs.write(DIR + '/' + entry.type + 's/' + entry.id + '.json', JSON.stringify({
        id: entry.id, type: entry.type, name: def.name || entry.name, version: entry.version,
        repository: entry.repo ? entry.repo.name : null, installed: Date.now(),
      }, null, 2), { mime: 'application/json' });
    } catch (e) { /* non-fatal */ }
  }
  function removeManifest(type, id) {
    try { const p = DIR + '/' + type + 's/' + id + '.json'; if (LX.vfs.exists(p)) LX.vfs.rm(p, { permanent: true }); } catch (e) {}
  }

  // ---------------- public API ----------------
  LX.repos = {
    list: () => repos.slice(),
    get: (id) => repos.find((r) => r.id === id) || null,
    add, remove, refresh, refreshAll, candidates,
    catalog, item,
    isInstalled: (type, id) => !!items[keyOf(type, id)],
    installedRec: (type, id) => items[keyOf(type, id)] || null,
    installedList: (type) => Object.keys(items).filter((k) => !type || items[k].type === type).map((k) => Object.assign({ key: k }, items[k])).sort((a, b) => b.t - a.t),
    installedCount: () => Object.keys(items).length,
    install, uninstall, update, updates,
    isDownloading: (key) => !!active[key],
    cancel(key) { if (active[key]) { active[key].cancel = true; if (typeof active[key].abort === 'function') { try { active[key].abort(); } catch (e) {} } return true; } return false; },
    usage() {
      let kb = 0; Object.keys(items).forEach((k) => { kb += (JSON.stringify(items[k].def || {}).length / 1024) + 4; });
      return { count: Object.keys(items).length, mb: Math.max(1, Math.round(kb / 1024 * 10) / 10) };
    },
    appIdOf,
    _renderWidgets: renderDynamicWidgets,
  };

  // ---------------- boot ----------------
  LX.onInit(() => {
    // bundled starter repository (ships with the OS, works offline, can be removed)
    const base = location.pathname.replace(/[^/]*$/, '');
    if (!repos.some((r) => r.bundled)) {
      const rec = {
        id: 'starter', name: 'Leonux Starter Store', url: base + 'store/repo.json', home: '',
        maintainer: 'Leonux', desc: 'The repository bundled with Leonux OS — apps, themes, widgets and sound packs that install and work offline.',
        version: '1.0', bundled: true, addedAt: Date.now(), lastSync: Date.now(),
      };
      repos.unshift(rec);
      saveList();
      fetchJSON(rec.url, 6000).then((j) => { if (validManifest(j)) { caches.starter = j; saveCaches(); emit(); } else { /* keep repos entry but mark empty */ } }).catch(() => {});
    } else {
      // keep the bundled catalog fresh across OS updates (new content ships with the OS)
      const bundled = repos.find((x) => x.bundled);
      if (bundled) fetchJSON(bundled.url, 6000).then((j) => {
        if (validManifest(j) && JSON.stringify(j) !== JSON.stringify(caches[bundled.id])) {
          caches[bundled.id] = j; bundled.lastSync = Date.now();
          if (j.version) bundled.version = String(j.version);
          saveList(); saveCaches(); emit();
        }
      }).catch(() => {});
    }
    // restore installed items (apps, themes, widgets, sound packs come back after reload)
    Object.keys(items).forEach((k) => {
      const it = items[k];
      if (it && it.def && it.def.zipApp) {
        // zip apps: only restore if their unpacked files actually survived in storage
        LX.zapps.appInfo(appIdOf(it.id)).then((info) => {
          if (info) { try { applyItem(it); } catch (e) { console.error('[repos] restore', k, e); } }
          else { delete items[k]; saveItems(); console.warn('[repos] files missing for', k, '— unregistered'); }
        }).catch(() => { try { applyItem(it); } catch (e) {} });
      } else {
        try { applyItem(it); } catch (e) { console.error('[repos] restore', k, e); }
      }
    });
    LX.bus.on('settings:change', (e) => { if (e.key === 'widgets') renderDynamicWidgets(); });
    LX.bus.on('repos:change', () => {
      // taskbar update badge counts repo updates too
      if (LX.packages && LX.packages.updateCount) LX.bus.emit('packages:change', { op: 'count' });
    });
  });
})();
