/* Leonux Sticky Notes — draggable, resizable coloured notes on a board */
(function () {
  'use strict';
  const H = LX.h, KEY = 'app.sticky.data';
  const COLORS = ['#F6C177', '#F5A3B8', '#9CCFD8', '#A6E3A1', '#C4A7E7', '#F2E394'];
  LX.apps.register({
    id: 'stickynotes', name: 'Sticky Notes', icon: 'sticky', color: '#F2E394', category: 'Productivity', desc: 'Quick coloured notes on a board', width: 760, height: 520, minWidth: 360, minHeight: 280, singleton: true,
    open(win) {
      const B = win.body; let notes = LX.store.get(KEY, null);
      if (!Array.isArray(notes)) notes = [{ id: LX.uid(), x: 30, y: 30, w: 210, h: 190, color: COLORS[0], text: 'Welcome!\nDrag me by the header, resize from the corner.', z: 1 }];
      const save = LX.debounce(() => LX.store.set(KEY, notes), 250);
      const board = H('div', { class: 'sn-board' });
      const add = H('button', { class: 'btn primary sm', html: LX.icon('plus', 14) + ' New note', onclick: () => create() });
      B.append(H('div', { class: 'toolbar' }, add, H('span', { class: 'grow' }), H('small', { class: 'muted sn-count' })), board);
      let topZ = Math.max(1, ...notes.map((n) => n.z || 1));
      function create() {
        const r = board.getBoundingClientRect(); const k = notes.length;
        const n = { id: LX.uid(), x: LX.clamp(30 + (k % 8) * 28, 0, Math.max(0, r.width - 220)), y: LX.clamp(30 + (k % 8) * 28, 0, Math.max(0, r.height - 200)), w: 210, h: 190, color: COLORS[k % COLORS.length], text: '', z: ++topZ };
        notes.push(n); save(); render(n.id);
      }
      function place(el, n) { el.style.cssText = 'left:' + n.x + 'px;top:' + n.y + 'px;width:' + n.w + 'px;height:' + n.h + 'px;z-index:' + (n.z || 1) + ';--sc:' + n.color; }
      function render(focusId) {
        board.innerHTML = '';
        board.classList.toggle('empty', !notes.length);
        notes.forEach((n) => {
          const ta = H('textarea', { class: 'sn-ta', placeholder: 'Write something…', spellcheck: 'false', value: n.text, oninput: () => { n.text = ta.value; save(); } });
          const el = H('div', { class: 'sn-note' });
          const head = H('div', { class: 'sn-head' }, H('span', { class: 'sn-grip', html: LX.icon('menu', 12) }), H('span', { class: 'grow' }),
            H('button', { class: 'sn-b', title: 'Colour', html: LX.icon('palette', 13), onclick: (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); LX.menu.show(r.left, r.bottom, COLORS.map((c, i) => ({ label: 'Colour ' + (i + 1), icon: n.color === c ? 'check' : undefined, action: () => { n.color = c; el.style.setProperty('--sc', c); save(); } }))); } }),
            H('button', { class: 'sn-b', title: 'Delete', html: LX.icon('x', 13), onclick: async (e) => { e.stopPropagation(); if (!n.text.trim() || await LX.dialog.confirm('Delete this note?', 'Sticky Notes')) { notes = notes.filter((x) => x !== n); save(); render(); } } }));
          const grip = H('div', { class: 'sn-resize' });
          el.append(head, ta, grip); place(el, n);
          const front = () => { if (n.z !== topZ) { n.z = ++topZ; el.style.zIndex = n.z; save(); } };
          el.addEventListener('pointerdown', front);
          drag(head, (dx, dy, o) => { n.x = Math.max(-n.w + 60, o.x + dx); n.y = Math.max(0, o.y + dy); el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }, () => ({ x: n.x, y: n.y }));
          drag(grip, (dx, dy, o) => { n.w = Math.max(120, o.w + dx); n.h = Math.max(90, o.h + dy); el.style.width = n.w + 'px'; el.style.height = n.h + 'px'; }, () => ({ w: n.w, h: n.h }));
          board.appendChild(el); if (n.id === focusId) ta.focus();
        });
        B.querySelector('.sn-count').textContent = notes.length + ' note' + (notes.length === 1 ? '' : 's');
        if (!notes.length) board.appendChild(H('div', { class: 'sn-empty' }, H('div', { html: LX.icon('sticky', 44) }), H('div', { text: 'No sticky notes — add one!' })));
      }
      function drag(handle, fn, start) {
        handle.addEventListener('pointerdown', (e) => {
          if (e.target.closest('.sn-b')) return; e.preventDefault(); const sx = e.clientX, sy = e.clientY, o = start();
          handle.setPointerCapture(e.pointerId);
          const mv = (ev) => fn(ev.clientX - sx, ev.clientY - sy, o);
          const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); save(); };
          handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
        });
      }
      board.addEventListener('dblclick', (e) => { if (e.target === board) create(); });
      B.tabIndex = 0; B.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); create(); } });
      win.setMenu([{ label: 'Notes', items: [{ label: 'New note', shortcut: 'Ctrl+N', action: () => create() }, { label: 'Delete all', action: async () => { if (await LX.dialog.confirm('Delete all sticky notes?', 'Sticky Notes')) { notes = []; save(); render(); } } }] }]);
      win.onClose(() => LX.store.set(KEY, notes));
      render();
    },
  });
})();
