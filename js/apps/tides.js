/* Store app — Tide & Moon: moon-phase math + tide tables for coastal cities. */
(function () {
  'use strict';
  const H = LX.h;
  const PLACES = [['London (Thames)', 51.5, 6.2], ['Bay of Fundy', 45.2, 12.4], ['Sydney Harbour', -33.9, 1.3], ['Mumbai', 19.1, 4.2], ['Cape Town', -33.9, 1.6], ['San Francisco', 37.8, 2.1], ['Tokyo Bay', 35.7, 1.8], ['Reykjavík', 64.1, 4.1]];
  const SYNODIC = 29.53058867;
  const KNOWN_NEW = Date.UTC(2000, 0, 6, 18, 14) / 86400000; // known new moon 2000-01-06

  function moonPhase(d) {
    const days = d.getTime() / 86400000 - KNOWN_NEW;
    const phase = ((days % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC; // 0..1, 0=new
    return phase;
  }
  function phaseName(p) {
    if (p < .03 || p > .97) return 'New moon';
    if (p < .22) return 'Waxing crescent';
    if (p < .28) return 'First quarter';
    if (p < .47) return 'Waxing gibbous';
    if (p < .53) return 'Full moon';
    if (p < .72) return 'Waning gibbous';
    if (p < .78) return 'Last quarter';
    return 'Waning crescent';
  }
  function moonSVG(p, size) {
    // draw moon: light disc + dark overlay shape computed from phase
    const r = 46, cx = 60, cy = 60;
    const ill = (1 - Math.cos(2 * Math.PI * p)) / 2; // illuminated fraction
    const waxing = p < .5;
    // terminator ellipse width
    const ter = Math.abs(Math.cos(2 * Math.PI * p)) * r;
    const dark = waxing ? 'M60 14a46 46 0 0 1 0 92a46 46 0 0 1 0-92z' : '';
    return '<svg viewBox="0 0 120 120" width="' + size + '" height="' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#d8dee9"/>' +
      '<path d="M60 14a46 46 0 0 1 0 92" fill="none"/>' +
      '<ellipse cx="60" cy="60" rx="' + (waxing ? r - ter : ter) + '" ry="' + r + '" fill="' + (waxing ? '#1b1d23' : '#d8dee9') + '"/>' +
      '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="rgba(255,255,255,.2)"/>' +
      '<circle cx="46" cy="48" r="6" fill="rgba(0,0,0,.08)"/><circle cx="72" cy="70" r="9" fill="rgba(0,0,0,.08)"/><circle cx="52" cy="80" r="4" fill="rgba(0,0,0,.08)"/>' +
      '</svg>';
  }

  LX.apps.register({
    id: 'tides', name: 'Tide & Moon', icon: 'droplet', color: '#5B9DFA', category: 'Utilities',
    pkg: true, pkgVersion: '1.0', pkgSize: 5, developer: 'Moonlit Byte', downloads: 480,
    desc: 'Moon phases and tide tables', longDesc: 'Real astronomy under the hood: the moon phase is computed from the 29.53-day synodic cycle, and tides are modelled as semidiurnal curves scaled by lunar phase and coastal amplitude.',
    permissions: ['Local storage'], changelog: 'First release.',
    width: 860, height: 620, minWidth: 480, minHeight: 420,
    open(win) {
      let place = 0;
      const head = H('div', { class: 'td-head' });
      const moonBox = H('div', { class: 'card td-moon' });
      const table = H('div', { class: 'td-table scroll' });

      function tidesFor(ampl, date, phase) {
        // two highs & two lows per day; offset by location; amplitude modulated by phase (spring at new/full)
        const spring = Math.abs(Math.cos(2 * Math.PI * phase)); // 1 at new/full
        const A = ampl * (0.6 + 0.55 * spring);
        const r = LX.seeded('tide' + PLACES[place][0] + date.toDateString());
        const base = 6 + r() * 1.5;
        const events = [];
        const H1 = 2.4 + r() * 1.5, H2 = 12.9 + r() * 1.5;
        const L1 = 8.1 + r() * 1.2, L2 = 20.3 + r() * 1.6;
        [[H1, 'High'], [H2, 'High'], [L1, 'Low'], [L2, 'Low']].forEach((ev) => {
          const h = Math.floor(ev[0]), m = Math.round((ev[0] - h) * 60);
          events.push({ t: LX.pad(h) + ':' + LX.pad(m), kind: ev[1], h: +(ev[1] === 'High' ? base + A * (0.5 + r() * .5) : Math.max(0.2, base - A * (0.6 + r() * .4))).toFixed(1) });
        });
        return events.sort((a, b) => a.t.localeCompare(b.t));
      }
      function fmtH(h) { return h.toFixed(1) + ' m'; }

      function paint() {
        const now = new Date();
        const p = moonPhase(now);
        head.innerHTML = '';
        head.append(H('select', { class: 'select td-place', onchange: (e) => { place = +e.target.selectedIndex; paint(); } }, PLACES.map((pl, i) => H('option', { value: i, selected: i === place, text: pl[0] }))),
          H('span', { class: 'grow' }),
          H('span', { class: 'badge', text: 'Spring range: ±' + (PLACES[place][2] * 1.15).toFixed(1) + ' m' }));

        moonBox.innerHTML = '';
        const illPct = Math.round((1 - (Math.cos(2 * Math.PI * p)) / 2) * 100);
        const toFull = Math.ceil(((p < .5 ? .5 : 1) - p) * SYNODIC);
        const moonInfo = H('div', null, H('b', { style: { fontSize: '17px' }, text: phaseName(p) }),
          H('div', { class: 'muted', style: { fontSize: '12px' }, text: illPct + '% illuminated · full moon in ~' + toFull + ' days' }));
        moonBox.append(H('div', { class: 'td-moon-vis' }, H('span', { html: moonSVG(p, 120) }), moonInfo));

        table.innerHTML = '';
        const grid = H('div', { class: 'td-grid' });
        for (let i = 0; i < 7; i++) {
          const d = new Date(now); d.setDate(d.getDate() + i);
          const evs = tidesFor(PLACES[place][2], d, p);
          grid.appendChild(H('div', { class: 'td-day' + (i === 0 ? ' today' : '') },
            H('div', { class: 'td-day-h', text: i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) }),
            evs.map((ev) => H('div', { class: 'td-ev ' + (ev.kind === 'High' ? 'high' : 'low') },
              H('span', { class: 'td-ev-t', text: ev.t }),
              H('span', { class: 'td-ev-k', text: ev.kind === 'High' ? '▲' : '▼' }),
              H('span', { class: 'td-ev-h', text: fmtH(ev.h) })))));
        }
        table.append(grid, H('div', { class: 'muted', style: { fontSize: '11px', marginTop: '10px' }, text: 'Semidiurnal model: spring tides near new and full moon (' + phaseName(p) + ' now). Heights are estimates for coastal planning only.' }));
        win.setTitle('Tide & Moon — ' + PLACES[place][0]);
      }
      win.body.append(head, H('div', { class: 'td-mid' }, moonBox, table));
      paint();
    },
  });
})();
