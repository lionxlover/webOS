/* Leonux OS 2 — Spaces (virtual desktops) + Mission Control overview.
   Ctrl+Alt+←/→ switch spaces, Ctrl+Alt+↑ (or F3 / CC tile) opens Mission Control. */
(function () {
  'use strict';
  const H = LX.h;
  const N = 4;
  let cur = 0;
  let overlay = null;
  const enabled = () => LX.settings.get('spaces') !== false;

  function applyVisibility() {
    LX.wm.list().forEach((w) => {
      if (w.space == null) w.space = 0;
      w.el.classList.toggle('off-space', enabled() && w.space !== cur);
    });
    LX.bus.emit('spaces:change', { current: cur });
  }

  function go(i, silent) {
    if (!enabled()) return;
    i = ((i % N) + N) % N;
    if (i === cur) return;
    cur = i;
    applyVisibility();
    if (!silent) {
      const flash = H('div', { class: 'space-flash' });
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 480);
      LX.audio.beep(620, 0.05, 'sine', 0.06);
    }
  }

  function assignNew(win) { if (win.space == null) win.space = cur; applyVisibility(); }

  // ---------------- Mission Control ----------------
  function previewOf(w) {
    const wrap = H('button', { class: 'mc-win' + (w.minimized ? ' minimized' : ''), title: w.title });
    const clone = w.el.cloneNode(true);
    clone.classList.remove('minimized', 'minimizing', 'off-space', 'focused');
    clone.classList.add('mc-clone');
    const scale = Math.min(1, 300 / Math.max(240, w.el.offsetWidth)) * 0.98;
    clone.style.transform = 'scale(' + (scale * 0.94) + ')';
    wrap.appendChild(clone);
    const app = LX.apps.get(w.appId) || {};
    wrap.appendChild(H('div', { class: 'mc-cap' }, H('span', { style: { color: app.color }, html: LX.icon(w.icon, 14) }), H('span', { class: 'ellipsis', text: w.title })));
    wrap.addEventListener('click', () => { close(); go(w.space || 0, true); setTimeout(() => w.focus(), 60); });
    return wrap;
  }

  function openMC() {
    if (overlay) return close();
    LX.panels.close(); LX.menu.close();
    overlay = H('div', { class: 'mc-overlay' });
    const bySpace = {};
    LX.wm.list().forEach((w) => { if (w.space == null) w.space = 0; (bySpace[w.space] = bySpace[w.space] || []).push(w); });

    const pills = H('div', { class: 'mc-spaces' });
    const rows = H('div', { class: 'mc-rows scroll' });
    for (let i = 0; i < N; i++) {
      const wins = (bySpace[i] || []).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex);
      pills.appendChild(H('button', { class: 'mc-pill' + (i === cur ? ' cur' : ''), onclick: () => { const t = i; close(); go(t); } },
        H('span', { class: 'mc-pill-dot' + (wins.length ? ' busy' : '') }), 'Desktop ' + (i + 1)));
      rows.appendChild(H('div', { class: 'mc-row' + (i === cur ? ' cur' : '') },
        H('div', { class: 'mc-row-h', onclick: () => { close(); go(i); } }, H('span', { class: 'mc-row-t', text: 'Desktop ' + (i + 1) }), H('span', { class: 'mc-row-n muted', text: wins.length ? LX.plural(wins.length, 'window') : 'Empty' })),
        H('div', { class: 'mc-row-wins' }, wins.length ? wins.map(previewOf) : H('div', { class: 'mc-empty muted', text: 'Nothing here — switch with Ctrl+Alt+←/→' }))));
    }
    overlay.append(H('div', { class: 'mc-top' }, H('h2', { text: 'Mission Control' }), H('span', { class: 'muted', text: 'Click a window to jump to its space · Esc to close' })), pills, rows);
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
    document.getElementById('dialogs').appendChild(overlay);
    requestAnimationFrame(() => overlay && overlay.classList.add('open'));
  }
  function close() { if (!overlay) return; const o = overlay; overlay = null; o.classList.remove('open'); setTimeout(() => o.remove(), 200); }

  LX.spaces = {
    count: N,
    get current() { return cur; },
    enabled,
    go, next: () => go(cur + 1), prev: () => go(cur - 1),
    missionControl: openMC,
    close,
    toggle: openMC,
  };

  LX.onInit(() => {
    // windows opened after this hook get the current space
    LX.bus.on('wm:change', (e) => { if (e.type === 'open') { if (e.win.space == null) e.win.space = cur; applyVisibility(); } });
    applyVisibility();
  });
})();
