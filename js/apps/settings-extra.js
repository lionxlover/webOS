/* Leonux OS 2 — Settings: Personalization (dock), Spaces, Apps & Store, System Install (PWA). */
(function () {
  'use strict';
  const H = LX.h;
  const ui = LX.settingsPages.ui;

  // ---------- Personalization: dock & taskbar ----------
  LX.settingsPages.add({ id: 'personalization', title: 'Dock & Taskbar', icon: 'rocket', group: 'Personal', order: 19, render(c) {
    const paint = () => {
      c.innerHTML = '';
      c.appendChild(ui.page('Dock & Taskbar',
        ui.group('Taskbar style',
          ui.row('Dock mode', 'Floating pill with magnification, running dots and launch bounce', ui.toggle('dock')),
          ui.row('Icon magnification', 'Hover the dock — icons grow like a certain fruit company', ui.toggle('dockMagnify')),
          ui.row('Position', null, ui.seg('taskbarPos', [{ v: 'bottom', l: 'Bottom' }, { v: 'top', l: 'Top' }]))),
        ui.group('Motion',
          ui.row('Animations', 'Window and dock transitions', ui.toggle('animations')),
          ui.row('High contrast', 'Stronger borders, no transparency', ui.toggle('highContrast'))),
        ui.group('Desktop',
          ui.row('Widgets', 'Clock, weather and system stats', ui.toggle('widgets')),
          ui.row('Spaces', 'Four virtual desktops + Mission Control (Ctrl+Alt+↑)', ui.toggle('spaces')))));
    };
    LX.bus.on('settings:change', (e) => { if (['dock', 'dockMagnify'].indexOf(e.key) >= 0) paint(); });
    paint();
  } });

  // ---------- Apps & Store ----------
  LX.settingsPages.add({ id: 'appsmanager', title: 'Apps & Store', icon: 'store', group: 'System', order: 40, render(c) {
    const paint = () => {
      c.innerHTML = '';
      const pk = LX.packages;
      const storeApps = LX.apps.list().filter((a) => a.pkg);
      const rows = storeApps.map((a) => {
        const inst = pk.isInstalled(a.id);
        const upd = inst && pk.updates().indexOf(a.id) >= 0;
        return ui.row(a.name, a.category + ' · v' + pk.versionOf(a.id) + (inst ? ' · installed' : ' · not installed'),
          H('div', { class: 'row gap' },
            H('button', { class: 'btn sm' + (upd ? ' primary' : inst ? '' : ' primary'), text: upd ? 'Update' : inst ? 'Open' : 'Install',
              onclick: () => { if (upd) { pk.markForUpdate(a.id); pk.update(a.id); } else LX.apps.launch(a.id); } }),
            inst && H('button', { class: 'btn sm ghost', html: LX.icon('trash', 13), title: 'Uninstall', onclick: async () => { if (await LX.dialog.confirm('Remove ' + a.name + '?', 'Uninstall')) { pk.uninstall(a.id); paint(); } } })));
      });
      c.appendChild(ui.page('Apps & Store',
        ui.group('Store apps (' + storeApps.filter((a) => pk.isInstalled(a.id)).length + ' of ' + storeApps.length + ' installed)', ...rows),
        ui.group('Storage',
          ui.row('App storage', 'Space used by installed apps', H('span', { class: 'muted', text: pk.usage().mb + ' MB' })),
          ui.row('Open App Store', null, H('button', { class: 'btn sm', html: LX.icon('store', 13) + ' Open', onclick: () => LX.apps.launch('softwarecenter', pk.updateCount() ? { view: 'updates' } : null) })),
          ui.row('Pending updates', null, H('span', { class: pk.updateCount() ? 'badge' : 'muted', text: pk.updateCount() ? pk.updateCount() + ' available' : 'Up to date' })))));
    };
    LX.bus.on('packages:change', paint);
    paint();
  } });

  // ---------- System install (PWA / offline) ----------
  LX.settingsPages.add({ id: 'install', title: 'System Install', icon: 'rocket', group: 'System', order: 41, render(c) {
    const paint = () => {
      c.innerHTML = '';
      const pwa = LX.pwa;
      const installed = pwa.installed;
      const canInstall = pwa.canInstall;
      const offlineReady = pwa.offlineReady;
      const usage = (() => { try { return navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null); } catch (e) { return Promise.resolve(null); } })();
      const cacheRow = ui.row('Offline cache', 'Every app and asset is cached on this device', H('span', { class: 'muted', id: 'st-cache', text: offlineReady ? 'Ready' : 'Preparing…' }));
      usage.then((est) => {
        const el = c.querySelector('#st-cache');
        if (el && est && est.usage) el.textContent = 'Ready · ' + LX.fmtBytes(est.usage) + ' cached';
      });
      const statusGroup = ui.group('Status',
        ui.row('Running as', null, H('span', { class: 'muted', text: installed ? 'Installed app (standalone)' : 'Browser tab' })),
        cacheRow,
        ui.row('Installable now', null, H('span', { class: 'muted', text: canInstall ? 'Yes — one click away' : installed ? 'Already installed' : 'Use your browser’s install menu' })));
      const installBtn = H('button', { class: 'btn sm primary', disabled: !canInstall, text: installed ? 'Installed' : canInstall ? 'Install now' : 'Not available', onclick: () => pwa.promptInstall() });
      const checkBtn = H('button', { class: 'btn sm', text: 'Check', onclick: (e) => {
        e.target.textContent = 'Checking…';
        pwa.checkForUpdates().then((ok) => {
          setTimeout(() => {
            e.target.textContent = ok ? 'Up to date' : 'Check';
            LX.notify({ title: 'Updates', body: ok ? 'You are on the latest build.' : 'Could not reach the update service — offline is fine.', icon: 'refresh2' });
          }, 500);
        });
      } });
      const restartBtn = H('button', { class: 'btn sm ghost', html: LX.icon('refresh', 13) + ' Restart', onclick: () => LX.power.restart() });
      const actionsGroup = ui.group('Actions',
        ui.row('Install as app', 'Adds Leonux to your system app list', installBtn),
        ui.row('Check for updates', 'Looks for a newer Leonux build', checkBtn),
        ui.row('Restart Leonux', 'Applies pending updates', restartBtn));
      const offlineGroup = ui.group('About offline mode',
        ui.row('Works offline', null, H('span', { class: 'muted', text: 'Yes — 100% of apps run locally' })),
        ui.row('Data location', null, H('span', { class: 'muted', text: 'This device only (browser storage)' })));
      c.appendChild(ui.page('Install Leonux on this system',
        H('p', { class: 'muted', style: { margin: '0 0 14px', fontSize: '13px', lineHeight: 1.6 }, text: 'Install Leonux as an app: it gets its own window, taskbar entry and offline storage. After installing you can disconnect the internet completely — every app, game and file keeps working.' }),
        statusGroup, actionsGroup, offlineGroup));
      LX.bus.on('pwa:ready', paint);
      LX.bus.on('pwa:installed', paint);
      LX.bus.on('pwa:caninstall', paint);
    };
    paint();
  } });
})();
