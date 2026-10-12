/* Leonux OS 2.2 — Spotlight (Ctrl+Space): grouped results — calculator & unit conversion, Apps (incl. store apps), Settings, Actions,
   Files (vfs.search) and a web fallback; recents when empty; prefixes ">" actions, "/" files; ⇧↵ Quick Look, Ctrl+↵ reveal. */
(function () {
  'use strict';
  const H = LX.h;
  let overlay, input, list, foot, items = [], sel = 0, q = '';

  // ---------- calculator (hand-written parser, no eval) ----------
  const FN = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, exp: Math.exp, cbrt: Math.cbrt };
  function calc(src) {
    let s = src.toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '').trim();
    let m = /^([\d.]+)\s*%\s*of\s*([\d.]+)$/.exec(s); if (m) return (+m[1]) * (+m[2]) / 100;
    if (!/^[\d\s+\-*/().%^a-z]+$/.test(s) || !/[\d]/.test(s) || !/[+\-*/^%(]|[a-z]/.test(s)) return null;
    if (/^[\d.\s]+$/.test(s)) return null;
    const tok = s.match(/\d*\.?\d+(?:e[+-]?\d+)?|[a-z]+|[+\-*/%^()]/g); if (!tok || tok.join('').length < s.replace(/\s/g, '').length) return null;
    let i = 0;
    const bad = () => { throw new Error('x'); };
    const prim = () => {
      const t = tok[i++]; if (t == null) bad();
      if (t === '(') { const v = add(); if (tok[i++] !== ')') bad(); return v; }
      if (t === '-') return -pow(); if (t === '+') return pow();
      if (t === 'pi') return Math.PI; if (t === 'e') return Math.E;
      if (FN[t]) { if (tok[i++] !== '(') bad(); const v = add(); if (tok[i++] !== ')') bad(); return FN[t](v); }
      const n = parseFloat(t); if (isNaN(n)) bad(); return n;
    };
    const pow = () => { let b = prim(); if (tok[i] === '^') { i++; b = Math.pow(b, pow()); } if (tok[i] === '%' && (i + 1 >= tok.length || tok[i + 1] === ')')) { i++; b /= 100; } return b; };
    const mul = () => { let v = pow(); while (i < tok.length && ['*', '/', '%'].indexOf(tok[i]) >= 0) { const o = tok[i++]; const r = pow(); v = o === '*' ? v * r : o === '/' ? v / r : v % r; } return v; };
    const add = () => { let v = mul(); while (tok[i] === '+' || tok[i] === '-') { const o = tok[i++]; const r = mul(); v = o === '+' ? v + r : v - r; } return v; };
    try { const v = add(); return i === tok.length && isFinite(v) ? v : null; } catch (e) { return null; }
  }
  const fmtNum = (v) => { const a = Math.abs(v); return (a !== 0 && (a >= 1e12 || a < 1e-6)) ? v.toExponential(6) : String(+v.toPrecision(12)); };

  // ---------- unit conversion ----------
  const U = {};
  const addU = (kind, base, defs) => Object.keys(defs).forEach((k) => { defs[k][0].split(' ').forEach((n) => { U[n] = { kind, f: defs[k][1], name: k }; }); });
  addU('len', 'm', { mm: ['mm millimeter millimeters millimetre millimetres', .001], cm: ['cm centimeter centimeters centimetre centimetres', .01], m: ['m meter meters metre metres', 1], km: ['km kilometer kilometers kilometre kilometres', 1000], in: ['in inch inches', .0254], ft: ['ft foot feet', .3048], yd: ['yd yard yards', .9144], mi: ['mi mile miles', 1609.344] });
  addU('mass', 'kg', { mg: ['mg milligram milligrams', 1e-6], g: ['g gram grams', .001], kg: ['kg kilogram kilograms kilo kilos', 1], lb: ['lb lbs pound pounds', .45359237], oz: ['oz ounce ounces', .0283495231], t: ['tonne tonnes', 1000] });
  addU('vol', 'l', { ml: ['ml milliliter milliliters millilitre millilitres', .001], l: ['l liter liters litre litres', 1], gal: ['gal gallon gallons', 3.785411784], qt: ['qt quart quarts', .946352946], cup: ['cup cups', .2365882365], floz: ['floz', .0295735296] });
  addU('speed', 'm/s', { 'm/s': ['m/s mps', 1], 'km/h': ['km/h kmh kph', 1 / 3.6], mph: ['mph', .44704], kn: ['kn knot knots', .514444] });
  addU('data', 'b', { B: ['b byte bytes', 1], KB: ['kb', 1024], MB: ['mb', 1048576], GB: ['gb', 1073741824], TB: ['tb', 1099511627776] });
  addU('time', 's', { s: ['s sec secs second seconds', 1], min: ['min mins minute minutes', 60], h: ['h hr hrs hour hours', 3600], day: ['day days d', 86400], week: ['week weeks', 604800] });
  const TEMP = { c: 'C', celsius: 'C', f: 'F', fahrenheit: 'F', k: 'K', kelvin: 'K', '°c': 'C', '°f': 'F' };
  function convert(src) {
    const m = /^(-?[\d.,]+)\s*([a-z°\/]+)\s+(?:to|in|into|as|=|->)\s+([a-z°\/]+)$/i.exec(src.trim()) || /^(-?[\d.,]+)\s*([a-z°\/]+)\s*(?:->|=>)\s*([a-z°\/]+)$/i.exec(src.trim());
    if (!m) return null;
    const v = parseFloat(m[1].replace(/,/g, '')), a = m[2].toLowerCase(), b = m[3].toLowerCase(); if (isNaN(v)) return null;
    if (TEMP[a] && TEMP[b]) {
      const k = TEMP[a] === 'C' ? v + 273.15 : TEMP[a] === 'F' ? (v - 32) * 5 / 9 + 273.15 : v;
      const r = TEMP[b] === 'C' ? k - 273.15 : TEMP[b] === 'F' ? (k - 273.15) * 9 / 5 + 32 : k;
      return { value: r, text: fmtNum(v) + ' °' + TEMP[a] + ' = ' + fmtNum(+r.toFixed(4)) + ' °' + TEMP[b] };
    }
    const ua = U[a], ub = U[b]; if (!ua || !ub || ua.kind !== ub.kind) return null;
    const r = v * ua.f / ub.f; return { value: r, text: fmtNum(v) + ' ' + ua.name + ' = ' + fmtNum(+r.toPrecision(8)) + ' ' + ub.name };
  }

  // ---------- fuzzy score ----------
  function score(text, ql) {
    const t = text.toLowerCase(); if (!ql) return 1;
    if (t === ql) return 100; if (t.indexOf(ql) === 0) return 80;
    const wi = t.indexOf(' ' + ql); if (wi >= 0) return 65;
    if (t.indexOf(ql) >= 0) return 45;
    let i = 0; for (let j = 0; j < t.length && i < ql.length; j++) if (t[j] === ql[i]) i++;
    return i === ql.length && ql.length > 2 ? 15 : 0;
  }
  const hi = (label, ql) => { const i = ql ? label.toLowerCase().indexOf(ql) : -1; return i < 0 ? [label] : [label.slice(0, i), H('b', { text: label.slice(i, i + ql.length) }), label.slice(i + ql.length)]; };

  // ---------- providers ----------
  const S = () => LX.settings;
  function actions() {
    const A = (id, label, icon, run, kw) => ({ k: 'action:' + id, label, icon, group: 'Actions', kw: kw || '', run });
    return [
      A('lock', 'Lock screen', 'lock', () => LX.power.lock(), 'sleep secure'), A('sleep', 'Sleep', 'moon', () => LX.power.sleep()),
      A('restart', 'Restart', 'refresh', () => LX.power.restart(), 'reboot'), A('shutdown', 'Shut down', 'power', () => LX.power.shutdown(), 'power off'),
      A('theme', 'Toggle dark / light theme', 'moon', () => S().set('theme', LX.theme.isDark() ? 'light' : 'dark'), 'appearance mode'),
      A('dnd', 'Toggle Do Not Disturb', 'bell', () => LX.focus.toggle('dnd'), 'focus notifications'), A('work', 'Turn on Work focus', 'zap', () => LX.focus.toggle('work'), 'focus'), A('sleepf', 'Turn on Sleep focus', 'moon', () => LX.focus.toggle('sleep'), 'focus night'),
      A('desktop', 'Show desktop', 'monitor', () => LX.wm.showDesktop()), A('mc', 'Mission Control', 'columns', () => LX.spaces.missionControl(), 'spaces desktops overview'),
      A('nextspace', 'Next desktop', 'chevron-right', () => LX.spaces.next(), 'space'), A('ss', 'Start screen saver', 'image', () => LX.screensaver.start()),
      A('launchpad', 'Open Launchpad', 'grid', () => LX.panels.open('launcher'), 'apps launcher'),
      A('layout', S().get('layout') === 'taskbar' ? 'Switch to Dock + Menu bar' : 'Switch to classic Taskbar', 'rocket', () => S().set('layout', S().get('layout') === 'taskbar' ? 'dock+menubar' : 'taskbar'), 'dock layout'),
      A('newfolder', 'New folder on Desktop', 'folder-plus', () => LX.desktop && LX.desktop.newItem('dir')), A('trash', 'Empty Trash', 'trash', () => { try { LX.vfs.emptyTrash(); LX.notify({ title: 'Trash emptied', icon: 'trash' }); } catch (e) {} }),
      A('closeall', 'Close all windows', 'x', () => LX.wm.closeAll(), 'quit'), A('store', 'Open App Store', 'store', () => LX.apps.launch('softwarecenter'), 'software install'),
    ];
  }
  function settingsHits() {
    const KW = { network: 'wifi internet wi-fi', sound: 'volume audio speaker', display: 'screen brightness resolution night', appearance: 'wallpaper theme accent dark light colors', datetime: 'clock time date timezone', accounts: 'user password login', power: 'battery sleep', hotcorners: 'corners', menubar: 'dock layout taskbar', screensaver: 'focus idle', windows: 'titlebar snap', personalization: 'dock taskbar', shortcuts: 'keyboard keys' };
    return (LX.settingsPages ? LX.settingsPages.list() : []).map((p) => ({ k: 'setting:' + p.id, label: p.title, sub: 'Settings · ' + p.group, icon: p.icon || 'settings', group: 'Settings', kw: p.id + ' ' + (KW[p.id] || ''), run: () => LX.apps.launch('settings', { page: p.id }) }));
  }
  function appHits() {
    return LX.apps.list().filter((a) => a.id !== 'files-props').map((a) => {
      const uninstalled = a.pkg && a.hidden;
      return { k: 'app:' + a.id, label: a.name, sub: uninstalled ? 'Not installed — get it in the App Store' : a.category, icon: a.icon, color: a.color, group: 'Apps', kw: (a.category || '') + ' ' + (a.desc || ''), hiddenApp: a.hidden && !uninstalled, uninstalled, run: () => LX.apps.launch(a.id) };
    }).filter((a) => !a.hiddenApp);
  }
  const fileItem = (s) => ({ k: 'file:' + s.path, label: s.name, sub: s.path.replace(LX.vfs.HOME, '~'), icon: s.type === 'dir' ? 'folder' : (LX.fileIcon ? LX.fileIcon(s)[0] : 'file'), color: LX.fileIcon ? LX.fileIcon(s)[1] : null, group: 'Files', path: s.path, isDir: s.type === 'dir', run: () => (s.type === 'dir' ? LX.apps.launch('files', { path: s.path }) : LX.apps.openFile(s.path)) });

  const recents = () => LX.store.get('search.recent', []);
  function remember(it) {
    if (!it.k || it.k.indexOf('calc') === 0) return;
    const r = recents().filter((x) => x !== it.k); r.unshift(it.k); LX.store.set('search.recent', r.slice(0, 8));
  }
  function resolve(key) {
    const [t, ...rest] = key.split(':'), id = rest.join(':');
    if (t === 'app') return appHits().find((x) => x.k === key);
    if (t === 'setting') return settingsHits().find((x) => x.k === key);
    if (t === 'action') return actions().find((x) => x.k === key);
    if (t === 'file') { try { return fileItem(LX.vfs.stat(id)); } catch (e) { return null; } }
    return null;
  }

  function gather(raw) {
    const out = []; let query = raw.trim(); let only = null;
    if (!query) {
      recents().map(resolve).filter(Boolean).forEach((it) => out.push(Object.assign({}, it, { group: 'Recent' })));
      const have = new Set(out.map((x) => x.k));
      appHits().filter((a) => !a.uninstalled && !have.has(a.k)).slice(0, out.length ? 5 : 8).forEach((a) => out.push(Object.assign({}, a, { group: 'Suggestions' })));
      return out;
    }
    if (query[0] === '>') { only = 'Actions'; query = query.slice(1).trim(); } else if (query[0] === '/' || query[0] === '~') { only = 'Files'; query = query.replace(/^[/~]+/, '').trim(); }
    const ql = query.toLowerCase();
    if (!only) {
      const cq = query.replace(/^(calc(ulate)?\s*[:=]?|=)\s*/i, '') || query; const cv = convert(cq); if (cv) out.push({ k: 'calc', label: cv.text, sub: 'Conversion · ↵ copies the result', icon: 'refresh', group: 'Conversion', big: true, run: () => LX.clipboard.copy(fmtNum(+cv.value.toPrecision(10))) });
      else { const c = calc(cq); if (c != null) out.push({ k: 'calc', label: '= ' + fmtNum(c), sub: cq + ' · ↵ copies the result', icon: 'calculator', group: 'Calculator', big: true, run: () => LX.clipboard.copy(fmtNum(c)) }); }
    }
    const rank = (arr, fields, n) => arr.map((it) => ({ it, s: Math.max(score(it.label, ql) * 1.2, fields ? score(it.kw || '', ql) * .6 : 0, score(it.sub || '', ql) * .3) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.it);
    if (!only) {
      rank(appHits(), true, 7).forEach((x) => out.push(x));
      rank(settingsHits(), true, 4).forEach((x) => out.push(x));
    }
    if (!only || only === 'Actions') rank(actions(), true, only ? 12 : 4).forEach((x) => out.push(x));
    if (!only || only === 'Files') { try { LX.vfs.search(query, only ? 30 : 7).forEach((s) => out.push(fileItem(s))); } catch (e) {} }
    if (!only && LX.apps.get('browser')) out.push({ k: 'web', label: 'Search the web for “' + query + '”', icon: 'globe', group: 'Web', run: () => LX.apps.launch('browser', { url: query }) });
    out.forEach((x) => { x.ql = ql; });
    return out;
  }

  function render() {
    list.innerHTML = '';
    let g = null, shown = 0;
    items.forEach((it, i) => {
      if (it.group !== g) { g = it.group; list.appendChild(H('div', { class: 'srch-group', text: g })); }
      const ic = H('span', { class: 'srch-ico', style: it.color ? { color: it.color } : null, html: LX.icon(it.icon || 'search', 17) });
      list.appendChild(H('div', { class: 'srch-item' + (i === sel ? ' sel' : '') + (it.big ? ' big' : ''), dataset: { i }, onmouseenter: () => { if (sel !== i) { sel = i; paint(); } }, onclick: () => pick(i) },
        ic, H('span', { class: 'srch-lbl' }, H('span', { class: 'srch-t' }, it.big ? it.label : hi(it.label, it.ql)), it.sub && H('small', { text: it.sub })),
        H('span', { class: 'srch-r' }, it.k && it.k.indexOf('app:') === 0 && LX.wm.list().some((w) => w.appId === it.k.slice(4)) ? H('span', { class: 'srch-run', title: 'Running' }) : null, H('span', { class: 'srch-key kbd', text: '↵' }))));
      shown++;
    });
    if (!items.length) list.appendChild(H('div', { class: 'srch-none' }, H('div', { html: LX.icon('search', 26) }), H('div', { text: 'No results for “' + q + '”' }), H('small', { class: 'muted', text: 'Try an app name, a file, a setting, or a calculation like 12 * 7 or 5 km in mi' })));
    list.classList.toggle('empty', !items.length);
    hint();
  }
  function paint() {
    LX.$$('.srch-item', list).forEach((c) => c.classList.toggle('sel', +c.dataset.i === sel));
    const s = list.querySelector('.srch-item.sel'); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' });
    hint();
  }
  function hint() {
    if (!foot) return; const it = items[sel]; foot.innerHTML = '';
    const k = (t) => H('span', { class: 'kbd', text: t });
    foot.append(k('↑'), k('↓'), ' navigate ', k('↵'), it && it.k === 'calc' ? ' copy result ' : ' open ');
    if (it && it.path && !it.isDir) foot.append(k('⇧↵'), ' Quick Look ');
    if (it && it.path) foot.append(k('Ctrl↵'), ' reveal ');
    if (!q) foot.append(H('span', { class: 'grow' }), H('span', { class: 'muted', text: 'Type  > actions   / files   5 km in mi   12*7' })); else foot.append(H('span', { class: 'grow' }), k('Esc'), ' close');
  }
  function pick(i, mod) {
    const it = items[i]; if (!it) return;
    if (it.path && mod === 'ql' && !it.isDir) { LX.quicklook.show(it.path, { siblings: items.filter((x) => x.path && !x.isDir).map((x) => x.path) }); close(true); return; }
    if (it.path && mod === 'reveal') { close(); setTimeout(() => LX.apps.launch('files', { path: it.isDir ? it.path : LX.vfs.dirname(it.path) }), 0); remember(it); return; }
    close(); remember(it); setTimeout(it.run, 0);
  }
  function refresh() { items = gather(input.value); sel = Math.min(sel, Math.max(0, items.length - 1)); q = input.value.trim(); render(); }
  function open() {
    LX.panels.close(); LX.menu.close(); overlay.classList.add('open'); input.value = ''; sel = 0; q = ''; refresh(); setTimeout(() => input.focus(), 30);
  }
  function close(keep) { overlay.classList.remove('open'); input.blur(); }
  LX.search = { open, close, toggle: () => (overlay.classList.contains('open') ? close() : open()), calc, convert };
  LX.onInit(() => {
    overlay = document.getElementById('search'); if (!overlay) return;
    input = H('input', { class: 'srch-input', placeholder: 'Spotlight Search', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Search',
      oninput: () => { sel = 0; refresh(); },
      onkeydown: (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); if (input.value) { input.value = ''; sel = 0; refresh(); } else close(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
        else if (e.key === 'Tab') { e.preventDefault(); sel = items.length ? (sel + (e.shiftKey ? -1 : 1) + items.length) % items.length : 0; paint(); }
        else if (e.key === 'Enter') { e.preventDefault(); pick(sel, e.shiftKey ? 'ql' : (e.ctrlKey || e.metaKey) ? 'reveal' : null); }
        else if (e.altKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); pick(+e.key - 1); }
      } });
    list = H('div', { class: 'srch-list scroll' }); foot = H('div', { class: 'srch-foot' });
    overlay.appendChild(H('div', { class: 'srch-box' }, H('div', { class: 'srch-bar' }, H('span', { html: LX.icon('search', 20) }), input), list, foot));
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
    LX.bus.on('settings:change', () => { if (overlay.classList.contains('open')) refresh(); });
  });
})();
