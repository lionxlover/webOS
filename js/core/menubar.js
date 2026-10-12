/* Leonux OS 2.2 — global top menubar (layout 'dock+menubar'): logo menu, active-app menus mirrored from
   win.setMenu, status icons, clock + calendar popover, Control Center / Notifications / Spotlight buttons. */
(function () {
  'use strict';
  const H = LX.h;
  let bar, leftEl, rightEl, clockEl, wifiEl, volEl, battEl, focusEl, spaceEl, calPanel, calGrid, calTitle, calDate = new Date(), openBtn = null, wasOpen = false;
  const isOn = () => LX.settings.get('layout') !== 'taskbar';
  const menuOpen = () => !!document.querySelector('#menus > .ctx-menu');
  const S = () => LX.settings;

  function showMenu(btn, items) {
    const r = btn.getBoundingClientRect();
    openBtn = btn; LX.panels.close();
    LX.menu.show(Math.max(4, r.left - 2), r.bottom + 1, items);
    paintOpen();
  }
  function paintOpen() { LX.$$('.mb-btn.open', bar).forEach((b) => b.classList.remove('open')); if (openBtn && menuOpen()) openBtn.classList.add('open'); }
  function btn(cls, content, onclick, title) {
    const b = H('button', { class: 'mb-btn ' + (cls || ''), title: title || null, onclick }, content);
    return b;
  }
  // a dropdown trigger: toggles on click, hover-switches while another menu is open
  function dd(cls, label, getItems, title) {
    const b = btn(cls, label, () => { if (wasOpen && openBtn === b) { wasOpen = false; return; } showMenu(b, getItems()); }, title);
    b.addEventListener('pointerenter', () => { if (menuOpen() && openBtn !== b) showMenu(b, getItems()); });
    return b;
  }

  // ---------- logo menu ----------
  const logoItems = () => [
    { label: 'About Leonux OS', icon: 'info', action: () => LX.apps.launch('settings', { page: 'about' }) },
    { separator: true },
    { label: 'System Settings…', icon: 'settings', action: () => LX.apps.launch('settings') },
    { label: 'App Store…', icon: 'store', action: () => LX.apps.launch('softwarecenter') },
    { label: 'Launchpad', icon: 'grid', shortcut: 'Alt+Space', action: () => LX.panels.open('launcher') },
    { label: 'Mission Control', icon: 'columns', shortcut: 'Ctrl+Alt+↑', action: () => LX.spaces.missionControl() },
    { separator: true },
    { label: 'Force Quit…', icon: 'x', action: () => LX.apps.launch('taskmanager') },
    { separator: true },
    { label: 'Lock Screen', icon: 'lock', shortcut: 'Ctrl+Alt+L', action: () => LX.power.lock() },
    { label: 'Sleep', icon: 'moon', action: () => LX.power.sleep() },
    { label: 'Restart…', icon: 'refresh', action: () => LX.power.restart() },
    { label: 'Shut Down…', icon: 'power', action: () => LX.power.shutdown() }];

  // ---------- app / window menus ----------
  function windowMenu(w) {
    const ws = LX.wm.list();
    const items = [
      { label: 'Minimise', icon: 'minus', disabled: !w, action: () => w && w.minimize() },
      { label: w && w.maximized ? 'Restore' : 'Zoom', icon: 'maximize', disabled: !w, action: () => w && w.toggleMax() },
      { label: w && w.fullscreen ? 'Exit Full Screen' : 'Enter Full Screen', icon: 'fullscreen', shortcut: 'F11', disabled: !w, action: () => w && w.toggleFullscreen() },
      { label: w && w.pinned ? 'Unpin from Top' : 'Always on Top', icon: 'pin', disabled: !w, action: () => w && w.setPinned(!w.pinned) },
      { separator: true },
      { label: 'Tile Window to Left', icon: 'arrow-left', disabled: !w, action: () => w && LX.snap.apply(w, 'left') },
      { label: 'Tile Window to Right', icon: 'arrow-right', disabled: !w, action: () => w && LX.snap.apply(w, 'right') }];
    if (LX.spaces && LX.spaces.enabled()) items.push({ label: 'Move to Desktop', icon: 'columns', disabled: !w, children: Array.from({ length: LX.spaces.count }, (_, i) => ({ label: 'Desktop ' + (i + 1), checked: !!w && (w.space || 0) === i, action: () => { if (w) { w.space = i; LX.spaces.go(i, true); LX.spaces.go(i); w.focus(); } } })) });
    items.push({ separator: true }, { label: 'Bring All to Front', action: () => ws.filter((x) => !x.minimized).forEach((x) => x.focus()) });
    if (ws.length) items.push({ separator: true });
    ws.forEach((x) => items.push({ label: x.title, icon: x.icon, checked: x === w, action: () => { if (LX.spaces && LX.spaces.enabled() && x.space != null) LX.spaces.go(x.space, true); x.focus(); } }));
    return items;
  }
  function appMenu(w) {
    const app = LX.apps.get(w.appId) || { name: w.appId };
    const same = LX.wm.list().filter((x) => x.appId === w.appId);
    return [
      { label: 'About ' + app.name, icon: 'info', action: () => LX.notify({ title: app.name, body: app.desc || 'Leonux application', icon: app.icon || 'info' }) },
      { separator: true },
      { label: 'New Window', icon: 'plus', disabled: !!app.singleton, action: () => LX.apps.launch(w.appId) },
      { label: 'Hide ' + app.name, icon: 'minus', action: () => same.forEach((x) => x.minimize()) },
      { label: 'Hide Others', action: () => LX.wm.list().filter((x) => x.appId !== w.appId).forEach((x) => x.minimize()) },
      { separator: true },
      { label: 'Close Window', icon: 'x', shortcut: 'Alt+F4', action: () => w.close() },
      { label: 'Quit ' + app.name, icon: 'power', danger: true, action: () => same.forEach((x) => x.close()) }];
  }
  function desktopMenus() {
    const home = LX.vfs.HOME;
    return [
      { label: 'File', items: [
        { label: 'New Folder', icon: 'folder-plus', action: () => LX.desktop && LX.desktop.newItem('dir') },
        { label: 'New Text File', icon: 'file-plus', action: () => LX.desktop && LX.desktop.newItem('file') },
        { separator: true }, { label: 'Open Files', icon: 'folder', action: () => LX.apps.launch('files') }, { label: 'Open Terminal', icon: 'terminal', action: () => LX.apps.launch('terminal') }] },
      { label: 'Go', items: ['Desktop', 'Documents', 'Pictures', 'Music', 'Videos', 'Downloads'].map((n) => ({ label: n, action: () => LX.apps.launch('files', { path: LX.vfs.join(home, n) }) })).concat([{ separator: true }, { label: 'Home', icon: 'home', action: () => LX.apps.launch('files', { path: home }) }]) },
      { label: 'View', items: [
        { label: 'Mission Control', icon: 'columns', action: () => LX.spaces.missionControl() }, { label: 'Show Desktop', icon: 'monitor', action: () => LX.wm.showDesktop() },
        { label: 'Screen Saver', icon: 'image', action: () => LX.screensaver && LX.screensaver.start() }, { label: 'Search…', icon: 'search', action: () => LX.search.open() }] }];
  }
  function paintLeft() {
    if (!leftEl) return;
    const w = LX.wm.focused();
    const app = w && !w.closed ? (LX.apps.get(w.appId) || { name: w.title }) : null;
    leftEl.innerHTML = '';
    leftEl.appendChild(dd('mb-logo', H('span', { class: 'logo-mark' }), logoItems, 'Leonux'));
    if (!app) {
      leftEl.appendChild(H('span', { class: 'mb-appname', text: 'Desktop' }));
      desktopMenus().forEach((m) => leftEl.appendChild(dd('mb-menu', m.label, () => m.items)));
      return;
    }
    leftEl.appendChild(dd('mb-appname', app.name, () => appMenu(w)));
    const mirrored = !S().get('menusInWindow') || false;
    (w.menus || []).forEach((m) => leftEl.appendChild(dd('mb-menu' + (mirrored ? '' : ' faint'), m.label, () => (m.items || []).map((it) => (it.separator ? it : Object.assign({}, it))))));
    leftEl.appendChild(dd('mb-menu', 'Window', () => windowMenu(w)));
  }

  // ---------- status ----------
  function paintStatus() {
    if (!wifiEl) return;
    wifiEl.innerHTML = LX.icon('wifi', 15); wifiEl.classList.toggle('off', !LX.network.online);
    volEl.innerHTML = LX.icon(+S().get('volume') === 0 || S().get('muted') ? 'volume-x' : 'volume', 15);
    const lv = Math.round(LX.battery.level * 100);
    battEl.innerHTML = LX.icon(LX.battery.charging ? 'zap' : 'battery', 16) + (S().get('mbBattPct') !== false ? '<span>' + lv + '%</span>' : '');
    battEl.classList.toggle('low', lv < 20 && !LX.battery.charging);
    const f = LX.focus ? LX.focus.current() : null;
    focusEl.style.display = f ? '' : 'none';
    if (f) { focusEl.innerHTML = LX.icon(f.icon, 14) + '<span>' + LX.escape(f.name) + '</span>'; focusEl.title = f.name + ' focus — click to change'; }
    const on = LX.spaces && LX.spaces.enabled();
    spaceEl.style.display = on ? '' : 'none';
    spaceEl.innerHTML = LX.icon('columns', 14) + '<span>' + ((LX.spaces && LX.spaces.current || 0) + 1) + '</span>';
  }
  function paintClock(d) {
    if (!clockEl) return; d = d || new Date();
    const date = S().get('mbDate') !== false ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' : '';
    clockEl.textContent = date + LX.fmtTime(d, !!S().get('mbSeconds'));
  }

  // ---------- calendar popover ----------
  function renderCal() {
    if (!calGrid) return;
    const y = calDate.getFullYear(), m = calDate.getMonth(), t = new Date();
    calTitle.textContent = new Date(y, m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    calGrid.innerHTML = '';
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d) => calGrid.appendChild(H('span', { class: 'cal-dow', text: d })));
    const start = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate(), prev = new Date(y, m, 0).getDate();
    for (let i = start - 1; i >= 0; i--) calGrid.appendChild(H('span', { class: 'cal-day dim', text: prev - i }));
    for (let d = 1; d <= dim; d++) calGrid.appendChild(H('span', { class: 'cal-day' + (d === t.getDate() && m === t.getMonth() && y === t.getFullYear() ? ' today' : ''), text: d,
      onclick: () => { if (LX.apps.get('calendar')) { LX.panels.close(); LX.apps.launch('calendar', { date: new Date(y, m, d).getTime() }); } } }));
    const total = start + dim; for (let i = 1; i <= (7 - (total % 7)) % 7; i++) calGrid.appendChild(H('span', { class: 'cal-day dim', text: i }));
  }
  function buildCal() {
    calTitle = H('div', { class: 'cal-title' }); calGrid = H('div', { class: 'cal-grid' });
    const big = H('div', { class: 'cp-big' }), sub = H('div', { class: 'cp-sub' });
    LX.bus.on('clock:tick', (d) => { if (calPanel.classList.contains('open')) { big.textContent = LX.fmtTime(d, true); sub.textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } });
    calPanel = H('div', { id: 'cal-panel' }, H('div', { class: 'cp-head' }, big, sub),
      H('div', { class: 'cal-head' }, H('button', { class: 'btn icon sm ghost', html: LX.icon('chevron-left', 14), onclick: () => { calDate = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1); renderCal(); } }), calTitle,
        H('button', { class: 'btn icon sm ghost', html: LX.icon('chevron-right', 14), onclick: () => { calDate = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1); renderCal(); } })),
      calGrid,
      H('div', { class: 'cp-foot' }, H('button', { class: 'btn sm ghost', text: 'Today', onclick: () => { calDate = new Date(); renderCal(); } }), H('button', { class: 'btn sm', text: 'Open Calendar', onclick: () => { LX.panels.close(); LX.apps.launch('calendar'); } })));
    document.body.appendChild(calPanel);
    LX.panels.register('cal', calPanel, { onOpen() { calDate = new Date(); renderCal(); LX.bus.emit('clock:tick', new Date()); } });
  }

  // ---------- layout switch ----------
  function sync() {
    const on = isOn(), cl = document.body.classList;
    cl.toggle('has-mb', on);
    cl.toggle('menus-global', on && !S().get('menusInWindow'));
    cl.toggle('dock-hide', on && !!S().get('dockAutoHide'));
    document.documentElement.style.setProperty('--mb-h', on ? '30px' : '0px');
    if (bar) bar.style.display = on ? '' : 'none';
    if (on) { paintLeft(); paintStatus(); paintClock(); }
    if (LX.wm.relayout) setTimeout(LX.wm.relayout, 20);
  }

  function build() {
    leftEl = H('div', { class: 'mb-left' });
    focusEl = btn('mb-status mb-focus', '', () => { if (LX.focus) showMenu(focusEl, LX.focus.menuItems()); }, 'Focus');
    spaceEl = btn('mb-status mb-space', '', () => LX.spaces.missionControl(), 'Mission Control');
    wifiEl = btn('mb-status', '', () => LX.panels.toggle('cc'), 'Wi-Fi'); volEl = btn('mb-status', '', () => LX.panels.toggle('cc'), 'Volume'); battEl = btn('mb-status mb-batt', '', () => LX.panels.toggle('cc'), 'Battery');
    const search = btn('mb-status', H('span', { html: LX.icon('search', 15) }), () => LX.search.toggle(), 'Spotlight (Ctrl+Space)');
    const cc = btn('mb-status', H('span', { html: LX.icon('sliders', 15) || LX.icon('settings', 15) }), () => LX.panels.toggle('cc'), 'Control Center');
    cc.innerHTML = '<svg class="ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.2"/><circle cx="9" cy="16" r="2.2"/></svg>';
    const notif = btn('mb-status', H('span', { html: LX.icon('bell', 15) }), () => LX.panels.toggle('notif'), 'Notification Centre');
    clockEl = btn('mb-clock', '', () => LX.panels.toggle('cal'), 'Calendar');
    [search, cc, notif, clockEl].forEach((b) => b.setAttribute('data-panel-trigger', ''));
    [wifiEl, volEl, battEl].forEach((b) => b.setAttribute('data-panel-trigger', ''));
    rightEl = H('div', { class: 'mb-right' }, focusEl, spaceEl, wifiEl, volEl, battEl, search, cc, notif, clockEl);
    bar = H('header', { id: 'menubar', role: 'menubar' }, leftEl, rightEl);
    document.body.insertBefore(bar, document.getElementById('taskbar'));
    notif._dot = null;
    // reveal on hover in full-screen mode
    document.addEventListener('pointermove', (e) => { if (document.body.classList.contains('fs-mode')) bar.classList.toggle('reveal', e.clientY < 3 || (bar.classList.contains('reveal') && e.clientY < 34)); }, { passive: true });
  }

  LX.menubar = { refresh() { sync(); }, enabled: isOn };

  LX.onInit(() => {
    build(); buildCal();
    window.addEventListener('pointerdown', () => { wasOpen = menuOpen(); }, true);
    new MutationObserver(paintOpen).observe(document.getElementById('menus'), { childList: true });
    LX.bus.on('wm:change', (e) => { if (e.type === 'title' && e.win !== LX.wm.focused()) return; paintLeft(); });
    LX.bus.on('apps:change', () => {});
    LX.bus.on('spaces:change', paintStatus); LX.bus.on('battery:change', paintStatus);
    LX.bus.on('focus:change', paintStatus);
    LX.bus.on('clock:tick', paintClock);
    LX.bus.on('settings:change', (e) => {
      if (['layout', 'menusInWindow', 'dockAutoHide', 'dock'].indexOf(e.key) >= 0) sync();
      if (['mbSeconds', 'mbDate', 'clock24'].indexOf(e.key) >= 0) paintClock();
      if (['mbBattPct', 'wifi', 'airplane', 'volume', 'muted'].indexOf(e.key) >= 0) paintStatus();
    });
    sync();

    // ---- Settings page ----
    if (LX.settingsPages) {
      const ui = LX.settingsPages.ui;
      LX.settingsPages.add({ id: 'menubar', title: 'Menu Bar', icon: 'menu', group: 'Personal', order: 18, render(c) {
        const paint = () => {
          c.innerHTML = '';
          c.appendChild(ui.page('Menu Bar',
            ui.group('Layout',
              ui.row('Desktop layout', 'Dock + top menu bar (default) or the classic taskbar', ui.seg('layout', [{ v: 'dock+menubar', l: 'Dock + Menu bar' }, { v: 'taskbar', l: 'Taskbar' }])),
              ui.row('Auto-hide the dock', 'Slide the dock away until the pointer touches the bottom edge', ui.toggle('dockAutoHide'))),
            ui.group('Menu bar',
              ui.row('Menus in window', 'Keep each app’s menu inside its window instead of the global menu bar', ui.toggle('menusInWindow')),
              ui.row('Show date', 'Weekday and date next to the clock', ui.toggle('mbDate')),
              ui.row('Show seconds', null, ui.toggle('mbSeconds')),
              ui.row('Battery percentage', null, ui.toggle('mbBattPct')))));
        };
        paint();
      } });
    }
  });
})();
