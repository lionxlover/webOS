/* Leonux Text Editor — tabs, find/replace, line numbers */
(function () {
  'use strict';
  const H = LX.h, V = LX.vfs;
  LX.apps.setOpener(['txt', 'log', 'json', 'js', 'css', 'py', 'rs', 'c', 'cpp', 'h', 'sh', 'csv', 'xml', 'ini', 'conf', 'yml', 'yaml', 'toml'], 'texteditor');
  LX.apps.register({
    id: 'texteditor', name: 'Text Editor', icon: 'file-text', color: '#5B9DFA', category: 'Productivity', desc: 'Edit plain text and code', width: 800, height: 560, minWidth: 420, minHeight: 300,
    open(win, args) {
      const B = win.body; B.tabIndex = 0;
      let tabs = [], cur = null, wrap = LX.store.get('app.te.wrap', false), lines = LX.store.get('app.te.lines', true);
      const tabBar = H('div', { class: 'tabs te-tabs' });
      const find = H('input', { class: 'input sm', placeholder: 'Find', oninput: () => doFind(0, true), onkeydown: (e) => { if (e.key === 'Enter') { doFind(e.shiftKey ? -1 : 1); e.preventDefault(); } else if (e.key === 'Escape') toggleFind(false); } });
      const repl = H('input', { class: 'input sm', placeholder: 'Replace', onkeydown: (e) => { if (e.key === 'Enter') replaceOne(); else if (e.key === 'Escape') toggleFind(false); } });
      const fcount = H('small', { class: 'muted' });
      const findBar = H('div', { class: 'toolbar te-find hidden' }, find, repl,
        H('button', { class: 'btn sm', text: 'Prev', onclick: () => doFind(-1) }), H('button', { class: 'btn sm', text: 'Next', onclick: () => doFind(1) }),
        H('button', { class: 'btn sm', text: 'Replace', onclick: replaceOne }), H('button', { class: 'btn sm', text: 'All', onclick: replaceAll }), fcount,
        H('button', { class: 'btn icon sm', html: LX.icon('x', 14), onclick: () => toggleFind(false) }));
      const gutter = H('div', { class: 'te-gutter' });
      const ta = H('textarea', { class: 'te-ta', spellcheck: 'false', wrap: 'off' });
      const wrapEl = H('div', { class: 'te-wrap' }, gutter, ta);
      const status = H('div', { class: 'te-status' });
      B.append(tabBar, findBar, wrapEl, status);

      const dirty = (t) => t.text !== t.saved;
      function newTab(path) {
        let text = '';
        if (path) { try { text = V.read(path); if (text.indexOf('data:') === 0 && !/^data:text/.test(text)) { LX.dialog.alert('This looks like a binary file and cannot be edited as text.', 'Cannot open'); return; } } catch (e) { LX.dialog.alert(e.message, 'Cannot open'); return; } }
        const ex = path && tabs.find((t) => t.path === path); if (ex) { select(ex); return; }
        const t = { id: LX.uid(), path: path || null, text, saved: text, sel: 0, scroll: 0, name: path ? V.basename(path) : 'Untitled' };
        tabs.push(t); select(t);
      }
      function select(t) { stash(); cur = t; ta.value = t.text; ta.selectionStart = ta.selectionEnd = t.sel; ta.scrollTop = t.scroll; renderTabs(); upd(); ta.focus(); }
      function stash() { if (cur) { cur.text = ta.value; cur.sel = ta.selectionStart; cur.scroll = ta.scrollTop; } }
      async function closeTab(t) {
        stash();
        if (dirty(t)) { const ok = await LX.dialog.confirm('"' + t.name + '" has unsaved changes. Close and discard them?', 'Unsaved changes'); if (!ok) return; }
        const i = tabs.indexOf(t); tabs.splice(i, 1);
        if (!tabs.length) newTab(); else if (cur === t) { cur = null; select(tabs[Math.min(i, tabs.length - 1)]); } else renderTabs();
      }
      function renderTabs() {
        tabBar.innerHTML = '';
        tabs.forEach((t) => tabBar.appendChild(H('div', { class: 'tab te-tab' + (t === cur ? ' active' : ''), onclick: () => select(t), onauxclick: (e) => { if (e.button === 1) closeTab(t); }, title: t.path || t.name },
          H('span', { text: (dirty(t) ? '● ' : '') + t.name }), H('span', { class: 'te-x', html: LX.icon('x', 12), onclick: (e) => { e.stopPropagation(); closeTab(t); } }))));
        tabBar.appendChild(H('button', { class: 'btn icon sm', title: 'New tab', html: LX.icon('plus', 14), onclick: () => newTab() }));
        win.setTitle((cur ? (dirty(cur) ? '● ' : '') + cur.name : 'Text Editor') + ' — Text Editor');
      }
      function upd() {
        ta.wrap = wrap ? 'soft' : 'off'; wrapEl.classList.toggle('nolines', !lines); wrapEl.classList.toggle('wrap', wrap);
        const n = ta.value.split('\n').length;
        if (lines) { let s = ''; for (let i = 1; i <= n; i++) s += i + '\n'; gutter.textContent = s; gutter.scrollTop = ta.scrollTop; }
        const before = ta.value.slice(0, ta.selectionStart).split('\n');
        const words = (ta.value.match(/\S+/g) || []).length;
        status.textContent = 'Ln ' + before.length + ', Col ' + (before[before.length - 1].length + 1) + '  ·  ' + n + ' lines  ·  ' + words + ' words  ·  ' + ta.value.length + ' chars  ·  UTF-8' + (wrap ? '  ·  Wrap' : '');
        if (cur) { const d = dirty({ text: ta.value, saved: cur.saved }); if (d !== !!cur._d) { cur._d = d; cur.text = ta.value; renderTabs(); } }
      }
      ta.addEventListener('input', () => { cur.text = ta.value; upd(); });
      ta.addEventListener('keyup', upd); ta.addEventListener('click', upd);
      ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
      });
      async function save(as) {
        stash(); let p = cur.path;
        if (!p || as) { p = await LX.dialog.saveFile({ title: 'Save file', path: p ? V.dirname(p) : V.HOME + '/Documents', name: cur.name === 'Untitled' ? 'untitled.txt' : cur.name }); if (!p) return; }
        try { V.write(p, cur.text); cur.path = p; cur.name = V.basename(p); cur.saved = cur.text; cur._d = false; renderTabs(); upd(); } catch (e) { LX.dialog.alert(e.message, 'Save failed'); }
      }
      async function openDlg() { const p = await LX.dialog.openFile({ title: 'Open file', path: V.HOME + '/Documents' }); if (p) newTab(p); }
      function toggleFind(on, repl) { findBar.classList.toggle('hidden', !on); if (on) { const s = ta.value.slice(ta.selectionStart, ta.selectionEnd); if (s && s.indexOf('\n') < 0) find.value = s; find.focus(); find.select(); doFind(0, true); } else { fcount.textContent = ''; ta.focus(); } }
      function doFind(dir, fromStart) {
        const q = find.value; if (!q) { fcount.textContent = ''; return; }
        const hay = ta.value.toLowerCase(), nq = q.toLowerCase(); let count = 0, i = -1; while ((i = hay.indexOf(nq, i + 1)) >= 0) count++;
        fcount.textContent = count + ' found'; if (!count || (!dir && !fromStart)) return;
        let pos;
        if (dir < 0) { pos = hay.lastIndexOf(nq, ta.selectionStart - 1); if (pos < 0) pos = hay.lastIndexOf(nq); }
        else { pos = hay.indexOf(nq, fromStart ? ta.selectionStart : ta.selectionEnd); if (pos < 0) pos = hay.indexOf(nq); }
        if (pos >= 0) { ta.setSelectionRange(pos, pos + q.length); const ln = ta.value.slice(0, pos).split('\n').length; ta.scrollTop = Math.max(0, (ln - 4) * 19.5); upd(); }
      }
      function replaceOne() {
        const q = find.value; if (!q) return;
        if (ta.value.slice(ta.selectionStart, ta.selectionEnd).toLowerCase() === q.toLowerCase()) { ta.setRangeText(repl.value, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
        doFind(1);
      }
      function replaceAll() {
        const q = find.value; if (!q) return; const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const n = (ta.value.match(re) || []).length; ta.value = ta.value.replace(re, () => repl.value); ta.dispatchEvent(new Event('input')); fcount.textContent = n + ' replaced';
      }
      async function gotoLine() { const v = await LX.dialog.prompt('Go to line', '1', 'Go to line'); const n = parseInt(v, 10); if (!n) return; const ls = ta.value.split('\n'); let pos = 0; for (let i = 0; i < Math.min(n - 1, ls.length - 1); i++) pos += ls[i].length + 1; ta.focus(); ta.setSelectionRange(pos, pos); ta.scrollTop = Math.max(0, (n - 4) * 19.5); upd(); }
      B.addEventListener('keydown', (e) => {
        const c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
        if (c && k === 's') save(e.shiftKey); else if (c && k === 'o') openDlg(); else if (c && k === 'n') newTab(); else if (c && k === 'f') toggleFind(true);
        else if (c && k === 'h') { toggleFind(true); repl.focus(); } else if (c && k === 'g') gotoLine(); else if (c && k === 'w') closeTab(cur); else if (k === 'f3') doFind(e.shiftKey ? -1 : 1); else return;
        e.preventDefault();
      });
      const setWrap = () => { wrap = !wrap; LX.store.set('app.te.wrap', wrap); upd(); };
      const setLines = () => { lines = !lines; LX.store.set('app.te.lines', lines); upd(); };
      win.setMenu([
        { label: 'File', items: [{ label: 'New', shortcut: 'Ctrl+N', action: () => newTab() }, { label: 'Open…', shortcut: 'Ctrl+O', action: openDlg }, { label: 'Save', shortcut: 'Ctrl+S', action: () => save() }, { label: 'Save As…', shortcut: 'Ctrl+Shift+S', action: () => save(true) }, { separator: true }, { label: 'Close tab', shortcut: 'Ctrl+W', action: () => closeTab(cur) }] },
        { label: 'Edit', items: [{ label: 'Find…', shortcut: 'Ctrl+F', action: () => toggleFind(true) }, { label: 'Replace…', shortcut: 'Ctrl+H', action: () => { toggleFind(true); repl.focus(); } }, { label: 'Go to line…', shortcut: 'Ctrl+G', action: gotoLine }, { separator: true }, { label: 'Select all', action: () => { ta.focus(); ta.select(); } }] },
        { label: 'View', items: [{ label: 'Toggle word wrap', action: setWrap }, { label: 'Toggle line numbers', action: setLines }] },
      ]);
      win.onClose(() => { stash(); if (tabs.some((t) => t.text !== t.saved)) { return LX.dialog.confirm('Discard unsaved changes?', 'Unsaved changes').then((ok) => { if (ok) { tabs.forEach((t) => t.saved = t.text); win.close(); } }) && false; } });
      win.on('args', (a) => { if (a && a.path) newTab(a.path); });
      newTab(args && args.path && V.isFile(args.path) ? args.path : null);
    },
  });
})();
