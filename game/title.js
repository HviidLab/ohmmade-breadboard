// Start screen: shown when the game opens without a #mission-…, #missions or #sandbox link.
// The bench behind it stays loaded but paused until the player picks a way in.
(function (BB) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let G;

  function init(game) {
    G = game;
    $("to-title").addEventListener("click", show);
  }

  // The first mission not yet done, or null when all are done.
  function nextMission(prog) { return BB.Missions.list.find((m) => !(prog[m.id] || {}).done) || null; }

  function show() {
    const M = BB.Missions.list, prog = G.progress();
    const done = M.filter((m) => (prog[m.id] || {}).done).length;
    const starsWon = M.reduce((n, m) => n + ((prog[m.id] || {}).stars || 0), 0);
    const next = nextMission(prog), fresh = done === 0;
    const hasBench = !!G.hasSavedSandbox();
    const host = $("title-screen");
    host.innerHTML = `<div class="ts-inner">
      <a class="ts-brand" href="index.html">Ohmmade Breadboard</a>
      <h1>Breadboard <span>Game</span></h1>
      <p class="ts-lede">A battery pack, a multimeter and a breadboard under the desk lamp. Build the workbook circuits, measure them, and find out what happens when you leave out the resistor.</p>
      <div class="ts-actions">
        ${next ? `<button type="button" class="ts-go" id="ts-go"><span class="ts-k">${fresh ? "Start" : "Continue"}</span><span class="ts-m">${next.id} · ${next.title}</span></button>`
               : `<button type="button" class="ts-go" id="ts-go"><span class="ts-k">All ${M.length} missions done</span><span class="ts-m">Pick one to replay</span></button>`}
        <div class="ts-more">
          <button type="button" class="ts-alt" id="ts-missions"><span class="ts-k">Choose a mission</span><span class="ts-s">${done} of ${M.length} done · ${starsWon} of ${3 * M.length} ★</span></button>
          <button type="button" class="ts-alt" id="ts-sandbox"><span class="ts-k">Sandbox</span><span class="ts-s">${hasBench ? "Your bench, as you left it" : "Free build, no goals"}</span></button>
        </div>
      </div>
      <p class="ts-narrow">The game needs a desktop screen (at least 900 px wide). On this screen, try the <a href="breadboard.html">breadboard trainer</a>.</p>
      <ol class="ts-how">
        <li><b>Drag</b> parts from the drawer onto the board.</li>
        <li><b>Measure</b> with the meter: volts, milliamps, ohms.</li>
        <li><b>Too much current?</b> The part smokes, just like at your bench.</li>
      </ol>
      <p class="ts-foot"><a href="index.html">Course home</a> · <a href="primer.html">Primer</a> · <a href="workbook.html">Workbook</a></p>
    </div>`;
    host.hidden = false;
    G.paused = true;
    BB.HUD.toast(null);
    $("ts-go").addEventListener("click", () => { hide(); if (next) BB.MissionUI.start(next); else BB.MissionUI.showSelect(); });
    $("ts-missions").addEventListener("click", () => { hide(); BB.MissionUI.showSelect(); });
    $("ts-sandbox").addEventListener("click", () => { hide(); G.enterSandbox(true); });
    $("ts-go").focus();
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
  }

  function hide() { $("title-screen").hidden = true; G.paused = false; }

  BB.Title = { init, show, hide, isOpen: () => !$("title-screen").hidden };
})(window.BB = window.BB || {});
