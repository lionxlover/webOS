/* Store app — Habit Tracker: habits with 12-week heatmaps and streaks. */
(function () {
  'use strict';
  const H = LX.h;
  const KEY = 'app.habits';
  const COLORS = ['#9ECE6A', '#5B9DFA', '#F6C177', '#F28B82', '#CBA6F7', '#4DD0E1'];

  LX.apps.register({
    id: 'habits', name: 'Habit Tracker', icon: 'check-circle', color: '#9ECE6A', category: 'Productivity',
    pkg: true, pkgVersion: '1.0', pkgSize: 9, developer: 'Acacia Systems', downloads: 860,
    desc: 'Build streaks, one day at a time', longDesc: 'Track daily habits with GitHub-style heatmaps covering the last 12 weeks. Tap a day to check it off, watch your streak grow, and keep every habit you are building.',
    permissions: ['Local storage'], changelog: 'First release.',
    width: 640, height: 600, minWidth: 420, minHeight: 400,
    open(win) {
      let habits = LX.store.get(KEY) || seed();
      const save = () => LX.store.set(KEY, habits);
      function seed() {
        return [
          { id: LX.uid(), name: 'Read 20 pages', c: 0, days: { [dstr(-1)]: 1, [dstr(-2)]: 1, [dstr(-4)]: 1 } },
          { id: LX.uid(), name: 'Stretch', c: 1, days: { [dstr(-1)]: 1, [dstr(-3)]: 1 } },
          { id: LX.uid(), name: 'No sugar', c: 3, days: {} },
        ];
      }
      function dstr(off) { const d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.toISOString().slice(0, 10); }
      function streak(h) {
        let s = 0; const today = new Date();
        for (let i = 0; i < 400; i++) {
          const d = new Date(); d.setDate(today.getDate() - i);
          const k = d.toISOString().slice(0, 10);
          if (h.days[k]) s++;
          else if (i > 0) break;
          else if (i === 0 && !h.days[k]) { /* today not yet done — keep looking */ }
        }
        return s;
      }

      const list = H('div', { class: 'hb-list scroll' });
      function paint() {
        list.innerHTML = '';
        if (!habits.length) { list.appendChild(H('div', { class: 'center muted', style: { padding: '40px 0' }, text: 'No habits yet — add one below.' })); return; }
        habits.forEach((h) => {
          const today = dstr(0);
          const doneToday = !!h.days[today];
          const days = [];
          for (let i = 83; i >= 0; i--) days.push(dstr(-i));
          const heat = H('div', { class: 'hb-heat' }, days.map((k) => H('span', { class: 'hb-cell' + (h.days[k] ? ' on' : ''), title: k, style: h.days[k] ? { background: COLORS[h.c % COLORS.length] } : null })));
          const row = H('div', { class: 'card hb-row' },
            H('div', { class: 'row gap', style: { marginBottom: '10px' } },
              H('span', { class: 'hb-dot', style: { background: COLORS[h.c % COLORS.length] } }),
              H('b', { class: 'grow ellipsis', text: h.name }),
              H('span', { class: 'badge', text: streak(h) + ' day streak' }),
              H('button', { class: 'btn sm' + (doneToday ? ' primary' : ''), text: doneToday ? 'Done today' : 'Check in', onclick: () => { if (h.days[today]) delete h.days[today]; else h.days[today] = 1; save(); paint(); } })),
            heat);
          list.appendChild(row);
        });
      }
      win.body.append(
        H('div', { class: 'toolbar' },
          H('button', { class: 'btn sm primary', html: LX.icon('plus', 13) + ' New habit', onclick: async () => {
            const n = await LX.dialog.prompt('Habit name', '', 'New habit');
            if (n && n.trim()) { habits.push({ id: LX.uid(), name: n.trim(), c: habits.length % COLORS.length, days: {} }); save(); paint(); }
          } }),
          H('span', { class: 'muted', style: { fontSize: '12px' }, text: habits.length + ' habits · tap a day cell to toggle' })),
        list);
      paint();
    },
  });
})();
