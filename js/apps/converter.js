/* Leonux Web OS — Unit & currency converter (offline, static currency rates) */
(function () {
  'use strict';
  const H = LX.h;
  // factors relative to a base unit
  const lin = (units) => units;
  const CATS = {
    length: { name: 'Length', icon: 'maximize', base: 'm', units: lin({ m: ['Metre', 1], km: ['Kilometre', 1000], cm: ['Centimetre', 0.01], mm: ['Millimetre', 0.001], mi: ['Mile', 1609.344], yd: ['Yard', 0.9144], ft: ['Foot', 0.3048], in: ['Inch', 0.0254], nmi: ['Nautical mile', 1852] }) },
    mass: { name: 'Mass', icon: 'layers', units: { kg: ['Kilogram', 1], g: ['Gram', 0.001], mg: ['Milligram', 1e-6], t: ['Tonne', 1000], lb: ['Pound', 0.45359237], oz: ['Ounce', 0.028349523125], st: ['Stone', 6.35029318] } },
    temperature: { name: 'Temperature', icon: 'thermometer', special: true, units: { C: ['Celsius', 1], F: ['Fahrenheit', 1], K: ['Kelvin', 1] } },
    speed: { name: 'Speed', icon: 'zap', units: { 'm/s': ['Metres/second', 1], 'km/h': ['Kilometres/hour', 1 / 3.6], mph: ['Miles/hour', 0.44704], kn: ['Knot', 0.514444], 'ft/s': ['Feet/second', 0.3048], mach: ['Mach (sea level)', 340.29] } },
    area: { name: 'Area', icon: 'grid', units: { 'm²': ['Square metre', 1], 'km²': ['Square kilometre', 1e6], 'cm²': ['Square centimetre', 1e-4], ha: ['Hectare', 1e4], acre: ['Acre', 4046.8564224], 'ft²': ['Square foot', 0.09290304], 'in²': ['Square inch', 0.00064516], 'mi²': ['Square mile', 2589988.110336] } },
    volume: { name: 'Volume', icon: 'droplet', units: { l: ['Litre', 1], ml: ['Millilitre', 0.001], 'm³': ['Cubic metre', 1000], gal: ['US gallon', 3.785411784], qt: ['US quart', 0.946352946], pt: ['US pint', 0.473176473], cup: ['US cup', 0.2365882365], floz: ['US fl oz', 0.0295735295625], tbsp: ['Tablespoon', 0.01478676478], tsp: ['Teaspoon', 0.00492892159] } },
    time: { name: 'Time', icon: 'clock', units: { s: ['Second', 1], ms: ['Millisecond', 0.001], min: ['Minute', 60], h: ['Hour', 3600], d: ['Day', 86400], wk: ['Week', 604800], mo: ['Month (30.44 d)', 2629743.84], yr: ['Year (365.25 d)', 31557600] } },
    data: { name: 'Data', icon: 'hard-drive', units: { B: ['Byte', 1], KB: ['Kilobyte (1000)', 1e3], MB: ['Megabyte', 1e6], GB: ['Gigabyte', 1e9], TB: ['Terabyte', 1e12], KiB: ['Kibibyte (1024)', 1024], MiB: ['Mebibyte', 1048576], GiB: ['Gibibyte', 1073741824], TiB: ['Tebibyte', 1099511627776], bit: ['Bit', 0.125] } },
    currency: { name: 'Currency', icon: 'globe', rates: true, units: { USD: ['US Dollar', 1], EUR: ['Euro', 0.92], GBP: ['British Pound', 0.79], JPY: ['Japanese Yen', 149.5], INR: ['Indian Rupee', 83.2], CAD: ['Canadian Dollar', 1.36], AUD: ['Australian Dollar', 1.52], CHF: ['Swiss Franc', 0.88], CNY: ['Chinese Yuan', 7.24], MXN: ['Mexican Peso', 17.1], BRL: ['Brazilian Real', 5.0], KRW: ['South Korean Won', 1330], SEK: ['Swedish Krona', 10.6], AED: ['UAE Dirham', 3.67] } },
  };
  // currency: value in units per 1 USD, so base = value / rate
  function toBase(cat, u, v) {
    if (cat.special) return u === 'C' ? v : u === 'F' ? (v - 32) * 5 / 9 : v - 273.15;
    return cat.rates ? v / cat.units[u][1] : v * cat.units[u][1];
  }
  function fromBase(cat, u, b) {
    if (cat.special) return u === 'C' ? b : u === 'F' ? b * 9 / 5 + 32 : b + 273.15;
    return cat.rates ? b * cat.units[u][1] : b / cat.units[u][1];
  }
  function fmt(n) {
    if (!isFinite(n)) return '—';
    if (n === 0) return '0';
    const a = Math.abs(n);
    if (a >= 1e15 || a < 1e-7) return n.toExponential(6).replace(/\.?0+e/, 'e');
    return String(parseFloat(n.toPrecision(10)));
  }
  function parse(s) { s = String(s).trim().replace(/,/g, ''); if (s === '' || s === '-' || s === '.') return NaN; return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? parseFloat(s) : NaN; }

  LX.apps.register({
    id: 'converter', name: 'Converter', icon: 'rotate-cw', color: '#94E2D5', category: 'Productivity', desc: 'Convert units and currencies', width: 760, height: 520, minWidth: 360, minHeight: 360,
    open(win) {
      const saved = LX.store.get('app.converter.state', {}) || {};
      let cat = CATS[saved.cat] ? saved.cat : 'length';
      const pairs = saved.pairs || {};
      const side = H('div', { class: 'sidebar cv-side' });
      const main = H('div', { class: 'cv-main' });
      win.body.append(side, main);
      win.body.tabIndex = 0;
      const keys = Object.keys(CATS);
      const persist = () => LX.store.set('app.converter.state', { cat, pairs });
      keys.forEach((k) => side.appendChild(H('div', { class: 'list-item', dataset: { k }, tabindex: 0, role: 'button', onclick: () => go(k), onkeydown: (e) => { if (e.key === 'Enter') go(k); } }, H('span', { html: LX.icon(CATS[k].icon, 17) }), H('span', { text: CATS[k].name }))));

      function go(k) {
        cat = k; LX.$$('.list-item', side).forEach((x) => x.classList.toggle('active', x.dataset.k === k));
        const c = CATS[k], names = Object.keys(c.units);
        const p = pairs[k] || {};
        let from = c.units[p.from] ? p.from : names[0], to = c.units[p.to] ? p.to : names[1];
        let last = 'from';
        const mkSel = (val) => { const s = H('select', { class: 'select', 'aria-label': 'Unit' }, names.map((n) => H('option', { value: n, text: c.units[n][0] + ' (' + n + ')' }))); s.value = val; return s; };
        const inA = H('input', { class: 'input', inputmode: 'decimal', value: p.val != null ? p.val : '1', 'aria-label': 'From value' });
        const inB = H('input', { class: 'input', inputmode: 'decimal', 'aria-label': 'To value' });
        const selA = mkSel(from), selB = mkSel(to);
        const table = H('div', { class: 'cv-table' });
        const run = () => {
          from = selA.value; to = selB.value;
          const srcIn = last === 'from' ? inA : inB, dst = last === 'from' ? inB : inA;
          const su = last === 'from' ? from : to, du = last === 'from' ? to : from;
          const v = parse(srcIn.value);
          srcIn.style.borderColor = srcIn.value.trim() && isNaN(v) ? 'var(--danger)' : '';
          if (isNaN(v)) { dst.value = ''; table.innerHTML = ''; return; }
          dst.value = fmt(fromBase(c, du, toBase(c, su, v)));
          const b = toBase(c, from, parse(inA.value));
          table.innerHTML = '';
          names.filter((n) => n !== from).forEach((n) => { const r = fmt(fromBase(c, n, b)); table.appendChild(H('div', { class: 'cv-chip', title: 'Click to copy', onclick: () => LX.clipboard.copy(r), }, H('b', { text: r }), H('span', { text: c.units[n][0] + ' · ' + n }))); });
          pairs[k] = { from, to, val: inA.value }; persist();
        };
        inA.addEventListener('input', () => { last = 'from'; run(); });
        inB.addEventListener('input', () => { last = 'to'; run(); });
        selA.addEventListener('change', () => { last = 'from'; run(); }); selB.addEventListener('change', () => { last = 'from'; run(); });
        const swap = H('button', { class: 'btn icon cv-swap', title: 'Swap units', 'aria-label': 'Swap units', html: LX.icon('repeat', 18), onclick: () => { const t = selA.value; selA.value = selB.value; selB.value = t; last = 'from'; run(); } });
        main.innerHTML = '';
        main.append(...[H('h2', { class: 'cv-title', text: c.name }),
          H('div', { class: 'cv-panel' }, H('div', { class: 'cv-field' }, H('label', { text: 'From' }), inA, selA), swap, H('div', { class: 'cv-field' }, H('label', { text: 'To' }), inB, selB)),
          c.rates ? H('div', { class: 'cv-note', text: 'Offline reference rates (static, relative to USD, approximate as of Oct 2026). Not live market data; do not use for transactions.' }) : null,
          H('div', { class: 'cv-note', text: 'All conversions' }), table].filter(Boolean));
        run(); persist();
      }
      go(cat);
    },
  });
})();
