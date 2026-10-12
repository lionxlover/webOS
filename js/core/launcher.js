/* Leonux OS 2.2 — Launchpad: full-screen paged app grid with search, category chips, page dots, arrow / wheel / swipe paging,
   quick power row. Works in both the dock + menubar and classic taskbar layouts. */
(function () {
  'use strict';
  const H = LX.h;
  let panel, input, viewport, track, dotsEl, query = '', sel = 0, cat = 'all', page = 0, pages = 1, per = 28, cols = 7, matches = [], chipsEl, wheelLock = 0;
  const CATS = [['all', 'All', 'grid'], ['recent', 'Recent', 'clock'], ['sys', 'System', 'settings'], ['prod', 'Productivity', 'sticky'], ['internet', 'Internet', 'globe'], ['media', 'Media', 'music'], ['games', 'Games', 'gamepad'], ['dev', 'Developer', 'code']];
  const mapCat = (c) => ({ System: 'sys', Productivity: 'prod', Internet: 'internet', Media: 'media', Games: 'games', Developer: 'dev', Utilities: 'sys', Other: 'sys' })[c] || 'sys';
  const visible = () => LX.apps.visible();
  const recent = () => LX.store.get('launcher.recent', []);
  const motion = () => LX.wm.motion();

  function launch(id) {
    LX.panels.close();
    const r = recent().filter((x) => x !== id); r.unshift(id);
    LX.store.set('launcher.recent', r.slice(0, 12));
    setTimeout(() => LX.apps.launch(id), 60);
  }
  function appBtn(a, i) {
    const running = LX.wm.list().some((w) => w.appId === a.id);
    return H('button', { class: 'lp-app' + (query && i === sel ? ' sel' : ''), title: a.desc || a.name, dataset: { id: a.id }, style: { '--i': i % per },
      onclick: () => launch(a.id),
      oncontextmenu: (e) => { e.preventDefault(); e.stopPropagation(); const pinned = (LX.settings.get('pinned') || []).indexOf(a.id) >= 0; LX.menu.show(e.clientX, e.clientY, [
        { label: 'Open', icon: 'external', action: () => launch(a.id) },
        { label: 'New window', icon: 'plus', disabled: !!a.singleton, action: () => { LX.panels.close(); LX.apps.launch(a.id); } },
        a.pkg && { label: 'Uninstall', icon: 'trash', danger: true, action: () => { if (LX.packages.uninstall(a.id)) LX.notify({ title: a.name + ' uninstalled', body: 'Removed from Leonux.', icon: 'trash' }); } },
        { separator: true },
        { label: pinned ? 'Remove from dock' : 'Keep in dock', icon: 'pin', action: () => { const p = (LX.settings.get('pinned') || []).slice(); LX.settings.set('pinned', pinned ? p.filter((x) => x !== a.id) : p.concat(a.id)); } }].filter(Boolean)); } },
      H('span', { class: 'lp-ico', style: { background: 'linear-gradient(145deg,' + a.color + ',' + a.color + '99)' }, html: LX.icon(a.icon, 34) }),
      H('span', { class: 'lp-name', text: a.name }), running && H('span', { class: 'lp-run' }));
  }

  function currentList() {
    const q = query.trim().toLowerCase();
    let all = visible().slice();
    if (q) return all.map((a) => ({ a, s: Math.max(a.name.toLowerCase().indexOf(q) === 0 ? 3 : a.name.toLowerCase().indexOf(q) > 0 ? 2 : 0, (a.category + ' ' + (a.desc || '')).toLowerCase().indexOf(q) >= 0 ? 1 : 0) })).filter((x) => x.s).sort((x, y) => y.s - x.s || x.a.name.localeCompare(y.a.name)).map((x) => x.a);
    if (cat === 'recent') return recent().map((id) => LX.apps.get(id)).filter((a) => a && !a.hidden);
    if (cat !== 'all') all = all.filter((a) => mapCat(a.category) === cat);
    const pin = LX.settings.get('pinned') || [];
    return all.sort((a, b) => { const pa = pin.indexOf(a.id), pb = pin.indexOf(b.id); if (pa >= 0 || pb >= 0) return (pa < 0 ? 999 : pa) - (pb < 0 ? 999 : pb); return a.name.localeCompare(b.name); });
  }
  function metrics() {
    const w = Math.max(320, innerWidth - 120), h = Math.max(220, innerHeight - 270);
    cols = LX.clamp(Math.floor(w / 128), 3, 8); const rows = LX.clamp(Math.floor(h / 128), 2, 5); per = cols * rows;
    panel.style.setProperty('--lp-cols', cols);
  }
  function render() {
    metrics();
    matches = currentList();
    if (query) sel = LX.clamp(sel, 0, Math.max(0, matches.length - 1));
    pages = Math.max(1, Math.ceil(matches.length / per)); page = LX.clamp(page, 0, pages - 1);
    track.innerHTML = '';
    if (!matches.length) track.appendChild(H('div', { class: 'lp-page' }, H('div', { class: 'lp-none' }, H('div', { html: LX.icon('search', 34) }), H('div', { text: query ? 'No apps match “' + query + '”' : cat === 'recent' ? 'Apps you open will show up here' : 'Nothing in this category yet' }), H('button', { class: 'btn sm', text: 'Browse the App Store', onclick: () => launch('softwarecenter') }))));
    for (let p = 0; p < pages && matches.length; p++) track.appendChild(H('div', { class: 'lp-page' }, H('div', { class: 'lp-grid' }, matches.slice(p * per, (p + 1) * per).map((a, i) => appBtn(a, p * per + i)))));
    dotsEl.innerHTML = '';
    if (pages > 1) for (let p = 0; p < pages; p++) dotsEl.appendChild(H('button', { class: 'lp-dot' + (p === page ? ' on' : ''), 'aria-label': 'Page ' + (p + 1), onclick: () => go(p) }));
    LX.$$('.lp-chip', chipsEl).forEach((el) => el.classList.toggle('on', !query && el.dataset.cat === cat));
    chipsEl.classList.toggle('dim', !!query);
    place(false);
  }
  function place(anim) { track.style.transition = anim && motion() ? '' : 'none'; track.style.transform = 'translateX(' + (-page * 100) + '%)'; if (!anim) { void track.offsetWidth; track.style.transition = ''; } LX.$$('.lp-dot', dotsEl).forEach((d, i) => d.classList.toggle('on', i === page)); }
  function go(p) { const n = LX.clamp(p, 0, pages - 1); if (n === page) { track.classList.add('bump'); setTimeout(() => track.classList.remove('bump'), 220); return; } page = n; place(true); }
  function select(i) { sel = LX.clamp(i, 0, matches.length - 1); const p = Math.floor(sel / per); if (p !== page) { page = p; place(true); } LX.$$('.lp-app', track).forEach((b) => b.classList.toggle('sel', !!query && !!matches[sel] && b.dataset.id === matches[sel].id)); }

  LX.launcher = { toggle: () => LX.panels.toggle('launcher'), open: () => LX.panels.open('launcher') };
  LX.onInit(() => {
    panel = document.getElementById('launcher'); if (!panel) return;
    input = H('input', { class: 'lp-search', placeholder: 'Search', 'aria-label': 'Search apps', spellcheck: 'false', autocomplete: 'off', oninput: () => { query = input.value; sel = 0; page = 0; render(); } });
    chipsEl = H('div', { class: 'lp-chips' }, CATS.map((c) => H('button', { class: 'lp-chip' + (c[0] === 'all' ? ' on' : ''), dataset: { cat: c[0] }, onclick: () => { cat = c[0]; page = 0; query = ''; input.value = ''; render(); } }, H('span', { html: LX.icon(c[2], 14) }), c[1])));
    track = H('div', { class: 'lp-track' }); viewport = H('div', { class: 'lp-viewport' }, track);
    dotsEl = H('div', { class: 'lp-dots' });
    const pw = H('div', { class: 'lp-power' },
      H('button', { class: 'lp-pbtn', title: 'App Store', html: LX.icon('store', 17), onclick: () => launch('softwarecenter') }),
      H('button', { class: 'lp-pbtn', title: 'Settings', html: LX.icon('settings', 17), onclick: () => launch('settings') }),
      H('button', { class: 'lp-pbtn', title: 'Mission Control', html: LX.icon('columns', 17), onclick: () => { LX.panels.close(); setTimeout(() => LX.spaces.missionControl(), 120); } }),
      H('button', { class: 'lp-pbtn', title: 'Lock', html: LX.icon('lock', 17), onclick: () => { LX.panels.close(); LX.power.lock(); } }),
      H('button', { class: 'lp-pbtn', title: 'Shut down', html: LX.icon('power', 17), onclick: () => { LX.panels.close(); LX.power.shutdown(); } }));
    panel.append(H('div', { class: 'lp-top' }, H('div', { class: 'lp-sbox' }, H('span', { html: LX.icon('search', 15) }), input), chipsEl), viewport, H('div', { class: 'lp-bottom' }, H('div', { class: 'lp-hint muted', text: 'Esc to close · ← → to turn pages' }), dotsEl, pw));
    // swipe / drag paging; a click on the empty backdrop closes
    const dragSwipe = { x0: 0, on: false, moved: false };
    panel.addEventListener('pointerdown', (e) => { if (e.button !== 0 || !e.target.closest('.lp-viewport,.lp-top,.lp-bottom') && e.target !== panel) return; if (e.target.closest('.lp-chip,.lp-search,.lp-pbtn,.lp-dot')) return; dragSwipe.x0 = e.clientX; dragSwipe.on = true; dragSwipe.moved = false; });
    document.addEventListener('pointermove', (e) => { if (dragSwipe.on && Math.abs(e.clientX - dragSwipe.x0) > 10) { dragSwipe.moved = true; track.style.transition = 'none'; track.style.transform = 'translateX(calc(' + (-page * 100) + '% + ' + (e.clientX - dragSwipe.x0) + 'px))'; } });
    document.addEventListener('pointerup', (e) => {
      if (!dragSwipe.on) return; dragSwipe.on = false; const dx = e.clientX - dragSwipe.x0;
      if (dragSwipe.moved) { track.style.transition = ''; if (Math.abs(dx) > 70) go(page + (dx < 0 ? 1 : -1)); else place(true); setTimeout(() => { dragSwipe.moved = false; }, 0); }
      else if (!e.target.closest('.lp-app,.lp-chip,.lp-search,.lp-pbtn,.lp-dot,.lp-none')) LX.panels.close();
    });
    panel.addEventListener('click', (e) => { if (dragSwipe.moved) { e.stopPropagation(); e.preventDefault(); } }, true);
    panel.addEventListener('wheel', (e) => { if (!panel.classList.contains('open')) return; const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (Math.abs(d) < 8 || Date.now() - wheelLock < 380) return; wheelLock = Date.now(); go(page + (d > 0 ? 1 : -1)); }, { passive: true });
    panel.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'Escape') { e.stopPropagation(); if (query) { input.value = ''; query = ''; render(); } else LX.panels.close(); return; }
      if (k === 'ArrowRight') { if (query && matches.length) { e.preventDefault(); select(sel + 1); } else if (!input.value || input.selectionStart === input.value.length) { e.preventDefault(); go(page + 1); } }
      else if (k === 'ArrowLeft') { if (query && matches.length) { e.preventDefault(); select(sel - 1); } else if (!input.value) { e.preventDefault(); go(page - 1); } }
      else if (k === 'ArrowDown' && query) { e.preventDefault(); select(sel + cols); } else if (k === 'ArrowUp' && query) { e.preventDefault(); select(sel - cols); }
      else if (k === 'PageDown') { e.preventDefault(); go(page + 1); } else if (k === 'PageUp') { e.preventDefault(); go(page - 1); }
      else if (k === 'Tab' && !query) { e.preventDefault(); const i = CATS.findIndex((c) => c[0] === cat); cat = CATS[(i + (e.shiftKey ? -1 : 1) + CATS.length) % CATS.length][0]; page = 0; render(); }
      else if (k === 'Enter') { const a = matches[query ? sel : 0]; if (a && query) launch(a.id); }
    });
    LX.panels.register('launcher', panel, { onOpen() { query = ''; cat = 'all'; page = 0; sel = 0; input.value = ''; render(); setTimeout(() => input.focus(), 60); }, onClose() { input.blur(); } });
    const live = () => { if (LX.panels.current() === 'launcher') render(); };
    LX.bus.on('apps:change', live); LX.bus.on('packages:change', live); window.addEventListener('resize', LX.debounce(live, 120));
  });
})();
