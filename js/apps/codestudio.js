/* Store app — Code Studio: multi-file code editor with syntax highlighting,
   JS runner with captured console, projects stored in the VFS. */
(function () {
  'use strict';
  const H = LX.h;
  const PROJ = '/home/user/Projects';
  const KW = /\b(const|let|var|function|return|if|else|for|while|class|new|typeof|instanceof|of|in|try|catch|throw|async|await|yield|import|export|default|switch|case|break|continue|do|delete|this|super|extends|static|get|set|null|true|false|undefined|document|window|console|Math|JSON|Array|Object|String|Number|Boolean|Promise)\b/g;

  function highlight(src, lang) {
    let s = LX.escape(src);
    s = s.replace(/(&#39;|')(?:[^&<]|&(?!amp;))*?\1/g, (m) => '\u0001S' + m + '\u0002');
    s = s.replace(/(&quot;)(?:[^&<]|&(?!amp;))*?\1|"(?:[^"\\]|\\.)*"/g, (m) => '\u0001S' + m + '\u0002');
    if (lang === 'css') {
      s = s.replace(/(\/\*[\s\S]*?\*\/)/g, '\u0001C$1\u0002');
      s = s.replace(/^([^\u0001\n][^{\n}]*)(\{)/gm, '\u0001K$1\u0002$2');
    } else {
      s = s.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/g, (m) => m.startsWith('#') && lang !== 'py' ? m : '\u0001C' + m + '\u0002');
      s = s.replace(/(&lt;\/?[a-zA-Z][^&\s]*|&lt;!DOCTYPE[^&]*)/g, (m) => lang === 'html' ? '\u0001K' + m + '\u0002' : m);
    }
    s = s.replace(KW, (m) => '\u0001K' + m + '\u0002');
    s = s.replace(/\b(\d+\.?\d*)\b/g, (m, d, off, str) => (str && str[off - 1] === '#' ? m : '\u0001N' + m + '\u0002'));
    s = s.replace(/\u0001S([\s\S]*?)\u0002/g, '<span class="cs-tok str">$1</span>');
    s = s.replace(/\u0001C([\s\S]*?)\u0002/g, '<span class="cs-tok com">$1</span>');
    s = s.replace(/\u0001K([\s\S]*?)\u0002/g, '<span class="cs-tok kw">$1</span>');
    s = s.replace(/\u0001N([\s\S]*?)\u0002/g, '<span class="cs-tok num">$1</span>');
    return s;
  }

  LX.apps.register({
    id: 'codestudio', name: 'Code Studio', icon: 'code', color: '#74C7EC', category: 'Developer',
    pkg: true, pkgVersion: '1.3', pkgSize: 38, developer: 'Leonux Labs', downloads: 2100,
    desc: 'Lightweight code editor with themes and a JS runner', longDesc: 'A fast multi-file code editor for JavaScript, HTML, CSS and friends. Syntax highlighting, a built-in JavaScript runner with captured console output, and projects saved right into the Leonux filesystem.',
    permissions: ['Local storage', 'Sandboxed script execution'], changelog: 'New keyword theme, faster highlighting, console timestamps.',
    canOpenExt: ['js', 'html', 'css', 'json', 'md', 'py'],
    width: 960, height: 640, minWidth: 520, minHeight: 380,
    open(win, args) {
      // seed project on first ever run
      if (!LX.vfs.exists(PROJ)) {
        LX.vfs.mkdir(PROJ);
        LX.vfs.write(PROJ + '/index.html', '<!DOCTYPE html>\n<html>\n<head>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1 id="t">Hello from Code Studio</h1>\n  <script src="app.js"></script>\n</body>\n</html>\n');
        LX.vfs.write(PROJ + '/style.css', 'body{font-family:system-ui;background:#14161b;color:#e8eaf0;display:grid;place-items:center;height:100vh;margin:0}\nh1{color:#74C7EC;border-bottom:2px solid #74C7EC66;padding-bottom:8px}\n');
        LX.vfs.write(PROJ + '/app.js', '// Press Run (Ctrl+Enter) — output appears in the console panel\nconst greet = (name) => `Hello, ${name}!`;\nconsole.log(greet("Leonux"));\nfor (let i = 1; i <= 5; i++) console.log("fib", i, fib(i));\nfunction fib(n){ return n < 2 ? n : fib(n-1) + fib(n-2); }\n');
      }
      let dir = PROJ;
      if (args && args.path) dir = LX.vfs.dirname(args.path);
      if (!LX.vfs.isDir(dir)) dir = PROJ;

      const side = H('div', { class: 'sidebar cs-side' });
      const tabs = H('div', { class: 'cs-tabs scroll' });
      const ta = H('textarea', { class: 'cs-editor', spellcheck: 'false', wrap: 'off', onscroll: () => { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; } });
      const hl = H('pre', { class: 'cs-hl', 'aria-hidden': 'true' });
      const gutter = H('div', { class: 'cs-gutter' });
      const consoleEl = H('div', { class: 'cs-console scroll' });
      let openFiles = [], active = null, dirty = new Set();

      const fileBtn = (p) => {
        const name = LX.vfs.basename(p);
        return H('button', { class: 'cs-tab' + (active === p ? ' on' : '') + (dirty.has(p) ? ' dirty' : ''), onclick: () => openFile(p), oncontextmenu: (e) => { e.preventDefault(); e.stopPropagation(); LX.menu.show(e.clientX, e.clientY, [{ label: 'Close', icon: 'x', action: () => closeFile(p) }, { label: 'Reveal in Files', icon: 'folder', action: () => LX.apps.launch('files', { path: LX.vfs.dirname(p) }) }]); } },
          H('span', { text: name }), dirty.has(p) && H('span', { class: 'cs-dot' }));
      };
      function paintTabs() {
        tabs.innerHTML = '';
        openFiles.forEach((p) => tabs.appendChild(fileBtn(p)));
      }
      function paintSide() {
        side.innerHTML = '';
        side.appendChild(H('div', { class: 'cs-side-h', text: LX.vfs.basename(dir) }));
        const files = [];
        (function walk(p) { LX.vfs.ls(p).forEach((s) => { if (s.name[0] === '.') return; s.type === 'dir' ? walk(s.path) : files.push(s); }); })(dir);
        files.forEach((s) => {
          const e = LX.vfs.ext(s.name);
          side.appendChild(H('div', { class: 'list-item cs-file' + (active === s.path ? ' active' : ''), onclick: () => openFile(s.path) },
            H('span', { html: LX.icon(e === 'js' ? 'code' : e === 'html' ? 'globe' : e === 'css' ? 'palette' : 'file-text', 15) }), H('span', { class: 'ellipsis', text: s.name })));
        });
        if (!files.length) side.appendChild(H('div', { class: 'muted', style: { padding: '10px', fontSize: '12px' }, text: 'No files here' }));
      }
      function langOf(p) { const e = LX.vfs.ext(p); return e === 'css' ? 'css' : e === 'html' ? 'html' : e === 'py' ? 'py' : 'js'; }
      function paintHl() {
        const lang = active ? langOf(active) : 'js';
        hl.innerHTML = highlight(ta.value, lang) + '\n';
        const n = ta.value.split('\n').length;
        gutter.innerHTML = Array.from({ length: n }, (_, i) => '<span>' + (i + 1) + '</span>').join('');
        gutter.scrollTop = ta.scrollTop;
      }
      function openFile(p) {
        if (!LX.vfs.isFile(p)) return;
        saveActive();
        active = p; ta.value = LX.vfs.read(p); dirty.delete(p);
        if (openFiles.indexOf(p) < 0) openFiles.push(p);
        win.setTitle(LX.vfs.basename(p) + ' — Code Studio');
        paintTabs(); paintSide(); paintHl(); ta.focus();
      }
      function saveActive() {
        if (active && dirty.has(active)) { LX.vfs.write(active, ta.value); dirty.delete(active); paintTabs(); }
      }
      function closeFile(p) {
        if (dirty.has(p) && !confirmDiscard()) return;
        openFiles = openFiles.filter((x) => x !== p);
        if (active === p) { active = openFiles[0] || null; active ? openFile(active) : (ta.value = '', paintHl()); }
        paintTabs(); paintSide();
      }
      function confirmDiscard() { /* simplified: auto-save instead */ saveActive(); return true; }
      ta.addEventListener('input', () => { if (active) dirty.add(active); paintHl(); paintTabs(); });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runJS(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveActive(); LX.notify({ title: 'Saved', body: active, icon: 'save', timeout: 1600 }); }
      });

      // ---- JS runner ----
      function runJS() {
        saveActive();
        const src = active ? ta.value : '';
        const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>(' +
          'function l(){return Array.from(arguments).map(function(a){try{return typeof a==="object"?JSON.stringify(a,null,1):String(a)}catch(e){return String(a)}}).join(" ")}' +
          'var __out=[];console.log=function(){__out.push({t:"log",s:l.apply(null,arguments).join(" ")})};' +
          'console.error=function(){__out.push({t:"err",s:l.apply(null,arguments).join(" ")})};' +
          'console.warn=function(){__out.push({t:"warn",s:l.apply(null,arguments).join(" ")})};' +
          'try{' + src.replace(/<\/script/gi, '<\\/script') + '}catch(e){__out.push({t:"err",s:String(e&&e.message||e)})}' +
          'parent.postMessage({cs:"run",__out:__out},"*");<\/script></body></html>';
        consoleEl.innerHTML = '';
        consoleEl.appendChild(H('div', { class: 'cs-clog muted', text: '— running ' + (active ? LX.vfs.basename(active) : '') + ' —' }));
        const f = H('iframe', { class: 'cs-run-frame', sandbox: 'allow-scripts' });
        f.srcdoc = html;
        win.body.appendChild(f);
        const onMsg = (e) => {
          if (!e.data || e.data.cs !== 'run') return;
          window.removeEventListener('message', onMsg);
          f.remove();
          (e.data.__out || []).forEach((l) => consoleEl.appendChild(H('div', { class: 'cs-cline ' + (l.t === 'err' ? 'err' : l.t === 'warn' ? 'warn' : ''), text: l.s })));
          if (!(e.data.__out || []).length) consoleEl.appendChild(H('div', { class: 'cs-cline muted', text: '(no output)' }));
        };
        window.addEventListener('message', onMsg);
      }

      win.body.append(
        H('div', { class: 'toolbar' },
          H('button', { class: 'btn sm primary', html: LX.icon('play', 13) + ' Run', title: 'Run JS (Ctrl+Enter)', onclick: runJS }),
          H('button', { class: 'btn sm', html: LX.icon('save', 13) + ' Save', onclick: () => { saveActive(); LX.notify({ title: 'Saved', body: active || 'Nothing open', icon: 'save', timeout: 1600 }); } }),
          H('button', { class: 'btn sm', html: LX.icon('file-plus', 13) + ' New', onclick: async () => {
            const n = await LX.dialog.prompt('File name (e.g. app.js)', 'untitled.js', 'New file');
            if (n && n.trim()) { const p = LX.vfs.join(dir, n.trim()); if (!LX.vfs.exists(p)) LX.vfs.write(p, ''); openFile(p); paintSide(); }
          } }),
          H('button', { class: 'btn sm', html: LX.icon('folder', 13) + ' Open project…', onclick: () => LX.dialog.pickFolder({ title: 'Open project folder', path: LX.vfs.HOME }).then((p) => { if (p) { dir = p; active = null; openFiles = []; paintSide(); paintTabs(); ta.value = ''; paintHl(); } }) }),
          H('span', { class: 'grow' }),
          H('button', { class: 'btn sm ghost', html: LX.icon('x', 13) + ' Console', title: 'Toggle console', onclick: (e) => { consoleEl.classList.toggle('hidden'); e.currentTarget.classList.toggle('primary'); } })),
        H('div', { class: 'cs-main' }, side, H('div', { class: 'cs-edit-wrap col' }, tabs, H('div', { class: 'cs-editor-wrap' }, gutter, H('div', { class: 'cs-ta-wrap' }, hl, ta)), consoleEl)));
      win.onClose(() => saveActive());
      if (args && args.path && LX.vfs.isFile(args.path)) openFile(args.path);
      else { const first = LX.vfs.ls(dir).find((s) => s.type === 'file' && ['js', 'html', 'css'].indexOf(LX.vfs.ext(s.name)) >= 0); first ? openFile(first.path) : paintSide(); }
    },
  });
})();
