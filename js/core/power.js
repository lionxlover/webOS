/* Leonux Web OS — lock / sleep / restart / shut down */
(function () {
  'use strict';
  const H = LX.h;
  function off() {
    const o = document.getElementById('poweroff'); o.classList.add('show');
    o.innerHTML = ''; o.appendChild(H('div', { class: 'po-box' }, H('div', { class: 'po-ico', html: LX.icon('power', 40) }), H('div', { class: 'po-t', text: 'Leonux is powered off' }), H('button', { class: 'btn primary', text: 'Power on', onclick: () => { o.classList.remove('show'); LX.boot.run().then(() => LX.lock.show()); } })));
  }
  LX.power = {
    lock() { LX.lock.show(); },
    sleep() { const d = document.getElementById('poweroff'); d.classList.add('show', 'sleep'); d.innerHTML = ''; const wake = () => { d.classList.remove('show', 'sleep'); document.removeEventListener('pointerdown', wake, true); document.removeEventListener('keydown', wake, true); LX.lock.show(); }; setTimeout(() => { document.addEventListener('pointerdown', wake, true); document.addEventListener('keydown', wake, true); }, 300); },
    shutdown() { LX.dialog.confirm('Close all windows and shut down?', 'Shut down').then((y) => { if (!y) return; LX.wm.closeAll(); LX.panels.close(); setTimeout(off, 350); }); },
    restart() { LX.dialog.confirm('Close all windows and restart?', 'Restart').then((y) => { if (!y) return; LX.wm.closeAll(); LX.panels.close(); setTimeout(() => { LX.boot.run().then(() => LX.lock.show()); }, 350); }); },
  };
})();
