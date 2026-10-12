/* Leonux Web OS — Task Manager: processes, windows and a quick performance summary */
(function () {
  'use strict';
  const H = LX.h;
  LX.apps.register({
    id: 'taskmanager', name: 'Task Manager', icon: 'activity', color: '#F28B82', category: 'System', desc: 'Monitor and end running applications', singleton: true, width: 760, height: 520, minWidth: 460, minHeight: 320,
    open(win) {
      const body = win.body; let tab = 'proc', sortKey = 'cpu', sortDir = -1, sel = null, q = '';
      const hist = { cpu: [], mem: [] };
      const search = H('input', { class: 'input tm-search', placeholder: 'Filter…', 'aria-label': 'Filter', oninput: (e) => { q = e.target.value.toLowerCase(); draw(); } });
      const endBtn = H('button', { class: 'btn danger sm', html: LX.icon('x', 13) + ' End task', onclick: () => endSel() });
      const tabs = H('div', { class: 'tabs tm-tabs' },
        ['proc:Processes', 'win:Windows', 'perf:Performance'].map((t) => { const [id, l] = t.split(':'); return H('div', { class: 'tab' + (id === tab ? ' active' : ''), dataset: { t: id }, text: l, onclick: () => { tab = id; LX.$$('.tab', tabs).forEach((x) => x.classList.toggle('active', x.dataset.t === tab)); draw(); } }); }));
      const sum = H('div', { class: 'tm-sum muted' });
      const main = H('div', { class: 'tm-main scroll' });
      body.append(H('div', { class: 'toolbar' }, search, H('div', { class: 'grow' }), sum, endBtn), tabs, main);
      body.tabIndex = 0;

      function procs() { return LX.proc.list().filter((p) => !q || (p.name + ' ' + p.title).toLowerCase().indexOf(q) >= 0).sort((a, b) => { const x = a[sortKey], y = b[sortKey]; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sortDir; }); }
      function endSel() { if (sel == null) return; const p = LX.proc.list().find((x) => x.pid === sel); if (p && p.appId === 'taskmanager' && LX.proc.list().filter((x) => x.appId === 'taskmanager').length === 1) { win.close(); return; } LX.proc.kill(sel); sel = null; draw(); }
      function bar(v, max, cls) { return H('div', { class: 'tm-bar ' + (cls || '') }, H('div', { style: { width: LX.clamp(v / max * 100, 1, 100) + '%' } }), H('span', { text: cls === 'mem' ? v + ' MB' : v.toFixed(1) + '%' })); }
      function ctx(e, p) { e.preventDefault(); sel = p.pid; draw(); LX.menu.show(e.clientX, e.clientY, [{ label: 'Switch to', icon: 'monitor', action: () => { const w = LX.wm.get(p.winId); if (w) w.focus(); } }, { separator: true }, { label: 'End task', icon: 'x', action: endSel }]); }
      function drawProc() {
        const list = procs();
        const th = (k, l, cls) => H('th', { class: cls || '', onclick: () => { if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'name' ? 1 : -1; } draw(); } }, l, sortKey === k ? H('span', { class: 'tm-arrow', html: LX.icon(sortDir > 0 ? 'chevron-up' : 'chevron-down', 12) }) : null);
        const t = H('table', { class: 'tm-table' }, H('thead', {}, H('tr', {}, th('name', 'Name'), th('pid', 'PID', 'num'), th('cpu', 'CPU'), th('mem', 'Memory'), th('started', 'Uptime', 'num'))));
        const tb = H('tbody');
        list.forEach((p) => {
          const a = LX.apps.get(p.appId) || {};
          const up = Math.floor((Date.now() - p.started) / 1000);
          tb.appendChild(H('tr', { class: sel === p.pid ? 'sel' : '', onclick: () => { sel = p.pid; draw(); }, ondblclick: () => { const w = LX.wm.get(p.winId); if (w) w.focus(); }, oncontextmenu: (e) => ctx(e, p) },
            H('td', {}, H('div', { class: 'tm-name' }, H('span', { class: 'tm-ico', style: { background: a.color || 'var(--accent)' }, html: LX.icon(a.icon || 'package', 13) }), H('div', { class: 'ellipsis' }, H('b', { text: p.name }), H('span', { class: 'muted', text: ' ' + (p.title !== p.name ? p.title : '') })))),
            H('td', { class: 'num muted', text: p.pid }), H('td', {}, bar(p.cpu, 40)), H('td', {}, bar(p.mem, 600, 'mem')),
            H('td', { class: 'num muted', text: Math.floor(up / 60) + 'm ' + LX.pad(up % 60) + 's' })));
        });
        t.appendChild(tb); main.appendChild(t);
        if (!list.length) main.appendChild(H('div', { class: 'tm-empty muted', text: q ? 'No matching processes.' : 'No applications are running.' }));
      }
      function drawWin() {
        const ws = LX.wm.list().filter((w) => !q || w.title.toLowerCase().indexOf(q) >= 0);
        const l = H('div', { class: 'list tm-wins' });
        ws.forEach((w) => l.appendChild(H('div', { class: 'list-item' + (w.isFocused() ? ' active' : ''), onclick: () => w.focus() },
          H('span', { html: LX.icon(w.icon, 18) }), H('div', { class: 'grow' }, H('div', { class: 'ellipsis', text: w.title }), H('div', { class: 'muted tm-sub', text: w.appId + ' · ' + w.el.offsetWidth + '×' + w.el.offsetHeight + (w.minimized ? ' · minimised' : '') + (w.maximized ? ' · maximised' : '') })),
          H('button', { class: 'btn sm ghost', text: w.minimized ? 'Restore' : 'Minimise', onclick: (e) => { e.stopPropagation(); w.minimized ? w.restore() : w.minimize(); } }),
          H('button', { class: 'btn sm danger', text: 'Close', onclick: (e) => { e.stopPropagation(); w.close(); } }))));
        main.appendChild(l);
        if (!ws.length) main.appendChild(H('div', { class: 'tm-empty muted', text: 'No open windows.' }));
      }
      function drawPerf() {
        const mk = (label, key, color, val) => { const cv = H('canvas', { class: 'tm-cv', width: 560, height: 120 }); setTimeout(() => spark(cv, hist[key], color), 0); return H('div', { class: 'card tm-perf' }, H('div', { class: 'row' }, H('b', { class: 'grow', text: label }), H('span', { class: 'muted', text: val })), cv); };
        const ps = LX.proc.list(); const cpu = ps.reduce((s, p) => s + p.cpu, 0), mem = ps.reduce((s, p) => s + p.mem, 0);
        main.append(mk('CPU', 'cpu', '#5B9DFA', Math.min(100, 4 + cpu).toFixed(0) + '%'), mk('Memory', 'mem', '#CBA6F7', (mem + 900) + ' MB of 8192 MB'),
          H('div', { class: 'card tm-perf muted', text: ps.length + ' processes · ' + LX.wm.list().filter((w) => w.minimized).length + ' minimised · Up since ' + LX.fmtTime(performance.timeOrigin, true) }));
      }
      function spark(cv, data, color) {
        const g = cv.getContext('2d'), w = cv.width, h = cv.height;
        g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(128,128,150,.2)'; g.lineWidth = 1;
        for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, h * i / 4); g.lineTo(w, h * i / 4); g.stroke(); }
        if (data.length < 2) return;
        g.beginPath(); data.forEach((v, i) => { const x = i / 59 * w, y = h - v / 100 * h; i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.strokeStyle = color; g.lineWidth = 2; g.stroke(); g.lineTo((data.length - 1) / 59 * w, h); g.lineTo(0, h); g.fillStyle = color + '33'; g.fill();
      }
      function sample() {
        const ps = LX.proc.list(); const cpu = Math.min(100, 4 + ps.reduce((s, p) => s + p.cpu, 0)), mem = (ps.reduce((s, p) => s + p.mem, 0) + 900) / 8192 * 100;
        hist.cpu.push(cpu); hist.mem.push(mem); ['cpu', 'mem'].forEach((k) => { if (hist[k].length > 60) hist[k].shift(); });
        return { cpu, mem };
      }
      function draw() {
        const st = main.scrollTop; main.innerHTML = '';
        const s = hist.cpu.length ? { cpu: hist.cpu[hist.cpu.length - 1], mem: hist.mem[hist.mem.length - 1] } : sample();
        sum.textContent = 'CPU ' + s.cpu.toFixed(0) + '% · Mem ' + s.mem.toFixed(0) + '%';
        endBtn.disabled = tab !== 'proc' || sel == null;
        if (tab === 'proc') drawProc(); else if (tab === 'win') drawWin(); else drawPerf();
        main.scrollTop = st;
      }
      const offs = [LX.bus.on('proc:change', () => { sample(); draw(); }), LX.bus.on('wm:change', LX.debounce(draw, 60))];
      body.addEventListener('keydown', (e) => { if (e.key === 'Delete' && tab === 'proc' && document.activeElement !== search) endSel(); });
      win.setMenu([{ label: 'Task', items: [{ label: 'End task', shortcut: 'Del', action: endSel }, { separator: true }, { label: 'Close', action: () => win.close() }] }, { label: 'View', items: [{ label: 'Processes', action: () => LX.$('[data-t=proc]', tabs).click() }, { label: 'Windows', action: () => LX.$('[data-t=win]', tabs).click() }, { label: 'Performance', action: () => LX.$('[data-t=perf]', tabs).click() }] }]);
      win.onClose(() => offs.forEach((o) => o()));
      for (let i = 0; i < 20; i++) sample();
      draw();
    },
  });
})();
