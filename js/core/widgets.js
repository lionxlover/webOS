/* Leonux Web OS — desktop widgets: clock, system stats, weather */
(function () {
  'use strict';
  const H = LX.h;
  const SKY = [['Clear', 'sun', 24], ['Partly cloudy', 'cloud', 21], ['Light rain', 'cloud-rain', 17], ['Sunny', 'sun', 27]];
  LX.onInit(() => {
    const host = document.getElementById('widgets'); if (!host) return;
    const t = H('div', { class: 'wg-time' }), d = H('div', { class: 'wg-date' });
    const clock = H('div', { class: 'widget wg-clock' }, t, d);
    const cpu = H('div', { style: 'width:0%' }), mem = H('div', { style: 'width:0%' }), disk = H('div', { style: 'width:0%' });
    const cpuV = H('span'), memV = H('span'), diskV = H('span');
    const stat = (n, bar, v) => H('div', { class: 'wg-stat' }, H('div', { class: 'wg-stat-h' }, H('span', { text: n }), v), H('div', { class: 'progress' }, bar));
    const sys = H('div', { class: 'widget wg-sys', onclick: () => LX.apps.launch('sysmonitor') }, stat('CPU', cpu, cpuV), stat('Memory', mem, memV), stat('Disk', disk, diskV));
    const day = new Date().getDate() % SKY.length; const sk = SKY[day];
    const wx = H('div', { class: 'widget wg-wx', onclick: () => LX.apps.launch('weather') }, H('div', { class: 'wg-wx-ico', html: LX.icon(sk[1], 34) }), H('div', null, H('div', { class: 'wg-wx-t', text: sk[2] + '°C' }), H('div', { class: 'wg-wx-s', text: sk[0] })));
    host.append(clock, wx, sys);
    let c = 18;
    LX.bus.on('clock:tick', (n) => {
      t.textContent = LX.fmtTime(n); d.textContent = n.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      if (n.getSeconds() % 2) return;
      const procs = LX.wm.list().length; c = LX.clamp(c + (Math.random() - 0.5) * 12 + (procs > 3 ? 1 : -0.5), 4, 85);
      const m = LX.clamp(28 + procs * 4 + Math.random() * 3, 20, 92); const u = LX.vfs.usage(); const dk = u.used / u.total * 100;
      cpu.style.width = c + '%'; cpuV.textContent = Math.round(c) + '%'; mem.style.width = m + '%'; memV.textContent = Math.round(m) + '%';
      disk.style.width = Math.max(1, dk) + '%'; diskV.textContent = LX.fmtBytes(u.used);
    });
    const vis = () => host.classList.toggle('hidden', !LX.settings.get('widgets'));
    vis(); LX.bus.on('settings:change', (e) => { if (e.key === 'widgets') vis(); });
  });
})();
