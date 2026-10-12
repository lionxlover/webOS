/* Leonux OS 2 — extra terminal commands: store, spaces, neofetch, theming, pwa. */
(function () {
  'use strict';
  const T = LX.terminal, V = LX.vfs, S = LX.settings;
  const reg = (n, f, h) => T.register(n, f, h);

  reg('store', function (ctx, args) {
    const sub = args[0];
    const pk = LX.packages;
    if (!sub || sub === 'list') {
      const all = LX.apps.list().filter((a) => a.pkg);
      ctx.printHtml('<b>App Store — ' + all.length + ' packages</b>');
      all.forEach((a) => {
        const inst = pk.isInstalled(a.id);
        ctx.printHtml('  ' + (inst ? '<span class="t-exec">✔</span>' : '<span class="t-dim">·</span>') + ' ' + a.name.padEnd(18) + (inst ? ' [installed v' + pk.versionOf(a.id) + ']' : ' [' + pk.appSize(a.id) + ' MB]'));
      });
      ctx.print('Use: store install <id> | store remove <id> | store open');
      return 0;
    }
    if (sub === 'open') { LX.apps.launch('softwarecenter'); ctx.print('Opening App Store…'); return 0; }
    if (sub === 'updates') {
      const ups = pk.updates();
      if (!ups.length) { ctx.print('All apps are up to date.'); return 0; }
      ups.forEach((id) => ctx.printHtml('  ↑ ' + LX.escape(id) + ' → v' + LX.escape(pk.versionOf(id))));
      return 0;
    }
    const id = args[1];
    if (sub === 'install' && id) {
      const a = LX.apps.get(id);
      if (!a || !a.pkg) { ctx.error('store: no such package: ' + id); return 1; }
      if (pk.isInstalled(id)) { ctx.print(a.name + ' is already installed.'); return 0; }
      ctx.print('Downloading ' + a.name + ' (' + pk.appSize(id) + ' MB)…');
      pk.install(id).then((r) => { if (r && r.ok) ctx.printHtml('<span class="t-exec">✔ installed</span> ' + LX.escape(a.name)); });
      return 0;
    }
    if (sub === 'remove' && id) {
      if (!pk.isInstalled(id)) { ctx.error('store: ' + id + ' is not installed'); return 1; }
      pk.uninstall(id, { silent: true });
      ctx.print('Removed ' + id + '.');
      return 0;
    }
    ctx.error('store: unknown subcommand. Try: store list | install | remove | updates | open');
    return 1;
  }, 'store [list|install|remove|updates|open] — manage App Store packages');

  reg('spaces', function (ctx, args) {
    if (!LX.spaces.enabled()) { ctx.print('Spaces are disabled (Settings → Dock & Taskbar).'); return 0; }
    const sub = args[0];
    if (sub === 'go' && args[1]) { LX.spaces.go(+args[1] - 1); ctx.print('Switched to Desktop ' + (LX.spaces.current + 1)); return 0; }
    if (sub === 'next') { LX.spaces.next(); }
    else if (sub === 'prev') { LX.spaces.prev(); }
    else if (sub === 'mc' || sub === 'mission') { LX.spaces.missionControl(); return 0; }
    const counts = [0, 0, 0, 0];
    LX.wm.list().forEach((w) => { counts[w.space || 0]++; });
    for (let i = 0; i < 4; i++) ctx.printHtml('  Desktop ' + (i + 1) + (i === LX.spaces.current ? ' <span class="t-exec">● current</span>' : '') + ' — ' + counts[i] + ' window(s)');
    return 0;
  }, 'spaces [go N|next|prev|mc] — virtual desktops');

  reg('neofetch', function (ctx) {
    const a = LX.apps.list().filter((x) => !x.hidden).length;
    const pk = LX.packages.usage();
    const wm = LX.wm.list().length;
    const art = [
      '      🦁      ',
      '    /\\_/\\    ',
      '   ( o.o )   ',
      '    > ^ <    ',
      '  /|     |\\  ',
      '  \"\"\"\"\"\"\"\"\"  ',
    ];
    const info = [
      LX.settings.get('fullname') + '@' + S.get('hostname'),
      '-----------------',
      'OS: Leonux OS 2.0 (Lioness) x86_Web',
      'Kernel: leonux-web 2.0.0',
      'Uptime: ' + Math.round(performance.now() / 1000) + 's',
      'Shell: lxsh · Resolution: ' + innerWidth + 'x' + innerHeight,
      'DE: Leonux Shell (dock mode: ' + (S.get('dock') ? 'on' : 'off') + ')',
      'WM: LeoWM (spaces: ' + (LX.spaces.enabled() ? '4' : 'off') + ')',
      'Theme: ' + S.get('theme') + ' · Accent: ' + S.get('accent'),
      'Apps: ' + a + ' visible · ' + pk.apps + ' store-installed (' + pk.mb + ' MB)',
      'Windows open: ' + wm,
      'Storage: ' + LX.fmtBytes(V.usage().used),
    ];
    for (let i = 0; i < Math.max(art.length, info.length); i++) {
      ctx.printHtml('<span class="t-accent">' + (art[i] || ' '.repeat(14)) + '</span>  ' + LX.escape(info[i] || ''));
    }
    return 0;
  }, 'neofetch — system summary with lion art');

  reg('theme', function (ctx, args) {
    if (!args.length) { ctx.print('theme: ' + S.get('theme') + '. Use: theme dark|light|auto'); return 0; }
    S.set('theme', args[0]);
    ctx.print('Theme set to ' + args[0] + '.');
    return 0;
  }, 'theme [dark|light|auto] — switch theme');

  reg('accent', function (ctx, args) {
    if (!args[0] || !/^#[0-9a-f]{6}$/i.test(args[0])) { ctx.error('accent: pass a hex colour, e.g. accent #9ECE6A'); return 1; }
    S.set('accent', args[0]);
    ctx.print('Accent set to ' + args[0] + '.');
    return 0;
  }, 'accent #hex — set accent colour');

  reg('wallpaper', function (ctx, args) {
    const w = LX.theme.wallpapers;
    if (!args.length) { ctx.print('Available: ' + Object.keys(w).join(', ')); ctx.print('Use: wallpaper <name> — or set a data URL from Files.'); return 0; }
    if (w[args[0]]) { S.set('wallpaper', args[0]); ctx.print('Wallpaper: ' + w[args[0]].name); return 0; }
    ctx.error('wallpaper: unknown name. Run `wallpaper` to list.');
    return 1;
  }, 'wallpaper [name] — list or set wallpaper');

  reg('dock', function (ctx, args) {
    S.set('dock', args[0] !== 'off');
    ctx.print('Dock mode ' + (S.get('dock') ? 'enabled' : 'disabled') + '.');
    return 0;
  }, 'dock [on|off] — toggle dock mode');

  reg('pwa', function (ctx) {
    ctx.print('Service worker: ' + (LX.pwa.offlineReady ? 'active, offline ready ✔' : 'registering…'));
    ctx.print('Running as: ' + (LX.pwa.installed ? 'installed app' : 'browser tab'));
    ctx.print('Installable: ' + (LX.pwa.canInstall ? 'yes — use the “Install as app” chip in Quick Settings' : 'use your browser menu → Install Leonux'));
    return 0;
  }, 'pwa — offline / install status');

  reg('apps', function (ctx) {
    LX.apps.list().filter((a) => !a.hidden).forEach((a) => ctx.printHtml('  ' + LX.escape(a.name.padEnd(20)) + '<span class="t-dim">' + LX.escape(a.id + ' · ' + a.category) + '</span>'));
    return 0;
  }, 'apps — list installed apps');
})();
