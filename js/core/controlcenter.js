/* Leonux OS 2 — control centre (quick settings): toggles, sliders,
   Mission Control & dock tiles, App Store + install-to-system chips. */
(function () {
  'use strict';
  const H = LX.h;
  function tile(key, icon, label, subFn, extra) {
    const t = H('button', { class: 'cc-tile', onclick: () => { LX.settings.set(key, !LX.settings.get(key)); if (extra) extra(LX.settings.get(key)); } },
      H('span', { class: 'cc-tile-ico', html: LX.icon(icon, 20) }), H('span', { class: 'cc-tile-txt' }, H('b', { text: label }), H('small', { class: 'cc-sub' })));
    const upd = () => { const on = !!LX.settings.get(key); t.classList.toggle('on', on); t.querySelector('.cc-sub').textContent = subFn ? subFn(on) : on ? 'On' : 'Off'; };
    upd(); LX.bus.on('settings:change', (e) => { if (e.key === key || e.key === 'airplane') upd(); });
    return t;
  }
  function actionTile(icon, label, sub, fn) {
    const t = H('button', { class: 'cc-tile act', onclick: fn }, H('span', { class: 'cc-tile-ico', html: LX.icon(icon, 20) }), H('span', { class: 'cc-tile-txt' }, H('b', { text: label }), H('small', { class: 'cc-sub', text: sub || '' })));
    return t;
  }
  // Focus modes: click toggles the last-used mode (Do Not Disturb by default), the chevron picks another
  function focusTile() {
    const t = H('button', { class: 'cc-tile', onclick: (e) => {
      const r = t.getBoundingClientRect();
      if (e.target.closest('.cc-more')) return LX.menu.show(r.left, r.bottom + 4, LX.focus.menuItems());
      LX.focus.toggle(LX.settings.get('focus') || LX.store.get('focus.last', 'dnd'));
    } }, H('span', { class: 'cc-tile-ico' }), H('span', { class: 'cc-tile-txt' }, H('b', { text: 'Focus' }), H('small', { class: 'cc-sub' })), H('span', { class: 'cc-more', html: LX.icon('chevron-down', 14) }));
    const upd = () => {
      const f = LX.focus.current(); t.classList.toggle('on', !!f);
      t.querySelector('.cc-tile-ico').innerHTML = LX.icon(f ? f.icon : 'moon', 20); t.querySelector('.cc-sub').textContent = f ? f.name : 'Off';
      if (f) LX.store.set('focus.last', f.id);
    };
    upd(); LX.bus.on('focus:change', upd); LX.bus.on('settings:change', (e) => { if (e.key === 'focus' || e.key === 'dnd') upd(); });
    return t;
  }
  function slider(key, icon, min) {
    const r = H('input', { type: 'range', class: 'slider', min: min || 0, max: 100, value: LX.settings.get(key), oninput: () => { LX.settings.set(key, +r.value); if (key === 'volume') LX.audio.beep(520, 0.05, 'sine', 0.1); } });
    const ico = H('span', { class: 'cc-sl-ico', html: LX.icon(icon, 18) });
    LX.bus.on('settings:change', (e) => { if (e.key === key && +r.value !== e.value) r.value = e.value; });
    return H('div', { class: 'cc-slider' }, ico, r);
  }
  LX.onInit(() => {
    const p = document.getElementById('cc'); if (!p) return;
    const clock = H('div', { class: 'cc-time' }), user = H('div', { class: 'cc-user', text: LX.settings.get('fullname') });

    // App-store / PWA status chips (live)
    const storeChip = H('button', { class: 'cc-chip cc-chip-store', onclick: () => { LX.panels.close(); LX.apps.launch('softwarecenter', LX.packages.updateCount() ? { view: 'updates' } : null); } });
    const installChip = H('button', { class: 'cc-chip', style: { display: 'none' }, onclick: () => LX.pwa.promptInstall() });
    function paintChips() {
      const u = LX.packages ? LX.packages.updateCount() : 0;
      storeChip.innerHTML = LX.icon('store', 15) + '<span>' + (u ? LX.plural(u, 'update') + ' available' : 'App Store') + '</span>';
      const can = LX.pwa && LX.pwa.canInstall && !LX.pwa.installed;
      installChip.style.display = can ? '' : 'none';
      installChip.innerHTML = LX.icon('rocket', 15) + '<span>Install as app</span>';
    }
    paintChips();
    LX.bus.on('packages:change', paintChips); LX.bus.on('pwa:caninstall', paintChips); LX.bus.on('pwa:installed', paintChips);

    p.append(
      H('div', { class: 'cc-head' }, H('div', null, clock, user),
        H('div', { class: 'cc-head-btns' },
          H('button', { class: 'btn icon ghost', title: 'Settings', html: LX.icon('settings', 17), onclick: () => { LX.panels.close(); LX.apps.launch('settings'); } }),
          H('button', { class: 'btn icon ghost', title: 'Lock', html: LX.icon('lock', 17), onclick: () => { LX.panels.close(); LX.power.lock(); } }),
          H('button', { class: 'btn icon ghost', title: 'Power', html: LX.icon('power', 17), onclick: () => { LX.panels.close(); LX.power.shutdown(); } }))),
      H('div', { class: 'cc-grid' },
        tile('wifi', 'wifi', 'Wi-Fi', (on) => (on && !LX.settings.get('airplane') ? LX.network.ssid : 'Off')),
        tile('bluetooth', 'bluetooth', 'Bluetooth', (on) => (on ? 'Discoverable' : 'Off')),
        tile('airplane', 'zap', 'Airplane', null, (on) => { if (on) { LX.settings.set('wifi', false); LX.settings.set('bluetooth', false); } }),
        focusTile(),
        tile('nightLight', 'sun', 'Night light'),
        tile('battSaver', 'battery', 'Battery saver'),
        actionTile('columns', 'Mission Control', 'Ctrl+Alt+↑', () => { LX.panels.close(); LX.spaces.missionControl(); }),
        actionTile('image', 'Screen saver', 'Start now', () => { LX.panels.close(); setTimeout(() => LX.screensaver.start(), 250); }),
        tile('widgets', 'layers', 'Widgets', (on) => (on ? 'Shown' : 'Hidden')),
        tile('dock', 'rocket', 'Dock', (on) => on ? 'Dock + menu bar' : 'Classic bar')),
      H('div', { class: 'cc-sliders' }, slider('brightness', 'sun', 20), slider('volume', 'volume')),
      H('div', { class: 'cc-row' },
        H('button', { class: 'cc-chip', onclick: () => LX.settings.set('theme', LX.theme.isDark() ? 'light' : 'dark'), html: LX.icon('moon', 15) + '<span>Theme</span>' }),
        storeChip,
        installChip,
        H('button', { class: 'cc-chip', onclick: () => { LX.panels.close(); LX.wm.showDesktop(); }, html: LX.icon('monitor', 15) + '<span>Desktop</span>' })));
    LX.panels.register('cc', p);
    LX.bus.on('clock:tick', (d) => { clock.textContent = LX.fmtTime(d); });
    LX.bus.on('settings:change', (e) => { if (e.key === 'fullname') user.textContent = e.value; });
  });
})();
