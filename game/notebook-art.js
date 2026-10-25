// The Notebook's drawings: one small ink diagram per idea, in the style of an inventor's notebook (art style 2):
// pen lines with a slight hand-drawn wobble, the current as amber highlighter dots, + in red and − in blue.
// diagram(id) returns an SVG string. Drawn in code, so the electronics are always right. No DOM needed.
(function (BB) {
  "use strict";
  const PEN = "#2b2a26", RED = "#c8362e", BLUE = "#2f63c8", DOT = "#f4a52c", HL = "rgba(255, 196, 80, .5)", GREY = "#8d8a80";
  let uid = 0;

  // ---------- pen strokes ----------
  const ln = (x1, y1, x2, y2, c = PEN, w = 2.2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const pl = (pts, c = PEN, w = 2.2, extra = "") => `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const tx = (x, y, t, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.a || "middle"}" font-family="Caveat, 'Patrick Hand', cursive" font-weight="700" font-size="${o.s || 17}" fill="${o.c || PEN}"${o.r ? ` transform="rotate(${o.r} ${x} ${y})"` : ""}>${t}</text>`;
  const circ = (x, y, r, fill = "none", c = PEN, w = 2.2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${c}" stroke-width="${w}"/>`;

  // amber dots every `gap` units along a polyline, with a soft highlighter stroke under them: the current
  function current(pts, gap = 14) {
    let out = pl(pts, HL, 8), carry = gap / 2;
    for (let k = 0; k + 1 < pts.length; k++) {
      const [x1, y1] = pts[k], [x2, y2] = pts[k + 1], L = Math.hypot(x2 - x1, y2 - y1);
      for (let d = carry; d < L; d += gap) out += `<circle cx="${(x1 + (x2 - x1) * d / L).toFixed(1)}" cy="${(y1 + (y2 - y1) * d / L).toFixed(1)}" r="3.2" fill="${DOT}"/>`;
      carry = (carry - L) % gap; if (carry < 0) carry += gap;
    }
    return out;
  }
  // a small arrow head at (x, y) pointing along angle a (degrees)
  const arrow = (x, y, a, c = DOT) => `<path d="M-6 -4.5 L3 0 L-6 4.5" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x} ${y}) rotate(${a})"/>`;

  // ---------- parts, as schematic symbols ----------
  // battery standing in a vertical wire at x: long plate (+) above, short plate (−) below, centred on y
  const battery = (x, y, lbl = true) => ln(x - 13, y - 5, x + 13, y - 5, PEN, 2.6) + ln(x - 7, y + 4, x + 7, y + 4, PEN, 4) +
    (lbl === "r" ? tx(x + 18, y - 3, "+", { c: RED, s: 15 }) : lbl ? tx(x - 22, y - 1, "+", { c: RED, s: 20 }) + tx(x - 22, y + 15, "−", { c: BLUE, s: 20 }) : "");
  // resistor zigzag from (x1, y) to (x2, y)
  function resH(x1, x2, y, amp = 6) {
    const pts = [[x1, y]], n = 6, step = (x2 - x1) / n;
    for (let k = 0; k < n; k++) pts.push([x1 + step * (k + 0.5), y + (k % 2 ? amp : -amp)]);
    pts.push([x2, y]);
    return pl(pts, PEN, 2.2);
  }
  function resV(x, y1, y2, amp = 6) {
    const pts = [[x, y1]], n = 6, step = (y2 - y1) / n;
    for (let k = 0; k < n; k++) pts.push([x + (k % 2 ? amp : -amp), y1 + step * (k + 0.5)]);
    pts.push([x, y2]);
    return pl(pts, PEN, 2.2);
  }
  // LED in a vertical wire at x, pointing down (current flows downwards), centred on y; lit = glowing
  function ledV(x, y, lit = true, dim = false, fill = null) {
    const glow = lit ? `<circle cx="${x}" cy="${y}" r="${dim ? 11 : 17}" fill="rgba(255, 190, 70, ${dim ? 0.25 : 0.45})"/>` : "";
    const rc = lit && !dim ? DOT : PEN, ray = (x1, y1) => ln(x1, y1, x1 + 8, y1 - 8, rc, 1.8) +
      `<path d="M-4 -3 L2 0 L-4 3" fill="none" stroke="${rc}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x1 + 8} ${y1 - 8}) rotate(-45)"/>`;
    const rays = ray(x + 11, y - 3) + ray(x + 14, y + 4);       // the LED symbol's two arrows: light going out
    return glow + `<path d="M${x - 10} ${y - 7} L${x + 10} ${y - 7} L${x} ${y + 7} Z" fill="${fill || (lit ? "#ffd27a" : "#fffdf6")}" stroke="${PEN}" stroke-width="2.2" stroke-linejoin="round"/>` +
      ln(x - 10, y + 7, x + 10, y + 7, PEN, 2.6) + rays;
  }
  // a meter: a circle with its letter, and a reading written beside it
  const meter = (x, y, letter, reading, rx = x, ry = y + 32) => circ(x, y, 14, "#fffdf6") + tx(x, y + 6, letter, { s: letter.length > 1 ? 15 : 19 }) +
    (reading ? tx(rx, ry, reading, { s: 19, c: "#a3360f" }) : "");
  // A meter probe, as on the bench: its metal tip touches the point (x, y), its handle (red or black) points towards
  // the meter at (mx, my), and its thin cord runs on into the meter. Circuit wires stay black: a probe is a tool laid
  // on the circuit, never a recoloured piece of wire. `bend` curves the cord (+ or −).
  const PROBE = { red: "#d93b30", black: "#22252a" };
  function probeTo(x, y, mx, my, colour, bend = 0) {
    const c = PROBE[colour], d = Math.hypot(mx - x, my - y), ux = (mx - x) / d, uy = (my - y) / d;
    const tip = Math.min(7, d * 0.15), hand = Math.min(16, d * 0.35);
    const hx = x + ux * (tip + hand), hy = y + uy * (tip + hand);
    const ex = mx - ux * 14, ey = my - uy * 14, cx = (hx + ex) / 2 - uy * bend, cy = (hy + ey) / 2 + ux * bend;
    return ln(x, y, x + ux * tip, y + uy * tip, "#9aa1a9", 2.2) +
      ln(x + ux * tip, y + uy * tip, hx, hy, c, 6) +
      `<path d="M${hx.toFixed(1)} ${hy.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  const term = (x, y) => circ(x, y, 3.2, "#fffdf6");          // a terminal: an open end of a wire, where a probe can touch
  const cross = (x, y, s = 9, c = RED) => ln(x - s, y - s, x + s, y + s, c, 3) + ln(x - s, y + s, x + s, y - s, c, 3);
  const tick = (x, y, c = "#2f8a43") => pl([[x - 7, y], [x - 2, y + 6], [x + 9, y - 8]], c, 3);
  const burst = (x, y, r = 14, c = RED) => {
    let d = "";
    for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8, rr = k % 2 ? r * 0.5 : r; d += `${k ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`; }
    return `<path d="${d}Z" fill="#ffd27a" stroke="${c}" stroke-width="2"/>`;
  };
  // a breadboard slot of five holes, vertical, top hole at y, 12 apart
  const slot = (x, y, n = 5, bar = true, p = 12) => `<rect x="${x - 9}" y="${y - 9}" width="18" height="${(n - 1) * p + 18}" rx="9" fill="#efe7d4" stroke="${PEN}" stroke-width="1.6"/>` +
    (bar ? `<rect x="${x - 3}" y="${y - 3}" width="6" height="${(n - 1) * p + 6}" rx="3" fill="#b9bec4" opacity=".9"/>` : "") +
    Array.from({ length: n }, (_, k) => `<circle cx="${x}" cy="${y + k * p}" r="2.6" fill="${PEN}"/>`).join("");

  // the standard loop: battery on the left, resistor on top, LED on the right, plain wire below
  const X0 = 44, X1 = 176, Y0 = 26, Y1 = 104, YM = 65;
  const loopWires = (opts = {}) => {
    let s = pl([[X0, YM - 5], [X0, Y0], [opts.resAt ? 82 : X1, Y0]]);
    if (opts.resAt) s += resH(82, 134, Y0) + pl([[134, Y0], [X1, Y0]]);
    s += pl([[X1, Y0], [X1, YM - 7]]) + pl([[X1, YM + 7], [X1, Y1]]);
    if (!opts.noBottom) s += pl([[X1, Y1], [X0, Y1], [X0, YM + 4]]);
    return s;
  };
  const loopPath = [[X0, YM - 10], [X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1], [X0, YM + 12]];

  // ---------- one drawing per idea ----------
  const D = {
    loop: () => current(loopPath) + loopWires({ resAt: true }) + battery(X0, YM) + ledV(X1, YM) +
      arrow(110, Y0, 0) + arrow(X1, 86, 90) + arrow(110, Y1, 180) + arrow(X0, 42, -90),
    switch: () => pl([[X0, YM - 5], [X0, Y0], [82, Y0]]) + resH(82, 134, Y0) + pl([[134, Y0], [X1, Y0], [X1, YM - 7]]) + pl([[X1, YM + 7], [X1, Y1], [128, Y1]]) +
      pl([[96, Y1], [X0, Y1], [X0, YM + 4]]) + circ(128, Y1, 3, PEN) + circ(96, Y1, 3, PEN) + ln(96, Y1, 124, Y1 - 16, PEN, 2.6) +
      battery(X0, YM) + ledV(X1, YM, false) + tx(112, Y1 + 20, "open: nothing flows", { s: 16 }),
    strip: () => slot(64, 22) + slot(156, 22) + tx(64, 106, "joined inside", { s: 16 }) + tx(156, 106, "the next strip", { s: 16 }) +
      `<path d="M82 28 C90 40 90 64 82 76" fill="none" stroke="${PEN}" stroke-width="2"/>` + tx(96, 58, "5", { s: 20 }) + cross(122, 52, 6),
    rail: () => `<rect x="18" y="30" width="186" height="20" rx="10" fill="#efe7d4" stroke="${PEN}" stroke-width="1.6"/>` + ln(22, 25, 200, 25, RED, 2.4) +
      `<rect x="18" y="70" width="186" height="20" rx="10" fill="#efe7d4" stroke="${PEN}" stroke-width="1.6"/>` + ln(22, 95, 200, 95, BLUE, 2.4) +
      Array.from({ length: 12 }, (_, k) => `<circle cx="${30 + k * 15.5}" cy="40" r="2.6" fill="${PEN}"/><circle cx="${30 + k * 15.5}" cy="80" r="2.6" fill="${PEN}"/>`).join("") +
      tx(12, 45, "+", { c: RED, s: 22 }) + tx(12, 86, "−", { c: BLUE, s: 22 }) + tx(112, 117, "one strip along this board", { s: 16 }),
    gap: () => slot(90, 9, 5, true, 9.5) + slot(90, 77, 5, true, 9.5) + slot(140, 9, 5, true, 9.5) + slot(140, 77, 5, true, 9.5) +
      `<rect x="62" y="59" width="108" height="8" rx="4" fill="#d9cfb8"/>` + cross(115, 63, 6) + tx(192, 56, "not", { s: 17 }) + tx(192, 74, "joined", { s: 17 }) +
      tx(40, 68, "gap", { s: 17 }),
    polarity: () => ln(30, 64, 92, 64, PEN, 2.4) + ln(128, 64, 182, 64, PEN, 2.4) +
      `<path d="M92 50 L92 78 L120 64 Z" fill="#ffd27a" stroke="${PEN}" stroke-width="2.4" stroke-linejoin="round"/>` + ln(121, 49, 121, 79, PEN, 3) +
      [[99, 47], [107, 47]].map(([x1, y1]) => ln(x1, y1, x1 + 6, y1 - 9, PEN, 1.8) + arrow(x1 + 6.5, y1 - 10, -56, PEN)).join("") +
      tx(46, 54, "+ longer leg", { s: 16, c: RED }) + tx(160, 54, "− shorter", { s: 16, c: BLUE }) +
      arrow(150, 92, 0, "#2f8a43") + ln(66, 92, 148, 92, "#2f8a43", 2.4) + tick(176, 92) +
      ln(66, 112, 148, 112, RED, 2.4) + arrow(68, 112, 180, RED) + cross(176, 110, 6),
    resistor: () => pl([[20, 40], [20, 22], [44, 22]]) + resH(44, 84, 22) + pl([[84, 22], [100, 22], [100, 34]]) + `<g transform="translate(200 0) scale(-1 1)">${ledV(100, 44, true, true)}</g>` + pl([[100, 51], [100, 66], [20, 66], [20, 48]]) +
      battery(20, 44, false) + tx(60, 92, "with: a safe glow", { s: 16 }) + tick(60, 108) +
      pl([[130, 40], [130, 22], [200, 22], [200, 34]]) + burst(200, 46) + pl([[200, 56], [200, 66], [130, 66], [130, 48]]) + battery(130, 44, false) +
      tx(166, 92, "without: pop!", { s: 16, c: RED }),
    short: () => current([[60, 58], [60, 26], [160, 26], [160, 104], [60, 104], [60, 76]], 7) + pl([[60, 60], [60, 26], [160, 26], [160, 104], [60, 104], [60, 70]]) +
      battery(60, 65) + `<path d="M150 40 q8 -8 0 -16 M162 44 q8 -10 0 -20 M174 40 q8 -8 0 -16" fill="none" stroke="${RED}" stroke-width="2.4" stroke-linecap="round"/>` +
      tx(186, 70, "hot!", { s: 22, c: RED }) + tx(110, 122, "only wire in the path", { s: 16 }),
    volts: () => pl([[70, 60], [70, 34], [104, 34]]) + pl([[70, 69], [70, 96], [104, 96]]) + battery(70, 65) + term(107, 34) + term(107, 96) +
      meter(160, 65, "V", "6 V", 194, 71) + probeTo(109, 34, 160, 65, "red", -6) + probeTo(109, 96, 160, 65, "black", 6) +
      tx(110, 122, "voltage: between two points", { s: 16 }),
    across: () => current(loopPath) + loopWires({ resAt: true }) + battery(X0, YM) + ledV(X1, YM) +
      tx(108, 50, "4 V", { s: 19, c: "#a3360f" }) +
      tx(146, 82, "2 V", { s: 19, c: "#a3360f" }) + ln(160, 72, 166, 67, "#a3360f", 1.6) +
      tx(110, 124, "4 V + 2 V = the battery's 6 V", { s: 16 }),
    current: () => current([[X0, YM - 10], [X0, Y0], [X1, Y0], [X1, Y1], [126, Y1], [94, Y1], [X0, Y1], [X0, YM + 12]]) +
      pl([[X0, YM - 5], [X0, Y0], [82, Y0]]) + resH(82, 134, Y0) + pl([[134, Y0], [X1, Y0], [X1, YM - 7]]) + pl([[X1, YM + 7], [X1, Y1], [124, Y1]]) + pl([[96, Y1], [X0, Y1], [X0, YM + 4]]) +
      battery(X0, YM) + ledV(X1, YM) + meter(110, Y1, "mA", "12 mA", 110, 76),
    sameCurrent: () => current([[X0, YM - 10], [X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1], [X0, YM + 12]]) + pl([[X0, YM - 5], [X0, Y0], [54, Y0]]) + resH(54, 86, Y0, 5) +
      pl([[86, Y0], [96, Y0]]) + pl([[124, Y0], [X1, Y0], [X1, YM - 7]]) +
      pl([[X1, YM + 7], [X1, Y1], [124, Y1]]) + pl([[96, Y1], [X0, Y1], [X0, YM + 4]]) + battery(X0, YM) + ledV(X1, YM) +
      meter(110, Y0, "mA", "12 mA", 110, 55) + meter(110, Y1, "mA") + tx(110, 86, "12 mA", { s: 17, c: "#a3360f" }) + tx(110, 70, "same!", { s: 15, c: "#2f8a43" }),
    fuse: () => pl([[70, 60], [70, 34], [104, 34]]) + pl([[70, 69], [70, 96], [104, 96]]) + battery(70, 65) + term(107, 34) + term(107, 96) +
      meter(160, 65, "mA") + probeTo(109, 34, 160, 65, "red", -6) + probeTo(109, 96, 160, 65, "black", 6) + burst(190, 40, 12) +
      tx(192, 92, "pop!", { s: 20, c: RED }) + tx(110, 122, "mA never across a battery", { s: 16 }),
    biggerR: () => {
      const mini = (ox, r, many) => current([[ox, 50], [ox, 26], [ox + 70, 26], [ox + 70, 94], [ox, 94], [ox, 70]], many ? 9 : 20) +
        pl([[ox, 55], [ox, 26], [ox + 16, 26]]) + resH(ox + 16, ox + 46, 26, 5) + pl([[ox + 46, 26], [ox + 70, 26], [ox + 70, 53]]) + ledV(ox + 70, 60, true, !many) +
        pl([[ox + 70, 67], [ox + 70, 94], [ox, 94], [ox, 64]]) + battery(ox, 60, false) + tx(ox + 31, 16, r, { s: 17 });
      return mini(14, "220 Ω", true) + mini(130, "1 kΩ", false) + tx(49, 116, "more flow", { s: 16 }) + tx(165, 116, "less flow", { s: 16 });
    },
    ohms: () => ln(62, 64, 76, 64) + resH(76, 124, 64) + ln(124, 64, 138, 64) + term(59, 64) + term(141, 64) + meter(100, 104, "Ω", "330 Ω", 100, 40) +
      probeTo(57, 66, 100, 104, "red", 6) + probeTo(143, 66, 100, 104, "black", -6) + battery(186, 28, false) + cross(186, 28, 11) + tx(180, 62, "battery off", { s: 15 }),
    break: () => pl([[X0, YM - 5], [X0, Y0], [82, Y0]]) + resH(82, 134, Y0) + pl([[134, Y0], [X1, Y0], [X1, YM - 7]]) + pl([[X1, YM + 7], [X1, Y1], [130, Y1]]) +
      pl([[94, Y1], [X0, Y1], [X0, YM + 4]]) + battery(X0, YM) + ledV(X1, YM, false) + circ(130, Y1, 2.6, PEN) + circ(94, Y1, 2.6, PEN) +
      meter(112, 66, "V") + probeTo(130, Y1 - 2, 112, 66, "red", -5) + probeTo(94, Y1 - 2, 112, 66, "black", 5) + tx(112, 46, "most of the voltage", { s: 16, c: "#a3360f" }) +
      tx(112, 124, "the break", { s: 16 }),
    continuity: () => slot(80, 24) + meter(160, 52, ")))") + probeTo(82, 24, 160, 52, "red", -8) + probeTo(82, 72, 160, 52, "black", 8) +
      tx(196, 40, "beep!", { s: 20, c: "#2f8a43", r: -8 }) + tx(110, 116, "joined by metal", { s: 16 }),
    // Chapter 3: Ohm's law
    twiceR: () => {
      const mini = (ox, r, mA, gap) => current([[ox, 50], [ox, 26], [ox + 76, 26], [ox + 76, 94], [ox, 94], [ox, 70]], gap) +
        pl([[ox, 55], [ox, 26], [ox + 22, 26]]) + resH(ox + 22, ox + 54, 26, 5) + pl([[ox + 54, 26], [ox + 76, 26], [ox + 76, 94], [ox + 50, 94]]) +
        pl([[ox + 26, 94], [ox, 94], [ox, 64]]) + battery(ox, 60, "r") + meter(ox + 38, 94, "mA") + tx(ox + 38, 16, r, { s: 17 }) + tx(ox + 38, 66, mA, { s: 19, c: "#a3360f" });
      return mini(18, "1 kΩ", "6 mA", 8) + mini(126, "2 kΩ", "3 mA", 16) + tx(110, 124, "twice the resistance, half the current", { s: 15 });
    },
    twiceV: () => {
      const mini = (ox, v, mA, gap, two) => current([[ox, 50], [ox, 26], [ox + 76, 26], [ox + 76, 94], [ox, 94], [ox, 70]], gap) +
        pl([[ox, two ? 47 : 55], [ox, 26], [ox + 22, 26]]) + resH(ox + 22, ox + 54, 26, 5) + pl([[ox + 54, 26], [ox + 76, 26], [ox + 76, 94], [ox + 50, 94]]) +
        pl([[ox + 26, 94], [ox, 94], [ox, two ? 72 : 64]]) + battery(ox, two ? 52 : 60, "r") + (two ? ln(ox, 56, ox, 63) + battery(ox, 68, false) : "") +
        meter(ox + 38, 94, "mA") + tx(ox - 6, 112, v, { s: 17 }) + tx(ox + 38, 66, mA, { s: 19, c: "#a3360f" });
      return mini(24, "3 V", "3 mA", 16, false) + mini(128, "6 V", "6 mA", 8, true) + tx(112, 126, "twice the voltage, twice the current", { s: 15 });
    },
    ohmsLaw: () => tx(110, 34, "current = voltage ÷ resistance", { s: 20 }) + ln(30, 44, 190, 44, HL, 7) +
      tx(110, 74, "volts ÷ kΩ = mA", { s: 22, c: "#a3360f" }) + tx(100, 106, "6 V ÷ 2 kΩ = 3 mA", { s: 21 }) + tick(192, 100),
    findR: () => ln(46, 50, 70, 50) + resH(70, 150, 50, 7) + ln(150, 50, 174, 50) + tx(110, 30, "?", { s: 30, c: RED }) +
      `<path d="M70 70 q40 12 80 0" fill="none" stroke="#a3360f" stroke-width="2"/>` + tx(110, 92, "6 V across, 4 mA through", { s: 17, c: "#a3360f" }) +
      tx(110, 118, "6 V ÷ 4 mA = 1.5 kΩ", { s: 20 }),
    power: () => ln(26, 56, 46, 56) + resH(46, 86, 56, 6) + ln(86, 56, 124, 56) +
      `<path d="M58 36 q6 -8 0 -16 M74 38 q6 -9 0 -18 M90 36 q6 -8 0 -16" fill="none" stroke="${RED}" stroke-width="2.4" stroke-linecap="round"/>` +
      tx(66, 86, "33 Ω: about 1 W", { s: 16, c: RED }) + tx(66, 104, "too hot!", { s: 17, c: RED }) +
      ln(136, 56, 148, 56) + resH(148, 186, 56, 6) + ln(186, 56, 198, 56) + tx(168, 86, "1 kΩ: 0.036 W", { s: 14 }) + tick(168, 100) +
      tx(110, 126, "power = voltage × current", { s: 17 }),
    // Chapter 4: LED maths
    ledDrop: () => current(loopPath) + loopWires({ resAt: true }) + battery(X0, YM) + ledV(X1, YM) +
      tx(108, 50, "the rest", { s: 17, c: "#a3360f" }) + tx(150, 82, "2 V", { s: 19, c: "#a3360f" }) + tx(110, 124, "about 2 V across the LED", { s: 16 }),
    ledCurrent: () => tx(110, 34, "(battery − LED) ÷ resistor", { s: 21 }) + ln(28, 44, 192, 44, HL, 7) +
      tx(110, 76, "(6 − 2) V ÷ 0.22 kΩ", { s: 20 }) + tx(110, 106, "≈ 18 mA", { s: 22, c: "#a3360f" }),
    chooseR: () => ln(30, 58, 46, 58) + resH(46, 92, 58, 6) + ln(92, 58, 112, 58) + `<g transform="rotate(-90 132 58)">${ledV(132, 58)}</g>` + ln(140, 58, 190, 58) +
      tx(69, 38, "?", { s: 26, c: RED }) + tx(22, 63, "+", { s: 18, c: RED }) + tx(198, 63, "−", { s: 18, c: BLUE }) + tx(110, 96, "(6 − 2) V ÷ 10 mA = 400 Ω", { s: 18 }) + tx(110, 120, "round up: 470 Ω", { s: 18, c: "#a3360f" }),
    ledColours: () => {
      const one = (x, fill, v) => `<path d="M${x - 12} 40 L${x + 12} 40 L${x} 58 Z" fill="${fill}" stroke="${PEN}" stroke-width="2.2" stroke-linejoin="round"/>` +
        ln(x - 12, 58, x + 12, 58, PEN, 2.6) + ln(x, 24, x, 40) + ln(x, 58, x, 74) + tx(x, 98, v, { s: 20, c: "#a3360f" }) +
        [[x + 12, 46], [x + 15, 53]].map(([x1, y1]) => ln(x1, y1, x1 + 7, y1 - 7, PEN, 1.6) +
          `<path d="M-3.5 -2.6 L1.8 0 L-3.5 2.6" fill="none" stroke="${PEN}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x1 + 7} ${y1 - 7}) rotate(-45)"/>`).join("");     // the LED symbol's arrows
      return one(44, "#ff6b5a", "2 V") + one(96, "#ffd84a", "2.1 V") + one(148, "#5fd47a", "2.2 V") + one(196, "#6f8cff", "3 V") + tx(110, 124, "each colour its own voltage", { s: 16 });
    },
    ledMax: () => ln(40, 60, 63, 60) + `<g transform="rotate(-90 70 60)">${ledV(70, 60)}</g>` + ln(77, 60, 100, 60) + tx(34, 65, "+", { s: 17, c: RED }) + tx(106, 65, "−", { s: 17, c: BLUE }) +
      tx(70, 100, "under 20 mA", { s: 17 }) + tick(70, 114) +
      burst(160, 58, 18) + tx(162, 100, "75 mA:", { s: 17, c: RED }) + tx(162, 117, "burns out", { s: 17, c: RED }) + tx(110, 22, "smallest: (6 − 2) V ÷ 20 mA = 200 Ω", { s: 15 }),
    // Chapter 5: series and parallel
    seriesR: () => ln(20, 56, 36, 56) + resH(36, 86, 56, 6) + ln(86, 56, 118, 56) + resH(118, 168, 56, 6) + ln(168, 56, 200, 56) +
      tx(61, 36, "1 kΩ", { s: 18 }) + tx(143, 36, "1 kΩ", { s: 18 }) + tx(110, 92, "1 kΩ + 1 kΩ = 2 kΩ", { s: 21, c: "#a3360f" }) + tx(110, 118, "in a row, they add up", { s: 16 }),
    seriesShare: () => current([[X0, YM - 10], [X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1], [X0, YM + 12]], 16) + pl([[X0, YM - 5], [X0, Y0], [60, Y0]]) + resH(60, 92, Y0, 5) +
      pl([[92, Y0], [108, Y0]]) + resH(108, 168, Y0, 5) + pl([[168, Y0], [X1, Y0], [X1, Y1], [X0, Y1], [X0, YM + 4]]) + battery(X0, YM) +
      tx(76, 52, "1 kΩ: 2 V", { s: 16, c: "#a3360f" }) + tx(138, 78, "2 kΩ: 4 V", { s: 16, c: "#a3360f" }) + tx(110, 124, "the bigger one, the bigger share", { s: 16 }),
    parallelV: () => ln(30, 22, 196, 22, RED, 2.4) + ln(30, 104, 196, 104, BLUE, 2.4) + tx(20, 27, "+", { c: RED, s: 20 }) + tx(20, 109, "−", { c: BLUE, s: 20 }) +
      ln(76, 22, 76, 40) + resV(76, 40, 86, 6) + ln(76, 86, 76, 104) + ln(150, 22, 150, 40) + resV(150, 40, 86, 6) + ln(150, 86, 150, 104) +
      tx(104, 68, "6 V", { s: 20, c: "#a3360f" }) + tx(178, 68, "6 V", { s: 20, c: "#a3360f" }) + tx(110, 124, "each has the whole 6 V", { s: 16 }),
    parallelI: () => current([[20, 22], [76, 22]], 8) + current([[76, 22], [76, 104]], 12) + current([[76, 22], [150, 22], [150, 104], [76, 104]], 22) + current([[76, 104], [20, 104]], 8) +
      ln(14, 22, 196, 22, RED, 2.4) + ln(14, 104, 196, 104, BLUE, 2.4) + ln(76, 22, 76, 40) + resV(76, 40, 86, 6) + ln(76, 86, 76, 104) +
      ln(150, 22, 150, 40) + resV(150, 40, 86, 6) + ln(150, 86, 150, 104) + tx(98, 68, "6 mA", { s: 17, c: "#a3360f" }) + tx(174, 68, "3 mA", { s: 17, c: "#a3360f" }) +
      tx(40, 14, "9 mA", { s: 18, c: "#a3360f" }) + tx(110, 124, "the branches add up", { s: 16 }),
    ownResistor: () => pl([[16, 43], [16, 22], [28, 22]]) + resH(28, 52, 22, 5) + pl([[52, 22], [86, 22], [86, 45]]) + pl([[62, 22], [62, 45]]) +
      `<g transform="translate(124 0) scale(-1 1)">${ledV(62, 52, true, true, "#ff6b5a")}</g>` + ledV(86, 52, false, false, "#c9d4f7") + tx(32, 37, "+", { c: RED, s: 15 }) + ln(62, 59, 62, 76) + ln(86, 59, 86, 76) + pl([[16, 52], [16, 76], [86, 76]]) +
      battery(16, 48, false) + tx(62, 92, "red", { s: 13 }) + tx(88, 92, "blue", { s: 13 }) + cross(50, 104, 6) + tx(50, 125, "one for two", { s: 15 }) +
      pl([[126, 43], [126, 22], [138, 22]]) + resH(138, 152, 22, 4) + pl([[152, 22], [160, 22], [160, 45]]) + ledV(160, 52, true, true, "#ff6b5a") +
      pl([[126, 22], [126, 6], [164, 6]]) + resH(164, 186, 6, 4) + pl([[186, 6], [196, 6], [196, 45]]) + ledV(196, 52, true, true, "#6f8cff") +
      ln(160, 59, 160, 76) + ln(196, 59, 196, 76) + pl([[126, 52], [126, 76], [196, 76]]) + battery(126, 48, false) + tx(142, 37, "+", { c: RED, s: 15 }) +
      tx(160, 92, "red", { s: 13 }) + tx(196, 92, "blue", { s: 13 }) + tick(160, 106) + tx(160, 125, "one each", { s: 15 }),
    // Chapter 6: dividers and the knob
    divider: () => ln(30, 16, 190, 16, RED, 2.4) + ln(30, 114, 190, 114, BLUE, 2.4) + tx(20, 21, "+", { c: RED, s: 20 }) + tx(20, 119, "−", { c: BLUE, s: 20 }) +
      ln(90, 16, 90, 24) + resV(90, 24, 56, 6) + ln(90, 56, 90, 74) + resV(90, 74, 106, 6) + ln(90, 106, 90, 114) + circ(90, 65, 4, PEN) +
      meter(160, 72, "V", "3 V", 194, 78) + probeTo(93, 66, 160, 72, "red", -6) + probeTo(172, 112, 160, 72, "black", -4) + tx(60, 44, "10 kΩ", { s: 15 }) + tx(60, 94, "10 kΩ", { s: 15 }) + tx(50, 70, "meeting point", { s: 13 }) +
      tx(110, 128, "6 V × R(− side) ÷ R(both)", { s: 15 }),
    potKnob: () => ln(30, 16, 150, 16, RED, 2.4) + ln(30, 114, 150, 114, BLUE, 2.4) + tx(20, 21, "+", { c: RED, s: 20 }) + tx(20, 119, "−", { c: BLUE, s: 20 }) +
      ln(80, 16, 80, 30) + resV(80, 30, 100, 7) + ln(80, 100, 80, 114) + pl([[120, 58], [92, 64]], PEN, 2.4) + arrow(90, 64.5, 168, PEN) +
      `<path d="M126 48 q14 16 0 32" fill="none" stroke="#a3360f" stroke-width="2"/>` + tx(178, 60, "0 V", { s: 18, c: "#a3360f" }) + tx(178, 80, "to 6 V", { s: 18, c: "#a3360f" }) +
      tx(110, 128, "the wiper slides along", { s: 15 }),
    dimmer: () => current(loopPath, 18) + pl([[X0, YM - 5], [X0, Y0], [64, Y0]]) + resH(64, 96, Y0, 5) + pl([[96, Y0], [118, Y0]]) + resH(118, 158, Y0, 6) +
      pl([[124, 40], [152, 13]], PEN, 2.2) + arrow(153, 12, -44, PEN) + pl([[158, Y0], [X1, Y0], [X1, YM - 7]]) + pl([[X1, YM + 7], [X1, Y1], [X0, Y1], [X0, YM + 4]]) +
      battery(X0, YM) + ledV(X1, YM, true, true) + tx(80, 50, "keep me!", { s: 16, c: RED }) + tx(140, 58, "the knob", { s: 16 }) + tx(110, 124, "a dimmer, with a fixed resistor", { s: 15 }),
    // Chapter 7: buttons (a push button: two contacts, and a bar above them that presses down)
    buttonLoop: () => {
      const btn = (x1, x2, y, down) => circ(x1, y, 3, PEN) + circ(x2, y, 3, PEN) + ln(x1 - 2, down ? y - 3 : y - 14, x2 + 2, down ? y - 3 : y - 14, PEN, 2.6) +
        ln((x1 + x2) / 2, down ? y - 3 : y - 14, (x1 + x2) / 2, down ? y - 14 : y - 25, PEN, 2.2);
      return current(loopPath) + pl([[X0, YM - 5], [X0, Y0], [82, Y0]]) + resH(82, 134, Y0) + pl([[134, Y0], [X1, Y0], [X1, YM - 7]]) + pl([[X1, YM + 7], [X1, Y1], [126, Y1]]) +
        pl([[94, Y1], [X0, Y1], [X0, YM + 4]]) + btn(97, 123, Y1, true) + battery(X0, YM) + ledV(X1, YM) + tx(110, 124, "lights while you press", { s: 16 });
    },
    buttonLegs: () => `<rect x="24" y="58" width="172" height="8" rx="4" fill="#d9cfb8" opacity=".8"/>` + tx(40, 80, "gap", { s: 14 }) +
      `<rect x="80" y="32" width="60" height="60" rx="10" fill="#efe7d4" stroke="${PEN}" stroke-width="2"/>` + circ(110, 62, 15, "#ff8a7a") +
      [[92, 32, 18], [128, 32, 18], [92, 92, 106], [128, 92, 106]].map(([x, y1, y2]) => ln(x, y1, x, y2, PEN, 3)).join("") +
      `<path d="M92 14 H72 V110 H92 M128 14 H148 V110 H128" fill="none" stroke="#a3360f" stroke-width="2"/>` +
      tx(46, 32, "always", { s: 14, c: "#a3360f" }) + tx(46, 46, "joined", { s: 14, c: "#a3360f" }) +
      tx(174, 32, "always", { s: 14, c: "#a3360f" }) + tx(174, 46, "joined", { s: 14, c: "#a3360f" }) + tx(110, 126, "press: the two columns join", { s: 15 }),
    buttonsAnd: () => {
      const btn = (x, y) => circ(x - 12, y, 3, PEN) + circ(x + 12, y, 3, PEN) + ln(x - 14, y - 3, x + 14, y - 3, PEN, 2.6) + ln(x, y - 3, x, y - 14, PEN, 2.2);
      return current(loopPath) + pl([[X0, YM - 5], [X0, Y0], [82, Y0]]) + resH(82, 134, Y0) + pl([[134, Y0], [X1, Y0], [X1, YM - 7]]) + pl([[X1, YM + 7], [X1, Y1], [150, Y1]]) +
        btn(138, Y1) + pl([[126, Y1], [96, Y1]]) + btn(84, Y1) + pl([[72, Y1], [X0, Y1], [X0, YM + 4]]) + battery(X0, YM) + ledV(X1, YM) +
        tx(106, 66, "this AND that", { s: 16, c: "#a3360f" });
    },
    buttonsOr: () => {
      const btn = (x, y) => circ(x - 12, y, 3, PEN) + circ(x + 12, y, 3, PEN) + ln(x - 14, y - 3, x + 14, y - 3, PEN, 2.6) + ln(x, y - 3, x, y - 14, PEN, 2.2);
      return current([[X0, YM - 10], [X0, Y0], [X1, Y0], [X1, Y1], [126, Y1], [94, Y1], [X0, Y1], [X0, YM + 12]]) + pl([[X0, YM - 5], [X0, Y0], [82, Y0]]) + resH(82, 134, Y0) + pl([[134, Y0], [X1, Y0], [X1, YM - 7]]) +
        pl([[X1, YM + 7], [X1, Y1], [124, Y1]]) + btn(110, Y1) + pl([[96, Y1], [X0, Y1], [X0, YM + 4]]) +
        pl([[150, Y1], [150, 82], [124, 82]]) + `<g opacity=".9">${circ(98, 82, 3, PEN) + circ(122, 82, 3, PEN) + ln(96, 68, 124, 68, PEN, 2.6) + ln(110, 68, 110, 57, PEN, 2.2)}</g>` +
        pl([[96, 82], [70, 82], [70, Y1]]) + battery(X0, YM) + ledV(X1, YM) + tx(110, 46, "this OR that", { s: 20, c: "#a3360f" });
    },
    // Chapter 8: capacitors and time (the capacitor symbol: two plates, the + one marked)
    capStore: () => {
      const cap = (x, y) => ln(x - 14, y - 4, x + 14, y - 4, PEN, 3) + `<path d="M${x - 14} ${y + 6} q14 -6 28 0" fill="none" stroke="${PEN}" stroke-width="3"/>` + tx(x - 20, y - 6, "+", { s: 16, c: RED });
      return current([[70, 54], [70, 40], [150, 40], [150, 104], [70, 104], [70, 64]], 14) + pl([[70, 54], [70, 40], [96, 40]]) + resH(96, 128, 40, 5) +
        pl([[128, 40], [150, 40], [150, 59]]) + ledV(150, 66, true, true) + pl([[150, 73], [150, 104], [70, 104], [70, 64]]) + cap(70, 58) + tx(110, 24, "it empties", { s: 17, c: "#a3360f" }) +
        tx(110, 124, "through the LED: a short glow", { s: 16 });
    },
    capTime: () => ln(30, 108, 200, 108, PEN, 2) + ln(30, 108, 30, 18, PEN, 2) + `<path d="M30 108 C60 40 100 32 196 28" fill="none" stroke="${DOT}" stroke-width="4"/>` +
      ln(30, 24, 200, 24, GREY, 1.4) + tx(14, 30, "6 V", { s: 15 }) + tx(196, 124, "time", { s: 15 }) + tx(80, 60, "fast", { s: 17, c: "#a3360f" }) + tx(160, 46, "slow", { s: 17, c: "#a3360f" }),
    tau: () => tx(110, 36, "R × C = time", { s: 24 }) + ln(40, 46, 180, 46, HL, 7) + tx(110, 78, "1 kΩ × 1000 µF = 1 s", { s: 19, c: "#a3360f" }) +
      tx(110, 108, "10 kΩ × 1000 µF = 10 s", { s: 19 }),
    capPolarity: () => {
      // straight plate = + (marked), curved plate = −; flipped: the + plate faces the − side
      const cap = (x, y, flip) => { const f = flip ? -1 : 1;
        return ln(x - 4 * f, y - 14, x - 4 * f, y + 14, PEN, 3) + `<path d="M${x + 6 * f} ${y - 14} q${-6 * f} 14 0 28" fill="none" stroke="${PEN}" stroke-width="3"/>` +
          tx(x - 12 * f, y + 24, "+", { s: 13, c: RED }); };
      return ln(30, 40, 66, 40) + cap(70, 40) + ln(76, 40, 110, 40) + tx(44, 28, "+ side", { s: 15, c: RED }) + tx(98, 28, "− side", { s: 15, c: BLUE }) + tick(130, 40) +
        ln(30, 98, 64, 98) + cap(70, 98, true) + ln(74, 98, 110, 98) + tx(44, 86, "+ side", { s: 15, c: RED }) + tx(98, 86, "− side", { s: 15, c: BLUE }) + burst(132, 98, 12) +
        tx(176, 44, "right", { s: 17 }) + tx(180, 102, "vents!", { s: 17, c: RED });
    },
    // Chapter 9: the transistor (a circle with the base bar, collector above, emitter below with its arrow)
    npnSwitch: () => {
      const x = 148, y = 84;
      const npn = circ(x, y, 17, "#fffdf6") + ln(x - 8, y - 10, x - 8, y + 10, PEN, 3) + pl([[x - 8, y - 4], [x, y - 11], [x, y - 17]]) +
        pl([[x - 8, y + 4], [x, y + 11], [x, y + 17]]) + arrow(x - 1, y + 10, 40, PEN) + ln(x - 24, y, x - 8, y);
      return current([[x, 10], [x, 120]], 9) + current([[46, y], [x - 24, y]], 18) + ln(x, 10, x, 22) + resV(x, 22, 40, 4) + ledV(x, 50) + ln(x, 57, x, y - 17) +
        ln(x, y + 17, x, 120) + npn + ln(46, y, 62, y) + resH(62, 104, y, 4) + ln(104, y, x - 24, y) +
        tx(84, y - 14, "tiny", { s: 17, c: "#a3360f" }) + tx(x + 40, 44, "big", { s: 19, c: "#a3360f" }) + tx(127, y - 6, "B", { s: 15 }) +
        tx(x + 22, y - 12, "C", { s: 15 }) + tx(x + 22, y + 26, "E", { s: 15 }) +
        tx(x + 12, 18, "+", { s: 16, c: RED }) + tx(x + 12, 128, "−", { s: 16, c: BLUE }) + tx(40, 76, "+", { s: 15, c: RED });
    },
    baseR: () => {
      const npn = (x, y) => circ(x, y, 15, "#fffdf6") + ln(x - 4, y - 9, x - 4, y + 9, PEN, 3) + ln(x - 4, y - 3, x + 7, y - 11) + ln(x - 4, y + 3, x + 7, y + 11) + ln(x - 19, y, x - 4, y) +
        arrow(x + 6, y + 10, 40, PEN);
      return ln(20, 44, 40, 44) + resH(40, 70, 44, 4) + ln(70, 44, 86, 44) + npn(105, 44) + tick(150, 44) + tx(56, 26, "10 kΩ", { s: 15 }) +
        ln(20, 98, 86, 98) + npn(105, 98) + burst(126, 86, 11) + tx(170, 104, "pop!", { s: 18, c: RED }) + tx(52, 120, "straight from +", { s: 15 });
    },
    // Chapter 10: sensors (the light sensor: a resistor in a circle, with arrows of light)
    ldr: () => {
      const ldr = (x, y, lit) => circ(x, y, 20, "#fffdf6") + resH(x - 14, x + 14, y, 4) + (lit ? arrow(x - 16, y - 24, 50, "#e0a21c") + ln(x - 30, y - 40, x - 17, y - 25, "#e0a21c", 2.2) +
        arrow(x - 4, y - 26, 60, "#e0a21c") + ln(x - 14, y - 44, x - 5, y - 27, "#e0a21c", 2.2) : "");
      return ldr(60, 60, true) + tx(60, 104, "light: 2 kΩ", { s: 17 }) + ldr(160, 60, false) + `<path d="M140 26 q20 -14 40 0 l4 24 h-48z" fill="#5c6b7c" opacity=".55"/>` +
        tx(160, 104, "covered: 75 kΩ", { s: 17, c: "#a3360f" });
    },
    ldrDivider: () => ln(30, 16, 196, 16, RED, 2.4) + ln(30, 114, 196, 114, BLUE, 2.4) + tx(184, 11, "6 V", { s: 13, c: RED }) + ln(90, 16, 90, 26) + circ(90, 40, 13, "#fffdf6") + resV(90, 30, 50, 4) + [[60, 24], [66, 19]].map(([x1, y1]) => ln(x1, y1, x1 + 10, y1 + 8, "#e0a21c", 1.8) + arrow(x1 + 11, y1 + 9, 39, "#e0a21c")).join("") +
      ln(90, 53, 90, 72) + resV(90, 72, 104, 6) + ln(90, 104, 90, 114) + circ(90, 62, 3.5, PEN) + meter(166, 56, "V") +
      probeTo(93, 63, 166, 56, "red", -5) + probeTo(178, 112, 166, 56, "black", -4) +
      tx(128, 84, "light: 5 V", { s: 14 }) + tx(128, 102, "dark: 0.7 V", { s: 14, c: "#a3360f" }) + tx(50, 44, "sensor", { s: 14 }) + tx(52, 92, "10 kΩ", { s: 14 }),
    nightLight: () => {
      const x = 156, y = 84;
      const npn = circ(x, y, 15, "#fffdf6") + ln(x - 7, y - 9, x - 7, y + 9, PEN, 3) + pl([[x - 7, y - 3], [x, y - 10], [x, y - 15]]) + pl([[x - 7, y + 3], [x, y + 10], [x, y + 15]]) +
        arrow(x - 1, y + 9, 40, PEN);
      return ln(30, 12, 196, 12, RED, 2.2) + ln(30, 122, 196, 122, BLUE, 2.2) + ln(x, 12, x, 20) + resV(x, 20, 36, 4) + ledV(x, 46, true, true) + ln(x, 53, x, y - 15) + npn +
        ln(x, y + 15, x, 122) + ln(70, 12, 70, 24) + resV(70, 24, 60, 5) + ln(70, 60, 70, y) + ln(70, y, x - 7, y) + circ(70, 100, 11, "#fffdf6") + resV(70, 92, 108, 3) + [[40, 80], [47, 75]].map(([x1, y1]) => ln(x1, y1, x1 + 11, y1 + 9, "#e0a21c", 1.8) + arrow(x1 + 12, y1 + 10, 39, "#e0a21c")).join("") +
        ln(70, y, 70, 89) + ln(70, 111, 70, 122) + tx(40, 46, "100 kΩ", { s: 14 }) + tx(36, 104, "sensor", { s: 14 }) + tx(192, 50, "on in", { s: 14, c: "#a3360f" }) + tx(192, 66, "the dark", { s: 14, c: "#a3360f" });
    },
    // a board pin set HIGH: a switch inside the board joins it to 5 V, and the LED on it lights
    pinOut: () => `<rect x="10" y="14" width="76" height="106" rx="8" fill="#fffdf6" stroke="${PEN}" stroke-width="2.2"/>` + tx(48, 32, "board", { s: 15 }) +
      circ(36, 52, 3.5, RED, RED) + tx(26, 57, "5V", { s: 13, c: RED, a: "end" }) + circ(36, 88, 3.5, BLUE, BLUE) + tx(26, 93, "0V", { s: 13, c: BLUE, a: "end" }) +
      ln(62, 70, 39, 54) + circ(62, 70, 3.5, PEN, PEN) + ln(62, 70, 86, 70) + tx(72, 62, "D13", { s: 12 }) + pl([[86, 108], [36, 108], [36, 92]]) + tx(64, 104, "GND", { s: 11 }) +
      current([[86, 70], [102, 70]]) + ln(86, 70, 102, 70) + resH(102, 138, 70) + current([[138, 70], [176, 70], [176, 82]]) + ln(138, 70, 176, 70) + ln(176, 70, 176, 85) +
      ledV(176, 92) + ln(176, 99, 176, 108) + current([[176, 100], [176, 108], [92, 108]]) + ln(176, 108, 86, 108) +
      tx(150, 32, "HIGH: lit", { s: 16, c: "#a3360f" }) + tx(150, 48, "LOW: dark", { s: 16 }),
    // no resistor: the pin gives too much and is damaged; with 330 Ω about 9 mA
    pinLimit: () => tx(56, 20, "no resistor", { s: 15 }) + tx(16, 46, "D13", { s: 12 }) + ln(40, 42, 60, 42) + ln(60, 42, 60, 58) + ledV(60, 65) + ln(60, 72, 60, 104) +
      tx(60, 120, "GND", { s: 12, c: BLUE }) + burst(42, 42, 10) + tx(80, 92, "64 mA", { s: 16, c: RED, a: "start" }) +
      `<line x1="112" y1="14" x2="112" y2="120" stroke="${GREY}" stroke-width="1.6" stroke-dasharray="4 5"/>` +
      tx(158, 20, "with 330 Ω", { s: 15 }) + tx(122, 46, "D13", { s: 12 }) + ln(134, 42, 142, 42) + resH(142, 176, 42) + ln(176, 42, 188, 42) + ln(188, 42, 188, 58) +
      ledV(188, 65) + ln(188, 72, 188, 104) + tx(188, 120, "GND", { s: 12, c: BLUE }) + tx(144, 92, "8 mA", { s: 16, c: "#a3360f" }) + tick(146, 104),
    // a knob's middle leg into A0: the push becomes a number
    analogRead: () => tx(46, 18, "5 V", { s: 14, c: RED }) + ln(46, 22, 46, 32) + resV(46, 32, 100) + ln(46, 100, 46, 110) + tx(46, 126, "0 V", { s: 14, c: BLUE }) +
      arrow(56, 66, 180, PEN) + ln(56, 66, 114, 66) + tx(84, 60, "A0", { s: 14 }) +
      `<rect x="114" y="34" width="94" height="60" rx="8" fill="#fffdf6" stroke="${PEN}" stroke-width="2.2"/>` +
      `<rect x="124" y="48" width="74" height="30" rx="5" fill="rgba(120, 200, 160, .25)" stroke="${PEN}" stroke-width="1.6"/>` + tx(161, 70, "512", { s: 20, c: "#a3360f" }) +
      tx(161, 112, "0 V → 0", { s: 14 }) + tx(161, 127, "5 V → 1023", { s: 14 }),
    // what a pin set to IN reads, for each push
    pinIn: () => `<rect x="40" y="14" width="30" height="42" fill="rgba(200, 54, 46, .18)"/><rect x="40" y="56" width="30" height="32" fill="rgba(141, 138, 128, .18)"/>` +
      `<rect x="40" y="88" width="30" height="32" fill="rgba(47, 99, 200, .18)"/><rect x="40" y="14" width="30" height="106" fill="none" stroke="${PEN}" stroke-width="2.2"/>` +
      tx(34, 20, "5 V", { s: 13, a: "end" }) + tx(34, 60, "3 V", { s: 13, a: "end" }) + tx(34, 92, "1.5 V", { s: 13, a: "end" }) + tx(34, 124, "0 V", { s: 13, a: "end" }) +
      tx(96, 40, "HIGH", { s: 17, c: RED }) + tx(96, 77, "?", { s: 19, c: GREY }) + tx(96, 110, "LOW", { s: 17, c: BLUE }) +
      tx(168, 52, "a pin set to IN", { s: 15 }) + tx(168, 70, "reads the voltage;", { s: 15 }) + tx(168, 88, "it puts none out", { s: 15 }),
    // a button from 5 V into D2, and the pull-down from D2 to GND
    pullDown: () => ln(18, 14, 110, 14, RED, 2.2) + tx(124, 19, "5 V", { s: 14, c: RED }) + ln(60, 14, 60, 28) + circ(60, 28, 2.6, PEN, PEN) + ln(70, 24, 70, 50, PEN, 2.6) + ln(70, 37, 80, 37) +
      circ(60, 46, 2.6, PEN, PEN) + tx(86, 41, "button", { s: 14, a: "start" }) + ln(60, 46, 60, 66) + circ(60, 66, 3.5, PEN, PEN) + ln(60, 66, 140, 66) +
      `<rect x="140" y="50" width="66" height="32" rx="6" fill="#fffdf6" stroke="${PEN}" stroke-width="2.2"/>` + tx(173, 72, "D2: IN", { s: 15 }) +
      ln(60, 66, 60, 76) + resV(60, 76, 106) + ln(60, 106, 60, 120) + ln(18, 120, 110, 120, BLUE, 2.2) + tx(124, 124, "GND", { s: 14, c: BLUE }) +
      tx(30, 96, "10 kΩ", { s: 14 }) + tx(173, 102, "holds it LOW", { s: 14, c: "#a3360f" }) + tx(173, 117, "till pressed", { s: 14, c: "#a3360f" }),
    // the board's program joins what it reads to what it sets
    program: () => `<rect x="58" y="22" width="104" height="86" rx="8" fill="#fffdf6" stroke="${PEN}" stroke-width="2.2"/>` +
      `<rect x="68" y="30" width="84" height="26" rx="5" fill="rgba(120, 200, 160, .25)" stroke="${PEN}" stroke-width="1.6"/>` + tx(110, 49, "D13 = D2", { s: 15 }) +
      tx(72, 96, "D2", { s: 13 }) + tx(146, 96, "D13", { s: 13 }) + `<path d="M80 86 C 96 66, 124 66, 138 84" fill="none" stroke="${DOT}" stroke-width="2.4" stroke-dasharray="5 4"/>` + arrow(138, 84, 55) +
      ln(20, 82, 32, 82) + circ(32, 82, 2.6, PEN, PEN) + ln(28, 74, 52, 74, PEN, 2.6) + ln(40, 74, 40, 67) + circ(48, 82, 2.6, PEN, PEN) + ln(48, 82, 58, 82) + tx(30, 61, "button", { s: 13 }) +
      ln(53, 82, 53, 90) + resV(53, 90, 108, 4) + ln(53, 108, 53, 113) + tx(53, 124, "GND", { s: 11, c: BLUE }) + tx(30, 102, "10 kΩ", { s: 11 }) +
      tx(12, 78, "5 V", { s: 13, c: RED }) + ln(162, 82, 166, 82) + resH(166, 184, 82, 4) + ln(184, 82, 196, 82) + ln(196, 82, 196, 92) +
      ledV(196, 99, false) + ln(196, 106, 196, 112) + tx(196, 126, "GND", { s: 12, c: BLUE }) + tx(126, 124, "the program decides", { s: 13, c: "#a3360f" }),
  };

  // Reading a resistor's colour bands (the Notebook's Real bench page): two digits, then how many zeros, then the tolerance.
  D.bands = () => ln(14, 52, 50, 52, PEN, 2.4) + ln(170, 52, 206, 52, PEN, 2.4) +
    `<rect x="50" y="38" width="120" height="28" rx="12" fill="#ecd3a4" stroke="${PEN}" stroke-width="2.2"/>` +
    [[66, "#e8822a"], [86, "#e8822a"], [112, "#7a4520"], [152, "#a67c1f"]].map(([x, c]) => `<rect x="${x - 5}" y="39" width="10" height="26" fill="${c}"/>`).join("") +
    tx(66, 30, "3", { s: 17 }) + tx(86, 30, "3", { s: 17 }) + tx(117, 30, "× 10", { s: 15 }) + tx(155, 30, "± 5 %", { s: 15 }) +
    tx(110, 92, "orange, orange, brown = 330 Ω", { s: 16, c: "#a3360f" }) + tx(110, 114, "gold: within 5 %", { s: 15 });
  // The symbols circuit drawings use (the Notebook's first card): battery, resistor, LED, capacitor, switch, meter.
  D.symbols = () => {
    const at = [[36, 28], [110, 28], [184, 28], [36, 84], [110, 84], [184, 84]], w = (x, y) => ln(x, y - 18, x, y - 9) + ln(x, y + 9, x, y + 18);
    const [b, r, l, c, sw, m] = at;
    return ln(b[0], b[1] - 18, b[0], b[1] - 5) + ln(b[0], b[1] + 4, b[0], b[1] + 18) + battery(b[0], b[1]) + tx(b[0], b[1] + 36, "battery", { s: 15 }) +
      resV(r[0], r[1] - 18, r[1] + 18, 5) + tx(r[0], r[1] + 36, "resistor", { s: 15 }) +
      w(l[0], l[1]) + ledV(l[0], l[1], false) + tx(l[0], l[1] + 36, "LED", { s: 15 }) +
      ln(c[0], c[1] - 18, c[0], c[1] - 4) + ln(c[0] - 12, c[1] - 4, c[0] + 12, c[1] - 4, PEN, 3) +
        `<path d="M${c[0] - 12} ${c[1] + 6} q12 -6 24 0" fill="none" stroke="${PEN}" stroke-width="3"/>` + ln(c[0], c[1] + 3, c[0], c[1] + 18) + tx(c[0] - 20, c[1] - 1, "+", { c: RED, s: 16 }) + tx(c[0], c[1] + 36, "capacitor", { s: 15 }) +
      ln(sw[0], sw[1] - 18, sw[0], sw[1] - 8) + circ(sw[0], sw[1] - 8, 2.4, PEN) + ln(sw[0], sw[1] - 8, sw[0] + 10, sw[1] + 6) + circ(sw[0], sw[1] + 8, 2.4, PEN) +
        ln(sw[0], sw[1] + 8, sw[0], sw[1] + 18) + tx(sw[0], sw[1] + 36, "switch", { s: 15 }) +
      ln(m[0], m[1] - 18, m[0], m[1] - 14) + ln(m[0], m[1] + 14, m[0], m[1] + 18) + meter(m[0], m[1], "V") + tx(m[0], m[1] + 36, "meter", { s: 15 });
  };
  function diagram(id) {
    const f = D[id];
    if (!f) return "";
    const k = ++uid;
    return `<svg viewBox="0 0 220 130" role="img" aria-hidden="true"><defs><filter id="ink${k}" x="-5%" y="-5%" width="110%" height="110%">` +
      `<feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="${k % 9}"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter></defs>` +
      `<g filter="url(#ink${k})">${f()}</g></svg>`;
  }

  // Small ink symbols for the chapter openers' word cards (viewBox 64 × 48): a meter with its letter, or a part's symbol.
  const SYM = {
    meter: (t) => ln(32, 4, 32, 10) + ln(32, 38, 32, 44) + circ(32, 24, 14, "#fffdf6") + tx(32, 24 + (t.length > 1 ? 5 : 6), t, { s: t.length > 1 ? 14 : 19 }),
    resistor: () => ln(4, 24, 12, 24) + resH(12, 52, 24, 6) + ln(52, 24, 60, 24),
    fuse: () => ln(4, 24, 14, 24) + `<rect x="14" y="16" width="36" height="16" rx="4" fill="#fffdf6" stroke="${PEN}" stroke-width="2.2"/>` + `<path d="M16 24 q8 -8 16 0 t16 0" fill="none" stroke="${RED}" stroke-width="2"/>` + ln(50, 24, 60, 24),
    probes: () => pl([[10, 6], [10, 30]], RED, 3) + `<path d="M6 30 h8 l-4 12 z" fill="${RED}"/>` + pl([[30, 6], [30, 30]], PEN, 3) + `<path d="M26 30 h8 l-4 12 z" fill="${PEN}"/>` + tx(48, 20, "+", { c: RED, s: 18 }) + tx(48, 40, "−", { s: 18 }),
    battery: () => ln(32, 4, 32, 18) + battery(32, 24, false) + ln(32, 28, 32, 44) + tx(14, 22, "+", { c: RED, s: 16 }),
    led: () => ln(32, 2, 32, 15) + ledV(32, 24, true) + ln(32, 31, 32, 46),
    cap: () => ln(32, 4, 32, 20) + ln(18, 20, 46, 20, PEN, 3) + `<path d="M18 30 q14 -6 28 0" fill="none" stroke="${PEN}" stroke-width="3"/>` + ln(32, 28, 32, 44) + tx(14, 18, "+", { c: RED, s: 16 }),
    switch: () => ln(4, 30, 18, 30) + circ(18, 30, 2.6, PEN) + ln(18, 30, 42, 16) + circ(46, 30, 2.6, PEN) + ln(46, 30, 60, 30),
    button: () => ln(4, 32, 18, 32) + circ(18, 32, 2.6, PEN) + circ(46, 32, 2.6, PEN) + ln(46, 32, 60, 32) + ln(14, 22, 50, 22, PEN, 2.6) + ln(32, 22, 32, 10),
    pot: () => ln(4, 30, 12, 30) + resH(12, 52, 30, 6) + ln(52, 30, 60, 30) + `<path d="M32 6 V20" stroke="${PEN}" stroke-width="2.2"/><path d="M27 15 L32 22 L37 15" fill="none" stroke="${PEN}" stroke-width="2.2"/>`,
    ldr: () => ln(4, 31, 18, 31) + ln(46, 31, 60, 31) + circ(32, 31, 14, "#fffdf6") + resH(20, 44, 31, 4) +
      [[10, 4], [20, 2]].map(([x1, y1]) => ln(x1, y1, x1 + 7, y1 + 9, "#e0a21c", 1.6) + arrow(x1 + 7.5, y1 + 10, 52, "#e0a21c")).join(""),
    npn: () => circ(36, 24, 15, "#fffdf6") + ln(30, 15, 30, 33, PEN, 3) + ln(30, 20, 41, 12) + ln(30, 28, 41, 36) + ln(41, 12, 41, 2) + ln(41, 36, 41, 46) + ln(10, 24, 30, 24) + arrow(40, 35, 40, PEN),
    gnd: () => ln(32, 4, 32, 22) + ln(16, 22, 48, 22, PEN, 2.6) + ln(21, 30, 43, 30, PEN, 2.4) + ln(26, 38, 38, 38, PEN, 2.2),
    heat: () => ln(4, 34, 12, 34) + resH(12, 52, 34, 6) + ln(52, 34, 60, 34) +
      `<path d="M22 22 q4 -5 0 -10 t0 -10 M32 22 q4 -5 0 -10 t0 -10 M42 22 q4 -5 0 -10 t0 -10" fill="none" stroke="${RED}" stroke-width="1.8" stroke-linecap="round"/>`,
    gap: () => `<rect x="6" y="8" width="20" height="32" rx="6" fill="#efe7d4" stroke="${PEN}" stroke-width="1.6"/><rect x="38" y="8" width="20" height="32" rx="6" fill="#efe7d4" stroke="${PEN}" stroke-width="1.6"/>` + ln(32, 4, 32, 44, RED, 2),
    short: () => ln(20, 8, 20, 18) + battery(20, 24, false) + ln(20, 28, 20, 40) + pl([[20, 8], [50, 8], [50, 40], [20, 40]], PEN, 2.6) + tx(10, 20, "+", { c: RED, s: 14 }) +
      `<path d="M54 14 q4 -4 0 -8 M60 16 q4 -5 0 -10" fill="none" stroke="${RED}" stroke-width="1.8" stroke-linecap="round"/>`,
    rail: () => `<rect x="6" y="16" width="52" height="14" rx="7" fill="#efe7d4" stroke="${PEN}" stroke-width="1.4"/>` + ln(8, 10, 56, 10, RED, 2.2) +
      [14, 26, 38, 50].map((x) => `<circle cx="${x}" cy="23" r="2.2" fill="${PEN}"/>`).join("") + tx(32, 44, "+ rail", { s: 12, c: RED }),
    clock: () => circ(32, 24, 17, "#fffdf6") + ln(32, 24, 32, 12) + ln(32, 24, 41, 28),
    chip: () => `<rect x="16" y="10" width="32" height="28" rx="4" fill="#2b2a26"/>` + [14, 22, 30].map((y) => ln(10, y, 16, y) + ln(48, y, 54, y)).join(""),
  };
  // A word card's symbol: a part's name, or any short text, which goes in a meter's circle.
  function symbol(key) {
    const k = ++uid, body = SYM[key] ? SYM[key]() : SYM.meter(String(key));
    return `<svg viewBox="0 0 64 48" aria-hidden="true"><defs><filter id="ink${k}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="${k % 9}"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter></defs><g filter="url(#ink${k})">${body}</g></svg>`;
  }

  BB.NotebookArt = { diagram, symbol, ids: () => Object.keys(D) };
})(window.BB = window.BB || {});
