/* Leonux Web OS — LX.h element builder */
(function () {
  'use strict';
  function append(el, kids) {
    for (const k of kids) {
      if (k == null || k === false) continue;
      if (Array.isArray(k)) append(el, k);
      else if (k instanceof Node) el.appendChild(k);
      else el.appendChild(document.createTextNode(String(k)));
    }
  }
  LX.h = function (tag, attrs) {
    const kids = Array.prototype.slice.call(arguments, 2);
    const el = document.createElement(tag);
    const isAttrs = attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs);
    if (isAttrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style') { if (typeof v === 'string') el.style.cssText = v; else Object.assign(el.style, v); }
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value' && 'value' in el) el.value = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    } else if (attrs != null) kids.unshift(attrs);
    append(el, kids);
    return el;
  };
})();
