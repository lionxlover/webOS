/* Store app — Leonux Sheets: a real spreadsheet with formulas, formatting and CSV I/O. */
(function () {
  'use strict';
  const H = LX.h;
  const COLS = 12, ROWS = 30;
  const colName = (c) => String.fromCharCode(65 + c);
  const KEY = 'app.sheets.data';

  function evalCell(ref, grid, depth) {
    depth = depth || 0;
    if (depth > 12) return '#CYCLE';
    const cell = grid[ref];
    if (cell == null || cell.raw == null) return 0;
    if (cell.cached != null && !cell.dirty) return cell.cached;
    let v = cell.raw;
    if (typeof v === 'string' && v[0] === '=') { v = evalFormula(v.slice(1), grid, depth + 1); }
    const num = typeof v === 'number' ? v : (String(v).trim() !== '' && !isNaN(+v) ? +v : v);
    cell.cached = num; cell.dirty = false;
    return num;
  }
  function expandRange(rng, grid, depth) {
    const m = /^([A-L])(\d{1,2}):([A-L])(\d{1,2})$/.exec(rng.toUpperCase());
    if (!m) return [evalCell(rng.toUpperCase(), grid, depth)];
    const out = [];
    for (let c = m[1].charCodeAt(0); c <= m[3].charCodeAt(0); c++) {
      for (let r = +m[2]; r <= +m[4]; r++) out.push(evalCell(String.fromCharCode(c) + r, grid, depth));
    }
    return out;
  }
  function evalFormula(f, grid, depth) {
    // functions: SUM AVG MIN MAX COUNT ABS ROUND
    const fn = f.match(/^(SUM|AVG|MIN|MAX|COUNT|ABS|ROUND)\((.*)\)$/i);
    if (fn) {
      const vals = expandRange(fn[2].replace(/\s/g, ''), grid, depth).filter((v) => typeof v === 'number' || v === 0 || typeof v !== 'string');
      const nums = expandRange(fn[2].replace(/\s/g, ''), grid, depth).map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));
      const name = fn[1].toUpperCase();
      if (name === 'SUM') return nums.reduce((a, b) => a + b, 0);
      if (name === 'AVG') return nums.length ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : 0;
      if (name === 'MIN') return Math.min(...nums);
      if (name === 'MAX') return Math.max(...nums);
      if (name === 'COUNT') return nums.filter((n) => n !== 0 || String(n) === '0').length ? nums.filter((n) => !isNaN(n)).length : 0;
      if (name === 'ABS') return Math.abs(nums[0] || 0);
      if (name === 'ROUND') return Math.round(nums[0] || 0);
    }
    // arithmetic with refs: A1*2+B2
    try {
      const expr = f.replace(/\+|-|\*|\/|\(|\)|\d|\s/g, ' ').split(/\s+/).filter(Boolean);
      const m = f.match(/^([A-L]\d{1,2})\s*([+\-*/])\s*([A-L]\d{1,2})$/i);
      if (m) { const a = evalCell(m[1], grid, depth), b = evalCell(m[3], grid, depth); const op = m[2]; return op === '+' ? +a + +b : op === '-' ? +a - +b : op === '*' ? +a * +b : +b === 0 ? '#DIV0' : +a / +b; }
      const js = f.replace(/([A-L]\d{1,2})/gi, (r) => '(' + Number(evalCell(r, grid, depth)) + ')');
      if (/^[\d\s+\-*/().]+$/.test(js)) { // safe arithmetic only
        const v = Function('"use strict";return (' + js + ')')();
        return typeof v === 'number' && isFinite(v) ? +v.toFixed(6) : '#ERR';
      }
    } catch (e) { return '#ERR'; }
    return '#ERR';
  }

  LX.apps.register({
    id: 'spreadsheets', name: 'Leonux Sheets', icon: 'grid', color: '#9ECE6A', category: 'Productivity',
    pkg: true, pkgVersion: '1.1', pkgSize: 26, developer: 'Savannah Softworks', downloads: 1450,
    desc: 'Spreadsheet with formulas and CSV import/export', longDesc: 'A pocket spreadsheet engine: cell references, ranges and functions (SUM, AVG, MIN, MAX, COUNT…), bold formatting, and open/save of CSV files straight into the Leonux filesystem.',
    permissions: ['Local storage'], changelog: 'Faster recalc, new ROUND function, CSV export.',
    canOpenExt: ['csv'],
    width: 920, height: 600, minWidth: 480, minHeight: 360,
    open(win, args) {
      let grid = args && args.path && LX.vfs.ext(args.path) === 'csv' ? fromCSV(LX.vfs.read(args.path)) : (LX.store.get(KEY) || seedGrid());
      const save = () => LX.store.set(KEY, grid);
      const bold = new Set(LX.store.get('app.sheets.bold', []));

      function seedGrid() {
        const g = {};
        g.A1 = { raw: 'Quarter', cached: null, dirty: true }; g.B1 = { raw: 'Revenue', cached: null, dirty: true }; g.C1 = { raw: 'Cost', cached: null, dirty: true }; g.D1 = { raw: 'Profit', cached: null, dirty: true };
        const data = [['Q1', 12500, 8200], ['Q2', 15200, 9100], ['Q3', 13900, 9400], ['Q4', 18100, 10800]];
        data.forEach((row, i) => { const r = 2 + i; g['A' + r] = { raw: row[0], dirty: true }; g['B' + r] = { raw: row[1], dirty: true }; g['C' + r] = { raw: row[2], dirty: true }; g['D' + r] = { raw: '=B' + r + '-C' + r, dirty: true }; });
        g.A7 = { raw: 'Total', dirty: true }; g.B7 = { raw: '=SUM(B2:B5)', dirty: true }; g.C7 = { raw: '=SUM(C2:C5)', dirty: true }; g.D7 = { raw: '=SUM(D2:D5)', dirty: true };
        g.A9 = { raw: 'Average profit', dirty: true }; g.D9 = { raw: '=AVG(D2:D5)', dirty: true };
        g.A10 = { raw: 'Best quarter', dirty: true }; g.D10 = { raw: '=MAX(D2:D5)', dirty: true };
        return g;
      }
      function fromCSV(text) {
        const g = {};
        text.split(/\r?\n/).forEach((line, r) => {
          if (!line) return;
          line.split(',').forEach((cell, c) => {
            if (c >= COLS || r >= ROWS) return;
            const raw = cell === '' ? '' : (isNaN(+cell) ? cell : +cell);
            if (raw !== '') g[colName(c) + (r + 1)] = { raw, dirty: true };
          });
        });
        return g;
      }
      function toCSV() {
        const out = [];
        for (let r = 1; r <= ROWS; r++) {
          const row = [];
          let any = false;
          for (let c = 0; c < COLS; c++) { const ref = colName(c) + r; const cell = grid[ref]; if (cell) { any = true; row.push(typeof cell.raw === 'string' && cell.raw[0] === '=' ? '"' + cell.raw.replace(/"/g, '""') + '"' : String(cell.raw == null ? '' : cell.raw)); } else row.push(''); }
          if (any) out.push(row.join(','));
        }
        return out.join('\n');
      }

      const fx = H('div', { class: 'sh-fx', html: '<span class="muted">' + LX.icon('type', 14) + '</span>' });
      const fxRef = H('b', { class: 'sh-ref', text: 'A1' });
      const fxIn = H('input', { class: 'input grow sh-fx-in', placeholder: 'Value or =SUM(B2:B5)' });
      fx.append(fxRef, fxIn);
      const wrap = H('div', { class: 'sh-grid-wrap scroll' });
      let sel = 'A1';

      function cellVal(ref) {
        const cell = grid[ref];
        if (!cell) return '';
        const v = evalCell(ref, grid);
        return typeof v === 'number' ? (Math.round(v * 100) / 100).toString() : String(v);
      }
      function paint() {
        wrap.innerHTML = '';
        const table = H('div', { class: 'sh-table', style: { gridTemplateColumns: '34px repeat(' + COLS + ', minmax(64px, 1fr))' } });
        table.appendChild(H('span', { class: 'sh-hc' }));
        for (let c = 0; c < COLS; c++) table.appendChild(H('span', { class: 'sh-hc', text: colName(c) }));
        for (let r = 1; r <= ROWS; r++) {
          table.appendChild(H('span', { class: 'sh-hc', text: r }));
          for (let c = 0; c < COLS; c++) {
            const ref = colName(c) + r;
            const v = cellVal(ref);
            const el = H('div', { class: 'sh-cell' + (ref === sel ? ' sel' : '') + (bold.has(ref) ? ' b' : '') + (/^#/.test(v) ? ' err' : '') + (typeof evalCell(ref, grid) === 'number' ? ' num' : ''), dataset: { ref }, onclick: () => select(ref) }, H('span', { class: 'sh-cell-v ellipsis', text: v }));
            table.appendChild(el);
          }
        }
        wrap.appendChild(table);
      }
      function select(ref) {
        sel = ref;
        const cell = grid[ref];
        fxRef.textContent = ref;
        fxIn.value = cell ? String(cell.raw == null ? '' : cell.raw) : '';
        paint();
        setTimeout(() => fxIn.focus(), 20);
      }
      fxIn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          let v = fxIn.value.trim();
          if (v !== '') { if (!isNaN(+v) && !/^0\d/.test(v)) v = +v; }
          if (v === '') delete grid[sel]; else grid[sel] = { raw: v, dirty: true };
          // invalidate dependents (simple: all)
          Object.keys(grid).forEach((k) => { grid[k].dirty = true; grid[k].cached = null; });
          save(); paint(); move(1);
        }
      });
      function move(dr) {
        const m = /^([A-L])(\d{1,2})$/.exec(sel); if (!m) return;
        const r = Math.min(ROWS, Math.max(1, +m[2] + dr));
        select(m[1] + r);
      }
      wrap.addEventListener('click', (e) => { const c = e.target.closest('.sh-cell'); if (c) select(c.dataset.ref); });

      win.body.append(
        H('div', { class: 'toolbar' },
          H('button', { class: 'btn sm', html: LX.icon('bold', 13), title: 'Bold', onclick: () => { bold.has(sel) ? bold.delete(sel) : bold.add(sel); LX.store.set('app.sheets.bold', [...bold]); paint(); } }),
          H('button', { class: 'btn sm', html: LX.icon('save', 13) + ' Save CSV', onclick: () => LX.dialog.saveFile({ title: 'Save spreadsheet', path: '/home/user/Documents', name: 'sheet.csv' }).then((p) => { if (p) { LX.vfs.write(p, toCSV()); LX.notify({ title: 'Saved', body: p, icon: 'save' }); } }) }),
          H('button', { class: 'btn sm', html: LX.icon('upload', 13) + ' Open CSV', onclick: () => LX.dialog.openFile({ title: 'Open CSV', path: '/home/user/Documents', exts: ['csv'] }).then((p) => { if (p) { grid = fromCSV(LX.vfs.read(p)); bold.clear(); select('A1'); } }) }),
          H('button', { class: 'btn sm ghost', html: LX.icon('trash', 13), title: 'Clear all', onclick: async () => { if (await LX.dialog.confirm('Clear the entire sheet?', 'Clear')) { grid = {}; bold.clear(); save(); paint(); } } }),
          H('span', { class: 'grow' }),
          H('span', { class: 'muted', style: { fontSize: '11.5px' }, text: 'Try =SUM(B2:B5) · =AVG(D2:D5) · =B2*1.2' })),
        fx, wrap);
      select('A1');
    },
  });
})();
