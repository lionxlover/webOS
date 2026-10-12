/* Store app — Screen Studio: real screen capture via getDisplayMedia —
   screenshots (PNG) and recordings (webm) saved into the VFS. */
(function () {
  'use strict';
  const H = LX.h;

  LX.apps.register({
    id: 'screenstudio', name: 'Screen Studio', icon: 'video', color: '#EB6F92', category: 'Media',
    pkg: true, pkgVersion: '1.0', pkgSize: 24, developer: 'Leonux Labs', downloads: 690,
    desc: 'Capture your screen as images or video', longDesc: 'Real screen capture built on getDisplayMedia: snap PNG screenshots of any tab or window, or record webm video with a live timer. Everything lands in your Leonux folders.',
    permissions: ['Screen capture', 'Microphone (optional)'],
    changelog: 'First release.',
    width: 860, height: 600, minWidth: 480, minHeight: 420,
    open(win) {
      let stream = null, recorder = null, chunks = [], recT = null, startedAt = 0;
      const preview = H('video', { class: 'ss-preview', autoplay: true, muted: true, playsinline: true });
      const timerEl = H('div', { class: 'ss-timer muted' });
      const gallery = H('div', { class: 'ss-gallery scroll' });
      const captures = []; // {kind, path, at}
      const status = H('div', { class: 'ss-status muted' });

      const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
      const canRecord = typeof MediaRecorder !== 'undefined';

      async function engage() {
        if (!supported) { LX.dialog.alert('This browser does not expose screen capture (getDisplayMedia). Try desktop Chrome or Edge.', 'Not supported'); return null; }
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
          preview.srcObject = stream;
          status.textContent = 'Capture source live — ' + (stream.getVideoTracks()[0].label || 'screen');
          stream.getVideoTracks()[0].addEventListener('ended', () => { disengage(); });
          return stream;
        } catch (e) { status.textContent = 'Capture cancelled.'; return null; }
      }
      function disengage() {
        if (recorder && recorder.state === 'recording') recorder.stop();
        stopTimer();
        if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
        preview.srcObject = null;
        status.textContent = 'Idle — click “Share screen”.';
      }
      function snap() {
        if (!stream) return LX.notify({ title: 'No source', body: 'Click “Share screen” first.', icon: 'alert' });
        const v = document.createElement('video');
        v.srcObject = stream; v.muted = true;
        v.play().then(() => {
          requestAnimationFrame(() => {
            const c = document.createElement('canvas');
            c.width = v.videoWidth; c.height = v.videoHeight;
            c.getContext('2d').drawImage(v, 0, 0);
            const data = c.toDataURL('image/png');
            const name = 'Screenshot ' + LX.fmtTime(Date.now()).replace(/:/g, '') + '.png';
            const p = LX.vfs.join('/home/user/Pictures', LX.vfs.uniqueName('/home/user/Pictures', name));
            LX.vfs.write(p, data, { mime: 'image/png' });
            captures.unshift({ kind: 'png', path: p, at: Date.now() });
            paintGallery();
            LX.notify({ title: 'Screenshot saved', body: p, icon: 'image', appId: 'photos', args: { path: '/home/user/Pictures' } });
            LX.audio.beep(980, .06, 'sine', .2);
          });
        }).catch(() => LX.notify({ title: 'Snap failed', body: 'Could not read a frame from the stream.', icon: 'alert' }));
      }
      function record() {
        if (!stream) { LX.notify({ title: 'No source', body: 'Click “Share screen” first.', icon: 'alert' }); return; }
        if (!canRecord) return LX.dialog.alert('MediaRecorder is unavailable here.', 'Not supported');
        if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
        chunks = [];
        try { recorder = new MediaRecorder(stream, { mimeType: pickMime() }); }
        catch (e) { recorder = new MediaRecorder(stream); }
        recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        recorder.onstop = () => {
          stopTimer();
          const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
          const fr = new FileReader();
          fr.onload = () => {
            const name = 'Recording ' + LX.fmtTime(startedAt).replace(/:/g, '') + '.webm';
            const p = LX.vfs.join('/home/user/Videos', LX.vfs.uniqueName('/home/user/Videos', name));
            LX.vfs.write(p, fr.result, { mime: 'video/webm' });
            captures.unshift({ kind: 'webm', path: p, at: Date.now() });
            paintGallery();
            LX.notify({ title: 'Recording saved', body: LX.fmtBytes(blob.size) + ' → ' + p, icon: 'video' });
          };
          fr.readAsDataURL(blob);
        };
        recorder.start(250);
        startedAt = Date.now();
        startTimer();
        paintRecBtn();
      }
      function pickMime() {
        const list = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
        for (const m of list) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
        return '';
      }
      function startTimer() {
        timerEl.classList.add('rec');
        recT = setInterval(() => {
          const s = Math.floor((Date.now() - startedAt) / 1000);
          timerEl.textContent = '● ' + LX.pad(Math.floor(s / 60)) + ':' + LX.pad(s % 60);
        }, 400);
      }
      function stopTimer() { clearInterval(recT); timerEl.classList.remove('rec'); timerEl.textContent = ''; }

      const shareBtn = H('button', { class: 'btn primary', html: LX.icon('external', 14) + ' Share screen', onclick: () => { stream ? disengage() : engage(); } });
      const snapBtn = H('button', { class: 'btn', html: LX.icon('camera', 14) + ' Screenshot', onclick: snap });
      const recBtn = H('button', { class: 'btn', html: LX.icon('record', 14) + ' Record', onclick: record });
      function paintRecBtn() {
        const on = recorder && recorder.state === 'recording';
        recBtn.classList.toggle('danger', !!on);
        recBtn.innerHTML = LX.icon('stop', 14) + (on ? ' Stop & save' : ' Record');
      }
      function paintGallery() {
        gallery.innerHTML = '';
        if (!captures.length) { gallery.appendChild(H('div', { class: 'muted', style: { padding: '12px' }, text: 'Your captures will appear here.' })); return; }
        captures.forEach((c) => gallery.appendChild(H('div', { class: 'ss-item', onclick: () => LX.apps.openFile(c.path) },
          H('span', { class: 'ss-item-ico', html: LX.icon(c.kind === 'png' ? 'image' : 'video', 16) }),
          H('div', { class: 'grow', style: { minWidth: 0 } }, H('span', { class: 'ellipsis', style: { display: 'block', fontSize: '12.5px' }, text: LX.vfs.basename(c.path) }),
            H('span', { class: 'muted', style: { fontSize: '11px' }, text: LX.vfs.dirname(c.path) })))));
      }

      win.body.append(
        H('div', { class: 'toolbar' }, shareBtn, snapBtn, recBtn, timerEl, H('span', { class: 'grow' }), status),
        H('div', { class: 'ss-wrap' },
          H('div', { class: 'ss-stage' }, preview, !supported && H('div', { class: 'ss-unsupported' }, H('div', { html: LX.icon('alert', 40) }), H('p', { class: 'muted', text: 'Screen capture needs desktop Chrome / Edge and a secure context. Everything else in Leonux still works.' }))),
          H('div', { class: 'ss-side' }, H('div', { class: 'muted', style: { fontSize: '11px', padding: '6px 2px' }, text: 'CAPTURES' }), gallery)));
      paintGallery(); paintRecBtn();
      status.textContent = 'Idle — click “Share screen”.';
      win.onClose(() => disengage());
    },
  });
})();
