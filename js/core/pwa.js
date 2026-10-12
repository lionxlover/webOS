/* Leonux OS 2 — PWA layer: service worker registration, install-to-system prompt,
   offline/online events and update flow. This is what makes first-run install
   produce a real, offline-capable app on the user's system. */
(function () {
  'use strict';
  const H = LX.h;
  let deferredPrompt = null;
  let installed = false; // standalone or display-mode
  const swPath = 'sw.js';
  let regP = null;

  function mode() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone ? 'standalone' : 'browser'; }

  LX.pwa = {
    get installed() { return installed; },
    get canInstall() { return !!deferredPrompt; },
    get offlineReady() { return !!navigator.serviceWorker && !!LX.store.get('pwa.cached', false); },
    /* Where is the system running, and can it register an offline worker here? */
    get context() {
      const p = location.protocol;
      if (p === 'file:') return 'file';
      if (!('serviceWorker' in navigator)) return 'unsupported';
      if (p === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '[::1]') return 'secure';
      return 'insecure';
    },
    /* Register sw.js (idempotent) and wait until it is active. Always resolves with a status object, never rejects. */
    register(timeout) {
      if (regP) return regP;
      const ctx = LX.pwa.context;
      const out = (ok, extra) => Object.assign({ ok, context: ctx, controlled: !!(navigator.serviceWorker && navigator.serviceWorker.controller) }, extra || {});
      if (ctx !== 'secure') return (regP = Promise.resolve(out(false, { reason: ctx })));
      regP = navigator.serviceWorker.register(swPath).then((reg) => {
        LX.store.set('pwa.sw', true);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              LX.notify({ title: 'Leonux update ready', body: 'A new version is installed. Restart to apply it.', icon: 'refresh2', timeout: 9000, args: { restart: true } });
            }
          });
        });
        navigator.serviceWorker.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'OFFLINE_READY') { LX.store.set('pwa.cached', true); LX.bus.emit('pwa:ready'); }
        });
        navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage({ type: 'CHECK_CACHED' });
        const ready = navigator.serviceWorker.ready.then(() => {
          LX.store.set('pwa.cached', true); LX.bus.emit('pwa:ready');
          return out(true, { scope: reg.scope });
        });
        const limit = new Promise((res) => setTimeout(() => res(out(!!reg.active || !!reg.installing, { scope: reg.scope, slow: true })), timeout || 9000));
        return Promise.race([ready, limit]);
      }).catch((e) => out(false, { reason: 'error', error: String((e && e.message) || e) }));
      return regP;
    },
    promptInstall() {
      if (!deferredPrompt) return Promise.resolve(false);
      const p = deferredPrompt; deferredPrompt = null;
      return p.prompt().then(() => p.userChoice).then((c) => {
        if (c && c.outcome === 'accepted') LX.notify({ title: 'Installing Leonux', body: 'Find it on your desktop / app list. It runs fully offline.', icon: 'rocket', appId: 'softwarecenter' });
        return c && c.outcome === 'accepted';
      }).catch(() => false);
    },
    checkForUpdates() {
      if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return Promise.resolve(false);
      return new Promise((res) => {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (!reg) return res(false);
          reg.update().then(() => res(true)).catch(() => res(false));
        }).catch(() => res(false));
      });
    },
  };

  LX.onInit(() => {
    installed = mode() === 'standalone';
    // --- service worker ---
    LX.pwa.register().catch(() => {});
    // --- install prompt ---
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); deferredPrompt = e;
      LX.bus.emit('pwa:caninstall');
      if (!installed) LX.notify({ title: 'Install Leonux OS', body: 'Add it to your system for a full offline desktop experience.', icon: 'rocket', timeout: 8000, appId: 'settings', args: { page: 'system' } });
    });
    window.addEventListener('appinstalled', () => {
      installed = true; deferredPrompt = null;
      LX.notify({ title: 'Leonux installed', body: 'Launch it from your system app list. Works offline.', icon: 'check-circle' });
      LX.bus.emit('pwa:installed');
    });
    // --- connectivity ---
    const onOff = () => {
      if (!navigator.onLine) LX.notify({ title: 'You are offline', body: 'No problem — every Leonux app keeps working.', icon: 'cloud', timeout: 4000 });
    };
    window.addEventListener('online', onOff);
    window.addEventListener('offline', onOff);
    if (!navigator.onLine && !LX.store.get('pwa.offlineShown', false)) {
      LX.store.set('pwa.offlineShown', true);
      setTimeout(onOff, 2500);
    }
    // notification tap that asked for restart → power.restart()
    LX.bus.on('notify', (n) => { if (n.args && n.args.restart) { /* handled by launcher click through args */ } });
  });
})();
