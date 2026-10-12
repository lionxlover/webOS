/* Leonux Web OS — toast notifications + notification centre (with calendar) */
(function () {
  'use strict';
  const H = LX.h;
  let history = LX.store.get('notifications', []);
  let panel, listEl, calEl, calDate = new Date();
  const save = () => LX.store.set('notifications', history.slice(0, 60));

  function toast(n) {
    const host = document.getElementById('notifs'); if (!host) return;
    const t = H('div', { class: 'toast', role: 'status' },
      H('div', { class: 'toast-ico', html: LX.icon(n.icon || 'bell', 18) }),
      H('div', { class: 'toast-txt' }, H('div', { class: 'toast-title', text: n.title || 'Notification' }), n.body && H('div', { class: 'toast-body', text: n.body })),
      H('button', { class: 'toast-x', html: LX.icon('x', 14), onclick: (e) => { e.stopPropagation(); kill(); } }));
    const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 250); };
    t.addEventListener('click', () => { if (n.appId) LX.apps.launch(n.appId, n.args); kill(); });
    host.appendChild(t); requestAnimationFrame(() => t.classList.add('in'));
    if (n.timeout !== 0) setTimeout(kill, n.timeout || 5000);
  }
  LX.notify = function (n) {
    n = Object.assign({ title: 'Notification', icon: 'bell', time: Date.now(), id: LX.uid() }, n || {});
    history.unshift({ id: n.id, title: n.title, body: n.body, icon: n.icon, appId: n.appId, time: n.time }); save();
    if (!LX.settings.get('dnd')) { toast(n); if (LX.settings.get('notifSound') !== false) LX.audio.event('notify'); }
    renderList(); LX.bus.emit('notify', n); return n.id;
  };
  LX.notifications = { list: () => history.slice(), clear() { history = []; save(); renderList(); } };

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!history.length) { listEl.appendChild(H('div', { class: 'np-empty' }, H('div', { html: LX.icon('bell', 28) }), H('div', { text: 'No notifications' }))); return; }
    history.forEach((n) => listEl.appendChild(H('div', { class: 'np-item', onclick: () => { if (n.appId) { LX.apps.launch(n.appId); LX.panels.close(); } } },
      H('div', { class: 'np-ico', html: LX.icon(n.icon || 'bell', 16) }),
      H('div', { class: 'np-txt' }, H('div', { class: 'np-title', text: n.title }), n.body && H('div', { class: 'np-body', text: n.body }), H('div', { class: 'np-time', text: LX.fmtTime(n.time) })),
      H('button', { class: 'toast-x', html: LX.icon('x', 12), onclick: (e) => { e.stopPropagation(); history = history.filter((x) => x.id !== n.id); save(); renderList(); } }))));
  }
  function renderCal() {
    if (!calEl) return;
    const y = calDate.getFullYear(), m = calDate.getMonth(); const today = new Date();
    const first = new Date(y, m, 1); const start = (first.getDay() + 6) % 7; const dim = new Date(y, m + 1, 0).getDate();
    calEl.innerHTML = '';
    calEl.appendChild(H('div', { class: 'cal-head' },
      H('button', { class: 'btn icon sm ghost', html: LX.icon('chevron-left', 14), onclick: () => { calDate = new Date(y, m - 1, 1); renderCal(); } }),
      H('div', { class: 'cal-title', text: first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }),
      H('button', { class: 'btn icon sm ghost', html: LX.icon('chevron-right', 14), onclick: () => { calDate = new Date(y, m + 1, 1); renderCal(); } })));
    const g = H('div', { class: 'cal-grid' }); ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d) => g.appendChild(H('span', { class: 'cal-dow', text: d })));
    for (let i = 0; i < start; i++) g.appendChild(H('span'));
    for (let d = 1; d <= dim; d++) g.appendChild(H('span', { class: 'cal-day' + (d === today.getDate() && m === today.getMonth() && y === today.getFullYear() ? ' today' : ''), text: d, onclick: () => { if (LX.apps.get('calendar')) { LX.apps.launch('calendar', { date: new Date(y, m, d).getTime() }); LX.panels.close(); } } }));
    calEl.appendChild(g);
  }
  LX.onInit(() => {
    panel = document.getElementById('notif-panel'); if (!panel) return;
    const timeEl = H('div', { class: 'np-clock' }); const dateEl = H('div', { class: 'np-date' });
    listEl = H('div', { class: 'np-list scroll' }); calEl = H('div', { class: 'np-cal' });
    panel.append(H('div', { class: 'np-top' }, timeEl, dateEl),
      H('div', { class: 'np-section' }, H('span', { text: 'Notifications' }), H('button', { class: 'btn ghost sm', text: 'Clear all', onclick: () => LX.notifications.clear() })), listEl, calEl);
    LX.panels.register('notif', panel, { onOpen() { calDate = new Date(); renderCal(); renderList(); } });
    LX.bus.on('clock:tick', (d) => { timeEl.textContent = LX.fmtTime(d, true); dateEl.textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); });
    renderList(); renderCal();
  });
})();
