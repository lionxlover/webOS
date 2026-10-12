/* Leonux Web OS — context / dropdown menus (LX.menu.show) */
(function () {
  'use strict';
  let root = null;
  function close() { if (root) { root.remove(); root = null; } }
  function build(items, depth) {
    const H = LX.h;
    const m = H('div', { class: 'ctx-menu' + (depth ? ' sub' : ''), role: 'menu' });
    items.forEach((it) => {
      if (!it) return;
      if (it.separator) { m.appendChild(H('div', { class: 'ctx-sep' })); return; }
      const row = H('div', { class: 'ctx-item' + (it.disabled ? ' disabled' : '') + (it.danger ? ' danger' : ''), role: 'menuitem' },
        H('span', { class: 'ctx-ico', html: it.icon ? LX.icon(it.icon, 15) : (it.checked ? LX.icon('check', 14) : '') }),
        H('span', { class: 'ctx-label', text: it.label }),
        it.shortcut && H('span', { class: 'ctx-short', text: it.shortcut }),
        it.children && H('span', { class: 'ctx-arrow', html: LX.icon('chevron-right', 13) }));
      if (it.children) {
        let sub = null, t;
        row.addEventListener('mouseenter', () => {
          clearTimeout(t);
          Array.from(m.querySelectorAll(':scope > .ctx-menu')).forEach((s) => s.remove());
          sub = build(it.children, depth + 1); m.appendChild(sub);
          const r = row.getBoundingClientRect(); let x = r.right - 4, y = r.top - 6;
          sub.style.left = '0px'; sub.style.top = '0px'; sub.style.position = 'fixed';
          const sr = sub.getBoundingClientRect();
          if (x + sr.width > innerWidth - 4) x = r.left - sr.width + 4;
          if (y + sr.height > innerHeight - 4) y = Math.max(4, innerHeight - sr.height - 4);
          sub.style.left = x + 'px'; sub.style.top = y + 'px';
        });
      } else if (!it.disabled) {
        row.addEventListener('click', (e) => { e.stopPropagation(); close(); if (it.action) setTimeout(it.action, 0); });
      }
      m.appendChild(row);
    });
    return m;
  }
  LX.menu = {
    show(x, y, items) {
      close();
      const m = build(items.filter(Boolean), 0);
      m.style.left = '0px'; m.style.top = '0px'; m.style.position = 'fixed'; m.style.visibility = 'hidden';
      (document.getElementById('menus') || document.body).appendChild(m); root = m;
      const r = m.getBoundingClientRect();
      if (x + r.width > innerWidth - 6) x = Math.max(6, innerWidth - r.width - 6);
      if (y + r.height > innerHeight - 6) y = Math.max(6, innerHeight - r.height - 6);
      m.style.left = x + 'px'; m.style.top = y + 'px'; m.style.visibility = '';
      m.classList.add('open');
    },
    close,
  };
  document.addEventListener('pointerdown', (e) => { if (root && !e.target.closest('.ctx-menu')) close(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('blur', close);
  window.addEventListener('resize', close);
})();
