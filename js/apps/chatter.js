/* Store app — Chatter: instant messenger with lifelike bot contacts (simulated network). */
(function () {
  'use strict';
  const H = LX.h;
  const KEY = 'app.chatter';

  LX.apps.register({
    id: 'chatter', name: 'Chatter', icon: 'message-circle', color: '#BB9AF7', category: 'Internet',
    pkg: true, pkgVersion: '1.0', pkgSize: 19, developer: 'PrideWorks', downloads: 1210,
    desc: 'Instant messenger with AI-ish friends', longDesc: 'A playful chat client with bot contacts who type, pause, reply and remember. Emoji quick-reactions, unread badges, per-contact history — all offline, all simulated.',
    permissions: ['Local storage'], changelog: 'First release.',
    width: 900, height: 620, minWidth: 520, minHeight: 420,
    open(win) {
      const BOTS = [
        { id: 'nova', name: 'Nova', color: '#5B9DFA', avatar: 'N', lines: ['That sounds amazing!', 'Tell me more 👀', 'Ha! You always say that.', 'On it. Give me five minutes.', 'Honestly? Same.', 'What are you building today?'], typing: 900 },
        { id: 'milo', name: 'Milo', color: '#F6C177', avatar: 'M', lines: ['Did you try the new App Store? 👀', 'Solitaire is my weakness.', 'brb, coffee ☕', 'You installing things again?', 'Send me a screenshot later!', 'ok that is genuinely cool'], typing: 1400 },
        { id: 'vera', name: 'Vera', color: '#F28B82', avatar: 'V', lines: ['Noted.', 'I disagree, but respectfully.', 'Interesting theory.', 'Prove it.', 'Fine. You win this round.', 'Adding it to the list.'], typing: 700 },
      ];
      let data = LX.store.get(KEY) || { chats: { nova: [{ me: 0, t: 'hey Nova, you around?' }, { me: 1, t: 'Always. What\'s up?' }], milo: [], vera: [] }, unread: { milo: 2 } };
      const save = () => LX.store.set(KEY, data);
      let cur = 'nova';

      const list = H('div', { class: 'sidebar ct-side' });
      const chat = H('div', { class: 'ct-chat col' });
      const input = H('input', { class: 'input grow ct-in', placeholder: 'Message…' });
      const msgs = H('div', { class: 'ct-msgs scroll' });
      const typingEl = H('div', { class: 'ct-typing hidden' }, H('span', null, H('i'), H('i'), H('i')));

      function bot(id) { return BOTS.find((b) => b.id === id); }
      function paintList() {
        list.innerHTML = '';
        list.appendChild(H('div', { class: 'ct-side-h' }, H('b', { text: 'Chatter' }), H('span', { class: 'muted', style: { fontSize: '11px' }, text: ' · 3 online' })));
        BOTS.forEach((b) => {
          const hist = data.chats[b.id] || [];
          const last = hist[hist.length - 1];
          const n = data.unread[b.id] || 0;
          const main = H('div', { class: 'grow', style: { minWidth: 0 } }, H('b', { text: b.name }),
            H('div', { class: 'muted ellipsis', style: { fontSize: '11.5px' }, text: last ? ((last.me ? 'You: ' : '') + last.t).slice(0, 42) : 'Say hi 👋' }));
          const tail = n ? H('span', { class: 'ct-badge', text: String(n) }) : H('span', { class: 'ct-on', title: 'online' });
          list.appendChild(H('div', { class: 'list-item ct-ct' + (cur === b.id ? ' active' : ''), onclick: () => openChat(b.id) },
            H('span', { class: 'ct-av', style: { background: b.color }, text: b.avatar }), main, tail));
        });
      }
      function openChat(id) {
        cur = id;
        delete data.unread[id]; save();
        paintList(); paintChat();
        input.focus();
      }
      function paintChat() {
        const b = bot(cur);
        msgs.innerHTML = '';
        (data.chats[cur] || []).forEach((m) => {
          msgs.appendChild(H('div', { class: 'ct-msg' + (m.me ? ' me' : '') },
            H('span', { class: 'ct-msg-av', style: { background: m.me ? 'var(--accent)' : b.color }, text: m.me ? 'You'[0] : b.avatar }),
            H('div', { class: 'ct-bubble' }, H('span', { text: m.t })), m.t && H('span', { class: 'ct-time muted', text: m.at ? LX.fmtTime(m.at) : '' })));
        });
        msgs.scrollTop = msgs.scrollHeight;
        win.setTitle(bot(cur).name + ' — Chatter');
        chat.querySelector('.ct-head-name') && (chat.querySelector('.ct-head-name').textContent = bot(cur).name);
      }
      function send() {
        const t = input.value.trim();
        if (!t) return;
        input.value = '';
        (data.chats[cur] = data.chats[cur] || []).push({ me: 1, t, at: Date.now() });
        save(); paintChat(); paintList();
        // typing… then reply
        const b = bot(cur);
        typingEl.classList.remove('hidden');
        const r = LX.seeded(cur + t);
        setTimeout(() => {
          typingEl.classList.add('hidden');
          let reply = b.lines[Math.floor(r() * b.lines.length)];
          if (/\?$/.test(t)) reply = r() < .5 ? 'Good question — my guess is yes.' : 'Hard to say. What do you think?';
          if (/install|store|app/i.test(t)) reply = 'The App Store has like 26 apps now. Wild. 🦁';
          (data.chats[cur] = data.chats[cur] || []).push({ me: 0, t: reply, at: Date.now() });
          save(); paintChat(); paintList();
          LX.audio.beep(720, .07, 'sine', .12);
        }, b.typing + r() * 900);
      }
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
      const sendBtn = H('button', { class: 'btn primary', html: LX.icon('arrow-right', 15) + '<span>Send</span>', onclick: send });
      const emoji = H('div', { class: 'ct-emoji' }, ['👋', '😂', '🦁', '❤️', '🔥', '👍'].map((em) => H('button', { class: 'ct-em', text: em, onclick: () => { input.value += em; input.focus(); } })));

      chat.append(
        H('div', { class: 'ct-head' }, H('span', { class: 'ct-av', style: { background: '#5B9DFA' }, text: 'N' }), H('div', { class: 'grow' }, H('b', { class: 'ct-head-name', text: 'Nova' }), H('div', { class: 'muted', style: { fontSize: '11px' }, text: 'online · simulated' }))),
        msgs, typingEl,
        H('div', { class: 'ct-emoji-bar' }, emoji),
        H('div', { class: 'ct-input-bar' }, input, sendBtn));
      win.body.append(list, chat);
      openChat('nova');
    },
  });
})();
