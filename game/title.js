// Start screen: shown when the game opens without a link to a level, the map or the sandbox.
// The bench behind it stays loaded but paused until the player picks a way in.
(function (BB) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let G;

  function init(game) {
    G = game;
    $("to-title").addEventListener("click", show);
    // a browser lets a page play sound only after a click or a key: then the title's tune can start
    const wake = () => { BB.Effects.unlock(); window.removeEventListener("pointerdown", wake, true); window.removeEventListener("keydown", wake, true); };
    window.addEventListener("pointerdown", wake, true); window.addEventListener("keydown", wake, true);
  }

  function show() {
    BB.LevelMap.hideAll();
    BB.Effects.music(true);
    const s = BB.LevelMap.summary(), next = BB.LevelMap.nextLevel(), fresh = s.done === 0;
    const hasBench = !!G.hasSavedSandbox();
    const host = $("title-screen");
    host.innerHTML = `${BB.TitleArt ? BB.TitleArt.scene() : ""}<div class="ts-inner">
      <p class="ts-brand">A game about real electronics</p>
      <h1>Ohmmade <span>Breadboard</span></h1>
      <p class="ts-lede">Learn electronics by building it. Light an LED, watch the current flow, and find out what happens when you leave out the resistor. No experience needed.</p>
      <div class="ts-actions">
        ${next ? `<button type="button" class="ts-go" id="ts-go"><span class="ts-k">${fresh ? "Start" : "Continue"}</span><span class="ts-m">${next.id} · ${next.title}</span></button>`
               : `<button type="button" class="ts-go" id="ts-go"><span class="ts-k">All ${s.total} levels done</span><span class="ts-m">The finale and your certificate</span></button>`}
        <div class="ts-more">
          <button type="button" class="ts-alt" id="ts-map"><span class="ts-k">Level map</span><span class="ts-s">${s.done} of ${s.total} levels · ${s.stars} ★</span></button>
          <button type="button" class="ts-alt" id="ts-notebook"><span class="ts-k">Notebook</span><span class="ts-s">${notes()}</span></button>
          <button type="button" class="ts-alt" id="ts-sandbox"><span class="ts-k">Sandbox</span><span class="ts-s">${hasBench ? "Your bench, as you left it" : "Every part, no goals"}</span></button>
        </div>
        ${saves(s)}
      </div>
      <p class="ts-narrow">The game needs a desktop screen (at least 900 px wide).</p>
      <ol class="ts-how">
        <li><b>Sparky</b>, a friendly LED, shows you one idea at a time.</li>
        <li><b>Build</b> on a real-feeling breadboard. The circuit is truly simulated.</li>
        <li><b>Too much current?</b> Parts smoke and pop. Then you fix it.</li>
      </ol>
    </div>`;
    host.hidden = false;
    BB.inertAround(host, true);       // the game behind is out of reach
    G.paused = true;
    BB.HUD.toast(null);
    $("ts-go").addEventListener("click", () => { hide(); if (next) BB.LevelMap.play(next); else BB.LevelMap.finale(); });
    $("ts-map").addEventListener("click", () => { hide(); BB.LevelMap.showMap(); });
    $("ts-sandbox").addEventListener("click", () => { hide(); G.enterSandbox(); });
    $("ts-notebook").addEventListener("click", () => { hide(); BB.LevelMap.notebook("title"); });
    wireSaves(s);
    $("ts-go").focus();
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
  }

  // Start over, and its undo. Undo stays offered until a level is finished in the new run.
  const has = (o) => !!o && Object.keys(o).length > 0;
  const tally = (s) => `${s.done} level${s.done === 1 ? "" : "s"} and ${s.stars} ★`;
  function notes() {
    const n = (BB.Store.get().notebook || []).length, k = BB.LevelMap.newCards();
    return n ? `${n} idea${n === 1 ? "" : "s"}${k ? ` · <b>${k} new</b>` : ""}` : "Every idea you learn";
  }
  function saves(s) {
    const st = BB.Store.get(), old = BB.Store.backup(), b = [];
    if (old && s.done === 0) b.push(`<button type="button" class="btn" id="ts-undo">Bring back my old progress (${tally(BB.LevelMap.summary(old.levels))})</button>`);
    else if (s.done || (st.notebook || []).length || has(st.telemetry)) b.push('<button type="button" class="btn" id="ts-over">Start over…</button>');
    b.push('<button type="button" class="btn" id="ts-sound">Sound and volume</button>');
    b.push('<button type="button" class="btn" id="ts-playtest">Playtest data</button>');
    return `<div class="ts-saves" id="ts-saves">${b.join("")}</div>`;
  }
  function wireSaves(s) {
    const box = $("ts-saves");
    if (!box) return;
    const undo = $("ts-undo"), over = $("ts-over");
    $("ts-playtest").addEventListener("click", () => { hide(); BB.LevelMap.playtest("title"); });
    $("ts-sound").addEventListener("click", () => { hide(); BB.LevelMap.soundPanel("title"); });
    if (undo) undo.addEventListener("click", () => { BB.Store.restore(); show(); BB.HUD.toast("Your old progress is back.", 4000); });
    if (over) over.addEventListener("click", () => {
      const pt = has(BB.Store.get().telemetry);
      box.innerHTML = `<div class="ts-confirm" role="group" aria-labelledby="ts-cf-h"><p id="ts-cf-h"><b>Start over from level 1-1?</b>
        This erases your ${tally(s)}, the Notebook${pt ? " and the playtest data" : ""}. Sound, voice and your sandbox bench are kept.
        Changed your mind later? You can bring it all back until you finish a level.</p>
        <div class="scr-row"><button type="button" class="btn danger" id="ts-erase">Erase and start over</button>
        ${pt ? '<button type="button" class="btn" id="ts-copy">Copy the playtest data first</button>' : ""}
        <button type="button" class="btn" id="ts-keep">Cancel</button></div></div>`;
      $("ts-erase").addEventListener("click", () => { BB.Store.startOver(); G.forgetAttempt(); show(); BB.HUD.toast("A fresh start. Have fun!", 4000); });
      if (pt) $("ts-copy").addEventListener("click", () => { hide(); BB.LevelMap.playtest("title"); });
      $("ts-keep").addEventListener("click", show);
      $("ts-keep").focus();
    });
  }

  function hide() {
    $("title-screen").hidden = true; G.paused = false;
    BB.Effects.music(false);
    if (!BB.LevelMap.isOpen()) BB.inertAround(null, false);
  }

  BB.Title = { init, show, hide, isOpen: () => !$("title-screen").hidden };
})(window.BB = window.BB || {});
