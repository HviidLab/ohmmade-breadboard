// Boot, game state, editing actions, the animation loop, storage and test hooks.
(function (BB) {
  "use strict";
  const R = BB.Render, H = BB.HUD;
  const $ = (id) => document.getElementById(id);
  const STORE = "bbgame.v1";

  const store = {
    mem: {},
    get() { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { return this.mem; } },
    put(obj) { this.mem = obj; try { localStorage.setItem(STORE, JSON.stringify(obj)); } catch (e) { /* storage blocked: keep in memory */ } },
  };

  function starter() {
    return { parts: [
      { id: "battery1", type: "battery", legs: ["+T3", "-T4"], on: true, bx: -40, by: -175 },
      { id: "meter1", type: "meter", mode: "V", socket: "VO", legs: [null, null], bx: -275, by: 150, loose: [[-140, 95], [-90, 95]] },
    ], nextId: 2 };
  }

  const G = BB.Game = {
    doc: null, sim: null, sel: null, speed: 1, seen: 0, mode: "sandbox", trace: [], run: null,

    redraw() { try { R.drawParts(G.doc, G.sim, G.sel); } catch (err) { BB.reportError(err, "drawing"); } },
    recompile() { G.sim.compile(); G.redraw(); },
    refreshPanels(force) { try { H.partList(G); H.inspector(G, force); } catch (err) { BB.reportError(err, "panels"); } },
    save() { if (G.mode !== "sandbox") return; const s = store.get(); s.sandbox = G.doc.serialize(); store.put(s); },
    progress() { return store.get().missions || {}; },
    saveProgress(p) { const s = store.get(); s.missions = p; store.put(s); },
    load(docData) {
      G.doc = new BB.Doc(docData);
      G.sim = new BB.Sim(G.doc);
      G.seen = 0; G.trace = []; G.sel = null;
      document.getElementById("log").replaceChildren();
      G.redraw(); G.refreshPanels(true);
    },
    enterMission(m) {
      if (G.mode === "sandbox") G.save();
      G.mode = "mission";
      G.load(JSON.parse(JSON.stringify(m.start)));
      G.run = new BB.Goals.Run(m);
      BB.trail("start mission");
      H.toast(null);
      BB.Render.guide(null);
      requestAnimationFrame(() => R.fit(m.view));
      H.log(`Mission ${m.id}: ${m.title}. ${m.brief}`, "", 0);
      try { history.replaceState(null, "", `#mission-${m.id}`); } catch (e) { /* ignore */ }
    },
    enterSandbox() {
      if (G.mode === "sandbox") return;
      G.mode = "sandbox"; G.run = null;
      G.load(store.get().sandbox || starter());
      BB.MissionUI.render(true);
      document.getElementById("mode-missions").setAttribute("aria-pressed", "false");
      document.getElementById("mode-sandbox").setAttribute("aria-pressed", "true");
      R.fit();
      try { history.replaceState(null, "", "#sandbox"); } catch (e) { /* ignore */ }
    },
    commit() { G.recompile(); G.refreshPanels(true); G.save(); },
    commitSoft() { G.refreshPanels(true); G.save(); },
    edit(fn) { G.doc.snapshot(); fn(); G.commit(); },

    select(id) { G.sel = id; G.redraw(); G.refreshPanels(true); },
    add(part) { G.doc.snapshot(); const p = G.doc.add(part); G.sel = p.id; BB.trail(`add ${p.id} ${p.legs.join(" ")}`); G.commit(); return p; },
    remove(id) { BB.trail(`delete ${id}`); G.edit(() => G.doc.remove(id)); if (G.sel === id) G.select(null); },
    set(id, key, value, snapshot = false) {
      const part = G.doc.get(id);
      if (!part || part[key] === value) return;
      if (key !== "pos" && key !== "lux") BB.trail(`${id} ${key} = ${value}`);
      if (snapshot) G.doc.snapshot();
      part[key] = value;
      G.recompile();
      if (snapshot) G.commitSoft(); else H.inspector(G);
    },
    rotate(id) {
      const p = G.doc.get(id);
      if (!p) return;
      if (p.type === "button") return G.set(id, "pairs", p.pairs === "along" ? "across" : "along", true);
      if (p.type === "battery" || p.type === "meter") return;
      const legs = p.legs.slice().reverse();
      if (G.doc.validate(p.type, legs, id).ok) G.edit(() => { p.legs = legs; });
    },
    nudge(id, dr, dc) {
      const p = G.doc.get(id);
      if (!p || p.type === "meter") return;
      const legs = p.legs.map((pt) => { if (!pt || pt.startsWith("U.")) return pt; const g = BB.Grid.grid(pt); return BB.Grid.point(g.row + dr, g.col + dc); });
      if (G.doc.validate(p.type, legs, id).ok) G.edit(() => { p.legs = legs; });
    },
    cyclePin(id, pin) {
      const p = G.doc.get(id);
      if (!p) return;
      const order = ["INPUT", "LOW", "HIGH"], cur = (p.pins && p.pins[pin]) || "INPUT";
      G.doc.snapshot();
      p.pins = Object.assign({}, p.pins, { [pin]: order[(order.indexOf(cur) + 1) % 3] });
      G.recompile(); G.commitSoft();
    },
    replace(id) {
      BB.trail(`replace ${id}`);
      const part = G.doc.get(id);
      if (part && part.type === "meter") {      // to change a fuse you take the probes off, so a new fuse does not blow at once
        const bx = part.bx ?? 0, by = part.by ?? 0;
        part.legs = [null, null];
        part.loose = [[bx + 135, by - 55], [bx + 185, by - 55]];
        H.toast("New fuse in. The probes are off the board now: put them back where you want to measure.", 6000);
      }
      G.sim.replace(id); H.log(`${BB.Parts.TYPES[G.doc.get(id).type].label} replaced.`, "good", G.sim.t); G.redraw(); G.refreshPanels(true); },
    undo() { BB.trail("undo"); if (G.doc.undo()) { if (G.sel && !G.doc.get(G.sel)) G.sel = null; G.commit(); } },
    redo() { BB.trail("redo"); if (G.doc.redo()) G.commit(); },
    clear() { G.edit(() => { G.doc.parts = G.doc.parts.filter((p) => p.type === "battery" || p.type === "meter"); }); },
  };

  // The last few things the player did, for bug reports.
  const trail = [];
  BB.trail = (text) => {
    trail.push(`${(G.sim ? G.sim.t : 0).toFixed(1)} s ${G.mode === "mission" && G.run ? G.run.m.id : "sandbox"}: ${text}`);
    if (trail.length > 12) trail.shift();
  };

  // Show unexpected errors instead of failing silently, so they can be reported.
  // The first error is usually the cause, so it stays on top; later ones are listed below it.
  const seenErrors = new Set(), shown = [];
  BB.reportError = (err, where) => {
    const msg = `${where}: ${err && err.message ? err.message : err}`;
    console.error(msg, err);
    if (seenErrors.has(msg)) return;
    seenErrors.add(msg);
    if (shown.length < 4) shown.push(`${msg}\n${(err && err.stack || "").split("\n").slice(0, 4).join("\n")}`);
    const bar = $("errbar");
    if (!bar) return;
    bar.hidden = false;
    bar.querySelector("code").textContent = `${shown.join("\n\n")}\n\nLast actions:\n${trail.join("\n")}`;
  };
  window.addEventListener("error", (e) => BB.reportError(e.error || e.message, "page"));

  function boot() {
    R.init($("canvas"));
    BB.Effects.init();
    const saved = store.get().sandbox;
    G.doc = new BB.Doc(saved || starter());
    G.sim = new BB.Sim(G.doc);
    BB.Input.init(G);
    G.redraw(); G.refreshPanels(true);
    requestAnimationFrame(() => R.fit());
    window.addEventListener("resize", () => R.refit());

    $("undo").addEventListener("click", G.undo);
    $("redo").addEventListener("click", G.redo);
    $("fit").addEventListener("click", () => R.fitAll());
    $("clear").addEventListener("click", G.clear);
    $("sound").addEventListener("click", (e) => {
      const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
      e.currentTarget.setAttribute("aria-pressed", on);
      e.currentTarget.textContent = on ? "Sound on" : "Sound off";
      BB.Effects.setMuted(!on);
    });
    $("speed").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      G.speed = +b.dataset.v;
      for (const x of $("speed").querySelectorAll("button")) x.setAttribute("aria-pressed", x === b);
    });
    BB.MissionUI.init(G);
    const hm = /^#mission-(\w+)$/.exec(location.hash);
    const hmission = hm && BB.Missions.list.find((m) => m.id === hm[1]);
    if (hmission) BB.MissionUI.start(hmission);
    else if (location.hash === "#missions") BB.MissionUI.showSelect();
    else if (!saved) H.toast("Drag a resistor and a red LED onto the board, and connect them to the battery rails. Then try it without the resistor.", 12000);

    let last = performance.now(), hudT = 0;
    function loop(now) {
      requestAnimationFrame(loop);          // schedule first: one bad frame must not stop the game
      try { frame(now); } catch (err) { BB.reportError(err, "simulation frame"); }
    }
    function frame(now) {
      const dtReal = Math.min((now - last) / 1000, 0.1);
      last = now;
      const t0 = performance.now();
      G.sim.advance(dtReal * G.speed);
      G.simMs = performance.now() - t0;
      BB.MissionUI.step(dtReal * G.speed);
      // new failure events
      while (G.seen < G.sim.events.length) {
        const ev = G.sim.events[G.seen++];
        const part = G.doc.get(ev.partId);
        if (part) BB.Effects.burst(part);
        if (part && part.type === "meter" && ev.kind === "destroyed") H.toast("The meter's fuse blew. Click the meter, then Replace fuse in the Inspector. Move the red lead back to VΩ unless you are measuring current in series.", 9000);
        BB.trail(`event: ${ev.kind} ${ev.partId}`);
        H.log(ev.text, "bad", ev.t);
        H.toast(ev.text);
        G.redraw(); G.refreshPanels(true);
      }
      BB.Effects.frame(G.doc, G.sim, dtReal);
      hudT += dtReal;
      if (hudT > 0.1) {
        hudT = 0;
        H.meter(G); H.inspector(G); H.uno(G); BB.MissionUI.render();
        const m = G.doc.parts.find((q) => q.type === "meter");
        if (m) {
          const rd = G.sim.read(m.id), scale = rd.mode === "mA" ? 1000 : 1;
          const unit = { V: "V", mA: "mA", ohm: "Ω", cont: "Ω" }[rd.mode] || "";
          if (G.trace.unit !== unit) { G.trace.length = 0; G.trace.unit = unit; }
          G.trace.push({ t: G.sim.t, v: rd.display || rd.value === undefined ? NaN : rd.value * scale });
          if (G.trace.length > 2000) G.trace.splice(0, G.trace.length - 2000);
          H.trace(G.trace, G.sim.t);
        }
        $("clock").textContent = `${G.sim.t.toFixed(1)} s`;
        const bat = G.doc.parts.find((p) => p.type === "battery" && G.sim.read(p.id) && G.sim.read(p.id).short);
        H.banner(bat ? `SHORT CIRCUIT: ${H.fmtA(G.sim.read(bat.id).I)} from the battery. Remove the wire or add a resistor.` : "");
        lostCheck();
      }
    }
    // If the battery and meter are both out of view (after panning), say how to get them back.
    let lostShown = false;
    function lostCheck() {
      const stage = $("stage").getBoundingClientRect();
      const offs = G.doc.parts.filter((p) => p.type === "battery" || p.type === "meter").map((p) => document.querySelector(`[data-body="${p.id}"]`));
      const gone = offs.length && offs.every((el) => { if (!el) return true; const r = el.getBoundingClientRect(); return r.right < stage.left || r.left > stage.right || r.bottom < stage.top || r.top > stage.bottom; });
      if (gone && !lostShown) { lostShown = true; H.toast("The battery and the meter are out of view. Press F or click Fit to bring everything back.", 6000); }
      if (!gone) lostShown = false;
    }
    requestAnimationFrame(loop);

    // Test hooks (used by run_tests.py --ui).
    window.BBGame = {
      G,
      holeClientXY: (h) => { const [x, y] = R.xy(h); return R.toScreen(x, y); },
      state: () => ({
        parts: G.doc.parts.map((p) => ({ id: p.id, type: p.type, legs: p.legs, destroyed: !!(G.sim.rt.get(p.id) || {}).destroyed, read: G.sim.read(p.id) })),
        events: G.sim.events.map((e) => e.text), t: G.sim.t, simMs: G.simMs, mode: G.mode,
        goals: G.run ? G.run.state.map((q) => q.done) : null, complete: G.run ? G.run.complete : null, stars: G.run ? G.run.stars : null,
      }),
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(window.BB = window.BB || {});
