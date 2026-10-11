// Current flow: amber dots that move along every path the current takes (parts, wires, battery leads,
// meter cables and the metal strips inside the board). Faster dots mean more current.
// Also the x-ray view: the strips and rails inside the board, drawn as metal bars.
(function (BB) {
  "use strict";
  const R = BB.Render, { Y } = BBShared;
  const SPACING = 15;          // world units between dots
  const MIN_I = 2e-5;          // below this no dots are drawn
  let enabled = true, tracks = [], xrayOn = false, xrayDrawn = false;

  // Speed in world units per second: 10 mA ≈ 70, 20 mA ≈ 100; capped so a short circuit is a blur, not a jump.
  const speed = (i) => Math.min(70 * Math.sqrt(i / 0.01), 420);

  // One track = one path and a function giving the current along it (positive = in the path's direction).
  function track(d, current) {
    const path = R.el("path", { d, class: "flow", "stroke-dasharray": `0.001 ${SPACING}` }, R.layers.flow);
    return { path, current, off: Math.random() * SPACING, shown: true };
  }

  // Where the legs of a part sit on the board, and which net (strip or rail) each one is in.
  function legSpots(part) {
    return part.legs.map((pt, k) => {
      if (!pt || pt.startsWith("U.")) return null;
      const p = BBShared.parse(pt), [x, y] = R.xy(pt);
      return { net: BB.netKey(pt, part.id, k), rail: p.kind === "rail", x, y, along: p.kind === "rail" ? x : y };
    });
  }

  // Rebuild every track after the bench was redrawn. Currents are read per frame; only the geometry is fixed here.
  function rebuild(doc, sim) {
    R.layers.flow.replaceChildren();
    tracks = [];
    if (!enabled) return;
    const legI = new Map();                     // part id -> current into each leg, refreshed each frame
    const cur = (id, k) => (legI.get(id) || [])[k] || 0;
    const nets = new Map();                     // net key -> [{along, x, y, rail, id, k}]
    for (const part of doc.parts) {
      const r = R.refs.get(part.id), T = BB.Parts.TYPES[part.type];
      if (!r || !T || !T.legI) continue;
      const spots = legSpots(part);
      spots.forEach((s, k) => { if (s) { if (!nets.has(s.net)) nets.set(s.net, []); nets.get(s.net).push(Object.assign({ id: part.id, k }, s)); } });
      if (r.leads) {                           // battery leads and probe cables: drawn from the body to the hole
        r.leads.forEach((d, k) => { if (d && part.legs[k]) tracks.push(track(d, () => -cur(part.id, k))); });
        continue;
      }
      const pts = spots.map((s) => s && [s.x, s.y]);
      if (pts.length === 2 && pts[0] && pts[1]) {
        tracks.push(track(r.track || `M${pts[0][0]} ${pts[0][1]}L${pts[1][0]} ${pts[1][1]}`, () => cur(part.id, 0)));
      } else if (pts.length > 2 && pts.every(Boolean)) {        // three or four legs: each leg to the middle
        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        pts.forEach((p, k) => tracks.push(track(`M${p[0]} ${p[1]}L${cx} ${cy}`, () => cur(part.id, k))));
      }
    }
    // Inside the board: each strip or rail is a line of holes. Between two neighbouring legs the strip carries
    // everything the legs before them put in, so the current in each piece is a running sum.
    for (const [, spots] of nets) {
      if (spots.length < 2) continue;
      spots.sort((a, b) => a.along - b.along);
      for (let j = 0; j + 1 < spots.length; j++) {
        const a = spots[j], b = spots[j + 1];
        if (b.along - a.along < 1) continue;
        const before = spots.slice(0, j + 1);
        tracks.push(track(`M${a.x} ${a.y}L${b.x} ${b.y}`, () => -before.reduce((s, q) => s + cur(q.id, q.k), 0)));
      }
    }
    tracks.legI = legI;
  }

  function frame(doc, sim, dt) {
    if (!enabled || !tracks.legI) return;
    const legI = tracks.legI;
    legI.clear();
    for (const part of doc.parts) {
      const T = BB.Parts.TYPES[part.type];
      if (!T || !T.legI) continue;
      const rt = sim.rt.get(part.id), rd = sim.read(part.id);
      if (!rd || (rt && rt.destroyed && part.type !== "meter")) continue;
      legI.set(part.id, T.legI(rd));
    }
    for (const t of tracks) {
      const i = t.current(), a = Math.abs(i);
      const show = a >= MIN_I;
      if (show !== t.shown) { t.path.style.display = show ? "" : "none"; t.shown = show; }
      if (!show) continue;
      t.off = (t.off - Math.sign(i) * speed(a) * dt) % SPACING;
      t.path.setAttribute("stroke-dashoffset", t.off.toFixed(2));
      t.path.setAttribute("opacity", Math.min(1, 0.45 + a / 0.01).toFixed(2));
      const hot = a > 0.1;
      if (hot !== t.hot) { t.path.classList.toggle("hot", hot); t.hot = hot; }
    }
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) { R.layers.flow.replaceChildren(); tracks = []; }
  }

  // ---------- x-ray ----------
  function drawXray() {
    const g = R.layers.xray, { xr, BOARD } = R, rows = BB.Grid.ROWS;
    for (let r = 1; r <= rows; r++) {
      for (const [y0, y1] of [[Y.a, Y.e], [Y.f, Y.j]]) R.el("rect", { x: xr(r) - 5, y: y0 - 6, width: 10, height: y1 - y0 + 12, rx: 5, class: "xr-strip" }, g);
    }
    for (const k of ["+T", "-T", "+B", "-B"]) R.el("rect", { x: BOARD.x + 30, y: Y[k] - 5, width: BOARD.w - 46, height: 10, rx: 5, class: `xr-rail ${k[0] === "+" ? "pos" : "neg"}` }, g);
    xrayDrawn = true;
  }
  function xray(on) {
    xrayOn = !!on;
    if (xrayOn && !xrayDrawn) drawXray();
    R.layers.xray.style.display = xrayOn ? "" : "none";
  }

  BB.Flow = { rebuild, frame, setEnabled, xray, get xrayOn() { return xrayOn; }, get enabled() { return enabled; }, tracks: () => tracks };
})(window.BB = window.BB || {});
