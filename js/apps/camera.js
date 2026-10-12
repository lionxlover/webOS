/* Leonux Web OS — Camera: getUserMedia with generated test-pattern fallback, capture PNG to ~/Pictures */
(function () {
  'use strict';
  const H = LX.h, PICS = '/home/user/Pictures';

  LX.apps.register({
    id: 'camera', name: 'Camera', icon: 'camera', color: '#C792EA', category: 'Media', desc: 'Take photos with your webcam', width: 720, height: 560, minWidth: 380, minHeight: 360,
    open(win) {
      const body = win.body; body.tabIndex = 0;
      let stream = null, raf = 0, mirror = LX.store.get('app.camera.mirror', true), timer = 0, last = null, mode = 'init', facing = 'user', t0 = performance.now();
      const video = H('video', { class: 'cm-video', autoplay: true, playsinline: true, muted: true });
      video.muted = true;
      const pattern = H('canvas', { class: 'cm-pattern hidden', width: 640, height: 480 });
      const msg = H('div', { class: 'cm-msg hidden' });
      const flash = H('div', { class: 'cm-flash' });
      const count = H('div', { class: 'cm-count hidden' });
      const stage = H('div', { class: 'cm-stage grow' }, video, pattern, msg, count, flash);
      const thumb = H('button', { class: 'cm-thumb', title: 'Open last photo in Photos', onclick: () => { if (last) LX.apps.launch('photos', { path: last }); } });
      const shutter = H('button', { class: 'cm-shutter', title: 'Take photo (Space)', 'aria-label': 'Take photo', onclick: () => snap() }, H('span'));
      const bMirror = H('button', { class: 'btn icon ghost', title: 'Mirror', html: LX.icon('rotate-cw', 18), onclick: () => { mirror = !mirror; LX.store.set('app.camera.mirror', mirror); sync(); } });
      const timerSel = H('select', { class: 'select cm-timer', title: 'Timer' }, H('option', { value: 0, text: 'No timer' }), H('option', { value: 3, text: '3 s' }), H('option', { value: 10, text: '10 s' }));
      const bRetry = H('button', { class: 'btn sm', html: LX.icon('refresh', 14) + ' Retry camera', onclick: () => start() });
      const bar = H('div', { class: 'cm-bar' }, thumb, H('span', { class: 'grow' }), shutter, H('span', { class: 'grow cm-right row' }, timerSel, bMirror));
      body.append(stage, bar);

      function sync() { stage.classList.toggle('mirror', mirror && mode === 'live'); }
      function showMsg(title, text, retry) {
        msg.innerHTML = ''; msg.append(H('div', { html: LX.icon('camera', 44) }), H('b', { text: title }), H('span', { class: 'muted', text: text }), retry ? bRetry : null);
        msg.classList.remove('hidden');
      }
      function drawPattern() {
        const c = pattern.getContext('2d'), w = 640, h = 480, t = (performance.now() - t0) / 1000;
        const bars = ['#fff', '#ff0', '#0ff', '#0f0', '#f0f', '#f00', '#00f', '#000'];
        bars.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * w / 8, 0, w / 8 + 1, h * 0.7); });
        const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#000'); g.addColorStop(1, '#fff'); c.fillStyle = g; c.fillRect(0, h * 0.7, w, h * 0.12);
        c.fillStyle = '#1b1f2a'; c.fillRect(0, h * 0.82, w, h * 0.18);
        c.fillStyle = '#fff'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center';
        c.fillText('TEST PATTERN — no camera', w / 2, h * 0.9);
        c.font = '14px monospace'; c.fillText(new Date().toLocaleTimeString(), w / 2, h * 0.96);
        c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3; c.beginPath(); c.arc(w / 2 + Math.cos(t * 2) * 120, h * 0.35 + Math.sin(t * 2) * 60, 26, 0, 7); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(w / 2 + Math.cos(t * 2) * 120, h * 0.35 + Math.sin(t * 2) * 60, 8, 0, 7); c.fill();
        raf = requestAnimationFrame(drawPattern);
      }
      function stop() {
        if (stream) { stream.getTracks().forEach((tr) => tr.stop()); stream = null; }
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        video.srcObject = null;
      }
      function fallback(title, text) {
        stop(); mode = 'pattern'; video.classList.add('hidden'); pattern.classList.remove('hidden');
        showMsg(title, text, true); msg.classList.add('banner'); drawPattern(); sync();
      }
      function start() {
        stop(); msg.classList.add('hidden'); msg.classList.remove('banner');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return fallback('Camera unavailable', 'This browser or context does not support camera access. You can still take a photo of the test pattern.');
        mode = 'init';
        navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }).then((s) => {
          if (win.closed) { s.getTracks().forEach((tr) => tr.stop()); return; }
          stream = s; mode = 'live'; video.srcObject = s; video.classList.remove('hidden'); pattern.classList.add('hidden'); video.play().catch(() => {}); sync();
        }).catch((e) => {
          const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
          fallback(denied ? 'Camera access denied' : 'No camera found', denied ? 'Allow camera access in your browser, then retry. Showing a test pattern meanwhile.' : 'Connect a camera and retry. Showing a test pattern meanwhile.');
        });
      }
      function snap() {
        if (timer) { clearInterval(timer); timer = 0; count.classList.add('hidden'); return; }
        const n = +timerSel.value;
        if (!n) return shoot();
        let left = n; count.textContent = left; count.classList.remove('hidden');
        timer = setInterval(() => { left--; if (left <= 0) { clearInterval(timer); timer = 0; count.classList.add('hidden'); shoot(); } else count.textContent = left; }, 1000);
      }
      function shoot() {
        const c = document.createElement('canvas'), live = mode === 'live' && video.videoWidth;
        c.width = live ? video.videoWidth : pattern.width; c.height = live ? video.videoHeight : pattern.height;
        const x = c.getContext('2d');
        if (live) { if (mirror) { x.translate(c.width, 0); x.scale(-1, 1); } x.drawImage(video, 0, 0); } else x.drawImage(pattern, 0, 0);
        flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
        try { LX.audio.beep(1200, 0.05, 'square', 0.08); } catch (e) { /* ignore */ }
        try {
          LX.vfs.mkdir(PICS);
          const d = new Date(), nm = 'Photo ' + d.getFullYear() + '-' + LX.pad(d.getMonth() + 1) + '-' + LX.pad(d.getDate()) + ' ' + LX.pad(d.getHours()) + '.' + LX.pad(d.getMinutes()) + '.' + LX.pad(d.getSeconds()) + '.png';
          const p = LX.vfs.join(PICS, LX.vfs.uniqueName(PICS, nm));
          const url = c.toDataURL('image/png'); LX.vfs.write(p, url, { mime: 'image/png' }); last = p;
          thumb.style.backgroundImage = 'url(' + url + ')'; thumb.classList.add('has');
          LX.notify({ title: 'Photo saved', body: LX.vfs.basename(p), icon: 'camera', appId: 'camera' });
        } catch (e) { LX.dialog.alert('Could not save photo: ' + e.message, 'Camera'); }
      }
      body.addEventListener('keydown', (e) => { if (e.target.tagName === 'SELECT') return; if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); snap(); } else if (e.key === 'm' || e.key === 'M') { mirror = !mirror; LX.store.set('app.camera.mirror', mirror); sync(); } });
      win.setMenu([{ label: 'Camera', items: [{ label: 'Take photo', shortcut: 'Space', action: snap }, { label: 'Retry camera', action: start }, { label: 'Mirror', shortcut: 'M', action: () => { mirror = !mirror; sync(); } }, { separator: true }, { label: 'Open Photos', action: () => LX.apps.launch('photos') }, { label: 'Close', action: () => win.close() }] }]);
      win.onClose(() => { win.closed = true; stop(); clearInterval(timer); });
      start();
    },
  });
})();
