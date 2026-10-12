/* Leonux Files — file manager app */
(function () {
  'use strict';
  const H = LX.h, V = LX.vfs;
  let clip = null; // {op:'copy'|'cut', paths:[]}
  const PLACES = [
    ['Home', V.HOME, 'home'], ['Desktop', V.HOME + '/Desktop', 'monitor'], ['Documents', V.HOME + '/Documents', 'file-text'],
    ['Pictures', V.HOME + '/Pictures', 'image'], ['Music', V.HOME + '/Music', 'music'], ['Videos', V.HOME + '/Videos', 'video'],
    ['Downloads', V.HOME + '/Downloads', 'download'], ['Trash', V.TRASH, 'trash'],
  ];
  const IMG = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'];
  function iconFor(s) {
    if (s.type === 'dir') return ['folder', '#F6C177'];
    const e = V.ext(s.name);
    if (IMG.indexOf(e) >= 0) return ['image', '#9CCFD8'];
    if (['mp3', 'wav', 'ogg', 'm4a', 'lxtrack'].indexOf(e) >= 0) return ['music', '#C4A7E7'];
    if (['mp4', 'webm'].indexOf(e) >= 0) return ['video', '#EB6F92'];
    if (['js', 'py', 'rs', 'c', 'cpp', 'h', 'sh', 'json', 'html', 'css', 'xml'].indexOf(e) >= 0) return ['code', '#31748F'];
    if (['md', 'txt', 'log', 'lxnote'].indexOf(e) >= 0) return ['file-text', '#5B9DFA'];
    return ['file', 'var(--text-muted)'];
  }
  function dlgErr(e) { return LX.dialog.alert(String(e && e.message || e), 'Error'); }

  LX.apps.register({
    id: 'files', name: 'Files', icon: 'folder', color: '#F6C177', category: 'System', desc: 'Browse and manage files', width: 900, height: 580, minWidth: 460, minHeight: 320,
    open(win, args) {
      const B = win.body; B.tabIndex = 0;
      let path = args && args.path && V.isDir(args.path) ? args.path : (args && args.path && V.exists(args.path) ? V.dirname(args.path) : V.HOME);
      let hist = [path], hi = 0, view = LX.store.get('app.files.view', 'grid'), sel = new Set(), query = '', results = null, sortBy = 'name', anchor = null, showHidden = false;
      const pathBox = H('div', { class: 'f-path' });
      const search = H('input', { class: 'input f-search', placeholder: 'Search…', oninput: LX.debounce(() => { query = search.value.trim(); results = query ? V.search(query, 80) : null; sel.clear(); render(); }, 150) });
      const btn = (ic, title, fn) => H('button', { class: 'btn icon sm', title, html: LX.icon(ic, 16), onclick: fn });
      const bBack = btn('arrow-left', 'Back', () => go(hi - 1, true)), bFwd = btn('arrow-right', 'Forward', () => go(hi + 1, true)), bUp = btn('arrow-up', 'Up', () => nav(V.dirname(path)));
      const bView = btn('list', 'Toggle view', () => { view = view === 'grid' ? 'list' : 'grid'; LX.store.set('app.files.view', view); render(); });
      const toolbar = H('div', { class: 'toolbar f-toolbar' }, bBack, bFwd, bUp, pathBox,
        btn('folder-plus', 'New folder', newFolder), btn('file-plus', 'New file', newFile), btn('upload', 'Upload from computer', upload), bView, search);
      const side = H('div', { class: 'sidebar f-side' });
      const content = H('div', { class: 'f-content scroll', tabindex: '-1' });
      const status = H('div', { class: 'f-status' });
      B.append(toolbar, H('div', { class: 'f-main' }, side, content), status);

      function nav(p, noPush) {
        if (!V.isDir(p)) return; path = p; query = ''; search.value = ''; results = null; sel.clear(); anchor = null;
        if (!noPush) { hist = hist.slice(0, hi + 1); hist.push(p); hi = hist.length - 1; }
        render();
      }
      function go(i, isHist) { if (i < 0 || i >= hist.length) return; hi = i; nav(hist[i], true); }
      function entries() {
        if (results) return results;
        let l = []; try { l = V.ls(path); } catch (e) { l = []; }
        if (!showHidden && path !== V.TRASH) l = l.filter((s) => s.name[0] !== '.');
        if (sortBy !== 'name') l.sort((a, b) => (a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : sortBy === 'size' ? b.size - a.size : sortBy === 'date' ? b.mtime - a.mtime : V.ext(a.name).localeCompare(V.ext(b.name))));
        return l;
      }
      function open(s) {
        if (s.type === 'dir') nav(s.path);
        else if (s.path.indexOf(V.TRASH + '/') === 0) LX.apps.launch('trash');
        else LX.apps.openFile(s.path);
      }
      function crumbs() {
        pathBox.innerHTML = '';
        if (results) { pathBox.appendChild(H('span', { class: 'f-crumb cur', text: 'Search results for "' + query + '"' })); return; }
        const parts = path.split('/').filter(Boolean); let acc = '';
        pathBox.appendChild(H('button', { class: 'f-crumb', html: LX.icon('hard-drive', 13), title: '/', onclick: () => nav('/') }));
        parts.forEach((p, i) => { acc += '/' + p; const a = acc; pathBox.append(H('span', { class: 'f-sep', text: '›' }), H('button', { class: 'f-crumb' + (i === parts.length - 1 ? ' cur' : ''), text: p, onclick: () => nav(a) })); });
      }
      function sidebar() {
        side.innerHTML = '';
        side.appendChild(H('div', { class: 'f-side-h', text: 'Places' }));
        PLACES.forEach((p) => {
          if (!V.exists(p[1])) return;
          side.appendChild(H('div', { class: 'list-item f-place' + (path === p[1] && !results ? ' active' : ''), onclick: () => nav(p[1]),
            ondragover: (e) => { if (p[1] !== V.TRASH || true) e.preventDefault(); }, ondrop: (e) => dropOn(e, p[1]) },
            H('span', { html: LX.icon(p[2], 16) }), H('span', { class: 'ellipsis', text: p[0] })));
        });
        const u = V.usage(); side.appendChild(H('div', { class: 'f-usage' }, H('div', { class: 'progress' }, H('div', { style: 'width:' + Math.max(2, u.used / u.total * 100) + '%' })), H('small', { class: 'muted', text: LX.fmtBytes(u.used) + ' used of ' + LX.fmtBytes(u.total) })));
      }
      function render() {
        crumbs(); sidebar();
        bBack.disabled = hi <= 0; bFwd.disabled = hi >= hist.length - 1; bUp.disabled = path === '/';
        bView.innerHTML = LX.icon(view === 'grid' ? 'list' : 'grid', 16);
        const l = entries(); content.innerHTML = ''; content.className = 'f-content scroll ' + view;
        win.setTitle((results ? 'Search' : V.basename(path) || '/') + ' — Files');
        if (!l.length) content.appendChild(H('div', { class: 'f-empty' }, H('div', { html: LX.icon(results ? 'search' : 'folder', 44) }), H('div', { text: results ? 'No results' : path === V.TRASH ? 'Trash is empty' : 'This folder is empty' })));
        if (view === 'list' && l.length) content.appendChild(H('div', { class: 'f-row f-head' }, ...['name', 'size', 'date'].map((k) => H('span', { class: 'f-c-' + k + (sortBy === k ? ' on' : ''), text: k === 'date' ? 'Modified' : k[0].toUpperCase() + k.slice(1), onclick: () => { sortBy = k; render(); } }))));
        l.forEach((s, i) => {
          const [ic, col] = iconFor(s);
          const thumb = IMG.indexOf(V.ext(s.name)) >= 0 && view === 'grid' && s.size < 400000 ? (() => { try { const d = V.read(s.path); return d.indexOf('data:') === 0 ? d : 'data:image/svg+xml;utf8,' + encodeURIComponent(d); } catch (e) { return null; } })() : null;
          const el = H('div', { class: 'f-item' + (sel.has(s.path) ? ' sel' : '') + (clip && clip.op === 'cut' && clip.paths.indexOf(s.path) >= 0 ? ' cut' : ''), draggable: 'true', dataset: { path: s.path }, title: s.name },
            view === 'grid' ? [H('div', { class: 'f-ico', style: 'color:' + col }, thumb ? H('img', { src: thumb, alt: '' }) : H('span', { html: LX.icon(ic, 42) })), H('div', { class: 'f-name', text: s.name })]
              : [H('span', { class: 'f-c-name' }, H('span', { style: 'color:' + col, html: LX.icon(ic, 18) }), H('span', { class: 'ellipsis', text: s.name })), H('span', { class: 'f-c-size', text: s.type === 'dir' ? (s.count != null ? s.count + ' items' : '—') : LX.fmtBytes(s.size) }), H('span', { class: 'f-c-date', text: LX.fmtDateTime(s.mtime) })]);
          if (view === 'list') el.classList.add('f-row');
          el.addEventListener('click', (e) => { e.stopPropagation(); pick(s, i, l, e); });
          el.addEventListener('dblclick', () => open(s));
          el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); if (!sel.has(s.path)) { sel = new Set([s.path]); mark(); } itemMenu(e.clientX, e.clientY, s); });
          el.addEventListener('dragstart', (e) => { if (!sel.has(s.path)) { sel = new Set([s.path]); mark(); } e.dataTransfer.setData('text/x-lx-paths', JSON.stringify([...sel])); e.dataTransfer.effectAllowed = 'copyMove'; });
          if (s.type === 'dir') { el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop'); }); el.addEventListener('dragleave', () => el.classList.remove('drop')); el.addEventListener('drop', (e) => { el.classList.remove('drop'); dropOn(e, s.path); }); }
          content.appendChild(el);
        });
        const nsel = sel.size; status.textContent = l.length + ' item' + (l.length === 1 ? '' : 's') + (nsel ? ' · ' + nsel + ' selected' : '') + (clip ? ' · ' + clip.paths.length + ' in clipboard' : '');
        cur = l;
      }
      let cur = [];
      function mark() { LX.$$('.f-item', content).forEach((e) => e.classList.toggle('sel', sel.has(e.dataset.path))); }
      function pick(s, i, l, e) {
        if (e.shiftKey && anchor != null) { sel = new Set(l.slice(Math.min(anchor, i), Math.max(anchor, i) + 1).map((x) => x.path)); }
        else if (e.ctrlKey || e.metaKey) { sel.has(s.path) ? sel.delete(s.path) : sel.add(s.path); anchor = i; }
        else { sel = new Set([s.path]); anchor = i; }
        mark(); B.focus();
      }
      content.addEventListener('click', () => { sel.clear(); mark(); });
      content.addEventListener('contextmenu', (e) => { e.preventDefault(); bgMenu(e.clientX, e.clientY); });
      content.addEventListener('dragover', (e) => e.preventDefault());
      content.addEventListener('drop', (e) => { if (!results) dropOn(e, path); });

      function dropOn(e, dest) {
        e.preventDefault(); e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length && !e.dataTransfer.getData('text/x-lx-paths')) { readFiles(e.dataTransfer.files, dest); return; }
        let ps = []; try { ps = JSON.parse(e.dataTransfer.getData('text/x-lx-paths') || '[]'); } catch (x) { }
        ps.forEach((p) => { try { if (V.dirname(p) !== dest) { if (e.ctrlKey) V.cp(p, dest); else V.mv(p, dest); } } catch (x) { dlgErr(x); } });
      }
      function readFiles(files, dest) {
        Array.from(files).forEach((f) => {
          const r = new FileReader(); const isText = /^text\/|json|xml|javascript/.test(f.type) || /\.(txt|md|json|js|css|html|csv|log|py|sh|rs|c|cpp|h|xml|yml|yaml|toml|ini|conf)$/i.test(f.name);
          r.onload = () => { try { const name = V.exists(V.join(dest, f.name)) ? V.uniqueName(dest, f.name) : f.name; V.write(V.join(dest, name), r.result, { mime: f.type || V.mime(f.name) }); } catch (e) { dlgErr(e); } };
          if (isText) r.readAsText(f); else r.readAsDataURL(f);
        });
      }
      function upload() { const i = H('input', { type: 'file', multiple: true }); i.onchange = () => readFiles(i.files, path); i.click(); }
      function uniq(base) { return V.join(path, V.uniqueName ? V.uniqueName(path, base) : base); }
      async function newFolder() { if (results || path === V.TRASH) return; const n = await LX.dialog.prompt('Folder name', 'New Folder', 'New folder'); if (n && n.trim()) try { V.mkdir(V.join(path, n.trim().replace(/\//g, '-'))); } catch (e) { dlgErr(e); } }
      async function newFile() { if (results || path === V.TRASH) return; const n = await LX.dialog.prompt('File name', 'Untitled.txt', 'New file'); if (n && n.trim()) try { const p = V.join(path, n.trim().replace(/\//g, '-')); if (V.exists(p)) throw new Error('Already exists'); V.write(p, ''); } catch (e) { dlgErr(e); } }
      async function rename(s) {
        const n = await LX.dialog.prompt('New name', s.name, 'Rename'); if (!n || !n.trim() || n === s.name) return;
        try { V.mv(s.path, V.join(V.dirname(s.path), n.trim().replace(/\//g, '-'))); sel.clear(); } catch (e) { dlgErr(e); }
      }
      function copy(cut) { if (!sel.size) return; clip = { op: cut ? 'cut' : 'copy', paths: [...sel] }; render(); }
      function paste() {
        if (!clip || results || path === V.TRASH) return;
        clip.paths.forEach((p) => { try { if (!V.exists(p)) return; if (clip.op === 'cut') { if (V.dirname(p) !== path) V.mv(p, path); } else V.cp(p, path); } catch (e) { dlgErr(e); } });
        if (clip.op === 'cut') clip = null; render();
      }
      async function del() {
        if (!sel.size) return; const ps = [...sel]; const inTrash = path === V.TRASH;
        if (inTrash && !(await LX.dialog.confirm('Permanently delete ' + ps.length + ' item(s)? This cannot be undone.', 'Delete permanently'))) return;
        ps.forEach((p) => { try { V.rm(p, { permanent: inTrash }); } catch (e) { dlgErr(e); } }); sel.clear();
      }
      function props(s) {
        let st = s; try { st = V.stat(s.path); } catch (e) { return; }
        let size = st.size; if (st.type === 'dir') { size = 0; (function w(p) { V.ls(p).forEach((c) => c.type === 'dir' ? w(c.path) : size += c.size); })(st.path); }
        const rows = [['Name', st.name], ['Type', st.type === 'dir' ? 'Folder' : st.mime], ['Location', V.dirname(st.path)], ['Size', LX.fmtBytes(size)], st.count != null ? ['Contains', st.count + ' items'] : null, ['Created', LX.fmtDateTime(st.ctime)], ['Modified', LX.fmtDateTime(st.mtime)]].filter(Boolean);
        const w = LX.apps.launch('files-props', { rows, title: st.name });
      }
      function itemMenu(x, y, s) {
        const one = sel.size === 1, inTrash = path === V.TRASH;
        const openWith = (s.type === 'file' && !inTrash && one) ? LX.apps.openWithItems(s.path, null) : [];
        LX.menu.show(x, y, [
          { label: 'Open', icon: 'external', action: () => open(s), disabled: !one },
          (s.type === 'file' && !inTrash && one) && { label: 'Open with', icon: 'package', children: openWith.length ? openWith : [{ label: 'Text Editor', icon: 'file-text', action: () => LX.apps.launch('texteditor', { path: s.path }) }] },
          { separator: true },
          { label: 'Cut', icon: 'scissors', shortcut: 'Ctrl+X', action: () => copy(true), disabled: inTrash },
          { label: 'Copy', icon: 'copy', shortcut: 'Ctrl+C', action: () => copy(false), disabled: inTrash },
          { label: 'Rename', icon: 'edit', shortcut: 'F2', action: () => rename(s), disabled: !one || inTrash },
          { separator: true },
          inTrash ? { label: 'Restore', icon: 'rotate-ccw', action: () => { [...sel].forEach((p) => { try { V.restore(p); } catch (e) { } }); sel.clear(); } } : null,
          { label: inTrash ? 'Delete permanently' : 'Move to Trash', icon: 'trash', shortcut: 'Del', action: del },
          { separator: true }, { label: 'Properties', icon: 'info', action: () => props(s), disabled: !one },
        ].filter(Boolean));
      }
      function bgMenu(x, y) {
        LX.menu.show(x, y, [
          { label: 'New Folder', icon: 'folder-plus', action: newFolder }, { label: 'New File', icon: 'file-plus', action: newFile },
          { label: 'Paste', icon: 'clipboard', shortcut: 'Ctrl+V', action: paste, disabled: !clip }, { separator: true },
          { label: 'Upload from computer…', icon: 'upload', action: upload },
          { label: 'Sort by', icon: 'sort', children: ['name', 'size', 'date', 'type'].map((k) => ({ label: k[0].toUpperCase() + k.slice(1), checked: sortBy === k, action: () => { sortBy = k; render(); } })) },
          { label: view === 'grid' ? 'List view' : 'Grid view', icon: view === 'grid' ? 'list' : 'grid', action: () => bView.click() },
          { label: 'Show hidden files', checked: showHidden, action: () => { showHidden = !showHidden; render(); } },
          { label: 'Refresh', icon: 'refresh', action: render },
          path === V.TRASH && { label: 'Empty Trash', icon: 'trash', action: async () => { if (await LX.dialog.confirm('Permanently delete everything in Trash?', 'Empty Trash')) V.emptyTrash(); } },
        ].filter(Boolean));
      }
      B.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') { search.value = ''; query = ''; results = null; render(); B.focus(); } return; }
        const k = e.key, c = e.ctrlKey || e.metaKey;
        if (k === 'Delete') del(); else if (k === 'F2' && sel.size === 1) rename(V.stat([...sel][0]));
        else if (k === 'Enter' && sel.size === 1) open(V.stat([...sel][0]));
        else if (k === 'Backspace' || (e.altKey && k === 'ArrowUp')) nav(V.dirname(path));
        else if (e.altKey && k === 'ArrowLeft') go(hi - 1); else if (e.altKey && k === 'ArrowRight') go(hi + 1);
        else if (c && k === 'a') { sel = new Set(cur.map((s) => s.path)); mark(); }
        else if (c && k === 'c') copy(false); else if (c && k === 'x') copy(true); else if (c && k === 'v') paste();
        else if (c && k === 'f') { search.focus(); }
        else if (c && e.shiftKey && k.toLowerCase() === 'n') newFolder();
        else if (k.indexOf('Arrow') === 0 && cur.length) {
          const idx = cur.findIndex((s) => s.path === [...sel].pop()); const cols = view === 'grid' ? Math.max(1, Math.floor(content.clientWidth / 100)) : 1;
          let n = idx < 0 ? 0 : idx + (k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : k === 'ArrowDown' ? cols : -cols);
          n = LX.clamp(n, 0, cur.length - 1); sel = new Set([cur[n].path]); anchor = n; mark();
          const el = LX.$$('.f-item', content)[n]; if (el) el.scrollIntoView({ block: 'nearest' });
        } else return;
        e.preventDefault();
      });
      win.setMenu([
        { label: 'File', items: [{ label: 'New Window', action: () => LX.apps.launch('files', { path }) }, { label: 'New Folder', shortcut: 'Ctrl+Shift+N', action: newFolder }, { label: 'New File', action: newFile }, { label: 'Upload…', icon: 'upload', action: upload }, { separator: true }, { label: 'Close', action: () => win.close() }] },
        { label: 'Edit', items: [{ label: 'Cut', shortcut: 'Ctrl+X', action: () => copy(true) }, { label: 'Copy', shortcut: 'Ctrl+C', action: () => copy(false) }, { label: 'Paste', shortcut: 'Ctrl+V', action: paste }, { separator: true }, { label: 'Select all', shortcut: 'Ctrl+A', action: () => { sel = new Set(cur.map((s) => s.path)); mark(); } }, { label: 'Move to Trash', shortcut: 'Del', action: del }] },
        { label: 'View', items: [{ label: 'Grid view', action: () => { view = 'grid'; LX.store.set('app.files.view', view); render(); } }, { label: 'List view', action: () => { view = 'list'; LX.store.set('app.files.view', view); render(); } }, { label: 'Show hidden files', action: () => { showHidden = !showHidden; render(); } }, { label: 'Refresh', action: render }] },
      ]);
      const off = LX.bus.on('vfs:change', () => { if (V.isDir(path)) { if (results) results = V.search(query, 80); render(); } else nav(V.HOME); });
      win.onClose(off);
      win.on('args', (a) => { if (a && a.path) nav(V.isDir(a.path) ? a.path : V.dirname(a.path)); });
      render();
    },
  });
  LX.apps.register({
    id: 'files-props', name: 'Properties', icon: 'info', hidden: true, width: 340, height: 330, minWidth: 280, minHeight: 240,
    open(win, a) { win.setTitle('Properties — ' + (a.title || '')); win.body.appendChild(H('div', { class: 'f-props' }, (a.rows || []).map((r) => H('div', { class: 'f-prow' }, H('span', { class: 'muted', text: r[0] }), H('span', { text: r[1] }))))); },
  });
})();
