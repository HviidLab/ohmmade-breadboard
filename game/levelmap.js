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
      <section class="lm-coming"><h2>Coming next</h2><ul>${COMING.filter(([n]) => !BB.Levels.chapters.some((c) => c.n === n)).map(([n, t]) => `<li><span>Chapter ${n}</span>${esc(t)}</li>`).join("")}</ul></section>
      <div class="scr-row"><button type="button" class="btn" id="lm-notebook">Notebook</button><button type="button" class="btn" id="lm-playtest">Playtest data</button><button type="button" class="btn" id="lm-title">Title screen</button></div></div>`, ".lm-node.current, .lm-node:not([disabled])");
    host.querySelectorAll(".lm-node").forEach((b) => b.addEventListener("click", () => play(BB.Levels.get(b.dataset.id))));
    on(host, "#lm-notebook", () => notebook("map"));
    on(host, "#lm-playtest", () => playtest("map"));
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
      <button type="button" class="btn" id="pz-playtest">Playtest data</button>
      <button type="button" class="btn" id="pz-title">Title screen</button></div></div>`, "#pz-resume");
    on(host, "#pz-resume", close);
    on(host, "#pz-restart", () => play(G.level));
    on(host, "#pz-map", showMap);
    on(host, "#pz-notebook", () => notebook("pause"));
    on(host, "#pz-sound", () => { G.setSound(BB.Effects.muted); pause(); });
    on(host, "#pz-voice", () => { BB.CoachUI.setVoice(!BB.CoachUI.voiceOn); pause(); });
    on(host, "#pz-playtest", () => playtest("pause"));
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

  // ---------- playtest data ----------
  // Per level played: attempts, the last finished attempt, and the last attempt left unfinished (or the one going on now).
  // It stays on this computer; the player copies it to share it.
  function playtestRows() {
    const tl = BB.Store.get().telemetry || {}, now = G.attempt();
    return BB.Levels.all().map((l) => {
      const t = tl[l.id] || {};
      const live = !!now && now.id === l.id;
      return { id: l.id, title: l.title, attempts: t.attempts || 0, last: t.last || null, open: live ? now : t.unfinished || null, live };
    }).filter((r) => r.attempts);
  }
  const slowest = (beats) => (beats && beats.length ? beats.reduce((a, b) => (b.t > a.t ? b : a)) : null);
  const steps = (beats) => beats.map((b) => `${b.id} ${b.t} s${b.hints ? ` (${b.hints} hint${b.hints > 1 ? "s" : ""})` : ""}`).join(", ");
  function playtestTable() {
    const rows = playtestRows();
    if (!rows.length) return '<p class="scr-sub">No levels played yet.</p>';
    return `<table class="pt-table"><tr><th>Level</th><th>Attempts</th><th>Time</th><th>Hints</th><th>Slowest step</th><th>Left unfinished at</th></tr>${rows.map((r) => {
      const s = slowest(r.last && r.last.beats);
      return `<tr><td>${r.id}</td><td>${r.attempts}</td><td>${r.last ? `${r.last.t} s` : "—"}</td><td>${r.last ? r.last.hints : "—"}</td>
        <td>${s ? `${esc(s.id)} (${s.t} s)` : "—"}</td><td>${r.open ? `${r.live ? "playing now: " : ""}${esc(r.open.beat)} (after ${r.open.t} s)` : "—"}</td></tr>`;
    }).join("")}</table>`;
  }
  function playtestText() {
    const lines = [`Ohmmade Breadboard playtest data, ${new Date().toISOString().slice(0, 10)}`];
    for (const r of playtestRows()) {
      lines.push(`${r.id} ${r.title}: ${r.attempts} attempt${r.attempts > 1 ? "s" : ""}`);
      if (r.last) lines.push(`  finished: ${r.last.t} s, ${r.last.hints} hint${r.last.hints === 1 ? "" : "s"}. Steps: ${steps(r.last.beats)}`);
      if (r.open) lines.push(`  ${r.live ? "playing now: at" : "not finished: stopped at"} "${r.open.beat}" after ${r.open.t} s. Steps: ${steps(r.open.beats)}`);
    }
    if (lines.length === 1) lines.push("No levels played yet.");
    return lines.join("\n");
  }
  function playtest(from) {
    const host = show("notebook", `<div class="scr-inner"><div class="scr-head"><p class="scr-brand">Ohmmade Breadboard</p><h1>Playtest data</h1>
      <p class="scr-sub">How long each step took and how many hints you used. It stays on this computer: nothing is sent anywhere. To share it, copy it.</p></div>
      ${playtestTable()}
      <textarea class="pt-text" readonly rows="8" aria-label="Playtest data as text">${esc(playtestText())}</textarea>
      <div class="scr-row"><button type="button" class="btn primary" id="pt-copy">Copy</button><button type="button" class="btn" id="pt-back">Back</button>
      <button type="button" class="btn" id="pt-reset">Reset</button><span class="pt-ok" id="pt-ok" role="status"></span></div></div>`, "#pt-copy");
    on(host, "#pt-copy", async () => {
      const ta = host.querySelector(".pt-text"), say = (t) => { host.querySelector("#pt-ok").textContent = t; };
      try { await navigator.clipboard.writeText(ta.value); say("Copied. Paste it into your message."); }
      catch (e) { ta.focus(); ta.select(); say(document.execCommand && document.execCommand("copy") ? "Copied. Paste it into your message." : "Select the text above and copy it."); }
    });
    on(host, "#pt-back", () => (from === "pause" ? pause() : showMap()));
    // Reset asks once more before it erases (only the playtest data: progress, stars and the Notebook stay).
    on(host, "#pt-reset", (e) => {
      const b = e.currentTarget;
      if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Click again to erase it"; b.classList.add("danger"); return; }
      BB.Store.update((s) => { s.telemetry = {}; });
      G.restartAttempt();                        // a level being played starts counting again from now
      playtest(from);
      host.querySelector("#pt-ok").textContent = "Playtest data erased. Your progress and stars are kept.";
    });
  }

  // Esc closes the pause menu and the Notebook.
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !open) return;
    if (open === "pause") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  }, true);

  BB.LevelMap = { init, showMap, complete, pause, notebook, playtest, playtestTable, playtestText, close, hideAll, nextLevel, summary, unlocked, isOpen: () => !!open };
})(window.BB = window.BB || {});
