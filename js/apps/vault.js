/* Store app — Password Vault: master-password-gated credential store (XOR-obfuscated). */
(function () {
  'use strict';
  const H = LX.h;
  const KEY = 'app.vault.blob';
  const enc = (s, k) => { let o = ''; for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ k.charCodeAt(i % k.length) ^ 42); return btoa(unescape(encodeURIComponent(o))); };
  const dec = (b, k) => { const s = decodeURIComponent(escape(atob(b))); let o = ''; for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ k.charCodeAt(i % k.length) ^ 42); return o; };

  LX.apps.register({
    id: 'vault', name: 'Password Vault', icon: 'lock', color: '#9ECE6A', category: 'Utilities',
    pkg: true, pkgVersion: '1.2', pkgSize: 7, developer: 'Leonux Labs', downloads: 1980,
    desc: 'Encrypted storage for passwords', longDesc: 'Keep credentials behind a master password. Entries are obfuscated at rest and only unlocked in-session. Includes a strong password generator and one-tap copy.',
    permissions: ['Local storage'], changelog: 'Faster unlock, new generator presets.',
    singleton: true,
    width: 820, height: 560, minWidth: 460, minHeight: 380,
    open(win) {
      const gate = H('div', { class: 'vl-gate center' });
      let master = null, entries = [], locked = true, lockTimer = null;

      function paintGate(msg) {
        win.body.innerHTML = '';
        gate.innerHTML = '';
        const hasMaster = !!LX.store.get(KEY);
        const pw = H('input', { class: 'input vl-pw', type: 'password', placeholder: hasMaster ? 'Master password' : 'Choose a master password', onkeydown: (e) => { if (e.key === 'Enter') go(); } });
        gate.append(H('div', { class: 'vl-gate-logo', html: LX.icon('lock', 44) }),
          H('h2', { text: hasMaster ? 'Unlock your vault' : 'Set up your vault' }),
          H('p', { class: 'muted', style: { maxWidth: '380px' }, text: hasMaster ? 'Enter the master password to decrypt your credentials for this session.' : 'Pick a master password. It never leaves this device and is not recoverable — remember it well.' }),
          pw, H('div', { class: 'vl-err', text: msg || '' }),
          H('button', { class: 'btn primary', style: { marginTop: '12px' }, text: hasMaster ? 'Unlock' : 'Create vault', onclick: () => go() }));
        win.body.append(gate);
        setTimeout(() => pw.focus(), 60);
      }
      async function go() {
        const val = gate.querySelector('.vl-pw').value;
        const hasMaster = !!LX.store.get(KEY);
        if (!val) return fail('Enter a password');
        if (!hasMaster) {
          if (val.length < 4) return fail('Use at least 4 characters');
          master = val; entries = [];
          LX.store.set(KEY, enc(JSON.stringify(entries), master));
        } else {
          try { entries = JSON.parse(dec(LX.store.get(KEY), val)); master = val; }
          catch (e) { return fail('Wrong master password'); }
          if (!Array.isArray(entries)) { entries = []; return fail('Wrong master password'); }
        }
        locked = false;
        armLock();
        paintApp();
      }
      function fail(m) { paintGate(m); LX.audio.beep(180, 0.15, 'square', 0.1); }
      function persist() { if (master) LX.store.set(KEY, enc(JSON.stringify(entries), master)); }
      function armLock() {
        clearTimeout(lockTimer);
        lockTimer = setTimeout(() => { if (!locked) { locked = true; master = null; entries = []; paintGate('Auto-locked after inactivity'); } }, 5 * 60 * 1000);
      }

      function genPass(len, sym, num, up) {
        const L = 'abcdefghijkmnopqrstuvwxyz', U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', N = '23456789', S = '!@#$%&*?+-=';
        let pool = L; if (up) pool += U; if (num) pool += N; if (sym) pool += S;
        let out = '';
        const arr = new Uint32Array(len); crypto.getRandomValues(arr);
        for (let i = 0; i < len; i++) out += pool[arr[i] % pool.length];
        return out;
      }
      function strength(p) {
        let s = 0;
        if (p.length >= 8) s++; if (p.length >= 12) s++;
        if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
        if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
        return Math.min(4, s);
      }

      function paintApp() {
        win.body.innerHTML = '';
        const list = H('div', { class: 'vl-list scroll grow' });
        const search = H('input', { class: 'input grow', placeholder: 'Search vault…', oninput: () => paintList(search.value.toLowerCase()) });
        const gen = H('div', { class: 'vl-gen card' });
        function paintGen() {
          const len = LX.store.get('app.vault.genLen', 16);
          const val = genPass(len, true, true, true);
          gen.innerHTML = '';
          gen.append(H('div', { class: 'row gap' }, H('b', { text: 'Generator' }),
            H('button', { class: 'btn sm ghost', html: LX.icon('refresh', 13), title: 'Reroll', onclick: paintGen }),
            H('span', { class: 'grow' })),
            H('div', { class: 'vl-gen-out', onclick: () => { LX.clipboard.copy(val); LX.notify({ title: 'Copied', body: 'Password copied to clipboard.', icon: 'copy', timeout: 1600 }); } }, H('code', { text: val }), H('span', { class: 'muted', style: { fontSize: '11px' }, text: 'tap to copy' })));
        }
        function paintList(q) {
          list.innerHTML = '';
          const shown = entries.filter((e) => !q || (e.title + ' ' + e.user + ' ' + e.url).toLowerCase().indexOf(q) >= 0);
          if (!shown.length) list.appendChild(H('div', { class: 'center muted', style: { padding: '36px' }, text: entries.length ? 'No matches.' : 'Vault is empty — add your first credential.' }));
          shown.forEach((e) => {
            const revealed = H('button', { class: 'btn sm ghost', title: 'Reveal', html: LX.icon('zoom-in', 13), onclick: () => { pwEl.textContent = pwEl.dataset.shown === '1' ? '••••••••' : e.pass; pwEl.dataset.shown = pwEl.dataset.shown === '1' ? '0' : '1'; } });
            const pwEl = H('code', { class: 'vl-pass', dataset: { shown: '0' }, text: '••••••••' });
            list.appendChild(H('div', { class: 'card vl-entry' },
              H('div', { class: 'row gap', style: { marginBottom: '6px' } },
                H('b', { class: 'grow ellipsis', text: e.title }),
                e.url && H('span', { class: 'muted ellipsis', style: { fontSize: '11.5px', maxWidth: '160px' }, text: e.url }),
                H('button', { class: 'btn sm ghost', title: 'Copy password', html: LX.icon('copy', 13), onclick: () => { LX.clipboard.copy(e.pass); LX.notify({ title: 'Copied', body: 'Password for ' + e.title, icon: 'copy', timeout: 1500 }); } }),
                H('button', { class: 'btn sm ghost danger', title: 'Delete', html: LX.icon('trash', 13), onclick: async () => { if (await LX.dialog.confirm('Delete ' + e.title + '?', 'Delete entry')) { entries = entries.filter((x) => x !== e); persist(); paintList(search.value.toLowerCase()); } } })),
              H('div', { class: 'muted', style: { fontSize: '12px' }, text: e.user || '—' }),
              H('div', { class: 'row gap' }, pwEl, revealed)));
          });
        }
        paintGen();
        win.body.append(
          H('div', { class: 'toolbar' }, search,
            H('button', { class: 'btn primary sm', html: LX.icon('plus', 13) + ' Add', onclick: addEntry }),
            H('button', { class: 'btn sm ghost', title: 'Lock now', html: LX.icon('lock', 13) + ' Lock', onclick: () => { locked = true; master = null; entries = []; clearTimeout(lockTimer); paintGate('Locked'); } })),
          H('div', { class: 'vl-main' }, list, gen));
        paintList('');
      }
      async function addEntry() {
        const title = await LX.dialog.prompt('Title (e.g. Email)', '', 'New entry'); if (!title || !title.trim()) return;
        const user = await LX.dialog.prompt('Username / email', '', 'New entry'); if (user == null) return;
        let pass = '';
        while (!pass) {
          const p1 = await LX.dialog.prompt('Password (or leave blank to generate)', '', 'New entry'); if (p1 == null) return;
          pass = p1 || genPass(16, true, true, true);
        }
        const url = await LX.dialog.prompt('Site URL (optional)', '', 'New entry'); if (url == null) return;
        entries.push({ title: title.trim(), user: user.trim(), pass, url: (url || '').trim() });
        persist(); paintApp();
      }
      ['pointerdown', 'keydown'].forEach((ev) => win.body.addEventListener(ev, () => { if (!locked) armLock(); }));
      paintGate();
    },
  });
})();
