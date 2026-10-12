/* Leonux Web OS — Snake game (canvas, speed levels, walls toggle, swipe/keys) */
(function () {
  'use strict';
  const N = 22, DELAY = [190, 145, 110, 82, 58];
  LX.apps.register({
    id: 'snake', name: 'Snake', icon: 'gamepad', color: '#7EE787', category: 'Games', desc: 'Classic snake with speed levels and wrap-around mode',
    width: 540, height: 660, minWidth: 340, minHeight: 440,
    open(win) {
      const H = LX.h, body = win.body; body.tabIndex = 0;
      let level = LX.clamp(LX.store.get('app.snake.level', 2), 1, 5), walls = LX.store.get('app.snake.walls', true) !== false;
      let best = LX.store.get('app.snake.best', {}) || {};
      let snake, dir, queue, food, score, state = 'ready', timer = 0, size = 0, dead = false, colors = {};
      const bk = () => (walls ? 'w' : 'o') + level;
      const canvas = H('canvas'), ctx = canvas.getContext('2d');
      const sScore = H('b', { text: '0' }), sBest = H('b', { text: '0' });
      const ov = H('div', { class: 'g-ov' }), stage = H('div', { class: 'g-stage' }, canvas, ov);
      const lvSel = H('select', { class: 'select', onchange: () => { level = +lvSel.value; LX.store.set('app.snake.level', level); newGame(); body.focus(); } },
        [1, 2, 3, 4, 5].map((i) => H('option', { value: i, text: 'Level ' + i, selected: i === level })));
      const wallSw = H('input', { type: 'checkbox', checked: walls, onchange: () => { walls = wallSw.checked; LX.store.set('app.snake.walls', walls); newGame(); body.focus(); } });
      body.append(H('div', { class: 'g-bar' }, H('div', { class: 'g-stat' }, H('small', { text: 'Score' }), sScore), H('div', { class: 'g-stat' }, H('small', { text: 'Best' }), sBest),
        H('div', { class: 'grow' }), lvSel, H('label', { class: 'g-lbl' }, 'Walls', H('label', { class: 'switch' }, wallSw, H('span')))), stage);

      function setOv(title, sub) {
        ov.classList.toggle('hidden', !title); ov.innerHTML = '';
        if (title) ov.append(H('h2', { text: title }), H('p', { text: sub }), H('button', { class: 'btn primary', text: state === 'over' ? 'Play again' : state === 'paused' ? 'Resume' : 'Start', onclick: () => { primary(); body.focus(); } }));
      }
      function stats() { sScore.textContent = score; sBest.textContent = best[bk()] || 0; }
      function newGame() {
        clearTimeout(timer); const m = N >> 1;
        snake = [{ x: m, y: m }, { x: m - 1, y: m }, { x: m - 2, y: m }]; dir = { x: 1, y: 0 }; queue = []; score = 0; state = 'ready';
        spawn(); stats(); setOv('Snake', 'Arrow keys / WASD / swipe to steer. Space pauses.'); draw();
      }
      function spawn() {
        const free = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
        food = free.length ? LX.pick(free) : null;
      }
      function schedule() { clearTimeout(timer); if (state === 'running') timer = setTimeout(tick, DELAY[level - 1]); }
      function primary() { if (state === 'ready' || state === 'paused') { state = 'running'; setOv(null); schedule(); } else if (state === 'over') { newGame(); state = 'running'; setOv(null); schedule(); } }
      function pause() { if (state === 'running') { state = 'paused'; clearTimeout(timer); setOv('Paused', 'Press Space to resume'); } }
      function tick() {
        if (queue.length) dir = queue.shift();
        let hx = snake[0].x + dir.x, hy = snake[0].y + dir.y;
        if (walls) { if (hx < 0 || hy < 0 || hx >= N || hy >= N) return die(); } else { hx = (hx + N) % N; hy = (hy + N) % N; }
        const eat = food && hx === food.x && hy === food.y;
        if (snake.slice(0, eat ? undefined : -1).some((s) => s.x === hx && s.y === hy)) return die();
        snake.unshift({ x: hx, y: hy });
        if (eat) { score += 10 * level; LX.audio.beep(660, 0.05, 'square', 0.08); spawn(); if (score > (best[bk()] || 0)) { best[bk()] = score; LX.store.set('app.snake.best', best); } if (!food) { stats(); draw(); return end('You win!'); } } else snake.pop();
        stats(); draw(); schedule();
      }
      function die() { LX.audio.beep(140, 0.3, 'sawtooth', 0.12); end('Game over'); }
      function end(t) { state = 'over'; clearTimeout(timer); draw(); setOv(t, 'Score ' + score + (score && score >= (best[bk()] || 0) ? ' - new best!' : '')); }
      function steer(dx, dy) {
        const last = queue.length ? queue[queue.length - 1] : dir;
        if ((last.x === dx && dx) || (last.y === dy && dy) || (last.x === -dx && dx) || (last.y === -dy && dy)) return;
        if (queue.length < 3) queue.push({ x: dx, y: dy });
        if (state === 'ready' || state === 'paused') primary();
      }
      function draw() {
        if (!size) return; const c = ctx, u = size / N;
        c.clearRect(0, 0, size, size);
        c.fillStyle = colors.bg; c.fillRect(0, 0, size, size);
        c.fillStyle = colors.grid; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) & 1) c.fillRect(x * u, y * u, u, u);
        if (food) { c.fillStyle = colors.food; c.beginPath(); c.arc((food.x + .5) * u, (food.y + .5) * u, u * .36, 0, 7); c.fill(); }
        snake.forEach((s, i) => {
          c.globalAlpha = Math.max(.45, 1 - i / (snake.length * 1.4)); c.fillStyle = colors.accent;
          const p = i ? 1.5 : 1; c.beginPath(); c.roundRect(s.x * u + p, s.y * u + p, u - p * 2, u - p * 2, u * .3); c.fill();
        });
        c.globalAlpha = 1;
        if (snake.length) { const h = snake[0]; c.fillStyle = '#000'; c.beginPath(); c.arc((h.x + .5 + dir.y * .2 + dir.x * .15) * u, (h.y + .5 + dir.x * .2 + dir.y * .15) * u, u * .09, 0, 7); c.arc((h.x + .5 - dir.y * .2 + dir.x * .15) * u, (h.y + .5 - dir.x * .2 + dir.y * .15) * u, u * .09, 0, 7); c.fill(); }
        if (walls) { c.strokeStyle = colors.danger; c.lineWidth = 3; c.strokeRect(1.5, 1.5, size - 3, size - 3); }
      }
      function fit() {
        const cs = getComputedStyle(body); colors = { bg: cs.getPropertyValue('--surface-2').trim() || '#222', grid: 'rgba(128,128,128,.08)', accent: cs.getPropertyValue('--success').trim() || '#7EE787', food: cs.getPropertyValue('--danger').trim() || '#f66', danger: cs.getPropertyValue('--danger').trim() || '#f66' };
        const s = Math.max(120, Math.floor(Math.min(stage.clientWidth - 20, stage.clientHeight - 20) / N) * N), d = window.devicePixelRatio || 1;
        size = s; canvas.style.width = canvas.style.height = s + 'px'; canvas.width = canvas.height = Math.round(s * d); ctx.setTransform(d, 0, 0, d, 0, 0); draw();
      }
      const ro = new ResizeObserver(fit); ro.observe(stage);
      const offTheme = LX.bus.on('settings:change', () => setTimeout(fit, 50));
      body.addEventListener('keydown', (e) => {
        if (/SELECT|INPUT/.test(e.target.tagName) && e.key !== 'Escape') return;
        const k = e.key.toLowerCase(), m = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] }[k];
        if (m) { e.preventDefault(); steer(m[0], m[1]); }
        else if (k === ' ' || k === 'p') { e.preventDefault(); state === 'running' ? pause() : primary(); }
        else if (k === 'enter' && state === 'over') primary();
        else if (k === 'n') newGame();
      });
      let tx, ty;
      canvas.addEventListener('pointerdown', (e) => { tx = e.clientX; ty = e.clientY; body.focus(); });
      canvas.addEventListener('pointerup', (e) => {
        if (tx == null) return; const dx = e.clientX - tx, dy = e.clientY - ty; tx = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
        Math.abs(dx) > Math.abs(dy) ? steer(dx > 0 ? 1 : -1, 0) : steer(0, dy > 0 ? 1 : -1);
      });
      win.on('blur', pause); win.onClose(() => { clearTimeout(timer); state = 'dead'; ro.disconnect(); offTheme && offTheme(); });
      win.setMenu([{ label: 'Game', items: [{ label: 'New game', shortcut: 'N', action: newGame }, { label: 'Pause / Resume', shortcut: 'Space', action: () => (state === 'running' ? pause() : primary()) }, { separator: true }, { label: 'Reset high scores', action: () => { best = {}; LX.store.set('app.snake.best', best); stats(); } }, { label: 'Close', action: () => win.close() }] }]);
      newGame(); setTimeout(() => body.focus(), 50);
    },
  });
})();
