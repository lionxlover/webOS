/* Leonux OS 2 — taskbar with two personalities:
   • Classic bar  — full-width taskbar (Settings → Personalization)
   • Dock mode (default) — floating centred dock with hover magnification,
     launch bounce, running dots and live App-Store update badges.
   Includes tray (network, volume, battery, spaces), clock and show-desktop. */
(function () {
  'use strict';
  const H = LX.h;
  let appsEl, wifiEl, volEl, battEl, clockEl, dateEl, badgeEl, spacesEl, deskEl, bar;

  function groups() {
    const map = new Map();
    (LX.settings.get('pinned') || []).forEach((id) => { const a = LX.apps.get(id); if (a && !a.hidden) map.set(id, []); });
    LX.wm.list().forEach((w) => { if (LX.apps.get(w.appId) && LX.apps.get(w.appId).hidden) return; if (!map.has(w.appId)) map.set(w.appId, []); map.get(w.appId).push(w); });
    return map;
  }
  function renderApps() {
    if (!appsEl) return;
    appsEl.innerHTML = '';
    groups().forEach((ws, id) => {
      const app = LX.apps.get(id) || { name: id, icon: 'package', color: '#5B9DFA' };
      const running = ws.length > 0, focused = ws.some((w) => w.isFocused());
      const updates = id === 'softwarecenter' ? LX.packages.updateCount() : 0;
      const b = H('button', { class: 'tb-app' + (running ? ' running' : '') + (focused ? ' focused' : ''), title: app.name + (ws.length > 1 ? ' (' + ws.length + ' windows)' : ''), dataset: { app: id },
        onclick: () => {
          if (!running) return launchBounce(id, () => LX.apps.launch(id));
          if (ws.length === 1) { const w = ws[0]; if (w.minimized) w.restore(); else if (w.isFocused()) w.minimize(); else w.focus(); return; }
          const r = b.getBoundingClientRect();
          LX.menu.show(r.left, r.top - ws.length * 34 - 16, ws.map((w) => ({ label: w.title, icon: app.icon, action: () => w.focus() })).concat([{ separator: true }, { label: 'New window', icon: 'plus', action: () => LX.apps.launch(id) }]));
        },
        oncontextmenu: (e) => {
          e.preventDefault(); const pinned = (LX.settings.get('pinned') || []).indexOf(id) >= 0;
          LX.menu.show(e.clientX, e.clientY - 120, [
            { label: 'Open new window', icon: 'plus', action: () => LX.apps.launch(id) },
            { label: pinned ? 'Unpin from taskbar' : 'Pin to taskbar', icon: 'pin', action: () => { const p = (LX.settings.get('pinned') || []).slice(); LX.settings.set('pinned', pinned ? p.filter((x) => x !== id) : p.concat(id)); } },
            id === 'softwarecenter' && { separator: true }, id === 'softwarecenter' && { label: LX.plural(LX.packages.updateCount(), 'update') + ' available', icon: 'refresh2', action: () => LX.apps.launch('softwarecenter', { view: 'updates' }) },
            running && { separator: true }, running && { label: 'Close all windows', icon: 'x', danger: true, action: () => ws.forEach((w) => w.close()) }]);
        } },
        H('span', { class: 'tb-ico', style: { color: app.color }, html: LX.icon(app.icon, 22) }),
        ws.length > 1 && H('span', { class: 'tb-count', text: ws.length }),
        updates ? H('span', { class: 'tb-alert', title: LX.plural(updates, 'update'), text: String(updates) }) : null);
      appsEl.appendChild(b);
    });
    if (LX.apps.get('trash') && !LX.apps.get('trash').hidden && !(LX.settings.get('pinned') || []).includes('trash')) {
      const full = (() => { try { return LX.vfs.trashList().length > 0; } catch (e) { return false; } })();
      appsEl.appendChild(H('span', { class: 'tb-sep' }));
      const tr = H('button', { class: 'tb-app tb-trash' + (LX.wm.list().some((w) => w.appId === 'trash') ? ' running' : ''), title: 'Trash', dataset: { app: 'trash' }, onclick: () => LX.apps.launch('trash') },
        H('span', { class: 'tb-ico', style: { color: full ? 'var(--text)' : 'var(--text-muted)' }, html: LX.icon('trash', 22) }));
      appsEl.appendChild(tr);
    }
  }

  function launchBounce(id, fn) {
    fn();
    const btn = appsEl && appsEl.querySelector('[data-app="' + id + '"]');
    if (btn && LX.settings.get('animations')) { btn.classList.add('bounce'); setTimeout(() => btn.classList.remove('bounce'), 1000); }
  }

  // ---- dock magnification ----
  function magnifyOn() {
    if (!appsEl) return;
    const reset = () => LX.$$('.tb-app', appsEl).forEach((el) => { el.style.transform = ''; });
    appsEl.addEventListener('pointermove', (e) => {
      if (!document.body.classList.contains('dock') || !LX.settings.get('dockMagnify')) return reset();
      LX.$$('.tb-app', appsEl).forEach((el) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(e.clientX - (r.left + r.width / 2));
        const f = Math.exp(-(d * d) / (2 * 78 * 78));
        const scale = 1 + 0.42 * f;
        const lift = -14 * f;
        el.style.transform = 'translateY(' + lift.toFixed(1) + 'px) scale(' + scale.toFixed(3) + ')';
      });
    });
    appsEl.addEventListener('pointerleave', reset);
  }

  function updateTray() {
    if (!wifiEl) return;
    const s = LX.settings;
    wifiEl.innerHTML = LX.icon('wifi', 16); wifiEl.classList.toggle('off', !LX.network.online);
    volEl.innerHTML = LX.icon(s.get('volume') == 0 ? 'volume-x' : 'volume', 16);
    const lv = Math.round(LX.battery.level * 100);
    battEl.innerHTML = LX.icon(LX.battery.charging ? 'zap' : 'battery', 16) + '<span>' + lv + '%</span>';
    battEl.classList.toggle('low', lv < 20 && !LX.battery.charging);
    if (badgeEl) { const dnd = s.get('dnd'); badgeEl.innerHTML = LX.icon(dnd ? 'moon' : 'bell', 15); badgeEl.classList.toggle('dnd', !!dnd); }
    if (spacesEl) {
      const on = LX.spaces && LX.spaces.enabled();
      spacesEl.style.display = on ? '' : 'none';
      spacesEl.innerHTML = LX.icon('columns', 15) + '<span>' + (LX.spaces ? LX.spaces.current + 1 : 1) + '</span>';
      spacesEl.title = 'Mission Control (Ctrl+Alt+↑)';
    }
    if (deskEl) deskEl.title = 'Show desktop (Meta+D)';
  }

  // layout 'dock+menubar' (default) → floating dock; 'taskbar' → classic full-width bar. `dock` mirrors it.
  function applyMode() {
    const dock = LX.settings.get('layout') !== 'taskbar';
    document.body.classList.toggle('dock', dock);
    if (dock) document.body.style.setProperty('--taskbar-h', '64px');
    else document.body.style.removeProperty('--taskbar-h');
    document.body.style.setProperty('--dock-icon', Math.round(LX.clamp(+LX.settings.get('dockSize') || 46, 32, 72) * 1.08) + 'px');
  }
  // dock auto-hide: reveal when the pointer touches the bottom edge
  function autoHide() {
    let t;
    document.addEventListener('pointermove', (e) => {
      if (!document.body.classList.contains('dock-hide')) return;
      const r = bar.getBoundingClientRect();
      const near = e.clientY >= innerHeight - 4 || (bar.classList.contains('reveal') && e.clientY > r.top - 10);
      clearTimeout(t);
      if (near) bar.classList.add('reveal'); else t = setTimeout(() => bar.classList.remove('reveal'), 280);
    }, { passive: true });
  }

  LX.onInit(() => {
    bar = document.getElementById('taskbar'); if (!bar) return;
    applyMode();
    appsEl = H('div', { class: 'tb-apps' });
    wifiEl = H('span', { class: 'tray-ico' }); volEl = H('span', { class: 'tray-ico' }); battEl = H('span', { class: 'tray-ico batt' });
    spacesEl = H('span', { class: 'tray-ico spaces', title: 'Mission Control', onclick: (e) => { e.stopPropagation(); LX.spaces && LX.spaces.missionControl(); } });
    const tray = H('button', { class: 'tb-tray', title: 'Quick settings', onclick: () => LX.panels.toggle('cc') }, wifiEl, volEl, battEl, spacesEl);
    tray.setAttribute('data-panel-trigger', '');
    clockEl = H('div', { class: 'tb-time' }); dateEl = H('div', { class: 'tb-date' });
    badgeEl = H('span', { class: 'tray-ico' });
    const clock = H('button', { class: 'tb-clock', title: 'Notifications & calendar', onclick: () => LX.panels.toggle('notif') }, H('div', { class: 'tb-clock-txt' }, clockEl, dateEl), badgeEl);
    clock.setAttribute('data-panel-trigger', '');
    const start = H('button', { class: 'tb-start', title: 'Start (Meta / Alt+Space)', html: '<span class="logo-mark"></span>', onclick: () => LX.panels.toggle('launcher') });
    start.setAttribute('data-panel-trigger', '');
    const search = H('button', { class: 'tb-search', title: 'Search (Ctrl+Space)', html: LX.icon('search', 18), onclick: () => LX.search.open() });
    deskEl = H('button', { class: 'tb-showdesk', title: 'Show desktop (Meta+D)', onclick: () => LX.wm.showDesktop() });
    bar.append(H('div', { class: 'tb-left' }, start, search), appsEl, H('div', { class: 'tb-right' }, tray, clock, deskEl));
    LX.bus.on('wm:change', renderApps); LX.bus.on('apps:change', renderApps);
    LX.bus.on('packages:change', renderApps);
    // keep the legacy `dock` flag and the `layout` setting in agreement
    const dk = LX.settings.get('layout') !== 'taskbar'; if (LX.settings.get('dock') !== dk) LX.settings.set('dock', dk);
    LX.bus.on('settings:change', (e) => {
      if (e.key === 'dock') { const l = e.value ? 'dock+menubar' : 'taskbar'; if (LX.settings.get('layout') !== l) LX.settings.set('layout', l); }
      if (e.key === 'layout') { const d = e.value !== 'taskbar'; if (LX.settings.get('dock') !== d) LX.settings.set('dock', d); }
      if (e.key === 'pinned') renderApps();
      if (e.key === 'dock' || e.key === 'layout' || e.key === 'taskbarPos' || e.key === 'dockSize') applyMode();
      updateTray();
    });
    LX.bus.on('battery:change', updateTray); LX.bus.on('vfs:change', (e) => { if (e.path && e.path.indexOf('.Trash') >= 0) renderApps(); });
    LX.bus.on('spaces:change', updateTray);
    LX.bus.on('clock:tick', (d) => { clockEl.textContent = LX.fmtTime(d); dateEl.textContent = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); });
    renderApps(); updateTray();
    magnifyOn(); autoHide();
  });
})();
