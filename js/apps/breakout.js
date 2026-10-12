/* Store app — Brick Blitz: breakout with levels, lives and score. */
(function () {
  'use strict';
  const H = LX.h;

  LX.apps.register({
    id: 'breakout', name: 'Brick Blitz', icon: 'gamepad', color: '#F28B82', category: 'Games',
    pkg: true, pkgVersion: '1.0', pkgSize: 7, developer: 'PrideWorks', downloads: 940,
    desc: 'Breakout with combo scoring', longDesc: 'A fresh take on breakout: five-row brick walls, combo multipliers, three lives and levels that speed up as you clear them. Mouse or keyboard paddle.',
    permissions: ['Local storage'], changelog: 'First release.',
    width: 780, height: 600, minWidth: 520, minHeight: 460,
    open(win) {
      const canvas = H('canvas', { class: 'bk-canvas' });
      const ctx = canvas.getContext('2d');
      let W, Hh;
      let state = 'menu', level = 1, score = 0, lives = 3, combo = 0;
      let bricks = [], ball = { x: .5, y: .8, vx: .007, vy: -.0055 }, padX = .5;
      const PADW = .16;
      let raf = null, lastT = 0, keys = {};
      const COLORS = ['#F28B82', '#F6C177', '#9ECE6A', '#5B9DFA', '#CBA6F7'];
      const best = () => LX.store.get('app.breakout.best', 0);

      function resize() { const r = canvas.parentElement.getBoundingClientRect(); W = canvas.width = Math.max(220, r.width); Hh = canvas.height = Math.max(180, r.height); }
      function buildLevel() {
        bricks = [];
        const rows = 4 + Math.min(2, level - 1);
        const cols = 9;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          bricks.push({ x: .06 + c * .098, y: .1 + r * .062, w: .088, h: .05, hp: r < 1 && level > 2 ? 2 : 1, col: COLORS[r % COLORS.length] });
        }
      }
      function newGame() { level = 1; score = 0; lives = 3; buildLevel(); serve(); }
      function serve() {
        ball = { x: .5, y: .82, vx: (Math.random() < .5 ? -1 : 1) * (.006 + level * .0007), vy: -(.005 + level * .0005) };
        state = 'serve';
        setTimeout(() => { if (state === 'serve') state = 'play'; }, 600);
      }
      function step(dt) {
        if (keys.a || keys.arrowleft) padX -= .013 * dt;
        if (keys.d || keys.arrowright) padX += .013 * dt;
        padX = LX.clamp(padX, PADW / 2, 1 - PADW / 2);
        if (state !== 'play') return;
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.x < .012) { ball.x = .012; ball.vx = Math.abs(ball.vx); }
        if (ball.x > .988) { ball.x = .988; ball.vx = -Math.abs(ball.vx); }
        if (ball.y < .012) { ball.y = .012; ball.vy = Math.abs(ball.vy); }
        // paddle
        if (ball.y > .93 && ball.y < .97 && Math.abs(ball.x - padX) < PADW / 2 + .012 && ball.vy > 0) {
          ball.vy = -Math.abs(ball.vy) * 1.02;
          ball.vx += (ball.x - padX) * .02;
          combo = 0;
          LX.audio.beep(380, .04, 'square', .1);
        }
        if (ball.y > 1.05) {
          lives--; combo = 0;
          LX.audio.beep(160, .3, 'sawtooth', .22);
          if (lives <= 0) {
            state = 'over';
            if (score > best()) LX.store.set('app.breakout.best', score);
            LX.notify({ title: 'Brick Blitz', body: 'Game over — score ' + score, icon: 'gamepad' });
          } else serve();
          return;
        }
        // bricks
        for (let i = bricks.length - 1; i >= 0; i--) {
          const b = bricks[i];
          if (ball.x > b.x - .01 && ball.x < b.x + b.w + .01 && ball.y > b.y - .01 && ball.y < b.y + b.h + .01) {
            const overlapX = Math.min(ball.x - b.x, b.x + b.w - ball.x);
            const overlapY = Math.min(ball.y - b.y, b.y + b.h - ball.y);
            if (overlapX < overlapY) ball.vx = -ball.vx; else ball.vy = -ball.vy;
            b.hp--;
            if (b.hp <= 0) bricks.splice(i, 1);
            combo++;
            score += 10 * Math.max(1, combo);
            LX.audio.beep(700 + combo * 60, .05, 'square', .12);
            break;
          }
        }
        if (!bricks.length) {
          level++; score += 250;
          LX.notify({ title: 'Level ' + level, body: 'Wall cleared! +250', icon: 'crown' });
          buildLevel(); serve();
        }
      }
      function draw() {
        const dark = LX.theme.isDark();
        ctx.fillStyle = dark ? '#0b0d13' : '#eef0f5';
        ctx.fillRect(0, 0, W, Hh);
        bricks.forEach((b) => {
          ctx.fillStyle = b.hp > 1 ? '#e8eaf0' : b.col;
          ctx.fillRect(b.x * W, b.y * Hh, b.w * W, b.h * Hh);
          if (b.hp > 1) { ctx.strokeStyle = b.col; ctx.lineWidth = 3; ctx.strokeRect(b.x * W + 1.5, b.y * Hh + 1.5, b.w * W - 3, b.h * Hh - 3); }
        });
        ctx.fillStyle = '#5B9DFA';
        ctx.fillRect((padX - PADW / 2) * W, Hh * .94, PADW * W, 12);
        ctx.beginPath(); ctx.arc(ball.x * W, ball.y * Hh, 8, 0, 7);
        ctx.fillStyle = '#e8eaf0'; ctx.shadowColor = 'rgba(232,234,240,.6)'; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = dark ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.7)';
        ctx.font = '600 13px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText('♥ ' + lives, 12, Hh - 14);
        ctx.textAlign = 'right';
        ctx.fillText('score ' + score + (combo > 1 ? '  ×' + combo : ''), W - 12, Hh - 14);
        if (state === 'menu' || state === 'over') {
          ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, Hh);
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
          ctx.font = '700 26px system-ui';
          ctx.fillText(state === 'over' ? 'Game over — ' + score : 'BRICK BLITZ', W / 2, Hh / 2 - 30);
          ctx.font = '14px system-ui';
          ctx.fillText('Press Space or click to ' + (state === 'over' ? 'retry' : 'start'), W / 2, Hh / 2 + 2);
          ctx.fillText('Best: ' + best(), W / 2, Hh / 2 + 24);
        }
      }
      function loop(t) {
        const dt = Math.min(3, (t - lastT) / 16.66 || 1); lastT = t;
        step(dt); draw();
        raf = requestAnimationFrame(loop);
      }
      const onKey = (e, down) => {
        const k = e.key.toLowerCase();
        if (['a', 'd', 'arrowleft', 'arrowright'].indexOf(k) >= 0) { keys[k] = down; e.preventDefault(); }
        if (k === ' ' && down) { e.preventDefault(); if (state === 'menu' || state === 'over') newGame(); else if (state === 'serve') state = 'play'; }
      };
      win.body.addEventListener('keydown', (e) => onKey(e, true));
      win.body.addEventListener('keyup', (e) => onKey(e, false));
      win.body.tabIndex = 0;
      canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); padX = LX.clamp((e.clientX - r.left) / r.width, PADW / 2, 1 - PADW / 2); });
      canvas.addEventListener('pointerdown', () => { if (state === 'menu' || state === 'over') newGame(); else if (state === 'serve') state = 'play'; });
      win.body.append(
        H('div', { class: 'toolbar' },
          H('button', { class: 'btn sm primary', html: LX.icon('play', 13) + ' New game', onclick: newGame }),
          H('span', { class: 'muted', style: { fontSize: '11.5px' }, text: 'Mouse or A/D · combos multiply the score' })),
        H('div', { class: 'bk-wrap' }, canvas));
      setTimeout(() => { resize(); raf = requestAnimationFrame(loop); }, 30);
      new ResizeObserver(LX.debounce(resize, 150)).observe(canvas.parentElement);
      win.onClose(() => cancelAnimationFrame(raf));
    },
  });
})();
