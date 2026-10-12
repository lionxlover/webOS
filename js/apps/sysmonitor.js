/* Leonux Web OS — System Monitor: live simulated CPU / memory / disk / network graphs */
(function () {
  'use strict';
  const H = LX.h;
  const N = 60;            // samples kept (seconds of history)
  const STEP = 1000;       // ms between samples

  // smooth random walk
  function walker(start, min, max, vol) {
    let v = start, target = start;
    return () => {
      if (Math.random() < 0.15) target = min + Math.random() * (max - min);
      v += (target - v) * 0.3 + (Math.random() - 0.5) * vol;
      return LX.clamp(v, min, max);
    };
  }
  function cssVar(el, n, d) { const v = getComputedStyle(el).getPropertyValue(n).trim(); return v || d; }
  function rate(b) { return LX.fmtBytes(b) + '/s'; }

  LX.apps.register({
    id: 'sysmonitor', name: 'System Monitor', icon: 'activity', color: '#A6E3A1', category: 'System', desc: 'Live CPU, memory, disk and network graphs', singleton: true, width: 820, height: 600, minWidth: 380, minHeight: 320,
    open(win) {
      const cores = navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 16) : 4;
      const body = win.body;
      const gens = {
        cpu: walker(18, 3, 85, 8), mem: walker(46, 35, 70, 1.2), dr: walker(8, 0, 90, 20), dw: walker(4, 0, 60, 14), nd: walker(30, 1, 100, 25), nu: walker(8, 0, 40, 8),
      };
      const coreG = Array.from({ length: cores }, () => walker(20, 2, 95, 20));
      const hist = { cpu: [], mem: [], dr: [], dw: [], nd: [], nu: [] };
      let coreVals = coreG.map((g) => g());
      const seed = () => { for (let i = 0; i < N + 2; i++) Object.keys(hist).forEach((k) => hist[k].push(gens[k]())); };
      seed();
      let lastSample = performance.now();

      const cards = {};
      function mkCard(key, title, icon, legend) {
        const val = H('div', { class: 'sm-val' }), sub = H('div', { class: 'sm-sub' });
        const cv = H('canvas', { class: 'sm-cv', 'aria-label': title + ' graph' });
        const extra = key === 'cpu' ? H('div', { class: 'sm-cores' }, coreG.map(() => H('i'))) : null;
        const el = H('div', { class: 'card sm-card' },
          H('div', { class: 'sm-head' }, H('div', { class: 'sm-title', html: LX.icon(icon, 15) + '<span>' + title + '</span>' }), val),
          H('div', { class: 'sm-cvwrap' }, cv), extra,
          legend ? H('div', { class: 'sm-legend' }, legend.map((l) => H('span', { html: '<i class="sm-dot" style="background:' + l[1] + '"></i>' + l[0] }))) : null, sub);
        cards[key] = { el, val, sub, cv, extra, g: cv.getContext('2d'), w: 0, h: 0 };
        return el;
      }
      const C = { a: '#5B9DFA', b: '#CBA6F7', c: '#9ECE6A', d: '#F6C177' };
      const grid = H('div', { class: 'sm-grid scroll' },
        mkCard('cpu', 'CPU', 'cpu'), mkCard('mem', 'Memory', 'layers'),
        mkCard('disk', 'Disk', 'hard-drive', [['Read', C.c], ['Write', C.d]]), mkCard('net', 'Network', 'wifi', [['Download', C.a], ['Upload', C.b]]));
      body.append(grid);

      function size(c) {
        const r = c.cv.parentElement.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
        if (c.w !== w || c.h !== h || c.dpr !== dpr) { c.w = w; c.h = h; c.dpr = dpr; c.cv.width = w * dpr; c.cv.height = h * dpr; }
      }
      // series: array of {data, color, max?}
      function plot(c, series, max, frac, fmtAxis) {
        size(c); const g = c.g, w = c.w, h = c.h;
        g.setTransform(c.dpr, 0, 0, c.dpr, 0, 0); g.clearRect(0, 0, w, h);
        g.strokeStyle = cssVar(c.cv, '--border', 'rgba(255,255,255,.08)'); g.lineWidth = 1;
        g.beginPath(); for (let i = 1; i < 4; i++) { const y = Math.round(h * i / 4) + .5; g.moveTo(0, y); g.lineTo(w, y); } g.stroke();
        g.fillStyle = cssVar(c.cv, '--text-faint', '#667'); g.font = '10px sans-serif'; g.textBaseline = 'top';
        g.fillText(fmtAxis(max), 6, 4); 
        series.forEach((s) => {
          const d = s.data, n = d.length, pts = [];
          // x scrolls left by frac of one step so motion is continuous
          const sx = w / (N - 1);
          for (let i = 0; i < n; i++) pts.push([(i - frac - (n - N - 1)) * sx, h - 3 - LX.clamp(d[i] / max, 0, 1) * (h - 8)]);
          g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) { const p0 = pts[i - 1], p1 = pts[i], mx = (p0[0] + p1[0]) / 2; g.bezierCurveTo(mx, p0[1], mx, p1[1], p1[0], p1[1]); }
          g.strokeStyle = s.color; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
          g.lineTo(pts[pts.length - 1][0], h); g.lineTo(pts[0][0], h); g.closePath();
          const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, s.color + '55'); grad.addColorStop(1, s.color + '05'); g.fillStyle = grad; g.fill();
        });
      }
      const last = (a) => a[a.length - 1];
      function text() {
        const used = last(hist.mem) / 100 * 8192;
        cards.cpu.val.textContent = last(hist.cpu).toFixed(0) + '%';
        cards.cpu.sub.textContent = cores + ' cores · ' + (2.4 + last(hist.cpu) / 100 * 1.6).toFixed(2) + ' GHz · ' + LX.proc.list().length + ' processes';
        coreVals.forEach((v, i) => { cards.cpu.extra.children[i].style.height = Math.max(2, v / 100 * 22) + 'px'; });
        cards.mem.val.textContent = last(hist.mem).toFixed(0) + '%';
        cards.mem.sub.textContent = (used / 1024).toFixed(1) + ' GB used of 8.0 GB · ' + ((8192 - used) / 1024).toFixed(1) + ' GB free';
        cards.disk.val.textContent = (last(hist.dr) + last(hist.dw)).toFixed(0) + ' MB/s';
        let u = { used: 0, total: 1 }; try { u = LX.vfs.usage(); } catch (e) { /* ignore */ }
        cards.disk.sub.textContent = 'Read ' + last(hist.dr).toFixed(1) + ' · Write ' + last(hist.dw).toFixed(1) + ' MB/s · Volume ' + LX.fmtBytes(u.used) + ' / ' + LX.fmtBytes(u.total);
        const online = LX.network ? LX.network.online : true;
        cards.net.val.textContent = online ? last(hist.nd).toFixed(0) + ' Mbps' : 'Offline';
        cards.net.sub.textContent = '↓ ' + rate(last(hist.nd) * 125000) + ' · ↑ ' + rate(last(hist.nu) * 125000) + (LX.network && LX.network.ssid ? ' · ' + LX.network.ssid : '');
      }
      function sample() {
        Object.keys(hist).forEach((k) => { hist[k].push(gens[k]()); if (hist[k].length > N + 2) hist[k].shift(); });
        coreVals = coreG.map((g) => g()); text();
      }
      function frame(now) {
        const frac = LX.clamp((now - lastSample) / STEP, 0, 1);
        plot(cards.cpu, [{ data: hist.cpu, color: C.a }], 100, frac, (m) => m + '%');
        plot(cards.mem, [{ data: hist.mem, color: C.b }], 100, frac, (m) => m + '%');
        plot(cards.disk, [{ data: hist.dr, color: C.c }, { data: hist.dw, color: C.d }], 100, frac, (m) => m + ' MB/s');
        plot(cards.net, [{ data: hist.nd, color: C.a }, { data: hist.nu, color: C.b }], 100, frac, (m) => m + ' Mbps');
      }
      let raf = 0, timer = 0, dead = false;
      const loop = (now) => {
        if (dead) return;
        if (now - lastSample >= STEP) { lastSample += STEP * Math.floor((now - lastSample) / STEP); sample(); }
        frame(now); raf = requestAnimationFrame(loop);
      };
      const ro = new ResizeObserver(() => { if (!dead) frame(performance.now()); });
      ro.observe(grid);
      sample(); lastSample = performance.now();
      raf = requestAnimationFrame(loop);
      win.onClose(() => { dead = true; cancelAnimationFrame(raf); clearTimeout(timer); ro.disconnect(); });
    },
  });
})();
