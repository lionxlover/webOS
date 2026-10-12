/* Leonux OS 2.2 — Quick Look: LX.quicklook.show(path) floating glass preview. Space on a selected Files / Desktop item opens it,
   ←/→ cycle through siblings, Esc or Space closes, Enter opens the file in its app. */
(function () {
  'use strict';
  const H = LX.h;
  let el, card, bodyEl, titleEl, metaEl, countEl, openBtn, list = [], idx = 0, current = null, urls = [];
  const IMG = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'];
  const AUD = ['mp3', 'wav', 'ogg', 'm4a'], VID = ['mp4', 'webm'];
  const esc = LX.escape;
  const kindOf = (st) => {
    if (st.type === 'dir') return 'dir';
    const e = LX.vfs.ext(st.path);
    if (IMG.indexOf(e) >= 0 || (st.mime || '').indexOf('image/') === 0) return 'image';
    if (AUD.indexOf(e) >= 0 || (st.mime || '').indexOf('audio/') === 0) return 'audio';
    if (VID.indexOf(e) >= 0 || (st.mime || '').indexOf('video/') === 0) return 'video';
    if (e === 'md' || e === 'markdown') return 'md';
    if (e === 'json' || e === 'lxtrack' || e === 'lxnote') return 'json';
    if (e === 'html' || e === 'htm') return 'html';
    return 'text';
  };
  const KIND_NAME = { dir: 'Folder', image: 'Image', audio: 'Audio', video: 'Video', md: 'Markdown', json: 'JSON', html: 'HTML document', text: 'Text' };

  // ---------- tiny renderers ----------
  function md(src) {
    const lines = esc(src).split('\n'); let out = '', list = null, code = null;
    const inline = (t) => t.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a>$1</a>');
    const endList = () => { if (list) { out += '</' + list + '>'; list = null; } };
    lines.forEach((ln) => {
      if (/^```/.test(ln)) { if (code == null) { endList(); code = []; } else { out += '<pre>' + code.join('\n') + '</pre>'; code = null; } return; }
      if (code) { code.push(ln); return; }
      let m;
      if ((m = /^(#{1,4})\s+(.*)$/.exec(ln))) { endList(); out += '<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'; }
      else if ((m = /^\s*[-*+]\s+(.*)$/.exec(ln))) { if (list !== 'ul') { endList(); out += '<ul>'; list = 'ul'; } out += '<li>' + inline(m[1]) + '</li>'; }
      else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(ln))) { if (list !== 'ol') { endList(); out += '<ol>'; list = 'ol'; } out += '<li>' + inline(m[1]) + '</li>'; }
      else if (/^&gt;\s?/.test(ln)) { endList(); out += '<blockquote>' + inline(ln.replace(/^&gt;\s?/, '')) + '</blockquote>'; }
      else if (/^(-{3,}|\*{3,})$/.test(ln.trim())) { endList(); out += '<hr>'; }
      else if (!ln.trim()) endList();
      else { endList(); out += '<p>' + inline(ln) + '</p>'; }
    });
    endList(); if (code) out += '<pre>' + code.join('\n') + '</pre>';
    return out;
  }
  function jsonHtml(src) {
    let t = src; try { t = JSON.stringify(JSON.parse(src), null, 2); } catch (e) { /* show raw */ }
    return esc(t).replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|(-?\b\d+\.?\d*(?:[eE][+-]?\d+)?\b)/g, (m, s, colon, b, n) => (s ? '<span class="' + (colon ? 'jk' : 'js') + '">' + s + '</span>' + (colon || '') : b ? '<span class="jb">' + b + '</span>' : '<span class="jn">' + n + '</span>'));
  }
  function codeHtml(src) {
    const lines = src.split('\n'); const cut = lines.length > 1500; const l = cut ? lines.slice(0, 1500) : lines;
    return '<div class="ql-code">' + l.map((x, i) => '<div class="ql-ln"><i>' + (i + 1) + '</i><span>' + (esc(x) || ' ') + '</span></div>').join('') + (cut ? '<div class="ql-more">… ' + (lines.length - 1500) + ' more lines</div>' : '') + '</div>';
  }
  function dataUrl(content, mime) { return content.indexOf('data:') === 0 ? content : 'data:' + mime + ';charset=utf-8,' + encodeURIComponent(content); }
  function bigIcon(icon, color, text) { return H('div', { class: 'ql-empty' }, H('div', { class: 'ql-bigico', style: { color: color || 'var(--accent)' }, html: LX.icon(icon, 72) }), H('div', { text: text || 'No preview available' })); }

  function render(st) {
    const k = kindOf(st); bodyEl.className = 'ql-body ql-k-' + k; bodyEl.innerHTML = '';
    const mime = st.mime || LX.vfs.mime(st.path) || 'text/plain';
    try {
      if (k === 'dir') {
        const kids = LX.vfs.ls(st.path); const ic = LX.fileIcon || (() => ['file', '#9aa1b0']);
        bodyEl.appendChild(H('div', { class: 'ql-dir' }, kids.length ? kids.slice(0, 60).map((c) => { const i = ic(c); return H('div', { class: 'ql-dirit' }, H('span', { style: { color: i[1] }, html: LX.icon(i[0], 28) }), H('span', { class: 'ellipsis', text: c.name })); }) : H('div', { class: 'muted', text: 'This folder is empty' })));
        return LX.plural(kids.length, 'item');
      }
      const c = LX.vfs.read(st.path);
      if (k === 'image') { const im = H('img', { class: 'ql-img', alt: st.name, draggable: 'false', src: dataUrl(c, mime.indexOf('image/') === 0 ? mime : 'image/' + LX.vfs.ext(st.path)) }); bodyEl.appendChild(im); im.onload = () => { metaEl.dataset.dim = im.naturalWidth + ' × ' + im.naturalHeight; metaEl.textContent = meta(st, LX.fmtBytes(st.size) + ' · ' + metaEl.dataset.dim); }; }
      else if (k === 'audio') {
        const a = H('audio', { controls: true, src: c.indexOf('data:') === 0 ? c : '' });
        bodyEl.appendChild(H('div', { class: 'ql-audio' }, H('div', { class: 'ql-cover', html: LX.icon('music', 64) }), H('div', { class: 'ql-atitle', text: st.name.replace(/\.[^.]+$/, '') }), c.indexOf('data:') === 0 ? a : H('div', { class: 'muted', text: 'Open in Music to play' })));
      } else if (k === 'video') bodyEl.appendChild(H('video', { class: 'ql-video', controls: true, src: dataUrl(c, mime) }));
      else if (k === 'html') bodyEl.appendChild(H('iframe', { class: 'ql-frame', sandbox: '', srcdoc: c, title: st.name }));
      else if (k === 'md') bodyEl.appendChild(H('div', { class: 'ql-md selectable', html: md(c.slice(0, 200000)) }));
      else if (k === 'json') bodyEl.appendChild(H('pre', { class: 'ql-json selectable', html: jsonHtml(c.slice(0, 200000)) }));
      else if (c.indexOf('data:') === 0) bodyEl.appendChild(bigIcon('file', null));
      else bodyEl.appendChild(H('div', { class: 'selectable', html: codeHtml(c.slice(0, 200000)) }));
    } catch (e) { bodyEl.appendChild(bigIcon('alert', 'var(--danger)', 'Cannot preview: ' + (e.message || e))); }
    return LX.fmtBytes(st.size);
  }
  const meta = (st, extra) => (KIND_NAME[kindOf(st)] || 'File') + ' · ' + extra;

  function load(i) {
    if (!list.length) return;
    idx = (i + list.length) % list.length;
    let st; try { st = LX.vfs.stat(list[idx]); } catch (e) { return close(); }
    current = st;
    titleEl.textContent = st.name;
    const extra = render(st);
    metaEl.textContent = meta(st, extra + (st.mtime ? ' · ' + LX.fmtDateTime(st.mtime) : ''));
    countEl.textContent = list.length > 1 ? (idx + 1) + ' / ' + list.length : '';
    countEl.parentNode.classList.toggle('single', list.length < 2);
    card.classList.remove('flip'); void card.offsetWidth; card.classList.add('flip');
  }
  function show(path, opts) {
    opts = opts || {};
    try { LX.vfs.stat(path); } catch (e) { return false; }
    list = (opts.siblings && opts.siblings.length ? opts.siblings : siblingsOf(path)).slice(0, 400);
    if (list.indexOf(path) < 0) list.unshift(path);
    LX.panels.close(); LX.menu.close();
    const o = opts.origin; if (o) card.style.transformOrigin = Math.round(o.x - (innerWidth - card.offsetWidth) / 2) + 'px ' + Math.round(o.y - (innerHeight - card.offsetHeight) / 2) + 'px'; else card.style.transformOrigin = '';
    el.classList.add('open');
    load(list.indexOf(path));
    return true;
  }
  function close() {
    if (!el || !el.classList.contains('open')) return;
    el.classList.remove('open'); bodyEl.querySelectorAll('audio,video').forEach((m) => { try { m.pause(); } catch (e) {} });
    setTimeout(() => { if (!el.classList.contains('open')) bodyEl.innerHTML = ''; }, 250);
  }
  function siblingsOf(path) {
    try { return LX.vfs.ls(LX.vfs.dirname(path)).map((s) => s.path); } catch (e) { return [path]; }
  }

  // selection currently visible in the focused window / desktop → {paths, siblings, origin}
  function selection(e) {
    const t = e.target;
    if (t && t.closest && t.closest('input,textarea,select,[contenteditable],button')) return null;
    const w = LX.wm.focused();
    if (w && !w.minimized && !w.closed && !(t && t.closest && t.closest('.d-icon'))) {
      if (w.appId !== 'files') return null;
      const all = LX.$$('.f-item', w.body); const sel = all.filter((x) => x.classList.contains('sel'));
      if (!sel.length) return null;
      const r = sel[0].getBoundingClientRect();
      return { paths: sel.map((x) => x.dataset.path), siblings: sel.length > 1 ? sel.map((x) => x.dataset.path) : all.map((x) => x.dataset.path), origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 } };
    }
    const d = LX.$$('.d-icon.sel').filter((x) => x.dataset.key && x.dataset.key[0] === '/');
    if (!d.length) return null;
    const all = LX.$$('.d-icon').filter((x) => x.dataset.key && x.dataset.key[0] === '/'); const r = d[0].getBoundingClientRect();
    return { paths: d.map((x) => x.dataset.key), siblings: d.length > 1 ? d.map((x) => x.dataset.key) : all.map((x) => x.dataset.key), origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 } };
  }

  LX.quicklook = {
    show, close, isOpen: () => !!(el && el.classList.contains('open')),
    next() { load(idx + 1); }, prev() { load(idx - 1); },
    get path() { return current && current.path; },
  };

  LX.onInit(() => {
    openBtn = H('button', { class: 'btn sm', html: LX.icon('external', 14) + '<span>Open</span>', onclick: () => { const p = current && current.path; close(); if (p) (LX.vfs.isDir(p) ? LX.apps.launch('files', { path: p }) : LX.apps.openFile(p)); } });
    titleEl = H('div', { class: 'ql-title ellipsis' }); metaEl = H('div', { class: 'ql-meta ellipsis' }); countEl = H('span', { class: 'ql-count' });
    bodyEl = H('div', { class: 'ql-body' });
    card = H('div', { class: 'ql-card', role: 'dialog', 'aria-label': 'Quick Look' },
      H('div', { class: 'ql-head' }, H('button', { class: 'wc wc-close', 'aria-label': 'Close', title: 'Close (Esc)', onclick: close }),
        H('div', { class: 'ql-hd' }, titleEl, metaEl),
        H('div', { class: 'ql-nav' }, H('button', { class: 'btn icon sm ghost', title: 'Previous (←)', html: LX.icon('chevron-left', 15), onclick: () => load(idx - 1) }), countEl, H('button', { class: 'btn icon sm ghost', title: 'Next (→)', html: LX.icon('chevron-right', 15), onclick: () => load(idx + 1) })), openBtn),
      bodyEl,
      H('div', { class: 'ql-foot' }, H('span', { class: 'kbd', text: 'Space' }), ' close  ', H('span', { class: 'kbd', text: '←' }), H('span', { class: 'kbd', text: '→' }), ' browse  ', H('span', { class: 'kbd', text: 'Enter' }), ' open'));
    el = H('div', { id: 'quicklook', onpointerdown: (e) => { if (e.target === el) close(); } }, card);
    document.body.appendChild(el);

    document.addEventListener('keydown', (e) => {
      if (LX.lock && LX.lock.locked) return;
      if (LX.quicklook.isOpen()) {
        const k = e.key;
        if (k === 'Escape' || k === ' ') { e.preventDefault(); e.stopPropagation(); close(); }
        else if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); load(idx + 1); }
        else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); load(idx - 1); }
        else if (k === 'Enter' && !e.target.closest('audio,video')) { e.preventDefault(); e.stopPropagation(); openBtn.click(); }
        return;
      }
      if (e.key === ' ' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.repeat) {
        const s = selection(e); if (!s || !s.paths.length) return;
        e.preventDefault(); e.stopPropagation();
        show(s.paths[0], { siblings: s.siblings, origin: s.origin });
      }
    }, true);
    LX.bus.on('panel:open', () => close());
  });
})();
