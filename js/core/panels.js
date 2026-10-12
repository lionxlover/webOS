/* Leonux Web OS — exclusive popup panels (launcher, control center, notification center) */
(function () {
  'use strict';
  const panels = {};
  let current = null;
  LX.panels = {
    register(name, el, opts) { panels[name] = { el, opts: opts || {} }; el.classList.add('panel'); },
    open(name) {
      const p = panels[name]; if (!p) return;
      if (current && current !== name) this.close();
      p.el.classList.add('open'); current = name;
      if (p.opts.onOpen) p.opts.onOpen();
      LX.bus.emit('panel:open', name);
    },
    close() {
      if (!current) return;
      const p = panels[current]; const n = current; current = null;
      p.el.classList.remove('open');
      if (p.opts.onClose) p.opts.onClose();
      LX.bus.emit('panel:close', n);
    },
    toggle(name) { current === name ? this.close() : this.open(name); },
    current() { return current; },
  };
  document.addEventListener('pointerdown', (e) => {
    if (!current) return;
    const p = panels[current];
    if (p.el.contains(e.target) || e.target.closest('[data-panel-trigger]') || e.target.closest('.ctx-menu')) return;
    LX.panels.close();
  }, true);
  window.addEventListener('blur', () => { /* keep panels open when iframe takes focus */ });
})();
