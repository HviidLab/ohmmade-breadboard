// Saved progress (localStorage "bbgame.v2"). No DOM.
// {levels: {"1-1": {done, stars, bonus}}, notebook: [concept ids], nbSeen: [concept ids already seen in the Notebook], settings: {sound}, sandbox, telemetry}
// The first time, the sandbox from the old "bbgame.v1" save is carried over.
(function (BB) {
  "use strict";
  const KEY = "bbgame.v2", OLD = "bbgame.v1";
  let mem = null;                      // used when storage is blocked

  const fresh = () => ({ v: 2, levels: {}, notebook: [], settings: {}, sandbox: null, telemetry: {} });
  function fromV1(old) {
    const s = fresh();
    if (old) s.sandbox = old.sandbox || null;
    return s;
  }
  function get() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = Object.assign(fresh(), JSON.parse(raw)); delete s.classic; return s; }   // classic: progress in the removed Classic lab
      return fromV1(JSON.parse(localStorage.getItem(OLD) || "null"));
    } catch (e) { return mem || (mem = fresh()); }
  }
  function put(s) { mem = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked: keep it in memory */ } }
  function update(fn) { const s = get(); fn(s); put(s); return s; }

  BB.Store = { get, put, update, KEY };
})(window.BB = window.BB || {});
