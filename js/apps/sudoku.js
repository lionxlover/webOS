/* Leonux Web OS — Sudoku (generator w/ unique solution, difficulty, notes, hints, conflicts, undo, timer) */
(function () {
  'use strict';
  const CLUES = { easy: 40, medium: 32, hard: 26 }, SAVE = 'app.sudoku.state';
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = LX.rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function ok(g, i, v) {
    const r = (i / 9) | 0, c = i % 9, br = r - r % 3, bc = c - c % 3;
    for (let k = 0; k < 9; k++) if (g[r * 9 + k] === v || g[k * 9 + c] === v || g[(br + ((k / 3) | 0)) * 9 + bc + k % 3] === v) return false;
    return true;
  }
  function fill(g) {
    const i = g.indexOf(0); if (i < 0) return true;
    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) if (ok(g, i, v)) { g[i] = v; if (fill(g)) return true; g[i] = 0; }
    return false;
  }
  function count(g, lim) {
    let best = -1, bc = 10, cand = null;
    for (let i = 0; i < 81; i++) if (!g[i]) { const cs = []; for (let v = 1; v <= 9; v++) if (ok(g, i, v)) cs.push(v); if (cs.length < bc) { bc = cs.length; best = i; cand = cs; if (bc <= 1) break; } }
    if (best < 0) return 1; let n = 0;
    for (const v of cand) { g[best] = v; n += count(g, lim - n); g[best] = 0; if (n >= lim) break; }
    return n;
  }
  function generate(diff) {
    const sol = Array(81).fill(0); fill(sol); const puz = sol.slice(); let clues = 81;
    for (const i of shuffle([...Array(81).keys()])) {
      if (clues <= CLUES[diff]) break; const v = puz[i]; puz[i] = 0;
      if (count(puz.slice(), 2) !== 1) puz[i] = v; else clues--;
    }
    return { sol, puz };
  }
  LX.apps.register({
    id: 'sudoku', name: 'Sudoku', icon: 'hash', color: '#5B9DFA', category: 'Games', desc: 'Sudoku with notes, hints and three difficulty levels',
    width: 700, height: 640, minWidth: 360, minHeight: 460,
    open(win) {
      const H = LX.h, body = win.body; body.tabIndex = 0;
      let diff = LX.store.get('app.sudoku.diff', 'medium'); if (!CLUES[diff]) diff = 'medium';
      let best = LX.store.get('app.sudoku.best', {}) || {};
      let sol, given, vals, notes, sel = 40, notesMode = false, history = [], secs = 0, timer = 0, hints = 0, done = false, errors = 0;
      const sTime = H('b', { text: '0:00' }), sBest = H('b', { text: '-' }), sHints = H('b', { text: '0' });
      const board = H('div', { class: 'sd-board' }), cells = [];
      for (let i = 0; i < 81; i++) { const r = (i / 9) | 0, c = i % 9; const el = H('div', { class: 'sd-c' + (r % 3 === 2 && r < 8 ? ' r' + r : '') + (c % 3 === 2 && c < 8 ? ' c' + c : ''), onclick: () => { select(i); body.focus(); } }); cells.push(el); board.append(el); }
      const ov = H('div', { class: 'g-ov hidden' });
      const sdSel = H('select', { class: 'select', onchange: () => { diff = sdSel.value; LX.store.set('app.sudoku.diff', diff); newGame(); body.focus(); } }, ['easy', 'medium', 'hard'].map((k) => H('option', { value: k, text: k[0].toUpperCase() + k.slice(1), selected: k === diff })));
      const numBtns = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => H('button', { class: 'btn', text: n, onclick: () => { enter(n); body.focus(); } }));
      const notesBtn = H('button', { class: 'btn wide', html: LX.icon('pencil', 14) + ' Notes: off', onclick: () => { toggleNotes(); body.focus(); } });
      const pad = H('div', { class: 'sd-pad' }, numBtns, notesBtn,
        H('button', { class: 'btn wide', html: LX.icon('eraser', 14) + ' Erase', onclick: () => { enter(0); body.focus(); } }),
        H('button', { class: 'btn wide', html: LX.icon('undo', 14) + ' Undo', onclick: () => { undo(); body.focus(); } }),
        H('button', { class: 'btn wide', html: LX.icon('zap', 14) + ' Hint', onclick: () => { hint(); body.focus(); } }));
      const stage = H('div', { class: 'g-stage' }, H('div', { class: 'sd-main' }, board, pad), ov);
      body.append(H('div', { class: 'g-bar' }, H('div', { class: 'g-stat' }, H('small', { text: 'Time' }), sTime), H('div', { class: 'g-stat' }, H('small', { text: 'Hints' }), sHints), H('div', { class: 'g-stat' }, H('small', { text: 'Best' }), sBest), H('div', { class: 'grow' }), sdSel,
        H('button', { class: 'btn sm primary', text: 'New game', onclick: () => { newGame(); body.focus(); } })), stage);

      const fmt = (s) => Math.floor(s / 60) + ':' + LX.pad(s % 60);
      const stopTimer = () => { clearInterval(timer); timer = 0; };
      function startTimer() { stopTimer(); timer = setInterval(() => { secs++; sTime.textContent = fmt(secs); if (secs % 10 === 0) save(); }, 1000); }
      function save() { if (sol && !done) LX.store.set(SAVE, { diff, sol, given, vals, notes: notes.map((n) => n.join('')), secs, hints }); else LX.store.remove(SAVE); }
      function stats() { sTime.textContent = fmt(secs); sHints.textContent = hints; sBest.textContent = best[diff] ? fmt(best[diff]) : '-'; }
      function setGame(sol_, puz, v, n) {
        sol = sol_; given = puz; vals = v; notes = n; history = []; done = false; sel = vals.findIndex((x) => !x); if (sel < 0) sel = 40;
        ov.classList.add('hidden'); stats(); render(); startTimer();
      }
      function newGame() {
        stopTimer(); ov.innerHTML = ''; ov.classList.remove('hidden'); ov.append(H('h2', { text: 'Generating...' }));
        setTimeout(() => { const { sol: s, puz } = generate(diff); secs = 0; hints = 0; setGame(s, puz, puz.slice(), Array.from({ length: 81 }, () => [])); save(); }, 30);
      }
      function conflict(i) { const v = vals[i]; if (!v) return false; const r = (i / 9) | 0, c = i % 9, br = r - r % 3, bc = c - c % 3; for (let k = 0; k < 9; k++) { const a = r * 9 + k, b = k * 9 + c, d = (br + ((k / 3) | 0)) * 9 + bc + k % 3; if ((a !== i && vals[a] === v) || (b !== i && vals[b] === v) || (d !== i && vals[d] === v)) return true; } return false; }
      function render() {
        const sr = (sel / 9) | 0, sc = sel % 9, sv = vals[sel];
        cells.forEach((el, i) => {
          const r = (i / 9) | 0, c = i % 9, v = vals[i];
          el.className = el.className.replace(/ (given|peer|same|sel|bad)/g, '');
          if (given[i]) el.classList.add('given');
          if (i === sel) el.classList.add('sel'); else if (sv && v === sv) el.classList.add('same'); else if (r === sr || c === sc || (r - r % 3 === sr - sr % 3 && c - c % 3 === sc - sc % 3)) el.classList.add('peer');
          if (!given[i] && v && conflict(i)) el.classList.add('bad');
          el.innerHTML = '';
          if (v) el.textContent = v;
          else if (notes[i].length) el.append(H('div', { class: 'sd-notes' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => H('span', { text: notes[i].includes(n) ? n : '' }))));
        });
        numBtns.forEach((b, k) => { const cnt = vals.filter((x) => x === k + 1).length; b.disabled = cnt >= 9; });
      }
      function select(i) { sel = LX.clamp(i, 0, 80); render(); }
      function pushHist() { history.push({ vals: vals.slice(), notes: notes.map((n) => n.slice()) }); if (history.length > 200) history.shift(); }
      function enter(n) {
        if (done || !sol || given[sel]) return;
        if (notesMode && n) {
          if (vals[sel]) return; pushHist(); const a = notes[sel], k = a.indexOf(n); k < 0 ? a.push(n) : a.splice(k, 1); a.sort(); render(); save(); return;
        }
        if (vals[sel] === n) return; pushHist(); vals[sel] = n; notes[sel] = [];
        if (n) { const r = (sel / 9) | 0, c = sel % 9; for (let k = 0; k < 9; k++) for (const j of [r * 9 + k, k * 9 + c, (r - r % 3 + ((k / 3) | 0)) * 9 + c - c % 3 + k % 3]) { const x = notes[j].indexOf(n); if (x >= 0) notes[j].splice(x, 1); } if (sol[sel] !== n) LX.audio.beep(160, 0.08, 'square', 0.06); }
        render(); save(); check();
      }
      function hint() {
        if (done || !sol) return; let i = sel;
        if (given[i] || vals[i] === sol[i]) { const bad = vals.map((v, k) => (v !== sol[k] ? k : -1)).filter((k) => k >= 0); if (!bad.length) return; i = LX.pick(bad); }
        pushHist(); sel = i; vals[i] = sol[i]; notes[i] = []; hints++; sHints.textContent = hints; render(); save(); check();
      }
      function undo() { if (done || !history.length) return; const h = history.pop(); vals = h.vals; notes = h.notes; render(); save(); }
      function toggleNotes() { notesMode = !notesMode; notesBtn.innerHTML = LX.icon('pencil', 14) + ' Notes: ' + (notesMode ? 'on' : 'off'); notesBtn.classList.toggle('on', notesMode); }
      function check() {
        if (vals.some((v, i) => v !== sol[i])) return;
        done = true; stopTimer(); LX.store.remove(SAVE); const nb = !hints && (!best[diff] || secs < best[diff]); if (nb) { best[diff] = secs; LX.store.set('app.sudoku.best', best); } stats(); LX.audio.beep(880, 0.25, 'sine', 0.1);
        ov.innerHTML = ''; ov.classList.remove('hidden'); ov.append(H('h2', { text: 'Solved!' }), H('p', { text: fmt(secs) + ' on ' + diff + (hints ? ', ' + hints + ' hint' + (hints > 1 ? 's' : '') : '') + (nb ? ' - new best!' : '') }), H('button', { class: 'btn primary', text: 'New game', onclick: () => { newGame(); body.focus(); } }));
      }
      function fit() {
        const aw = stage.clientWidth - 20, ah = stage.clientHeight - 20, narrow = aw < 520;
        const padW = narrow ? 0 : 184, s = Math.max(180, Math.min(aw - padW, narrow ? ah - 150 : ah, 640)), u = Math.floor(s / 9) * 9;
        board.style.width = board.style.height = u + 'px'; board.style.setProperty('--sz', u / 9 + 'px');
        pad.style.width = narrow ? Math.min(u, 320) + 'px' : '170px'; pad.style.gridTemplateColumns = narrow ? 'repeat(9,1fr)' : 'repeat(3,1fr)';
        LX.$$('.btn', pad).forEach((b) => { b.style.gridColumn = b.classList.contains('wide') ? '1/-1' : ''; b.style.padding = narrow ? '8px 0' : ''; });
      }
      body.addEventListener('keydown', (e) => {
        if (/SELECT|INPUT/.test(e.target.tagName)) return;
        if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); return undo(); }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key; let handled = true, r = (sel / 9) | 0, c = sel % 9;
        if (/^[1-9]$/.test(k)) enter(+k);
        else if (k === 'Backspace' || k === 'Delete' || k === '0') enter(0);
        else if (k === 'ArrowUp') select(((r + 8) % 9) * 9 + c); else if (k === 'ArrowDown') select(((r + 1) % 9) * 9 + c);
        else if (k === 'ArrowLeft') select(r * 9 + (c + 8) % 9); else if (k === 'ArrowRight') select(r * 9 + (c + 1) % 9);
        else if (k.toLowerCase() === 'n' || k === ' ') toggleNotes(); else if (k.toLowerCase() === 'h') hint(); else if (k.toLowerCase() === 'u') undo();
        else handled = false;
        if (handled) e.preventDefault();
      });
      const ro = new ResizeObserver(fit); ro.observe(stage);
      win.on('blur', () => { if (!done && timer && !ov.classList.contains('hidden') === false) { stopTimer(); ov.innerHTML = ''; ov.classList.remove('hidden'); ov.append(H('h2', { text: 'Paused' }), H('p', { text: 'Board hidden while paused' }), H('button', { class: 'btn primary', text: 'Resume', onclick: () => { ov.classList.add('hidden'); startTimer(); body.focus(); } })); } });
      win.onClose(() => { save(); stopTimer(); ro.disconnect(); });
      win.setMenu([{ label: 'Game', items: [{ label: 'New game', action: newGame }, { label: 'Undo', shortcut: 'U', action: undo }, { label: 'Hint', shortcut: 'H', action: hint }, { label: 'Toggle notes', shortcut: 'N', action: toggleNotes }, { separator: true },
        { label: 'Reset best times', action: () => { best = {}; LX.store.set('app.sudoku.best', best); stats(); } }, { label: 'Close', action: () => win.close() }] }]);
      fit();
      const sv = LX.store.get(SAVE, null);
      if (sv && Array.isArray(sv.sol) && sv.sol.length === 81 && Array.isArray(sv.vals) && sv.vals.length === 81 && CLUES[sv.diff]) {
        diff = sdSel.value = sv.diff; secs = +sv.secs || 0; hints = +sv.hints || 0;
        setGame(sv.sol, sv.given, sv.vals, (sv.notes || []).map((s) => String(s).split('').map(Number).filter(Boolean)).concat(Array.from({ length: 81 }, () => [])).slice(0, 81));
      } else newGame();
      setTimeout(() => body.focus(), 50);
    },
  });
})();
