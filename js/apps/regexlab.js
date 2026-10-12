/* Store app — Regex Lab: live pattern testing, replace preview and a cheat sheet. */
(function () {
  'use strict';
  const H = LX.h;

  LX.apps.register({
    id: 'regexlab', name: 'Regex Lab', icon: 'braces', color: '#CBA6F7', category: 'Developer',
    pkg: true, pkgVersion: '1.0', pkgSize: 9, developer: 'Savannah Softworks', downloads: 610,
    desc: 'Test regular expressions live', longDesc: 'Write a pattern, watch matches highlight as you type, inspect capture groups, preview replacements and keep the cheat sheet one glance away.',
    permissions: ['Local storage'], changelog: 'First release.',
    width: 900, height: 620, minWidth: 520, minHeight: 420,
    open(win) {
      let flags = 'gm';
      const patIn = H('input', { class: 'input grow rl-pat', value: '(\\w+)@(\\w+)\\.com', spellcheck: 'false' });
      const flagIn = H('input', { class: 'input rl-flags', value: flags, style: { width: '64px' }, spellcheck: 'false' });
      const testIn = H('textarea', { class: 'textarea rl-test', spellcheck: 'false', style: { minHeight: '120px' } });
      testIn.value = 'Contact: ada@leonux.com and grace@example.com\nInvalid: not-an-email\nAlso: turing@bletchley.com';
      const repIn = H('input', { class: 'input rl-rep', value: '$1 at $2 [domain]', spellcheck: 'false' });
      const out = H('div', { class: 'rl-out scroll' });
      const groups = H('div', { class: 'rl-groups scroll' });
      const repOut = H('div', { class: 'rl-repout' });
      const status = H('span', { class: 'rl-status' });

      const CHEAT = [['\\d', 'digit'], ['\\w', 'word char'], ['\\s', 'whitespace'], ['.', 'any char'], ['^ $', 'line start/end'], ['[abc]', 'set'], ['[^a]', 'negated set'], ['a*', '0 or more'], ['a+', '1 or more'], ['a?', 'optional'], ['a{2,4}', 'range'], ['(a)', 'capture group'], ['(?:a)', 'non-capture'], ['a|b', 'or'], ['(?=a)', 'lookahead'], ['\\b', 'word boundary']];

      function escHtml(s) { return LX.escape(s); }
      function paint() {
        out.innerHTML = ''; groups.innerHTML = ''; repOut.innerHTML = '';
        let re;
        try { re = new RegExp(patIn.value, flagIn.value); status.textContent = ''; status.className = 'rl-status ok'; }
        catch (e) { status.textContent = e.message; status.className = 'rl-status bad'; out.appendChild(H('div', { class: 'rl-line muted', text: testIn.value })); return; }
        flags = flagIn.value;

        // highlight preview (text-level)
        const text = testIn.value;
        const lines = text.split('\n');
        let html = '';
        let last = 0, count = 0;
        const gm = re.global ? re : new RegExp(re.source, re.flags + (re.global ? '' : 'g'));
        let m;
        const marks = [];
        while ((m = gm.exec(text)) !== null) {
          marks.push({ i: m.index, len: m[0].length || 1 });
          count++;
          if (!re.global) break;
          if (m[0] === '') gm.lastIndex++;
          if (count > 500) break;
        }
        let pos = 0;
        const frag = [];
        marks.forEach((mk) => {
          frag.push(escHtml(text.slice(pos, mk.i)));
          frag.push('<mark class="rl-mk">' + escHtml(text.slice(mk.i, mk.i + mk.len)) + '</mark>');
          pos = mk.i + mk.len;
        });
        frag.push(escHtml(text.slice(pos)));
        out.appendChild(H('div', { class: 'rl-line', html: frag.join('').replace(/\n/g, '<br>') }));

        // groups table
        const gm2 = re.global ? re : new RegExp(re.source, re.flags + (re.global ? '' : 'g'));
        let g = gm2.exec(text), shown = 0;
        while (g && shown < 30) {
          const row = H('div', { class: 'rl-g' });
          row.appendChild(H('code', { class: 'rl-g0', text: JSON.stringify(g[0]) }));
          if (g.length > 1) row.appendChild(H('span', { class: 'muted', style: { fontSize: '11.5px' }, text: g.slice(1).map((x, i) => '$' + (i + 1) + '=' + JSON.stringify(x)).join('  ') }));
          groups.appendChild(row);
          shown++;
          if (!re.global) break;
          if (g[0] === '') gm2.lastIndex++;
          g = gm2.exec(text);
        }
        if (!shown) groups.appendChild(H('div', { class: 'muted', text: 'No matches yet.' }));

        try { repOut.appendChild(H('code', { text: text.replace(re, repIn.value) })); }
        catch (e) { repOut.appendChild(H('span', { class: 'rl-status bad', text: e.message })); }
        status.textContent = count + ' match' + (count === 1 ? '' : 'es');
      }
      [patIn, flagIn, testIn, repIn].forEach((el) => el.addEventListener('input', paint));
      flagIn.addEventListener('input', () => { flagIn.value = flagIn.value.replace(/[^gimsuy]/g, ''); });

      const cheat = H('div', { class: 'rl-cheat scroll' }, CHEAT.map((c) => H('div', { class: 'rl-crow', onclick: () => { patIn.focus(); } }, H('code', { text: c[0] }), H('span', { class: 'muted', text: c[1] }))));
      const colLeft = H('div', { class: 'rl-col' }, H('div', { class: 'muted rl-lbl', text: 'Test text' }), testIn, H('div', { class: 'muted rl-lbl', text: 'Highlighted matches' }), out);
      const colRight = H('div', { class: 'rl-col' },
        H('div', { class: 'muted rl-lbl', text: 'Matches & groups' }), groups,
        H('div', { class: 'muted rl-lbl', text: 'Replace with' }), repIn, repOut,
        H('div', { class: 'muted rl-lbl', text: 'Cheat sheet' }), cheat);
      win.body.append(
        H('div', { class: 'toolbar' }, H('span', { class: 'rl-slash', text: '/' }), patIn, H('span', { class: 'rl-slash', text: '/' }), flagIn, H('span', { class: 'grow' }), status),
        H('div', { class: 'rl-grid' }, colLeft, colRight));
      paint();
    },
  });
})();
