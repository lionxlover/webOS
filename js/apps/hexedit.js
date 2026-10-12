/* Store app — Hex Editor: byte-level view & edit for VFS files (text and data-URL payloads). */
(function () {
  'use strict';
  const H = LX.h;
  const ROW = 16;

  LX.apps.register({
    id: 'hexedit', name: 'Hex Editor', icon: 'hash', color: '#F6C177', category: 'Developer',
    pkg: true, pkgVersion: '1.1', pkgSize: 6, developer: 'Savannah Softworks', downloads: 540,
    desc: 'Inspect and edit files byte by byte', longDesc: 'Open any file from the Leonux filesystem and inspect it as a hex dump: offsets, bytes and ASCII. Click a byte to patch it, then write the whole file back to disk.',
    permissions: ['Local storage'], changelog: 'Supports data-URL media files.',
    canOpenExt: ['txt', 'js', 'json', 'css', 'html', 'svg', 'md', 'csv'],
    width: 860, height: 580, minWidth: 520, minHeight: 380,
    open(win, args) {
      let bytes = new Uint8Array(0), path = null, dirty = false, name = '';
      const info = H('div', { class: 'hx-info muted', style: { fontSize: '12px' } });
      const dump = H('div', { class: 'hx-dump scroll' });
      const offset = H('div', { class: 'hx-off muted' });

      function loadPath(p) {
        if (!LX.vfs.isFile(p)) return;
        path = p; name = LX.vfs.basename(p);
        const d = LX.vfs.read(p);
        if (d.indexOf('data:') === 0) {
          const b64 = d.slice(d.indexOf(',') + 1);
          const bin = atob(b64);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else bytes = new TextEncoder().encode(d);
        dirty = false; paint();
      }
      function serialize() {
        const txt = new TextDecoder().decode(bytes);
        if (path && LX.vfs.ext(path) === 'svg') return txt;
        return txt;
      }
      function save() {
        if (!path) return;
        const d = LX.vfs.read(path);
        if (d.indexOf('data:') === 0) {
          let bin = '';
          bytes.forEach((b) => bin += String.fromCharCode(b));
          LX.vfs.write(path, d.slice(0, d.indexOf(',') + 1) + btoa(bin));
        } else LX.vfs.write(path, serialize());
        dirty = false; paint();
        LX.notify({ title: 'Saved', body: path, icon: 'save', timeout: 1600 });
      }

      function paint() {
        win.setTitle((name || 'No file') + (dirty ? ' *' : '') + ' — Hex Editor');
        info.textContent = path ? (bytes.length + ' bytes · ' + (dirty ? 'unsaved changes' : 'saved')) : 'Open a file to begin';
        dump.innerHTML = '';
        if (!path) {
          dump.appendChild(H('div', { class: 'center', style: { padding: '40px' } },
            H('div', { html: LX.icon('hash', 44) }), H('div', { class: 'muted', style: { marginTop: '10px' }, text: 'Open a file from the Leonux filesystem' })));
          return;
        }
        for (let r = 0; r < Math.ceil(bytes.length / ROW); r++) {
          const rowEl = H('div', { class: 'hx-row' });
          rowEl.appendChild(H('span', { class: 'hx-ro', text: (r * ROW).toString(16).padStart(6, '0') }));
          const hexPart = H('span', { class: 'hx-hex' });
          const ascPart = H('span', { class: 'hx-asc' });
          for (let c = 0; c < ROW; c++) {
            const i = r * ROW + c;
            if (i >= bytes.length) { hexPart.appendChild(H('span', { class: 'hx-b dim', text: '··' })); ascPart.appendChild(H('span', { class: 'dim' }, '·')); continue; }
            const b = bytes[i];
            const hexCell = H('span', { class: 'hx-b', dataset: { i }, text: b.toString(16).padStart(2, '0'), title: 'offset ' + i, onclick: () => editByte(i, hexCell) });
            const asc = b >= 32 && b < 127 ? String.fromCharCode(b) : '·';
            ascPart.appendChild(H('span', { class: 'hx-a', dataset: { i }, text: asc, onclick: () => editByte(i, hexCell) }));
            hexPart.appendChild(hexCell);
          }
          rowEl.append(hexPart, ascPart);
          dump.appendChild(rowEl);
        }
      }
      function editByte(i, cell) {
        const cur = bytes[i].toString(16).padStart(2, '0');
        const inp = H('input', { class: 'input hx-in', value: cur, maxlength: 2, style: { width: '46px', textTransform: 'lowercase' }, onkeydown: (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cell.innerHTML = cur; } });
        cell.innerHTML = ''; cell.appendChild(inp); inp.focus(); inp.select();
        const commit = () => {
          const v = parseInt(inp.value.replace(/[^0-9a-f]/gi, ''), 16);
          if (!isNaN(v)) { bytes[i] = v & 255; dirty = true; }
          paint();
        };
        inp.addEventListener('blur', commit, { once: true });
      }

      win.body.append(
        H('div', { class: 'toolbar' },
          H('button', { class: 'btn sm', html: LX.icon('folder', 13) + ' Open', onclick: () => LX.dialog.openFile({ title: 'Open in hex editor', path: LX.vfs.HOME }).then((p) => { if (p) loadPath(p); }) }),
          H('button', { class: 'btn sm primary', html: LX.icon('save', 13) + ' Save', onclick: save, disabled: !path }),
          H('button', { class: 'btn sm ghost', html: LX.icon('search', 13), title: 'Jump to offset', onclick: async () => {
            const v = await LX.dialog.prompt('Offset (hex or decimal)', '0', 'Jump to offset');
            if (v == null) return;
            const n = /^[0-9a-f]+$/i.test(v) && !/^\d+$/.test(v) ? parseInt(v, 16) : +v;
            if (!isNaN(n)) { const row = Math.floor(n / ROW); const el = dump.children[row]; if (el) el.scrollIntoView({ block: 'center' }); }
          } }),
          info, H('span', { class: 'grow' }), offset),
        dump);
      if (args && args.path) loadPath(args.path);
    },
  });
})();
