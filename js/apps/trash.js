/* Leonux Trash — restore / delete permanently */
(function () {
  'use strict';
  const H = LX.h, V = LX.vfs;
  LX.apps.register({
    id: 'trash', name: 'Trash', icon: 'trash', color: '#EB6F92', category: 'System', desc: 'Restore or permanently delete removed files', width: 640, height: 460, minWidth: 380, minHeight: 280, singleton: true,
    open(win) {
      const B = win.body; let sel = new Set();
      const list = H('div', { class: 'tr-list scroll' });
      const bR = H('button', { class: 'btn sm', html: LX.icon('rotate-ccw', 14) + ' Restore', onclick: restore });
      const bD = H('button', { class: 'btn sm danger', html: LX.icon('x', 14) + ' Delete', onclick: del });
      const bE = H('button', { class: 'btn sm danger', html: LX.icon('trash', 14) + ' Empty Trash', onclick: empty });
      const status = H('div', { class: 'tr-status muted' });
      B.append(H('div', { class: 'toolbar' }, bR, bD, H('span', { class: 'grow' }), bE), list, status);
      function items() { try { return V.trashList().sort((a, b) => b.deleted - a.deleted); } catch (e) { return []; } }
      function render() {
        const l = items(); list.innerHTML = '';
        sel = new Set([...sel].filter((p) => l.some((i) => i.path === p)));
        if (!l.length) list.appendChild(H('div', { class: 'tr-empty' }, H('div', { html: LX.icon('trash', 48) }), H('div', { text: 'Trash is empty' })));
        l.forEach((i) => {
          list.appendChild(H('div', { class: 'list-item tr-item' + (sel.has(i.path) ? ' sel' : ''),
            onclick: (e) => { if (e.ctrlKey || e.metaKey) { sel.has(i.path) ? sel.delete(i.path) : sel.add(i.path); } else sel = new Set([i.path]); render(); },
            ondblclick: () => { if (i.type === 'file') LX.apps.launch('texteditor', { path: i.path }); },
            oncontextmenu: (e) => { e.preventDefault(); if (!sel.has(i.path)) { sel = new Set([i.path]); render(); } LX.menu.show(e.clientX, e.clientY, [{ label: 'Restore', icon: 'rotate-ccw', action: restore }, { label: 'Delete permanently', icon: 'trash', action: del }]); } },
            H('span', { class: 'tr-ico', html: LX.icon(i.type === 'dir' ? 'folder' : 'file', 20) }),
            H('div', { class: 'grow tr-meta' }, H('div', { class: 'ellipsis', text: i.name }), H('small', { class: 'muted ellipsis', text: 'From ' + V.dirname(i.origin) })),
            H('small', { class: 'muted tr-size', text: i.type === 'dir' ? '' : LX.fmtBytes(i.size) }), H('small', { class: 'muted tr-date', text: LX.fmtDateTime(i.deleted) })));
        });
        bR.disabled = bD.disabled = !sel.size; bE.disabled = !l.length;
        status.textContent = l.length + ' item' + (l.length === 1 ? '' : 's') + (sel.size ? ' · ' + sel.size + ' selected' : '');
      }
      function restore() { [...sel].forEach((p) => { try { V.restore(p); } catch (e) { LX.dialog.alert(e.message); } }); sel.clear(); render(); }
      async function del() { if (!sel.size || !(await LX.dialog.confirm('Permanently delete ' + sel.size + ' item(s)?', 'Delete permanently'))) return; [...sel].forEach((p) => { try { V.rm(p, { permanent: true }); } catch (e) { } }); sel.clear(); render(); }
      async function empty() { if (await LX.dialog.confirm('Permanently delete all items in Trash?', 'Empty Trash')) { V.emptyTrash(); sel.clear(); render(); } }
      B.tabIndex = 0;
      B.addEventListener('keydown', (e) => { if (e.key === 'Delete') del(); else if (e.key === 'Enter') restore(); else if ((e.ctrlKey || e.metaKey) && e.key === 'a') { sel = new Set(items().map((i) => i.path)); render(); } else return; e.preventDefault(); });
      win.onClose(LX.bus.on('vfs:change', render));
      render();
    },
  });
})();
