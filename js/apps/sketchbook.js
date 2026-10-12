/* Store app — Sketchbook: pressure-style brushes + kaleidoscope symmetry drawing. */
(function () {
  'use strict';
  const H = LX.h;

  LX.apps.register({
    id: 'sketchbook', name: 'Sketchbook', icon: 'brush', color: '#94E2D5', category: 'Media',
    pkg: true, pkgVersion: '1.2', pkgSize: 18, developer: 'PrideWorks', downloads: 1360,
    desc: 'Draw with symmetry and expressive brushes', longDesc: 'An infinite-feel canvas with velocity-based ink brushes, marker and spray modes, and a kaleidoscope that mirrors every stroke into 6, 8 or 12 segments. Saves PNG artwork straight to Pictures.',
    permissions: ['Local storage'], changelog: 'Symmetry engine rewritten — buttery smooth.',
    width: 940, height: 660, minWidth: 520, minHeight: 440,
    open(win) {
      const COLORS = ['#e8eaf0', '#0b0d13', '#F28B82', '#F6C177', '#9ECE6A', '#5B9DFA', '#CBA6F7', '#FF8A65', '#4DD0E1'];
      let color = '#5B9DFA', size = 6, tool = 'ink', sym = 1;
      const canvas = H('canvas', { class: 'sb-canvas' });
      const ctx = canvas.getContext('2d');
      let drawing = false, last = null, lastSpeed = 0;
      const undoStack = [];

      function resize() {
        const r = canvas.parentElement.getBoundingClientRect();
        const img = canvas.width ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
        canvas.width = Math.max(100, r.width); canvas.height = Math.max(100, r.height);
        ctx.fillStyle = '#101319';
        if (img && img.width === canvas.width && img.height === canvas.height) ctx.putImageData(img, 0, 0);
        else { ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      }
      function snap() { undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); if (undoStack.length > 10) undoStack.shift(); }
      function undo() { const im = undoStack.pop(); if (im) ctx.putImageData(im, 0, 0); }

      function pt(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; }
      function strokeSeg(a, b) {
        const speed = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, b.t - a.t); // px/ms
        lastSpeed = lastSpeed * 0.7 + speed * 0.3;
        const dyn = tool === 'ink' ? LX.clamp(size * (1.6 - lastSpeed * 0.5), 1.5, size * 2.2) : size;
        for (let s = 0; s < sym; s++) {
          const ang = (Math.PI * 2 / sym) * s;
          const cx = canvas.width / 2, cy = canvas.height / 2;
          const rot = (p) => {
            const dx = p.x - cx, dy = p.y - cy;
            const c = Math.cos(ang), sn = Math.sin(ang);
            return { x: cx + dx * c - dy * sn, y: cy + dx * sn + dy * c };
          };
          const ra = rot(a), rb = rot(b);
          if (tool === 'spray') {
            ctx.fillStyle = color + 'cc';
            for (let i = 0; i < 14; i++) {
              const t = Math.random();
              const x = ra.x + (rb.x - ra.x) * t + (Math.random() - .5) * size * 2.4;
              const y = ra.y + (rb.y - ra.y) * t + (Math.random() - .5) * size * 2.4;
              ctx.beginPath(); ctx.arc(x, y, Math.random() * dyn * .4 + .4, 0, 7); ctx.fill();
            }
          } else if (tool === 'marker') {
            ctx.strokeStyle = color + 'b3'; ctx.lineWidth = dyn * 1.8;
            ctx.beginPath(); ctx.moveTo(ra.x, ra.y); ctx.lineTo(rb.x, rb.y); ctx.stroke();
          } else { // ink
            ctx.strokeStyle = color; ctx.lineWidth = dyn;
            ctx.globalAlpha = 0.92;
            ctx.beginPath(); ctx.moveTo(ra.x, ra.y);
            ctx.quadraticCurveTo(ra.x, ra.y, (ra.x + rb.x) / 2, (ra.y + rb.y) / 2);
            ctx.lineTo(rb.x, rb.y); ctx.stroke();
            ctx.globalAlpha = 1;
          }
          // mirrored twin for even kaleidoscopes
          if (sym > 1) {
            const ma = { x: cx - (ra.x - cx), y: ra.y }, mb = { x: cx - (rb.x - cx), y: rb.y };
            if (tool !== 'spray') { ctx.strokeStyle = tool === 'marker' ? color + 'b3' : color; ctx.lineWidth = tool === 'marker' ? dyn * 1.8 : dyn; ctx.beginPath(); ctx.moveTo(ma.x, ma.y); ctx.lineTo(mb.x, mb.y); ctx.stroke(); }
          }
        }
      }
      canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        drawing = true; snap(); last = pt(e); lastSpeed = 0.3;
        try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
        strokeSeg(last, { x: last.x + .1, y: last.y + .1, t: last.t + 1 });
      });
      canvas.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pt(e); strokeSeg(last, p); last = p; });
      canvas.addEventListener('pointerup', () => { drawing = false; });
      canvas.addEventListener('pointercancel', () => { drawing = false; });

      const tools = [['ink', 'brush'], ['marker', 'edit'], ['spray', 'cloud'], ['eraser', 'eraser']].map((tl) =>
        H('button', { class: 'btn sm sb-tool' + (tool === tl[0] ? ' primary' : ''), html: LX.icon(tl[1], 14) + ' ' + tl[0][0].toUpperCase() + tl[0].slice(1), onclick: () => { tool = tl[0]; paintTools(); } }));
      function paintTools() { tools.forEach((b, i) => { const tl = [['ink', 'brush'], ['marker', 'edit'], ['spray', 'cloud'], ['eraser', 'eraser']][i]; b.classList.toggle('primary', tool === tl[0]); }); }

      const sizeSlider = H('input', { type: 'range', class: 'slider sb-size', min: 2, max: 26, value: size, oninput: () => { size = +sizeSlider.value; } });
      const symBtns = [1, 6, 8, 12].map((n) => H('button', { class: 'btn sm' + (sym === n ? ' primary' : ''), text: n === 1 ? 'Off' : '×' + n, title: 'Kaleidoscope ' + (n === 1 ? 'off' : n + ' segments'), onclick: () => { sym = n; symBtns.forEach((b, i) => b.classList.toggle('primary', [1, 6, 8, 12][i] === sym)); } }));
      const swatches = H('div', { class: 'sb-swatches' }, COLORS.map((c) => H('button', { class: 'sb-sw' + (c === color ? ' on' : ''), style: { background: c }, onclick: () => { color = c; paintSw(); } })));
      function paintSw() { LX.$$('.sb-sw', win.body).forEach((b) => b.classList.toggle('on', b.style.background && rgbEq(b.style.background, color))); }
      function rgbEq(styleBg, hex) { // style.background returns rgb(...) — compare loosely by hue order
        return styleBg.replace(/\s/g, '').toLowerCase() === ('rgb(' + hex2rgbStr(hex) + ')').toLowerCase();
      }
      function hex2rgbStr(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', '); }

      win.body.append(
        H('div', { class: 'toolbar sb-top' },
          H('div', { class: 'row gap' }, tools),
          H('span', { class: 'muted', style: { fontSize: '11px' }, text: 'size' }), sizeSlider,
          H('span', { class: 'muted', style: { fontSize: '11px' }, text: 'symmetry' }, ...symBtns),
          H('span', { class: 'grow' }),
          H('button', { class: 'btn sm ghost', html: LX.icon('undo', 13) + ' Undo', onclick: undo }),
          H('button', { class: 'btn sm ghost', html: LX.icon('trash', 13), title: 'Clear', onclick: () => { snap(); ctx.fillStyle = '#101319'; ctx.fillRect(0, 0, canvas.width, canvas.height); } }),
          H('button', { class: 'btn sm primary', html: LX.icon('save', 13) + ' Save to Pictures', onclick: () => {
            const name = 'Sketch ' + LX.fmtTime(Date.now()).replace(/:/g, '') + '.png';
            const p = LX.vfs.join('/home/user/Pictures', LX.vfs.uniqueName('/home/user/Pictures', name));
            LX.vfs.write(p, canvas.toDataURL('image/png'), { mime: 'image/png' });
            LX.notify({ title: 'Artwork saved', body: p, icon: 'image' });
          } })),
        swatches,
        H('div', { class: 'sb-wrap' }, canvas));
      setTimeout(resize, 30);
      new ResizeObserver(LX.debounce(resize, 150)).observe(canvas.parentElement);
    },
  });
})();
