// The level screen around the bench: objective card (top left), controls (top right), the mentor Sparky with the
// current line and its buttons (bottom left), the parts hotbar (bottom right), and the part card next to the
// selected part. Also the hooks the coach (coach.js) talks to.
(function (BB) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const R = BB.Render, H = BB.HUD;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let G = null, lv = null, marks = null, spotEl = null, asideTimer = null, partFor = null, lastHotbar = "", lastObjective = "";

  // Sparky, the mentor: a little LED. The parts are separate so CSS can make it bob, blink, glow, talk and react.
  const SPARK = `<svg viewBox="0 -24 120 160" aria-hidden="true"><defs>
    <linearGradient id="spHair" x1="0" y1="1" x2=".3" y2="0"><stop offset="0" stop-color="#1b3a9e"/><stop offset=".6" stop-color="#2f7fe0"/><stop offset="1" stop-color="#5fe0f0"/></linearGradient>
    <radialGradient id="spGlow"><stop offset="0" stop-color="#fff2c8"/><stop offset=".4" stop-color="#ffb547" stop-opacity=".55"/><stop offset="1" stop-color="#ffb547" stop-opacity="0"/></radialGradient>
    <radialGradient id="spGlowBad"><stop offset="0" stop-color="#ffd2c8"/><stop offset=".4" stop-color="#ff6a4a" stop-opacity=".55"/><stop offset="1" stop-color="#ff6a4a" stop-opacity="0"/></radialGradient>
    <radialGradient id="spDome" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#ffecc2"/><stop offset=".55" stop-color="#ffb547"/><stop offset="1" stop-color="#c46f0e"/></radialGradient></defs>
    <circle class="sp-glow" cx="60" cy="58" r="58" fill="url(#spGlow)"/><circle class="sp-glow-bad" cx="60" cy="58" r="58" fill="url(#spGlowBad)"/>
    <g class="sp-body">
      <g class="sp-legs" stroke="#c7ccd1" stroke-width="4.5" stroke-linecap="round" fill="none"><path d="M49 104 V132"/><path d="M71 104 V122 l7 8"/></g>
      <path d="M24 62 A36 36 0 0 1 96 62 V102 H24Z" fill="url(#spDome)" stroke="#b5640c" stroke-width="1.5"/>
      <rect x="18" y="99" width="84" height="10" rx="3.5" fill="#c46f0e"/>
      <ellipse cx="42" cy="44" rx="7" ry="13" fill="#fff" opacity=".38" transform="rotate(24 42 44)"/>
      <g class="sp-hair">
        <path d="M26 52 C22 36 30 24 40 20 L34 4 L50 14 L52 -10 L64 8 L76 -18 L80 6 L96 -2 L90 18 C98 26 100 40 96 52 C86 38 74 34 60 36 C46 36 34 40 26 52Z" fill="url(#spHair)" stroke="#0f2366" stroke-width="2" stroke-linejoin="round"/>
        <path d="M44 28 C52 16 60 8 70 -8" stroke="#9ff3ff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".75"/>
        <path d="M78 24 C84 16 88 10 92 4" stroke="#9ff3ff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".5"/>
        <path class="sp-zap" d="M0 -6 L1.4 -1.4 L6 0 L1.4 1.4 L0 6 L-1.4 1.4 L-6 0 L-1.4 -1.4Z" fill="#fff6c8" transform="translate(76 -22)"/>
        <path class="sp-zap z2" d="M0 -5 L1.2 -1.2 L5 0 L1.2 1.2 L0 5 L-1.2 1.2 L-5 0 L-1.2 -1.2Z" fill="#fff6c8" transform="translate(53 -14)"/>
        <path class="sp-zap z3" d="M0 -5 L1.2 -1.2 L5 0 L1.2 1.2 L0 5 L-1.2 1.2 L-5 0 L-1.2 -1.2Z" fill="#fff6c8" transform="translate(98 -6)"/>
      </g>
      <g class="sp-eyes" fill="#2a1a05"><ellipse cx="47" cy="66" rx="5.4" ry="7"/><ellipse cx="73" cy="66" rx="5.4" ry="7"/><circle cx="49" cy="63" r="1.8" fill="#fff"/><circle cx="75" cy="63" r="1.8" fill="#fff"/></g>
      <g class="sp-eyes-happy" stroke="#2a1a05" stroke-width="3.6" stroke-linecap="round" fill="none"><path d="M41 68 Q47 59 53 68"/><path d="M67 68 Q73 59 79 68"/></g>
      <circle cx="38" cy="78" r="5" fill="#ff7a59" opacity=".45"/><circle cx="82" cy="78" r="5" fill="#ff7a59" opacity=".45"/>
      <path class="sp-smile" d="M51 80 Q60 88 69 80" stroke="#2a1a05" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <ellipse class="sp-mouth" cx="60" cy="83" rx="6.5" ry="5" fill="#2a1a05"/>
      <path class="sp-frown" d="M51 86 Q55.5 81 60 85 Q64.5 89 69 84" stroke="#2a1a05" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <g class="sp-arm" transform="translate(96 78)"><path d="M0 0 H34" stroke="#6b4310" stroke-width="9" stroke-linecap="round"/><path d="M0 0 H34" stroke="#e9ecef" stroke-width="5" stroke-linecap="round"/><circle cx="38" cy="0" r="8" fill="#ffd27a" stroke="#6b4310" stroke-width="2.5"/><path d="M42 0 H51" stroke="#6b4310" stroke-width="7" stroke-linecap="round"/><path d="M42 0 H51" stroke="#ffd27a" stroke-width="3.5" stroke-linecap="round"/></g>
    </g></svg>`;
  // Sparky's face for a moment: "talk" while a new line appears (the mouth moves), and a feeling on top of it:
  // "happy" for stars and goals, "worried" when something fails. Talking and a feeling can show together.
  const moodTimers = {};
  function mood(name, ms) {
    const a = $("mentor-avatar");
    if (!a || !name) return;
    const slot = name === "talk" ? "talk" : "feel";
    clearTimeout(moodTimers[slot]);
    if (slot === "feel") a.classList.remove("happy", "worried");
    else a.classList.remove("talk");
    void a.offsetWidth;
    a.classList.add(name);
    moodTimers[slot] = setTimeout(() => a.classList.remove(name), ms);
  }
  function init(game) {
    G = game;
    $("mentor-avatar").innerHTML = SPARK;
    $("mentor-text").addEventListener("click", () => stopSpeaking());     // click the line to see all of it at once
    voiceOn = BB.Store.get().settings.voice !== false;
    $("lv-undo").addEventListener("click", () => G.undo());
    $("lv-pause").addEventListener("click", () => BB.LevelMap.pause());
    $("lv-xray").addEventListener("click", () => xray(!BB.Flow.xrayOn));
    window.addEventListener("keydown", (e) => {
      if (G.mode !== "level" || e.target.matches("input, select, textarea")) return;
      if (e.key === "Escape" && !G.paused) { e.preventDefault(); BB.LevelMap.pause(); }
      else if (e.key === "Enter" && !G.paused && typing) { e.preventDefault(); stopSpeaking(); }
      else if (e.key === "Enter" && !G.paused && $("mentor-next")) { e.preventDefault(); $("mentor-next").click(); }
      else if ((e.key === "x" || e.key === "X") && !G.paused && !$("lv-xray").hidden) xray(!BB.Flow.xrayOn);
    });
    // Hidden tuning overlay (the backquote key): per level, attempts, time and hints of the last finished attempt.
    // Kept on this computer only; nothing is sent anywhere.
    window.addEventListener("keydown", (e) => { if (e.key === "`" && !e.target.matches("input, select, textarea")) telemetry(); });
  }

  // ---------- entering and leaving a level ----------
  function enter(level) {
    stopSpeaking(); shownParts = [];
    lv = level; marks = null; partFor = null; lastHotbar = ""; lastObjective = "";
    $("lv").hidden = false;
    $("lv-xray").hidden = !(lv.ui && lv.ui.xray);
    xray(false);
    $("mentor-text").textContent = "";
    $("mentor-act").replaceChildren();
    aside(null);
    refresh();
    for (const n of [$("mentor-avatar"), $("mentor")]) n.removeAttribute("style");
    lastBox = null;
    requestAnimationFrame(() => walk(null));
  }
  function leave() {
    stopSpeaking(); shownParts = [];
    lv = null; marks = null;
    $("lv").hidden = true;
    R.marks(null); R.guide(null); spot(null);
    $("partcard").hidden = true;
  }
  // Room the overlays take, so the bench is fitted into the free middle.
  function insets() {
    const st = $("stage").getBoundingClientRect();
    // Sparky stands at the lower left, so the bench keeps to the right of him; the bubble and the tray take the bottom.
    // The bottom keeps extra room for the bubble to grow when a hint is added.
    const bub = $("mentor"), H = st.height;      // the bubble's home height, wherever Sparky is now
    const bot = Math.min(st.top + H - 18 - bub.offsetHeight, $("hotbar").getBoundingClientRect().top);
    R.setInsets({ top: 62, bottom: Math.max(st.bottom - bot + 64, 40), left: 12 + baseW() + 4, right: 12 });   // Sparky's home column
  }

  // ---------- Sparky speaks: the line types out, with a gibberish syllable every couple of letters ----------
  // The mouth opens on each syllable (wider on vowels). Commas and full stops pause. Buttons never wait for it.
  let typing = null, voiceOn = true;
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function mouth(open) { const m = document.querySelector("#mentor-avatar .sp-mouth"); if (m) m.style.transform = `scaleY(${open})`; }
  function talking(on) { $("mentor-avatar").classList.toggle("talk", on); if (!on) mouth(0.2); }
  function stopSpeaking() {
    if (!typing) return;
    clearTimeout(typing.timer);
    typing.queue.forEach((q) => { q.el.textContent = q.text; });
    typing = null;
    talking(false);
  }
  function speak(queue) {
    stopSpeaking();
    queue = queue.filter((q) => q.text);
    if (!queue.length) return;
    if (reduceMotion()) { queue.forEach((q) => { q.el.textContent = q.text; }); return; }
    let qi = 0, ci = 0, syl = 0;
    typing = { queue, timer: null };
    queue.forEach((q) => { q.el.innerHTML = `<span class="ut">${esc(q.text)}</span>`; });   // full size from the start, so Sparky knows where to stand
    talking(true);
    const tick = () => {
      const q = queue[qi];
      if (!q) { typing = null; talking(false); return; }
      ci++;
      q.el.innerHTML = `${esc(q.text.slice(0, ci))}<span class="ut">${esc(q.text.slice(ci))}</span>`;
      const ch = q.text[ci - 1];
      let delay = 26;
      if (/[a-z0-9]/i.test(ch)) {
        if (syl++ % 2 === 0) {
          const vowel = /[aeiouy]/i.test(ch), end = /[.!?]/.exec(q.text.slice(ci));
          if (voiceOn) BB.Effects.voice(ch, { question: !!end && end[0] === "?" && end.index < 10, excited: !!end && end[0] === "!" });
          mouth(vowel ? 1 : 0.6);
          setTimeout(() => { if (typing) mouth(0.2); }, 60);
        }
      } else if (/[,;:]/.test(ch)) delay = 130;
      else if (/[.!?…]/.test(ch)) delay = 240;
      if (ci >= q.text.length) { qi++; ci = 0; delay = Math.max(delay, 280); }
      typing.timer = setTimeout(tick, delay);
    };
    tick();
  }
  function setVoice(on) { voiceOn = !!on; BB.Store.update((s) => { s.settings.voice = voiceOn; }); }

  // ---------- the coach's hooks ----------
  // A new line from Sparky. Parts already on screen (the same line with a hint added) stay; new parts are spoken.
  let shownParts = [];
  function say(text, offer = {}) {
    const parts = String(text).split("\n");
    const p = $("mentor-text");
    const same = (k) => shownParts[k] === parts[k] && (k > 0 || p.childElementCount > 0);
    p.innerHTML = parts.map((t, k) => (k === 0 ? '<span class="ml"></span>' : '<span class="hint-line"></span>')).join("");
    const spans = [...p.children];
    if (!same(0)) { p.classList.remove("pop"); void p.offsetWidth; p.classList.add("pop"); }
    const toSpeak = [];
    parts.forEach((t, k) => { if (same(k)) spans[k].textContent = t; else toSpeak.push({ el: spans[k], text: t }); });
    shownParts = parts;
    speak(toSpeak);
    relayout();
    const act = $("mentor-act");
    act.replaceChildren();
    const btn = (label, cls, fn, id) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = label; if (id) b.id = id; b.addEventListener("click", fn); act.appendChild(b); return b; };
    if (offer.choices) offer.choices.forEach((c, k) => btn(c, "choice", () => G.coach.choose(k)).dataset.k = k);
    if (offer.next) btn(`${offer.next}`, "btn primary", () => G.coach.next(), "mentor-next");
    if (offer.hints > 0 || (G.coach && G.coach.beat && G.coach.hint < (G.coach.beat.hints || []).length)) btn("Hint", "btn ghost", () => G.coach.showHint(), "mentor-hint");
    if (offer.choices) { const first = act.querySelector(".choice"); if (first) first.focus({ preventScroll: true }); }
    else if (offer.next) $("mentor-next").focus({ preventScroll: true });
  }
  function highlight(targets) {
    marks = targets;
    R.marks((targets && [].concat(targets).filter((t) => !t.ui)) || null);
    const ui = targets && [].concat(targets).find((t) => t.ui);
    spot(ui ? document.querySelector(ui.ui) : null);
    relayout();
  }

  // ---------- Sparky walks to what he is talking about ----------
  // He stands next to the marked thing (below, beside or above it) with his bubble, never covering it, the objective
  // card, the top buttons or the tray, and points at it. With nothing marked, or no room, he walks home (lower left).
  const AWAY = 0.74;                       // his size away from home
  let lastBox = null, layoutRaf = 0, walkTimer = null, atHome = true;
  const rel = (r, st) => ({ left: r.left - st.left, top: r.top - st.top, right: r.right - st.left, bottom: r.bottom - st.top });
  const grow = (r, m) => ({ left: r.left - m, top: r.top - m, right: r.right + m, bottom: r.bottom + m });
  const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const union = (rs) => ({ left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)), right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)) });
  const baseW = () => Math.min(Math.max(window.innerWidth * 0.165, 170), 240);

  // Screen boxes (relative to the stage) of the marked things: [main, ...others]. Sparky goes to the first one named.
  function targetBoxes() {
    if (!marks) return [];
    const st = $("stage").getBoundingClientRect(), all = [].concat(marks), onBench = all.filter((t) => !t.ui);
    return all.map((t) => {
      const rs = t.ui ? [document.querySelector(t.ui)].filter(Boolean).map((n) => n.getBoundingClientRect())
        : [...document.querySelectorAll(`#L-coach [data-t="${onBench.indexOf(t)}"] .mark`)].map((n) => n.getBoundingClientRect());
      const ok = rs.filter((r) => r.width || r.height);
      return ok.length ? rel(union(ok), st) : null;
    }).filter(Boolean);
  }
  const targetBox = () => targetBoxes()[0] || null;
  function relayout() {
    if (layoutRaf || !lv) return;
    layoutRaf = requestAnimationFrame(() => { layoutRaf = 0; if (lv) walk(targetBox()); });
  }
  function walk(box) {
    lastBox = box;
    const st = $("stage").getBoundingClientRect(), W = st.width, H = st.height, bub = $("mentor");
    if (box) {
      bub.classList.add("away");
      const bw = bub.offsetWidth, bh = bub.offsetHeight, w = baseW() * AWAY, h = (w * 160) / 120, gap = 14;
      const avoid = [grow(box, 12), ...targetBoxes().slice(1).map((r) => grow(r, 6)), ...[$("objective"), $("hotbar"), document.querySelector(".topctl")].map((n) => grow(rel(n.getBoundingClientRect(), st), 6))];
      const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
      const m = 20;                       // his distance from the target (more than the 12 px it must stay clear)
      const spots = [[cx - w / 2, box.bottom + m], [box.right + m, cy - h / 2], [box.left - m - w, cy - h / 2], [cx - w / 2, box.top - h - m],
        [box.right + m, box.bottom - h * 0.5], [box.left - m - w, box.bottom - h * 0.5], [box.right + m, box.top - h * 0.5], [box.left - m - w, box.top - h * 0.5]];
      // First try to keep clear of every part on the board too (wires excepted: they are long); then only the targets.
      const parts = G.doc.parts.filter((q) => q.type !== "wire").map((q) => document.querySelector(`[data-body="${q.id}"]`) || document.querySelector(`[data-part="${q.id}"]`))
        .filter(Boolean).map((n) => grow(rel(n.getBoundingClientRect(), st), 4));
      for (const extra of [parts, []]) {
        for (const [sx, sy] of spots) {
          for (const side of cx > sx + w / 2 ? ["left", "right"] : ["right", "left"]) {      // the bubble goes on the side away from the target
            const bx = side === "right" ? sx + w + gap : sx - gap - bw, by = Math.min(Math.max(sy + h * 0.5 - bh / 2, 8), H - bh - 8);
            const S = { left: sx, top: sy, right: sx + w, bottom: sy + h }, B = { left: bx, top: by, right: bx + bw, bottom: by + bh }, all = union([S, B]);
            if (all.left < 8 || all.top < 8 || all.right > W - 8 || all.bottom > H - 8) continue;
            if (avoid.some((a) => meets(a, S) || meets(a, B)) || extra.some((a) => meets(a, S) || meets(a, B))) continue;
            return go({ sx, sy, w, bx, by, side, aim: [cx, cy] });
          }
        }
      }
    }
    bub.classList.remove("away");                       // home: lower left, full size, bubble beside him
    const w = baseW(), h = (w * 160) / 120;
    go({ sx: 12, sy: H - h - 10, w, bx: w + 22, by: H - 18 - bub.offsetHeight, side: "right", aim: null });
  }
  function go(p) {
    const a = $("mentor-avatar"), b = $("mentor"), st = $("stage").getBoundingClientRect(), cur = a.getBoundingClientRect();
    const dx = p.sx - (cur.left - st.left), dist = Math.hypot(dx, p.sy - (cur.top - st.top));
    const dur = !a.style.left || dist < 6 || reduceMotion() ? 0 : Math.min(1.3, Math.max(0.4, dist / 650));
    const tr = dur ? `left ${dur}s ease-in-out, top ${dur}s ease-in-out` : "none";
    a.style.transition = dur ? `${tr}, width ${dur}s ease-in-out` : "none";
    b.style.transition = tr;               // the bubble's width must not animate: Sparky measures it to find a place
    Object.assign(a.style, { left: `${p.sx}px`, top: `${p.sy}px`, width: `${p.w}px`, bottom: "auto" });
    Object.assign(b.style, { left: `${p.bx}px`, top: `${p.by}px`, bottom: "auto" });
    b.classList.toggle("tail-right", p.side === "left");
    atHome = !p.aim;
    clearTimeout(walkTimer);
    a.classList.remove("pointing");
    if (dur) {
      a.style.setProperty("--lean", dx < 0 ? "-5deg" : "5deg");
      a.classList.add("walking");
      walkTimer = setTimeout(() => { a.classList.remove("walking"); aimArm(p); }, dur * 1000);
    } else { a.classList.remove("walking"); aimArm(p); }
  }
  // Point at the target with the arm on its side.
  function aimArm(p) {
    const a = $("mentor-avatar"), arm = a.querySelector(".sp-arm");
    if (!p.aim || !arm) return;
    const k = p.w / 120, right = p.aim[0] > p.sx + p.w / 2, sh = [p.sx + (right ? 96 : 24) * k, p.sy + (78 + 24) * k];     // the drawing starts 24 units above the dome (the hair)
    const deg = (Math.atan2(p.aim[1] - sh[1], p.aim[0] - sh[0]) * 180) / Math.PI;
    arm.setAttribute("transform", `translate(${right ? 96 : 24} 78) rotate(${deg.toFixed(1)})`);
    a.classList.add("pointing");
  }
  // The board moved (pan, zoom, redraw) or the window changed: follow the target.
  function follow() {
    if (!lv) return;
    const box = targetBox();
    const moved = !!box !== !!lastBox || (box && ["left", "top", "right", "bottom"].some((k) => Math.abs(box[k] - lastBox[k]) > 20));
    if (moved) walk(box);
  }
  function spot(node) {
    if (spotEl) spotEl.classList.remove("spot");
    spotEl = node;
    if (node) node.classList.add("spot");
  }
  function ghost(parts) { R.guide(parts && parts.map((p) => Object.assign({}, p, { id: `ghost-${p.id}` }))); }
  function xray(on) {
    BB.Flow.xray(on);
    $("lv-xray").setAttribute("aria-pressed", String(!!on));
  }
  function bonus(k) {
    refreshObjective(true);
    BB.Effects.chime && BB.Effects.chime(1);
    aside(`Bonus: ${lv.bonus[k].text} ★`, 4000, "good");
    mood("happy", 1600);
  }
  const hooks = () => ({ say, highlight, ghost, xray, bonus, aside: (t) => aside(t, 4000), beat: () => { refresh(); } });

  // A short line under the mentor's own: refusals, failures, the short-circuit guard.
  function aside(text, ms = 6000, kind = "") {
    const a = $("mentor-aside");
    clearTimeout(asideTimer);
    if (!text) { a.hidden = true; return; }
    a.textContent = text;
    a.className = `aside ${kind}`;
    if (kind === "bad") mood("worried", 2200);
    a.hidden = false;
    asideTimer = setTimeout(() => { a.hidden = true; }, ms);
  }

  // ---------- objective card, hotbar, part card ----------
  function refreshObjective(force) {
    if (!lv || !G.run) return;
    const goalDone = G.run.state.map((s) => s.done), got = G.coach ? G.coach.bonus : [];
    const key = JSON.stringify([lv.id, goalDone, got]);
    if (!force && key === lastObjective) return;
    lastObjective = key;
    $("objective").innerHTML = `<p class="ob-level">Level ${lv.id}</p><h2>${esc(lv.title)}</h2>
      <ul class="ob-goals">${lv.goals.map((g, k) => `<li class="${goalDone[k] ? "done" : ""}"><span aria-hidden="true">${goalDone[k] ? "✓" : "○"}</span>${esc(g.text)}</li>`).join("")}</ul>
      <ul class="ob-bonus">${(lv.bonus || []).map((b, k) => `<li class="${got[k] ? "got" : ""}"><span aria-hidden="true">${got[k] ? "★" : "☆"}</span>${esc(b.text)}</li>`).join("")}</ul>`;
  }

  function label(item) {
    if (item.type === "wire") return "Wire";
    return BB.Parts.name(Object.assign({ value: 330 }, item));
  }
  function refreshHotbar() {
    if (!lv || !G.rules) return;
    const items = G.rules.tray(G);
    const key = JSON.stringify(items);
    if (key === lastHotbar) return;
    lastHotbar = key;
    const ul = $("hotbar-list");
    ul.replaceChildren();
    if (!items.length) { ul.innerHTML = '<li class="empty">Nothing to add in this level</li>'; return; }
    for (const it of items) {
      const li = document.createElement("li");
      li.tabIndex = 0;
      li.dataset.key = it.key;
      li.className = it.n ? "" : "none";
      const color = it.type === "led" ? R.LEDC[it.color] && R.LEDC[it.color].icon : null;
      li.innerHTML = `${H.icon(it.type, color)}<span class="hb-name">${esc(label(it))}</span><span class="hb-n">×${it.n}</span>`;
      const startDrag = (e) => {
        if (!it.n) { aside(`No ${label(it).toLowerCase()} left. Take one off the board to use it again.`, 3500); return; }
        BB.Input.startNew(Object.assign({}, it), e);
      };
      li.addEventListener("pointerdown", (e) => { e.preventDefault(); startDrag(e); });
      li.addEventListener("keydown", (e) => { if (e.key === "Enter") startDrag(null); });
      ul.appendChild(li);
    }
  }

  // Actions for the selected part, each only if this level allows it.
  function refreshPartCard() {
    const card = $("partcard");
    const part = lv && G.sel && G.doc.get(G.sel);
    if (!part || ["battery", "meter"].includes(part.type)) { card.hidden = true; partFor = null; return; }
    const rt = G.sim.rt.get(part.id), dead = !!(rt && rt.destroyed);
    const acts = [];
    if (part.type === "led" && G.can({ kind: "flip", id: part.id }).ok) acts.push(["Flip", "flip", () => G.rotate(part.id)]);
    if (dead && G.can({ kind: "replace", id: part.id }).ok) acts.push(["Fresh one", "fresh", () => G.replace(part.id)]);
    if (G.can({ kind: "remove", id: part.id }).ok) acts.push(["Remove", "remove", () => G.remove(part.id)]);
    const key = JSON.stringify([part.id, dead, acts.map((a) => a[1])]);
    if (key !== partFor) {
      partFor = key;
      card.innerHTML = `<p class="pc-name">${esc(BB.Parts.name(part))}${dead ? ' <span class="pc-dead">burned out</span>' : ""}</p><div class="pc-act"></div>`;
      const box = card.querySelector(".pc-act");
      for (const [lbl, cls, fn] of acts) { const b = document.createElement("button"); b.type = "button"; b.className = `btn pc-${cls}`; b.textContent = lbl; b.addEventListener("click", fn); box.appendChild(b); }
      if (!acts.length) box.innerHTML = '<span class="pc-fixed">Fixed in this level</span>';
    }
    card.hidden = false;
    placePartCard();
  }
  function placePartCard() {
    const card = $("partcard");
    if (card.hidden || !G.sel) return;
    const node = document.querySelector(`[data-part="${G.sel}"]`);
    if (!node) { card.hidden = true; return; }
    const b = node.getBoundingClientRect(), st = $("stage").getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight;
    let x = b.right - st.left + 12, y = b.top - st.top - h - 8;
    if (x + w > st.width - 8) x = b.left - st.left - w - 12;
    if (y < 8) y = b.bottom - st.top + 10;
    card.style.left = `${Math.max(8, x)}px`; card.style.top = `${Math.max(8, y)}px`;
  }

  // After every change: tray counts, the card, the objective.
  function refresh() { if (!lv) return; refreshHotbar(); refreshPartCard(); refreshObjective(); }
  // After the bench is redrawn: marks follow the parts.
  function redrawn() {
    if (!lv) return;
    if (marks) R.marks([].concat(marks).filter((t) => !t.ui));
    placePartCard();
  }
  // Ten times a second from the main loop.
  function tick() { if (!lv) return; refreshObjective(); placePartCard(); follow(); }

  function telemetry() {
    let box = $("telemetry");
    if (box) { box.remove(); return; }
    const tl = BB.Store.get().telemetry || {};
    box = document.createElement("div");
    box.id = "telemetry";
    box.className = "telemetry";
    box.innerHTML = `<h2>Playtest data (this computer only)</h2><table><tr><th>Level</th><th>Attempts</th><th>Time</th><th>Hints</th><th>Slowest step</th></tr>${BB.Levels.all().map((l) => {
      const t = tl[l.id] || {}, last = t.last, slow = last && last.beats.length ? last.beats.reduce((a, b) => (b.t > a.t ? b : a)) : null;
      return `<tr><td>${l.id}</td><td>${t.attempts || 0}</td><td>${last ? `${last.t} s` : "—"}</td><td>${last ? last.hints : "—"}</td><td>${slow ? `${esc(slow.id)} (${slow.t} s)` : "—"}</td></tr>`;
    }).join("")}</table><p>Press \` to close.</p>`;
    document.body.appendChild(box);
  }

  window.addEventListener("resize", () => { if (lv) walk(targetBox()); });

  BB.CoachUI = { get sparkHome() { return atHome; }, setVoice, get voiceOn() { return voiceOn; }, get speaking() { return !!typing; }, stopSpeaking, mood, init, enter, leave, insets, hooks, refresh, redrawn, tick, aside, interject: aside, say };
})(window.BB = window.BB || {});
