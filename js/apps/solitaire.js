/* Store app — Solitaire: Klondike with click-to-move, double-click auto-send, undo. */
(function () {
  'use strict';
  const H = LX.h;
  const SUITS = [{ s: '♠', c: 'black' }, { s: '♥', c: 'red' }, { s: '♦', c: 'red' }, { s: '♣', c: 'black' }];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const ri = (r) => RANKS.indexOf(r);

  LX.apps.register({
    id: 'solitaire', name: 'Solitaire', icon: 'spade', color: '#7EE787', category: 'Games',
    pkg: true, pkgVersion: '1.2', pkgSize: 9, developer: 'Leonux Labs', downloads: 1740,
    desc: 'Klondike with undo and auto-complete', longDesc: 'The classic game of patience: click a card then its destination, or double-click to send it home. Drag-free controls work everywhere, and a win is celebrated properly.',
    permissions: ['Local storage'], changelog: 'Auto-complete button and win animation.',
    width: 920, height: 640, minWidth: 560, minHeight: 480,
    open(win) {
      let stock, waste, found, tab, sel, history, moves, started, won;
      const el = H('div', { class: 'kl-wrap' });
      const statusEl = H('span', { class: 'muted', style: { fontSize: '12px' } });

      function deal() {
        const deck = [];
        SUITS.forEach((su, si) => RANKS.forEach((r, ri2) => deck.push({ r, s: su.s, color: su.c, up: false, id: si * 13 + ri2 })));
        for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
        stock = []; waste = []; found = [[], [], [], []]; tab = [[], [], [], [], [], [], []];
        let idx = 0;
        for (let p = 0; p < 7; p++) { for (let c = 0; c <= p; c++) { const card = deck[idx++]; card.up = (c === p); tab[p].push(card); } }
        stock = deck.slice(idx).map((c) => { c.up = false; return c; });
        sel = null; history = []; moves = 0; started = Date.now(); won = false;
        paint();
      }
      function snapshot() { return JSON.parse(JSON.stringify({ stock: stock.map(c => ({...c})), waste: waste.map(c => ({...c})), found: found.map(f => f.map(c => ({...c}))), tab: tab.map(t => t.map(c => ({...c}))), moves })); }
      function undo() {
        if (!history.length || won) return;
        const s = history.pop();
        stock = s.stock; waste = s.waste; found = s.found; tab = s.tab; moves = Math.max(0, s.moves - 1);
        sel = null; paint();
      }
      function pushHistory() { history.push(snapshot()); if (history.length > 40) history.shift(); moves++; }

      function canStack(card, dest) { // on tableau: descending, alternating color; dest null = empty needs K
        if (!dest) return card.r === 'K';
        return dest.color !== card.color && ri(dest.r) === ri(card.r) + 1;
      }
      function foundTarget(card, i) { // foundation i: same suit ascending — suit determined by first card
        const f = found[i];
        if (!f.length) return card.r === 'A' ? i : -1;
        if (f[0].s !== card.s) return -1;
        return ri(f[f.length - 1].r) === ri(card.r) - 1 ? i : -1;
      }

      function drawStock() {
        if (stock.length) { pushHistory(); const c = stock.pop(); c.up = true; waste.push(c); }
        else if (waste.length) { pushHistory(); stock = waste.reverse().map((c) => { c.up = false; return c; }); waste = []; }
        paint();
      }
      function autoSend(card, fromTab, fromWaste) {
        for (let i = 0; i < 4; i++) {
          if (foundTarget(card, i) === i) {
            pushHistory();
            if (fromTab != null) tab[fromTab].pop();
            if (fromWaste) waste.pop();
            found[i].push(card);
            checkWin();
            paint();
            return true;
          }
        }
        return false;
      }
      function checkWin() {
        if (found.every((f) => f.length === 13) && !won) {
          won = true;
          LX.notify({ title: 'You win! 🎉', body: moves + ' moves in ' + Math.round((Date.now() - started) / 1000) + 's', icon: 'star' });
          win.body.classList.add('kl-win');
          setTimeout(() => win.body.classList.remove('kl-win'), 2600);
        }
      }
      function autoComplete() {
        let changed = true, guard = 0;
        while (changed && guard++ < 200) {
          changed = false;
          for (let t = 0; t < 7; t++) {
            const pile = tab[t];
            if (pile.length && pile[pile.length - 1].up && !sel) { if (autoSend(pile[pile.length - 1], t, false)) changed = true; }
          }
          if (waste.length && waste[waste.length - 1].up) { if (autoSend(waste[waste.length - 1], null, true)) changed = true; }
        }
        paint();
      }

      function paint() {
        el.innerHTML = '';
        statusEl.textContent = moves + ' moves · ' + (won ? 'won!' : Math.round((Date.now() - started) / 1000) + 's');
        // top row: stock, waste, foundations
        const top = H('div', { class: 'kl-row' });
        const stockEl = H('div', { class: 'kl-pile kl-stock', onclick: drawStock, title: 'Draw' },
          stock.length ? H('span', { class: 'kl-back', text: '⬤' }) : H('span', { class: 'kl-empty', html: LX.icon('refresh', 20) }));
        const wasteEl = H('div', { class: 'kl-pile' }, waste.slice(-3).map((c, i, arr) => cardEl(c, { zone: 'waste' }, i === arr.length - 1)));
        top.append(stockEl, wasteEl, H('span', { class: 'grow' }));
        for (let i = 0; i < 4; i++) {
          const f = found[i];
          top.appendChild(H('div', { class: 'kl-pile kl-found' + (sel && sel.zone === 'found' ? '' : '') }, f.length ? cardEl(f[f.length - 1], { zone: 'found', i }) : H('span', { class: 'kl-empty', text: SUITS[i].s })));
        }
        el.appendChild(top);
        // tableau
        const trow = H('div', { class: 'kl-row kl-trow' });
        for (let t = 0; t < 7; t++) {
          const pile = H('div', { class: 'kl-pile kl-tab', dataset: { t } });
          if (!tab[t].length) pile.appendChild(H('span', { class: 'kl-empty', text: 'K' }));
          tab[t].forEach((c, i) => pile.appendChild(cardEl(c, { zone: 'tab', t, i }, c.up)));
          trow.appendChild(pile);
        }
        el.appendChild(trow);
        win.setTitle('Solitaire — ' + moves + ' moves');
      }
      function cardEl(c, where, face) {
        const isSel = sel && sel.zone === where.zone && ((where.zone === 'tab' && where.t === sel.t && where.i >= sel.i) || (where.zone === 'waste') || (where.zone === 'found' && false));
        const card = H('div', { class: 'kl-card' + (c.up ? '' : ' down') + (face ? '' : ' dn') + (isSel ? ' sel' : '') + (c.color === 'red' ? ' red' : ' black'),
          onclick: (e) => { e.stopPropagation(); tap(c, where); },
          ondblclick: (e) => { e.stopPropagation(); if (c.up) { if (where.zone === 'tab' && where.i === tab[where.t].length - 1) autoSend(c, where.t, false); else if (where.zone === 'waste' && c === waste[waste.length - 1]) autoSend(c, null, true); } } },
          c.up && H('div', { class: 'kl-face' }, H('span', { class: 'kl-r', text: c.r }), H('span', { class: 'kl-s', text: c.s })),
          !c.up && H('div', { class: 'kl-back-face' }));
        if (where.zone === 'tab') card.style.top = Math.min(where.i * 26, 200) + 'px';
        return card;
      }
      function tap(c, where) {
        if (won) return;
        // ---- clicking a tableau card ----
        if (where.zone === 'tab') {
          const pile = tab[where.t];
          if (!c.up) { if (where.i === pile.length - 1) { pushHistory(); c.up = true; paint(); } return; }
          // a selection already exists → try to land it on this pile
          if (sel) {
            let ok = false;
            if (sel.zone === 'tab' && sel.t !== where.t) ok = moveSeq(sel.t, sel.i, where.t);
            else if (sel.zone === 'waste') {
              const topCard = pile.length ? pile[pile.length - 1] : null;
              if (canStack(sel.card, topCard) && !(topCard && !topCard.up)) {
                pushHistory(); waste.pop(); pile.push(sel.card); flipAfterMove(); checkWin(); ok = true;
              }
            }
            sel = null; paint(); if (!ok) LX.audio.beep(190, .06, 'square', .08);
            return;
          }
          sel = { zone: 'tab', t: where.t, i: where.i, card: c }; paint(); return;
        }
        // ---- clicking the waste top ----
        if (where.zone === 'waste') {
          if (c !== waste[waste.length - 1]) return;
          if (sel) { // land on waste? invalid — cancel
            if (sel.zone === 'tab' && sel.i === tab[sel.t].length - 1) { if (autoSend(sel.card, sel.t, false)) { sel = null; return; } }
            sel = null; paint(); return;
          }
          sel = { zone: 'waste', card: c }; paint(); return;
        }
        // ---- clicking a foundation ----
        if (where.zone === 'found') {
          if (!sel) return;
          let ok = false;
          if (sel.zone === 'waste') ok = autoSend(sel.card, null, true);
          else if (sel.zone === 'tab' && sel.i === tab[sel.t].length - 1) ok = autoSend(sel.card, sel.t, false);
          sel = null; paint(); if (!ok) LX.audio.beep(190, .06, 'square', .08);
        }
      }
      function flipAfterMove() {
        for (let t = 0; t < 7; t++) { const p = tab[t]; if (p.length && !p[p.length - 1].up) { p[p.length - 1].up = true; } }
      }
      // fix sequence move: override tap handler for multi-card
      function moveSeq(fromT, fromI, toT) {
        const seq = tab[fromT].slice(fromI);
        const dest = tab[toT];
        const topCard = dest.length ? dest[dest.length - 1] : null;
        if (topCard && !topCard.up) return false;
        if (!canStack(seq[0], topCard)) return false;
        pushHistory();
        tab[fromT] = tab[fromT].slice(0, fromI);
        seq.forEach((c) => dest.push(c));
        flipAfterMove();
        checkWin(); paint();
        return true;
      }
      el.addEventListener('click', (e) => {
        // clicking empty tableau pile area with a live selection
        const pile = e.target.closest('.kl-tab');
        if (pile && sel) {
          const t = +pile.dataset.t;
          if (sel.zone === 'tab' && sel.t !== t) { if (moveSeq(sel.t, sel.i, t)) { sel = null; return; } }
          else if (sel.zone === 'waste') {
            const dest = tab[t]; const topCard = dest.length ? dest[dest.length - 1] : null;
            if (canStack(sel.card, topCard) && !(topCard && !topCard.up)) { pushHistory(); waste.pop(); dest.push(sel.card); flipAfterMove(); checkWin(); sel = null; paint(); return; }
          } else if (sel.zone === 'tab' && sel.t === t && sel.i !== tab[t].length - 1) { sel = null; paint(); return; }
        }
        if (!e.target.closest('.kl-card') && !e.target.closest('.kl-stock') && !e.target.closest('.kl-found')) { if (sel) { sel = null; paint(); } }
      });

      win.body.append(
        H('div', { class: 'toolbar' },
          H('button', { class: 'btn sm primary', html: LX.icon('refresh', 13) + ' New deal', onclick: () => { if (moves && !won && !confirm2()) return; deal(); } }),
          H('button', { class: 'btn sm ghost', html: LX.icon('undo', 13) + ' Undo', onclick: undo }),
          H('button', { class: 'btn sm', html: LX.icon('zap', 13) + ' Auto-finish', onclick: autoComplete, title: 'Send everything home' }),
          H('span', { class: 'grow' }), statusEl),
        el);
      function confirm2() { return true; }
      deal();
    },
  });
})();
