/* Store app — Flappy Lion: one-tap flying with parallax savanna. */
(function () {
  'use strict';
  const H = LX.h;

  LX.apps.register({
    id: 'flappylion', name: 'Flappy Lion', icon: 'gamepad', color: '#F6C177', category: 'Games',
    pkg: true, pkgVersion: '1.0', pkgSize: 6, developer: 'Leonux Labs', downloads: 1480,
    desc: 'One tap, infinite savanna', longDesc: 'Guide the lion through the acacia gaps. Parallax savanna, day-night cycle as you fly, and a medal system. Click, tap or press Space to flap.',
    permissions: ['Local storage'], changelog: 'First release.',
    width: 520, height: 640, minWidth: 380, minHeight: 520,
    open(win) {
      const canvas = H('canvas', { class: 'fl-canvas' });
      const ctx = canvas.getContext('2d');
      let W, Hh;
      let state = 'menu', bird = { y: .5, v: 0 }, pipes = [], t = 0, score = 0, bestS = () => LX.store.get('app.flappy.best', 0);
      let raf = null, lastT = 0;
      const GAP = .26, PIPE_W = .09, SPEED = .0042;

      function resize() { const r = canvas.parentElement.getBoundingClientRect(); W = canvas.width = Math.max(240, r.width); Hh = canvas.height = Math.max(300, r.height); }
      function newGame() { bird = { y: .42, v: 0 }; pipes = []; t = 0; score = 0; state = 'serve'; addPipe(); }
      function addPipe() { pipes.push({ x: 1.2, gap: .25 + Math.random() * .5, scored: false }); }
      function flap() {
        if (state === 'menu' || state === 'over') { newGame(); return; }
        if (state === 'serve') state = 'play';
        bird.v = -.0115;
        LX.audio.beep(600, .05, 'sine', .1);
      }
      function die() {
        state = 'over';
        LX.audio.beep(170, .3, 'square', .25);
        if (score > bestS()) { LX.store.set('app.flappy.best', score); LX.notify({ title: 'New best!', body: score + ' points on the savanna', icon: 'crown' }); }
      }
      function step(dt) {
        t += dt;
        if (state === 'play') {
          bird.v += .00068 * dt;
          bird.y += bird.v * dt;
          pipes.forEach((p) => { p.x -= SPEED * dt; });
          if (pipes.length && pipes[0].x < -.15) pipes.shift();
          const lastP = pipes[pipes.length - 1];
          if (!lastP || lastP.x < .55) addPipe();
          pipes.forEach((p) => {
            if (!p.scored && p.x + PIPE_W < .22) { p.scored = true; score++; LX.audio.beep(880, .07, 'sine', .15); }
            if (.22 + PIPE_W > p.x && .22 < p.x + PIPE_W) {
              if (bird.y < p.gap - GAP / 2 || bird.y > p.gap + GAP / 2) die();
            }
          });
          if (bird.y > 1.02 || bird.y < -.02) die();
        }
      }
      function draw() {
        const night = (Math.sin(t / 420) + 1) / 2; // slow day/night
        const skyA = 14 + night * 4, skyB = 20 + night * 6;
        const g = ctx.createLinearGradient(0, 0, 0, Hh);
        g.addColorStop(0, 'hsl(215,60%,' + (62 - night * 45) + '%)');
        g.addColorStop(1, 'hsl(28,70%,' + (78 - night * 55) + '%)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
        // sun / moon
        ctx.beginPath();
        ctx.arc(W * .82, Hh * .2, 26, 0, 7);
        ctx.fillStyle = night > .5 ? '#d8dee9' : '#FFD166';
        ctx.fill();
        // stars at night
        if (night > .45) {
          ctx.fillStyle = 'rgba(255,255,255,' + (night - .45) * 1.6 + ')';
          const rr = LX.seeded('stars');
          for (let i = 0; i < 40; i++) ctx.fillRect((rr() * W + t * .2) % W, rr() * Hh * .4, 2, 2);
        }
        // far hills (parallax)
        ctx.fillStyle = 'hsla(150,30%,' + (30 - night * 18) + '%,.9)';
        ctx.beginPath();
        ctx.moveTo(0, Hh * .72);
        for (let x = 0; x <= W; x += 40) ctx.lineTo(x, Hh * .72 - Math.abs(Math.sin((x + t * .4) / 130)) * Hh * .1);
        ctx.lineTo(W, Hh); ctx.lineTo(0, Hh); ctx.fill();
        // ground strip
        ctx.fillStyle = 'hsl(95,35%,' + (34 - night * 20) + '%)';
        ctx.fillRect(0, Hh * .93, W, Hh * .07);
        // pipes (acacia trunks)
        pipes.forEach((p) => {
          const px = p.x * W, pw = PIPE_W * W, gy = p.gap * Hh, gh = GAP / 2 * Hh;
          ctx.fillStyle = '#7a5a33';
          ctx.fillRect(px, 0, pw, gy - gh);
          ctx.fillRect(px, gy + gh, pw, Hh - gy - gh);
          ctx.fillStyle = '#5c421f';
          ctx.fillRect(px - 3, gy - gh - 14, pw + 6, 14);
          ctx.fillRect(px - 3, gy + gh, pw + 6, 14);
        });
        // lion
        const bx = .22 * W, by = bird.y * Hh;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(LX.clamp(bird.v * 3, -.5, .8));
        // body
        ctx.fillStyle = '#F6C177';
        ctx.beginPath(); ctx.ellipse(0, 0, 20, 15, 0, 0, 7); ctx.fill();
        // mane
        ctx.fillStyle = '#c1440e';
        ctx.beginPath(); ctx.arc(-4, 0, 13, 0, 7); ctx.fill();
        // face
        ctx.fillStyle = '#F6C177';
        ctx.beginPath(); ctx.arc(-7, -1, 8, 0, 7); ctx.fill();
        ctx.fillStyle = '#1b1d23';
        ctx.beginPath(); ctx.arc(-10, -3, 1.6, 0, 7); ctx.fill();
        ctx.fillStyle = '#e8eaf0';
        ctx.beginPath(); ctx.arc(18, -3, 7, 0, 7); ctx.fill(); // tail tuft
        ctx.strokeStyle = '#c1440e'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(18, -8, 18, -3); ctx.stroke();
        // wing flap
        const wing = Math.sin(t / 3) * (state === 'play' ? 12 : 4);
        ctx.fillStyle = '#d99a4e';
        ctx.beginPath(); ctx.ellipse(-2, 4, 10, 6, wing * .02, 0, 7); ctx.fill();
        ctx.restore();
        // score
        ctx.textAlign = 'center';
        ctx.font = '800 34px system-ui';
        ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 5;
        ctx.strokeText(String(score), W / 2, 64);
        ctx.fillStyle = '#fff'; ctx.fillText(String(score), W / 2, 64);
        if (state === 'menu' || state === 'over') {
          ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, Hh);
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
          ctx.font = '700 24px system-ui';
          ctx.fillText(state === 'over' ? 'Score ' + score : 'FLAPPY LION', W / 2, Hh / 2 - 26);
          ctx.font = '14px system-ui';
          ctx.fillText('Tap / click / Space to flap', W / 2, Hh / 2 + 6);
          if (state === 'over') ctx.fillText('Best: ' + bestS(), W / 2, Hh / 2 + 28);
        }
      }
      function loop(ts) {
        const dt = Math.min(3, (ts - lastT) / 16.66 || 1); lastT = ts;
        step(dt); draw();
        raf = requestAnimationFrame(loop);
      }
      const onKey = (e, down) => { if (down && (e.key === ' ' || e.key === 'ArrowUp')) { e.preventDefault(); flap(); } };
      win.body.addEventListener('keydown', (e) => onKey(e, true));
      win.body.tabIndex = 0;
      canvas.addEventListener('pointerdown', () => flap());
      win.body.append(
        H('div', { class: 'toolbar' },
          H('button', { class: 'btn sm primary', html: LX.icon('play', 13) + ' Fly', onclick: flap }),
          H('span', { class: 'muted', style: { fontSize: '11.5px' }, text: 'Best: ' + bestS() + ' · tap to flap' })),
        H('div', { class: 'fl-wrap' }, canvas));
      setTimeout(() => { resize(); raf = requestAnimationFrame(loop); }, 30);
      new ResizeObserver(LX.debounce(resize, 150)).observe(canvas.parentElement);
      win.onClose(() => cancelAnimationFrame(raf));
    },
  });
})();
