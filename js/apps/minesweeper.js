/* Leonux Web OS — Minesweeper (3 presets + custom, flags, chording, best times) */
(function () {
  'use strict';
  const MODES = { beginner: { c: 9, r: 9, m: 10, n: 'Beginner' }, intermediate: { c: 16, r: 16, m: 40, n: 'Intermediate' }, expert: { c: 30, r: 16, m: 99, n: 'Expert' } };
  const FLAG = '<svg viewBox="0 0 16 16" class="ms-flag"><path d="M4 1.5v13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4.5 2l8 3-8 3z" fill="currentColor"/></svg>';
  const MINE = '<svg viewBox="0 0 16 16"><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1v14M1 8h14M3 3l10 10M13 3L3 13"/></g><circle cx="8" cy="8" r="4.2" fill="currentColor"/><circle cx="6.6" cy="6.6" r="1.2" fill="#fff"/></svg>';
  LX.apps.register({
    id: 'minesweeper', name: 'Minesweeper', icon: 'zap', color: '#FF6B6B', category: 'Games', desc: 'Find all the mines. Right-click or long-press to flag.',
    width: 520, height: 620, minWidth: 340, minHeight: 400,
    open(win) {
      const H = LX.h, body = win.body; body.tabIndex = 0;
      let mode = LX.store.get('app.minesweeper.mode', 'beginner'), custom = LX.store.get('app.minesweeper.custom', { c: 12, r: 12, m: 20 });
      let best = LX.store.get('app.minesweeper.best', {}) || {};
      let cfg, cells, state, flags, opened, t0, secs, timer = 0, cs = 28, cur = 0;
      const sMines = H('b'), sTime = H('b', { text: '0' }), sBest = H('b', { text: '-' });
      const face = H('button', { class: 'btn sm', text: 'New game', onclick: () => { newGame(); body.focus(); } });
      const modeSel = H('select', { class: 'select', onchange: async () => { if (modeSel.value === 'custom') { const ok = await askCustom(); if (!ok) { modeSel.value = mode; return; } } mode = modeSel.value; LX.store.set('app.minesweeper.mode', mode); newGame(); body.focus(); } },
        Object.keys(MODES).map((k) => H('option', { value: k, text: MODES[k].n })), H('option', { value: 'custom', text: 'Custom' }));
      modeSel.value = mode;
      const boardEl = H('div', { class: 'ms-board' }), ov = H('div', { class: 'g-ov hidden' });
      const stage = H('div', { class: 'g-stage', style: 'overflow:auto' }, H('div', { style: 'margin:auto;display:flex' }, boardEl), ov);
      body.append(H('div', { class: 'g-bar' }, H('div', { class: 'g-stat' }, H('small', { text: 'Mines' }), sMines), H('div', { class: 'g-stat' }, H('small', { text: 'Time' }), sTime), H('div', { class: 'g-stat' }, H('small', { text: 'Best' }), sBest), H('div', { class: 'grow' }), modeSel, face), stage);

      async function askCustom() {
        const v = await LX.dialog.prompt('Enter columns x rows x mines (e.g. 20x15x50). Max 40x30.', custom.c + 'x' + custom.r + 'x' + custom.m, 'Custom board');
        if (!v) return false; const p = v.split(/[x,\s]+/).map(Number);
        if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) { LX.dialog.alert('Please use the format 20x15x50.'); return false; }
        const c = LX.clamp(p[0] | 0, 5, 40), r = LX.clamp(p[1] | 0, 5, 30), m = LX.clamp(p[2] | 0, 1, c * r - 9);
        custom = { c, r, m }; LX.store.set('app.minesweeper.custom', custom); return true;
      }
      const bestKey = () => (mode === 'custom' ? null : mode);
      function newGame() {
        clearInterval(timer); cfg = mode === 'custom' ? custom : MODES[mode] || MODES.beginner;
        cells = Array.from({ length: cfg.c * cfg.r }, () => ({ m: false, o: false, f: false, n: 0 }));
        state = 'ready'; flags = 0; opened = 0; secs = 0; cur = 0; ov.classList.add('hidden');
        boardEl.style.gridTemplateColumns = 'repeat(' + cfg.c + ',var(--cs,26px))'; boardEl.style.gridAutoRows = 'var(--cs,26px)';
        boardEl.innerHTML = ''; cells.forEach((_, i) => boardEl.appendChild(H('div', { class: 'ms-c', dataset: { i } })));
        face.textContent = 'New game'; layout(); paintAll(); head();
      }
      function layout() {
        cs = LX.clamp(Math.floor(Math.min((stage.clientWidth - 36) / cfg.c, (stage.clientHeight - 36) / cfg.r)) - 2, 18, 44); boardEl.style.setProperty('--cs', cs + 'px');
      }
      function head() {
        sMines.textContent = cfg.m - flags; sTime.textContent = secs; const k = bestKey(); sBest.textContent = k && best[k] ? best[k] + 's' : '-';
      }
      const nb = (i) => { const x = i % cfg.c, y = (i / cfg.c) | 0, o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < cfg.c && b < cfg.r) o.push(b * cfg.c + a); } return o; };
      function plant(safe) {
        const ban = new Set([safe].concat(nb(safe))); const pool = []; cells.forEach((_, i) => { if (!ban.has(i)) pool.push(i); });
        if (pool.length < cfg.m) cells.forEach((_, i) => { if (i !== safe && !pool.includes(i)) pool.push(i); });
        for (let k = 0; k < cfg.m; k++) { const j = LX.rand(k, pool.length - 1); [pool[k], pool[j]] = [pool[j], pool[k]]; cells[pool[k]].m = true; }
        cells.forEach((c, i) => { c.n = nb(i).filter((j) => cells[j].m).length; });
      }
      function paint(i) {
        const c = cells[i], el = boardEl.children[i]; if (!el) return;
        let cls = 'ms-c', h = '';
        if (c.o) { cls += ' open'; if (c.m) { cls += ' mine'; h = MINE; } else if (c.n) { cls += ' n' + c.n; h = c.n; } }
        else if (c.f) { h = FLAG; if (state === 'lost' && !c.m) cls += ' wrong'; }
        else if (state === 'lost' && c.m) { cls += ' open'; h = MINE; }
        if (i === cur && document.activeElement === body) cls += ' cur';
        if (el.className !== cls) el.className = cls; if (el._h !== h) { el.innerHTML = h; el._h = h; }
      }
      const paintAll = () => cells.forEach((_, i) => paint(i));
      function reveal(i) {
        const st = [i];
        while (st.length) {
          const k = st.pop(), c = cells[k]; if (c.o || c.f) continue; c.o = true; opened++;
          if (c.m) return lose(k); if (c.n === 0) nb(k).forEach((j) => { if (!cells[j].o) st.push(j); });
        }
        if (opened === cells.length - cfg.m) win_();
      }
      function open(i) {
        if (state === 'won' || state === 'lost') return; const c = cells[i];
        if (c.f) return;
        if (c.o) { // chord
          if (c.n && nb(i).filter((j) => cells[j].f).length === c.n) { nb(i).forEach((j) => { if (state === 'playing') reveal(j); }); }
        } else {
          if (state === 'ready') { plant(i); state = 'playing'; t0 = Date.now(); timer = setInterval(() => { secs = Math.floor((Date.now() - t0) / 1000); sTime.textContent = secs; }, 250); }
          reveal(i);
        }
        paintAll(); head();
      }
      function flag(i) {
        if (state === 'won' || state === 'lost') return; const c = cells[i]; if (c.o) return;
        c.f = !c.f; flags += c.f ? 1 : -1; paint(i); head(); LX.audio.beep(c.f ? 520 : 380, 0.04, 'square', 0.05);
      }
      function lose(k) { state = 'lost'; clearInterval(timer); cells[k].o = true; LX.audio.beep(120, 0.4, 'sawtooth', 0.15); face.textContent = 'Try again'; setTimeout(() => banner('Boom!', 'You hit a mine.'), 400); }
      function win_() {
        state = 'won'; clearInterval(timer); secs = Math.max(1, Math.round((Date.now() - t0) / 1000)); cells.forEach((c) => { if (c.m && !c.f) { c.f = true; flags++; } });
        const k = bestKey(); let rec = false; if (k && (!best[k] || secs < best[k])) { best[k] = secs; LX.store.set('app.minesweeper.best', best); rec = true; }
        LX.audio.chime(); face.textContent = 'Play again'; paintAll(); head(); banner('Cleared!', 'Time: ' + secs + 's' + (rec ? ' - new best!' : ''));
      }
      function banner(t, s) { if (state !== 'won' && state !== 'lost') return; ov.innerHTML = ''; ov.classList.remove('hidden'); ov.append(H('h2', { text: t }), H('p', { text: s }), H('button', { class: 'btn primary', text: 'New game', onclick: () => { newGame(); body.focus(); } })); }

      let lp = null, longDone = false, downI = -1;
      const idx = (e) => { const el = e.target.closest('.ms-c'); return el ? +el.dataset.i : -1; };
      boardEl.addEventListener('pointerdown', (e) => {
        body.focus(); const i = idx(e); if (i < 0) return; downI = i; longDone = false; cur = i;
        if (e.pointerType !== 'mouse') lp = setTimeout(() => { longDone = true; flag(i); if (navigator.vibrate) try { navigator.vibrate(20); } catch (x) {} }, 420);
      });
      boardEl.addEventListener('pointerup', (e) => {
        clearTimeout(lp); const i = idx(e);
        if (i < 0 || i !== downI || longDone) return;
        if (e.pointerType === 'mouse') { if (e.button === 0) open(i); else if (e.button === 1) { e.preventDefault(); open(i); } } else open(i);
      });
      boardEl.addEventListener('pointercancel', () => clearTimeout(lp));
      boardEl.addEventListener('pointerleave', () => clearTimeout(lp));
      boardEl.addEventListener('contextmenu', (e) => { e.preventDefault(); if (e.pointerType === 'touch' || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents)) return; const i = idx(e); if (i >= 0) flag(i); });
      body.addEventListener('keydown', (e) => {
        if (/SELECT|INPUT/.test(e.target.tagName)) return; const k = e.key; let m = true;
        if (k === 'ArrowLeft') cur = (cur % cfg.c) ? cur - 1 : cur; else if (k === 'ArrowRight') cur = (cur % cfg.c < cfg.c - 1) ? cur + 1 : cur;
        else if (k === 'ArrowUp') cur = cur >= cfg.c ? cur - cfg.c : cur; else if (k === 'ArrowDown') cur = cur + cfg.c < cells.length ? cur + cfg.c : cur;
        else if (k === ' ' || k === 'Enter') open(cur); else if (k === 'f' || k === 'F') flag(cur); else if (k === 'n' || k === 'F2') newGame(); else m = false;
        if (m) { e.preventDefault(); paintAll(); }
      });
      body.addEventListener('blur', () => paint(cur)); body.addEventListener('focus', () => paint(cur));
      const ro = new ResizeObserver(layout); ro.observe(stage);
      win.on('blur', () => { /* timer is wall-clock based; nothing to pause for a turn-based game */ });
      win.onClose(() => { clearInterval(timer); ro.disconnect(); });
      const setMode = (m) => async () => { if (m === 'custom' && !(await askCustom())) return; mode = m; modeSel.value = m; LX.store.set('app.minesweeper.mode', m); newGame(); };
      win.setMenu([{ label: 'Game', items: [{ label: 'New game', shortcut: 'N', action: newGame }, { separator: true }, { label: 'Beginner (9x9, 10)', action: setMode('beginner') }, { label: 'Intermediate (16x16, 40)', action: setMode('intermediate') }, { label: 'Expert (30x16, 99)', action: setMode('expert') }, { label: 'Custom...', action: setMode('custom') }, { separator: true }, { label: 'Reset best times', action: () => { best = {}; LX.store.set('app.minesweeper.best', best); head(); } }, { label: 'Close', action: () => win.close() }] }]);
      newGame(); setTimeout(() => body.focus(), 50);
    },
  });
})();
