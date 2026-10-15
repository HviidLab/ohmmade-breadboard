// Saved progress (localStorage "bbgame.v2"). No DOM.
// {levels: {"1-1": {done, stars, clean, challenge}}, notebook: [concept ids], nbSeen: [concept ids already seen in the Notebook], settings: {sound}, sandbox, telemetry}
// The first time, the sandbox from the old "bbgame.v1" save is carried over.
(function (BB) {
  "use strict";
  const KEY = "bbgame.v2", OLD = "bbgame.v1";
  let mem = null, failed = false;      // mem: the save in memory; failed: the last write to storage did not work

  const fresh = () => ({ v: 2, levels: {}, notebook: [], settings: {}, sandbox: null, telemetry: {} });
  function fromV1(old) {
    const s = fresh();
    if (old && typeof old.sandbox === "string") s.sandbox = old.sandbox;
    return s;
  }
  // One bad field must not stop the game: every field is checked and a broken one starts over.
  const obj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
  function clean(raw) {
    if (!obj(raw)) return fresh();
    const s = Object.assign(fresh(), raw);
    delete s.classic;                                   // progress in the removed Classic lab
    for (const k of ["levels", "settings", "telemetry"]) if (!obj(s[k])) s[k] = {};
    for (const k of ["notebook", "nbSeen"]) if (s[k] !== undefined && !Array.isArray(s[k])) s[k] = [];
    if (s.variants !== undefined && !obj(s.variants)) delete s.variants;
    for (const [id, l] of Object.entries(s.levels)) { if (!obj(l)) delete s.levels[id]; else delete l.bonus; }    // bonus: the old bonus objectives, now replaced
    for (const [id, t] of Object.entries(s.telemetry)) if (!obj(t)) delete s.telemetry[id];
    if (s.sandbox != null) { try { if (!obj(JSON.parse(s.sandbox))) s.sandbox = null; } catch (e) { s.sandbox = null; } }
    return s;
  }
  const copy = (s) => JSON.parse(JSON.stringify(s));
  function get() {
    if (failed && mem) return copy(mem);                // storage is full or blocked: this session's progress lives here
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return clean(JSON.parse(raw));
      return fromV1(JSON.parse(localStorage.getItem(OLD) || "null"));
    } catch (e) { return mem ? copy(mem) : (mem = fresh()); }
  }
  function put(s) {
    mem = copy(s);
    try { localStorage.setItem(KEY, JSON.stringify(s)); failed = false; }
    catch (e) {
      if (!failed && BB.HUD) setTimeout(() => BB.HUD.toast("This browser won't let the game save. Your progress is kept until you close the page.", 10000), 600);   // after the screen that caused it has opened
      failed = true;
    }
  }
  function update(fn) { const s = get(); fn(s); put(s); return s; }

  BB.Store = { get, put, update, KEY };
})(window.BB = window.BB || {});
