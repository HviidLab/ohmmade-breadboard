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
  // The playtest switch (Playtest data → Open all levels): every level is playable; progress is not changed.
  const openAll = () => !!BB.Store.get().settings.openAll;
  // A level is open when it is the first one or the one before it is done (or the playtest switch is on).
  function unlocked(lv, prog = progress(), all_ = openAll()) {
    if (all_) return true;
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
  // Everything behind an open screen is inert: no focus, no clicks, not read out.
  function behind(on, host) { BB.inertAround(host, on); }
  const LABEL = { levelmap: "Level map", complete: "Level complete", pause: "Paused", notebook: "My Notebook", sound: "Sound" };
  function show(id, html, focus) {
    hideAll();
    const host = $(id);
    host.innerHTML = html;
    host.hidden = false;
    host.setAttribute("role", "dialog"); host.setAttribute("aria-modal", "true"); host.setAttribute("aria-label", LABEL[id] || id);
    behind(true, host);
    open = id;
    G.paused = true;
    const f = focus && host.querySelector(focus);
    if (f) f.focus({ preventScroll: true });
    return host;
  }
  function hideAll() {
    for (const id of ["levelmap", "complete", "pause", "notebook"]) $(id).hidden = true;
    BB.Effects.music(false);                    // the chapter screens' tune stops when its screen goes
    open = null;
    behind(false);
  }
  function close() { hideAll(); G.paused = false; }
  const on = (host, sel, fn) => { const b = host.querySelector(sel); if (b) b.addEventListener("click", fn); };
  // A chapter's first level opens with the chapter's opener page the first time (and again from the map).
  function play(lv, skipIntro) {
    const ch = BB.Levels.chapters.find((c) => c.levels[0] === lv);
    if (!skipIntro && ch && ch.intro && !(BB.Store.get().introSeen || []).includes(ch.n)) return opener(ch.n);
    close(); BB.Title.hide(); G.enterLevel(lv);
  }
  // The chapter's opener: what it will answer, its new words, and the earlier ideas it builds on.
  function opener(n, from) {
    const ch = BB.Levels.chapters.find((c) => c.n === n), it = ch.intro, first = ch.levels[0], learned = BB.Store.get().notebook || [];
    const earlier = new Set(BB.Levels.chapters.filter((c) => c.n < n).flatMap((c) => c.levels.flatMap((l) => l.teaches)));
    const knows = [...new Set(ch.levels.flatMap((l) => l.uses))].filter((id) => earlier.has(id)).map((id) => BB.Concepts.get(id));
    BB.Store.update((s) => { s.introSeen = [...new Set([...(s.introSeen || []), n])]; });
    const open_ = unlocked(first);
    const spark = ((BB.CoachUI && BB.CoachUI.SPARK) || "").replace(/id="sp/g, 'id="osp').replace(/url\(#sp/g, "url(#osp");      // his own gradient ids
    const cover = it.cover ? BB.Concepts.get(it.cover) : null;
    const host = show("notebook", `<div class="nb-book opener">
      <div class="op-top"><div class="op-titles"><p class="op-k">Chapter ${n} of ${BB.Levels.chapters.length}</p><h1>${esc(ch.title)}</h1>
        <div class="op-say"><span class="op-spark ts-sparky">${spark}</span><p class="op-bubble">${esc(it.lede)}</p></div></div>
        ${cover ? `<figure class="nb-card op-cover"><span class="nb-art">${BB.NotebookArt.diagram(cover.id)}</span><figcaption>${esc(cover.name)}</figcaption></figure>` : ""}</div>
      <section class="nb-page"><h2 class="nb-ch">In this chapter you find out</h2><ol class="op-q">${it.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ol></section>
      <section class="nb-page"><h2 class="nb-ch">New words</h2><dl class="op-words">${it.words.map((w) => `<div class="op-word">${BB.NotebookArt.symbol(w.sym || w.w[0])}<dt>${esc(w.w)}</dt><dd>${esc(w.d)}</dd></div>`).join("")}</dl></section>
      ${knows.length ? `<section class="nb-page"><h2 class="nb-ch">You already know</h2><ul class="op-knows">${knows.map((c) => `<li class="${learned.includes(c.id) ? "" : "op-new"}">${esc(c.name)}</li>`).join("")}</ul></section>` : ""}
      <div class="scr-row">${open_ ? `<button type="button" class="btn primary" id="op-go">Start ${first.id} · ${esc(first.title)} →</button>` : ""}<button type="button" class="btn" id="op-map">Level map</button></div></div>`,
      open_ ? "#op-go" : "#op-map");
    on(host, "#op-go", () => play(first, true));
    BB.Effects.music(true);
    on(host, "#op-map", () => showMap(n));
  }

  // Notebook cards learned but not looked at yet, for the "new" badges.
  function newCards() { const st = BB.Store.get(); return (st.notebook || []).filter((id) => !(st.nbSeen || []).includes(id)).length; }
  const nbButton = (id) => { const n = newCards(); return `<button type="button" class="btn" id="${id}">Notebook${n ? ` <span class="badge">${n} new</span>` : ""}</button>`; };
  const smooth = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  // A row of chapter numbers that jumps to each chapter on a long screen (the map, the Notebook).
  function chips(prefix, cls = () => "") {
    return `<nav class="lm-chips" aria-label="Go to a chapter"><span>Chapter</span>${BB.Levels.chapters.map((c) =>
      `<button type="button" class="lm-chip${cls(c)}" data-go="${prefix}${c.n}" title="Chapter ${c.n}: ${esc(c.title)}" aria-label="Chapter ${c.n}: ${esc(c.title)}">${c.n}</button>`).join("")}</nav>`;
  }
  function wireChips(host) {
    host.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { const t = host.querySelector(`#${b.dataset.go}`); if (t) t.scrollIntoView({ block: "start", behavior: smooth() }); }));
  }

  // The map. A bar stays on top while it scrolls: the way back, the Notebook, the playtest data and a jump to each
  // chapter. Each chapter shows its progress, Sparky's line from its opener and a button into the opener.
  // It opens at `chapter`, or else at the chapter being played.
  function showMap(chapter) {
    if (typeof chapter !== "number") chapter = undefined;           // a button's click event, when it is the handler
    BB.Title.hide();
    const prog = progress(), s = summary(prog), next = nextLevel(prog), all_ = openAll();
    const done = (l) => !!(prog[l.id] || {}).done;
    const ch = BB.Levels.chapters.map((c) => {
      const n = c.levels.filter(done).length, got = c.levels.reduce((k, l) => k + ((prog[l.id] || {}).stars || 0), 0);
      return `<section class="lm-chapter" id="lm-ch${c.n}"><div class="lm-chead"><h2><span>Chapter ${c.n}</span>${esc(c.title)}</h2>
        <p class="lm-cprog">${n} of ${c.levels.length} levels · ${got} of ${3 * c.levels.length} ★</p>
        ${c.intro ? `<p class="lm-lede">“${esc(c.intro.lede)}”</p><button type="button" class="btn lm-about" data-ch="${c.n}">Chapter intro: questions and new words</button>` : ""}</div>
      <ol class="lm-path">${c.levels.map((lv) => {
        const p = prog[lv.id] || {}, open_ = unlocked(lv, prog, all_), cur = next === lv;
        return `<li><button type="button" class="lm-node${p.done ? " done" : ""}${cur ? " current" : ""}" data-id="${lv.id}" ${open_ ? "" : "disabled"}>
          <span class="lm-n">${lv.id}</span><span class="lm-t">${esc(lv.title)}</span><span class="lm-s" aria-label="${p.stars || 0} of 3 stars">${open_ ? stars(p.stars || 0) : "locked"}</span></button></li>`;
      }).join("")}</ol></section>`;
    }).join("");
    const later = COMING.filter(([n]) => !BB.Levels.chapters.some((c) => c.n === n));
    const host = show("levelmap", `<div class="scr-inner">
      <div class="lm-bar"><div class="lm-bar-row"><button type="button" class="btn" id="lm-title">← Title screen</button>
        <div class="lm-bar-t"><h1>Level map</h1><p class="scr-sub">${s.done} of ${s.total} levels · ${s.stars} of ${3 * s.total} ★${all_ ? ' · <span class="lm-all">All levels open (playtest switch)</span>' : ""}</p></div>
        ${s.done === s.total ? '<button type="button" class="btn primary" id="lm-finale">The finale</button>' : ""}${nbButton("lm-notebook")}<button type="button" class="btn" id="lm-playtest">Playtest data</button></div>
        ${chips("lm-ch", (c) => (c.levels.every(done) ? " done" : "") + (next && next.chapter === c.n ? " current" : ""))}</div>
      ${ch}
      ${later.length ? `<section class="lm-coming"><h2>Coming next</h2><ul>${later.map(([n, t]) => `<li><span>Chapter ${n}</span>${esc(t)}</li>`).join("")}</ul></section>` : ""}</div>`, ".lm-node.current, .lm-node:not([disabled])");
    host.querySelectorAll(".lm-node").forEach((b) => b.addEventListener("click", () => play(BB.Levels.get(b.dataset.id))));
    host.querySelectorAll(".lm-about").forEach((b) => b.addEventListener("click", () => opener(+b.dataset.ch)));
    wireChips(host);
    on(host, "#lm-notebook", () => notebook("map"));
    on(host, "#lm-finale", finale);
    on(host, "#lm-playtest", () => playtest("map"));
    on(host, "#lm-title", () => { hideAll(); BB.Title.show(); });
    const at = host.querySelector(`#lm-ch${chapter || (next ? next.chapter : 1)}`);
    if (at && (chapter || (next && next.chapter > 1))) at.scrollIntoView({ block: "start" });
    try { history.replaceState(null, "", "#map"); } catch (e) { /* ignore */ }
  }

  function complete(lv, res) {
    const all = BB.Levels.all(), next = all[all.findIndex((f) => f.id === lv.id) + 1] || null;
    const concept = lv.teaches.length ? BB.Concepts.get(lv.teaches[0]) : lv.card;
    const lastOfChapter = !next || next.chapter !== lv.chapter;
    const host = show("complete", `<div class="cc-card" role="dialog" aria-labelledby="cc-h">
      <p class="cc-kicker">Level ${lv.id} complete</p><h1 id="cc-h">${esc(lv.title)}</h1>
      <p class="cc-stars" aria-label="${res.stars} of 3 stars">${[0, 1, 2].map((k) => `<span class="${k < res.stars ? "on" : ""}" style="animation-delay:${0.15 + k * 0.18}s">★</span>`).join("")}</p>
      <ul class="cc-bonus"><li class="got">★ Level done</li><li class="${res.clean ? "got" : ""}">${res.clean ? "★" : "☆"} ${esc(BB.Coach.cleanText(lv))}</li>
        ${lv.challenge ? `<li class="${res.challenge ? "got" : ""}">${res.challenge ? "★" : "☆"} ${esc(lv.challenge.text)}</li>` : ""}</ul>
      ${res.stars < 3 ? '<p class="cc-more">Play again to win the missing ★.</p>' : ""}
      ${concept ? `<div class="cc-learned"><p class="cc-lh">What you learned</p>${lv.teaches.length ? `<span class="nb-art">${BB.NotebookArt.diagram(lv.teaches[0])}</span>` : ""}
        <h2>${esc(concept.name)}</h2><p>${esc(concept.text)}</p>${lv.teaches.length ? '<p class="cc-nb">Added to your Notebook</p><span class="cc-stamp">New!</span>' : ""}</div>` : ""}
      ${lastOfChapter ? chapterEnd(lv.chapter, next) : ""}
      <div class="scr-row">${!next ? '<button type="button" class="btn primary" id="cc-finale">The finale →</button>'
        : lastOfChapter ? `<button type="button" class="btn primary" id="cc-next">Start chapter ${next.chapter} →</button><button type="button" class="btn" id="cc-nb">Notebook</button>`
        : '<button type="button" class="btn primary" id="cc-next">Next level →</button>'}
      <button type="button" class="btn" id="cc-again">Play again</button><button type="button" class="btn" id="cc-map">Level map</button></div></div>`, "#cc-next, #cc-finale, #cc-map");
    on(host, "#cc-next", () => play(next));
    on(host, "#cc-finale", finale);
    on(host, "#cc-nb", () => notebook("map", lv.chapter));
    on(host, "#cc-again", () => play(BB.Levels.get(lv.id)));      // a new variant of the same level
    on(host, "#cc-map", showMap);
    BB.Effects.chime && BB.Effects.chime(3);
  }

  // The end of a chapter: its stars, the ideas it added to the Notebook, and what comes next.
  function chapterEnd(n, next) {
    const ch = BB.Levels.chapters.find((c) => c.n === n), prog = progress();
    const got = ch.levels.reduce((k, l) => k + ((prog[l.id] || {}).stars || 0), 0);
    const ideas = ch.levels.flatMap((l) => l.teaches).map((id) => BB.Concepts.get(id).name);
    const nextCh = next && BB.Levels.chapters.find((c) => c.n === next.chapter);
    return `<div class="cc-chapter"><p class="cc-ch-h">Chapter ${n} complete: ${esc(ch.title)}</p>
      <p>${got} of ${3 * ch.levels.length} ★ · ${ideas.length} ideas in your Notebook: ${esc(ideas.join(", "))}.</p>
      ${nextCh ? `<p>Next: Chapter ${nextCh.n}, ${esc(nextCh.title)}.</p>` : ""}</div>`;
  }

  // ---------- the finale, after the last level ----------
  // A recap of the chapters, the stars, a certificate to print (the name stays on this computer), and real next steps.
  function finale() {
    const prog = progress(), s = summary(prog), name = BB.Store.get().settings.certName || "";
    const rows = BB.Levels.chapters.map((c) => `<li><span>Chapter ${c.n}</span>${esc(c.title)}<b>${c.levels.reduce((k, l) => k + ((prog[l.id] || {}).stars || 0), 0)} of ${3 * c.levels.length} ★</b></li>`).join("");
    const host = show("complete", `<div class="cc-card finale" role="dialog" aria-labelledby="fn-h">
      <p class="cc-kicker">All ${s.total} levels done</p><h1 id="fn-h">You built it all</h1>
      <p class="fn-lede">From one closed loop to a night light run by a program. Sparky is proud of you: you think like an electronics engineer now.</p>
      <ol class="fn-recap">${rows}</ol><p class="fn-total">${s.stars} of ${3 * s.total} ★</p>
      <div class="cert" id="cert"><p class="cert-k">Ohmmade Breadboard</p><p class="cert-t">Certificate</p><p>This shows that</p>
        <p class="cert-name" id="cert-name">${esc(name || "…")}</p><p>built and understood every circuit in all ${BB.Levels.chapters.length} chapters,<br>with ${s.stars} of ${3 * s.total} stars.</p>
        <p class="cert-d">${new Date().toISOString().slice(0, 10)}</p></div>
      <div class="scr-row fn-name"><label for="fn-in">Your name for the certificate</label><input id="fn-in" type="text" maxlength="40" value="${esc(name)}" autocomplete="off">
        <button type="button" class="btn" id="fn-print">Print it</button></div>
      <div class="fn-next"><h2>Do it for real</h2>
        <p>A starter kit with: a breadboard (830 holes), a 4 × AA box with a switch, resistors from 100 Ω to 100 kΩ, red, yellow, green and blue LEDs,
        push buttons, a 10 kΩ knob, a light sensor, NPN transistors such as BC547 (legs C, B, E; a 2N2222 has them the other way round, E, B, C: check the datasheet), 100 µF and 1000 µF capacitors rated 16 V or more, jumper wires and a multimeter.</p>
        <p>The controller board showed you its code. Real boards, such as Arduino, run code like those lines; start with the blink and the button programs.</p>
        <p>Keep the Safe bench card in your Notebook close. And the sandbox is always open for new ideas.</p></div>
      <div class="scr-row"><button type="button" class="btn primary" id="fn-sandbox">Open the sandbox</button><button type="button" class="btn" id="fn-nb">Notebook</button>
        <button type="button" class="btn" id="fn-map">Level map</button></div></div>`, "#fn-sandbox");
    const input = host.querySelector("#fn-in");
    input.addEventListener("input", () => { host.querySelector("#cert-name").textContent = input.value || "…"; BB.Store.update((st) => { st.settings.certName = input.value; }); });
    on(host, "#fn-print", () => window.print());
    on(host, "#fn-sandbox", () => { close(); BB.Title.hide(); G.enterSandbox(); });
    on(host, "#fn-nb", () => notebook("finale"));
    on(host, "#fn-map", showMap);
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
      <button type="button" class="btn" id="pz-sound">Sound and volume${sound ? "" : " (off)"}</button>
      <button type="button" class="btn" id="pz-keys">Keys</button>
      <button type="button" class="btn" id="pz-playtest">Playtest data</button>
      <button type="button" class="btn" id="pz-title">Title screen</button></div></div>`, "#pz-resume");
    on(host, "#pz-resume", close);
    on(host, "#pz-restart", () => play(G.level));
    on(host, "#pz-map", showMap);
    on(host, "#pz-notebook", () => notebook("pause"));
    on(host, "#pz-sound", () => soundPanel("pause"));
    on(host, "#pz-playtest", () => playtest("pause"));
    on(host, "#pz-keys", keys);
    on(host, "#pz-title", () => { hideAll(); BB.Title.show(); });
  }

  // Sound and volume: sound on or off, Sparky's voice on or off, and three volumes (all, Sparky's voice, the effects).
  // A slider plays a sample when let go, so the player hears the new level. The settings stay on this computer.
  function soundPanel(from) {
    const v = BB.Effects.volume, on_ = !BB.Effects.muted, voice = BB.CoachUI.voiceOn;
    const slider = (k, label) => `<label class="snd-row"><span>${label}</span><input type="range" min="0" max="100" step="5" id="vol-${k}" value="${Math.round(v[k] * 100)}"
      aria-label="${label}"><output id="vol-${k}-v">${Math.round(v[k] * 100)}%</output></label>`;
    const host = show("pause", `<div class="cc-card pause-card snd-card" role="dialog" aria-labelledby="snd-h"><h1 id="snd-h">Sound and volume</h1>
      <div class="pz-list"><button type="button" class="btn" id="snd-on" aria-pressed="${on_}">Sound: ${on_ ? "on" : "off"}</button>
      <button type="button" class="btn" id="snd-voice" aria-pressed="${voice}">Sparky's voice: ${voice ? "on" : "off"}</button></div>
      <div class="snd-sliders">${slider("master", "Volume")}${slider("voice", "Sparky's voice")}${slider("sfx", "Sound effects")}${slider("music", "Music")}</div>
      <p class="scr-sub">Your computer's own volume works too. These only change the game.</p>
      <div class="scr-row"><button type="button" class="btn primary" id="snd-back">Back</button></div></div>`, "#snd-on");
    const back = () => (from === "pause" ? pause() : (hideAll(), BB.Title.show()));
    on(host, "#snd-back", back);
    on(host, "#snd-on", () => { G.setSound(BB.Effects.muted); soundPanel(from); host.querySelector("#snd-on").focus(); });
    on(host, "#snd-voice", () => { BB.CoachUI.setVoice(!BB.CoachUI.voiceOn); soundPanel(from); host.querySelector("#snd-voice").focus(); });
    for (const k of ["master", "voice", "sfx", "music"]) {
      const inp = host.querySelector(`#vol-${k}`);
      inp.addEventListener("input", () => {
        BB.Effects.setVolume(k, inp.value / 100);
        host.querySelector(`#vol-${k}-v`).textContent = `${inp.value}%`;
        BB.Store.update((s) => { s.settings.vol = BB.Effects.volume; });
      });
      inp.addEventListener("change", () => BB.Effects.sample(k === "voice" || k === "music" ? k : "sfx"));
    }
  }

  // Playing with the keyboard.
  function keys() {
    const row = (k, t) => `<tr><th>${k}</th><td>${t}</td></tr>`;
    const host = show("pause", `<div class="cc-card pause-card" role="dialog" aria-labelledby="ky-h"><h1 id="ky-h">Keys</h1>
      <table class="keys">${[
        row("Tab", "Move between Sparky's buttons, the top buttons, the parts tray, the board and the controls on the parts"),
        row("Enter", "Sparky's Continue; on a tray part: carry it to the board"),
        row("Arrow keys", "On the board: move the cursor from hole to hole (up from the top rail: the controller board's sockets)"),
        row("Enter on the board", "Pick up what is under the cursor (one end of a part, a probe tip) or start a wire; Enter again puts it down"),
        row("1, 2", "Pick up the red or the black probe"),
        row("R · Delete", "Flip · take off the part under the cursor"),
        row("Esc", "Put down nothing (cancel); with nothing carried: the menu"),
        row("Enter, Space", "On a control: use it (dial, socket, switch, button, light sensor, pin)"),
        row("Arrow keys on a knob", "Turn it (Shift: finely)"),
        row("+ · − · F", "Zoom in · out · show the whole level"),
        row("Ctrl+Z", "Undo"),
      ].join("")}</table>
      <div class="scr-row"><button type="button" class="btn primary" id="ky-back">Back</button></div></div>`, "#ky-back");
    on(host, "#ky-back", pause);
  }

  // ---------- the Notebook: an inventor's notebook on graph paper (art style 2) ----------
  // A page per chapter; each idea is a taped card with its drawing. Ideas not learned yet are pencil outlines that say
  // where you will learn them. Cards learned since the last visit carry a "New!" stamp. Click a card to see it large.
  // Always in the Notebook: what is safe in the game is not always safe on a real bench.
  const SAFE = `<section class="nb-page"><h2 class="nb-ch">Safe bench</h2><ol class="nb-grid"><li class="nb-wide"><div class="nb-card nb-safe">
    <h2>Safe here, careful there</h2><p>In the game you can break anything. On a real bench:</p><ul>
    <li>Use AA or AAA alkaline packs, or a controller board on USB. Never mains, and never bare Li-ion or LiPo cells: shorted, they can catch fire.</li>
    <li>Never short a battery: wires and cells get hot enough to burn.</li>
    <li>If a part gets hot or smells, disconnect it, and let it cool before you touch it.</li>
    <li>Electrolytic capacitors: stripe to −, never above the voltage printed on them, and keep your face away when you switch on.</li>
    <li>Every LED gets its resistor, and so does every transistor base and every pin that drives a part.</li>
    <li>Never join the 6 V pack to a controller board's pin: its pins are made for at most 5 V.</li></ul></div></li></ol></section>`;
  const teacher = (id) => BB.Levels.all().find((l) => l.teaches.includes(id));
  function ideaCard(c, isNew) {
    return `${isNew ? '<span class="nb-new">New!</span>' : ""}<span class="nb-art">${BB.NotebookArt.diagram(c.id)}</span>
      <h2>${esc(c.name)}</h2><p>${esc(c.text)}</p>`;
  }
  function notebook(from, chapter) {
    const st = BB.Store.get(), learned = st.notebook || [], seen = st.nbSeen || [];
    const card = (c) => {
      if (!learned.includes(c.id)) { const lv = teacher(c.id); return `<li><div class="nb-card locked"><span class="nb-q">?</span><p>You will learn this in level ${lv ? lv.id : "…"}.</p></div></li>`; }
      return `<li><button type="button" class="nb-card" data-id="${c.id}" aria-label="${esc(c.name)}: open it large">${ideaCard(c, !seen.includes(c.id))}</button></li>`;
    };
    const prog = progress();
    // each chapter's summary card once its last level is done; the circuit symbols at the start of chapter 1
    const summary_ = (ch) => ch.levels.filter((l) => l.card && (prog[l.id] || {}).done).map((l) => `<li class="nb-wide"><div class="nb-card nb-sum"><h2>${esc(l.card.name)}</h2><p>${esc(l.card.text)}</p></div></li>`).join("");
    const symbols = `<li><div class="nb-card nb-sym"><span class="nb-art">${BB.NotebookArt.diagram("symbols")}</span><h2>Circuit symbols</h2>
      <p>Circuit drawings use symbols. The battery's long plate is +; the LED's triangle points the way current flows.</p></div></li>`;
    const pages = BB.Levels.chapters.map((ch) => `<section class="nb-page" id="nb-ch${ch.n}"><h2 class="nb-ch">Chapter ${ch.n} · ${esc(ch.title)}</h2>
      <ol class="nb-grid">${summary_(ch)}${ch.n === 1 ? symbols : ""}${ch.levels.flatMap((l) => l.teaches).map((id) => card(BB.Concepts.get(id))).join("")}</ol></section>`).join("");
    const back = { level: "Back to the level", pause: "Menu", map: "Level map", finale: "Back" }[from] || "Title screen";
    const host = show("notebook", `<div class="nb-book"><div class="nb-bar"><div class="nb-bar-row"><button type="button" class="btn primary" id="nb-back">← ${back}</button>
      <div class="nb-head"><h1>My Notebook</h1><p class="scr-sub">${learned.length} of ${BB.Concepts.LIST.length} ideas learned</p></div></div>${chips("nb-ch")}</div>
      ${SAFE}${pages}</div><div class="nb-zoom" id="nb-zoom" hidden></div>`, "#nb-back");
    wireChips(host);
    on(host, "#nb-back", () => (from === "level" ? (close(), BB.CoachUI.refreshNotebook()) : from === "pause" ? pause() : from === "map" ? showMap() : from === "finale" ? finale() : (hideAll(), BB.Title.show())));
    if (chapter) { const pg = host.querySelector(`#nb-ch${chapter}`); if (pg) pg.scrollIntoView({ block: "start" }); }
    host.querySelectorAll(".nb-card[data-id]").forEach((b) => b.addEventListener("click", () => zoom(host, b.dataset.id)));
    BB.Store.update((s) => { s.nbSeen = learned.slice(); });          // seen now: the stamps go next time
  }
  // One card, large, with a way back into the level that taught it.
  function zoom(host, id) {
    const z = host.querySelector("#nb-zoom"), c = BB.Concepts.get(id), lv = teacher(id);
    z.innerHTML = `<div class="nb-card big" role="dialog" aria-label="${esc(c.name)}">${ideaCard(c, false)}
      <div class="scr-row">${lv ? `<button type="button" class="btn primary" id="nb-play">Play ${lv.id} · ${esc(lv.title)}</button>` : ""}<button type="button" class="btn" id="nb-close">Close</button></div></div>`;
    z.hidden = false;
    const shut = () => { z.hidden = true; z.replaceChildren(); };
    on(z, "#nb-close", shut);
    on(z, "#nb-play", () => play(BB.Levels.get(lv.id)));
    z.addEventListener("click", (e) => { if (e.target === z) shut(); });
    const f = z.querySelector("#nb-close"); if (f) f.focus({ preventScroll: true });
  }

  // ---------- playtest data ----------
  // Per level played: attempts, the last finished attempt, and the last attempt left unfinished (or the one going on now).
  // It stays on this computer; the player copies it to share it.
  function playtestRows() {
    const tl = BB.Store.get().telemetry || {}, now = G.attempt();
    return BB.Levels.all().map((l) => {
      const t = tl[l.id] || {};
      const live = !!now && now.id === l.id;
      return { id: l.id, title: l.title, attempts: t.attempts || 0, reloads: t.reloads || 0, last: t.last || null, open: live ? now : t.unfinished || null, live };
    }).filter((r) => r.attempts);
  }
  const slowest = (beats) => (beats && beats.length ? beats.reduce((a, b) => (b.t > a.t ? b : a)) : null);
  const steps = (beats) => beats.map((b) => `${b.id} ${b.t} s${b.hints ? ` (${b.hints} hint${b.hints > 1 ? "s" : ""})` : ""}`).join(", ");
  function playtestTable() {
    const rows = playtestRows();
    if (!rows.length) return '<p class="scr-sub">No levels played yet.</p>';
    return `<table class="pt-table"><tr><th>Level</th><th>Attempts</th><th>Time</th><th>Hints</th><th>Slowest step</th><th>Left unfinished at</th></tr>${rows.map((r) => {
      const s = slowest(r.last && r.last.beats);
      return `<tr><td>${r.id}</td><td>${r.attempts}${r.reloads ? ` (page reloaded ${r.reloads}×)` : ""}</td><td>${r.last ? `${r.last.t} s` : "—"}</td><td>${r.last ? r.last.hints : "—"}</td>
        <td>${s ? `${esc(s.id)} (${s.t} s)` : "—"}</td><td>${r.open ? `${r.live ? "playing now: " : ""}${esc(r.open.beat)} (after ${r.open.t} s)` : "—"}</td></tr>`;
    }).join("")}</table>`;
  }
  function playtestText() {
    const lines = [`Ohmmade Breadboard playtest data, ${new Date().toISOString().slice(0, 10)}`];
    for (const r of playtestRows()) {
      lines.push(`${r.id} ${r.title}: ${r.attempts} attempt${r.attempts > 1 ? "s" : ""}${r.reloads ? `, page reloaded ${r.reloads} time${r.reloads > 1 ? "s" : ""}` : ""}`);
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
      <label class="pt-switch"><input type="checkbox" id="pt-open"${openAll() ? " checked" : ""}> Open all levels, to try any level without finishing the ones before it. Your progress is not changed.</label>
      <div class="scr-row"><button type="button" class="btn primary" id="pt-copy">Copy</button><button type="button" class="btn" id="pt-back">Back</button>
      <button type="button" class="btn" id="pt-reset">Reset</button><span class="pt-ok" id="pt-ok" role="status"></span></div></div>`, "#pt-copy");
    on(host, "#pt-copy", async () => {
      const ta = host.querySelector(".pt-text"), say = (t) => { host.querySelector("#pt-ok").textContent = t; };
      try { await navigator.clipboard.writeText(ta.value); say("Copied. Paste it into your message."); }
      catch (e) { ta.focus(); ta.select(); say(document.execCommand && document.execCommand("copy") ? "Copied. Paste it into your message." : "Select the text above and copy it."); }
    });
    on(host, "#pt-back", () => (from === "pause" ? pause() : from === "title" ? (hideAll(), BB.Title.show()) : showMap()));
    host.querySelector("#pt-open").addEventListener("change", (e) => {
      BB.Store.update((s) => { if (e.target.checked) s.settings.openAll = true; else delete s.settings.openAll; });
      host.querySelector("#pt-ok").textContent = e.target.checked ? "All levels are open." : "Levels open one by one again.";
    });
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

  // Esc closes the open screen: the pause menu, a large Notebook card, the Notebook or the playtest data (back to where
  // they came from), the level map (to the title screen).
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !open) return;
    const host = $(open), zoomed = host.querySelector(".nb-zoom:not([hidden])");
    const back = zoomed ? zoomed.querySelector("#nb-close") : open === "pause" ? host.querySelector("#ky-back, #snd-back") : host.querySelector("#nb-back, #pt-back, #op-map, #lm-title");
    if (open !== "pause" && !back) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (back) back.click(); else close();
  }, true);

  BB.LevelMap = { play, opener, finale, init, showMap, newCards, soundPanel, complete, pause, notebook, playtest, playtestTable, playtestText, close, hideAll, nextLevel, summary, unlocked, isOpen: () => !!open };
})(window.BB = window.BB || {});
