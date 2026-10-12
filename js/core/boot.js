/* Leonux Web OS — boot animation */
(function () {
  'use strict';
  const H = LX.h;
  const LINES = ['Starting Leonux kernel 2.2', 'Mounting virtual filesystem', 'Preparing multi-file app engine', 'Loading window manager & spaces', 'Starting audio engine', 'Registering applications', 'Connecting live store repositories', 'Optimizing for offline use', 'Welcome'];
  LX.boot = {
    run(fast) {
      return new Promise((resolve) => {
        const el = document.getElementById('boot'); el.innerHTML = ''; el.classList.remove('done'); el.classList.add('show');
        const bar = H('div', { class: 'boot-fill' }), log = H('div', { class: 'boot-log' });
        el.append(H('div', { class: 'boot-logo' }, H('div', { class: 'logo-mark big' }), H('div', { class: 'boot-name', text: 'Leonux' })), H('div', { class: 'boot-bar' }, bar), log);
        let i = 0, done = false;
        const finish = () => { if (done) return; done = true; el.classList.add('done'); setTimeout(() => { el.classList.remove('show', 'done'); resolve(); }, 500); };
        const step = () => {
          if (done) return;
          if (i >= LINES.length) return finish();
          log.textContent = LINES[i]; bar.style.width = Math.round(++i / LINES.length * 100) + '%';
          setTimeout(step, fast ? 40 : 230);
        };
        step();
        const skip = () => { document.removeEventListener('keydown', skip); finish(); };
        document.addEventListener('keydown', skip, { once: true });
      });
    },
  };
})();
