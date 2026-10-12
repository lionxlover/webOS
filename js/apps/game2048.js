/* Leonux Web OS — 2048 (animated slides, undo, best score, swipe/arrows, win/continue/game over) */
(function () {
  'use strict';
  const COL = { 2: ['#eee4da', '#776e65'], 4: ['#ede0c8', '#776e65'], 8: ['#f2b179', '#fff'], 16: ['#f59563', '#fff'], 32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'], 128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'], 512: ['#edc850', '#fff'], 1024: ['#edc53f', '#fff'], 2048: ['#edc22e', '#fff'] };
  LX.apps.register({
    id: 'game2048', name: '2048', icon: 'grid', color: '#F6C177', category: 'Games', desc: 'Slide and merge tiles to reach 2048',
    width: 480, height: 640, minWidth: 340, minHeight: 440,
    open(win) {
      const H = LX.h, body = win.body; body.tabIndex = 0;
      const N = 4, SAVE = 'app.game2048.state';
      let grid, tiles = [], score = 0, best = +LX.store.get('app.game2048.best', 0) || 0, won = false, keepGoing = false, over = false, history = [], nid = 1, S = 300, gap = 10, busy = false;
      const sScore = H('b', { text: '0' }), sBest = H('b', { text: '0' });
      const board = H('div', { class: 't48-board' }), ov = H('div', { class: 'g-ov hidden' });
      const stage = H('div', { class: 'g-stage' }, board, H('div', { class: 't48-hint', text: 'Arrows / WASD / swipe to move. U to undo.' }), ov);
      const undoBtn = H('button', { class: 'btn sm', html: LX.icon('undo', 14) + ' Undo', onclick: () => { undo(); body.focus(); } });
      body.append(H('div', { class: 'g-bar' }, H('div', { class: 'g-stat' }, H('small', { text: 'Score' }), sScore), H('div', { class: 'g-stat' }, H('small', { text: 'Best' }), sBest), H('div', { class: 'grow' }), undoBtn, H('button', { class: 'btn sm primary', text: 'New game', onclick: () => { newGame(); body.focus(); } })), stage);
      for (let i = 0; i < N * N; i++) board.append(H('div', { class: 't48-cell', dataset: { i } }));

      const cell = () => (S - gap * 2 - gap * (N - 1)) / N;
      function place(t) {
        const cs = cell(), x = gap + t.c * (cs + gap), y = gap + t.r * (cs + gap);
        t.el.style.width = t.el.style.height = cs + 'px'; t.el.style.transform = `translate(${x}px,${y}px)`;
        t.el.style.fontSize = (cs * (t.v >= 1024 ? .32 : t.v >= 128 ? .38 : .46)) + 'px';
      }
      function paint(t) {
        const k = COL[t.v] || ['#3c3a32', '#fff'];
        t.inner.style.background = k[0]; t.inner.style.color = k[1]; t.inner.textContent = t.v; place(t);
      }
      function mk(r, c, v, cls) {
        const inner = H('div', { class: 't48-in' }), el = H('div', { class: 't48-tile ' + (cls || '') }, inner);
        const t = { id: nid++, r, c, v, el, inner }; board.append(el); paint(t); tiles.push(t); grid[r][c] = t; return t;
      }
      function layout() {
        const cs = board.parentNode ? Math.min(stage.clientWidth - 20, stage.clientHeight - 50) : 300;
        S = Math.max(200, Math.floor(cs)); gap = Math.max(6, Math.round(S / 40));
        board.style.width = board.style.height = S + 'px';
        const c = cell(); LX.$$('.t48-cell', board).forEach((e, i) => { const r = i >> 2, q = i & 3; Object.assign(e.style, { width: c + 'px', height: c + 'px', left: gap + q * (c + gap) + 'px', top: gap + r * (c + gap) + 'px' }); });
        tiles.forEach(place);
      }
      function snapshot() { return { cells: tiles.map((t) => [t.r, t.c, t.v]), score }; }
      function save() { LX.store.set(SAVE, { ...snapshot(), won, keepGoing, over }); }
      function load(s) {
        tiles.forEach((t) => t.el.remove()); tiles = []; grid = Array.from({ length: N }, () => Array(N).fill(null));
        s.cells.forEach(([r, c, v]) => mk(r, c, v)); score = s.score; stats();
      }
      function stats() { sScore.textContent = score; if (score > best) { best = score; LX.store.set('app.game2048.best', best); } sBest.textContent = best; undoBtn.disabled = !history.length; }
      function showOv(t, sub, btns) { ov.classList.toggle('hidden', !t); ov.innerHTML = ''; if (t) ov.append(H('h2', { text: t }), H('p', { text: sub }), H('div', { class: 'row gap' }, btns)); }
      function newGame() { history = []; won = keepGoing = over = false; score = 0; load({ cells: [], score: 0 }); spawn(); spawn(); showOv(null); save(); }
      function spawn() {
        const free = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) free.push([r, c]);
        if (!free.length) return; const [r, c] = LX.pick(free); mk(r, c, Math.random() < .9 ? 2 : 4, 't48-new');
      }
      function move(dr, dc) {
        if (busy || over || !ov.classList.contains('hidden')) return;
        const before = snapshot();
        const rows = dr > 0 ? [3, 2, 1, 0] : [0, 1, 2, 3], cols = dc > 0 ? [3, 2, 1, 0] : [0, 1, 2, 3];
        let moved = false, gain = 0; const dead = [], merged = new Set();
        rows.forEach((r) => cols.forEach((c) => {
          const t = grid[r][c]; if (!t) return;
          let nr = r, nc = c;
          while (true) {
            const tr = nr + dr, tc = nc + dc; if (tr < 0 || tc < 0 || tr >= N || tc >= N) break;
            const o = grid[tr][tc];
            if (!o) { nr = tr; nc = tc; continue; }
            if (o.v === t.v && !merged.has(o.id)) { grid[r][c] = null; t.r = tr; t.c = tc; place(t); dead.push(t); merged.add(o.id); o.v *= 2; gain += o.v; moved = true; o.merge = true; t.gone = true; }
            break;
          }
          if (!t.gone && (nr !== r || nc !== c)) { grid[r][c] = null; grid[nr][nc] = t; t.r = nr; t.c = nc; place(t); moved = true; }
        }));
        if (!moved) return;
        history.push(before); if (history.length > 30) history.shift();
        busy = true; score += gain; LX.audio.beep(gain ? 520 : 320, 0.03, 'triangle', 0.05);
        setTimeout(() => {
          dead.forEach((t) => { t.el.remove(); tiles.splice(tiles.indexOf(t), 1); });
          tiles.forEach((t) => { t.el.classList.remove('t48-new', 't48-merge'); if (t.merge) { t.merge = false; paint(t); void t.el.offsetWidth; t.el.classList.add('t48-merge'); } });
          spawn(); busy = false; stats(); check(); save();
        }, 125);
      }
      function check() {
        if (!won && tiles.some((t) => t.v >= 2048) && !keepGoing) { won = true; showOv('You reached 2048!', 'Score ' + score, [H('button', { class: 'btn primary', text: 'Keep going', onclick: () => { keepGoing = true; showOv(null); body.focus(); } }), H('button', { class: 'btn', text: 'New game', onclick: newGame })]); return; }
        if (tiles.length === N * N) {
          let can = false; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const v = grid[r][c].v; if ((c < 3 && grid[r][c + 1].v === v) || (r < 3 && grid[r + 1][c].v === v)) can = true; }
          if (!can) { over = true; LX.audio.beep(150, 0.3, 'sawtooth', 0.1); showOv('Game over', 'Score ' + score, [H('button', { class: 'btn', text: 'Undo', onclick: () => { undo(); body.focus(); } }), H('button', { class: 'btn primary', text: 'Try again', onclick: () => { newGame(); body.focus(); } })]); }
        }
      }
      function undo() { if (busy || !history.length) return; load(history.pop()); over = false; showOv(null); stats(); save(); }
      body.addEventListener('keydown', (e) => {
        const m = { arrowup: [-1, 0], w: [-1, 0], arrowdown: [1, 0], s: [1, 0], arrowleft: [0, -1], a: [0, -1], arrowright: [0, 1], d: [0, 1] }[e.key.toLowerCase()];
        if (m && !e.ctrlKey && !e.metaKey) { e.preventDefault(); move(m[0], m[1]); }
        else if (e.key.toLowerCase() === 'u' || (e.ctrlKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); undo(); }
        else if (e.key.toLowerCase() === 'n') newGame();
      });
      let tx, ty;
      stage.addEventListener('pointerdown', (e) => { tx = e.clientX; ty = e.clientY; body.focus(); });
      stage.addEventListener('pointerup', (e) => {
        if (tx == null) return; const dx = e.clientX - tx, dy = e.clientY - ty; tx = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        Math.abs(dx) > Math.abs(dy) ? move(0, dx > 0 ? 1 : -1) : move(dy > 0 ? 1 : -1, 0);
      });
      const ro = new ResizeObserver(layout); ro.observe(stage);
      win.onClose(() => { ro.disconnect(); save(); });
      win.setMenu([{ label: 'Game', items: [{ label: 'New game', shortcut: 'N', action: newGame }, { label: 'Undo', shortcut: 'U', action: undo }, { separator: true }, { label: 'Reset best score', action: () => { best = 0; LX.store.set('app.game2048.best', 0); stats(); } }, { label: 'Close', action: () => win.close() }] }]);
      layout();
      const sv = LX.store.get(SAVE, null);
      if (sv && Array.isArray(sv.cells) && sv.cells.length && !sv.over) { won = !!sv.won; keepGoing = !!sv.keepGoing; load(sv); } else newGame();
      setTimeout(() => body.focus(), 50);
    },
  });
})();
