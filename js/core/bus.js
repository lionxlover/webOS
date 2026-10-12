/* Leonux Web OS — event bus */
(function () {
  'use strict';
  const map = {};
  LX.bus = {
    on(evt, fn) { (map[evt] = map[evt] || new Set()).add(fn); return () => LX.bus.off(evt, fn); },
    off(evt, fn) { if (map[evt]) map[evt].delete(fn); },
    emit(evt, data) {
      if (!map[evt]) return;
      Array.from(map[evt]).forEach((fn) => { try { fn(data); } catch (e) { console.error('[bus ' + evt + ']', e); } });
    },
  };
})();
