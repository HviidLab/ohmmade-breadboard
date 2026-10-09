// Input: pointer state machine for the workbench, plus keyboard shortcuts.
(function (BB) {
  "use strict";
  const R = BB.Render, Gr = BB.Grid;
  const SNAP = 13;   // screen pixels
  let G, svg, st = null, wireColor = 0;

  function holeUnder(cx, cy) {
    const [wx, wy] = R.toWorld(cx, cy), rad = SNAP / R.view.k;
    const h = R.holeAt(wx, wy, rad);
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
    BB.HUD.buildDrawer(startNew);
  }

  // ---------- starting gestures ----------
  function startNew(d, e) {
    BB.Effects.unlock();
    if (d.type === "meter" && G.doc.parts.some((p) => p.type === "meter")) { BB.HUD.toast("There is already a multimeter on the bench."); return; }
    if (d.type === "uno" && G.doc.parts.some((p) => p.type === "uno")) { BB.HUD.toast("There is already an Uno-style board on the bench."); return; }
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
      if (ctl === "switch") G.set(id, "on", part.on === false, true);
      else if (ctl.startsWith("mode:")) G.set(id, "mode", ctl.slice(5), true);
      else if (ctl.startsWith("socket:")) G.set(id, "socket", ctl.slice(7), true);
      else if (ctl === "press") { if (e.shiftKey) G.set(id, "pressed", !part.pressed, true); else { G.set(id, "pressed", true); st = { kind: "press", id }; } }
      else if (ctl === "knob") st = { kind: "knob", id, y: e.clientY, pos0: part.pos ?? 0.5 };
      else if (ctl.startsWith("pin:")) G.cyclePin(id, ctl.slice(4));
      capture(e); return;
    }
    if ((n = at("[data-probe]"))) { const id = n.dataset.id; G.select(id); G.doc.snapshot(); st = { kind: "probe", id, k: +n.dataset.probe }; capture(e); return; }
    if ((n = at("[data-handle]"))) { const id = n.dataset.id; G.select(id); st = { kind: "leg", id, k: +n.dataset.handle, legs: null, ok: false }; capture(e); return; }
    // Uno header sockets: drawing a wire wins over dragging the board
    const sk = at("[data-body]") && holeUnder(e.clientX, e.clientY);
    if (sk && sk.startsWith("U.") && !G.doc.occupancy().has(sk)) { st = { kind: "wire", from: sk, to: null }; G.select(null); capture(e); return; }
    if ((n = at("[data-body]"))) {
      const id = n.dataset.body, part = G.doc.get(id);
      G.select(id); G.doc.snapshot();
      st = { kind: "body", id, dx: wx - (part.bx ?? 0), dy: wy - (part.by ?? 0) };
      capture(e); return;
    }
    if ((n = at("[data-part]"))) {
      const id = n.dataset.part, part = G.doc.get(id);
      G.select(id);
      // grab the leg nearest to the pointer
      let grab = 0, bd = Infinity;
      part.legs.forEach((pt, k) => { if (!pt || pt.startsWith("U.")) return; const [x, y] = R.xy(pt); const d = Math.hypot(x - wx, y - wy); if (d < bd) { bd = d; grab = k; } });
      st = { kind: "move", id, grab, x: e.clientX, y: e.clientY, moved: false, legs: null, ok: false };
      capture(e); return;
    }
    const hole = holeUnder(e.clientX, e.clientY);
    if (hole && !G.doc.occupancy().has(hole)) { st = { kind: "wire", from: hole, to: null }; G.select(null); capture(e); return; }
    G.select(null);
    startPan(e);
  }
  function startPan(e) { st = { kind: "pan", x: e.clientX, y: e.clientY }; svg.classList.add("panning"); capture(e); }
  function capture(e) { try { svg.setPointerCapture(e.pointerId); } catch (err) { /* drawer drags are not captured */ } }

  // ---------- moving ----------
  function preview(cx, cy) {
    const d = st.d, hole = holeUnder(cx, cy);
    if (d.type === "meter" || d.type === "uno") { st.ok = true; const [wx, wy] = R.toWorld(cx, cy); st.at = [wx, wy]; R.clearGhost(); return; }
    if (d.type === "battery") {
      if (!hole) { st.legs = null; R.clearGhost(); return; }
      const row = Gr.grid(hole).row;
      st.legs = [`+T${row}`, `-T${Math.min(row + 1, Gr.ROWS)}`];
    } else st.legs = hole ? Gr.footprint(d.type, hole) : null;
    st.ok = !!st.legs && G.doc.validate(d.type, st.legs).ok;
    if (d.type === "battery") { R.highlight(st.legs ? st.legs[0] : null); return; }
    R.ghost(d.type, st.legs, st.ok, { value: d.value || 330 });
  }

  function move(e) {
    if (!st) return hover(e);
    switch (st.kind) {
      case "new": st.x = e.clientX; st.y = e.clientY; preview(e.clientX, e.clientY); break;
      case "pan": R.pan(e.clientX - st.x, e.clientY - st.y); st.x = e.clientX; st.y = e.clientY; break;
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
        const part = G.doc.get(st.id), hole = holeUnder(e.clientX, e.clientY);
        const from = part.legs[st.grab] && Gr.grid(part.legs[st.grab]);
        if (!hole || !from) { st.legs = null; R.clearGhost(); return; }
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
        R.ghost(part.type, st.legs, st.ok, part);
        break;
      }
      case "probe": {
        const part = G.doc.get(st.id), hole = holeUnder(e.clientX, e.clientY), [wx, wy] = R.toWorld(e.clientX, e.clientY);
        part.legs[st.k] = hole;
        part.loose = part.loose || [null, null];
        part.loose[st.k] = hole ? null : [wx, wy];
        G.recompile();
        R.highlight(hole);
        break;
      }
      case "body": {
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
    st = null;
    svg.classList.remove("panning");
    R.clearGhost(); R.highlight(null); BB.HUD.tooltip(null);
    switch (s.kind) {
      case "wire":
        if (s.to && G.doc.validate("wire", [s.from, s.to]).ok) G.add({ type: "wire", legs: [s.from, s.to], color: R.C.wires[wireColor++ % R.C.wires.length] });
        break;
      case "move":
        if (s.moved && s.ok) G.edit(() => { G.doc.get(s.id).legs = s.legs; });
        else if (s.moved) BB.HUD.toast(G.doc.validate(G.doc.get(s.id).type, s.legs || [null], s.id).why || "It does not fit there.", 3000);
        break;
      case "leg": if (s.ok) G.edit(() => { G.doc.get(s.id).legs = s.legs; }); break;
      case "press": G.set(s.id, "pressed", false); break;
      case "knob": G.commitSoft(); break;
      case "probe": case "body": G.commitSoft(); break;
    }
  }

  function finish() {
    const s = st; st = null;
    R.clearGhost(); R.highlight(null);
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
      if (s.x >= r.left && s.x <= r.right && s.y >= r.top && s.y <= r.bottom) BB.HUD.toast((s.legs && G.doc.validate(d.type, s.legs).why) || "Drop it onto the breadboard holes.", 3000);
      return;
    }
    const part = { type: d.type, legs: s.legs };
    if (d.type === "resistor") part.value = 330;
    if (d.type === "cap") part.value = d.value;
    if (d.type === "pot") part.pos = 0.5;
    if (d.type === "ldr") part.lux = 200;
    if (d.type === "button") { part.pairs = "across"; part.pressed = false; }
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
    if (hole) {
      R.highlight(hole);
      const v = G.sim.voltageAt(hole);
      const n = hole.startsWith("U.") ? `Uno socket ${hole.slice(2).replace(/^GND\d$/, "GND")}` : BBShared.netName(BBShared.net(hole));
      const occ = G.doc.occupancy().get(hole);
      const what = occ ? `\n${BB.Parts.TYPES[G.doc.get(occ.id).type].label} leg` : "";
      BB.HUD.tooltip(`${hole}: ${n}\n${v === null ? "not connected" : `${v.toFixed(2)} V vs ground`}${what}`, e.clientX, e.clientY);
    } else if (partEl) {
      R.highlight(null);
      BB.HUD.tooltip(BB.HUD.partTip(G, partEl.dataset.part), e.clientX, e.clientY);
    } else { R.highlight(null); BB.HUD.tooltip(null); }
  }

  // ---------- keyboard ----------
  function key(e) {
    if (e.target.matches("input, select, textarea")) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? G.redo() : G.undo(); return; }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); G.redo(); return; }
    if (e.key === "Escape") { st = null; R.clearGhost(); R.highlight(null); return; }
    if (e.key === "f" || e.key === "F") { R.fit(); return; }
    if (e.key === "+" || e.key === "=") { const r = svg.getBoundingClientRect(); R.zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.15); return; }
    if (e.key === "-") { const r = svg.getBoundingClientRect(); R.zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.15); return; }
    if (!G.sel) return;
    if (e.key === "r" || e.key === "R") { G.rotate(G.sel); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); G.remove(G.sel); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key]) { e.preventDefault(); G.nudge(G.sel, ...arrows[e.key]); }
  }

  BB.Input = { init };
})(window.BB = window.BB || {});
