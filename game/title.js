// Start screen: shown when the game opens without a link to a level, the map or the sandbox.
// The bench behind it stays loaded but paused until the player picks a way in.
(function (BB) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let G;

  function init(game) {
    G = game;
    $("to-title").addEventListener("click", show);
  }

  function show() {
    BB.LevelMap.hideAll();
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
          <button type="button" class="ts-alt" id="ts-map"><span class="ts-k">Level map</span><span class="ts-s">${s.done} of ${s.total} levels · ${s.stars} of ${3 * s.total} ★</span></button>
          <button type="button" class="ts-alt" id="ts-sandbox"><span class="ts-k">Sandbox</span><span class="ts-s">${hasBench ? "Your bench, as you left it" : "Every part, no goals"}</span></button>
        </div>
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
    $("ts-go").focus();
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
  }

  function hide() {
    $("title-screen").hidden = true; G.paused = false;
    if (!BB.LevelMap.isOpen()) BB.inertAround(null, false);
  }

  BB.Title = { init, show, hide, isOpen: () => !$("title-screen").hidden };
})(window.BB = window.BB || {});
