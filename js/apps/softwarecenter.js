/* Leonux OS 2.1 — App Store 3.0: the live, web-based store.
   Two kinds of content side by side:
   · Leonux Store — the classic built-in app catalog (packages.js)
   · Live repositories — anyone publishes a repo.json manifest (GitHub, Pages, any static
     host), pastes the link in Sources, and the store pulls apps, themes, widgets and
     sound packs straight from that repo (LX.repos). The OS stays a separate body. */
(function () {
  'use strict';
  const H = LX.h;

  const FEATURED = [
    { id: 'codestudio', tag: 'Code anything, anywhere', bg: 'linear-gradient(120deg,#1a2b4a,#2d4a7a 45%,#74C7EC)' },
    { id: 'solitaire', tag: 'The classic, beautifully dealt', bg: 'linear-gradient(120deg,#0e3a1f,#1f6b3a 50%,#7EE787)' },
    { id: 'vault', tag: 'Your keys, your castle', bg: 'linear-gradient(120deg,#2a2e14,#4a5a20 50%,#9ECE6A)' },
    { id: 'chess', tag: 'Checkmate in style', bg: 'linear-gradient(120deg,#3a2a10,#6b5a2a 55%,#E0AF68)' },
  ];
  const NEW_PICKS = ['liondle', 'sketchbook', 'wavefm', 'chatter', 'tides', 'colorpicker', 'pomodoro', 'finance'];
  const CATS = [['apps', 'Apps', 'grid'], ['games', 'Games', 'gamepad'], ['productivity', 'Productivity', 'sticky'], ['developer', 'Developer', 'code'], ['media', 'Media', 'music'], ['internet', 'Internet', 'globe'], ['utilities', 'Utilities', 'zap']];
  const LIVE = [['themes', 'Themes', 'palette'], ['widgets', 'Widgets', 'layers'], ['soundpacks', 'Sound Packs', 'volume']];
  const CATMAP = { Games: 'games', Productivity: 'productivity', Developer: 'developer', Media: 'media', Internet: 'internet', Utilities: 'utilities', System: 'utilities', Other: 'utilities', Apps: 'utilities' };
  const TYPEMETA = { app: { label: 'App', icon: 'package' }, theme: { label: 'Theme', icon: 'palette' }, widget: { label: 'Widget', icon: 'layers' }, soundpack: { label: 'Sound Pack', icon: 'volume' } };
  const REVIEW_NAMES = ['Ava K.', 'Marco P.', 'Sana R.', 'Theo L.', 'Nina B.', 'Kofi A.', 'Iris M.', 'Dmitri V.', 'Priya S.', 'Leo F.'];
  const REVIEW_TEXTS = {
    default: ['Exactly what I needed — works offline on the train.', 'Beautiful interface, smooth on my old laptop.', 'Replaced three other tools for me.', 'Great experience so far. Small learning curve.', 'Solid. Would love more content like this.', 'Runs perfectly inside Leonux. Feels native.'],
    games: ['Addictive! My high score is safe… for now.', 'Great controls, runs at 60fps in the browser.', 'Perfect coffee-break game.', 'Love the polish — feels like a real OS game.', 'The difficulty curve is just right.'],
    theme: ['My desktop has never looked this good.', 'Perfectly matched accent colours.', 'Subtle, classy, easy on the eyes.', 'Paired beautifully with the dark mode.'],
    widget: ['Sits quietly on my desktop, exactly as promised.', 'Useful at a glance — love it.', 'Great addition to the widget stack.'],
    soundpack: ['The startup chime alone is worth it.', 'Such a satisfying little click.', 'Finally my OS sounds like me.'],
  };
  const SND_NAMES = [['startup', 'Startup'], ['shutdown', 'Shutdown'], ['unlock', 'Unlock'], ['lock', 'Lock'], ['launch', 'App launch'], ['notify', 'Notification'], ['install', 'Install complete'], ['error', 'Error'], ['trash', 'Trash'], ['click', 'Click']];

  // ---------- catalogs ----------
  function builtinCatalog() {
    const out = [];
    LX.apps.list().forEach((a) => {
      if (a.id === 'softwarecenter' || a.id === 'files-props' || a.dynamic) return;
      if (a.category === 'System' && !a.pkg) { out.push(mkBuiltin(a, true)); return; }
      if (a.pkg) out.push(mkBuiltin(a, false));
      else if (!a.hidden) out.push(mkBuiltin(a, true));
    });
    return out;
  }
  function mkBuiltin(a, builtin) {
    const r = LX.seeded('st:' + a.id);
    const rating = +(3.9 + r() * 1.05).toFixed(1);
    const reviews = [];
    const cat = CATMAP[a.category] === 'games' ? 'games' : 'default';
    const pool = REVIEW_TEXTS[cat] || REVIEW_TEXTS.default;
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) reviews.push({ name: REVIEW_NAMES[Math.floor(r() * REVIEW_NAMES.length)], stars: Math.max(3, Math.min(5, Math.round(rating + (r() - 0.4)))), text: pool[Math.floor(r() * pool.length)] });
    return {
      key: 'b:' + a.id, kind: 'builtin', type: 'app', id: a.id, app: a,
      name: a.name, icon: a.icon, color: a.color, cat: a.category, catKey: CATMAP[a.category] || 'utilities',
      desc: a.desc || 'A Leonux application.', long: a.longDesc || (a.desc || 'A Leonux application.') + ' Fully offline, sandboxed inside Leonux, and tuned for the desktop experience.',
      size: a.pkgSize || 6 + LX.hash(a.id, 44), sizeKB: false, rating, downloads: a.downloads != null ? a.downloads : 120 + LX.hash(a.id + 'dl', 3800),
      dev: a.developer || (builtin ? 'Leonux Team' : 'Leonux Labs'), builtin, version: LX.packages.versionOf(a.id),
      perms: a.permissions || [], reviews, changelog: a.changelog, updated: a.updated || 'Recently',
    };
  }
  function repoCatalog() {
    return LX.repos.catalog().map((e) => {
      const r = LX.seeded('rp:' + e.key);
      const catKey = e.type === 'app' ? (CATMAP[e.category] || 'utilities') : null;
      const pool = REVIEW_TEXTS[e.type === 'app' ? (catKey === 'games' ? 'games' : 'default') : e.type] || REVIEW_TEXTS.default;
      const reviews = [];
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) reviews.push({ name: REVIEW_NAMES[Math.floor(r() * REVIEW_NAMES.length)], stars: Math.max(3, Math.min(5, Math.round(e.rating + (r() - 0.4)))), text: pool[Math.floor(r() * pool.length)] });
      return Object.assign({}, e, {
        kind: 'repo', catKey, sizeKB: true, reviews, dev: e.developer || 'Community',
        installedV: (LX.repos.installedRec(e.type, e.id) || {}).version || null,
      });
    });
  }
  function allEntries() { return builtinCatalog().concat(repoCatalog()); }

  function fmtSize(e) { return e.sizeKB ? (e.size >= 1024 ? (e.size / 1024).toFixed(1) + ' MB' : e.size + ' KB') : e.size + ' MB'; }
  function fmtDL(k) { return k >= 1000 ? (k / 1000).toFixed(1).replace(/\.0$/, '') + 'M' : k + 'K'; }
  function ago(t) { const d = (Date.now() - t) / 1000; if (d < 60) return 'just now'; if (d < 3600) return Math.round(d / 60) + ' min ago'; if (d < 86400) return Math.round(d / 3600) + ' h ago'; return Math.round(d / 86400) + ' d ago'; }

  // ---------- shared component builders ----------
  function iconEl(e, big) {
    return H('span', { class: 'ast-ico' + (big ? ' big' : ''), style: { background: 'linear-gradient(140deg,' + e.color + ',' + e.color + 'cc)' }, html: LX.icon(e.icon, big ? 34 : 22) });
  }
  function starsEl(e, small) {
    return H('span', { class: 'ast-stars' + (small ? ' sm' : '') }, H('b', { text: e.rating.toFixed(1) }), H('span', { class: 'ast-star-txt', text: LX.stars(e.rating) }), !small && H('span', { class: 'muted', text: '· ' + fmtDL(e.downloads) }));
  }
  function repoChip(e) {
    if (e.kind !== 'repo') return null;
    return H('span', { class: 'ast-repo-chip', title: 'Live from ' + e.repo.name }, H('span', { class: 'ast-live-dot' }), e.repo.name.length > 18 ? e.repo.name.slice(0, 17) + '…' : e.repo.name);
  }
  function zipChip(e) {
    if (!e.zip) return null;
    return H('span', { class: 'ast-zip-chip', title: 'Multi-file app — one index.html plus css/, js/ and assets, distributed as a .zip package', html: LX.icon('package', 11) + ' ZIP' });
  }

  function progressUI(e) {
    const el = H('div', { class: 'ast-prog' },
      H('div', { class: 'progress' }, H('div', { style: { width: '2%' } })),
      H('span', { class: 'ast-prog-t muted' }, '0%'),
      H('button', { class: 'btn sm ghost', text: 'Cancel', onclick: () => { if (e.kind === 'repo') LX.repos.cancel(e.key); else LX.packages.cancel(e.id); } }));
    const bar = el.firstChild.firstChild;
    const txt = el.querySelector('.ast-prog-t');
    const apply = (ev) => {
      if (!el.isConnected) return;
      bar.style.width = Math.max(2, ev.pct || 2) + '%';
      txt.textContent = Math.round(ev.pct || 2) + '%' + (ev.rate ? ' · ' + (ev.rate > 1024 ? (ev.rate / 1024).toFixed(1) + ' GB/s' : ev.rate.toFixed(1) + ' MB/s') : '');
    };
    const offR = LX.bus.on('repos:progress', (ev) => { if (ev.key === e.key) apply(ev); });
    const offP = LX.bus.on('packages:progress', (ev) => { if (ev.id === e.id) apply(ev); });
    const die = () => { offR(); offP(); };
    const mo = new MutationObserver(() => { if (!el.isConnected) { die(); mo.disconnect(); } });
    mo.observe(document.body, { childList: true, subtree: true });
    return el;
  }

  // action button for ANY entry type
  function actionBtn(e, row) {
    const wrap = H('div', { class: 'ast-act' });
    const nocb = (fn) => (ev) => { ev.stopPropagation(); fn(ev); };
    const paint = () => {
      wrap.innerHTML = '';
      if (e.kind === 'builtin') return paintBuiltin();
      return paintRepo();
    };
    function paintBuiltin() {
      if (LX.packages.isDownloading(e.id) || LX.packages.isUpdating(e.id)) { wrap.appendChild(progressUI(e)); return; }
      if (e.builtin && !e.app.pkg) {
        wrap.appendChild(H('button', { class: 'btn sm' + (row ? '' : ' primary'), text: 'Open', onclick: nocb(() => LX.apps.launch(e.id)) }));
        wrap.appendChild(H('span', { class: 'badge', text: 'Built-in' }));
        return;
      }
      if (LX.packages.isInstalled(e.id)) {
        const updatable = LX.packages.updates().indexOf(e.id) >= 0;
        if (updatable) wrap.appendChild(H('button', { class: 'btn sm primary', text: 'Update', onclick: nocb(() => doUpdate(e)) }));
        else wrap.appendChild(H('button', { class: 'btn sm' + (row ? '' : ' primary'), text: 'Open', onclick: nocb(() => LX.apps.launch(e.id)) }));
        wrap.appendChild(uninstallBtn(e));
        return;
      }
      wrap.appendChild(H('button', { class: 'btn sm primary', html: LX.icon('download2', 13) + ' Get', onclick: nocb(() => doInstall(e)) }));
    }
    function paintRepo() {
      if (LX.repos.isDownloading(e.key)) { wrap.appendChild(progressUI(e)); return; }
      const rec = LX.repos.installedRec(e.type, e.id);
      if (rec) {
        if (e.version && rec.version && cmpV(e.version, rec.version) > 0) {
          wrap.appendChild(H('button', { class: 'btn sm primary', text: 'Update', onclick: nocb(() => LX.repos.update(e)) }));
        } else {
          let label = 'Open', act = () => {};
          if (e.type === 'app') { act = () => LX.apps.launch(LX.repos.appIdOf(e.id)); }
          else if (e.type === 'theme') { label = 'Apply'; act = () => { LX.theme.applyDynamic(e.id); LX.notify({ title: e.name + ' applied', body: 'Enjoy the new look.', icon: 'palette', timeout: 2500 }); }; }
          else if (e.type === 'soundpack') { label = LX.settings.get('soundPack') === e.id ? 'Active' : 'Apply'; act = () => { LX.settings.set('soundPack', e.id); LX.audio.event('notify'); paint(); }; }
          else { label = 'Added'; act = () => LX.apps.launch('settings', { page: 'appearance' }); }
          wrap.appendChild(H('button', { class: 'btn sm' + (row ? '' : ' primary') + (label === 'Active' || label === 'Added' ? ' ghost' : ''), text: label, onclick: nocb(act) }));
        }
        wrap.appendChild(uninstallBtn(e));
        return;
      }
      wrap.appendChild(H('button', { class: 'btn sm primary', html: LX.icon('download2', 13) + ' Get', onclick: nocb(() => doRepoInstall(e)) }));
    }
    paint();
    const offs = [LX.bus.on('packages:progress', paint), LX.bus.on('repos:progress', paint), LX.bus.on('packages:change', paint), LX.bus.on('repos:change', paint), LX.bus.on('settings:change', (ev) => { if (ev.key === 'soundPack') paint(); })];
    row && row._cleanup && row._cleanup.push(() => offs.forEach((f) => f()));
    return wrap;
  }
  function uninstallBtn(e) {
    return H('button', { class: 'btn sm ghost', title: 'Uninstall', html: LX.icon('trash', 13), onclick: async (ev) => {
      ev.stopPropagation();
      if (await LX.dialog.confirm('Remove ' + e.name + '? You can reinstall it from the App Store at any time.', 'Uninstall ' + e.name)) {
        if (e.kind === 'repo') LX.repos.uninstall(e.type, e.id);
        else LX.packages.uninstall(e.id);
      }
    } });
  }
  function cmpV(a, b) {
    const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x < y ? -1 : 1; }
    return 0;
  }
  function doInstall(e) {
    LX.notify({ title: 'Downloading ' + e.name, body: e.size + ' MB from the Leonux App Store', icon: 'download2', timeout: 2500 });
    LX.packages.install(e.id);
  }
  function doRepoInstall(e) {
    LX.notify({ title: 'Downloading ' + e.name, body: fmtSize(e) + ' from ' + (e.repo ? e.repo.name : 'repository'), icon: 'download2', timeout: 2500 });
    LX.repos.install(e).catch((err) => LX.notify({ title: 'Could not install ' + e.name, body: err.message || 'Download failed — check your connection.', icon: 'alert' }));
  }
  function doUpdate(e) {
    LX.notify({ title: 'Updating ' + e.name, body: 'Fetching the latest version…', icon: 'refresh2', timeout: 2500 });
    LX.packages.update(e.id).then(() => LX.notify({ title: e.name + ' updated', body: 'Now running v' + LX.packages.versionOf(e.id), icon: 'check-circle' }));
  }

  // ---------- app ----------
  LX.apps.register({
    id: 'softwarecenter', name: 'App Store', icon: 'store', color: '#FAB387', category: 'System', singleton: true,
    desc: 'Discover and install apps, themes, widgets and sound packs', longDesc: 'The Leonux App Store: browse the built-in catalog and any live repository you connect — apps, themes, widgets and sound packs, installed straight from the web and stored on your device for offline use.',
    width: 980, height: 660, minWidth: 480, minHeight: 380,
    open(win, args) {
      let view = (args && args.view) || LX.store.get('app.store.view', 'home');
      let detail = null; // entry object (or builtin id string via args.app)
      let repoFilter = null, q = '';
      const cleanups = [];

      const side = H('div', { class: 'sidebar ast-side' });
      const search = H('input', { class: 'input ast-search', placeholder: 'Search apps, themes, widgets…', oninput: LX.debounce(() => { q = search.value.trim().toLowerCase(); view = q ? 'search' : 'home'; detail = null; draw(); }, 120) });
      const scroll = H('div', { class: 'ast-scroll scroll' });
      const status = H('span', { class: 'muted', style: { fontSize: '12px' } });
      const syncBtn = H('button', { class: 'btn sm ghost', title: 'Refresh all repositories', html: LX.icon('refresh2', 14), onclick: syncAll });
      win.body.append(side, H('div', { class: 'ast-main' }, H('div', { class: 'toolbar' }, search, H('span', { class: 'grow' }), status, syncBtn), scroll));

      function syncAll() {
        syncBtn.classList.add('spin');
        LX.repos.refreshAll().then(() => {
          syncBtn.classList.remove('spin');
          LX.notify({ title: 'Repositories synced', body: 'Catalogs are up to date.', icon: 'check-circle', timeout: 2200 });
          draw();
        });
      }

      // ---- sidebar ----
      function sideItem(c, badge) {
        return H('div', { class: 'list-item ast-cat' + (view === c[0] && !detail ? ' active' : '') + (view === c[0] && repoFilter ? ' active' : ''), tabindex: 0, role: 'button', onclick: () => { view = c[0]; detail = null; repoFilter = null; q = ''; search.value = ''; LX.store.set('app.store.view', view); draw(); } },
          H('span', { html: LX.icon(c[2], 16) }), H('span', { class: 'grow', text: c[1] }), badge);
      }
      function drawSide() {
        side.innerHTML = '';
        side.appendChild(H('div', { class: 'ast-brand' }, H('span', { class: 'ast-brand-ico', html: LX.icon('store', 20) }), H('b', { text: 'App Store' })));
        side.appendChild(sideItem(['home', 'Discover', 'star']));
        side.appendChild(H('div', { class: 'ast-grp', text: 'Leonux Store' }));
        CATS.forEach((c) => side.appendChild(sideItem(c)));
        side.appendChild(H('div', { class: 'ast-grp', text: 'Live repositories' }));
        LIVE.forEach((c) => side.appendChild(sideItem(c)));
        side.appendChild(H('div', { class: 'ast-grp', text: 'Library' }));
        const upd = updateCount();
        side.appendChild(sideItem(['updates', 'Updates', 'refresh2'], upd ? H('span', { class: 'badge ast-nbadge', text: LX.plural(upd, '') }) : null));
        side.appendChild(sideItem(['installed', 'Installed', 'check-circle']));
        side.appendChild(H('div', { class: 'ast-grp', text: 'Manage' }));
        const repos = LX.repos.list();
        side.appendChild(sideItem(['sources', 'Sources', 'globe'], H('span', { class: 'badge' + (repos.length ? ' ast-live-badge' : ''), title: repos.length + (repos.length === 1 ? ' repository connected' : ' repositories connected'), text: String(repos.length) })));
        const u = LX.repos.usage();
        side.appendChild(H('div', { class: 'ast-side-foot' },
          H('div', { class: 'muted', style: { fontSize: '11px' }, text: LX.plural(repos.length, 'repo') + ' · ' + u.count + ' items · ' + u.mb + ' MB' })));
      }
      function updateCount() { return LX.packages.updateCount(); }

      // ---- home ----
      function heroCard(e, tag) {
        return H('div', { class: 'ast-hero', style: { background: 'linear-gradient(120deg,' + e.color + '40,#151a24 55%,' + e.color + ')' } },
          H('div', { class: 'ast-hero-txt' }, e.zip ? H('span', { class: 'ast-zip-hero', text: '📦 Multi-file app' }) : null,
            H('span', { class: 'ast-hero-kicker', text: e.kind === 'repo' ? 'FROM YOUR REPOSITORIES' : 'EDITOR’S CHOICE' }), H('h2', { text: e.name }), H('p', { text: tag || e.desc }),
            H('div', { class: 'row gap' }, H('button', { class: 'btn sm', style: { background: 'rgba(255,255,255,.16)' }, text: 'Learn more', onclick: () => { detail = e; draw(); } }), actionBtn(e))),
          iconEl(e, true));
      }
      function carousel(heroes) {
        const rot = H('div', { class: 'ast-hero-wrap' });
        const dots = H('div', { class: 'ast-hero-dots' });
        let hi = 0;
        heroes.forEach((el, i) => { if (i) el.classList.add('hidden'); rot.appendChild(el); });
        heroes.forEach((f, i) => dots.appendChild(H('button', { class: i === 0 ? 'on' : '', onclick: () => { hi = i; paint(); } })));
        function paint() { heroes.forEach((el, i) => el.classList.toggle('hidden', i !== hi)); dots.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === hi)); }
        const t = setInterval(() => { hi = (hi + 1) % heroes.length; paint(); }, 5200);
        cleanups.push(() => clearInterval(t));
        return H('span', rot, dots);
      }
      function repoBanner() {
        const repos = LX.repos.list();
        if (!repos.length) return H('div', { class: 'ast-cta card', role: 'button', tabindex: 0, onclick: () => { view = 'sources'; draw(); } },
          H('span', { class: 'ast-cta-ico', html: LX.icon('globe', 26) }),
          H('div', { class: 'grow' }, H('b', { text: 'Connect the live App Store' }), H('div', { class: 'muted', style: { fontSize: '12.5px' }, text: 'Publish the appstore repo on GitHub and paste the link in Sources — apps, themes, widgets and sound packs stream straight in.' })),
          H('button', { class: 'btn primary sm', text: 'Add a repository' }));
        const chips = H('div', { class: 'ast-chiprow' });
        repos.forEach((r) => {
          chips.appendChild(H('span', { class: 'ast-repo-chip', title: r.desc || r.name, onclick: () => { view = 'apps'; repoFilter = r.id; draw(); } },
            H('span', { class: 'ast-live-dot' }), r.name, H('span', { class: 'muted' }, ' · ' + repoCounts(r))));
        });
        return chips;
      }
      function repoCounts(r) {
        const cat = LX.repos.catalog().filter((e) => e.repoId === r.id);
        const n = { apps: 0, themes: 0, widgets: 0, soundpacks: 0 };
        cat.forEach((e) => { n[e.type + 's']++; });
        return n.apps + ' apps · ' + n.themes + ' themes · ' + n.widgets + ' widgets · ' + n.soundpacks + ' packs';
      }
      function homeView() {
        const repos = LX.repos.list();
        const rc = repoCatalog();
        const apps = rc.filter((e) => e.type === 'app');
        const heroes = apps.sort((a, b) => b.downloads - a.downloads).slice(0, 4).map((e) => heroCard(e));
        const bc = builtinCatalog();
        const news = NEW_PICKS.map((id) => bc.find((e) => e.id === id)).filter(Boolean).map((e) => cardOf(e));
        const top = bc.filter((e) => !e.builtin).sort((a, b) => b.downloads - a.downloads).slice(0, 6);
        scroll.append(repoBanner());
        if (heroes.length) scroll.append(section('Fresh from your repositories', carousel(heroes)));
        if (rc.filter((e) => e.type === 'theme').length) scroll.append(section('Themes', H('div', { class: 'ast-themerow scroll-x' }, rc.filter((e) => e.type === 'theme').map((e) => themeCard(e)))));
        if (rc.filter((e) => e.type === 'widget').length) scroll.append(section('Widgets', H('div', { class: 'ast-hgrid' }, rc.filter((e) => e.type === 'widget').slice(0, 6).map((e) => cardOf(e)))));
        if (rc.filter((e) => e.type === 'soundpack').length) scroll.append(section('Sound Packs', H('div', { class: 'ast-hgrid' }, rc.filter((e) => e.type === 'soundpack').map((e) => cardOf(e)))));
        scroll.append(section('New & noteworthy', H('div', { class: 'ast-hgrid' }, news)));
        scroll.append(section('Top Free', H('div', { class: 'ast-rows' }, top.map((e, i) => chartRow(e, i + 1)))));
        scroll.append(section('Browse categories', H('div', { class: 'ast-hgrid' }, ['games', 'productivity', 'developer', 'media', 'internet', 'utilities'].map((k) => {
          const meta = CATS.find((c) => c[0] === k);
          return H('button', { class: 'ast-catcard', onclick: () => { view = k; draw(); } }, H('span', { html: LX.icon(meta[2], 22) }), H('b', { text: meta[1] }), H('small', { class: 'muted', text: LX.plural(countIn(k), 'app') }));
        }))));
        status.textContent = allEntries().length + ' items · ' + LX.plural(repos.length, 'live repo');
      }
      function section(title, ...nodes) { return H('div', { class: 'ast-sec' }, H('h3', { class: 'ast-sec-t', text: title }), nodes); }
      function countIn(k) { return allEntries().filter((e) => e.type === 'app' && !e.builtin && e.catKey === k).length; }

      function cardOf(e) {
        return H('div', { class: 'card ast-card', role: 'button', tabindex: 0, onclick: () => { detail = e; draw(); }, onkeydown: (ev) => { if (ev.key === 'Enter') { detail = e; draw(); } } },
          zipChip(e),
          iconEl(e), H('div', { class: 'ast-info' }, H('div', { class: 'ast-name ellipsis' }, e.name, ' ', repoChip(e)), H('div', { class: 'ast-desc ellipsis', text: e.desc }), starsEl(e, true)),
          H('div', { class: 'ast-card-act' }, actionBtn(e)));
      }
      function themeCard(e) {
        const rec = LX.repos.installedRec('theme', e.id);
        const def = rec ? rec.def : (e.raw || e);
        return H('div', { class: 'ast-themecard', role: 'button', tabindex: 0, onclick: () => { detail = e; draw(); } },
          H('div', { class: 'ast-themecard-prev', style: { background: def.wallpaper } },
            H('span', { class: 'ast-mode-chip', text: def.mode === 'light' ? '☀ Light' : '☾ Dark' }),
            def.accent ? H('span', { class: 'ast-accent-dot', style: { background: def.accent }, title: 'Accent ' + def.accent }) : null),
          H('div', { class: 'ast-themecard-txt' }, H('b', { class: 'ellipsis', text: e.name }), H('small', { class: 'muted ellipsis', text: e.desc })));
      }
      function chartRow(e, n) {
        return H('div', { class: 'row ast-chrow' + (e.builtin ? ' builtin' : ''), onclick: () => { detail = e; draw(); } },
          H('span', { class: 'ast-rank', text: String(n) }),
          iconEl(e), H('div', { class: 'grow', style: { minWidth: 0 } }, H('div', { class: 'ast-name ellipsis' }, e.name, ' ', zipChip(e), ' ', repoChip(e)), H('div', { class: 'ast-desc ellipsis', text: e.dev })),
          H('div', { style: { flexShrink: 0 } }, actionBtn(e, true)));
      }

      // ---- list views ----
      function listView() {
        let list;
        if (view === 'apps') list = allEntries().filter((e) => e.type === 'app' && (!repoFilter || (e.kind === 'repo' && e.repoId === repoFilter)));
        else if (view === 'installed') list = allEntries().filter((e) => (e.kind === 'builtin' ? LX.packages.isInstalled(e.id) : LX.repos.isInstalled(e.type, e.id)));
        else list = allEntries().filter((e) => e.type === 'app' && !e.builtin && e.catKey === view && (!repoFilter || (e.kind === 'repo' && e.repoId === repoFilter)));
        list = list.sort((a, b) => a.name.localeCompare(b.name));
        const label = repoFilter && LX.repos.get(repoFilter) ? LX.repos.get(repoFilter).name + ' — ' : '';
        status.textContent = list.length + ' apps';
        if (!list.length) { scroll.append(empty(repoFilter ? 'This repository has no apps yet.' : 'Nothing here yet.')); return; }
        scroll.append(section(view === 'installed' ? 'Installed on this device' : view === 'apps' ? 'All apps' : CATS.find((c) => c[0] === view)[1],
          repoFilter && label ? H('div', { class: 'muted', style: { marginBottom: '8px', fontSize: '12.5px' }, text: 'Showing ' + label.slice(0, -3) }) : null,
          H('div', { class: 'ast-hgrid' }, list.map((e) => cardOf(e)))));
      }

      function liveView() {
        const type = view === 'themes' ? 'theme' : view === 'widgets' ? 'widget' : 'soundpack';
        const list = repoCatalog().filter((e) => e.type === type).sort((a, b) => b.downloads - a.downloads);
        status.textContent = list.length + ' ' + (TYPEMETA[type].label.toLowerCase() + 's') + ' · live';
        if (!list.length) {
          scroll.append(empty('No repositories provide ' + TYPEMETA[type].label.toLowerCase() + 's yet.'), H('div', { class: 'ast-empty-act' },
            H('button', { class: 'btn primary sm', html: LX.icon('globe', 14) + ' Add a repository', onclick: () => { view = 'sources'; draw(); } })));
          return;
        }
        if (type === 'theme') scroll.append(section('Themes from your repositories', H('div', { class: 'ast-themegrid' }, list.map((e) => themeCard(e)))));
        else scroll.append(section(TYPEMETA[type].label + 's from your repositories', H('div', { class: 'ast-hgrid' }, list.map((e) => cardOf(e)))));
      }

      function updatesView() {
        const bu = LX.packages.updates().map((id) => builtinCatalog().find((e) => e.id === id)).filter(Boolean);
        const ru = LX.repos.updates();
        status.textContent = (bu.length + ru.length) ? LX.plural(bu.length + ru.length, 'update') + ' available' : 'Everything is up to date';
        if (!bu.length && !ru.length) { scroll.append(empty('You are up to date — every app, theme, widget and pack is at its latest version.')); return; }
        const row = (e, from, to) => H('div', { class: 'card ast-updrow' }, iconEl(e),
          H('div', { class: 'grow', style: { minWidth: 0 } }, H('div', { class: 'ast-name', text: e.name }),
            H('div', { class: 'muted', style: { fontSize: '12px' }, text: 'v' + from + ' → v' + to + ' · ' + (e.changelog || 'performance polish and new content') })),
          actionBtn(e, true));
        scroll.append(section('Leonux Store updates', H('div', { class: 'ast-rows' }, bu.map((e) => row(e, LX.packages.installedList().find((p) => p.id === e.id).v, LX.packages.versionOf(e.id))))));
        if (ru.length) scroll.append(section('Repository updates', H('div', { class: 'ast-rows' }, ru.map((e) => row(e, (LX.repos.installedRec(e.type, e.id) || {}).version || '?', e.version)))));
      }

      function searchView() {
        const list = allEntries().filter((e) => (e.name + ' ' + e.desc + ' ' + e.dev + ' ' + (e.cat || '') + ' ' + TYPEMETA[e.type].label).toLowerCase().indexOf(q) >= 0)
          .sort((a, b) => (b.kind === 'repo') - (a.kind === 'repo') || b.downloads - a.downloads);
        status.textContent = list.length + ' results';
        if (!list.length) return empty('Nothing matches “' + LX.escape(search.value) + '”.');
        scroll.append(section('Results', H('div', { class: 'ast-hgrid' }, list.map((e) => cardOf(e)))));
      }

      // ---- sources view ----
      function sourcesView() {
        const repos = LX.repos.list();
        status.textContent = repos.length + (repos.length === 1 ? ' repository connected' : ' repositories connected');
        const input = H('input', { class: 'input grow', placeholder: 'https://github.com/you/leonux-appstore', spellcheck: 'false', onkeydown: (ev) => { if (ev.key === 'Enter') doAdd(); } });
        const msg = H('div', { class: 'ast-add-msg' });
        const addBtn = H('button', { class: 'btn primary', html: LX.icon('plus', 14) + ' Add repository', onclick: doAdd });
        let busy = false;
        function doAdd() {
          const url = input.value.trim();
          if (!url || busy) return;
          busy = true; addBtn.disabled = true;
          msg.className = 'ast-add-msg muted'; msg.textContent = 'Detecting repository — trying main, master and gh-pages…';
          LX.repos.add(url).then((r) => {
            busy = false; addBtn.disabled = false;
            input.value = '';
            msg.className = 'ast-add-msg ok'; msg.textContent = 'Connected “' + r.name + '” · ' + repoCounts(r);
            LX.notify({ title: 'Repository connected', body: r.name + ' is now live in your App Store.', icon: 'check-circle', timeout: 3000 });
            view = 'apps'; repoFilter = r.id; draw();
          }).catch((e) => {
            busy = false; addBtn.disabled = false;
            msg.className = 'ast-add-msg err'; msg.textContent = e.message || 'Could not add that repository.';
          });
        }
        const addCard = H('div', { class: 'card ast-src-add' },
          H('div', { class: 'row gap' },
            H('span', { class: 'ast-cta-ico', html: LX.icon('globe', 22) }),
            H('div', { class: 'grow' }, H('b', { text: 'Add a live repository' }), H('div', { class: 'muted', style: { fontSize: '12.5px' }, text: 'Paste a GitHub repo link — github.com/you/repo — raw repo.json URLs, GitHub Pages and any static host also work.' })),
            addBtn),
          H('div', { class: 'row gap', style: { marginTop: '10px' } }, input),
          msg);

        const list = H('div', { class: 'ast-srclist' });
        function drawRepos() {
          list.innerHTML = '';
          if (!repos.length) { list.appendChild(empty('No repositories connected yet.')); return; }
          repos.forEach((r) => {
            const cat = LX.repos.catalog().filter((e) => e.repoId === r.id);
            const hasErr = !cat.length;
            list.appendChild(H('div', { class: 'card ast-repo' + (hasErr ? ' err' : '') },
              H('div', { class: 'ast-repo-ico', style: { background: 'linear-gradient(140deg, hsl(' + LX.hash(r.id, 360) + ',60%,52%), hsl(' + LX.hash(r.id + 'x', 360) + ',55%,38%))' }, text: (r.name || '?').charAt(0).toUpperCase() }),
              H('div', { class: 'grow', style: { minWidth: 0 } },
                H('div', { class: 'row gap-s' }, H('b', { class: 'ellipsis', text: r.name }), r.bundled ? H('span', { class: 'badge', text: 'Bundled' }) : null, H('span', { class: 'ast-repo-chip' }, H('span', { class: 'ast-live-dot' }), 'live')),
                H('div', { class: 'muted ellipsis', style: { fontSize: '12px' }, text: r.maintainer + (r.home ? ' · ' + r.home.replace(/^https?:\/\//, '') : '') }),
                H('div', { class: 'muted ellipsis', style: { fontSize: '11.5px' }, text: hasErr ? 'Catalog not cached — go online and refresh.' : repoCounts(r) + ' · synced ' + ago(r.lastSync || r.addedAt) }),
                r.desc ? H('div', { class: 'muted ellipsis', style: { fontSize: '11.5px', marginTop: '2px' }, text: r.desc }) : null),
              H('div', { class: 'ast-repo-act' },
                H('button', { class: 'btn sm', text: 'Browse', onclick: () => { view = 'apps'; repoFilter = r.id; draw(); } }),
                H('button', { class: 'btn sm ghost', title: 'Refresh', html: LX.icon('refresh2', 13), onclick: (ev) => {
                  const b = ev.currentTarget; b.classList.add('spin');
                  LX.repos.refresh(r.id).then(() => { draw(); }).catch(() => { b.classList.remove('spin'); msg.className = 'ast-add-msg err'; msg.textContent = 'Could not refresh ' + r.name + '.'; });
                } }),
                H('button', { class: 'btn sm ghost', title: 'Remove repository', html: LX.icon('trash', 13), onclick: async () => {
                  if (await LX.dialog.confirm('Remove ' + r.name + '? Items you already installed stay on this device.', 'Remove repository')) { LX.repos.remove(r.id); draw(); }
                } }))));
          });
        }
        drawRepos();
        scroll.append(
          H('h3', { class: 'ast-sec-t', text: 'Store sources' }), addCard, list,
          section('How the live store works', H('div', { class: 'card ast-howto' },
            H('ol', null,
              H('li', null, H('b', { text: 'Publish ' }), 'the ', H('code', { text: 'appstore' }), ' repository anywhere static — GitHub is perfect (push the folder to a repo, no build step).'),
              H('li', null, H('b', { text: 'Paste ' }), 'the repo link above. Leonux auto-detects the branch (main / master / gh-pages) and reads ', H('code', { text: 'repo.json' }), '.'),
              H('li', null, H('b', { text: 'Install ' }), 'apps, themes, widgets and sound packs. They are stored on your device and keep working offline.'),
              H('li', null, H('b', { text: 'Multi-file apps ' }), 'ship as ', H('code', { text: '.zip' }), ' packages — one index.html plus any css/, js/ and asset files. Leonux verifies the checksum, unzips every file to on-device storage and serves them offline through its service worker.'),
              H('li', null, H('b', { text: 'Update ' }), 'the GitHub repo any time — hit refresh in the store and new content appears. The OS and the store are fully separate bodies.')))));
      }

      // ---- detail views ----
      function detailView() {
        const e = detail;
        status.textContent = e.cat || TYPEMETA[e.type].label;
        const back = H('button', { class: 'btn sm ghost ast-back', html: LX.icon('chevron-left', 14) + ' Back', onclick: () => { detail = null; draw(); } });
        if (e.kind === 'repo' && e.type !== 'app') return liveDetail(e, back);
        return appDetail(e, back);
      }

      // package contents viewer for multi-file ZIP apps
      function zipTree(e) {
        if (!e.zip) return null;
        const rec = LX.repos.installedRec(e.type, e.id);
        const box = H('div', { class: 'ast-filetree' });
        if (rec && rec.def && rec.def.zipApp && Array.isArray(rec.def.files) && rec.def.files.length) {
          box.appendChild(H('div', null, H('b', { text: '📦 ' + rec.def.files.length + ' files unpacked on this device' })));
          rec.def.files.slice().sort().forEach((p) => {
            const row = H('div', { text: p, dataset: { p } });
            box.appendChild(row);
          });
          // fill in real sizes asynchronously from app storage
          if (LX.zapps) {
            LX.zapps.listFiles(LX.repos.appIdOf(e.id)).then((files) => {
              if (!files || !files.length || !box.isConnected) return;
              const map = {}; files.forEach((f) => { map[f.path] = f.size; });
              LX.$$('[data-p]', box).forEach((r) => {
                const sz = map[r.dataset.p];
                if (sz != null) r.appendChild(H('span', { class: 'sz', text: LX.fmtBytes(sz) }));
              });
            }).catch(() => {});
          }
        } else {
          box.appendChild(H('div', null, H('b', { text: '📦 .zip package' })));
          box.appendChild(H('div', { text: 'index.html' }));
          box.appendChild(H('div', { text: 'css/  ·  js/  ·  assets/' }));
          box.appendChild(H('div', { style: { marginTop: '6px', fontFamily: 'inherit' }, text: (e.files ? LX.plural(e.files, 'file') : 'Multi-file') + ' — unzipped and stored on-device at install time, then served offline.' }));
        }
        return box;
      }

      function appDetail(e, back) {
        const installed = e.kind === 'builtin' ? LX.packages.isInstalled(e.id) : LX.repos.isInstalled('app', e.id);
        const shotColors = [e.color, '#5B9DFA', '#9ECE6A'];
        const gallery = H('div', { class: 'ast-shots scroll' }, [0, 1, 2].map((i) =>
          H('div', { class: 'ast-shot', style: { background: 'linear-gradient(140deg,' + shotColors[i] + '30, var(--surface-2) 65%, var(--surface-3))' } },
            H('div', { class: 'ast-shot-ui' },
              H('span', { class: 'ast-shot-side' }),
              H('span', { class: 'ast-shot-main' }, H('span', { class: 'ast-shot-bar', style: { width: 40 + i * 18 + '%' } }), H('span', { class: 'ast-shot-bar thin', style: { width: 70 - i * 12 + '%' } }),
                H('span', { class: 'ast-shot-grid' }, [0, 1, 2].map(() => H('span')))),
              H('span', { class: 'ast-shot-ico', html: LX.icon(e.icon, 26) })))));
        const ver = e.kind === 'builtin' ? LX.packages.versionOf(e.id) : e.version;
        const infoRows = [
          ['Developer', e.dev], ['Category', e.cat || 'Apps'], ['Size', fmtSize(e)], ['Version', ver],
          ['Downloads', fmtDL(e.downloads)], ['Works offline', 'Yes'],
          ['Source', e.kind === 'repo' ? e.repo.name + ' (live)' : 'Leonux Store'],
        ];
        if (e.zip) {
          infoRows.push(['Format', 'ZIP — multi-file'], ['Package', (e.package || '').split('/').pop() || 'app.zip'], ['Files', e.files ? LX.plural(e.files, 'file') : 'multi-file']);
        }
        scroll.append(
          H('div', { class: 'ast-detail-head' }, iconEl(e, true),
            H('div', { class: 'grow', style: { minWidth: 0 } },
              H('h2', { class: 'ast-d-name', text: e.name }),
              H('div', { class: 'muted', style: { fontSize: '12.5px' } }, H('span', { text: e.dev + ' · ' + (e.cat || 'Apps') }), ' ', zipChip(e), ' ', repoChip(e)),
              H('div', { class: 'row gap', style: { marginTop: '6px', flexWrap: 'wrap' } },
                starsEl(e), H('span', { class: 'muted', style: { fontSize: '12px' }, text: '· ' + fmtSize(e) + ' · v' + ver + (installed ? ' (installed)' : '') }))),
            H('div', { class: 'ast-d-act' }, actionBtn(e))),
          back, gallery,
          H('div', { class: 'ast-cols' },
            H('div', { class: 'ast-col' },
              H('h3', { text: 'About' }), H('p', { class: 'ast-long', text: e.long }),
              e.zip ? H('p', { class: 'muted', style: { fontSize: '12.5px' }, text: 'A true multi-file app: one index.html plus separate stylesheets, scripts and assets, shipped as a .zip. Leonux downloads it, verifies the checksum, unzips every file to on-device storage and serves them offline.' }) : null,
              H('h3', { text: 'What’s new' }), H('p', { class: 'muted', text: 'v' + ver + ' — ' + (e.changelog || 'performance polish, refreshed layouts and new content.') }),
              e.zip ? H('h3', { text: 'Package contents' }) : null, zipTree(e)),
            H('div', { class: 'ast-col' },
              H('h3', { text: 'Ratings & reviews' }),
              e.reviews.map((rv) => H('div', { class: 'ast-review' },
                H('div', { class: 'ast-rv-head' }, H('span', { class: 'ast-rv-av', text: rv.name[0] }), H('b', { text: rv.name }), H('span', { class: 'muted', style: { fontSize: '11px' }, text: LX.stars(rv.stars) })),
                H('div', { class: 'muted', style: { fontSize: '12.5px' }, text: rv.text }))),
              H('h3', { style: { marginTop: '14px' }, text: 'Information' }),
              H('div', { class: 'ast-info-tbl' }, infoRows.map((r) => H('div', { class: 'ast-irow' }, H('span', { class: 'muted', text: r[0] }), H('span', { text: r[1] })))))));
      }

      function liveDetail(e, back) {
        const rec = LX.repos.installedRec(e.type, e.id);
        const def = rec ? rec.def : (e.raw || e);
        const head = H('div', { class: 'ast-detail-head' }, iconEl(e, true),
          H('div', { class: 'grow', style: { minWidth: 0 } },
            H('h2', { class: 'ast-d-name', text: e.name }),
            H('div', { class: 'muted', style: { fontSize: '12.5px' } }, H('span', { text: e.dev + ' · ' + TYPEMETA[e.type].label }), ' ', repoChip(e)),
            H('div', { class: 'row gap', style: { marginTop: '6px', flexWrap: 'wrap' } },
              starsEl(e), H('span', { class: 'muted', style: { fontSize: '12px' }, text: '· ' + fmtSize(e) + ' · v' + e.version + (rec ? ' (installed)' : '') }))),
          H('div', { class: 'ast-d-act' }, actionBtn(e)));

        let preview = null, extra = null, info = [
          ['Developer', e.dev], ['Version', e.version], ['Size', fmtSize(e)], ['Downloads', fmtDL(e.downloads)],
          ['Source', e.repo.name + ' (live)'], ['Works offline', 'After install'],
        ];
        if (e.type === 'theme') {
          preview = H('div', { class: 'ast-theme-hero', style: { background: (def && def.wallpaper) || 'linear-gradient(140deg,#333,#111)' } },
            (def && def.accent) ? H('span', { class: 'ast-accent-dot big', style: { background: def.accent }, title: 'Accent colour ' + def.accent }) : null,
            H('span', { class: 'ast-mode-chip', text: def && def.mode === 'light' ? '☀ Light mode' : '☾ Dark mode' }));
          extra = H('div', null, H('h3', { text: 'About this theme' }), H('p', { class: 'ast-long', text: e.long || e.desc }),
            H('p', { class: 'muted', style: { fontSize: '12.5px' }, text: 'Installing a theme applies it instantly: wallpaper, accent colour and light/dark mode. Revert any time in Settings → Appearance.' }));
        } else if (e.type === 'widget') {
          const h = (def && def.size && def.size.h) || 200;
          preview = def ? H('div', { class: 'ast-wprev card' }, liveFrame(def, Math.min(320, 320), Math.min(360, h)), H('div', { class: 'muted', style: { fontSize: '11.5px', textAlign: 'center' }, text: 'Live preview — this is the actual widget' })) : null;
          extra = H('div', null, H('h3', { text: 'About this widget' }), H('p', { class: 'ast-long', text: e.long || e.desc }),
            H('p', { class: 'muted', style: { fontSize: '12.5px' }, text: 'Widgets live in the stack on the right of your desktop (toggle in Settings). Right-click any installed widget to remove it.' }));
        } else if (e.type === 'soundpack') {
          const sounds = (def && def.sounds) || null;
          preview = H('div', { class: 'card ast-sndcard' },
            H('div', { class: 'row gap-s', style: { marginBottom: '8px' } }, H('b', { text: 'Sounds in this pack' }), rec && LX.settings.get('soundPack') === e.id ? H('span', { class: 'badge', text: 'Active' }) : null),
            H('div', { class: 'ast-sndlist' }, SND_NAMES.filter(([k]) => sounds && sounds[k]).map(([k, label]) =>
              H('button', { class: 'ast-sndrow', onclick: () => LX.audio.previewPack(def, k) },
                H('span', { html: LX.icon('play', 13) }), H('span', { class: 'grow', text: label }), H('span', { class: 'muted', style: { fontSize: '11px' }, text: '▶ try' })))));
          extra = H('div', null, H('h3', { text: 'About this sound pack' }), H('p', { class: 'ast-long', text: e.long || e.desc }),
            H('p', { class: 'muted', style: { fontSize: '12.5px' }, text: 'Every system moment — startup, unlock, notifications, installs — plays from the pack you apply.' }));
        }
        scroll.append(head, back, preview || H('span'), H('div', { class: 'ast-cols' },
          H('div', { class: 'ast-col' }, extra),
          H('div', { class: 'ast-col' },
            H('h3', { text: 'Information' }),
            H('div', { class: 'ast-info-tbl' }, info.map((r) => H('div', { class: 'ast-irow' }, H('span', { class: 'muted', text: r[0] }), H('span', { text: r[1] })))))));
      }

      function liveFrame(def, w, h) {
        const fr = document.createElement('iframe');
        fr.className = 'dyn-wframe';
        fr.setAttribute('sandbox', 'allow-scripts allow-modals');
        fr.setAttribute('title', def.name || 'Preview');
        fr.style.width = '100%'; fr.style.height = Math.max(90, h) + 'px';
        fr.srcdoc = def.html;
        return fr;
      }

      function empty(msg) { return H('div', { class: 'ast-empty' }, H('div', { html: LX.icon('store', 36) }), H('div', { style: { marginTop: '10px' }, text: msg })); }

      function draw() {
        drawSide();
        scroll.innerHTML = '';
        if (detail) { win.setTitle(detail.name + ' — App Store'); return detailView(); }
        win.setTitle('App Store');
        if (q) return searchView();
        if (view === 'home') return homeView();
        if (view === 'sources') return sourcesView();
        if (view === 'updates') return updatesView();
        if (view === 'themes' || view === 'widgets' || view === 'soundpacks') return liveView();
        return listView();
      }

      const offCh = LX.bus.on('repos:change', () => { if (!win.closed) draw(); });
      const offPk = LX.bus.on('packages:change', () => { if (!win.closed && !LX.packages.isDownloading()) draw(); });
      cleanups.push(() => { offCh(); offPk(); });
      win.on('args', (a) => {
        if (!a) return;
        if (a.app) { const ent = allEntries().find((x) => x.id === a.app && x.type === 'app'); if (ent) { detail = ent; draw(); } }
        else if (a.view) { view = a.view; detail = null; repoFilter = a.repo || null; q = ''; search.value = ''; draw(); }
      });
      win.onClose(() => { cleanups.forEach((f) => { try { f(); } catch (x) {} }); });
      if (args && args.view === 'updates') view = 'updates';
      draw();
    },
  });
})();
