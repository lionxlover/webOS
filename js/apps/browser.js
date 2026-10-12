/* Leonux Web OS — Browser: tabs, address bar, history, sandboxed iframes, start page with bookmarks, VFS html via srcdoc */
(function () {
  'use strict';
  const H = LX.h, KEY = 'app.browser.bookmarks', START = 'lx://start';
  const DEFAULT_BM = [
    { title: 'DuckDuckGo', url: 'https://duckduckgo.com/' }, { title: 'Wikipedia', url: 'https://en.wikipedia.org/' },
    { title: 'MDN Web Docs', url: 'https://developer.mozilla.org/' }, { title: 'OpenStreetMap', url: 'https://www.openstreetmap.org/' },
    { title: 'Hacker News', url: 'https://news.ycombinator.com/' }, { title: 'Archive.org', url: 'https://archive.org/' },
  ];
  const color = (s) => { let n = 0; for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0; return 'hsl(' + (n % 360) + ',55%,52%)'; };

  function resolve(raw) {
    const t = (raw || '').trim(); if (!t) return START;
    if (t === START || /^about:/.test(t)) return START;
    if (t[0] === '/' && !/\s/.test(t)) return t;
    if (/^file:\/\//i.test(t)) return t.replace(/^file:\/\//i, '');
    if (/^https?:\/\//i.test(t)) return t;
    if (/^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(t) || /^localhost(:\d+)?([/?#]\S*)?$/i.test(t)) return 'https://' + t;
    return 'https://duckduckgo.com/?q=' + encodeURIComponent(t);
  }
  const isVfs = (u) => u[0] === '/';
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };

  LX.apps.register({
    id: 'browser', name: 'Browser', icon: 'globe', color: '#5B9DFA', category: 'Internet', desc: 'Browse the web and open local HTML files', width: 960, height: 640, minWidth: 460, minHeight: 340,
    open(win, args) {
      const body = win.body; body.tabIndex = 0;
      let tabs = [], cur = null, bms = LX.store.get(KEY, null); if (!Array.isArray(bms)) bms = DEFAULT_BM.slice();
      const saveBm = () => LX.store.set(KEY, bms);

      const tabBar = H('div', { class: 'br-tabs' });
      const bBack = H('button', { class: 'btn icon sm', title: 'Back (Alt+Left)', html: LX.icon('arrow-left', 16), onclick: () => hist(-1) });
      const bFwd = H('button', { class: 'btn icon sm', title: 'Forward (Alt+Right)', html: LX.icon('arrow-right', 16), onclick: () => hist(1) });
      const bReload = H('button', { class: 'btn icon sm', title: 'Reload (Ctrl+R)', html: LX.icon('refresh', 16), onclick: reload });
      const bHome = H('button', { class: 'btn icon sm', title: 'Start page', html: LX.icon('home', 16), onclick: () => go(START) });
      const addr = H('input', { class: 'input br-addr', type: 'text', placeholder: 'Search DuckDuckGo or enter an address', spellcheck: false, 'aria-label': 'Address bar',
        onkeydown: (e) => { if (e.key === 'Enter') { go(resolve(addr.value)); } else if (e.key === 'Escape') { syncAddr(); addr.blur(); } }, onfocus: () => addr.select() });
      const bStar = H('button', { class: 'btn icon sm', title: 'Bookmark this page (Ctrl+D)', html: LX.icon('star', 16), onclick: toggleBm });
      const bExt = H('button', { class: 'btn icon sm', title: 'Open in a real browser tab', html: LX.icon('external', 16), onclick: openExternal });
      const bar = H('div', { class: 'toolbar br-bar' }, bBack, bFwd, bReload, bHome, addr, bStar, bExt);
      const load = H('div', { class: 'br-load hidden' }, H('div'));
      const notice = H('div', { class: 'br-notice hidden' }, H('span', { html: LX.icon('info', 14) }), H('span', { class: 'grow', text: 'Many sites refuse to be shown inside other pages. If a page stays blank, use "Open in a real browser tab".' }),
        H('button', { class: 'btn sm', text: 'Open externally', onclick: openExternal }), H('button', { class: 'btn icon sm', title: 'Dismiss', html: LX.icon('x', 14), onclick: () => { notice.classList.add('hidden'); noticeOff = true; } }));
      let noticeOff = false;
      const view = H('div', { class: 'br-view grow' });
      body.append(tabBar, bar, load, notice, view);

      function newTab(url, activate) {
        const t = { id: LX.uid(), url: START, title: 'New tab', hist: [], hi: -1, frame: null, page: null };
        tabs.push(t); if (activate !== false) select(t); renderTabs();
        go(url || START, t, true); return t;
      }
      function closeTab(t) {
        const i = tabs.indexOf(t); if (i < 0) return;
        if (t.frame) t.frame.remove(); if (t.page) t.page.remove(); tabs.splice(i, 1);
        if (!tabs.length) return win.close();
        if (cur === t) select(tabs[Math.min(i, tabs.length - 1)]); else renderTabs();
      }
      function select(t) { cur = t; tabs.forEach((x) => { const el = x.frame || x.page; if (el) el.classList.toggle('hidden', x !== t); }); renderTabs(); syncAddr(); syncNav(); }
      function renderTabs() {
        tabBar.innerHTML = '';
        tabs.forEach((t) => tabBar.append(H('div', { class: 'br-tab' + (t === cur ? ' active' : ''), title: t.title, onclick: () => select(t), onauxclick: (e) => { if (e.button === 1) closeTab(t); },
          oncontextmenu: (e) => { e.preventDefault(); LX.menu.show(e.clientX, e.clientY, [{ label: 'Duplicate tab', action: () => newTab(t.url) }, { label: 'Close tab', action: () => closeTab(t) }]); } },
          H('span', { class: 'br-dot', style: { background: t.url === START ? 'var(--accent)' : color(host(t.url)) } }), H('span', { class: 'grow ellipsis', text: t.title }),
          H('button', { class: 'br-x', title: 'Close tab', 'aria-label': 'Close tab', html: LX.icon('x', 12), onclick: (e) => { e.stopPropagation(); closeTab(t); } }))));
        tabBar.append(H('button', { class: 'btn icon sm br-new', title: 'New tab (Ctrl+T)', html: LX.icon('plus', 16), onclick: () => { newTab(START); addr.focus(); } }));
      }
      function syncAddr() { if (!cur) return; addr.value = cur.url === START ? '' : (isVfs(cur.url) ? 'file://' + cur.url : cur.url); const t = cur.title; win.setTitle('Browser — ' + t); syncStar(); }
      function syncNav() { bBack.disabled = !cur || cur.hi <= 0; bFwd.disabled = !cur || cur.hi >= cur.hist.length - 1; bStar.disabled = bExt.disabled = !cur || cur.url === START; notice.classList.toggle('hidden', noticeOff || !cur || cur.url === START || isVfs(cur.url)); }
      function syncStar() { const on = cur && bms.some((b) => b.url === cur.url); bStar.classList.toggle('on', !!on); bStar.innerHTML = LX.icon('star', 16); }

      function go(url, t, replace) {
        t = t || cur; if (!t) return; const u = url || START;
        if (!replace || t.hi < 0) { t.hist = t.hist.slice(0, t.hi + 1); t.hist.push(u); t.hi = t.hist.length - 1; } else t.hist[t.hi] = u;
        show(t, u);
      }
      function hist(d) { if (!cur) return; const i = cur.hi + d; if (i < 0 || i >= cur.hist.length) return; cur.hi = i; show(cur, cur.hist[i]); }
      function reload() { if (cur) show(cur, cur.url, true); }
      function dispose(t) { if (t.frame) { t.frame.remove(); t.frame = null; } if (t.page) { t.page.remove(); t.page = null; } }
      function show(t, u, isReload) {
        t.url = u; dispose(t);
        if (u === START) { t.title = 'New tab'; t.page = startPage(t); view.append(t.page); }
        else {
          t.title = isVfs(u) ? LX.vfs.basename(u) : host(u) || u;
          const f = H('iframe', { class: 'br-frame', title: t.title, referrerpolicy: 'no-referrer', allow: '', loading: 'eager' });
          t.frame = f; view.append(f);
          if (isVfs(u)) {
            f.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups');
            let src = '';
            try { src = LX.vfs.read(u); if (/^data:/.test(src)) { const i = src.indexOf(','); src = /;base64/.test(src.slice(0, i)) ? decodeURIComponent(escape(atob(src.slice(i + 1)))) : decodeURIComponent(src.slice(i + 1)); } }
            catch (e) { src = '<body style="font:15px sans-serif;padding:32px;color:#555"><h2>Cannot open file</h2><p>' + LX.escape(u) + '</p><p>' + LX.escape(e.message) + '</p></body>'; }
            const m = /<title[^>]*>([^<]*)<\/title>/i.exec(src); if (m && m[1].trim()) t.title = m[1].trim();
            spin(true); f.addEventListener('load', () => spin(false)); f.srcdoc = src;
          } else {
            f.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-same-origin allow-popups-to-escape-sandbox');
            spin(true); f.addEventListener('load', () => spin(false)); f.addEventListener('error', () => spin(false)); setTimeout(() => spin(false), 8000); f.src = u;
          }
        }
        if (cur !== t) { const el = t.frame || t.page; el && el.classList.add('hidden'); }
        renderTabs(); if (cur === t) { syncAddr(); syncNav(); }
      }
      function spin(on) { load.classList.toggle('hidden', !on); }

      function startPage(t) {
        const input = H('input', { class: 'input br-search', type: 'text', placeholder: 'Search DuckDuckGo…', 'aria-label': 'Search',
          onkeydown: (e) => { if (e.key === 'Enter' && input.value.trim()) go(resolve(input.value), t); } });
        const grid = H('div', { class: 'br-grid' });
        const draw = () => {
          grid.innerHTML = '';
          bms.forEach((b, i) => grid.append(H('a', { class: 'br-bm', href: '#', title: b.url, onclick: (e) => { e.preventDefault(); go(b.url, t); },
            oncontextmenu: (e) => { e.preventDefault(); LX.menu.show(e.clientX, e.clientY, [{ label: 'Open', action: () => go(b.url, t) }, { label: 'Open in new tab', action: () => newTab(b.url) }, { separator: true }, { label: 'Remove bookmark', icon: 'trash', action: () => { bms.splice(i, 1); saveBm(); draw(); syncStar(); } }]); } },
            H('span', { class: 'br-fav', style: { background: color(host(b.url)) }, text: (b.title || host(b.url)).charAt(0).toUpperCase() }), H('span', { class: 'ellipsis', text: b.title || host(b.url) }))));
          if (!bms.length) grid.append(H('div', { class: 'muted', text: 'No bookmarks yet. Press the star in the toolbar to add one.' }));
        };
        draw();
        const pg = H('div', { class: 'br-start scroll' }, H('div', { class: 'br-hero' }, H('div', { class: 'br-logo', html: LX.icon('globe', 44) }), H('h1', { text: 'Leonux Browser' }), input,
          H('div', { class: 'br-sub muted', text: 'Bookmarks' }), grid,
          H('div', { class: 'br-tip muted', html: LX.icon('info', 14) + ' <span>Many websites block embedding in other pages and will show blank or an error. HTML files from your Files app open here too.</span>' }),
          H('button', { class: 'btn sm', html: LX.icon('folder', 14) + ' Open HTML file…', onclick: openHtml })));
        setTimeout(() => { if (cur === t && !addr.matches(':focus')) input.focus(); }, 50);
        return pg;
      }
      function toggleBm() {
        if (!cur || cur.url === START) return;
        const i = bms.findIndex((b) => b.url === cur.url);
        if (i >= 0) bms.splice(i, 1); else bms.push({ title: cur.title, url: cur.url });
        saveBm(); syncStar(); if (cur.url !== START) LX.notify({ title: i >= 0 ? 'Bookmark removed' : 'Bookmark added', body: cur.title, icon: 'star', appId: 'browser', timeout: 2000 });
      }
      function openExternal() { if (!cur || cur.url === START) return; if (isVfs(cur.url)) return LX.dialog.alert('Local files can only be viewed inside this browser.', 'Browser'); try { window.open(cur.url, '_blank', 'noopener'); } catch (e) { /* ignore */ } }
      function openHtml() { LX.dialog.openFile({ title: 'Open HTML file', path: LX.vfs.HOME + '/Documents', exts: ['html', 'htm'] }).then((p) => { if (p) go(p); }); }

      body.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (e.ctrlKey && k === 't') { newTab(START); } else if (e.ctrlKey && k === 'w') { closeTab(cur); } else if (e.ctrlKey && k === 'l') { addr.focus(); } else if (e.ctrlKey && k === 'r' || k === 'f5') { reload(); }
        else if (e.ctrlKey && k === 'd') { toggleBm(); } else if (e.ctrlKey && k === 'o') { openHtml(); } else if (e.altKey && k === 'arrowleft') { hist(-1); } else if (e.altKey && k === 'arrowright') { hist(1); }
        else if (e.ctrlKey && k === 'tab') { select(tabs[(tabs.indexOf(cur) + 1) % tabs.length]); } else return;
        e.preventDefault();
      });
      win.setMenu([
        { label: 'File', items: [{ label: 'New tab', shortcut: 'Ctrl+T', action: () => newTab(START) }, { label: 'Open HTML file…', shortcut: 'Ctrl+O', action: openHtml }, { label: 'Close tab', shortcut: 'Ctrl+W', action: () => closeTab(cur) }, { separator: true }, { label: 'Close window', action: () => win.close() }] },
        { label: 'View', items: [{ label: 'Reload', shortcut: 'Ctrl+R', action: reload }, { label: 'Start page', action: () => go(START) }, { label: 'Focus address bar', shortcut: 'Ctrl+L', action: () => addr.focus() }] },
        { label: 'Bookmarks', items: [{ label: 'Bookmark this page', shortcut: 'Ctrl+D', action: toggleBm }, { label: 'Reset bookmarks', action: () => { bms = DEFAULT_BM.slice(); saveBm(); reload(); } }] },
      ]);
      win.on('args', (a) => { if (a && (a.path || a.url)) newTab(a.path ? a.path : resolve(a.url)); });
      win.onClose(() => { tabs.forEach(dispose); tabs = []; });
      newTab(args && args.path ? args.path : args && args.url ? resolve(args.url) : START);
    },
  });
})();
