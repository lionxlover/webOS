/* Leonux Web OS — lock screen */
(function () {
  'use strict';
  const H = LX.h;
  let el, timeEl, dateEl, pwIn, err, locked = false;
  function unlock() {
    const need = LX.settings.get('password');
    if (need && pwIn.value !== need) { err.textContent = 'Incorrect password'; el.querySelector('.lk-card').classList.remove('shake'); void el.offsetWidth; el.querySelector('.lk-card').classList.add('shake'); pwIn.value = ''; LX.audio.beep(180, 0.15, 'square', 0.1); return; }
    locked = false; el.classList.add('unlocking'); pwIn.value = ''; err.textContent = '';
    LX.audio.event('unlock');
    setTimeout(() => { el.classList.remove('show', 'unlocking'); }, 450);
    LX.bus.emit('lock:change', false);
  }
  LX.lock = {
    get locked() { return locked; },
    show() {
      locked = true; LX.panels.close(); LX.menu.close();
      el.classList.remove('unlocking'); el.classList.add('show');
      pwIn.style.display = LX.settings.get('password') ? '' : 'none';
      el.querySelector('.lk-hint').textContent = LX.settings.get('password') ? 'Enter your password' : 'Click or press Enter to unlock';
      setTimeout(() => (LX.settings.get('password') ? pwIn : el).focus(), 60);
      LX.bus.emit('lock:change', true);
    },
    unlock,
  };
  LX.onInit(() => {
    el = document.getElementById('lock'); if (!el) return;
    timeEl = H('div', { class: 'lk-time' }); dateEl = H('div', { class: 'lk-date' });
    pwIn = H('input', { class: 'input lk-pw', type: 'password', placeholder: 'Password', autocomplete: 'off', onkeydown: (e) => { if (e.key === 'Enter') { e.stopPropagation(); unlock(); } } });
    err = H('div', { class: 'lk-err' });
    el.tabIndex = 0;
    el.append(timeEl, dateEl, H('div', { class: 'lk-card' }, H('div', { class: 'lk-avatar', text: (LX.settings.get('fullname') || 'L')[0] }), H('div', { class: 'lk-name', text: LX.settings.get('fullname') }), pwIn, err, H('div', { class: 'lk-hint' })),
      H('div', { class: 'lk-foot', text: 'Leonux OS' }));
    el.addEventListener('click', (e) => { if (!LX.settings.get('password') && locked) unlock(); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !LX.settings.get('password') && locked) unlock(); });
    LX.bus.on('clock:tick', (d) => { timeEl.textContent = LX.fmtTime(d); dateEl.textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); });
    LX.bus.on('settings:change', (e) => { if (e.key === 'fullname') { el.querySelector('.lk-name').textContent = e.value; el.querySelector('.lk-avatar').textContent = (e.value || 'L')[0]; } });
  });
})();
