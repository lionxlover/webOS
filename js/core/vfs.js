/* Leonux Web OS — virtual file system (localStorage-backed tree, sync API) */
(function () {
  'use strict';
  const HOME = '/home/user';
  const TRASH = HOME + '/.Trash';
  const MIME = {
    txt: 'text/plain', md: 'text/markdown', log: 'text/plain', json: 'application/json', js: 'text/javascript', css: 'text/css', html: 'text/html', htm: 'text/html',
    py: 'text/x-python', rs: 'text/x-rust', c: 'text/x-c', cpp: 'text/x-c++', h: 'text/x-c', sh: 'text/x-shellscript', csv: 'text/csv', xml: 'text/xml', ini: 'text/plain', conf: 'text/plain',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', lxtrack: 'application/x-lxtrack',
    mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf', zip: 'application/zip', lxnote: 'application/x-lxnote',
  };
  let root = null;
  const now = () => Date.now();
  const err = (code, p) => new Error(code + ': ' + p);

  function norm(p) {
    p = String(p || '/');
    const out = [];
    p.split('/').forEach((s) => { if (!s || s === '.') return; if (s === '..') out.pop(); else out.push(s); });
    return '/' + out.join('/');
  }
  const parts = (p) => norm(p).split('/').filter(Boolean);
  const dirname = (p) => { const a = parts(p); a.pop(); return '/' + a.join('/'); };
  const basename = (p) => { const a = parts(p); return a.length ? a[a.length - 1] : '/'; };
  const ext = (p) => { const b = basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i + 1).toLowerCase() : ''; };
  const join = function () { return norm(Array.prototype.join.call(arguments, '/')); };
  const mime = (p) => MIME[ext(p)] || 'application/octet-stream';

  function dirNode(c) { return { t: 'd', c: c || {}, m: now(), ct: now() }; }
  function fileNode(d, mt) { return { t: 'f', d, mime: mt, m: now(), ct: now() }; }
  function node(p) { let n = root; for (const s of parts(p)) { if (n.t !== 'd' || !n.c[s]) return null; n = n.c[s]; } return n; }
  const save = LX.debounce(() => {
    try { localStorage.setItem('lx:vfs', JSON.stringify(root)); }
    catch (e) { if (LX.notify) LX.notify({ title: 'Storage full', body: 'Some changes could not be saved to disk.', icon: 'alert' }); }
  }, 250);
  const changed = (path, op) => { save(); LX.bus.emit('vfs:change', { path, op }); };

  function svgPic(c1, c2, c3, kind) {
    const shapes = {
      mountains: '<path d="M0 420 L200 220 L330 330 L520 150 L720 360 L900 250 L900 600 L0 600Z" fill="' + c3 + '" opacity=".85"/><circle cx="700" cy="140" r="60" fill="#fff" opacity=".85"/>',
      waves: '<path d="M0 360 Q150 300 300 360 T600 360 T900 360 V600 H0Z" fill="' + c3 + '" opacity=".7"/><path d="M0 440 Q150 380 300 440 T600 440 T900 440 V600 H0Z" fill="' + c2 + '" opacity=".6"/>',
      circles: '<circle cx="250" cy="260" r="160" fill="' + c3 + '" opacity=".6"/><circle cx="560" cy="330" r="220" fill="' + c2 + '" opacity=".5"/><circle cx="700" cy="180" r="90" fill="#fff" opacity=".35"/>',
      city: '<g fill="' + c3 + '" opacity=".9"><rect x="60" y="300" width="90" height="300"/><rect x="170" y="220" width="110" height="380"/><rect x="300" y="340" width="80" height="260"/><rect x="400" y="180" width="120" height="420"/><rect x="540" y="280" width="100" height="320"/><rect x="660" y="240" width="90" height="360"/></g>',
      dunes: '<path d="M0 380 Q200 280 420 380 T900 330 V600 H0Z" fill="' + c3 + '" opacity=".8"/><path d="M0 470 Q260 390 520 470 T900 450 V600 H0Z" fill="' + c2 + '" opacity=".7"/>',
      stars: '<g fill="#fff">' + Array.from({ length: 40 }, (_, i) => '<circle cx="' + ((i * 97) % 900) + '" cy="' + ((i * 53) % 420) + '" r="' + (1 + (i % 3)) + '" opacity="' + (0.4 + (i % 5) / 10) + '"/>').join('') + '</g><path d="M0 500 Q300 430 600 500 T900 480 V600 H0Z" fill="' + c3 + '"/>',
    };
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs><rect width="900" height="600" fill="url(#g)"/>' + shapes[kind] + '</svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function seed() {
    const d = dirNode();
    const mk = (path, node_) => { let n = d; const a = parts(path); const last = a.pop(); a.forEach((s) => { n.c[s] = n.c[s] || dirNode(); n = n.c[s]; }); n.c[last] = node_; };
    ['/home/user/Desktop', '/home/user/Documents', '/home/user/Pictures', '/home/user/Music', '/home/user/Videos', '/home/user/Downloads', '/home/user/.Trash', '/tmp', '/usr/share', '/etc', '/var/log'].forEach((p) => mk(p, dirNode()));
    const txt = (p, s) => mk(p, fileNode(s, mime(p)));
    txt('/home/user/Documents/welcome.txt', 'Welcome to Leonux OS!\n\nThis is a complete operating system running in your browser.\nEverything you see - windows, files, apps - lives in this page.\n\nTry:\n  - Open the Files app and browse around\n  - Press Ctrl+Space to search\n  - Press the Windows/Meta key (or Alt+Space) for the launcher\n  - Drag a window to the screen edge to snap it\n  - Open Terminal and type "help"\n\nEnjoy!\n');
    txt('/home/user/Documents/notes.md', '# Project Notes\n\n## Ideas\n- Build a **web OS**\n- Add a *terminal*\n- Ship it\n\n## Todo\n1. Write more apps\n2. Polish the UI\n\n> Everything is stored locally in your browser.\n\n```js\nconsole.log("hello from Leonux");\n```\n');
    txt('/home/user/Documents/todo.txt', '[x] Boot the OS\n[ ] Customize wallpaper\n[ ] Try the paint app\n[ ] Beat 2048\n');
    txt('/home/user/Documents/hello.js', '// Open in the Text Editor and press Run (Ctrl+Enter) if supported\nconst names = ["Files", "Terminal", "Notes"];\nnames.forEach((n, i) => console.log(i + 1, n));\n');
    txt('/home/user/Documents/data.json', JSON.stringify({ name: 'leonux', version: '1.0', apps: ['files', 'terminal', 'notes'], dark: true }, null, 2) + '\n');
    txt('/home/user/Desktop/README.txt', 'Files on the Desktop show up as icons.\nRight-click the desktop for options.\n');
    txt('/home/user/Downloads/hello.txt', 'Hello from Downloads!\n');
    txt('/etc/os-release', 'NAME="Leonux OS"\nVERSION="1.0 (Lioness)"\nID=leonux\nPRETTY_NAME="Leonux OS 1.0"\nHOME_URL="https://leonux.local"\n');
    txt('/etc/hostname', 'leonux-pc\n');
    txt('/var/log/boot.log', '[ OK ] Started Window Manager\n[ OK ] Mounted virtual filesystem\n[ OK ] Reached target Desktop\n');
    const pics = [['Aurora.svg', '#1b2a6b', '#7b2ff7', '#0d1b4c', 'mountains'], ['Lagoon.svg', '#0f4c75', '#2ec4b6', '#0b2545', 'waves'], ['Bubbles.svg', '#f857a6', '#ff5858', '#7b2ff7', 'circles'], ['Skyline.svg', '#141e30', '#35577d', '#0a1020', 'city'], ['Dunes.svg', '#f6d365', '#fda085', '#c1440e', 'dunes'], ['Night.svg', '#0b0f2e', '#33206b', '#050716', 'stars']];
    pics.forEach((p) => mk('/home/user/Pictures/' + p[0], fileNode(svgPic(p[1], p[2], p[3], p[4]), 'image/svg+xml')));
    return d;
  }

  function load() {
    try { root = JSON.parse(localStorage.getItem('lx:vfs')); } catch (e) { root = null; }
    if (!root || root.t !== 'd' || !root.c.home) { root = seed(); changed('/', 'write'); }
  }
  function need(p) { const n = node(p); if (!n) throw err('ENOENT', norm(p)); return n; }
  function statOf(p, n) {
    n = n || need(p);
    const size = n.t === 'f' ? (n.d ? n.d.length : 0) : 0;
    return { name: basename(p), path: norm(p), type: n.t === 'd' ? 'dir' : 'file', size, mtime: n.m, ctime: n.ct, mime: n.t === 'f' ? n.mime || mime(p) : 'inode/directory', count: n.t === 'd' ? Object.keys(n.c).length : undefined };
  }
  function parentOf(p, create) {
    const a = parts(p); if (!a.length) throw err('EINVAL', '/');
    const last = a.pop(); let n = root;
    for (const s of a) {
      if (!n.c[s]) { if (create) n.c[s] = dirNode(); else throw err('ENOENT', dirname(p)); }
      n = n.c[s]; if (n.t !== 'd') throw err('ENOTDIR', dirname(p));
    }
    return { dir: n, name: last };
  }
  function clone(n) { return JSON.parse(JSON.stringify(n)); }
  function uniqueIn(dirPath, name) {
    const d = need(dirPath); if (!d.c[name]) return name;
    const i = name.lastIndexOf('.'); const base = i > 0 ? name.slice(0, i) : name; const e = i > 0 ? name.slice(i) : '';
    let k = 2; while (d.c[base + ' (' + k + ')' + e]) k++;
    return base + ' (' + k + ')' + e;
  }
  const meta = () => LX.store.get('vfs.trash', {});

  LX.vfs = {
    HOME, TRASH, norm, join, dirname, basename, ext, mime, uniqueName: uniqueIn,
    exists: (p) => !!node(p),
    isDir: (p) => { const n = node(p); return !!n && n.t === 'd'; },
    isFile: (p) => { const n = node(p); return !!n && n.t === 'f'; },
    stat: (p) => statOf(p),
    ls(p) {
      const n = need(p); if (n.t !== 'd') throw err('ENOTDIR', norm(p));
      return Object.keys(n.c).map((k) => statOf(join(p, k), n.c[k])).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) : a.type === 'dir' ? -1 : 1));
    },
    read(p) { const n = need(p); if (n.t !== 'f') throw err('EISDIR', norm(p)); return n.d; },
    write(p, content, opts) {
      opts = opts || {};
      const { dir, name } = parentOf(p, opts.parents);
      const ex = dir.c[name]; if (ex && ex.t === 'd') throw err('EISDIR', norm(p));
      if (ex) { ex.d = String(content); ex.m = now(); if (opts.mime) ex.mime = opts.mime; }
      else dir.c[name] = fileNode(String(content), opts.mime || mime(p));
      changed(norm(p), 'write');
    },
    mkdir(p) {
      const a = parts(p); let n = root;
      a.forEach((s) => { if (!n.c[s]) n.c[s] = dirNode(); n = n.c[s]; if (n.t !== 'd') throw err('ENOTDIR', norm(p)); });
      changed(norm(p), 'mkdir');
    },
    rm(p, opts) {
      opts = opts || {}; p = norm(p);
      if (p === '/' || p === HOME || p === TRASH) throw err('EPERM', p);
      need(p);
      if (opts.permanent || p.indexOf(TRASH + '/') === 0) {
        const { dir, name } = parentOf(p); delete dir.c[name];
        const m = meta(); delete m[p]; LX.store.set('vfs.trash', m);
      } else {
        const n = need(p); const name = uniqueIn(TRASH, basename(p));
        const { dir, name: old } = parentOf(p); delete dir.c[old];
        need(TRASH).c[name] = n;
        const m = meta(); m[join(TRASH, name)] = { origin: p, deleted: now() }; LX.store.set('vfs.trash', m);
      }
      changed(p, 'rm');
    },
    mv(from, to) {
      from = norm(from); to = norm(to);
      need(from); if (node(to) && node(to).t === 'd') to = join(to, basename(from));
      if (to === from) return;
      if (to.indexOf(from + '/') === 0) throw err('EINVAL', 'cannot move into itself');
      if (node(to)) throw err('EEXIST', to);
      const n = need(from); const src = parentOf(from); const dst = parentOf(to);
      delete src.dir.c[src.name]; dst.dir.c[dst.name] = n; n.m = now();
      changed(to, 'mv');
    },
    cp(from, to) {
      from = norm(from); to = norm(to);
      const n = need(from); if (node(to) && node(to).t === 'd') to = join(to, basename(from));
      if (to.indexOf(from + '/') === 0) throw err('EINVAL', 'cannot copy into itself');
      if (node(to)) { to = join(dirname(to), uniqueIn(dirname(to), basename(to))); }
      const dst = parentOf(to); const c = clone(n); c.m = now(); c.ct = now(); dst.dir.c[dst.name] = c;
      changed(to, 'cp'); return to;
    },
    trashList() {
      const m = meta(); const d = need(TRASH);
      return Object.keys(d.c).map((k) => { const p = join(TRASH, k); const s = statOf(p, d.c[k]); const mm = m[p] || {}; return { name: k, path: p, origin: mm.origin || join(HOME, k), deleted: mm.deleted || s.mtime, type: s.type, size: s.size }; });
    },
    restore(tp) {
      const m = meta(); const info = m[norm(tp)]; const n = need(tp);
      let dest = info ? info.origin : join(HOME, basename(tp));
      if (!node(dirname(dest))) { this.mkdir(dirname(dest)); }
      if (node(dest)) dest = join(dirname(dest), uniqueIn(dirname(dest), basename(dest)));
      const { dir, name } = parentOf(tp); delete dir.c[name];
      const dst = parentOf(dest); dst.dir.c[dst.name] = n;
      delete m[norm(tp)]; LX.store.set('vfs.trash', m);
      changed(dest, 'restore'); return dest;
    },
    emptyTrash() { const d = need(TRASH); d.c = {}; LX.store.set('vfs.trash', {}); changed(TRASH, 'rm'); },
    usage() {
      let used = 0; (function walk(n) { if (n.t === 'f') used += n.d ? n.d.length : 0; else Object.keys(n.c).forEach((k) => walk(n.c[k])); })(root);
      return { used, total: 64 * 1024 * 1024 * 1024 };
    },
    search(query, limit) {
      query = String(query || '').toLowerCase(); const out = []; if (!query) return out;
      (function walk(n, p) {
        if (out.length >= (limit || 30)) return;
        Object.keys(n.c).forEach((k) => {
          if (out.length >= (limit || 30)) return;
          const cp = join(p, k);
          if (cp.indexOf(TRASH) === 0) return;
          if (k.toLowerCase().indexOf(query) >= 0) out.push(statOf(cp, n.c[k]));
          if (n.c[k].t === 'd') walk(n.c[k], cp);
        });
      })(root, '/');
      return out;
    },
    reset() { root = seed(); LX.store.remove('vfs.trash'); changed('/', 'write'); },
  };
  load();
})();
