/* Leonux OS 2.2 — Multi-file ZIP apps (LX.zapps).
   Apps can ship as real .zip packages: one index.html plus any number of
   css/, js/ and asset files. The package is:
     · downloaded with live byte-accurate progress (and optional sha256 check),
     · unzipped by a zero-dependency ZIP reader (DecompressionStream),
     · stored file-by-file in IndexedDB,
     · served offline by the service worker at  <base>~zapps/<appId>/<path>,
   so every relative link inside the app (css/style.css, js/main.js, img/…)
   resolves naturally — exactly like a real installed application. */
(function () {
  'use strict';

  const DB_NAME = 'lx-zapps';
  const DB_VERSION = 1;
  const FILES = 'files'; // key: "appId/relPath" -> {key, appId, path, mime, data, size}
  const META = 'meta';   // key: appId -> {appId, name, version, entry, count, size, t}

  const LIMITS = { files: 250, file: 8 * 1024 * 1024, total: 24 * 1024 * 1024 };

  // ---------------- MIME ----------------
  const MIMES = {
    html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8', webmanifest: 'application/manifest+json; charset=utf-8', map: 'application/json; charset=utf-8',
    txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', csv: 'text/plain; charset=utf-8', xml: 'application/xml; charset=utf-8',
    svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    wasm: 'application/wasm', pdf: 'application/pdf',
  };
  function mimeOf(path) {
    const m = String(path).toLowerCase().match(/\.([a-z0-9]+)$/);
    return (m && MIMES[m[1]]) || 'application/octet-stream';
  }

  // ---------------- IndexedDB ----------------
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!('indexedDB' in self)) { dbp = null; return reject(new Error('IndexedDB is unavailable in this browser')); }
      const rq = indexedDB.open(DB_NAME, DB_VERSION);
      rq.onupgradeneeded = () => {
        const d = rq.result;
        if (!d.objectStoreNames.contains(FILES)) d.createObjectStore(FILES, { keyPath: 'key' });
        if (!d.objectStoreNames.contains(META)) d.createObjectStore(META, { keyPath: 'appId' });
      };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => { dbp = null; reject(rq.error || new Error('Could not open app storage')); };
    });
    return dbp;
  }
  const range = (appId) => IDBKeyRange.bound(appId + '/', appId + '/\uffff');

  function writeApp(appId, entries, meta) {
    return db().then((d) => new Promise((resolve, reject) => {
      const t = d.transaction([FILES, META], 'readwrite');
      t.onerror = () => reject(t.error || new Error('Could not write app files'));
      t.oncomplete = () => resolve(true);
      const f = t.objectStore(FILES);
      try { f.delete(range(appId)); } catch (e) {}
      let total = 0;
      entries.forEach((en) => {
        total += en.size || (en.data ? en.data.byteLength : 0);
        f.put({ key: appId + '/' + en.path, appId, path: en.path, mime: mimeOf(en.path), data: en.data, size: en.size || (en.data ? en.data.byteLength : 0) });
      });
      t.objectStore(META).put(Object.assign({ appId, entry: 'index.html', t: Date.now() }, meta || {}, {
        count: entries.length, size: total,
      }));
    }));
  }

  function deleteApp(appId) {
    return db().then((d) => new Promise((resolve, reject) => {
      const t = d.transaction([FILES, META], 'readwrite');
      t.onerror = () => reject(t.error || new Error('Could not delete app files'));
      t.oncomplete = () => resolve(true);
      try { t.objectStore(FILES).delete(range(appId)); } catch (e) {}
      t.objectStore(META).delete(appId);
    }));
  }

  function read(appId, path) {
    return db().then((d) => new Promise((resolve, reject) => {
      const rq = d.transaction(FILES, 'readonly').objectStore(FILES).get(appId + '/' + String(path).replace(/^\/+/, ''));
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror = () => reject(rq.error);
    }));
  }

  function listFiles(appId) {
    return db().then((d) => new Promise((resolve, reject) => {
      const rq = d.transaction(FILES, 'readonly').objectStore(FILES).getAll(range(appId));
      rq.onsuccess = () => resolve((rq.result || []).map((r) => ({ path: r.path, size: r.size, mime: r.mime })).sort((a, b) => a.path.localeCompare(b.path)));
      rq.onerror = () => reject(rq.error);
    }));
  }

  function appInfo(appId) {
    return db().then((d) => new Promise((resolve, reject) => {
      const rq = d.transaction(META, 'readonly').objectStore(META).get(appId);
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror = () => reject(rq.error);
    }));
  }

  function listApps() {
    return db().then((d) => new Promise((resolve, reject) => {
      const rq = d.transaction(META, 'readonly').objectStore(META).getAll();
      rq.onsuccess = () => resolve((rq.result || []).sort((a, b) => (b.t || 0) - (a.t || 0)));
      rq.onerror = () => reject(rq.error);
    }));
  }

  // ---------------- ZIP reader (zero dependencies) ----------------
  const u16 = (v, o) => v[o] | (v[o + 1] << 8);
  const u32 = (v, o) => ((v[o] | (v[o + 1] << 8) | (v[o + 2] << 16) | (v[o + 3] << 24)) >>> 0);
  const SIG_LH = 0x04034b50, SIG_CD = 0x02014b50, SIG_EOCD = 0x06054b50;

  async function inflateRaw(u8) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot unzip packages (DecompressionStream missing). Use an up-to-date Chrome, Edge, Safari 16.4+ or Firefox 113+.');
    }
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  function skipJunk(name) {
    const base = name.split('/').pop();
    return !base || base === '.DS_Store' || base.charAt(0) === '._' || name.indexOf('__MACOSX/') >= 0;
  }

  /* Parse a .zip ArrayBuffer -> { entries:[{path,data,size}], manifest, entry, total, files } */
  async function unpack(buf) {
    const u8 = new Uint8Array(buf);
    if (u8.length < 22) throw new Error('The package is too small to be a valid ZIP.');
    // locate the end-of-central-directory record (scan back, it may have a comment)
    let eocd = -1;
    const from = Math.max(0, u8.length - 66000);
    for (let i = u8.length - 22; i >= from; i--) {
      if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a ZIP archive (end-of-central-directory not found).');
    const count = u16(u8, eocd + 10);
    const cdOff = u32(u8, eocd + 16);
    if (cdOff === 0xFFFFFFFF || count === 0xFFFF) throw new Error('Zip64 packages are not supported (your app is smaller than that anyway).');
    const td = new TextDecoder();
    const found = [];
    let p = cdOff;
    for (let i = 0; i < count; i++) {
      if (p + 46 > u8.length || u32(u8, p) !== SIG_CD) throw new Error('The ZIP central directory is corrupt.');
      const method = u16(u8, p + 10);
      const csize = u32(u8, p + 20);
      const usize = u32(u8, p + 24);
      const nlen = u16(u8, p + 28), xlen = u16(u8, p + 30), clen = u16(u8, p + 32);
      const lho = u32(u8, p + 42);
      const name = td.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (name.charAt(name.length - 1) === '/' || skipJunk(name)) continue; // directory / os junk
      if (name.charAt(0) === '/' || name.split('/').indexOf('..') >= 0) throw new Error('Unsafe path inside package: ' + name);
      if (method !== 0 && method !== 8) throw new Error('Unsupported compression method ' + method + ' for ' + name + ' (use store or deflate).');
      if (usize > LIMITS.file) throw new Error('File too large inside package: ' + name + ' (' + LX.fmtBytes(usize) + ').');
      if (lho + 30 > u8.length || u32(u8, lho) !== SIG_LH) throw new Error('The ZIP local header for ' + name + ' is corrupt.');
      const dstart = lho + 30 + u16(u8, lho + 26) + u16(u8, lho + 28);
      if (dstart + csize > u8.length) throw new Error('Truncated package data for ' + name + '.');
      const raw = u8.subarray(dstart, dstart + csize);
      const data = method === 0 ? new Uint8Array(raw) : await inflateRaw(raw);
      if (data.length !== usize) throw new Error('Size mismatch while inflating ' + name + '.');
      // copy out of the zip buffer so IndexedDB stores standalone ArrayBuffers
      const copy = new Uint8Array(data.length);
      copy.set(data);
      found.push({ path: name, data: copy.buffer, size: usize });
    }
    if (!found.length) throw new Error('The package contains no files.');
    if (found.length > LIMITS.files) throw new Error('Too many files in package (' + found.length + ' > ' + LIMITS.files + ').');
    // strip a single shared root folder (GitHub "Download ZIP" style)
    const root = found[0].path.split('/')[0];
    const shared = root && found.every((f) => f.path.indexOf(root + '/') === 0);
    const entries = shared ? found.map((f) => ({ path: f.path.slice(root.length + 1), data: f.data, size: f.size })) : found;
    let total = 0; entries.forEach((e) => { total += e.size; });
    if (total > LIMITS.total) throw new Error('Package is too large (' + LX.fmtBytes(total) + ' > ' + LX.fmtBytes(LIMITS.total) + ').');
    // optional in-package metadata (app.json / manifest.json)
    let manifest = null;
    const mf = entries.find((e) => /^app\.json$/i.test(e.path)) || entries.find((e) => /^manifest\.json$/i.test(e.path));
    if (mf) { try { manifest = JSON.parse(new TextDecoder().decode(new Uint8Array(mf.data))); } catch (e) { /* optional */ } }
    let entry = (manifest && typeof manifest.entry === 'string' && manifest.entry) || 'index.html';
    entry = entry.replace(/^\/+/, '');
    if (!entries.some((e) => e.path === entry)) {
      throw new Error('The package must contain "' + entry + '" at its root next to ' + (entries.length - 1) + ' other file(s).');
    }
    return { entries, manifest, entry, total, files: entries.map((e) => e.path) };
  }

  // ---------------- download ----------------
  /* Streamed download with real progress. onProgress(pct 0-96, mbSoFar). */
  function fetchZip(url, onProgress, reg) {
    const ctl = new AbortController();
    if (reg) reg.abort = () => ctl.abort();
    return fetch(url, { signal: ctl.signal }).then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' while downloading the package');
      const len = Number(r.headers.get('content-length')) || 0;
      if (!r.body || !r.body.getReader) return r.arrayBuffer();
      const reader = r.body.getReader();
      const chunks = []; let got = 0;
      const pump = () => reader.read().then((res) => {
        if (res.done) {
          const all = new Uint8Array(got);
          let o = 0; chunks.forEach((c) => { all.set(c, o); o += c.length; });
          return all.buffer;
        }
        chunks.push(res.value); got += res.value.length;
        if (onProgress) onProgress(len ? Math.min(96, (got / len) * 96) : Math.min(90, 35 + got / 40000), got / 1048576);
        return pump();
      });
      return pump();
    });
  }

  function sha256(buf) {
    if (!crypto || !crypto.subtle || !crypto.subtle.digest) return Promise.resolve(null);
    return crypto.subtle.digest('SHA-256', buf).then((h) => Array.prototype.map.call(new Uint8Array(h), (b) => ('0' + b.toString(16)).slice(-2)).join(''));
  }

  // ---------------- runtime ----------------
  function url(appId, path) {
    const base = location.pathname.replace(/[^/]*$/, '');
    return base + '~zapps/' + appId + '/' + String(path || 'index.html').replace(/^\/+/, '');
  }

  /* Point an iframe at a zapp virtual URL, making sure the service worker
     (which serves those URLs from IndexedDB) is controlling the page first. */
  /* No service worker (file://, insecure http, unsupported browser): rebuild the app as one
     self-contained srcdoc page — stylesheets, scripts and images are inlined from IndexedDB. */
  function buildInline(appId, entry) {
    return listFiles(appId).then((list) => Promise.all(list.map((f) => read(appId, f.path)))).then((recs) => {
      const files = {};
      recs.forEach((r) => { if (r) files[r.path] = r; });
      const dec = (r) => new TextDecoder().decode(r.data);
      const b64 = (r) => { let bin = ''; const u = new Uint8Array(r.data); for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(bin); };
      const dataUri = (r) => 'data:' + (r.mime || 'application/octet-stream').split(';')[0] + ';base64,' + b64(r);
      const norm = (base, rel) => {
        rel = String(rel || '').split('#')[0].split('?')[0];
        if (!rel || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(rel)) return null;
        const parts = (rel.charAt(0) === '/' ? rel : base + rel).split('/'), out = [];
        parts.forEach((p) => { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); });
        try { return decodeURIComponent(out.join('/')); } catch (e) { return out.join('/'); }
      };
      const dirOf = (p) => p.replace(/[^/]*$/, '');
      const cssInline = (css, base) => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) => { const k = norm(base, u); return k && files[k] ? 'url("' + dataUri(files[k]) + '")' : m; })
        .replace(/@import\s+(?:url\()?\s*['"]([^'"]+)['"]\s*\)?\s*;/g, (m, u) => { const k = norm(base, u); return k && files[k] ? cssInline(dec(files[k]), dirOf(k)) : m; });
      const ep = String(entry || 'index.html').replace(/^\/+/, '');
      if (!files[ep]) throw new Error('Entry file missing: ' + ep);
      const base = dirOf(ep);
      const doc = new DOMParser().parseFromString(dec(files[ep]), 'text/html');
      doc.querySelectorAll('link[rel~="stylesheet"][href]').forEach((el) => {
        const k = norm(base, el.getAttribute('href'));
        if (k && files[k]) { const st = doc.createElement('style'); st.textContent = cssInline(dec(files[k]), dirOf(k)); el.replaceWith(st); }
      });
      doc.querySelectorAll('style').forEach((el) => { el.textContent = cssInline(el.textContent, base); });
      doc.querySelectorAll('script[src]').forEach((el) => {
        const k = norm(base, el.getAttribute('src'));
        if (k && files[k]) { const sc = doc.createElement('script'); if (el.type) sc.type = el.type; sc.textContent = dec(files[k]).replace(/<\/script/gi, '<\\/script'); el.replaceWith(sc); }
      });
      doc.querySelectorAll('[src],[poster]').forEach((el) => {
        ['src', 'poster'].forEach((at) => { const k = el.hasAttribute(at) && norm(base, el.getAttribute(at)); if (k && files[k]) el.setAttribute(at, dataUri(files[k])); });
      });
      doc.querySelectorAll('link[href]:not([rel~="stylesheet"])').forEach((el) => { const k = norm(base, el.getAttribute('href')); if (k && files[k]) el.setAttribute('href', dataUri(files[k])); });
      return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
    });
  }

  function mount(appId, entry, frame) {
    const go = () => { frame.src = url(appId, entry); };
    const inline = () => buildInline(appId, entry).then((h) => { frame.srcdoc = h; }).catch((e) => { frame.srcdoc = '<body style="font:14px sans-serif;padding:20px;color:#c33">Could not open this app: ' + String(e && e.message || e).replace(/</g, '&lt;') + '</body>'; });
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return inline();
    if (navigator.serviceWorker.controller) return go();
    navigator.serviceWorker.ready.then(() => {
      let tries = 0;
      const wait = () => {
        if (navigator.serviceWorker.controller || tries++ > 20) return navigator.serviceWorker.controller ? go() : inline();
        setTimeout(wait, 120);
      };
      wait();
    }).catch(inline);
  }

  LX.zaps = LX.zapps = {
    // storage
    writeApp, deleteApp, read, listFiles, appInfo, listApps,
    // zip engine
    unpack, fetchZip, sha256, mimeOf,
    // runtime
    url, mount, buildInline,
    limits: LIMITS,
  };
})();
