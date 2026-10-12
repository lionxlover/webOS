/* Leonux OS 2.1 — WebAudio engine: beeps, system volume, UI sound events and
   installable sound packs (from store repositories).
   A sound pack defines short synth "notes" per event:
     "startup": [{ "f": 523.25, "t": 0, "d": 0.5, "w": "sine", "v": 0.5 }, ...]
     f = frequency (Hz) · t = start (s) · d = duration (s) · w = waveform · v = volume 0..1 */
(function () {
  'use strict';
  let ctx = null;
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // ---- built-in pack ("Leonux") ----
  const BUILTIN = {
    id: 'leonux', name: 'Leonux (built-in)', builtIn: true,
    sounds: {
      startup: [{ f: 392, t: 0, d: 0.45, w: 'sine', v: 0.4 }, { f: 523.25, t: 0.14, d: 0.45, w: 'sine', v: 0.4 }, { f: 659.25, t: 0.28, d: 0.5, w: 'sine', v: 0.42 }, { f: 783.99, t: 0.42, d: 0.7, w: 'sine', v: 0.45 }],
      shutdown: [{ f: 659.25, t: 0, d: 0.3, w: 'sine', v: 0.35 }, { f: 523.25, t: 0.13, d: 0.3, w: 'sine', v: 0.32 }, { f: 392, t: 0.26, d: 0.5, w: 'sine', v: 0.3 }],
      unlock: [{ f: 587.33, t: 0, d: 0.12, w: 'sine', v: 0.3 }, { f: 880, t: 0.09, d: 0.18, w: 'sine', v: 0.26 }],
      lock: [{ f: 880, t: 0, d: 0.12, w: 'sine', v: 0.26 }, { f: 587.33, t: 0.09, d: 0.18, w: 'sine', v: 0.28 }],
      launch: [{ f: 740, t: 0, d: 0.06, w: 'sine', v: 0.12 }],
      notify: [{ f: 660, t: 0, d: 0.12, w: 'sine', v: 0.15 }, { f: 880, t: 0.09, d: 0.18, w: 'sine', v: 0.13 }],
      install: [{ f: 523.25, t: 0, d: 0.12, w: 'sine', v: 0.28 }, { f: 659.25, t: 0.1, d: 0.12, w: 'sine', v: 0.28 }, { f: 987.77, t: 0.2, d: 0.3, w: 'sine', v: 0.3 }],
      error: [{ f: 196, t: 0, d: 0.18, w: 'square', v: 0.1 }, { f: 155.56, t: 0.15, d: 0.24, w: 'square', v: 0.1 }],
      trash: [{ f: 493.88, t: 0, d: 0.09, w: 'triangle', v: 0.22 }, { f: 329.63, t: 0.07, d: 0.09, w: 'triangle', v: 0.2 }, { f: 220, t: 0.14, d: 0.16, w: 'triangle', v: 0.2 }],
      click: [{ f: 900, t: 0, d: 0.03, w: 'sine', v: 0.08 }],
    },
  };
  const packs = { leonux: BUILTIN };

  function playNotes(notes, vol) {
    const c = ac();
    if (!c || !notes || !notes.length) return;
    const now = c.currentTime;
    const master = vol == null ? 1 : vol;
    notes.forEach((n) => {
      if (!n || !n.f) return;
      try {
        const o = c.createOscillator(), g = c.createGain();
        o.type = n.w || 'sine';
        o.frequency.setValueAtTime(n.f, now + (n.t || 0));
        if (n.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, n.slide), now + (n.t || 0) + (n.d || 0.1));
        const v = (n.v == null ? 0.3 : n.v) * master;
        const t0 = now + (n.t || 0), dur = n.d || 0.12;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + Math.min(0.02, dur * 0.2));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(c.destination);
        o.start(t0); o.stop(t0 + dur + 0.03);
      } catch (e) { /* skip bad note */ }
    });
  }

  function activePack() {
    const id = LX.settings.get('soundPack') || 'leonux';
    return packs[id] || packs.leonux;
  }

  LX.audio = {
    get volume() { return LX.clamp((LX.settings.get('volume') || 0) / 100, 0, 1); },
    context: ac,
    packs,
    packList() { return Object.keys(packs).map((k) => packs[k]); },
    addPack(def) { if (def && def.id && def.sounds) packs[def.id] = Object.assign({}, def, { name: def.name || def.id }); },
    removePack(id) {
      if (!packs[id] || packs[id].builtIn) return;
      delete packs[id];
      if (LX.settings.get('soundPack') === id) LX.settings.set('soundPack', 'leonux');
    },
    activePackId() { return activePack().id; },
    previewPack(def, event) { if (def && def.sounds) playNotes(def.sounds[event] || def.sounds.click || null, this.volume); },
    playFrom(packId, event) { const p = packs[packId]; if (!p) return; playNotes(p.sounds[event] || p.sounds.click || BUILTIN.sounds.click, this.volume); },
    event(name) {
      if (LX.settings.get('muted')) return;
      const p = activePack();
      playNotes(p.sounds[name] || null, this.volume);
    },
    beep(freq, dur, type, vol) {
      const c = ac(); if (!c || this.volume === 0) return;
      freq = freq || 440; dur = dur || 0.1; vol = vol == null ? 0.2 : vol;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      const v = vol * this.volume;
      g.gain.setValueAtTime(v, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
    },
    chime() { this.event('notify'); },
  };
})();
