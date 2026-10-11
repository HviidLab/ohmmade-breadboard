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
    leg: "#c7ccd1", legHi: "#f4f6f8", board: "#ece7dc", boardEdge: "#c9c1b0", strip: "#e1dbcd", hole: "#3a3d3f",
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
  function sprite(g, name, cx, cy, w, ang = 0, attrs = {}) {
    const [iw, ih] = A.size(name), h = (w * ih) / iw;
    return el("image", Object.assign({ href: A.url(name), x: cx - w / 2, y: cy - h / 2, width: w, height: h, preserveAspectRatio: "none",
      transform: ang ? `rotate(${ang} ${cx} ${cy})` : null }, attrs), g);
  }

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
      <pattern id="matgrid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="rgba(255,255,255,.045)" stroke-width="1"/></pattern>`;
    for (const [k, c] of Object.entries(LEDC)) {
      defs.insertAdjacentHTML("beforeend",
        `<radialGradient id="glow-${k}"><stop offset="0" stop-color="${c.glow[0]}" stop-opacity="1"/><stop offset=".18" stop-color="${c.glow[1]}" stop-opacity=".85"/><stop offset=".5" stop-color="${c.glow[2]}" stop-opacity=".32"/><stop offset="1" stop-color="${c.glow[2]}" stop-opacity="0"/></radialGradient>` +
        `<radialGradient id="dome-${k}" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="${c.dome[0]}"/><stop offset=".55" stop-color="${c.dome[1]}"/><stop offset="1" stop-color="${c.dome[2]}"/></radialGradient>` +
        (c.matrix ? `<filter id="tint-${k}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${c.matrix}"/></filter>` : ""));
    }
    world = el("g", { id: "world" }, svg);
    if (A.has("bg_mat")) {
      el("rect", { x: -4000, y: -3000, width: 9000, height: 7000, fill: "#0e1d18" }, world);
      el("image", { href: A.url("bg_mat"), x: -900, y: -650, width: 3400, height: 1912, preserveAspectRatio: "none" }, world);
      el("rect", { x: -900, y: -650, width: 3400, height: 1912, fill: "#06110d", opacity: 0.38 }, world);
    } else el("rect", { x: -4000, y: -3000, width: 9000, height: 7000, fill: "url(#matgrid)" }, world);
    // layers, bottom to top; only the board and the parts take the pointer
    for (const k of ["board", "xray", "region", "guide", "hi", "parts", "flow", "fx", "coach", "ui"]) L[k] = el("g", { id: `L-${k}`, "pointer-events": k === "board" || k === "parts" ? null : "none" }, world);
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
  function fitBox(x0, y0, x1, y1) {
    lastBox = [x0, y0, x1, y1];
    const r = svg.getBoundingClientRect();
    const W = Math.max(r.width - insets.left - insets.right, 100), H = Math.max(r.height - insets.top - insets.bottom, 100);
    view.k = Math.max(0.2, Math.min(2.2, W / (x1 - x0), H / (y1 - y0)));
    view.tx = insets.left - x0 * view.k + (W - (x1 - x0) * view.k) / 2;
    view.ty = insets.top - y0 * view.k + (H - (y1 - y0) * view.k) / 2;
    apply();
  }
  // World box around a level's open board area and its battery pack.
  function regionBox(region, doc) {
    const [r0, r1] = region.rows || [1, ROWS], bat = doc.parts.find((p) => p.type === "battery");
    const x0 = Math.min(xr(r0) - 50, bat ? (bat.bx ?? 40) - 10 : Infinity), x1 = Math.max(xr(r1) + 40, bat ? (bat.bx ?? 40) + 240 : -Infinity);
    const y0 = bat ? (bat.by ?? -150) - 12 : Y["+T"] - 40, y1 = (region.cols === "a-j" ? Y.j : Y.e) + 34;
    return [x0, y0, x1, y1];
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
    el("rect", { x: BOARD.x, y: BOARD.y, width: BOARD.w, height: BOARD.h, rx: 10, fill: C.board, stroke: C.boardEdge, "stroke-width": 1.5, filter: "url(#shadow)" }, g);
    // centre channel
    el("rect", { x: BOARD.x + 6, y: (Y.e + Y.f) / 2 - 7, width: BOARD.w - 12, height: 14, rx: 3, fill: "#d9d2c3" }, g);
    // rail stripes
    for (const [k, col, side] of [["+T", C.pos, -1], ["-T", C.gnd, 1], ["+B", C.pos, -1], ["-B", C.gnd, 1]]) {
      el("line", { x1: BOARD.x + 26, x2: BOARD.x + BOARD.w - 12, y1: Y[k] + side * 12, y2: Y[k] + side * 12, stroke: col, "stroke-width": 2, opacity: 0.85 }, g);
      el("text", { x: BOARD.x + 10, y: Y[k] + 5, fill: col, "font-family": "IBM Plex Mono, monospace", "font-size": 15, "font-weight": 600 }, g).textContent = k[0] === "+" ? "+" : "−";
    }
    for (const c of "abcdefghij") el("text", { x: BOARD.x + 12, y: Y[c] + 4, fill: "#8f8676", "font-family": "IBM Plex Mono, monospace", "font-size": 11 }, g).textContent = c;
    // holes (one path per column type for speed)
    const d = [];
    for (let r = 1; r <= ROWS; r++) for (const c of COLS) d.push(`M${xr(r) - 3.2} ${Y[c] - 3.2}h6.4v6.4h-6.4z`);
    el("path", { d: d.join(""), fill: C.hole }, g);
    for (let r = 1; r <= ROWS; r++) if (r === 1 || r % 5 === 0) {
      el("text", { x: xr(r), y: Y.a - 16, "text-anchor": "middle", fill: "#8f8676", "font-family": "IBM Plex Mono, monospace", "font-size": 10 }, g).textContent = r;
      el("text", { x: xr(r), y: Y.j + 22, "text-anchor": "middle", fill: "#8f8676", "font-family": "IBM Plex Mono, monospace", "font-size": 10 }, g).textContent = r;
    }
  }

  // Highlight every hole in the same net as `pt` (strip or rail).
  function highlight(pt) {
    L.hi.replaceChildren();
    if (!pt || pt.startsWith("U.")) return;
    const p = BBShared.parse(pt);
    if (p.kind === "rail") el("rect", { x: BOARD.x + 22, y: Y[p.rail] - 9, width: BOARD.w - 34, height: 18, rx: 5, class: "strip-hi" }, L.hi);
    else {
      const top = "abcde".includes(p.col);
      const [y1, y2] = top ? [Y.a, Y.e] : [Y.f, Y.j];
      el("rect", { x: xr(p.row) - 9, y: y1 - 9, width: 18, height: y2 - y1 + 18, rx: 5, class: "strip-hi" }, L.hi);
    }
  }

  // ---------- parts ----------
  const refs = new Map();      // part id -> {glow, body, ...} for per-frame updates

  function leg(g, a, b, w = 2.4) {
    el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.leg, "stroke-width": w, "stroke-linecap": "round" }, g);
    el("line", { x1: a[0], y1: a[1] - 0.6, x2: b[0], y2: b[1] - 0.6, stroke: C.legHi, "stroke-width": 0.8, opacity: 0.7, "stroke-linecap": "round" }, g);
  }
  function curve(a, b, bend) { return BBShared.curve(a, b, bend); }

  function bandColors(v) {
    const s = String(Math.round(v)), d1 = +s[0], d2 = +(s[1] || 0), z = Math.max(s.length - 2, 0);
    return [BANDS[d1], BANDS[d2], BANDS[z], "#c9a227"];
  }

  // Draw one part into group g. dead = destroyed. Returns refs for dynamic updates.
  function drawBody(g, part, pts, dead, fx = null) {
    const r = {};
    const [a, b] = pts;
    const mid = a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : null;
    switch (part.type) {
      case "resistor": {
        leg(g, a, b);
        if (A.has("resistor_body")) {
          const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
          const w = Math.max(48, Math.min(74, Math.hypot(b[0] - a[0], b[1] - a[1]) + 14)), h = (w * A.size("resistor_body")[1]) / A.size("resistor_body")[0];
          const body = el("g", { transform: `translate(${mid[0]} ${mid[1]}) rotate(${ang})` }, g);
          sprite(body, dead ? "resistor_charred" : "resistor_body", 0, 0, w);
          const bx0 = -w / 2 + 0.29 * w, bw = 0.42 * w;
          if (!dead) bandColors(part.value).forEach((c, k) => el("rect", { x: bx0 + 2 + k * (bw - 6) / 3.6 + (k === 3 ? 3 : 0), y: -h * 0.3, width: 2.8, height: h * 0.6, fill: c, opacity: 0.92 }, body));
          r.heat = el("rect", { x: bx0 - 2, y: -h * 0.32, width: bw + 4, height: h * 0.64, rx: 5, fill: "#ff5a1a", opacity: 0 }, body);
          break;
        }
        const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        const len = Math.min(36, Math.max(18, Math.hypot(b[0] - a[0], b[1] - a[1]) - 8));
        const body = el("g", { transform: `translate(${mid[0]} ${mid[1]}) rotate(${ang})` }, g);
        r.body = el("rect", { x: -len / 2, y: -7, width: len, height: 14, rx: 6, fill: dead ? "#3b2a1c" : "url(#resBody)", stroke: dead ? "#1a120c" : C.resEdge, "stroke-width": 1 }, body);
        if (!dead) bandColors(part.value).forEach((c, k) => el("rect", { x: -len / 2 + 6 + k * (len - 14) / 3.4 + (k === 3 ? 3 : 0), y: -7, width: 3.2, height: 14, fill: c }, body));
        else el("path", { d: `M${-len / 2 + 4} -3 l6 5 l5 -6 l6 7`, stroke: "#120b06", "stroke-width": 2, fill: "none" }, body);
        r.heat = el("rect", { x: -len / 2, y: -7, width: len, height: 14, rx: 6, fill: "#ff5a1a", opacity: 0 }, body);
        break;
      }
      case "wire": {
        const col = part.color || C.wires[0];
        r.track = curve(a, b, 16);
        r.path = el("path", { d: r.track, stroke: dead ? "#4a3a2a" : col, "stroke-width": 4.2, fill: "none", "stroke-linecap": "round", "stroke-dasharray": dead ? "3 4" : null }, g);
        el("path", { d: curve(a, b, 16), stroke: "#fff", "stroke-width": 1.2, fill: "none", opacity: 0.25, transform: "translate(-.6 -.8)" }, g);
        for (const p of [a, b]) el("rect", { x: p[0] - 2.5, y: p[1] - 2.5, width: 5, height: 5, fill: "#b8bec4" }, g);
        r.glow = el("path", { d: curve(a, b, 16), stroke: "#ff8a3a", "stroke-width": 10, fill: "none", opacity: 0, filter: "url(#soft)" }, g);
        break;
      }
      case "led": {
        leg(g, a, mid); leg(g, b, mid);
        const col = ledc(part);
        r.glowFill = `url(#glow-${col})`;
        if (A.has("probe_led_off")) {
          r.glow = el("circle", { cx: mid[0], cy: mid[1], r: 34, fill: r.glowFill, opacity: 0 }, fx || g);
          const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
          sprite(g, dead ? "led_burnt" : "probe_led_off", mid[0], mid[1], 26, ang, { filter: LEDC[col].matrix ? `url(#tint-${col})` : null });
          r.core = el("circle", { cx: mid[0], cy: mid[1], r: 5, fill: "#fff6e0", opacity: 0 }, g);
          el("text", { x: a[0] - 4, y: a[1] + 17, fill: C.pos, "font-family": "IBM Plex Mono, monospace", "font-size": 11, "font-weight": 600 }, g).textContent = "+";
          break;
        }
        r.glow = el("circle", { cx: mid[0], cy: mid[1], r: 34, fill: r.glowFill, opacity: 0 }, fx || g);
        const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        const dome = el("g", { transform: `translate(${mid[0]} ${mid[1]}) rotate(${ang})` }, g);
        el("path", { d: "M-11 0 A11 11 0 1 1 8.5 7 L8.5 -7 A11 11 0 0 1 -11 0Z", fill: "rgba(0,0,0,.35)", transform: "translate(2 3)" }, dome);
        r.body = el("path", { d: "M8.5 -7 A11 11 0 1 0 8.5 7 Z", fill: dead ? "url(#domeDead)" : `url(#dome-${col})`, stroke: dead ? "#2a1a1a" : LEDC[col].edge, "stroke-width": 1 }, dome);
        if (dead) el("path", { d: "M-6 -6 l4 5 l-3 4 l5 4", stroke: "#111", "stroke-width": 1.4, fill: "none" }, dome);
        r.core = el("circle", { cx: -2, cy: 0, r: 4, fill: "#fff6e0", opacity: 0 }, dome);
        el("text", { x: a[0] - 4, y: a[1] + 17, fill: C.pos, "font-family": "IBM Plex Mono, monospace", "font-size": 11, "font-weight": 600 }, g).textContent = "+";
        break;
      }
      case "cap": {
        leg(g, a, mid); leg(g, b, mid);
        if (A.has("cap_top")) {
          const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
          sprite(g, dead ? "cap_vented" : "cap_top", mid[0], mid[1], part.value >= 1e-3 ? 34 : part.value >= 1e-4 ? 26 : 20, ang);
          el("text", { x: a[0] - 4, y: a[1] + 19, fill: C.pos, "font-family": "IBM Plex Mono, monospace", "font-size": 11, "font-weight": 600 }, g).textContent = "+";
          break;
        }
        const big = part.value >= 1e-3, rr = big ? 15 : 11;
        el("circle", { cx: mid[0] + 2, cy: mid[1] + 3, r: rr, fill: "rgba(0,0,0,.35)" }, g);
        r.body = el("circle", { cx: mid[0], cy: mid[1], r: rr, fill: dead ? "#2c2f36" : "url(#capTop)", stroke: "#162650", "stroke-width": 1 }, g);
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const sx = mid[0] + Math.cos(ang) * rr * 0.62, sy = mid[1] + Math.sin(ang) * rr * 0.62;
        el("circle", { cx: sx, cy: sy, r: rr * 0.32, fill: "#c9d4ee", opacity: 0.85 }, g);
        el("path", { d: `M${mid[0] - rr * 0.5} ${mid[1]}h${rr}M${mid[0]} ${mid[1] - rr * 0.5}v${rr}`, stroke: dead ? "#ffb08a" : "#aab8dd", "stroke-width": 1.4, opacity: 0.8 }, g);
        el("text", { x: a[0] - 4, y: a[1] + 19, fill: C.pos, "font-family": "IBM Plex Mono, monospace", "font-size": 11, "font-weight": 600 }, g).textContent = "+";
        break;
      }
      case "ldr": {
        leg(g, a, b);
        if (A.has("ldr")) { sprite(g, "ldr", mid[0], mid[1], 24); break; }
        el("circle", { cx: mid[0] + 1.5, cy: mid[1] + 2.5, r: 10, fill: "rgba(0,0,0,.35)" }, g);
        r.body = el("circle", { cx: mid[0], cy: mid[1], r: 10, fill: "#e9c46a", stroke: "#a67c2a" }, g);
        el("path", { d: `M${mid[0] - 7} ${mid[1] - 3}h3v6h3v-6h3v6h3v-6h3`, stroke: "#8b3a1a", "stroke-width": 1.4, fill: "none" }, g);
        break;
      }
      case "pot": {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        if (A.has("pot_body")) {
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
          sprite(g, "pot_body", cx, cy, 58, 0, { opacity: dead ? 0.55 : 1 });
          const knob = el("g", { class: "ctl", "data-ctl": "knob", "data-id": part.id }, g);
          el("circle", { cx, cy, r: 14, fill: "transparent" }, knob);
          const ang = (-135 + 270 * (part.pos ?? 0.5)) * Math.PI / 180;
          r.pointer = el("line", { x1: cx, y1: cy, x2: cx + Math.sin(ang) * 9, y2: cy - Math.cos(ang) * 9, stroke: "#5b6066", "stroke-width": 3, "stroke-linecap": "round" }, knob);
          break;
        }
        const x0 = Math.min(...xs) - 14, x1 = Math.max(...xs) + 14, y0 = Math.min(...ys) - 16, y1 = Math.max(...ys) + 16;
        el("rect", { x: x0 + 2, y: y0 + 3, width: x1 - x0, height: y1 - y0, rx: 5, fill: "rgba(0,0,0,.35)" }, g);
        r.body = el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 5, fill: dead ? "#2b2f36" : C.pot, stroke: "#123a6b" }, g);
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const knob = el("g", { class: "ctl", "data-ctl": "knob", "data-id": part.id }, g);
        el("circle", { cx, cy, r: 13, fill: "#e9ecef", stroke: "#9aa3a8" }, knob);
        const ang = (-135 + 270 * (part.pos ?? 0.5)) * Math.PI / 180;
        r.pointer = el("line", { x1: cx, y1: cy, x2: cx + Math.sin(ang) * 10, y2: cy - Math.cos(ang) * 10, stroke: "#333", "stroke-width": 2.5, "stroke-linecap": "round" }, knob);
        break;
      }
      case "npn": {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        if (A.has("npn_to92")) {
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = Math.min(...ys);
          sprite(g, dead ? "npn_burnt" : "npn_to92", cx, cy, 54);
          ["C", "B", "E"].forEach((t, k) => el("text", { x: pts[k][0], y: cy + 31, "text-anchor": "middle", fill: "#e9ecef", stroke: "#111", "stroke-width": 2.5, "paint-order": "stroke", "font-family": "IBM Plex Mono, monospace", "font-size": 10, "font-weight": 600 }, g).textContent = t);
          break;
        }
        const x0 = Math.min(...xs) - 12, x1 = Math.max(...xs) + 12, yc = Math.min(...ys);
        r.body = el("path", { d: `M${x0} ${yc - 12}H${x1}V${yc + 2}Q${(x0 + x1) / 2} ${yc + 26} ${x0} ${yc + 2}Z`, fill: dead ? "#3a2a22" : C.npn, stroke: "#000", filter: "url(#shadow)" }, g);
        ["C", "B", "E"].forEach((t, k) => el("text", { x: pts[k][0], y: yc + 5, "text-anchor": "middle", fill: "#e9ecef", "font-family": "IBM Plex Mono, monospace", "font-size": 10, "font-weight": 600 }, g).textContent = t);
        if (dead) el("circle", { cx: (x0 + x1) / 2, cy: yc, r: 6, fill: "#5a3a2a", opacity: 0.8 }, g);
        break;
      }
      case "button": {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        if (A.has("button")) {
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
          sprite(g, "button", cx, cy, 70);
          const cap = el("g", { class: "ctl", "data-ctl": "press", "data-id": part.id }, g);
          r.cap = el("circle", { cx, cy, r: 15, fill: part.pressed ? "rgba(0,0,0,.45)" : "transparent" }, cap);
          break;
        }
        const x0 = Math.min(...xs) - 11, x1 = Math.max(...xs) + 11, y0 = Math.min(...ys) - 11, y1 = Math.max(...ys) + 11;
        el("rect", { x: x0 + 2, y: y0 + 3, width: x1 - x0, height: y1 - y0, rx: 4, fill: "rgba(0,0,0,.35)" }, g);
        r.body = el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 4, fill: C.btn, stroke: "#1b1e21" }, g);
        const cap = el("g", { class: "ctl", "data-ctl": "press", "data-id": part.id }, g);
        r.cap = el("circle", { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r: Math.min(x1 - x0, y1 - y0) * 0.3, fill: part.pressed ? "#6b737a" : "#9aa3a8", stroke: "#2b3035" }, cap);
        break;
      }
      case "battery": drawBattery(g, part, pts, r, dead); break;
      case "meter": drawMeter(g, part, pts, r); break;
      case "uno": drawUno(g, part, r); break;
    }
    return r;
  }

  function drawBattery(g, part, pts, r, dead) {
    if (A.has("battery_holder")) return drawBatterySprite(g, part, pts, r, dead);
    const bx = part.bx ?? 40, by = part.by ?? -150, W = 210, H = 74;
    const body = el("g", { "data-body": part.id }, g);
    el("rect", { x: bx + 3, y: by + 5, width: W, height: H, rx: 8, fill: "rgba(0,0,0,.4)" }, body);
    el("rect", { x: bx, y: by, width: W, height: H, rx: 8, fill: "#24282c", stroke: "#0f1113" }, body);
    for (let k = 0; k < 4; k++) {
      const cy = by + 10 + k * 14;
      el("rect", { x: bx + 34, y: cy, width: 140, height: 12, rx: 5, fill: dead ? "#4a3c2a" : k % 2 ? "#5b6066" : "#c1661c", stroke: "#0f1113", "stroke-width": 0.8 }, body);
      el("rect", { x: bx + (k % 2 ? 34 : 168), y: cy + 3, width: 6, height: 6, fill: "#c9ced3" }, body);
    }
    const sw = el("g", { class: "ctl", "data-ctl": "switch", "data-id": part.id }, body);
    el("rect", { x: bx + 182, y: by + 20, width: 20, height: 34, rx: 4, fill: "#111" }, sw);
    r.sw = el("rect", { x: bx + 185, y: by + (part.on !== false ? 23 : 37), width: 14, height: 14, rx: 3, fill: part.on !== false ? "#6fdc8c" : "#7b8288" }, sw);
    el("text", { x: bx + 8, y: by + 42, fill: "#9aa3a8", "font-family": "IBM Plex Mono, monospace", "font-size": 10, transform: `rotate(-90 ${bx + 12} ${by + 40})` }, body).textContent = "4×AA";
    // leads
    leads(g, [[bx + 60, by + H], [bx + 110, by + H]], pts, part, ["#d64545", "#1a1a1a"], 60, r);
  }

  // Battery leads from the holder to their holes. r.leads keeps each lead's path (holder → hole) for the current flow.
  function leads(g, ends, pts, part, cols, drop, r) {
    r.leads = [];
    pts.forEach((p, k) => {
      const end = p || part.loose?.[k] || [ends[k][0], ends[k][1] + 40];
      const d = `M${ends[k][0]} ${ends[k][1]} C ${ends[k][0]} ${ends[k][1] + drop}, ${end[0]} ${end[1] - 60}, ${end[0]} ${end[1]}`;
      r.leads[k] = d;
      el("path", { d, stroke: cols[k], "stroke-width": 3.4, fill: "none", "stroke-linecap": "round" }, g);
      el("rect", { x: end[0] - 3, y: end[1] - 3, width: 6, height: 6, fill: "#b8bec4" }, g);
      el("circle", { cx: end[0], cy: end[1], r: 9, fill: "transparent", class: "lead-end", "data-handle": k, "data-id": part.id, style: "cursor:grab" }, g);
    });
  }

  function drawBatterySprite(g, part, pts, r, dead) {
    const bx = part.bx ?? 40, by = part.by ?? -150, W = 230, [iw, ih] = A.size("battery_holder"), H = (W * ih) / iw;
    const body = el("g", { "data-body": part.id }, g);
    el("image", { href: A.url("battery_holder"), x: bx, y: by, width: W, height: H, preserveAspectRatio: "none", opacity: dead ? 0.6 : 1 }, body);
    const [sx, sy] = A.anchor("battery_holder").switch || [0.83, 0.12];
    const sw = el("g", { class: "ctl", "data-ctl": "switch", "data-id": part.id }, body);
    const on = part.on !== false;
    el("rect", { x: bx + sx * W - 20, y: by + sy * H - 9, width: 40, height: 18, rx: 9, fill: on ? "#1f6b3a" : "#3a3f44", stroke: "#0b0d0e" }, sw);
    r.sw = el("circle", { cx: bx + sx * W + (on ? 10 : -10), cy: by + sy * H, r: 7, fill: on ? "#6fdc8c" : "#9aa3a8" }, sw);
    el("text", { x: bx + sx * W, y: by + sy * H + 22, "text-anchor": "middle", fill: "#e9ecef", "font-family": "IBM Plex Mono, monospace", "font-size": 9 }, body).textContent = on ? "ON" : "OFF";
    if (dead) el("text", { x: bx + W / 2, y: by + H / 2, "text-anchor": "middle", fill: "#ffb08a", "font-family": "IBM Plex Mono, monospace", "font-size": 13, "font-weight": 600 }, body).textContent = "LEAKING";
    leads(g, [[bx + W * 0.3, by + H - 10], [bx + W * 0.45, by + H - 10]], pts, part, ["#d64545", "#1a1a1a"], 60, r);
  }

  function drawMeterSprite(g, part, pts, r) {
    const bx = part.bx ?? 60, by = part.by ?? 560, Wi = 270, [iw, ih] = A.size("meter_body"), Hi = (Wi * ih) / iw, an = A.anchor("meter_body");
    const P_ = (fx, fy) => [bx + fx * Wi, by + fy * Hi];
    const body = el("g", { "data-body": part.id }, g);
    el("image", { href: A.url("meter_body"), x: bx, y: by, width: Wi, height: Hi, preserveAspectRatio: "none" }, body);
    // live LCD
    const [l0, t0] = P_(an.lcd[0], an.lcd[1]), [l1, t1] = P_(an.lcd[2], an.lcd[3]);
    r.lcd = el("text", { x: l1 - 10, y: t1 - 16, "text-anchor": "end", fill: "#1a2418", "font-family": "IBM Plex Mono, monospace", "font-size": 34, "font-weight": 600 }, body);
    r.lcdUnit = el("text", { x: l0 + 8, y: t0 + 16, fill: "#33452f", "font-family": "IBM Plex Mono, monospace", "font-size": 13, "font-weight": 600 }, body);
    // rotating knob: a clipped copy of the sprite, turned to the selected mode
    const [cx, cy] = P_(an.dial[0], an.dial[1]), kr = an.dial[2] * Wi;
    const cid = `knob-${part.id}`;
    const defs = el("clipPath", { id: cid }, body);
    el("circle", { cx, cy, r: kr * 0.93 }, defs);
    const cur = DIAL.find((d) => d[0] === (part.mode || "V")) || DIAL[1];
    el("circle", { cx, cy, r: kr * 0.93, fill: "#2b2f33" }, body);
    el("image", { href: A.url("meter_body"), x: bx, y: by, width: Wi, height: Hi, preserveAspectRatio: "none", "clip-path": `url(#${cid})`, transform: `rotate(${cur[2] - an.dialAngle} ${cx} ${cy})` }, body);
    for (const [mode, lbl, deg] of DIAL) {
      const a = (deg - 90) * Math.PI / 180, lx = cx + Math.cos(a) * (kr + 17), ly = cy + Math.sin(a) * (kr + 17);
      const t = el("g", { class: "ctl", "data-ctl": `mode:${mode}`, "data-id": part.id }, body);
      el("circle", { cx: lx, cy: ly, r: 14, fill: "transparent" }, t);
      el("text", { x: lx, y: ly + 4, "text-anchor": "middle", fill: (part.mode || "V") === mode ? "#ffb547" : "#d6dade", "font-family": "IBM Plex Mono, monospace", "font-size": 12, "font-weight": 600 }, t).textContent = lbl;
    }
    // sockets
    const sock = {};
    for (const [k, [fx, fy]] of Object.entries(an.sockets)) {
      const [sx, sy] = P_(fx, fy); sock[k] = [sx, sy];
      const t = el("g", { class: k === "COM" ? "" : "ctl", "data-ctl": k === "COM" ? null : `socket:${k}`, "data-id": part.id }, body);
      el("circle", { cx: sx, cy: sy, r: 13, fill: "transparent" }, t);
      el("text", { x: sx, y: sy - 17, "text-anchor": "middle", fill: "#d6dade", "font-family": "IBM Plex Mono, monospace", "font-size": 10 }, t).textContent = k === "VO" ? "VΩ" : k;
    }
    const from = [sock[part.socket === "mA" ? "mA" : "VO"], sock.COM];
    el("circle", { cx: from[0][0], cy: from[0][1], r: 5, fill: "#d64545" }, body);
    el("circle", { cx: from[1][0], cy: from[1][1], r: 5, fill: "#1a1a1a" }, body);
    probes(g, part, pts, from, r);
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
      el("path", { d: `M${tip[0]} ${tip[1]} l-4 8 v16 h8 v-16z`, fill: cols[k], stroke: "#000", "stroke-width": 0.8 }, pr);
      el("circle", { cx: tip[0], cy: tip[1], r: 3, fill: "#e9ecef" }, pr);
    });
  }

  const DIAL = [["off", "OFF", -60], ["V", "V⎓", -20], ["mA", "mA", 20], ["ohm", "Ω", 60], ["cont", "·)))", 100]];
  function drawMeter(g, part, pts, r) {
    if (A.has("meter_body")) return drawMeterSprite(g, part, pts, r);
    const bx = part.bx ?? 60, by = part.by ?? 560, W = 190, H = 270;
    const body = el("g", { "data-body": part.id }, g);
    el("rect", { x: bx + 4, y: by + 6, width: W, height: H, rx: 18, fill: "rgba(0,0,0,.45)" }, body);
    el("rect", { x: bx, y: by, width: W, height: H, rx: 18, fill: "#e5b622", stroke: "#8a6a0a", "stroke-width": 1.5 }, body);
    el("rect", { x: bx + 10, y: by + 10, width: W - 20, height: H - 20, rx: 12, fill: "#23272b" }, body);
    el("rect", { x: bx + 22, y: by + 22, width: W - 44, height: 52, rx: 5, fill: "#9db39a" }, body);
    r.lcd = el("text", { x: bx + W - 30, y: by + 60, "text-anchor": "end", fill: "#1a2418", "font-family": "IBM Plex Mono, monospace", "font-size": 26, "font-weight": 600 }, body);
    r.lcdUnit = el("text", { x: bx + 30, y: by + 40, fill: "#33452f", "font-family": "IBM Plex Mono, monospace", "font-size": 11 }, body);
    // dial
    const cx = bx + W / 2, cy = by + 146;
    el("circle", { cx, cy, r: 40, fill: "#15181b", stroke: "#3a3f44", "stroke-width": 2 }, body);
    for (const [mode, lbl, deg] of DIAL) {
      const a = (deg - 90) * Math.PI / 180;
      const t = el("g", { class: "ctl", "data-ctl": `mode:${mode}`, "data-id": part.id }, body);
      el("circle", { cx: cx + Math.cos(a) * 58, cy: cy + Math.sin(a) * 58, r: 14, fill: "transparent" }, t);
      el("text", { x: cx + Math.cos(a) * 58, y: cy + Math.sin(a) * 58 + 4, "text-anchor": "middle", fill: (part.mode || "V") === mode ? "#ffb547" : "#c9ced3", "font-family": "IBM Plex Mono, monospace", "font-size": 11, "font-weight": 600 }, t).textContent = lbl;
    }
    const cur = DIAL.find((d) => d[0] === (part.mode || "V")) || DIAL[1];
    const pa = (cur[2] - 90) * Math.PI / 180;
    el("line", { x1: cx, y1: cy, x2: cx + Math.cos(pa) * 34, y2: cy + Math.sin(pa) * 34, stroke: "#e9ecef", "stroke-width": 5, "stroke-linecap": "round" }, body);
    el("circle", { cx, cy, r: 10, fill: "#2b3035" }, body);
    // sockets: mA, COM, VΩ
    const sock = { mA: [bx + 46, by + 236], COM: [bx + 95, by + 236], VO: [bx + 144, by + 236] };
    for (const [k, [sx, sy]] of Object.entries(sock)) {
      const t = el("g", { class: k === "COM" ? "" : "ctl", "data-ctl": k === "COM" ? null : `socket:${k}`, "data-id": part.id }, body);
      el("circle", { cx: sx, cy: sy, r: 10, fill: "#0d0f11", stroke: k === "COM" ? "#555" : k === "mA" ? "#c9a227" : "#d64545", "stroke-width": 2 }, t);
      el("text", { x: sx, y: sy - 15, "text-anchor": "middle", fill: "#c9ced3", "font-family": "IBM Plex Mono, monospace", "font-size": 10 }, t).textContent = k === "VO" ? "VΩ" : k;
    }
    // leads and probe tips
    const from = [sock[part.socket === "mA" ? "mA" : "VO"], sock.COM];
    probes(g, part, pts.map((p, k) => p || part.loose?.[k] || [bx + 60 + k * 70, by - 40]), from, r);
  }

  function drawUno(g, part, r) {
    const U = BB.Uno, bx = part.bx ?? U.pos.bx, by = part.by ?? U.pos.by;
    U.pos.bx = bx; U.pos.by = by;
    const body = el("g", { "data-body": part.id }, g);
    if (!A.has("uno_board")) el("rect", { x: bx + 6, y: by + 10, width: U.W, height: U.H, rx: 14, fill: "rgba(0,0,0,.45)" }, body);
    if (A.has("uno_board")) el("image", { href: A.url("uno_board"), x: bx, y: by, width: U.W, height: U.H, preserveAspectRatio: "none" }, body);
    else el("rect", { x: bx, y: by, width: U.W, height: U.H, rx: 14, fill: "#1d5fa8", stroke: "#0d3466" }, body);
    const rd = BB.Game && BB.Game.sim ? BB.Game.sim.read(part.id) : null;
    // on-board LEDs: ON (power) and L (pin 13)
    r.onLed = el("circle", { cx: bx + 0.848 * U.W, cy: by + 0.288 * U.H, r: 9, fill: "url(#glowGreen)", opacity: 0 }, body);
    r.lLed = el("circle", { cx: bx + 0.45 * U.W, cy: by + 0.405 * U.H, r: 9, fill: "url(#glowAmber)", opacity: 0 }, body);
    for (const sk of U.SOCKETS) {
      const [sx, sy] = [bx + sk.fx * U.W, by + sk.fy * U.H], name = sk.name, usable = U.usable(`U.${name}`);
      el("rect", { x: sx - 5, y: sy - 5, width: 10, height: 10, fill: "#0b0c0d", stroke: "#2a2d30" }, body);
      const lbl = name.replace(/^GND\d$/, "GND").replace("3V3", "3.3V");
      el("text", { x: sx, y: sk.top ? sy + 20 : sy - 12, "text-anchor": "middle", fill: usable ? "#f1f3f5" : "#8fa6c2", "font-family": "IBM Plex Mono, monospace", "font-size": 9, "font-weight": 600, transform: `rotate(-90 ${sx} ${sk.top ? sy + 20 : sy - 12})`, "dominant-baseline": "middle", "text-anchor": sk.top ? "end" : "start" }, body).textContent = lbl;
      if (U.DIGITAL.includes(name)) {
        const pin = rd && rd.pins[name], mode = (part.pins && part.pins[name]) || "INPUT";
        const t = el("g", { class: "ctl", "data-ctl": `pin:${name}`, "data-id": part.id }, body);
        const col = pin && pin.damaged ? "#7a1f1f" : mode === "HIGH" ? "#d64545" : mode === "LOW" ? "#3b4a5c" : "#1d2a36";
        el("rect", { x: sx - 9, y: sy + 46, width: 18, height: 14, rx: 4, fill: col, stroke: "#0b0c0d" }, t);
        el("text", { x: sx, y: sy + 56, "text-anchor": "middle", fill: "#f1f3f5", "font-family": "IBM Plex Mono, monospace", "font-size": 8.5, "font-weight": 600 }, t).textContent = pin && pin.damaged ? "✗" : mode === "HIGH" ? "H" : mode === "LOW" ? "L" : "in";
      }
      if (rd && rd.pins[name] && rd.pins[name].damaged) el("path", { d: `M${sx - 6} ${sy - 6}l12 12m0 -12l-12 12`, stroke: "#ff6b6b", "stroke-width": 2 }, body);
    }
    el("text", { x: bx + 18, y: by + U.H - 14, fill: "#dbe7f5", "font-family": "IBM Plex Mono, monospace", "font-size": 11 }, body).textContent = "Uno-style board · USB 5 V";
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
    for (const t of [].concat(targets || [])) {
      for (const h of t.holes || []) { const [x, y] = xy(h); el("circle", { cx: x, cy: y, r: 11, class: "mark" }, L.coach); }
      for (const n of [].concat(t.net || [], t.nets || [])) netMark(n.replace(/^bb:/, ""));
      for (const id of [].concat(t.part || [], t.parts || [])) boxMark(svg.querySelector(`[data-body="${id}"]`) || svg.querySelector(`[data-part="${id}"]`));
      if (t.ctl) boxMark(svg.querySelector(`[data-ctl="${t.ctl}"][data-id="${t.id}"]`), 6);
    }
  }
  function netMark(n) {
    if (n[0] === "+" || n[0] === "-") { el("rect", { x: BOARD.x + 22, y: Y[n] - 11, width: BOARD.w - 34, height: 22, rx: 7, class: "mark" }, L.coach); return; }
    const row = +n.slice(1), [y1, y2] = n[0] === "L" ? [Y.a, Y.e] : [Y.f, Y.j];
    el("rect", { x: xr(row) - 11, y: y1 - 11, width: 22, height: y2 - y1 + 22, rx: 7, class: "mark" }, L.coach);
  }
  function boxMark(node, pad = 9) {
    if (!node) return;
    const b = node.getBBox();
    if (!b.width && !b.height) return;
    el("rect", { x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad, rx: 10, class: "mark" }, L.coach);
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

  // Faint outline of a workbook layout, to copy from.
  function guide(parts) {
    L.guide.replaceChildren();
    if (!parts) return;
    const g = el("g", { opacity: 0.42 }, L.guide);
    for (const part of parts) {
      const pts = part.legs.map((l) => (l ? xy(l) : null));
      if (!pts.every(Boolean)) continue;
      drawBody(el("g", {}, g), part, pts, false);
      pts.forEach((p) => el("circle", { cx: p[0], cy: p[1], r: 6, fill: "none", stroke: "#ffb547", "stroke-width": 2, "stroke-dasharray": "3 2" }, g));
    }
  }

  BB.Render = { init, drawParts, region, marks, fitBox, regionBox, setInsets, ghost, floatGhost, wireGhost, clearGhost, guide, highlight, holeAt, toWorld, toScreen, zoomAt, pan, fit, fitAll, refit, contentBox, view, refs, xy, xr, el, layers: L, C, BOARD, LEDC };
})(window.BB = window.BB || {});
