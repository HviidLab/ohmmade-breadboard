// Mission select screen, mission panel, workbook-layout guide, progress.
(function (BB) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const M = BB.Missions.list;
  let G, guideOn = false, hintsShown = 0, lastRender = "";

  // Each mission's card shows its main part, drawn like the bench (art style 1), with the mission's number glowing.
  const PART = { E0: "meter", E1: "meter", E2: "resistor", E3: "led", E3x: "led", E4s: "resistor", E4p: "resistor", E5: "pot", E6: "button", E7: "cap", E8: "npn", E9: "ldr" };
  const face = (m) => `<span class="ms-ph">${BB.HUD.icon(PART[m.id] || (m.id[0] === "A" ? "uno" : "battery"))}<b>${m.id}</b></span>`;
  const stars = (n, of = 3) => "★".repeat(n) + "☆".repeat(of - n);

  function init(game) {
    G = game;
    $("mode-missions").addEventListener("click", showSelect);
    $("mode-sandbox").addEventListener("click", () => G.enterSandbox());
  }

  // ---------- select screen ----------
  function showSelect() {
    const prog = G.progress();
    const host = $("mselect");
    host.innerHTML = `<div class="ms-inner"><div class="ms-head"><h2>Missions</h2><p>The workbook experiments, checked by the simulator. Build anywhere on the board: the goals test what flows, not which holes you use.</p>
      <button type="button" class="btn" id="ms-close">Back to the bench</button></div><ol class="ms-grid">${M.map((m, k) => {
        const p = prog[m.id] || {};
        return `<li><button type="button" class="ms-card${p.done ? " done" : ""}" data-k="${k}">
          ${face(m)}
          <span class="ms-id">${m.id}</span><span class="ms-title">${m.title}</span>
          <span class="ms-stars" aria-label="${p.stars || 0} of 3 stars">${stars(p.stars || 0)}</span>${p.badge ? '<span class="ms-badge">Lesson learned</span>' : ""}</button></li>`;
      }).join("")}</ol></div>`;
    host.hidden = false;
    $("mode-missions").setAttribute("aria-pressed", "true");
    $("mode-sandbox").setAttribute("aria-pressed", "false");
    $("ms-close").addEventListener("click", () => { host.hidden = true; syncModeButtons(); });
    host.querySelectorAll(".ms-card").forEach((b) => b.addEventListener("click", () => { host.hidden = true; start(M[+b.dataset.k]); }));
    const first = host.querySelector(".ms-card:not(.done)") || host.querySelector(".ms-card");
    if (first) first.focus();
  }
  function syncModeButtons() {
    $("mode-missions").setAttribute("aria-pressed", String(G.mode === "mission"));
    $("mode-sandbox").setAttribute("aria-pressed", String(G.mode === "sandbox"));
  }

  // ---------- running a mission ----------
  function start(m) {
    hintsShown = 0; guideOn = false; lastRender = "";
    G.enterMission(m);
    syncModeButtons();
    render(true);
  }

  function render(force) {
    const panel = $("mission-panel");
    if (G.mode !== "mission" || !G.run) { panel.hidden = true; if (G.mode !== "level") BB.Render.guide(null); return; }
    const run = G.run, m = run.m;
    const key = JSON.stringify([run.state.map((s) => s.done), run.complete, hintsShown, guideOn]);
    if (!force && key === lastRender) return;
    lastRender = key;
    panel.hidden = false;
    const next = run.nextOpen();
    panel.innerHTML = `<div class="paper"><h2>${m.id} · ${m.title}</h2><p class="brief">${m.brief}</p>
      <ol class="goals">${m.goals.map((g, k) => `<li class="${run.state[k].done ? "done" : k === next ? "next" : ""}"><span class="tick" aria-hidden="true">${run.state[k].done ? "✓" : "○"}</span>${g.text}</li>`).join("")}</ol>
      ${run.complete ? `<div class="won"><span class="big-stars">${stars(run.stars)}</span><p>${run.stars === 3 ? "Perfect: nothing broken, no short circuits." : run.stars === 2 ? "Done without breaking anything. Avoid short circuits and overloads for the third star." : "Done. Try again without breaking parts for more stars."}${m.badge ? " Badge earned: Lesson learned." : ""}</p></div>` : ""}
      ${hintsShown ? `<ul class="hints">${m.hints.slice(0, hintsShown).map((h) => `<li>${h}</li>`).join("")}</ul>` : ""}
      </div><div class="row">
      ${hintsShown < m.hints.length ? '<button type="button" class="btn" id="mp-hint">Show a hint</button>' : ""}
      <button type="button" class="btn" id="mp-guide" aria-pressed="${guideOn}">${guideOn ? "Hide" : "Show"} workbook layout</button>
      <button type="button" class="btn" id="mp-restart">Restart</button>
      <button type="button" class="btn" id="mp-all">All missions</button>
      ${run.complete && nextMission(m) ? '<button type="button" class="btn primary" id="mp-next">Next mission</button>' : ""}
      </div><p class="note"><a href="${m.workbook}" target="_blank" rel="noopener">Open this experiment in the workbook</a></p>`;
    const on = (id, fn) => { const b = $(id); if (b) b.addEventListener("click", fn); };
    on("mp-hint", () => { hintsShown++; render(true); });
    on("mp-guide", () => { guideOn = !guideOn; BB.Render.guide(guideOn ? guideParts(m) : null); render(true); });
    on("mp-restart", () => start(m));
    on("mp-all", showSelect);
    on("mp-next", () => start(nextMission(m)));
  }

  function guideParts(m) {
    const id = m.guide || (m.id === "E3x" ? "E3" : m.id);
    return BB.Missions.layout(id);
  }
  function nextMission(m) { const k = M.indexOf(m); return M[k + 1] || null; }

  // Called from the main loop with the simulated time step.
  function step(dt) {
    if (G.mode !== "mission" || !G.run) return;
    const was = G.run.complete, before = G.run.state.map((s) => s.done);
    G.run.step(G, dt);
    G.run.state.forEach((s, k) => { if (s.done && !before[k]) BB.HUD.log(`Goal done: ${G.run.m.goals[k].text}`, "good", G.sim.t); });
    if (!was && G.run.complete) {
      const m = G.run.m, prog = G.progress(), old = prog[m.id] || {};
      prog[m.id] = { done: true, stars: Math.max(old.stars || 0, G.run.stars), badge: old.badge || !!m.badge };
      G.saveProgress(prog);
      BB.HUD.toast(`Mission complete: ${m.title} ${stars(G.run.stars)}`, 6000);
    }
  }

  BB.MissionUI = { init, render, step, showSelect, start };
})(window.BB = window.BB || {});
