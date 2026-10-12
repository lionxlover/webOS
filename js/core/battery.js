/* Leonux Web OS — battery + network state (real API when available, simulated otherwise) */
(function () {
  'use strict';
  LX.battery = { level: 0.86, charging: false, real: false };
  LX.onInit(() => {
    const emit = () => LX.bus.emit('battery:change', LX.battery);
    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        const upd = () => { LX.battery.level = b.level; LX.battery.charging = b.charging; LX.battery.real = true; emit(); };
        upd(); b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd);
      }).catch(() => {});
    }
    setInterval(() => {
      if (LX.battery.real) return;
      const d = LX.battery.charging ? 0.002 : -0.0015;
      LX.battery.level = LX.clamp(LX.battery.level + d, 0.05, 1);
      if (LX.battery.level >= 1) LX.battery.charging = false;
      emit();
    }, 15000);
    emit();
  });
  LX.network = {
    get online() { return LX.settings.get('wifi') && !LX.settings.get('airplane'); },
    ssid: 'LeoNet 5G',
  };
})();
