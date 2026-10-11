// Full-screen screens of the level game: the level map, the level-complete card, the pause menu and the Notebook.
// Each one pauses the bench while it is open.
(function (BB) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const stars = (n, of = 3) => "★".repeat(n) + "☆".repeat(of - n);
  let G = null;

  // Later chapters, shown on the map as what is coming.
  const COMING = [
    [2, "Measuring"], [3, "Ohm's law"], [4, "LED maths"], [5, "Series and parallel"], [6, "Dividers and the knob"],
    [7, "Buttons"], [8, "Capacitors and time"], [9, "The transistor"], [10, "Sensors"], [11, "The controller board"],
  ];

  function init(game) { G = game; }

  const progress = () => BB.Store.get().levels || {};
  // A level is open when it is the first one or the one before it is done.
  function unlocked(lv, prog = progress()) {
    const all = BB.Levels.all(), k = all.indexOf(lv);
    return k <= 0 || !!(prog[all[k - 1].id] || {}).done;
  }
  function nextLevel(prog = progress()) { return BB.Levels.all().find((l) => !(prog[l.id] || {}).done) || null; }
  function summary(prog = progress()) {
    const all = BB.Levels.all();
    return { done: all.filter((l) => (prog[l.id] || {}).done).length, stars: all.reduce((n, l) => n + ((prog[l.id] || {}).stars || 0), 0), total: all.length };
  }

  // ---------- screens ----------
  let open = null;
  function show(id, html, focus) {
    hideAll();
    const host = $(id);
    host.innerHTML = html;
    host.hidden = false;
    open = id;
    G.paused = true;
    const f = focus && host.querySelector(focus);
    if (f) f.focus({ preventScroll: true });
    return host;
  }
  function hideAll() {
    for (const id of ["levelmap", "complete", "pause", "notebook"]) $(id).hidden = true;
    open = null;
  }
  function close() { hideAll(); G.paused = false; }
  const on = (host, sel, fn) => { const b = host.querySelector(sel); if (b) b.addEventListener("click", fn); };
  function play(lv) { close(); BB.Title.hide(); G.enterLevel(lv); }

  function showMap() {
    BB.Title.hide();
    const prog = progress(), s = summary(prog), next = nextLevel(prog);
    const ch = BB.Levels.chapters.map((c) => `<section class="lm-chapter"><h2><span>Chapter ${c.n}</span>${esc(c.title)}</h2>
      <ol class="lm-path">${c.levels.map((lv) => {
        const p = prog[lv.id] || {}, open_ = unlocked(lv, prog), cur = next === lv;
        return `<li><button type="button" class="lm-node${p.done ? " done" : ""}${cur ? " current" : ""}" data-id="${lv.id}" ${open_ ? "" : "disabled"}>
          <span class="lm-n">${lv.id}</span><span class="lm-t">${esc(lv.title)}</span><span class="lm-s" aria-label="${p.stars || 0} of 3 stars">${open_ ? stars(p.stars || 0) : "locked"}</span></button></li>`;
      }).join("")}</ol></section>`).join("");
    const host = show("levelmap", `<div class="scr-inner">
      <div class="scr-head"><p class="scr-brand">Ohmmade Breadboard</p><h1>Level map</h1><p class="scr-sub">${s.done} of ${s.total} levels · ${s.stars} of ${3 * s.total} ★</p></div>
      ${ch}
      <section class="lm-coming"><h2>Coming next</h2><ul>${COMING.map(([n, t]) => `<li><span>Chapter ${n}</span>${esc(t)}</li>`).join("")}</ul></section>
      <div class="scr-row"><button type="button" class="btn" id="lm-notebook">Notebook</button><button type="button" class="btn" id="lm-title">Title screen</button></div></div>`, ".lm-node.current, .lm-node:not([disabled])");
    host.querySelectorAll(".lm-node").forEach((b) => b.addEventListener("click", () => play(BB.Levels.get(b.dataset.id))));
    on(host, "#lm-notebook", () => notebook("map"));
    on(host, "#lm-title", () => { hideAll(); BB.Title.show(); });
    try { history.replaceState(null, "", "#map"); } catch (e) { /* ignore */ }
  }

  function complete(lv, res) {
    const all = BB.Levels.all(), next = all[all.findIndex((f) => f.id === lv.id) + 1] || null;
    const concept = lv.teaches.length ? BB.Concepts.get(lv.teaches[0]) : lv.card;
    const lastOfChapter = !next || next.chapter !== lv.chapter;
    const host = show("complete", `<div class="cc-card" role="dialog" aria-labelledby="cc-h">
      <p class="cc-kicker">Level ${lv.id} complete</p><h1 id="cc-h">${esc(lv.title)}</h1>
      <p class="cc-stars" aria-label="${res.stars} of 3 stars">${[0, 1, 2].map((k) => `<span class="${k < res.stars ? "on" : ""}" style="animation-delay:${0.15 + k * 0.18}s">★</span>`).join("")}</p>
      <ul class="cc-bonus"><li class="got">★ Level done</li>${(lv.bonus || []).map((b, k) => `<li class="${res.bonus[k] ? "got" : ""}">${res.bonus[k] ? "★" : "☆"} ${esc(b.text)}</li>`).join("")}</ul>
      ${concept ? `<div class="cc-learned"><p class="cc-lh">What you learned</p><h2>${esc(concept.name)}</h2><p>${esc(concept.text)}</p>${lv.teaches.length ? '<p class="cc-nb">Added to your Notebook.</p>' : ""}</div>` : ""}
      ${lastOfChapter ? `<p class="cc-chapter">Chapter ${lv.chapter} complete!</p>` : ""}
      <div class="scr-row">${next && !lastOfChapter ? '<button type="button" class="btn primary" id="cc-next">Next level →</button>' : '<button type="button" class="btn primary" id="cc-map">Level map</button>'}
      <button type="button" class="btn" id="cc-again">Play again</button>${next && !lastOfChapter ? '<button type="button" class="btn" id="cc-map">Level map</button>' : ""}</div></div>`, "#cc-next, #cc-map");
    on(host, "#cc-next", () => play(next));
    on(host, "#cc-again", () => play(BB.Levels.get(lv.id)));      // a new variant of the same level
    on(host, "#cc-map", showMap);
    BB.Effects.chime && BB.Effects.chime(3);
  }

  function pause() {
    if (G.mode !== "level") return;
    const sound = !BB.Effects.muted;
    const host = show("pause", `<div class="cc-card pause-card" role="dialog" aria-labelledby="pz-h"><h1 id="pz-h">Paused</h1>
      <p class="scr-sub">Level ${G.level.id} · ${esc(G.level.title)}</p>
      <div class="pz-list"><button type="button" class="btn primary" id="pz-resume">Resume</button>
      <button type="button" class="btn" id="pz-restart">Restart level</button>
      <button type="button" class="btn" id="pz-map">Level map</button>
      <button type="button" class="btn" id="pz-notebook">Notebook</button>
      <button type="button" class="btn" id="pz-sound" aria-pressed="${sound}">Sound: ${sound ? "on" : "off"}</button>
      <button type="button" class="btn" id="pz-voice" aria-pressed="${BB.CoachUI.voiceOn}">Sparky's voice: ${BB.CoachUI.voiceOn ? "on" : "off"}</button>
      <button type="button" class="btn" id="pz-title">Title screen</button></div></div>`, "#pz-resume");
    on(host, "#pz-resume", close);
    on(host, "#pz-restart", () => play(G.level));
    on(host, "#pz-map", showMap);
    on(host, "#pz-notebook", () => notebook("pause"));
    on(host, "#pz-sound", () => { G.setSound(BB.Effects.muted); pause(); });
    on(host, "#pz-voice", () => { BB.CoachUI.setVoice(!BB.CoachUI.voiceOn); pause(); });
    on(host, "#pz-title", () => { hideAll(); BB.Title.show(); });
  }

  function notebook(from) {
    const learned = BB.Store.get().notebook || [];
    const host = show("notebook", `<div class="scr-inner"><div class="scr-head"><p class="scr-brand">Ohmmade Breadboard</p><h1>Notebook</h1>
      <p class="scr-sub">${learned.length} of ${BB.Concepts.LIST.length} ideas learned</p></div>
      <ol class="nb-grid">${BB.Concepts.LIST.map((c) => learned.includes(c.id)
        ? `<li class="nb-card"><h2>${esc(c.name)}</h2><p>${esc(c.text)}</p></li>`
        : '<li class="nb-card locked"><h2>?</h2><p>Not learned yet.</p></li>').join("")}</ol>
      <div class="scr-row"><button type="button" class="btn primary" id="nb-back">Back</button></div></div>`, "#nb-back");
    on(host, "#nb-back", () => (from === "pause" ? pause() : from === "map" ? showMap() : (hideAll(), BB.Title.show())));
  }

  // Esc closes the pause menu and the Notebook.
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !open) return;
    if (open === "pause") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  }, true);

  BB.LevelMap = { init, showMap, complete, pause, notebook, close, hideAll, nextLevel, summary, unlocked, isOpen: () => !!open };
})(window.BB = window.BB || {});
