/* Leonux Web OS — Clock: world clocks, alarms, stopwatch, timer */
(function () {
  'use strict';
  const H = LX.h, P = LX.pad;
  const ZONES = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo', 'America/Mexico_City', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow', 'Africa/Cairo', 'Africa/Lagos', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney', 'Pacific/Auckland', 'Pacific/Honolulu'];
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  function parts(zone, d) {
    try {
      const f = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short', day: 'numeric', month: 'short' });
      const o = {}; f.formatToParts(d).forEach((p) => { o[p.type] = p.value; });
      return { h: +o.hour % 24, m: +o.minute, s: +o.second, label: o.weekday + ', ' + o.day + ' ' + o.month };
    } catch (e) { return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), label: 'UTC' }; }
  }
  const cityOf = (z) => z.split('/').pop().replace(/_/g, ' ');
  function offsetMin(zone, d) { const p = parts(zone, d); const l = parts(Intl.DateTimeFormat().resolvedOptions().timeZone, d); let diff = (p.h * 60 + p.m) - (l.h * 60 + l.m); if (diff > 720) diff -= 1440; if (diff < -720) diff += 1440; return diff; }
  const fmt12 = (h, m) => { const s = LX.settings.get('clock24') === false; return s ? ((h % 12) || 12) + ':' + P(m) + ' ' + (h < 12 ? 'AM' : 'PM') : P(h) + ':' + P(m); };
  function analog(size) {
    const ns = 'http://www.w3.org/2000/svg';
    let t = ''; for (let i = 0; i < 12; i++) t += '<line x1="50" y1="6" x2="50" y2="' + (i % 3 ? 10 : 13) + '" transform="rotate(' + i * 30 + ' 50 50)" stroke="currentColor" stroke-width="' + (i % 3 ? 1.2 : 2.2) + '" opacity="' + (i % 3 ? .4 : .8) + '"/>';
    const el = document.createElementNS(ns, 'svg'); el.setAttribute('viewBox', '0 0 100 100'); el.setAttribute('width', size); el.setAttribute('height', size);
    el.innerHTML = '<circle cx="50" cy="50" r="46" fill="var(--surface-2)" stroke="var(--border-strong)" stroke-width="1.5"/>' + t +
      '<line class="hh" x1="50" y1="50" x2="50" y2="26" stroke="var(--text)" stroke-width="3.2" stroke-linecap="round"/><line class="mh" x1="50" y1="50" x2="50" y2="16" stroke="var(--text)" stroke-width="2.2" stroke-linecap="round"/><line class="sh" x1="50" y1="56" x2="50" y2="12" stroke="var(--accent)" stroke-width="1.2" stroke-linecap="round"/><circle cx="50" cy="50" r="2.6" fill="var(--accent)"/>';
    el.set = (h, m, s) => { el.querySelector('.hh').setAttribute('transform', 'rotate(' + ((h % 12) * 30 + m / 2) + ' 50 50)'); el.querySelector('.mh').setAttribute('transform', 'rotate(' + (m * 6 + s / 10) + ' 50 50)'); el.querySelector('.sh').setAttribute('transform', 'rotate(' + s * 6 + ' 50 50)'); };
    return el;
  }
  const fmtMs = (ms) => { const t = Math.floor(ms / 10), cs = t % 100, s = Math.floor(t / 100) % 60, m = Math.floor(t / 6000) % 60, h = Math.floor(t / 360000); return (h ? P(h) + ':' : '') + P(m) + ':' + P(s) + '.' + P(cs); };
  const fmtHMS = (sec) => { sec = Math.max(0, Math.ceil(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return P(h) + ':' + P(m) + ':' + P(s); };

  // ----- alarms (global scheduler so they ring even when the window is closed) -----
  const AK = 'app.clock.alarms';
  let alarms = null, alTimer = null, lastMin = -1;
  const getAlarms = () => { if (!alarms) { const v = LX.store.get(AK, null); alarms = Array.isArray(v) ? v : [{ id: LX.uid(), time: '07:30', label: 'Wake up', days: [1, 2, 3, 4, 5], on: false }]; } return alarms; };
  const saveAlarms = () => { LX.store.set(AK, alarms); LX.bus.emit('clock:alarms'); };
  function ring(label) {
    LX.notify({ title: 'Alarm', body: label || 'Alarm', icon: 'bell', appId: 'clock', timeout: 15000 });
    let n = 0; const iv = setInterval(() => { LX.audio.beep(n % 2 ? 880 : 988, 0.18, 'square', 0.15); if (++n > 9) clearInterval(iv); }, 280);
  }
  function tickAlarms() {
    const now = new Date(), mk = Math.floor(now.getTime() / 60000); if (mk === lastMin) return; lastMin = mk;
    const t = P(now.getHours()) + ':' + P(now.getMinutes());
    getAlarms().forEach((a) => { if (a.on && a.time === t && (!a.days.length || a.days.includes(now.getDay()))) { ring(a.label); if (!a.days.length) { a.on = false; saveAlarms(); } } });
  }
  function startAlarms() { if (!alTimer) alTimer = setInterval(tickAlarms, 1000); }
  setTimeout(startAlarms, 2000);

  LX.apps.register({
    id: 'clock', name: 'Clock', icon: 'clock', color: '#4FD1C5', category: 'Productivity',
    desc: 'World clocks, alarms, stopwatch and timer', width: 560, height: 620, minWidth: 380, minHeight: 440,
    open(win) {
      startAlarms();
      const root = win.body; const timers = []; const offs = [];
      let tab = LX.store.get('app.clock.tab', 'world');
      const content = H('div', { class: 'ck-content scroll' });
      const tabsEl = H('div', { class: 'tabs' });
      root.append(tabsEl, content);
      const clearT = () => { while (timers.length) clearInterval(timers.pop()); };
      win.onClose(() => { clearT(); offs.forEach((f) => f()); });
      const every = (fn, ms) => { fn(); timers.push(setInterval(fn, ms)); };

      function show(t) { tab = t; LX.store.set('app.clock.tab', t); clearT(); tabsEl.replaceChildren(...['world', 'alarms', 'stopwatch', 'timer'].map((x) => H('button', { class: 'tab' + (x === t ? ' active' : ''), text: { world: 'World Clock', alarms: 'Alarms', stopwatch: 'Stopwatch', timer: 'Timer' }[x], onclick: () => show(x) }))); ({ world, alarms: alarmsT, stopwatch, timer })[t](); }

      // --- world ---
      function world() {
        const local = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        let zones = LX.store.get('app.clock.zones', ['America/New_York', 'Europe/London', 'Asia/Tokyo']);
        if (!Array.isArray(zones)) zones = [];
        const big = analog(150), bigTxt = H('div', { class: 'ck-big' }), bigDate = H('div', { class: 'muted' });
        const list = H('div', { class: 'ck-zones' });
        const sel = H('select', { class: 'select' }, H('option', { value: '', text: 'Add a city…' }), ZONES.filter((z) => !zones.includes(z)).map((z) => H('option', { value: z, text: cityOf(z) + ' (' + z.split('/')[0] + ')' })));
        sel.onchange = () => { if (sel.value) { zones.push(sel.value); LX.store.set('app.clock.zones', zones); world(); } };
        content.replaceChildren(H('div', { class: 'ck-hero' }, big, H('div', null, bigTxt, bigDate, H('div', { class: 'muted', text: 'Local · ' + cityOf(local) }))), H('div', { class: 'row gap ck-add' }, sel), list);
        const rows = zones.map((z) => { const t = H('div', { class: 'ck-zt' }), s = H('div', { class: 'muted ck-zs' }); const mini = analog(44);
          const r = H('div', { class: 'ck-zone', oncontextmenu: (e) => { e.preventDefault(); LX.menu.show(e.clientX, e.clientY, [{ label: 'Remove', icon: 'trash', action: rm }]); } }, mini, H('div', { class: 'grow' }, H('div', { text: cityOf(z) }), s), t, H('button', { class: 'btn icon sm', title: 'Remove', html: LX.icon('x', 14), onclick: rm }));
          function rm() { zones = zones.filter((x) => x !== z); LX.store.set('app.clock.zones', zones); world(); }
          list.appendChild(r); return { z, t, s, mini }; });
        if (!zones.length) list.appendChild(H('div', { class: 'muted center ck-empty', text: 'Add a city to compare times.' }));
        every(() => {
          const d = new Date(), p = parts(local, d); big.set(p.h, p.m, p.s);
          bigTxt.textContent = fmt12(p.h, p.m) + ':' + P(p.s).replace(/^/, ''); bigDate.textContent = LX.fmtDate(d);
          rows.forEach((r) => { const q = parts(r.z, d); r.mini.set(q.h, q.m, q.s); r.t.textContent = fmt12(q.h, q.m); const o = offsetMin(r.z, d); r.s.textContent = q.label + ' · ' + (o === 0 ? 'same time' : (o > 0 ? '+' : '−') + Math.floor(Math.abs(o) / 60) + 'h' + (Math.abs(o) % 60 ? ' ' + Math.abs(o) % 60 + 'm' : '')); });
        }, 1000);
      }

      // --- alarms ---
      function alarmsT() {
        const list = H('div', { class: 'ck-alarms' });
        const draw = () => {
          const arr = getAlarms().slice().sort((a, b) => a.time.localeCompare(b.time));
          list.replaceChildren(...(arr.length ? arr.map((a) => H('div', { class: 'ck-alarm' + (a.on ? '' : ' off') },
            H('div', { class: 'grow', onclick: () => edit(a) }, H('div', { class: 'ck-atime', text: (() => { const [h, m] = a.time.split(':').map(Number); return fmt12(h, m); })() }), H('div', { class: 'muted', text: (a.label || 'Alarm') + ' · ' + (a.days.length === 0 ? 'Once' : a.days.length === 7 ? 'Every day' : a.days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(' ')) })),
            H('button', { class: 'btn icon sm', title: 'Delete', html: LX.icon('trash', 15), onclick: () => { alarms = getAlarms().filter((x) => x.id !== a.id); saveAlarms(); } }),
            H('label', { class: 'switch' }, H('input', { type: 'checkbox', checked: !!a.on, onchange: (e) => { a.on = e.target.checked; saveAlarms(); } }), H('span')))) : [H('div', { class: 'muted center ck-empty', text: 'No alarms yet.' })]));
        };
        function edit(a) {
          const isNew = !a; a = a || { id: LX.uid(), time: '08:00', label: '', days: [], on: true };
          const t = H('input', { class: 'input', type: 'time', value: a.time }), l = H('input', { class: 'input', placeholder: 'Label', value: a.label });
          let days = a.days.slice(); const dd = H('div', { class: 'ck-days' });
          const dr = () => dd.replaceChildren(...DAYS.map((c, i) => H('button', { class: 'ck-day' + (days.includes(i) ? ' on' : ''), text: c, onclick: () => { days = days.includes(i) ? days.filter((x) => x !== i) : days.concat(i); dr(); } }))); dr();
          const close = () => ov.remove();
          const ov = H('div', { class: 'ck-ov', onmousedown: (e) => { if (e.target === ov) close(); }, onkeydown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } } }, H('div', { class: 'card ck-dlg' }, H('h3', { text: isNew ? 'New alarm' : 'Edit alarm' }), t, l, H('div', { class: 'muted', text: 'Repeat (none = once)' }), dd,
            H('div', { class: 'row gap', style: 'justify-content:flex-end' }, H('button', { class: 'btn ghost', text: 'Cancel', onclick: close }), H('button', { class: 'btn primary', text: 'Save', onclick: () => { if (!/^\d{2}:\d{2}$/.test(t.value)) { t.focus(); return; } Object.assign(a, { time: t.value, label: l.value.trim(), days, on: true }); if (isNew) getAlarms().push(a); saveAlarms(); close(); } }))));
          root.appendChild(ov); t.focus();
        }
        content.replaceChildren(H('div', { class: 'row ck-bar' }, H('div', { class: 'grow muted', text: 'Alarms ring with a notification and a beep while Leonux is open.' }), H('button', { class: 'btn primary sm', html: LX.icon('plus', 14) + ' Add alarm', onclick: () => edit() }), H('button', { class: 'btn sm', text: 'Test', onclick: () => ring('Test alarm') })), list);
        draw(); offs.push(LX.bus.on('clock:alarms', () => { if (tab === 'alarms' && list.isConnected) draw(); }));
      }

      // --- stopwatch ---
      function stopwatch() {
        const st = LX.store.get('app.clock.sw', null) || { acc: 0, start: 0, laps: [] };
        const disp = H('div', { class: 'ck-sw' }), lapsEl = H('div', { class: 'ck-laps' });
        const now = () => st.acc + (st.start ? Date.now() - st.start : 0);
        const persist = () => LX.store.set('app.clock.sw', st);
        const go = H('button', { class: 'btn primary ck-btn', onclick: () => { if (st.start) { st.acc += Date.now() - st.start; st.start = 0; } else st.start = Date.now(); persist(); upd(); } });
        const lap = H('button', { class: 'btn ck-btn', onclick: () => { if (st.start) { st.laps.unshift(now()); persist(); drawLaps(); } else { st.acc = 0; st.laps = []; persist(); upd(); drawLaps(); } } });
        function upd() { go.textContent = st.start ? 'Stop' : (st.acc ? 'Resume' : 'Start'); lap.textContent = st.start ? 'Lap' : 'Reset'; lap.disabled = !st.start && !st.acc; disp.textContent = fmtMs(now()); }
        function drawLaps() {
          const L = st.laps; const splits = L.map((t, i) => t - (L[i + 1] || 0)); const mn = Math.min(...splits), mx = Math.max(...splits);
          lapsEl.replaceChildren(...L.map((t, i) => H('div', { class: 'ck-lap' + (L.length > 2 && splits[i] === mn ? ' best' : L.length > 2 && splits[i] === mx ? ' worst' : '') }, H('span', { class: 'muted', text: 'Lap ' + (L.length - i) }), H('span', { text: '+' + fmtMs(splits[i]) }), H('span', { class: 'muted', text: fmtMs(t) }))));
          if (!L.length) lapsEl.replaceChildren(H('div', { class: 'muted center ck-empty', text: 'Laps appear here.' }));
        }
        content.replaceChildren(H('div', { class: 'ck-swwrap' }, disp, H('div', { class: 'row gap', style: 'justify-content:center' }, lap, go)), lapsEl);
        upd(); drawLaps(); every(() => { disp.textContent = fmtMs(now()); }, 37);
      }

      // --- timer ---
      function timer() {
        const T = LX.store.get('app.clock.timer', null) || { total: 300, end: 0, left: 300, running: false };
        const hh = H('input', { class: 'input ck-ti', type: 'number', min: 0, max: 99, value: Math.floor(T.total / 3600) }), mm = H('input', { class: 'input ck-ti', type: 'number', min: 0, max: 59, value: Math.floor(T.total / 60) % 60 }), ss = H('input', { class: 'input ck-ti', type: 'number', min: 0, max: 59, value: T.total % 60 });
        const inputs = H('div', { class: 'row gap ck-inputs', style: 'justify-content:center' }, hh, H('b', { text: ':' }), mm, H('b', { text: ':' }), ss);
        const disp = H('div', { class: 'ck-sw' }), ring = H('div', { class: 'ck-ring' });
        const R = 88, C = 2 * Math.PI * R;
        ring.innerHTML = '<svg viewBox="0 0 200 200" width="200" height="200"><circle cx="100" cy="100" r="' + R + '" fill="none" stroke="var(--surface-3)" stroke-width="8"/><circle class="arc" cx="100" cy="100" r="' + R + '" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="0" transform="rotate(-90 100 100)"/></svg>';
        const arc = ring.querySelector('.arc'); ring.appendChild(disp);
        const persist = () => LX.store.set('app.clock.timer', T);
        const left = () => (T.running ? Math.max(0, (T.end - Date.now()) / 1000) : T.left);
        const go = H('button', { class: 'btn primary ck-btn', onclick: () => {
          if (T.running) { T.left = left(); T.running = false; }
          else { if (T.left <= 0 || T.left === T.total || !T.started) { T.total = (+hh.value || 0) * 3600 + (+mm.value || 0) * 60 + (+ss.value || 0); if (T.left <= 0 || !T.started) T.left = T.total; } if (T.total <= 0) return; T.end = Date.now() + T.left * 1000; T.running = true; T.started = true; }
          persist(); upd(); } });
        const reset = H('button', { class: 'btn ck-btn', text: 'Reset', onclick: () => { T.running = false; T.started = false; T.total = (+hh.value || 0) * 3600 + (+mm.value || 0) * 60 + (+ss.value || 0); T.left = T.total; persist(); upd(); } });
        const presets = H('div', { class: 'row gap', style: 'justify-content:center;flex-wrap:wrap' }, [60, 180, 300, 600, 900, 1800].map((s) => H('button', { class: 'btn sm', text: s < 3600 ? s / 60 + ' min' : '1 h', onclick: () => { T.running = false; T.started = false; T.total = T.left = s; hh.value = 0; mm.value = Math.floor(s / 60); ss.value = 0; persist(); upd(); } })));
        function upd() {
          const active = T.running || T.started;
          inputs.style.display = active ? 'none' : ''; presets.style.display = active ? 'none' : '';
          ring.style.display = active ? '' : 'none'; go.textContent = T.running ? 'Pause' : (T.started ? 'Resume' : 'Start'); reset.disabled = !active;
          const l = left(); disp.textContent = fmtHMS(l); arc.setAttribute('stroke-dashoffset', C * (1 - (T.total ? l / T.total : 0)));
        }
        content.replaceChildren(H('div', { class: 'ck-swwrap' }, inputs, ring, presets, H('div', { class: 'row gap', style: 'justify-content:center' }, reset, go)));
        upd();
        every(() => { if (T.running) { if (left() <= 0) { T.running = false; T.started = false; T.left = T.total; persist(); LX.notify({ title: 'Timer finished', body: fmtHMS(T.total) + ' elapsed', icon: 'clock', appId: 'clock', timeout: 12000 }); let n = 0; const iv = setInterval(() => { LX.audio.beep(n % 2 ? 784 : 988, 0.2, 'triangle', 0.18); if (++n > 7) clearInterval(iv); }, 300); } upd(); } }, 200);
      }
      show(tab);
    },
  });
})();
