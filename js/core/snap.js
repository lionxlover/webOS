/* Leonux Web OS — window snapping zones (drag to edges) */
(function () {
  'use strict';
  const T = 10;
  function el() { return document.getElementById('snap-preview'); }
  LX.snap = {
    zoneAt(px, py) {
      const a = LX.wm.area();
      if (py <= a.y + T) return 'max';
      if (px <= T) return 'left';
      if (px >= innerWidth - T) return 'right';
      return null;
    },
    rect(zone) {
      const a = LX.wm.area();
      if (zone === 'max') return { x: a.x, y: a.y, w: a.w, h: a.h };
      if (zone === 'left') return { x: a.x, y: a.y, w: Math.floor(a.w / 2), h: a.h };
      if (zone === 'right') return { x: a.x + Math.floor(a.w / 2), y: a.y, w: Math.ceil(a.w / 2), h: a.h };
      return null;
    },
    show(zone) {
      const e = el(); if (!e) return;
      const r = this.rect(zone);
      if (!r) { e.classList.remove('show'); return; }
      Object.assign(e.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      e.classList.add('show');
    },
    hide() { const e = el(); if (e) e.classList.remove('show'); },
    apply(win, zone) {
      if (zone === 'max') return win.maximize();
      const r = this.rect(zone); if (!r) return;
      win.snapTo(r);
    },
  };
})();
