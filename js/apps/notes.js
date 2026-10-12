/* Leonux Notes — notebook list + editor, autosave, .lxnote opener */
(function () {
  'use strict';
  const H = LX.h, KEY = 'app.notes.data';
  const COLORS = ['', '#F6C177', '#EB6F92', '#9CCFD8', '#A6E3A1', '#C4A7E7', '#5B9DFA'];
  const wins = new Set();
  function load() { const d = LX.store.get(KEY, null); if (d && Array.isArray(d.notes)) return d; const t = Date.now(); return { notes: [{ id: LX.uid(), title: 'Welcome to Notes', body: 'Notes are saved automatically.\n\n- Pin important notes\n- Colour-code them\n- Search across everything', color: '#F6C177', pinned: true, created: t, updated: t }] }; }
  let data = load();
  const save = LX.debounce(() => { LX.store.set(KEY, data); wins.forEach((f) => f()); }, 250);
  function importLxnote(path) {
    let o; try { o = JSON.parse(LX.vfs.read(path)); } catch (e) { o = { title: LX.vfs.basename(path).replace(/\.lxnote$/, ''), body: (function () { try { return LX.vfs.read(path); } catch (x) { return ''; } })() }; }
    const t = Date.now(); const n = { id: LX.uid(), title: String(o.title || 'Imported note'), body: String(o.body || ''), color: o.color || '', pinned: false, created: t, updated: t };
    data.notes.unshift(n); LX.store.set(KEY, data); return n.id;
  }
  LX.apps.setOpener(['lxnote'], 'notes');
  LX.apps.register({
    id: 'notes', name: 'Notes', icon: 'sticky', color: '#F6C177', category: 'Productivity', desc: 'Notebook with colours, pins and search', width: 860, height: 580, minWidth: 440, minHeight: 320,
    open(win, args) {
      const B = win.body; B.tabIndex = 0; let sel = null, q = '';
      const search = H('input', { class: 'input', placeholder: 'Search notes…', oninput: () => { q = search.value.toLowerCase(); renderList(); } });
      const list = H('div', { class: 'nt-list scroll' });
      const side = H('div', { class: 'sidebar nt-side' }, H('div', { class: 'nt-sh' }, search, H('button', { class: 'btn icon sm', title: 'New note', html: LX.icon('plus', 16), onclick: addNote })), list);
      const title = H('input', { class: 'nt-title', placeholder: 'Title', oninput: () => edit('title', title.value) });
      const body = H('textarea', { class: 'nt-body', placeholder: 'Start typing…', oninput: () => edit('body', body.value) });
      const swatches = H('div', { class: 'nt-sw' });
      const info = H('small', { class: 'muted' });
      const editor = H('div', { class: 'nt-editor' }, H('div', { class: 'nt-bar' }, title,
        H('button', { class: 'btn icon sm', title: 'Pin', onclick: () => cur() && edit('pinned', !cur().pinned, true) , html: LX.icon('pin', 15) }),
        H('button', { class: 'btn icon sm', title: 'Delete', html: LX.icon('trash', 15), onclick: del })), swatches, body, H('div', { class: 'nt-foot' }, info));
      const empty = H('div', { class: 'nt-empty' }, H('div', { html: LX.icon('sticky', 44) }), H('div', { text: 'No note selected' }), H('button', { class: 'btn primary', text: 'New note', onclick: addNote }));
      const main = H('div', { class: 'nt-main' }, editor, empty);
      B.append(H('div', { class: 'nt-root' }, side, main));
      const cur = () => data.notes.find((n) => n.id === sel);
      function addNote() { const t = Date.now(); const n = { id: LX.uid(), title: '', body: '', color: '', pinned: false, created: t, updated: t }; data.notes.unshift(n); sel = n.id; save(); renderAll(); title.focus(); }
      async function del() { const n = cur(); if (!n || !(await LX.dialog.confirm('Delete "' + (n.title || 'Untitled') + '"?', 'Delete note'))) return; data.notes = data.notes.filter((x) => x !== n); sel = null; save(); renderAll(); }
      function edit(k, v, rerender) { const n = cur(); if (!n) return; n[k] = v; n.updated = Date.now(); save(); if (rerender) renderAll(); else renderList(); info.textContent = stats(n); }
      const stats = (n) => (n.body.match(/\S+/g) || []).length + ' words · edited ' + LX.fmtDateTime(n.updated);
      function renderList() {
        list.innerHTML = '';
        const l = data.notes.filter((n) => !q || (n.title + ' ' + n.body).toLowerCase().indexOf(q) >= 0).sort((a, b) => (b.pinned - a.pinned) || b.updated - a.updated);
        if (!l.length) list.appendChild(H('div', { class: 'muted nt-none', text: q ? 'No matches' : 'No notes yet' }));
        l.forEach((n) => list.appendChild(H('div', { class: 'nt-item' + (n.id === sel ? ' active' : ''), style: n.color ? '--nc:' + n.color : '', onclick: () => { sel = n.id; renderAll(); },
          oncontextmenu: (e) => { e.preventDefault(); sel = n.id; renderAll(); LX.menu.show(e.clientX, e.clientY, [{ label: n.pinned ? 'Unpin' : 'Pin', icon: 'pin', action: () => edit('pinned', !n.pinned, true) }, { label: 'Export to Documents', icon: 'download', action: () => exportNote(n) }, { label: 'Delete', icon: 'trash', action: del }]); } },
          H('div', { class: 'nt-it' }, n.pinned && H('span', { html: LX.icon('pin', 11) }), H('span', { class: 'ellipsis', text: n.title || 'Untitled' })),
          H('div', { class: 'nt-ib ellipsis', text: n.body.replace(/\s+/g, ' ').slice(0, 80) || 'No content' }), H('small', { class: 'muted', text: LX.fmtDate(n.updated) }))));
      }
      function exportNote(n) { try { const p = LX.vfs.join(LX.vfs.HOME, 'Documents', LX.vfs.uniqueName(LX.vfs.HOME + '/Documents', (n.title || 'Untitled').replace(/[\/\\]/g, '-') + '.lxnote')); LX.vfs.write(p, JSON.stringify({ title: n.title, body: n.body, color: n.color })); LX.notify({ title: 'Note exported', body: p, icon: 'check' }); } catch (e) { LX.dialog.alert(e.message); } }
      function renderEditor() {
        const n = cur(); editor.classList.toggle('hidden', !n); empty.classList.toggle('hidden', !!n); if (!n) return;
        if (document.activeElement !== title) title.value = n.title; if (document.activeElement !== body) body.value = n.body;
        editor.style.setProperty('--nc', n.color || 'var(--accent)'); info.textContent = stats(n);
        swatches.innerHTML = ''; COLORS.forEach((c) => swatches.appendChild(H('button', { class: 'nt-dot' + (n.color === c ? ' on' : ''), style: 'background:' + (c || 'var(--surface-3)'), title: c || 'None', onclick: () => edit('color', c, true) })));
      }
      function renderAll() { renderList(); renderEditor(); }
      const refresh = () => { data = LX.store.get(KEY, data) || data; if (!document.activeElement || (document.activeElement !== title && document.activeElement !== body)) renderAll(); };
      wins.add(refresh); win.onClose(() => wins.delete(refresh));
      B.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); addNote(); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); search.focus(); } });
      win.setMenu([{ label: 'Note', items: [{ label: 'New note', shortcut: 'Ctrl+N', action: addNote }, { label: 'Delete note', action: del }, { separator: true }, { label: 'Import .lxnote…', action: async () => { const p = await LX.dialog.openFile({ title: 'Import note', exts: ['lxnote', 'txt', 'md'] }); if (p) { sel = importLxnote(p); renderAll(); } } }] }]);
      win.on('args', (a) => { if (a && a.path) { sel = importLxnote(a.path); renderAll(); } });
      if (args && args.path) sel = importLxnote(args.path); else if (data.notes.length) sel = data.notes.slice().sort((a, b) => b.updated - a.updated)[0].id;
      renderAll();
    },
  });
})();
