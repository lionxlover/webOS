/* Leonux Web OS — Contacts: list + detail, groups, favourites, search, persisted */
(function () {
  'use strict';
  const H = LX.h;
  const KEY = 'app.contacts';
  const COLORS = ['#5B9DFA', '#9ECE6A', '#F6C177', '#F28B82', '#BB9AF7', '#4FD1C5', '#F78FB3'];
  const GROUPS = ['Family', 'Friends', 'Work', 'Other'];
  const seed = () => [
    ['Ada Lovelace', 'ada@analytical.org', '+44 20 7946 0001', 'Analytical Engines', 'Work', 'First programmer.'], ['Alan Turing', 'alan@bletchley.uk', '+44 20 7946 0002', 'Bletchley Park', 'Work', ''],
    ['Grace Hopper', 'grace@navy.mil', '+1 202 555 0143', 'US Navy', 'Work', 'Found the first bug.'], ['Linus Torvalds', 'linus@kernel.org', '+1 503 555 0199', 'Linux Foundation', 'Friends', ''],
    ['Maya Patel', 'maya.patel@mail.com', '+91 98765 43210', '', 'Family', 'Birthday: 14 March'], ['Sam Rivera', 'sam@rivera.me', '+1 415 555 0170', 'Rivera Studio', 'Friends', 'Lunch buddy'],
    ['Lena Fischer', 'lena@fischer.de', '+49 30 5550 123', 'Fischer GmbH', 'Work', ''], ['Tomás Silva', 'tomas.silva@mail.pt', '+351 21 555 0188', '', 'Other', ''],
  ].map((r, i) => ({ id: LX.uid(), name: r[0], email: r[1], phone: r[2], company: r[3], group: r[4], notes: r[5], fav: i === 4 || i === 5, color: COLORS[i % COLORS.length], address: '', birthday: '' }));
  let data = null;
  const load = () => { if (!data) { const v = LX.store.get(KEY, null); data = Array.isArray(v) ? v.filter((c) => c && c.id) : seed(); if (!Array.isArray(v)) save(); } return data; };
  const save = () => { LX.store.set(KEY, data); LX.bus.emit('contacts:change'); };
  const initials = (n) => (n.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || '?').toUpperCase();
  const avatar = (c, sz) => H('div', { class: 'ct-av', style: 'width:' + sz + 'px;height:' + sz + 'px;font-size:' + Math.round(sz * .38) + 'px;background:' + c.color, text: initials(c.name) });

  LX.apps.register({
    id: 'contacts', name: 'Contacts', icon: 'users', color: '#BB9AF7', category: 'Productivity',
    desc: 'Address book with groups and favourites', width: 860, height: 600, minWidth: 420, minHeight: 340,
    open(win, args) {
      load();
      const root = win.body; root.tabIndex = 0; root.style.flexDirection = 'row';
      let filter = 'all', q = '', selId = null, editing = null;
      const groupsEl = H('div', { class: 'list ct-groups' });
      const listEl = H('div', { class: 'ct-list scroll' });
      const detail = H('div', { class: 'ct-detail scroll' });
      const search = H('input', { class: 'input', placeholder: 'Search contacts…', oninput: (e) => { q = e.target.value.trim().toLowerCase(); drawList(); } });
      const left = H('div', { class: 'ct-left' }, H('div', { class: 'toolbar' }, search, H('button', { class: 'btn primary icon sm', title: 'New contact', html: LX.icon('plus', 16), onclick: () => startEdit(null) })), groupsEl, listEl);
      root.append(left, detail);

      const visible = () => load().filter((c) => (filter === 'all' || (filter === 'fav' ? c.fav : c.group === filter)) && (!q || [c.name, c.email, c.phone, c.company].join(' ').toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
      function drawGroups() {
        const items = [['all', 'All', 'users'], ['fav', 'Favourites', 'star']].concat(GROUPS.map((g) => [g, g, 'folder']));
        groupsEl.replaceChildren(...items.map(([k, l, ic]) => H('div', { class: 'list-item ct-gi' + (filter === k ? ' active' : ''), onclick: () => { filter = k; drawGroups(); drawList(); } }, H('span', { html: LX.icon(ic, 14) }), H('span', { class: 'grow', text: l }), H('span', { class: 'muted', text: String(load().filter((c) => k === 'all' || (k === 'fav' ? c.fav : c.group === k)).length) }))));
      }
      function drawList() {
        const v = visible(); let last = '';
        listEl.replaceChildren(...(v.length ? v.flatMap((c) => { const out = [], L = c.name[0] ? c.name[0].toUpperCase() : '#'; if (L !== last) { last = L; out.push(H('div', { class: 'ct-letter muted', text: L })); }
          out.push(H('div', { class: 'list-item ct-item' + (c.id === selId ? ' active' : ''), onclick: () => { selId = c.id; editing = null; drawList(); drawDetail(); },
            oncontextmenu: (e) => { e.preventDefault(); LX.menu.show(e.clientX, e.clientY, [{ label: c.fav ? 'Remove favourite' : 'Add to favourites', icon: 'star', action: () => fav(c) }, { label: 'Edit', icon: 'edit', action: () => { selId = c.id; startEdit(c); } }, { label: 'Delete', icon: 'trash', action: () => del(c) }]); } },
            avatar(c, 36), H('div', { class: 'grow' }, H('div', { class: 'ellipsis', text: c.name }), H('div', { class: 'muted ct-sm ellipsis', text: c.company || c.email || c.phone || '' })), c.fav ? H('span', { class: 'ct-star', html: LX.icon('star', 14) }) : null)); return out; })
          : [H('div', { class: 'muted center ct-empty', text: q ? 'No contacts match your search.' : 'No contacts here yet.' })]));
      }
      function fav(c) { c.fav = !c.fav; save(); }
      function del(c) { LX.dialog.confirm('Delete ' + c.name + '?', 'Delete contact').then((ok) => { if (ok) { data = data.filter((x) => x.id !== c.id); if (selId === c.id) selId = null; save(); } }); }
      function row(label, val, href) { return val ? H('div', { class: 'ct-row' }, H('span', { class: 'muted ct-lab', text: label }), href ? H('a', { href, text: val, onclick: (e) => { e.preventDefault(); if (href.startsWith('mailto:')) { LX.apps.launch('mail', { compose: { to: val } }); } else LX.clipboard.copy(val).then(() => LX.notify({ title: 'Copied', body: val, icon: 'copy', timeout: 1800 })); } }) : H('span', { text: val })) : null; }
      function drawDetail() {
        const c = load().find((x) => x.id === selId);
        if (editing) return drawEdit();
        if (!c) { detail.replaceChildren(H('div', { class: 'muted center ct-empty', style: 'height:100%' }, H('div', null, H('div', { html: LX.icon('user', 48) }), H('p', { text: 'Select a contact or create a new one.' }), H('button', { class: 'btn primary', text: 'New contact', onclick: () => startEdit(null) })))); return; }
        detail.replaceChildren(H('div', { class: 'ct-head' }, avatar(c, 88), H('h2', { text: c.name }), H('div', { class: 'muted', text: [c.company, c.group].filter(Boolean).join(' · ') }),
          H('div', { class: 'row gap ct-acts' }, H('button', { class: 'btn' + (c.fav ? ' primary' : ''), html: LX.icon('star', 15) + (c.fav ? ' Favourite' : ' Favourite'), onclick: () => fav(c) }), H('button', { class: 'btn', html: LX.icon('mail', 15) + ' Email', disabled: !c.email, onclick: () => LX.apps.launch('mail', { compose: { to: c.email } }) }), H('button', { class: 'btn', html: LX.icon('edit', 15) + ' Edit', onclick: () => startEdit(c) }), H('button', { class: 'btn danger', html: LX.icon('trash', 15), title: 'Delete', onclick: () => del(c) }))),
          H('div', { class: 'card ct-card' }, row('phone', c.phone, 'tel:' + c.phone), row('email', c.email, 'mailto:' + c.email), row('company', c.company), row('group', c.group), row('address', c.address), row('birthday', c.birthday), row('notes', c.notes)));
      }
      function startEdit(c) { editing = c ? { ...c } : { id: LX.uid(), name: '', email: '', phone: '', company: '', group: filter !== 'all' && GROUPS.includes(filter) ? filter : 'Friends', notes: '', fav: filter === 'fav', color: LX.pick(COLORS), address: '', birthday: '', _new: true }; drawDetail(); }
      function drawEdit() {
        const e = editing, f = {};
        const fld = (k, l, o) => { f[k] = H('input', Object.assign({ class: 'input', value: e[k] || '', placeholder: l }, o || {})); return H('label', { class: 'ct-f' }, H('span', { class: 'muted', text: l }), f[k]); };
        f.group = H('select', { class: 'select' }, GROUPS.map((g) => H('option', { value: g, text: g, selected: e.group === g })));
        f.notes = H('textarea', { class: 'textarea', rows: 3 }); f.notes.value = e.notes || '';
        const err = H('div', { style: 'color:var(--danger);font-size:12px;min-height:16px' });
        const submit = () => {
          const name = f.name.value.trim(); if (!name) { err.textContent = 'Name is required.'; f.name.focus(); return; }
          const em = f.email.value.trim(); if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { err.textContent = 'Enter a valid email address.'; f.email.focus(); return; }
          const out = { id: e.id, name, email: em, phone: f.phone.value.trim(), company: f.company.value.trim(), group: f.group.value, notes: f.notes.value, fav: e.fav, color: e.color, address: f.address.value.trim(), birthday: f.birthday.value };
          if (e._new) data.push(out); else data[data.findIndex((x) => x.id === e.id)] = out;
          selId = e.id; editing = null; save();
        };
        const form = H('div', { class: 'ct-form', onkeydown: (ev) => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') submit(); else if (ev.key === 'Escape') { ev.stopPropagation(); editing = null; drawDetail(); } } },
          H('h3', { text: e._new ? 'New contact' : 'Edit contact' }), fld('name', 'Name'), fld('phone', 'Phone', { type: 'tel' }), fld('email', 'Email', { type: 'email' }), fld('company', 'Company'), H('label', { class: 'ct-f' }, H('span', { class: 'muted', text: 'Group' }), f.group), fld('address', 'Address'), fld('birthday', 'Birthday', { type: 'date' }), H('label', { class: 'ct-f' }, H('span', { class: 'muted', text: 'Notes' }), f.notes), err,
          H('div', { class: 'row gap' }, H('button', { class: 'btn ghost', text: 'Cancel', onclick: () => { editing = null; drawDetail(); } }), H('button', { class: 'btn primary', text: 'Save', onclick: submit })));
        detail.replaceChildren(form); setTimeout(() => f.name.focus(), 20);
      }
      const redraw = () => { drawGroups(); drawList(); if (!editing) drawDetail(); };
      const off = LX.bus.on('contacts:change', redraw);
      win.onClose(() => off());
      win.setMenu([{ label: 'Contact', items: [{ label: 'New contact', shortcut: 'Ctrl+N', action: () => startEdit(null) }, { label: 'Export vCard to Documents', action() { const vc = load().map((c) => 'BEGIN:VCARD\nVERSION:3.0\nFN:' + c.name + '\nTEL:' + c.phone + '\nEMAIL:' + c.email + '\nORG:' + c.company + '\nEND:VCARD').join('\n'); try { LX.vfs.write('/home/user/Documents/contacts.vcf', vc, { mime: 'text/vcard' }); LX.notify({ title: 'Contacts exported', body: 'Documents/contacts.vcf', icon: 'users' }); } catch (e) { LX.dialog.alert(String(e.message || e)); } } }] }]);
      root.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); startEdit(null); } else if (e.key === 'Delete' && !e.target.matches('input,textarea,select') && selId) { const c = load().find((x) => x.id === selId); if (c) del(c); } });
      if (args && args.new) startEdit(null);
      else if (visible()[0]) selId = visible()[0].id;
      drawGroups(); drawList(); drawDetail();
    },
  });
})();
