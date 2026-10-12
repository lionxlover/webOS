/* Leonux Web OS — About: system information card */
(function () {
  'use strict';
  const H = LX.h;
  function browser() {
    const ua = navigator.userAgent;
    const m = ua.match(/(Firefox|Edg|Chrome|Version)\/([\d.]+)/);
    let name = m ? m[1] : 'Unknown';
    if (name === 'Version') name = 'Safari'; if (name === 'Edg') name = 'Edge';
    return name + (m ? ' ' + m[2].split('.')[0] : '');
  }
  function osName() {
    const ua = navigator.userAgent;
    return /Windows/.test(ua) ? 'Windows host' : /Mac OS/.test(ua) ? 'macOS host' : /Android/.test(ua) ? 'Android host' : /Linux/.test(ua) ? 'Linux host' : navigator.platform || 'Web';
  }
  function dur(s) {
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return (d ? d + 'd ' : '') + (h || d ? h + 'h ' : '') + m + 'm ' + LX.pad(Math.floor(s % 60)) + 's';
  }
  LX.apps.register({
    id: 'about', name: 'About Leonux', icon: 'info', color: '#74C7EC', category: 'System', desc: 'System information', singleton: true, width: 520, height: 640, minWidth: 360, minHeight: 360,
    open(win) {
      const S = LX.settings;
      const rows = [];
      const row = (k, getter) => { const v = H('div', { class: 'ab-v' }); rows.push(() => { v.textContent = getter(); }); return H('div', { class: 'ab-row' }, H('div', { class: 'ab-k', text: k }), v); };
      const store = H('div', { class: 'card ab-store' });
      const drawStore = () => {
        let u = { used: 0, total: 64 * 1024 ** 3 };
        try { u = LX.vfs.usage(); } catch (e) { /* ignore */ }
        const pct = LX.clamp(u.used / u.total * 100, 0.5, 100);
        store.innerHTML = '';
        store.append(H('div', { class: 'row' }, H('b', { class: 'grow', text: 'Storage' }), H('span', { class: 'muted', text: LX.fmtBytes(u.used) + ' of ' + LX.fmtBytes(u.total) + ' used' })),
          H('div', { class: 'progress', style: { margin: '10px 0 6px' } }, H('div', { style: { width: pct + '%' } })),
          H('div', { class: 'muted', style: { fontSize: '12px' }, text: LX.fmtBytes(u.total - u.used) + ' free' }));
      };
      const card = H('div', { class: 'card ab-card' },
        row('Device name', () => S.get('hostname')),
        row('User', () => S.get('fullname') + ' (@' + S.get('username') + ')'),
        row('Processor', () => 'Leonux Virtual CPU × ' + (navigator.hardwareConcurrency || 4)),
        row('Memory', () => (navigator.deviceMemory || 8) + ' GB'),
        row('Browser', browser), row('Host', osName),
        row('Display', () => innerWidth + ' × ' + innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x'),
        row('Language', () => navigator.language || 'en'),
        row('Uptime', () => dur(performance.now() / 1000)),
        row('Windows open', () => String(LX.wm && LX.wm.list ? LX.wm.list().length : 0)),
        row('Apps installed', () => String(LX.apps.list().length)));
      const copy = () => {
        const txt = ['Leonux ' + (LX.version || '1.0.0'), 'Device: ' + S.get('hostname'), 'Browser: ' + browser(), 'Display: ' + innerWidth + 'x' + innerHeight].join('\n');
        LX.clipboard.copy(txt).then(() => LX.notify({ title: 'About', body: 'System info copied', icon: 'copy' }));
      };
      win.body.append(H('div', { class: 'scroll', style: 'flex:1;min-height:0' }, H('div', { class: 'ab-wrap' },
        H('div', { class: 'ab-logo', html: LX.icon('zap', 52) }),
        H('h1', { class: 'ab-name', text: 'Leonux 1.0' }),
        H('div', { class: 'ab-ver', text: 'Version ' + (LX.version || '1.0.0') + ' · “Lion Cub” · build 2026.10' }),
        card, store,
        H('div', { class: 'ab-actions' },
          H('button', { class: 'btn', html: LX.icon('copy', 14) + ' Copy info', onclick: copy }),
          H('button', { class: 'btn', html: LX.icon('settings', 14) + ' Settings', onclick: () => LX.apps.launch('settings', { page: 'system' }) }),
          H('button', { class: 'btn', html: LX.icon('activity', 14) + ' System Monitor', onclick: () => LX.apps.launch('sysmonitor') })),
        H('div', { class: 'ab-foot', text: '© 2026 Leonux Project. Runs entirely in your browser.' }))));
      const tick = () => { rows.forEach((f) => f()); };
      tick(); drawStore();
      const t = setInterval(tick, 1000);
      const off = LX.bus.on('vfs:change', LX.debounce(drawStore, 300));
      const off2 = LX.bus.on('settings:change', tick);
      win.onClose(() => { clearInterval(t); off(); off2(); });
    },
  });
})();
