/* Leonux Tasks — lists, smart lists, due dates, priorities, subtasks, tags, reminders. */
(function () {
  'use strict';
  const H = LX.h;
  const KEY = 'app.todo.data';
  const PRIO = [{ n: 'None', c: 'var(--text-faint)' }, { n: 'Low', c: 'var(--accent)' }, { n: 'Medium', c: 'var(--warning)' }, { n: 'High', c: 'var(--danger)' }];
  const LCOL = ['#5B9DFA', '#9ECE6A', '#F6C177', '#F28B82', '#CBA6F7', '#4DD0E1'];
  const SMART = [
    { id: 's:today', name: 'Today', icon: 'sun' }, { id: 's:upcoming', name: 'Upcoming', icon: 'calendar' },
    { id: 's:important', name: 'Important', icon: 'star' }, { id: 's:all', name: 'All tasks', icon: 'list' }, { id: 's:done', name: 'Completed', icon: 'check' },
  ];
  let D = null;
  function load() {
    D = LX.store.get(KEY);
    if (!D || !Array.isArray(D.tasks)) {
      const now = Date.now(), day = 864e5, l1 = LX.uid(), l2 = LX.uid();
      const at = (d, h) => { const x = new Date(now + d * day); x.setHours(h, 0, 0, 0); return x.getTime(); };
      D = { sel: 's:today', lists: [{ id: l1, name: 'Personal', c: 0 }, { id: l2, name: 'Work', c: 2 }], tasks: [
        mk('Welcome to Tasks - tap the circle to complete me', l1, { due: at(0, 18), hasTime: true, prio: 2 }),
        mk('Plan the week', l2, { due: at(1, 9), hasTime: true, prio: 3, tags: ['planning'], subs: [{ id: LX.uid(), t: 'Review calendar', done: true }, { id: LX.uid(), t: 'Pick top 3 goals', done: false }] }),
        mk('Buy groceries', l1, { due: at(0, 0), prio: 1, tags: ['home'], star: true }),
        mk('Read a chapter', l1, { due: at(3, 0) }),
      ] };
    }
    D.lists = D.lists || []; D.sel = D.sel || 's:today';
  }
  function mk(title, list, o) { return Object.assign({ id: LX.uid(), list, title, notes: '', done: false, doneAt: 0, due: 0, hasTime: false, prio: 0, tags: [], subs: [], star: false, created: Date.now(), notified: false }, o || {}); }
  function save() { LX.store.set(KEY, D); LX.bus.emit('todo:change'); }
  const sod = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function isToday(t) { return t && sod(t.due) <= sod(Date.now()); }
  function inSmart(t, id) {
    if (id === 's:done') return t.done;
    if (t.done) return false;
    if (id === 's:today') return t.due && sod(t.due) <= sod(Date.now());
    if (id === 's:upcoming') return t.due && sod(t.due) > sod(Date.now());
    if (id === 's:important') return t.star || t.prio === 3;
    if (id === 's:all') return true;
    return t.list === id;
  }
  function dueLabel(t) {
    if (!t.due) return '';
    const dd = Math.round((sod(t.due) - sod(Date.now())) / 864e5);
    const base = dd === 0 ? 'Today' : dd === 1 ? 'Tomorrow' : dd === -1 ? 'Yesterday' : LX.fmtDate(t.due).replace(/^\w+, /, '');
    return base + (t.hasTime ? ', ' + LX.fmtTime(t.due) : '');
  }
  function overdue(t) { return !t.done && t.due && (t.hasTime ? t.due < Date.now() : sod(t.due) < sod(Date.now())); }
  function toLocalInput(ts, withTime) { const d = new Date(ts); const p = LX.pad; const s = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); return withTime ? s + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) : s; }

  // quick-add parser: "Call mum tomorrow 5pm !high #family"
  function parseQuick(text) {
    const o = { title: text, tags: [], prio: 0 };
    o.title = o.title.replace(/#([\w-]+)/g, (m, g) => { o.tags.push(g); return ''; });
    o.title = o.title.replace(/!(high|med|medium|low|1|2|3)\b/i, (m, g) => { g = g.toLowerCase(); o.prio = g === 'high' || g === '3' ? 3 : g.indexOf('med') === 0 || g === '2' ? 2 : 1; return ''; });
    let base = null;
    o.title = o.title.replace(/\b(today|tomorrow|tmr)\b/i, (m, g) => { base = new Date(); if (g.toLowerCase() !== 'today') base.setDate(base.getDate() + 1); return ''; });
    o.title = o.title.replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i, (m, g) => { const i = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(g.toLowerCase()); base = new Date(); let add = (i - base.getDay() + 7) % 7; if (!add) add = 7; base.setDate(base.getDate() + add); return ''; });
    let tm = null;
    o.title = o.title.replace(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, (m, h, mi, ap) => { h = +h % 12; if (/pm/i.test(ap)) h += 12; tm = [h, +(mi || 0)]; return ''; });
    if (!tm) o.title = o.title.replace(/\bat\s+(\d{1,2}):(\d{2})\b/i, (m, h, mi) => { tm = [+h, +mi]; return ''; });
    if (tm && !base) base = new Date();
    if (base) { base.setHours(tm ? tm[0] : 0, tm ? tm[1] : 0, 0, 0); o.due = base.getTime(); o.hasTime = !!tm; if (tm && o.due < Date.now() - 6e4 && sod(o.due) === sod(Date.now())) { /* past time today stays */ } }
    o.title = o.title.replace(/\s+/g, ' ').trim();
    return o;
  }

  // Public API (used by Lion Assistant)
  load();
  LX.todoApi = { add(title, o) { const t = mk(title, (o && o.list) || (D.lists[0] && D.lists[0].id) || '', o || {}); D.tasks.unshift(t); save(); return t; }, parse: parseQuick, data: () => D };

  // Background reminder checker (runs even when the window is closed)
  function check() {
    const now = Date.now(); let ch = false;
    D.tasks.forEach((t) => {
      if (t.done || !t.hasTime || !t.due || t.notified || t.due > now) return;
      t.notified = true; ch = true;
      if (now - t.due < 864e5) LX.notify({ title: 'Task due', body: t.title, icon: 'bell', appId: 'todo' });
    });
    if (ch) save();
  }
  LX.onInit(() => { setInterval(check, 15000); setTimeout(check, 3000); });

  LX.apps.register({
    id: 'todo', name: 'Tasks', icon: 'check', color: '#9ECE6A', category: 'Productivity',
    desc: 'Lists, due dates, priorities and subtasks', width: 940, height: 620, minWidth: 440, minHeight: 360,
    open(win) {
      let query = '', selId = null, drag = null;
      const side = H('div', { class: 'td-side scroll' });
      const listEl = H('div', { class: 'td-list scroll' });
      const head = H('div', { class: 'td-head' });
      const detail = H('div', { class: 'td-detail scroll' });
      const quick = H('input', { class: 'input td-quick', placeholder: 'Add a task…  try "Call mum tomorrow 5pm !high #family"', onkeydown: (e) => {
        if (e.key === 'Enter' && quick.value.trim()) {
          const p = parseQuick(quick.value.trim()); if (!p.title) return;
          const o = { prio: p.prio, tags: p.tags };
          if (p.due) { o.due = p.due; o.hasTime = p.hasTime; }
          if (D.sel === 's:today' && !o.due) { const d = new Date(); d.setHours(0, 0, 0, 0); o.due = d.getTime(); }
          if (D.sel === 's:important') o.star = true;
          const lst = D.lists.some((l) => l.id === D.sel) ? D.sel : (D.lists[0] ? D.lists[0].id : '');
          const t = mk(p.title, lst, o); D.tasks.unshift(t); quick.value = ''; save(); LX.audio.beep(660, 0.05);
        }
      } });
      const search = H('input', { class: 'input td-search', type: 'search', placeholder: 'Search…', oninput: () => { query = search.value.toLowerCase(); paintList(); } });
      const main = H('div', { class: 'td-main' }, head, H('div', { class: 'td-addrow' }, H('span', { html: LX.icon('plus', 16) }), quick), listEl);
      win.body.append(H('div', { class: 'td-wrap' }, side, main, detail));
      win.body.tabIndex = 0;

      const curName = () => { const s = SMART.find((x) => x.id === D.sel); if (s) return s.name; const l = D.lists.find((x) => x.id === D.sel); return l ? l.name : 'Tasks'; };
      function paintSide() {
        side.innerHTML = '';
        const row = (id, icon, name, color, ctx) => {
          const n = D.tasks.filter((t) => inSmart(t, id) && id !== 's:done').length;
          return H('div', { class: 'td-nav' + (D.sel === id ? ' active' : ''), onclick: () => { D.sel = id; selId = null; save(); }, oncontextmenu: ctx },
            H('span', { class: 'td-ni', style: color ? { color } : null, html: LX.icon(icon, 16) }), H('span', { class: 'grow ellipsis', text: name }), n && id !== 's:done' ? H('span', { class: 'td-cnt', text: n }) : null);
        };
        SMART.forEach((s) => side.appendChild(row(s.id, s.icon, s.name)));
        side.appendChild(H('div', { class: 'td-sec' }, 'LISTS', H('button', { class: 'btn icon sm ghost', title: 'New list', html: LX.icon('plus', 13), onclick: newList })));
        D.lists.forEach((l) => side.appendChild(row(l.id, 'list', l.name, LCOL[l.c % LCOL.length], (e) => { e.preventDefault(); LX.menu.show(e.clientX, e.clientY, [
          { label: 'Rename', icon: 'edit', action: async () => { const n = await LX.dialog.prompt('List name', l.name, 'Rename list'); if (n && n.trim()) { l.name = n.trim(); save(); } } },
          { label: 'Delete list', icon: 'trash', danger: true, action: async () => { if (await LX.dialog.confirm('Delete "' + l.name + '" and its tasks?', 'Delete list')) { D.tasks = D.tasks.filter((t) => t.list !== l.id); D.lists = D.lists.filter((x) => x !== l); D.sel = 's:today'; save(); } } }]); })));
      }
      async function newList() { const n = await LX.dialog.prompt('List name', '', 'New list'); if (n && n.trim()) { const l = { id: LX.uid(), name: n.trim(), c: D.lists.length % LCOL.length }; D.lists.push(l); D.sel = l.id; save(); } }

      function visible() {
        let a = D.tasks.filter((t) => inSmart(t, D.sel));
        if (query) a = D.tasks.filter((t) => (t.title + ' ' + t.notes + ' ' + t.tags.join(' ') + ' ' + t.subs.map((s) => s.t).join(' ')).toLowerCase().indexOf(query) >= 0);
        if (D.sel === 's:done') a.sort((x, y) => y.doneAt - x.doneAt);
        else if (D.sel === 's:upcoming') a.sort((x, y) => x.due - y.due);
        return a;
      }
      function paintHead() {
        const open = D.tasks.filter((t) => !t.done && inSmart(t, D.sel)).length, done = D.tasks.filter((t) => t.done && D.lists.some((l) => l.id === D.sel) && t.list === D.sel).length;
        head.innerHTML = '';
        head.append(H('div', { class: 'td-title' }, H('h2', { text: curName() }), H('span', { class: 'muted', text: D.sel === 's:today' ? LX.fmtDate(Date.now()) : open + ' open' + (done ? ' · ' + done + ' done' : '') })), H('span', { class: 'grow' }), search,
          D.sel === 's:done' ? H('button', { class: 'btn sm ghost', text: 'Clear', onclick: async () => { if (await LX.dialog.confirm('Delete all completed tasks?', 'Clear completed')) { D.tasks = D.tasks.filter((t) => !t.done); save(); } } }) : null);
        win.setTitle(curName() + ' - Tasks');
      }
      function taskEl(t) {
        const doneSubs = t.subs.filter((s) => s.done).length;
        const chk = H('button', { class: 'td-check' + (t.done ? ' on' : ''), title: 'Complete', html: LX.icon('check', 13), style: { '--pc': PRIO[t.prio].c }, onclick: (e) => { e.stopPropagation(); toggle(t, el); } });
        const el = H('div', { class: 'td-task' + (t.done ? ' done' : '') + (selId === t.id ? ' sel' : ''), draggable: !query && !t.done ? 'true' : 'false', dataset: { id: t.id },
          onclick: () => { selId = t.id; paintList(); paintDetail(); },
          oncontextmenu: (e) => { e.preventDefault(); selId = t.id; LX.menu.show(e.clientX, e.clientY, [
            { label: t.done ? 'Mark incomplete' : 'Complete', icon: 'check', action: () => toggle(t) },
            { label: t.star ? 'Remove star' : 'Mark important', icon: 'star', action: () => { t.star = !t.star; save(); } },
            { label: 'Due today', icon: 'sun', action: () => { const d = new Date(); d.setHours(0, 0, 0, 0); t.due = d.getTime(); t.hasTime = false; save(); } },
            { label: 'Due tomorrow', icon: 'calendar', action: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); t.due = d.getTime(); t.hasTime = false; save(); } },
            { label: 'Priority', icon: 'zap', children: PRIO.map((p, i) => ({ label: p.n, action: () => { t.prio = i; save(); } })) },
            { separator: true }, { label: 'Delete', icon: 'trash', danger: true, action: () => del(t) }]); },
          ondragstart: (e) => { drag = t.id; el.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', t.id); } catch (x) {} },
          ondragend: () => { drag = null; el.classList.remove('drag'); LX.$$('.td-task', listEl).forEach((x) => x.classList.remove('over-t', 'over-b')); },
          ondragover: (e) => { if (!drag || drag === t.id) return; e.preventDefault(); const r = el.getBoundingClientRect(), top = e.clientY < r.top + r.height / 2; el.classList.toggle('over-t', top); el.classList.toggle('over-b', !top); },
          ondragleave: () => el.classList.remove('over-t', 'over-b'),
          ondrop: (e) => { e.preventDefault(); if (!drag || drag === t.id) return; const r = el.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2; const mv = D.tasks.find((x) => x.id === drag); D.tasks = D.tasks.filter((x) => x !== mv); let i = D.tasks.indexOf(t); if (!before) i++; D.tasks.splice(i, 0, mv); drag = null; save(); } },
          chk,
          H('div', { class: 'td-body' }, H('div', { class: 'td-tt ellipsis', text: t.title }),
            H('div', { class: 'td-meta' },
              t.due ? H('span', { class: 'td-due' + (overdue(t) ? ' late' : ''), html: LX.icon('calendar', 11) + ' ' + LX.escape(dueLabel(t)) }) : null,
              t.subs.length ? H('span', { html: LX.icon('list', 11) + ' ' + doneSubs + '/' + t.subs.length }) : null,
              t.prio ? H('span', { class: 'td-pr', style: { color: PRIO[t.prio].c }, text: PRIO[t.prio].n }) : null,
              t.tags.map((g) => H('span', { class: 'td-tag', text: '#' + g })),
              !D.lists.some((l) => l.id === D.sel) && D.lists.find((l) => l.id === t.list) ? H('span', { class: 'muted', text: D.lists.find((l) => l.id === t.list).name }) : null)),
          H('button', { class: 'td-star' + (t.star ? ' on' : ''), title: 'Important', html: LX.icon('star', 15), onclick: (e) => { e.stopPropagation(); t.star = !t.star; save(); } }));
        return el;
      }
      function toggle(t, el) {
        t.done = !t.done; t.doneAt = t.done ? Date.now() : 0;
        if (t.done) {
          LX.audio.beep(880, 0.07, 'sine', 0.12);
          if (el) { el.classList.add('done', 'pop'); const c = LX.$('.td-check', el); c && c.classList.add('on'); setTimeout(save, 450); return; }
        }
        save();
      }
      function del(t) { D.tasks = D.tasks.filter((x) => x !== t); if (selId === t.id) selId = null; save(); }
      function paintList() {
        const keepY = listEl.scrollTop;
        listEl.innerHTML = '';
        const a = visible();
        if (!a.length) {
          listEl.appendChild(H('div', { class: 'td-empty' }, H('div', { class: 'td-eico', html: LX.icon(query ? 'search' : D.sel === 's:done' ? 'check' : 'sun', 44) }), H('b', { text: query ? 'No matches' : D.sel === 's:done' ? 'Nothing completed yet' : 'All clear' }), H('span', { class: 'muted', text: query ? 'Try a different search.' : 'Add a task above to get started.' })));
          return;
        }
        const open = a.filter((t) => !t.done), done = a.filter((t) => t.done);
        open.forEach((t) => listEl.appendChild(taskEl(t)));
        if (done.length && D.sel !== 's:done') { listEl.appendChild(H('div', { class: 'td-sec2', text: 'Completed (' + done.length + ')' })); }
        done.forEach((t) => listEl.appendChild(taskEl(t)));
        listEl.scrollTop = keepY;
      }
      function paintDetail() {
        const t = D.tasks.find((x) => x.id === selId);
        detail.classList.toggle('open', !!t); detail.innerHTML = '';
        if (!t) return;
        const title = H('input', { class: 'input td-dtitle', value: t.title, onchange: () => { if (title.value.trim()) { t.title = title.value.trim(); save(); } } });
        const notes = H('textarea', { class: 'textarea', rows: 3, placeholder: 'Notes', onchange: () => { t.notes = notes.value; LX.store.set(KEY, D); } }); notes.value = t.notes;
        const dueIn = H('input', { class: 'input', type: t.hasTime ? 'datetime-local' : 'date', value: t.due ? toLocalInput(t.due, t.hasTime) : '', onchange: () => {
          if (!dueIn.value) t.due = 0; else { const d = new Date(dueIn.value); t.due = d.getTime(); if (!t.hasTime) { d.setHours(0, 0, 0, 0); t.due = d.getTime(); } }
          t.notified = false; save(); } });
        const timeSw = H('input', { type: 'checkbox', onchange: () => { t.hasTime = timeSw.checked; if (t.hasTime && t.due) { const d = new Date(t.due); if (d.getHours() === 0 && d.getMinutes() === 0) { d.setHours(9, 0); t.due = d.getTime(); } } if (t.hasTime && !t.due) { const d = new Date(Date.now() + 36e5); d.setMinutes(0, 0, 0); t.due = d.getTime(); } t.notified = false; save(); } }); timeSw.checked = t.hasTime;
        const prio = H('select', { class: 'select', onchange: () => { t.prio = +prio.value; save(); } }, PRIO.map((p, i) => H('option', { value: i, text: p.n, selected: t.prio === i })));
        const lst = H('select', { class: 'select', onchange: () => { t.list = lst.value; save(); } }, D.lists.map((l) => H('option', { value: l.id, text: l.name, selected: t.list === l.id })));
        const tags = H('input', { class: 'input', placeholder: 'tags, comma separated', value: t.tags.join(', '), onchange: () => { t.tags = tags.value.split(/[,\s]+/).map((x) => x.replace(/^#/, '').trim()).filter(Boolean); save(); } });
        const subs = H('div', { class: 'td-subs' }, t.subs.map((s) => H('div', { class: 'td-sub' + (s.done ? ' done' : '') },
          H('input', { type: 'checkbox', checked: s.done, onchange: (e) => { s.done = e.target.checked; save(); } }),
          H('input', { class: 'td-subt', value: s.t, onchange: (e) => { s.t = e.target.value; LX.store.set(KEY, D); } }),
          H('button', { class: 'btn icon sm ghost', html: LX.icon('x', 12), onclick: () => { t.subs = t.subs.filter((x) => x !== s); save(); } }))));
        const subIn = H('input', { class: 'input', placeholder: 'Add subtask and press Enter', onkeydown: (e) => { if (e.key === 'Enter' && subIn.value.trim()) { t.subs.push({ id: LX.uid(), t: subIn.value.trim(), done: false }); save(); setTimeout(() => { const x = LX.$('.td-detail input[placeholder^="Add sub"]', win.body); x && x.focus(); }, 0); } } });
        detail.append(
          H('div', { class: 'row' }, H('b', { class: 'grow', text: 'Details' }), H('button', { class: 'btn icon sm ghost', html: LX.icon('x', 14), onclick: () => { selId = null; paintList(); paintDetail(); } })),
          title, notes,
          H('label', { class: 'td-f' }, 'Due', dueIn), H('label', { class: 'td-f row' }, H('span', { class: 'grow', text: 'Include time (reminder)' }), H('label', { class: 'switch' }, timeSw, H('span'))),
          H('div', { class: 'td-two' }, H('label', { class: 'td-f' }, 'Priority', prio), H('label', { class: 'td-f' }, 'List', lst)),
          H('label', { class: 'td-f' }, 'Tags', tags),
          H('div', { class: 'td-f' }, 'Subtasks', subs, subIn),
          H('div', { class: 'td-f muted', text: 'Created ' + LX.fmtDateTime(t.created) }),
          H('button', { class: 'btn danger sm', html: LX.icon('trash', 13) + ' Delete task', onclick: () => del(t) }));
      }
      function paint() { paintSide(); paintHead(); paintList(); paintDetail(); }
      const off = LX.bus.on('todo:change', () => { load2(); paint(); });
      function load2() { /* D is shared in-module */ }
      win.onClose(() => { off(); });
      win.body.addEventListener('keydown', (e) => {
        const tag = (e.target.tagName || '').toLowerCase();
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); search.focus(); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); quick.focus(); }
        else if (e.key === 'Escape') { if (selId) { selId = null; paintList(); paintDetail(); } else if (tag === 'input') e.target.blur(); }
        else if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
          const a = visible(); let i = a.findIndex((x) => x.id === selId);
          if (e.key === 'ArrowDown') { e.preventDefault(); i = Math.min(a.length - 1, i + 1); if (a[i]) { selId = a[i].id; paintList(); paintDetail(); } }
          else if (e.key === 'ArrowUp') { e.preventDefault(); i = Math.max(0, i - 1); if (a[i]) { selId = a[i].id; paintList(); paintDetail(); } }
          else if (e.key === ' ' && a[i]) { e.preventDefault(); toggle(a[i]); }
          else if (e.key === 'Delete' && a[i]) del(a[i]);
        }
      });
      win.setMenu([
        { label: 'Task', items: [{ label: 'New task', shortcut: 'Ctrl+N', action: () => quick.focus() }, { label: 'New list…', action: newList }, { separator: true },
          { label: 'Mark all done in view', action: () => { visible().forEach((t) => { if (!t.done) { t.done = true; t.doneAt = Date.now(); } }); save(); } },
          { label: 'Clear completed', action: () => { D.tasks = D.tasks.filter((t) => !t.done); save(); } }] },
        { label: 'View', items: SMART.map((s) => ({ label: s.name, action: () => { D.sel = s.id; save(); } })).concat([{ separator: true }, { label: 'Search', shortcut: 'Ctrl+F', action: () => search.focus() }]) },
      ]);
      paint(); setTimeout(() => quick.focus(), 50);
    },
  });
})();
