/* Leonux Web OS — Paint: pencil, brush, eraser, shapes, flood fill, undo/redo, open/save PNG via VFS */
(function () {
  'use strict';
  const H = LX.h, PICS = '/home/user/Pictures';
  const SWATCHES = ['#000000', '#ffffff', '#7f7f7f', '#c3c3c3', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4', '#b97a57', '#ffaec9', '#99d9ea'];
  const TOOLS = [['pencil', 'pencil', 'Pencil (P)'], ['brush', 'brush', 'Brush (B)'], ['eraser', 'eraser', 'Eraser (E)'], ['fill', 'droplet', 'Fill (F)'], ['line', 'minus', 'Line (L)'], ['rect', 'monitor', 'Rectangle (R)'], ['ellipse', 'record', 'Ellipse (O)'], ['picker', 'search', 'Pick colour (K)']];

  LX.apps.register({
    id: 'paint', name: 'Paint', icon: 'palette', color: '#FF9E64', category: 'Media', desc: 'Draw and edit pictures', width: 900, height: 640, minWidth: 460, minHeight: 360,
    open(win, args) {
      const body = win.body; body.tabIndex = 0;
      let tool = 'pencil', color = '#000000', size = 4, fillShape = false, undo = [], redo = [], drawing = null, snap = null, curPath = null, dirty = false;
      const canvas = H('canvas', { class: 'pt-canvas', width: 800, height: 520 });
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const overlay = H('canvas', { class: 'pt-overlay', width: 800, height: 520 });
      const ox = overlay.getContext('2d');
      const wrap = H('div', { class: 'pt-wrap' }, canvas, overlay);
      const scroller = H('div', { class: 'pt-scroll scroll grow' }, wrap);
      const status = H('div', { class: 'pt-status muted' });
      const colorIn = H('input', { type: 'color', class: 'pt-color', value: color, title: 'Custom colour', oninput: () => setColor(colorIn.value) });
      const sizeIn = H('input', { type: 'range', class: 'slider pt-size', min: 1, max: 60, value: size, title: 'Brush size', oninput: () => { size = +sizeIn.value; sizeLbl.textContent = size + 'px'; } });
      const sizeLbl = H('span', { class: 'muted pt-sizelbl', text: size + 'px' });
      const fillCk = H('label', { class: 'pt-fillck muted', title: 'Fill shapes' }, H('input', { type: 'checkbox', onchange: (e) => { fillShape = e.target.checked; } }), ' Filled');
      const toolBtns = {};
      const tools = H('div', { class: 'pt-tools' }, TOOLS.map((t) => (toolBtns[t[0]] = H('button', { class: 'btn icon sm pt-tool', title: t[2], 'aria-label': t[2], html: LX.icon(t[1], 16), onclick: () => setTool(t[0]) }))));
      const bUndo = H('button', { class: 'btn icon sm', title: 'Undo (Ctrl+Z)', html: LX.icon('undo', 16), onclick: doUndo });
      const bRedo = H('button', { class: 'btn icon sm', title: 'Redo (Ctrl+Y)', html: LX.icon('redo', 16), onclick: doRedo });
      const swatches = H('div', { class: 'pt-swatches' }, SWATCHES.map((c) => H('button', { class: 'pt-sw', style: { background: c }, title: c, 'aria-label': c, onclick: () => setColor(c) })));
      const toolbar = H('div', { class: 'toolbar pt-bar' }, tools, H('span', { class: 'pt-sep' }), bUndo, bRedo, H('span', { class: 'pt-sep' }),
        H('button', { class: 'btn sm', html: LX.icon('trash', 14) + ' Clear', onclick: clearAll }), H('span', { class: 'pt-sep' }), sizeIn, sizeLbl, fillCk);
      const palette = H('div', { class: 'pt-palette' }, colorIn, swatches, H('span', { class: 'grow' }), status);
      body.append(toolbar, scroller, palette);

      function setColor(c) { color = c; colorIn.value = /^#[0-9a-f]{6}$/i.test(c) ? c : '#000000'; if (tool === 'eraser') setTool('pencil'); upd(); }
      function setTool(t) { tool = t; Object.keys(toolBtns).forEach((k) => toolBtns[k].classList.toggle('active', k === t)); canvas.dataset.tool = overlay.dataset.tool = t; }
      function upd() { bUndo.disabled = !undo.length; bRedo.disabled = !redo.length; status.textContent = canvas.width + ' × ' + canvas.height + (curPath ? '  ·  ' + LX.vfs.basename(curPath) : '') + (dirty ? ' *' : ''); }
      function title() { win.setTitle('Paint — ' + (curPath ? LX.vfs.basename(curPath) : 'Untitled') + (dirty ? ' *' : '')); }
      function push() { try { undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); if (undo.length > 30) undo.shift(); redo = []; dirty = true; } catch (e) { /* ignore */ } upd(); title(); }
      function restore(img) { if (canvas.width !== img.width || canvas.height !== img.height) setSize(img.width, img.height); ctx.putImageData(img, 0, 0); }
      function doUndo() { if (!undo.length) return; redo.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); restore(undo.pop()); dirty = true; upd(); title(); }
      function doRedo() { if (!redo.length) return; undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); restore(redo.pop()); upd(); title(); }
      function setSize(w, h) { canvas.width = overlay.width = w; canvas.height = overlay.height = h; }
      function white() { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      function clearAll() { push(); white(); }
      function newDoc() {
        const go = () => { setSize(800, 520); white(); undo = []; redo = []; curPath = null; dirty = false; upd(); title(); };
        if (dirty) LX.dialog.confirm('Discard unsaved changes?', 'New drawing').then((ok) => ok && go()); else go();
      }
      function pos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; }
      function style(c) { c.lineCap = c.lineJoin = 'round'; c.lineWidth = tool === 'pencil' ? Math.max(1, Math.min(size, 3)) : size; c.strokeStyle = c.fillStyle = tool === 'eraser' ? '#ffffff' : color; }

      function floodFill(sx, sy, hex) {
        const w = canvas.width, h = canvas.height; sx = Math.floor(sx); sy = Math.floor(sy); if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
        const img = ctx.getImageData(0, 0, w, h), d = img.data;
        const n = parseInt(hex.slice(1), 16), nr = n >> 16 & 255, ng = n >> 8 & 255, nb = n & 255;
        const i0 = (sy * w + sx) * 4, r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2], a0 = d[i0 + 3];
        if (r0 === nr && g0 === ng && b0 === nb && a0 === 255) return;
        const tol = 24, match = (i) => Math.abs(d[i] - r0) <= tol && Math.abs(d[i + 1] - g0) <= tol && Math.abs(d[i + 2] - b0) <= tol && Math.abs(d[i + 3] - a0) <= tol;
        const stack = [sx, sy];
        while (stack.length) {
          let y = stack.pop(), x = stack.pop(); let i = (y * w + x) * 4;
          while (x >= 0 && match((y * w + x) * 4)) x--; x++;
          let up = false, dn = false;
          while (x < w && match((y * w + x) * 4)) {
            i = (y * w + x) * 4; d[i] = nr; d[i + 1] = ng; d[i + 2] = nb; d[i + 3] = 255;
            if (y > 0) { const m = match(((y - 1) * w + x) * 4); if (m && !up) { stack.push(x, y - 1); up = true; } else if (!m) up = false; }
            if (y < h - 1) { const m = match(((y + 1) * w + x) * 4); if (m && !dn) { stack.push(x, y + 1); dn = true; } else if (!m) dn = false; }
            x++;
          }
        }
        ctx.putImageData(img, 0, 0);
      }
      function shape(c, a, b, shift) {
        let x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
        if (shift && tool !== 'line') { const s = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)); x2 = x1 + Math.sign(x2 - x1 || 1) * s; y2 = y1 + Math.sign(y2 - y1 || 1) * s; }
        else if (shift) { const dx = x2 - x1, dy = y2 - y1, ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4, L = Math.hypot(dx, dy); x2 = x1 + Math.cos(ang) * L; y2 = y1 + Math.sin(ang) * L; }
        style(c); c.beginPath();
        if (tool === 'line') { c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
        else if (tool === 'rect') { c.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); fillShape ? c.fill() : c.stroke(); }
        else { c.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2); fillShape ? c.fill() : c.stroke(); }
      }
      overlay.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return; e.preventDefault(); const p = pos(e); body.focus();
        if (tool === 'picker') { const px = ctx.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data; setColor('#' + [px[0], px[1], px[2]].map((v) => LX.pad(v.toString(16))).join('')); return; }
        if (tool === 'fill') { push(); floodFill(p.x, p.y, color); return; }
        overlay.setPointerCapture(e.pointerId); push(); drawing = { start: p, last: p };
        if (tool === 'pencil' || tool === 'brush' || tool === 'eraser') { style(ctx); ctx.beginPath(); ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, 7); ctx.fill(); }
      });
      overlay.addEventListener('pointermove', (e) => {
        const p = pos(e); status.textContent = Math.round(p.x) + ', ' + Math.round(p.y) + '  ·  ' + canvas.width + ' × ' + canvas.height;
        if (!drawing) return;
        if (tool === 'pencil' || tool === 'brush' || tool === 'eraser') { style(ctx); ctx.beginPath(); ctx.moveTo(drawing.last.x, drawing.last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); drawing.last = p; }
        else { ox.clearRect(0, 0, overlay.width, overlay.height); shape(ox, drawing.start, p, e.shiftKey); }
      });
      const end = (e) => {
        if (!drawing) return; const p = pos(e);
        if (tool === 'line' || tool === 'rect' || tool === 'ellipse') { ox.clearRect(0, 0, overlay.width, overlay.height); shape(ctx, drawing.start, p, e.shiftKey); }
        drawing = null; upd();
      };
      overlay.addEventListener('pointerup', end); overlay.addEventListener('pointercancel', end);

      function openImg(p) {
        let url; try { url = LX.vfs.read(p); } catch (e) { return LX.dialog.alert('Cannot open ' + p + ': ' + e.message, 'Paint'); }
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight, 1)), w = Math.max(1, Math.round((im.naturalWidth || 800) * k)), h = Math.max(1, Math.round((im.naturalHeight || 520) * k));
          setSize(w, h); white(); ctx.drawImage(im, 0, 0, w, h); undo = []; redo = []; curPath = p; dirty = false; upd(); title();
        };
        im.onerror = () => LX.dialog.alert('This file is not a valid image.', 'Paint');
        im.src = url;
      }
      function open() { LX.dialog.openFile({ title: 'Open image', path: PICS, exts: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'] }).then((p) => { if (p) openImg(p); }); }
      function writeTo(p) { try { LX.vfs.write(p, canvas.toDataURL('image/png'), { mime: 'image/png' }); curPath = p; dirty = false; upd(); title(); LX.notify({ title: 'Saved', body: LX.vfs.basename(p), icon: 'palette', appId: 'paint' }); } catch (e) { LX.dialog.alert('Could not save: ' + e.message, 'Paint'); } }
      function saveAs() { LX.dialog.saveFile({ title: 'Save picture', path: PICS, name: curPath ? LX.vfs.basename(curPath) : 'Drawing.png' }).then((p) => { if (p) writeTo(/\.png$/i.test(p) ? p : p + '.png'); }); }
      function save() { if (curPath && LX.vfs.ext(curPath) === 'png') writeTo(curPath); else saveAs(); }
      function download() { const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = (curPath ? LX.vfs.basename(curPath).replace(/\.\w+$/, '') : 'Drawing') + '.png'; document.body.appendChild(a); a.click(); a.remove(); }

      const keys = { p: 'pencil', b: 'brush', e: 'eraser', f: 'fill', l: 'line', r: 'rect', o: 'ellipse', k: 'picker' };
      body.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
        const k = e.key.toLowerCase();
        if (e.ctrlKey || e.metaKey) {
          if (k === 'z') (e.shiftKey ? doRedo : doUndo)(); else if (k === 'y') doRedo(); else if (k === 's') (e.shiftKey ? saveAs : save)(); else if (k === 'o') open(); else if (k === 'n') newDoc(); else return;
        } else if (keys[k]) setTool(keys[k]); else if (k === '[') { size = Math.max(1, size - 2); sizeIn.value = size; sizeLbl.textContent = size + 'px'; } else if (k === ']') { size = Math.min(60, size + 2); sizeIn.value = size; sizeLbl.textContent = size + 'px'; } else return;
        e.preventDefault();
      });
      win.setMenu([
        { label: 'File', items: [{ label: 'New', shortcut: 'Ctrl+N', action: newDoc }, { label: 'Open…', shortcut: 'Ctrl+O', action: open }, { label: 'Save', shortcut: 'Ctrl+S', action: save }, { label: 'Save as…', shortcut: 'Ctrl+Shift+S', action: saveAs }, { label: 'Download PNG', action: download }, { separator: true }, { label: 'Close', action: () => win.close() }] },
        { label: 'Edit', items: [{ label: 'Undo', shortcut: 'Ctrl+Z', action: doUndo }, { label: 'Redo', shortcut: 'Ctrl+Y', action: doRedo }, { separator: true }, { label: 'Clear canvas', action: clearAll }] },
      ]);
      win.onClose(() => { drawing = null; });
      win.on('args', (a) => { if (a && a.path) openImg(a.path); });
      white(); setTool('pencil'); upd(); title();
      if (args && args.path) openImg(args.path);
    },
  });
})();
