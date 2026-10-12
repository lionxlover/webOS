/* Leonux OS 2 — package manager: real install / uninstall / update lifecycle for store apps.
   Store apps register normally (pkg:true) but stay hidden+unlaunchable until installed.
   Installs write an app manifest into the virtual FS (/usr/apps), animate a download,
   and flip the app visible system-wide (launcher, taskbar, search, openers). */
(function () {
  'use strict';
  const KEY = 'packages.installed';      // { appId: {v, t} }
  const VKEY = 'packages.versions';      // { appId: 'x.y' } — simulated live-store version overrides
  const DIR = '/usr/apps';

  const load = () => LX.store.get(KEY, {});
  const loadV = () => LX.store.get(VKEY, {});
  let installed = load();
  let liveVer = loadV();

  const save = () => { LX.store.set(KEY, installed); };
  const saveV = () => { LX.store.set(VKEY, liveVer); };

  function pkgOf(id) { const a = LX.apps.get(id); return a && a.pkg ? a : null; }
  function versionOf(id) {
    const a = LX.apps.get(id) || {};
    const base = String(a.pkgVersion || '1.0');
    if (liveVer[id]) return liveVer[id]; // simulated store bump
    return base;
  }
  function bumpCompare(a, b) { // -1 a<b, 0 eq, 1 a>b
    const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x < y ? -1 : 1; }
    return 0;
  }

  // -------- manifest writing into VFS (makes installs feel physical) --------
  function writeManifest(id) {
    const a = LX.apps.get(id) || {};
    try {
      LX.vfs.mkdir(DIR);
      LX.vfs.write(DIR + '/' + id + '.json', JSON.stringify({
        id, name: a.name, version: versionOf(id), category: a.category, developer: a.developer || 'Leonux Software',
        installed: Date.now(), size: appSize(id), icon: a.icon, color: a.color, permissions: a.permissions || [],
      }, null, 2), { mime: 'application/json' });
    } catch (e) { /* vfs full — non-fatal */ }
  }
  function removeManifest(id) { try { if (LX.vfs.exists(DIR + '/' + id + '.json')) LX.vfs.rm(DIR + '/' + id + '.json', { permanent: true }); } catch (e) {} }

  const appSize = (id) => { const a = LX.apps.get(id) || {}; return a.pkgSize || (6 + LX.hash(id, 44)); };
  const totalSize = (id) => (appSize(id) * 1.04 + 1.5).toFixed(1) * 1; // installed footprint ≈ download + cache

  // -------- install with animated download --------
  const active = {}; // id -> {pct, speed, cancel}
  function install(id, opts) {
    opts = opts || {};
    const a = LX.apps.get(id);
    if (!a || !a.pkg) return Promise.reject(new Error('Not a store app: ' + id));
    if (installed[id]) return Promise.resolve({ already: true });
    if (active[id]) return Promise.reject(new Error('Already downloading'));
    return new Promise((resolve) => {
      const size = appSize(id);
      let pct = 0;
      const rec = { pct: 0, cancel: false, started: Date.now() };
      active[id] = rec;
      const tick = () => {
        if (rec.cancel) { delete active[id]; LX.bus.emit('packages:progress', { id, pct: 0, cancelled: true }); return resolve({ cancelled: true }); }
        const burst = 2.2 + Math.random() * 7.5 * (LX.hash01(id + 'x') > 0.15 ? 1 : 0.25); // occasional stalls
        pct = Math.min(100, pct + burst);
        rec.pct = pct;
        rec.rate = (size * pct / 100) / Math.max(0.35, (Date.now() - rec.started) / 1000); // MB/s
        LX.bus.emit('packages:progress', { id, pct: Math.round(pct), rate: rec.rate });
        if (pct >= 100) {
          delete active[id];
          finishInstall(id);
          resolve({ ok: true });
        } else t = setTimeout(tick, 70 + Math.random() * 90);
      };
      let t = setTimeout(tick, 120);
    });
  }
  function finishInstall(id) {
    installed[id] = { v: versionOf(id), t: Date.now() };
    save();
    const a = LX.apps.get(id);
    if (a) { a.hidden = false; }
    writeManifest(id);
    LX.bus.emit('apps:change', id);
    LX.bus.emit('packages:change', { op: 'install', id });
    if (LX.notify) LX.notify({
      title: (a ? a.name : id) + ' installed',
      body: 'Ready to launch from the launcher or dock. Tap to open.',
      icon: a ? a.icon : 'package', appId: id,
    });
    LX.audio.event('install');
  }

  function uninstall(id, opts) {
    const a = LX.apps.get(id);
    if (!a || !a.pkg || !installed[id]) return false;
    if (!(opts && opts.silent)) {
      // close its windows first
      LX.wm.list().filter((w) => w.appId === id).forEach((w) => { w.closeHandlers = []; w.close(); });
    }
    delete installed[id];
    delete liveVer[id]; saveV();
    save();
    a.hidden = true;
    removeManifest(id);
    // unpin
    const pin = (LX.settings.get('pinned') || []).filter((x) => x !== id);
    if (pin.length !== (LX.settings.get('pinned') || []).length) LX.settings.set('pinned', pin);
    LX.bus.emit('apps:change', id);
    LX.bus.emit('packages:change', { op: 'uninstall', id });
    if (LX.notify && !(opts && opts.silent)) LX.notify({ title: a.name + ' removed', body: 'You can reinstall it any time from the App Store.', icon: 'trash', appId: 'softwarecenter' });
    return true;
  }

  function update(id) {
    if (!installed[id]) return Promise.reject(new Error('Not installed'));
    if (activeUpdate[id] && activeUpdate[id].running) return Promise.reject(new Error('Already updating'));
    const rec = { pct: 0, running: true };
    activeUpdate[id] = rec;
    return new Promise((resolve) => {
      let pct = 0;
      const tick = () => {
        pct = Math.min(100, pct + 3 + Math.random() * 8);
        rec.pct = pct;
        LX.bus.emit('packages:progress', { id, pct: Math.round(pct), rate: 8 + Math.random() * 6, update: true });
        if (pct >= 100) {
          installed[id] = { v: versionOf(id), t: Date.now() }; save();
          delete activeUpdate[id];
          writeManifest(id);
          LX.bus.emit('packages:change', { op: 'update', id });
          resolve({ ok: true });
        } else t = setTimeout(tick, 80);
      };
      let t = setTimeout(tick, 150);
    });
  }
  const activeUpdate = {};

  // simulated "the live store moved on": once per boot, some installed apps get a newer store version
  function simulateStoreDrift() {
    const ids = Object.keys(installed).filter(pkgOf);
    if (!ids.length) return;
    const r = LX.seeded('drift' + new Date().toDateString());
    ids.forEach((id) => {
      if (r() < 0.3) {
        const cur = versionOf(id).split('.').map(Number);
        cur[1] = (cur[1] || 0) + 1 + Math.floor(r() * 3);
        liveVer[id] = cur[0] + '.' + cur[1]; saveV();
      }
    });
  }

  LX.packages = {
    isInstalled: (id) => !!installed[id],
    installedList: () => Object.keys(installed).map((id) => ({ id, v: installed[id].v, t: installed[id].t })).sort((a, b) => b.t - a.t),
    versionOf,
    appSize,
    totalSize,
    install,
    uninstall,
    update,
    cancel(id) { if (active[id]) { active[id].cancel = true; return true; } return false; },
    isDownloading: (id) => !!active[id],
    isUpdating: (id) => !!(activeUpdate[id] && activeUpdate[id].running),
    markForUpdate() {},
    updates() { return Object.keys(installed).filter((id) => bumpCompare(versionOf(id), installed[id].v) > 0); },
    updateCount() { return this.updates().length + (LX.repos ? LX.repos.updates().length : 0); },
    downloadCount(id) { const a = LX.apps.get(id) || {}; return a.downloads != null ? a.downloads : 120 + LX.hash(id + 'dl', 3800); }, // in thousands
    simulateStoreDrift,
    usage() {
      let mb = 0;
      Object.keys(installed).forEach((id) => { mb += totalSize(id); });
      return { apps: Object.keys(installed).length, mb: Math.round(mb) };
    },
  };

  LX.onInit(() => {
    // restore visibility for everything installed (apps register hidden on every page load)
    Object.keys(installed).forEach((id) => {
      const a = LX.apps.get(id);
      if (a && a.pkg && LX.packages.isInstalled(id)) { a.hidden = false; LX.bus.emit('apps:change', id); }
      else if (a && a.pkg) { // stale record (app no longer exists) — drop it
        delete installed[id]; save();
      }
    });
    simulateStoreDrift();
  });
})();
