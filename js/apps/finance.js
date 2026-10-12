/* Store app — Money Tracker: transactions, categories and a canvas chart. */
(function () {
  'use strict';
  const H = LX.h;
  const KEY = 'app.finance';
  const CATS = [['Food', '#F28B82'], ['Transport', '#5B9DFA'], ['Fun', '#CBA6F7'], ['Bills', '#F6C177'], ['Health', '#9ECE6A'], ['Other', '#9aa1b0'], ['Income', '#9ECE6A']];

  LX.apps.register({
    id: 'finance', name: 'Money Tracker', icon: 'wallet', color: '#74C7EC', category: 'Productivity',
    pkg: true, pkgVersion: '1.0', pkgSize: 14, developer: 'Acacia Systems', downloads: 1130,
    desc: 'Track spending with live charts', longDesc: 'A private budget book: log income and expenses by category, watch the monthly bar chart update live, and export everything to CSV. All data stays on your device.',
    permissions: ['Local storage'], changelog: 'First release.',
    width: 880, height: 600, minWidth: 480, minHeight: 420,
    open(win) {
      let txs = LX.store.get(KEY) || seed();
      const save = () => LX.store.set(KEY, txs);
      function seed() {
        const t = [];
        const r = LX.seeded('fin');
        const samples = [['Coffee run', 'Food', -4.5], ['Groceries', 'Food', -62.4], ['Bus pass', 'Transport', -28], ['Cinema', 'Fun', -12], ['Salary', 'Income', 2400], ['Internet bill', 'Bills', -35], ['Pharmacy', 'Health', -18.2], ['Book store', 'Fun', -22], ['Farmers market', 'Food', -31.5]];
        samples.forEach((s, i) => { const d = new Date(); d.setDate(d.getDate() - (i * 2 + 1)); t.push({ id: LX.uid(), d: d.toISOString().slice(0, 10), desc: s[0], cat: s[1], amt: s[2] }); });
        return t;
      }
      const monthKey = (dstr) => dstr.slice(0, 7);
      const thisMonth = () => new Date().toISOString().slice(0, 7);

      const balance = H('div', { class: 'fn-balance' });
      const list = H('div', { class: 'fn-list scroll' });
      const chart = H('canvas', { class: 'fn-chart', width: 640, height: 190 });

      function catColor(c) { const m = CATS.find((x) => x[0] === c); return m ? m[1] : '#9aa1b0'; }
      function fmt(n) { return (n < 0 ? '−' : '') + '$' + Math.abs(n).toFixed(2); }

      function paint() {
        // summary
        const now = thisMonth();
        const monthTx = txs.filter((t) => monthKey(t.d) === now);
        const inc = monthTx.filter((t) => t.amt > 0).reduce((a, t) => a + t.amt, 0);
        const exp = monthTx.filter((t) => t.amt < 0).reduce((a, t) => a - t.amt, 0);
        const net = txs.reduce((a, t) => a + t.amt, 0);
        balance.innerHTML = '';
        balance.append(
          H('div', { class: 'fn-bal-card main' }, H('span', { class: 'muted', text: 'Balance' }), H('b', { text: fmt(net) })),
          H('div', { class: 'fn-bal-card in' }, H('span', { class: 'muted', text: 'Income (month)' }), H('b', { text: fmt(inc) })),
          H('div', { class: 'fn-bal-card out' }, H('span', { class: 'muted', text: 'Spending (month)' }), H('b', { text: fmt(exp) })));
        // list
        list.innerHTML = '';
        txs.slice().sort((a, b) => b.d.localeCompare(a.d)).slice(0, 60).forEach((t) => {
          list.appendChild(H('div', { class: 'fn-row', oncontextmenu: (e) => { e.preventDefault(); LX.menu.show(e.clientX, e.clientY, [{ label: 'Delete', icon: 'trash', danger: true, action: () => { txs = txs.filter((x) => x.id !== t.id); save(); paint(); } }]); } },
            H('span', { class: 'fn-cat', style: { background: catColor(t.cat) + '33', color: catColor(t.cat) }, text: t.cat }),
            H('span', { class: 'grow ellipsis', text: t.desc }), H('span', { class: 'muted', style: { fontSize: '11.5px' }, text: t.d }),
            H('b', { class: t.amt > 0 ? 'pos' : '', text: fmt(t.amt) })));
        });
        if (!txs.length) list.appendChild(H('div', { class: 'center muted', style: { padding: '30px' }, text: 'No transactions yet.' }));
        drawChart();
      }
      function drawChart() {
        const ctx = chart.getContext('2d');
        const W = chart.width = chart.clientWidth || 640, Hh = chart.height = 190;
        ctx.clearRect(0, 0, W, Hh);
        // last 6 months income vs expense grouped bars
        const months = [];
        for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); months.push(d.toISOString().slice(0, 7)); }
        const inc = months.map((m) => txs.filter((t) => monthKey(t.d) === m && t.amt > 0).reduce((a, t) => a + t.amt, 0));
        const exp = months.map((m) => -txs.filter((t) => monthKey(t.d) === m && t.amt < 0).reduce((a, t) => a - t.amt, 0));
        const max = Math.max(1, ...inc, ...exp);
        const pad = 34, bw = (W - pad * 2) / months.length / 2 - 6;
        ctx.font = '10px system-ui';
        months.forEach((m, i) => {
          const x0 = pad + i * (W - pad * 2) / months.length;
          const hi = inc[i] / max * (Hh - 46), he = exp[i] / max * (Hh - 46);
          ctx.fillStyle = '#9ECE6A'; roundRect(ctx, x0 + 4, Hh - 26 - hi, bw, hi, 4); ctx.fill();
          ctx.fillStyle = '#F28B82'; roundRect(ctx, x0 + bw + 10, Hh - 26 - he, bw, he, 4); ctx.fill();
          ctx.fillStyle = 'rgba(154,161,176,.9)';
          ctx.fillText(m[5] === '0' ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m[6]-1] : m, x0, Hh - 8);
        });
        ctx.fillStyle = '#9ECE6A'; ctx.fillText('● income', W - 100, 14);
        ctx.fillStyle = '#F28B82'; ctx.fillText('● spending', W - 100, 28);
      }
      function roundRect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, Math.abs(h) / 2); ctx.beginPath(); if (h < 0) { y += h; h = -h; } ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

      const desc = H('input', { class: 'input grow', placeholder: 'Description' });
      const amt = H('input', { class: 'input', type: 'number', step: '0.01', placeholder: 'Amount', style: { width: '110px' } });
      const cat = H('select', { class: 'select' }, CATS.map((c) => H('option', { value: c[0], text: c[0] })));
      const add = H('button', { class: 'btn primary', text: 'Add', onclick: () => {
        const v = +amt.value;
        if (!desc.value.trim() || !v) { LX.notify({ title: 'Missing fields', body: 'Add a description and a non-zero amount.', icon: 'alert' }); return; }
        const c = cat.value === 'Income' ? 'Income' : cat.value;
        txs.push({ id: LX.uid(), d: new Date().toISOString().slice(0, 10), desc: desc.value.trim(), cat: c, amt: c === 'Income' ? Math.abs(v) : -Math.abs(v) });
        save(); desc.value = ''; amt.value = ''; paint();
      } });

      win.body.append(
        balance,
        H('div', { class: 'fn-chart-wrap card' }, chart),
        H('div', { class: 'toolbar' }, desc, cat, amt, add,
          H('button', { class: 'btn sm ghost', html: LX.icon('download', 13) + ' CSV', title: 'Export to Documents', onclick: () => {
            const csv = 'date,description,category,amount\n' + txs.map((t) => [t.d, '"' + t.desc.replace(/"/g, '""') + '"', t.cat, t.amt].join(',')).join('\n');
            LX.dialog.saveFile({ title: 'Export CSV', path: '/home/user/Documents', name: 'money-tracker.csv' }).then((p) => { if (p) { LX.vfs.write(p, csv); LX.notify({ title: 'Exported', body: p, icon: 'save' }); } });
          } })),
        list);
      paint();
    },
  });
})();
