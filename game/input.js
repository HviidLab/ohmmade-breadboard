// Input: pointer state machine for the workbench, plus keyboard shortcuts.
(function (BB) {
  "use strict";
  const R = BB.Render, Gr = BB.Grid;
  const SNAP = 13;   // screen pixels
  const EDGE = 32;   // screen pixels: pausing this close to the stage edge while dragging scrolls the bench
  const EDGE_WAIT = 350;   // ms in the edge band before scrolling starts, so a drop near the edge stays put
  let G, svg, st = null, wireColor = 0, floater, lastPtr = null, edgeRaf = 0;

  function holeUnder(cx, cy) {
    if (!inStage(cx, cy)) return null;     // holes hidden behind the side panels or the level's overlays are out of reach
    const [wx, wy] = R.toWorld(cx, cy), rad = SNAP / R.view.k;
    const h = R.holeAt(wx, wy, rad);
    if (h && G.rules && !G.rules.inRegion(h)) return null;      // closed part of the board in this level
    if (h || !BB.Uno.present) return h;
    const sk = BB.Uno.socketAt(wx, wy, rad);
    return sk && BB.Uno.usable(sk) ? sk : null;
  }

  function init(game) {
    G = game;
    svg = document.getElementById("canvas");
    const safe = (fn, where) => (e) => { try { fn(e); } catch (err) { st = null; BB.reportError(err, where); } };
    svg.addEventListener("pointerdown", safe(down, "pointer down"));
    window.addEventListener("pointermove", safe(move, "pointer move"));
    window.addEventListener("pointerup", safe(up, "pointer up"));
    svg.addEventListener("wheel", (e) => { e.preventDefault(); R.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    svg.addEventListener("pointerleave", () => { if (!st) { BB.HUD.tooltip(null); R.highlight(null); } });
    window.addEventListener("keydown", key);
    floater = document.createElement("div");
    floater.className = "drag-float"; floater.hidden = true;
    document.body.appendChild(floater);
    BB.HUD.buildDrawer(startNew);
  }

  // ---------- keeping the dragged thing visible ----------
  function inStage(cx, cy) {
    const r = svg.getBoundingClientRect();
    if (!(cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom)) return false;
    if (G.mode !== "level") return true;
    const top = document.elementFromPoint(cx, cy);         // the level's cards and bars sit on top of the bench
    return !top || !!top.closest("#canvas") || !!top.closest(".drag-float");
  }
  const overHotbar = (cx, cy) => { const t = document.elementFromPoint(cx, cy); return !!t && !!t.closest("#hotbar"); };
  // While a part that may come off the board is dragged, the level's parts tray shows itself as a drop zone.
  function trayState(state) {
    const hb = document.getElementById("hotbar");
    if (!hb) return;
    hb.classList.toggle("drop-ready", state === "ready" || state === "over");
    hb.classList.toggle("drop-over", state === "over");
  }
  // The drawer picture, following the pointer (over the drawer, or for parts that have no board ghost).
  function float(type, cx, cy, color) {
    if (!type) { floater.hidden = true; floater.dataset.type = ""; return; }
    const col = color || (st && st.d && st.d.color) || BB.HUD.defaults.ledColor;
    const key = type === "led" ? `led:${col}` : type;
    if (floater.dataset.type !== key) { floater.innerHTML = BB.HUD.icon(type, type === "led" ? R.LEDC[col].icon : null); floater.dataset.type = key; }
    floater.style.left = `${cx - 44}px`; floater.style.top = `${cy - 28}px`;
    floater.hidden = false;
  }
  // World points for legs laid out like `legs`, moved so that leg k sits at the world point (wx, wy).
  function freePts(legs, k, wx, wy) {
    if (!legs || !legs[k] || !legs.every(Boolean)) return null;
    const [x0, y0] = R.xy(legs[k]);
    return legs.map((l) => { const [x, y] = R.xy(l); return [wx + x - x0, wy + y - y0]; });
  }
  // Dragging near the stage edge scrolls the bench, so far rows are in reach.
  // It starts only after the pointer has been well inside the stage, so a part dragged in from the drawer does not scroll.
  function edgeTick() {
    edgeRaf = 0;
    if (!st || !lastPtr || !["new", "wire", "move", "leg", "probe", "body"].includes(st.kind)) return;
    const r = svg.getBoundingClientRect(), x = lastPtr.clientX, y = lastPtr.clientY;
    if (!inStage(x, y)) return;
    const dl = x - r.left, dr = r.right - x, dt = y - r.top, db = r.bottom - y;
    if (!st.armed) { if (Math.min(dl, dr, dt, db) > EDGE) st.armed = true; return; }
    const sp = (d) => (d < EDGE ? Math.ceil(((EDGE - d) / EDGE) * 12) : 0);
    let dx = sp(dl) - sp(dr), dy = sp(dt) - sp(db);
    if (!dx && !dy) { st.edgeSince = null; return; }
    const now = performance.now();
    if (st.edgeSince == null) st.edgeSince = now;
    if (now - st.edgeSince < EDGE_WAIT) { edgeRaf = requestAnimationFrame(edgeTick); return; }
    const boost = 1 + Math.min(2, (now - st.edgeSince - EDGE_WAIT) / 600);   // speeds up while you hold
    dx = Math.round(dx * boost); dy = Math.round(dy * boost);
    // stop once the far edge of the board (or of the parts) is in view
    const c = R.contentBox(st.id), [x0, y0] = R.toScreen(c[0], c[1]), [x1, y1] = R.toScreen(c[2], c[3]), m = 40;
    if (dx > 0) dx = Math.max(0, Math.min(dx, r.left + m - x0));
    if (dx < 0) dx = Math.min(0, Math.max(dx, r.right - m - x1));
    if (dy > 0) dy = Math.max(0, Math.min(dy, r.top + m - y0));
    if (dy < 0) dy = Math.min(0, Math.max(dy, r.bottom - m - y1));
    if (dx || dy) { R.pan(dx, dy); move(lastPtr); }   // the bench moved under a still pointer
  }

  // ---------- starting gestures ----------
  function startNew(d, e) {
    BB.Effects.unlock();
    if (d.type === "meter" && G.doc.parts.some((p) => p.type === "meter")) { BB.HUD.toast("There is already a multimeter on the bench."); return; }
    if (d.type === "uno" && G.doc.parts.some((p) => p.type === "uno")) { BB.HUD.toast("There is already a controller board on the bench."); return; }
    if (G.rules && !G.check(d.type === "wire" ? { kind: "wire" } : Object.assign({ kind: "place" }, d))) return;
    st = { kind: "new", d, legs: null, ok: false, x: e ? e.clientX : 0, y: e ? e.clientY : 0 };
    if (!e) { // keyboard: drop near the middle of the visible board
      const r = svg.getBoundingClientRect();
      st.x = r.left + r.width / 2; st.y = r.top + r.height / 2;
      preview(st.x, st.y); finish(); return;
    }
  }

  function down(e) {
    BB.Effects.unlock();
    if (e.button === 1 || (e.button === 0 && e.getModifierState && e.getModifierState(" "))) return startPan(e);
    if (e.button !== 0) return;
    const t = e.target, at = (sel) => t.closest(sel);
    const [wx, wy] = R.toWorld(e.clientX, e.clientY);
    let n;
    if ((n = at("[data-ctl]"))) {
      const id = n.dataset.id, ctl = n.dataset.ctl, part = G.doc.get(id);
      G.select(id);
      if (!G.check({ kind: "ctl", id, ctl })) { capture(e); return; }
      if (ctl === "switch") G.set(id, "on", part.on === false, true);
      else if (ctl === "cells") G.set(id, "cells", (part.cells || 4) === 4 ? 2 : 4, true);      // two cells in or out: 3 V ↔ 6 V
      else if (ctl.startsWith("mode:")) G.set(id, "mode", ctl.slice(5), true);
      else if (ctl.startsWith("socket:")) G.set(id, "socket", ctl.slice(7), true);
      else if (ctl === "press") {                      // held down while the mouse is; Shift-click, or a latching button, stays down
        if (e.shiftKey || part.latch) G.set(id, "pressed", !part.pressed, true); else { G.set(id, "pressed", true); st = { kind: "press", id }; }
      }
      else if (ctl === "knob") st = { kind: "knob", id, y: e.clientY, pos0: part.pos ?? 0.5 };
      else if (ctl === "cover") {                      // the light sensor: covered while held (Shift-click: stays covered)
        const room = part.room ?? 200;
        if (e.shiftKey) G.set(id, "lux", (part.lux ?? room) <= 5 ? room : 1, true);
        else { part.room = part.lux > 5 ? part.lux : room; G.set(id, "lux", 1, true); st = { kind: "cover", id }; }
      }
      else if (ctl.startsWith("pin:")) G.cyclePin(id, ctl.slice(4));
      else if (ctl === "program") G.cycleProgram(id);
      capture(e); return;
    }
    if ((n = at("[data-probe]"))) { const id = n.dataset.id; G.select(id); if (!G.check({ kind: "probe", id })) return; G.doc.snapshot(); st = { kind: "probe", id, k: +n.dataset.probe, was: (G.doc.get(id).legs || [])[+n.dataset.probe] || null }; capture(e); return; }
    if ((n = at("[data-handle]"))) { const id = n.dataset.id; G.select(id); if (!G.check({ kind: "legs", id })) return; st = { kind: "leg", id, k: +n.dataset.handle, legs: null, ok: false }; capture(e); return; }
    // board header sockets: drawing a wire wins over dragging the board
    const sk = at("[data-body]") && holeUnder(e.clientX, e.clientY);
    if (sk && sk.startsWith("U.") && !G.doc.occupancy().has(sk)) { st = { kind: "wire", from: sk, to: null }; G.select(null); capture(e); return; }
    if ((n = at("[data-body]"))) {
      const id = n.dataset.body, part = G.doc.get(id);
      G.select(id); G.doc.snapshot();
      st = { kind: "body", id, dx: wx - (part.bx ?? 0), dy: wy - (part.by ?? 0), x: e.clientX, y: e.clientY };
      capture(e); return;
    }
    if ((n = at("[data-part]"))) {
      const id = n.dataset.part, part = G.doc.get(id);
      G.select(id);
      const canMove = G.can({ kind: "move", id }).ok, canRemove = G.mode === "level" && G.can({ kind: "remove", id }).ok;
      if (!canMove && !canRemove) { st = { kind: "fixed", id, x: e.clientX, y: e.clientY }; capture(e); return; }
      // grab the leg nearest to the pointer
      let grab = 0, bd = Infinity;
      part.legs.forEach((pt, k) => { if (!pt || pt.startsWith("U.")) return; const [x, y] = R.xy(pt); const d = Math.hypot(x - wx, y - wy); if (d < bd) { bd = d; grab = k; } });
      st = { kind: "move", id, grab, x: e.clientX, y: e.clientY, moved: false, legs: null, ok: false, removeOnly: !canMove, canRemove };   // removeOnly: it may only go back to the tray
      capture(e); return;
    }
    const hole = holeUnder(e.clientX, e.clientY);
    if (hole && !G.doc.occupancy().has(hole)) {
      G.select(null);
      if (G.rules && !G.can({ kind: "wire" }).ok) { st = { kind: "nowire", x: e.clientX, y: e.clientY, say: G.can({ kind: "wire" }).say }; capture(e); return; }
      st = { kind: "wire", from: hole, to: null }; capture(e); return;
    }
    G.select(null);
    startPan(e);
  }
  function startPan(e) { st = { kind: "pan", x: e.clientX, y: e.clientY }; svg.classList.add("panning"); capture(e); }
  function capture(e) { try { svg.setPointerCapture(e.pointerId); } catch (err) { /* drawer drags are not captured */ } }

  // Where a part dropped from the drawer or tray puts its legs. In levels, a resistor dropped on a top rail
  // stands from the rail into the board below it (rail → hole a), the way a beginner's circuit starts.
  function dropLegs(type, hole) {
    if (G.mode === "level" && type === "resistor" && /^[+-]T\d+$/.test(hole)) return [hole, `a${BBShared.parse(hole).row}`];
    return Gr.footprint(type, hole);
  }

  // In levels a two-leg part with both legs in one rail does nothing (both ends join the same thing): say so instead.
  const RAIL_BOTH = "Both legs would be in the same rail, so the part would do nothing. Put one leg in a strip.";
  function bothInRail(type, legs) {
    if (G.mode !== "level" || type === "wire" || !legs || legs.length !== 2 || !legs.every((l) => l && /^[+-][TB]\d+$/.test(l))) return false;
    return BBShared.net(legs[0]) === BBShared.net(legs[1]);
  }

  // ---------- moving ----------
  function preview(cx, cy) {
    const d = st.d, hole = holeUnder(cx, cy), over = inStage(cx, cy), [wx, wy] = R.toWorld(cx, cy);
    float(!over || ["meter", "uno", "battery"].includes(d.type) ? d.type : null, cx, cy);
    if (d.type === "meter" || d.type === "uno") { st.ok = true; st.at = [wx, wy]; R.clearGhost(); return; }
    if (d.type === "battery") {
      if (!hole) { st.legs = null; R.clearGhost(); R.highlight(null); return; }
      const row = Gr.grid(hole).row;
      st.legs = [`+T${row}`, `-T${Math.min(row + 1, Gr.ROWS)}`];
    } else st.legs = hole ? dropLegs(d.type, hole) : null;
    st.ok = !!st.legs && G.doc.validate(d.type, st.legs).ok;
    if (d.type === "battery") { R.highlight(st.legs ? st.legs[0] : null); return; }
    const look = { value: d.value || BB.HUD.defaults.resistor, color: d.color || BB.HUD.defaults.ledColor };
    if (st.legs) R.ghost(d.type, st.legs, st.ok, look);
    else if (over) R.floatGhost(d.type, freePts(Gr.footprint(d.type, "c30"), 0, wx, wy), look);
    else R.clearGhost();
  }

  function move(e) {
    if (!st) return hover(e);
    lastPtr = { clientX: e.clientX, clientY: e.clientY };
    if (!edgeRaf) edgeRaf = requestAnimationFrame(edgeTick);
    switch (st.kind) {
      case "new": st.x = e.clientX; st.y = e.clientY; preview(e.clientX, e.clientY); break;
      case "pan": R.pan(e.clientX - st.x, e.clientY - st.y); st.x = e.clientX; st.y = e.clientY; break;
      case "fixed": case "nowire":
        if (!st.told && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 8) { st.told = true; G.refuse(st.say || G.can({ kind: "move", id: st.id }).say); }
        break;
      case "wire": {
        const hole = holeUnder(e.clientX, e.clientY), [wx, wy] = R.toWorld(e.clientX, e.clientY);
        st.to = hole && hole !== st.from ? hole : null;
        R.wireGhost(st.from, st.to ? R.xy(st.to) : [wx, wy]);
        R.highlight(st.to);
        break;
      }
      case "move": {
        if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 4) return;
        st.moved = true;
        const part = G.doc.get(st.id);
        if (st.canRemove && overHotbar(e.clientX, e.clientY)) {     // over the tray: the part floats above it, ready to drop
          trayState("over"); R.clearGhost(); float(part.type, e.clientX, e.clientY, part.color);
          st.legs = null; st.ok = false; return;
        }
        if (st.canRemove) trayState("ready");
        float(null);
        const hole = st.removeOnly ? null : holeUnder(e.clientX, e.clientY);
        const from = part.legs[st.grab] && Gr.grid(part.legs[st.grab]);
        if (!hole || !from) { st.legs = null; st.ok = false; R.floatGhost(part.type, freePts(part.legs, st.grab, ...R.toWorld(e.clientX, e.clientY)), part); return; }
        const to = Gr.grid(hole), dr = to.row - from.row, dc = to.col - from.col;
        st.legs = part.legs.map((pt) => { if (!pt || pt.startsWith("U.")) return pt; const g = Gr.grid(pt); return Gr.point(g.row + dr, g.col + dc); });
        st.ok = G.doc.validate(part.type, st.legs, part.id).ok;
        R.ghost(part.type, st.legs, st.ok, part);
        break;
      }
      case "leg": {
        const part = G.doc.get(st.id), hole = holeUnder(e.clientX, e.clientY);
        st.legs = part.legs.slice(); st.legs[st.k] = hole;
        st.ok = !!hole && G.doc.validate(part.type, st.legs, part.id).ok;
        if (part.type === "battery") { R.highlight(hole); st.okHole = hole; return; }
        if (!hole) { R.floatGhost(part.type, part.legs.map((l, i) => (i === st.k ? R.toWorld(e.clientX, e.clientY) : l && R.xy(l))), part); return; }
        R.ghost(part.type, st.legs, st.ok, part);
        break;
      }
      case "probe": {
        st.dragged = true;
        const part = G.doc.get(st.id), [wx, wy] = R.toWorld(e.clientX, e.clientY);
        let hole = holeUnder(e.clientX, e.clientY);
        const ring = G.mode === "level" && BB.CoachUI.probeTargets()[st.k];       // near the ring Sparky marked: snap into it
        if (ring) { const [rx, ry] = R.xy(ring); if (Math.hypot(wx - rx, wy - ry) < 1.6 * BBShared.P) hole = ring; }
        if (hole && !G.can({ kind: "hole", hole }).ok) hole = null;      // a closed part of the board: the tip stays loose
        part.legs[st.k] = hole;
        part.loose = part.loose || [null, null];
        part.loose[st.k] = hole ? null : [wx, wy];
        G.recompile();
        if (hole && G.rules && G.rules.guardMeter && BB.Rules.meterOverload(G.doc, G.sim)) {   // not even while dragging
          part.legs[st.k] = null; part.loose[st.k] = [wx, wy]; G.recompile(); hole = null;
          if (!st.warned) { st.warned = true; BB.CoachUI.aside(BB.Coach.METER, 7000, "bad"); }
        }
        R.highlight(hole);
        break;
      }
      case "body": {
        if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 4) return;
        st.moved = true;
        const part = G.doc.get(st.id), [wx, wy] = R.toWorld(e.clientX, e.clientY);
        part.bx = wx - st.dx; part.by = wy - st.dy;
        G.redraw();
        break;
      }
      case "knob": G.set(st.id, "pos", Math.max(0, Math.min(1, st.pos0 - (e.clientY - st.y) / 160))); break;
    }
  }

  function up(e) {
    if (!st) return;
    const s = st;
    if (s.kind === "new") { st.x = e.clientX; st.y = e.clientY; preview(e.clientX, e.clientY); return finish(); }
    st = null; lastPtr = null;
    svg.classList.remove("panning");
    R.clearGhost(); R.highlight(null); BB.HUD.tooltip(null); float(null); trayState(null);
    switch (s.kind) {
      case "wire":
        if (s.to && G.doc.validate("wire", [s.from, s.to]).ok) G.add({ type: "wire", legs: [s.from, s.to], color: R.C.wires[wireColor++ % R.C.wires.length] });
        break;
      case "move":
        if (s.moved && G.mode === "level" && overHotbar(e.clientX, e.clientY)) { G.remove(s.id); break; }
        if (s.moved && s.ok && s.legs && bothInRail(G.doc.get(s.id).type, s.legs)) G.refuse(RAIL_BOTH);
        else if (s.moved && s.ok && s.legs) { BB.trail(`move ${s.id} to ${s.legs.join(" ")}`); G.sound.move(G.doc.get(s.id)); G.edit(() => { G.doc.get(s.id).legs = s.legs; }); G.emit("move", { id: s.id }); }
        else if (s.moved && s.removeOnly) G.refuse("Drop it on the parts tray to take it out.");
        else if (s.moved) G.refuse(G.doc.validate(G.doc.get(s.id).type, s.legs || [null], s.id).why || "It does not fit there.");
        break;
      case "leg": if (s.ok && s.legs && bothInRail(G.doc.get(s.id).type, s.legs)) G.refuse(RAIL_BOTH); else if (s.ok && s.legs) { BB.trail(`leg ${s.id} to ${s.legs.join(" ")}`); G.sound.move(G.doc.get(s.id), 1); G.edit(() => { G.doc.get(s.id).legs = s.legs; }); G.emit("move", { id: s.id }); } break;
      case "press": G.set(s.id, "pressed", false); break;
      case "cover": { const p = G.doc.get(s.id); if (p) G.set(s.id, "lux", p.room ?? 200, true); break; }
      case "knob": G.commitSoft(); break;
      case "probe": {
        const m = G.doc.get(s.id), now = m && m.legs[s.k];
        if (m && s.was && s.was !== now) G.sound.out(m, 1);                 // a probe tip leaves its hole
        if (m && now && now !== s.was) setTimeout(() => G.sound.in(m, 1), s.was ? 110 : 0);
        if (m) BB.trail(`probes red ${m.legs[0] || "loose"}, black ${m.legs[1] || "loose"}`);
        if (m && now === s.was && !s.dragged) { G.doc.unsnapshot(); break; }      // a click on a probe: nothing to undo
        G.commitSoft();
        if (m && now !== s.was) G.emit("probe", { id: s.id });
        break; }
      case "body": if (s.moved) G.commitSoft(); else G.doc.unsnapshot(); break;
    }
  }

  function finish() {
    const s = st; st = null; lastPtr = null;
    float(null); R.clearGhost(); R.highlight(null);
    const d = s.d;
    if (d.type === "uno") {
      const [wx, wy] = s.at || [-440, 200];
      G.add({ type: "uno", legs: [], pins: {}, bx: wx - BB.Uno.W / 2, by: wy - BB.Uno.H / 2 });
      return;
    }
    if (d.type === "meter") {
      const [wx, wy] = s.at || [60, 560];
      G.add({ type: "meter", mode: "V", socket: "VO", legs: [null, null], bx: wx - 95, by: wy - 40, loose: [[wx - 40, wy - 90], [wx + 40, wy - 90]] });
      return;
    }
    if (!s.legs || !s.ok) {
      const r = svg.getBoundingClientRect();
      if (s.x >= r.left && s.x <= r.right && s.y >= r.top && s.y <= r.bottom && !(G.mode === "level" && overHotbar(s.x, s.y))) G.refuse((s.legs && G.doc.validate(d.type, s.legs).why) || "Drop it onto the breadboard holes.");
      return;
    }
    if (bothInRail(d.type, s.legs)) { G.refuse(RAIL_BOTH); return; }
    const part = BB.Rules.partOf(Object.assign({}, d, { value: d.value ?? (d.type === "resistor" ? BB.HUD.defaults.resistor : undefined), color: d.color ?? BB.HUD.defaults.ledColor }), s.legs, G.level);
    if (d.type === "battery") { part.on = true; const [x] = R.xy(s.legs[0]); part.bx = x - 90; part.by = -170; }
    if (d.type === "wire") part.color = R.C.wires[wireColor++ % R.C.wires.length];
    G.add(part);
  }

  // ---------- hover ----------
  let lastHover = 0;
  function hover(e) {
    if (e.target.closest && !e.target.closest("#canvas")) return;
    const now = performance.now();
    if (now - lastHover < 40) return;
    lastHover = now;
    const partEl = e.target.closest && e.target.closest("[data-part]");
    const hole = holeUnder(e.clientX, e.clientY);
    if (G.mode === "level") {          // no voltages yet: the part's name, and the strip under the pointer once strips are taught
      R.highlight(hole && G.level.ui && G.level.ui.xray ? hole : null);
      BB.HUD.tooltip(!hole && partEl ? BB.Parts.name(G.doc.get(partEl.dataset.part) || { type: "wire" }) : null, e.clientX, e.clientY);
      return;
    }
    if (hole) {
      R.highlight(hole);
      const v = G.sim.voltageAt(hole);
      const n = hole.startsWith("U.") ? `board socket ${BB.Uno.label(hole.slice(2))}` : BBShared.netName(BBShared.net(hole));
      const occ = G.doc.occupancy().get(hole);
      const what = occ ? `\n${BB.Parts.name(G.doc.get(occ.id))} leg` : "";
      BB.HUD.tooltip(`${hole}: ${n}\n${v === null ? "not connected" : `${v.toFixed(2)} V vs ground`}${what}`, e.clientX, e.clientY);
    } else if (partEl) {
      R.highlight(null);
      BB.HUD.tooltip(BB.HUD.partTip(G, partEl.dataset.part), e.clientX, e.clientY);
    } else { R.highlight(null); BB.HUD.tooltip(null); }
  }

  // ---------- keyboard ----------
  function key(e) {
    if (e.target.matches("input, select, textarea") || G.paused) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? G.redo() : G.undo(); return; }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); G.redo(); return; }
    if (e.key === "Escape") { st = null; lastPtr = null; float(null); trayState(null); R.clearGhost(); R.highlight(null); return; }
    if (e.key === "f" || e.key === "F") { R.fitAll(); return; }
    if (e.key === "+" || e.key === "=") { const r = svg.getBoundingClientRect(); R.zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.15); return; }
    if (e.key === "-") { const r = svg.getBoundingClientRect(); R.zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.15); return; }
    if (!G.sel) return;
    if (e.key === "r" || e.key === "R") { G.rotate(G.sel); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); G.remove(G.sel); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key]) { e.preventDefault(); G.nudge(G.sel, ...arrows[e.key]); }
  }

  BB.Input = { init, startNew };
})(window.BB = window.BB || {});
