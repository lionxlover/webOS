/* Leonux Web OS — safe localStorage wrapper (JSON, prefixed) */
(function () {
  'use strict';
  const P = 'lx:';
  const mem = {};
  LX.store = {
    get(key, def) {
      try { const v = localStorage.getItem(P + key); return v == null ? def : JSON.parse(v); }
      catch (e) { return key in mem ? mem[key] : def; }
    },
    set(key, val) {
      try { localStorage.setItem(P + key, JSON.stringify(val)); }
      catch (e) { mem[key] = val; }
      return val;
    },
    remove(key) { try { localStorage.removeItem(P + key); } catch (e) {} delete mem[key]; },
    keys() { try { return Object.keys(localStorage).filter((k) => k.startsWith(P)).map((k) => k.slice(P.length)); } catch (e) { return Object.keys(mem); } },
    clearAll() { try { Object.keys(localStorage).filter((k) => k.startsWith(P)).forEach((k) => localStorage.removeItem(k)); } catch (e) {} },
  };
})();
