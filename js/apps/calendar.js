/* Leonux Web OS — Calendar: month/week/agenda views, coloured events, reminders */
(function () {
  'use strict';
  const H = LX.h, P = LX.pad;
  const KEY = 'app.calendar.events';
  const COLORS = ['#5B9DFA', '#9ECE6A', '#F6C177', '#F28B82', '#BB9AF7', '#4FD1C5', '#F78FB3'];
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const ymd = (d) => d.getFullYear() + '-' + P(d.getMonth() + 1) + '-' + P(d.getDate());
  const parseYmd = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const sameDay = (a, b) => ymd(a) === ymd(b);

  let events = null;
  function load() {
    if (events) return events;
    const v = LX.store.get(KEY, null);
    if (Array.isArray(v)) { events = v.filter((e) => e && e.id && e.date); return events; }
    const t = new Date();
    events = [
      { id: LX.uid(), title: 'Team stand-up', date: ymd(t), start: '09:30', end: '10:00', allDay: false, color: COLORS[0], notes: 'Daily sync', remind: 10, repeat: 'none' },
      { id: LX.uid(), title: 'Lunch with Sam', date: ymd(addDays(t, 1)), start: '12:30', end: '13:30', allDay: false, color: COLORS[2], notes: '', remind: 15, repeat: 'none' },
      { id: LX.uid(), title: 'Leonux release day', date: ymd(addDays(t, 3)), start: '', end: '', allDay: true, color: COLORS[4], notes: 'Ship it!', remind: 0, repeat: 'none' },
      { id: LX.uid(), title: 'Gym', date: ymd(addDays(t, 2)), start: '18:00', end: '19:00', allDay: false, color: COLORS[1], notes: '', remind: 30, repeat: 'weekly' },
    ];
    save(); return events;
  }
  function save() { LX.store.set(KEY, events); LX.bus.emit('calendar:change'); }
  // does event occur on date d?
  function occurs(e, d) {
    const s = parseYmd(e.date); if (d < s && !sameDay(d, s)) return false;
    if (sameDay(s, d)) return true;
    const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(s.getFullYear(), s.getMonth(), s.getDate())) / 864e5);
    if (e.repeat === 'daily') return true;
    if (e.repeat === 'weekly') return diff % 7 === 0;
    if (e.repeat === 'monthly') return s.getDate() === d.getDate();
    if (e.repeat === 'yearly') return s.getDate() === d.getDate() && s.getMonth() === d.getMonth();
    return false;
  }
  const eventsOn = (d) => load().filter((e) => occurs(e, d)).sort((a, b) => (a.allDay ? '' : a.start || '').localeCompare(b.allDay ? '' : b.start || '') || a.title.localeCompare(b.title));
  const timeLabel = (e) => (e.allDay ? 'All day' : (e.start || '') + (e.end ? '–' + e.end : ''));

  // reminders: shared across windows, checked every 20s
  let remTimer = null; const fired = {};
  function checkReminders() {
    const now = new Date(), nowMin = Math.floor(now.getTime() / 60000);
    load().forEach((e) => {
      if (e.allDay || !e.start || !(e.remind > 0) || !occurs(e, now)) return;
      const [hh, mm] = e.start.split(':').map(Number); const st = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm).getTime() / 60000;
      const k = e.id + ymd(now);
      if (nowMin >= st - e.remind && nowMin < st && !fired[k]) { fired[k] = 1; LX.notify({ title: e.title, body: 'Starts at ' + e.start + (e.remind ? ' (in ' + Math.max(1, Math.round(st - nowMin)) + ' min)' : ''), icon: 'calendar', appId: 'calendar' }); }
    });
  }
  function startReminders() { if (!remTimer) { checkReminders(); remTimer = setInterval(checkReminders, 20000); } }

  LX.apps.register({
    id: 'calendar', name: 'Calendar', icon: 'calendar', color: '#F28B82', category: 'Productivity',
    desc: 'Plan your days with events and reminders', width: 960, height: 660, minWidth: 420, minHeight: 360,
    open(win) {
      load(); startReminders();
      const root = win.body; root.tabIndex = 0;
      let view = LX.store.get('app.calendar.view', 'month'), cur = new Date(), sel = new Date(), q = '';
      const title = H('div', { class: 'cal-title' });
      const main = H('div', { class: 'cal-main scroll' });
      const search = H('input', { class: 'input cal-search', placeholder: 'Search events…', oninput: (e) => { q = e.target.value.trim().toLowerCase(); render(); } });
      const vtabs = H('div', { class: 'cal-views' });
      const tb = H('div', { class: 'toolbar' },
        H('button', { class: 'btn sm', text: 'Today', onclick: () => { cur = new Date(); sel = new Date(); render(); } }),
        H('button', { class: 'btn icon sm', title: 'Previous', html: LX.icon('chevron-left', 16), onclick: () => nav(-1) }),
        H('button', { class: 'btn icon sm', title: 'Next', html: LX.icon('chevron-right', 16), onclick: () => nav(1) }),
        title, H('div', { class: 'grow' }), search, vtabs,
        H('button', { class: 'btn primary sm', html: LX.icon('plus', 14) + ' New', onclick: () => editor(null, sel) }));
      root.append(tb, main);

      function nav(n) {
        if (view === 'month') cur = new Date(cur.getFullYear(), cur.getMonth() + n, 1);
        else cur = addDays(cur, n * 7);
        render();
      }
      function weekStart(d) { return addDays(d, -d.getDay()); }
      function chip(e, d, compact) {
        return H('div', { class: 'cal-chip' + (e.allDay ? ' allday' : ''), style: '--c:' + e.color, title: e.title + ' · ' + timeLabel(e), onclick: (ev) => { ev.stopPropagation(); editor(e, d); },
          oncontextmenu: (ev) => { ev.preventDefault(); ev.stopPropagation(); LX.menu.show(ev.clientX, ev.clientY, [{ label: 'Edit', icon: 'edit', action: () => editor(e, d) }, { label: 'Delete', icon: 'trash', action: () => del(e) }]); } },
          compact ? null : H('span', { class: 'cal-ct', text: e.allDay ? '' : e.start }), H('span', { class: 'ellipsis', text: e.title }));
      }
      function filt(list) { return q ? list.filter((e) => (e.title + ' ' + (e.notes || '')).toLowerCase().includes(q)) : list; }

      function renderMonth() {
        const y = cur.getFullYear(), m = cur.getMonth(); title.textContent = MON[m] + ' ' + y;
        const first = new Date(y, m, 1), start = addDays(first, -first.getDay());
        const grid = H('div', { class: 'cal-month' });
        DOW.forEach((d) => grid.appendChild(H('div', { class: 'cal-dow', text: d })));
        const weeks = Math.ceil((first.getDay() + new Date(y, m + 1, 0).getDate()) / 7);
        grid.style.gridTemplateRows = '24px repeat(' + weeks + ',minmax(70px,1fr))';
        for (let i = 0; i < weeks * 7; i++) {
          const d = addDays(start, i), evs = filt(eventsOn(d));
          grid.appendChild(H('div', { class: 'cal-cell' + (d.getMonth() !== m ? ' out' : '') + (sameDay(d, new Date()) ? ' today' : '') + (sameDay(d, sel) ? ' sel' : ''),
            onclick: () => { sel = d; render(); }, ondblclick: () => editor(null, d) },
            H('div', { class: 'cal-num', text: d.getDate() }), evs.slice(0, 3).map((e) => chip(e, d)), evs.length > 3 ? H('div', { class: 'cal-more muted', text: '+' + (evs.length - 3) + ' more' }) : null));
        }
        main.replaceChildren(grid);
      }
      function renderWeek() {
        const ws = weekStart(cur), we = addDays(ws, 6);
        title.textContent = MON[ws.getMonth()].slice(0, 3) + ' ' + ws.getDate() + ' – ' + (ws.getMonth() !== we.getMonth() ? MON[we.getMonth()].slice(0, 3) + ' ' : '') + we.getDate() + ', ' + we.getFullYear();
        const head = H('div', { class: 'cal-wk-head' }, H('div'));
        const ad = H('div', { class: 'cal-wk-allday' }, H('div', { class: 'cal-hr muted', text: 'all-day' }));
        const body = H('div', { class: 'cal-wk-body' }, H('div', { class: 'cal-hours' }, Array.from({ length: 24 }, (_, h) => H('div', { class: 'cal-hr muted', text: P(h) + ':00' }))));
        for (let i = 0; i < 7; i++) {
          const d = addDays(ws, i), evs = filt(eventsOn(d));
          head.appendChild(H('div', { class: 'cal-wk-d' + (sameDay(d, new Date()) ? ' today' : '') + (sameDay(d, sel) ? ' sel' : ''), onclick: () => { sel = d; render(); } }, H('span', { class: 'muted', text: DOW[d.getDay()] }), H('b', { text: d.getDate() })));
          ad.appendChild(H('div', { class: 'cal-wk-adc' }, evs.filter((e) => e.allDay).map((e) => chip(e, d, true))));
          const col = H('div', { class: 'cal-wk-col', ondblclick: (ev) => { const r = col.getBoundingClientRect(); const h = Math.floor((ev.clientY - r.top) / 44); editor(null, d, P(LX.clamp(h, 0, 23)) + ':00'); } });
          evs.filter((e) => !e.allDay && e.start).forEach((e) => {
            const [sh, sm] = e.start.split(':').map(Number); let [eh, em] = (e.end || '').split(':').map(Number);
            if (isNaN(eh)) { eh = sh + 1; em = sm; }
            const top = (sh + sm / 60) * 44, hgt = Math.max(20, ((eh + em / 60) - (sh + sm / 60)) * 44);
            col.appendChild(H('div', { class: 'cal-ev', style: 'top:' + top + 'px;height:' + hgt + 'px;--c:' + e.color, title: e.title, onclick: (ev) => { ev.stopPropagation(); editor(e, d); } }, H('b', { class: 'ellipsis', text: e.title }), H('span', { class: 'ellipsis', text: timeLabel(e) })));
          });
          if (sameDay(d, new Date())) { const n = new Date(); col.appendChild(H('div', { class: 'cal-now', style: 'top:' + ((n.getHours() + n.getMinutes() / 60) * 44) + 'px' })); }
          body.appendChild(col);
        }
        const wrap = H('div', { class: 'cal-week' }, head, ad, body);
        main.replaceChildren(wrap);
        if (!main._scrolled) { main.scrollTop = 7 * 44; main._scrolled = true; }
      }
      function renderAgenda() {
        const from = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate()); title.textContent = 'Agenda · from ' + LX.fmtDate(from);
        const wrap = H('div', { class: 'cal-agenda' }); let n = 0;
        for (let i = 0; i < 90; i++) {
          const d = addDays(from, i), evs = filt(eventsOn(d)); if (!evs.length) continue; n++;
          wrap.appendChild(H('div', { class: 'cal-ag-day' }, H('div', { class: 'cal-ag-date' + (sameDay(d, new Date()) ? ' today' : '') }, H('b', { text: d.getDate() }), H('span', { class: 'muted', text: DOW[d.getDay()] + ' · ' + MON[d.getMonth()].slice(0, 3) })),
            H('div', { class: 'cal-ag-list' }, evs.map((e) => H('div', { class: 'cal-ag-ev', style: '--c:' + e.color, onclick: () => editor(e, d) }, H('span', { class: 'cal-dot' }), H('span', { class: 'cal-ag-t muted', text: timeLabel(e) }), H('span', { class: 'grow ellipsis', text: e.title }), e.repeat !== 'none' ? H('span', { class: 'muted', html: LX.icon('repeat', 13) }) : null)))));
        }
        if (!n) wrap.appendChild(H('div', { class: 'cal-empty center muted' }, H('div', null, H('div', { html: LX.icon('calendar', 40) }), H('p', { text: q ? 'No events match your search.' : 'No upcoming events in the next 90 days.' }))));
        main.replaceChildren(wrap);
      }
      function render() {
        vtabs.replaceChildren(...['month', 'week', 'agenda'].map((v) => H('button', { class: 'btn sm' + (v === view ? ' primary' : ' ghost'), text: v[0].toUpperCase() + v.slice(1), onclick: () => { view = v; LX.store.set('app.calendar.view', v); render(); } })));
        if (view === 'month') renderMonth(); else if (view === 'week') renderWeek(); else renderAgenda();
      }

      function del(e) { LX.dialog.confirm('Delete "' + e.title + '"?' + (e.repeat !== 'none' ? ' All repeats will be removed.' : ''), 'Delete event').then((ok) => { if (ok) { events = events.filter((x) => x.id !== e.id); save(); } }); }
      function editor(ev, d, startT) {
        const isNew = !ev; ev = ev || { id: LX.uid(), title: '', date: ymd(d || sel), start: startT || '09:00', end: startT ? P(Math.min(23, +startT.slice(0, 2) + 1)) + ':00' : '10:00', allDay: false, color: COLORS[0], notes: '', remind: 10, repeat: 'none' };
        const f = {
          title: H('input', { class: 'input', value: ev.title, placeholder: 'Event title', autofocus: true }),
          date: H('input', { class: 'input', type: 'date', value: ev.date }),
          start: H('input', { class: 'input', type: 'time', value: ev.start }), end: H('input', { class: 'input', type: 'time', value: ev.end }),
          allDay: H('input', { type: 'checkbox', checked: !!ev.allDay }),
          remind: H('select', { class: 'select' }, [[0, 'None'], [5, '5 minutes before'], [10, '10 minutes before'], [15, '15 minutes before'], [30, '30 minutes before'], [60, '1 hour before']].map(([v, l]) => H('option', { value: v, text: l, selected: +ev.remind === v }))),
          repeat: H('select', { class: 'select' }, ['none', 'daily', 'weekly', 'monthly', 'yearly'].map((v) => H('option', { value: v, text: v === 'none' ? 'Does not repeat' : 'Every ' + v.replace('ly', '').replace('dai', 'day').replace('week', 'week'), selected: ev.repeat === v }))),
          notes: H('textarea', { class: 'textarea', rows: 3, placeholder: 'Notes', text: ev.notes || '' }),
        };
        f.notes.value = ev.notes || '';
        let color = ev.color;
        const sw = H('div', { class: 'cal-colors' });
        const drawSw = () => sw.replaceChildren(...COLORS.map((c) => H('button', { class: 'cal-sw' + (c === color ? ' on' : ''), style: 'background:' + c, title: c, onclick: () => { color = c; drawSw(); } })));
        drawSw();
        const times = H('div', { class: 'row gap' }, f.start, H('span', { class: 'muted', text: 'to' }), f.end);
        const syncAD = () => { times.style.display = f.allDay.checked ? 'none' : ''; }; f.allDay.onchange = syncAD; syncAD();
        const close = () => ov.remove();
        const err = H('div', { class: 'cal-err', style: 'color:var(--danger);font-size:12px;min-height:16px' });
        const doSave = () => {
          const t = f.title.value.trim(); if (!t) { err.textContent = 'Please enter a title.'; f.title.focus(); return; }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date.value)) { err.textContent = 'Please choose a valid date.'; return; }
          if (!f.allDay.checked && f.start.value && f.end.value && f.end.value < f.start.value) { err.textContent = 'End time must be after start time.'; return; }
          Object.assign(ev, { title: t, date: f.date.value, start: f.allDay.checked ? '' : f.start.value, end: f.allDay.checked ? '' : f.end.value, allDay: f.allDay.checked, color, notes: f.notes.value, remind: +f.remind.value, repeat: f.repeat.value });
          Object.keys(fired).forEach((k) => { if (k.startsWith(ev.id)) delete fired[k]; });
          if (isNew) load().push(ev); save(); close();
        };
        const lab = (t, el) => H('label', { class: 'cal-f' }, H('span', { class: 'muted', text: t }), el);
        const ov = H('div', { class: 'cal-ov', onmousedown: (e) => { if (e.target === ov) close(); }, onkeydown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (e.key === 'Enter' && e.target.tagName === 'INPUT') doSave(); } },
          H('div', { class: 'cal-dlg card' }, H('h3', { text: isNew ? 'New event' : 'Edit event' }), lab('Title', f.title), lab('Date', f.date),
            H('label', { class: 'row gap' }, f.allDay, H('span', { text: 'All day' })), times, lab('Colour', sw), lab('Reminder', f.remind), lab('Repeat', f.repeat), lab('Notes', f.notes), err,
            H('div', { class: 'row gap', style: 'justify-content:flex-end' }, !isNew ? H('button', { class: 'btn danger', text: 'Delete', onclick: () => { close(); del(ev); } }) : null, H('div', { class: 'grow' }), H('button', { class: 'btn ghost', text: 'Cancel', onclick: close }), H('button', { class: 'btn primary', text: 'Save', onclick: doSave }))));
        root.appendChild(ov); setTimeout(() => f.title.focus(), 30);
      }

      root.addEventListener('keydown', (e) => {
        if (e.target.matches('input,textarea,select') || e.ctrlKey || e.altKey) return;
        if (e.key === 'ArrowLeft') nav(-1); else if (e.key === 'ArrowRight') nav(1); else if (e.key === 't') { cur = new Date(); sel = new Date(); render(); }
        else if (e.key === 'n') editor(null, sel); else if (e.key === 'm') { view = 'month'; render(); } else if (e.key === 'w') { view = 'week'; render(); } else if (e.key === 'a') { view = 'agenda'; render(); } else return;
        e.preventDefault();
      });
      win.setMenu([{ label: 'Event', items: [{ label: 'New event…', shortcut: 'N', action: () => editor(null, sel) }, { label: 'Go to today', shortcut: 'T', action: () => { cur = new Date(); sel = new Date(); render(); } }] },
        { label: 'View', items: [{ label: 'Month', shortcut: 'M', action: () => { view = 'month'; render(); } }, { label: 'Week', shortcut: 'W', action: () => { view = 'week'; render(); } }, { label: 'Agenda', shortcut: 'A', action: () => { view = 'agenda'; render(); } }] }]);
      const off = LX.bus.on('calendar:change', render);
      win.onClose(() => off());
      render();
    },
  });
  // keep reminders alive even if the app was never opened
  setTimeout(startReminders, 3000);
})();
