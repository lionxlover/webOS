/* Store app — JSON Studio: validate, format, minify and tree-explore JSON. */
(function () {
  'use strict';
  const H = LX.h;

  LX.apps.register({
    id: 'jsonstudio', name: 'JSON Studio', icon: 'braces', color: '#F6C177', category: 'Developer',
    pkg: true, pkgVersion: '1.1', pkgSize: 10, developer: 'Leonux Labs', downloads: 760,
    desc: 'Format, validate and explore JSON', longDesc: 'Paste or open JSON, format it with configurable indentation, minify for transport, and browse the structure in an expandable tree with values and node counts.',
    permissions: ['Local storage'], changelog: 'Tree view added.',
    canOpenExt: ['json'],
    width: 900, height: 620, minWidth: 520, minHeight: 420,
    open(win, args) {
      const input = H('textarea', { class: 'textarea js-in', spellcheck: 'false', style: { flex: 1, fontFamily: 'var(--mono)', fontSize: '13px' } });
      input.value = args && args.path ? LX.vfs.read(args.path) : '{\n  "name": "leonux",\n  "version": 2,\n  "apps": ["files", "terminal", "app store"],\n  "offline": true,\n  "stats": { "windows": 12, "spaces": 4 }\n}';
      const out = H('div', { class: 'js-out scroll' });
      const tree = H('div', { class: 'js-tree scroll' });
      const status = H('span', { class: 'js-status' });
      let mode = 'format';

      function parse() {
        try { const v = JSON.parse(input.value); status.textContent = 'valid'; status.className = 'js-status ok'; return v; }
        catch (e) {
          status.textContent = e.message; status.className = 'js-status bad';
          const mm = /position (\d+)/.exec(e.message);
          out.innerHTML = '';
          out.appendChild(H('div', { class: 'js-err' }, H('b', { text: 'Invalid JSON' }), H('div', { class: 'muted', text: e.message }),
            mm && H('div', { class: 'js-ctx' }, H('code', { text: input.value.slice(Math.max(0, +mm[1] - 24), +mm[1]) }), H('mark', { text: input.value.slice(+mm[1], +mm[1] + 1) || ' ' }), H('code', { text: input.value.slice(+mm[1] + 1, +mm[1] + 20) }))));
          return null;
        }
      }
      function paint() {
        const v = parse();
        if (v == null) { tree.innerHTML = ''; return; }
        if (mode === 'format') out.textContent = JSON.stringify(v, null, 2);
        else if (mode === 'min') out.textContent = JSON.stringify(v);
        else out.textContent = JSON.stringify(v, null, '\t');
        // tree
        tree.innerHTML = '';
        tree.appendChild(node(v, 'root', 0));
      }
      function node(v, key, depth) {
        const wrap = H('div', { class: 'js-nd', style: { paddingLeft: Math.min(depth * 14, 56) + 'px' } });
        if (v !== null && typeof v === 'object') {
          const open = depth < 2;
          const caret = H('button', { class: 'js-caret' + (open ? '' : ' closed'), html: LX.icon('chevron-right', 12), onclick: () => { kids.classList.toggle('hidden'); caret.classList.toggle('closed'); } });
          const kids = H('div', { class: open ? '' : 'hidden' });
          const head = H('div', { class: 'js-nd-h' }, caret, H('code', { class: 'js-k', text: key }), H('span', { class: 'muted', text: Array.isArray(v) ? 'array[' + v.length + ']' : 'object{' + Object.keys(v).length + '}' }));
          Object.keys(v).forEach((k) => kids.appendChild(node(v[k], Array.isArray(v) ? k : k, depth + 1)));
          wrap.append(head, kids);
        } else {
          wrap.appendChild(H('div', { class: 'js-nd-h' }, H('code', { class: 'js-k', text: key }), H('code', { class: 'js-v ' + (typeof v === 'number' ? 'num' : typeof v === 'boolean' ? 'bool' : v === null ? 'null' : 'str'), text: JSON.stringify(v) })));
        }
        return wrap;
      }
      input.addEventListener('input', LX.debounce(paint, 200));

      const setMode = (m) => () => { mode = m; paint(); };
      win.body.append(
        H('div', { class: 'toolbar' },
          H('button', { class: 'btn sm primary', text: 'Format', onclick: setMode('format') }),
          H('button', { class: 'btn sm', text: 'Minify', onclick: setMode('min') }),
          H('button', { class: 'btn sm', text: 'Tabs', onclick: setMode('tab') }),
          H('button', { class: 'btn sm', html: LX.icon('copy', 13) + ' Copy output', onclick: () => LX.clipboard.copy(out.textContent) }),
          H('button', { class: 'btn sm', html: LX.icon('save', 13) + ' Save', onclick: () => LX.dialog.saveFile({ title: 'Save JSON', path: '/home/user/Documents', name: 'data.json' }).then((p) => { if (p) { LX.vfs.write(p, out.textContent || input.value); LX.notify({ title: 'Saved', body: p, icon: 'save' }); } }) }),
          H('button', { class: 'btn sm ghost', html: LX.icon('folder', 13) + ' Open', onclick: () => LX.dialog.openFile({ title: 'Open JSON', path: '/home/user/Documents', exts: ['json'] }).then((p) => { if (p) { input.value = LX.vfs.read(p); paint(); } }) }),
          H('span', { class: 'grow' }), status),
        H('div', { class: 'js-main' },
          H('div', { class: 'js-col' }, H('div', { class: 'muted js-lbl', text: 'Input' }), input),
          H('div', { class: 'js-col' }, H('div', { class: 'muted js-lbl', text: 'Output' }), out,
            H('div', { class: 'muted js-lbl', style: { marginTop: '10px' }, text: 'Tree' }), tree)));
      paint();
    },
  });
})();
