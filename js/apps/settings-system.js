/* Leonux Web OS — Settings pages: System, Storage, Power, Privacy, Shortcuts, Reset OS */
(function () {
  'use strict';
  const H = LX.h, ui = LX.settingsPages.ui, S = LX.settings;
  const kv = (k, v) => ui.row(k, null, H('span', { class: 'muted st-mono', text: v }));

  function dirSize(p) {
    let t = 0;
    try { LX.vfs.ls(p).forEach((e) => { t += e.type === 'dir' ? dirSize(e.path) : (e.size || 0); }); } catch (e) { /* ignore */ }
    return t;
  }

  LX.settingsPages.add({ id: 'system', title: 'System', icon: 'cpu', group: 'System', order: 60, render(c) {
    const mem = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '8 GB';
    c.appendChild(ui.page('System',
      H('div', { class: 'st-card st-profile' }, H('div', { class: 'st-avatar st-logo', html: LX.icon('zap', 28) }), H('div', {}, H('div', { class: 'st-name', text: 'Leonux 1.0' }), H('div', { class: 'muted', text: S.get('hostname') + ' · build ' + (LX.version || '1.0.0') }))),
      ui.group('Device',
        kv('Device name', S.get('hostname')), kv('Processor', 'Leonux Virtual CPU × ' + (navigator.hardwareConcurrency || 4) + ' cores'),
        kv('Memory', mem), kv('Browser', (navigator.userAgent.match(/(Firefox|Edg|Chrome|Safari)\/[\d.]+/) || ['unknown'])[0]),
        kv('Platform', navigator.platform || 'web'), kv('Display', innerWidth + ' × ' + innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x')),
      H('div', { class: 'st-btns' }, H('button', { class: 'btn', html: LX.icon('info', 14) + ' About Leonux', onclick: () => LX.apps.launch('about') }), H('button', { class: 'btn', html: LX.icon('activity', 14) + ' System Monitor', onclick: () => LX.apps.launch('sysmonitor') }))));
  } });

  LX.settingsPages.add({ id: 'storage', title: 'Storage', icon: 'hard-drive', group: 'System', order: 61, render(c) {
    const box = H('div'); c.appendChild(ui.page('Storage', box));
    const draw = () => {
      box.innerHTML = '';
      const u = LX.vfs.usage(); const pct = Math.max(0.4, u.used / u.total * 100);
      const H0 = LX.vfs.HOME;
      const cats = [['Documents', 'file-text', H0 + '/Documents'], ['Pictures', 'image', H0 + '/Pictures'], ['Music', 'music', H0 + '/Music'], ['Videos', 'video', H0 + '/Videos'], ['Downloads', 'download', H0 + '/Downloads'], ['Desktop', 'monitor', H0 + '/Desktop'], ['Trash', 'trash', H0 + '/.Trash']];
      const sizes = cats.map((x) => dirSize(x[2]));
      box.appendChild(H('div', { class: 'st-card' }, H('div', { class: 'row' }, H('div', { class: 'st-lbl grow', text: 'Leonux Disk' }), H('span', { class: 'muted', text: LX.fmtBytes(u.used) + ' of ' + LX.fmtBytes(u.total) + ' used' })),
        H('div', { class: 'progress', style: { margin: '10px 0 4px' } }, H('div', { style: { width: pct + '%' } })), H('div', { class: 'muted st-desc', text: LX.fmtBytes(u.total - u.used) + ' free' })));
      box.appendChild(ui.group('Breakdown', cats.map((x, i) => H('div', { class: 'st-row' }, H('span', { html: LX.icon(x[1], 17) }), H('div', { class: 'st-rl' }, H('div', { class: 'st-lbl', text: x[0] })), H('div', { class: 'st-ctl' }, H('span', { class: 'muted', text: LX.fmtBytes(sizes[i]) }), x[0] === 'Trash' ? H('button', { class: 'btn sm danger', text: 'Empty', onclick: () => LX.dialog.confirm('Permanently delete everything in Trash?', 'Empty Trash').then((y) => { if (y) { LX.vfs.emptyTrash(); draw(); } }) }) : H('button', { class: 'btn sm ghost', text: 'Open', onclick: () => LX.apps.launch('files', { path: x[2] }) }))))));
    };
    draw();
    const off = LX.bus.on('vfs:change', LX.debounce(() => { if (c.isConnected) draw(); }, 300));
    return off;
  } });

  LX.settingsPages.add({ id: 'power', title: 'Power', icon: 'battery', group: 'System', order: 62, render(c) {
    const lvl = H('div', { class: 'st-lbl' }), bar = H('div'), st = H('div', { class: 'muted st-desc' });
    const upd = () => { const b = LX.battery; lvl.textContent = Math.round(b.level * 100) + '%'; bar.style.width = b.level * 100 + '%'; bar.style.background = b.level < 0.2 ? 'var(--danger)' : ''; st.textContent = b.charging ? 'Charging' : 'On battery' + (b.real ? '' : ' (simulated)'); };
    upd(); const off = LX.bus.on('battery:change', upd);
    c.appendChild(ui.page('Power',
      H('div', { class: 'st-card' }, H('div', { class: 'row' }, H('span', { html: LX.icon('battery', 20) }), H('div', { class: 'grow', style: { marginLeft: '10px' } }, lvl, st)), H('div', { class: 'progress', style: { marginTop: '10px' } }, bar)),
      ui.group('Mode',
        ui.row('Battery saver', 'Disables blur and heavy effects', ui.toggle('battSaver')),
        ui.row('Screen off after', 'When idle', ui.select('screenOff', [{ v: '1', l: '1 minute' }, { v: '5', l: '5 minutes' }, { v: '15', l: '15 minutes' }, { v: '0', l: 'Never' }])),
        ui.row('Auto lock', 'Lock after inactivity', ui.toggle('autoLock'))),
      ui.group('Session',
        H('div', { class: 'st-row st-btns' },
          H('button', { class: 'btn', html: LX.icon('lock', 14) + ' Lock', onclick: () => LX.power.lock() }),
          H('button', { class: 'btn', html: LX.icon('moon', 14) + ' Sleep', onclick: () => LX.power.sleep() }),
          H('button', { class: 'btn', html: LX.icon('rotate-cw', 14) + ' Restart', onclick: () => LX.power.restart() }),
          H('button', { class: 'btn danger', html: LX.icon('power', 14) + ' Shut down', onclick: () => LX.power.shutdown() })))));
    const sel = LX.$('select', c); if (S.get('screenOff') == null) sel.value = '5';
    return off;
  } });

  LX.settingsPages.add({ id: 'privacy', title: 'Privacy', icon: 'shield', group: 'System', order: 63, render(c) {
    const clear = (label, fn) => H('button', { class: 'btn sm danger', text: 'Clear', onclick: () => LX.dialog.confirm('Clear ' + label + '?', 'Privacy').then((y) => { if (y) { fn(); LX.notify({ title: 'Privacy', body: label + ' cleared.', icon: 'shield' }); } }) });
    c.appendChild(ui.page('Privacy',
      ui.group('App permissions',
        ui.row('Location', 'Let apps (Weather) use your location', ui.toggle('privLocation')),
        ui.row('Camera', 'Allow Camera and video apps', ui.toggle('privCamera')),
        ui.row('Microphone', 'Allow Recorder and voice features', ui.toggle('privMic')),
        ui.row('Notifications', 'Allow apps to show popups', ui.toggle('privNotif'))),
      ui.group('Data',
        ui.row('Browser history', 'Pages visited in Browser', clear('browser history', () => { ['app.browser.history', 'app.browser.hist'].forEach((k) => LX.store.remove(k)); })),
        ui.row('Terminal history', 'Commands typed in Terminal', clear('terminal history', () => LX.store.remove('app.terminal.history'))),
        ui.row('Recent files', 'Recently opened documents', clear('recent files', () => { LX.store.remove('recent'); LX.store.remove('app.files.recent'); })))));
    ['privLocation', 'privCamera', 'privMic', 'privNotif'].forEach((k, i) => { if (S.get(k) === undefined) { ui.set(k, true); LX.$$('input[type=checkbox]', c)[i].checked = true; } });
  } });

  const SC = [['Alt + Space', 'Open the app launcher'], ['Meta (tap)', 'Open the app launcher'], ['Ctrl + Space', 'Search'], ['Ctrl + Alt + T', 'Open Terminal'], ['Ctrl + Alt + L / Meta + L', 'Lock screen'], ['Ctrl + Alt + D / Meta + D', 'Show desktop'], ['Meta + E', 'Open Files'], ['Alt + Tab', 'Switch windows'], ['Alt + F4', 'Close window'], ['Meta + ← / →', 'Snap window left / right'], ['Meta + ↑', 'Maximise window'], ['Meta + ↓', 'Restore / minimise window'], ['Ctrl + C / Ctrl + L', 'Terminal: interrupt / clear']];
  LX.settingsPages.add({ id: 'shortcuts', title: 'Shortcuts', icon: 'keyboard', group: 'System', order: 64, render(c) {
    c.appendChild(ui.page('Keyboard shortcuts', ui.group('', SC.map((s) => ui.row(s[1], null, H('span', {}, s[0].split(' ').map((p) => (p === '+' || p === '/' ? H('span', { class: 'muted', text: ' ' + p + ' ' }) : H('span', { class: 'kbd', text: p }))))))))); 
  } });

  LX.settingsPages.add({ id: 'reset', title: 'Reset OS', icon: 'rotate-ccw', group: 'System', order: 65, render(c) {
    const wipe = (all) => {
      if (!all) { S.reset(); LX.notify({ title: 'Settings', body: 'Settings restored to defaults.', icon: 'settings' }); return; }
      try { Object.keys(localStorage).filter((k) => k.indexOf('lx:') === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
      location.reload();
    };
    c.appendChild(ui.page('Reset OS',
      ui.group('Reset settings', ui.row('Restore default settings', 'Theme, accent, wallpaper, volume, etc. Your files stay.', H('button', { class: 'btn', text: 'Reset settings', onclick: () => LX.dialog.confirm('Restore all settings to their defaults?', 'Reset settings').then((y) => y && wipe(false)) }))),
      ui.group('Factory reset', ui.row('Erase everything', 'Deletes all files, app data and settings, then reloads Leonux.', H('button', { class: 'btn danger', text: 'Factory reset…', onclick: () => LX.dialog.confirm('This permanently erases ALL files, app data and settings. Continue?', 'Factory reset').then((y) => y && wipe(true)) })))));
  } });
})();
