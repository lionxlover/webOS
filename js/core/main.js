/* Leonux OS 2 — entry point: boot → OOBE (first run) → lock screen → desktop.
   Also handles ?app= deep links from PWA shortcuts. */
(function () {
  'use strict';
  window.addEventListener('error', (e) => { console.error('[os]', e.message); });
  function start() {
    LX.runInit();
    const params = new URLSearchParams(location.search);
    const fast = params.has('fast') || params.has('nolock');
    LX.boot.run(fast).then(() => {
      const proceed = () => {
        if (!params.has('nolock')) LX.lock.show();
        LX.bus.emit('os:ready');
        try { LX.audio.event('startup'); } catch (e) { /* autoplay may be blocked before first gesture */ }
        if (!LX.store.get('welcomed', false)) {
          LX.store.set('welcomed', true);
          setTimeout(() => LX.notify({ title: 'Welcome to Leonux OS 2', body: 'Ctrl+Space to search · Meta key for the launcher · Ctrl+Alt+↑ for Mission Control.', icon: 'star', timeout: 8000 }), 800);
        }
        // deep link from PWA shortcut (?app=files etc.)
        const app = params.get('app');
        if (app && LX.apps.get(app) && !LX.apps.get(app).hidden) setTimeout(() => LX.apps.launch(app), 1200);
      };
      if (LX.oobe.needed() && !params.has('nolock') && !params.has('nooobe')) { LX.oobe.run(proceed); }
      else proceed();
    });
    document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input,textarea,[contenteditable]')) e.preventDefault(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
