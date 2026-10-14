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
    (lbl ? tx(x - 22, y - 1, "+", { c: RED, s: 20 }) + tx(x - 22, y + 15, "−", { c: BLUE, s: 20 }) : "");
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
  function ledV(x, y, lit = true, dim = false) {
    const glow = lit ? `<circle cx="${x}" cy="${y}" r="${dim ? 11 : 17}" fill="rgba(255, 190, 70, ${dim ? 0.25 : 0.45})"/>` : "";
    const rays = lit && !dim ? ln(x + 12, y - 8, x + 20, y - 14, DOT, 2.4) + ln(x + 13, y + 1, x + 22, y - 2, DOT, 2.4) : "";
    return glow + `<path d="M${x - 10} ${y - 7} L${x + 10} ${y - 7} L${x} ${y + 7} Z" fill="${lit ? "#ffd27a" : "#fffdf6"}" stroke="${PEN}" stroke-width="2.2" stroke-linejoin="round"/>` +
      ln(x - 10, y + 7, x + 10, y + 7, PEN, 2.6) + rays;
  }
  // a meter: a circle with its letter, and a reading written beside it
  const meter = (x, y, letter, reading, rx = x, ry = y + 32) => circ(x, y, 14, "#fffdf6") + tx(x, y + 6, letter, { s: letter.length > 1 ? 15 : 19 }) +
    (reading ? tx(rx, ry, reading, { s: 19, c: "#a3360f" }) : "");
  const probe = (pts, c) => pl(pts, c, 2.4);
  const cross = (x, y, s = 9, c = RED) => ln(x - s, y - s, x + s, y + s, c, 3) + ln(x - s, y + s, x + s, y - s, c, 3);
  const tick = (x, y, c = "#2f8a43") => pl([[x - 7, y], [x - 2, y + 6], [x + 9, y - 8]], c, 3);
  const burst = (x, y, r = 14, c = RED) => {
    let d = "";
    for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8, rr = k % 2 ? r * 0.5 : r; d += `${k ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`; }
    return `<path d="${d}Z" fill="#ffd27a" stroke="${c}" stroke-width="2"/>`;
  };
  // a breadboard slot of five holes, vertical, top hole at y, 12 apart
  const slot = (x, y, n = 5, bar = true) => `<rect x="${x - 9}" y="${y - 9}" width="18" height="${(n - 1) * 12 + 18}" rx="9" fill="#efe7d4" stroke="${PEN}" stroke-width="1.6"/>` +
    (bar ? `<rect x="${x - 3}" y="${y - 3}" width="6" height="${(n - 1) * 12 + 6}" rx="3" fill="#b9bec4" opacity=".9"/>` : "") +
    Array.from({ length: n }, (_, k) => `<circle cx="${x}" cy="${y + k * 12}" r="2.6" fill="${PEN}"/>`).join("");

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
    strip: () => slot(64, 22) + slot(156, 22, 5, false) + tx(64, 106, "joined inside", { s: 16 }) + tx(156, 106, "the next strip", { s: 16 }) +
      `<path d="M82 28 C90 40 90 64 82 76" fill="none" stroke="${PEN}" stroke-width="2"/>` + tx(96, 58, "5", { s: 20 }) + cross(122, 52, 6),
    rail: () => `<rect x="18" y="30" width="186" height="20" rx="10" fill="#efe7d4" stroke="${PEN}" stroke-width="1.6"/>` + ln(22, 25, 200, 25, RED, 2.4) +
      `<rect x="18" y="70" width="186" height="20" rx="10" fill="#efe7d4" stroke="${PEN}" stroke-width="1.6"/>` + ln(22, 95, 200, 95, BLUE, 2.4) +
      Array.from({ length: 12 }, (_, k) => `<circle cx="${30 + k * 15.5}" cy="40" r="2.6" fill="${PEN}"/><circle cx="${30 + k * 15.5}" cy="80" r="2.6" fill="${PEN}"/>`).join("") +
      tx(12, 45, "+", { c: RED, s: 22 }) + tx(12, 86, "−", { c: BLUE, s: 22 }) + tx(112, 117, "one strip, the whole length", { s: 16 }),
    gap: () => slot(90, 12, 4) + slot(90, 80, 4) + slot(140, 12, 4) + slot(140, 80, 4) +
      `<rect x="62" y="62" width="108" height="10" rx="5" fill="#d9cfb8"/>` + cross(115, 67, 7) + tx(192, 58, "not", { s: 17 }) + tx(192, 76, "joined", { s: 17 }) +
      tx(40, 70, "gap", { s: 17 }),
    polarity: () => ln(30, 64, 92, 64, PEN, 2.4) + ln(128, 64, 182, 64, PEN, 2.4) +
      `<path d="M92 50 L92 78 L120 64 Z" fill="#ffd27a" stroke="${PEN}" stroke-width="2.4" stroke-linejoin="round"/>` + ln(121, 49, 121, 79, PEN, 3) +
      tx(46, 54, "+ long leg", { s: 16, c: RED }) + tx(160, 54, "− short", { s: 16, c: BLUE }) +
      arrow(150, 92, 0, "#2f8a43") + ln(66, 92, 148, 92, "#2f8a43", 2.4) + tick(176, 92) +
      ln(66, 112, 148, 112, RED, 2.4) + arrow(68, 112, 180, RED) + cross(176, 110, 6),
    resistor: () => pl([[20, 40], [20, 22], [44, 22]]) + resH(44, 84, 22) + pl([[84, 22], [100, 22], [100, 34]]) + ledV(100, 44) + pl([[100, 51], [100, 66], [20, 66], [20, 48]]) +
      battery(20, 44, false) + tx(60, 92, "with: a safe glow", { s: 16 }) + tick(60, 108) +
      pl([[130, 40], [130, 22], [200, 22], [200, 34]]) + burst(200, 46) + pl([[200, 56], [200, 66], [130, 66], [130, 48]]) + battery(130, 44, false) +
      tx(166, 92, "without: pop!", { s: 16, c: RED }),
    short: () => current([[60, 58], [60, 26], [160, 26], [160, 104], [60, 104], [60, 76]], 7) + pl([[60, 60], [60, 26], [160, 26], [160, 104], [60, 104], [60, 70]]) +
      battery(60, 65) + `<path d="M150 40 q8 -8 0 -16 M162 44 q8 -10 0 -20 M174 40 q8 -8 0 -16" fill="none" stroke="${RED}" stroke-width="2.4" stroke-linecap="round"/>` +
      tx(186, 70, "hot!", { s: 22, c: RED }) + tx(110, 122, "nothing in the way", { s: 16 }),
    volts: () => pl([[70, 58], [70, 26], [110, 26]]) + pl([[70, 72], [70, 104], [110, 104]]) + battery(70, 65) +
      probe([[110, 26], [150, 26], [150, 51]], RED) + probe([[110, 104], [150, 104], [150, 79]], PEN) + meter(150, 65, "V", "6 V", 186, 71) +
      tx(110, 122, "the push between two points", { s: 16 }),
    across: () => current(loopPath) + loopWires({ resAt: true }) + battery(X0, YM) + ledV(X1, YM) +
      tx(108, 50, "4 V", { s: 19, c: "#a3360f" }) + ln(100, 38, 108, 33, "#a3360f", 1.6) +
      tx(146, 82, "2 V", { s: 19, c: "#a3360f" }) + ln(158, 74, 166, 70, "#a3360f", 1.6) +
      tx(110, 124, "4 V + 2 V = the battery's 6 V", { s: 16 }),
    current: () => current([[X0, YM - 10], [X0, Y0], [X1, Y0], [X1, Y1], [126, Y1], [94, Y1], [X0, Y1], [X0, YM + 12]]) +
      pl([[X0, YM - 5], [X0, Y0], [82, Y0]]) + resH(82, 134, Y0) + pl([[134, Y0], [X1, Y0], [X1, YM - 7]]) + pl([[X1, YM + 7], [X1, Y1], [124, Y1]]) + pl([[96, Y1], [X0, Y1], [X0, YM + 4]]) +
      battery(X0, YM) + ledV(X1, YM) + meter(110, Y1, "mA", "12 mA", 110, 76),
    sameCurrent: () => current([[X0, YM - 10], [X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1], [X0, YM + 12]]) + pl([[X0, YM - 5], [X0, Y0], [96, Y0]]) + pl([[124, Y0], [X1, Y0], [X1, YM - 7]]) +
      pl([[X1, YM + 7], [X1, Y1], [124, Y1]]) + pl([[96, Y1], [X0, Y1], [X0, YM + 4]]) + battery(X0, YM) + ledV(X1, YM) +
      meter(110, Y0, "mA", "12 mA", 110, 56) + meter(110, Y1, "mA", "12 mA", 110, 90) + tx(110, 73, "same!", { s: 17, c: "#2f8a43" }),
    fuse: () => pl([[70, 58], [70, 26], [130, 26]]) + pl([[70, 72], [70, 104], [130, 104]]) + battery(70, 65) +
      probe([[130, 26], [150, 26], [150, 51]], RED) + probe([[130, 104], [150, 104], [150, 79]], PEN) + meter(150, 65, "mA") + burst(170, 48, 12) +
      tx(192, 92, "pop!", { s: 20, c: RED }) + tx(110, 122, "mA never across a battery", { s: 16 }),
    biggerR: () => {
      const mini = (ox, r, many) => current([[ox, 50], [ox, 26], [ox + 76, 26], [ox + 76, 94], [ox, 94], [ox, 70]], many ? 9 : 20) +
        pl([[ox, 55], [ox, 26], [ox + 18, 26]]) + resH(ox + 18, ox + 50, 26, 5) + pl([[ox + 50, 26], [ox + 76, 26], [ox + 76, 53]]) + ledV(ox + 76, 60, true, !many) +
        pl([[ox + 76, 67], [ox + 76, 94], [ox, 94], [ox, 64]]) + battery(ox, 60, false) + tx(ox + 34, 16, r, { s: 17 });
      return mini(20, "220 Ω", true) + mini(124, "1 kΩ", false) + tx(58, 116, "more flow", { s: 16 }) + tx(162, 116, "less flow", { s: 16 });
    },
    ohms: () => ln(60, 64, 76, 64) + resH(76, 124, 64) + ln(124, 64, 140, 64) + probe([[60, 64], [60, 98], [96, 98]], RED) + probe([[140, 64], [140, 98], [124, 98]], PEN) +
      meter(110, 98, "Ω", "330 Ω", 110, 40) + battery(186, 28, false) + cross(186, 28, 11) + tx(186, 62, "power off", { s: 15 }),
    break: () => pl([[X0, YM - 5], [X0, Y0], [82, Y0]]) + resH(82, 134, Y0) + pl([[134, Y0], [X1, Y0], [X1, YM - 7]]) + pl([[X1, YM + 7], [X1, Y1], [130, Y1]]) +
      pl([[94, Y1], [X0, Y1], [X0, YM + 4]]) + battery(X0, YM) + ledV(X1, YM, false) + circ(130, Y1, 2.6, PEN) + circ(94, Y1, 2.6, PEN) +
      probe([[94, Y1], [94, 82]], RED) + probe([[130, Y1], [130, 82]], PEN) + meter(112, 72, "V") + tx(112, 50, "most of the push", { s: 16, c: "#a3360f" }) +
      tx(112, 124, "the break", { s: 16 }),
    continuity: () => slot(80, 24) + probe([[80, 24], [118, 18], [148, 44]], RED) + probe([[80, 72], [118, 80], [148, 72]], PEN) + meter(160, 58, ")))") +
      tx(196, 40, "beep!", { s: 20, c: "#2f8a43", r: -8 }) + tx(110, 116, "joined by metal", { s: 16 }),
    // Chapter 3: Ohm's law
    twiceR: () => {
      const mini = (ox, r, mA, gap) => current([[ox, 50], [ox, 26], [ox + 76, 26], [ox + 76, 94], [ox, 94], [ox, 70]], gap) +
        pl([[ox, 55], [ox, 26], [ox + 22, 26]]) + resH(ox + 22, ox + 54, 26, 5) + pl([[ox + 54, 26], [ox + 76, 26], [ox + 76, 94], [ox + 50, 94]]) +
        pl([[ox + 26, 94], [ox, 94], [ox, 64]]) + battery(ox, 60, false) + meter(ox + 38, 94, "mA") + tx(ox + 38, 16, r, { s: 17 }) + tx(ox + 38, 66, mA, { s: 19, c: "#a3360f" });
      return mini(18, "1 kΩ", "6 mA", 8) + mini(126, "2 kΩ", "3 mA", 16) + tx(110, 124, "twice the resistance, half the current", { s: 15 });
    },
    twiceV: () => {
      const mini = (ox, v, mA, gap, two) => current([[ox, 50], [ox, 26], [ox + 76, 26], [ox + 76, 94], [ox, 94], [ox, 70]], gap) +
        pl([[ox, 50], [ox, 26], [ox + 22, 26]]) + resH(ox + 22, ox + 54, 26, 5) + pl([[ox + 54, 26], [ox + 76, 26], [ox + 76, 94], [ox + 50, 94]]) +
        pl([[ox + 26, 94], [ox, 94], [ox, two ? 76 : 64]]) + battery(ox, two ? 52 : 60, false) + (two ? battery(ox, 68, false) : "") +
        meter(ox + 38, 94, "mA") + tx(ox - 6, 112, v, { s: 17 }) + tx(ox + 38, 66, mA, { s: 19, c: "#a3360f" });
      return mini(24, "3 V", "3 mA", 16, false) + mini(128, "6 V", "6 mA", 8, true) + tx(112, 126, "twice the push, twice the current", { s: 15 });
    },
    ohmsLaw: () => tx(110, 34, "current = push ÷ resistance", { s: 22 }) + ln(30, 44, 190, 44, HL, 7) +
      tx(110, 74, "volts ÷ kΩ = mA", { s: 22, c: "#a3360f" }) + tx(100, 106, "6 V ÷ 2 kΩ = 3 mA", { s: 21 }) + tick(192, 100),
    findR: () => ln(46, 50, 70, 50) + resH(70, 150, 50, 7) + ln(150, 50, 174, 50) + tx(110, 30, "?", { s: 30, c: RED }) +
      `<path d="M70 70 q40 12 80 0" fill="none" stroke="#a3360f" stroke-width="2"/>` + tx(110, 92, "6 V across, 4 mA through", { s: 17, c: "#a3360f" }) +
      tx(110, 118, "6 V ÷ 4 mA = 1.5 kΩ", { s: 20 }),
    power: () => ln(26, 56, 46, 56) + resH(46, 104, 56, 7) + ln(104, 56, 124, 56) +
      `<path d="M58 36 q6 -8 0 -16 M74 38 q6 -9 0 -18 M90 36 q6 -8 0 -16" fill="none" stroke="${RED}" stroke-width="2.4" stroke-linecap="round"/>` +
      tx(66, 86, "33 Ω: about 1 W", { s: 16, c: RED }) + tx(66, 104, "too hot!", { s: 17, c: RED }) +
      ln(146, 56, 158, 56) + resH(158, 196, 56, 6) + ln(196, 56, 208, 56) + tx(178, 86, "1 kΩ: 0.036 W", { s: 15 }) + tick(178, 100) +
      tx(110, 126, "power = push × current", { s: 17 }),
  };

  function diagram(id) {
    const f = D[id];
    if (!f) return "";
    const k = ++uid;
    return `<svg viewBox="0 0 220 130" role="img" aria-hidden="true"><defs><filter id="ink${k}" x="-5%" y="-5%" width="110%" height="110%">` +
      `<feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="${k % 9}"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter></defs>` +
      `<g filter="url(#ink${k})">${f()}</g></svg>`;
  }

  BB.NotebookArt = { diagram, ids: () => Object.keys(D) };
})(window.BB = window.BB || {});
