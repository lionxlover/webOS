/* Store app — Diff Tool: side-by-side LCS diff of two texts. */
(function () {
  'use strict';
  const H = LX.h;

  function lcsDiff(a, b) {
    // returns [{type:'same'|'add'|'del', text, ai, bi}]
    const n = a.length, m = b.length;
    const MAX = 900;
    if (n * m > MAX * MAX) {
      // fallback: line-by-line without alignment quality guarantee (chunked)
    }
    const dp = [];
    for (let i = 0; i <= n; i++) { dp.push(new Array(m + 1).fill(0)); }
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', text: a[i] }); i++; }
      else { out.push({ type: 'add', text: b[j] }); j++; }
    }
    while (i < n) { out.push({ type: 'del', text: a[i] }); i++; }
    while (j < m) { out.push({ type: 'add', text: b[j] }); j++; }
    return out;
  }

  LX.apps.register({
    id: 'diff', name: 'Diff Tool', icon: 'columns', color: '#74C7EC', category: 'Developer',
    pkg: true, pkgVersion: '1.0', pkgSize: 7, developer: 'Savannah Softworks', downloads: 430,
    desc: 'Compare two texts side by side', longDesc: 'Paste or load two texts and get an aligned, colour-coded diff — deletions on the left, insertions on the right — with change counts. Load files straight from the Leonux filesystem.',
    permissions: ['Local storage'], changelog: 'First release.',
    canOpenExt: [],
    width: 940, height: 620, minWidth: 520, minHeight: 420,
    open(win) {
      const left = H('textarea', { class: 'textarea df-in', spellcheck: 'false' });
      const right = H('textarea', { class: 'textarea df-in', spellcheck: 'false' });
      left.value = 'The quick brown fox\njumps over\nthe lazy dog\nand keeps running\ninto the sunset';
      right.value = 'The quick brown fox\nleaps over\nthe lazy dog\nand keeps running\npast the sunset\nforever';
      const resL = H('div', { class: 'df-out scroll' });
      const resR = H('div', { class: 'df-out scroll' });
      const stats = H('div', { class: 'df-stats' });

      function run() {
        const a = left.value.split('\n');
        const b = right.value.split('\n');
        const d = lcsDiff(a, b);
        resL.innerHTML = ''; resR.innerHTML = '';
        let del = 0, add = 0, same = 0;
        d.forEach((op) => {
          if (op.type === 'same') {
            same++;
            resL.appendChild(row('same', op.text));
            resR.appendChild(row('same', op.text));
          } else if (op.type === 'del') {
            del++;
            resL.appendChild(row('del', op.text));
            resR.appendChild(H('div', { class: 'df-row df-empty', text: ' ' }));
          } else {
            add++;
            resL.appendChild(H('div', { class: 'df-row df-empty', text: ' ' }));
            resR.appendChild(row('add', op.text));
          }
        });
        stats.innerHTML = '';
        stats.append(H('span', { class: 'df-chip same', text: same + ' unchanged' }), H('span', { class: 'df-chip del', text: '− ' + del + ' removed' }), H('span', { class: 'df-chip add', text: '+ ' + add + ' added' }));
        win.setTitle('Diff Tool — ' + del + ' removed, ' + add + ' added');
      }
      function row(type, text) { return H('div', { class: 'df-row ' + type }, H('span', { class: 'df-mark', text: type === 'del' ? '−' : type === 'add' ? '+' : ' ' }), H('span', { class: 'ellipsis', text: text === '' ? ' ' : text })); }

      const loadBtn = (ta, label) => H('button', { class: 'btn sm ghost', html: LX.icon('folder', 13) + label, onclick: () => LX.dialog.openFile({ title: 'Open file', path: '/home/user/Documents' }).then((p) => { if (p) { ta.value = LX.vfs.read(p); run(); } }) });
      win.body.append(
        H('div', { class: 'toolbar' },
          H('button', { class: 'btn sm primary', html: LX.icon('zap', 13) + ' Compare', onclick: run }),
          H('button', { class: 'btn sm', html: LX.icon('shuffle', 13), title: 'Swap sides', onclick: () => { const t = left.value; left.value = right.value; right.value = t; run(); } }),
          loadBtn(left, ' Load left'), loadBtn(right, ' Load right'),
          H('span', { class: 'grow' }), stats),
        H('div', { class: 'df-grid' },
          H('div', { class: 'df-col' }, H('div', { class: 'muted df-lbl', text: 'Original' }), left, H('div', { class: 'muted df-lbl', text: 'Result — left side' }), resL),
          H('div', { class: 'df-col' }, H('div', { class: 'muted df-lbl', text: 'Changed' }), right, H('div', { class: 'muted df-lbl', text: 'Result — right side' }), resR)));
      run();
    },
  });
})();
