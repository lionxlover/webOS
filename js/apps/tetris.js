/* Leonux Web OS — Tetris (canvas, 7-bag, ghost, hold, next, levels, pause, high score) */
(function () {
  'use strict';
  const W = 10, Hh = 20;
  const SHAPES = {
    I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
    S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  };
  const COLORS = { I: '#4DD0E1', O: '#F6C177', T: '#B58CFF', S: '#7EE787', Z: '#FF6B6B', J: '#5B9DFA', L: '#FF9F5A' };
  const SCORES = [0, 100, 300, 500, 800];
  function rot(cells, size) { return cells.map(([x, y]) => [size - 1 - y, x]); }
  LX.apps.register({
    id: 'tetris', name: 'Tetris', icon: 'layers', color: '#B58CFF', category: 'Games', desc: 'Falling blocks with hold, ghost piece and levels',
    width: 560, height: 700, minWidth: 380, minHeight: 480,
    open(win) {
      const H = LX.h, body = win.body; body.tabIndex = 0;
      let board, cur, bag = [], next, hold = null, canHold = true, score, lines, level, state = 'ready', raf = 0, last = 0, acc = 0, size = 0, cell = 20, high = +LX.store.get('app.tetris.high', 0) || 0, colors = {};
      const sScore = H('b', { text: '0' }), sLevel = H('b', { text: '1' }), sLines = H('b', { text: '0' }), sBest = H('b', { text: '0' });
      const canvas = H('canvas'), hc = H('canvas', { width: 92, height: 70 }), nc = H('canvas', { width: 92, height: 70 });
      const ctx = canvas.getContext('2d'), hctx = hc.getContext('2d'), nctx = nc.getContext('2d');
      const ov = H('div', { class: 'g-ov' });
      const main = H('div', { class: 'tt-main' }, canvas, ov);
      const side = H('div', { class: 'tt-side' }, H('div', { class: 'lbl', text: 'Hold' }), hc, H('div', { class: 'lbl', text: 'Next' }), nc,
        H('div', { class: 'tt-help', html: '&larr; &rarr; move<br>&uarr; / X rotate<br>Z rotate back<br>&darr; soft drop<br>Space hard drop<br>C hold, P pause' }));
      const stage = H('div', { class: 'g-stage' }, H('div', { class: 'tt-wrap' }, side, main));
      body.append(H('div', { class: 'g-bar' }, H('div', { class: 'g-stat' }, H('small', { text: 'Score' }), sScore), H('div', { class: 'g-stat' }, H('small', { text: 'Level' }), sLevel), H('div', { class: 'g-stat' }, H('small', { text: 'Lines' }), sLines), H('div', { class: 'g-stat' }, H('small', { text: 'Best' }), sBest)), stage);

      function refill() { const b = Object.keys(SHAPES); for (let i = b.length - 1; i > 0; i--) { const j = LX.rand(0, i); [b[i], b[j]] = [b[j], b[i]]; } bag.push(...b); }
      function take() { if (bag.length < 2) refill(); return bag.shift(); }
      function mkPiece(t) { const sz = t === 'I' ? 4 : t === 'O' ? 4 : 3; return { t, cells: SHAPES[t].map((c) => c.slice()), sz, x: 3, y: t === 'I' ? -1 : 0 }; }
      function rotated(p, dir) {
        if (p.t === 'O') return p.cells;
        let c = p.cells; const n = dir > 0 ? 1 : 3; for (let i = 0; i < n; i++) c = rot(c, p.sz); return c;
      }
      function fits(cells, x, y) { return cells.every(([cx, cy]) => { const X = x + cx, Y = y + cy; return X >= 0 && X < W && Y < Hh && (Y < 0 || !board[Y][X]); }); }
      function spawn() {
        cur = mkPiece(next); next = take(); canHold = true;
        if (!fits(cur.cells, cur.x, cur.y)) return gameOver();
        drawSide();
      }
      function newGame() {
        board = Array.from({ length: Hh }, () => Array(W).fill(null)); bag = []; hold = null; score = 0; lines = 0; level = 1; acc = 0; next = take(); state = 'ready';
        spawn(); stats(); showOv('Tetris', 'Press Space or Start to play', 'Start'); draw(); drawSide();
      }
      function stats() { sScore.textContent = score; sLevel.textContent = level; sLines.textContent = lines; sBest.textContent = high; }
      function showOv(t, sub, btn) { ov.classList.toggle('hidden', !t); ov.innerHTML = ''; if (t) ov.append(H('h2', { text: t }), H('p', { text: sub }), H('button', { class: 'btn primary', text: btn, onclick: () => { primary(); body.focus(); } })); }
      function primary() { if (state === 'over') newGame(); if (state === 'ready' || state === 'paused') { state = 'running'; showOv(null); last = performance.now(); loop(last); } }
      function pause() { if (state === 'running') { state = 'paused'; cancelAnimationFrame(raf); showOv('Paused', 'Press P to resume', 'Resume'); } }
      function gameOver() {
        state = 'over'; cancelAnimationFrame(raf); LX.audio.beep(130, 0.4, 'sawtooth', 0.12);
        const nb = score > high; if (nb) { high = score; LX.store.set('app.tetris.high', high); }
        stats(); draw(); showOv('Game over', 'Score ' + score + (nb ? ' - new best!' : ''), 'Play again');
      }
      const delay = () => Math.max(60, 900 * Math.pow(0.82, level - 1));
      function loop(t) {
        if (state !== 'running') return;
        acc += t - last; last = t;
        const d = delay(); let n = 0;
        while (acc >= d && n++ < 5) { acc -= d; if (!step()) break; }
        draw(); raf = requestAnimationFrame(loop);
      }
      function step() { if (fits(cur.cells, cur.x, cur.y + 1)) { cur.y++; return true; } lock(); return false; }
      function lock() {
        cur.cells.forEach(([cx, cy]) => { const Y = cur.y + cy; if (Y >= 0) board[Y][cur.x + cx] = cur.t; });
        let cleared = 0;
        for (let y = Hh - 1; y >= 0; y--) if (board[y].every(Boolean)) { board.splice(y, 1); board.unshift(Array(W).fill(null)); cleared++; y++; }
        if (cleared) { score += SCORES[cleared] * level; lines += cleared; level = 1 + Math.floor(lines / 10); LX.audio.beep(600 + cleared * 100, 0.1, 'square', 0.08); } else LX.audio.beep(200, 0.03, 'square', 0.05);
        if (score > high) { high = score; LX.store.set('app.tetris.high', high); }
        stats(); spawn();
      }
      function shift(dx) { if (state === 'running' && fits(cur.cells, cur.x + dx, cur.y)) { cur.x += dx; draw(); } }
      function rotate(dir) {
        if (state !== 'running') return; const c = rotated(cur, dir);
        for (const k of [0, -1, 1, -2, 2]) if (fits(c, cur.x + k, cur.y)) { cur.cells = c; cur.x += k; draw(); return; }
        if (fits(c, cur.x, cur.y - 1)) { cur.cells = c; cur.y--; draw(); }
      }
      function soft() { if (state !== 'running') return; if (fits(cur.cells, cur.x, cur.y + 1)) { cur.y++; score++; stats(); acc = 0; draw(); } }
      function hard() { if (state !== 'running') return; let n = 0; while (fits(cur.cells, cur.x, cur.y + 1)) { cur.y++; n++; } score += n * 2; lock(); acc = 0; draw(); }
      function doHold() {
        if (state !== 'running' || !canHold) return; const t = cur.t;
        if (hold) { cur = mkPiece(hold); } else { cur = mkPiece(next); next = take(); }
        hold = t; canHold = false; drawSide(); draw();
      }
      function block(c, x, y, u, col, a) {
        c.globalAlpha = a == null ? 1 : a; c.fillStyle = col; c.beginPath(); c.roundRect(x + 1, y + 1, u - 2, u - 2, u * .18); c.fill();
        if (a == null) { c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x + 3, y + 3, u - 6, Math.max(2, u * .15)); }
        c.globalAlpha = 1;
      }
      function draw() {
        if (!size) return; const c = ctx, u = cell;
        c.clearRect(0, 0, canvas.width, canvas.height); c.fillStyle = colors.bg; c.fillRect(0, 0, W * u, Hh * u);
        c.strokeStyle = colors.grid; c.lineWidth = 1; c.beginPath();
        for (let x = 1; x < W; x++) { c.moveTo(x * u + .5, 0); c.lineTo(x * u + .5, Hh * u); } for (let y = 1; y < Hh; y++) { c.moveTo(0, y * u + .5); c.lineTo(W * u, y * u + .5); } c.stroke();
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (board[y][x]) block(c, x * u, y * u, u, COLORS[board[y][x]]);
        if (cur && state !== 'over') {
          let gy = cur.y; while (fits(cur.cells, cur.x, gy + 1)) gy++;
          cur.cells.forEach(([cx, cy]) => { if (gy + cy >= 0) block(c, (cur.x + cx) * u, (gy + cy) * u, u, COLORS[cur.t], .22); });
          cur.cells.forEach(([cx, cy]) => { if (cur.y + cy >= 0) block(c, (cur.x + cx) * u, (cur.y + cy) * u, u, COLORS[cur.t]); });
        }
      }
      function mini(c, t, dim) {
        c.clearRect(0, 0, 92, 70); if (!t) return; const cs = SHAPES[t], u = 16, xs = cs.map((p) => p[0]), ys = cs.map((p) => p[1]);
        const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1, ox = (92 - w * u) / 2 - Math.min(...xs) * u, oy = (70 - h * u) / 2 - Math.min(...ys) * u;
        cs.forEach(([x, y]) => block(c, ox + x * u, oy + y * u, u, COLORS[t], dim ? .35 : null));
      }
      function drawSide() { mini(hctx, hold, !canHold); mini(nctx, next); }
      function fit() {
        const cs = getComputedStyle(body);
        colors = { bg: cs.getPropertyValue('--surface-2').trim() || '#222', grid: 'rgba(128,128,128,.12)' };
        const aw = main.clientWidth - 4, ah = main.clientHeight - 4, wide = stage.clientWidth > 360;
        side.style.display = wide ? '' : 'none';
        cell = Math.max(10, Math.floor(Math.min(aw / W, ah / Hh))); size = cell * W;
        const d = window.devicePixelRatio || 1; canvas.style.width = W * cell + 'px'; canvas.style.height = Hh * cell + 'px';
        canvas.width = Math.round(W * cell * d); canvas.height = Math.round(Hh * cell * d); ctx.setTransform(d, 0, 0, d, 0, 0);
        [hc, nc].forEach((c) => { c.width = 92 * d; c.height = 70 * d; c.getContext('2d').setTransform(d, 0, 0, d, 0, 0); });
        draw(); drawSide();
      }
      const ro = new ResizeObserver(fit); ro.observe(stage);
      const offTheme = LX.bus.on('settings:change', () => setTimeout(fit, 50));
      body.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key.toLowerCase();
        if (k === 'arrowleft' || k === 'a') shift(-1);
        else if (k === 'arrowright' || k === 'd') shift(1);
        else if (k === 'arrowup' || k === 'x' || k === 'w') rotate(1);
        else if (k === 'z') rotate(-1);
        else if (k === 'arrowdown' || k === 's') soft();
        else if (k === 'c') doHold();
        else if (k === ' ') { state === 'running' ? (e.repeat || hard()) : primary(); }
        else if (k === 'p' || k === 'escape') { state === 'running' ? pause() : primary(); }
        else if (k === 'enter') { if (state !== 'running') primary(); }
        else if (k === 'n') newGame();
        else return;
        e.preventDefault();
      });
      win.on('blur', pause);
      win.onClose(() => { state = 'dead'; cancelAnimationFrame(raf); ro.disconnect(); offTheme && offTheme(); });
      win.setMenu([{ label: 'Game', items: [{ label: 'New game', shortcut: 'N', action: newGame }, { label: 'Pause / Resume', shortcut: 'P', action: () => (state === 'running' ? pause() : primary()) }, { label: 'Hold piece', shortcut: 'C', action: doHold }, { separator: true }, { label: 'Reset high score', action: () => { high = 0; LX.store.set('app.tetris.high', 0); stats(); } }, { label: 'Close', action: () => win.close() }] }]);
      let tx, ty, tt;
      canvas.addEventListener('pointerdown', (e) => { tx = e.clientX; ty = e.clientY; tt = Date.now(); body.focus(); });
      canvas.addEventListener('pointerup', (e) => {
        if (tx == null) return; const dx = e.clientX - tx, dy = e.clientY - ty; tx = null;
        if (Math.abs(dx) < 15 && Math.abs(dy) < 15) return rotate(1);
        if (Math.abs(dx) > Math.abs(dy)) shift(dx > 0 ? 1 : -1); else if (dy > 0) hard();
      });
      newGame(); setTimeout(() => body.focus(), 50);
    },
  });
})();
