/* Leonux Web OS — Photos: gallery, lightbox viewer (zoom/pan/rotate), slideshow, wallpaper, import */
(function () {
  'use strict';
  const H = LX.h, PICS = '/home/user/Pictures';
  const EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'];

  function listImages() {
    const out = [];
    (function walk(d) {
      let items = []; try { items = LX.vfs.ls(d); } catch (e) { return; }
      items.forEach((s) => { if (s.type === 'dir') walk(s.path); else if (EXTS.indexOf(LX.vfs.ext(s.path)) >= 0) out.push(s); });
    })(PICS);
    return out;
  }
  const src = (p) => { try { return LX.vfs.read(p); } catch (e) { return ''; } };

  LX.apps.register({
    id: 'photos', name: 'Photos', icon: 'image', color: '#F28B82', category: 'Media', desc: 'Browse and view your pictures', width: 900, height: 620, minWidth: 420, minHeight: 320,
    open(win, args) {
      const body = win.body; body.tabIndex = 0;
      let images = [], idx = -1, zoom = 1, rot = 0, px = 0, py = 0, slide = null, size = LX.store.get('app.photos.size', 160), fitMode = true;

      const grid = H('div', { class: 'ph-grid scroll' });
      const count = H('span', { class: 'muted ph-count' });
      const file = H('input', { type: 'file', accept: 'image/*', multiple: true, class: 'hidden', onchange: () => importFiles(file.files) });
      const sizeSl = H('input', { type: 'range', class: 'slider ph-size', min: 100, max: 280, value: size, title: 'Thumbnail size', oninput: () => { size = +sizeSl.value; grid.style.setProperty('--ph-size', size + 'px'); LX.store.set('app.photos.size', size); } });
      grid.style.setProperty('--ph-size', size + 'px');
      const toolbar = H('div', { class: 'toolbar' },
        H('button', { class: 'btn sm', html: LX.icon('upload', 14) + ' Import', onclick: () => file.click() }),
        H('button', { class: 'btn sm', html: LX.icon('play', 14) + ' Slideshow', onclick: () => { if (images.length) startSlide(Math.max(idx, 0)); } }),
        H('span', { class: 'grow' }), count, sizeSl, file);
      const empty = H('div', { class: 'ph-empty center col hidden' }, H('div', { html: LX.icon('image', 48) }), H('b', { text: 'No pictures yet' }), H('span', { class: 'muted', text: 'Import images from your computer or save one from Camera or Paint.' }));

      // Lightbox
      const img = H('img', { class: 'ph-img', draggable: false, alt: '' });
      const stage = H('div', { class: 'ph-stage' }, img);
      const title = H('span', { class: 'ph-title ellipsis' });
      const lbBar = H('div', { class: 'ph-lbbar' },
        H('button', { class: 'btn icon ghost', title: 'Back (Esc)', html: LX.icon('arrow-left'), onclick: () => closeLb() }), title, H('span', { class: 'grow' }),
        tb('zoom-out', 'Zoom out (-)', () => setZoom(zoom / 1.25)), tb('zoom-in', 'Zoom in (+)', () => setZoom(zoom * 1.25)), tb('maximize', 'Fit (0)', fit),
        tb('rotate-ccw', 'Rotate left (L)', () => { rot -= 90; apply(); }), tb('rotate-cw', 'Rotate right (R)', () => { rot += 90; apply(); }),
        tb('play', 'Slideshow (S)', () => startSlide(idx)), tb('monitor', 'Set as wallpaper', setWallpaper), tb('trash', 'Delete (Del)', del));
      const prev = H('button', { class: 'ph-nav prev', html: LX.icon('chevron-left', 28), title: 'Previous', onclick: () => go(-1) });
      const next = H('button', { class: 'ph-nav next', html: LX.icon('chevron-right', 28), title: 'Next', onclick: () => go(1) });
      const lb = H('div', { class: 'ph-lb hidden' }, lbBar, stage, prev, next);
      function tb(ic, t, fn) { return H('button', { class: 'btn icon ghost', title: t, html: LX.icon(ic), onclick: fn }); }

      body.append(toolbar, H('div', { class: 'ph-main' }, grid, empty, lb));

      function refresh() {
        const cur = idx >= 0 && images[idx] ? images[idx].path : null;
        images = listImages();
        grid.innerHTML = '';
        images.forEach((s, i) => {
          const t = H('div', { class: 'ph-thumb', title: s.name, tabindex: 0, onclick: () => openLb(i), onkeydown: (e) => { if (e.key === 'Enter') openLb(i); }, oncontextmenu: (e) => { e.preventDefault(); LX.menu.show(e.clientX, e.clientY, [
            { label: 'Open', icon: 'image', action: () => openLb(i) },
            { label: 'Set as wallpaper', icon: 'monitor', action: () => setWallpaper(s.path) },
            { separator: true }, { label: 'Move to Trash', icon: 'trash', action: () => { LX.vfs.rm(s.path); } }]); } },
            H('img', { src: src(s.path), loading: 'lazy', alt: s.name, draggable: false }), H('span', { class: 'ph-name ellipsis', text: s.name }));
          grid.appendChild(t);
        });
        count.textContent = images.length + (images.length === 1 ? ' picture' : ' pictures');
        empty.classList.toggle('hidden', images.length > 0); grid.classList.toggle('hidden', !images.length);
        if (cur) { const n = images.findIndex((s) => s.path === cur); if (n < 0) { if (images.length && !lb.classList.contains('hidden')) openLb(Math.min(idx, images.length - 1)); else closeLb(); } else idx = n; }
      }
      function importFiles(files) {
        let n = 0; const arr = Array.from(files || []).filter((f) => /^image\//.test(f.type));
        if (!arr.length) return;
        arr.forEach((f) => {
          const r = new FileReader();
          r.onload = () => { try { LX.vfs.mkdir(PICS); LX.vfs.write(LX.vfs.join(PICS, LX.vfs.uniqueName(PICS, f.name)), r.result, { mime: f.type }); n++; } catch (e) { LX.dialog.alert('Could not import ' + f.name + ': ' + e.message, 'Import failed'); } if (n === arr.length) LX.notify({ title: 'Photos', body: 'Imported ' + n + ' picture(s)', icon: 'image', appId: 'photos' }); };
          r.readAsDataURL(f);
        });
        file.value = '';
      }
      function apply() {
        img.style.transform = 'translate(' + px + 'px,' + py + 'px) rotate(' + rot + 'deg) scale(' + zoom + ')';
        const rot90 = Math.abs(rot / 90) % 2 === 1;
        img.style.maxWidth = rot90 ? stage.clientHeight + 'px' : '100%'; img.style.maxHeight = rot90 ? stage.clientWidth + 'px' : '100%';
      }
      function fit() { zoom = 1; px = 0; py = 0; apply(); }
      function setZoom(z) { zoom = LX.clamp(z, 0.1, 12); apply(); }
      function openLb(i) {
        if (i < 0 || i >= images.length) return; idx = i; rot = 0; zoom = 1; px = 0; py = 0;
        img.src = src(images[i].path); title.textContent = images[i].name + '  ·  ' + (i + 1) + ' / ' + images.length;
        win.setTitle('Photos — ' + images[i].name);
        lb.classList.remove('hidden'); prev.style.visibility = next.style.visibility = images.length > 1 ? '' : 'hidden'; body.focus(); apply();
      }
      function closeLb() { stopSlide(); lb.classList.add('hidden'); idx = -1; win.setTitle('Photos'); lb.classList.remove('slide'); }
      function go(d) { if (!images.length) return; openLb((idx + d + images.length) % images.length); }
      function del() {
        if (idx < 0) return; const s = images[idx];
        LX.dialog.confirm('Move "' + s.name + '" to the Trash?', 'Delete picture').then((ok) => { if (ok) { try { LX.vfs.rm(s.path); } catch (e) { LX.dialog.alert(e.message); } } });
      }
      function setWallpaper(p) {
        const path = typeof p === 'string' ? p : (images[idx] || {}).path; if (!path) return;
        try { LX.settings.set('wallpaper', LX.vfs.read(path)); LX.notify({ title: 'Wallpaper changed', body: LX.vfs.basename(path), icon: 'image', appId: 'photos' }); }
        catch (e) { LX.dialog.alert('Could not set wallpaper: ' + e.message); }
      }
      function startSlide(i) {
        if (!images.length) return; stopSlide(); openLb(i < 0 ? 0 : i); lb.classList.add('slide');
        slide = setInterval(() => go(1), 3000);
      }
      function stopSlide() { if (slide) { clearInterval(slide); slide = null; } lb.classList.remove('slide'); }

      // Pan/zoom interactions
      let drag = null;
      stage.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; drag = { x: e.clientX - px, y: e.clientY - py }; stage.setPointerCapture(e.pointerId); stage.classList.add('drag'); });
      stage.addEventListener('pointermove', (e) => { if (!drag) return; px = e.clientX - drag.x; py = e.clientY - drag.y; apply(); });
      stage.addEventListener('pointerup', () => { drag = null; stage.classList.remove('drag'); });
      stage.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)); }, { passive: false });
      stage.addEventListener('dblclick', () => { if (zoom === 1) setZoom(2.5); else fit(); });
      body.addEventListener('keydown', (e) => {
        if (lb.classList.contains('hidden')) return;
        const k = e.key;
        if (k === 'Escape') closeLb(); else if (k === 'ArrowRight') go(1); else if (k === 'ArrowLeft') go(-1);
        else if (k === '+' || k === '=') setZoom(zoom * 1.25); else if (k === '-') setZoom(zoom / 1.25); else if (k === '0') fit();
        else if (k === 'r' || k === 'R') { rot += 90; apply(); } else if (k === 'l' || k === 'L') { rot -= 90; apply(); }
        else if (k === 's' || k === 'S') { slide ? stopSlide() : startSlide(idx); } else if (k === 'Delete') del(); else return;
        e.preventDefault();
      });
      win.on('resize', () => { if (!lb.classList.contains('hidden')) apply(); });
      win.setMenu([
        { label: 'File', items: [{ label: 'Import…', shortcut: 'Ctrl+O', action: () => file.click() }, { separator: true }, { label: 'Close', action: () => win.close() }] },
        { label: 'View', items: [{ label: 'Slideshow', shortcut: 'S', action: () => startSlide(Math.max(idx, 0)) }, { label: 'Fit to window', shortcut: '0', action: fit }, { label: 'Refresh', action: refresh }] },
      ]);

      const off = LX.bus.on('vfs:change', (e) => { if (!e || !e.path || e.path.indexOf(PICS) === 0 || e.path.indexOf('.Trash') > 0 || e.path === '/') refresh(); });
      win.onClose(() => { off(); stopSlide(); });
      win.on('args', (a) => { if (a && a.path) showPath(a.path); });
      function showPath(p) { refresh(); let i = images.findIndex((s) => s.path === p); if (i < 0 && LX.vfs.isFile(p)) { images.unshift(LX.vfs.stat(p)); i = 0; } if (i >= 0) openLb(i); }
      refresh();
      if (args && args.path) showPath(args.path);
    },
  });
})();
