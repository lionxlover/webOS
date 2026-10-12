/* Leonux Clipboard — history of copied text/images, pin, search, re-copy; Ctrl+Shift+V opens it. */
(function () {
  'use strict';
  const H = LX.h;
  const KEY = 'app.clipboard.items';
  const MAX = 60;
  let items = LX.store.get(KEY, []);
  if (!Array.isArray(items)) items = [];
  let muted = false;
  const persist = LX.debounce(() => {
    let a = items.slice();
    for (let i = 0; i < 6; i++) { try { localStorage.setItem('lx:' + KEY, JSON.stringify(a)); break; } catch (e) { const k = a.map((x, j) => [x, j]).filter((p) => p[0].type === 'image' && !p[0].pin).pop(); if (k) a.splice(k[1], 1); else a.pop(); } }
    LX.bus.emit('clip:persisted');
  }, 300);

  function add(it) {
    if (muted) return;
    if (it.type === 'text') { it.data = String(it.data); if (!it.data.trim()) return; }
    const dup = items.findIndex((x) => x.type === it.type && x.data === it.data);
    let pin = false;
    if (dup >= 0) { pin = items[dup].pin; items.splice(dup, 1); }
    items.unshift({ id: LX.uid(), type: it.type, data: it.data, pin, ts: Date.now(), src: it.src || '' });
    const unp = items.filter((x) => !x.pin);
    if (unp.length > MAX) { const drop = unp.slice(MAX); items = items.filter((x) => drop.indexOf(x) < 0); }
    persist(); LX.bus.emit('clip:change');
  }
  function selText() {
    try {
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && typeof a.selectionStart === 'number' && a.selectionStart !== a.selectionEnd) return a.value.substring(a.selectionStart, a.selectionEnd);
      return String(document.getSelection() || '');
    } catch (e) { return ''; }
  }
  function fileToData(f) { return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(f); }); }
  LX.clipApi = { add: (t) => add({ type: 'text', data: t }), items: () => items };

  document.addEventListener('copy', (e) => { const t = selText(); if (t) add({ type: 'text', data: t }); }, true);
  document.addEventListener('cut', () => { const t = selText(); if (t) add({ type: 'text', data: t }); }, true);
  document.addEventListener('paste', async (e) => {
    const cd = e.clipboardData; if (!cd) return;
    const files = Array.from(cd.files || []).filter((f) => /^image\//.test(f.type));
    for (const f of files) { const d = await fileToData(f); if (d) add({ type: 'image', data: d }); }
  }, true);
  // Capture programmatic copies made through LX.clipboard.copy by other apps
  const origCopy = LX.clipboard.copy.bind(LX.clipboard);
  LX.clipboard.copy = function (text) { add({ type: 'text', data: text }); return origCopy(text); };
  function copyItem(it) {
    muted = true; setTimeout(() => { muted = false; }, 50);
    if (it.type === 'text') origCopy(it.data);
    else { try { fetch(it.data).then((r) => r.blob()).then((b) => navigator.clipboard.write([new ClipboardItem({ [b.type]: b })])).catch(() => {}); } catch (e) {} }
    const i = items.indexOf(it); if (i > 0) { items.splice(i, 1); items.unshift(it); persist(); LX.bus.emit('clip:change'); }
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'v') { e.preventDefault(); LX.apps.launch('clipboardmgr'); }
  });

  function ago(ts) { const s = (Date.now() - ts) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return LX.fmtDate(ts).replace(/^\w+, /, ''); }

  LX.apps.register({
    id: 'clipboardmgr', name: 'Clipboard', icon: 'clipboard', color: '#4DD0E1', category: 'Utilities', singleton: true,
    desc: 'Clipboard history with pins and search (Ctrl+Shift+V)', width: 460, height: 580, minWidth: 340, minHeight: 320,
    open(win) {
      let q = '', filter = 'all', sel = 0;
      const list = H('div', { class: 'cb-list scroll' });
      const search = H('input', { class: 'input cb-search', type: 'search', placeholder: 'Search clipboard history…', oninput: () => { q = search.value.toLowerCase(); sel = 0; paint(); } });
      const tabs = H('div', { class: 'tabs cb-tabs' }, [['all', 'All'], ['pin', 'Pinned'], ['text', 'Text'], ['image', 'Images']].map((t) => H('button', { class: 'tab' + (filter === t[0] ? ' active' : ''), dataset: { f: t[0] }, text: t[1], onclick: () => { filter = t[0]; sel = 0; LX.$$('.tab', tabs).forEach((x) => x.classList.toggle('active', x.dataset.f === filter)); paint(); } })));
      const count = H('span', { class: 'muted cb-count' });
      win.body.append(H('div', { class: 'cb-top' }, search, H('button', { class: 'btn sm', title: 'Paste from system clipboard', html: LX.icon('download', 13) + ' Capture', onclick: capture })), tabs, list, H('div', { class: 'cb-foot' }, count, H('span', { class: 'grow' }), H('span', { class: 'muted', text: 'Enter re-copies · Del removes · P pins' })));
      win.body.tabIndex = 0;

      async function capture() {
        let got = false;
        try {
          const cis = await navigator.clipboard.read();
          for (const ci of cis) for (const ty of ci.types) { if (ty.indexOf('image/') === 0) { const b = await ci.getType(ty); const d = await fileToData(b); if (d) { add({ type: 'image', data: d }); got = true; } } }
        } catch (e) {}
        if (!got) { const t = await LX.clipboard.paste(); if (t) { add({ type: 'text', data: t }); got = true; } }
        if (!got) LX.notify({ title: 'Clipboard', body: 'Nothing to capture (the browser may need permission).', icon: 'clipboard' });
      }
      function view() {
        return items.filter((x) => (filter === 'all' || (filter === 'pin' ? x.pin : x.type === filter)) && (!q || (x.type === 'text' && x.data.toLowerCase().indexOf(q) >= 0)))
          .sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0));
      }
      function paint() {
        const v = view(); list.innerHTML = ''; sel = LX.clamp(sel, 0, Math.max(0, v.length - 1));
        count.textContent = items.length + ' item' + (items.length === 1 ? '' : 's');
        if (!v.length) {
          list.appendChild(H('div', { class: 'cb-empty' }, H('div', { html: LX.icon('clipboard', 46) }), H('b', { text: items.length ? 'No matches' : 'Clipboard history is empty' }), H('span', { class: 'muted', text: items.length ? 'Try another search or filter.' : 'Copy some text (Ctrl+C) anywhere in Leonux and it will show up here.' })));
          return;
        }
        v.forEach((it, i) => {
          const body = it.type === 'image' ? H('img', { class: 'cb-img', src: it.data, draggable: 'false' }) : H('div', { class: 'cb-text', text: it.data.length > 400 ? it.data.slice(0, 400) + '…' : it.data });
          const el = H('div', { class: 'cb-item' + (i === sel ? ' sel' : '') + (it.pin ? ' pinned' : ''), tabindex: -1,
            onclick: () => { sel = i; copyItem(it); LX.notify({ title: 'Copied', body: it.type === 'text' ? it.data.slice(0, 60) : 'Image copied', icon: 'clipboard', timeout: 1500 }); },
            oncontextmenu: (e) => { e.preventDefault(); sel = i; LX.menu.show(e.clientX, e.clientY, [
              { label: 'Copy', icon: 'copy', action: () => copyItem(it) }, { label: it.pin ? 'Unpin' : 'Pin', icon: 'pin', action: () => { it.pin = !it.pin; persist(); paint(); } },
              it.type === 'text' && { label: 'Save as note…', icon: 'file-text', action: () => saveText(it) },
              it.type === 'image' && { label: 'Save to Pictures', icon: 'image', action: () => saveImg(it) },
              { separator: true }, { label: 'Delete', icon: 'trash', danger: true, action: () => rm(it) }].filter(Boolean)); } },
            H('div', { class: 'cb-main' }, body, H('div', { class: 'cb-meta muted', text: (it.type === 'text' ? it.data.length + ' chars' : 'Image') + ' · ' + ago(it.ts) })),
            H('div', { class: 'cb-acts' },
              H('button', { class: 'btn icon sm ghost' + (it.pin ? ' on' : ''), title: it.pin ? 'Unpin' : 'Pin', html: LX.icon('pin', 14), onclick: (e) => { e.stopPropagation(); it.pin = !it.pin; persist(); paint(); } }),
              H('button', { class: 'btn icon sm ghost', title: 'Delete', html: LX.icon('x', 14), onclick: (e) => { e.stopPropagation(); rm(it); } })));
          list.appendChild(el);
        });
      }
      function rm(it) { items = items.filter((x) => x !== it); persist(); paint(); }
      function saveText(it) { const n = 'clip-' + Date.now().toString(36) + '.txt'; try { LX.vfs.write(LX.vfs.join(LX.vfs.HOME, 'Documents', n), it.data); LX.notify({ title: 'Saved', body: 'Documents/' + n, icon: 'file-text' }); } catch (e) {} }
      function saveImg(it) { const ext = (it.data.match(/^data:image\/(\w+)/) || [0, 'png'])[1]; const n = 'clip-' + Date.now().toString(36) + '.' + ext; try { LX.vfs.write(LX.vfs.join(LX.vfs.HOME, 'Pictures', n), it.data); LX.notify({ title: 'Saved', body: 'Pictures/' + n, icon: 'image' }); } catch (e) {} }
      async function clearAll(keepPins) { if (await LX.dialog.confirm(keepPins ? 'Clear all unpinned items?' : 'Clear the entire clipboard history?', 'Clear history')) { items = keepPins ? items.filter((x) => x.pin) : []; persist(); paint(); } }

      const off = LX.bus.on('clip:change', paint);
      const t = setInterval(() => { if (win.isFocused && !win.isFocused()) paint(); }, 60000);
      win.onClose(() => { off(); clearInterval(t); });
      win.on('args', () => { search.focus(); search.select(); });
      win.body.addEventListener('keydown', (e) => {
        const v = view(); const typing = e.target === search;
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(v.length - 1, sel + 1); paint(); const el = list.children[sel]; el && el.scrollIntoView && el.scrollIntoView({ block: 'nearest' }); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); const el = list.children[sel]; el && el.scrollIntoView && el.scrollIntoView({ block: 'nearest' }); }
        else if (e.key === 'Enter' && v[sel]) { e.preventDefault(); copyItem(v[sel]); LX.notify({ title: 'Copied', body: 'Item copied to clipboard', icon: 'clipboard', timeout: 1500 }); win.close(); }
        else if (!typing && e.key === 'Delete' && v[sel]) rm(v[sel]);
        else if (!typing && e.key.toLowerCase() === 'p' && v[sel]) { v[sel].pin = !v[sel].pin; persist(); paint(); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); search.focus(); }
        else if (e.key === 'Escape') win.close();
      });
      win.setMenu([
        { label: 'History', items: [{ label: 'Capture system clipboard', action: capture }, { label: 'Search', shortcut: 'Ctrl+F', action: () => search.focus() }, { separator: true },
          { label: 'Clear unpinned', action: () => clearAll(true) }, { label: 'Clear everything', action: () => clearAll(false) }] },
        { label: 'View', items: [['all', 'All'], ['pin', 'Pinned'], ['text', 'Text'], ['image', 'Images']].map((f) => ({ label: f[1], action: () => { const b = LX.$('.tab[data-f="' + f[0] + '"]', tabs); b && b.click(); } })) },
      ]);
      paint(); setTimeout(() => search.focus(), 40);
    },
  });
})();
