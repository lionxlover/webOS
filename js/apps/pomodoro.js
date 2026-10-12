/* Store app — Focus Timer: pomodoro with SVG ring, session history and chime. */
(function () {
  'use strict';
  const H = LX.h;
  const KEY = 'app.pomodoro';

  LX.apps.register({
    id: 'pomodoro', name: 'Focus Timer', icon: 'timer', color: '#F28B82', category: 'Productivity',
    pkg: true, pkgVersion: '1.0', pkgSize: 8, developer: 'Moonlit Byte', downloads: 1240,
    desc: 'Pomodoro sessions with stats', longDesc: 'The classic 25/5 technique, beautifully executed: a live progress ring, automatic breaks, a session counter, daily statistics and a gentle chime when each interval ends.',
    permissions: ['Notifications'], changelog: 'First release.',
    width: 460, height: 620, minWidth: 380, minHeight: 480,
    open(win) {
      let cfg = LX.store.get(KEY + '.cfg') || { focus: 25, brk: 5, long: 15 };
      let stats = LX.store.get(KEY + '.stats') || {};
      const saveCfg = () => LX.store.set(KEY + '.cfg', cfg);
      const today = () => new Date().toISOString().slice(0, 10);

      let mode = 'focus'; // focus | brk | long
      let left = cfg.focus * 60;
      let running = false;
      let done = 0; // focus sessions completed this run
      let ticker = null;
      const task = H('input', { class: 'input pm-task', placeholder: 'What are you focusing on?' });

      const R = 120, C = 2 * Math.PI * R;
      const ring = H('circle', { cx: 140, cy: 140, r: R, class: 'pm-ring-bg' });
      const prog = H('circle', { cx: 140, cy: 140, r: R, class: 'pm-ring-fg', strokeDasharray: C, strokeDashoffset: 0, transform: 'rotate(-90 140 140)' });
      const svg = HNS('svg', { class: 'pm-ring', viewBox: '0 0 280 280' }, ring, prog);
      const timeEl = H('div', { class: 'pm-time' });
      const modeEl = H('div', { class: 'pm-mode' });
      const dots = H('div', { class: 'pm-dots' });
      const statEl = H('div', { class: 'pm-stats' });

      function paintRing() {
        const total = (mode === 'focus' ? cfg.focus : mode === 'brk' ? cfg.brk : cfg.long) * 60;
        const p = 1 - left / total;
        prog.setAttribute('stroke-dashoffset', String(C * (1 - p)));
        prog.style.stroke = mode === 'focus' ? 'var(--accent)' : 'var(--success)';
        timeEl.textContent = LX.pad(Math.floor(left / 60)) + ':' + LX.pad(left % 60);
        modeEl.textContent = mode === 'focus' ? 'Focus' : mode === 'brk' ? 'Short break' : 'Long break';
        modeEl.className = 'pm-mode ' + (mode === 'focus' ? '' : 'green');
        win.setTitle(timeEl.textContent + ' · ' + modeEl.textContent + ' — Focus');
      }
      function paintDots() {
        dots.innerHTML = '';
        for (let i = 0; i < 4; i++) dots.appendChild(H('span', { class: 'pm-dot' + (i < done % 4 || (done && done % 4 === 0) ? ' full' : '') }));
      }
      function paintStats() {
        const d = stats[today()] || { n: 0, mins: 0 };
        statEl.innerHTML = '';
        statEl.append(H('div', { class: 'pm-stat' }, H('b', { text: String(d.n || 0) }), H('span', { class: 'muted', text: 'sessions today' })),
          H('div', { class: 'pm-stat' }, H('b', { text: String(d.mins || 0) }), H('span', { class: 'muted', text: 'focus minutes' })),
          H('div', { class: 'pm-stat' }, H('b', { text: String(done) }), H('span', { class: 'muted', text: 'this run' })));
      }
      function record() {
        const d = stats[today()] || { n: 0, mins: 0 };
        d.n++; d.mins += cfg.focus;
        stats[today()] = d;
        LX.store.set(KEY + '.stats', stats);
      }
      function tick() {
        left--;
        if (left <= 0) {
          if (mode === 'focus') {
            done++; record();
            LX.notify({ title: 'Focus session done!', body: done + ' session' + (done === 1 ? '' : 's') + ' today. Time for a break.', icon: 'check-circle' });
            [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => LX.audio.beep(f, 0.22, 'sine', 0.3), i * 180));
            mode = done % 4 === 0 ? 'long' : 'brk';
            left = (mode === 'long' ? cfg.long : cfg.brk) * 60;
          } else {
            LX.notify({ title: 'Break over', body: 'Ready for another focus session?', icon: 'zap' });
            LX.audio.beep(880, 0.2, 'sine', 0.3);
            mode = 'focus'; left = cfg.focus * 60;
          }
          paintDots(); paintStats();
        }
        paintRing();
      }
      const toggle = H('button', { class: 'btn primary pm-go', text: 'Start', onclick: () => {
        running = !running;
        if (running) { ticker = setInterval(tick, 1000); toggle.textContent = 'Pause'; }
        else { clearInterval(ticker); toggle.textContent = 'Resume'; }
      } });
      const reset = H('button', { class: 'btn ghost', text: 'Reset', onclick: () => { running = false; clearInterval(ticker); mode = 'focus'; left = cfg.focus * 60; toggle.textContent = 'Start'; paintRing(); } });

      const cfgRow = (lbl, key, min, max) => {
        const inp = H('input', { class: 'input pm-cfg-in', type: 'number', min, max, value: cfg[key], onchange: () => { cfg[key] = LX.clamp(+inp.value || min, min, max); inp.value = cfg[key]; saveCfg(); if (!running && mode === 'focus' && key === 'focus') { left = cfg.focus * 60; paintRing(); } } });
        return H('label', { class: 'pm-cfg' }, H('span', { class: 'muted', text: lbl }), inp);
      };
      const cfgs = H('div', { class: 'pm-cfgs' }, cfgRow('Focus', 'focus', 5, 60), cfgRow('Break', 'brk', 1, 30), cfgRow('Long', 'long', 5, 45));

      win.body.append(
        H('div', { class: 'pm-top' }, task),
        H('div', { class: 'pm-stage' }, svg, H('div', { class: 'pm-center' }, timeEl, modeEl, dots)),
        H('div', { class: 'pm-ctrls' }, toggle, reset),
        cfgs,
        H('div', { class: 'pm-stats-wrap' }, H('div', { class: 'pm-stats-t', text: 'Today' }), statEl));
      paintRing(); paintDots(); paintStats();
      win.onClose(() => clearInterval(ticker));
    },
  });
  function HNS(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs || {}) el.setAttribute(k, attrs[k]);
    for (let i = 2; i < arguments.length; i++) { const c = arguments[i]; if (c) el.appendChild(c); }
    return el;
  }
})();
