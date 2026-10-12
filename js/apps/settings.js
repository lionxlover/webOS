/* Leonux Web OS — Settings app shell + core pages (Display, Sound, Date & Time, Accounts, Apps) */
(function () {
  'use strict';
  const H = LX.h;
  const pages = [];
  let selfChange = false;

  // ---- shared UI helpers for settings pages ----
  const ui = {
    set(key, val) { selfChange = true; try { LX.settings.set(key, val); } finally { selfChange = false; } },
    page(title, ...kids) { return H('div', { class: 'st-page' }, H('h2', { class: 'st-h', text: title }), kids); },
    group(title, ...rows) { return H('div', { class: 'st-group' }, title ? H('div', { class: 'st-gt', text: title }) : null, H('div', { class: 'st-card' }, rows)); },
    row(label, desc, control) {
      return H('div', { class: 'st-row' }, H('div', { class: 'st-rl' }, H('div', { class: 'st-lbl', text: label }), desc ? H('div', { class: 'st-desc muted', text: desc }) : null), control ? H('div', { class: 'st-ctl' }, control) : null);
    },
    toggle(key, cb) {
      const inp = H('input', { type: 'checkbox', 'aria-label': key });
      inp.checked = !!LX.settings.get(key);
      inp.addEventListener('change', () => { ui.set(key, inp.checked); if (cb) cb(inp.checked); });
      return H('label', { class: 'switch' }, inp, H('span'));
    },
    slider(key, min, max, step, fmt) {
      const out = H('span', { class: 'st-val muted' });
      const inp = H('input', { type: 'range', class: 'slider', min, max, step: step || 1 });
      inp.value = LX.settings.get(key);
      const show = () => { out.textContent = fmt ? fmt(+inp.value) : inp.value; };
      show();
      inp.addEventListener('input', () => { show(); ui.set(key, +inp.value); });
      return H('div', { class: 'st-slider' }, inp, out);
    },
    select(key, opts, cb) {
      const s = H('select', { class: 'select' }, opts.map((o) => H('option', { value: o.v, text: o.l })));
      s.value = LX.settings.get(key);
      s.addEventListener('change', () => { ui.set(key, s.value); if (cb) cb(s.value); });
      return s;
    },
    seg(key, opts) {
      const wrap = H('div', { class: 'st-seg' });
      const paint = () => wrap.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(LX.settings.get(key))));
      opts.forEach((o) => wrap.appendChild(H('button', { class: 'btn sm', dataset: { v: o.v }, text: o.l, onclick: () => { ui.set(key, o.v); paint(); } })));
      paint(); return wrap;
    },
  };

  LX.settingsPages = {
    ui,
    add(def) { const i = pages.findIndex((p) => p.id === def.id); if (i >= 0) pages.splice(i, 1); pages.push(Object.assign({ order: 50, group: 'System', icon: 'settings' }, def)); },
    list() { return pages.slice().sort((a, b) => a.order - b.order); },
  };

  // ---- core pages ----
  LX.settingsPages.add({ id: 'display', title: 'Display', icon: 'monitor', group: 'Personal', order: 20, render(c) {
    const res = [{ v: '1920x1080', l: '1920 × 1080 (16:9)' }, { v: '1600x900', l: '1600 × 900' }, { v: '1366x768', l: '1366 × 768' }];
    c.appendChild(ui.page('Display',
      ui.group('Brightness & colour',
        ui.row('Brightness', 'Dims the whole screen', ui.slider('brightness', 20, 100, 1, (v) => v + '%')),
        ui.row('Night light', 'Warmer colours for the evening', ui.toggle('nightLight'))),
      ui.group('Screen',
        ui.row('Resolution', 'Simulated: the web display scales automatically', ui.select('resolution', res)),
        ui.row('Display scaling', 'Applies to all text', ui.slider('fontScale', 80, 140, 5, (v) => v + '%')),
        ui.row('Current viewport', 'Real size of this browser window', H('span', { class: 'muted', text: innerWidth + ' × ' + innerHeight, 'data-vp': '' })))));
    if (LX.settings.get('resolution') == null) LX.$('select', c).value = '1920x1080';
  } });

  LX.settingsPages.add({ id: 'sound', title: 'Sound', icon: 'volume', group: 'Personal', order: 21, render(c) {
    const test = () => { LX.audio.beep(523, 0.12, 'sine', 0.25); setTimeout(() => LX.audio.beep(659, 0.12, 'sine', 0.25), 130); setTimeout(() => LX.audio.beep(784, 0.2, 'sine', 0.25), 260); };
    // ---- sound packs (from repositories) ----
    const packs = H('div', { class: 'st-packlist' });
    function drawPacks() {
      packs.innerHTML = '';
      const active = LX.audio.activePackId();
      LX.audio.packList().forEach((p) => {
        const on = p.id === active;
        packs.appendChild(H('div', { class: 'st-pack' + (on ? ' on' : '') },
          H('button', { class: 'st-pack-main', onclick: () => { LX.settings.set('soundPack', p.id); LX.audio.event('notify'); drawPacks(); } },
            H('span', { class: 'st-pack-ico', html: LX.icon('volume', 16) }),
            H('span', { class: 'grow', style: { minWidth: 0 } }, H('div', { class: 'st-lbl', text: p.name }), H('div', { class: 'st-desc muted', text: p.builtIn ? 'The classic Leonux sounds' : 'Installed from a store repository' })),
            on ? H('span', { class: 'badge', text: 'Active' }) : H('span', { class: 'muted', style: { fontSize: '11px' }, text: 'Apply' })),
          !p.builtIn ? H('button', { class: 'btn sm ghost', title: 'Preview', html: LX.icon('play', 13), onclick: () => LX.audio.playFrom(p.id, 'startup') }) : null,
          !p.builtIn ? H('button', { class: 'btn sm ghost', title: 'Uninstall pack', html: LX.icon('trash', 13), onclick: async () => { if (await LX.dialog.confirm('Remove ' + p.name + '? System sounds fall back to the built-in pack.', 'Remove sound pack')) { LX.repos.uninstall('soundpack', p.id); drawPacks(); } } }) : null));
      });
      if (!LX.audio.packList().length) packs.appendChild(H('div', { class: 'st-empty muted', text: 'No sound packs installed.' }));
    }
    drawPacks();
    const offPack = LX.bus.on('repos:change', () => drawPacks());
    c.appendChild(ui.page('Sound',
      ui.group('Output',
        ui.row('Master volume', null, ui.slider('volume', 0, 100, 1, (v) => v + '%')),
        ui.row('Mute', 'Silence all system sounds', ui.toggle('muted', (m) => { const sl = LX.$('.slider', c); if (m) { ui.set('volumePrev', LX.settings.get('volume') || 70); ui.set('volume', 0); } else ui.set('volume', LX.settings.get('volumePrev') || 70); sl.value = LX.settings.get('volume'); sl.dispatchEvent(new Event('input')); })),
        ui.row('Output device', 'Simulated', ui.select('audioOut', [{ v: 'speakers', l: 'Built-in Speakers' }, { v: 'headphones', l: 'Headphones' }, { v: 'hdmi', l: 'HDMI Audio' }])),
        ui.row('Test sound', null, H('button', { class: 'btn sm', html: LX.icon('play', 14) + ' Play', onclick: test }))),
      ui.group('Sound packs', packs,
        H('div', { class: 'st-row' },
          H('div', { class: 'st-rl' }, H('div', { class: 'st-lbl', text: 'Get more packs' }), H('div', { class: 'st-desc muted', text: 'Live sound packs from your store repositories' })),
          H('div', { class: 'st-ctl' }, H('button', { class: 'btn sm', html: LX.icon('store', 14) + ' App Store', onclick: () => LX.apps.launch('softwarecenter', { view: 'soundpacks' }) })))),
      ui.group('Alerts',
        ui.row('Notification sounds', 'Play a chime for new notifications', ui.toggle('notifSound')),
        ui.row('Do not disturb', 'Hide notification popups', ui.toggle('dnd')))));
    if (LX.settings.get('audioOut') == null) LX.$('select', c).value = 'speakers';
    return () => offPack();
  } });

  LX.settingsPages.add({ id: 'datetime', title: 'Date & Time', icon: 'clock', group: 'Personal', order: 22, render(c) {
    const now = H('div', { class: 'st-bigclock' });
    const date = H('div', { class: 'muted' });
    const tick = () => { now.textContent = LX.fmtTime(Date.now(), true); date.textContent = LX.fmtDate(Date.now()); };
    tick();
    const t = setInterval(tick, 1000);
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
    c.appendChild(ui.page('Date & Time',
      H('div', { class: 'st-card st-clockcard' }, now, date),
      ui.group('Format',
        ui.row('24-hour clock', 'Use 14:05 instead of 2:05 PM', ui.toggle('clock24', tick)),
        ui.row('Time zone', 'Detected from your browser', H('span', { class: 'muted', text: tz })),
        ui.row('Language', null, ui.select('lang', [{ v: 'en', l: 'English' }, { v: 'es', l: 'Español' }, { v: 'fr', l: 'Français' }, { v: 'de', l: 'Deutsch' }, { v: 'hi', l: 'हिन्दी' }])))));
    return () => clearInterval(t);
  } });

  LX.settingsPages.add({ id: 'accounts', title: 'Accounts', icon: 'user', group: 'Personal', order: 23, render(c) {
    const S = LX.settings;
    const field = (key, ph) => { const i = H('input', { class: 'input', placeholder: ph, value: S.get(key) || '' }); i.addEventListener('change', () => { const v = i.value.trim(); if (!v) { i.value = S.get(key); return; } ui.set(key, v); avatar(); }); return i; };
    const av = H('div', { class: 'st-avatar' }); const nm = H('div', { class: 'st-name' }); const un = H('div', { class: 'muted' });
    function avatar() { av.textContent = (S.get('fullname') || '?').trim().charAt(0).toUpperCase(); nm.textContent = S.get('fullname'); un.textContent = '@' + S.get('username') + ' · ' + S.get('hostname'); }
    avatar();
    const pw = H('input', { class: 'input', type: 'password', placeholder: 'New password (empty = none)' });
    const pw2 = H('input', { class: 'input', type: 'password', placeholder: 'Confirm password' });
    const msg = H('div', { class: 'st-msg muted' });
    const status = () => { msg.textContent = S.get('password') ? 'Lock screen password is set.' : 'No password: the lock screen opens without one.'; msg.style.color = ''; };
    status();
    const save = () => {
      if (pw.value !== pw2.value) { msg.textContent = 'Passwords do not match.'; msg.style.color = 'var(--danger)'; return; }
      ui.set('password', pw.value); pw.value = pw2.value = ''; status(); LX.notify({ title: 'Account', body: S.get('password') ? 'Password updated.' : 'Password removed.', icon: 'lock' });
    };
    c.appendChild(ui.page('Accounts',
      H('div', { class: 'st-card st-profile' }, av, H('div', {}, nm, un)),
      ui.group('Profile',
        ui.row('Full name', null, field('fullname', 'Full name')),
        ui.row('Username', null, field('username', 'username')),
        ui.row('Computer name', 'Shown in the terminal and About', field('hostname', 'hostname'))),
      ui.group('Lock screen password',
        ui.row('New password', null, pw), ui.row('Confirm', null, pw2),
        H('div', { class: 'st-row' }, msg, H('div', { class: 'st-ctl' }, H('button', { class: 'btn sm', text: 'Remove', onclick: () => { ui.set('password', ''); status(); } }), H('button', { class: 'btn primary sm', text: 'Save password', onclick: save }))),
        ui.row('Auto lock', 'Lock after 5 minutes of inactivity', ui.toggle('autoLock')))));
  } });

  LX.settingsPages.add({ id: 'apps', title: 'Apps', icon: 'grid', group: 'System', order: 30, render(c) {
    const q = H('input', { class: 'input', placeholder: 'Search apps…' });
    const list = H('div', { class: 'st-card st-applist' });
    const draw = () => {
      list.innerHTML = '';
      const pinned = LX.settings.get('pinned') || [];
      const f = q.value.toLowerCase();
      LX.apps.list().filter((a) => !a.hidden && (!f || a.name.toLowerCase().indexOf(f) >= 0)).sort((a, b) => a.name.localeCompare(b.name)).forEach((a) => {
        const isP = pinned.indexOf(a.id) >= 0;
        list.appendChild(H('div', { class: 'st-row' },
          H('div', { class: 'st-appico', style: { background: a.color }, html: LX.icon(a.icon, 18) }),
          H('div', { class: 'st-rl' }, H('div', { class: 'st-lbl', text: a.name }), H('div', { class: 'st-desc muted', text: a.category + (a.desc ? ' · ' + a.desc : '') })),
          H('div', { class: 'st-ctl' },
            H('button', { class: 'btn sm ghost', text: 'Open', onclick: () => LX.apps.launch(a.id) }),
            H('button', { class: 'btn sm' + (isP ? ' primary' : ''), text: isP ? 'Pinned' : 'Pin', title: 'Pin to taskbar', onclick: () => { const p = (LX.settings.get('pinned') || []).slice(); const i = p.indexOf(a.id); if (i >= 0) p.splice(i, 1); else p.push(a.id); ui.set('pinned', p); draw(); } }))));
      });
      if (!list.children.length) list.appendChild(H('div', { class: 'st-empty muted', text: 'No apps match.' }));
    };
    q.addEventListener('input', draw); draw();
    c.appendChild(ui.page('Apps', q, list));
  } });

  // ---- app shell ----
  LX.apps.register({
    id: 'settings', name: 'Settings', icon: 'settings', color: '#8E9BB5', category: 'System', desc: 'Personalise and configure Leonux', singleton: true, width: 900, height: 620, minWidth: 460, minHeight: 360,
    open(win, args) {
      const body = win.body; let cur = null, cleanup = null, filter = '';
      const side = H('div', { class: 'sidebar st-side' });
      const search = H('input', { class: 'input st-search', placeholder: 'Search settings', 'aria-label': 'Search settings' });
      const nav = H('div', { class: 'st-nav' });
      const content = H('div', { class: 'st-content scroll' });
      side.append(search, nav);
      body.appendChild(H('div', { class: 'st-shell' }, side, content));
      function drawNav() {
        nav.innerHTML = '';
        const groups = {};
        LX.settingsPages.list().filter((p) => !filter || p.title.toLowerCase().indexOf(filter) >= 0).forEach((p) => (groups[p.group] = groups[p.group] || []).push(p));
        ['Personal', 'Connectivity', 'System'].concat(Object.keys(groups).filter((g) => ['Personal', 'Connectivity', 'System'].indexOf(g) < 0)).forEach((g) => {
          if (!groups[g]) return;
          nav.appendChild(H('div', { class: 'st-grp', text: g }));
          groups[g].forEach((p) => nav.appendChild(H('div', { class: 'list-item st-item' + (p.id === cur ? ' active' : ''), tabindex: 0, role: 'button', onclick: () => go(p.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(p.id); } } }, H('span', { html: LX.icon(p.icon, 17) }), H('span', { class: 'ellipsis', text: p.title }))));
        });
        if (!nav.children.length) nav.appendChild(H('div', { class: 'st-empty muted', text: 'No results' }));
      }
      function go(id) {
        const p = LX.settingsPages.list().find((x) => x.id === id) || LX.settingsPages.list()[0];
        if (!p) return;
        if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
        cur = p.id; content.innerHTML = ''; win.setTitle('Settings — ' + p.title);
        try { cleanup = p.render(content) || null; } catch (e) { console.error(e); content.appendChild(H('div', { class: 'st-empty', text: 'This page failed to load: ' + e.message })); }
        content.scrollTop = 0; drawNav();
      }
      search.addEventListener('input', () => { filter = search.value.trim().toLowerCase(); drawNav(); const first = LX.settingsPages.list().find((p) => p.title.toLowerCase().indexOf(filter) >= 0); if (filter && first && first.id !== cur) go(first.id); });
      const rerender = LX.debounce(() => { if (!selfChange && cur && !win.closed) { const st = content.scrollTop; go(cur); content.scrollTop = st; } }, 120);
      const off = LX.bus.on('settings:change', () => { if (!selfChange) rerender(); });
      const offApps = LX.bus.on('apps:change', () => { if (cur === 'apps') rerender(); });
      win.on('args', (a) => { if (a && a.page) go(a.page); });
      win.onClose(() => { off(); offApps(); if (cleanup) try { cleanup(); } catch (e) { /* ignore */ } });
      go((args && args.page) || 'appearance');
    },
  });
})();
