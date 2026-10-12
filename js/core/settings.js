/* Leonux Web OS — persistent system settings */
(function () {
  'use strict';
  const DEFAULTS = {
    theme: 'dark', accent: '#5B9DFA', wallpaper: 'aurora', brightness: 100, volume: 70,
    wifi: true, bluetooth: false, airplane: false, dnd: false, clock24: true,
    username: 'leo', fullname: 'Leo Lion', hostname: 'leonux-pc', password: '',
    animations: true, fontScale: 100, highContrast: false, taskbarPos: 'bottom',
    lang: 'en', nightLight: false, battSaver: false, widgets: true,
    pinned: ['files', 'browser', 'terminal', 'notes', 'softwarecenter', 'settings'], autoLock: false,
    dock: true, dockMagnify: true, layout: 'dock+menubar', menusInWindow: false, dockAutoHide: false, mbSeconds: false, mbDate: true, mbBattPct: true, titlebar: 'vibrant', snapFlyout: true, focus: '', screensaver: 'starfield', screensaverMin: 5, screensaverLock: false, hotCorners: { tl: 'mc', tr: 'none', bl: 'none', br: 'desktop' }, desktopSort: 'name', dockSize: 46, spaces: true, notifSound: true,
  };
  let data = Object.assign({}, DEFAULTS, LX.store.get('settings', {}));
  LX.settings = {
    defaults: DEFAULTS,
    get(key) { return data[key]; },
    all() { return Object.assign({}, data); },
    set(key, value) {
      if (data[key] === value) return value;
      data[key] = value; LX.store.set('settings', data);
      LX.bus.emit('settings:change', { key, value });
      return value;
    },
    reset() { data = Object.assign({}, DEFAULTS); LX.store.set('settings', data); Object.keys(DEFAULTS).forEach((k) => LX.bus.emit('settings:change', { key: k, value: data[k] })); },
  };
})();
