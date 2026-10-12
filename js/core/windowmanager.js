/* Leonux Web OS — window manager: create/focus/drag/resize/minimize/maximize/snap */
(function () {
  'use strict';
  const wins = [];
  let seq = 0, z = 100, focused = null, cascade = 0;
  const layer = () => document.getElementById('windows');
  const isMobile = () => innerWidth <= 768;
  const tbH = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--taskbar-h')) || 56;
  const mbH = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--mb-h')) || 0;
  const motion = () => LX.settings.get('animations') !== false && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const PIN_Z = 20000;
  let pz = PIN_Z;

  // usable desktop rectangle: respects the global menubar, the dock / taskbar and full-screen mode
  function area() {
    const cl = document.body.classList;
    if (cl.contains('fs-mode')) return { x: 0, y: 0, w: innerWidth, h: innerHeight };
    if (cl.contains('has-mb')) { const t = mbH(); const b = cl.contains('dock-hide') ? 0 : 76; return { x: 0, y: t, w: innerWidth, h: innerHeight - t - b }; }
    const top = cl.contains('tb-top');
    const th = tbH();
    return { x: 0, y: top ? th : 0, w: innerWidth, h: innerHeight - th };
  }
  function syncFs() {
    const f = !!(focused && focused.fullscreen && !focused.minimized && !focused.closed);
    if (document.body.classList.contains('fs-mode') === f) return;
    document.body.classList.toggle('fs-mode', f);
    LX.bus.emit('wm:fs', f);
  }
  // where a window should fly to when minimised: its dock / taskbar icon
  function dockTarget(win) {
    const ic = document.querySelector('#taskbar .tb-app[data-app="' + win.appId + '"]');
    const r = win.rect(); let tx = innerWidth / 2, ty = innerHeight - 20;
    if (ic) { const b = ic.getBoundingClientRect(); if (b.width) { tx = b.left + b.width / 2; ty = b.top + b.height / 2; } }
    return { dx: Math.round(tx - (r.x + r.w / 2)), dy: Math.round(ty - (r.y + r.h / 2)) };
  }
  // snap layouts offered by the maximise-button flyout (fractions of the usable area)
  const SNAPS = [
    { id: 'halves', name: 'Halves', cells: [[0, 0, .5, 1], [.5, 0, .5, 1]] },
    { id: 'thirds', name: 'Thirds', cells: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
    { id: 'wide-l', name: 'Two thirds + third', cells: [[0, 0, 2 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
    { id: 'wide-r', name: 'Third + two thirds', cells: [[0, 0, 1 / 3, 1], [1 / 3, 0, 2 / 3, 1]] },
    { id: 'quarters', name: 'Quarters', cells: [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]] },
    { id: 'main-side', name: 'Main + stack', cells: [[0, 0, .5, 1], [.5, 0, .5, .5], [.5, .5, .5, .5]] },
  ];
  function cellRect(c) { const a = area(); return { x: a.x + Math.round(a.w * c[0]), y: a.y + Math.round(a.h * c[1]), w: Math.round(a.w * c[2]), h: Math.round(a.h * c[3]) }; }
  let fly = null, flyTimer = null, flyWin = null;
  function hideFly() { clearTimeout(flyTimer); if (fly) { fly.remove(); fly = null; } flyWin = null; }
  function showFly(win, btn) {
    hideFly(); flyWin = win;
    const H = LX.h;
    fly = H('div', { class: 'snap-fly', role: 'menu', onmouseleave: () => { flyTimer = setTimeout(hideFly, 220); }, onmouseenter: () => clearTimeout(flyTimer) },
      H('div', { class: 'sf-grid' }, SNAPS.map((l) => H('div', { class: 'sf-layout', title: l.name },
        l.cells.map((c) => H('button', { class: 'sf-cell', style: { left: c[0] * 100 + '%', top: c[1] * 100 + '%', width: c[2] * 100 + '%', height: c[3] * 100 + '%' }, 'aria-label': l.name,
          onclick: (e) => { e.stopPropagation(); const w = flyWin; hideFly(); if (w) w.snapTo(cellRect(c)); } }, H('i')))))),
      H('div', { class: 'sf-foot' }, H('button', { class: 'sf-btn', text: win.maximized && !win.snapped ? 'Restore' : 'Maximise', onclick: (e) => { e.stopPropagation(); const w = flyWin; hideFly(); if (w) w.toggleMax(); } }),
        H('button', { class: 'sf-btn', text: 'Full screen', onclick: (e) => { e.stopPropagation(); const w = flyWin; hideFly(); if (w) w.toggleFullscreen(); } })));
    document.body.appendChild(fly);
    const b = btn.getBoundingClientRect(), fr = fly.getBoundingClientRect();
    fly.style.left = LX.clamp(Math.round(b.left - 20), 8, innerWidth - fr.width - 8) + 'px';
    fly.style.top = Math.min(Math.round(b.bottom + 8), innerHeight - fr.height - 8) + 'px';
    requestAnimationFrame(() => fly && fly.classList.add('in'));
  }

  function Win(o) {
    const self = this;
    this.id = 'w' + (++seq); this.appId = o.appId || 'app'; this.args = {}; this.title = o.title || 'Window'; this.icon = o.icon || 'package';
    this.listeners = {}; this.closeHandlers = []; this.menus = null; this.pinned = false; this.fullscreen = false; this.minimized = false; this.maximized = false; this.restoreRect = null;
    this.minW = o.minWidth || 320; this.minH = o.minHeight || 200; this.closed = false;
    const a = area();
    const w = LX.clamp(o.width || 800, this.minW, a.w - 20), h = LX.clamp(o.height || 540, this.minH, a.h - 20);
    const off = (cascade++ % 8) * 28;
    const x = LX.clamp(Math.round((a.w - w) / 2) - 60 + off, a.x + 4, Math.max(a.x + 4, a.x + a.w - w - 4)), y = LX.clamp(Math.round((a.h - h) / 2) - 30 + off, a.y + 4, Math.max(a.y + 4, a.y + a.h - h - 4));
    const H = LX.h;
    this.el = H('div', { class: 'win opening', dataset: { id: this.id, app: this.appId }, style: { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' } },
      H('div', { class: 'win-titlebar' },
        H('div', { class: 'win-ctrls' },
          H('button', { class: 'wc wc-close', title: 'Close', 'aria-label': 'Close', onclick: (e) => { e.stopPropagation(); self.close(); } }),
          H('button', { class: 'wc wc-min', title: 'Minimize', 'aria-label': 'Minimize', onclick: (e) => { e.stopPropagation(); self.minimize(); } }),
          H('button', { class: 'wc wc-max', title: 'Maximize', 'aria-label': 'Maximize', onclick: (e) => { e.stopPropagation(); self.toggleMax(); } })),
        H('div', { class: 'win-heading' }, H('span', { class: 'win-icon', html: LX.icon(this.icon, 14) }), H('span', { class: 'win-title', text: this.title })),
        H('div', { class: 'win-ctrls-spacer' }, H('button', { class: 'win-pin hidden', title: 'Always on top — click to unpin', 'aria-label': 'Unpin from top', html: LX.icon('pin', 13), onclick: (e) => { e.stopPropagation(); self.setPinned(false); } }))),
      H('div', { class: 'win-menubar hidden' }),
      H('div', { class: 'win-body app-' + this.appId, tabindex: '-1' }));
    this.body = this.el.querySelector('.win-body');
    this.titlebar = this.el.querySelector('.win-titlebar');
    this.menubar = this.el.querySelector('.win-menubar');
    this.el.appendChild(H('div', { class: 'fs-hot' }, H('button', { class: 'fs-exit', html: LX.icon('minimize', 14) + '<span>Exit Full Screen</span>', onclick: (e) => { e.stopPropagation(); self.toggleFullscreen(); } })));
    ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((d) => this.el.appendChild(H('div', { class: 'win-rz rz-' + d, dataset: { dir: d } })));
    layer().appendChild(this.el);
    wins.push(this);
    this._bind();
    setTimeout(() => this.el.classList.remove('opening'), 320);
    if (isMobile()) this.maximize(true);
    this.focus();
    LX.bus.emit('wm:change', { type: 'open', win: this });
  }

  const P = Win.prototype;
  P.on = function (e, fn) { (this.listeners[e] = this.listeners[e] || []).push(fn); return this; };
  P.emit = function (e, d) { (this.listeners[e] || []).slice().forEach((fn) => { try { fn(d); } catch (x) { console.error(x); } }); };
  P.setTitle = function (t) { this.title = t; this.el.querySelector('.win-title').textContent = t; LX.bus.emit('wm:change', { type: 'title', win: this }); };
  P.setIcon = function (n) { this.icon = n; this.el.querySelector('.win-icon').innerHTML = LX.icon(n, 14); LX.bus.emit('wm:change', { type: 'icon', win: this }); };
  P.onClose = function (fn) { this.closeHandlers.push(fn); return this; };
  P.isFocused = function () { return focused === this; };
  P.rect = function () { return { x: this.el.offsetLeft, y: this.el.offsetTop, w: this.el.offsetWidth, h: this.el.offsetHeight }; };
  P._set = function (r) {
    const s = this.el.style; s.left = Math.round(r.x) + 'px'; s.top = Math.round(r.y) + 'px'; s.width = Math.round(r.w) + 'px'; s.height = Math.round(r.h) + 'px';
    this.emit('resize', r);
  };
  P.resize = function (w, h) { const r = this.rect(); this._set({ x: r.x, y: r.y, w: Math.max(this.minW, w), h: Math.max(this.minH, h) }); };
  P.move = function (x, y) { const r = this.rect(); this._set({ x, y, w: r.w, h: r.h }); };
  P.focus = function () {
    if (this.closed) return;
    if (this.minimized) this.restore();
    if (focused === this) { return; }
    const prev = focused; focused = this;
    this.el.style.zIndex = this.pinned ? ++pz : ++z; if (z > 8000) renormalize();
    wins.forEach((w) => w.el.classList.toggle('focused', w === this));
    if (prev) prev.emit('blur');
    this.emit('focus');
    syncFs();
    LX.bus.emit('wm:change', { type: 'focus', win: this });
  };
  P.setPinned = function (v) {
    this.pinned = !!v; this.el.classList.toggle('on-top', this.pinned);
    this.menubar && this.titlebar.querySelector('.win-pin').classList.toggle('hidden', !this.pinned);
    this.el.style.zIndex = this.pinned ? ++pz : ++z;
    LX.bus.emit('wm:change', { type: 'pin', win: this });
  };
  P.toggleFullscreen = function () {
    if (this.closed) return;
    if (!this.fullscreen) {
      this._fs = { rect: this.rect(), max: this.maximized, snapped: this.snapped, rr: this.restoreRect };
      this.fullscreen = true; this.maximized = true; this.snapped = false; this.el.classList.add('fs', 'maximized');
      if (this.minimized) this.restore(); this.focus(); syncFs();
    } else {
      const f = this._fs || {}; this.fullscreen = false; this.el.classList.remove('fs');
      syncFs();
      if (f.max) { this.snapped = f.snapped; this.restoreRect = f.rr; const a = area(); if (!f.snapped) this._set({ x: a.x, y: a.y, w: a.w, h: a.h }); else this._set(f.rect); }
      else { this.maximized = false; this.snapped = false; this.el.classList.remove('maximized', 'snapped'); this._set(f.rect || { x: 80, y: 60, w: 760, h: 520 }); }
    }
    LX.bus.emit('wm:change', { type: 'fullscreen', win: this });
  };
  P.minimize = function () {
    if (this.minimized) return;
    this.minimized = true;
    if (motion()) { const t = dockTarget(this); this.el.style.setProperty('--gx', t.dx + 'px'); this.el.style.setProperty('--gy', t.dy + 'px'); }
    this.el.classList.add('minimizing');
    setTimeout(() => { if (this.minimized) { this.el.classList.add('minimized'); this.el.classList.remove('minimizing'); } }, motion() ? 360 : 20);
    if (focused === this) { focused = null; const n = topVisible(); if (n) n.focus(); else wins.forEach((w) => w.el.classList.remove('focused')); }
    syncFs();
    LX.bus.emit('wm:change', { type: 'minimize', win: this });
  };
  P.restore = function () {
    if (!this.minimized) return;
    this.minimized = false; this.el.classList.remove('minimized', 'minimizing');
    if (motion()) { const t = dockTarget(this); this.el.style.setProperty('--gx', t.dx + 'px'); this.el.style.setProperty('--gy', t.dy + 'px'); }
    this.el.classList.add('restoring'); setTimeout(() => this.el.classList.remove('restoring'), 380);
    LX.bus.emit('wm:change', { type: 'restore', win: this });
    this.focus();
  };
  P.maximize = function (silent) {
    if (this.maximized) return;
    this.restoreRect = this.rect(); this.maximized = true;
    this.el.classList.add('maximized');
    const a = area(); this._set({ x: a.x, y: a.y, w: a.w, h: a.h });
    if (!silent) LX.bus.emit('wm:change', { type: 'max', win: this });
  };
  P.unmaximize = function () {
    if (!this.maximized) return;
    this.maximized = false; this.el.classList.remove('maximized', 'snapped');
    const r = this.restoreRect || { x: 80, y: 60, w: 760, h: 520 }; this._set(r);
    LX.bus.emit('wm:change', { type: 'max', win: this });
  };
  P.toggleMax = function () { this.maximized ? this.unmaximize() : this.maximize(); };
  P.snapTo = function (r) {
    if (!this.maximized && !this.snapped) this.restoreRect = this.rect();
    this.snapped = true; this.maximized = true; this.el.classList.add('maximized', 'snapped'); this._set(r);
  };
  P.close = function () {
    if (this.closed) return false;
    for (const fn of this.closeHandlers.slice()) { try { if (fn() === false) return false; } catch (e) { console.error(e); } }
    this.closed = true; this.emit('close');
    const i = wins.indexOf(this); if (i >= 0) wins.splice(i, 1);
    this.el.classList.add('closing'); hideFly();
    const el = this.el; setTimeout(() => el.remove(), motion() ? 200 : 10);
    if (focused === this) { focused = null; const n = topVisible(); if (n) n.focus(); }
    syncFs();
    LX.bus.emit('wm:change', { type: 'close', win: this });
    return true;
  };
  P.setMenu = function (menus) {
    const bar = this.menubar; bar.innerHTML = '';
    this.menus = menus && menus.length ? menus : null;
    LX.bus.emit('wm:change', { type: 'menu', win: this });
    if (!menus || !menus.length) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    menus.forEach((m) => {
      const b = LX.h('button', { class: 'mb-item', text: m.label, onclick: () => { const r = b.getBoundingClientRect(); LX.menu.show(r.left, r.bottom + 2, m.items.map((it) => it.separator ? it : Object.assign({}, it, { action: it.action }))); } });
      bar.appendChild(b);
    });
  };
  P._bind = function () {
    const self = this, el = this.el;
    el.addEventListener('pointerdown', () => self.focus(), true);
    this.titlebar.addEventListener('dblclick', (e) => { if (!e.target.closest('.wc')) self.toggleMax(); });
    this.titlebar.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation();
      const sp = LX.spaces && LX.spaces.enabled() ? [{ label: 'Move to Desktop…', icon: 'columns', children: Array.from({ length: LX.spaces.count }, (_, i) => ({ label: 'Desktop ' + (i + 1), checked: (self.space || 0) === i, action: () => { self.space = i; LX.spaces.go(i, true); LX.spaces.go(i); self.focus(); } })) }] : [];
      LX.menu.show(e.clientX, e.clientY, [
        { label: self.pinned ? 'Unpin from Top' : 'Always on Top', icon: 'pin', checked: false, action: () => self.setPinned(!self.pinned) },
        { label: self.fullscreen ? 'Exit Full Screen' : 'Enter Full Screen', icon: 'fullscreen', shortcut: 'F11', action: () => self.toggleFullscreen() },
        { separator: true },
        { label: self.maximized ? 'Restore' : 'Maximise', icon: 'maximize', action: () => self.toggleMax() },
        { label: 'Snap Left', icon: 'arrow-left', action: () => LX.snap.apply(self, 'left') },
        { label: 'Snap Right', icon: 'arrow-right', action: () => LX.snap.apply(self, 'right') },
        { label: 'Minimise', icon: 'minus', action: () => self.minimize() }].concat(sp, [{ separator: true }, { label: 'Close Window', icon: 'x', danger: true, action: () => self.close() }]));
    });
    const mx = this.titlebar.querySelector('.wc-max');
    mx.addEventListener('mouseenter', () => { if (LX.settings.get('snapFlyout') === false || isMobile() || self.fullscreen) return; clearTimeout(flyTimer); flyTimer = setTimeout(() => showFly(self, mx), 420); });
    mx.addEventListener('mouseleave', () => { clearTimeout(flyTimer); if (fly) flyTimer = setTimeout(hideFly, 260); });
    mx.addEventListener('click', hideFly);
    // drag
    this.titlebar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.wc')) return;
      if (isMobile()) return;
      const sx = e.clientX, sy = e.clientY; let started = false, grabX = 0, grabY = 0, zone = null;
      const tb = this.titlebar;
      try { tb.setPointerCapture(e.pointerId); } catch (x) {}
      const move = (ev) => {
        if (!started) {
          if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 4) return;
          started = true; document.documentElement.classList.add('dragging');
          if (self.maximized) {
            const rr = self.restoreRect || { w: 760, h: 520 }; const ratio = sx / innerWidth;
            self.maximized = false; self.snapped = false; el.classList.remove('maximized', 'snapped');
            self._set({ x: ev.clientX - rr.w * ratio, y: ev.clientY - 16, w: rr.w, h: rr.h });
          }
          grabX = ev.clientX - el.offsetLeft; grabY = ev.clientY - el.offsetTop;
        }
        const a = area();
        let nx = ev.clientX - grabX, ny = LX.clamp(ev.clientY - grabY, a.y, a.y + a.h - 40);
        nx = LX.clamp(nx, -el.offsetWidth + 120, innerWidth - 80);
        el.style.left = nx + 'px'; el.style.top = ny + 'px';
        zone = LX.snap.zoneAt(ev.clientX, ev.clientY); LX.snap.show(zone);
      };
      const up = () => {
        tb.removeEventListener('pointermove', move); tb.removeEventListener('pointerup', up); tb.removeEventListener('pointercancel', up);
        document.documentElement.classList.remove('dragging'); LX.snap.hide();
        if (started && zone) LX.snap.apply(self, zone);
        else if (started) self.emit('resize', self.rect());
      };
      tb.addEventListener('pointermove', move); tb.addEventListener('pointerup', up); tb.addEventListener('pointercancel', up);
    });
    // resize
    el.querySelectorAll('.win-rz').forEach((h) => h.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || self.maximized) return;
      e.preventDefault(); e.stopPropagation(); self.focus();
      const dir = h.dataset.dir, r0 = self.rect(), sx = e.clientX, sy = e.clientY, a = area();
      try { h.setPointerCapture(e.pointerId); } catch (x) {}
      document.documentElement.classList.add('dragging');
      const move = (ev) => {
        let { x, y, w, h: hh } = r0; const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (dir.indexOf('e') >= 0) w = Math.max(self.minW, r0.w + dx);
        if (dir.indexOf('s') >= 0) hh = Math.max(self.minH, r0.h + dy);
        if (dir.indexOf('w') >= 0) { w = Math.max(self.minW, r0.w - dx); x = r0.x + (r0.w - w); }
        if (dir.indexOf('n') >= 0) { hh = Math.max(self.minH, r0.h - dy); y = r0.y + (r0.h - hh); if (y < a.y) { hh -= (a.y - y); y = a.y; } }
        self._set({ x, y, w, h: hh });
      };
      const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); document.documentElement.classList.remove('dragging'); };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    }));
  };

  function topVisible() {
    let best = null;
    wins.forEach((w) => { if (!w.minimized && (!best || +w.el.style.zIndex > +best.el.style.zIndex)) best = w; });
    return best;
  }
  function renormalize() {
    const sorted = wins.slice().sort((a, b) => +a.el.style.zIndex - +b.el.style.zIndex);
    z = 100; sorted.forEach((w) => { if (!w.pinned) w.el.style.zIndex = ++z; });
  }

  LX.wm = {
    create: (o) => new Win(o),
    list: () => wins.slice(),
    get: (id) => wins.find((w) => w.id === id),
    focused: () => focused,
    area, motion, snapLayouts: SNAPS, snapCellRect: cellRect,
    isMobile,
    showDesktop() {
      const vis = wins.filter((w) => !w.minimized);
      if (vis.length) { LX.wm._hidden = vis; vis.forEach((w) => w.minimize()); }
      else if (LX.wm._hidden) { LX.wm._hidden.forEach((w) => { if (!w.closed) w.restore(); }); LX.wm._hidden = null; }
    },
    cycle(dir) {
      const vis = wins.filter((w) => !w.minimized).sort((a, b) => +a.el.style.zIndex - +b.el.style.zIndex);
      if (vis.length < 2) return;
      (dir < 0 ? vis[vis.length - 1] : vis[0]).focus();
    },
    closeAll() { wins.slice().forEach((w) => { w.closeHandlers = []; w.close(); }); },
  };
  window.addEventListener('resize', () => {
    const a = area();
    wins.forEach((w) => {
      if (w.maximized && !w.snapped) w._set({ x: a.x, y: a.y, w: a.w, h: a.h });
      else if (isMobile()) { w.maximize(true); }
      else { const r = w.rect(); if (r.x > a.w - 60 || r.y > a.y + a.h - 40) w.move(Math.max(0, a.w - r.w - 20), Math.max(a.y, 20)); }
    });
  });
  function relayout() {
    const a = area();
    wins.forEach((w) => { if (w.maximized && !w.snapped && !w.fullscreen) w._set({ x: a.x, y: a.y, w: a.w, h: a.h }); else if (!w.maximized) { const r = w.rect(); if (r.y < a.y) w.move(r.x, a.y); } });
  }
  LX.wm.relayout = relayout;
  LX.onInit(() => {
    const tbs = () => { const r = document.documentElement.classList; const v = LX.settings.get('titlebar') || 'vibrant'; r.toggle('tb-vibrant', v === 'vibrant'); r.toggle('tb-accent', v === 'accent'); r.toggle('tb-solid', v === 'solid'); };
    tbs(); LX.bus.on('settings:change', (e) => { if (e.key === 'titlebar') tbs(); if (e.key === 'layout' || e.key === 'dockAutoHide' || e.key === 'taskbarPos' || e.key === 'dock') setTimeout(relayout, 30); });
    document.addEventListener('pointerdown', (e) => { if (fly && !e.target.closest('.snap-fly')) hideFly(); }, true);
    // leaving full screen / Esc closes the snap flyout
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && fly) hideFly(); });
    if (LX.settingsPages) {
      const ui = LX.settingsPages.ui;
      LX.settingsPages.add({ id: 'windows', title: 'Windows', icon: 'layers', group: 'Personal', order: 17, render(c) {
        c.appendChild(ui.page('Windows',
          ui.group('Title bars',
            ui.row('Title bar style', 'Vibrant tints the glass with your accent colour', ui.seg('titlebar', [{ v: 'vibrant', l: 'Vibrant' }, { v: 'accent', l: 'Accent' }, { v: 'solid', l: 'Solid' }]))),
          ui.group('Arranging',
            ui.row('Snap layouts', 'Hover the green button to tile a window in halves, thirds or quarters', ui.toggle('snapFlyout')),
            ui.row('Spaces', 'Four virtual desktops + Mission Control', ui.toggle('spaces')),
            ui.row('Animations', 'Spring open, close and minimise', ui.toggle('animations')))));
      } });
    }
  });
  LX.bus.on('settings:change', (e) => { if (e.key === 'taskbarPos') { const a = area(); wins.forEach((w) => { if (w.maximized && !w.snapped) w._set({ x: a.x, y: a.y, w: a.w, h: a.h }); }); } });
})();
