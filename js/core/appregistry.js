/* Leonux Web OS — application registry, launcher and file-type openers (v2: package-aware) */
(function () {
  'use strict';
  const apps = {};
  const openers = {};
  const TEXT_EXT = 'txt log json js css html htm py rs c cpp h sh csv xml ini conf yml yaml toml md'.split(' ');
  LX.apps = {
    register(def) {
      apps[def.id] = Object.assign({ name: def.id, icon: 'package', color: '#5B9DFA', category: 'Other', desc: '', width: 820, height: 560, minWidth: 360, minHeight: 240, singleton: false, hidden: false, pkg: false, open() {} }, def);
      if (apps[def.id].pkg && !apps[def.id].installedByDefault) apps[def.id].hidden = true; // store apps hidden until installed
      LX.bus.emit('apps:change', def.id);
    },
    get: (id) => apps[id],
    list: () => Object.keys(apps).map((k) => apps[k]),
    // apps visible in launcher / search / taskbar
    visible: () => Object.keys(apps).map((k) => apps[k]).filter((a) => !a.hidden),
    setOpener(exts, appId) { [].concat(exts).forEach((e) => { openers[e] = appId; }); },
    unregister(id) { delete apps[id]; LX.bus.emit('apps:change', id); },
    openerFor(path) { const e = LX.vfs.ext(path); return openers[e] || (TEXT_EXT.indexOf(e) >= 0 || e === 'md' ? 'texteditor' : null); },
    launch(id, args) {
      const a = apps[id];
      if (!a) { if (LX.notify) LX.notify({ title: 'App not found', body: 'No application "' + id + '" is installed.', icon: 'alert' }); return null; }
      if (a.pkg && LX.packages && !LX.packages.isInstalled(id)) {
        LX.notify({ title: 'Not installed', body: a.name + ' can be installed from the App Store.', icon: 'store', appId: 'softwarecenter', args: { app: id } });
        return LX.apps.launch('softwarecenter', { app: id });
      }
      if (a.singleton) {
        const ex = LX.wm.list().find((w) => w.appId === id);
        if (ex) { if (ex.minimized) ex.restore(); ex.focus(); if (args) ex.emit('args', args); return ex; }
      }
      const win = LX.wm.create({ appId: id, title: a.name, icon: a.icon, width: a.width, height: a.height, minWidth: a.minWidth, minHeight: a.minHeight, color: a.color });
      win.args = args || {};
      try { a.open(win, win.args); }
      catch (e) {
        console.error('[app ' + id + ']', e);
        win.body.innerHTML = '<div class="app-crash"><b>' + LX.escape(a.name) + ' crashed</b><pre>' + LX.escape(String(e && e.stack || e)) + '</pre></div>';
      }
      LX.bus.emit('app:launch', id);
      return win;
    },
    openFile(path) {
      let id = this.openerFor(path);
      const a0 = id ? apps[id] : null;
      if (!a0 || a0.hidden) {
        const e = LX.vfs.ext(path);
        let alt = null;
        Object.keys(apps).forEach((k) => { const a = apps[k]; if (!a.hidden && a !== a0 && a.canOpenExt && [].concat(a.canOpenExt).indexOf(e) >= 0 && (!alt || k === 'texteditor' || k === 'photos')) alt = k; });
        if (alt) id = alt;
        else {
          const m = LX.vfs.mime(path);
          if (m.indexOf('text/') === 0 && apps.texteditor && !apps.texteditor.hidden) id = 'texteditor';
          else if (a0 && a0.pkg) { LX.apps.launch('softwarecenter', { app: a0.id }); return null; } // its default app exists in the store
          else { LX.dialog.alert('No application is associated with ".' + e + '" files.', 'Cannot open'); return null; }
        }
      }
      return this.launch(id, { path });
    },
    // "Open with" submenu items for a file — used by Files & Desktop
    openWithItems(path, cb) {
      const e = LX.vfs.ext(path);
      const candidates = [];
      Object.keys(apps).forEach((k) => {
        const a = apps[k];
        if (a.hidden || a.id === 'files-props' || !a.canOpenExt) return;
        if ([].concat(a.canOpenExt).indexOf(e) >= 0) candidates.push(a);
      });
      const items = candidates.map((a) => ({ label: a.name, icon: a.icon, action: () => { if (cb) cb(); LX.apps.launch(a.id, { path }); } }));
      if (LX.packages) {
        const notInstalled = [];
        Object.keys(apps).forEach((k) => {
          const a = apps[k];
          if (a.pkg && a.canOpenExt && [].concat(a.canOpenExt).indexOf(e) >= 0 && !LX.packages.isInstalled(k)) notInstalled.push(a);
        });
        if (notInstalled.length) {
          items.push({ separator: true });
          notInstalled.slice(0, 3).forEach((a) => items.push({ label: 'Install ' + a.name + ' from App Store', icon: 'download', action: () => { if (cb) cb(); LX.apps.launch('softwarecenter', { app: a.id }); } }));
        }
      }
      return items;
    },
  };
  LX.apps.setOpener(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'], 'photos');
  LX.apps.setOpener(['mp3', 'wav', 'ogg', 'm4a', 'lxtrack'], 'music');
  LX.apps.setOpener(['mp4', 'webm'], 'video');
  LX.apps.setOpener(['html', 'htm'], 'browser');
  LX.apps.setOpener(['md'], 'markdown');
  LX.apps.setOpener(['lxnote'], 'notes');
})();
