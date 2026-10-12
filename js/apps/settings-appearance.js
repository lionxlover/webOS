/* Leonux Web OS — Settings page: Appearance (theme, accent, wallpaper, fonts, taskbar) */
(function () {
  'use strict';
  const H = LX.h, ui = LX.settingsPages.ui, S = LX.settings;

  function themeCard(id, label, sw) {
    return H('button', { class: 'st-theme', dataset: { v: id }, onclick: () => { ui.set('theme', id); paint(); } },
      H('div', { class: 'st-theme-prev', style: { background: sw } }, H('i'), H('i')), H('span', { text: label }));
  }
  let paint = () => {};

  LX.settingsPages.add({ id: 'appearance', title: 'Appearance', icon: 'palette', group: 'Personal', order: 10, render(c) {
    const themes = H('div', { class: 'st-themes' },
      themeCard('light', 'Light', 'linear-gradient(135deg,#f3f5fa,#cfd6e6)'),
      themeCard('dark', 'Dark', 'linear-gradient(135deg,#1b1e29,#07080d)'),
      themeCard('auto', 'Auto', 'linear-gradient(115deg,#f3f5fa 50%,#0b0d14 50%)'));

    const accents = H('div', { class: 'st-accents' });
    const custom = H('input', { type: 'color', class: 'st-color', title: 'Custom colour', 'aria-label': 'Custom accent' });
    custom.value = /^#[0-9a-f]{6}$/i.test(S.get('accent')) ? S.get('accent') : '#5B9DFA';
    custom.addEventListener('input', () => { ui.set('accent', custom.value); paint(); });
    LX.theme.accents.forEach((a) => accents.appendChild(H('button', { class: 'st-sw', dataset: { v: a }, style: { background: a }, title: a, 'aria-label': 'Accent ' + a, onclick: () => { ui.set('accent', a); custom.value = a; paint(); }, html: LX.icon('check', 14) })));
    accents.appendChild(custom);

    const walls = H('div', { class: 'st-walls' });
    const W = LX.theme.wallpapers;
    Object.keys(W).forEach((k) => walls.appendChild(H('button', { class: 'st-wall', dataset: { v: k }, title: W[k].name, onclick: () => { ui.set('wallpaper', k); paint(); } },
      H('div', { class: 'st-wall-prev', style: { background: W[k].css } }), H('span', { text: W[k].name }))));
    // dynamic themes installed from store repositories
    const dyn = LX.theme.dynamic || {};
    Object.keys(dyn).forEach((k) => walls.appendChild(H('button', { class: 'st-wall st-wall-dyn', dataset: { v: k }, title: dyn[k].name + ' — installed from a store repository', onclick: () => { LX.theme.applyDynamic(k); paint(); } },
      H('div', { class: 'st-wall-prev', style: { background: dyn[k].css } }, H('span', { class: 'st-wall-store', html: LX.icon('store', 11) })), H('span', { text: dyn[k].name }))));
    const isCustom = () => String(S.get('wallpaper')).indexOf('data:') === 0;
    const setCustomImg = (url) => { ui.set('wallpaper', url); paint(); };
    const fileIn = H('input', { type: 'file', accept: 'image/*', hidden: true });
    fileIn.addEventListener('change', () => {
      const f = fileIn.files[0]; if (!f) return;
      const r = new FileReader(); r.onload = () => downscale(r.result, setCustomImg); r.readAsDataURL(f);
    });
    function downscale(url, cb) {
      const img = new Image();
      img.onload = () => { const k = Math.min(1, 1920 / img.width); const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); try { cb(cv.toDataURL('image/jpeg', 0.85)); } catch (e) { cb(url); } };
      img.onerror = () => LX.dialog.alert('That image could not be loaded.', 'Wallpaper');
      img.src = url;
    }
    const customTile = H('button', { class: 'st-wall', dataset: { v: 'custom' }, title: 'Custom image', onclick: () => { if (isCustom()) return; fileIn.click(); } },
      H('div', { class: 'st-wall-prev st-wall-custom' }), H('span', { text: 'Custom' }));
    walls.appendChild(customTile);

    paint = () => {
      LX.$$('.st-theme', c).forEach((b) => b.classList.toggle('on', b.dataset.v === S.get('theme')));
      LX.$$('.st-sw', c).forEach((b) => b.classList.toggle('on', b.dataset.v.toLowerCase() === String(S.get('accent')).toLowerCase()));
      LX.$$('.st-wall', c).forEach((b) => b.classList.toggle('on', b.dataset.v === (isCustom() ? 'custom' : S.get('wallpaper'))));
      const cp = LX.$('.st-wall-custom', c); if (cp) cp.style.background = isCustom() ? 'center/cover url("' + S.get('wallpaper') + '")' : '';
    };

    c.appendChild(ui.page('Appearance',
      ui.group('Theme', H('div', { class: 'st-pad' }, themes)),
      ui.group('Accent colour', H('div', { class: 'st-pad' }, accents)),
      ui.group('Wallpaper', H('div', { class: 'st-pad' }, walls,
        H('div', { class: 'st-btns' },
          H('button', { class: 'btn sm', html: LX.icon('upload', 14) + ' Upload image…', onclick: () => fileIn.click() }),
          H('button', { class: 'btn sm', html: LX.icon('image', 14) + ' From Pictures…', onclick: () => LX.dialog.openFile({ title: 'Choose wallpaper', path: '/home/user/Pictures', exts: ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'] }).then((p) => { if (!p) return; try { const d = LX.vfs.read(p); if (d.indexOf('data:') === 0) downscale(d, setCustomImg); else downscale('data:image/svg+xml;utf8,' + encodeURIComponent(d), setCustomImg); } catch (e) { LX.dialog.alert(e.message, 'Wallpaper'); } }) }),
          fileIn))),
      ui.group('Text & motion',
        ui.row('Font size', 'Scales text across the system', ui.slider('fontScale', 80, 140, 5, (v) => v + '%')),
        ui.row('High contrast', 'Stronger borders, no transparency', ui.toggle('highContrast')),
        ui.row('Animations', 'Window and UI transitions', ui.toggle('animations'))),
      ui.group('Screen',
        ui.row('Brightness', null, ui.slider('brightness', 20, 100, 1, (v) => v + '%')),
        ui.row('Night light', 'Warm, low-blue-light tint', ui.toggle('nightLight'))),
      ui.group('Taskbar',
        ui.row('Taskbar position', null, ui.seg('taskbarPos', [{ v: 'bottom', l: 'Bottom' }, { v: 'top', l: 'Top' }])))));
    paint();
  } });
})();
