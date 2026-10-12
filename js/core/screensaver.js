/* Leonux OS 2.2 — screen saver (starfield / clock / bubbles / aurora, idle timeout) + Focus modes (Do Not Disturb / Work / Sleep). */
(function () {
  'use strict';
  const H = LX.h;
  const STYLES = [{ id: 'starfield', name: 'Starfield' }, { id: 'clock', name: 'Clock' }, { id: 'bubbles', name: 'Bubbles' }, { id: 'aurora', name: 'Aurora' }];
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let el, cv, ctx, raf = 0, running = false, last = Date.now(), startedAt = 0, style = 'starfield', lastMove = { x: -1, y: -1 }, state = {};
  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '91,157,250';

  // ---------------- renderers: init(w,h) + draw(t,dt,w,h) ----------------
  const R = {
    starfield: {
      init(w, h) { state.stars = Array.from({ length: Math.round(w * h / 4500) }, () => ({ x: (Math.random() - .5) * w * 2, y: (Math.random() - .5) * h * 2, z: Math.random() * w })); },
      draw(t, dt, w, h) {
        ctx.fillStyle = 'rgba(2,3,10,.35)'; ctx.fillRect(0, 0, w, h);
        const sp = reduced() ? 0.4 : 380 * dt;
        state.stars.forEach((s) => {
          const px = s.x / s.z * w * .5 + w / 2, py = s.y / s.z * w * .5 + h / 2;
          s.z -= sp; if (s.z < 1 || px < 0 || px > w || py < 0 || py > h) { s.x = (Math.random() - .5) * w * 2; s.y = (Math.random() - .5) * h * 2; s.z = w; return; }
          const k = 1 - s.z / w; ctx.fillStyle = 'rgba(' + (k > .6 ? '255,255,255' : accent()) + ',' + (.25 + k * .75).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(px, py, .4 + k * 2.2, 0, 6.3); ctx.fill();
        });
      },
    },
    clock: {
      init(w, h) { state.p = { x: w * .3, y: h * .35, vx: 38, vy: 26 }; state.cw = 520; state.ch = 220; },
      draw(t, dt, w, h) {
        const p = state.p; ctx.fillStyle = 'rgb(3,4,10)'; ctx.fillRect(0, 0, w, h);
        if (!reduced()) { p.x += p.vx * dt; p.y += p.vy * dt; }
        if (p.x < 0 || p.x + state.cw > w) { p.vx *= -1; p.x = LX.clamp(p.x, 0, w - state.cw); }
        if (p.y < 0 || p.y + state.ch > h) { p.vy *= -1; p.y = LX.clamp(p.y, 0, h - state.ch); }
        const d = new Date();
        const g = ctx.createLinearGradient(p.x, p.y, p.x + state.cw, p.y + state.ch); g.addColorStop(0, 'rgb(' + accent() + ')'); g.addColorStop(1, '#CBA6F7');
        ctx.font = '200 150px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = g;
        ctx.shadowColor = 'rgba(' + accent() + ',.5)'; ctx.shadowBlur = 40;
        ctx.fillText(LX.fmtTime(d), p.x + state.cw / 2, p.y + 150);
        ctx.shadowBlur = 0; ctx.font = '400 26px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.fillText(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), p.x + state.cw / 2, p.y + 200);
      },
    },
    bubbles: {
      init(w, h) { const cols = ['91,157,250', '203,166,247', '77,208,225', '244,143,177', '158,206,106']; state.b = Array.from({ length: 46 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 10 + Math.random() * 60, v: 12 + Math.random() * 40, ph: Math.random() * 6.3, c: cols[Math.floor(Math.random() * cols.length)] })); },
      draw(t, dt, w, h) {
        const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#070a1c'); bg.addColorStop(1, '#10243f'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        state.b.forEach((b) => {
          if (!reduced()) { b.y -= b.v * dt; b.x += Math.sin(t / 1400 + b.ph) * 14 * dt; }
          if (b.y < -b.r * 2) { b.y = h + b.r * 2; b.x = Math.random() * w; }
          const g = ctx.createRadialGradient(b.x - b.r * .3, b.y - b.r * .3, b.r * .1, b.x, b.y, b.r);
          g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(.6, 'rgba(' + b.c + ',.14)'); g.addColorStop(1, 'rgba(' + b.c + ',.35)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.3); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.2; ctx.stroke();
        });
      },
    },
    aurora: {
      init() {},
      draw(t, dt, w, h) {
        const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#02040c'); g.addColorStop(1, '#06202e'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        const bands = [['94,231,223', .0, .55], ['91,157,250', 1.7, .42], ['203,166,247', 3.1, .34], ['158,206,106', 4.4, .3]];
        const tt = reduced() ? 0 : t / 1000;
        ctx.globalCompositeOperation = 'lighter';
        bands.forEach((b, i) => {
          const base = h * (.34 + i * .09);
          const grad = ctx.createLinearGradient(0, base - h * .25, 0, base + h * .2); grad.addColorStop(0, 'rgba(' + b[0] + ',0)'); grad.addColorStop(.5, 'rgba(' + b[0] + ',' + b[2] * .5 + ')'); grad.addColorStop(1, 'rgba(' + b[0] + ',0)');
          ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 16) ctx.lineTo(x, base + Math.sin(x / (170 + i * 40) + tt * (.5 + i * .13) + b[1]) * h * .07 + Math.sin(x / 61 + tt * .9 + i) * h * .018);
          ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 40; i++) { const x = (i * 9973 % 1000) / 1000 * w, y = (i * 7919 % 1000) / 1000 * h * .55; ctx.fillStyle = 'rgba(255,255,255,' + (.25 + .4 * Math.abs(Math.sin(tt + i))).toFixed(2) + ')'; ctx.fillRect(x, y, 1.4, 1.4); }
      },
    },
  };

  function fit() { if (!cv) return; const dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(.05, (ts - (loop.prev || ts)) / 1000); loop.prev = ts;
    try { R[style].draw(ts, dt, innerWidth, innerHeight); } catch (e) { console.error(e); }
    raf = reduced() ? setTimeout(() => requestAnimationFrame(loop), 1000) : requestAnimationFrame(loop);
  }
  function start(st) {
    if (running || !el) return;
    LX.panels.close(); LX.menu.close();
    style = R[st] ? st : (R[LX.settings.get('screensaver')] ? LX.settings.get('screensaver') : 'starfield');
    el.classList.remove('out'); el.classList.add('show'); fit(); R[style].init(innerWidth, innerHeight); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, innerWidth, innerHeight);
    running = true; startedAt = Date.now(); loop.prev = 0; lastMove = { x: -1, y: -1 }; raf = requestAnimationFrame(loop);
    LX.bus.emit('screensaver:change', true);
  }
  function stop(lockIfSet) {
    if (!running) return;
    running = false; cancelAnimationFrame(raf); clearTimeout(raf); last = Date.now();
    el.classList.add('out'); setTimeout(() => { if (!running) el.classList.remove('show', 'out'); }, 300);
    LX.bus.emit('screensaver:change', false);
    if (lockIfSet && LX.settings.get('screensaverLock')) LX.power.lock();
  }
  function poke(e) {
    if (running) {
      if (Date.now() - startedAt < 700) return;
      if (e.type === 'pointermove') { const moved = lastMove.x < 0 ? (lastMove.x = e.clientX, lastMove.y = e.clientY, false) : Math.abs(e.clientX - lastMove.x) + Math.abs(e.clientY - lastMove.y) > 6; if (!moved) return; }
      e.preventDefault && e.preventDefault(); e.stopPropagation();
      stop(true); return;
    }
    last = Date.now();
  }
  LX.screensaver = { styles: STYLES, start, stop, get running() { return running; } };

  // ---------------- Focus modes ----------------
  const MODES = [
    { id: 'dnd', name: 'Do Not Disturb', icon: 'moon', desc: 'Silence notifications' },
    { id: 'work', name: 'Work', icon: 'zap', desc: 'Silence notifications, stay on task' },
    { id: 'sleep', name: 'Sleep', icon: 'cloud', desc: 'Quiet + warm night light' },
  ];
  let busy = false;
  function applyFocus(id) {
    busy = true;
    try {
      const S = LX.settings, prev = S.get('focus');
      if (id === 'sleep' && prev !== 'sleep') { LX.store.set('focus.nl', !!S.get('nightLight')); S.set('nightLight', true); }
      if (prev === 'sleep' && id !== 'sleep') S.set('nightLight', !!LX.store.get('focus.nl', false));
      S.set('focus', id); S.set('dnd', !!id);
    } finally { busy = false; }
    LX.bus.emit('focus:change', id);
    const m = MODES.find((x) => x.id === id);
    if (id) LX.audio.beep(420, .06, 'sine', .06);
  }
  LX.focus = {
    modes: MODES,
    current() { return MODES.find((m) => m.id === LX.settings.get('focus')) || null; },
    set: applyFocus,
    toggle(id) { applyFocus(LX.settings.get('focus') === id ? '' : id); },
    menuItems() {
      const cur = LX.settings.get('focus');
      return MODES.map((m) => ({ label: m.name, icon: m.icon, checked: cur === m.id, action: () => LX.focus.toggle(m.id) })).concat(cur ? [{ separator: true }, { label: 'Turn off Focus', icon: 'x', action: () => applyFocus('') }] : []);
    },
  };

  LX.onInit(() => {
    el = H('div', { id: 'screensaver', 'aria-hidden': 'true' }); cv = H('canvas'); el.appendChild(cv); document.body.appendChild(el); ctx = cv.getContext('2d');
    ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((t) => document.addEventListener(t, poke, { capture: true, passive: false }));
    window.addEventListener('resize', () => { if (running) { fit(); R[style].init(innerWidth, innerHeight); } });
    setInterval(() => {
      const min = +LX.settings.get('screensaverMin') || 0;
      if (!running && min > 0 && Date.now() - last > min * 60000 && !(LX.lock && LX.lock.locked) && !document.querySelector('#boot.show,#oobe.show,#poweroff.show')) start();
    }, 4000);
    // keep legacy DND toggle and Focus in step
    LX.bus.on('settings:change', (e) => {
      if (busy || e.key !== 'dnd') return;
      const f = LX.settings.get('focus');
      if (e.value && !f) applyFocus('dnd'); else if (!e.value && f) applyFocus('');
    });
    if (LX.settings.get('dnd') && !LX.settings.get('focus')) LX.settings.set('focus', 'dnd');

    if (!LX.settingsPages) return;
    const ui = LX.settingsPages.ui;
    LX.settingsPages.add({ id: 'screensaver', title: 'Screen Saver & Focus', icon: 'moon', group: 'Personal', order: 25, render(c) {
      const paint = () => {
        c.innerHTML = '';
        const tiles = H('div', { class: 'ss-tiles' }, STYLES.map((s) => H('button', { class: 'ss-tile' + (LX.settings.get('screensaver') === s.id ? ' on' : ''), onclick: () => { ui.set('screensaver', s.id); paint(); } },
          H('span', { class: 'ss-prev ss-' + s.id }), H('span', { text: s.name }))));
        const foc = H('div', { class: 'ss-tiles' }, MODES.map((m) => H('button', { class: 'ss-tile ss-focus' + (LX.settings.get('focus') === m.id ? ' on' : ''), onclick: () => { LX.focus.toggle(m.id); paint(); } },
          H('span', { class: 'ss-ico', html: LX.icon(m.icon, 22) }), H('span', { text: m.name }), H('small', { class: 'muted', text: m.desc }))));
        c.appendChild(ui.page('Screen Saver & Focus',
          ui.group('Screen saver', H('div', { class: 'st-row' }, tiles),
            ui.row('Start after', 'Inactivity before the screen saver appears', ui.select('screensaverMin', [{ v: 0, l: 'Never' }, { v: 1, l: '1 minute' }, { v: 2, l: '2 minutes' }, { v: 5, l: '5 minutes' }, { v: 10, l: '10 minutes' }, { v: 15, l: '15 minutes' }, { v: 30, l: '30 minutes' }], () => { LX.settings.set('screensaverMin', +LX.settings.get('screensaverMin')); })),
            ui.row('Require password after', 'Lock the screen when the screen saver ends', ui.toggle('screensaverLock')),
            ui.row('Preview', null, H('button', { class: 'btn sm primary', text: 'Start now', onclick: () => setTimeout(() => start(), 120) }))),
          ui.group('Focus', H('div', { class: 'st-row' }, foc),
            ui.row('Notification sounds', 'Play a chime when notifications arrive', ui.toggle('notifSound')))));
      };
      paint();
      const off = LX.bus.on('focus:change', paint);
      return () => { if (typeof off === 'function') off(); };
    } });
  });
})();
