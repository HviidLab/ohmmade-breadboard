// "I don't get it": Sparky pushes the bench off the screen, a blackboard comes down, and he explains the level's idea
// in a few chalk boards (lectures.js, chalk-art.js). Got it (or Esc) brings the bench back exactly as it was, and the
// level goes on at the same step. The level is paused meanwhile; a lecture never counts as a hint.
(function (BB) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => { const n = document.createElement("span"); n.textContent = s; return n.innerHTML; };
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const T = { fade: 200, push: 700, drop: 650, rise: 450, back: 600 };      // ms (game.css uses the same)
  let G = null, built = false, S = null;      // S: the lecture on screen

  function build() {
    if (built) return;
    built = true;
    const sec = document.createElement("section");
    sec.className = "chalk"; sec.id = "chalk"; sec.hidden = true; sec.tabIndex = -1;
    sec.setAttribute("role", "dialog"); sec.setAttribute("aria-modal", "true"); sec.setAttribute("aria-labelledby", "chalk-title");
    sec.innerHTML = '<div class="ch-board"><div class="ch-head"><h2 id="chalk-title"></h2><p class="ch-count" id="chalk-count"></p></div>' +
      '<div class="ch-chips" id="chalk-chips" role="group" aria-label="Ideas to go over"></div>' +
      '<figure class="ch-pic" id="chalk-pic" role="img"></figure><p class="sr-only" id="chalk-sr" aria-live="polite"></p></div>' +
      '<div class="ch-ledge"><button type="button" class="btn ch-step" id="chalk-back">← Back</button>' +
      '<button type="button" class="btn ch-step" id="chalk-next">Next →</button><button type="button" class="btn primary" id="chalk-done">Got it</button></div>';
    $("objective").after(sec);
    const say = document.createElement("div");
    say.className = "mentor chalk-say"; say.id = "chalk-say"; say.hidden = true;
    say.innerHTML = '<div class="mentor-body"><p class="mentor-name">Sparky</p><p class="mentor-text" id="chalk-line" aria-hidden="true"></p></div>';
    $("mentor").after(say);
    $("chalk-back").addEventListener("click", () => go(-1));
    $("chalk-next").addEventListener("click", () => go(1));
    $("chalk-done").addEventListener("click", () => close());
    $("chalk-line").addEventListener("click", () => BB.CoachUI.stopSpeaking());
    $("chalk-chips").addEventListener("click", (e) => { const b = e.target.closest("button[data-c]"); if (b) pick(b.dataset.c); });
    window.addEventListener("keydown", key, true);
  }
  function init(game) { G = game; }

  // Is there a lecture for this level? Its own idea, or (a level that teaches nothing new) one of the ideas it uses.
  function available(lv) {
    if (!lv) return false;
    return !!BB.Lectures.topic(lv) || (!(lv.teaches || []).length && BB.Lectures.choices(lv).length > 0);
  }

  // ---------- timing ----------
  function later(ms, fn) { if (!S) return; if (!ms) { fn(); return; } S.timers.push(setTimeout(() => { if (S) fn(); }, ms)); }
  function clearTimers() { if (S) { S.timers.forEach(clearTimeout); S.timers = []; } }

  // ---------- open: Sparky pushes the bench away, the blackboard comes down ----------
  function open(id) {
    if (!G || S || G.mode !== "level" || !G.level || G.paused || BB.LevelMap.isOpen() || BB.Title.isOpen() || !available(G.level)) return false;
    if (G.coach && G.coach.finished) return false;
    build();
    const lv = G.level, quick = reduce();
    BB.Input.cancel();
    BB.CoachUI.stopSpeaking();
    BB.CoachUI.hold(true);
    G.paused = true;
    S = { lv, id: id || BB.Lectures.topic(lv), i: 0, seen: {}, t0: performance.now(), beat: G.coach && G.coach.beat ? G.coach.beat.id || String(G.coach.i) : "",
      view: Object.assign({}, BB.Render.view), size: stageSize(), focus: document.activeElement, timers: [], phase: "opening", resized: false };
    const lvEl = $("lv"), stage = $("stage"), canvas = $("canvas"), board = $("chalk");
    lvEl.classList.add("lecturing");
    stage.classList.add("lecturing");
    board.hidden = false;
    board.classList.remove("down", "rising");
    BB.inertAround(board, true);
    board.focus({ preventScroll: true });
    BB.trail(`lecture ${S.id || "pick"}`);
    if (quick) { canvas.classList.add("away"); return drop(true); }
    // Sparky walks to the bench's left edge, leans in and pushes it off to the right.
    const st = stage.getBoundingClientRect(), bench = BB.CoachUI.benchBox(), home = BB.CoachUI.homeSpot();
    const w = home.w, h = home.h, mid = Math.min(Math.max((Math.max(bench.top, 0) + Math.min(bench.bottom, st.height)) / 2, h / 2 + 8), st.height - h / 2 - 10);
    const sx = Math.max(12, Math.min(bench.left, st.width * 0.4) - w * 0.62), sy = mid - h / 2;
    const walk = BB.CoachUI.goTo({ sx, sy, w, aim: [sx + w * 4, sy + h * 0.55] });
    later(T.fade + walk, () => {
      $("mentor-avatar").classList.add("pushing");
      canvas.classList.add("pushed");
      BB.CoachUI.goTo({ sx: sx + 90, sy, w, aim: [sx + 90 + w * 4, sy + h * 0.55] });
      later(T.push - 150, () => drop(false));
    });
    return true;
  }
  function drop(quick) {
    $("mentor-avatar").classList.remove("pushing");
    const board = $("chalk");
    board.classList.add("down");
    const home = BB.CoachUI.homeSpot(), st = $("stage").getBoundingClientRect(), r = board.getBoundingClientRect();
    BB.CoachUI.goTo({ sx: home.sx, sy: home.sy, w: home.w, aim: [r.left - st.left + r.width * 0.3, r.top - st.top + r.height * 0.45] });
    later(quick ? 0 : T.drop, () => {
      S.phase = "open";
      $("chalk-say").hidden = false;
      show();
    });
    return true;
  }

  // ---------- the boards ----------
  function lecture() { return S && S.id ? BB.Lectures.get(S.id) : null; }
  function show() {
    const L = lecture(), quick = reduce();
    const name = (id) => (BB.Concepts.get(id) || {}).name || id;
    const slides = L ? L.slides : [{ art: "pick", say: BB.Lectures.PICK, alt: "A big question mark: pick an idea." }];
    S.i = Math.max(0, Math.min(S.i, slides.length - 1));
    const sl = slides[S.i];
    if (L) { const v = S.seen[S.id] = S.seen[S.id] || { max: 0, of: slides.length }; v.max = Math.max(v.max, S.i + 1); }
    $("chalk-title").textContent = L ? name(S.id) : "Go over an idea";
    $("chalk-count").textContent = L ? `${S.i + 1} / ${slides.length}` : "";
    const ids = BB.Lectures.choices(S.lv);
    $("chalk-chips").innerHTML = ids.length > 1 || !L ? ids.map((c) => `<button type="button" class="ch-chip" data-c="${c}" aria-pressed="${c === S.id}">${esc(name(c))}</button>`).join("") : "";
    const pic = $("chalk-pic");
    pic.innerHTML = BB.ChalkArt.board(sl.art);
    pic.setAttribute("aria-label", sl.alt || "");
    BB.ChalkArt.animate(pic, { instant: quick });
    $("chalk-back").disabled = S.i === 0;
    $("chalk-next").hidden = !L || S.i === slides.length - 1;
    $("chalk-sr").textContent = L ? `Board ${S.i + 1} of ${slides.length}. ${sl.say}` : sl.say;
    BB.CoachUI.mood("talk", 600);
    BB.CoachUI.speakLine($("chalk-line"), sl.say);
    const f = !L ? $("chalk-chips").querySelector("button") : $("chalk-next").hidden ? $("chalk-done") : $("chalk-next");
    if (f && (document.activeElement === $("chalk") || !$("chalk").contains(document.activeElement) || document.activeElement.disabled || document.activeElement.hidden)) f.focus({ preventScroll: true });
  }
  function go(d) {
    if (!S || S.phase !== "open" || !lecture()) return;
    const n = lecture().slides.length, i = S.i + d;
    if (i < 0 || i >= n) return;
    S.i = i; show();
  }
  function pick(id) {
    if (!S || S.phase !== "open" || !BB.Lectures.has(id)) return;
    S.id = id; S.i = 0; show();
  }

  // ---------- close: the blackboard goes up, the bench slides back ----------
  function close(opts = {}) {
    if (!S || S.phase === "closing") return;
    const quick = opts.instant || reduce(), canvas = $("canvas"), board = $("chalk");
    clearTimers();
    S.phase = "closing";
    BB.CoachUI.stopSpeaking();
    $("chalk-say").hidden = true;
    $("mentor-avatar").classList.remove("pushing");
    record();
    // the view as it was (the board is still away); if the window changed size, the bench is fitted again below
    if (!S.resized && sameSize(S.size, stageSize())) BB.Render.setView(S.view);
    const finish = () => {
      board.hidden = true;
      board.classList.remove("down", "rising");
      canvas.classList.remove("pushed", "away", "returning");
      $("lv").classList.remove("lecturing");
      $("stage").classList.remove("lecturing");
      BB.inertAround(null, false);
      const was = S;
      S = null;
      if (G.mode !== "level") return;
      G.paused = false;
      BB.CoachUI.hold(false);
      if (was.resized || !sameSize(was.size, stageSize())) G.fitLevel();
      const f = was.focus && document.contains(was.focus) && !was.focus.closest("#chalk") ? was.focus : $("lv-lecture");
      if (f && f.focus) f.focus({ preventScroll: true });
    };
    if (quick) { finish(); return; }
    board.classList.add("rising");
    S.timers.push(setTimeout(() => { canvas.classList.remove("away"); canvas.classList.add("returning"); canvas.classList.remove("pushed"); }, 250));
    S.timers.push(setTimeout(finish, 250 + T.back));
  }
  // The window changed size while the blackboard is up: the bench is fitted again when it comes back.
  function resized() { if (S) S.resized = true; }
  const stageSize = () => { const r = $("stage").getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
  const sameSize = (a, b) => a[0] === b[0] && a[1] === b[1];

  // For the playtest data: which ideas were gone over, how far, how long, at which step.
  function record() {
    if (!G.coach || !S) return;
    const s = +((performance.now() - S.t0) / 1000).toFixed(1);
    const seen = Object.entries(S.seen);
    if (!seen.length) seen.push(["pick", { max: 0, of: 0 }]);
    for (const [c, v] of seen) G.coach.lectures.push({ c, beat: S.beat, boards: v.max, of: v.of, s });
    BB.trail(`lecture closed: ${seen.map(([c, v]) => `${c} ${v.max}/${v.of}`).join(", ")}`);
  }

  // Keys while the blackboard is up: Esc puts the bench back (it never opens the menu), the arrows go back and forth,
  // Enter shows Sparky's whole line at once.
  function key(e) {
    if (!S) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    if (S.phase !== "open") { e.stopImmediatePropagation(); return; }
    const onButton = e.target.closest && e.target.closest("button");
    if (e.key === "ArrowRight" && !e.target.closest(".ch-chips")) { e.preventDefault(); e.stopImmediatePropagation(); go(1); }
    else if (e.key === "ArrowLeft" && !e.target.closest(".ch-chips")) { e.preventDefault(); e.stopImmediatePropagation(); go(-1); }
    else if (e.key === "Enter" && !onButton && BB.CoachUI.speaking) { e.preventDefault(); e.stopImmediatePropagation(); BB.CoachUI.stopSpeaking(); }
    else if (e.key === "Tab") trap(e);
    else e.stopImmediatePropagation();          // nothing else reaches the paused level
  }
  function trap(e) {
    const all = [...$("chalk").querySelectorAll("button")].filter((b) => !b.hidden && !b.disabled);
    if (!all.length) return;
    const i = all.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); all[all.length - 1].focus(); }
    else if (!e.shiftKey && (i === -1 || i === all.length - 1)) { e.preventDefault(); all[0].focus(); }
  }

  BB.Lecture = { init, open, close, resized, available, isOpen: () => !!S, get state() { return S ? { id: S.id, i: S.i, phase: S.phase, seen: S.seen } : null; } };
})(window.BB = window.BB || {});
