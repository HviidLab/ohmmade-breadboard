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
    if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(outgrown)).observe($("mentor"));
    $("mentor-text").addEventListener("click", () => stopSpeaking());     // click the line to see all of it at once
    voiceOn = BB.Store.get().settings.voice !== false;
    $("lv-voice").setAttribute("aria-pressed", String(voiceOn));
    $("lv-undo").addEventListener("click", () => G.undo());
    $("lv-voice").addEventListener("click", () => setVoice(!voiceOn));
    const zoom = (f) => { const r = $("canvas").getBoundingClientRect(); R.zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); };
    $("lv-zin").addEventListener("click", () => zoom(1.2));
    $("lv-zout").addEventListener("click", () => zoom(1 / 1.2));
    $("lv-fit").addEventListener("click", () => G.fitLevel());
    $("lv-pause").addEventListener("click", () => BB.LevelMap.pause());
    $("lv-notebook").addEventListener("click", () => BB.LevelMap.notebook("level"));
    window.addEventListener("keydown", (e) => {
      if (G.mode !== "level" || e.target.matches("input, select, textarea")) return;
      const free = e.target === document.body || !!e.target.closest("#mentor");     // Enter belongs to the focused button, if any
      if (e.key === "Escape" && !G.paused) { e.preventDefault(); BB.LevelMap.pause(); }
      else if (e.key === "Enter" && !G.paused && typing && free) { e.preventDefault(); stopSpeaking(); }
      else if (e.key === "Enter" && !G.paused && $("mentor-next") && free) { e.preventDefault(); $("mentor-next").click(); }
    });
    // Hidden tuning overlay (the backquote key): per level, attempts, time and hints of the last finished attempt.
    // Kept on this computer only; nothing is sent anywhere.
    window.addEventListener("keydown", (e) => { if ((e.key === "`" || e.code === "Backquote") && !e.target.matches("input, select, textarea")) telemetry(); });
  }

  // ---------- entering and leaving a level ----------
  function enter(level) {
    stopSpeaking(); shownParts = []; shownReply = null;
    lv = level; marks = null; partFor = null; lastHotbar = ""; lastObjective = "";
    $("lv").hidden = false;
    $("mentor-text").textContent = "";
    $("mentor-act").replaceChildren();
    aside(null);
    refresh();
    refreshNotebook();
    for (const n of [$("mentor-avatar"), $("mentor")]) n.removeAttribute("style");
    lastBox = null;
    requestAnimationFrame(() => walk(null));
  }
  // The level's Notebook button gets a dot while the Notebook has cards not looked at yet.
  function refreshNotebook() {
    const n = BB.LevelMap.newCards(), b = $("lv-notebook");
    b.classList.toggle("has-new", n > 0);
    b.setAttribute("aria-label", n ? `Notebook, ${n} new` : "Notebook");
  }
  function leave() {
    stopSpeaking(); shownParts = []; shownReply = null;
    lv = null; marks = null;
    $("lv").hidden = true;
    R.marks(null); R.guide(null); spot(null);
    $("partcard").hidden = true;
  }
  const COMPACT = 1150;                     // px: below this the tray turns into an icon strip (game.css)
  // Room the overlays take, so the bench is fitted into the free middle.
  function insets() {
    const st = $("stage").getBoundingClientRect();
    fittedFor = $("mentor").offsetHeight;
    // Sparky stands at the lower left, so the bench keeps to the right of him; the bubble and the tray take the bottom.
    // The bottom keeps extra room for the bubble to grow when a hint is added.
    const bub = $("mentor"), H = st.height, hb = $("hotbar").getBoundingClientRect();      // the bubble's home height, wherever Sparky is now
    const compact = window.innerWidth <= COMPACT;                // a narrow screen: the tray is a strip down the right edge
    const bot = compact ? st.top + H - 18 - bub.offsetHeight : Math.min(st.top + H - 18 - bub.offsetHeight, hb.top);
    const short = window.innerHeight <= 620, ob = $("objective").getBoundingClientRect();        // a short screen: the bench keeps right of the objective card
    R.setInsets({ top: 62, bottom: Math.max(st.bottom - bot + 16, 40), left: Math.max(12 + baseW() + 4, short ? ob.right - st.left + 10 : 0), right: compact ? hb.width + 26 : 12 });   // Sparky's home column
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
    revealMarks();
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
      if (!q) { typing = null; talking(false); revealMarks(); return; }
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
  function setVoice(on) { voiceOn = !!on; BB.Store.update((s) => { s.settings.voice = voiceOn; }); $("lv-voice").setAttribute("aria-pressed", String(voiceOn)); }

  // ---------- the coach's hooks ----------
  // A new line from Sparky. Parts already on screen (the same line with a hint added) stay; new parts are spoken.
  // offer.reply: his answer to an earlier prediction ("Right!" or "Not quite: …"), said first, above the line.
  let shownParts = [], shownReply = null;
  function say(text, offer = {}) {
    const parts = String(text).split("\n");
    const p = $("mentor-text");
    const rp = offer.reply ? offer.reply.text : null;
    const sameReply = rp === shownReply && p.childElementCount > 0;
    const same = (k) => shownParts[k] === parts[k] && (k > 0 || (p.childElementCount > 0 && sameReply));
    p.innerHTML = (rp ? `<span class="reply ${offer.reply.ok ? "ok" : "no"}"></span>` : "") + parts.map((t, k) => (k === 0 ? '<span class="ml"></span>' : `<span class="${t.startsWith("★") ? "star-line" : "hint-line"}"></span>`)).join("")
      + (offer.note ? '<span class="bench-note"></span>' : "");
    const spans = [...p.children], off = rp ? 1 : 0;
    if (!same(0)) { p.classList.remove("pop"); void p.offsetWidth; p.classList.add("pop"); }
    const toSpeak = [];
    if (rp) { if (sameReply) spans[0].textContent = rp; else toSpeak.push({ el: spans[0], text: rp }); }
    parts.forEach((t, k) => { if (same(k)) spans[k + off].textContent = t; else toSpeak.push({ el: spans[k + off], text: t }); });
    if (offer.note) { const n = spans[spans.length - 1]; if (sameReply && same(0)) n.textContent = offer.note; else toSpeak.push({ el: n, text: offer.note }); }
    shownParts = parts; shownReply = rp;
    const all = [rp, ...parts, offer.note && `Real bench: ${offer.note}`].filter(Boolean).join(" ");       // for screen readers: the whole line, once
    if ($("mentor-sr").textContent !== all) $("mentor-sr").textContent = all;
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
  // The holes Sparky has ringed for the red (0) and black (1) probe, if any: a probe dropped near one snaps into it.
  function probeTargets() {
    const out = [null, null];
    for (const t of [].concat(marks || [])) (t.probes || []).forEach((h, k) => { if (h) out[k] = h; });
    return out;
  }
  // Marks wait until Sparky has said his line (or it is skipped), so they never run ahead of his words. While he only
  // explains or asks (opts.look) they are calm outlines; they pulse only when it is the player's turn to act.
  let markWait = false;
  function highlight(targets, opts = {}) {
    marks = targets;
    R.marks((targets && [].concat(targets).filter((t) => !t.ui)) || null);
    const ui = targets && [].concat(targets).find((t) => t.ui);
    spot(ui ? document.querySelector(ui.ui) : null);
    markWait = !!opts.after && !!typing;
    const layer = $("L-coach");
    layer.classList.toggle("look", !!opts.look);
    layer.classList.toggle("waiting", markWait);
    if (spotEl) { spotEl.classList.toggle("look", !!opts.look); spotEl.classList.toggle("spot-wait", markWait); }
    relayout();
  }
  function revealMarks() {
    if (!markWait) return;
    markWait = false;
    $("L-coach").classList.remove("waiting");
    if (spotEl) spotEl.classList.remove("spot-wait");
  }

  // ---------- Sparky points at what he is talking about ----------
  // He stays home (lower left) and points his arm at the marked thing. Only when it is far from him does he walk, and
  // then only to the edge of the bench (above, below or beside it), never onto the board, the objective card, the top
  // buttons or the tray. With no room there, he points from home.
  const AWAY = 0.74;                       // his size away from home
  let lastBox = null, layoutRaf = 0, walkTimer = null, atHome = true;
  const rel = (r, st) => ({ left: r.left - st.left, top: r.top - st.top, right: r.right - st.left, bottom: r.bottom - st.top });
  const grow = (r, m) => ({ left: r.left - m, top: r.top - m, right: r.right + m, bottom: r.bottom + m });
  const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const union = (rs) => ({ left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)), right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)) });
  const baseW = () => Math.min(Math.max(Math.min(window.innerWidth * 0.165, window.innerHeight * 0.3), 130), 240);     // as in game.css

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
  // The open bench on screen (the board's open rows, the battery and the meter), relative to the stage.
  function benchBox(st) {
    const [x0, y0, x1, y1] = R.regionBox(lv.region, G.doc), a = R.toScreen(x0, y0), b = R.toScreen(x1, y1);
    return { left: a[0] - st.left, top: a[1] - st.top, right: b[0] - st.left, bottom: b[1] - st.top };
  }
  const FAR = 0.6;                         // walk only to things more than this share of the screen's width away from home
  function walk(box) {
    lastBox = box;
    const st = $("stage").getBoundingClientRect(), W = st.width, H = st.height, bub = $("mentor");
    const homeW = baseW(), homeH = (homeW * 160) / 120, aim = box ? [(box.left + box.right) / 2, (box.top + box.bottom) / 2] : null;
    if (box && Math.hypot(aim[0] - (12 + homeW / 2), aim[1] - (H - homeH / 2)) > FAR * W) {
      bub.classList.add("away");
      const bw = bub.offsetWidth, bh = bub.offsetHeight, w = baseW() * AWAY, h = (w * 160) / 120, gap = 14;
      const bench = grow(benchBox(st), 6), zone = union([box, bench]);
      const avoid = [grow(box, 12), bench, ...targetBoxes().slice(1).map((r) => grow(r, 6)), ...[$("objective"), $("hotbar"), document.querySelector(".topctl")].filter(Boolean).map((n) => grow(rel(n.getBoundingClientRect(), st), 6))];
      const [cx, cy] = aim;
      const m = 20;                       // his distance from the bench's edge
      const spots = [[cx - w / 2, zone.bottom + m], [cx - w / 2, zone.top - h - m], [zone.right + m, cy - h / 2], [zone.left - m - w, cy - h / 2],
        [zone.right + m, zone.bottom - h], [zone.left - m - w, zone.bottom - h]];
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
    bub.classList.remove("away");                       // home: lower left, full size, bubble beside him, pointing from there
    go({ sx: 12, sy: H - homeH - 10, w: homeW, bx: homeW + 22, by: H - 18 - bub.offsetHeight, side: "right", aim, home: true });
    outgrown();
  }
  // A longer line, an answer, a note or an aside made the bubble at home taller than the room the bench was fitted
  // around, so it would cover the bench: fit the bench again (called on every change of the bubble's size too).
  function outgrown() {
    if (!lv || !atHome) return;
    const st = $("stage").getBoundingClientRect(), bub = $("mentor"), b = rel(bub.getBoundingClientRect(), st);
    const bench = benchBox(st), seen = { left: Math.max(bench.left, 0), top: Math.max(bench.top, 0), right: Math.min(bench.right, st.width), bottom: Math.min(bench.bottom, st.height) };
    if (meets(b, seen) && bub.offsetHeight > fittedFor + 4) { fittedFor = bub.offsetHeight; G.fitLevel(); }
  }
  let fittedFor = 0;                       // the bubble height the bench was last fitted around
  function go(p) {
    const a = $("mentor-avatar"), b = $("mentor"), st = $("stage").getBoundingClientRect(), cur = a.getBoundingClientRect();
    const dx = p.sx - (cur.left - st.left), dist = Math.hypot(dx, p.sy - (cur.top - st.top));
    const dur = !a.style.left || dist < 6 || reduceMotion() ? 0 : Math.min(1.3, Math.max(0.4, dist / 650));
    const tr = dur ? `left ${dur}s ease-in-out, top ${dur}s ease-in-out` : "none";
    a.style.transition = dur ? `${tr}, width ${dur}s ease-in-out` : "none";
    b.style.transition = tr;               // the bubble's width must not animate: Sparky measures it to find a place
    Object.assign(a.style, { left: `${p.sx}px`, top: `${p.sy}px`, width: `${p.w}px`, bottom: "auto" });
    // at home the bubble is anchored by its bottom, so a longer line (an aside, a hint) grows it upwards, never off the screen
    Object.assign(b.style, p.home ? { left: `${p.bx}px`, top: "auto", bottom: "18px" } : { left: `${p.bx}px`, top: `${p.by}px`, bottom: "auto" });
    b.classList.toggle("tail-right", p.side === "left");
    atHome = !!p.home;
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
    if (spotEl) spotEl.classList.remove("spot", "look", "spot-wait");
    spotEl = node;
    if (node) node.classList.add("spot");
  }
  function ghost(parts) {
    R.guide(parts && parts.map((p) => Object.assign({}, p, { id: `ghost-${p.id}` })));
    document.querySelectorAll('[data-id^="ghost-"]').forEach((n) => { n.removeAttribute("data-ctl"); n.removeAttribute("data-id"); });    // a hint's picture is not a control
  }
  function challenge() {
    refreshObjective(true);
    BB.Effects.chime && BB.Effects.chime(1);
    aside(`Challenge done: ${lv.challenge.text} ★`, 4000, "good");
    mood("happy", 1600);
  }
  const hooks = () => ({ say, highlight, ghost, challenge, aside: (t) => aside(t, 6000), beat: () => { G.redraw(); refresh(); } });

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
    const goalDone = G.run.state.map((s) => s.done), C = G.coach, got = !!C && C.challenge, clean = !C || C.clean;
    // while a question is still open, a goal that would give its answer away shows its neutral words (`pre`)
    const asking = !!G.coach && lv.beats.some((b) => b.waitFor.predict && G.coach.pred[b.id] === undefined);
    const key = JSON.stringify([lv.id, goalDone, got, clean, asking]);
    if (!force && key === lastObjective) return;
    lastObjective = key;
    $("objective").innerHTML = `<p class="ob-level">Level ${lv.id}</p><h2>${esc(lv.title)}</h2>
      <ul class="ob-goals">${lv.goals.map((g, k) => `<li class="${goalDone[k] ? "done" : ""}"><span aria-hidden="true">${goalDone[k] ? "✓" : "○"}</span>${esc(asking && g.pre ? g.pre : g.text)}</li>`).join("")}</ul>
      <ul class="ob-bonus"><li class="${clean ? "" : "lost"}"><span aria-hidden="true">${clean ? "☆" : "✗"}</span>${esc(BB.Coach.cleanText(lv))}</li>
      ${lv.challenge ? `<li class="${got ? "got" : ""}"><span aria-hidden="true">${got ? "★" : "☆"}</span>${esc(lv.challenge.text)}</li>` : ""}</ul>`;
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
    const rt = part && G.sim.rt.get(part.id), dead = !!(rt && (rt.destroyed || (part.type === "uno" && BB.Uno.damaged(rt))));
    if (!part || ((part.type === "battery" || part.type === "meter") && !dead)) { card.hidden = true; partFor = null; return; }
    const acts = [];
    if (part.type === "meter" && G.can({ kind: "replace", id: part.id }).ok) acts.push(["New fuse", "fresh", () => G.replace(part.id)]);
    if ((part.type === "led" || part.type === "cap") && G.can({ kind: "flip", id: part.id }).ok) acts.push(["Flip", "flip", () => G.rotate(part.id)]);
    if (dead && part.type !== "meter" && G.can({ kind: "replace", id: part.id }).ok) acts.push([part.type === "uno" ? "Fresh board" : part.type === "battery" ? "Fresh batteries" : "Fresh one", "fresh", () => G.replace(part.id)]);
    if (dead) {                            // the exact reason, with its numbers
      const ev = [...G.sim.events].reverse().find((q) => q.partId === part.id && q.kind === "destroyed");
      if (ev) acts.push(["Why?", "why", () => aside(ev.text, 12000, "bad")]);
    }
    if (part.type !== "meter" && part.type !== "battery" && G.can({ kind: "remove", id: part.id }).ok) acts.push(["Remove", "remove", () => G.remove(part.id)]);
    const key = JSON.stringify([part.id, dead, acts.map((a) => a[1])]);
    if (key !== partFor) {
      partFor = key;
      card.innerHTML = `<p class="pc-name">${esc(BB.Parts.name(part))}${dead ? ` <span class="pc-dead">${part.type === "meter" ? "fuse blown" : part.type === "uno" ? "pin damaged" : part.type === "battery" ? "overheated" : "burned out"}</span>` : ""}</p><div class="pc-act"></div>`;
      const box = card.querySelector(".pc-act");
      for (const [lbl, cls, fn] of acts) { const b = document.createElement("button"); b.type = "button"; b.className = `btn pc-${cls}`; b.textContent = lbl; b.addEventListener("click", fn); box.appendChild(b); }
      if (!acts.length) box.innerHTML = `<span class="pc-fixed">${esc(howTo(part))}</span>`;
    }
    card.hidden = false;
    placePartCard();
  }
  // How the player can use a part here, in a few words (for the part card and the tooltip).
  function howTo(part) {
    const can = (kind) => G.can({ kind, id: part.id, ctl: "use" }).ok;
    if (part.type === "pot" && can("ctl")) return "Drag the knob up or down to turn it";
    if (part.type === "ldr" && can("ctl")) return "Press and hold it to cover it (Shift-click keeps it covered)";
    if (part.type === "button" && can("ctl")) return part.latch ? "Click it to press it down, again to let it up" : "Press it (Shift-click keeps it down)";
    if (part.type === "battery" && can("ctl")) return "Click the switch to turn it on or off";
    if (part.legs.length === 2 && can("legs")) return "Drag an end to move that end";
    if (can("move")) return "Drag it to move it";
    return "Stays as it is in this level";
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
  // What the meter's own note would say (red lead in the wrong socket, OL, Err), said by Sparky once it has lasted a second.
  let meterSaid = null, meterSince = 0;
  function meterNote() {
    const m = G.doc.parts.find((p) => p.type === "meter");
    if (!m || !m.legs[0] || !m.legs[1]) return null;
    const rd = G.sim.read(m.id) || {}, mode = m.mode || "V";
    if (m.socket === "mA" && mode !== "mA" && mode !== "off") return "Careful: the red lead is still in the mA socket, so the meter is almost a wire. Move it back to VΩ.";
    if (rd.display === "OL") return "OL means over the limit: the meter finds no path it can measure between the probes.";
    if (mode === "V" && m.socket === "VO" && BB.HUD.apart(G, m)) return BB.HUD.APART;
    return rd.note || null;
  }
  function meterWatch() {
    const n = meterNote(), now = performance.now();
    if (n !== meterSaid) { meterSaid = n; meterSince = now; return; }
    if (n && meterSince && now - meterSince > 1000) { meterSince = 0; aside(n, 7000); }
  }
  // Ten times a second from the main loop.
  function tick() { if (!lv) return; refreshObjective(); placePartCard(); follow(); meterWatch(); }

  // The playtest data as a small overlay (the backquote key); the pause menu and the map show it in full.
  function telemetry() {
    let box = $("telemetry");
    if (box) { box.remove(); return; }
    box = document.createElement("div");
    box.id = "telemetry";
    box.className = "telemetry";
    box.innerHTML = `<h2>Playtest data (this computer only)</h2>${BB.LevelMap.playtestTable()}<p>Press \` to close. To copy it: Menu → Playtest data.</p>`;
    document.body.appendChild(box);
  }


  BB.CoachUI = { SPARK, refreshNotebook, howTo, relayout, probeTargets, get sparkHome() { return atHome; }, setVoice, get voiceOn() { return voiceOn; }, get speaking() { return !!typing; }, stopSpeaking, mood, init, enter, leave, insets, hooks, refresh, redrawn, tick, aside, interject: aside, say };
})(window.BB = window.BB || {});
