/* Leonux Web OS — 1 Hz clock service ('clock:tick') */
(function () {
  'use strict';
  LX.clock = { now: () => new Date() };
  LX.onInit(() => {
    const tick = () => LX.bus.emit('clock:tick', new Date());
    tick();
    setInterval(tick, 1000);
    LX.bus.on('settings:change', (e) => { if (e.key === 'clock24') tick(); });
  });
})();
