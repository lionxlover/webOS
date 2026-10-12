/* Leonux Web OS — modal dialogs: alert / confirm / prompt / file pickers */
(function () {
  'use strict';
  const H = LX.h;
  function host() { return document.getElementById('dialogs') || document.body; }
  function modal(build) {
    return new Promise((resolve) => {
      const overlay = H('div', { class: 'dlg-overlay' });
      const box = H('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'true' });
      overlay.appendChild(box);
      let done = false;
      const finish = (v) => { if (done) return; done = true; overlay.classList.add('closing'); setTimeout(() => overlay.remove(), 160); document.removeEventListener('keydown', onKey, true); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); finish(ctl.cancelValue); } };
      const ctl = { cancelValue: null, finish };
      build(box, finish, ctl);
      document.addEventListener('keydown', onKey, true);
      host().appendChild(overlay);
      requestAnimationFrame(() => { overlay.classList.add('open'); const f = box.querySelector('[autofocus],input,button.primary'); if (f) f.focus(); });
    });
  }
  const head = (title) => H('div', { class: 'dlg-head', text: title });

  function dlgAlert(msg, title) {
    return modal((box, fin, ctl) => {
      ctl.cancelValue = true;
      box.append(head(title || 'Notice'), H('div', { class: 'dlg-msg', text: msg }), H('div', { class: 'dlg-actions' }, H('button', { class: 'btn primary', text: 'OK', onclick: () => fin(true) })));
    });
  }
  function dlgConfirm(msg, title) {
    return modal((box, fin, ctl) => {
      ctl.cancelValue = false;
      box.append(head(title || 'Confirm'), H('div', { class: 'dlg-msg', text: msg }), H('div', { class: 'dlg-actions' },
        H('button', { class: 'btn ghost', text: 'Cancel', onclick: () => fin(false) }), H('button', { class: 'btn primary', text: 'OK', onclick: () => fin(true) })));
    });
  }
  function dlgPrompt(msg, def, title) {
    return modal((box, fin) => {
      const inp = H('input', { class: 'input', value: def == null ? '' : def, autofocus: true, onkeydown: (e) => { if (e.key === 'Enter') fin(inp.value); } });
      box.append(head(title || 'Input'), H('div', { class: 'dlg-msg', text: msg }), inp, H('div', { class: 'dlg-actions' },
        H('button', { class: 'btn ghost', text: 'Cancel', onclick: () => fin(null) }), H('button', { class: 'btn primary', text: 'OK', onclick: () => fin(inp.value) })));
      setTimeout(() => inp.select(), 30);
    });
  }

  function filePicker(mode, o) {
    o = o || {};
    return modal((box, fin) => {
      box.classList.add('dlg-files');
      let cwd = o.path && LX.vfs.isDir(o.path) ? o.path : (o.path ? LX.vfs.dirname(o.path) : LX.vfs.HOME);
      if (!LX.vfs.isDir(cwd)) cwd = LX.vfs.HOME;
      let sel = null;
      const exts = o.exts && o.exts.length ? o.exts.map((e) => e.toLowerCase()) : null;
      const pathIn = H('input', { class: 'input dlg-path', onkeydown: (e) => { if (e.key === 'Enter') go(pathIn.value); } });
      const list = H('div', { class: 'dlg-list scroll' });
      const nameIn = mode === 'save' ? H('input', { class: 'input', value: o.name || '', placeholder: 'File name' }) : null;
      const ok = H('button', { class: 'btn primary', text: mode === 'save' ? 'Save' : mode === 'folder' ? 'Select folder' : 'Open', onclick: confirmSel });
      const places = [['Home', LX.vfs.HOME, 'home'], ['Desktop', LX.vfs.HOME + '/Desktop', 'monitor'], ['Documents', LX.vfs.HOME + '/Documents', 'file-text'], ['Pictures', LX.vfs.HOME + '/Pictures', 'image'], ['Music', LX.vfs.HOME + '/Music', 'music'], ['Videos', LX.vfs.HOME + '/Videos', 'video'], ['Downloads', LX.vfs.HOME + '/Downloads', 'download'], ['Root', '/', 'hard-drive']];
      function go(p) { p = LX.vfs.norm(p); if (LX.vfs.isDir(p)) { cwd = p; sel = null; render(); } else pathIn.value = cwd; }
      function confirmSel() {
        if (mode === 'folder') return fin(sel && LX.vfs.isDir(sel) ? sel : cwd);
        if (mode === 'save') {
          const n = nameIn.value.trim(); if (!n || /[\/\\]/.test(n)) { nameIn.focus(); return; }
          const p = LX.vfs.join(cwd, n);
          if (LX.vfs.exists(p)) { dlgConfirm('"' + n + '" already exists. Replace it?', 'Overwrite').then((y) => { if (y) fin(p); }); return; }
          return fin(p);
        }
        if (sel && LX.vfs.isFile(sel)) fin(sel);
      }
      function render() {
        pathIn.value = cwd; list.innerHTML = '';
        if (cwd !== '/') list.appendChild(H('div', { class: 'dlg-row', ondblclick: () => go(LX.vfs.dirname(cwd)), onclick: () => {} }, H('span', { html: LX.icon('arrow-up', 16) }), H('span', { text: '..' })));
        LX.vfs.ls(cwd).forEach((s) => {
          if (s.name[0] === '.') return;
          const dim = s.type === 'file' && (mode === 'folder' || (exts && exts.indexOf(LX.vfs.ext(s.name)) < 0));
          const row = H('div', { class: 'dlg-row' + (dim ? ' dim' : '') + (sel === s.path ? ' sel' : ''),
            onclick: () => { if (dim) return; sel = s.path; if (nameIn && s.type === 'file') nameIn.value = s.name; render(); },
            ondblclick: () => { if (s.type === 'dir') go(s.path); else if (!dim) { sel = s.path; if (mode === 'save') nameIn.value = s.name; confirmSel(); } } },
            H('span', { html: LX.icon(s.type === 'dir' ? 'folder' : 'file', 16) }), H('span', { class: 'grow ellipsis', text: s.name }), H('span', { class: 'muted', text: s.type === 'file' ? LX.fmtBytes(s.size) : '' }));
          list.appendChild(row);
        });
        if (!list.children.length) list.appendChild(H('div', { class: 'dlg-empty muted', text: 'This folder is empty' }));
      }
      const side = H('div', { class: 'dlg-places' }, places.map((p) => H('div', { class: 'dlg-place', onclick: () => go(p[1]) }, H('span', { html: LX.icon(p[2], 15) }), p[0])));
      box.append(head(o.title || (mode === 'save' ? 'Save file' : mode === 'folder' ? 'Select folder' : 'Open file')),
        H('div', { class: 'dlg-bar' }, H('button', { class: 'btn icon sm ghost', title: 'Up', html: LX.icon('arrow-up', 15), onclick: () => go(LX.vfs.dirname(cwd)) }), pathIn),
        H('div', { class: 'dlg-main' }, side, list), nameIn && H('div', { class: 'dlg-name' }, nameIn),
        H('div', { class: 'dlg-actions' }, H('button', { class: 'btn ghost', text: 'Cancel', onclick: () => fin(null) }), ok));
      render();
    });
  }

  LX.dialog = {
    alert: dlgAlert, confirm: dlgConfirm, prompt: dlgPrompt,
    openFile: (o) => filePicker('open', o), saveFile: (o) => filePicker('save', o), pickFolder: (o) => filePicker('folder', o),
    custom: modal,
  };
})();
