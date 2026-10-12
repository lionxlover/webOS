/* Store app — Chess: full rules engine + minimax AI. Castling, en passant,
   promotion, check/checkmate/stalemate detection. Play vs friend or vs Leonux. */
(function () {
  'use strict';
  const H = LX.h;
  const UNICODE = { wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙', bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟' };
  const VAL = { p: 100, n: 305, b: 320, r: 500, q: 900, k: 20000 };
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

  function parseFen(fen) {
    const grid = [];
    fen.split('/').forEach((row) => {
      const r = [];
      for (const ch of row) { if (/\d/.test(ch)) { for (let i = 0; i < +ch; i++) r.push(null); } else r.push(ch); }
      grid.push(r);
    });
    return grid;
  }
  function toFen(grid) {
    return grid.map((row) => {
      let s = '', run = 0;
      row.forEach((c) => { if (!c) run++; else { if (run) s += run; run = 0; s += c; } });
      if (run) s += run;
      return s;
    }).join('/');
  }
  const isW = (c) => c && c === c.toUpperCase();
  const colorOf = (c) => !c ? null : (isW(c) ? 'w' : 'b');
  const kindOf = (c) => c ? c.toLowerCase() : null;

  LX.apps.register({
    id: 'chess', name: 'Chess', icon: 'crown', color: '#E0AF68', category: 'Games',
    pkg: true, pkgVersion: '1.4', pkgSize: 12, developer: 'Leonux Labs', downloads: 1560,
    desc: 'Classic chess against a friendly engine', longDesc: 'A complete chess engine: legal moves with castling, en passant and promotion, check and mate detection, undo, move list — plus a minimax opponent with three strength levels.',
    permissions: ['Local storage'], changelog: 'Smarter engine, cleaner board theme.',
    width: 880, height: 620, minWidth: 560, minHeight: 460,
    open(win) {
      let grid = parseFen(START);
      let turn = 'w', sel = null, legal = [], lastMove = null, over = null, promote = null;
      let castle = { wk: true, wq: true, bk: true, bq: true };
      let epTarget = null;
      let vsAI = true, level = 2, aiColor = 'b';
      let history = [];
      const boardEl = H('div', { class: 'ch-board' });
      const statusEl = H('div', { class: 'ch-status' });
      const moveList = H('div', { class: 'ch-moves scroll' });

      const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
      function sq(r, c) { return grid[r][c]; }

      function pseudoMoves(r, c, noCastling) {
        const piece = sq(r, c); if (!piece) return [];
        const col = colorOf(piece), k = kindOf(piece);
        const out = [];
        const push = (rr, cc, flag) => { if (inside(rr, cc) && (colorOf(sq(rr, cc)) !== col)) out.push({ r: rr, c: cc, flag }); };
        if (k === 'p') {
          const dir = col === 'w' ? -1 : 1;
          const startRow = col === 'w' ? 6 : 1;
          if (inside(r + dir, c) && !sq(r + dir, c)) {
            out.push({ r: r + dir, c, flag: r + dir === (col === 'w' ? 0 : 7) ? 'promote' : null });
            if (r === startRow && !sq(r + 2 * dir, c)) out.push({ r: r + 2 * dir, c, flag: 'dbl' });
          }
          [[dir, -1], [dir, 1]].forEach(([dr, dc]) => {
            const rr = r + dr, cc = c + dc;
            if (!inside(rr, cc)) return;
            const target = sq(rr, cc);
            if (target && colorOf(target) !== col) out.push({ r: rr, c: cc, flag: rr === (col === 'w' ? 0 : 7) ? 'promote' : null });
            if (!target && epTarget && epTarget.r === rr && epTarget.c === cc) out.push({ r: rr, c: cc, flag: 'ep' });
          });
        } else if (k === 'n') {
          [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([dr, dc]) => push(r + dr, c + dc));
        } else if (k === 'k') {
          [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => push(r + dr, c + dc));
          // castling
          if (noCastling !== true) {
          const row = col === 'w' ? 7 : 0;
          if (r === row && c === 4) {
            const ks = castle[col === 'w' ? 'wk' : 'bk'];
            const qs = castle[col === 'w' ? 'wq' : 'bq'];
            if (ks && !sq(row, 5) && !sq(row, 6) && sq(row, 7) && kindOf(sq(row, 7)) === 'r' && colorOf(sq(row, 7)) === col
              && !attacked(row, 4, col === 'w' ? 'b' : 'w') && !attacked(row, 5, col === 'w' ? 'b' : 'w') && !attacked(row, 6, col === 'w' ? 'b' : 'w')) out.push({ r: row, c: 6, flag: 'castleK' });
            if (qs && !sq(row, 3) && !sq(row, 2) && !sq(row, 1) && sq(row, 0) && kindOf(sq(row, 0)) === 'r' && colorOf(sq(row, 0)) === col
              && !attacked(row, 4, col === 'w' ? 'b' : 'w') && !attacked(row, 3, col === 'w' ? 'b' : 'w') && !attacked(row, 2, col === 'w' ? 'b' : 'w')) out.push({ r: row, c: 2, flag: 'castleQ' });
          }
          }
        } else {
          const rays = k === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : k === 'b' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
          rays.forEach(([dr, dc]) => {
            let rr = r + dr, cc = c + dc;
            while (inside(rr, cc)) {
              const t = sq(rr, cc);
              if (!t) out.push({ r: rr, c: cc });
              else { if (colorOf(t) !== col) out.push({ r: rr, c: cc }); break; }
              rr += dr; cc += dc;
            }
          });
        }
        return out;
      }
      function attacked(r, c, byCol) {
        for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++) {
          const p = sq(rr, cc);
          if (p && colorOf(p) === byCol) {
            const ms = pseudoMoves(rr, cc, true);
            if (ms.some((m) => m.r === r && m.c === c)) return true;
          }
        }
        return false;
      }
      function kingPos(col) {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = sq(r, c); if (p && kindOf(p) === 'k' && colorOf(p) === col) return { r, c }; }
        return null;
      }
      function inCheck(col) {
        const kp = kingPos(col); if (!kp) return false;
        return attacked(kp.r, kp.c, col === 'w' ? 'b' : 'w');
      }
      function legalMoves(r, c) {
        const piece = sq(r, c); if (!piece) return [];
        const col = colorOf(piece);
        return pseudoMoves(r, c).filter((m) => {
          const snap = snapshot();
          applyMove(r, c, m, 'q'); // promote default for test
          const bad = inCheck(col);
          restore(snap);
          return !bad;
        });
      }
      function snapshot() { return { grid: JSON.parse(JSON.stringify(grid)), castle: { ...castle }, ep: epTarget, last: lastMove, turn }; }
      function restore(s) { grid = s.grid; castle = s.castle; epTarget = s.ep; lastMove = s.last; if (s.turn != null) turn = s.turn; }

      function applyMove(r, c, m, promoPiece) {
        const piece = sq(r, c);
        const col = colorOf(piece);
        const k = kindOf(piece);
        // track rook/king moves for castling
        if (k === 'k') { castle[col + 'k'] = false; castle[col + 'q'] = false; }
        if (r === 7 && c === 0) castle.wq = false;
        if (r === 7 && c === 7) castle.wk = false;
        if (r === 0 && c === 0) castle.bq = false;
        if (r === 0 && c === 7) castle.bk = false;
        grid[m.r][m.c] = piece;
        grid[r][c] = null;
        if (m.flag === 'ep') grid[r][c] = null; // captured pawn sits on from-row
        if (m.flag === 'promote') grid[m.r][m.c] = col === 'w' ? (promoPiece || 'q').toUpperCase() : (promoPiece || 'q');
        if (m.flag === 'castleK') { const row = m.r; grid[row][5] = grid[row][7]; grid[row][7] = null; }
        if (m.flag === 'castleQ') { const row = m.r; grid[row][3] = grid[row][0]; grid[row][0] = null; }
        epTarget = m.flag === 'dbl' ? { r: (r + m.r) / 2, c } : null;
        lastMove = { from: { r, c }, to: { r: m.r, c: m.c } };
        turn = col === 'w' ? 'b' : 'w';
      }

      // ---- AI ----
      function evaluate() {
        let score = 0;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
          const p = sq(r, c); if (!p) continue;
          const col = colorOf(p), k = kindOf(p);
          let v = VAL[k];
          // mild centrality bonus
          v += (3.5 - Math.abs(3.5 - c)) * 3 + (3.5 - Math.abs(3.5 - r)) * 2;
          if (k === 'p') v += (col === 'w' ? 6 - r : r - 1) * 6; // advance bonus
          score += col === 'w' ? v : -v;
        }
        return score;
      }
      function allMoves(col) {
        const out = [];
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
          const p = sq(r, c);
          if (p && colorOf(p) === col) legalMoves(r, c).forEach((m) => out.push({ r, c, m }));
        }
        return out;
      }
      function search(depth, alpha, beta, forCol) {
        if (depth === 0) return forCol === 'w' ? evaluate() : -evaluate();
        const moves = allMoves(forCol);
        if (!moves.length) return forCol === 'w' ? evaluate() : -evaluate();
        // order: captures first
        moves.sort((a, b) => (sq(b.m.r, b.m.c) ? VAL[kindOf(sq(b.m.r, b.m.c))] || 0 : 0) - (sq(a.m.r, a.m.c) ? VAL[kindOf(sq(a.m.r, a.m.c))] || 0 : 0));
        let best = -1e9;
        for (const mv of moves) {
          const snap = snapshot();
          applyMove(mv.r, mv.c, mv.m, 'q');
          const sc = -search(depth - 1, -beta, -alpha, forCol === 'w' ? 'b' : 'w');
          restore(snap);
          if (sc > best) best = sc;
          if (best > alpha) alpha = best;
          if (alpha >= beta) break;
        }
        return best;
      }
      function aiMove() {
        const depth = level === 1 ? 1 : level === 2 ? 2 : 3;
        const moves = allMoves(aiColor);
        if (!moves.length) return;
        let best = null, bestScore = -1e9;
        moves.forEach((mv) => {
          const snap = snapshot();
          applyMove(mv.r, mv.c, mv.m, 'q');
          let sc;
          try { sc = -search(depth - 1, -1e9, 1e9, aiColor === 'w' ? 'b' : 'w'); }
          catch (e) { sc = 0; }
          restore(snap);
          sc += Math.random() * (level === 3 ? 2 : 26); // lower levels: more noise
          if (sc > bestScore) { bestScore = sc; best = mv; }
        });
        if (best) doMove(best.r, best.c, best.m);
      }

      function doMove(r, c, m) {
        const piece = sq(r, c);
        history.push(snapshot());
        const target = sq(m.r, m.c);
        const sAN = an(r, c) + (target ? '×' : '') + an(m.r, m.c);
        if (m.flag === 'promote') {
          // auto-queen (with future dialog)
          applyMove(r, c, m, 'q');
        } else applyMove(r, c, m);
        // game end check
        const next = allMoves(turn);
        const chk = inCheck(turn);
        if (!next.length) { over = chk ? (turn === 'w' ? 'black' : 'white') + ' wins by checkmate' : 'draw — stalemate'; }
        else if (chk) over = null;
        sel = null; legal = [];
        paint();
        moveList.appendChild(H('div', { class: 'ch-mv', html: '<span class="muted">' + (colorOf(piece) === 'w' ? '·' : '') + '</span> ' + LX.escape(sAN) + (chk && !over ? ' +' : '') }));
        moveList.scrollTop = moveList.scrollHeight;
        if (over) {
          LX.notify({ title: 'Game over', body: over, icon: 'crown' });
          statusEl.textContent = over + ' — ' + 'press New game';
        } else if (vsAI && turn === aiColor) {
          statusEl.textContent = 'Leonux is thinking…';
          setTimeout(() => { if (!over) aiMove(); }, 420);
        }
      }
      const an = (r, c) => 'abcdefgh'[c] + (8 - r);

      function paint() {
        boardEl.innerHTML = '';
        statusEl.innerHTML = '';
        const chk = inCheck(turn);
        statusEl.append(H('b', { text: over ? 'Game over' : (turn === 'w' ? 'White' : 'Black') + ' to move' + (chk ? ' — check!' : '') }),
          H('span', { class: 'muted', style: { fontSize: '12px' }, text: ' · ' + (vsAI ? 'vs engine (level ' + level + ')' : '2 players') }));
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const piece = sq(r, c);
            const dark = (r + c) % 2;
            const isSel = sel && sel.r === r && sel.c === c;
            const isLegal = legal.some((m) => m.r === r && m.c === c);
            const isLast = lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c));
            const isKing = piece && kindOf(piece) === 'k' && colorOf(piece) === turn && chk;
            const cell = H('div', { class: 'ch-sq' + (dark ? ' dark' : '') + (isSel ? ' sel' : '') + (isLast ? ' last' : '') + (isKing ? ' chk' : ''),
              dataset: { r, c },
              onclick: () => tap(r, c) },
              piece ? H('span', { class: 'ch-p ' + (colorOf(piece) === 'w' ? 'white' : 'black'), text: UNICODE[(colorOf(piece) === 'w' ? 'w' : 'b') + kindOf(piece)] }) : null,
              isLegal ? H('span', { class: 'ch-dot' + (sq(r, c) ? ' take' : '') }) : null,
              H('span', { class: 'ch-co', text: c === 0 ? String(8 - r) : '' }),
              H('span', { class: 'ch-co b', text: r === 7 ? 'abcdefgh'[c] : '' }));
            boardEl.appendChild(cell);
          }
        }
        win.setTitle('Chess — ' + (over || (turn === 'w' ? 'white' : 'black') + ' to move'));
      }
      function tap(r, c) {
        if (over) return;
        if (vsAI && turn === aiColor) return;
        const piece = sq(r, c);
        if (sel && legal.some((m) => m.r === r && m.c === c)) { doMove(sel.r, sel.c, legal.find((m) => m.r === r && m.c === c)); return; }
        if (piece && colorOf(piece) === turn) {
          if (sel && sel.r === r && sel.c === c) { sel = null; legal = []; } 
          else { sel = { r, c }; legal = legalMoves(r, c); }
        } else { sel = null; legal = []; }
        paint();
      }
      function newGame() {
        grid = parseFen(START); turn = 'w'; sel = null; legal = []; lastMove = null; over = null;
        castle = { wk: true, wq: true, bk: true, bq: true }; epTarget = null; history = [];
        moveList.innerHTML = '';
        paint();
      }
      function undo() {
        if (!history.length) return;
        const s = history.pop();
        restore(s);
        // restore one more if vs AI (undo pair)
        if (vsAI && history.length && turn === aiColor) { const s2 = history.pop(); restore(s2); }
        over = null; sel = null; legal = [];
        moveList.appendChild(H('div', { class: 'ch-mv muted', text: '— undo —' }));
        paint();
      }

      const modeBtn = H('button', { class: 'btn sm', text: vsAI ? 'Vs engine' : '2 players', onclick: () => { vsAI = !vsAI; modeBtn.textContent = vsAI ? 'Vs engine' : '2 players'; if (vsAI && turn === aiColor && !over) setTimeout(aiMove, 300); } });
      const lvlSel = H('select', { class: 'select', style: { width: 'auto' }, onchange: () => { level = +lvlSel.value; } },
        [1, 2, 3].map((l) => H('option', { value: l, selected: l === level, text: ['Easy', 'Medium', 'Sharp'][l - 1] })));
      win.body.append(
        H('div', { class: 'toolbar' },
          H('button', { class: 'btn sm primary', html: LX.icon('refresh', 13) + ' New game', onclick: newGame }),
          H('button', { class: 'btn sm ghost', html: LX.icon('undo', 13) + ' Undo', onclick: undo }),
          modeBtn, H('span', { class: 'muted', style: { fontSize: '11px' }, text: 'engine' }), lvlSel,
          H('span', { class: 'grow' }), statusEl),
        H('div', { class: 'ch-wrap' }, boardEl, H('div', { class: 'ch-side' }, H('div', { class: 'ch-side-h', text: 'Moves' }), moveList)));
      newGame();
    },
  });
})();
