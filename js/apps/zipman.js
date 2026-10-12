/* Store app — Archive Manager: .lxzip create / inspect / extract inside the VFS. */
(function () {
  'use strict';
  const H = LX.h;
  const MAGIC = 'LXZIP1\n';
  const readNode = (p) => {
    if (LX.vfs.isFile(p)) {
      const d = LX.vfs.read(p);
      return { t: 'f', n: LX.vfs.basename(p), m: LX.vfs.mime(p), d: d.length > 200000 ? null : d, big: d.length, p };
    }
    const dir = { t: 'd', n: LX.vfs.basename(p), c: [] };
    LX.vfs.ls(p).forEach((s) => { if (s.name[0] !== '.') dir.c.push(readNode(s.path)); });
    return dir;
  };
  const flatten = (node, base, out) => {
    out = out || [];
    if (node.t === 'f') out.push({ path: base + node.n, node });
    else node.c.forEach((c) => flatten(c, base + node.n + '/', out));
    return out;
  };
  const totalSize = (nodes) => flatten({ t: 'd', n: '', c: nodes }, '', []).reduce((a, f) => a + (f.node.d ? f.node.d.length : 0), 0);

  LX.apps.register({
    id: 'zipman', name: 'Archive Manager', icon: 'package', color: '#FF9E64', category: 'Utilities',
    pkg: true, pkgVersion: '1.1', pkgSize: 8, developer: 'Leonux Labs', downloads: 640,
    desc: 'Create and extract .lxzip archives', longDesc: 'Pack folders into .lxzip archives stored in the Leonux filesystem, inspect their contents and extract them anywhere. Fully offline — no compression server involved.',
    permissions: ['Local storage'], changelog: 'Extract-overwrite prompts.',
    canOpenExt: ['lxzip'],
    width: 780, height: 560, minWidth: 460, minHeight: 380,
    open(win, args) {
      const body = H('div', { class: 'zm-wrap col' });
      let current = null; // {name, files:[{path,node}], meta}

      function home() {
        current = null;
        body.innerHTML = '';
        const archives = [];
        (function walk(p) { try { LX.vfs.ls(p).forEach((s) => { if (s.name[0] === '.') return; if (s.type === 'dir') walk(s.path); else if (LX.vfs.ext(s.name) === 'lxzip') archives.push(s); }); } catch (e) {} })(LX.vfs.HOME);
        body.append(
          H('div', { class: 'zm-hero' }, H('div', { class: 'zm-hero-ico', html: LX.icon('package', 40) }),
            H('h2', { text: 'Archives' }), H('p', { class: 'muted', text: 'Create .lxzip archives from your folders, or open one to inspect and extract it.' }),
            H('div', { class: 'row gap', style: { justifyContent: 'center', marginTop: '12px' } },
              H('button', { class: 'btn primary', html: LX.icon('plus', 14) + ' New archive', onclick: createFlow }),
              H('button', { class: 'btn', html: LX.icon('folder', 14) + ' Open…', onclick: () => LX.dialog.openFile({ title: 'Open archive', path: LX.vfs.HOME, exts: ['lxzip'] }).then((p) => { if (p) openArchive(p); }) }))),
          H('div', { class: 'zm-list' }, archives.length ? archives.map((a) => H('div', { class: 'card zm-row', onclick: () => openArchive(a.path) },
            H('span', { class: 'zm-ico', html: LX.icon('package', 20) }),
            H('div', { class: 'grow' }, H('b', { class: 'ellipsis', text: a.name.replace(/\.lxzip$/i, '') }), H('div', { class: 'muted', style: { fontSize: '11.5px' }, text: LX.fmtBytes(a.size) + ' · ' + a.path })),
            H('button', { class: 'btn sm', text: 'Open', onclick: (e) => { e.stopPropagation(); openArchive(a.path); } })))
            : H('div', { class: 'muted', style: { textAlign: 'center', padding: '20px' }, text: 'No archives yet.' })));
        win.setTitle('Archive Manager');
      }

      async function createFlow() {
        const src = await LX.dialog.pickFolder({ title: 'Choose a folder to archive', path: LX.vfs.HOME });
        if (!src) return;
        let name = await LX.dialog.prompt('Archive name', LX.vfs.basename(src) + '.lxzip', 'New archive');
        if (!name) return;
        if (!/\.lxzip$/i.test(name)) name += '.lxzip';
        const node = readNode(src);
        const files = flatten(node, '', []);
        const meta = { src, at: Date.now(), count: files.length, bytes: totalSize([node]) };
        const payload = MAGIC + JSON.stringify({ meta, files: files.map((f) => ({ path: f.path, mime: f.node.m, d: f.node.d, big: f.node.d ? undefined : f.node.big })) });
        let dest = LX.vfs.join(LX.vfs.dirname(src), name);
        if (LX.vfs.exists(dest)) dest = LX.vfs.join(LX.vfs.dirname(src), LX.vfs.uniqueName(LX.vfs.dirname(src), name));
        LX.vfs.write(dest, payload, { mime: 'application/x-lxzip' });
        LX.notify({ title: 'Archive created', body: files.length + ' files → ' + dest, icon: 'package' });
        openArchive(dest);
      }

      function openArchive(p) {
        let data;
        try { data = LX.vfs.read(p); } catch (e) { return LX.dialog.alert('Cannot read archive'); }
        if (!data.startsWith(MAGIC)) return LX.dialog.alert('This does not look like a .lxzip archive.', 'Invalid archive');
        let parsed;
        try { parsed = JSON.parse(data.slice(MAGIC.length)); } catch (e) { return LX.dialog.alert('Archive is corrupted.'); }
        current = { path: p, files: parsed.files || [], meta: parsed.meta || {} };
        paintArchive();
      }
      function paintArchive() {
        body.innerHTML = '';
        const rows = current.files.map((f) => H('div', { class: 'zm-file' },
          H('span', { html: LX.icon(f.mime && f.mime.indexOf('image/') === 0 ? 'image' : f.d == null ? 'alert' : 'file-text', 15) }),
          H('span', { class: 'grow ellipsis', text: f.path }),
          H('span', { class: 'muted', style: { fontSize: '11.5px' }, text: f.d == null ? 'too large to pack' : LX.fmtBytes(f.d.length) })));
        body.append(
          H('div', { class: 'toolbar' },
            H('button', { class: 'btn sm ghost', html: LX.icon('chevron-left', 13) + ' Archives', onclick: home }),
            H('b', { class: 'ellipsis', text: LX.vfs.basename(current.path) }),
            H('span', { class: 'grow' }),
            H('button', { class: 'btn sm primary', html: LX.icon('download', 13) + ' Extract…', onclick: extractFlow })),
          H('div', { class: 'zm-meta muted', text: (current.meta.count || current.files.length) + ' files · packed from ' + (current.meta.src || 'unknown') }),
          H('div', { class: 'zm-files scroll' }, rows.length ? rows : H('div', { class: 'muted', text: 'Empty archive.' })));
        win.setTitle(LX.vfs.basename(current.path) + ' — Archive Manager');
      }
      async function extractFlow() {
        const dest = await LX.dialog.pickFolder({ title: 'Extract into', path: LX.vfs.HOME });
        if (!dest) return;
        const base = LX.vfs.basename(current.path).replace(/\.lxzip$/i, '');
        const outDir = LX.vfs.join(dest, LX.vfs.uniqueName(dest, base));
        LX.vfs.mkdir(outDir);
        let n = 0, skipped = 0;
        current.files.forEach((f) => {
          if (f.d == null) { skipped++; return; }
          const target = LX.vfs.join(outDir, f.path.replace(/^\//, ''));
          LX.vfs.mkdir(LX.vfs.dirname(target));
          LX.vfs.write(target, f.d, { mime: f.mime });
          n++;
        });
        LX.notify({ title: 'Extraction complete', body: n + ' files → ' + outDir + (skipped ? ' · ' + skipped + ' skipped' : ''), icon: 'check-circle' });
      }

      win.body.append(body);
      if (args && args.path && LX.vfs.ext(args.path) === 'lxzip') openArchive(args.path);
      else home();
    },
  });
})();
