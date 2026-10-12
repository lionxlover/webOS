/* Leonux Web OS — Music: library, queue, transport, shuffle/repeat, WebAudio visualizer, generated seed tracks */
(function () {
  'use strict';
  const H = LX.h, MUSIC = '/home/user/Music';
  const AEXT = ['mp3', 'wav', 'ogg', 'm4a', 'lxtrack', 'webm', 'flac', 'aac'];
  const isAudio = (s) => AEXT.indexOf(LX.vfs.ext(s.path)) >= 0 && (LX.vfs.ext(s.path) !== 'webm' || /^audio\//.test(s.mime));
  const fmt = (t) => (isFinite(t) ? Math.floor(t / 60) + ':' + LX.pad(Math.floor(t % 60)) : '0:00');

  // ---- WAV generation (seed tracks) ----
  function wavDataUrl(notes, rate) {
    const total = notes.reduce((a, n) => a + n[1], 0), N = Math.floor(total * rate), buf = new Uint8Array(44 + N * 2), dv = new DataView(buf.buffer);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + N * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, N * 2, true);
    let pos = 0;
    notes.forEach((n) => {
      const len = Math.floor(n[1] * rate);
      for (let i = 0; i < len && pos < N; i++, pos++) {
        const t = i / rate, env = Math.min(1, i / (rate * 0.02)) * Math.exp(-3 * t / n[1]) * Math.min(1, (len - i) / (rate * 0.03));
        const f = n[0]; let v = 0;
        if (f > 0) v = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t) + 0.15 * Math.sin(6 * Math.PI * f * t)) * 0.45;
        dv.setInt16(44 + pos * 2, Math.round(LX.clamp(v * env, -1, 1) * 30000), true);
      }
    });
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return 'data:audio/wav;base64,' + btoa(bin);
  }
  const F = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A3: 220, G3: 196, E3: 164.81, R: 0 };
  const SEEDS = {
    'Sunrise Arpeggio.wav': () => { const n = []; ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4', 'E4', 'G4', 'C5', 'E5', 'C5', 'G4', 'E4', 'C4', 'R'].forEach((k) => n.push([F[k], 0.4])); return n; },
    'Lion Lullaby.wav': () => { const n = []; [['E4', 0.6], ['D4', 0.3], ['C4', 0.6], ['D4', 0.3], ['E4', 0.6], ['E4', 0.3], ['E4', 0.9], ['D4', 0.6], ['D4', 0.3], ['D4', 0.9], ['E4', 0.6], ['G4', 0.3], ['G4', 0.9]].forEach((k) => n.push([F[k[0]], k[1]])); return n; },
    'Night Drive.wav': () => { const n = []; ['A3', 'A3', 'C4', 'A3', 'E4', 'A3', 'D4', 'C4', 'G3', 'G3', 'B4', 'G3', 'D4', 'G3', 'C4', 'B4', 'A3', 'A3', 'C4', 'A3', 'E4', 'A3', 'G4', 'E4'].forEach((k) => n.push([F[k] || 220, 0.3])); return n; },
  };
  function seed() {
    if (LX.store.get('app.music.seeded')) return;
    let have = false; try { LX.vfs.mkdir(MUSIC); have = LX.vfs.ls(MUSIC).some(isAudio); } catch (e) { return; }
    LX.store.set('app.music.seeded', true);
    if (have) return;
    Object.keys(SEEDS).forEach((name) => { try { LX.vfs.write(LX.vfs.join(MUSIC, name), wavDataUrl(SEEDS[name](), 11025), { mime: 'audio/wav' }); } catch (e) { /* storage full */ } });
  }
  function scan() {
    const out = [];
    (function walk(d) { let l = []; try { l = LX.vfs.ls(d); } catch (e) { return; } l.forEach((s) => { if (s.type === 'dir') walk(s.path); else if (isAudio(s)) out.push(s); }); })(MUSIC);
    return out;
  }

  LX.apps.register({
    id: 'music', name: 'Music', icon: 'music', color: '#CBA6F7', category: 'Media', desc: 'Play your music with a live visualizer', width: 860, height: 560, minWidth: 460, minHeight: 360, singleton: true,
    open(win, args) {
      seed();
      const body = win.body; body.tabIndex = 0;
      const audio = new Audio(); audio.preload = 'metadata';
      let lib = [], queue = [], cur = -1, shuffle = LX.store.get('app.music.shuffle', false), repeat = LX.store.get('app.music.repeat', 'off'), vol = LX.store.get('app.music.vol', 0.8);
      let an = null, raf = 0, srcNode = null, hist = [];

      const list = H('div', { class: 'list scroll mu-list' });
      const empty = H('div', { class: 'muted center mu-empty hidden', text: 'No music found in ~/Music. Add some with the + button.' });
      const canvas = H('canvas', { class: 'mu-viz' });
      const tTitle = H('div', { class: 'mu-title ellipsis', text: 'Nothing playing' }), tSub = H('div', { class: 'mu-sub muted ellipsis', text: 'Pick a track from your library' });
      const cur_ = H('span', { class: 'mu-time', text: '0:00' }), dur_ = H('span', { class: 'mu-time', text: '0:00' });
      const seek = H('input', { type: 'range', class: 'slider mu-seek', min: 0, max: 1000, value: 0, oninput: () => { if (isFinite(audio.duration)) audio.currentTime = audio.duration * seek.value / 1000; } });
      const volS = H('input', { type: 'range', class: 'slider mu-vol', min: 0, max: 100, value: vol * 100, title: 'Volume', oninput: () => { vol = volS.value / 100; applyVol(); LX.store.set('app.music.vol', vol); } });
      const btn = (ic, t, fn, cls) => H('button', { class: 'btn icon ghost ' + (cls || ''), title: t, html: LX.icon(ic, 20), onclick: fn });
      const bShuf = btn('shuffle', 'Shuffle', () => { shuffle = !shuffle; LX.store.set('app.music.shuffle', shuffle); sync(); });
      const bRep = btn('repeat', 'Repeat', () => { repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off'; LX.store.set('app.music.repeat', repeat); sync(); });
      const bPlay = btn('play', 'Play/Pause (Space)', toggle, 'mu-play');
      const file = H('input', { type: 'file', accept: 'audio/*', multiple: true, class: 'hidden', onchange: () => addFiles(file.files) });
      const side = H('div', { class: 'sidebar mu-side' },
        H('div', { class: 'toolbar' }, H('b', { class: 'grow', text: 'Library' }), H('button', { class: 'btn icon ghost sm', title: 'Add music from disk', html: LX.icon('plus', 16), onclick: () => file.click() })), list, empty, file);
      const main = H('div', { class: 'mu-main col grow' },
        H('div', { class: 'mu-stage grow' }, canvas, H('div', { class: 'mu-meta' }, tTitle, tSub)),
        H('div', { class: 'mu-controls' },
          H('div', { class: 'row gap mu-seekrow' }, cur_, seek, dur_),
          H('div', { class: 'row mu-btns' }, bShuf, btn('skip-back', 'Previous (P)', () => step(-1)), bPlay, btn('skip-forward', 'Next (N)', () => step(1)), bRep, H('span', { class: 'grow' }), H('span', { html: LX.icon('volume', 16), class: 'muted' }), volS)));
      body.append(H('div', { class: 'row grow mu-body' }, side, main));

      function applyVol() { audio.volume = LX.clamp(vol, 0, 1); }
      function sync() {
        bPlay.innerHTML = LX.icon(audio.paused ? 'play' : 'pause', 22);
        bShuf.classList.toggle('on', shuffle); bRep.classList.toggle('on', repeat !== 'off'); bRep.title = 'Repeat: ' + repeat;
        bRep.innerHTML = LX.icon('repeat', 20) + (repeat === 'one' ? '<i class="mu-one">1</i>' : '');
        LX.$$('.list-item', list).forEach((e, i) => e.classList.toggle('active', i === cur));
        if (audio.paused) stopViz(); else startViz();
      }
      function renderList() {
        list.innerHTML = '';
        queue.forEach((s, i) => list.appendChild(H('div', { class: 'list-item mu-item', onclick: () => play(i), ondblclick: () => play(i), oncontextmenu: (e) => { e.preventDefault(); LX.menu.show(e.clientX, e.clientY, [{ label: 'Play', icon: 'play', action: () => play(i) }, { separator: true }, { label: 'Move to Trash', icon: 'trash', action: () => LX.vfs.rm(s.path) }]); } },
          H('span', { html: LX.icon('music', 16), class: 'muted' }), H('span', { class: 'grow ellipsis', text: s.name.replace(/\.[^.]+$/, '') }), H('span', { class: 'muted mu-size', text: LX.fmtBytes(s.size) }))));
        empty.classList.toggle('hidden', queue.length > 0);
      }
      function load(refreshOnly) {
        const curPath = queue[cur] && queue[cur].path; lib = scan(); queue = lib.slice(); cur = curPath ? queue.findIndex((s) => s.path === curPath) : -1;
        renderList(); sync();
        if (cur < 0 && !audio.paused && !refreshOnly) audio.pause();
      }
      function play(i) {
        if (i < 0 || i >= queue.length) return; cur = i; hist.push(i); if (hist.length > 100) hist.shift();
        const s = queue[i]; let d; try { d = LX.vfs.read(s.path); } catch (e) { LX.dialog.alert('Cannot read ' + s.name); return; }
        audio.src = d; applyVol(); ensureViz();
        audio.play().catch(() => {});
        const name = s.name.replace(/\.[^.]+$/, ''); tTitle.textContent = name; tSub.textContent = LX.vfs.ext(s.path).toUpperCase() + ' · ' + LX.fmtBytes(s.size); win.setTitle('Music — ' + name);
        sync();
      }
      function toggle() { if (cur < 0) { if (queue.length) play(0); return; } audio.paused ? audio.play().catch(() => {}) : audio.pause(); }
      function step(d, auto) {
        if (!queue.length) return;
        if (shuffle && queue.length > 1) { let n; do { n = LX.rand(0, queue.length - 1); } while (n === cur); return play(n); }
        let n = cur + d;
        if (n >= queue.length) { if (repeat === 'all' || !auto) n = 0; else { audio.pause(); audio.currentTime = 0; sync(); return; } }
        if (n < 0) n = queue.length - 1;
        play(n);
      }
      function addFiles(files) {
        Array.from(files || []).forEach((f) => { const r = new FileReader(); r.onload = () => { try { LX.vfs.mkdir(MUSIC); LX.vfs.write(LX.vfs.join(MUSIC, LX.vfs.uniqueName(MUSIC, f.name)), r.result, { mime: f.type || 'audio/mpeg' }); } catch (e) { LX.dialog.alert('Could not add ' + f.name + ': ' + e.message); } }; r.readAsDataURL(f); });
        file.value = '';
      }
      audio.addEventListener('timeupdate', () => { cur_.textContent = fmt(audio.currentTime); if (isFinite(audio.duration)) seek.value = audio.currentTime / audio.duration * 1000; });
      audio.addEventListener('loadedmetadata', () => { dur_.textContent = fmt(audio.duration); });
      audio.addEventListener('play', sync); audio.addEventListener('pause', sync);
      audio.addEventListener('ended', () => { if (repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); } else step(1, true); });
      audio.addEventListener('error', () => { if (audio.src) { tSub.textContent = 'Cannot play this file'; } });

      // Visualizer
      function ensureViz() {
        if (an) return; const ctx = LX.audio.context(); if (!ctx) return;
        try { srcNode = ctx.createMediaElementSource(audio); an = ctx.createAnalyser(); an.fftSize = 128; an.smoothingTimeConstant = 0.8; srcNode.connect(an); an.connect(ctx.destination); } catch (e) { an = null; }
      }
      function draw() {
        raf = requestAnimationFrame(draw);
        const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        const c = canvas.getContext('2d'); c.clearRect(0, 0, w, h);
        const bars = 48, data = new Uint8Array(an ? an.frequencyBinCount : 64); if (an) an.getByteFrequencyData(data);
        const accent = getComputedStyle(body).getPropertyValue('--accent').trim() || '#5B9DFA', bw = w / bars, t = performance.now() / 400;
        c.fillStyle = accent;
        for (let i = 0; i < bars; i++) {
          let v = an ? data[Math.floor(i * data.length / bars)] / 255 : (Math.sin(t + i * 0.4) + 1) / 4;
          const bh = Math.max(3, v * h * 0.9); c.globalAlpha = 0.35 + v * 0.65;
          const x = i * bw + 2; c.beginPath(); c.roundRect ? c.roundRect(x, h - bh, bw - 4, bh, 4) : c.rect(x, h - bh, bw - 4, bh); c.fill();
        }
        c.globalAlpha = 1;
      }
      function startViz() { if (!raf) draw(); }
      function stopViz() { if (raf) { cancelAnimationFrame(raf); raf = 0; } setTimeout(() => { if (audio.paused && !raf) { const c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height); } }, 0); }

      body.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
        const k = e.key;
        if (k === ' ') toggle(); else if (k === 'n' || k === 'N') step(1); else if (k === 'p' || k === 'P') step(-1);
        else if (k === 'ArrowRight') audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5); else if (k === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
        else if (k === 'ArrowUp') { vol = LX.clamp(vol + 0.05, 0, 1); volS.value = vol * 100; applyVol(); } else if (k === 'ArrowDown') { vol = LX.clamp(vol - 0.05, 0, 1); volS.value = vol * 100; applyVol(); } else return;
        e.preventDefault();
      });
      win.setMenu([{ label: 'File', items: [{ label: 'Add music…', action: () => file.click() }, { separator: true }, { label: 'Close', action: () => win.close() }] },
        { label: 'Playback', items: [{ label: 'Play / Pause', shortcut: 'Space', action: toggle }, { label: 'Next', shortcut: 'N', action: () => step(1) }, { label: 'Previous', shortcut: 'P', action: () => step(-1) }, { separator: true }, { label: 'Shuffle', action: () => bShuf.click() }, { label: 'Repeat', action: () => bRep.click() }] }]);
      const off = LX.bus.on('vfs:change', (e) => { if (!e || !e.path || e.path.indexOf(MUSIC) === 0 || e.path === '/' || e.path.indexOf('.Trash') > 0) load(true); });
      win.onClose(() => { off(); stopViz(); audio.pause(); audio.removeAttribute('src'); audio.load(); });
      function openPath(p) { load(true); let i = queue.findIndex((s) => s.path === p); if (i < 0 && LX.vfs.isFile(p)) { queue.unshift(LX.vfs.stat(p)); renderList(); i = 0; } if (i >= 0) play(i); }
      win.on('args', (a) => { if (a && a.path) openPath(a.path); });
      applyVol(); load(); sync();
      if (args && args.path) openPath(args.path);
    },
  });
})();
