/* Leonux Web OS — Voice Recorder: MediaRecorder, level meter, saves to ~/Music/Recordings, list + playback */
(function () {
  'use strict';
  const H = LX.h, DIR = '/home/user/Music/Recordings';
  const fmt = (t) => LX.pad(Math.floor(t / 60)) + ':' + LX.pad(Math.floor(t % 60));

  LX.apps.register({
    id: 'recorder', name: 'Voice Recorder', icon: 'mic', color: '#F28B82', category: 'Media', desc: 'Record audio from your microphone', width: 560, height: 560, minWidth: 360, minHeight: 380,
    open(win) {
      const body = win.body; body.tabIndex = 0;
      let rec = null, stream = null, chunks = [], actx = null, an = null, raf = 0, tick = 0, startT = 0, pausedAt = 0, paused = 0, state = 'idle', player = null, playing = null, off = null;
      const meter = H('canvas', { class: 'rc-meter', width: 480, height: 90 });
      const time = H('div', { class: 'rc-time', text: '00:00' });
      const note = H('div', { class: 'rc-note muted', text: 'Press the red button to start recording.' });
      const bRec = H('button', { class: 'rc-rec', title: 'Record / Stop (Space)', 'aria-label': 'Record', onclick: toggle }, H('span'));
      const bPause = H('button', { class: 'btn icon', title: 'Pause / Resume', html: LX.icon('pause', 20), disabled: true, onclick: pauseRes });
      const ctl = H('div', { class: 'rc-ctl' }, H('span', { class: 'grow' }), bPause, bRec, H('span', { class: 'grow' }));
      const list = H('div', { class: 'list scroll rc-list' });
      const head = H('div', { class: 'rc-head' }, H('b', { text: 'Recordings' }), H('span', { class: 'grow' }), H('button', { class: 'btn sm ghost', html: LX.icon('folder', 14) + ' Show folder', onclick: () => LX.apps.launch('files', { path: DIR }) }));
      body.append(H('div', { class: 'rc-top' }, meter, time, note, ctl), head, list);

      function drawLevel(level) {
        const c = meter.getContext('2d'), w = meter.width, h = meter.height; c.clearRect(0, 0, w, h);
        const n = 48, bw = w / n; const col = getComputedStyle(body).getPropertyValue(state === 'recording' ? '--danger' : '--text-faint').trim() || '#888';
        c.fillStyle = col;
        for (let i = 0; i < n; i++) { const v = level ? level[i % level.length] : 0; const bh = Math.max(3, v * h); c.globalAlpha = state === 'idle' ? 0.35 : 1; c.fillRect(i * bw + 2, (h - bh) / 2, bw - 4, bh); }
      }
      function loop() {
        if (!an) return; const d = new Uint8Array(an.frequencyBinCount); an.getByteTimeDomainData(d);
        const out = []; const step = Math.floor(d.length / 48) || 1;
        for (let i = 0; i < 48; i++) { let m = 0; for (let j = 0; j < step; j++) m = Math.max(m, Math.abs(d[i * step + j] - 128) / 128); out.push(Math.min(1, m * 1.6)); }
        drawLevel(out); raf = requestAnimationFrame(loop);
      }
      function setState(s) {
        state = s; bRec.classList.toggle('on', s !== 'idle'); bPause.disabled = s === 'idle'; bPause.innerHTML = LX.icon(s === 'paused' ? 'play' : 'pause', 20);
        note.textContent = s === 'idle' ? 'Press the red button to start recording.' : s === 'paused' ? 'Paused' : 'Recording…';
        note.classList.toggle('rec', s === 'recording');
      }
      function elapsed() { return state === 'idle' ? 0 : ((state === 'paused' ? pausedAt : Date.now()) - startT - paused) / 1000; }
      function unavailable(t) { note.textContent = t; note.classList.add('err'); drawLevel(null); }
      function toggle() { state === 'idle' ? begin() : finish(); }
      function begin() {
        note.classList.remove('err');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') return unavailable('Recording is not supported here (no microphone API available).');
        navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
          if (win.closed) { s.getTracks().forEach((t) => t.stop()); return; }
          stream = s; chunks = [];
          try { rec = new MediaRecorder(s); } catch (e) { cleanup(); return unavailable('Could not start the recorder: ' + e.message); }
          rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
          rec.onstop = save;
          try { const AC = window.AudioContext || window.webkitAudioContext; actx = new AC(); an = actx.createAnalyser(); an.fftSize = 512; actx.createMediaStreamSource(s).connect(an); } catch (e) { an = null; }
          rec.start(250); startT = Date.now(); paused = 0; setState('recording');
          tick = setInterval(() => { time.textContent = fmt(elapsed()); }, 200); loop();
        }).catch((e) => {
          const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
          unavailable(denied ? 'Microphone access was denied. Allow it in your browser and try again.' : 'No microphone found. Connect one and try again.');
        });
      }
      function pauseRes() {
        if (!rec) return;
        if (state === 'recording') { rec.pause(); pausedAt = Date.now(); setState('paused'); }
        else if (state === 'paused') { rec.resume(); paused += Date.now() - pausedAt; setState('recording'); }
      }
      function finish() { if (rec && rec.state !== 'inactive') rec.stop(); }
      function cleanup() {
        clearInterval(tick); cancelAnimationFrame(raf); raf = 0; an = null;
        if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null;
        if (actx) { try { actx.close(); } catch (e) { /* ignore */ } actx = null; }
      }
      function save() {
        const type = (rec && rec.mimeType) || 'audio/webm', secs = elapsed(); cleanup(); setState('idle'); time.textContent = '00:00'; drawLevel(null);
        if (!chunks.length) return;
        const blob = new Blob(chunks, { type }); chunks = [];
        const r = new FileReader();
        r.onload = () => {
          try {
            LX.vfs.mkdir(DIR); const d = new Date();
            const ext = /ogg/.test(type) ? 'ogg' : /mp4|aac/.test(type) ? 'm4a' : /wav/.test(type) ? 'wav' : 'webm';
            const nm = 'Recording ' + d.getFullYear() + '-' + LX.pad(d.getMonth() + 1) + '-' + LX.pad(d.getDate()) + ' ' + LX.pad(d.getHours()) + '.' + LX.pad(d.getMinutes()) + '.' + LX.pad(d.getSeconds()) + '.' + ext;
            const p = LX.vfs.join(DIR, LX.vfs.uniqueName(DIR, nm)); LX.vfs.write(p, r.result, { mime: type.split(';')[0] });
            LX.notify({ title: 'Recording saved', body: LX.vfs.basename(p) + ' (' + fmt(secs) + ')', icon: 'mic', appId: 'recorder' });
          } catch (e) { LX.dialog.alert('Could not save recording: ' + e.message, 'Voice Recorder'); }
        };
        r.readAsDataURL(blob);
      }
      function stopPlay() { if (player) { player.pause(); player = null; } playing = null; }
      function refresh() {
        let items = []; try { items = LX.vfs.ls(DIR).filter((s) => s.type === 'file'); } catch (e) { /* none */ }
        items.sort((a, b) => b.mtime - a.mtime); list.innerHTML = '';
        if (!items.length) { list.append(H('div', { class: 'rc-empty muted center', text: 'No recordings yet.' })); return; }
        items.forEach((s) => {
          const on = playing === s.path;
          list.append(H('div', { class: 'list-item rc-item' + (on ? ' active' : ''), oncontextmenu: (e) => { e.preventDefault(); LX.menu.show(e.clientX, e.clientY, [
            { label: 'Play', icon: 'play', action: () => play(s.path) }, { label: 'Rename…', icon: 'edit', action: () => rename(s) }, { separator: true }, { label: 'Move to Trash', icon: 'trash', action: () => del(s) }]); } },
            H('button', { class: 'btn icon sm', title: on ? 'Stop' : 'Play', html: LX.icon(on ? 'stop' : 'play', 16), onclick: () => on ? (stopPlay(), refresh()) : play(s.path) }),
            H('div', { class: 'grow ellipsis col' }, H('span', { class: 'ellipsis', text: s.name.replace(/\.[^.]+$/, '') }), H('span', { class: 'muted rc-sub', text: LX.fmtDateTime(s.mtime) + ' · ' + LX.fmtBytes(s.size) })),
            H('button', { class: 'btn icon ghost sm', title: 'Delete', html: LX.icon('trash', 15), onclick: () => del(s) })));
        });
      }
      function play(p) {
        stopPlay();
        try { player = new Audio(LX.vfs.read(p)); } catch (e) { return LX.dialog.alert('Cannot play: ' + e.message); }
        playing = p; player.onended = () => { playing = null; player = null; refresh(); }; player.onerror = () => { playing = null; player = null; refresh(); };
        player.play().catch(() => { playing = null; refresh(); }); refresh();
      }
      function rename(s) {
        LX.dialog.prompt('New name:', s.name.replace(/\.[^.]+$/, ''), 'Rename recording').then((n) => {
          if (!n || !n.trim()) return; try { LX.vfs.mv(s.path, LX.vfs.join(DIR, n.trim().replace(/[\/]/g, '-') + '.' + LX.vfs.ext(s.path))); } catch (e) { LX.dialog.alert(e.message); }
        });
      }
      function del(s) { LX.dialog.confirm('Move "' + s.name + '" to the Trash?', 'Delete recording').then((ok) => { if (ok) { if (playing === s.path) stopPlay(); try { LX.vfs.rm(s.path); } catch (e) { LX.dialog.alert(e.message); } } }); }
      body.addEventListener('keydown', (e) => { if (e.key === ' ' && e.target === body) { e.preventDefault(); toggle(); } });
      win.setMenu([{ label: 'Recorder', items: [{ label: 'Record / Stop', shortcut: 'Space', action: toggle }, { label: 'Pause / Resume', action: pauseRes }, { separator: true }, { label: 'Open recordings folder', action: () => LX.apps.launch('files', { path: DIR }) }, { label: 'Close', action: () => win.close() }] }]);
      off = LX.bus.on('vfs:change', (e) => { if (!e || !e.path || e.path.indexOf(DIR) === 0 || e.path.indexOf('.Trash') > 0) refresh(); });
      win.onClose(() => { win.closed = true; off && off(); stopPlay(); if (rec && rec.state !== 'inactive') { rec.onstop = null; try { rec.stop(); } catch (e) { /* ignore */ } } cleanup(); });
      drawLevel(null); refresh();
    },
  });
})();
