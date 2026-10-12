/* Leonux Web OS — Memory (emoji card matching, 3 difficulties, moves/time, best scores) */
(function () {
  'use strict';
  const EMOJI = ['🦁', '🐙', '🦊', '🐼', '🐸', '🦄', '🐝', '🦋', '🐳', '🌵', '🍉', '🍕', '🚀', '⚡', '🎸', '💎', '🍄', '🌈'];
  const LV = { easy: { c: 4, r: 3, name: 'Easy (4x3)' }, medium: { c: 4, r: 4, name: 'Medium (4x4)' }, hard: { c: 6, r: 5, name: 'Hard (6x5)' } };
  LX.apps.register({
    id: 'memory', name: 'Memory', icon: 'star', color: '#FF6B9D', category: 'Games', desc: 'Find all matching pairs in the fewest moves',
    width: 560, height: 640, minWidth: 340, minHeight: 420,
    open(win) {
      const H = LX.h, body = win.body; body.tabIndex = 0;
      let lv = LX.store.get('app.memory.level', 'easy'); if (!LV[lv]) lv = 'easy';
      let best = LX.store.get('app.memory.best', {}) || {};
      let cards = [], flipped = [], moves = 0, matched = 0, secs = 0, timer = 0, started = false, lock = false, over = false, focus = 0, paused = false;
      const sMoves = H('b', { text: '0' }), sTime = H('b', { text: '0:00' }), sBest = H('b', { text: '-' });
      const grid = H('div', { class: 'mem-grid' }), ov = H('div', { class: 'g-ov hidden' });
      const stage = H('div', { class: 'g-stage' }, grid, ov);
      const sel = H('select', { class: 'select', onchange: () => { lv = sel.value; LX.store.set('app.memory.level', lv); newGame(); body.focus(); } },
        Object.keys(LV).map((k) => H('option', { value: k, text: LV[k].name, selected: k === lv })));
      body.append(H('div', { class: 'g-bar' }, H('div', { class: 'g-stat' }, H('small', { text: 'Moves' }), sMoves), H('div', { class: 'g-stat' }, H('small', { text: 'Time' }), sTime), H('div', { class: 'g-stat' }, H('small', { text: 'Best' }), sBest), H('div', { class: 'grow' }), sel,
        H('button', { class: 'btn sm primary', text: 'New game', onclick: () => { newGame(); body.focus(); } })), stage);

      const fmt = (s) => Math.floor(s / 60) + ':' + LX.pad(s % 60);
      function stats() { sMoves.textContent = moves; sTime.textContent = fmt(secs); const b = best[lv]; sBest.textContent = b ? b.moves + ' / ' + fmt(b.time) : '-'; }
      function tick() { secs++; sTime.textContent = fmt(secs); }
      function startTimer() { if (!started) { started = true; timer = setInterval(tick, 1000); } }
      function stopTimer() { clearInterval(timer); timer = 0; }
      function newGame() {
        stopTimer(); const { c, r } = LV[lv], n = c * r / 2; started = false; moves = matched = secs = 0; flipped = []; lock = false; over = false; paused = false; focus = 0;
        const em = EMOJI.slice(); for (let i = em.length - 1; i > 0; i--) { const j = LX.rand(0, i); [em[i], em[j]] = [em[j], em[i]]; }
        const deck = em.slice(0, n); deck.push(...deck); for (let i = deck.length - 1; i > 0; i--) { const j = LX.rand(0, i); [deck[i], deck[j]] = [deck[j], deck[i]]; }
        grid.innerHTML = ''; grid.style.gridTemplateColumns = `repeat(${c},1fr)`; grid.style.gridTemplateRows = `repeat(${r},1fr)`; grid.style.aspectRatio = c + '/' + r;
        cards = deck.map((e, i) => {
          const el = H('button', { class: 'mem-card', 'aria-label': 'Card ' + (i + 1), tabindex: i ? -1 : 0, onclick: () => flip(i) }, H('div', { class: 'mem-in' }, H('div', { class: 'mem-b', text: '?' }), H('div', { class: 'mem-f', text: e })));
          grid.append(el); return { e, el, up: false, done: false };
        });
        ov.classList.add('hidden'); stats(); fit();
      }
      function flip(i) {
        const k = cards[i]; if (lock || over || paused || k.up || k.done) return;
        startTimer(); k.up = true; k.el.classList.add('up'); flipped.push(i); LX.audio.beep(500 + i * 4, 0.04, 'triangle', 0.05);
        if (flipped.length === 2) {
          moves++; sMoves.textContent = moves; const [a, b] = flipped.map((x) => cards[x]);
          if (a.e === b.e) {
            a.done = b.done = true; matched += 2; flipped = []; setTimeout(() => { a.el.classList.add('done'); b.el.classList.add('done'); LX.audio.beep(780, 0.1, 'sine', 0.08); }, 300);
            if (matched === cards.length) win_();
          } else {
            lock = true; setTimeout(() => { a.up = b.up = false; a.el.classList.remove('up'); b.el.classList.remove('up'); flipped = []; lock = false; }, 800);
          }
        }
      }
      function win_() {
        over = true; stopTimer(); const b = best[lv], nb = !b || moves < b.moves || (moves === b.moves && secs < b.time);
        if (nb) { best[lv] = { moves, time: secs }; LX.store.set('app.memory.best', best); }
        stats();
        setTimeout(() => { ov.innerHTML = ''; ov.classList.remove('hidden'); ov.append(H('h2', { text: 'You win!' }), H('p', { text: moves + ' moves in ' + fmt(secs) + (nb ? ' - new best!' : '') }), H('button', { class: 'btn primary', text: 'Play again', onclick: () => { newGame(); body.focus(); } })); LX.audio.beep(880, 0.25, 'sine', 0.1); }, 700);
      }
      function fit() {
        const { c, r } = LV[lv], aw = stage.clientWidth - 20, ah = stage.clientHeight - 20; if (aw <= 0 || ah <= 0) return;
        const w = Math.min(640, aw, ah * c / r); grid.style.width = w + 'px'; grid.style.height = w * r / c + 'px';
        grid.style.setProperty('--ms', Math.min(w / c, (w * r / c) / r) + 'px');
      }
      function setFocus(i) { const { c, r } = LV[lv]; focus = (i + c * r) % (c * r); cards.forEach((k, j) => (k.el.tabIndex = j === focus ? 0 : -1)); cards[focus].el.focus(); }
      body.addEventListener('keydown', (e) => {
        if (/SELECT/.test(e.target.tagName)) return; const { c } = LV[lv], k = e.key.toLowerCase();
        const cur = cards.findIndex((x) => x.el === document.activeElement); if (cur >= 0) focus = cur;
        if (k === 'arrowright') setFocus(focus + 1); else if (k === 'arrowleft') setFocus(focus - 1); else if (k === 'arrowdown') setFocus(focus + c); else if (k === 'arrowup') setFocus(focus - c);
        else if (k === 'n') newGame(); else return;
        e.preventDefault();
      });
      const ro = new ResizeObserver(fit); ro.observe(stage);
      win.on('blur', () => { if (started && !over && timer) { stopTimer(); paused = true; started = false; ov.innerHTML = ''; ov.classList.remove('hidden'); ov.append(H('h2', { text: 'Paused' }), H('button', { class: 'btn primary', text: 'Resume', onclick: () => { paused = false; ov.classList.add('hidden'); startTimer(); body.focus(); } })); } });
      win.onClose(() => { stopTimer(); ro.disconnect(); });
      win.setMenu([{ label: 'Game', items: [{ label: 'New game', shortcut: 'N', action: newGame }, { separator: true },
        ...Object.keys(LV).map((k) => ({ label: LV[k].name, action: () => { lv = sel.value = k; LX.store.set('app.memory.level', lv); newGame(); } })),
        { separator: true }, { label: 'Reset best scores', action: () => { best = {}; LX.store.set('app.memory.best', best); stats(); } }, { label: 'Close', action: () => win.close() }] }]);
      newGame(); setTimeout(() => body.focus(), 50);
    },
  });
})();
