/* Store app — Pong Arena: classic pong vs engine or a friend. */
(function () {
  'use strict';
  const H = LX.h;

  LX.apps.register({
    id: 'pong', name: 'Pong Arena', icon: 'gamepad', color: '#74C7EC', category: 'Games',
    pkg: true, pkgVersion: '1.0', pkgSize: 6, developer: 'Leonux Labs', downloads: 870,
    desc: 'The classic, 60fps, two modes', longDesc: 'Pong the way it was meant to be: crisp 60fps canvas play against a speed-capped engine, or grab a friend for local two-player. First to 7 wins.',
    permissions: [], changelog: 'First release.',
    width: 780, height: 560, minWidth: 520, minHeight: 420,
    open(win) {
      const canvas = H('canvas', { class: 'pg-canvas' });
      const ctx = canvas.getContext('2d');
      let W, Hh;
      let mode = 'ai';
      let state = 'menu'; // menu | serve | play | over
      let l = { y: 0.5 }, r = { y: 0.5 };
      let ball = { x: .5, y: .5, vx: .006, vy: .003 };
      let score = [0, 0];
      let keys = {};
      let raf = null, lastT = 0, rally = 0;

      function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        W = canvas.width = Math.max(200, rect.width);
        Hh = canvas.height = Math.max(160, rect.height);
      }
      function reset(dir) {
        ball = { x: .5, y: .5, vx: .0055 * dir * (1 + rally * .04), vy: (Math.random() - .5) * .007 };
        state = 'serve';
        setTimeout(() => { if (state === 'serve') state = 'play'; }, 700);
      }
      function newGame() { score = [0, 0]; rally = 0; l.y = r.y = .5; reset(Math.random() < .5 ? 1 : -1); }

      function step(dt) {
        const PS = 0.011, AI = 0.0085;
        if (keys.w) l.y -= PS * dt;
        if (keys.s) l.y += PS * dt;
        if (mode === 'ai') {
          const target = ball.vx > 0 ? ball.y : .5;
          if (r.y < target - .02) r.y += AI * dt;
          else if (r.y > target + .02) r.y -= AI * dt;
        } else {
          if (keys.arrowup) r.y -= PS * dt;
          if (keys.arrowdown) r.y += PS * dt;
        }
        l.y = LX.clamp(l.y, .09, .91); r.y = LX.clamp(r.y, .09, .91);
        if (state !== 'play') return;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        if (ball.y < .02) { ball.y = .02; ball.vy = Math.abs(ball.vy); }
        if (ball.y > .98) { ball.y = .98; ball.vy = -Math.abs(ball.vy); }
        // paddles at x .03 / .97, height .16
        const PH = .16;
        if (ball.x < .045 && ball.x > .02 && Math.abs(ball.y - l.y) < PH / 2 + .012 && ball.vx < 0) {
          ball.vx = Math.abs(ball.vx) * 1.045;
          ball.vy += (ball.y - l.y) * .012;
          rally++; LX.audio.beep(440, .04, 'square', .12);
        }
        if (ball.x > .955 && ball.x < .98 && Math.abs(ball.y - r.y) < PH / 2 + .012 && ball.vx > 0) {
          ball.vx = -Math.abs(ball.vx) * 1.045;
          ball.vy += (ball.y - r.y) * .012;
          rally++; LX.audio.beep(520, .04, 'square', .12);
        }
        if (ball.x < -.02) { score[1]++; point('Right'); }
        if (ball.x > 1.02) { score[0]++; point('Left'); }
      }
      function point(who) {
        LX.audio.beep(180, .25, 'sawtooth', .2);
        if (score[0] >= 7 || score[1] >= 7) {
          state = 'over';
          LX.notify({ title: 'Pong over', body: who + ' wins ' + Math.max(score[0], score[1]) + '–' + Math.min(score[0], score[1]), icon: 'crown' });
        } else { rally = 0; reset(ball.vx > 0 ? 1 : -1); }
      }
      function draw() {
        ctx.clearRect(0, 0, W, Hh);
        const theme = LX.theme.isDark();
        ctx.fillStyle = theme ? '#0b0d13' : '#eef0f5';
        ctx.fillRect(0, 0, W, Hh);
        ctx.strokeStyle = theme ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.14)';
        ctx.setLineDash([8, 10]);
        ctx.beginPath(); ctx.moveTo(W / 2, 8); ctx.lineTo(W / 2, Hh - 8); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '700 46px system-ui';
        ctx.fillStyle = theme ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.12)';
        ctx.textAlign = 'center';
        ctx.fillText(String(score[0]), W * .25, 56);
        ctx.fillText(String(score[1]), W * .75, 56);
        const PH = .16 * Hh;
        ctx.fillStyle = '#5B9DFA';
        round(ctx, W * .03 - 7, l.y * Hh - PH / 2, 10, PH, 5);
        ctx.fillStyle = '#F28B82';
        round(ctx, W * .97 - 3, r.y * Hh - PH / 2, 10, PH, 5);
        ctx.beginPath();
        ctx.arc(ball.x * W, ball.y * Hh, 8, 0, 7);
        ctx.fillStyle = '#e8eaf0';
        ctx.shadowColor = 'rgba(232,234,240,.7)';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
        if (state === 'menu' || state === 'over') {
          ctx.fillStyle = 'rgba(0,0,0,.55)';
          ctx.fillRect(0, 0, W, Hh);
          ctx.fillStyle = '#fff';
          ctx.font = '700 26px system-ui';
          ctx.fillText(state === 'over' ? (score[0] > score[1] ? 'Left wins!' : 'Right wins!') : 'PONG ARENA', W / 2, Hh / 2 - 34);
          ctx.font = '14px system-ui';
          ctx.fillText('Press Space to ' + (state === 'over' ? 'rematch' : 'start'), W / 2, Hh / 2 + 4);
          ctx.fillText(mode === 'ai' ? 'W/S to move · engine on the right' : 'W/S vs ↑/↓', W / 2, Hh / 2 + 26);
        }
      }
      function round(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill(); }
      function loop(t) {
        const dt = Math.min(3, (t - lastT) / 16.66 || 1); lastT = t;
        step(dt);
        draw();
        raf = requestAnimationFrame(loop);
      }
      const onKey = (e, down) => {
        const k = e.key.toLowerCase();
        if (['w', 's', 'arrowup', 'arrowdown'].indexOf(k) >= 0) { keys[k] = down; e.preventDefault(); }
        if (k === ' ' && down) { e.preventDefault(); if (state === 'menu' || state === 'over') newGame(); else if (state === 'serve') state = 'play'; }
      };
      win.body.addEventListener('keydown', (e) => onKey(e, true));
      win.body.addEventListener('keyup', (e) => onKey(e, false));
      win.body.tabIndex = 0;
      canvas.addEventListener('pointermove', (e) => {
        const rect = canvas.getBoundingClientRect();
        l.y = LX.clamp((e.clientY - rect.top) / rect.height, .09, .91);
      });
      canvas.addEventListener('pointerdown', () => { if (state === 'menu' || state === 'over') newGame(); });
      const modeBtn = H('button', { class: 'btn sm', text: 'Vs engine', onclick: () => { mode = mode === 'ai' ? '2p' : 'ai'; modeBtn.textContent = mode === 'ai' ? 'Vs engine' : '2 players'; } });
      win.body.append(
        H('div', { class: 'toolbar' }, modeBtn,
          H('button', { class: 'btn sm primary', html: LX.icon('play', 13) + ' Start', onclick: () => newGame() }),
          H('span', { class: 'muted', style: { fontSize: '11.5px' }, text: 'First to 7 · mouse or W/S · engine caps its speed' })),
        H('div', { class: 'pg-wrap' }, canvas));
      setTimeout(() => { resize(); raf = requestAnimationFrame(loop); }, 30);
      new ResizeObserver(LX.debounce(resize, 150)).observe(canvas.parentElement);
      win.onClose(() => cancelAnimationFrame(raf));
    },
  });
})();
