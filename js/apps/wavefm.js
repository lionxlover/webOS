/* Store app — Wave FM: generative ambient radio, 100% synthesized with WebAudio. */
(function () {
  'use strict';
  const H = LX.h;

  LX.apps.register({
    id: 'wavefm', name: 'Wave FM', icon: 'radio', color: '#CBA6F7', category: 'Media',
    pkg: true, pkgVersion: '1.1', pkgSize: 12, developer: 'Moonlit Byte', downloads: 830,
    desc: 'Generative ambient radio', longDesc: 'Four channels of endless generative music, synthesized live in your browser — lo-fi chords, rain, drones and bells. No audio files, no streaming, no internet: pure WebAudio.',
    permissions: ['Audio output'], changelog: 'New visualizer, calmer nights channel.',
    singleton: true,
    width: 760, height: 560, minWidth: 440, minHeight: 460,
    open(win) {
      const CHANNELS = [
        { name: 'Lo-Fi Groove', bg: 'linear-gradient(140deg,#2a1e3a,#4a3358)', desc: 'Dusty chords & lazy drums', chords: [[0, 3, 7, 10], [-2, 2, 5, 9]], root: 220, drums: true, noise: 0.02, bell: false },
        { name: 'Rainy Jazz', bg: 'linear-gradient(140deg,#12202e,#1d3a52)', desc: 'Muted keys with rain', chords: [[0, 4, 7, 11], [-3, 0, 4, 7]], root: 196, drums: false, noise: 0.16, bell: false },
        { name: 'Space Drone', bg: 'linear-gradient(140deg,#0e0c1e,#231a3a)', desc: 'Deep pads for focus', chords: [[0, 7, 12, 19]], root: 110, drums: false, noise: 0.04, bell: true },
        { name: 'Morning Birds', bg: 'linear-gradient(140deg,#14351e,#2d5a37)', desc: 'Warm winds & chimes', chords: [[0, 5, 9, 14], [2, 7, 11, 16]], root: 262, drums: false, noise: 0.07, bell: true },
      ];
      let ch = 0, playing = false, nodes = null, timer = null;
      let step = 0;

      const canvas = H('canvas', { class: 'wf-viz' });
      const cctx = canvas.getContext('2d');
      const title = H('div', { class: 'wf-name' });
      const sub = H('div', { class: 'wf-sub muted' });
      const eq = H('div', { class: 'wf-eq' }, [0, 1, 2, 3, 4].map(() => H('span')));

      function audio() { const c = LX.audio.context(); return c; }

      function start() {
        const ac = audio(); if (!ac) return;
        stop(true);
        const conf = CHANNELS[ch];
        const master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
        const filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 1800; filt.connect(master);
        // noise bed
        let noiseSrc = null;
        if (conf.noise > 0) {
          const len = ac.sampleRate * 2;
          const buf = ac.createBuffer(1, len, ac.sampleRate);
          const d = buf.getChannelData(0);
          let lastV = 0;
          for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; lastV = lastV * .96 + w * .04; d[i] = lastV * conf.noise * 6; }
          noiseSrc = ac.createBufferSource(); noiseSrc.buffer = buf; noiseSrc.loop = true;
          const ng = ac.createGain(); ng.gain.value = .5;
          noiseSrc.connect(ng); ng.connect(filt); noiseSrc.start();
        }
        const chordGain = ac.createGain(); chordGain.gain.value = .5; chordGain.connect(filt);
        nodes = { master, filt, chordGain, noiseSrc, oscs: [] };
        master.gain.linearRampToValueAtTime(LX.audio.volume * .8, ac.currentTime + 1.2);

        const beatLen = conf.drums ? 0.5 : 1.6;
        const tick = () => {
          if (!nodes) return;
          const t = ac.currentTime + .06;
          const set = conf.chords[step % conf.chords.length];
          set.forEach((semi, i) => {
            const f = conf.root * Math.pow(2, semi / 12);
            const o = ac.createOscillator(); o.type = i === 0 ? 'triangle' : 'sine';
            o.frequency.value = f * (i === 0 ? 1 : 1.001);
            const g = ac.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(.16 / (i + 1), t + .12);
            g.gain.exponentialRampToValueAtTime(.002, t + beatLen * 1.8);
            o.connect(g); g.connect(chordGain);
            o.start(t); o.stop(t + beatLen * 2);
            nodes.oscs.push(o);
          });
          if (conf.drums && step % 2 === 0) {
            // kick
            const o = ac.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(46, t + .12);
            const g = ac.createGain(); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .22);
            o.connect(g); g.connect(master); o.start(t); o.stop(t + .3);
          }
          if (conf.drums && step % 2 === 1) {
            // hat
            const len = 2200; const b = ac.createBuffer(1, len, ac.sampleRate); const d = b.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
            const s = ac.createBufferSource(); s.buffer = b;
            const hg = ac.createGain(); hg.gain.value = .12;
            const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
            s.connect(hp); hp.connect(hg); hg.connect(master); s.start(t);
          }
          if (conf.bell && step % 4 === 2) {
            const scale = [0, 3, 5, 7, 10, 12, 15];
            const f = conf.root * 4 * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12);
            const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
            const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + 1.4);
            o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.5);
          }
          step++;
        };
        tick(); timer = setInterval(tick, (conf.drums ? 0.5 : 1.6) * 1000);
        playing = true;
        vizOn();
      }
      function stop(quiet) {
        if (timer) clearInterval(timer); timer = null;
        if (nodes) {
          try { nodes.master.gain.linearRampToValueAtTime(0, audio().currentTime + .4); } catch (e) {}
          const n = nodes;
          setTimeout(() => { try { n.noiseSrc && n.noiseSrc.stop(); } catch (e) {} try { n.master.disconnect(); } catch (e) {} }, 600);
          nodes = null;
        }
        playing = false;
        if (!quiet) { vizOff(); }
      }

      // visualizer
      let vizT = null;
      function vizOn() {
        vizT = requestAnimationFrame(vizOn);
        const W = canvas.width = canvas.clientWidth, Hh = canvas.height = canvas.clientHeight;
        cctx.clearRect(0, 0, W, Hh);
        const t = performance.now() / 1000;
        for (let i = 0; i < 5; i++) {
          const a = playing ? (Math.sin(t * (1.1 + i * .35)) * .5 + .5) : .06;
          const r = Math.min(W, Hh) * (.18 + a * .12 + i * .07);
          cctx.beginPath();
          cctx.arc(W / 2, Hh / 2, r, 0, 7);
          cctx.strokeStyle = 'hsla(' + (255 + i * 18 - (playing ? 0 : 40)) + ',60%,' + (55 + a * 25) + '%,' + (.5 - i * .08) + ')';
          cctx.lineWidth = 2 + a * 3;
          cctx.stroke();
        }
        const bars = eq.children;
        for (let i = 0; i < bars.length; i++) bars[i].style.height = (playing ? 6 + Math.abs(Math.sin(t * (1.4 + i * .5))) * 18 : 4) + 'px';
      }
      function vizOff() { if (vizT) cancelAnimationFrame(vizT); cctx.clearRect(0, 0, canvas.width, canvas.height); for (const b of eq.children) b.style.height = '4px'; }

      function paintCh() {
        const c = CHANNELS[ch];
        title.textContent = c.name; sub.textContent = c.desc + ' · generative · no files, no stream';
        win.body.style.setProperty('bg', '');
      }
      const playBtn = H('button', { class: 'btn primary wf-play', html: LX.icon('play', 16) + ' Play', onclick: () => { playing ? stop() : start(); paintBtn(); } });
      function paintBtn() { playBtn.innerHTML = (playing ? LX.icon('pause', 16) + ' Pause' : LX.icon('play', 16) + ' Play'); }
      const chRow = H('div', { class: 'wf-channels' }, CHANNELS.map((c, i) => H('button', { class: 'wf-ch' + (i === ch ? ' on' : ''), style: { background: c.bg }, onclick: () => { ch = i; paintCh(); LX.$$('.wf-ch', win.body).forEach((b, j) => b.classList.toggle('on', j === ch)); if (playing) { start(); } } },
        H('b', { text: c.name }), H('span', { class: 'muted', style: { fontSize: '11px' }, text: c.desc }))));

      win.body.append(
        H('div', { class: 'wf-hero' }, canvas, H('div', { class: 'wf-hero-txt' }, title, sub, eq)),
        H('div', { class: 'toolbar' }, playBtn,
          H('button', { class: 'btn ghost', html: LX.icon('shuffle', 14), title: 'Random channel', onclick: () => { ch = LX.rand(0, CHANNELS.length - 1); paintCh(); LX.$$('.wf-ch', win.body).forEach((b, j) => b.classList.toggle('on', j === ch)); if (playing) start(); } })),
        chRow);
      paintCh(); paintBtn();
      win.onClose(() => stop(true));
    },
  });
})();
