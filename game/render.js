// Rendering: the workbench SVG (board, parts, ghost, handles, net highlight) and per-frame dynamics.
// Parts are vector drawings; when generated sprites exist (BB.Art), they replace the bodies.
(function (BB) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const { P, X0, Y } = BBShared;
  const { COLS, ROWS } = BB.Grid;
  const xr = (r) => X0 + (r - 1) * P;
  const bbxy = (pt) => { const p = BBShared.parse(pt); return [xr(p.row), Y[p.kind === "rail" ? p.rail : p.col]]; };
  const xy = (pt) => (pt.startsWith("U.") ? BB.Uno.socketXY(pt) : bbxy(pt));
  const BOARD = { x: 18, y: 56, w: xr(ROWS) + 52 - 18, h: 444 };
  const C = {
    leg: "#c7ccd1", legHi: "#f4f6f8", board: "#f3efe6", boardEdge: "#d9d0bd", strip: "#e1dbcd", hole: "#3b4048",
    slot: "#e6dece", slotEdge: "#cfc4ad", gap: "#e2dbcb", label: "#6b6250",
    pos: "#d64545", gnd: "#3a78d6", res: "#dcc293", resEdge: "#a98b55", led: "#e8202a", cap: "#2f4fa3",
    pot: "#2a6fc2", npn: "#202326", btn: "#3b4046", wires: ["#2fae5a", "#f08c2a", "#f2c94c", "#3a8ee6", "#e9ecef", "#c2410c"],
  };
  const BANDS = BBShared.BANDS;
  // LED colours: glow (core, mid, edge), dome (light, base, dark), and a colour matrix that turns the red sprite into this colour.
  const LEDC = {
    red: { glow: ["#ffd2c8", "#ff4a3a", "#ff2a1a"], dome: ["#ff9a8f", "#d81e28", "#8e0f16"], edge: "#7a0d14", icon: "#d81e28" },
    yellow: { glow: ["#fff6c8", "#ffd43a", "#ffb000"], dome: ["#fff1a0", "#f2c200", "#9a7400"], edge: "#7a5c00", icon: "#f2c200",
      matrix: "1.25 0.2 0 0 0.02  1.05 0.2 0 0 0  0.15 0.1 0 0 0  0 0 0 1 0" },
    green: { glow: ["#d9ffe0", "#3ddc6e", "#1fbf4f"], dome: ["#a6f5b8", "#1fa83f", "#0d5a20"], edge: "#0b4a1a", icon: "#1fa83f",
      matrix: "0.1 0.1 0 0 0  0.95 0.25 0 0 0.02  0.25 0.1 0 0 0  0 0 0 1 0" },
    blue: { glow: ["#dce6ff", "#5a86ff", "#2a4dff"], dome: ["#a8bfff", "#2347d8", "#0f2378"], edge: "#0d1f66", icon: "#2347d8",
      matrix: "0.12 0.1 0 0 0  0.35 0.2 0 0 0  1.25 0.3 0 0 0.04  0 0 0 1 0" },
    white: { glow: ["#ffffff", "#eef2ff", "#c9d4ff"], dome: ["#ffffff", "#dfe4ea", "#9aa3ad"], edge: "#7d858f", icon: "#e9edf2",
      matrix: "0.75 0.5 0.5 0 0.18  0.75 0.5 0.5 0 0.18  0.78 0.5 0.5 0 0.2  0 0 0 0.92 0" },
  };
  const ledc = (part) => (LEDC[part.color] ? part.color : "red");

  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  const A = BB.Art || { has: () => false };


  let svg, world, L = {};
  const view = { tx: 40, ty: 210, k: 1 };

  function init(root) {
    svg = root;
    const defs = el("defs", {}, svg);
    defs.innerHTML = `
      <radialGradient id="glow"><stop offset="0" stop-color="#ffd2c8" stop-opacity="1"/><stop offset=".18" stop-color="#ff4a3a" stop-opacity=".85"/><stop offset=".5" stop-color="#ff2a1a" stop-opacity=".32"/><stop offset="1" stop-color="#ff2a1a" stop-opacity="0"/></radialGradient>
      <radialGradient id="glowGreen"><stop offset="0" stop-color="#d9ffe0"/><stop offset=".4" stop-color="#3ddc6e" stop-opacity=".8"/><stop offset="1" stop-color="#3ddc6e" stop-opacity="0"/></radialGradient>
      <radialGradient id="glowAmber"><stop offset="0" stop-color="#fff2c8"/><stop offset=".4" stop-color="#ffb547" stop-opacity=".85"/><stop offset="1" stop-color="#ffb547" stop-opacity="0"/></radialGradient>
      <radialGradient id="glowHot"><stop offset="0" stop-color="#fff6e0" stop-opacity="1"/><stop offset=".25" stop-color="#ff7a5a" stop-opacity=".7"/><stop offset="1" stop-color="#ff2a1a" stop-opacity="0"/></radialGradient>
      <radialGradient id="dome" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#ff9a8f"/><stop offset=".55" stop-color="#d81e28"/><stop offset="1" stop-color="#8e0f16"/></radialGradient>
      <radialGradient id="domeDead" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#8a6a66"/><stop offset="1" stop-color="#3a2526"/></radialGradient>
      <linearGradient id="resBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1dcb0"/><stop offset=".5" stop-color="#dcc293"/><stop offset="1" stop-color="#b99d66"/></linearGradient>
      <radialGradient id="capTop" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#5f84d8"/><stop offset="1" stop-color="#20387a"/></radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="2" dy="4" stdDeviation="3" flood-color="#000" flood-opacity=".45"/></filter>
      <filter id="soft"><feGaussianBlur stdDeviation="3"/></filter>
      <pattern id="matgrid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="rgba(160,200,255,.035)" stroke-width="1"/></pattern>
      <radialGradient id="bench" cx=".42" cy=".38" r=".6"><stop offset="0" stop-color="#16304a"/><stop offset=".55" stop-color="#0d1b2c"/><stop offset="1" stop-color="#070f1a"/></radialGradient>`;
    for (const [k, c] of Object.entries(LEDC)) {
      defs.insertAdjacentHTML("beforeend",
        `<radialGradient id="glow-${k}"><stop offset="0" stop-color="${c.glow[0]}" stop-opacity="1"/><stop offset=".18" stop-color="${c.glow[1]}" stop-opacity=".85"/><stop offset=".5" stop-color="${c.glow[2]}" stop-opacity=".32"/><stop offset="1" stop-color="${c.glow[2]}" stop-opacity="0"/></radialGradient>` +
        `<radialGradient id="dome-${k}" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="${c.dome[0]}"/><stop offset=".55" stop-color="${c.dome[1]}"/><stop offset="1" stop-color="${c.dome[2]}"/></radialGradient>` +
        (c.matrix ? `<filter id="tint-${k}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${c.matrix}"/></filter>` : ""));
    }
    world = el("g", { id: "world" }, svg);
    // the bench: deep night blue, brightest behind the board, with a faint grid (art style 1: the glowing flat cartoon)
    el("rect", { x: -4000, y: -3000, width: 9000, height: 7000, fill: "#070f1a" }, world);
    el("rect", { x: -1400, y: -1100, width: 4600, height: 2700, fill: "url(#bench)" }, world);
    el("rect", { x: -4000, y: -3000, width: 9000, height: 7000, fill: "url(#matgrid)" }, world);
    // layers, bottom to top; only the board and the parts take the pointer
    for (const k of ["board", "region", "guide", "hi", "parts", "flow", "fx", "coach", "ui", "kb"]) L[k] = el("g", { id: `L-${k}`, "pointer-events": k === "board" || k === "parts" ? null : "none" }, world);
    drawBoard();
    apply();
  }

  // ---------- view ----------
  function apply() { world.setAttribute("transform", `translate(${view.tx} ${view.ty}) scale(${view.k})`); }
  function toWorld(cx, cy) {
    const r = svg.getBoundingClientRect();
    return [(cx - r.left - view.tx) / view.k, (cy - r.top - view.ty) / view.k];
  }
  function toScreen(wx, wy) {
    const r = svg.getBoundingClientRect();
    return [r.left + view.tx + wx * view.k, r.top + view.ty + wy * view.k];
  }
  function zoomAt(cx, cy, f) {
    const r = svg.getBoundingClientRect();
    const k2 = Math.max(0.2, Math.min(2.6, view.k * f));
    const px = cx - r.left, py = cy - r.top;
    view.tx = px - ((px - view.tx) * k2) / view.k;
    view.ty = py - ((py - view.ty) * k2) / view.k;
    view.k = k2;
    apply();
  }
  function pan(dx, dy) { view.tx += dx; view.ty += dy; apply(); }
  let lastRows = [1, 24], lastBox = null;
  function fit(rows = [1, 24]) {
    lastRows = rows; lastBox = null;
    const r = svg.getBoundingClientRect();
    let x0 = xr(rows[0]) - 345, x1 = xr(rows[1]) + 30, y0 = -190, y1 = 500;
    if (BB.Uno.present) { x0 = Math.min(x0, BB.Uno.pos.bx - 30); y0 = Math.min(y0, BB.Uno.pos.by - 40); y1 = Math.max(y1, BB.Uno.pos.by + BB.Uno.H + 30); }
    view.k = Math.min(r.width / (x1 - x0), r.height / (y1 - y0));
    view.tx = -x0 * view.k + (r.width - (x1 - x0) * view.k) / 2;
    view.ty = -y0 * view.k + (r.height - (y1 - y0) * view.k) / 2;
    apply();
  }
  const refit = () => (lastBox ? fitBox(...lastBox) : fit(lastRows));
  // Levels: fit a world box into the part of the stage that the overlays leave free.
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  function setInsets(i) { Object.assign(insets, { top: 0, right: 0, bottom: 0, left: 0 }, i || {}); }
  // On a small screen the holes would get too small to hit: then keep at least MIN_PITCH screen pixels between holes,
  // centred on `focus` (the open board), and the rest is a pan or the zoom buttons away.
  let MIN_PITCH = 16;
  function fitBox(x0, y0, x1, y1, focus) {
    lastBox = [x0, y0, x1, y1, focus];
    const r = svg.getBoundingClientRect();
    const W = Math.max(r.width - insets.left - insets.right, 100), H = Math.max(r.height - insets.top - insets.bottom, 100);
    view.k = Math.max(0.2, Math.min(2.2, W / (x1 - x0), H / (y1 - y0)));
    if (focus && view.k * P < MIN_PITCH) {
      const k = view.k = MIN_PITCH / P;
      // what does not fit: keep the board's left end and its bottom row in view, and as much above and right as there is room for
      if ((x1 - x0) * k > W) { x0 = Math.max(x0, focus[0]); x1 = x0 + W / k; }
      if ((y1 - y0) * k > H) { y0 = Math.max(y0, Math.min(focus[1] - 20, focus[3] - H / k)); y1 = y0 + H / k; }
    }
    view.tx = insets.left - x0 * view.k + (W - (x1 - x0) * view.k) / 2;
    view.ty = insets.top - y0 * view.k + (H - (y1 - y0) * view.k) / 2;
    apply();
  }
  // World box of a level's open board rows, without the battery and meter around them.
  function boardBox(region) {
    const [r0, r1] = region.rows || [1, ROWS];
    return [xr(r0) - 50, Y["+T"] - 30, xr(r1) + 40, (region.rails === "all" ? Y["-B"] : region.cols === "a-j" ? Y.j : Y.e) + 34];
  }
  // World box around a level's open board area and its battery pack.
  function regionBox(region, doc) {
    const [r0, r1] = region.rows || [1, ROWS], bat = doc.parts.find((p) => p.type === "battery"), m = doc.parts.find((p) => p.type === "meter");
    let x0 = Math.min(xr(r0) - 50, bat ? (bat.bx ?? 40) - 10 : Infinity), x1 = Math.max(xr(r1) + 40, bat ? (bat.bx ?? 40) + 240 : -Infinity);
    let y0 = bat ? (bat.by ?? -150) - 12 : Y["+T"] - 40, y1 = (region.rails === "all" ? Y["-B"] : region.cols === "a-j" ? Y.j : Y.e) + 34;
    for (const b of doc.parts.filter((p) => p.type === "battery" && p !== bat && p.by !== undefined)) y1 = Math.max(y1, b.by + 150);   // a second pack below the board
    const u = doc.parts.find((p) => p.type === "uno");
    if (u && u.bx !== undefined) {          // the controller board above the breadboard, its USB cable to the left
      x0 = Math.min(x0, u.bx - 130); x1 = Math.max(x1, u.bx + BB.Uno.W + 12); y0 = Math.min(y0, u.by - 12);
    }
    if (m && m.bx !== undefined) {          // the meter beside the board, with its loose probes above it
      x0 = Math.min(x0, m.bx - 10); x1 = Math.max(x1, m.bx + meterSize()[0] + 10);
      y0 = Math.min(y0, m.by - 10); y1 = Math.max(y1, m.by + meterSize()[1] + 75);
    }
    return [x0, y0, x1, y1];
  }
  // The meter body's size in world units (the sprite keeps its picture's shape).
  function meterSize() { return [240, 340]; }
  // Which of the meter's dial positions and sockets are locked in this level (set by the game; null: none).
  let ctlLocked = null;
  function setCtlLock(fn) { ctlLocked = fn; }
  function lockCtls(body, part) {
    if (!ctlLocked) return;
    for (const t of body.querySelectorAll(".ctl")) if (ctlLocked(part, t.dataset.ctl)) t.classList.add("locked");
  }
  // Show the whole bench: every row of the board and every part, wherever it has been moved.
  // World box around the board and all parts, optionally leaving out one part (the one being dragged).
  function contentBox(skipId) {
    const gs = [L.board, ...[...L.parts.children].filter((g) => !skipId || g.dataset.part !== skipId)];
    const boxes = gs.map((g) => g.getBBox()).filter((b) => b.width && b.height);
    return [Math.min(...boxes.map((b) => b.x)), Math.min(...boxes.map((b) => b.y)),
            Math.max(...boxes.map((b) => b.x + b.width)), Math.max(...boxes.map((b) => b.y + b.height))];
  }
  function fitAll() {
    if (lastBox) return fitBox(...lastBox);      // in a level, "show everything" means the open part of the board
    const r = svg.getBoundingClientRect(), pad = 24, c = contentBox();
    const x0 = c[0] - pad, y0 = c[1] - pad, x1 = c[2] + pad, y1 = c[3] + pad;
    view.k = Math.max(0.2, Math.min(r.width / (x1 - x0), r.height / (y1 - y0)));
    view.tx = -x0 * view.k + (r.width - (x1 - x0) * view.k) / 2;
    view.ty = -y0 * view.k + (r.height - (y1 - y0) * view.k) / 2;
    apply();
  }

  // Nearest breadboard hole to a world point within `rad` world units.
  function holeAt(wx, wy, rad) {
    const row = Math.round((wx - X0) / P) + 1;
    if (row < 1 || row > ROWS) return null;
    let best = null, bd = rad;
    for (const c of COLS) {
      const d = Math.hypot(wx - xr(row), wy - Y[c]);
      if (d <= bd) { bd = d; best = c; }
    }
    return best ? `${best}${row}` : null;
  }

  // ---------- board ----------
  function drawBoard() {
    const g = L.board;
    // "Strips you can see": each group of five joined holes sits in its own rounded slot, each rail in one long band
    el("rect", { x: BOARD.x, y: BOARD.y, width: BOARD.w, height: BOARD.h, rx: 16, fill: C.board, stroke: C.boardEdge, "stroke-width": 2, filter: "url(#shadow)" }, g);
    el("rect", { x: BOARD.x + 8, y: (Y.e + Y.f) / 2 - 8, width: BOARD.w - 16, height: 16, rx: 8, fill: C.gap }, g);      // centre gap
    for (const [k, col] of [["+T", C.pos], ["-T", C.gnd], ["+B", C.pos], ["-B", C.gnd]]) {
      el("rect", { x: BOARD.x + 24, y: Y[k] - 10, width: BOARD.w - 36, height: 20, rx: 10, fill: col, "fill-opacity": 0.07, stroke: col, "stroke-opacity": 0.45, "stroke-width": 1.4 }, g);
      el("line", { x1: BOARD.x + 30, x2: BOARD.x + BOARD.w - 18, y1: Y[k] + (k[0] === "+" ? -13 : 13), y2: Y[k] + (k[0] === "+" ? -13 : 13), stroke: col, "stroke-width": 2.2, opacity: 0.9, "stroke-linecap": "round" }, g);
      el("text", { x: BOARD.x + 12, y: Y[k] + 5, "text-anchor": "middle", fill: col, "font-family": "IBM Plex Mono, monospace", "font-size": 15, "font-weight": 600 }, g).textContent = k[0] === "+" ? "+" : "−";
    }
    const slots = [];                                    // one path for all the slots, for speed
    for (let r = 1; r <= ROWS; r++) for (const [y0, y1] of [[Y.a, Y.e], [Y.f, Y.j]]) {
      const x = xr(r) - 10, t = y0 - 11, h = y1 - y0 + 22;
      slots.push(`M${x + 10} ${t}a10 10 0 0 1 10 10v${h - 20}a10 10 0 0 1 -20 0v${-(h - 20)}a10 10 0 0 1 10 -10z`);
    }
    el("path", { d: slots.join(""), fill: C.slot, stroke: C.slotEdge, "stroke-width": 1.1 }, g);
    for (const c of "abcdefghij") el("text", { x: BOARD.x + 12, y: Y[c] + 4, "text-anchor": "middle", fill: C.label, "font-family": "IBM Plex Mono, monospace", "font-size": 13, "font-weight": 600 }, g).textContent = c;
    const d = [];                                        // round holes, one path
    for (let r = 1; r <= ROWS; r++) for (const c of COLS) d.push(`M${xr(r) - 3.2} ${Y[c]}a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0z`);
    el("path", { d: d.join(""), fill: C.hole }, g);
    for (let r = 1; r <= ROWS; r++) if (r === 1 || r % 5 === 0) {
      el("text", { x: xr(r), y: Y.a - 18, "text-anchor": "middle", fill: C.label, "font-family": "IBM Plex Mono, monospace", "font-size": 12, "font-weight": 600 }, g).textContent = r;
      el("text", { x: xr(r), y: Y.j + 24, "text-anchor": "middle", fill: C.label, "font-family": "IBM Plex Mono, monospace", "font-size": 12, "font-weight": 600 }, g).textContent = r;
    }
  }

  // Highlight every hole in the same net as `pt` (strip or rail).
  function highlight(pt) {
    L.hi.replaceChildren();
    if (!pt || pt.startsWith("U.")) return;
    const p = BBShared.parse(pt);
    if (p.kind === "rail") el("rect", { x: BOARD.x + 24, y: Y[p.rail] - 10, width: BOARD.w - 36, height: 20, rx: 10, class: "strip-hi" }, L.hi);
    else {                                               // the slot under the pointer: the strip it would join
      const top = "abcde".includes(p.col);
      const [y1, y2] = top ? [Y.a, Y.e] : [Y.f, Y.j];
      el("rect", { x: xr(p.row) - 10, y: y1 - 11, width: 20, height: y2 - y1 + 22, rx: 10, class: "strip-hi" }, L.hi);
    }
  }

  // ---------- parts ----------
  const refs = new Map();      // part id -> {glow, body, ...} for per-frame updates

  function leg(g, a, b, w = 2.4) {
    el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.leg, "stroke-width": w, "stroke-linecap": "round" }, g);
    el("line", { x1: a[0], y1: a[1] - 0.6, x2: b[0], y2: b[1] - 0.6, stroke: C.legHi, "stroke-width": 0.8, opacity: 0.7, "stroke-linecap": "round" }, g);
  }
  // A longer leg pushed into its hole: the extra length makes a small bend halfway.
  function legKink(g, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const p = (t, o) => [a[0] + dx * t + nx * o, a[1] + dy * t + ny * o];
    const pts = [a, p(0.3, 0), p(0.42, 4), p(0.54, -4), p(0.66, 0), b];
    const d = `M${pts.map((q) => q.map((v) => v.toFixed(1)).join(" ")).join(" L")}`;
    el("path", { d, stroke: C.leg, "stroke-width": 2.4, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    el("path", { d, stroke: C.legHi, "stroke-width": 0.8, fill: "none", opacity: 0.7, transform: "translate(0 -.6)" }, g);
  }
  function curve(a, b, bend) { return BBShared.curve(a, b, bend); }

  function bandColors(v) {
    const s = String(Math.round(v)), d1 = +s[0], d2 = +(s[1] || 0), z = Math.max(s.length - 2, 0);
    return [BANDS[d1], BANDS[d2], BANDS[z], "#c9a227"];
  }

  // Draw one part into group g. dead = destroyed. Returns refs for dynamic updates.
  // Art style 1 (the glowing flat cartoon): flat bodies with one soft highlight, a darker outline and a soft shadow;
  // what carries electricity glows. Drawn in code so every leg sits exactly in its hole.
  const shade = (g, d, dx = 2, dy = 3) => el("path", { d, fill: "rgba(4, 10, 20, .32)", transform: `translate(${dx} ${dy})` }, g);
  function drawBody(g, part, pts, dead, fx = null) {
    const r = {};
    const [a, b] = pts;
    const mid = a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : null;
    const angOf = (p, q) => (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
    switch (part.type) {
      case "resistor": {
        leg(g, a, b);
        const len = Math.min(42, Math.max(24, Math.hypot(b[0] - a[0], b[1] - a[1]) - 10)), hh = 8;
        const body = el("g", { transform: `translate(${mid[0]} ${mid[1]}) rotate(${angOf(a, b)})` }, g);
        const cap = `M${-len / 2 + hh} ${-hh}H${len / 2 - hh}A${hh} ${hh} 0 0 1 ${len / 2 - hh} ${hh}H${-len / 2 + hh}A${hh} ${hh} 0 0 1 ${-len / 2 + hh} ${-hh}Z`;
        shade(body, cap);
        r.body = el("path", { d: cap, fill: dead ? "#3b2a1c" : "#ecd3a4", stroke: dead ? "#1a120c" : "#a8834c", "stroke-width": 1.4 }, body);
        if (!dead) {
          const x0 = -len / 2 + hh * 0.9, span = len - hh * 1.8;
          bandColors(part.value).forEach((c, k) => el("rect", { x: x0 + (k < 3 ? k * span * 0.24 : span * 0.82), y: -hh + 0.7, width: 3.6, height: 2 * hh - 1.4, fill: c }, body));
          el("rect", { x: -len / 2 + hh * 0.6, y: -hh + 2, width: len - hh * 1.2, height: 3, rx: 1.5, fill: "#fff", opacity: 0.35 }, body);
        } else el("path", { d: `M${-len / 2 + 6} -3 l6 5 l5 -6 l6 7`, stroke: "#120b06", "stroke-width": 2, fill: "none" }, body);
        r.heat = el("path", { d: cap, fill: "#ff5a1a", opacity: 0 }, body);
        break;
      }
      case "wire": {
        const col = part.color || C.wires[0];
        r.track = curve(a, b, 16);
        el("path", { d: r.track, stroke: "rgba(4, 10, 20, .35)", "stroke-width": 7.5, fill: "none", "stroke-linecap": "round", transform: "translate(1.5 2.5)" }, g);
        el("path", { d: r.track, stroke: dead ? "#2a2018" : "rgba(10, 16, 24, .55)", "stroke-width": 7, fill: "none", "stroke-linecap": "round" }, g);
        r.path = el("path", { d: r.track, stroke: dead ? "#4a3a2a" : col, "stroke-width": 4.6, fill: "none", "stroke-linecap": "round", "stroke-dasharray": dead ? "3 4" : null }, g);
        el("path", { d: r.track, stroke: "transparent", "stroke-width": 16, fill: "none" }, g);            // easier to grab than the thin wire
        el("path", { d: r.track, stroke: "#fff", "stroke-width": 1.3, fill: "none", opacity: 0.3, transform: "translate(-.6 -.9)" }, g);
        for (const p of [a, b]) el("circle", { cx: p[0], cy: p[1], r: 2.8, fill: "#d5dbe1", stroke: "#6b7580", "stroke-width": 0.8 }, g);
        r.glow = el("path", { d: r.track, stroke: "#ff8a3a", "stroke-width": 10, fill: "none", opacity: 0, filter: "url(#soft)" }, g);
        break;
      }
      case "led": {
        legKink(g, a, mid); leg(g, b, mid);          // the + leg is the longer one: its extra length shows as a bend
        const col = ledc(part), L = LEDC[col];
        r.glowFill = `url(#glow-${col})`;
        r.glow = el("circle", { cx: mid[0], cy: mid[1], r: 34, fill: r.glowFill, opacity: 0 }, fx || g);
        const dome = el("g", { transform: `translate(${mid[0]} ${mid[1]}) rotate(${angOf(a, b)})` }, g);
        const rim = "M11.5 -9.8 A15 15 0 1 0 11.5 9.8 Z", top = "M9.8 -8.2 A12.8 12.8 0 1 0 9.8 8.2 Z";     // the flat side marks the − leg
        shade(dome, rim);
        el("path", { d: rim, fill: dead ? "#2a1d1d" : L.dome[2], stroke: dead ? "#140c0c" : L.edge, "stroke-width": 1.2 }, dome);
        r.body = el("path", { d: top, fill: dead ? "url(#domeDead)" : L.dome[1] }, dome);
        if (!dead) {
          r.shine = el("path", { d: top, fill: L.glow[0], opacity: 0 }, dome);                  // lights up with the current
          r.shade = el("path", { d: top, fill: "#0b0608", opacity: 0.4 }, dome);                // a dim LED's lens stays dark; fades as it lights
          el("ellipse", { cx: -5, cy: -4.5, rx: 3.6, ry: 5.6, fill: "#fff", opacity: 0.55, transform: "rotate(35 -5 -4.5)" }, dome);
        } else el("path", { d: "M-6 -6 l4 5 l-3 4 l5 4", stroke: "#111", "stroke-width": 1.4, fill: "none" }, dome);
        r.core = el("circle", { cx: -1, cy: 0, r: 4, fill: "#fff6e0", opacity: 0 }, dome);
        el("text", { x: a[0] - 4, y: a[1] + 17, fill: C.pos, "font-family": "IBM Plex Mono, monospace", "font-size": 11, "font-weight": 600 }, g).textContent = "+";
        break;
      }
      case "cap": {
        leg(g, a, mid); leg(g, b, mid);
        const rr = part.value >= 1e-3 ? 16 : part.value >= 1e-4 ? 13 : 11, ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        el("circle", { cx: mid[0] + 2, cy: mid[1] + 3, r: rr, fill: "rgba(4, 10, 20, .32)" }, g);
        // the charge ring: fills with amber as the capacitor charges (effects.js sets how far)
        r.fillC = 2 * Math.PI * (rr + 4.5);
        el("circle", { cx: mid[0], cy: mid[1], r: rr + 4.5, fill: "none", stroke: "rgba(255, 181, 71, .18)", "stroke-width": 3.5 }, g);
        r.fill = el("circle", { cx: mid[0], cy: mid[1], r: rr + 4.5, fill: "none", stroke: "#ffb547", "stroke-width": 3.5, "stroke-linecap": "round",
          "stroke-dasharray": `0 ${r.fillC}`, transform: `rotate(-90 ${mid[0]} ${mid[1]})`, style: "filter: drop-shadow(0 0 3px rgba(255, 181, 71, .8))" }, g);
        r.body = el("circle", { cx: mid[0], cy: mid[1], r: rr, fill: dead ? "#2c2f36" : "#3a63d6", stroke: dead ? "#14161a" : "#1c3474", "stroke-width": 1.4 }, g);
        // the light stripe marks the − side
        const sx = mid[0] + Math.cos(ang) * rr * 0.58, sy = mid[1] + Math.sin(ang) * rr * 0.58;
        el("circle", { cx: sx, cy: sy, r: rr * 0.34, fill: dead ? "#4a4d55" : "#c9d6f6" }, g);
        el("circle", { cx: mid[0] - rr * 0.3, cy: mid[1] - rr * 0.32, r: rr * 0.22, fill: "#fff", opacity: dead ? 0 : 0.35 }, g);
        el("path", { d: `M${mid[0] - rr * 0.45} ${mid[1]}h${rr * 0.9}M${mid[0]} ${mid[1] - rr * 0.45}v${rr * 0.9}`, stroke: dead ? "#ffb08a" : "#9fb4ea", "stroke-width": 1.5, opacity: 0.85 }, g);
        el("text", { x: a[0] - 4, y: a[1] + 19, fill: C.pos, "font-family": "IBM Plex Mono, monospace", "font-size": 11, "font-weight": 600 }, g).textContent = "+";
        break;
      }
      case "ldr": {
        leg(g, a, b);
        el("circle", { cx: mid[0] + 2, cy: mid[1] + 3, r: 11, fill: "rgba(4, 10, 20, .32)" }, g);
        // press and hold to cover it with your hand (dark); Shift-click keeps it covered
        const face = el("g", { class: "ctl", "data-ctl": "cover", "data-id": part.id }, g);
        r.body = el("circle", { cx: mid[0], cy: mid[1], r: 11, fill: "#f0c85c", stroke: "#a67c2a", "stroke-width": 1.4 }, face);
        el("path", { d: `M${mid[0] - 7} ${mid[1] - 3}h3v6h3v-6h3v6h3v-6h3`, stroke: "#8b3a1a", "stroke-width": 1.6, fill: "none", "stroke-linejoin": "round" }, face);
        el("circle", { cx: mid[0] - 4, cy: mid[1] - 5, r: 2.4, fill: "#fff", opacity: 0.45 }, face);
        if ((part.lux ?? 200) <= 5) {               // covered: a hand's shadow over it
          el("circle", { cx: mid[0], cy: mid[1], r: 17, fill: "#0a1220", opacity: 0.72, "pointer-events": "none" }, g);
          el("text", { x: mid[0], y: mid[1] - 21, "text-anchor": "middle", fill: "#cfe0f4", "font-family": "Fredoka, sans-serif", "font-size": 11, "font-weight": 600, "pointer-events": "none" }, g).textContent = "dark";
        }
        break;
      }
      case "pot": {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const x0 = Math.min(...xs) - 15, x1 = Math.max(...xs) + 15, y0 = Math.min(...ys) - 18, y1 = Math.max(...ys) + 16;
        el("rect", { x: x0 + 2, y: y0 + 3, width: x1 - x0, height: y1 - y0, rx: 9, fill: "rgba(4, 10, 20, .32)" }, g);
        r.body = el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 9, fill: dead ? "#2b2f36" : "#2f6fd0", stroke: "#173a75", "stroke-width": 1.4 }, g);
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const knob = el("g", { class: "ctl", "data-ctl": "knob", "data-id": part.id }, g);
        el("circle", { cx, cy, r: 22, fill: "transparent" }, knob);
        el("circle", { cx, cy, r: 14, fill: "#eef1f4", stroke: "#8f9aa5", "stroke-width": 1.4 }, knob);
        el("circle", { cx: cx - 4, cy: cy - 5, r: 4, fill: "#fff", opacity: 0.7 }, knob);
        const ang = (-135 + 270 * (part.pos ?? 0.5)) * Math.PI / 180;       // clockwise moves the wiper towards the third leg, as on a real pot
        r.pointer = el("line", { x1: cx, y1: cy, x2: cx + Math.sin(ang) * 10, y2: cy - Math.cos(ang) * 10, stroke: "#26303a", "stroke-width": 3, "stroke-linecap": "round" }, knob);
        break;
      }
      case "npn": {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const x0 = Math.min(...xs) - 13, x1 = Math.max(...xs) + 13, yc = Math.min(...ys);
        // A BC547 reads C, B, E from left to right seen from its flat face: the flat face is on the side the labels read from.
        const flatDown = pts[0][0] < pts[2][0];
        const d = flatDown ? `M${x0} ${yc + 13}H${x1}V${yc - 2}Q${(x0 + x1) / 2} ${yc - 27} ${x0} ${yc - 2}Z` : `M${x0} ${yc - 13}H${x1}V${yc + 2}Q${(x0 + x1) / 2} ${yc + 27} ${x0} ${yc + 2}Z`;
        shade(g, d);
        r.body = el("path", { d, fill: dead ? "#3a2a22" : "#2b3038", stroke: "#0c0e11", "stroke-width": 1.4 }, g);
        el("rect", { x: x0 + 3, y: flatDown ? yc + 6 : yc - 10, width: x1 - x0 - 6, height: 4, rx: 2, fill: "#fff", opacity: 0.12 }, g);
        ["C", "B", "E"].forEach((t, k) => el("text", { x: pts[k][0], y: yc + 5, "text-anchor": "middle", fill: "#e9ecef", "font-family": "IBM Plex Mono, monospace", "font-size": 10, "font-weight": 600 }, g).textContent = t);
        if (dead) el("circle", { cx: (x0 + x1) / 2, cy: yc, r: 6, fill: "#5a3a2a", opacity: 0.8 }, g);
        break;
      }
      case "button": {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const x0 = Math.min(...xs) - 12, x1 = Math.max(...xs) + 12, y0 = Math.min(...ys) - 12, y1 = Math.max(...ys) + 12;
        el("rect", { x: x0 + 2, y: y0 + 3, width: x1 - x0, height: y1 - y0, rx: 8, fill: "rgba(4, 10, 20, .32)" }, g);
        r.body = el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 8, fill: "#2b3038", stroke: "#0c0e11", "stroke-width": 1.4 }, g);
        const cap = el("g", { class: "ctl", "data-ctl": "press", "data-id": part.id }, g), rc = Math.min(x1 - x0, y1 - y0) * 0.3;
        r.cap = el("circle", { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r: rc, fill: part.pressed ? "#c23a3a" : "#ff5a5a", stroke: "#7a1d1d", "stroke-width": 1.4 }, cap);
        el("circle", { cx: (x0 + x1) / 2 - rc * 0.3, cy: (y0 + y1) / 2 - rc * 0.35, r: rc * 0.3, fill: "#fff", opacity: part.pressed ? 0.15 : 0.45 }, cap);
        break;
      }
      case "battery": drawBattery(g, part, pts, r, dead); break;
      case "meter": drawMeter(g, part, pts, r); break;
      case "uno": drawUno(g, part, r); break;
    }
    return r;
  }

  // The battery pack: a flat dark box with its AA cells, a switch, and two leads into the board.
  const BAT = { W: 230, H: 104 };
  function drawBattery(g, part, pts, r, dead) {
    const bx = part.bx ?? 40, by = part.by ?? -150, { W, H } = BAT, cells = part.cells || 4;
    const body = el("g", { "data-body": part.id }, g);
    el("rect", { x: bx + 3, y: by + 5, width: W, height: H, rx: 18, fill: "rgba(4, 10, 20, .4)" }, body);
    el("rect", { x: bx, y: by, width: W, height: H, rx: 18, fill: "#1a2433", stroke: "#2e3e54", "stroke-width": 2 }, body);
    // a pack with cellSwap: click its slots to put in two more cells (or take them out): 3 V ↔ 6 V
    const slots = part.cellSwap ? el("g", { class: "ctl", "data-ctl": "cells", "data-id": part.id }, body) : body;
    if (part.cellSwap) el("rect", { x: bx + 10, y: by + 8, width: 150, height: H - 16, rx: 14, fill: "transparent" }, slots);
    for (let k = 0; k < 4; k++) {                       // four slots; a 2×AA pack leaves two empty
      const cx = bx + 16 + k * 36, full = k < cells;
      el("rect", { x: cx, y: by + 14, width: 28, height: H - 28, rx: 12, fill: full ? "#2b313a" : "#121a25", stroke: full ? "none" : part.cellSwap ? "#ffb547" : "#26354a", "stroke-dasharray": full ? null : "4 3" }, slots);
      if (!full) { if (part.cellSwap) el("text", { x: cx + 14, y: by + H / 2 + 6, "text-anchor": "middle", fill: "#ffb547", "font-family": "Fredoka, sans-serif", "font-size": 18, "font-weight": 600 }, slots).textContent = "+"; continue; }
      el("rect", { x: cx, y: by + (k % 2 ? 14 : H / 2), width: 28, height: H / 2 - 14, rx: 12, fill: dead ? "#5a4630" : "#ee9a3c" }, slots);
      el("rect", { x: cx + 5, y: by + 18, width: 5, height: H - 36, rx: 2.5, fill: "#fff", opacity: 0.18 }, slots);
    }
    const on = part.on !== false, sx = bx + W - 40, sy = by + 22;
    const sw = el("g", { class: "ctl", "data-ctl": "switch", "data-id": part.id }, body);
    el("rect", { x: sx - 24, y: sy - 13, width: 48, height: 26, rx: 13, fill: on ? "#22a65a" : "#3a4552", stroke: "#0c1118", "stroke-width": 1.4 }, sw);
    r.sw = el("circle", { cx: sx + (on ? 11 : -11), cy: sy, r: 9.5, fill: on ? "#dfffe9" : "#aeb7c0" }, sw);
    el("text", { x: sx, y: sy + 30, "text-anchor": "middle", fill: on ? "#8ff0b4" : "#93a6b8", "font-family": "IBM Plex Mono, monospace", "font-size": 11, "font-weight": 600 }, body).textContent = on ? "ON" : "OFF";
    el("text", { x: sx, y: by + H - 14, "text-anchor": "middle", fill: "#93a6b8", "font-family": "IBM Plex Mono, monospace", "font-size": 11 }, body).textContent = `${cells}×AA`;
    if (dead) el("text", { x: bx + W / 2 - 20, y: by + H / 2 + 5, "text-anchor": "middle", fill: "#ffb08a", "font-family": "IBM Plex Mono, monospace", "font-size": 13, "font-weight": 600 }, body).textContent = "LEAKING";
    const ly = by > Y.j ? by + 10 : by + H - 8;          // below the board, the leads leave from the pack's top edge
    [["+", bx + W * 0.3], ["−", bx + W * 0.45]].forEach(([t, x]) => { el("text", { x: x + 9, y: ly + (by > Y.j ? -3 : 0), fill: t === "+" ? "#ff9a9a" : "#c9d3dd", "font-family": "IBM Plex Mono, monospace", "font-size": 13, "font-weight": 700 }, body).textContent = t; });
    leads(g, [[bx + W * 0.3, ly], [bx + W * 0.45, ly]], pts, part, ["#e04848", "#151a20"], 60, r);
  }

  // Battery leads from the holder to their holes. r.leads keeps each lead's path (holder → hole) for the current flow.
  function leads(g, ends, pts, part, cols, drop, r) {
    r.leads = [];
    pts.forEach((p, k) => {
      const end = p || part.loose?.[k] || [ends[k][0], ends[k][1] + 40];
      const up = end[1] < ends[k][1] - 40;          // a pack below the board: its leads rise to the holes
      const d = up ? `M${ends[k][0]} ${ends[k][1]} C ${ends[k][0]} ${ends[k][1] - drop}, ${end[0]} ${end[1] + 60}, ${end[0]} ${end[1]}`
        : `M${ends[k][0]} ${ends[k][1]} C ${ends[k][0]} ${ends[k][1] + drop}, ${end[0]} ${end[1] - 60}, ${end[0]} ${end[1]}`;
      r.leads[k] = d;
      el("path", { d, stroke: cols[k], "stroke-width": 3.4, fill: "none", "stroke-linecap": "round" }, g);
      el("rect", { x: end[0] - 3, y: end[1] - 3, width: 6, height: 6, fill: "#b8bec4" }, g);
      el("circle", { cx: end[0], cy: end[1], r: 9, fill: "transparent", class: "lead-end", "data-handle": k, "data-id": part.id, style: "cursor:grab" }, g);
    });
  }

  // Probe cables; r.leads keeps each cable's path (meter → probe tip) for the current flow.
  function probes(g, part, pts, from, r) {
    const cols = ["#d64545", "#1a1a1a"];
    r.leads = [];
    pts.forEach((p, k) => {
      const tip = p || part.loose?.[k] || [from[k][0], from[k][1] - 300];
      const d = `M${from[k][0]} ${from[k][1]} C ${from[k][0]} ${from[k][1] + 70}, ${tip[0] + (k ? 30 : -30)} ${tip[1] + 120}, ${tip[0]} ${tip[1] + 22} L ${tip[0]} ${tip[1]}`;
      r.leads[k] = d;
      el("path", { d, stroke: cols[k], "stroke-width": 3, fill: "none", "stroke-linecap": "round", opacity: 0.95 }, g);
      const pr = el("g", { class: "probe", "data-probe": k, "data-id": part.id, style: "cursor:grab" }, g);
      el("rect", { x: tip[0] - 11, y: tip[1] + 3, width: 22, height: 30, rx: 8, fill: "transparent" }, pr);          // grab it by its handle, not over the next holes
      el("path", { d: `M${tip[0]} ${tip[1]} l-4 8 v16 h8 v-16z`, fill: cols[k], stroke: "#000", "stroke-width": 0.8 }, pr);
      el("circle", { cx: tip[0], cy: tip[1], r: 3, fill: "#e9ecef" }, pr);
      el("text", { x: tip[0], y: tip[1] + 22, "text-anchor": "middle", fill: "#fff", "font-family": "IBM Plex Mono, monospace", "font-size": 10, "font-weight": 700 }, pr).textContent = k ? "−" : "+";   // not by colour alone
    });
  }

  const DIAL = [["off", "OFF", -60], ["V", "V⎓", -20], ["mA", "mA", 20], ["ohm", "Ω", 60], ["cont", "·)))", 100]];
  // The multimeter: a flat yellow body, a dark face, a glowing display, the dial and three sockets.
  const MTR = { W: 240, H: 340 };
  function drawMeter(g, part, pts, r) {
    const bx = part.bx ?? 60, by = part.by ?? 560, { W, H } = MTR;
    const body = el("g", { "data-body": part.id }, g);
    el("rect", { x: bx + 4, y: by + 7, width: W, height: H, rx: 30, fill: "rgba(4, 10, 20, .4)" }, body);
    el("rect", { x: bx, y: by, width: W, height: H, rx: 30, fill: "#ffc43d", stroke: "#b9800f", "stroke-width": 2.5, "data-markbox": "" }, body);   // its outline, for marks
    el("rect", { x: bx + 6, y: by + 6, width: W - 12, height: 10, rx: 5, fill: "#fff", opacity: 0.3 }, body);
    el("rect", { x: bx + 14, y: by + 18, width: W - 28, height: H - 32, rx: 22, fill: "#1c2633", stroke: "#0d131b", "stroke-width": 1.5 }, body);
    // the display, glowing a little
    el("rect", { x: bx + 28, y: by + 34, width: W - 56, height: 84, rx: 12, fill: "#0e2620", stroke: "#2c5a4b", "stroke-width": 1.5, "data-lcd": part.id }, body);
    r.lcd = el("text", { "data-lcd-text": part.id, x: bx + W - 42, y: by + 98, "text-anchor": "end", fill: "#9dffc8", "font-family": "IBM Plex Mono, monospace", "font-size": 40, "font-weight": 600, style: "filter: drop-shadow(0 0 4px rgba(120, 255, 190, .55))" }, body);
    r.lcdUnit = el("text", { x: bx + 40, y: by + 56, fill: "#6fd4a4", "font-family": "IBM Plex Mono, monospace", "font-size": 14, "font-weight": 600 }, body);
    // the dial
    const cx = bx + W / 2, cy = by + 196, kr = 44;
    el("circle", { cx, cy, r: kr + 4, fill: "#121a24" }, body);
    el("circle", { cx, cy, r: kr, fill: "#2b3644", stroke: "#0d131b", "stroke-width": 1.5 }, body);
    el("circle", { cx: cx - 12, cy: cy - 14, r: 12, fill: "#fff", opacity: 0.06 }, body);
    const cur = DIAL.find((d) => d[0] === (part.mode || "V")) || DIAL[1], pa = (cur[2] - 90) * Math.PI / 180;
    el("line", { x1: cx, y1: cy, x2: cx + Math.cos(pa) * (kr - 6), y2: cy + Math.sin(pa) * (kr - 6), stroke: "#f2f5f8", "stroke-width": 6, "stroke-linecap": "round" }, body);
    el("circle", { cx, cy, r: 9, fill: "#1c2633" }, body);
    for (const [mode, lbl, deg] of DIAL) {
      const an = (deg - 90) * Math.PI / 180, lx = cx + Math.cos(an) * (kr + 22), ly = cy + Math.sin(an) * (kr + 22);
      const t = el("g", { class: "ctl", "data-ctl": `mode:${mode}`, "data-id": part.id }, body);
      el("circle", { cx: lx, cy: ly, r: 15, fill: "transparent" }, t);
      el("text", { x: lx, y: ly + 4.5, "text-anchor": "middle", fill: (part.mode || "V") === mode ? "#ffb547" : "#c9d3dd", "font-family": "IBM Plex Mono, monospace", "font-size": 13, "font-weight": 600 }, t).textContent = lbl;
    }
    // sockets: mA, COM, VΩ
    const sock = { mA: [bx + 58, by + 294], COM: [bx + W / 2, by + 294], VO: [bx + W - 58, by + 294] };
    for (const [k, [sx, sy]] of Object.entries(sock)) {
      const t = el("g", { class: k === "COM" ? "" : "ctl", "data-ctl": k === "COM" ? null : `socket:${k}`, "data-id": part.id }, body);
      el("circle", { cx: sx, cy: sy, r: 14, fill: "#0a0e13", stroke: k === "COM" ? "#5b6672" : k === "mA" ? "#ffc43d" : "#ff5a5a", "stroke-width": 3 }, t);
      el("text", { x: sx, y: sy - 21, "text-anchor": "middle", fill: "#c9d3dd", "font-family": "IBM Plex Mono, monospace", "font-size": 11 }, t).textContent = k === "VO" ? "VΩ" : k;
      if (k === "mA") el("text", { x: sx, y: sy + 27, "text-anchor": "middle", fill: "#ffc43d", "font-family": "IBM Plex Mono, monospace", "font-size": 8.5, "font-weight": 600 }, t).textContent = "FUSED";
    }
    lockCtls(body, part);
    const from = [sock[part.socket === "mA" ? "mA" : "VO"], sock.COM];
    el("circle", { cx: from[0][0], cy: from[0][1], r: 6, fill: "#e04848" }, body);
    el("circle", { cx: from[0][0], cy: from[0][1], r: 13, fill: "transparent", "data-plug": part.id, style: "cursor:grab" }, g);     // drag the red plug to another socket
    el("circle", { cx: from[1][0], cy: from[1][1], r: 6, fill: "#151a20" }, body);
    probes(g, part, pts.map((p, k) => p || part.loose?.[k] || [bx + 60 + k * 70, by - 40]), from, r);
  }

  // The controller board: a generic board in style 1. One row of sockets along its bottom edge, a click-badge above each
  // pin D2–D13 (H = HIGH, L = LOW, IN = reads), and a screen that shows what the board reads and its program.
  function drawUno(g, part, r) {
    const U = BB.Uno, bx = part.bx ?? U.pos.bx, by = part.by ?? U.pos.by, { W, H } = U, SY = by + H - 18;
    U.pos.bx = bx; U.pos.by = by;
    const body = el("g", { "data-body": part.id }, g), mono = "IBM Plex Mono, monospace";
    // the USB cable, which powers it
    el("path", { d: `M${bx - 120} ${by + 34} C${bx - 70} ${by + 34} ${bx - 60} ${by + 60} ${bx - 16} ${by + 60}`, stroke: "#2b3644", "stroke-width": 10, fill: "none", "stroke-linecap": "round" }, body);
    el("rect", { x: bx - 20, y: by + 47, width: 28, height: 26, rx: 4, fill: "#c9d3dd", stroke: "#7b8794", "stroke-width": 1.5 }, body);
    el("rect", { x: bx + 5, y: by + 8, width: W, height: H, rx: 22, fill: "rgba(4, 10, 20, .4)" }, body);
    el("rect", { x: bx, y: by, width: W, height: H, rx: 22, fill: "#1b6b5c", stroke: "#0d4038", "stroke-width": 2.5, "data-markbox": "" }, body);
    el("rect", { x: bx + 8, y: by + 6, width: W - 16, height: 9, rx: 4.5, fill: "#fff", opacity: 0.22 }, body);
    // the chip
    for (let k = 0; k < 6; k++) for (const sx of [bx + 22, bx + 112]) el("rect", { x: sx, y: by + 32 + k * 11, width: 10, height: 5, rx: 1.5, fill: "#b8c2cc" }, body);
    el("rect", { x: bx + 30, y: by + 24, width: 84, height: 76, rx: 9, fill: "#161c24", stroke: "#0a0e13", "stroke-width": 1.5 }, body);
    el("circle", { cx: bx + 42, cy: by + 36, r: 4, fill: "#2b3644" }, body);
    // the screen
    const scr = el("g", part.programs ? { class: "ctl", "data-ctl": "program", "data-id": part.id } : {}, body);    // click it to choose the next program
    el("rect", { x: bx + 146, y: by + 18, width: 338, height: 92, rx: 12, fill: "#0e2620", stroke: "#2c5a4b", "stroke-width": 1.5, "data-lcd": part.id }, scr);
    r.screen = [0, 1, 2].map((k) => el("text", { x: bx + 162, y: by + 46 + k * 26, fill: "#9dffc8", "font-family": mono, "font-size": 17, "font-weight": 600, style: "filter: drop-shadow(0 0 4px rgba(120, 255, 190, .5))" }, scr));
    // the power light, and what the badges mean
    r.onLed = el("circle", { cx: bx + W - 40, cy: by + 36, r: 11, fill: "url(#glowGreen)", opacity: 0 }, body);
    el("circle", { cx: bx + W - 40, cy: by + 36, r: 4.5, fill: "#3ddc6e", stroke: "#0d4038" }, body);
    el("text", { x: bx + W - 58, y: by + 41, "text-anchor": "end", fill: "#d8efe9", "font-family": mono, "font-size": 12, "font-weight": 600 }, body).textContent = "ON";
    [["H", "HIGH: 5 V", "#ff5a5a"], ["L", "LOW: 0 V", "#4d8dff"], ["IN", "reads", "#0e2620"]].forEach(([b, t, c], k) => {
      const y = by + 62 + k * 22;
      el("rect", { x: bx + 504, y: y - 13, width: 24, height: 18, rx: 5, fill: c, stroke: k === 2 ? "#9dffc8" : "#0d1418", "stroke-width": 1.2 }, body);
      el("text", { x: bx + 516, y: y + 0.5, "text-anchor": "middle", fill: "#f4f7f9", "font-family": mono, "font-size": 10, "font-weight": 700 }, body).textContent = b;
      el("text", { x: bx + 536, y: y + 0.5, fill: "#d8efe9", "font-family": mono, "font-size": 11.5, "font-weight": 600 }, body).textContent = t;
    });
    // the header: a dark strip per group, the sockets, and their names
    const groups = [["3V3", "GND1"], ["D2", "D13"], ["A0", "A5"]].map(([a, z]) => [U.SOCKETS.find((q) => q.name === a), U.SOCKETS.find((q) => q.name === z)]);
    for (const [a, z] of groups) el("rect", { x: bx + a.x - 13, y: SY - 13, width: z.x - a.x + 26, height: 26, rx: 6, fill: "#10161d" }, body);
    el("text", { x: bx + 506 + 65, y: SY - 40, "text-anchor": "middle", fill: "#bfe3da", "font-family": mono, "font-size": 11, "font-weight": 600 }, body).textContent = "analog in";
    r.badges = {};
    for (const sk of U.SOCKETS) {
      const sx = bx + sk.x, name = sk.name;
      el("rect", { x: sx - 5.5, y: SY - 5.5, width: 11, height: 11, rx: 2, fill: "#030507", stroke: "#3a4652" }, body);
      const col = name === "5V" ? "#ff8a8a" : /^GND/.test(name) ? "#8fb3ff" : name === "3V3" ? "#9fb0bf" : "#f1f3f5";
      el("text", { x: sx, y: SY - 19, "text-anchor": "middle", fill: col, "font-family": mono, "font-size": name.length > 3 ? 9 : 10.5, "font-weight": 700 }, body).textContent = U.label(name);
      if (U.DIGITAL.includes(name)) {
        const t = el("g", { class: "ctl", "data-ctl": `pin:${name}`, "data-id": part.id }, body);
        el("rect", { x: sx - 13.5, y: SY - 66, width: 27, height: 32, fill: "transparent" }, t);       // a bigger target than the badge
        const rect = el("rect", { x: sx - 11.5, y: SY - 58, width: 23, height: 20, rx: 5, "stroke-width": 1.2 }, t);
        const txt = el("text", { x: sx, y: SY - 44, "text-anchor": "middle", fill: "#f4f7f9", "font-family": mono, "font-size": 10, "font-weight": 700 }, t);
        r.badges[name] = { rect, txt };
      }
    }
    unoLive(part, r, BB.Game && BB.Game.sim);
    lockCtls(body, part);
  }
  // The parts of the board that change while it runs: the badges, the screen and the power light.
  function unoLive(part, r, sim) {
    const rd = sim && sim.read(part.id), U = BB.Uno;
    if (r.onLed) r.onLed.setAttribute("opacity", rd && rd.powered ? 0.95 : 0);
    for (const [name, b] of Object.entries(r.badges || {})) {
      const mode = (part.pins && part.pins[name]) || "INPUT", bad = rd && rd.pins && rd.pins[name] && rd.pins[name].damaged;
      const prog = part.program && part.program.out === name;
      b.rect.setAttribute("fill", bad ? "#5a1414" : mode === "HIGH" ? "#ff5a5a" : mode === "LOW" ? "#4d8dff" : "#0e2620");
      b.rect.setAttribute("stroke", prog ? "#ffc43d" : mode === "INPUT" && !bad ? "#9dffc8" : "#0d1418");
      b.rect.setAttribute("stroke-width", prog ? 2.4 : 1.2);
      b.txt.textContent = bad ? "✗" : mode === "HIGH" ? "H" : mode === "LOW" ? "L" : "IN";
    }
    if (!r.screen) return;
    const lines = [];
    if (rd && !rd.powered) lines.push("USB fuse tripped:", "the board is off");
    else if (sim && rd) {
      if (part.program) lines.push(`▶ ${U.programText(part.program)}`, { code: U.programCode(part.program) });
      for (const n of part.watch || []) {
        if (n[0] === "A") lines.push(`${n} reads ${rd.pins[n] && rd.pins[n].damaged ? "--" : rd.analog[n]}`);
        else { const q = U.reading(sim, part, n); lines.push(`${n} reads ${q.damaged ? "--" : q.read}`); }
      }
      if (!lines.length) lines.push("ready · 5 V");
    }
    r.screen.forEach((t, k) => {             // a line of code is smaller and paler, under its rule
      const l = lines[k] || "", code = typeof l === "object";
      t.textContent = code ? l.code : l;
      t.setAttribute("font-size", code ? 12.5 : 17); t.setAttribute("fill", code ? "#c9f5dd" : "#9dffc8");
    });
  }
  function partPoints(part) {
    return part.legs.map((pt) => (pt ? (pt.startsWith("U.") ? BB.Uno.socketXY(pt) : xy(pt)) : null));
  }

  function drawParts(doc, sim, selectedId) {
    L.parts.replaceChildren();
    L.fx.replaceChildren();
    refs.clear();
    // draw order: board parts by type, then off-board bodies and probes on top
    const order = ["uno", "wire", "resistor", "ldr", "pot", "button", "npn", "cap", "led", "battery", "meter"];
    BB.Uno.present = doc.parts.some((p) => p.type === "uno");
    const parts = [...doc.parts].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    for (const part of parts) {
      const rt = sim.rt.get(part.id);
      const g = el("g", { class: `part${part.id === selectedId ? " selected" : ""}`, "data-part": part.id }, L.parts);
      try {
        const pts = partPoints(part);
        const r = drawBody(g, part, pts, rt && rt.destroyed && part.type !== "meter", L.fx);
        r.g = g;
        refs.set(part.id, r);
        if (part.id === selectedId) drawSelection(g, part, pts);
      } catch (err) { BB.reportError && BB.reportError(err, `drawing ${part.type} ${part.id}`); }
    }
    if (BB.Flow) BB.Flow.rebuild(doc, sim);
  }

  function drawSelection(g, part, pts) {
    if (part.type === "battery" || part.type === "meter") return;
    const ps = pts.filter(Boolean);
    if (!ps.length) return;               // the Uno-style board has no legs; its body shows it is selected
    const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
    el("rect", { x: Math.min(...xs) - 16, y: Math.min(...ys) - 16, width: Math.max(...xs) - Math.min(...xs) + 32, height: Math.max(...ys) - Math.min(...ys) + 32, rx: 8, class: "sel-ring" }, g);
    if (part.legs.length === 2) pts.forEach((p, k) => p && el("circle", { cx: p[0], cy: p[1], r: 6, class: "handle", "data-handle": k, "data-id": part.id }, g));
  }

  // ---------- levels: the open part of the board, and the coach's marks ----------
  // Dim the rows, half and rails that this level keeps closed. One path, so overlapping pieces are not darker.
  function region(spec) {
    L.region.replaceChildren();
    if (!spec) return;
    const d = [], X1 = BOARD.x, X2 = BOARD.x + BOARD.w, Y1 = BOARD.y, Y2 = BOARD.y + BOARD.h;
    const rect = (x0, y0, x1, y1) => { if (x1 > x0 && y1 > y0) d.push(`M${x0} ${y0}H${x1}V${y1}H${x0}Z`); };
    const [r0, r1] = spec.rows || [1, ROWS];
    const xa = r0 > 1 ? xr(r0) - P / 2 : X1, xb = r1 < ROWS ? xr(r1) + P / 2 : X2;
    rect(X1, Y1, xa, Y2); rect(xb, Y1, X2, Y2);
    if (spec.cols !== "a-j") rect(xa, (Y.e + Y.f) / 2, xb, Y2);
    else if (spec.rails !== "all") rect(xa, (Y.j + Y["+B"]) / 2, xb, Y2);
    if (!spec.rails || spec.rails === "none") rect(xa, Y1, xb, (Y["-T"] + Y.a) / 2);
    el("path", { d: d.join(""), class: "region-off" }, L.region);
  }

  // Coach marks: pulsing outlines round holes, strips or rails, parts, or a control. Targets as in coach.js.
  function marks(targets) {
    L.coach.replaceChildren();
    [].concat(targets || []).forEach((t, k) => {          // one group per target, so the coach can find each one
      const g = el("g", { "data-t": k }, L.coach);
      for (const h of t.holes || []) { const [x, y] = xy(h); el("circle", { cx: x, cy: y, r: 11, class: "mark" }, g); }
      (t.probes || []).forEach((h, k) => {                  // where the red (0) and the black (1) probe tip should go
        if (!h) return;
        const [x, y] = xy(h);
        el("circle", { cx: x, cy: y, r: 12, class: `mark probe-ring ${k ? "black" : "red"}` }, g);
      });
      for (const n of [].concat(t.net || [], t.nets || [])) netMark(n.replace(/^bb:/, ""), g);
      for (const id of [].concat(t.part || [], t.parts || [])) boxMark(svg.querySelector(`[data-body="${id}"] [data-markbox]`) || svg.querySelector(`[data-body="${id}"]`) || svg.querySelector(`[data-part="${id}"]`), g);
      for (const c of [].concat(t.ctl || [])) boxMark(svg.querySelector(`[data-ctl="${c}"][data-id="${t.id}"]`), g, 6);
      if (t.lcd) boxMark(svg.querySelector(`[data-lcd="${t.lcd}"]`), g, 4);
    });
  }
  function netMark(n, g) {
    if (n[0] === "+" || n[0] === "-") { el("rect", { x: BOARD.x + 22, y: Y[n] - 11, width: BOARD.w - 34, height: 22, rx: 7, class: "mark" }, g); return; }
    const row = +n.slice(1), [y1, y2] = n[0] === "L" ? [Y.a, Y.e] : [Y.f, Y.j];
    el("rect", { x: xr(row) - 11, y: y1 - 11, width: 22, height: y2 - y1 + 22, rx: 7, class: "mark" }, g);
  }
  function boxMark(node, g, pad = 9) {
    if (!node) return;
    const b = node.getBBox();
    if (!b.width && !b.height) return;
    el("rect", { x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad, rx: 10, class: "mark" }, g);
  }

  // ---------- ghost ----------
  function ghost(type, legs, ok, part) {
    L.ui.replaceChildren();
    if (!legs) return;
    const g = el("g", { class: ok ? "ghost-ok" : "ghost-bad", "pointer-events": "none" }, L.ui);
    const fake = Object.assign({ type, value: 330, pos: 0.5, color: C.wires[0] }, part || {}, { legs });
    const pts = legs.map((l) => (l ? xy(l) : null));
    if (pts.every(Boolean)) drawBody(g, fake, pts, false);
    pts.forEach((p) => p && el("circle", { cx: p[0], cy: p[1], r: 5, class: "leg-tip" }, g));
  }
  function wireGhost(a, bxy) {
    L.ui.replaceChildren();
    if (!a) return;
    const pa = xy(a);
    el("path", { d: curve(pa, bxy, 16), stroke: "#ffb547", "stroke-width": 4, fill: "none", "stroke-dasharray": "6 5", "stroke-linecap": "round" }, L.ui);
  }
  // A part that is not in the holes (yet): drawn at the world points `pts`, following the pointer.
  function floatGhost(type, pts, part) {
    L.ui.replaceChildren();
    if (!pts || !pts.every(Boolean)) return;
    const g = el("g", { class: "ghost-free", "pointer-events": "none" }, L.ui);
    drawBody(g, Object.assign({ type, value: 330, pos: 0.5, color: C.wires[0] }, part || {}, { legs: pts.map(() => null) }), pts, false);
  }
  function clearGhost() { L.ui.replaceChildren(); }
  // The keyboard cursor: a ring on one hole (or board socket); `held` when something is being carried to it.
  function cursor(pt, held) {
    L.kb.replaceChildren();
    if (!pt) return;
    const [x, y] = pt.startsWith("U.") ? BB.Uno.socketXY(pt) : xy(pt);
    el("circle", { cx: x, cy: y, r: 12, fill: "none", stroke: held ? "#ffb547" : "#36c5ff", "stroke-width": 3, "stroke-dasharray": held ? null : "5 3" }, L.kb);
    el("circle", { cx: x, cy: y, r: 16, fill: "none", stroke: "#0b1422", "stroke-width": 1.5, opacity: 0.6 }, L.kb);
  }

  // Faint outline of a workbook layout, to copy from.
  function guide(parts) {
    L.guide.replaceChildren();
    if (!parts) return;
    const g = el("g", { opacity: 0.42 }, L.guide);
    for (const part of parts) {
      const pts = part.legs.map((l) => (l ? xy(l) : null));
      if (!pts.every(Boolean)) continue;
      drawBody(el("g", {}, g), part, pts, false);
      pts.forEach((p) => el("circle", { cx: p[0], cy: p[1], r: 6, fill: "none", stroke: "#ff3dc8", "stroke-width": 2, "stroke-dasharray": "3 2" }, g));   // the mark colour (game.css --mark)
    }
  }

  BB.Render = { cursor, setMinPitch: (v) => { MIN_PITCH = v; }, init, drawParts, unoLive, region, marks, fitBox, regionBox, boardBox, meterSize, setCtlLock, setInsets, ghost, floatGhost, wireGhost, clearGhost, guide, highlight, holeAt, toWorld, toScreen, zoomAt, pan, fit, fitAll, refit, contentBox, view, refs, xy, xr, el, layers: L, C, BOARD, LEDC };
})(window.BB = window.BB || {});
