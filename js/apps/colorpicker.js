/* Store app — Color Studio: eyedropper (Chrome EyeDropper API), formats, palettes. */
(function () {
  'use strict';
  const H = LX.h;

  function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgb2hex(r, g, b) { return '#' + [r, g, b].map((v) => LX.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h, s, l = (mx + mn) / 2;
    if (mx === mn) { h = s = 0; } else {
      const d = mx - mn;
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }
  function shift(hex, deg) {
    const [r, g, b] = hex2rgb(hex); const [h, s, l] = rgb2hsl(r, g, b);
    const nh = (((h + deg) % 360) + 360) % 360;
    // hsl→rgb
    const c = (1 - Math.abs(2 * l / 100 - 1)) * (s / 100);
    const x = c * (1 - Math.abs((nh / 60) % 2 - 1));
    const m = l / 100 - c / 2;
    let [r1, g1, b1] = nh < 60 ? [c, x, 0] : nh < 120 ? [x, c, 0] : nh < 180 ? [0, c, x] : nh < 240 ? [0, x, c] : nh < 300 ? [x, 0, c] : [c, 0, x];
    return rgb2hex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255);
  }

  LX.apps.register({
    id: 'colorpicker', name: 'Color Studio', icon: 'palette', color: '#F48FB1', category: 'Utilities',
    pkg: true, pkgVersion: '1.0', pkgSize: 10, developer: 'PrideWorks', downloads: 890,
    desc: 'Pick, convert and save colors', longDesc: 'Sample any color on your screen with the eyedropper (where supported), convert between HEX / RGB / HSL, build complementary and analogous palettes, and save your favourites.',
    permissions: ['Local storage'], changelog: 'First release.',
    width: 760, height: 640, minWidth: 460, minHeight: 420,
    open(win) {
      let color = LX.store.get('app.colorstudio.last', '#5B9DFA');
      const saved = LX.store.get('app.colorstudio.saved', ['#5B9DFA', '#9ECE6A', '#F28B82']);
      const save = () => { LX.store.set('app.colorstudio.last', color); LX.store.set('app.colorstudio.saved', saved); };

      const preview = H('div', { class: 'cp-preview' });
      const formats = H('div', { class: 'cp-formats' });
      const scales = H('div', { class: 'cp-scales' });
      const harmony = H('div', { class: 'cp-harmony' });
      const savedEl = H('div', { class: 'cp-saved' });

      function paint() {
        const [r, g, b] = hex2rgb(color);
        const [h, s, l] = rgb2hsl(r, g, b);
        preview.style.background = color;
        const c = lum(color) > 0.45 ? '#111' : '#fff';
        preview.innerHTML = '';
        preview.append(H('b', { style: { color: c, fontSize: '24px' }, text: color.toUpperCase() }), H('span', { style: { color: c, opacity: .8, fontSize: '12px' }, text: 'picked colour' }));

        function lum(hex) { const [rr, gg, bb] = hex2rgb(hex).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * rr + .7152 * gg + .0722 * bb; }

        formats.innerHTML = '';
        const rows = [
          ['HEX', color.toUpperCase()], ['RGB', `rgb(${r}, ${g}, ${b})`], ['HSL', `hsl(${h}°, ${s}%, ${l}%)`],
          ['CSS var', `--brand: ${color};`],
        ];
        rows.forEach((row) => formats.appendChild(H('div', { class: 'cp-frow' },
          H('span', { class: 'muted', style: { width: '58px' }, text: row[0] }),
          H('code', { class: 'grow ellipsis', text: row[1] }),
          H('button', { class: 'btn sm ghost', html: LX.icon('copy', 13), onclick: () => { LX.clipboard.copy(row[1]); LX.notify({ title: 'Copied', body: row[1], icon: 'copy', timeout: 1400 }); } }))));

        scales.innerHTML = '';
        const marks = [];
        for (let i = 1; i <= 9; i++) marks.push(l - 40 + i * 8);
        const rowEl = H('div', { class: 'cp-scale-row' }, marks.map((L) => {
          const hex = hslHex(h, s, LX.clamp(Math.round(L), 4, 96));
          return H('button', { class: 'cp-sw' + (hex === color ? ' cur' : ''), style: { background: hex }, title: hex, onclick: () => { color = hex; save(); paint(); } });
        }));
        scales.append(H('div', { class: 'muted', style: { fontSize: '11.5px', margin: '4px 0' }, text: 'Shades — click to select' }), rowEl);

        harmony.innerHTML = '';
        const groups = [['Complementary', [color, shift(color, 180)]], ['Analogous', [shift(color, -30), color, shift(color, 30)]], ['Triadic', [color, shift(color, 120), shift(color, 240)]], ['Split', [color, shift(color, 150), shift(color, 210)]]];
        groups.forEach((gp) => harmony.appendChild(H('div', { class: 'cp-hgroup' },
          H('span', { class: 'muted', style: { fontSize: '11px' }, text: gp[0] }),
          H('div', { class: 'row gap' }, gp[1].map((cc) => H('button', { class: 'cp-sw', style: { background: cc }, title: cc, onclick: () => { color = cc; save(); paint(); } }))))));

        savedEl.innerHTML = '';
        savedEl.append(H('span', { class: 'muted', style: { fontSize: '11.5px' }, text: 'Saved' }),
          H('div', { class: 'row gap', style: { flexWrap: 'wrap' } }, saved.map((cc) => H('button', { class: 'cp-sw', style: { background: cc }, title: cc + ' (click to load, right-click to remove)', onclick: () => { color = cc; save(); paint(); }, oncontextmenu: (e) => { e.preventDefault(); const i = saved.indexOf(cc); if (i >= 0) { saved.splice(i, 1); save(); paint(); } } }))),
          H('button', { class: 'btn sm', style: { marginLeft: '8px' }, html: LX.icon('plus', 12), onclick: () => { if (saved.indexOf(color) < 0) saved.push(color); save(); paint(); } }));
      }
      function hslHex(h, s, l) {
        const c = (1 - Math.abs(2 * l / 100 - 1)) * (s / 100);
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l / 100 - c / 2;
        let [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
        return rgb2hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
      }

      const manual = H('input', { class: 'input', type: 'color', value: color, style: { width: '52px', height: '38px', padding: '2px' }, oninput: () => { color = manual.value; save(); paint(); } });
      const pick = H('button', { class: 'btn primary', html: LX.icon('zoom-in', 14) + ' Eyedropper', onclick: async () => {
        if (!window.EyeDropper) return LX.dialog.alert('The eyedropper needs a Chromium browser (Chrome / Edge). Pick manually with the swatch on the right.', 'Not supported here');
        try { const r = await new EyeDropper().open(); color = r.sRGBHex; save(); paint(); }
        catch (e) { /* cancelled */ }
      } });

      win.body.append(
        H('div', { class: 'toolbar' }, pick, H('span', { class: 'grow' }), H('span', { class: 'muted', style: { fontSize: '12px' }, text: 'Manual' }), manual),
        preview, formats, H('div', { class: 'cp-wrap' }, scales, harmony), savedEl);
      paint();
    },
  });
})();
