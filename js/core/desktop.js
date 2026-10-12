/* Leonux Web OS — desktop: icons from ~/Desktop, rubber-band selection, context menu */
(function () {
  'use strict';
  const H = LX.h;
  const DESK = LX.vfs.HOME + '/Desktop';
  let iconsEl, selected = new Set(), band = null;
  const SYS = [
    { id: '__files', name: 'Files', icon: 'folder', color: '#5B9DFA', open: () => LX.apps.launch('files', { path: LX.vfs.HOME }) },
    { id: '__trash', name: 'Trash', icon: 'trash', color: '#9aa1b0', open: () => LX.apps.launch('trash') },
  ];
  const fileIcon = (s) => {
    if (s.type === 'dir') return ['folder', '#5B9DFA'];
    const m = s.mime || '';
    if (m.indexOf('image/') === 0) return ['image', '#F28B82'];
    if (m.indexOf('audio/') === 0) return ['music', '#CBA6F7'];
    if (m.indexOf('video/') === 0) return ['video', '#F6C177'];
    if (m.indexOf('text/') === 0 || m === 'application/json') return ['file-text', '#9ECE6A'];
    return ['file', '#9aa1b0'];
  };
  LX.fileIcon = fileIcon;
  const pos = () => LX.store.get('desktop.pos', {});

  function layout() {
    const p = pos(); const cellH = 104, cellW = 96, a = LX.wm.area();
    const rows = Math.max(1, Math.floor((a.h - 24) / cellH));
    let i = 0;
    LX.$$('.d-icon', iconsEl).forEach((el) => {
      const k = el.dataset.key;
      if (p[k]) { el.style.left = p[k].x + 'px'; el.style.top = p[k].y + 'px'; }
      else { const c = Math.floor(i / rows), r = i % rows; el.style.left = (12 + c * cellW) + 'px'; el.style.top = (12 + r * cellH) + 'px'; i++; }
    });
  }
  function render() {
    iconsEl.innerHTML = '';
    const items = SYS.map((s) => ({ key: s.id, name: s.name, icon: s.icon, color: s.color, open: s.open, sys: true }));
    let files = []; try { files = LX.vfs.ls(DESK); } catch (e) {}
    const how = LX.settings.get('desktopSort') || 'name', ext = (n) => (n.lastIndexOf('.') > 0 ? n.slice(n.lastIndexOf('.') + 1).toLowerCase() : '');
    files = files.filter((s) => s.name[0] !== '.').sort((a, b) => {
      if (how === 'kind') return (a.type === b.type ? 0 : a.type === 'dir' ? -1 : 1) || ext(a.name).localeCompare(ext(b.name)) || a.name.localeCompare(b.name);
      if (how === 'modified') return (b.mtime || 0) - (a.mtime || 0);
      if (how === 'size') return (b.size || 0) - (a.size || 0);
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
    files.forEach((s) => { if (s.name[0] === '.') return; const [ic, col] = fileIcon(s); items.push({ key: s.path, name: s.name, icon: ic, color: col, path: s.path, type: s.type, open: () => (s.type === 'dir' ? LX.apps.launch('files', { path: s.path }) : LX.apps.openFile(s.path)) }); });
    items.forEach((it) => {
      const el = H('div', { class: 'd-icon', dataset: { key: it.key }, tabindex: '0',
        ondblclick: () => it.open(),
        onkeydown: (e) => { if (e.key === 'Enter') it.open(); if (e.key === 'Delete' && !it.sys) del(it); },
        onpointerdown: (e) => {
          if (e.button !== 0) return; e.stopPropagation();
          if (!e.ctrlKey && !selected.has(it.key)) selected.clear(); selected.add(it.key); paintSel();
          startDrag(e, el, it);
        },
        oncontextmenu: (e) => {
          e.preventDefault(); e.stopPropagation(); selected.clear(); selected.add(it.key); paintSel();
          LX.menu.show(e.clientX, e.clientY, [{ label: 'Open', icon: 'external', action: it.open }, !it.sys && { label: 'Quick Look', icon: 'zoom-in', shortcut: 'Space', action: () => LX.quicklook.show(it.path) }, !it.sys && { separator: true },
            !it.sys && { label: 'Rename', icon: 'edit', action: () => rename(it) }, !it.sys && { label: 'Move to Trash', icon: 'trash', danger: true, action: () => del(it) }]);
        } },
        H('div', { class: 'd-ico', style: { color: it.color }, html: LX.icon(it.icon, 38) }), H('div', { class: 'd-name', text: it.name }));
      iconsEl.appendChild(el);
    });
    layout(); paintSel();
  }
  function paintSel() { LX.$$('.d-icon', iconsEl).forEach((e) => e.classList.toggle('sel', selected.has(e.dataset.key))); }
  function del(it) { try { LX.vfs.rm(it.path); } catch (e) { LX.dialog.alert(e.message); } }
  function rename(it) { LX.dialog.prompt('New name', LX.vfs.basename(it.path), 'Rename').then((n) => { if (n && n !== it.name) { try { LX.vfs.mv(it.path, LX.vfs.join(LX.vfs.dirname(it.path), n)); } catch (e) { LX.dialog.alert(e.message); } } }); }
  function startDrag(e, el, it) {
    const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop; let moved = false;
    const move = (ev) => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return; moved = true;
      el.style.left = (ox + ev.clientX - sx) + 'px'; el.style.top = (oy + ev.clientY - sy) + 'px'; el.classList.add('drag');
    };
    const up = () => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); el.classList.remove('drag');
      if (moved) { const p = pos(); p[it.key] = { x: Math.max(0, el.offsetLeft), y: Math.max(0, el.offsetTop) }; LX.store.set('desktop.pos', p); }
    };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  }
  function newItem(kind) {
    const base = kind === 'dir' ? 'New Folder' : 'New File.txt';
    const name = LX.vfs.uniqueName(DESK, base);
    try { kind === 'dir' ? LX.vfs.mkdir(LX.vfs.join(DESK, name)) : LX.vfs.write(LX.vfs.join(DESK, name), ''); } catch (e) { LX.dialog.alert(e.message); }
  }
  function cleanUp() { LX.store.set('desktop.pos', {}); render(); }
  function sortBy(how) { LX.settings.set('desktopSort', how); LX.store.set('desktop.pos', {}); render(); }
  function ctx(e) {
    e.preventDefault();
    const cur = LX.settings.get('desktopSort') || 'name', wp = LX.settings.get('wallpaper');
    LX.menu.show(e.clientX, e.clientY, [
      { label: 'New Folder', icon: 'folder-plus', action: () => newItem('dir') }, { label: 'New Text File', icon: 'file-plus', action: () => newItem('file') }, { separator: true },
      { label: 'Change Wallpaper', icon: 'image', children: Object.keys(LX.theme.wallpapers).map((k) => ({ label: LX.theme.wallpapers[k].name + (k === 'dynamic' ? ' (follows the time of day)' : ''), checked: wp === k, action: () => LX.settings.set('wallpaper', k) })).concat([{ separator: true }, { label: 'More in Appearance…', icon: 'palette', action: () => LX.apps.launch('settings', { page: 'appearance' }) }]) },
      { label: 'Sort By', icon: 'sort', children: [['name', 'Name'], ['kind', 'Kind'], ['modified', 'Date Modified'], ['size', 'Size']].map((o) => ({ label: o[1], checked: cur === o[0], action: () => sortBy(o[0]) })) },
      { label: 'Clean Up', icon: 'grid', action: cleanUp },
      { label: 'Refresh', icon: 'refresh', action: render }, { separator: true },
      { label: 'Open Terminal', icon: 'terminal', action: () => LX.apps.launch('terminal', { cwd: DESK }) }, { label: 'Open Files', icon: 'folder', action: () => LX.apps.launch('files', { path: DESK }) },
      { label: 'Mission Control', icon: 'columns', shortcut: 'Ctrl+Alt+↑', action: () => LX.spaces.missionControl() },
      { label: LX.settings.get('widgets') ? 'Hide Widgets' : 'Show Widgets', icon: 'layers', action: () => LX.settings.set('widgets', !LX.settings.get('widgets')) }, { separator: true },
      { label: 'Display Settings…', icon: 'monitor', action: () => LX.apps.launch('settings', { page: 'display' }) }]);
  }
  LX.desktop = { newItem, render: () => render(), cleanUp, sortBy };
  LX.onInit(() => {
    const d = document.getElementById('desktop'); iconsEl = document.getElementById('desktop-icons'); if (!d || !iconsEl) return;
    d.addEventListener('contextmenu', (e) => { if (e.target === d || e.target.id === 'desktop-icons' || e.target.id === 'wallpaper') ctx(e); });
    d.addEventListener('pointerdown', (e) => {
      if (e.target !== d && e.target.id !== 'desktop-icons' && e.target.id !== 'wallpaper') return;
      if (e.button !== 0) return; selected.clear(); paintSel();
      const sx = e.clientX, sy = e.clientY; band = H('div', { class: 'd-band' }); d.appendChild(band);
      const move = (ev) => {
        const x = Math.min(sx, ev.clientX), y = Math.min(sy, ev.clientY), w = Math.abs(ev.clientX - sx), h = Math.abs(ev.clientY - sy);
        Object.assign(band.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
        LX.$$('.d-icon', iconsEl).forEach((el) => { const r = el.getBoundingClientRect(); const hit = !(r.right < x || r.left > x + w || r.bottom < y || r.top > y + h); if (hit) selected.add(el.dataset.key); else selected.delete(el.dataset.key); });
        paintSel();
      };
      const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); band && band.remove(); band = null; };
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    });
    LX.bus.on('settings:change', (e) => { if (e.key === 'desktopSort') render(); if (e.key === 'layout') setTimeout(layout, 60); });
    LX.bus.on('vfs:change', (e) => { if (e.path && (e.path.indexOf(DESK) === 0 || e.path === '/')) render(); });
    window.addEventListener('resize', LX.debounce(layout, 150));
    render();
  });
})();
