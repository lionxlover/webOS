/* Leonux Web OS — clipboard with in-memory fallback */
(function () {
  'use strict';
  let mem = '';
  LX.clipboard = {
    copy(text) {
      mem = String(text);
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(mem).catch(() => {});
      return Promise.resolve();
    },
    paste() {
      if (navigator.clipboard && navigator.clipboard.readText) return navigator.clipboard.readText().then((t) => t || mem).catch(() => mem);
      return Promise.resolve(mem);
    },
  };
})();
