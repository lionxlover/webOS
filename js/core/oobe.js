/* Leonux OS 2 — first-run OOBE (out-of-box experience).
   Runs once after the very first boot: personalize theme/accent/wallpaper,
   create the account, pick recommended apps, then "installs the system"
   with real progress — chosen apps genuinely install through the package manager. */
(function () {
  'use strict';
  const H = LX.h;
  const WALLS = ['aurora', 'savanna', 'glacier', 'blossom', 'prism', 'aurora2'];
  const ACCENTS = ['#5B9DFA', '#9ECE6A', '#F6C177', '#F28B82', '#CBA6F7', '#4DD0E1', '#FF8A65', '#F48FB1'];
  const RECOMMENDED = [
    ['codestudio', 'Code Studio'], ['solitaire', 'Solitaire'], ['vault', 'Password Vault'],
    ['kanban', 'Kanban Boards'], ['chess', 'Chess'], ['spreadsheets', 'Leonux Sheets'],
    ['chatter', 'Chatter'], ['sketchbook', 'Sketchbook'],
  ];

  LX.oobe = {
    needed() { return !LX.store.get('oobe.done', false); },
    run(done) { wizard(done); },
  };

  function wizard(onDone) {
    const root = document.getElementById('oobe');
    if (!root) { (onDone || (() => {}))(); return; }
    root.classList.add('show'); root.innerHTML = '';
    const state = { step: 0, theme: 'dark', accent: '#5B9DFA', wallpaper: 'aurora', fullname: '', username: '', password: '', picks: new Set(RECOMMENDED.slice(0, 4).map((r) => r[0])) };

    const card = H('div', { class: 'ob-card' });
    const dots = H('div', { class: 'ob-dots' });
    root.append(H('div', { class: 'ob-bg' }), H('div', { class: 'ob-wrap' }, dots, card));

    const STEPS = 5;
    function paintDots() {
      dots.innerHTML = '';
      for (let i = 0; i < STEPS; i++) dots.appendChild(H('span', { class: 'ob-dot' + (i === state.step ? ' cur' : '') + (i < state.step ? ' done' : '') }));
    }

    function navBtns(nextLabel, onNext, back) {
      const row = H('div', { class: 'ob-nav' });
      if (back) row.appendChild(H('button', { class: 'btn ghost ob-back', html: LX.icon('chevron-left', 15) + ' Back', onclick: () => { state.step--; render(); } }));
      row.appendChild(H('span', { class: 'grow' }));
      row.appendChild(H('button', { class: 'btn primary ob-next', text: nextLabel || 'Continue', onclick: onNext }));
      return row;
    }

    function render() {
      paintDots();
      card.innerHTML = '';
      card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
      const s = state.step;

      if (s === 0) { // ---- welcome ----
        card.append(
          H('div', { class: 'ob-logo' }, H('div', { class: 'ob-logo-mark' }), H('div', { class: 'ob-title' }, H('h1', { text: 'Welcome to Leonux' }), H('p', { class: 'muted', text: 'The desktop OS that lives in your browser. In the next few steps you will personalize it, create your account, and install it so it runs offline — no internet needed after setup.' }))),
          H('div', { class: 'ob-feats' },
            ['Windows & multitasking', 'Real App Store', 'Runs fully offline', '26+ apps & games'].map((t) => H('span', { class: 'ob-chip', html: LX.icon('check-circle', 14) + LX.escape(t) }))),
          navBtns('Get started', () => { state.step = 1; render(); }));
      }

      if (s === 1) { // ---- personalize ----
        const themes = H('div', { class: 'ob-opts' },
          ['dark', 'light', 'auto'].map((t) => H('button', { class: 'ob-opt' + (state.theme === t ? ' on' : ''), onclick: () => { state.theme = t; LX.settings.set('theme', t); render(); } },
            H('span', { class: 'ob-opt-ico', html: LX.icon(t === 'dark' ? 'moon' : t === 'light' ? 'sun' : 'zap', 20) }),
            H('span', {}, H('b', { text: t[0].toUpperCase() + t.slice(1) }), H('small', { class: 'muted', text: t === 'auto' ? 'Follows your system' : t === 'dark' ? 'Deep midnight glass' : 'Bright & airy' })))));
        const accents = H('div', { class: 'ob-swatches' }, ACCENTS.map((c) => H('button', { class: 'ob-swatch' + (state.accent === c ? ' on' : ''), style: { background: c }, onclick: () => { state.accent = c; LX.settings.set('accent', c); render(); } })));
        const walls = H('div', { class: 'ob-walls' }, WALLS.map((w) => H('button', { class: 'ob-wall' + (state.wallpaper === w ? ' on' : ''), style: { background: LX.theme.wallpapers[w].css }, onclick: () => { state.wallpaper = w; LX.settings.set('wallpaper', w); render(); } })));
        card.append(H('h2', { text: 'Make it yours' }), H('p', { class: 'muted ob-sub', text: 'Pick a look — you can change everything later in Settings.' }),
          H('div', { class: 'ob-lbl', text: 'Theme' }), themes,
          H('div', { class: 'ob-lbl', text: 'Accent' }), accents,
          H('div', { class: 'ob-lbl', text: 'Wallpaper' }), walls,
          navBtns('Continue', () => { state.step = 2; render(); }, true));
      }

      if (s === 2) { // ---- account ----
        const fn = H('input', { class: 'input ob-in', value: state.fullname, placeholder: 'e.g. Ada Lovelace', oninput: () => { state.fullname = fn.value; } });
        const un = H('input', { class: 'input ob-in', value: state.username, placeholder: 'lowercase, no spaces', oninput: () => { state.username = un.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); un.value = state.username; } });
        const pw = H('input', { class: 'input ob-in', type: 'password', value: state.password, placeholder: 'Leave blank for no password', oninput: () => { state.password = pw.value; } });
        card.append(H('h2', { text: 'Create your account' }), H('p', { class: 'muted ob-sub', text: 'This account lives only on this device.' }),
          H('div', { class: 'ob-lbl', text: 'Full name' }), fn,
          H('div', { class: 'ob-lbl', text: 'Username' }), un,
          H('div', { class: 'ob-lbl', text: 'Password (optional)' }), pw,
          H('div', { class: 'muted ob-note', html: LX.icon('info', 13) + ' Tip: skip the password on shared computers — you can add one later in Settings.' }),
          navBtns('Continue', () => {
            if (!state.fullname.trim()) { fn.focus(); fn.classList.add('shake'); setTimeout(() => fn.classList.remove('shake'), 500); return; }
            if (!state.username.trim()) state.username = 'user';
            state.step = 3; render();
          }, true));
        setTimeout(() => fn.focus(), 80);
      }

      if (s === 3) { // ---- recommended apps ----
        const grid = H('div', { class: 'ob-apps' }, RECOMMENDED.map(([id, name]) => {
          const a = LX.apps.get(id) || { icon: 'package', color: '#5B9DFA', name };
          return H('button', { class: 'ob-app' + (state.picks.has(id) ? ' on' : ''), onclick: (e) => { e.preventDefault(); state.picks.has(id) ? state.picks.delete(id) : state.picks.add(id); render(); } },
            H('span', { class: 'ob-app-ico', style: { background: 'linear-gradient(135deg,' + a.color + ',' + a.color + '99)' }, html: LX.icon(a.icon, 22) }),
            H('span', { class: 'ob-app-name', text: name }),
            H('span', { class: 'ob-app-check', html: LX.icon('check', 13) }));
        }));
        card.append(H('h2', { text: 'Start with some apps?' }), H('p', { class: 'muted ob-sub', text: 'These install now from the App Store. You can always install more later — there are 26+ apps, games and tools.' }),
          grid,
          H('div', { class: 'ob-lbl', style: { marginTop: '14px' }, text: 'Selected: ' + state.picks.size + ' of ' + RECOMMENDED.length }),
          navBtns('Install Leonux', () => { state.step = 4; render(); }, true));
      }

      if (s === 4) { // ---- installing ----
        card.classList.add('ob-installing');
        const bar = H('div', { class: 'progress ob-prog' }, H('div', { style: { width: '0%' } }));
        const line = H('div', { class: 'ob-step-line muted', text: 'Preparing…' });
        const list = H('div', { class: 'ob-install-list' });
        card.append(H('h2', { text: 'Installing your system' }), H('p', { class: 'muted ob-sub', text: 'Setting up ' + LX.escape(state.fullname || 'your') + '\'s Leonux. This takes a few seconds.' }), bar, line, list);

        const phases = [
          ['Applying your wallpaper and theme', 12],
          ['Creating your home folders', 22],
          ['Writing system manifest', 30],
        ];
        const ids = [...state.picks];
        let pi = 0;
        const total = 30 + ids.length * 14 + 10;
        let done = 30;
        function phaseNext() {
          if (pi < phases.length) {
            const [label, to] = phases[pi++];
            line.textContent = label;
            bar.firstElementChild.style.width = to + '%';
            setTimeout(phaseNext, 420);
          } else installApps();
        }
        // register sw.js so the whole system is cached for offline use (http/https only)
        function offlineStep() {
          line.textContent = 'Enabling offline mode…';
          const row = H('div', { class: 'ob-irow' }, H('span', { class: 'ob-irow-ico', html: LX.icon('cloud', 16) }), H('span', { class: 'grow', text: 'Offline mode' }), H('span', { class: 'muted ob-irow-st', text: 'Caching…' }));
          list.appendChild(row); list.scrollTop = list.scrollHeight;
          const st = row.querySelector('.ob-irow-st');
          const note = (t) => { list.appendChild(H('div', { class: 'muted ob-note', style: { marginTop: '8px', lineHeight: 1.5 }, html: LX.icon('info', 13) + ' ' + LX.escape(t) })); list.scrollTop = list.scrollHeight; };
          const guard = new Promise((res) => setTimeout(() => res({ ok: false, reason: 'timeout' }), 10000));
          return Promise.race([LX.pwa ? LX.pwa.register() : Promise.resolve({ ok: false, reason: 'unsupported' }), guard]).then((r) => {
            if (r.ok) { st.textContent = r.slow ? 'Finishing in background' : 'Ready'; row.classList.add('ok'); }
            else if (r.reason === 'file') { st.textContent = 'Not needed'; note('Leonux is running from a local file, so everything is already on this device. Offline caching (a service worker) only exists on http/https — host the folder or open it from a web address to install it as an app.'); }
            else if (r.reason === 'insecure') { st.textContent = 'Needs HTTPS'; note('Offline install needs a secure (https) address. Leonux still works fully in this tab.'); }
            else { st.textContent = 'Unavailable'; note('Your browser could not enable offline caching here. Leonux still works in this tab.'); }
          }).catch(() => { st.textContent = 'Unavailable'; });
        }
        function installApps() {
          if (!ids.length) return offlineStep().then(() => setTimeout(finish, r_wait()));
          const id = ids.shift();
          const a = LX.apps.get(id);
          const row = H('div', { class: 'ob-irow' }, H('span', { class: 'ob-irow-ico', html: LX.icon(a ? a.icon : 'package', 16) }), H('span', { class: 'grow', text: (a ? a.name : id) }), H('span', { class: 'muted ob-irow-st', text: 'Downloading…' }));
          list.appendChild(row);
          const next = (okMsg) => {
            const st = row.querySelector('.ob-irow-st');
            st.textContent = okMsg || 'Installed';
            if (!okMsg) row.classList.add('ok');
            done += 14; bar.firstElementChild.style.width = Math.min(96, done / total * 100) + '%';
            installApps();
          };
          // a failing app must never block the rest of the setup
          let p; try { p = Promise.resolve(LX.packages.install(id)); } catch (e) { p = Promise.reject(e); }
          p.then(() => next(), () => next('Skipped — install later from the App Store'));
        }
        function finish() {
          line.textContent = 'Almost there…';
          bar.firstElementChild.style.width = '100%';
          setTimeout(() => {
            // apply account
            LX.settings.set('fullname', state.fullname.trim() || 'Leo Lion');
            LX.settings.set('username', state.username || 'leo');
            if (state.password) LX.settings.set('password', state.password);
            LX.store.set('oobe.done', true);
            LX.bus.emit('oobe:done');
            root.classList.add('done');
            setTimeout(() => { root.classList.remove('show', 'done'); root.innerHTML = ''; (onDone || (() => {}))(); }, 600);
          }, 500);
        }
        function r_wait() { return LX.pwa && LX.pwa.context === 'secure' ? 200 : 1800; } // leave time to read the note
        phaseNext();
      }
    }
    render();
  }
})();
