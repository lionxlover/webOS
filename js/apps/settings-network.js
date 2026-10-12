/* Leonux Web OS — Settings pages: Network (Wi-Fi), Bluetooth, Airplane mode (simulated) */
(function () {
  'use strict';
  const H = LX.h, ui = LX.settingsPages.ui, S = LX.settings;
  const NETS = [['LeoNet 5G', 4, true], ['Home-WiFi-2.4', 3, true], ['CoffeeShop Guest', 2, false], ['FBI Surveillance Van', 3, true], ['xfinitywifi', 1, false], ['Neighbour_5G', 2, true], ['Pixel_Hotspot', 4, true]];
  const DEVS = [['Leo Buds Pro', 'headphones', 'Audio'], ['Magic Keyboard', 'keyboard', 'Keyboard'], ['MX Master 3', 'mouse', 'Mouse'], ['Galaxy Watch', 'clock', 'Wearable'], ['JBL Flip 6', 'volume', 'Speaker'], ['Pixel 9', 'monitor', 'Phone']];
  const bars = (n) => H('span', { class: 'st-bars' }, [1, 2, 3, 4].map((i) => H('i', { class: i <= n ? 'on' : '', style: { height: 4 + i * 3 + 'px' } })));
  const airplaneBanner = () => S.get('airplane') ? H('div', { class: 'st-banner', html: LX.icon('alert', 16) + ' Airplane mode is on. Wireless radios are disabled.' }) : null;

  LX.settingsPages.add({ id: 'network', title: 'Network & Wi-Fi', icon: 'wifi', group: 'Connectivity', order: 40, render(c) {
    const known = S.get('knownNets') || ['LeoNet 5G'];
    let connected = S.get('ssid') || LX.network.ssid;
    const list = H('div', { class: 'st-card' });
    const draw = () => {
      list.innerHTML = '';
      if (!S.get('wifi') || S.get('airplane')) { list.appendChild(H('div', { class: 'st-empty muted', text: 'Wi-Fi is off.' })); return; }
      NETS.slice().sort((a, b) => (b[0] === connected) - (a[0] === connected) || b[1] - a[1]).forEach(([n, sig, sec]) => {
        const on = n === connected;
        list.appendChild(H('div', { class: 'st-row st-net' + (on ? ' on' : '') },
          H('span', { html: LX.icon('wifi', 18) }), H('div', { class: 'st-rl' }, H('div', { class: 'st-lbl', text: n }), H('div', { class: 'st-desc muted', text: on ? 'Connected · ' + (LX.network.online ? 'Internet' : 'No internet') : (sec ? 'Secured' : 'Open') + (known.indexOf(n) >= 0 ? ' · Saved' : '') })),
          bars(sig), sec ? H('span', { class: 'muted', html: LX.icon('lock', 13) }) : null,
          H('button', { class: 'btn sm' + (on ? '' : ' primary'), text: on ? 'Disconnect' : 'Connect', onclick: () => connect(n, sec, on) })));
      });
    };
    async function connect(n, sec, on) {
      if (on) { connected = ''; S.set('ssid', ''); LX.network.ssid = ''; draw(); return; }
      if (sec && known.indexOf(n) < 0) { const pw = await LX.dialog.prompt('Enter the password for "' + n + '"', '', 'Wi-Fi password'); if (pw == null) return; if (pw.length < 8) { LX.dialog.alert('Password must be at least 8 characters.', 'Wi-Fi'); return; } known.push(n); S.set('knownNets', known.slice()); }
      connected = n; LX.network.ssid = n; S.set('ssid', n); LX.notify({ title: 'Wi-Fi', body: 'Connected to ' + n, icon: 'wifi' }); draw();
    }
    const scan = H('button', { class: 'btn sm', html: LX.icon('refresh', 14) + ' Scan', onclick: () => { list.innerHTML = '<div class="st-empty muted">Scanning…</div>'; setTimeout(draw, 800); } });
    c.appendChild(ui.page('Network & Wi-Fi', airplaneBanner(),
      ui.group('Wi-Fi', ui.row('Wi-Fi', connected && S.get('wifi') ? 'Connected to ' + connected : 'Off', ui.toggle('wifi', draw)), ui.row('Airplane mode', 'Turns off Wi-Fi and Bluetooth', ui.toggle('airplane', () => LX.bus.emit('settings:change', { key: 'airplane', value: S.get('airplane') })))),
      H('div', { class: 'st-gt row' }, H('span', { class: 'grow', text: 'Available networks' }), scan), list,
      ui.group('Connection',
        ui.row('IP address', null, H('span', { class: 'muted st-mono', text: '192.168.1.' + (S.get('ipTail') || (S.set('ipTail', LX.rand(20, 200)), S.get('ipTail'))) })),
        ui.row('Gateway', null, H('span', { class: 'muted st-mono', text: '192.168.1.1' })),
        ui.row('DNS', null, H('span', { class: 'muted st-mono', text: '1.1.1.1, 8.8.8.8' })),
        ui.row('Browser reports', null, H('span', { class: 'muted', text: navigator.onLine ? 'Online' : 'Offline' })))));
    draw();
  } });

  LX.settingsPages.add({ id: 'bluetooth', title: 'Bluetooth', icon: 'bluetooth', group: 'Connectivity', order: 41, render(c) {
    let paired = S.get('btPaired') || ['Leo Buds Pro'];
    let connectedDev = S.get('btConn') || '';
    const list = H('div', { class: 'st-card' });
    const draw = () => {
      list.innerHTML = '';
      if (!S.get('bluetooth') || S.get('airplane')) { list.appendChild(H('div', { class: 'st-empty muted', text: 'Bluetooth is off.' })); return; }
      DEVS.forEach(([n, ic, type]) => {
        const isP = paired.indexOf(n) >= 0, isC = connectedDev === n;
        list.appendChild(H('div', { class: 'st-row' }, H('span', { html: LX.icon(ic, 18) }),
          H('div', { class: 'st-rl' }, H('div', { class: 'st-lbl', text: n }), H('div', { class: 'st-desc muted', text: type + (isC ? ' · Connected' : isP ? ' · Paired' : '') })),
          H('div', { class: 'st-ctl' },
            isP ? H('button', { class: 'btn sm ghost', text: 'Forget', onclick: () => { paired = paired.filter((x) => x !== n); if (isC) connectedDev = ''; save(); draw(); } }) : null,
            H('button', { class: 'btn sm' + (isC ? '' : ' primary'), text: isC ? 'Disconnect' : isP ? 'Connect' : 'Pair', onclick: (e) => act(n, isP, isC, e.currentTarget) }))));
      });
    };
    const save = () => { S.set('btPaired', paired.slice()); S.set('btConn', connectedDev); };
    function act(n, isP, isC, btn) {
      if (isC) { connectedDev = ''; save(); draw(); return; }
      btn.textContent = 'Pairing…'; btn.disabled = true;
      setTimeout(() => { if (!isP) paired.push(n); connectedDev = n; save(); LX.notify({ title: 'Bluetooth', body: n + ' connected', icon: 'bluetooth' }); draw(); }, 900);
    }
    c.appendChild(ui.page('Bluetooth', airplaneBanner(),
      ui.group('Bluetooth', ui.row('Bluetooth', 'Discoverable as "' + S.get('hostname') + '"', ui.toggle('bluetooth', draw))),
      H('div', { class: 'st-gt', text: 'Devices' }), list));
    draw();
  } });

  LX.settingsPages.add({ id: 'airplane', title: 'Airplane mode', icon: 'zap', group: 'Connectivity', order: 42, render(c) {
    c.appendChild(ui.page('Airplane mode', airplaneBanner(),
      ui.group('', ui.row('Airplane mode', 'Disables Wi-Fi and Bluetooth', ui.toggle('airplane', () => { LX.bus.emit('settings:change', { key: 'airplane', value: S.get('airplane') }); }))),
      ui.group('Radios', ui.row('Wi-Fi', S.get('airplane') ? 'Disabled by airplane mode' : null, ui.toggle('wifi')), ui.row('Bluetooth', S.get('airplane') ? 'Disabled by airplane mode' : null, ui.toggle('bluetooth')))));
  } });
})();
