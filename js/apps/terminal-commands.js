/* Leonux Web OS — Terminal built-in commands (operate on LX.vfs); registered via LX.terminal.register */
(function () {
  'use strict';
  const T = LX.terminal, V = LX.vfs, S = LX.settings, esc = LX.escape;
  const reg = (n, f, h) => T.register(n, f, h);

  // parse short flags: returns {f:Set-like object, rest:[], val}. opts: names of flags taking a value
  function parse(args, valued) {
    const f = {}, rest = []; valued = valued || '';
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '--') { rest.push.apply(rest, args.slice(i + 1)); break; }
      if (/^-[A-Za-z]/.test(a) && !/^-\d+$/.test(a)) {
        for (let j = 1; j < a.length; j++) { const c = a[j]; if (valued.indexOf(c) >= 0) { f[c] = a.slice(j + 1) || args[++i]; break; } f[c] = true; }
      } else if (/^-\d+$/.test(a) && valued.indexOf('n') >= 0) f.n = a.slice(1); else rest.push(a);
    }
    return { f, rest };
  }
  const dateStr = (ts) => { const d = new Date(ts); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + LX.pad(d.getDate(), 2) + ' ' + LX.fmtTime(d); };
  const human = (n) => (n < 1024 ? n + '' : LX.fmtBytes(n).replace(' ', ''));
  const flatten = (p, out) => { out = out || []; V.ls(p).forEach((e) => { out.push(e); if (e.type === 'dir') flatten(e.path, out); }); return out; };
  const cls = (e) => (e.type === 'dir' ? 't-dirc' : /\.(js|sh|py)$/.test(e.name) ? 't-exec' : /\.(png|jpg|jpeg|svg|gif|webp|mp3|wav|mp4|webm|ogg)$/i.test(e.name) ? 't-media' : '');
  const need = (ctx, args, n, usage) => { if (args.length < n) { ctx.error(ctx.name + ': missing operand. Usage: ' + ctx.name + ' ' + usage); return false; } return true; };

  // ---------- navigation & listing ----------
  reg('pwd', (c) => { c.print(c.cwd); }, 'Print working directory');
  reg('cd', (c, a) => {
    let t = a[0] == null ? c.env.HOME : a[0] === '-' ? (c.env.OLDPWD || c.cwd) : a[0]; const p = c.resolve(t);
    if (!V.exists(p)) { c.error('cd: ' + a[0] + ': No such file or directory'); return 1; }
    if (!V.isDir(p)) { c.error('cd: ' + a[0] + ': Not a directory'); return 1; }
    c.env.OLDPWD = c.cwd; c.setCwd(p); c.session.promptChanged && c.session.promptChanged();
  }, 'Change directory');
  reg('ls', (c, a) => {
    const { f, rest } = parse(a); const targets = rest.length ? rest : ['.']; let code = 0;
    targets.forEach((t, i) => {
      const p = c.resolve(t); if (!V.exists(p)) { c.error('ls: cannot access ' + t + ': No such file or directory'); code = 2; return; }
      let items = V.isDir(p) ? V.ls(p) : [V.stat(p)];
      if (!f.a) items = items.filter((e) => e.name[0] !== '.');
      if (f.t) items.sort((x, y) => y.mtime - x.mtime); if (f.S) items.sort((x, y) => y.size - x.size); if (f.r) items.reverse();
      if (targets.length > 1) c.print((i ? '\n' : '') + t + ':');
      if (!c.isTTY || f['1']) { items.forEach((e) => c.print(e.name + (f.F && e.type === 'dir' ? '/' : ''))); return; }
      if (f.l) {
        c.print('total ' + items.length);
        items.forEach((e) => c.printHtml('<span class="t-dim">' + (e.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--') + ' 1 ' + esc(c.env.USER) + ' ' + esc(c.env.USER) + '</span> ' + esc((f.h ? human(e.size) : String(e.size)).padStart(7)) + ' <span class="t-dim">' + dateStr(e.mtime) + '</span> <span class="' + cls(e) + '">' + esc(e.name) + (e.type === 'dir' ? '/' : '') + '</span>'));
      } else if (items.length) {
        c.printHtml('<span class="t-cols">' + items.map((e) => '<span class="' + cls(e) + '">' + esc(e.name) + (e.type === 'dir' ? '/' : '') + '</span>').join('') + '</span>');
      }
    });
    return code;
  }, 'List directory contents (-l -a -h -t -S -r -1)');
  reg('tree', (c, a) => {
    const { f, rest } = parse(a, 'L'); const root = c.resolve(rest[0] || '.'); const maxD = f.L ? +f.L : 99; let nd = 0, nf = 0;
    if (!V.isDir(root)) { c.error('tree: ' + (rest[0] || '.') + ': Not a directory'); return 1; }
    const lines = [(rest[0] || '.')];
    (function walk(p, pre, d) {
      if (d > maxD) return; let it = V.ls(p); if (!f.a) it = it.filter((e) => e.name[0] !== '.');
      it.forEach((e, i) => { const last = i === it.length - 1; lines.push(pre + (last ? '└── ' : '├── ') + e.name); if (e.type === 'dir') { nd++; walk(e.path, pre + (last ? '    ' : '│   '), d + 1); } else nf++; });
    })(root, '', 1);
    lines.forEach((l) => c.print(l)); c.print('\n' + nd + ' directories, ' + nf + ' files');
  }, 'Show directory tree (-L depth, -a)');
  reg('stat', (c, a) => { if (!need(c, a, 1, '<file>')) return 1; a.forEach((x) => { const s = V.stat(c.resolve(x)); c.print('  File: ' + s.name + '\n  Size: ' + s.size + '\tType: ' + s.type + '\n  Path: ' + s.path + '\n  Mime: ' + s.mime + '\nModify: ' + new Date(s.mtime).toLocaleString() + '\nCreate: ' + new Date(s.ctime).toLocaleString()); }); }, 'Show file status');
  reg('du', (c, a) => { const { f, rest } = parse(a); const sz = (p) => V.isDir(p) ? V.ls(p).reduce((s, e) => s + (e.type === 'dir' ? sz(e.path) : e.size || 0), 0) : V.stat(p).size; (rest.length ? rest : ['.']).forEach((x) => { const p = c.resolve(x); if (V.isDir(p) && !f.s) V.ls(p).filter((e) => e.type === 'dir').forEach((e) => c.print((f.h ? human(sz(e.path)) : sz(e.path)) + '\t' + x.replace(/\/$/, '') + '/' + e.name)); c.print((f.h ? human(sz(p)) : sz(p)) + '\t' + x); }); }, 'Disk usage (-h -s)');
  reg('df', (c) => { const u = V.usage(); c.print('Filesystem      Size    Used   Avail  Use%  Mounted on'); c.print('leonux-vfs  ' + LX.fmtBytes(u.total).padStart(8) + LX.fmtBytes(u.used).padStart(8) + LX.fmtBytes(u.total - u.used).padStart(8) + (Math.max(1, Math.round(u.used / u.total * 100)) + '%').padStart(6) + '  /'); }, 'Report free disk space');

  // ---------- file manipulation ----------
  reg('mkdir', (c, a) => { const { rest } = parse(a); if (!need(c, rest, 1, '<dir>...')) return 1; let code = 0; rest.forEach((d) => { try { V.mkdir(c.resolve(d)); } catch (e) { c.error('mkdir: ' + d + ': ' + e.message); code = 1; } }); return code; }, 'Create directories');
  reg('rmdir', (c, a) => { if (!need(c, a, 1, '<dir>')) return 1; let code = 0; a.forEach((d) => { const p = c.resolve(d); if (!V.isDir(p)) { c.error('rmdir: ' + d + ': Not a directory'); code = 1; } else if (V.ls(p).length) { c.error('rmdir: ' + d + ': Directory not empty'); code = 1; } else V.rm(p); }); return code; }, 'Remove empty directories');
  reg('touch', (c, a) => { if (!need(c, a, 1, '<file>...')) return 1; a.forEach((x) => { const p = c.resolve(x); if (V.exists(p)) { if (V.isFile(p)) V.write(p, V.read(p)); } else V.write(p, ''); }); }, 'Create empty files / update time');
  reg('rm', (c, a) => {
    const { f, rest } = parse(a); if (!need(c, rest, 1, '[-rfP] <path>...')) return 1; let code = 0;
    rest.forEach((x) => { const p = c.resolve(x); if (p === '/' || p === V.HOME) { c.error('rm: refusing to remove ' + p); code = 1; return; } if (!V.exists(p)) { if (!f.f) { c.error('rm: cannot remove ' + x + ': No such file or directory'); code = 1; } return; } if (V.isDir(p) && !f.r && !f.R) { c.error('rm: cannot remove ' + x + ': Is a directory (use -r)'); code = 1; return; } V.rm(p, { permanent: !!f.P }); });
    return code;
  }, 'Remove files (-r recursive, -f force, -P permanent; default moves to Trash)');
  const target = (c, a, cmd, fn) => {
    const { f, rest } = parse(a); if (rest.length < 2) { c.error(cmd + ': missing operand. Usage: ' + cmd + ' <src>... <dest>'); return 1; }
    let dest = c.resolve(rest[rest.length - 1]); const srcs = rest.slice(0, -1); let code = 0;
    if (srcs.length > 1 && !V.isDir(dest)) { c.error(cmd + ': target is not a directory'); return 1; }
    srcs.forEach((s) => { const sp = c.resolve(s); if (!V.exists(sp)) { c.error(cmd + ': cannot stat ' + s + ': No such file or directory'); code = 1; return; } const d = V.isDir(dest) ? V.join(dest, V.basename(sp)) : dest; if (V.isDir(sp) && cmd === 'cp' && !f.r && !f.R) { c.error('cp: -r not specified; omitting directory ' + s); code = 1; return; } if (V.exists(d) && f.n) return; try { if (V.exists(d) && !V.isDir(d)) V.rm(d, { permanent: true }); fn(sp, d); } catch (e) { c.error(cmd + ': ' + e.message); code = 1; } });
    return code;
  };
  reg('mv', (c, a) => target(c, a, 'mv', (s, d) => V.mv(s, d)), 'Move or rename files');
  reg('cp', (c, a) => target(c, a, 'cp', (s, d) => V.cp(s, d)), 'Copy files (-r for directories)');
  reg('cat', (c, a) => { const { f, rest } = parse(a); c.inputs(rest).forEach((i) => { const lines = i.text.replace(/\n$/, '').split('\n'); if (i.text.indexOf('data:') === 0) { c.print('[binary data: ' + i.name + ']'); return; } lines.forEach((l, n) => c.print((f.n ? String(n + 1).padStart(5) + '  ' : '') + l)); }); }, 'Print files (-n numbers lines)');
  reg('tac', (c, a) => { c.inputs(a).forEach((i) => i.text.replace(/\n$/, '').split('\n').reverse().forEach((l) => c.print(l))); }, 'Print lines in reverse');
  reg('rev', (c, a) => { c.inputs(a).forEach((i) => i.text.replace(/\n$/, '').split('\n').forEach((l) => c.print(Array.from(l).reverse().join('')))); }, 'Reverse each line');
  reg('head', (c, a) => { const { f, rest } = parse(a, 'n'); const n = f.n != null ? +f.n : 10; c.inputs(rest).forEach((i) => i.text.replace(/\n$/, '').split('\n').slice(0, n).forEach((l) => c.print(l))); }, 'First lines of a file (-n N)');
  reg('tail', (c, a) => { const { f, rest } = parse(a, 'n'); const n = f.n != null ? +f.n : 10; c.inputs(rest).forEach((i) => i.text.replace(/\n$/, '').split('\n').slice(-n).forEach((l) => c.print(l))); }, 'Last lines of a file (-n N)');
  reg('wc', (c, a) => { const { f, rest } = parse(a); c.inputs(rest).forEach((i) => { const t = i.text, l = (t.match(/\n/g) || []).length, w = (t.trim() ? t.trim().split(/\s+/).length : 0); const all = !f.l && !f.w && !f.c; c.print([(all || f.l) ? String(l).padStart(6) : '', (all || f.w) ? String(w).padStart(6) : '', (all || f.c) ? String(t.length).padStart(7) : '', i.name === '(stdin)' ? '' : ' ' + i.name].join('')); }); }, 'Count lines, words, chars (-l -w -c)');
  reg('sort', (c, a) => { const { f, rest } = parse(a); let l = []; c.inputs(rest).forEach((i) => { l = l.concat(i.text.replace(/\n$/, '').split('\n')); }); l.sort(f.n ? (x, y) => parseFloat(x) - parseFloat(y) : (x, y) => x.localeCompare(y)); if (f.r) l.reverse(); if (f.u) l = l.filter((x, i) => l.indexOf(x) === i); l.forEach((x) => c.print(x)); }, 'Sort lines (-r -n -u)');
  reg('uniq', (c, a) => { const { f, rest } = parse(a); const l = c.inputs(rest)[0].text.replace(/\n$/, '').split('\n'); const g = []; l.forEach((x) => { if (g.length && g[g.length - 1][0] === x) g[g.length - 1][1]++; else g.push([x, 1]); }); g.forEach(([x, n]) => c.print((f.c ? String(n).padStart(4) + ' ' : '') + x)); }, 'Collapse repeated lines (-c)');
  reg('tee', (c, a) => { const t = c.stdin || ''; c.inputs([]).forEach(() => {}); a.forEach((x) => V.write(c.resolve(x), t)); t.replace(/\n$/, '').split('\n').forEach((l) => c.print(l)); }, 'Copy stdin to files and stdout');
  reg('grep', (c, a) => {
    const { f, rest } = parse(a, 'e'); const pat = f.e || rest.shift(); if (pat == null) { c.error('grep: usage: grep [-inrvcl] <pattern> [file...]'); return 2; }
    let re; try { re = new RegExp(pat, f.i ? 'i' : ''); } catch (e) { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), f.i ? 'i' : ''); }
    let files = rest; if (f.r || f.R) { files = []; (rest.length ? rest : ['.']).forEach((x) => { const p = c.resolve(x); if (V.isDir(p)) flatten(p).filter((e) => e.type === 'file').forEach((e) => files.push(e.path)); else files.push(x); }); }
    const multi = files.length > 1; let hits = 0;
    c.inputs(files).forEach((i) => { if (i.text.indexOf('data:') === 0) return; let cnt = 0; i.text.replace(/\n$/, '').split('\n').forEach((l, n) => { if (re.test(l) !== !!f.v) { cnt++; hits++; if (!f.c && !f.l) c.print((multi || f.r ? i.name + ':' : '') + (f.n ? (n + 1) + ':' : '') + l); } }); if (f.c) c.print((multi ? i.name + ':' : '') + cnt); if (f.l && cnt) c.print(i.name); });
    return hits ? 0 : 1;
  }, 'Search text (-i -n -v -c -l -r)');
  reg('find', (c, a) => {
    const { f, rest } = parse(a); let root = '.', name = null, type = null; const ar = a.slice();
    if (ar[0] && ar[0][0] !== '-') root = ar.shift();
    for (let i = 0; i < ar.length; i++) { if (ar[i] === '-name' || ar[i] === '-iname') { name = new RegExp('^' + ar[++i].replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', ar[i - 1] === '-iname' ? 'i' : ''); } else if (ar[i] === '-type') type = ar[++i]; }
    const p = c.resolve(root); if (!V.exists(p)) { c.error('find: ' + root + ': No such file or directory'); return 1; }
    const base = root.replace(/\/$/, ''); void f; void rest;
    if ((!type || type === 'd') && !name) c.print(root);
    flatten(p).forEach((e) => { if (name && !name.test(e.name)) return; if (type && (type === 'd') !== (e.type === 'dir')) return; c.print((base === '.' ? '.' : base) + e.path.slice(p === '/' ? 0 : p.length)); });
  }, 'Find files (-name PATTERN -type f|d)');
  reg('basename', (c, a) => { if (!need(c, a, 1, '<path>')) return 1; c.print(V.basename(a[0])); }, 'Strip directory from path');
  reg('dirname', (c, a) => { if (!need(c, a, 1, '<path>')) return 1; c.print(V.dirname(a[0])); }, 'Strip last path component');
  reg('base64', (c, a) => { const { f, rest } = parse(a); const t = c.inputs(rest)[0].text.replace(/\n$/, ''); try { c.print(f.d ? decodeURIComponent(escape(atob(t))) : btoa(unescape(encodeURIComponent(t)))); } catch (e) { c.error('base64: invalid input'); return 1; } }, 'Encode / decode base64 (-d)');
  reg('edit', (c, a) => { if (!need(c, a, 1, '<file>')) return 1; const p = c.resolve(a[0]); if (!V.exists(p)) V.write(p, ''); LX.apps.launch('texteditor', { path: p }); }, 'Open a file in Text Editor');
  reg('nano', (c, a) => T.commands.edit.fn(c, a), 'Alias of edit');

  // ---------- text / output ----------
  reg('echo', (c, a) => { const { f, rest } = parse(a.filter((x) => x !== '-e' || true).slice(0, 0).concat(a.slice(0, a.findIndex((x) => !/^-[neE]+$/.test(x)) < 0 ? a.length : a.findIndex((x) => !/^-[neE]+$/.test(x))))); let s = a.slice(Object.keys(f).length ? a.findIndex((x) => !/^-[neE]+$/.test(x)) < 0 ? a.length : a.findIndex((x) => !/^-[neE]+$/.test(x)) : 0).join(' '); void rest; if (f.e) s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\'); c.print(s); }, 'Print text (-e interprets \\n \\t)');
  reg('printf', (c, a) => { if (!a.length) return 0; let i = 1; const s = a[0].replace(/%[sdif%]/g, (m) => (m === '%%' ? '%' : a[i] == null ? '' : m === '%d' || m === '%i' ? String(parseInt(a[i++], 10) || 0) : m === '%f' ? String(parseFloat(a[i++]) || 0) : a[i++])).replace(/\\n/g, '\n').replace(/\\t/g, '\t'); c.print(s.replace(/\n$/, '')); }, 'Formatted print (%s %d %f)');
  reg('clear', (c) => c.clear(), 'Clear the screen');
  reg('seq', (c, a) => { const n = a.map(Number); let [s, st, e] = n.length === 1 ? [1, 1, n[0]] : n.length === 2 ? [n[0], 1, n[1]] : n; if ([s, st, e].some(isNaN) || !st) { c.error('seq: invalid argument'); return 1; } for (let i = s, k = 0; st > 0 ? i <= e : i >= e; i += st) { c.print(i); if (++k > 5000) break; } }, 'Print a sequence of numbers');
  reg('true', () => 0, 'Do nothing, successfully'); reg('false', () => 1, 'Do nothing, unsuccessfully');
  reg('sleep', async (c, a) => { const s = parseFloat(a[0]); if (isNaN(s) || s < 0) { c.error('sleep: invalid time interval'); return 1; } await c.sleep(Math.min(s, 60) * 1000); }, 'Wait N seconds (Ctrl+C aborts)');
  reg('yes', async (c, a) => { for (let i = 0; i < 200 && !c.aborted(); i++) { c.print(a.join(' ') || 'y'); if (i % 20 === 19) await c.sleep(10); } }, 'Repeat a string (max 200 lines)');
  reg('random', (c, a) => { const lo = a.length > 1 ? +a[0] : 0, hi = a.length > 1 ? +a[1] : a[0] != null ? +a[0] : 100; c.print(LX.rand(lo, hi)); }, 'Random integer: random [min] max');
  reg('calc', (c, a) => { const e = a.join(' '); if (!e) { c.error('calc: usage: calc 2*(3+4)'); return 1; } try { c.print(calc(e)); } catch (x) { c.error('calc: ' + x.message); return 1; } }, 'Evaluate a math expression');
  function calc(src) {
    let i = 0; const s = src.replace(/\s+/g, '');
    const peek = () => s[i];
    function num() { const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i)); if (m) { i += m[0].length; return parseFloat(m[0]); } const w = /^(pi|e|sqrt|sin|cos|tan|log|ln|abs|floor|ceil|round)/i.exec(s.slice(i)); if (!w) throw new Error('unexpected "' + (s[i] || 'end') + '"'); i += w[0].length; const k = w[0].toLowerCase(); if (k === 'pi') return Math.PI; if (k === 'e') return Math.E; if (peek() !== '(') throw new Error('expected ( after ' + k); i++; const v = expr(); if (peek() !== ')') throw new Error('missing )'); i++; return { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round }[k](v); }
    function atom() { if (peek() === '-') { i++; return -pow(); } if (peek() === '+') { i++; return pow(); } if (peek() === '(') { i++; const v = expr(); if (peek() !== ')') throw new Error('missing )'); i++; return v; } return num(); }
    function pow() { const b = atom(); if (peek() === '^') { i++; return Math.pow(b, pow()); } return b; }
    function term() { let v = pow(); while (peek() === '*' || peek() === '/' || peek() === '%') { const o = s[i++]; const r = pow(); if (o === '*') v *= r; else if (o === '/') { if (r === 0) throw new Error('division by zero'); v /= r; } else v %= r; } return v; }
    function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = s[i++]; const r = term(); v = o === '+' ? v + r : v - r; } return v; }
    const v = expr(); if (i < s.length) throw new Error('unexpected "' + s[i] + '"'); return +v.toPrecision(12);
  }
  reg('cal', (c, a) => {
    const now = new Date(); const m = a.length >= 2 ? +a[0] - 1 : now.getMonth(), y = a.length >= 2 ? +a[1] : a.length === 1 ? +a[0] : now.getFullYear();
    if (isNaN(m) || isNaN(y) || m < 0 || m > 11) { c.error('cal: usage: cal [month year]'); return 1; }
    const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const t = names[m] + ' ' + y; c.print(' '.repeat(Math.max(0, Math.floor((20 - t.length) / 2))) + t); c.print('Su Mo Tu We Th Fr Sa');
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(); let row = '   '.repeat(first);
    for (let d = 1; d <= days; d++) { const today = d === now.getDate() && m === now.getMonth() && y === now.getFullYear(); row += (today ? '<span class="t-hl">' + String(d).padStart(2) + '</span>' : String(d).padStart(2)) + ' '; if ((first + d) % 7 === 0 || d === days) { c.printHtml(row.replace(/ $/, '')); row = ''; } }
  }, 'Show a calendar');
  reg('date', (c, a) => { const d = new Date(); if (a[0] && a[0][0] === '+') c.print(a[0].slice(1).replace(/%([YmdHMSAaBbyjeZp%])/g, (m, k) => ({ Y: d.getFullYear(), m: LX.pad(d.getMonth() + 1), d: LX.pad(d.getDate()), H: LX.pad(d.getHours()), M: LX.pad(d.getMinutes()), S: LX.pad(d.getSeconds()), y: String(d.getFullYear()).slice(2), e: d.getDate(), A: d.toLocaleDateString('en', { weekday: 'long' }), a: d.toLocaleDateString('en', { weekday: 'short' }), B: d.toLocaleDateString('en', { month: 'long' }), b: d.toLocaleDateString('en', { month: 'short' }), p: d.getHours() < 12 ? 'AM' : 'PM', Z: Intl.DateTimeFormat().resolvedOptions().timeZone, '%': '%' }[k]))); else c.print(d.toString().replace(/ GMT.*$/, '')); }, 'Show date/time (+%Y-%m-%d %H:%M:%S)');
  reg('uptime', (c) => { const s = Math.floor((Date.now() - performance.timeOrigin) / 1000); c.print(' ' + LX.fmtTime(Date.now(), true) + ' up ' + Math.floor(s / 3600) + 'h ' + Math.floor(s % 3600 / 60) + 'm ' + (s % 60) + 's, ' + LX.wm.list().length + ' windows'); }, 'Time since boot');
  const FORT = ['There are only two hard things in CS: cache invalidation and naming things.', 'It works on my machine.', 'A journey of a thousand miles begins with `mkdir`.', 'Keep it simple, stupid.', 'Premature optimisation is the root of all evil. — Knuth', 'rm -rf is forever; Trash is a gentle friend.', 'Talk is cheap. Show me the code. — Linus', 'There is no place like 127.0.0.1.', 'Simplicity is prerequisite for reliability. — Dijkstra', 'The lion sleeps tonight, the kernel never does.'];
  reg('fortune', (c) => { c.print(LX.pick(FORT)); }, 'Print a random quote');
  function cow(text, eyes) {
    const w = Math.min(40, Math.max(...text.split('\n').map((l) => l.length))); const lines = []; text.split(/\n/).forEach((l) => { while (l.length > w) { lines.push(l.slice(0, w)); l = l.slice(w); } lines.push(l); });
    const b = [' ' + '_'.repeat(w + 2)]; lines.forEach((l, i) => { const [o, e] = lines.length === 1 ? ['<', '>'] : i === 0 ? ['/', '\\'] : i === lines.length - 1 ? ['\\', '/'] : ['|', '|']; b.push(o + ' ' + l.padEnd(w) + ' ' + e); }); b.push(' ' + '-'.repeat(w + 2));
    return b.concat(['        \\   ^__^', '         \\  (' + eyes + ')\\_______', '            (__)\\       )\\/\\', '                ||----w |', '                ||     ||']);
  }
  reg('cowsay', (c, a) => { const t = a.join(' ') || (c.stdin || '').trim() || 'Moo! (give me something to say)'; cow(t, 'oo').forEach((l) => c.print(l)); }, 'A talking cow');
  reg('cowthink', (c, a) => { cow(a.join(' ') || '...', '--').forEach((l) => c.print(l)); }, 'A thinking cow');
  reg('lolcat', (c, a) => { const t = a.join(' ') || c.stdin || ''; c.printHtml(Array.from(t).map((ch, i) => '<span style="color:hsl(' + (i * 18 % 360) + ',90%,65%)">' + esc(ch) + '</span>').join('')); }, 'Rainbow text');

  // ---------- system info ----------
  reg('whoami', (c) => c.print(c.env.USER), 'Print current user');
  reg('hostname', (c) => c.print(S.get('hostname')), 'Print host name');
  reg('uname', (c, a) => { const { f } = parse(a); const all = ['Leonux', S.get('hostname'), '1.0.0-web', '#1 SMP ' + new Date(performance.timeOrigin).toDateString(), 'x86_64']; c.print(f.a ? all.join(' ') : f.r ? all[2] : f.n ? all[1] : f.m ? all[4] : all[0]); }, 'System information (-a -r -n -m)');
  reg('id', (c) => c.print('uid=1000(' + c.env.USER + ') gid=1000(' + c.env.USER + ') groups=1000(' + c.env.USER + '),27(sudo)'), 'User identity');
  reg('free', (c, a) => { const tot = (navigator.deviceMemory || 8) * 1024, used = Math.round(LX.proc.list().reduce((s, p) => s + p.mem, 0) + 900); const h = parse(a).f.h; const fm = (m) => (h ? (m / 1024).toFixed(1) + 'G' : String(m)).padStart(10); c.print('              total      used      free'); c.print('Mem:' + fm(tot) + fm(used) + fm(tot - used)); }, 'Memory usage (-h)');
  reg('ps', (c) => { c.print('  PID  CPU%  MEM(MB)  COMMAND'); LX.proc.list().forEach((p) => c.print(String(p.pid).padStart(5) + String(p.cpu.toFixed(1)).padStart(6) + String(p.mem).padStart(9) + '  ' + p.name + (p.title !== p.name ? ' — ' + p.title : ''))); }, 'List running apps');
  reg('kill', (c, a) => { if (!need(c, a, 1, '<pid>')) return 1; let code = 0; a.forEach((x) => { if (!LX.proc.kill(+x)) { c.error('kill: (' + x + ') - No such process'); code = 1; } }); return code; }, 'End an app by PID');
  reg('neofetch', (c) => {
    const lg = ['    __,,,__   ', '  ,\' /     \\`. ', ' / (  o  o ) \\', ' |  \\  ^^  /  |', '  \\  `----\'  / ', '   `-.____.-\'  ', '    /_/  \\_\\   '];
    const u = V.usage(), s = Math.floor((Date.now() - performance.timeOrigin) / 1000);
    const info = [['', c.env.USER + '@' + S.get('hostname')], ['', '-'.repeat((c.env.USER + '@' + S.get('hostname')).length)], ['OS', 'Leonux 1.0 (web)'], ['Kernel', '1.0.0-web'], ['Uptime', Math.floor(s / 60) + ' mins, ' + (s % 60) + ' secs'], ['Shell', 'lsh'], ['Resolution', innerWidth + 'x' + innerHeight], ['Theme', S.get('theme') + ' / ' + S.get('accent')], ['CPU', (navigator.hardwareConcurrency || 4) + ' cores'], ['Memory', (navigator.deviceMemory || 8) + ' GiB'], ['Disk', LX.fmtBytes(u.used) + ' / ' + LX.fmtBytes(u.total)], ['Apps', LX.apps.list().length + ' installed']];
    const out = []; for (let i = 0; i < Math.max(lg.length, info.length); i++) out.push('<span class="t-accent">' + esc(lg[i] || ' '.repeat(14)) + '</span>  ' + (info[i] ? (info[i][0] ? '<b class="t-accent">' + info[i][0] + '</b>: ' : '<b class="t-accent">') + esc(info[i][1]) + (info[i][0] ? '' : '</b>') : ''));
    c.printHtml('<div style="white-space:pre">' + out.join('\n') + '</div><div style="white-space:pre;margin-top:6px">' + ['#F28B82', '#F6C177', '#9ECE6A', '#5B9DFA', '#CBA6F7', '#7FDBCA', '#e8eaf0'].map((x) => '<span style="background:' + x + '">   </span>').join('') + '</div>');
  }, 'Show system info');
  reg('sysinfo', (c) => T.commands.neofetch.fn(c, []), 'Alias of neofetch');

  // ---------- shell ----------
  reg('help', (c, a) => {
    if (a[0]) { const d = T.commands[a[0]]; if (!d) { c.error('help: no such command: ' + a[0]); return 1; } c.print(a[0] + ' — ' + (d.help || 'no description')); return 0; }
    const names = Object.keys(T.commands).sort();
    c.printHtml('<b>Leonux shell — ' + names.length + ' commands.</b> Use <b>help &lt;cmd&gt;</b> for one. Operators: <b>|  &gt;  &gt;&gt;  &amp;&amp;  ||  ;</b>  Globs: <b>* ?</b>');
    names.forEach((n) => c.printHtml('<span class="t-help" data-cmd="' + n + ' ">' + esc(n) + '</span>' + esc(T.commands[n].help)));
  }, 'List commands');
  reg('man', (c, a) => T.commands.help.fn(c, a), 'Alias of help');
  reg('which', (c, a) => { let code = 0; a.forEach((x) => { if (T.commands[x]) c.print('/usr/bin/' + x); else if (T.aliases()[x]) c.print(x + ': aliased to ' + T.aliases()[x]); else { c.error(x + ' not found'); code = 1; } }); return code; }, 'Locate a command');
  reg('type', (c, a) => T.commands.which.fn(c, a), 'Alias of which');
  reg('history', (c, a) => { if (a[0] === '-c') { T.clearHistory(); return 0; } const h = T.history(); const n = a[0] ? +a[0] : h.length; h.slice(-n).forEach((l, i) => c.print(String(h.length - Math.min(n, h.length) + i + 1).padStart(5) + '  ' + l)); }, 'Command history (-c clears)');
  reg('env', (c) => Object.keys(c.env).sort().forEach((k) => c.print(k + '=' + c.env[k])), 'Print environment');
  reg('printenv', (c, a) => { if (a[0]) { if (c.env[a[0]] == null) return 1; c.print(c.env[a[0]]); } else T.commands.env.fn(c, []); }, 'Print an environment variable');
  reg('export', (c, a) => { if (!a.length) return T.commands.env.fn(c, []); a.forEach((x) => { const m = /^([A-Za-z_]\w*)=(.*)$/.exec(x); if (m) c.env[m[1]] = m[2]; else if (!/^[A-Za-z_]\w*$/.test(x)) c.error('export: invalid identifier: ' + x); }); }, 'Set variables: export NAME=value');
  reg('unset', (c, a) => a.forEach((x) => { delete c.env[x]; }), 'Remove a variable');
  reg('alias', (c, a) => {
    const al = T.aliases(); if (!a.length) { Object.keys(al).sort().forEach((k) => c.print("alias " + k + "='" + al[k] + "'")); return 0; }
    a.forEach((x) => { const m = /^([^=\s]+)=(.*)$/.exec(x); if (m) T.setAlias(m[1], m[2]); else if (al[x]) c.print("alias " + x + "='" + al[x] + "'"); else c.error('alias: ' + x + ': not found'); });
  }, 'Define or list aliases: alias ll="ls -l"');
  reg('unalias', (c, a) => { a.forEach((x) => T.setAlias(x, null)); }, 'Remove an alias');
  reg('exit', (c) => { c.exit(); }, 'Close this terminal tab');
  reg('reset', (c) => { c.clear(); }, 'Reset the terminal');

  // ---------- desktop integration ----------
  reg('open', (c, a) => {
    if (!need(c, a, 1, '<file|app>')) return 1; const x = a[0]; const app = LX.apps.get(x.toLowerCase());
    if (app && !V.exists(c.resolve(x))) { LX.apps.launch(app.id); return 0; }
    const p = c.resolve(x); if (!V.exists(p)) { c.error('open: ' + x + ': No such file, directory or app'); return 1; }
    if (V.isDir(p)) LX.apps.launch('files', { path: p }); else LX.apps.openFile(p);
  }, 'Open a file, folder or app');
  reg('apps', (c, a) => { const l = LX.apps.list().filter((x) => !x.hidden && (!a[0] || (x.name + x.id + x.category).toLowerCase().indexOf(a[0].toLowerCase()) >= 0)).sort((x, y) => x.category.localeCompare(y.category) || x.name.localeCompare(y.name)); l.forEach((x) => c.printHtml('<span class="t-help" data-cmd="open ' + x.id + '">' + esc(x.id) + '</span>' + esc(x.name + ' · ' + x.category))); c.print(l.length + ' apps. Launch with: open <id>'); }, 'List installed apps');
  reg('notify', (c, a) => { if (!need(c, a, 1, '<message>')) return 1; LX.notify({ title: 'Terminal', body: a.join(' '), icon: 'terminal', appId: 'terminal' }); }, 'Show a desktop notification');
  reg('theme', (c, a) => { if (!a[0]) { c.print('theme: ' + S.get('theme')); return 0; } if (['dark', 'light', 'auto'].indexOf(a[0]) < 0) { c.error('theme: choose dark, light or auto'); return 1; } S.set('theme', a[0]); c.print('Theme set to ' + a[0]); }, 'Get/set theme: dark | light | auto');
  reg('accent', (c, a) => { if (!a[0]) { c.print('accent: ' + S.get('accent') + '\npresets: ' + LX.theme.accents.join(' ')); return 0; } let v = a[0]; if (a[0] === 'random') v = LX.pick(LX.theme.accents); if (!/^#[0-9a-f]{6}$/i.test(v)) { c.error('accent: expected #RRGGBB or "random"'); return 1; } S.set('accent', v); c.print('Accent set to ' + v); }, 'Get/set accent colour: accent #RRGGBB | random');
  reg('wallpaper', (c, a) => { const W = LX.theme.wallpapers; if (!a[0]) { c.print(Object.keys(W).join('  ')); return 0; } if (!W[a[0]]) { c.error('wallpaper: unknown. Options: ' + Object.keys(W).join(', ')); return 1; } S.set('wallpaper', a[0]); }, 'Set wallpaper by name');
  reg('volume', (c, a) => { if (a[0] == null) { c.print('volume: ' + S.get('volume') + '%'); return 0; } const v = +a[0]; if (isNaN(v)) { c.error('volume: expected 0-100'); return 1; } S.set('volume', LX.clamp(v, 0, 100)); }, 'Get/set volume 0-100');
  reg('brightness', (c, a) => { if (a[0] == null) { c.print('brightness: ' + S.get('brightness') + '%'); return 0; } const v = +a[0]; if (isNaN(v)) { c.error('brightness: expected 20-100'); return 1; } S.set('brightness', LX.clamp(v, 20, 100)); }, 'Get/set brightness 20-100');
  reg('settings', (c, a) => { LX.apps.launch('settings', a[0] ? { page: a[0] } : undefined); }, 'Open Settings [page]');
  reg('lock', () => LX.power.lock(), 'Lock the screen');
  reg('reboot', () => LX.power.restart(), 'Restart Leonux');
  reg('shutdown', () => LX.power.shutdown(), 'Shut down Leonux');
  reg('ping', async (c, a) => { if (!need(c, a, 1, '<host>')) return 1; c.print('PING ' + a[0] + ' (simulated)'); let t = 0; for (let i = 0; i < 4 && !c.aborted(); i++) { await c.sleep(450); const ms = LX.rand(8, 60); t += ms; c.print('64 bytes from ' + a[0] + ': icmp_seq=' + (i + 1) + ' ttl=57 time=' + ms + ' ms'); } c.print('--- 4 packets transmitted, 4 received, avg ' + Math.round(t / 4) + ' ms ---'); }, 'Simulated ping');
  reg('trash', (c, a) => { if (a[0] === 'empty') { V.emptyTrash(); c.print('Trash emptied.'); } else { const l = V.trashList(); if (!l.length) c.print('Trash is empty.'); l.forEach((t) => c.print(t.name + '\t' + t.origin)); } }, 'List Trash, or "trash empty"');
  reg('restore', (c, a) => { if (!need(c, a, 1, '<name>')) return 1; const t = V.trashList().find((x) => x.name === a[0]); if (!t) { c.error('restore: ' + a[0] + ': not in Trash'); return 1; } V.restore(t.path); c.print('Restored to ' + t.origin); }, 'Restore a file from Trash');

  // ---------- live store repositories ----------
  reg('repos', (c) => {
    const list = LX.repos.list();
    if (!list.length) { c.print('No repositories connected. Add one with: repo add <github-url>'); return 0; }
    list.forEach((r) => c.printHtml('<b>' + esc(r.name) + '</b>  <span class="t-dim">[' + esc(r.id) + ']' + (r.bundled ? ' bundled' : ' live') + '</span>\n  ' + esc(r.maintainer + ' · ' + r.url)));
    const cat = LX.repos.catalog();
    c.print(cat.length + ' items available · ' + LX.repos.installedCount() + ' installed · manage with: repo add|rm|refresh');
  }, 'List connected store repositories');
  reg('repo', async (c, a) => {
    const sub = a[0];
    if (sub === 'add') {
      if (!need(c, a, 2, 'add <github-url>')) return 1;
      c.print('Detecting repository…');
      try { const r = await LX.repos.add(a[1]); c.printHtml('<span class="t-ok">✓</span> Connected <b>' + esc(r.name) + '</b> (' + esc(r.id) + '). Browse it in the App Store.'); LX.apps.launch('softwarecenter', { view: 'apps', repo: r.id }); return 0; }
      catch (e) { c.error('repo: ' + e.message); return 1; }
    }
    if (sub === 'rm' || sub === 'remove') {
      if (!need(c, a, 2, 'rm <repo-id>')) return 1;
      if (!LX.repos.get(a[1])) { c.error('repo: no repository "' + a[1] + '" (run `repos`)'); return 1; }
      LX.repos.remove(a[1]); c.print('Removed. Installed items stay on this device.'); return 0;
    }
    if (sub === 'refresh') {
      const id = a[1];
      c.print('Syncing' + (id ? ' ' + id : ' all repositories') + '…');
      try { await (id ? LX.repos.refresh(id) : LX.repos.refreshAll()); c.printHtml('<span class="t-ok">✓</span> Catalogs up to date.'); return 0; }
      catch (e) { c.error('repo: ' + e.message); return 1; }
    }
    c.error('repo: unknown subcommand. Try: repo add <url> | repo rm <id> | repo refresh [id]');
    return 1;
  }, 'Manage live store repositories (add/rm/refresh)');

  // ---------- multi-file zip apps ----------
  reg('zapps', (c, a) => {
    const done = (apps) => {
      if (!apps.length) { c.print('No multi-file (ZIP) apps installed yet.'); c.print('Try the App Store → Games → Neon Snake, or:'); c.print('  · Zenboard (Productivity) · Synthwave Sequencer (Media) · Star Painter (Media)'); return 0; }
      c.printHtml('<b>' + apps.length + ' multi-file app' + (apps.length > 1 ? 's' : '') + '</b> — unpacked & served offline from IndexedDB:');
      apps.forEach((z) => c.printHtml('  📦 <b>' + esc(z.name) + '</b> v' + esc(z.version) + '  <span class="t-dim">' + z.count + ' files · ' + LX.fmtBytes(z.size) + ' · entry ' + esc(z.entry) + '</span>'));
      if (a[0] === 'ls' && apps[0]) { c.print(''); LX.zapps.listFiles(LX.repos.appIdOf(apps[0].appId.replace(/^rp_/, ''))).then((fs) => fs.forEach((f) => c.print('  ' + f.path + '  (' + LX.fmtBytes(f.size) + ')'))).catch(() => {}); }
      return 0;
    };
    if (!LX.zapps) { c.error('zapps: engine not loaded'); return 1; }
    LX.zapps.listApps().then(done).catch((e) => { c.error('zapps: ' + e.message); return 1; });
  }, 'List installed multi-file ZIP apps ("zapps ls" shows files of the newest)');

  reg('colors', (c) => { c.printHtml(['#F28B82', '#F6C177', '#9ECE6A', '#7FDBCA', '#5B9DFA', '#CBA6F7'].map((x) => '<span style="color:' + x + '">██ ' + x + '</span>').join('  ')); }, 'Show the palette');
})();
