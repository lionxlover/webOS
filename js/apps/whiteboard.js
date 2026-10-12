/* Leonux Whiteboard — infinite pan/zoom canvas: pen, highlighter, shapes, arrows, text, sticky notes. */
(function () {
  'use strict';
  const H = LX.h;
  const KEY = 'app.whiteboard.autosave';
  const COLORS = ['auto', '#F28B82', '#F6C177', '#FFE066', '#9ECE6A', '#4DD0E1', '#5B9DFA', '#CBA6F7', '#F48FB1'];
  const TOOLS = [
    ['select', 'Select (V)', 'mouse'], ['hand', 'Pan (H)', 'move'], ['pen', 'Pen (P)', 'pencil'], ['hl', 'Highlighter (L)', 'brush'],
    ['rect', 'Rectangle (R)', 'maximize'], ['ellipse', 'Ellipse (O)', 'record'], ['line', 'Line (N)', 'minus'], ['arrow', 'Arrow (A)', 'arrow-right'],
    ['text', 'Text (T)', 'type'], ['sticky', 'Sticky note (S)', 'sticky'], ['eraser', 'Eraser (E)', 'eraser'],
  ];
  const KEYS = { v: 'select', h: 'hand', p: 'pen', l: 'hl', r: 'rect', o: 'ellipse', n: 'line', a: 'arrow', t: 'text', s: 'sticky', e: 'eraser' };

  function bbox(o, ctx) {
    if (o.t === 'pen' || o.t === 'hl') { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; o.pts.forEach((p) => { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); }); return { x: a, y: b, w: c - a, h: d - b }; }
    if (o.t === 'text') { const L = String(o.s).split('\n'); ctx.font = '600 ' + o.size + 'px sans-serif'; let w = 0; L.forEach((l) => { w = Math.max(w, ctx.measureText(l).width); }); return { x: o.x, y: o.y, w: Math.max(w, 10), h: L.length * o.size * 1.25 }; }
    if (o.t === 'sticky') return { x: o.x, y: o.y, w: o.w, h: o.h };
    return { x: Math.min(o.x1, o.x2), y: Math.min(o.y1, o.y2), w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) };
  }
  function xform(o, fx, fy) { // map every point of o through fx/fy (used by move & resize)
    if (o.pts) o.pts = o.pts.map((p) => [fx(p[0]), fy(p[1])]);
    else if (o.t === 'sticky') { const x2 = fx(o.x + o.w), y2 = fy(o.y + o.h); o.x = fx(o.x); o.y = fy(o.y); o.w = Math.max(40, x2 - o.x); o.h = Math.max(40, y2 - o.y); }
    else if (o.t === 'text') { const ny = fy(o.y + o.size * 1.25), oy = fy(o.y); o.size = Math.max(6, o.size * Math.abs((ny - oy) / (o.size * 1.25)) || o.size); o.x = fx(o.x); o.y = oy; }
    else { o.x1 = fx(o.x1); o.x2 = fx(o.x2); o.y1 = fy(o.y1); o.y2 = fy(o.y2); }
  }
  function distSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }

  LX.apps.register({
    id: 'whiteboard', name: 'Whiteboard', icon: 'edit', color: '#F28B82', category: 'Productivity',
    desc: 'Infinite canvas for sketches, diagrams and notes', width: 1000, height: 660, minWidth: 480, minHeight: 360,
    open(win, args) {
      let board = { v: 1, view: { x: 0, y: 0, z: 1 }, objs: [] };
      let tool = 'pen', color = 'auto', width = 3, sel = [], file = null, dirty = false;
      let undo = [], redo = [], cur = null, mode = null, panning = false, spaceDown = false, editor = null;
      const canvas = H('canvas', { class: 'wb-canvas' });
      const ctx = canvas.getContext('2d');
      const stage = H('div', { class: 'wb-stage' }, canvas);
      const toolEls = {};
      const toolbar = H('div', { class: 'wb-tools' }, TOOLS.map((t) => (toolEls[t[0]] = H('button', { class: 'wb-tool', title: t[1], html: LX.icon(t[2], 18), onclick: () => setTool(t[0]) }))));
      const swatches = H('div', { class: 'wb-sw' }, COLORS.map((c) => H('button', { class: 'wb-swatch' + (c === color ? ' on' : ''), dataset: { c }, title: c === 'auto' ? 'Auto (theme)' : c, style: c === 'auto' ? { background: 'linear-gradient(135deg,#fff 50%,#111 50%)' } : { background: c }, onclick: () => setColor(c) })));
      const wSlider = H('input', { type: 'range', class: 'slider', min: 1, max: 24, value: width, title: 'Stroke width', oninput: () => { width = +wSlider.value; if (sel.length) applySel((o) => { if (o.w !== undefined && o.t !== 'sticky') o.w = width; if (o.t === 'text') o.size = 12 + width * 2; }); } });
      const zoomLbl = H('span', { class: 'wb-zoom muted', text: '100%' });
      const btn = (ic, title, fn) => H('button', { class: 'btn icon sm ghost', title, html: LX.icon(ic, 16), onclick: fn });
      const undoB = btn('undo', 'Undo (Ctrl+Z)', () => doUndo()), redoB = btn('redo', 'Redo (Ctrl+Shift+Z)', () => doRedo());
      const top = H('div', { class: 'toolbar wb-top' }, swatches, wSlider, H('span', { class: 'grow' }), undoB, redoB, btn('zoom-out', 'Zoom out', () => zoomBy(1 / 1.25)), zoomLbl, btn('zoom-in', 'Zoom in', () => zoomBy(1.25)), btn('maximize', 'Fit content', fit));
      const hint = H('div', { class: 'wb-hint muted' });
      win.body.append(top, H('div', { class: 'wb-row' }, toolbar, stage), hint);
      win.body.tabIndex = 0;

      const css = () => getComputedStyle(win.body);
      const resolve = (c, exp) => (c === 'auto' ? (exp ? '#111' : css().color) : c);
      function setTool(t) { tool = t; commitEditor(); Object.keys(toolEls).forEach((k) => toolEls[k].classList.toggle('on', k === t)); stage.dataset.tool = t; hint.textContent = { select: 'Click to select, drag to move/marquee, Delete to remove. Double-click text or a note to edit.', hand: 'Drag to pan. Wheel to zoom. Hold Space with any tool to pan.', text: 'Click anywhere to type. Ctrl+Enter or click away to finish.', sticky: 'Click to drop a sticky note.', eraser: 'Click or drag over objects to erase them.' }[t] || 'Drag to draw. Wheel zooms, Space+drag pans.'; if (t !== 'select') { sel = []; } draw(); }
      function setColor(c) { color = c; LX.$$('.wb-swatch', swatches).forEach((s) => s.classList.toggle('on', s.dataset.c === c)); if (sel.length) applySel((o) => { if (o.t === 'sticky') o.c = c === 'auto' ? '#FFE066' : c; else o.c = c; }); }
      function applySel(fn) { snap(); sel.forEach(fn); touch(); draw(); }

      // ---- history / persistence
      const clone = () => JSON.stringify(board.objs);
      function snap() { undo.push(clone()); if (undo.length > 120) undo.shift(); redo = []; syncUR(); }
      function doUndo() { commitEditor(); if (!undo.length) return; redo.push(clone()); board.objs = JSON.parse(undo.pop()); sel = []; touch(); syncUR(); draw(); }
      function doRedo() { commitEditor(); if (!redo.length) return; undo.push(clone()); board.objs = JSON.parse(redo.pop()); sel = []; touch(); syncUR(); draw(); }
      function syncUR() { undoB.disabled = !undo.length; redoB.disabled = !redo.length; }
      const autosave = LX.debounce(() => { if (!file) LX.store.set(KEY, board); }, 400);
      function touch() { dirty = true; autosave(); title(); }
      function title() { win.setTitle((file ? LX.vfs.basename(file) : 'Untitled board') + (dirty && file ? ' •' : '') + ' - Whiteboard'); }

      // ---- coords
      const toW = (e) => { const r = canvas.getBoundingClientRect(), v = board.view; return [(e.clientX - r.left - v.x) / v.z, (e.clientY - r.top - v.y) / v.z]; };
      function resize() { const r = stage.getBoundingClientRect(), d = window.devicePixelRatio || 1; canvas.width = Math.max(1, r.width * d); canvas.height = Math.max(1, r.height * d); canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px'; draw(); }
      function zoomAt(cx, cy, f) { const v = board.view, nz = LX.clamp(v.z * f, 0.1, 6), r = nz / v.z; v.x = cx - (cx - v.x) * r; v.y = cy - (cy - v.y) * r; v.z = nz; draw(); }
      function zoomBy(f) { const r = canvas.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, f); }
      function fit() {
        if (!board.objs.length) { board.view = { x: 0, y: 0, z: 1 }; return draw(); }
        const b = union(board.objs), r = canvas.getBoundingClientRect(), pad = 60;
        const z = LX.clamp(Math.min((r.width - pad * 2) / Math.max(b.w, 1), (r.height - pad * 2) / Math.max(b.h, 1)), 0.1, 2);
        board.view = { z, x: (r.width - b.w * z) / 2 - b.x * z, y: (r.height - b.h * z) / 2 - b.y * z }; draw();
      }
      function union(os) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; os.forEach((o) => { const q = bbox(o, ctx); a = Math.min(a, q.x); b = Math.min(b, q.y); c = Math.max(c, q.x + q.w); d = Math.max(d, q.y + q.h); }); return { x: a, y: b, w: c - a, h: d - b }; }

      // ---- rendering
      function wrap(text, maxW) { const out = []; String(text).split('\n').forEach((para) => { let line = ''; para.split(' ').forEach((w) => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }); out.push(line); }); return out; }
      function drawObj(c, o, exp) {
        c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
        const col = resolve(o.c, exp);
        if (o.t === 'pen' || o.t === 'hl') {
          c.strokeStyle = col; c.lineWidth = o.t === 'hl' ? o.w * 4 : o.w; if (o.t === 'hl') { c.globalAlpha = 0.35; c.lineCap = 'butt'; }
          c.beginPath(); const p = o.pts; c.moveTo(p[0][0], p[0][1]);
          if (p.length < 3) c.lineTo(p[p.length - 1][0] + 0.01, p[p.length - 1][1]);
          else { for (let i = 1; i < p.length - 1; i++) c.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2); c.lineTo(p[p.length - 1][0], p[p.length - 1][1]); }
          c.stroke();
        } else if (o.t === 'rect') { c.strokeStyle = col; c.lineWidth = o.w; c.beginPath(); if (c.roundRect) c.roundRect(Math.min(o.x1, o.x2), Math.min(o.y1, o.y2), Math.abs(o.x2 - o.x1), Math.abs(o.y2 - o.y1), 6); else c.rect(Math.min(o.x1, o.x2), Math.min(o.y1, o.y2), Math.abs(o.x2 - o.x1), Math.abs(o.y2 - o.y1)); c.stroke(); }
        else if (o.t === 'ellipse') { c.strokeStyle = col; c.lineWidth = o.w; c.beginPath(); c.ellipse((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, Math.abs(o.x2 - o.x1) / 2 + 0.01, Math.abs(o.y2 - o.y1) / 2 + 0.01, 0, 0, 7); c.stroke(); }
        else if (o.t === 'line' || o.t === 'arrow') {
          c.strokeStyle = col; c.fillStyle = col; c.lineWidth = o.w; c.beginPath(); c.moveTo(o.x1, o.y1); c.lineTo(o.x2, o.y2); c.stroke();
          if (o.t === 'arrow') { const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1), L = 10 + o.w * 2.5; c.beginPath(); c.moveTo(o.x2, o.y2); c.lineTo(o.x2 - L * Math.cos(a - 0.45), o.y2 - L * Math.sin(a - 0.45)); c.lineTo(o.x2 - L * Math.cos(a + 0.45), o.y2 - L * Math.sin(a + 0.45)); c.closePath(); c.fill(); }
        } else if (o.t === 'text') { c.fillStyle = col; c.font = '600 ' + o.size + 'px sans-serif'; c.textBaseline = 'top'; String(o.s).split('\n').forEach((l, i) => c.fillText(l, o.x, o.y + i * o.size * 1.25)); }
        else if (o.t === 'sticky') {
          c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 12; c.shadowOffsetY = 4; c.fillStyle = o.c; c.fillRect(o.x, o.y, o.w, o.h); c.shadowColor = 'transparent';
          c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(o.x, o.y, o.w, 18);
          c.fillStyle = '#1b1b1b'; c.font = '500 16px sans-serif'; c.textBaseline = 'top'; wrap(o.s, o.w - 20).forEach((l, i) => { if (24 + i * 20 < o.h - 8) c.fillText(l, o.x + 10, o.y + 26 + i * 20); });
        }
        c.restore();
      }
      function draw() {
        const d = window.devicePixelRatio || 1, v = board.view, W = canvas.width, Ht = canvas.height;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, Ht);
        // dot grid
        const gs = 32 * v.z; if (gs > 8) { ctx.fillStyle = css().color; ctx.globalAlpha = 0.16; const ox = ((v.x % gs) + gs) % gs, oy = ((v.y % gs) + gs) % gs; for (let x = ox; x < W / d; x += gs) for (let y = oy; y < Ht / d; y += gs) ctx.fillRect(x * d - 1, y * d - 1, 2, 2); ctx.globalAlpha = 1; }
        ctx.setTransform(d * v.z, 0, 0, d * v.z, d * v.x, d * v.y);
        board.objs.forEach((o) => { if (o !== editing) drawObj(ctx, o); });
        if (cur) drawObj(ctx, cur);
        // selection
        if (sel.length) {
          const b = union(sel), z = v.z; ctx.save(); ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#5B9DFA'; ctx.lineWidth = 1.5 / z; ctx.setLineDash([5 / z, 4 / z]); ctx.strokeRect(b.x - 4 / z, b.y - 4 / z, b.w + 8 / z, b.h + 8 / z); ctx.setLineDash([]); ctx.fillStyle = '#fff';
          handles(b).forEach((h) => { ctx.beginPath(); ctx.rect(h.x - 5 / z, h.y - 5 / z, 10 / z, 10 / z); ctx.fill(); ctx.stroke(); }); ctx.restore();
        }
        if (mode && mode.kind === 'marquee') { const m = mode; ctx.save(); ctx.strokeStyle = '#5B9DFA'; ctx.fillStyle = 'rgba(91,157,250,.12)'; ctx.lineWidth = 1 / v.z; ctx.fillRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0); ctx.strokeRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0); ctx.restore(); }
        zoomLbl.textContent = Math.round(v.z * 100) + '%';
        if (!board.objs.length && !cur) { ctx.setTransform(d, 0, 0, d, 0, 0); ctx.fillStyle = css().color; ctx.globalAlpha = 0.45; ctx.textAlign = 'center'; ctx.font = '600 18px sans-serif'; ctx.fillText('Your canvas is empty', W / d / 2, Ht / d / 2 - 8); ctx.font = '14px sans-serif'; ctx.fillText('Pick a tool and start drawing - the board is infinite.', W / d / 2, Ht / d / 2 + 16); ctx.globalAlpha = 1; ctx.textAlign = 'left'; }
      }
      function handles(b) { return [{ x: b.x, y: b.y, k: 'nw' }, { x: b.x + b.w, y: b.y, k: 'ne' }, { x: b.x, y: b.y + b.h, k: 'sw' }, { x: b.x + b.w, y: b.y + b.h, k: 'se' }]; }

      // ---- hit testing
      function hit(o, x, y) {
        const tol = 7 / board.view.z;
        if (o.t === 'pen' || o.t === 'hl') { const w = (o.t === 'hl' ? o.w * 2 : o.w / 2) + tol; for (let i = 0; i < o.pts.length - 1; i++) if (distSeg(x, y, o.pts[i][0], o.pts[i][1], o.pts[i + 1][0], o.pts[i + 1][1]) <= w) return true; return o.pts.length === 1 && Math.hypot(x - o.pts[0][0], y - o.pts[0][1]) <= w; }
        if (o.t === 'line' || o.t === 'arrow') return distSeg(x, y, o.x1, o.y1, o.x2, o.y2) <= tol + o.w / 2;
        const b = bbox(o, ctx);
        if (o.t === 'text' || o.t === 'sticky') return x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 2 && y <= b.y + b.h + 2;
        if (o.t === 'rect') { const inO = x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol; const inI = x > b.x + tol && x < b.x + b.w - tol && y > b.y + tol && y < b.y + b.h - tol; return inO && !inI; }
        if (o.t === 'ellipse') { const rx = b.w / 2 + 0.01, ry = b.h / 2 + 0.01, dx = (x - b.x - rx) / rx, dy = (y - b.y - ry) / ry, r = Math.sqrt(dx * dx + dy * dy); return Math.abs(r - 1) * Math.min(rx, ry) <= tol; }
        return false;
      }
      const pick = (x, y) => { for (let i = board.objs.length - 1; i >= 0; i--) if (hit(board.objs[i], x, y)) return board.objs[i]; return null; };

      // ---- pointer
      let editing = null;
      stage.addEventListener('pointerdown', (e) => {
        if (editor && e.target === editor) return;
        commitEditor(); win.body.focus(); if (e.button === 1 || e.button === 2) { if (e.button === 2) return; }
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        const [x, y] = toW(e), v = board.view;
        if (e.button === 1 || tool === 'hand' || spaceDown) { mode = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y }; stage.classList.add('panning'); return; }
        if (tool === 'select') {
          if (sel.length) { const b = union(sel), h = handles(b).find((h) => Math.abs(h.x - x) < 9 / v.z && Math.abs(h.y - y) < 9 / v.z); if (h) { snap(); mode = { kind: 'resize', h: h.k, b, orig: JSON.stringify(sel) }; return; } }
          const o = pick(x, y);
          if (o) { if (e.shiftKey) sel = sel.indexOf(o) >= 0 ? sel.filter((s) => s !== o) : sel.concat(o); else if (sel.indexOf(o) < 0) sel = [o]; snap(); mode = { kind: 'move', x, y, moved: false }; if (e.detail === 2) { sel = [o]; edit(o); mode = null; } }
          else { sel = []; mode = { kind: 'marquee', x0: x, y0: y, x1: x, y1: y }; }
          draw(); return;
        }
        if (tool === 'eraser') { snap(); mode = { kind: 'erase' }; eraseAt(x, y); return; }
        if (tool === 'text') { const o = { t: 'text', x, y, s: '', c: color, size: 12 + width * 2 }; edit(o, true); return; }
        if (tool === 'sticky') { snap(); const o = { t: 'sticky', x: x - 90, y: y - 70, w: 180, h: 140, s: '', c: color === 'auto' ? '#FFE066' : color }; board.objs.push(o); sel = [o]; touch(); edit(o); setTool('select'); sel = [o]; draw(); return; }
        mode = { kind: 'draw', x0: x, y0: y };
        if (tool === 'pen' || tool === 'hl') cur = { t: tool, pts: [[x, y]], c: color, w: width };
        else cur = { t: tool, x1: x, y1: y, x2: x, y2: y, c: color, w: width };
        draw();
      });
      stage.addEventListener('pointermove', (e) => {
        if (!mode) return; const [x, y] = toW(e), v = board.view;
        if (mode.kind === 'pan') { v.x = mode.vx + e.clientX - mode.sx; v.y = mode.vy + e.clientY - mode.sy; }
        else if (mode.kind === 'draw') {
          if (cur.pts) { const l = cur.pts[cur.pts.length - 1]; if (Math.hypot(x - l[0], y - l[1]) * v.z > 1.5) cur.pts.push([x, y]); }
          else { cur.x2 = x; cur.y2 = y; if (e.shiftKey) { const dx = x - cur.x1, dy = y - cur.y1; if (cur.t === 'line' || cur.t === 'arrow') { if (Math.abs(dx) > Math.abs(dy) * 2) cur.y2 = cur.y1; else if (Math.abs(dy) > Math.abs(dx) * 2) cur.x2 = cur.x1; } else { const s = Math.max(Math.abs(dx), Math.abs(dy)); cur.x2 = cur.x1 + Math.sign(dx || 1) * s; cur.y2 = cur.y1 + Math.sign(dy || 1) * s; } } }
        } else if (mode.kind === 'move') { const dx = x - mode.x, dy = y - mode.y; if (dx || dy) { mode.moved = true; sel.forEach((o) => xform(o, (a) => a + dx, (a) => a + dy)); mode.x = x; mode.y = y; touch(); } }
        else if (mode.kind === 'resize') {
          const b = mode.b, ox = mode.h.indexOf('w') >= 0 ? b.x + b.w : b.x, oy = mode.h.indexOf('n') >= 0 ? b.y + b.h : b.y;
          const sx = b.w > 1 ? (x - ox) / ((mode.h.indexOf('w') >= 0 ? b.x : b.x + b.w) - ox) : 1, sy = b.h > 1 ? (y - oy) / ((mode.h.indexOf('n') >= 0 ? b.y : b.y + b.h) - oy) : 1;
          const orig = JSON.parse(mode.orig); sel.forEach((o, i) => { Object.keys(o).forEach((k) => delete o[k]); Object.assign(o, orig[i]); xform(o, (a) => ox + (a - ox) * (isFinite(sx) && Math.abs(sx) > 0.02 ? sx : 0.02), (a) => oy + (a - oy) * (isFinite(sy) && Math.abs(sy) > 0.02 ? sy : 0.02)); }); touch();
        } else if (mode.kind === 'marquee') { mode.x1 = x; mode.y1 = y; }
        else if (mode.kind === 'erase') eraseAt(x, y);
        draw();
      });
      const up = () => {
        if (!mode) return; const m = mode; mode = null; stage.classList.remove('panning');
        if (m.kind === 'draw' && cur) { const ok = cur.pts || Math.hypot(cur.x2 - cur.x1, cur.y2 - cur.y1) > 2; if (ok) { snap(); board.objs.push(cur); touch(); } cur = null; }
        else if (m.kind === 'move' && !m.moved) { undo.pop(); syncUR(); }
        else if (m.kind === 'marquee') { const x0 = Math.min(m.x0, m.x1), x1 = Math.max(m.x0, m.x1), y0 = Math.min(m.y0, m.y1), y1 = Math.max(m.y0, m.y1); sel = board.objs.filter((o) => { const b = bbox(o, ctx); return b.x + b.w >= x0 && b.x <= x1 && b.y + b.h >= y0 && b.y <= y1; }); if (m.x1 === m.x0) sel = []; }
        draw();
      };
      stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
      function eraseAt(x, y) { const o = pick(x, y); if (o) { board.objs = board.objs.filter((q) => q !== o); sel = sel.filter((q) => q !== o); touch(); } }
      stage.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); else { board.view.x -= e.deltaX; draw(); } }, { passive: false });
      stage.addEventListener('dblclick', (e) => { if (tool === 'select') { const [x, y] = toW(e), o = pick(x, y); if (o && (o.t === 'text' || o.t === 'sticky')) { sel = [o]; edit(o); } } });
      stage.addEventListener('contextmenu', (e) => {
        e.preventDefault(); const [x, y] = toW(e), o = pick(x, y);
        if (o && sel.indexOf(o) < 0) { sel = [o]; draw(); }
        LX.menu.show(e.clientX, e.clientY, sel.length ? [
          { label: 'Bring to front', icon: 'layers', action: () => { snap(); board.objs = board.objs.filter((q) => sel.indexOf(q) < 0).concat(sel); touch(); draw(); } },
          { label: 'Send to back', action: () => { snap(); board.objs = sel.concat(board.objs.filter((q) => sel.indexOf(q) < 0)); touch(); draw(); } },
          { label: 'Duplicate', icon: 'copy', shortcut: 'Ctrl+D', action: duplicate }, { separator: true }, { label: 'Delete', icon: 'trash', danger: true, shortcut: 'Del', action: delSel }] : [
          { label: 'Select all', shortcut: 'Ctrl+A', action: () => { setTool('select'); sel = board.objs.slice(); draw(); } }, { label: 'Fit content', action: fit }, { label: 'Reset view', action: () => { board.view = { x: 0, y: 0, z: 1 }; draw(); } }, { separator: true }, { label: 'Clear board', icon: 'trash', danger: true, action: clearBoard }]);
      });

      // ---- text editing overlay
      function edit(o, isNew) {
        editing = o; const v = board.view, size = (o.t === 'text' ? o.size : 16) * v.z;
        const ta = H('textarea', { class: 'wb-editor' });
        ta.value = o.s; editor = ta; editor._o = o; editor._new = !!isNew;
        const left = (o.x * v.z + v.x), topPx = (o.y * v.z + v.y);
        Object.assign(ta.style, { left: left + (o.t === 'sticky' ? 10 * v.z : 0) + 'px', top: topPx + (o.t === 'sticky' ? 24 * v.z : 0) + 'px', fontSize: size + 'px', lineHeight: '1.25', color: o.t === 'sticky' ? '#1b1b1b' : resolve(o.c), width: (o.t === 'sticky' ? (o.w - 20) * v.z : 260) + 'px', height: (o.t === 'sticky' ? (o.h - 30) * v.z : size * 1.4) + 'px', fontWeight: o.t === 'sticky' ? 500 : 600 });
        ta.addEventListener('input', () => { if (o.t === 'text') { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; } });
        ta.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); commitEditor(); win.body.focus(); } });
        ta.addEventListener('blur', () => commitEditor());
        stage.appendChild(ta); draw(); setTimeout(() => { ta.focus(); ta.select(); }, 0);
      }
      function commitEditor() {
        if (!editor) return; const ta = editor, o = ta._o, isNew = ta._new; editor = null; editing = null;
        const val = ta.value; ta.remove();
        if (o.t === 'text') { if (!val.trim()) { board.objs = board.objs.filter((q) => q !== o); } else if (isNew) { snap(); o.s = val; board.objs.push(o); touch(); } else if (val !== o.s) { snap(); o.s = val; touch(); } }
        else if (val !== o.s) { snap(); o.s = val; touch(); }
        draw();
      }

      function delSel() { if (!sel.length) return; snap(); board.objs = board.objs.filter((o) => sel.indexOf(o) < 0); sel = []; touch(); draw(); }
      function duplicate() { if (!sel.length) return; snap(); const cp = sel.map((o) => { const c = JSON.parse(JSON.stringify(o)); xform(c, (a) => a + 24, (a) => a + 24); return c; }); board.objs.push(...cp); sel = cp; touch(); draw(); }
      async function clearBoard() { if (!board.objs.length || await LX.dialog.confirm('Remove everything from this board?', 'Clear board')) { snap(); board.objs = []; sel = []; touch(); draw(); } }

      // ---- files
      function serialize() { return JSON.stringify({ app: 'lxboard', v: 1, view: board.view, objs: board.objs }); }
      function loadData(s, path) {
        try { const j = JSON.parse(s); if (!j || !Array.isArray(j.objs)) throw 0; board = { v: 1, view: j.view || { x: 0, y: 0, z: 1 }, objs: j.objs }; undo = []; redo = []; sel = []; file = path || null; dirty = false; syncUR(); title(); draw(); }
        catch (e) { LX.dialog.alert('That file is not a valid whiteboard (.lxboard).', 'Cannot open'); }
      }
      async function saveAs() { const p = await LX.dialog.saveFile({ title: 'Save board', path: LX.vfs.join(LX.vfs.HOME, 'Documents'), name: (file ? LX.vfs.basename(file) : 'board.lxboard') }); if (!p) return; file = /\.lxboard$/i.test(p) ? p : p + '.lxboard'; doSave(); }
      function doSave() { if (!file) return saveAs(); try { LX.vfs.write(file, serialize(), { mime: 'application/json' }); dirty = false; title(); LX.notify({ title: 'Board saved', body: LX.vfs.basename(file), icon: 'save', timeout: 2000 }); } catch (e) { LX.dialog.alert(String(e.message || e), 'Save failed'); } }
      async function openFileDlg() { const p = await LX.dialog.openFile({ title: 'Open board', path: LX.vfs.join(LX.vfs.HOME, 'Documents'), exts: ['lxboard'] }); if (p) { try { loadData(LX.vfs.read(p), p); } catch (e) { LX.dialog.alert(String(e.message || e)); } } }
      function newBoard() { board = { v: 1, view: { x: 0, y: 0, z: 1 }, objs: [] }; file = null; undo = []; redo = []; sel = []; dirty = false; syncUR(); title(); draw(); }
      function exportPNG() {
        if (!board.objs.length) return LX.notify({ title: 'Whiteboard', body: 'Nothing to export yet.', icon: 'alert' });
        const b = union(board.objs), pad = 40, sc = 2, W = Math.ceil((b.w + pad * 2) * sc), Ht = Math.ceil((b.h + pad * 2) * sc);
        if (W > 8000 || Ht > 8000) return LX.notify({ title: 'Whiteboard', body: 'Board is too large to export.', icon: 'alert' });
        const c = document.createElement('canvas'); c.width = W; c.height = Ht; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, Ht); x.scale(sc, sc); x.translate(pad - b.x, pad - b.y);
        const save = ctx; board.objs.forEach((o) => drawExport(x, o));
        const name = (file ? LX.vfs.basename(file).replace(/\.lxboard$/i, '') : 'whiteboard') + '-' + LX.pad(new Date().getHours()) + LX.pad(new Date().getMinutes()) + LX.pad(new Date().getSeconds()) + '.png';
        try { const dir = LX.vfs.join(LX.vfs.HOME, 'Pictures'); LX.vfs.write(LX.vfs.join(dir, name), c.toDataURL('image/png'), { mime: 'image/png' }); LX.notify({ title: 'Exported PNG', body: 'Pictures/' + name, icon: 'image', appId: 'photos' }); } catch (e) { LX.dialog.alert(String(e.message || e), 'Export failed'); }
      }
      function drawExport(x, o) { x.save(); x.font = '10px sans-serif'; const oc = ctx; drawObjWith(x, o); x.restore(); }
      function drawObjWith(x, o) { drawObj(x, o, true); }

      // ---- keys
      const onKey = (e) => {
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
        const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
        if (e.key === ' ') { spaceDown = true; stage.classList.add('panning-ready'); e.preventDefault(); return; }
        if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
        else if (mod && k === 'y') { e.preventDefault(); doRedo(); }
        else if (mod && k === 's') { e.preventDefault(); e.shiftKey ? saveAs() : doSave(); }
        else if (mod && k === 'o') { e.preventDefault(); openFileDlg(); }
        else if (mod && k === 'e') { e.preventDefault(); exportPNG(); }
        else if (mod && k === 'a') { e.preventDefault(); setTool('select'); sel = board.objs.slice(); draw(); }
        else if (mod && k === 'd') { e.preventDefault(); duplicate(); }
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSel(); }
        else if (e.key === 'Escape') { sel = []; draw(); }
        else if (e.key === '+' || e.key === '=') zoomBy(1.25);
        else if (e.key === '-') zoomBy(0.8);
        else if (e.key === '0' && !mod) { board.view = { x: 0, y: 0, z: 1 }; draw(); }
        else if (e.key.indexOf('Arrow') === 0 && sel.length) { e.preventDefault(); const s = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0; sel.forEach((o) => xform(o, (a) => a + dx, (a) => a + dy)); touch(); draw(); }
        else if (!mod && KEYS[k]) setTool(KEYS[k]);
      };
      win.body.addEventListener('keydown', onKey);
      win.body.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceDown = false; stage.classList.remove('panning-ready'); } });

      win.setMenu([
        { label: 'File', items: [{ label: 'New board', action: newBoard }, { label: 'Open…', shortcut: 'Ctrl+O', action: openFileDlg }, { label: 'Save', shortcut: 'Ctrl+S', action: doSave }, { label: 'Save as…', shortcut: 'Ctrl+Shift+S', action: saveAs }, { separator: true }, { label: 'Export PNG to Pictures', shortcut: 'Ctrl+E', action: exportPNG }] },
        { label: 'Edit', items: [{ label: 'Undo', shortcut: 'Ctrl+Z', action: doUndo }, { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: doRedo }, { separator: true }, { label: 'Select all', shortcut: 'Ctrl+A', action: () => { setTool('select'); sel = board.objs.slice(); draw(); } }, { label: 'Duplicate', shortcut: 'Ctrl+D', action: duplicate }, { label: 'Delete', shortcut: 'Del', action: delSel }, { separator: true }, { label: 'Clear board', action: clearBoard }] },
        { label: 'View', items: [{ label: 'Zoom in', shortcut: '+', action: () => zoomBy(1.25) }, { label: 'Zoom out', shortcut: '-', action: () => zoomBy(0.8) }, { label: 'Reset zoom', shortcut: '0', action: () => { board.view = { x: 0, y: 0, z: 1 }; draw(); } }, { label: 'Fit content', action: fit }] },
      ]);
      win.onClose(() => { ro.disconnect(); if (!file) LX.store.set(KEY, board); });
      const ro = new ResizeObserver(resize); ro.observe(stage);
      LX.apps.get('whiteboard');
      if (args && args.path) { try { loadData(LX.vfs.read(args.path), args.path); } catch (e) { LX.dialog.alert('Cannot open ' + args.path); } }
      else { const a = LX.store.get(KEY); if (a && Array.isArray(a.objs)) board = a; }
      win.on('args', (a) => { if (a && a.path) { try { loadData(LX.vfs.read(a.path), a.path); } catch (e) {} } });
      setTool('pen'); syncUR(); title(); setTimeout(() => { resize(); win.body.focus(); }, 30);
    },
  });
  LX.apps.setOpener(['lxboard'], 'whiteboard');
})();
