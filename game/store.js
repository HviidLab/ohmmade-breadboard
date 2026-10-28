// Saved progress (localStorage "bbgame.v2"). No DOM.
// {levels: {"1-1": {done, stars, clean, challenge}}, notebook: [concept ids], nbSeen: [concept ids already seen in the Notebook],
//  introSeen: [chapter numbers], variants, settings: {sound, voice, vol, certName}, ids}
// ids: the level numbering the save uses (2: since the "build it yourself" levels of Chapters 6–11, 2026-10-18;
// 3: since the easier Chapters 9–11, 2026-10-27).
// Start over keeps the old save in "bbgame.v2.backup" until the next start over, so it can be brought back.
(function (BB) {
  "use strict";
  const KEY = "bbgame.v2", BACKUP = "bbgame.v2.backup";
  let mem = null, failed = false;      // mem: the save in memory; failed: the last write to storage did not work
  let memBackup;                       // the backup, when storage can't hold it (undefined: look in storage)

  const fresh = () => ({ v: 2, ids: 3, levels: {}, notebook: [], settings: {} });
  // A "build it yourself" level came in before each puzzle of Chapters 6–11, so those puzzles moved up one number.
  // Chapters 9–11 made easier (2026-10-27): four levels cut (null), the rest of 10 and 11 moved down; two ideas left the Notebook.
  const STEPS = [
    { to: 2, moved: { "6-4": "6-5", "7-5": "7-6", "8-5": "8-6", "9-3": "9-4", "10-4": "10-5", "11-7": "11-8" } },
    { to: 3, moved: { "10-2": null, "10-3": "10-2", "10-4": "10-3", "10-5": null, "11-3": null, "11-4": "11-3", "11-5": null, "11-6": "11-4", "11-7": "11-5", "11-8": "11-6" },
      gone: ["ldrDivider", "pullDown"] },
  ];
  function renumber(s, from) {
    for (const st of STEPS) {
      if (from >= st.to) continue;
      for (const k of ["levels", "variants"]) {
        if (!obj(s[k])) continue;
        const out = {};
        for (const [id, v] of Object.entries(s[k])) { const to = id in st.moved ? st.moved[id] : id; if (to) out[to] = v; }
        s[k] = out;
      }
      for (const k of ["notebook", "nbSeen"]) if (Array.isArray(s[k]) && st.gone) s[k] = s[k].filter((c) => !st.gone.includes(c));
    }
    s.ids = STEPS[STEPS.length - 1].to;
  }
  // One bad field must not stop the game: every field is checked and a broken one starts over.
  const obj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
  function clean(raw) {
    if (!obj(raw)) return fresh();
    const s = Object.assign(fresh(), raw);
    delete s.classic;                                   // progress in the removed Classic lab
    delete s.sandbox; delete s.telemetry;               // the removed sandbox bench and playtest data (2026-10-28)
    for (const k of ["levels", "settings"]) if (!obj(s[k])) s[k] = {};
    delete s.settings.openAll;                          // the removed playtest switch
    for (const k of ["notebook", "nbSeen", "introSeen"]) if (s[k] !== undefined && !Array.isArray(s[k])) s[k] = [];
    if (s.variants !== undefined && !obj(s.variants)) delete s.variants;
    for (const [id, l] of Object.entries(s.levels)) { if (!obj(l)) delete s.levels[id]; else delete l.bonus; }    // bonus: the old bonus objectives, now replaced
    if (!(raw.ids >= 3)) renumber(s, raw.ids >= 2 ? raw.ids : 1);
    return s;
  }
  const copy = (s) => JSON.parse(JSON.stringify(s));
  function get() {
    if (failed && mem) return copy(mem);                // storage is full or blocked: this session's progress lives here
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? clean(JSON.parse(raw)) : fresh();
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

  // Start over: the levels, stars, Notebook, chapter openers and certificate name go. Sound and voice stay.
  // The old save becomes the backup.
  function startOver() {
    const old = get();
    memBackup = copy(old);
    try { localStorage.setItem(BACKUP, JSON.stringify(old)); memBackup = undefined; } catch (e) { /* kept in memory */ }
    const s = fresh();
    s.settings = Object.assign({}, old.settings); delete s.settings.certName;
    put(s);
    return s;
  }
  function backup() {
    if (memBackup !== undefined) return memBackup && copy(memBackup);
    try { const raw = localStorage.getItem(BACKUP); return raw ? clean(JSON.parse(raw)) : null; } catch (e) { return null; }
  }
  // Undo a start over: the old progress comes back; today's settings stay as they are now.
  function restore() {
    const b = backup(), now = get();
    if (!b) return false;
    b.settings = Object.assign({}, now.settings, { certName: b.settings.certName });
    if (b.settings.certName === undefined) delete b.settings.certName;
    put(b);
    memBackup = null;
    try { localStorage.removeItem(BACKUP); } catch (e) { /* ignore */ }
    return true;
  }

  BB.Store = { get, put, update, startOver, backup, restore, KEY, BACKUP };
})(window.BB = window.BB || {});
