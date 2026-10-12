/* Leonux Web OS — Terminal: shell engine (LX.terminal) + tabbed terminal app */
(function () {
  'use strict';
  const H = LX.h, esc = LX.escape;
  const cmds = {};            // name -> {fn, help}
  const sharedEnv = { SHELL: '/bin/lsh', TERM: 'xterm-leonux', LANG: 'en_US.UTF-8', PATH: '/usr/bin:/bin' };
  let aliases = LX.store.get('app.terminal.aliases', null) || { ll: 'ls -lah', la: 'ls -a', '..': 'cd ..', cls: 'clear' };
  let history = LX.store.get('app.terminal.history', []);
  if (!Array.isArray(history)) history = [];
  const saveAliases = () => LX.store.set('app.terminal.aliases', aliases);
  const saveHistory = () => LX.store.set('app.terminal.history', history.slice(-500));
  const toText = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; };

  function friendly(e) {
    const m = String(e && e.message || e);
    const map = { ENOENT: 'No such file or directory', EEXIST: 'File exists', ENOTDIR: 'Not a directory', EISDIR: 'Is a directory', ENOTEMPTY: 'Directory not empty', EINVAL: 'Invalid argument' };
    const k = Object.keys(map).find((x) => m.indexOf(x) === 0);
    return k ? map[k] : m;
  }

  // ---- tokenizer: words (with quoting, $VAR, ~) and operators ----
  function tokenize(line, env, status) {
    const toks = []; let i = 0; const n = line.length;
    const expand = (s) => s.replace(/\$(\?|\{[A-Za-z_]\w*\}|[A-Za-z_]\w*)/g, (m, v) => { if (v === '?') return String(status); v = v.replace(/[{}]/g, ''); return env[v] != null ? env[v] : ''; });
    while (i < n) {
      const c = line[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '#') break;
      if (c === ';') { toks.push({ op: ';' }); i++; continue; }
      if (c === '|') { if (line[i + 1] === '|') { toks.push({ op: '||' }); i += 2; } else { toks.push({ op: '|' }); i++; } continue; }
      if (c === '&') { if (line[i + 1] === '&') { toks.push({ op: '&&' }); i += 2; continue; } i++; continue; }
      if (c === '>') { if (line[i + 1] === '>') { toks.push({ op: '>>' }); i += 2; } else { toks.push({ op: '>' }); i++; } continue; }
      let w = '', quoted = false, started = false;
      while (i < n && !/[\s;|&>]/.test(line[i])) {
        const ch = line[i];
        if (ch === "'") { const j = line.indexOf("'", i + 1); if (j < 0) throw new Error('unterminated quote'); w += line.slice(i + 1, j); i = j + 1; quoted = true; }
        else if (ch === '"') {
          let j = i + 1, s = '';
          while (j < n && line[j] !== '"') { if (line[j] === '\\' && j + 1 < n && /["\\$]/.test(line[j + 1])) { s += line[j + 1]; j += 2; } else s += line[j++]; }
          if (j >= n) throw new Error('unterminated quote');
          w += expand(s); i = j + 1; quoted = true;
        }
        else if (ch === '\\' && i + 1 < n) { w += line[i + 1]; i += 2; quoted = true; }
        else { let j = i; while (j < n && !/[\s;|&>'"\\]/.test(line[j])) j++; let s = line.slice(i, j); if (!started && s[0] === '~' && (s.length === 1 || s[1] === '/')) s = (env.HOME || '/home/user') + s.slice(1); w += expand(s); i = j; }
        started = true;
      }
      toks.push({ word: w, quoted });
    }
    return toks;
  }

  function globToRe(g) { return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'); }
  function expandGlob(sess, w) {
    if (!/[*?]/.test(w)) return [w];
    const slash = w.lastIndexOf('/'); const dir = slash >= 0 ? w.slice(0, slash + 1) : ''; const pat = w.slice(slash + 1);
    try { const re = globToRe(pat); const out = LX.vfs.ls(sess.resolve(dir || '.')).filter((e) => (pat[0] === '.' || e.name[0] !== '.') && re.test(e.name)).map((e) => dir + e.name); return out.length ? out : [w]; } catch (e) { return [w]; }
  }

  // ---- sessions ----
  function createSession(opts) {
    opts = opts || {};
    const S = LX.settings;
    const sess = {
      env: Object.assign({}, sharedEnv, { HOME: LX.vfs.HOME, USER: S.get('username'), HOSTNAME: S.get('hostname'), PWD: opts.cwd || LX.vfs.HOME }),
      cwd: opts.cwd || LX.vfs.HOME, status: 0, running: false, signal: { aborted: false }, startTime: Date.now(),
      write: opts.write || function () {}, clear: opts.clear || function () {}, onExit: opts.onExit || function () {},
      resolve(p) { p = String(p == null ? '' : p); if (p === '~' || p.indexOf('~/') === 0) p = sess.env.HOME + p.slice(1); const full = p[0] === '/' ? p : sess.cwd + '/' + p; const parts = []; full.split('/').forEach((s) => { if (!s || s === '.') return; if (s === '..') parts.pop(); else parts.push(s); }); return '/' + parts.join('/'); },
      setCwd(p) { sess.cwd = p; sess.env.PWD = p; },
      abort() { sess.signal.aborted = true; },
      prompt() { const home = sess.env.HOME; const d = sess.cwd === home ? '~' : sess.cwd.indexOf(home + '/') === 0 ? '~' + sess.cwd.slice(home.length) : sess.cwd; return { user: S.get('username') || 'user', host: S.get('hostname') || 'leonux', dir: d }; },
      async exec(line) {
        if (sess.running) return 1;
        sess.running = true; sess.signal = { aborted: false };
        try { sess.status = await runLine(sess, line); } catch (e) { sess.write('<div class="t-err">lsh: ' + esc(friendly(e)) + '</div>'); sess.status = 2; }
        sess.running = false; return sess.status;
      },
      complete(text) { return complete(sess, text); },
    };
    return sess;
  }

  function splitStatements(toks) {
    const stmts = []; let cur = { stages: [[]], redirs: [null], op: ';' };
    const push = (op) => { stmts.push(cur); cur = { stages: [[]], redirs: [null], op }; };
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.op === ';' || t.op === '&&' || t.op === '||') { if (cur.stages[0].length || cur.stages.length > 1) push(t.op); else if (t.op !== ';') throw new Error('syntax error near `' + t.op + "'"); }
      else if (t.op === '|') { if (!cur.stages[cur.stages.length - 1].length) throw new Error("syntax error near `|'"); cur.stages.push([]); cur.redirs.push(null); }
      else if (t.op === '>' || t.op === '>>') { const f = toks[i + 1]; if (!f || f.word == null) throw new Error('syntax error: expected file after ' + t.op); cur.redirs[cur.redirs.length - 1] = { append: t.op === '>>', file: f.word }; i++; }
      else cur.stages[cur.stages.length - 1].push(t);
    }
    if (cur.stages[0].length || cur.stages.length > 1) stmts.push(cur);
    return stmts;
  }

  async function runLine(sess, line) {
    const toks = tokenize(line, sess.env, sess.status);
    const stmts = splitStatements(toks);
    let st = sess.status;
    for (const s of stmts) {
      if (sess.signal.aborted) return 130;
      if (s.op === '&&' && st !== 0) continue;
      if (s.op === '||' && st === 0) continue;
      st = await runPipeline(sess, s);
      sess.status = st;
    }
    return st;
  }

  async function runPipeline(sess, stmt) {
    let input = null; let code = 0;
    for (let i = 0; i < stmt.stages.length; i++) {
      let words = [];
      stmt.stages[i].forEach((t) => { if (t.quoted) words.push(t.word); else expandGlob(sess, t.word).forEach((x) => words.push(x)); });
      if (!words.length) continue;
      let name = words[0];
      for (let g = 0; g < 5 && aliases[name] != null && Object.prototype.hasOwnProperty.call(aliases, name); g++) {
        const re = tokenize(aliases[name], sess.env, sess.status).filter((t) => t.word != null).map((t) => t.word);
        words = re.concat(words.slice(1)); name = words[0] || name; if (!aliases[name]) break;
      }
      const last = i === stmt.stages.length - 1, redir = stmt.redirs[i];
      const buffered = !last || !!redir; const buf = [];
      const ctx = makeCtx(sess, name, input, buffered, buf);
      const def = cmds[name];
      if (!def) { ctx.error(name + ': command not found' + (name.length > 1 ? '. Try "help".' : '')); code = 127; input = ''; continue; }
      try { const r = def.fn(ctx, words.slice(1)); code = (await r) | 0; } catch (e) { ctx.error(name + ': ' + friendly(e)); code = 1; }
      if (buffered) {
        const text = buf.join('\n');
        if (redir) {
          try { const p = sess.resolve(redir.file); const prev = redir.append && LX.vfs.isFile(p) ? LX.vfs.read(p) : ''; LX.vfs.write(p, prev + (prev && !/\n$/.test(prev) ? '\n' : '') + text + (text ? '\n' : '')); } catch (e) { sess.write('<div class="t-err">lsh: ' + esc(redir.file) + ': ' + esc(friendly(e)) + '</div>'); code = 1; }
          input = '';
        } else input = text;
      }
      if (sess.signal.aborted) return 130;
    }
    return code;
  }

  function makeCtx(sess, name, stdin, buffered, buf) {
    const ctx = {
      name, session: sess, env: sess.env, stdin, isTTY: !buffered, signal: sess.signal,
      get cwd() { return sess.cwd; }, user: sess.env.USER, host: sess.env.HOSTNAME,
      resolve: (p) => sess.resolve(p), setCwd: (p) => sess.setCwd(p),
      print(s) { s = s == null ? '' : String(s); if (buffered) buf.push(s); else sess.write('<div class="t-line">' + (s === '' ? '&nbsp;' : esc(s)) + '</div>'); },
      printHtml(h) { if (buffered) buf.push(toText(h)); else sess.write('<div class="t-line">' + h + '</div>'); },
      error(s) { if (buffered && false) buf.push(s); sess.write('<div class="t-err t-line">' + esc(s) + '</div>'); },
      clear() { sess.clear(); },
      exit() { sess.onExit(); },
      esc,
      span: (t, cls) => '<span class="' + cls + '">' + esc(t) + '</span>',
      sleep(ms) { return new Promise((res) => { const t0 = Date.now(); const iv = setInterval(() => { if (sess.signal.aborted || Date.now() - t0 >= ms) { clearInterval(iv); res(); } }, 25); }); },
      aborted() { return sess.signal.aborted; },
      // read text from files (args) or stdin; returns [{name, text}]
      inputs(files) {
        if (files && files.length) return files.map((f) => { const p = sess.resolve(f); if (LX.vfs.isDir(p)) throw new Error(f + ': Is a directory'); return { name: f, text: LX.vfs.read(p) }; });
        return [{ name: '(stdin)', text: stdin == null ? '' : stdin }];
      },
    };
    return ctx;
  }

  // ---- completion ----
  function complete(sess, text) {
    const m = /(?:^|[\s;|&>])([^\s;|&>]*)$/.exec(text); const word = m ? m[1] : '';
    const start = text.length - word.length; const before = text.slice(0, start).trim();
    const isCmd = !before || /[;|&]$/.test(before);
    let cands = [];
    if (word[0] === '$') { cands = Object.keys(sess.env).filter((k) => k.indexOf(word.slice(1)) === 0).map((k) => '$' + k); }
    else if (isCmd && word.indexOf('/') < 0) { cands = Object.keys(cmds).concat(Object.keys(aliases)).filter((c) => c.indexOf(word) === 0); cands = cands.filter((c, i) => cands.indexOf(c) === i).sort(); }
    else {
      const slash = word.lastIndexOf('/'); const dir = word.slice(0, slash + 1), part = word.slice(slash + 1);
      try { cands = LX.vfs.ls(sess.resolve(dir || '.')).filter((e) => e.name.indexOf(part) === 0 && (part[0] === '.' || e.name[0] !== '.')).map((e) => dir + e.name.replace(/ /g, '\\ ') + (e.type === 'dir' ? '/' : '')); } catch (e) { cands = []; }
    }
    return { start, word, cands };
  }
  const common = (a) => a.reduce((p, s) => { let i = 0; while (i < p.length && p[i] === s[i]) i++; return p.slice(0, i); }, a[0] || '');

  // ---- public API ----
  LX.terminal = {
    commands: cmds, aliases() { return aliases; }, setAlias(k, v) { if (v == null) delete aliases[k]; else aliases[k] = v; saveAliases(); },
    history() { return history; }, clearHistory() { history.length = 0; saveHistory(); },
    register(name, fn, help) { cmds[name] = { fn, help: help || '' }; },
    createSession,
    // run a line headlessly; resolves {out, code}
    async run(line, opts) {
      opts = opts || {}; const out = [];
      const sess = opts.session || createSession({ cwd: opts.cwd, write: (h) => out.push(toText(h)) });
      const code = await sess.exec(line);
      return { out: out.join('\n'), code };
    },
  };

  // ---- app ----
  LX.apps.register({
    id: 'terminal', name: 'Terminal', icon: 'terminal', color: '#3DDC97', category: 'System', desc: 'Command line for Leonux', width: 780, height: 500, minWidth: 380, minHeight: 240,
    open(win, args) {
      const body = win.body; body.tabIndex = 0;
      let fsize = LX.store.get('app.terminal.fsize', 13); let tabs = [], cur = null, tabSeq = 0;
      const bar = H('div', { class: 'tr-bar' });
      const stage = H('div', { class: 'tr-stage' });
      body.append(bar, stage); body.style.setProperty('--tr-fs', fsize + 'px');

      function newTab(opt) {
        opt = opt || {};
        const out = H('div', { class: 'tr-out' });
        const pr = H('span', { class: 'tr-prompt' });
        const inp = H('input', { class: 'tr-input', spellcheck: false, autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Terminal input' });
        const line = H('div', { class: 'tr-line' }, pr, inp);
        const scr = H('div', { class: 'tr-screen scroll' }, out, line);
        const t = { id: ++tabSeq, scr, out, inp, line, pr, hist: [], hi: -1, draft: '', label: 'Shell' };
        let pend = '';
        t.sess = createSession({ cwd: opt.cwd, write: (h) => { out.insertAdjacentHTML('beforeend', h); while (out.childNodes.length > 2500) out.removeChild(out.firstChild); scr.scrollTop = scr.scrollHeight; }, clear: () => { out.innerHTML = ''; }, onExit: () => closeTab(t) });
        t.tabEl = H('div', { class: 'tab tr-tab', onclick: () => select(t) }, H('span', { class: 'ellipsis tr-tl' }), H('button', { class: 'tr-x', title: 'Close tab', 'aria-label': 'Close tab', html: LX.icon('x', 11), onclick: (e) => { e.stopPropagation(); closeTab(t); } }));
        const upd = () => { const p = t.sess.prompt(); pr.innerHTML = '<span class="t-user">' + esc(p.user + '@' + p.host) + '</span><span class="t-sep">:</span><span class="t-dir">' + esc(p.dir) + '</span><span class="t-sep">$ </span>'; t.label = p.dir === '~' ? p.user + '@' + p.host : p.dir; LX.$('.tr-tl', t.tabEl).textContent = t.label; if (cur === t) win.setTitle('Terminal — ' + t.label); };
        t.upd = upd;
        tabs.push(t); stage.appendChild(scr); redrawBar(); upd(); select(t);
        t.sess.write('<div class="t-line t-dim">Leonux Terminal ' + esc(LX.version) + ' — type <b>help</b> for commands, <b>Tab</b> to complete, <b>Ctrl+C</b> to interrupt.</div><div class="t-line">&nbsp;</div>');
        inp.addEventListener('keydown', (e) => onKey(e, t));
        scr.addEventListener('mouseup', () => { if (!String(getSelection()).length) inp.focus(); });
        out.addEventListener('click', (e) => { const a = e.target.closest('[data-cmd]'); if (a) { inp.value = a.dataset.cmd; inp.focus(); } });
        if (opt.cmd) { inp.value = opt.cmd; submit(t); }
        return t;
      }
      function redrawBar() {
        bar.innerHTML = ''; const tw = H('div', { class: 'tabs tr-tabs' }, tabs.map((t) => t.tabEl));
        bar.append(tw, H('button', { class: 'btn icon ghost sm', title: 'New tab (Ctrl+Shift+T)', 'aria-label': 'New tab', html: LX.icon('plus', 14), onclick: () => newTab({ cwd: cur && cur.sess.cwd }) }));
      }
      function select(t) { cur = t; tabs.forEach((x) => { x.scr.classList.toggle('on', x === t); x.tabEl.classList.toggle('active', x === t); }); t.upd(); setTimeout(() => (t.sess.running ? body : t.inp).focus(), 0); t.scr.scrollTop = t.scr.scrollHeight; }
      function closeTab(t) {
        t.sess.abort(); const i = tabs.indexOf(t); if (i < 0) return;
        tabs.splice(i, 1); t.scr.remove();
        if (!tabs.length) { win.close(); return; }
        redrawBar(); if (cur === t) select(tabs[Math.min(i, tabs.length - 1)]);
      }
      async function submit(t) {
        const text = t.inp.value; t.inp.value = ''; t.hi = -1;
        const p = t.sess.prompt();
        t.out.insertAdjacentHTML('beforeend', '<div class="t-line"><span class="t-user">' + esc(p.user + '@' + p.host) + '</span><span class="t-sep">:</span><span class="t-dir">' + esc(p.dir) + '</span><span class="t-sep">$ </span>' + esc(text) + '</div>');
        if (!text.trim()) { t.scr.scrollTop = t.scr.scrollHeight; return; }
        if (history[history.length - 1] !== text) { history.push(text); saveHistory(); }
        t.line.style.display = 'none'; body.focus();
        const label = t.label; LX.$('.tr-tl', t.tabEl).textContent = text.split(/\s/)[0];
        await t.sess.exec(text);
        if (t.sess.signal.aborted) t.sess.write('<div class="t-line t-dim">^C</div>');
        if (!tabs.includes(t)) return;
        t.upd(); t.line.style.display = ''; if (cur === t) t.inp.focus(); t.scr.scrollTop = t.scr.scrollHeight; void label;
      }
      function onKey(e, t) {
        const inp = t.inp;
        if (e.key === 'Enter') { e.preventDefault(); submit(t); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (!history.length) return; if (t.hi < 0) { t.draft = inp.value; t.hi = history.length; } t.hi = Math.max(0, t.hi - 1); inp.value = history[t.hi]; }
        else if (e.key === 'ArrowDown') { e.preventDefault(); if (t.hi < 0) return; t.hi++; if (t.hi >= history.length) { t.hi = -1; inp.value = t.draft; } else inp.value = history[t.hi]; }
        else if (e.key === 'Tab') { e.preventDefault(); tab(t); }
        else if (e.ctrlKey && !e.shiftKey && (e.key === 'c' || e.key === 'C') && inp.selectionStart === inp.selectionEnd) { e.preventDefault(); t.sess.write('<div class="t-line">' + t.pr.innerHTML + esc(inp.value) + '<span class="t-dim">^C</span></div>'); inp.value = ''; t.hi = -1; }
        else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); t.out.innerHTML = ''; }
        else if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) { e.preventDefault(); inp.value = inp.value.slice(inp.selectionStart); inp.setSelectionRange(0, 0); }
        else if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); inp.value = inp.value.slice(0, inp.selectionStart); }
        else if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); inp.setSelectionRange(0, 0); }
        else if (e.ctrlKey && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); inp.setSelectionRange(inp.value.length, inp.value.length); }
        else if (e.ctrlKey && (e.key === 'd' || e.key === 'D') && !inp.value) { e.preventDefault(); closeTab(t); }
        else if (e.key === 'PageUp') { t.scr.scrollTop -= t.scr.clientHeight * 0.9; }
        else if (e.key === 'PageDown') { t.scr.scrollTop += t.scr.clientHeight * 0.9; }
        else t.tabCount = 0;
      }
      function tab(t) {
        const inp = t.inp; const pos = inp.selectionStart; const text = inp.value.slice(0, pos), rest = inp.value.slice(pos);
        const r = t.sess.complete(text);
        if (!r.cands.length) return;
        const cp = common(r.cands);
        if (r.cands.length === 1) { const v = r.cands[0]; inp.value = text.slice(0, r.start) + v + (/[\/]$/.test(v) ? '' : ' ') + rest; const np = (text.slice(0, r.start) + v).length + (/[\/]$/.test(v) ? 0 : 1); inp.setSelectionRange(np, np); return; }
        if (cp.length > r.word.length) { inp.value = text.slice(0, r.start) + cp + rest; inp.setSelectionRange(r.start + cp.length, r.start + cp.length); return; }
        t.sess.write('<div class="t-line">' + t.pr.innerHTML + esc(text) + '</div><div class="t-line t-cols">' + r.cands.map((c) => '<span data-cmd="' + esc(text.slice(0, r.start) + c) + '">' + esc(c) + '</span>').join('') + '</div>');
      }
      const zoom = (d) => { fsize = LX.clamp(fsize + d, 9, 24); body.style.setProperty('--tr-fs', fsize + 'px'); LX.store.set('app.terminal.fsize', fsize); };
      body.addEventListener('keydown', (e) => {
        if (!cur) return;
        if (e.target === body && cur.sess.running && e.ctrlKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); cur.sess.abort(); }
        if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) { e.preventDefault(); newTab({ cwd: cur.sess.cwd }); }
        if (e.ctrlKey && e.shiftKey && (e.key === 'W' || e.key === 'w')) { e.preventDefault(); closeTab(cur); }
        if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoom(1); }
        if (e.ctrlKey && e.key === '-') { e.preventDefault(); zoom(-1); }
        if (e.ctrlKey && e.key === 'Tab') { e.preventDefault(); select(tabs[(tabs.indexOf(cur) + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length]); }
      });
      body.addEventListener('focus', () => { if (cur && !cur.sess.running) cur.inp.focus(); });
      win.on('focus', () => { if (cur && !cur.sess.running) setTimeout(() => cur.inp.focus(), 0); });
      win.setMenu([
        { label: 'Shell', items: [{ label: 'New tab', shortcut: 'Ctrl+Shift+T', action: () => newTab({ cwd: cur && cur.sess.cwd }) }, { label: 'Close tab', shortcut: 'Ctrl+Shift+W', action: () => cur && closeTab(cur) }, { separator: true }, { label: 'Clear', shortcut: 'Ctrl+L', action: () => cur && cur.sess.clear() }, { label: 'Clear history', action: () => { LX.terminal.clearHistory(); } }] },
        { label: 'Edit', items: [{ label: 'Copy selection', action: () => { const s = String(getSelection()); if (s) LX.clipboard.copy(s); } }, { label: 'Paste', action: () => LX.clipboard.paste().then((s) => { if (cur && s) { cur.inp.value += s.replace(/\r?\n/g, ' '); cur.inp.focus(); } }) }] },
        { label: 'View', items: [{ label: 'Zoom in', shortcut: 'Ctrl++', action: () => zoom(1) }, { label: 'Zoom out', shortcut: 'Ctrl+-', action: () => zoom(-1) }, { label: 'Reset zoom', action: () => { zoom(13 - fsize); } }] },
      ]);
      win.onClose(() => tabs.forEach((t) => t.sess.abort()));
      newTab({ cwd: args && (args.cwd || args.path) && LX.vfs.isDir(args.cwd || args.path) ? (args.cwd || args.path) : null, cmd: args && args.cmd });
    },
  });
})();
