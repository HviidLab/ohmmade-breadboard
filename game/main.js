// Boot, game state, editing actions, the animation loop, routing and test hooks.
// Modes: "level" (the teaching levels: full-screen bench, rules, coach) and "sandbox" (the free bench).
(function (BB) {
  "use strict";
  const R = BB.Render, H = BB.HUD, St = BB.Store;
  const $ = (id) => document.getElementById(id);
  const OK = { ok: true };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const CTL_KEYS = ["on", "pos", "pressed", "lux", "mode", "socket", "pins", "cells"];
  // Sounds of legs going into holes and coming out (see effects.js); a move is out, then in.
  const legsIn = (p) => (p ? p.legs.filter(Boolean).length : 0);
  const sound = {
    in: (p, n = legsIn(p)) => { if (p && n) BB.Effects.insert(p.type, n); },
    out: (p, n = legsIn(p)) => { if (p && n) BB.Effects.extract(p.type, n); },
    move: (p, n = legsIn(p)) => { sound.out(p, n); setTimeout(() => sound.in(p, n), 110); },
  };

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
    hasSavedSandbox() { return !!St.get().sandbox; },
    load(docData) {
      G.doc = new BB.Doc(docData);
      G.sim = new BB.Sim(G.doc);
      G.seen = 0; G.trace = []; G.sel = null;
      BB.Effects.reset();                       // what is already lit on a fresh bench makes no jingle
      document.getElementById("log").replaceChildren();
      G.redraw(); G.refreshPanels(true);
    },

    // ---------- rules (levels only) ----------
    can(act) { return G.rules ? G.rules.can(G, act) : OK; },
    refuse(say) { G.lastRefusal = say; if (G.mode === "level") BB.CoachUI.aside(say, 4000); else H.toast(say, 3000); },
    check(act) { const r = G.can(act); if (!r.ok) G.refuse(r.say); return r.ok; },
    emit(type, data) { if (G.coach) G.coach.emit(type, data); },
    // In early levels a short circuit is undone at once, with a word from Sparky. So is a meter set for mA put
    // where it would blow its fuse, until the level about the fuse.
    guard() {
      if (!G.rules) return;
      if (G.rules.guardMeter && BB.Rules.meterOverload(G.doc, G.sim) && G.doc.undo()) {
        if (G.sel && !G.doc.get(G.sel)) G.sel = null;
        G.recompile();
        BB.CoachUI.aside(BB.Coach.METER, 7000, "bad");
        BB.trail("guard: meter fuse saved");
        return;
      }
      if (!G.rules.guardShorts) return;
      G.sim.settle();
      const short = G.doc.parts.some((p) => p.type === "battery" && (G.sim.read(p.id) || {}).short);
      if (short && G.doc.undo()) {
        setTimeout(() => BB.Effects.extract("wire", 2), 160);        // in… and taken straight back out
        if (G.sel && !G.doc.get(G.sel)) G.sel = null;
        G.recompile();
        BB.CoachUI.aside(BB.Coach.SHORT, 7000, "bad");
        BB.trail("guard: short circuit undone");
      }
    },

    // ---------- modes ----------
    // The attempt going on now, for the playtest data: the steps so far and the one the player is on.
    attempt() {
      const C = G.coach;
      if (G.mode !== "level" || !C || C.finished) return null;
      const beats = C.tele.concat(C.beat ? [{ id: C.beat.id || String(C.i), t: +C.beatT.toFixed(1), hints: C.hint }] : []);
      return { id: G.level.id, beat: C.beat ? C.beat.id || String(C.i) : "finish", t: +C.t.toFixed(1), beats };
    },
    // After the playtest data was reset: the level being played counts as a new attempt from now on.
    restartAttempt() {
      if (G.mode !== "level" || !G.coach) return;
      G.coach.tele = []; G.coach.t = 0; G.coach.beatT = 0;
      St.update((s) => { s.telemetry[G.level.id] = { attempts: 1, seed: G.level.seed }; });
    },
    // An attempt left without finishing (Restart, the map, another level, closing the page) is kept: that is where a player got stuck.
    keepUnfinished() {
      const a = G.attempt();
      if (a && a.t >= 5) St.update((s) => { const t = s.telemetry[a.id] = s.telemetry[a.id] || { attempts: 1 }; t.unfinished = a; });
    },
    leaveLevel() {
      if (G.mode !== "level") return;
      G.keepUnfinished();
      G.level = null; G.rules = null; G.coach = null; G.run = null;
      R.region(null); R.guide(null); R.setInsets(null); R.setCtlLock(null);
      BB.Flow.xray(false);
      BB.CoachUI.leave();
      document.body.classList.remove("mode-level");
    },
    // A level family (from the map, title, Next or Play again) gets a new variant; a level already built
    // (Restart, or a link with a seed) is played again as it is.
    enterLevel(which, seed) {
      const fam = which.instance ? which : BB.Levels.get(which.id);
      if (seed === undefined) seed = which.instance ? BB.Levels.nextSeed(fam, (St.get().variants || {})[fam.id]) : which.seed;
      const lv = fam.instance(seed);
      St.update((s) => { s.variants = s.variants || {}; s.variants[fam.id] = seed; });
      if (G.mode === "sandbox") G.save();
      G.leaveLevel();
      G.mode = "level"; G.level = lv; G.paused = false; G.speed = 1;
      document.body.classList.add("mode-level");
      G.rules = new BB.Rules.LevelRules(lv);
      R.setCtlLock((part, ctl) => ["meter", "uno"].includes(part.type) && ctl !== "program" && !G.can({ kind: "ctl", id: part.id, ctl }).ok);   // dimmed until taught
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
      St.update((s) => { const t = s.telemetry[lv.id] = s.telemetry[lv.id] || { attempts: 0 }; t.attempts++; t.seed = seed; });
      R.region(lv.region);
      BB.CoachUI.enter(lv);
      H.toast(null); H.banner("");
      BB.trail(`start level ${lv.id}`);
      G.coach.start();
      G.fitLevel();
      requestAnimationFrame(() => G.fitLevel());
      try { history.replaceState(null, "", `#level-${lv.id}${seed ? `/${seed}` : ""}`); } catch (e) { /* ignore */ }
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
        delete t.unfinished;
      });
      BB.trail(`level ${lv.id} complete, ${res.stars} stars`);
      BB.CoachUI.mood("happy", 2000);
      BB.CoachUI.refresh();
      setTimeout(() => { if (G.level === lv) BB.LevelMap.complete(lv, res); }, 500);
    },
    enterSandbox(opts = {}) {
      G.leaveLevel();
      G.paused = false;
      if (G.mode !== "sandbox") {
        G.mode = "sandbox"; G.run = null;
        G.load(St.get().sandbox || starter());
        requestAnimationFrame(() => R.fit());
      }
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
      G.doc.snapshot(); const p = G.doc.add(part); G.sel = p.id; BB.trail(`add ${p.id} ${p.legs.join(" ")}`);
      sound.in(p);
      G.commit();
      G.emit("place", { id: p.id, type: p.type });
      return p;
    },
    remove(id) {
      if (!G.check({ kind: "remove", id })) return;
      const type = (G.doc.get(id) || {}).type;
      sound.out(G.doc.get(id));
      BB.trail(`delete ${id}`); G.edit(() => G.doc.remove(id)); if (G.sel === id) G.select(null);
      G.emit("remove", { id, type });
    },
    set(id, key, value, snapshot = false) {
      const part = G.doc.get(id);
      if (!part || part[key] === value) return;
      if (CTL_KEYS.includes(key) && !G.check({ kind: "ctl", id, ctl: key, value })) return;
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
      if (G.doc.validate(p.type, legs, id).ok) { sound.move(p); G.edit(() => { p.legs = legs; }); G.emit("flip", { id }); }
    },
    nudge(id, dr, dc) {
      const p = G.doc.get(id);
      if (!p || p.type === "meter") return;
      if (!G.check({ kind: "move", id })) return;
      const legs = p.legs.map((pt) => { if (!pt || pt.startsWith("U.")) return pt; const g = BB.Grid.grid(pt); return BB.Grid.point(g.row + dr, g.col + dc); });
      if (G.rules && legs.some((l) => l && !G.rules.inRegion(l))) return;
      if (G.doc.validate(p.type, legs, id).ok) { sound.move(p); G.edit(() => { p.legs = legs; }); G.emit("move", { id }); }
    },
    cyclePin(id, pin) {
      const p = G.doc.get(id);
      if (!p) return;
      if (!G.check({ kind: "ctl", id, ctl: `pin:${pin}` })) return;
      const order = G.rules ? G.rules.pinModes(G, id, pin) : ["INPUT", "LOW", "HIGH"], cur = (p.pins && p.pins[pin]) || "INPUT";
      G.doc.snapshot();
      p.pins = Object.assign({}, p.pins, { [pin]: order[(order.indexOf(cur) + 1) % order.length] });
      G.recompile(); G.commitSoft();
      G.emit("set", { id, key: "pins", pin });
    },
    // The next of the level's programs on the board's screen.
    cycleProgram(id) {
      const p = G.doc.get(id), list = (p && p.programs) || [];
      if (!p || !list.length || !G.check({ kind: "ctl", id, ctl: "program" })) return;
      const k = list.findIndex((q) => q.rule === (p.program || {}).rule);
      G.doc.snapshot();
      p.program = Object.assign({}, list[(k + 1) % list.length]);
      G.recompile(); G.commitSoft();
      G.emit("set", { id, key: "program" });
    },
    replace(id) {
      if (!G.check({ kind: "replace", id })) return;
      BB.trail(`replace ${id}`);
      const part = G.doc.get(id);
      if (part && part.type === "meter") {      // to change a fuse you take the probes off, so a new fuse does not blow at once
        const bx = part.bx ?? 0, by = part.by ?? 0, h = R.meterSize()[1];
        part.legs = [null, null];
        part.loose = G.mode === "level" ? [[bx + 95, by + h + 40], [bx + 165, by + h + 40]] : [[bx + 135, by - 55], [bx + 185, by - 55]];
        if (G.mode === "level") BB.CoachUI.aside("New fuse in. The probes are off the board now.", 5000);
        else H.toast("New fuse in. The probes are off the board now: put them back where you want to measure.", 6000);
      }
      if (part && part.type !== "meter") sound.move(part);
      G.sim.replace(id); H.log(`${BB.Parts.name(G.doc.get(id))} replaced.`, "good", G.sim.t); G.redraw(); G.refreshPanels(true);
      G.emit("replace", { id });
    },
    sound,
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
    const where = G.mode === "level" && G.level ? `level ${G.level.id}` : "sandbox";
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
    if ((m = /^#level-(\d+-\d+)(?:\/(\d+))?$/.exec(h)) && BB.Levels.get(m[1])) return G.enterLevel(BB.Levels.get(m[1]), m[2] === undefined ? undefined : +m[2]);
    if (h === "#map") return BB.LevelMap.showMap();
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
    window.addEventListener("pagehide", () => G.keepUnfinished());
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
      if (G.paused) { BB.Effects.hush(); return; }       // a screen is open over the bench: no buzz or hiss behind it
      const dt = dtReal * G.speed;
      const t0 = performance.now();
      G.sim.advance(dt);
      G.simMs = performance.now() - t0;
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
        H.meter(G); H.inspector(G); H.uno(G); BB.CoachUI.tick();
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
      // Does Sparky (or his bubble) cover the open bench: the board's open rows, the battery or the meter?
      sparkyOnBench: () => {
        if (!G.level) return false;
        const [x0, y0, x1, y1] = R.regionBox(G.level.region, G.doc), a = R.toScreen(x0, y0), b = R.toScreen(x1, y1);
        const meets = (r) => r.left < b[0] && a[0] < r.right && r.top < b[1] && a[1] < r.bottom;
        return ["mentor-avatar", "mentor"].filter((id) => meets(document.getElementById(id).getBoundingClientRect()));
      },
      level: () => (G.level ? { id: G.level.id, seed: G.level.seed, layout: G.level.layout, beat: G.coach.beat && G.coach.beat.id, done: G.coach.done, finished: G.coach.finished, stars: G.coach.stars,
        bonus: G.coach.bonus, complete: G.run.complete, hint: G.coach.hint } : null),
      // One step of a level's scripted solution, done through the same actions the player's clicks use.
      play(st) {
        G.lastRefusal = null;
        const own = (ref) => (G.doc.get(ref) ? ref : ([...G.doc.parts].reverse().find((p) => p.type === ref && G.rules.own(p.id)) || {}).id);
        const meter = () => (G.doc.parts.find((p) => p.type === "meter") || {}).id;
        if (st.next) G.coach.next();
        else if (st.choose !== undefined) G.coach.choose(st.choose === "right" ? G.coach.beat.predict.answer : st.choose);
        else if (st.wire) G.add({ type: "wire", legs: st.wire.slice(), color: R.C.wires[0] });
        else if (st.place) G.add(Object.assign({}, st.place, { legs: st.at.slice() }));
        else if (st.remove) G.remove(own(st.remove));
        else if (st.flip) G.rotate(own(st.flip));
        else if (st.ctl) G.set(st.ctl, "on", G.doc.get(st.ctl).on === false, true);
        else if (st.cells) G.set(st.cells, "cells", (G.doc.get(st.cells).cells || 4) === 4 ? 2 : 4, true);
        else if (st.knob) { G.set(own(st.knob), "pos", st.pos); G.commitSoft(); }
        else if (st.cover) G.set(own(st.cover), "lux", st.on === false ? 200 : 1, true);
        else if (st.program) { const id = G.doc.parts.find((p) => p.type === "uno").id; for (let k = 0; k < 4 && (G.doc.get(id).program || {}).rule !== st.program; k++) G.cycleProgram(id); }
        else if (st.pin) { const id = G.doc.parts.find((p) => p.type === "uno").id; for (let k = 0; k < 3 && ((G.doc.get(id).pins || {})[st.pin] || "INPUT") !== st.mode; k++) G.cyclePin(id, st.pin); }
        else if (st.press) { const id = own(st.press), b = G.doc.get(id); G.set(id, "pressed", st.on ?? !b.pressed, true); }
        else if (st.replace) G.replace(st.replace);
        else if (st.move) { const id = own(st.move); if (G.check({ kind: "move", id })) { G.edit(() => { G.doc.get(id).legs = st.to.slice(); }); G.emit("move", { id }); } }
        else if (st.dial) G.set(meter(), "mode", st.dial, true);
        else if (st.socket) G.set(meter(), "socket", st.socket, true);
        else if (st.probe) {                     // both probe tips at once: [red, black], null = off the board
          const id = meter();
          if (G.check({ kind: "probe", id }) && st.probe.every((h) => !h || G.check({ kind: "hole", hole: h }))) {
            G.doc.snapshot(); const m = G.doc.get(id); m.legs = st.probe.slice(); m.loose = [null, null];
            G.recompile(); G.commitSoft(); G.emit("probe", { id });
          }
        }
        return G.lastRefusal;
      },
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(window.BB = window.BB || {});
