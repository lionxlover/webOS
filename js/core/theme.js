/* Leonux Web OS — theme engine: light/dark, accent, wallpaper, brightness, night light, font scale */
(function () {
  'use strict';
  const W = {
    aurora: { name: 'Aurora', css: 'radial-gradient(60% 50% at 20% 15%, rgba(91,157,250,.55), transparent 70%), radial-gradient(55% 45% at 85% 20%, rgba(203,166,247,.45), transparent 70%), radial-gradient(70% 60% at 60% 95%, rgba(46,160,140,.4), transparent 70%), #07080d' },
    sunset: { name: 'Sunset', css: 'radial-gradient(70% 60% at 80% 100%, rgba(255,120,80,.65), transparent 70%), radial-gradient(60% 50% at 10% 20%, rgba(190,80,160,.5), transparent 70%), linear-gradient(160deg,#1a1030,#2b1236 60%,#4a1d2e)' },
    ocean: { name: 'Ocean', css: 'radial-gradient(80% 60% at 50% 110%, rgba(0,200,200,.5), transparent 70%), radial-gradient(60% 50% at 20% 10%, rgba(40,100,220,.55), transparent 70%), linear-gradient(180deg,#04122a,#062544)' },
    forest: { name: 'Forest', css: 'radial-gradient(60% 50% at 80% 10%, rgba(158,206,106,.4), transparent 70%), radial-gradient(70% 60% at 15% 100%, rgba(20,120,90,.5), transparent 70%), linear-gradient(170deg,#06150f,#0b261b)' },
    nebula: { name: 'Nebula', css: 'radial-gradient(50% 40% at 30% 30%, rgba(160,80,255,.55), transparent 70%), radial-gradient(45% 40% at 75% 65%, rgba(255,80,160,.4), transparent 70%), radial-gradient(40% 40% at 60% 15%, rgba(60,120,255,.35), transparent 70%), #08040f' },
    graphite: { name: 'Graphite', css: 'radial-gradient(70% 60% at 50% 0%, rgba(255,255,255,.1), transparent 70%), linear-gradient(180deg,#14161b,#08090c)' },
    dawn: { name: 'Dawn', css: 'radial-gradient(70% 55% at 50% 100%, rgba(255,200,120,.7), transparent 70%), radial-gradient(60% 50% at 85% 10%, rgba(255,150,170,.5), transparent 70%), linear-gradient(180deg,#31456e,#8a6a8f 70%,#e0a67a)' },
    midnight: { name: 'Midnight', css: 'radial-gradient(50% 40% at 70% 20%, rgba(70,90,200,.35), transparent 70%), linear-gradient(180deg,#02030a,#070a1c)' },
    paper: { name: 'Paper', css: 'radial-gradient(70% 60% at 30% 10%, rgba(255,255,255,.9), transparent 70%), linear-gradient(180deg,#dfe4ee,#c3cbdb)' },
    savanna: { name: 'Savanna', css: 'radial-gradient(60% 45% at 15% 20%, rgba(246,193,119,.5), transparent 65%), radial-gradient(55% 40% at 85% 15%, rgba(235,111,146,.45), transparent 65%), radial-gradient(75% 60% at 55% 100%, rgba(158,206,106,.5), transparent 70%), linear-gradient(165deg,#2a1e14,#49321f 55%,#7a5a33)' },
    glacier: { name: 'Glacier', css: 'radial-gradient(50% 40% at 20% 25%, rgba(77,208,225,.5), transparent 65%), radial-gradient(45% 40% at 80% 20%, rgba(91,157,250,.55), transparent 65%), radial-gradient(70% 55% at 50% 105%, rgba(137,220,235,.45), transparent 70%), linear-gradient(170deg,#041522,#0a2b3d 60%,#12495f)' },
    blossom: { name: 'Blossom', css: 'radial-gradient(55% 45% at 25% 20%, rgba(244,143,177,.55), transparent 65%), radial-gradient(50% 40% at 85% 25%, rgba(203,166,247,.5), transparent 65%), radial-gradient(65% 55% at 55% 100%, rgba(255,138,101,.4), transparent 70%), linear-gradient(160deg,#1c1020,#3a1c33 55%,#5c2b4a)' },
    volcano: { name: 'Volcano', css: 'radial-gradient(60% 50% at 50% 110%, rgba(255,107,53,.65), transparent 70%), radial-gradient(45% 35% at 20% 15%, rgba(255,158,100,.4), transparent 65%), linear-gradient(175deg,#170806,#31100c 55%,#662018)' },
    solar: { name: 'Solar', css: 'radial-gradient(55% 45% at 80% 20%, rgba(255,209,102,.6), transparent 65%), radial-gradient(45% 40% at 15% 80%, rgba(255,138,101,.5), transparent 65%), radial-gradient(40% 35% at 55% 50%, rgba(246,193,119,.45), transparent 65%), linear-gradient(160deg,#1e1503,#4a3410 60%,#8a642a)' },
    prism: { name: 'Prism', css: 'conic-gradient(from 120deg at 70% 20%, rgba(91,157,250,.5), rgba(203,166,247,.45), rgba(244,143,177,.45), rgba(158,206,106,.45), rgba(77,208,225,.5), rgba(91,157,250,.5)), #08090f' },
    aurora2: { name: 'Aurora Borealis', css: 'radial-gradient(70% 40% at 20% 90%, rgba(94,231,223,.55), transparent 60%), radial-gradient(50% 35% at 70% 15%, rgba(91,157,250,.5), transparent 60%), radial-gradient(40% 30% at 40% 40%, rgba(158,206,106,.35), transparent 60%), linear-gradient(180deg,#02040c,#052633)' },
  };
  /* Dynamic wallpaper: sky gradient + sun/moon glow that follow the local time of day */
  const SKY = [[0, '#04061a', '#0b1233'], [5, '#0c1438', '#2b2f63'], [6.5, '#3b4a85', '#e8a07c'], [9, '#4a8ee8', '#a6d6f7'], [13, '#2a74dc', '#8fcaff'], [16.5, '#3f6bb8', '#f0c07a'], [18.5, '#4a2d6e', '#e0667c'], [20.5, '#150f35', '#3a2150'], [24, '#04061a', '#0b1233']];
  const hx = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => { const x = hx(a), y = hx(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')'; };
  function dynamicCss(d) {
    d = d || new Date(); const h = d.getHours() + d.getMinutes() / 60;
    let i = 0; while (i < SKY.length - 2 && h >= SKY[i + 1][0]) i++;
    const a = SKY[i], b = SKY[i + 1], t = LX.clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
    const top = mix(a[1], b[1], t), bot = mix(a[2], b[2], t);
    const day = h >= 6 && h < 18.5; const p = day ? (h - 6) / 12.5 : ((h >= 18.5 ? h - 18.5 : h + 5.5) / 11);
    const sx = Math.round(12 + p * 76), sy = Math.round(70 - Math.sin(p * Math.PI) * 52);
    const glow = day ? 'rgba(255,236,190,.75)' : 'rgba(190,205,255,.35)';
    return 'radial-gradient(22% 28% at ' + sx + '% ' + sy + '%, ' + glow + ', transparent 70%), radial-gradient(70% 50% at 50% 110%, ' + bot + ', transparent 75%), linear-gradient(180deg,' + top + ',' + bot + ')';
  }
  Object.defineProperty(W, 'dynamic', { enumerable: true, value: { name: 'Dynamic', get css() { return dynamicCss(); } } });
  const ACCENTS = ['#5B9DFA', '#9ECE6A', '#F6C177', '#F28B82', '#CBA6F7', '#4DD0E1', '#FF8A65', '#F48FB1'];
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lum(hex) { const [r, g, b] = rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  function isDark() {
    const t = LX.settings.get('theme');
    if (t === 'auto') return !(window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
    return t !== 'light';
  }
  /* Dynamic themes installed from store repositories. Each: {id,name,css,accent,mode} */
  const dynamicThemes = {};
  function dynOf(id) { return dynamicThemes[id] || null; }
  function addDynamic(def) {
    if (!def || !def.id) return;
    dynamicThemes[def.id] = {
      id: def.id, name: def.name || def.id, css: def.wallpaper,
      accent: /^#[0-9a-f]{3,8}$/i.test(def.accent || '') ? def.accent : null,
      mode: def.mode === 'light' || def.mode === 'dark' ? def.mode : null,
    };
    apply();
  }
  function removeDynamic(id) {
    delete dynamicThemes[id];
    if (LX.settings.get('wallpaper') === id) {
      LX.settings.set('wallpaper', 'aurora');
      LX.settings.set('theme', 'dark');
    }
    apply();
  }
  function applyDynamic(id) {
    const d = dynamicThemes[id];
    if (!d) return false;
    LX.settings.set('wallpaper', id);
    if (d.accent) LX.settings.set('accent', d.accent);
    if (d.mode) LX.settings.set('theme', d.mode);
    apply();
    return true;
  }
  function apply() {
    const s = LX.settings, root = document.documentElement;
    root.setAttribute('data-theme', isDark() ? 'dark' : 'light');
    const dyn = dynOf(s.get('wallpaper'));
    if (dyn && dyn.accent) root.style.setProperty('--accent-override', dyn.accent);
    else root.style.removeProperty('--accent-override');
    const a = dyn && dyn.accent ? dyn.accent : (/^#[0-9a-f]{6}$/i.test(s.get('accent')) ? s.get('accent') : '#5B9DFA');
    const [r, g, b] = rgb(a);
    root.style.setProperty('--accent', a);
    root.style.setProperty('--accent-glow', 'rgba(' + r + ',' + g + ',' + b + ',.35)');
    root.style.setProperty('--accent-rgb', r + ',' + g + ',' + b);
    root.style.setProperty('--accent-fg', lum(a) > 0.4 ? '#0a0f1a' : '#ffffff');
    const wp = dyn ? { css: dyn.css } : W[s.get('wallpaper')];
    const wall = document.getElementById('wallpaper');
    if (wall) {
      const custom = s.get('wallpaper') && String(s.get('wallpaper')).indexOf('data:') === 0;
      wall.style.background = custom ? 'center/cover url("' + s.get('wallpaper') + '")' : (wp || W.aurora).css;
    }
    const dim = document.getElementById('dim');
    if (dim) dim.style.opacity = String(LX.clamp(1 - s.get('brightness') / 100, 0, 0.8));
    const night = document.getElementById('night');
    if (night) night.style.opacity = s.get('nightLight') ? '1' : '0';
    root.style.setProperty('--font-scale', String(s.get('fontScale') / 100));
    root.style.fontSize = (16 * s.get('fontScale') / 100) + 'px';
    root.classList.toggle('no-anim', !s.get('animations'));
    root.classList.toggle('hc', !!s.get('highContrast'));
    document.body.classList.toggle('tb-top', s.get('taskbarPos') === 'top' && s.get('layout') === 'taskbar');
    root.classList.toggle('batt-saver', !!s.get('battSaver'));
  }
  LX.theme = { dynamicCss, wallpapers: W, accents: ACCENTS, apply, isDark, dynamic: dynamicThemes, addDynamic, removeDynamic, applyDynamic };
  LX.onInit(() => {
    apply();
    LX.bus.on('settings:change', apply);
    setInterval(() => { if (LX.settings.get('wallpaper') === 'dynamic') apply(); }, 60000);
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
  });
})();
