// The voltage staircase (Chapter 6): a panel beside the bench that draws a row of resistors (and, in Chapter 8, a
// capacitor) from + to − as steps down.
// Height is voltage against the − rail: the + rail on top, the − rail at 0 V, and each strip between two parts on a
// landing. A landing shows its height only once the player has measured it (red probe on it, black on the − rail),
// so the staircase never answers a question before the meter does. When the parts change, the old staircase stays
// behind, dashed, so the player sees the landing move. Levels switch it on with ui: { ladder: true }.
(function (BB) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const uF = (c) => `${Math.round(c * 1e6)} µF`;
  const kohm = (r) => (r >= 1000 ? `${+(r / 1000).toFixed(r < 10000 ? 1 : 0)} kΩ` : `${Math.round(r)} Ω`);

  // The row of parts the staircase draws: { nodes: [{ root, pt, rail }], steps: [{ label, ids }], sig }, or null.
  // A path from the battery's + to its −, through resistors and the knob's two pieces of track, with no rail in between.
  // With more than one such path, the one the red probe is on wins (then the shortest).
  function chain(S) {
    const bat = S.battery();
    if (!bat || !bat.nets[0] || !bat.nets[1]) return null;
    const plus = S.root(bat.nets[0]), minus = S.root(bat.nets[1]), edges = [];
    const on = (q) => q.ok && q.legs.every(Boolean);
    for (const q of S.all) {
      if (q.type === "resistor" && on(q)) edges.push({ a: q.nets[0], b: q.nets[1], pa: q.legs[0], pb: q.legs[1], label: kohm(q.part.value), key: `${q.id}:${q.part.value}` });
      // a capacitor is a step too: the voltage across it, which grows as it fills (Chapter 8)
      if (q.type === "cap" && on(q)) edges.push({ a: q.nets[0], b: q.nets[1], pa: q.legs[0], pb: q.legs[1], label: uF(q.part.value), key: `${q.id}:cap` });
      if (q.type === "pot" && on(q)) {
        const a = q.part.pos ?? 0.5;
        edges.push({ a: q.nets[0], b: q.nets[1], pa: q.legs[0], pb: q.legs[1], label: kohm(10000 * a), key: `${q.id}:0`, pot: true });
        edges.push({ a: q.nets[1], b: q.nets[2], pa: q.legs[1], pb: q.legs[2], label: kohm(10000 * (1 - a)), key: `${q.id}:1`, pot: true });
      }
    }
    for (const e of edges) { e.a = S.root(e.a); e.b = S.root(e.b); }
    const paths = [];
    // mids: the nodes passed on the way (not the rails), pts: a hole in each, to read its voltage
    const walk = (node, mids, steps, pts) => {
      if (paths.length > 40 || steps.length > 5) return;
      for (const e of edges) {
        if (steps.includes(e) || (e.a !== node && e.b !== node) || e.a === e.b) continue;
        const next = e.a === node ? e.b : e.a, pt = e.a === node ? e.pb : e.pa;
        if (next === minus) { paths.push({ steps: steps.concat(e), mids, pts }); continue; }
        if (next === plus || mids.includes(next)) continue;
        walk(next, mids.concat(next), steps.concat(e), pts.concat(pt));
      }
    };
    walk(plus, [], [], []);
    if (!paths.length) return null;
    const red = S.meter && S.meter.red ? S.root(BB.netKey(S.meter.red)) : null;
    const score = (p) => (red && p.mids.includes(red) ? 0 : 100) + p.steps.length;
    const best = paths.sort((x, y) => score(x) - score(y))[0];
    return {
      nodes: [{ root: plus, pt: bat.legs[0], rail: "+" }, ...best.mids.map((root, k) => ({ root, pt: best.pts[k] })), { root: minus, pt: bat.legs[1], rail: "−" }],
      steps: best.steps.map((e) => ({ label: e.label, pot: !!e.pot })),
      sig: best.steps.map((e) => e.key).join(" "),             // which parts, not where the knob is
      knob: best.steps.filter((e) => e.pot).map((e) => e.label).join(" "),
    };
  }

  // What the meter shows of a landing right now: its height, if the probes are on it and on the − rail in V mode.
  function measured(S, root, minus) {
    const m = S.meter;
    if (!m || m.mode !== "V" || m.socket !== "VO" || m.display || !m.red || !m.com || m.value === undefined) return null;
    const r = S.root(BB.netKey(m.red)), c = S.root(BB.netKey(m.com));
    return (r === root && c === minus) || (r === minus && c === root) ? Math.abs(m.value) : null;
  }

  // ---------- the panel ----------
  let on = false, mem = null, lastKey = "", last = null;
  function enter(lv) {
    on = !!(lv && lv.ui && lv.ui.ladder);
    mem = { seen: new Map(), sig: null, knob: null, last: null, ghost: null };
    lastKey = "";
    const box = $("ladder");
    if (box) { box.hidden = !on; if (on) box.querySelector("svg").replaceChildren(); }
  }
  function leave() { on = false; const box = $("ladder"); if (box) box.hidden = true; }

  // Ten times a second: follow the circuit and the meter, and draw when something changed.
  function tick(G) {
    if (!on) return;
    const S = BB.Goals.query(G), ch = chain(S);
    let view = null;
    if (ch) {
      if (ch.sig !== mem.sig) {                       // other parts: what was measured no longer holds; the old staircase stays, dashed
        mem.ghost = mem.last && mem.last.nodes.length === ch.nodes.length ? mem.last : null;
        mem.last = null; mem.seen = new Map(); mem.sig = ch.sig;
      } else if (ch.knob !== mem.knob) mem.seen = new Map();     // the knob turned: only what the meter shows now holds
      mem.knob = ch.knob;
      const minus = ch.nodes[ch.nodes.length - 1].root, top = Math.abs(S.v(ch.nodes[0].pt) ?? 0);
      const nodes = ch.nodes.map((n) => {
        if (n.rail === "+") return { label: "+ rail", v: top, rail: "+" };
        if (n.rail) return { label: "− rail", v: 0, rail: "−" };
        const now = measured(S, n.root, minus);
        if (now !== null) mem.seen.set(n.root, now);
        return { v: mem.seen.has(n.root) ? mem.seen.get(n.root) : null, live: now !== null };
      });
      const mids = nodes.filter((n) => !n.rail);
      mids.forEach((n, k) => { n.label = ch.steps.some((s) => s.pot) && mids.length === 1 ? "wiper" : mids.length === 1 ? "meeting point" : `point ${"ABCD"[k]}`; });
      view = { nodes, steps: ch.steps, top: Math.max(6, top), known: nodes.filter((n) => n.v !== null).length };
      if (view.known > 2) mem.last = view;            // something measured: what a change will be compared with
    }
    const key = JSON.stringify([view && view.nodes.map((n) => [n.label, n.v === null ? null : +n.v.toFixed(2), n.live]), view && view.steps, mem.ghost && mem.ghost.nodes.map((n) => n.v)]);
    if (key === lastKey) return;
    lastKey = key;
    last = [view, view && mem.ghost];
    draw(...last);
  }
  // The panel changed size (a new window size): draw it again at the new size.
  function resized() { if (on && last) draw(...last); }

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  const fmt = (v) => `${v < 0.05 ? "0" : v.toFixed(1)} V`;

  function draw(view, ghost) {
    // drawn in screen pixels, so the words keep their size whatever room the panel has
    const svg = $("ladder").querySelector("svg"), W = Math.max(svg.clientWidth, 160), H = Math.max(svg.clientHeight, 140);
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const note = $("ladder").querySelector(".ld-note");
    if (!view) {
      el("text", { x: W / 2, y: H / 2 - 8, class: "ld-empty" }, svg, "Build a row of resistors");
      el("text", { x: W / 2, y: H / 2 + 12, class: "ld-empty" }, svg, "from the + rail to the − rail.");
      note.textContent = "";
      return;
    }
    const X0 = 38, X1 = W - 14, Y0 = 26, Y1 = H - 46, top = view.top;
    const n = view.nodes.length, colX = (k) => X0 + 14 + (k * (X1 - X0 - 28)) / (n - 1), yv = (v) => Y1 - (v / top) * (Y1 - Y0), half = Math.min(15, (X1 - X0) / (n - 1) / 4);
    // the scale: a line per volt, numbered at 0, half and full
    for (let v = 0; v <= top + 1e-9; v++) {
      el("line", { x1: X0, y1: yv(v), x2: X1, y2: yv(v), class: v === 0 ? "ld-axis" : "ld-grid" }, svg);
      if (v === 0 || v === top || v * 2 === top) el("text", { x: X0 - 6, y: yv(v) + 4, class: "ld-scale" }, svg, `${v} V`);
    }
    // the parts between the landings, named under the steps
    view.steps.forEach((s, k) => {
      const x = (colX(k) + colX(k + 1)) / 2;
      el("text", { x, y: H - 26, class: "ld-part" }, svg, s.label);
    });
    // the landings, joined by a slope wherever two neighbours are both known
    const path = (nodes, cls) => {
      let d = "", prev = false;
      nodes.forEach((nd, k) => {
        if (nd.v === null) { prev = false; return; }
        d += `${prev ? "L" : "M"}${colX(k) - half} ${yv(nd.v)}H${colX(k) + half}`;
        prev = true;
      });
      el("path", { d, class: cls }, svg);
    };
    if (ghost) { path(ghost.nodes, "ld-ghost"); note.textContent = "Dashed: before your change."; } else note.textContent = "Height: voltage above the − rail.";
    path(view.nodes, "ld-line");
    view.nodes.forEach((nd, k) => {
      const x = colX(k);
      el("text", { x, y: H - 8, class: `ld-node${nd.rail ? " rail" : ""}` }, svg, nd.label);
      if (nd.v === null) {                       // not measured yet: somewhere between the rails (the ? above them, at no height)
        el("line", { x1: x, y1: Y0, x2: x, y2: Y1, class: "ld-unknown" }, svg);
        el("circle", { cx: x, cy: Y0 - 13, r: 10, class: "ld-q" }, svg);
        el("text", { x, y: Y0 - 8, class: "ld-qt" }, svg, "?");
        return;
      }
      el("line", { x1: x - half, y1: yv(nd.v), x2: x + half, y2: yv(nd.v), class: `ld-landing${nd.rail === "+" ? " pos" : nd.rail ? " neg" : ""}${nd.live ? " live" : ""}` }, svg);
      if (!nd.rail || nd.rail === "+") el("text", { x, y: yv(nd.v) - 8, class: "ld-v" }, svg, fmt(nd.v));
    });
    // how far each step goes down, where both its ends are known
    view.steps.forEach((s, k) => {
      const a = view.nodes[k], b = view.nodes[k + 1];
      if (a.v === null || b.v === null) return;
      const x = (colX(k) + colX(k + 1)) / 2, y = (yv(a.v) + yv(b.v)) / 2;
      el("text", { x: x + 5, y: y + 4, class: "ld-drop" }, svg, `−${fmt(a.v - b.v)}`);
    });
  }

  BB.Ladder = { chain, enter, leave, tick, resized, get on() { return on; } };
})(window.BB = window.BB || {});
