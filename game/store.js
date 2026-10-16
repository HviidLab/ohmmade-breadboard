// Saved progress (localStorage "bbgame.v2"). No DOM.
// {levels: {"1-1": {done, stars, clean, challenge}}, notebook: [concept ids], nbSeen: [concept ids already seen in the Notebook],
//  introSeen: [chapter numbers], variants, settings: {sound, voice, certName, openAll}, sandbox, telemetry}
// The first time, the sandbox from the old "bbgame.v1" save is carried over.
// Start over keeps the old save in "bbgame.v2.backup" until the next start over, so it can be brought back.
(function (BB) {
  "use strict";
  const KEY = "bbgame.v2", OLD = "bbgame.v1", BACKUP = "bbgame.v2.backup";
  let mem = null, failed = false;      // mem: the save in memory; failed: the last write to storage did not work
  let memBackup;                       // the backup, when storage can't hold it (undefined: look in storage)

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
    for (const k of ["notebook", "nbSeen", "introSeen"]) if (s[k] !== undefined && !Array.isArray(s[k])) s[k] = [];
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

  // Start over: the levels, stars, Notebook, chapter openers, certificate name and playtest data go. Sound, voice,
  // the playtest switch and the sandbox bench stay. The old save becomes the backup.
  function startOver() {
    const old = get();
    memBackup = copy(old);
    try { localStorage.setItem(BACKUP, JSON.stringify(old)); memBackup = undefined; } catch (e) { /* kept in memory */ }
    const s = fresh();
    s.settings = Object.assign({}, old.settings); delete s.settings.certName;
    s.sandbox = old.sandbox;
    put(s);
    return s;
  }
  function backup() {
    if (memBackup !== undefined) return memBackup && copy(memBackup);
    try { const raw = localStorage.getItem(BACKUP); return raw ? clean(JSON.parse(raw)) : null; } catch (e) { return null; }
  }
  // Undo a start over: the old progress comes back; today's settings and sandbox bench stay as they are now.
  function restore() {
    const b = backup(), now = get();
    if (!b) return false;
    b.settings = Object.assign({}, now.settings, { certName: b.settings.certName });
    if (b.settings.certName === undefined) delete b.settings.certName;
    b.sandbox = now.sandbox;
    put(b);
    memBackup = null;
    try { localStorage.removeItem(BACKUP); } catch (e) { /* ignore */ }
    return true;
  }

  BB.Store = { get, put, update, startOver, backup, restore, KEY, BACKUP };
})(window.BB = window.BB || {});
