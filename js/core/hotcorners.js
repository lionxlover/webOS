/* Leonux OS 2.2 — hot corners: push the pointer into a screen corner to trigger an action. Configure in Settings → Hot Corners. */
(function () {
  'use strict';
  const H = LX.h;
  const ACTIONS = [
    { id: 'none', name: '—', desc: 'Do nothing', run() {} },
    { id: 'mc', name: 'Mission Control', icon: 'columns', run() { LX.spaces.missionControl(); } },
    { id: 'desktop', name: 'Show Desktop', icon: 'monitor', run() { LX.wm.showDesktop(); } },
    { id: 'launcher', name: 'Launchpad', icon: 'grid', run() { LX.panels.toggle('launcher'); } },
    { id: 'search', name: 'Spotlight', icon: 'search', run() { LX.search.toggle(); } },
    { id: 'lock', name: 'Lock Screen', icon: 'lock', run() { LX.power.lock(); } },
    { id: 'notif', name: 'Notification Centre', icon: 'bell', run() { LX.panels.toggle('notif'); } },
    { id: 'screensaver', name: 'Start Screen Saver', icon: 'image', run() { LX.screensaver && LX.screensaver.start(); } },
  ];
  const NAMES = { tl: 'Top left', tr: 'Top right', bl: 'Bottom left', br: 'Bottom right' };
  const cfg = () => Object.assign({ tl: 'none', tr: 'none', bl: 'none', br: 'none' }, LX.settings.get('hotCorners') || {});
  let zones = {}, cooling = false, dwell = null;

  function trigger(k) {
    if (cooling || (LX.lock && LX.lock.locked) || document.body.classList.contains('oobe-on')) return;
    const a = ACTIONS.find((x) => x.id === cfg()[k]); if (!a || a.id === 'none') return;
    cooling = true; setTimeout(() => { cooling = false; }, 900);
    zones[k].classList.add('fire'); setTimeout(() => zones[k].classList.remove('fire'), 450);
    try { a.run(); } catch (e) { console.error('[hotcorner]', e); }
  }
  function build() {
    Object.keys(NAMES).forEach((k) => {
      const z = H('div', { class: 'hot-corner hc-' + k, 'aria-hidden': 'true' });
      z.addEventListener('pointerenter', () => { if (cfg()[k] === 'none') return; clearTimeout(dwell); dwell = setTimeout(() => trigger(k), 180); });
      z.addEventListener('pointerleave', () => clearTimeout(dwell));
      document.body.appendChild(z); zones[k] = z;
    });
  }
  LX.hotcorners = { actions: ACTIONS, get: cfg, set(k, v) { const c = cfg(); c[k] = v; LX.settings.set('hotCorners', Object.assign({}, c)); } };

  LX.onInit(() => {
    build();
    if (!LX.settingsPages) return;
    const ui = LX.settingsPages.ui;
    LX.settingsPages.add({ id: 'hotcorners', title: 'Hot Corners', icon: 'maximize', group: 'Personal', order: 24, render(c) {
      const paint = () => {
        c.innerHTML = '';
        const sel = (k) => {
          const s = H('select', { class: 'select hcp-sel', 'aria-label': NAMES[k] + ' corner', onchange: () => { LX.hotcorners.set(k, s.value); paint(); } }, ACTIONS.map((a) => H('option', { value: a.id, text: a.name, selected: a.id === cfg()[k] })));
          s.value = cfg()[k]; return s;
        };
        const dot = (k) => H('span', { class: 'hcp-dot' + (cfg()[k] !== 'none' ? ' on' : ''), title: NAMES[k] });
        const picker = H('div', { class: 'hcp' },
          H('div', { class: 'hcp-screen' }, dot('tl'), dot('tr'), dot('bl'), dot('br'), H('div', { class: 'hcp-note muted', text: 'Move the pointer into a corner of the screen' })),
          H('div', { class: 'hcp-grid' }, ['tl', 'tr', 'bl', 'br'].map((k) => H('label', { class: 'hcp-cell hcp-' + k }, H('span', { class: 'muted', text: NAMES[k] }), sel(k)))));
        c.appendChild(ui.page('Hot Corners', ui.group('Screen corners', H('div', { class: 'st-row' }, picker)),
          ui.group(null, ui.row('Try it', 'Pushing the pointer into a corner runs its action after a short dwell', H('button', { class: 'btn sm', text: 'Reset all', onclick: () => { LX.settings.set('hotCorners', { tl: 'mc', tr: 'none', bl: 'none', br: 'desktop' }); paint(); } })))));
      };
      paint();
    } });
  });
})();
