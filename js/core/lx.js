/* Leonux Web OS — core namespace, helpers, init queue */
(function () {
  'use strict';
  const LX = (window.LX = window.LX || {});
  LX.version = '2.2.0';
  LX.$ = (s, r) => (r || document).querySelector(s);
  LX.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  LX.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
  LX.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  LX.pad = (n, len) => String(n).padStart(len || 2, '0');
  LX.rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  LX.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  LX.escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  LX.debounce = (fn, ms) => { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms); }; };
  LX.fmtBytes = (n) => {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return (n >= 100 ? n.toFixed(0) : n.toFixed(1)) + ' ' + u[i];
  };
  const D = (d) => (d instanceof Date ? d : new Date(d == null ? Date.now() : d));
  LX.fmtTime = (d, secs) => {
    d = D(d);
    const h24 = !LX.settings || LX.settings.get('clock24') !== false;
    let h = d.getHours(); const m = LX.pad(d.getMinutes()); const s = secs ? ':' + LX.pad(d.getSeconds()) : '';
    if (h24) return LX.pad(h) + ':' + m + s;
    const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return h + ':' + m + s + ' ' + ap;
  };
  LX.fmtDate = (d) => D(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/,/g, ',');
  LX.fmtDateTime = (d) => LX.fmtDate(d) + ' ' + LX.fmtTime(d);
  // deterministic string hash → 0..1 (used by App Store for stable ratings/sizes)
  LX.hash01 = (s) => { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  LX.hash = (s, m) => Math.floor(LX.hash01(s) * (m || 100));
  // seeded RNG helper for stable per-key pseudo data
  LX.seeded = (seed) => { let a = (LX.hash01(seed) * 4294967296) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  LX.stars = (r) => { const full = Math.round(r); return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full); };
  // plural helper
  LX.plural = (n, s) => n + ' ' + s + (n === 1 ? '' : 's');
  // init queue: modules call LX.onInit(fn); main.js runs them once the DOM is ready
  const inits = [];
  LX.onInit = (fn) => inits.push(fn);
  LX.runInit = () => inits.forEach((fn) => { try { fn(); } catch (e) { console.error('[init]', e); } });
})();
