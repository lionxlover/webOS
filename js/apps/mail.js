/* Leonux Web OS — Mail: offline simulated mail client (folders, compose, reply, search, persisted) */
(function () {
  'use strict';
  const H = LX.h;
  const KEY = 'app.mail.messages';
  const ME = () => (LX.settings.get('fullname') || 'Leo Lion') + ' <' + (LX.settings.get('username') || 'leo') + '@leonux.local>';
  const FOLDERS = [['inbox', 'Inbox', 'mail'], ['starred', 'Starred', 'star'], ['sent', 'Sent', 'arrow-right'], ['drafts', 'Drafts', 'file'], ['trash', 'Trash', 'trash']];
  const nameOf = (s) => String(s || '').replace(/<.*>/, '').trim() || String(s || '');
  const addrOf = (s) => { const m = /<([^>]+)>/.exec(s || ''); return m ? m[1] : String(s || '').trim(); };
  function seed() {
    const now = Date.now(), H1 = 36e5, D = 864e5;
    const m = (from, subject, body, ago, extra) => Object.assign({ id: LX.uid(), folder: 'inbox', from, to: ME(), subject, body, date: now - ago, read: false, starred: false }, extra || {});
    return [
      m('Leonux Team <hello@leonux.local>', 'Welcome to Leonux Mail', 'Hi there,\n\nWelcome to Leonux OS! This mail client runs entirely offline: messages you send are stored locally and never leave this machine.\n\nTry composing a message, replying, starring or deleting items.\n\nEnjoy,\nThe Leonux Team', 20 * 6e4),
      m('Ada Lovelace <ada@analytical.org>', 'Notes on the Analytical Engine', 'Dear Leo,\n\nI have been thinking about how the Engine might compose music, were its fundamental relations expressible in its notation.\n\nWould you be free to discuss on Thursday?\n\nYours,\nAda', 3 * H1, { starred: true }),
      m('Grace Hopper <grace@navy.mil>', 'Re: Compiler status', 'Leo,\n\nThe compiler now handles English-like statements. It was a long night, but the nanoseconds are worth it.\n\nRegards,\nGrace', 9 * H1),
      m('Sam Rivera <sam@rivera.me>', 'Lunch tomorrow?', 'Hey! Are we still on for lunch tomorrow at 12:30? That new ramen place downtown looks good.\n\n- Sam', 1 * D + 2 * H1, { read: true }),
      m('Security <security@leonux.local>', 'Your system is up to date', 'All packages are current. No action required.\n\nLast scan: today.', 2 * D, { read: true }),
      m('Lena Fischer <lena@fischer.de>', 'Invoice #2026-114', 'Hello,\n\nPlease find the invoice for October attached (simulated). Payment due in 14 days.\n\nBest,\nLena', 4 * D),
      m('Maya Patel <maya.patel@mail.com>', 'Family photos', 'Hi Leo, I uploaded the photos from the weekend. Let me know what you think of the sunset shots!\n\nLove,\nMaya', 6 * D, { read: true, starred: true }),
      { id: LX.uid(), folder: 'sent', from: ME(), to: 'Sam Rivera <sam@rivera.me>', subject: 'Re: Lunch tomorrow?', body: 'Sounds great, see you at 12:30!', date: now - 1 * D, read: true, starred: false },
      { id: LX.uid(), folder: 'drafts', from: ME(), to: 'ada@analytical.org', subject: 'Thursday', body: 'Thursday works for me. Shall we meet at', date: now - 2 * H1, read: true, starred: false },
    ];
  }
  let msgs = null;
  const load = () => { if (!msgs) { const v = LX.store.get(KEY, null); msgs = Array.isArray(v) ? v.filter((x) => x && x.id) : seed(); if (!Array.isArray(v)) save(); } return msgs; };
  const save = () => { LX.store.set(KEY, msgs); LX.bus.emit('mail:change'); };
  function when(ts) { const d = new Date(ts), n = new Date(); if (d.toDateString() === n.toDateString()) return LX.fmtTime(d); if (n - d < 6 * 864e5) return d.toLocaleDateString('en-GB', { weekday: 'short' }); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  const inFolder = (m, f) => f === 'starred' ? m.starred && m.folder !== 'trash' : m.folder === f;

  LX.apps.register({
    id: 'mail', name: 'Mail', icon: 'mail', color: '#F6C177', category: 'Productivity',
    desc: 'Offline mail client with folders and compose', width: 960, height: 640, minWidth: 460, minHeight: 360,
    open(win, args) {
      load();
      const root = win.body; root.tabIndex = 0; root.style.flexDirection = 'row';
      let folder = 'inbox', selId = null, q = '';
      const side = H('div', { class: 'sidebar ml-side' }), listEl = H('div', { class: 'ml-list scroll' }), view = H('div', { class: 'ml-view scroll' });
      const search = H('input', { class: 'input', placeholder: 'Search mail…', oninput: (e) => { q = e.target.value.trim().toLowerCase(); drawList(); } });
      const listWrap = H('div', { class: 'ml-listwrap' }, H('div', { class: 'toolbar' }, search), listEl);
      root.append(side, listWrap, view);

      const vis = () => load().filter((m) => inFolder(m, folder) && (!q || [m.from, m.to, m.subject, m.body].join(' ').toLowerCase().includes(q))).sort((a, b) => b.date - a.date);
      function drawSide() {
        side.replaceChildren(H('button', { class: 'btn primary ml-compose', html: LX.icon('pencil', 15) + ' Compose', onclick: () => compose() }),
          ...FOLDERS.map(([k, l, ic]) => { const n = load().filter((m) => inFolder(m, k) && (k === 'inbox' ? !m.read : k === 'drafts')).length;
            return H('div', { class: 'list-item ml-f' + (folder === k ? ' active' : ''), onclick: () => { folder = k; selId = null; root.classList.remove('ml-reading'); drawAll(); } }, H('span', { html: LX.icon(ic, 16) }), H('span', { class: 'grow', text: l }), n ? H('span', { class: 'badge', text: String(n) }) : null); }),
          folder === 'trash' && load().some((m) => m.folder === 'trash') ? H('button', { class: 'btn sm ghost', text: 'Empty trash', onclick: () => LX.dialog.confirm('Permanently delete all messages in Trash?', 'Empty trash').then((ok) => { if (ok) { msgs = msgs.filter((m) => m.folder !== 'trash'); selId = null; save(); } }) }) : []);
      }
      function drawList() {
        const v = vis();
        listEl.replaceChildren(...(v.length ? v.map((m) => { const who = folder === 'sent' || folder === 'drafts' ? 'To: ' + (nameOf(m.to) || '(no recipient)') : nameOf(m.from);
          return H('div', { class: 'ml-item' + (m.id === selId ? ' active' : '') + (m.read ? '' : ' unread'), onclick: () => open(m.id),
            oncontextmenu: (e) => { e.preventDefault(); LX.menu.show(e.clientX, e.clientY, [{ label: m.read ? 'Mark as unread' : 'Mark as read', action: () => { m.read = !m.read; save(); } }, { label: m.starred ? 'Unstar' : 'Star', icon: 'star', action: () => { m.starred = !m.starred; save(); } }, { label: 'Reply', icon: 'arrow-left', disabled: m.folder === 'drafts', action: () => reply(m) }, { separator: true }, { label: m.folder === 'trash' ? 'Delete forever' : 'Move to Trash', icon: 'trash', action: () => remove(m) }]); } },
            H('div', { class: 'row' }, m.read ? null : H('i', { class: 'ml-dot' }), H('b', { class: 'grow ellipsis', text: who }), H('span', { class: 'muted ml-sm', text: when(m.date) }), m.starred ? H('span', { class: 'ml-star', html: LX.icon('star', 12) }) : null),
            H('div', { class: 'ellipsis ml-subj', text: m.subject || '(no subject)' }), H('div', { class: 'muted ml-sm ellipsis', text: m.body.replace(/\s+/g, ' ').slice(0, 90) })); })
          : [H('div', { class: 'muted center ml-empty' }, H('div', null, H('div', { html: LX.icon('mail', 40) }), H('p', { text: q ? 'No messages match.' : 'Nothing in ' + FOLDERS.find((f) => f[0] === folder)[1] + '.' })))]));
      }
      function open(id) {
        selId = id; const m = load().find((x) => x.id === id); if (!m) return;
        if (m.folder === 'drafts') { compose(m); return; }
        if (!m.read) { m.read = true; LX.store.set(KEY, msgs); }
        root.classList.add('ml-reading'); drawSide(); drawList(); drawView();
      }
      function drawView() {
        const m = load().find((x) => x.id === selId);
        if (!m) { view.replaceChildren(H('div', { class: 'muted center ml-empty', style: 'height:100%' }, H('div', null, H('div', { html: LX.icon('mail', 48) }), H('p', { text: 'Select a message to read.' })))); return; }
        view.replaceChildren(H('div', { class: 'ml-vh' },
          H('div', { class: 'row gap ml-vtools' }, H('button', { class: 'btn icon sm ml-back', title: 'Back', html: LX.icon('arrow-left', 16), onclick: () => root.classList.remove('ml-reading') }), H('div', { class: 'grow' }),
            H('button', { class: 'btn sm', html: LX.icon('arrow-left', 14) + ' Reply', onclick: () => reply(m) }), H('button', { class: 'btn sm', html: LX.icon('arrow-right', 14) + ' Forward', onclick: () => compose({ subject: 'Fwd: ' + m.subject.replace(/^Fwd: /, ''), body: '\n\n---------- Forwarded ----------\nFrom: ' + m.from + '\n\n' + m.body }) }),
            H('button', { class: 'btn icon sm', title: 'Star', html: LX.icon('star', 16), style: m.starred ? 'color:var(--warning)' : '', onclick: () => { m.starred = !m.starred; save(); } }),
            m.folder === 'trash' ? H('button', { class: 'btn sm', text: 'Restore', onclick: () => { m.folder = 'inbox'; save(); } }) : null,
            H('button', { class: 'btn icon sm danger', title: 'Delete', html: LX.icon('trash', 16), onclick: () => remove(m) })),
          H('h2', { class: 'ml-title', text: m.subject || '(no subject)' }),
          H('div', { class: 'ml-meta' }, H('div', { class: 'ml-av', text: (nameOf(m.from)[0] || '?').toUpperCase() }), H('div', { class: 'grow' }, H('div', null, H('b', { text: nameOf(m.from) }), ' ', H('span', { class: 'muted', text: '<' + addrOf(m.from) + '>' })), H('div', { class: 'muted ml-sm', text: 'To: ' + m.to + ' · ' + LX.fmtDateTime(m.date) })))),
          H('div', { class: 'ml-body', text: m.body }));
      }
      function remove(m) {
        if (m.folder === 'trash') { LX.dialog.confirm('Permanently delete this message?', 'Delete').then((ok) => { if (ok) { msgs = msgs.filter((x) => x.id !== m.id); if (selId === m.id) selId = null; save(); } }); return; }
        m.prevFolder = m.folder; m.folder = 'trash'; if (selId === m.id) { selId = null; root.classList.remove('ml-reading'); } save();
      }
      function reply(m) { compose({ to: addrOf(m.folder === 'sent' ? m.to : m.from), subject: /^Re:/i.test(m.subject) ? m.subject : 'Re: ' + m.subject, body: '\n\nOn ' + LX.fmtDateTime(m.date) + ', ' + nameOf(m.from) + ' wrote:\n' + m.body.split('\n').map((l) => '> ' + l).join('\n') }); }
      function compose(init) {
        init = init || {}; const draft = init.folder === 'drafts' ? init : null;
        const to = H('input', { class: 'input', placeholder: 'recipient@example.com', value: init.to || '' }), subj = H('input', { class: 'input', placeholder: 'Subject', value: init.subject || '' }), body = H('textarea', { class: 'textarea ml-ta' });
        body.value = init.body || ''; const err = H('div', { style: 'color:var(--danger);font-size:12px;min-height:16px' });
        const close = () => ov.remove();
        const saveDraft = () => { if (!to.value.trim() && !subj.value.trim() && !body.value.trim()) return; if (draft) Object.assign(draft, { to: to.value, subject: subj.value, body: body.value, date: Date.now() }); else msgs.push({ id: LX.uid(), folder: 'drafts', from: ME(), to: to.value, subject: subj.value, body: body.value, date: Date.now(), read: true, starred: false }); save(); };
        const send = () => {
          const rcpt = to.value.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
          if (!rcpt.length) { err.textContent = 'Add at least one recipient.'; to.focus(); return; }
          const bad = rcpt.find((r) => !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(addrOf(r))); if (bad) { err.textContent = '"' + bad + '" is not a valid address.'; to.focus(); return; }
          const msg = { id: draft ? draft.id : LX.uid(), folder: 'sent', from: ME(), to: rcpt.join(', '), subject: subj.value.trim(), body: body.value, date: Date.now(), read: true, starred: false };
          if (draft) msgs[msgs.findIndex((x) => x.id === draft.id)] = msg; else msgs.push(msg);
          // simulated delivery: local recipients auto-reply
          if (rcpt.some((r) => /@leonux\.local$/.test(addrOf(r)) || /hello@|echo@/.test(addrOf(r)))) setTimeout(() => { msgs.push({ id: LX.uid(), folder: 'inbox', from: rcpt[0], to: ME(), subject: 'Re: ' + msg.subject, body: 'Thanks for your message! (automatic reply from the offline mail simulator)', date: Date.now(), read: false, starred: false }); save(); LX.notify({ title: 'New mail', body: 'Re: ' + msg.subject, icon: 'mail', appId: 'mail' }); }, 2500);
          save(); close(); folder = 'sent'; selId = msg.id; drawAll(); LX.notify({ title: 'Message sent', body: 'To ' + rcpt.join(', '), icon: 'mail', timeout: 2500 });
        };
        const ov = H('div', { class: 'ml-ov', onmousedown: (e) => { if (e.target === ov) { saveDraft(); close(); } }, onkeydown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); saveDraft(); close(); } else if (e.key === 'Enter' && e.ctrlKey) send(); } },
          H('div', { class: 'card ml-dlg' }, H('h3', { text: init.subject && /^Re:/.test(init.subject) ? 'Reply' : 'New message' }), H('label', { class: 'ml-f2' }, H('span', { class: 'muted', text: 'To' }), to), H('label', { class: 'ml-f2' }, H('span', { class: 'muted', text: 'Subject' }), subj), body, err,
            H('div', { class: 'row gap' }, H('button', { class: 'btn ghost', text: 'Discard', onclick: () => { if (draft) { msgs = msgs.filter((x) => x.id !== draft.id); save(); } close(); } }), H('div', { class: 'grow muted ml-sm', text: 'Ctrl+Enter to send' }), H('button', { class: 'btn', text: 'Save draft', onclick: () => { saveDraft(); close(); } }), H('button', { class: 'btn primary', html: LX.icon('arrow-right', 14) + ' Send', onclick: send }))));
        root.appendChild(ov); setTimeout(() => (to.value ? body : to).focus(), 30);
      }
      const drawAll = () => { drawSide(); drawList(); drawView(); };
      const off = LX.bus.on('mail:change', drawAll); win.onClose(() => off());
      win.setMenu([{ label: 'Mail', items: [{ label: 'Compose', shortcut: 'Ctrl+N', action: () => compose() }, { label: 'Mark all as read', action() { load().forEach((m) => { if (m.folder === 'inbox') m.read = true; }); save(); } }, { separator: true }, { label: 'Reset mailbox', action() { LX.dialog.confirm('Restore the sample mailbox? This deletes your messages.', 'Reset mailbox').then((ok) => { if (ok) { msgs = seed(); save(); } }); } }] }]);
      root.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); compose(); } else if (e.key === 'Delete' && !e.target.matches('input,textarea') && selId) { const m = load().find((x) => x.id === selId); if (m) remove(m); } });
      drawAll();
      if (args && args.compose) compose(args.compose);
      win.on('args', (a) => { if (a && a.compose) compose(a.compose); });
    },
  });
})();
