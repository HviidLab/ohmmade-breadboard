// Boot, game state, editing actions, the animation loop, routing and test hooks.
// Modes: "level" (the teaching levels: full-screen bench, rules, coach), "sandbox" and "mission" (the classic lab layout).
(function (BB) {
  "use strict";
  const R = BB.Render, H = BB.HUD, St = BB.Store;
  const $ = (id) => document.getElementById(id);
  const OK = { ok: true };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const CTL_KEYS = ["on", "pos", "pressed", "lux", "mode", "socket", "pins"];

  function starter() {
    return { parts: [
      { id: "battery1", type: "battery", legs: ["+T3", "-T4"], on: true, bx: -40, by: -175 },
      { id: "meter1", type: "meter", mode: "V", socket: "VO", legs: [null, null], bx: -275, by: 150, loose: [[-140, 95], [-90, 95]] },
    ], nextId: 2 };
  }

  const G = BB.Game = {
    doc: null, sim: null, sel: null, speed: 1, paused: false, seen: 0, mode: "sandbox", trace: [], run: null,
    level: null, rules: null, coach: null,

    redraw() { try { R.drawParts(G.doc, G.sim, G.sel); BB.CoachUI.redrawn(); } catch (err) { BB.reportError(err, "drawing"); } },
    recompile() { G.sim.compile(); G.redraw(); },
    refreshPanels(force) { try { H.partList(G); H.inspector(G, force); BB.CoachUI.refresh(); } catch (err) { BB.reportError(err, "panels"); } },
    save() { if (G.mode !== "sandbox") return; St.update((s) => { s.sandbox = G.doc.serialize(); }); },
    progress() { return St.get().classic || {}; },
    saveProgress(p) { St.update((s) => { s.classic = p; }); },
    hasSavedSandbox() { return !!St.get().sandbox; },
    load(docData) {
      G.doc = new BB.Doc(docData);
      G.sim = new BB.Sim(G.doc);
      G.seen = 0; G.trace = []; G.sel = null;
      document.getElementById("log").replaceChildren();
      G.redraw(); G.refreshPanels(true);
    },

    // ---------- rules (levels only) ----------
    can(act) { return G.rules ? G.rules.can(G, act) : OK; },
    refuse(say) { G.lastRefusal = say; if (G.mode === "level") BB.CoachUI.aside(say, 4000); else H.toast(say, 3000); },
    check(act) { const r = G.can(act); if (!r.ok) G.refuse(r.say); return r.ok; },
    emit(type, data) { if (G.coach) G.coach.emit(type, data); },
    // In early levels a short circuit is undone at once, with a word from Spark.
    guard() {
      if (!G.rules || !G.rules.guardShorts) return;
      G.sim.settle();
      const short = G.doc.parts.some((p) => p.type === "battery" && (G.sim.read(p.id) || {}).short);
      if (short && G.doc.undo()) {
        if (G.sel && !G.doc.get(G.sel)) G.sel = null;
        G.recompile();
        BB.CoachUI.aside(BB.Coach.SHORT, 7000, "bad");
        BB.trail("guard: short circuit undone");
      }
    },

    // ---------- modes ----------
    leaveLevel() {
      if (G.mode !== "level") return;
      G.level = null; G.rules = null; G.coach = null; G.run = null;
      R.region(null); R.guide(null); R.setInsets(null);
      BB.Flow.xray(false);
      BB.CoachUI.leave();
      document.body.classList.remove("mode-level");
    },
    enterLevel(lv) {
      if (G.mode === "sandbox") G.save();
      G.leaveLevel();
      $("mselect").hidden = true;
      G.mode = "level"; G.level = lv; G.paused = false; G.speed = 1;
      document.body.classList.add("mode-level");
      G.rules = new BB.Rules.LevelRules(lv);
      G.coach = null;
      G.load(clone(lv.start));
      G.run = new BB.Goals.Run(lv);
      G.run.goalsOn = false;
      G.coach = new BB.Coach.CoachRun(lv, BB.CoachUI.hooks());
      // Finish waits until the goal is met right now (its short hold then completes the level).
      G.coach.blocked = () => {
        const S = BB.Goals.query(G);
        const now = lv.goals.every((g) => { try { return g.when(S, {}); } catch (e) { return false; } });
        return now || G.run.complete ? null : `First: ${lv.goals[0].text.toLowerCase()}.`;
      };
      St.update((s) => { const t = s.telemetry[lv.id] = s.telemetry[lv.id] || { attempts: 0 }; t.attempts++; });
      R.region(lv.region);
      BB.CoachUI.enter(lv);
      H.toast(null); H.banner("");
      BB.trail(`start level ${lv.id}`);
      G.coach.start();
      G.fitLevel();
      requestAnimationFrame(() => G.fitLevel());
      try { history.replaceState(null, "", `#level-${lv.id}`); } catch (e) { /* ignore */ }
    },
    fitLevel() { if (G.mode !== "level") return; BB.CoachUI.insets(); R.fitBox(...R.regionBox(G.level.region, G.doc)); },
    finishLevel() {
      const lv = G.level, res = G.coach.finish();
      St.update((s) => {
        const old = s.levels[lv.id] || {};
        s.levels[lv.id] = { done: true, stars: Math.max(old.stars || 0, res.stars), bonus: res.bonus.map((b, k) => b || !!(old.bonus && old.bonus[k])) };
        for (const c of lv.teaches) if (!s.notebook.includes(c)) s.notebook.push(c);
        const t = s.telemetry[lv.id] = s.telemetry[lv.id] || { attempts: 1 };
        t.last = { t: +G.coach.t.toFixed(1), hints: G.coach.tele.reduce((n, b) => n + b.hints, 0), beats: G.coach.tele };
      });
      BB.trail(`level ${lv.id} complete, ${res.stars} stars`);
      BB.CoachUI.mood("happy", 2000);
      BB.CoachUI.refresh();
      setTimeout(() => { if (G.level === lv) BB.LevelMap.complete(lv, res); }, 500);
    },
    enterMission(m) {
      if (G.mode === "sandbox") G.save();
      G.leaveLevel();
      G.mode = "mission";
      G.load(clone(m.start));
      G.run = new BB.Goals.Run(m);
      BB.trail("start mission");
      H.toast(null);
      BB.Render.guide(null);
      requestAnimationFrame(() => R.fit(m.view));
      H.log(`Mission ${m.id}: ${m.title}. ${m.brief}`, "", 0);
      try { history.replaceState(null, "", `#mission-${m.id}`); } catch (e) { /* ignore */ }
    },
    enterSandbox(opts = {}) {
      G.leaveLevel();
      G.paused = false;
      if (G.mode !== "sandbox") {
        G.mode = "sandbox"; G.run = null;
        G.load(St.get().sandbox || starter());
        BB.MissionUI.render(true);
        requestAnimationFrame(() => R.fit());
      }
      document.getElementById("mode-missions").setAttribute("aria-pressed", "false");
      document.getElementById("mode-sandbox").setAttribute("aria-pressed", "true");
      try { history.replaceState(null, "", "#sandbox"); } catch (e) { /* ignore */ }
      if (!opts.quiet && !G.hasSavedSandbox()) H.toast("Drag a resistor and a red LED onto the board, and connect them to the battery rails. Then try it without the resistor.", 12000);
    },

    // ---------- editing ----------
    commit() { G.recompile(); G.guard(); G.refreshPanels(true); G.save(); },
    commitSoft() { G.guard(); G.refreshPanels(true); G.save(); },
    edit(fn) { G.doc.snapshot(); fn(); G.commit(); },

    select(id) { G.sel = id; G.redraw(); G.refreshPanels(true); },
    add(part) {
      if (G.rules) {
        const act = part.type === "wire" ? { kind: "wire" } : Object.assign({ kind: "place" }, part);
        if (!G.check(act)) return null;
        const off = part.legs.find((l) => l && !G.rules.inRegion(l));
        if (off) { G.refuse("That part of the board is not open yet."); return null; }
      }
      G.doc.snapshot(); const p = G.doc.add(part); G.sel = p.id; BB.trail(`add ${p.id} ${p.legs.join(" ")}`); G.commit();
      G.emit("place", { id: p.id, type: p.type });
      return p;
    },
    remove(id) {
      if (!G.check({ kind: "remove", id })) return;
      const type = (G.doc.get(id) || {}).type;
      BB.trail(`delete ${id}`); G.edit(() => G.doc.remove(id)); if (G.sel === id) G.select(null);
      G.emit("remove", { id, type });
    },
    set(id, key, value, snapshot = false) {
      const part = G.doc.get(id);
      if (!part || part[key] === value) return;
      if (CTL_KEYS.includes(key) && !G.check({ kind: "ctl", id, ctl: key })) return;
      if (key !== "pos" && key !== "lux") BB.trail(`${id} ${key} = ${value}`);
      if (snapshot) G.doc.snapshot();
      part[key] = value;
      G.recompile();
      if (snapshot) G.commitSoft(); else H.inspector(G);
      G.emit("set", { id, key, value });
    },
    rotate(id) {
      const p = G.doc.get(id);
      if (!p) return;
      if (!G.check({ kind: "flip", id })) return;
      if (p.type === "button") return G.set(id, "pairs", p.pairs === "along" ? "across" : "along", true);
      if (p.type === "battery" || p.type === "meter") return;
      const legs = p.legs.slice().reverse();
      if (G.doc.validate(p.type, legs, id).ok) { G.edit(() => { p.legs = legs; }); G.emit("flip", { id }); }
    },
    nudge(id, dr, dc) {
      const p = G.doc.get(id);
      if (!p || p.type === "meter") return;
      if (!G.check({ kind: "move", id })) return;
      const legs = p.legs.map((pt) => { if (!pt || pt.startsWith("U.")) return pt; const g = BB.Grid.grid(pt); return BB.Grid.point(g.row + dr, g.col + dc); });
      if (G.rules && legs.some((l) => l && !G.rules.inRegion(l))) return;
      if (G.doc.validate(p.type, legs, id).ok) { G.edit(() => { p.legs = legs; }); G.emit("move", { id }); }
    },
    cyclePin(id, pin) {
      const p = G.doc.get(id);
      if (!p) return;
      if (!G.check({ kind: "ctl", id, ctl: "pin" })) return;
      const order = ["INPUT", "LOW", "HIGH"], cur = (p.pins && p.pins[pin]) || "INPUT";
      G.doc.snapshot();
      p.pins = Object.assign({}, p.pins, { [pin]: order[(order.indexOf(cur) + 1) % 3] });
      G.recompile(); G.commitSoft();
    },
    replace(id) {
      if (!G.check({ kind: "replace", id })) return;
      BB.trail(`replace ${id}`);
      const part = G.doc.get(id);
      if (part && part.type === "meter") {      // to change a fuse you take the probes off, so a new fuse does not blow at once
        const bx = part.bx ?? 0, by = part.by ?? 0;
        part.legs = [null, null];
        part.loose = [[bx + 135, by - 55], [bx + 185, by - 55]];
        H.toast("New fuse in. The probes are off the board now: put them back where you want to measure.", 6000);
      }
      G.sim.replace(id); H.log(`${BB.Parts.name(G.doc.get(id))} replaced.`, "good", G.sim.t); G.redraw(); G.refreshPanels(true);
      G.emit("replace", { id });
    },
    undo() { BB.trail("undo"); if (G.doc.undo()) { if (G.sel && !G.doc.get(G.sel)) G.sel = null; G.commit(); G.emit("undo", {}); } },
    redo() { BB.trail("redo"); if (G.doc.redo()) { G.commit(); G.emit("undo", {}); } },
    clear() { G.edit(() => { G.doc.parts = G.doc.parts.filter((p) => p.type === "battery" || p.type === "meter"); }); },
    setSound(on) {
      BB.Effects.setMuted(!on);
      const b = $("sound");
      b.setAttribute("aria-pressed", String(on)); b.textContent = on ? "Sound on" : "Sound off";
      St.update((s) => { s.settings.sound = on; });
    },
  };

  // The last few things the player did, for bug reports.
  const trail = [];
  BB.trail = (text) => {
    const where = G.mode === "level" && G.level ? `level ${G.level.id}` : G.mode === "mission" && G.run ? G.run.m.id : "sandbox";
    trail.push(`${(G.sim ? G.sim.t : 0).toFixed(1)} s ${where}: ${text}`);
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

  // Where a link (game.html#…) should take you.
  function route() {
    const h = location.hash;
    let m;
    if ((m = /^#level-(\d+-\d+)$/.exec(h)) && BB.Levels.get(m[1])) return G.enterLevel(BB.Levels.get(m[1]));
    if (h === "#map") return BB.LevelMap.showMap();
    if ((m = /^#mission-(\w+)$/.exec(h)) && BB.Missions.list.find((x) => x.id === m[1])) return BB.MissionUI.start(BB.Missions.list.find((x) => x.id === m[1]));
    if (h === "#missions" || h === "#classic") return BB.MissionUI.showSelect();
    if (h === "#sandbox") return G.enterSandbox();
    BB.Title.show();
  }

  function boot() {
    R.init($("canvas"));
    BB.Effects.init();
    const saved = St.get().sandbox;
    G.doc = new BB.Doc(saved || starter());
    G.sim = new BB.Sim(G.doc);
    BB.Input.init(G);
    BB.CoachUI.init(G);
    BB.LevelMap.init(G);
    G.redraw(); G.refreshPanels(true);
    requestAnimationFrame(() => { if (G.mode !== "level") R.fit(); });
    window.addEventListener("resize", () => (G.mode === "level" ? G.fitLevel() : R.refit()));
    if (St.get().settings.sound === false) G.setSound(false);

    $("undo").addEventListener("click", G.undo);
    $("redo").addEventListener("click", G.redo);
    $("fit").addEventListener("click", () => R.fitAll());
    $("clear").addEventListener("click", G.clear);
    $("sound").addEventListener("click", (e) => G.setSound(e.currentTarget.getAttribute("aria-pressed") !== "true"));
    $("speed").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      G.speed = +b.dataset.v;
      for (const x of $("speed").querySelectorAll("button")) x.setAttribute("aria-pressed", x === b);
    });
    BB.MissionUI.init(G);
    BB.Title.init(G);
    route();

    let last = performance.now(), hudT = 0;
    function loop(now) {
      requestAnimationFrame(loop);          // schedule first: one bad frame must not stop the game
      try { frame(now); } catch (err) { BB.reportError(err, "simulation frame"); }
    }
    function frame(now) {
      const dtReal = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (G.paused) return;                 // a screen is open over the bench
      const dt = dtReal * G.speed;
      const t0 = performance.now();
      G.sim.advance(dt);
      G.simMs = performance.now() - t0;
      if (G.mode === "mission") BB.MissionUI.step(dt);
      // new failure events
      while (G.seen < G.sim.events.length) {
        const ev = G.sim.events[G.seen++];
        const part = G.doc.get(ev.partId);
        if (part) BB.Effects.burst(part);
        BB.trail(`event: ${ev.kind} ${ev.partId}`);
        if (G.mode === "level" && G.coach) {
          const say = G.coach.simEvent(ev, part);
          if (say) BB.CoachUI.aside(say, 7000, "bad");
          if (ev.kind === "destroyed") BB.CoachUI.mood("worried", 2600);
        } else {
          if (part && part.type === "meter" && ev.kind === "destroyed") H.toast("The meter's fuse blew. Click the meter, then Replace fuse in the Inspector. Move the red lead back to VΩ unless you are measuring current in series.", 9000);
          H.log(ev.text, "bad", ev.t);
          H.toast(ev.text);
        }
        G.redraw(); G.refreshPanels(true);
      }
      if (G.mode === "level" && G.run && G.coach) {
        G.run.goalsOn = G.coach.goalsOn;
        const S = G.run.step(G, dt);
        G.coach.step(S, dt);
        if (G.run.complete && G.coach.done && !G.coach.finished) G.finishLevel();
      }
      BB.Effects.frame(G.doc, G.sim, dtReal);
      BB.Flow.frame(G.doc, G.sim, dtReal * Math.min(G.speed, 1));
      hudT += dtReal;
      if (hudT > 0.1) {
        hudT = 0;
        H.meter(G); H.inspector(G); H.uno(G); BB.MissionUI.render(); BB.CoachUI.tick();
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
        const showBanner = G.mode !== "level" || (G.level && G.level.rules && G.level.rules.banner);
        H.banner(bat && showBanner ? (G.mode === "level" ? "SHORT CIRCUIT" : `SHORT CIRCUIT: ${H.fmtA(G.sim.read(bat.id).I)} from the battery. Remove the wire or add a resistor.`) : "");
        lostCheck();
      }
    }
    // If the battery and meter are both out of view (after panning), say how to get them back.
    let lostShown = false;
    function lostCheck() {
      if (G.mode === "level") return;
      const stage = $("stage").getBoundingClientRect();
      const offs = G.doc.parts.filter((p) => p.type === "battery" || p.type === "meter").map((p) => document.querySelector(`[data-body="${p.id}"]`));
      const gone = offs.length && offs.every((el) => { if (!el) return true; const r = el.getBoundingClientRect(); return r.right < stage.left || r.left > stage.right || r.bottom < stage.top || r.top > stage.bottom; });
      if (gone && !lostShown) { lostShown = true; H.toast("The battery and the meter are out of view. Press F or click Fit to bring everything back.", 6000); }
      if (!gone) lostShown = false;
    }
    requestAnimationFrame(loop);

    // Test hooks (used by the UI tests).
    window.BBGame = {
      G,
      holeClientXY: (h) => { const [x, y] = R.xy(h); return R.toScreen(x, y); },
      state: () => ({
        parts: G.doc.parts.map((p) => ({ id: p.id, type: p.type, legs: p.legs, destroyed: !!(G.sim.rt.get(p.id) || {}).destroyed, read: G.sim.read(p.id) })),
        events: G.sim.events.map((e) => e.text), t: G.sim.t, simMs: G.simMs, mode: G.mode,
        goals: G.run ? G.run.state.map((q) => q.done) : null, complete: G.run ? G.run.complete : null, stars: G.run ? G.run.stars : null,
      }),
      level: () => (G.level ? { id: G.level.id, beat: G.coach.beat && G.coach.beat.id, done: G.coach.done, finished: G.coach.finished, stars: G.coach.stars,
        bonus: G.coach.bonus, complete: G.run.complete, hint: G.coach.hint } : null),
      // One step of a level's scripted solution, done through the same actions the player's clicks use.
      play(st) {
        G.lastRefusal = null;
        const own = (ref) => (G.doc.get(ref) ? ref : ([...G.doc.parts].reverse().find((p) => p.type === ref && G.rules.own(p.id)) || {}).id);
        if (st.next) G.coach.next();
        else if (st.choose !== undefined) G.coach.choose(st.choose);
        else if (st.wire) G.add({ type: "wire", legs: st.wire.slice(), color: R.C.wires[0] });
        else if (st.place) G.add(Object.assign({}, st.place, { legs: st.at.slice() }));
        else if (st.remove) G.remove(own(st.remove));
        else if (st.flip) G.rotate(own(st.flip));
        else if (st.ctl) G.set(st.ctl, "on", G.doc.get(st.ctl).on === false, true);
        else if (st.replace) G.replace(st.replace);
        else if (st.move) { const id = own(st.move); if (G.check({ kind: "move", id })) { G.edit(() => { G.doc.get(id).legs = st.to.slice(); }); G.emit("move", { id }); } }
        return G.lastRefusal;
      },
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(window.BB = window.BB || {});
