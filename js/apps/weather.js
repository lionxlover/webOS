/* Leonux Web OS — Weather: deterministic simulated offline forecasts with SVG icons and charts */
(function () {
  'use strict';
  const H = LX.h, P = LX.pad;
  // name, country, latitude, annual-mean C, seasonal amplitude C, wetness 0-1
  const CITIES = [
    ['London', 'UK', 51.5, 11, 7, .6], ['New York', 'USA', 40.7, 13, 12, .45], ['Tokyo', 'Japan', 35.7, 16, 10, .5], ['Paris', 'France', 48.9, 12, 8, .45],
    ['Sydney', 'Australia', -33.9, 18, 5, .45], ['Mumbai', 'India', 19.1, 27, 3, .55], ['Cairo', 'Egypt', 30, 22, 8, .03], ['Moscow', 'Russia', 55.8, 6, 14, .4],
    ['Rio de Janeiro', 'Brazil', -22.9, 24, 4, .5], ['Cape Town', 'South Africa', -33.9, 17, 4, .35], ['Reykjavik', 'Iceland', 64.1, 5, 6, .65], ['Dubai', 'UAE', 25.2, 28, 8, .03],
    ['Singapore', 'Singapore', 1.4, 28, 1, .7], ['San Francisco', 'USA', 37.8, 14, 4, .3], ['Berlin', 'Germany', 52.5, 10, 10, .4], ['Delhi', 'India', 28.6, 25, 10, .25],
  ].map((c) => ({ name: c[0], country: c[1], lat: c[2], mean: c[3], amp: c[4], wet: c[5] }));
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const COND = { clear: 'Clear', pcloudy: 'Partly cloudy', cloudy: 'Cloudy', rain: 'Rain', storm: 'Thunderstorm', snow: 'Snow', fog: 'Fog' };
  function icon(kind, night, size) {
    const s = size || 40, sun = '<circle cx="24" cy="24" r="8" fill="#F6C177"/><g stroke="#F6C177" stroke-width="2.5" stroke-linecap="round">' + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => '<line x1="24" y1="8" x2="24" y2="12" transform="rotate(' + a + ' 24 24)"/>').join('') + '</g>';
    const moon = '<path d="M30 8a15 15 0 1 0 10 25A13 13 0 0 1 30 8z" fill="#cdd6f4"/>';
    const cloud = (c, dx, dy) => '<path transform="translate(' + (dx || 0) + ' ' + (dy || 0) + ')" d="M14 36a7 7 0 0 1 0-14 10 10 0 0 1 19-2 8 8 0 0 1 2 16z" fill="' + (c || '#aab3c5') + '"/>';
    let b = '';
    if (kind === 'clear') b = night ? moon : sun;
    else if (kind === 'pcloudy') b = (night ? '<g transform="translate(-6 -6) scale(.8)">' + moon + '</g>' : '<g transform="translate(-6 -8) scale(.8)">' + sun + '</g>') + cloud('#c3cadb', 2, 2);
    else if (kind === 'cloudy') b = cloud('#8d96aa', -2, -3) + cloud('#c3cadb', 3, 3);
    else if (kind === 'rain') b = cloud('#8d96aa', 0, -4) + '<g stroke="#5B9DFA" stroke-width="2.6" stroke-linecap="round"><line x1="16" y1="36" x2="14" y2="42"/><line x1="25" y1="36" x2="23" y2="42"/><line x1="34" y1="36" x2="32" y2="42"/></g>';
    else if (kind === 'storm') b = cloud('#6f7890', 0, -4) + '<path d="M26 28l-6 9h5l-3 8 9-11h-5l3-6z" fill="#F6C177"/>';
    else if (kind === 'snow') b = cloud('#aab3c5', 0, -4) + '<g fill="#fff"><circle cx="16" cy="39" r="2.2"/><circle cx="25" cy="42" r="2.2"/><circle cx="34" cy="39" r="2.2"/></g>';
    else b = '<g stroke="#aab3c5" stroke-width="3" stroke-linecap="round"><line x1="8" y1="18" x2="40" y2="18"/><line x1="12" y1="26" x2="38" y2="26"/><line x1="8" y1="34" x2="34" y2="34"/></g>';
    return '<svg viewBox="0 0 48 48" width="' + s + '" height="' + s + '" aria-hidden="true">' + b + '</svg>';
  }
  function condFor(r, city, t, hum) {
    const x = r(), y = r();
    if (t < 0 && x < city.wet * .8) return 'snow';
    if (x < city.wet * .35) return y < .15 && t > 15 ? 'storm' : 'rain';
    if (x < city.wet * .35 + .2) return 'cloudy';
    if (x < .75) return y < .5 ? 'pcloudy' : 'clear';
    return hum > 85 && y < .3 ? 'fog' : 'clear';
  }
  // Compute the weather model for a city at a given Date
  function forecast(city, now) {
    const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    const season = -Math.cos((doy - 15) / 365 * 2 * Math.PI) * (city.lat < 0 ? -1 : 1); // +1 mid-summer north
    const dayKey = (off) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
    const days = [];
    for (let i = 0; i < 7; i++) {
      const r = rng(hash(city.name) ^ dayKey(i)); const base = city.mean + season * city.amp;
      const mean = base + (r() - .5) * 7, rng2 = 6 + r() * 6 - Math.abs(city.lat) / 30, hum = Math.round(LX.clamp(45 + city.wet * 40 + (r() - .5) * 30, 20, 98));
      const cond = condFor(r, city, mean, hum);
      const adj = cond === 'rain' || cond === 'storm' ? -2 : cond === 'clear' ? 1.5 : 0;
      days.push({ date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + i), cond, hi: Math.round(mean + adj + rng2 / 2), lo: Math.round(mean + adj - rng2 / 2), hum, wind: Math.round(6 + r() * 22), pop: Math.round((cond === 'rain' || cond === 'storm' ? 60 + r() * 35 : cond === 'snow' ? 70 + r() * 25 : cond === 'cloudy' ? 20 + r() * 20 : r() * 12)), uv: Math.round(LX.clamp((9 - Math.abs(city.lat) / 10) * (cond === 'clear' ? 1 : .5) * (.6 + .4 * (season + 1) / 2) + r() * 2, 0, 11)) });
    }
    const t0 = days[0], hours = [];
    for (let i = 0; i < 24; i++) {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + i); const dd = Math.floor((t - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
      const d = days[Math.min(dd, 6)], h = t.getHours(), r = rng(hash(city.name) ^ (dayKey(dd) * 31 + h));
      const temp = (d.lo + d.hi) / 2 + (d.hi - d.lo) / 2 * Math.sin((h - 9) / 24 * 2 * Math.PI) + (r() - .5) * 1.2;
      const night = h < 6 || h >= 20;
      let c = d.cond; if ((c === 'rain' || c === 'storm') && r() < .3) c = 'cloudy'; if (c === 'pcloudy' && r() < .2) c = 'cloudy';
      hours.push({ t, temp: Math.round(temp * 10) / 10, cond: c, night, pop: Math.round(LX.clamp(d.pop + (r() - .5) * 30, 0, 100)) });
    }
    const cur = hours[0];
    return { cur: { temp: Math.round(cur.temp), feels: Math.round(cur.temp - (t0.wind > 20 ? 2 : 0) + (t0.hum > 80 && cur.temp > 22 ? 2 : 0)), cond: cur.cond, night: cur.night, hum: t0.hum, wind: t0.wind, pressure: 1000 + Math.round((rng(hash(city.name) ^ dayKey(0))() - .4) * 40), vis: cur.cond === 'fog' ? 1 : cur.cond === 'rain' ? 6 : 10, uv: cur.night ? 0 : t0.uv, hi: t0.hi, lo: t0.lo, dew: Math.round(cur.temp - (100 - t0.hum) / 5) }, hours, days };
  }
  function lineChart(vals, labels, unit, w, h) {
    const mn = Math.min(...vals), mx = Math.max(...vals), pad = 24, rangeV = Math.max(1, mx - mn);
    const X = (i) => pad + i * (w - pad * 2) / (vals.length - 1), Y = (v) => 18 + (1 - (v - mn) / rangeV) * (h - 52);
    const pts = vals.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1));
    let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none" class="wx-chart"><defs><linearGradient id="wxg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>';
    s += '<polygon points="' + X(0) + ',' + (h - 24) + ' ' + pts.join(' ') + ' ' + X(vals.length - 1) + ',' + (h - 24) + '" fill="url(#wxg)"/><polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
    vals.forEach((v, i) => { if (i % 3 === 0) s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="3" fill="var(--accent)"/><text x="' + X(i).toFixed(1) + '" y="' + (Y(v) - 8).toFixed(1) + '" text-anchor="middle" font-size="11" fill="var(--text)">' + Math.round(v) + '°</text><text x="' + X(i).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle" font-size="10" fill="var(--text-muted)">' + labels[i] + '</text>'; });
    return s + '</svg>';
  }

  LX.apps.register({
    id: 'weather', name: 'Weather', icon: 'cloud', color: '#5B9DFA', category: 'Productivity',
    desc: 'Simulated offline forecasts for cities around the world', width: 900, height: 660, minWidth: 420, minHeight: 380,
    open(win) {
      const root = win.body;
      let saved = LX.store.get('app.weather.cities', ['London', 'New York', 'Tokyo', 'Sydney']); if (!Array.isArray(saved) || !saved.length) saved = ['London'];
      let unit = LX.store.get('app.weather.unit', 'C'), cur = LX.store.get('app.weather.current', saved[0]); if (!saved.includes(cur)) cur = saved[0];
      const T = (c) => Math.round(unit === 'F' ? c * 9 / 5 + 32 : c) + '°';
      const spd = (k) => unit === 'F' ? Math.round(k * .621) + ' mph' : k + ' km/h';
      const byName = (n) => CITIES.find((c) => c.name === n) || CITIES[0];
      const side = H('div', { class: 'sidebar wx-side scroll' }), main = H('div', { class: 'wx-main scroll grow' });
      root.style.flexDirection = 'row'; root.append(side, main);
      let tick = setInterval(() => { const d = new Date(); if (d.getMinutes() !== lastMin) { lastMin = d.getMinutes(); render(); } }, 15000), lastMin = new Date().getMinutes();
      win.onClose(() => clearInterval(tick));

      function drawSide() {
        const now = new Date();
        const sel = H('select', { class: 'select', onchange: (e) => { const v = e.target.value; if (v) { if (!saved.includes(v)) saved.push(v); cur = v; persist(); render(); } } }, H('option', { value: '', text: '+ Add city' }), CITIES.filter((c) => !saved.includes(c.name)).map((c) => H('option', { value: c.name, text: c.name + ', ' + c.country })));
        side.replaceChildren(H('div', { class: 'wx-unit row gap' }, H('b', { class: 'grow', text: 'Cities' }),
          H('div', { class: 'wx-seg' }, ['C', 'F'].map((u) => H('button', { class: u === unit ? 'on' : '', text: '°' + u, onclick: () => { unit = u; LX.store.set('app.weather.unit', u); render(); } })))), sel,
          H('div', { class: 'list wx-cities' }, saved.map((n) => { const c = byName(n), f = forecast(c, now);
            return H('div', { class: 'list-item wx-city' + (n === cur ? ' active' : ''), onclick: () => { cur = n; LX.store.set('app.weather.current', n); render(); },
              oncontextmenu: (e) => { e.preventDefault(); LX.menu.show(e.clientX, e.clientY, [{ label: 'Remove', icon: 'trash', disabled: saved.length < 2, action: () => rm(n) }]); } },
              H('div', { html: icon(f.cur.cond, f.cur.night, 30) }), H('div', { class: 'grow' }, H('div', { class: 'ellipsis', text: n }), H('div', { class: 'muted wx-sm ellipsis', text: COND[f.cur.cond] })), H('b', { class: 'wx-t', text: T(f.cur.temp) }),
              saved.length > 1 ? H('button', { class: 'btn icon sm wx-rm', title: 'Remove', html: LX.icon('x', 12), onclick: (e) => { e.stopPropagation(); rm(n); } }) : null); })),
          H('div', { class: 'muted wx-sm wx-note', text: 'Simulated data — works offline.' }));
      }
      function rm(n) { saved = saved.filter((x) => x !== n); if (cur === n) cur = saved[0]; persist(); render(); }
      function persist() { LX.store.set('app.weather.cities', saved); LX.store.set('app.weather.current', cur); }
      function render() {
        const now = new Date(), c = byName(cur), f = forecast(c, now), k = f.cur;
        drawSide(); win.setTitle('Weather — ' + c.name);
        const hours = H('div', { class: 'wx-hours' }, f.hours.map((h, i) => H('div', { class: 'wx-hour' }, H('span', { class: 'muted', text: i === 0 ? 'Now' : P(h.t.getHours()) + ':00' }), H('div', { html: icon(h.cond, h.night, 30) }), H('b', { text: T(h.temp) }), h.pop >= 20 ? H('span', { class: 'wx-pop', text: h.pop + '%' }) : H('span', { class: 'wx-pop', text: ' ' }))));
        const wkMin = Math.min(...f.days.map((d) => d.lo)), wkMax = Math.max(...f.days.map((d) => d.hi)), span = Math.max(1, wkMax - wkMin);
        const days = H('div', { class: 'wx-days' }, f.days.map((d, i) => H('div', { class: 'wx-day' }, H('span', { class: 'wx-dn', text: i === 0 ? 'Today' : d.date.toLocaleDateString('en-GB', { weekday: 'short' }) }), H('span', { html: icon(d.cond, false, 28) }), H('span', { class: 'wx-pop', text: d.pop >= 20 ? d.pop + '%' : '' }),
          H('span', { class: 'muted wx-lo', text: T(d.lo) }), H('div', { class: 'wx-bar' }, H('i', { style: 'left:' + ((d.lo - wkMin) / span * 100) + '%;width:' + (Math.max(8, (d.hi - d.lo) / span * 100)) + '%' })), H('b', { class: 'wx-hi', text: T(d.hi) }))));
        const metric = (ic, l, v) => H('div', { class: 'card wx-metric' }, H('div', { class: 'muted wx-sm', html: LX.icon(ic, 14) + ' ' + l.toUpperCase() }), H('div', { class: 'wx-mv', text: v }));
        const chartVals = f.hours.map((h) => unit === 'F' ? h.temp * 9 / 5 + 32 : h.temp);
        main.replaceChildren(
          H('div', { class: 'wx-hero' }, H('div', null, H('h2', { text: c.name }), H('div', { class: 'muted', text: c.country + ' · ' + LX.fmtDate(now) + ' · ' + LX.fmtTime(now) })), H('div', { class: 'wx-now' }, H('div', { html: icon(k.cond, k.night, 84) }), H('div', null, H('div', { class: 'wx-big', text: T(k.temp) }), H('div', { text: COND[k.cond] }), H('div', { class: 'muted', text: 'H ' + T(k.hi) + '  L ' + T(k.lo) + ' · Feels like ' + T(k.feels) })))),
          H('div', { class: 'wx-sec' }, H('div', { class: 'wx-h muted', text: 'HOURLY FORECAST' }), hours),
          H('div', { class: 'wx-sec' }, H('div', { class: 'wx-h muted', text: 'TEMPERATURE · NEXT 24 HOURS' }), H('div', { html: lineChart(chartVals, f.hours.map((h) => P(h.t.getHours()) + 'h'), unit, 600, 150) })),
          H('div', { class: 'wx-sec' }, H('div', { class: 'wx-h muted', text: '7-DAY FORECAST' }), days),
          H('div', { class: 'wx-grid' }, metric('droplet', 'Humidity', k.hum + '%'), metric('wind', 'Wind', spd(k.wind)), metric('sun', 'UV index', k.uv + (k.uv >= 8 ? ' · Very high' : k.uv >= 6 ? ' · High' : k.uv >= 3 ? ' · Moderate' : ' · Low')), metric('thermometer', 'Dew point', T(k.dew)), metric('activity', 'Pressure', k.pressure + ' hPa'), metric('zap', 'Visibility', (unit === 'F' ? Math.round(k.vis * .621) + ' mi' : k.vis + ' km'))));
      }
      win.setMenu([{ label: 'View', items: [{ label: 'Celsius', action() { unit = 'C'; LX.store.set('app.weather.unit', 'C'); render(); } }, { label: 'Fahrenheit', action() { unit = 'F'; LX.store.set('app.weather.unit', 'F'); render(); } }, { separator: true }, { label: 'Refresh', action: render }] }]);
      render();
    },
  });
})();
