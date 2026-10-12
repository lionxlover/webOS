/* Leonux Web OS — Calculator: standard / scientific / programmer, hand-written parsers (no eval) */
(function () {
  'use strict';
  const H = LX.h;

  // ---------- floating point expression parser ----------
  function tokenize(src) {
    const t = []; let i = 0; src = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, ' pi ').replace(/√/g, ' sqrt ');
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      let m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
      if (m) { t.push({ k: 'n', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      m = /^[a-zA-Z_]+/.exec(src.slice(i));
      if (m) { t.push({ k: 'id', v: m[0].toLowerCase() }); i += m[0].length; continue; }
      if ('+-*/^()!%,'.indexOf(c) >= 0) { t.push({ k: c }); i++; continue; }
      throw new Error('Unexpected "' + c + '"');
    }
    return t;
  }
  const fact = (n) => { if (n < 0 || Math.floor(n) !== n || n > 170) throw new Error('Invalid factorial'); let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  const rnd = (x) => (isFinite(x) ? Number(x.toPrecision(14)) : x);
  function evalNum(src, opt) {
    opt = opt || {};
    const toks = tokenize(src); let p = 0; const deg = opt.deg !== false;
    const toR = (x) => (deg ? x * Math.PI / 180 : x), fromR = (x) => (deg ? x * 180 / Math.PI : x);
    const F = {
      sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10, log2: Math.log2, floor: Math.floor, ceil: Math.ceil, round: Math.round, fact: fact,
      sin: (x) => rnd(Math.sin(toR(x))), cos: (x) => rnd(Math.cos(toR(x))), tan: (x) => { const r = toR(x); if (Math.abs(Math.cos(r)) < 1e-15) throw new Error('Undefined'); return rnd(Math.tan(r)); },
      asin: (x) => rnd(fromR(Math.asin(x))), acos: (x) => rnd(fromR(Math.acos(x))), atan: (x) => rnd(fromR(Math.atan(x))),
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    };
    F.arcsin = F.asin; F.arccos = F.acos; F.arctan = F.atan;
    const C = { pi: Math.PI, e: Math.E, ans: opt.ans || 0, tau: 2 * Math.PI };
    const peek = () => toks[p] && toks[p].k;
    let pct = false;
    function expr() {
      let v = term();
      while (peek() === '+' || peek() === '-') {
        const op = toks[p++].k; const l = v; pct = false; const r = term();
        const rv = pct ? l * r : r; pct = false; v = op === '+' ? l + rv : l - rv;
      }
      return v;
    }
    function startsOperand() { const k = peek(); return k === 'n' || k === 'id' || k === '('; }
    function term() {
      let v = unary();
      for (;;) {
        const k = peek();
        if (k === '*' || k === '/') {
          p++; const l = v; const r = unary();
          if (k === '/') { if (r === 0) throw new Error('Cannot divide by zero'); v = l / r; } else v = l * r;
          pct = false;
        } else if (startsOperand()) { v = v * unary(); pct = false; } else break;
      }
      return v;
    }
    function unary() {
      if (peek() === '-') { p++; return -unary(); }
      if (peek() === '+') { p++; return unary(); }
      return power();
    }
    function power() {
      let b = postfix();
      if (peek() === '^') { p++; const e = unary(); pct = false; b = Math.pow(b, e); if (isNaN(b)) throw new Error('Invalid power'); }
      return b;
    }
    function postfix() {
      let v = primary();
      for (;;) {
        if (peek() === '!') { p++; v = fact(v); pct = false; } else if (peek() === '%') { p++; v = v / 100; pct = true; } else break;
      }
      return v;
    }
    function primary() {
      const t = toks[p++];
      if (!t) throw new Error('Incomplete expression');
      if (t.k === 'n') { pct = false; return t.v; }
      if (t.k === '(') { const v = expr(); if (peek() === ')') p++; else if (p < toks.length) throw new Error('Missing )'); pct = false; return v; }
      if (t.k === 'id') {
        if (t.v in C) return C[t.v];
        if (t.v in F) {
          let a;
          if (peek() === '(') { p++; a = expr(); if (peek() === ')') p++; else if (p < toks.length) throw new Error('Missing )'); } else a = unary();
          pct = false; const r = F[t.v](a);
          if (typeof r !== 'number' || isNaN(r)) throw new Error('Invalid input');
          return r;
        }
        throw new Error('Unknown "' + t.v + '"');
      }
      throw new Error('Unexpected "' + t.k + '"');
    }
    if (!toks.length) throw new Error('Empty');
    const v = expr();
    if (p < toks.length) throw new Error('Unexpected "' + (toks[p].v != null ? toks[p].v : toks[p].k) + '"');
    if (!isFinite(v)) throw new Error(isNaN(v) ? 'Invalid result' : 'Overflow');
    return v;
  }

  // ---------- integer (programmer) parser ----------
  function evalInt(src, base, bits) {
    const s = String(src).replace(/\s+/g, '').toUpperCase(); const toks = []; let i = 0;
    const digits = '0123456789ABCDEF'.slice(0, base);
    while (i < s.length) {
      const c = s[i];
      if (digits.indexOf(c) >= 0) { let v = 0n; while (i < s.length && digits.indexOf(s[i]) >= 0) { v = v * BigInt(base) + BigInt(digits.indexOf(s[i])); i++; } toks.push({ k: 'n', v }); continue; }
      if (s.substr(i, 2) === '<<' || s.substr(i, 2) === '>>') { toks.push({ k: s.substr(i, 2) }); i += 2; continue; }
      if ('+-*/%&|^~()'.indexOf(c) >= 0) { toks.push({ k: c }); i++; continue; }
      throw new Error('Invalid digit "' + c + '"');
    }
    let p = 0; const peek = () => toks[p] && toks[p].k; const M = (x) => BigInt.asIntN(bits, x);
    const lvl = [['|'], ['^'], ['&'], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];
    function bin(l) {
      if (l >= lvl.length) return unary();
      let v = bin(l + 1);
      while (lvl[l].indexOf(peek()) >= 0) {
        const op = toks[p++].k; const r = bin(l + 1);
        switch (op) {
          case '|': v = v | r; break; case '^': v = v ^ r; break; case '&': v = v & r; break;
          case '<<': v = M(v << BigInt(Number(r) & 255)); break; case '>>': v = v >> BigInt(Number(r) & 255); break;
          case '+': v = v + r; break; case '-': v = v - r; break; case '*': v = v * r; break;
          case '/': if (r === 0n) throw new Error('Cannot divide by zero'); v = v / r; break;
          case '%': if (r === 0n) throw new Error('Cannot divide by zero'); v = v % r; break;
        }
        v = M(v);
      }
      return v;
    }
    function unary() {
      if (peek() === '-') { p++; return M(-unary()); }
      if (peek() === '~') { p++; return M(~unary()); }
      if (peek() === '+') { p++; return unary(); }
      const t = toks[p++]; if (!t) throw new Error('Incomplete expression');
      if (t.k === 'n') return M(t.v);
      if (t.k === '(') { const v = bin(0); if (peek() === ')') p++; return v; }
      throw new Error('Unexpected "' + t.k + '"');
    }
    if (!toks.length) throw new Error('Empty');
    const v = bin(0); if (p < toks.length) throw new Error('Unexpected "' + toks[p].k + '"'); return v;
  }
  const intStr = (v, base, bits) => (base === 10 ? v.toString() : BigInt.asUintN(bits, v).toString(base).toUpperCase());

  // ---------- formatting ----------
  function fmt(n) {
    n = Number(n.toPrecision(12)); if (n === 0) return '0';
    const a = Math.abs(n); if (a >= 1e15 || a < 1e-9) return n.toExponential().replace('e+', 'e');
    return String(n);
  }
  const group = (s) => s.replace(/^(-?)(\d+)/, (m, sg, d) => sg + d.replace(/\B(?=(\d{3})+(?!\d))/g, ','));

  LX.apps.register({
    id: 'calculator', name: 'Calculator', icon: 'calculator', color: '#9ECE6A', category: 'Productivity',
    desc: 'Standard, scientific and programmer calculator', width: 400, height: 620, minWidth: 320, minHeight: 440,
    evaluate: evalNum, evaluateInt: evalInt, format: fmt,
    open(win) {
      let mode = LX.store.get('app.calculator.mode', 'standard'); if (['standard', 'scientific', 'programmer'].indexOf(mode) < 0) mode = 'standard';
      let deg = LX.store.get('app.calculator.deg', true), inv = false, base = 10, bits = 64;
      let hist = LX.store.get('app.calculator.history', []); if (!Array.isArray(hist)) hist = [];
      let showHist = false, expr = '', ans = 0, mem = 0, done = false, err = '';
      const root = win.body; root.tabIndex = 0;
      const exprEl = H('div', { class: 'calc-expr' }), resEl = H('div', { class: 'calc-res' }), infoEl = H('div', { class: 'calc-info muted' });
      const basesEl = H('div', { class: 'calc-bases' }), keys = H('div', { class: 'calc-keys' });
      const histEl = H('div', { class: 'calc-hist scroll' }), main = H('div', { class: 'calc-main' });
      const tabs = H('div', { class: 'tabs calc-tabs' });

      function compute(final) {
        err = '';
        if (!expr.trim()) return null;
        try { return mode === 'programmer' ? evalInt(expr, base, bits) : evalNum(expr, { deg, ans }); } catch (e) { if (final) err = e.message; return null; }
      }
      function render() {
        exprEl.textContent = expr || ' ';
        const live = done ? null : compute(false);
        let shown;
        if (err) shown = err;
        else if (done) shown = mode === 'programmer' ? intStr(ans, base, bits) : group(fmt(ans));
        else if (live !== null && /[^\d.\s]/.test(expr.replace(/^-/, ''))) shown = mode === 'programmer' ? intStr(live, base, bits) : group(fmt(live));
        else shown = expr ? expr : '0';
        resEl.textContent = shown; resEl.classList.toggle('err', !!err);
        resEl.style.fontSize = shown.length > 14 ? Math.max(18, 40 - (shown.length - 14) * 1.6) + 'px' : '';
        infoEl.textContent = (mode !== 'programmer' ? (deg ? 'DEG' : 'RAD') : 'WORD ' + bits) + (mem ? '  ·  M' : '');
        if (mode === 'programmer') {
          const v = done ? ans : (compute(false) || 0n); basesEl.innerHTML = '';
          [[16, 'HEX'], [10, 'DEC'], [8, 'OCT'], [2, 'BIN']].forEach((b) => basesEl.appendChild(H('div', { class: 'calc-base' + (b[0] === base ? ' on' : ''), onclick: () => setBase(b[0]) }, H('b', { text: b[1] }), H('span', { text: intStr(v, b[0], bits) }))));
        }
        LX.$$('.k[data-inv]', keys).forEach((k) => { k.textContent = inv ? k.dataset.inv : k.dataset.f; });
        LX.$$('.k[data-tog="inv"]', keys).forEach((k) => k.classList.toggle('on', inv));
        LX.$$('.k[data-tog="deg"]', keys).forEach((k) => { k.textContent = deg ? 'Deg' : 'Rad'; });
      }
      function setBase(nb) {
        if (nb === base) return;
        let v = 0n; try { v = done ? ans : (expr.trim() ? evalInt(expr, base, bits) : 0n); } catch (e) { v = 0n; }
        base = nb; expr = expr.trim() || done ? intStr(v, base, bits) : ''; done = false; err = ''; render(); updKeys();
      }
      function commit() {
        const v = compute(true); if (v === null) { const e = err; render(); if (e) { err = e; resEl.textContent = e; resEl.classList.add('err'); resEl.style.fontSize = ''; } return; }
        const shown = mode === 'programmer' ? intStr(v, base, bits) : fmt(v);
        hist.unshift({ e: expr, r: shown, m: mode, b: base }); hist = hist.slice(0, 100); LX.store.set('app.calculator.history', hist);
        ans = v; done = true; renderHist(); render();
      }
      function put(s) {
        const isOpChar = /^[+\-*/^&|%]|^<<|^>>$/.test(s) && s !== '-' ? true : s === '-';
        if (done) { done = false; if (isOpChar || s === '!' ) expr = (mode === 'programmer' ? intStr(ans, base, bits) : fmt(ans)); else expr = ''; }
        err = ''; expr += s; render();
      }
      function back() { if (done) { done = false; expr = ''; } else expr = expr.replace(/(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|ln|log|abs|exp|fact|ans|pi)\($|(sin|cos|tan|asin|acos|atan|sqrt|cbrt|ln|log|abs|exp|fact|ans|pi)$|<<$|>>$|.$/, ''); err = ''; render(); }
      function clear() { expr = ''; done = false; err = ''; render(); }
      function memOp(op) {
        const v = done ? ans : compute(false); const n = typeof v === 'bigint' ? Number(v) : v;
        if (op === 'MC') mem = 0; else if (op === 'MR') { put(fmt(mem)); return; } else if (n != null) mem = op === 'M+' ? mem + n : mem - n;
        render();
      }
      function press(k) {
        if (k[0] === '#') return put(k.slice(1));
        if (k === '=') return commit();
        if (k === 'C') return clear();
        if (k === '⌫') return back();
        if (k === '±') { if (done) { ans = typeof ans === 'bigint' ? -ans : -ans; expr = ''; render(); return; } expr = expr.startsWith('-(') && expr.endsWith(')') ? expr.slice(2, -1) : (expr ? '-(' + expr + ')' : '-'); return render(); }
        if (/^M[CR+-]$|^MR$/.test(k) || k === 'M+' || k === 'M-' || k === 'MC' || k === 'MR') return memOp(k);
        if (k === 'inv') { inv = !inv; return render(); }
        if (k === 'deg') { deg = !deg; LX.store.set('app.calculator.deg', deg); return render(); }
        if (k === 'x²') return put('^2'); if (k === '1/x') { if (done) { expr = fmt(ans); done = false; } expr = '1/(' + expr + ')'; return render(); }
        if (k === 'bits') { bits = bits === 64 ? 32 : bits === 32 ? 16 : bits === 16 ? 8 : 64; return render(); }
        put(k);
      }

      function key(label, cls, val, extra) {
        const b = H('button', { class: 'k ' + (cls || ''), type: 'button', text: label, onclick: () => { press(val != null ? val : label); root.focus(); } });
        if (extra) Object.assign(b.dataset, extra); return b;
      }
      function updKeys() {
        keys.innerHTML = ''; keys.className = 'calc-keys ' + mode;
        const std = [['C', 'fn'], ['(', 'fn'], [')', 'fn'], ['÷', 'op', '/'], ['7'], ['8'], ['9'], ['×', 'op', '*'], ['4'], ['5'], ['6'], ['−', 'op', '-'], ['1'], ['2'], ['3'], ['+', 'op'], ['±', 'fn'], ['0'], ['.'], ['=', 'eq']];
        const add = (l) => l.forEach((a) => keys.appendChild(key(a[0], a[1], a[2])));
        if (mode === 'standard') {
          add([['MC', 'mem'], ['MR', 'mem'], ['M+', 'mem'], ['M-', 'mem'], ['%', 'fn'], ['√', 'fn', 'sqrt('], ['x²', 'fn'], ['⌫', 'fn']]); add(std);
        } else if (mode === 'scientific') {
          keys.appendChild(key('Inv', 'fn', 'inv', { tog: 'inv' })); keys.appendChild(key('Deg', 'fn', 'deg', { tog: 'deg' }));
          [['π', 'fn', 'pi'], ['e', 'fn']].forEach((a) => keys.appendChild(key(a[0], a[1], a[2])));
          [['sin', 'asin'], ['cos', 'acos'], ['tan', 'atan'], ['ln', 'exp'], ['log', '10^'], ['√', 'x²']].forEach((a) => {
            const b = key(a[0], 'fn sci', null, { f: a[0], inv: a[1] });
            b.onclick = () => { const f = inv ? a[1] : a[0]; if (f === 'x²') press('x²'); else if (f === '10^') put('10^('); else put(f === '√' ? 'sqrt(' : f + '('); inv = false; render(); root.focus(); };
            keys.appendChild(b);
          });
          [['x!', 'fn', '!'], ['xʸ', 'fn', '^'], ['%', 'fn'], ['1/x', 'fn'], ['MC', 'mem'], ['MR', 'mem'], ['M+', 'mem'], ['⌫', 'fn']].forEach((a) => keys.appendChild(key(a[0], a[1], a[2])));
          add(std);
        } else {
          [['Word', 'fn', 'bits'], ['⌫', 'fn'], ['CE', 'fn', 'C'], ['÷', 'op', '/'], ['<<', 'fn'], ['>>', 'fn'], ['(', 'fn'], [')', 'fn'], ['AND', 'fn', '&'], ['OR', 'fn', '|'], ['XOR', 'fn', '^'], ['NOT', 'fn', '~']].forEach((a) => keys.appendChild(key(a[0], a[1], a[2])));
          ['D', 'E', 'F', '×', 'A', 'B', 'C', '−', '7', '8', '9', '+', '4', '5', '6', 'Mod', '1', '2', '3', '±', '0', '='].forEach((l) => {
            const hex = /[A-F]/.test(l); const op = l === '×' ? '*' : l === '−' ? '-' : l === 'Mod' ? '%' : l;
            const cls = '+−×'.indexOf(l) >= 0 ? 'op' : l === '=' ? 'eq' : l === 'Mod' || l === '±' ? 'fn' : 'hexd';
            const b = key(l, cls, hex || /^\d$/.test(l) ? '#' + op : op); const dg = parseInt(l, 16); if (!isNaN(dg) && dg >= base) b.disabled = true;
            if (l === '0') b.style.gridColumn = 'span 3'; keys.appendChild(b);
          });
        }
        // fix 'e' constant semantic and button label substitution
        LX.$$('.k', keys).forEach((b) => { if (b.textContent === 'e' && mode === 'scientific') b.onclick = () => { put('e'); root.focus(); }; });
        render();
      }
      function renderTabs() {
        tabs.innerHTML = '';
        [['standard', 'Standard'], ['scientific', 'Scientific'], ['programmer', 'Programmer']].forEach((m) => tabs.appendChild(H('button', { class: 'tab' + (m[0] === mode ? ' active' : ''), text: m[1], onclick: () => setMode(m[0]) })));
        tabs.appendChild(H('span', { class: 'grow' }));
        tabs.appendChild(H('button', { class: 'btn icon sm ghost', title: 'History', html: LX.icon('clock', 16), onclick: () => { showHist = !showHist; root.classList.toggle('show-hist', showHist); } }));
      }
      function setMode(m) {
        mode = m; LX.store.set('app.calculator.mode', m); expr = ''; done = false; err = ''; if (m === 'programmer') base = 10; basesEl.style.display = m === 'programmer' ? '' : 'none';
        win.resize(m === 'scientific' ? 460 : m === 'programmer' ? 480 : 400, m === 'standard' ? 620 : 680);
        renderTabs(); updKeys();
      }
      function renderHist() {
        histEl.innerHTML = '';
        histEl.appendChild(H('div', { class: 'row calc-hist-h' }, H('b', { class: 'grow', text: 'History' }), H('button', { class: 'btn sm ghost', text: 'Clear', onclick: () => { hist = []; LX.store.set('app.calculator.history', hist); renderHist(); } })));
        if (!hist.length) histEl.appendChild(H('div', { class: 'muted center calc-empty', text: 'No calculations yet' }));
        hist.forEach((h) => histEl.appendChild(H('div', { class: 'calc-hi', title: 'Click to reuse result', onclick: () => { done = false; expr = h.r; err = ''; render(); root.focus(); } }, H('div', { class: 'muted ellipsis', text: h.e + ' =' }), H('div', { class: 'calc-hr ellipsis', text: h.r }))));
      }

      root.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') LX.clipboard.copy(resEl.textContent); return; }
        const k = e.key; let handled = true;
        if (k === 'Enter' || k === '=') press('=');
        else if (k === 'Backspace') back(); else if (k === 'Escape' || k === 'Delete') clear();
        else if (k === '*' || k === 'x' && mode !== 'programmer') put('*'); else if (k === '/') put('/');
        else if (k.length === 1) {
          if (mode === 'programmer') { if (/[0-9a-fA-F+\-*/%&|^~()]/.test(k)) { if (/[0-9a-fA-F]/.test(k) && parseInt(k, 16) >= base) { handled = true; } else put(k.toUpperCase()); } else if (k === '<' || k === '>') put(k + k); else handled = false; }
          else if (/[0-9.+\-^()!%,a-zA-Z]/.test(k)) put(k); else handled = false;
        } else handled = false;
        if (handled) e.preventDefault();
      });
      win.setMenu([{ label: 'Edit', items: [
        { label: 'Copy result', shortcut: 'Ctrl+C', action() { LX.clipboard.copy(resEl.textContent); } },
        { label: 'Paste', action() { LX.clipboard.paste().then((t) => { if (t) put(String(t).trim()); }); } }, { separator: true },
        { label: 'Clear history', action() { hist = []; LX.store.set('app.calculator.history', hist); renderHist(); } }] },
      { label: 'View', items: [{ label: 'Standard', action() { setMode('standard'); } }, { label: 'Scientific', action() { setMode('scientific'); } }, { label: 'Programmer', action() { setMode('programmer'); } }, { separator: true }, { label: 'Toggle history', action() { showHist = !showHist; root.classList.toggle('show-hist', showHist); } }] }]);

      main.append(tabs, H('div', { class: 'calc-display' }, infoEl, exprEl, resEl), basesEl, keys);
      root.append(main, histEl); renderHist(); basesEl.style.display = mode === 'programmer' ? '' : 'none';
      renderTabs(); updKeys(); setTimeout(() => root.focus(), 50);
      if (mode !== 'standard') win.resize(mode === 'scientific' ? 460 : 480, 680);
    },
  });
})();
