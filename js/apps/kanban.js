/* Store app — Kanban Boards: drag & drop cards across columns, persisted. */
(function () {
  'use strict';
  const H = LX.h;
  const KEY = 'app.kanban.board';
  const COLORS = ['#5B9DFA', '#9ECE6A', '#F6C177', '#F28B82', '#CBA6F7', '#4DD0E1'];

  LX.apps.register({
    id: 'kanban', name: 'Kanban Boards', icon: 'columns', color: '#F6C177', category: 'Productivity',
    pkg: true, pkgVersion: '1.0', pkgSize: 12, developer: 'PrideWorks', downloads: 980,
    desc: 'Drag & drop task boards', longDesc: 'Organize work the visual way: cards flow across Backlog, In Progress and Done columns with drag & drop. Color-tag cards, track completion, and everything is saved automatically.',
    permissions: ['Local storage'], changelog: 'First release.',
    width: 900, height: 580, minWidth: 480, minHeight: 360,
    open(win) {
      let board = LX.store.get(KEY) || seed();
      const save = () => LX.store.set(KEY, board);
      function seed() {
        return {
          title: 'My Project',
          cols: [
            { name: 'Backlog', cards: [{ t: 'Sketch ideas', c: 0 }, { t: 'Research competitors', c: 1 }] },
            { name: 'In progress', cards: [{ t: 'Build the board UI', c: 2 }] },
            { name: 'Done', cards: [{ t: 'Install Leonux', c: 3 }, { t: 'Set up wallpaper', c: 4 }] },
          ],
        };
      }

      const title = H('input', { class: 'kb-title', value: board.title, oninput: () => { board.title = title.value; save(); } });
      const stats = H('div', { class: 'kb-stats' });
      const colsEl = H('div', { class: 'kb-cols scroll' });
      let dragId = null, dragFrom = -1;

      function cardEl(card, ci, idx) {
        const el = H('div', { class: 'kb-card', draggable: 'true', dataset: { id: card.id },
          ondragstart: (e) => { dragId = card.id; dragFrom = ci; e.dataTransfer.effectAllowed = 'move'; el.classList.add('drag'); },
          ondragend: () => { el.classList.remove('drag'); dragId = null; },
          onclick: () => editCard(ci, idx),
          oncontextmenu: (e) => { e.preventDefault(); LX.menu.show(e.clientX, e.clientY, [
            { label: 'Edit', icon: 'edit', action: () => editCard(ci, idx) },
            { label: 'Move right', icon: 'chevron-right', action: () => moveCard(ci, idx, ci + 1) }, ci > 0 && { label: 'Move left', icon: 'chevron-left', action: () => moveCard(ci, idx, ci - 1) },
            { separator: true }, { label: 'Delete', icon: 'trash', danger: true, action: () => { board.cols[ci].cards.splice(idx, 1); save(); paint(); } }].filter(Boolean)); } },
          H('span', { class: 'kb-dot', style: { background: COLORS[card.c % COLORS.length] } }),
          H('span', { class: 'grow', text: card.t }));
        return el;
      }
      function editCard(ci, idx) {
        const card = board.cols[ci].cards[idx];
        LX.dialog.prompt('Card text', card.t, 'Edit card').then((t) => {
          if (t == null) return;
          LX.dialog.custom((box, fin) => {
            const chips = H('div', { class: 'row gap', style: { flexWrap: 'wrap' } }, COLORS.map((c, i) => H('button', { class: 'kb-pick' + (card.c === i ? ' on' : ''), style: { background: c }, onclick: () => { card.c = i; fin(true); } })));
            box.append(H('div', { class: 'dlg-head', text: 'Pick a colour' }), chips, H('div', { class: 'dlg-actions' }, H('button', { class: 'btn ghost', text: 'Skip', onclick: () => fin(false) })));
          });
          if (t.trim() !== card.t) card.t = t.trim();
          save(); paint();
        });
      }
      function moveCard(ci, idx, to) {
        if (to < 0 || to >= board.cols.length) return;
        const [card] = board.cols[ci].cards.splice(idx, 1);
        board.cols[to].cards.unshift(card); save(); paint();
      }
      function colEl(col, ci) {
        const head = H('div', { class: 'kb-col-h' }, H('b', { text: col.name }), H('span', { class: 'badge', text: String(col.cards.length) }));
        const list = H('div', { class: 'kb-list scroll' });
        col.cards.forEach((card, idx) => list.appendChild(cardEl(card, ci, idx)));
        const add = H('button', { class: 'kb-add', html: LX.icon('plus', 14) + ' Add card', onclick: async () => {
          const t = await LX.dialog.prompt('New card', '', 'Add to ' + col.name);
          if (t && t.trim()) { col.cards.push({ id: LX.uid(), t: t.trim(), c: LX.rand(0, COLORS.length - 1) }); save(); paint(); }
        } });
        const el = H('div', { class: 'kb-col', dataset: { ci } }, head, list, add);
        el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
        el.addEventListener('dragleave', () => el.classList.remove('over'));
        el.addEventListener('drop', (e) => {
          e.preventDefault(); el.classList.remove('over'); if (dragId == null) return;
          board.cols.forEach((c, i) => { const j = c.cards.findIndex((x) => x.id === dragId); if (j >= 0 && i !== ci) { const [card] = c.cards.splice(j, 1); board.cols[ci].cards.push(card); } });
          dragId = null; save(); paint();
        });
        return el;
      }
      function paint() {
        colsEl.innerHTML = '';
        board.cols.forEach((col, ci) => colsEl.appendChild(colEl(col, ci)));
        const total = board.cols.reduce((a, c) => a + c.cards.length, 0);
        const done = board.cols[board.cols.length - 1].cards.length;
        stats.innerHTML = '';
        stats.appendChild(H('span', { class: 'muted', text: total + ' cards · ' }));
        stats.appendChild(H('span', { class: 'progress', style: { width: '90px' } }, H('div', { style: { width: (total ? Math.round(done / total * 100) : 0) + '%' } })));
        stats.appendChild(H('span', { class: 'muted', text: ' ' + (total ? Math.round(done / total * 100) : 0) + '% done' }));
        win.setTitle(board.title + ' — Kanban');
      }
      win.body.append(
        H('div', { class: 'toolbar kb-top' }, title, stats, H('span', { class: 'grow' }),
          H('button', { class: 'btn sm', html: LX.icon('plus', 13) + ' Column', onclick: async () => { const n = await LX.dialog.prompt('Column name', 'New column', 'Add column'); if (n && n.trim()) { board.cols.push({ name: n.trim(), cards: [] }); save(); paint(); } } }),
          H('button', { class: 'btn sm ghost', html: LX.icon('trash', 13), title: 'Delete last column', onclick: async () => { if (board.cols.length <= 2) return LX.dialog.alert('Keep at least two columns.'); if (await LX.dialog.confirm('Delete "' + board.cols[board.cols.length - 1].name + '" and its cards?', 'Delete column')) { board.cols.pop(); save(); paint(); } } })),
        colsEl);
      paint();
    },
  });
})();
