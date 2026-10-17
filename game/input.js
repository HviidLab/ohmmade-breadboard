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
    const [wx, wy] = R.toWorld(cx, cy), rad = Math.max(SNAP / R.view.k, 0.48 * BBShared.P);      // a drop between holes goes to the nearer one
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
    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const k = e.target.closest && e.target.closest('[data-ctl="knob"]');          // over a knob, the wheel turns it
      if (k) { const p = G.doc.get(k.dataset.id); if (p) { G.set(p.id, "pos", Math.max(0, Math.min(1, (p.pos ?? 0.5) + (e.deltaY < 0 ? -1 : 1) * (e.shiftKey ? 0.004 : 0.02)))); G.commitSoft(); } return; }
      R.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    svg.addEventListener("pointerleave", () => { if (!st) { BB.HUD.tooltip(null); R.highlight(null); } });
    window.addEventListener("keydown", key);
    floater = document.createElement("div");
    floater.className = "drag-float"; floater.hidden = true;
    document.body.appendChild(floater);
    BB.HUD.buildDrawer(startNew);
    svg.addEventListener("focus", () => { if (svg.matches(":focus-visible")) kbMode = true; if (!cur) cur = startHole(); show(); });
    svg.addEventListener("pointerdown", () => { if (kbMode) { kbMode = false; kb = null; R.cursor(null); } }, true);
    svg.addEventListener("blur", () => { if (!kb) { R.cursor(null); R.highlight(null); R.clearGhost(); } });
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
    if (floater.dataset.type !== key) { floater.innerHTML = BB.HUD.icon(type, type === "led" ? R.LEDC[col].icon : null, st && st.d && st.d.value); floater.dataset.type = key; }
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
    if (!e) {                // keyboard: carry it to the cursor on the board, Enter puts it down there
      kb = { kind: "new", d }; kbMode = true; svg.focus({ preventScroll: true }); if (!cur) cur = startHole(); show();
      return;
    }
    st = { kind: "new", d, legs: null, ok: false, x: e.clientX, y: e.clientY };
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
      else if (ctl === "knob") st = { kind: "knob", id, x: e.clientX, y: e.clientY, pos0: part.pos ?? 0.5 };
      else if (ctl === "cover") {                      // the light sensor: covered while held (Shift-click: stays covered)
        const room = part.room ?? 200;
        if (e.shiftKey) G.set(id, "lux", (part.lux ?? room) <= 5 ? room : 1, true);
        else { part.room = part.lux > 5 ? part.lux : room; G.set(id, "lux", 1, true); st = { kind: "cover", id }; }
      }
      else if (ctl.startsWith("pin:")) G.cyclePin(id, ctl.slice(4));
      else if (ctl === "program") G.cycleProgram(id);
      capture(e); return;
    }
    if ((n = at("[data-plug]"))) { const id = n.dataset.plug; G.select(id); st = { kind: "plug", id }; capture(e); return; }
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
      // a long part (wire, resistor, light sensor) pressed right at one end: that end moves, no need to select it first
      const span = part.legs.length === 2 && part.legs.every((l) => l && !l.startsWith("U.")) ? Math.hypot(...[0, 1].map((i) => R.xy(part.legs[0])[i] - R.xy(part.legs[1])[i])) : 0;
      if (span > 1.5 * BBShared.P && bd < 0.55 * BBShared.P && G.can({ kind: "legs", id }).ok) { st = { kind: "leg", id, k: grab, legs: null, ok: false }; capture(e); return; }
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
  // The same for a light sensor; the leg in the board goes into the first free hole of that column (a, then b, …).
  function dropLegs(type, hole) {
    if (G.mode === "level" && (type === "resistor" || type === "ldr") && /^[+-]T\d+$/.test(hole)) {
      const row = BBShared.parse(hole).row, occ = G.doc.occupancy();
      return [hole, `${"abcde".split("").find((c) => !occ.has(`${c}${row}`)) || "a"}${row}`];
    }
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
      case "knob": {              // up or right turns it clockwise (towards the first leg's end); Shift turns it finely
        const d = (e.clientX - st.x) - (e.clientY - st.y);
        G.set(st.id, "pos", Math.max(0, Math.min(1, st.pos0 - d / (e.shiftKey ? 1200 : 300))));
        break;
      }
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
        else if (s.moved && !s.legs && G.doc.get(s.id).legs.length === 2 && G.can({ kind: "legs", id: s.id }).ok) G.refuse("To move just one end, press right on that end and drag it.");
        else if (s.moved) G.refuse(G.doc.validate(G.doc.get(s.id).type, s.legs || [null], s.id).why || "It does not fit there.");
        break;
      case "leg": {
        const part = G.doc.get(s.id), moved = s.legs && s.legs[s.k] !== part.legs[s.k];
        if (s.ok && s.legs && bothInRail(part.type, s.legs)) G.refuse(RAIL_BOTH);
        else if (s.ok && moved) { BB.trail(`leg ${s.id} to ${s.legs.join(" ")}`); G.sound.move(part, 1); G.edit(() => { part.legs = s.legs; }); G.emit("move", { id: s.id }); }
        else if (s.legs && moved) G.refuse(G.doc.validate(part.type, s.legs, s.id).why || "It does not fit there.");
        break;
      }
      case "press": G.set(s.id, "pressed", false); break;
      case "plug": {             // dropped on a socket: the red lead goes in there
        const sock = document.elementsFromPoint(e.clientX, e.clientY).map((x) => x.closest && x.closest('[data-ctl^="socket:"]')).find(Boolean);
        if (sock && G.check({ kind: "ctl", id: s.id, ctl: sock.dataset.ctl })) G.set(s.id, "socket", sock.dataset.ctl.slice(7), true);
        break;
      }
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
  // What a control on a part does, for its tooltip.
  function CTL_TIP(c) {
    if (c.startsWith("mode:")) return `Click to turn the dial to ${{ off: "OFF", V: "V (volts)", mA: "mA (current)", ohm: "Ω (ohms)", cont: "the beep" }[c.slice(5)] || c.slice(5)}`;
    if (c.startsWith("socket:")) return `Click, or drag the red plug here, to put the red lead in the ${c.slice(7) === "VO" ? "VΩ" : "mA"} socket`;
    if (c.startsWith("pin:")) return `Click to switch ${c.slice(4)}: IN, LOW or HIGH`;
    return { switch: "Click to switch the battery on or off", cells: "Click to put two cells in or take them out", knob: "Drag up or right to turn it up, down or left to turn it down. Shift: finely. The wheel works too.",
      press: "Press it. Shift-click keeps it down.", cover: "Press and hold to cover it. Shift-click keeps it covered.", program: "Click to change the program" }[c] || null;
  }
  let lastHover = 0;
  function hover(e) {
    if (e.target.closest && !e.target.closest("#canvas")) return;
    const now = performance.now();
    if (now - lastHover < 40) return;
    lastHover = now;
    const partEl = e.target.closest && e.target.closest("[data-part]");
    const hole = holeUnder(e.clientX, e.clientY);
    if (G.mode === "level") {          // no voltages yet: the part's name and how to use it, and the strip under the pointer once strips are taught
      R.highlight(hole && G.level.ui && G.level.ui.strips ? hole : null);
      const ctl = e.target.closest && e.target.closest("[data-ctl]"), part = partEl && G.doc.get(partEl.dataset.part);
      const tip = ctl && CTL_TIP(ctl.dataset.ctl) || (!hole && part ? `${BB.Parts.name(part)}\n${BB.CoachUI.howTo(part)}` : null);
      BB.HUD.tooltip(tip, e.clientX, e.clientY);
      return;
    }
    if (hole) {
      R.highlight(hole);
      const v = G.sim.voltageAt(hole);
      const n = hole.startsWith("U.") ? `board socket ${BB.Uno.label(hole.slice(2))}` : BBShared.netName(BBShared.net(hole));
      const occ = G.doc.occupancy().get(hole);
      const what = occ ? `\n${BB.Parts.name(G.doc.get(occ.id))} leg` : "";
      BB.HUD.tooltip(`${hole}: ${n}\n${v === null ? "not connected" : `${v.toFixed(2)} V from the − rail`}${what}`, e.clientX, e.clientY);
    } else if (partEl) {
      R.highlight(null);
      BB.HUD.tooltip(BB.HUD.partTip(G, partEl.dataset.part), e.clientX, e.clientY);
    } else { R.highlight(null); BB.HUD.tooltip(null); }
  }

  // ---------- keyboard ----------
  function key(e) {
    if (e.target.matches("input, select, textarea") || G.paused) return;
    if (e.target === svg && boardKey(e)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    const ctlEl = e.target.closest && e.target.closest("[data-ctl]");
    if (ctlEl && ctlKey(ctlEl, e)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
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

  // ---------- keyboard play ----------
  // With the board focused, a cursor sits on one hole: the arrow keys move it, Enter picks up what is there (one end of a
  // part, a probe tip) or starts a wire from a free hole, and Enter again puts it down at the cursor. Escape cancels.
  // A tray item chosen with Enter is carried to the cursor the same way; 1 and 2 pick up the red and the black probe.
  // The controls on the parts (dial, sockets, switch, knob, buttons, pins) are focusable and work with Enter or the arrows.
  let cur = null, kb = null, kbMode = false;          // kbMode: the keyboard is in use (the mouse turns it off); kb: what is carried: {kind: "wire", from} | {kind: "leg", id, k} | {kind: "new", d} | {kind: "probe", id, k}
  const open_ = (h) => !!h && (!G.rules || G.rules.inRegion(h));
  const sockets = () => (BB.Uno.present ? BB.Uno.SOCKETS.map((s) => `U.${s.name}`).filter((h) => BB.Uno.usable(h)) : []);
  function startHole() {
    const t = BB.CoachUI.probeTargets && BB.CoachUI.probeTargets()[0];
    if (t && open_(t)) return t;
    const r = G.mode === "level" ? G.level.region.rows : [10, 20];
    return `c${Math.round((r[0] + r[1]) / 2)}`;
  }
  const nearestTo = (x, list, at) => list.reduce((b, h) => (Math.abs(at(h) - x) < Math.abs(at(b) - x) ? h : b), list[0]);
  function moveCursor(dr, dc) {
    if (cur.startsWith("U.")) {                               // along the board's sockets, or down to the top rail
      const ss = sockets(), k = ss.indexOf(cur);
      if (dr) { cur = ss[Math.max(0, Math.min(ss.length - 1, k + dr))]; return; }
      if (dc > 0) { const x = BB.Uno.socketXY(cur)[0]; cur = nearestTo(x, Array.from({ length: Gr.ROWS }, (_, i) => `+T${i + 1}`).filter(open_), (h) => R.xy(h)[0]) || cur; }
      return;
    }
    const g = Gr.grid(cur);
    if (dc < 0 && g.col === 0 && sockets().length) { cur = nearestTo(R.xy(cur)[0], sockets(), (h) => BB.Uno.socketXY(h)[0]); return; }
    for (let n = 1, row = g.row + dr, col = g.col + dc; n < 16; n++, row += dr, col += dc) {        // skip closed holes
      const p = Gr.point(row, col);
      if (!p) return;
      if (open_(p)) { cur = p; return; }
    }
  }
  // What the cursor is on, said for screen readers.
  function say(text) { const n = document.getElementById("kb-sr"); if (n) n.textContent = text; }
  function show() {
    if (kb && kb.id && !G.doc.get(kb.id)) kb = null;          // what was carried is gone (Undo, a new level)
    if (!kbMode) return;
    R.cursor(cur, !!kb); R.clearGhost(); R.highlight(cur && !cur.startsWith("U.") ? cur : null);
    if (!cur) return;
    const occ = G.doc.occupancy().get(cur), what = occ ? `, ${BB.Parts.name(G.doc.get(occ.id))}` : "";
    if (kb && kb.kind === "wire") R.wireGhost(kb.from, cur.startsWith("U.") ? BB.Uno.socketXY(cur) : R.xy(cur));
    else if (kb && kb.kind === "leg") { const p = G.doc.get(kb.id), legs = p.legs.slice(); legs[kb.k] = cur; R.ghost(p.type, legs, G.doc.validate(p.type, legs, p.id).ok, p); }
    else if (kb && kb.kind === "new" && !["meter", "uno", "battery"].includes(kb.d.type)) {
      const legs = dropLegs(kb.d.type, cur);
      R.ghost(kb.d.type, legs, !!legs && G.doc.validate(kb.d.type, legs).ok, { value: kb.d.value || BB.HUD.defaults.resistor, color: kb.d.color || BB.HUD.defaults.ledColor });
    }
    const label = cur.startsWith("U.") ? `board socket ${BB.Uno.label(cur.slice(2))}` : `hole ${cur}`;
    say(`${label}${what}${kb ? `. Carrying ${kb.kind === "new" ? BB.Parts.name(Object.assign({ value: 330 }, kb.d)) : kb.kind === "probe" ? (kb.k ? "the black probe" : "the red probe") : kb.kind === "wire" ? "a wire" : "one end"}: Enter puts it here.` : ""}`);
  }
  function pickUp() {
    const m = G.doc.parts.find((p) => p.type === "meter"), pk = m ? m.legs.indexOf(cur) : -1;
    if (pk >= 0) { if (G.check({ kind: "probe", id: m.id })) kb = { kind: "probe", id: m.id, k: pk }; return; }
    const occ = G.doc.occupancy().get(cur);
    if (occ) {
      G.select(occ.id);
      if (G.can({ kind: "legs", id: occ.id }).ok) { kb = { kind: "leg", id: occ.id, k: occ.leg }; return; }
      const b = document.querySelector("#partcard button");             // Remove, Flip, Fresh one…
      if (b) b.focus(); else G.refuse(G.can({ kind: "legs", id: occ.id }).say);
      return;
    }
    if (G.rules && !G.check({ kind: "wire" })) return;
    kb = { kind: "wire", from: cur };
  }
  function putDown() {
    const c = kb;
    if (c.kind === "wire") {
      if (cur === c.from) return;
      const v = G.doc.validate("wire", [c.from, cur]);
      if (!v.ok) { G.refuse(v.why); return; }
      kb = null;
      G.add({ type: "wire", legs: [c.from, cur], color: R.C.wires[wireColor++ % R.C.wires.length] });
    } else if (c.kind === "leg") {
      const p = G.doc.get(c.id), legs = p.legs.slice(); legs[c.k] = cur;
      const v = G.doc.validate(p.type, legs, p.id);
      if (!v.ok) { G.refuse(v.why); return; }
      if (bothInRail(p.type, legs)) { G.refuse(RAIL_BOTH); return; }
      kb = null;
      G.sound.move(p, 1); G.edit(() => { p.legs = legs; }); G.emit("move", { id: p.id });
    } else if (c.kind === "probe") {
      if (!G.check({ kind: "hole", hole: cur })) return;
      kb = null;
      const m = G.doc.get(c.id), was = m.legs[c.k];
      G.doc.snapshot(); m.legs[c.k] = cur; m.loose = m.loose || [null, null]; m.loose[c.k] = null;
      G.recompile(); G.commitSoft();
      if (m.legs[c.k] !== was) G.emit("probe", { id: c.id });
    } else if (c.kind === "new") {
      const [x, y] = R.toScreen(...(cur.startsWith("U.") ? BB.Uno.socketXY(cur) : R.xy(cur)));
      const legs = c.d.type === "battery" ? [`+T${Gr.grid(cur).row}`, `-T${Math.min(Gr.grid(cur).row + 1, Gr.ROWS)}`] : dropLegs(c.d.type, cur);
      kb = null;
      st = { kind: "new", d: c.d, legs, ok: !!legs && (["meter", "uno"].includes(c.d.type) || G.doc.validate(c.d.type, legs).ok), x, y, at: R.xy(cur.startsWith("U.") ? "c30" : cur) };
      finish();
    }
  }
  function boardKey(e) {
    if (e.key === "Tab" || e.key === "Shift") return false;
    kbMode = true;
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!cur) cur = startHole();
    if (arrows[e.key] && !(e.ctrlKey || e.metaKey)) { moveCursor(...arrows[e.key]); show(); return true; }
    if (e.key === "Enter" || e.key === " ") { if (kb) putDown(); else pickUp(); show(); return true; }
    if (e.key === "Escape" && kb) { kb = null; show(); return true; }
    if (e.key === "1" || e.key === "2") {
      const m = G.doc.parts.find((p) => p.type === "meter");
      if (m && G.check({ kind: "probe", id: m.id })) { kb = { kind: "probe", id: m.id, k: +e.key - 1 }; show(); }
      return true;
    }
    const occ = G.doc.occupancy().get(cur);
    if ((e.key === "Delete" || e.key === "Backspace") && occ) { G.remove(occ.id); show(); return true; }
    if ((e.key === "r" || e.key === "R") && occ) { G.rotate(occ.id); show(); return true; }
    return false;
  }
  // A focused control on a part: Enter or Space uses it (a push button and the light sensor toggle), the arrows turn a knob.
  function ctlKey(n, e) {
    const id = n.dataset.id, ctl = n.dataset.ctl, part = G.doc.get(id);
    if (!part) return false;
    const go = e.key === "Enter" || e.key === " ";
    if (ctl === "knob") {
      const d = { ArrowUp: -1, ArrowRight: -1, ArrowDown: 1, ArrowLeft: 1 }[e.key];
      if (!d) return false;
      if (G.check({ kind: "ctl", id, ctl })) { G.set(id, "pos", Math.max(0, Math.min(1, (part.pos ?? 0.5) + d * (e.shiftKey ? 0.004 : 0.02)))); G.commitSoft(); }
      return true;
    }
    if (!go) return false;
    G.select(id);
    if (!G.check({ kind: "ctl", id, ctl })) return true;
    if (ctl === "switch") G.set(id, "on", part.on === false, true);
    else if (ctl === "cells") G.set(id, "cells", (part.cells || 4) === 4 ? 2 : 4, true);
    else if (ctl.startsWith("mode:")) G.set(id, "mode", ctl.slice(5), true);
    else if (ctl.startsWith("socket:")) G.set(id, "socket", ctl.slice(7), true);
    else if (ctl === "press") G.set(id, "pressed", !part.pressed, true);
    else if (ctl === "cover") { const room = part.room ?? 200; if ((part.lux ?? room) > 5) part.room = part.lux ?? room; G.set(id, "lux", (part.lux ?? room) <= 5 ? part.room ?? 200 : 1, true); }
    else if (ctl.startsWith("pin:")) G.cyclePin(id, ctl.slice(4));
    else if (ctl === "program") G.cycleProgram(id);
    return true;
  }
  // After every redraw: the controls can be reached with Tab and are named; the one that had the focus gets it back.
  let focusKey = null;
  function beforeRedraw() { const a = document.activeElement; focusKey = a && a.dataset && a.dataset.ctl && svg.contains(a) ? [a.dataset.ctl, a.dataset.id] : null; }
  function afterRedraw() {
    for (const n of svg.querySelectorAll("[data-ctl]")) {
      if (!n.dataset.id || n.dataset.id.startsWith("ghost-")) continue;
      n.setAttribute("tabindex", n.classList.contains("locked") ? "-1" : "0"); n.setAttribute("role", "button");
      n.setAttribute("aria-label", CTL_TIP(n.dataset.ctl) || n.dataset.ctl);
    }
    if (focusKey) { const n = svg.querySelector(`[data-ctl="${focusKey[0]}"][data-id="${focusKey[1]}"]`); if (n) n.focus({ preventScroll: true }); }
    if (kbMode && (document.activeElement === svg || kb)) show();
  }

  function reset() { kb = null; cur = null; R.cursor(null); }       // a new bench (a level, the sandbox)
  // Drop whatever is being dragged or carried (Sparky's blackboard is about to cover the bench).
  function cancel() { st = null; lastPtr = null; float(null); trayState(null); R.clearGhost(); R.highlight(null); if (kb) { kb = null; show(); } }
  BB.Input = { reset, init, startNew, beforeRedraw, afterRedraw, cancel, get carrying() { return !!kb; }, get busy() { return !!st || !!kb; } };
})(window.BB = window.BB || {});
