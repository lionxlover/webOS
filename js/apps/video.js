/* Leonux Web OS — Video player: VFS/disk files, speed, fullscreen, keyboard shortcuts */
(function () {
  'use strict';
  const H = LX.h, VIDS = '/home/user/Videos', VEXT = ['mp4', 'webm', 'ogv', 'mov', 'm4v'];
  const fmt = (t) => { if (!isFinite(t)) return '0:00'; const h = Math.floor(t / 3600); return (h ? h + ':' + LX.pad(Math.floor(t % 3600 / 60)) : Math.floor(t / 60)) + ':' + LX.pad(Math.floor(t % 60)); };

  LX.apps.register({
    id: 'video', name: 'Videos', icon: 'video', color: '#F28B82', category: 'Media', desc: 'Play video files', width: 820, height: 540, minWidth: 420, minHeight: 320,
    open(win, args) {
      const body = win.body; body.tabIndex = 0;
      const v = H('video', { class: 'vd-video', playsinline: true, preload: 'metadata' });
      let objUrl = null, speed = 1, hideT = 0, curPath = null;
      const file = H('input', { type: 'file', accept: 'video/*,audio/*', class: 'hidden', onchange: () => { if (file.files[0]) playBlob(file.files[0]); file.value = ''; } });
      const toast = H('div', { class: 'vd-toast hidden' });
      const empty = H('div', { class: 'vd-empty col center' }, H('div', { html: LX.icon('video', 56) }), H('b', { text: 'No video playing' }), H('span', { class: 'muted', text: 'Open a video from your files or from your computer.' }),
        H('div', { class: 'row gap' }, H('button', { class: 'btn primary', text: 'Open from Files…', onclick: openVfs }), H('button', { class: 'btn', text: 'Open from computer…', onclick: () => file.click() })),
        H('div', { class: 'vd-lib col' }));
      const bPlay = H('button', { class: 'btn icon ghost', title: 'Play/Pause (Space)', html: LX.icon('play', 20), onclick: toggle });
      const seek = H('input', { type: 'range', class: 'slider vd-seek', min: 0, max: 1000, value: 0, oninput: () => { if (isFinite(v.duration)) v.currentTime = v.duration * seek.value / 1000; } });
      const tm = H('span', { class: 'vd-time', text: '0:00 / 0:00' });
      const bMute = H('button', { class: 'btn icon ghost', title: 'Mute (M)', html: LX.icon('volume', 18), onclick: mute });
      const volS = H('input', { type: 'range', class: 'slider vd-vol', min: 0, max: 100, value: 80, oninput: () => { v.volume = volS.value / 100; v.muted = false; vsync(); } });
      const bSpeed = H('button', { class: 'btn sm ghost vd-speed', text: '1×', title: 'Playback speed', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); LX.menu.show(r.left, r.top - 8 - 6 * 30, [0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => ({ label: s + '×' + (s === speed ? '  ✓' : ''), action: () => setSpeed(s) }))); } });
      const bFs = H('button', { class: 'btn icon ghost', title: 'Fullscreen (F)', html: LX.icon('fullscreen', 18), onclick: fs });
      const bar = H('div', { class: 'vd-bar' }, H('div', { class: 'row gap vd-seekrow' }, seek), H('div', { class: 'row gap vd-ctl' },
        bPlay, H('button', { class: 'btn icon ghost', title: 'Back 10s (J)', html: LX.icon('rotate-ccw', 18), onclick: () => skip(-10) }), H('button', { class: 'btn icon ghost', title: 'Forward 10s (L)', html: LX.icon('rotate-cw', 18), onclick: () => skip(10) }),
        tm, H('span', { class: 'grow' }), bMute, volS, bSpeed, H('button', { class: 'btn icon ghost', title: 'Open…', html: LX.icon('folder', 18), onclick: openVfs }), bFs));
      const stage = H('div', { class: 'vd-stage grow', onmousemove: showBar, onclick: (e) => { if (e.target === v) toggle(); }, ondblclick: (e) => { if (e.target === v) fs(); } }, v, toast, bar);
      body.append(file, empty, stage); stage.classList.add('hidden');

      function libRender() {
        const lib = empty.querySelector('.vd-lib'); lib.innerHTML = ''; let l = [];
        try { l = LX.vfs.ls(VIDS).filter((s) => s.type === 'file' && VEXT.indexOf(LX.vfs.ext(s.path)) >= 0); } catch (e) { /* none */ }
        if (l.length) lib.append(H('div', { class: 'muted', text: 'In ~/Videos' }), ...l.map((s) => H('button', { class: 'btn ghost vd-libitem', html: LX.icon('video', 16) + ' ' + LX.escape(s.name), onclick: () => playPath(s.path) })));
      }
      function setSrc(url, name) {
        if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
        v.src = url; v.playbackRate = speed; win.setTitle('Videos — ' + name);
        empty.classList.add('hidden'); stage.classList.remove('hidden'); body.focus();
        v.play().catch(() => {}); showBar();
      }
      function playBlob(f) { objUrl = URL.createObjectURL(f); const u = objUrl; setSrc(u, f.name); objUrl = u; curPath = null; }
      function playPath(p) { try { curPath = p; setSrc(LX.vfs.read(p), LX.vfs.basename(p)); } catch (e) { LX.dialog.alert('Cannot open ' + p + ': ' + e.message); } }
      function openVfs() { LX.dialog.openFile({ title: 'Open video', path: VIDS, exts: VEXT.concat(['mp3', 'wav', 'ogg']) }).then((p) => { if (p) playPath(p); }); }
      function toggle() { if (!v.src) return openVfs(); v.paused ? v.play().catch(() => {}) : v.pause(); }
      function skip(d) { if (isFinite(v.duration)) { v.currentTime = LX.clamp(v.currentTime + d, 0, v.duration); say((d > 0 ? '+' : '') + d + 's'); } }
      function mute() { v.muted = !v.muted; vsync(); say(v.muted ? 'Muted' : 'Volume ' + Math.round(v.volume * 100) + '%'); }
      function vsync() { bMute.innerHTML = LX.icon(v.muted || v.volume === 0 ? 'volume-x' : 'volume', 18); volS.value = v.muted ? 0 : v.volume * 100; }
      function setSpeed(s) { speed = s; v.playbackRate = s; bSpeed.textContent = s + '×'; say('Speed ' + s + '×'); }
      function fs() { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (body.requestFullscreen) body.requestFullscreen().catch(() => say('Fullscreen unavailable')); }
      let tt = 0;
      function say(t) { toast.textContent = t; toast.classList.remove('hidden'); clearTimeout(tt); tt = setTimeout(() => toast.classList.add('hidden'), 900); }
      function showBar() { stage.classList.add('active'); clearTimeout(hideT); hideT = setTimeout(() => { if (!v.paused) stage.classList.remove('active'); }, 2500); }
      v.addEventListener('play', () => { bPlay.innerHTML = LX.icon('pause', 20); showBar(); });
      v.addEventListener('pause', () => { bPlay.innerHTML = LX.icon('play', 20); stage.classList.add('active'); });
      v.addEventListener('timeupdate', () => { if (isFinite(v.duration)) seek.value = v.currentTime / v.duration * 1000; tm.textContent = fmt(v.currentTime) + ' / ' + fmt(v.duration); });
      v.addEventListener('error', () => say('This file cannot be played'));
      body.addEventListener('keydown', (e) => {
        const k = e.key; if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
        if (k === ' ' || k === 'k') toggle(); else if (k === 'ArrowRight') skip(5); else if (k === 'ArrowLeft') skip(-5); else if (k === 'l' || k === 'L') skip(10); else if (k === 'j' || k === 'J') skip(-10);
        else if (k === 'ArrowUp') { v.volume = LX.clamp(v.volume + 0.05, 0, 1); vsync(); say('Volume ' + Math.round(v.volume * 100) + '%'); }
        else if (k === 'ArrowDown') { v.volume = LX.clamp(v.volume - 0.05, 0, 1); vsync(); say('Volume ' + Math.round(v.volume * 100) + '%'); }
        else if (k === 'm' || k === 'M') mute(); else if (k === 'f' || k === 'F') fs();
        else if (k === '>' || k === '.') setSpeed(Math.min(2, speed + 0.25)); else if (k === '<' || k === ',') setSpeed(Math.max(0.25, speed - 0.25));
        else if (k === 'o' && e.ctrlKey) openVfs(); else return;
        e.preventDefault();
      });
      win.setMenu([{ label: 'File', items: [{ label: 'Open from Files…', shortcut: 'Ctrl+O', action: openVfs }, { label: 'Open from computer…', action: () => file.click() }, { separator: true }, { label: 'Close', action: () => win.close() }] },
        { label: 'Playback', items: [{ label: 'Play / Pause', shortcut: 'Space', action: toggle }, { label: 'Fullscreen', shortcut: 'F', action: fs }, { label: 'Faster', shortcut: '>', action: () => setSpeed(Math.min(2, speed + 0.25)) }, { label: 'Slower', shortcut: '<', action: () => setSpeed(Math.max(0.25, speed - 0.25)) }] }]);
      win.onClose(() => { clearTimeout(hideT); v.pause(); v.removeAttribute('src'); v.load(); if (objUrl) URL.revokeObjectURL(objUrl); if (document.fullscreenElement === body) document.exitFullscreen().catch(() => {}); });
      win.on('args', (a) => { if (a && a.path) playPath(a.path); });
      v.volume = 0.8; libRender();
      if (args && args.path) playPath(args.path);
    },
  });
})();
