/* Leonux Markdown — live split editor/preview with a safe hand-written renderer */
(function () {
  'use strict';
  const H = LX.h, V = LX.vfs;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function safeUrl(u) { u = u.trim().replace(/&amp;/g, '&'); return /^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(u) || /^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(u) ? esc(u) : null; }
  function inline(raw) {
    const codes = []; let s = esc(raw);
    s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push('<code>' + c + '</code>'); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (m, a, u) => { const x = safeUrl(u); return x ? '<img src="' + x + '" alt="' + a + '">' : a; });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (m, t, u) => { const x = safeUrl(u); return x ? '<a href="' + x + '" target="_blank" rel="noopener noreferrer">' + t + '</a>' : t; });
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, p, u) => p + '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>');
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>').replace(/(^|[^\w])_([^_]+)_(?!\w)/g, '$1<em>$2</em>').replace(/~~([^~]+)~~/g, '<del>$1</del>');
    return s.replace(/\u0000(\d+)\u0000/g, (m, i) => codes[+i]);
  }
  function render(src) {
    const L = String(src).replace(/\r\n?/g, '\n').split('\n'); let i = 0; const out = [];
    const blank = (l) => /^\s*$/.test(l);
    const isBlock = (l) => /^(#{1,6}\s|```|>\s?|\s*([-*+]|\d+\.)\s|\s*([-*_])(\s*\3){2,}\s*$)/.test(l);
    function list(indent) {
      const ord = /^\s*\d+\./.test(L[i]); const tag = ord ? 'ol' : 'ul'; let h = '<' + tag + '>';
      while (i < L.length) {
        const m = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(L[i]); if (!m) break;
        const ind = m[1].replace(/\t/g, '    ').length; if (ind < indent) break; if (ind > indent) { h = h.replace(/<\/li>$/, '') + list(ind) + '</li>'; continue; }
        let t = m[3], cls = ''; const tk = /^\[( |x|X)\]\s+(.*)$/.exec(t);
        if (tk) { t = '<input type="checkbox" disabled' + (tk[1] !== ' ' ? ' checked' : '') + '> ' + inline(tk[2]); cls = ' class="task"'; } else t = inline(t);
        h += '<li' + cls + '>' + t + '</li>'; i++;
      }
      return h + '</' + tag + '>';
    }
    while (i < L.length) {
      const l = L[i];
      if (blank(l)) { i++; continue; }
      let m;
      if ((m = /^```\s*([\w+-]*)/.exec(l))) { const b = []; i++; while (i < L.length && !/^```/.test(L[i])) b.push(L[i++]); i++; out.push('<pre><code' + (m[1] ? ' class="lang-' + esc(m[1]) + '"' : '') + '>' + esc(b.join('\n')) + '</code></pre>'); continue; }
      if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l))) { out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'); i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (/^>\s?/.test(l)) { const b = []; while (i < L.length && /^>\s?/.test(L[i])) b.push(L[i++].replace(/^>\s?/, '')); out.push('<blockquote>' + render(b.join('\n')) + '</blockquote>'); continue; }
      if (/^\s*([-*+]|\d+\.)\s+/.test(l)) { out.push(list(/^(\s*)/.exec(l)[1].replace(/\t/g, '    ').length)); continue; }
      if (l.indexOf('|') >= 0 && i + 1 < L.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(L[i + 1])) {
        const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const al = cells(L[i + 1]).map((c) => /^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : 'left');
        let h = '<table><thead><tr>' + cells(l).map((c, k) => '<th style="text-align:' + (al[k] || 'left') + '">' + inline(c) + '</th>').join('') + '</tr></thead><tbody>'; i += 2;
        while (i < L.length && !blank(L[i]) && L[i].indexOf('|') >= 0) { h += '<tr>' + cells(L[i]).map((c, k) => '<td style="text-align:' + (al[k] || 'left') + '">' + inline(c) + '</td>').join('') + '</tr>'; i++; }
        out.push(h + '</tbody></table>'); continue;
      }
      const p = [l]; i++; while (i < L.length && !blank(L[i]) && !isBlock(L[i])) p.push(L[i++]);
      out.push('<p>' + p.map((x) => inline(x.replace(/\s+$/, ''))).join('<br>') + '</p>');
    }
    return out.join('\n');
  }
  LX.mdRender = render;
  const SAMPLE = '# Markdown\n\nWrite **bold**, *italic*, ~~strike~~, `code` and [links](https://example.com).\n\n## Lists\n- Item one\n  - Nested\n- [x] Done task\n- [ ] Open task\n\n1. First\n2. Second\n\n> A quote\n\n```js\nconsole.log("hello");\n```\n\n| Name | Value |\n|------|------:|\n| a | 1 |\n| b | 2 |\n\n---\n';
  LX.apps.setOpener(['md', 'markdown'], 'markdown');
  LX.apps.register({
    id: 'markdown', name: 'Markdown', icon: 'hash', color: '#9CCFD8', category: 'Productivity', desc: 'Live markdown editor and preview', width: 940, height: 580, minWidth: 440, minHeight: 300,
    open(win, args) {
      const B = win.body; B.tabIndex = 0; let path = null, saved = SAMPLE, mode = LX.store.get('app.md.mode', 'split');
      const ta = H('textarea', { class: 'md-ta', spellcheck: 'false', value: SAMPLE });
      const pv = H('div', { class: 'md-preview scroll' });
      const status = H('small', { class: 'muted md-status' });
      const tb = (ic, t, fn) => H('button', { class: 'btn icon sm', title: t, html: LX.icon(ic, 15), onclick: fn });
      const wrap = (a, b) => () => { const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value.slice(s, e) || 'text'; ta.setRangeText(a + v + (b == null ? a : b), s, e, 'end'); ta.focus(); ta.dispatchEvent(new Event('input')); };
      const pre = (p) => () => { const s = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1; ta.setRangeText(p, s, s, 'end'); ta.focus(); ta.dispatchEvent(new Event('input')); };
      const modeBtns = ['edit', 'split', 'preview'].map((m) => H('button', { class: 'btn sm ghost', text: m[0].toUpperCase() + m.slice(1), onclick: () => setMode(m) }));
      B.append(H('div', { class: 'toolbar' }, tb('bold', 'Bold', wrap('**')), tb('italic', 'Italic', wrap('*')), tb('code', 'Code', wrap('`')), tb('link', 'Link', wrap('[', '](https://)')), tb('hash', 'Heading', pre('## ')), tb('list', 'List', pre('- ')), H('span', { class: 'grow' }), ...modeBtns),
        H('div', { class: 'md-split' }, ta, pv), H('div', { class: 'md-foot' }, status));
      function setMode(m) { mode = m; LX.store.set('app.md.mode', m); B.querySelector('.md-split').dataset.mode = m; modeBtns.forEach((b, i) => b.classList.toggle('active', ['edit', 'split', 'preview'][i] === m)); }
      const draw = LX.debounce(() => { pv.innerHTML = render(ta.value); }, 60);
      function upd() { draw(); const d = ta.value !== saved; win.setTitle((d ? '● ' : '') + (path ? V.basename(path) : 'Untitled.md') + ' — Markdown'); status.textContent = (ta.value.match(/\S+/g) || []).length + ' words · ' + ta.value.length + ' chars' + (path ? ' · ' + path : ''); }
      ta.addEventListener('input', upd);
      ta.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); upd(); } });
      function loadPath(p) { try { ta.value = saved = V.read(p); path = p; pv.innerHTML = render(ta.value); upd(); } catch (e) { LX.dialog.alert(e.message, 'Cannot open'); } }
      async function save(as) {
        let p = path; if (!p || as) { p = await LX.dialog.saveFile({ title: 'Save markdown', path: V.HOME + '/Documents', name: path ? V.basename(path) : 'untitled.md' }); if (!p) return; }
        try { V.write(p, ta.value); path = p; saved = ta.value; upd(); } catch (e) { LX.dialog.alert(e.message, 'Save failed'); }
      }
      async function openDlg() { const p = await LX.dialog.openFile({ title: 'Open markdown', path: V.HOME + '/Documents', exts: ['md', 'markdown', 'txt'] }); if (p) loadPath(p); }
      B.addEventListener('keydown', (e) => {
        const c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
        if (c && k === 's') save(e.shiftKey); else if (c && k === 'o') openDlg(); else if (c && k === 'b') wrap('**')(); else if (c && k === 'i') wrap('*')(); else return; e.preventDefault();
      });
      win.setMenu([{ label: 'File', items: [{ label: 'New', action: () => { path = null; saved = ''; ta.value = ''; upd(); } }, { label: 'Open…', shortcut: 'Ctrl+O', action: openDlg }, { label: 'Save', shortcut: 'Ctrl+S', action: () => save() }, { label: 'Save As…', shortcut: 'Ctrl+Shift+S', action: () => save(true) }] },
        { label: 'View', items: [{ label: 'Editor only', action: () => setMode('edit') }, { label: 'Split', action: () => setMode('split') }, { label: 'Preview only', action: () => setMode('preview') }] }]);
      win.onClose(() => { if (ta.value !== saved) { LX.dialog.confirm('Discard unsaved changes?', 'Unsaved changes').then((ok) => { if (ok) { saved = ta.value; win.close(); } }); return false; } });
      win.on('args', (a) => { if (a && a.path) loadPath(a.path); });
      setMode(mode); if (args && args.path) loadPath(args.path); else { pv.innerHTML = render(ta.value); upd(); }
    },
  });
})();
