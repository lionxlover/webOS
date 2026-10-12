/* Leonux Web OS — process table derived from open windows (simulated cpu/mem) */
(function () {
  'use strict';
  const stats = {};
  let pidSeq = 1000;
  function statFor(w) {
    if (!stats[w.id]) stats[w.id] = { pid: ++pidSeq, mem: LX.rand(40, 220), cpu: 0, started: Date.now() };
    return stats[w.id];
  }
  LX.proc = {
    list() {
      return LX.wm.list().map((w) => {
        const s = statFor(w); const a = LX.apps.get(w.appId) || {};
        return { pid: s.pid, winId: w.id, appId: w.appId, name: a.name || w.appId, title: w.title, started: s.started, mem: Math.round(s.mem), cpu: +s.cpu.toFixed(1) };
      });
    },
    kill(pid) { const p = LX.proc.list().find((x) => x.pid === pid); if (!p) return false; const w = LX.wm.get(p.winId); if (w) { w.closeHandlers = []; w.close(); } return true; },
  };
  LX.onInit(() => {
    setInterval(() => {
      LX.wm.list().forEach((w) => {
        const s = statFor(w);
        s.cpu = LX.clamp(s.cpu + (Math.random() - 0.5) * 4 + (w.isFocused() ? 0.6 : -0.4), 0, 38);
        s.mem = LX.clamp(s.mem + (Math.random() - 0.5) * 3, 25, 900);
      });
      LX.bus.emit('proc:change');
    }, 2000);
  });
})();
