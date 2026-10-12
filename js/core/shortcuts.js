/* Leonux Web OS — global keyboard shortcuts + Alt+Tab switcher */
(function () {
  'use strict';
  const H = LX.h;
  let metaAlone = false, sw = null, swList = [], swIdx = 0;
  function showSwitcher(dir) {
    const ws = LX.wm.list().sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex);
    if (ws.length < 2) return;
    if (!sw) { swList = ws; swIdx = 0; sw = H('div', { class: 'switcher' }); document.getElementById('menus').appendChild(sw); }
    swIdx = (swIdx + dir + swList.length) % swList.length;
    sw.innerHTML = '';
    swList.forEach((w, i) => sw.appendChild(H('div', { class: 'sw-item' + (i === swIdx ? ' sel' : '') }, H('div', { class: 'sw-ico', html: LX.icon(w.icon, 30) }), H('div', { class: 'sw-t', text: w.title }))));
  }
  function endSwitcher() { if (!sw) return; const w = swList[swIdx]; sw.remove(); sw = null; if (w && !w.closed) w.focus(); }
  const key = (e) => e.key.toLowerCase();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Meta') { metaAlone = true; return; }
    metaAlone = false;
    const k = key(e);
    if (e.altKey && e.key === 'Tab') { e.preventDefault(); showSwitcher(e.shiftKey ? -1 : 1); return; }
    if (e.key === 'F11') { const fw = LX.wm.focused(); if (fw) { e.preventDefault(); fw.toggleFullscreen(); return; } }
    if (e.altKey && e.key === 'F4') { e.preventDefault(); const w = LX.wm.focused(); if (w) w.close(); return; }
    if ((e.altKey && e.code === 'Space') || (e.ctrlKey && e.altKey && k === 'a')) { e.preventDefault(); LX.panels.toggle('launcher'); return; }
    if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); LX.search.toggle(); return; }
    if (e.ctrlKey && e.altKey && k === 't') { e.preventDefault(); LX.apps.launch('terminal'); return; }
    if (e.ctrlKey && e.altKey && k === 'l') { e.preventDefault(); LX.power.lock(); return; }
    if (e.ctrlKey && e.altKey && k === 'd') { e.preventDefault(); LX.wm.showDesktop(); return; }
    if (e.metaKey && k === 'd') { e.preventDefault(); LX.wm.showDesktop(); return; }
    if (e.metaKey && k === 'l') { e.preventDefault(); LX.power.lock(); return; }
    if (e.metaKey && k === 'e') { e.preventDefault(); LX.apps.launch('files'); return; }
    // ---- spaces (virtual desktops) ----
    if (e.ctrlKey && e.altKey && k === 'arrowleft') { e.preventDefault(); LX.spaces.prev(); return; }
    if (e.ctrlKey && e.altKey && k === 'arrowright') { e.preventDefault(); LX.spaces.next(); return; }
    if ((e.ctrlKey && e.altKey && k === 'arrowup') || e.key === 'F3') { e.preventDefault(); LX.spaces.toggle(); return; }
    if (e.ctrlKey && e.altKey && k === 'arrowdown') { e.preventDefault(); LX.spaces.close(); return; }
    if ((e.metaKey || e.altKey) && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].indexOf(k) >= 0 && (e.metaKey || e.shiftKey)) {
      const w = LX.wm.focused(); if (!w) return; e.preventDefault();
      if (k === 'arrowleft') LX.snap.apply(w, 'left'); else if (k === 'arrowright') LX.snap.apply(w, 'right');
      else if (k === 'arrowup') w.maximize(); else if (w.maximized) w.unmaximize(); else w.minimize();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Meta' && metaAlone) { metaAlone = false; LX.panels.toggle('launcher'); }
    if (e.key === 'Alt') endSwitcher();
  });
})();
