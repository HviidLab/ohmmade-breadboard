// Sparky's blackboard: chalk pictures for the "I don't get it" lectures. Drawn in code (the electronics are always
// right), in the Notebook's pen strokes (notebook-art.js), then turned into chalk: every ink colour gets a chalk
// colour, and a grainy filter roughens the lines. board(art) returns an SVG string; animate() draws it stroke by
// stroke. A picture is a list of layers, drawn one after another; a "live" layer (flowing water, a turning wheel)
// moves all the time, so it is drawn without the grain filter (that filter would be redone on every frame).
(function (BB) {
  "use strict";
  const K = BB.NotebookArt.kit;
  const { PEN, RED, BLUE, DOT, ln, pl, tx, circ, current, arrow, battery, resH, resV, ledV, term, cross, tick, burst, slot, loopWires, loopPath, X0, X1, Y0, Y1, YM } = K;
  const PAPER = "#fffdf6", WATER = "#3b8fb0";

  // ---------- ink to chalk ----------
  const BOARD = "#26382f";                  // the blackboard's slate green (game.css .chalk)
  const CHALK = {
    "#2b2a26": "#f2efe6", "#c8362e": "#ff9a90", "#2f63c8": "#9cc8ff", "#f4a52c": "#ffd866", "#8d8a80": "#a9b4ad",
    "#a3360f": "#ffb37a", "#fffdf6": BOARD, "#efe7d4": "#34493e", "#d9cfb8": "#3e5448", "#ffd27a": "#ffe28a",
    "#e0a21c": "#ffd866", "#2f8a43": "#a6eba6", "#ff6b5a": "#ff9a90", "#ff8a7a": "#ffa69c", "#6f8cff": "#a9bcff",
    "#c9d4f7": "#c9d4f7", "#ffd84a": "#ffe066", "#d93b30": "#ff9a90", "#b9bec4": "#b9c4bf", "#9aa1a9": "#c0c8c4",
    "#5fd47a": "#8fe8a0", "#5c6b7c": "#9aa8b5", "#22252a": "#cfd6d2", "#3b8fb0": "#9fdcf0",
  };
  const CHALK_RGBA = [
    [/rgba\(255, 196, 80, \.5\)/g, "rgba(255, 216, 102, .22)"], [/rgba\(255, 190, 70, /g, "rgba(255, 224, 120, "],
    [/rgba\(47, 99, 200, \.18\)/g, "rgba(156, 200, 255, .16)"], [/rgba\(200, 54, 46, \.18\)/g, "rgba(255, 154, 144, .16)"],
    [/rgba\(141, 138, 128, \.18\)/g, "rgba(200, 210, 205, .14)"], [/rgba\(120, 200, 160, \.25\)/g, "rgba(150, 230, 180, .2)"],
  ];
  const PALETTE = new Set(Object.values(CHALK));
  function chalkify(svg) {
    let s = svg.replace(/#[0-9a-fA-F]{6}\b/g, (c) => CHALK[c.toLowerCase()] || c);
    for (const [re, to] of CHALK_RGBA) s = s.replace(re, to);
    return s;
  }

  // ---------- extra strokes for everyday pictures ----------
  const d = (pts, closed) => `M${pts.map((p) => p.join(" ")).join(" L")}${closed ? " Z" : ""}`;
  // Pipes (or a road): an outline, hollowed out with the board's colour. All outlines first, then all insides,
  // so where two pipes meet they join cleanly. Each pipe: { pts, closed, w }.
  // An inside is drawn together with its outline (data-pair), so a pipe never shows as a solid band while it draws.
  let pairs = 0;
  function pipes(list) {
    const one = (p, c, w, k) => `<path data-pair="${k}" d="${d(p.pts, p.closed)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="butt"/>`;
    const ks = list.map(() => ++pairs);
    return list.map((p, i) => one(p, PEN, p.w || 13, ks[i])).join("") + list.map((p, i) => one(p, PAPER, (p.w || 13) - 5.5, ks[i])).join("");
  }
  // Water in a pipe: moving dashes ("flow", "fast") or standing still ("still"). Drawn in a live layer.
  const water = (pts, how = "flow", closed = false) => `<path class="ch-water ch-${how}" d="${d(pts, closed)}" fill="none" stroke="${WATER}" stroke-width="3.4" stroke-linecap="round"/>`;
  // a pump: a round housing with a turning arrow
  const pump = (x, y) => circ(x, y, 15, PAPER) +
    `<path d="M${x - 7} ${y + 5} A8 8 0 1 1 ${x + 6} ${y + 6}" fill="none" stroke="${PEN}" stroke-width="2.2" stroke-linecap="round"/>` + arrow(x + 6, y + 6, 130, PEN);
  // a little water wheel; turning = it spins (a live layer)
  function wheel(x, y, r = 13, turning = false) {
    let s = circ(x, y, r, PAPER) + circ(x, y, 2.6, PEN);
    for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; s += ln(x + Math.cos(a) * 3, y + Math.sin(a) * 3, x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4), PEN, 2.2); }
    return turning ? `<g class="ch-spin">${s}</g>` : s;
  }
  // a car seen from above, along a road at angle a
  const car = (x, y, a = 0) => `<g transform="translate(${x} ${y}) rotate(${a})"><rect x="-6" y="-3.6" width="12" height="7.2" rx="2" fill="${PAPER}" stroke="${PEN}" stroke-width="1.6"/></g>`;
  // a stick figure standing at (x, y) (feet)
  const person = (x, y) => circ(x, y - 24, 4, PAPER) + ln(x, y - 20, x, y - 9) + ln(x - 5, y - 15, x + 5, y - 15) + ln(x, y - 9, x - 4, y) + ln(x, y - 9, x + 4, y);
  // a turnstile seen from above: three arms round a post, turned a little
  function turnstile(x, y, locked) {
    let s = "";
    for (const a of [-90, 30, 150]) { const r = (a * Math.PI) / 180; s += ln(x, y, x + Math.cos(r) * 28, y + Math.sin(r) * 28, PEN, 3); }
    s += circ(x, y, 6, PAPER);
    if (!locked) s += `<path d="M${x + 20} ${y - 26} A33 33 0 0 1 ${x + 33} ${y + 4}" fill="none" stroke="${PEN}" stroke-width="2" stroke-dasharray="3 4"/>` + arrow(x + 33, y + 4, 95, PEN);
    else s += `<rect x="${x - 5}" y="${y - 4}" width="10" height="8" rx="1.5" fill="${PEN}"/><path d="M${x - 3} ${y - 4} v-3 a3 3 0 0 1 6 0 v3" fill="none" stroke="${PEN}" stroke-width="1.6"/>`;
    return s;
  }
  const house = (x, y) => `<path d="M${x - 12} ${y + 20} V${y + 6} L${x} ${y - 4} L${x + 12} ${y + 6} V${y + 20} Z" fill="${PAPER}" stroke="${PEN}" stroke-width="2" stroke-linejoin="round"/>` +
    `<rect x="${x - 3}" y="${y + 11}" width="6" height="9" fill="none" stroke="${PEN}" stroke-width="1.6"/>`;
  const wavy = (x1, x2, y, amp = 2.5, c = WATER, w = 2) => {
    let s = `M${x1} ${y}`;
    for (let x = x1; x < x2; x += 10) s += ` q2.5 ${-amp} 5 0 t5 0`;
    return `<path d="${s}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  const heat = (x, y) => [0, 7, 14].map((k) => `<path d="M${x + k} ${y} q-4 -5 0 -10 t0 -10" fill="none" stroke="${RED}" stroke-width="2" stroke-linecap="round"/>`).join("");
  const flip = (x, y, s) => `<g transform="rotate(180 ${x} ${y})">${s}</g>`;
  const live = (s) => ({ live: s });

  // ---------- the pictures ----------
  // The ring of pipe used by the water pictures: a pump on the left side.
  const RING = [[44, 28], [176, 28], [176, 102], [44, 102]];
  const S = {
    // loop
    pumpRing: () => [pipes([{ pts: RING, closed: true }]) + pump(44, 65), live(water(RING, "flow", true)),
      tx(110, 60, "the pump pushes:", { s: 16 }) + tx(110, 78, "round and round", { s: 16 }) + arrow(110, 14, 0, PEN) + arrow(110, 116, 180, PEN)],
    pumpPlug: () => [pipes([{ pts: RING, closed: true }]) + pump(44, 65), live(water(RING, "still", true)),
      `<rect x="166" y="54" width="20" height="22" rx="3" fill="${PEN}"/>` + tx(110, 60, "one plug, and", { s: 16 }) + tx(110, 78, "all of it stops", { s: 16 }) + cross(204, 65, 6)],
    loopOpen: () => [pl([[X0, YM - 5], [X0, Y0], [82, Y0]]) + resH(82, 134, Y0) + pl([[134, Y0], [X1, Y0], [X1, YM - 7]]) + pl([[X1, YM + 7], [X1, Y1], [128, Y1]]) + term(128, Y1) +
      pl([[X0, YM + 4], [X0, Y1], [92, Y1], [104, Y1 - 14]]) + term(104, Y1 - 14) + battery(X0, YM) + ledV(X1, YM, false),
      tx(112, 124, "open: no current anywhere", { s: 16 })],
    // switch
    bridgeDown: () => [pipes([{ pts: RING, closed: true, w: 17 }]) + ln(96, 93, 96, 111, PEN, 2) + ln(124, 93, 124, 111, PEN, 2),
      [60, 76, 92, 108, 124, 140, 156].map((x) => car(x, 28)).join("") + [44, 60, 76, 92].map((y) => car(176, y, 90)).join("") +
        [160, 144, 128, 112, 96, 80, 64].map((x) => car(x, 102, 180)).join("") + [86, 70, 54, 38].map((y) => car(44, y, -90)).join(""),
      tx(110, 58, "bridge down:", { s: 16 }) + tx(110, 76, "they all roll", { s: 16 })],
    bridgeUp: () => [pipes([{ pts: [[96, 102], [44, 102], [44, 28], [176, 28], [176, 102], [124, 102]], w: 17 }]) + ln(96, 102, 104, 84, PEN, 4) + ln(124, 102, 116, 84, PEN, 4),
      [60, 76, 92, 108, 124, 140, 156].map((x) => car(x, 28)).join("") + [44, 60, 76, 92].map((y) => car(176, y, 90)).join("") +
        [160, 145, 130, 90, 75, 60].map((x) => car(x, 102, 180)).join("") + [86, 70, 54, 38].map((y) => car(44, y, -90)).join(""),
      tx(110, 58, "bridge up: a gap,", { s: 16 }) + tx(110, 76, "every car stops", { s: 16 }) + cross(110, 116, 6)],
    switchClosed: () => [pl([[X0, YM - 5], [X0, Y0], [82, Y0]]) + resH(82, 134, Y0) + pl([[134, Y0], [X1, Y0], [X1, YM - 7]]) + pl([[X1, YM + 7], [X1, Y1], [128, Y1]]) +
      pl([[96, Y1], [X0, Y1], [X0, YM + 4]]) + circ(128, Y1, 3, PEN) + circ(96, Y1, 3, PEN) + ln(96, Y1, 126, Y1, PEN, 2.6) + battery(X0, YM) + ledV(X1, YM, true),
      current(loopPath), tx(112, 124, "closed: it lights at once", { s: 16 })],
    // strip
    roomDoors: () => [[0, 1, 2].map((k) => `<rect x="${18 + k * 64}" y="26" width="56" height="54" rx="3" fill="none" stroke="${PEN}" stroke-width="2.4"/>`).join(""),
      [0, 1, 2].map((k) => [0, 1, 2, 3, 4].map((j) => `<rect x="${22 + k * 64 + j * 10}" y="70" width="7" height="10" fill="${PAPER}" stroke="${PEN}" stroke-width="1.4"/>`).join("")).join(""),
      person(90, 112) + arrow(90, 88, -90, PEN) + person(130, 112) + arrow(130, 88, -90, PEN) + tx(110, 18, "one room, five doors", { s: 16 }) + tick(110, 100)],
    roomWalls: () => [`<rect x="26" y="24" width="80" height="62" rx="3" fill="none" stroke="${PEN}" stroke-width="2.4"/><rect x="114" y="24" width="80" height="62" rx="3" fill="none" stroke="${PEN}" stroke-width="2.4"/>`,
      person(60, 78) + `<path d="M72 50 H148" fill="none" stroke="${PEN}" stroke-width="2" stroke-dasharray="4 4"/>` + arrow(150, 50, 0, PEN) + cross(110, 50, 7),
      tx(110, 108, "right next door,", { s: 16 }) + tx(110, 124, "but not joined", { s: 16 })],
    stripLegs: () => [slot(110, 20),
      pl([[16, 32], [44, 32]]) + resH(44, 92, 32) + ln(92, 32, 110, 32) + ln(110, 56, 136, 56) + `<g transform="rotate(-90 150 56)">${ledV(150, 56, true)}</g>` + ln(157, 56, 204, 56),
      current([[16, 32], [110, 32], [110, 56], [204, 56]]), tx(110, 98, "legs in the same strip", { s: 16 }) + tx(110, 116, "are joined", { s: 16 })],
    // rail
    mains: () => [pipes([{ pts: [[204, 34], [22, 34], [22, 100], [204, 100]], w: 11 }]) + pump(22, 67) +
      [80, 130, 180].map((x) => ln(x - 6, 39, x - 6, 52, PEN, 2.4) + ln(x + 6, 82, x + 6, 95, PEN, 2.4) + house(x, 56)).join(""),
      live(water([[22, 34], [204, 34]], "flow") + water([[204, 100], [22, 100]], "flow")),
      tx(126, 20, "one long pipe out", { s: 15 }) + tx(126, 124, "one long pipe back", { s: 15 })],
    railTaps: () => [`<rect x="18" y="14" width="186" height="18" rx="9" fill="#efe7d4" stroke="${PEN}" stroke-width="1.6"/>` + ln(22, 9, 200, 9, RED, 2.4) +
      `<rect x="18" y="98" width="186" height="18" rx="9" fill="#efe7d4" stroke="${PEN}" stroke-width="1.6"/>` + ln(22, 121, 200, 121, BLUE, 2.4) +
      Array.from({ length: 12 }, (_, k) => `<circle cx="${30 + k * 15.5}" cy="23" r="2.4" fill="${PEN}"/><circle cx="${30 + k * 15.5}" cy="107" r="2.4" fill="${PEN}"/>`).join("") +
      tx(10, 28, "+", { c: RED, s: 20 }) + tx(10, 112, "−", { c: BLUE, s: 20 }),
      ln(107.5, 23, 107.5, 60) + battery(107.5, 65, false) + ln(107.5, 69, 107.5, 107) + tx(96, 58, "+", { c: RED, s: 16 }) + tx(96, 82, "−", { c: BLUE, s: 16 }),
      [45.5, 169.5].map((x) => ln(x, 23, x, 38) + resV(x, 38, 60) + ln(x, 60, x, 68) + ledV(x, 75, true) + ln(x, 82, x, 107)).join(""),
      current([[45.5, 23], [45.5, 107]], 12) + current([[169.5, 23], [169.5, 107]], 12) + current([[107.5, 58], [107.5, 23]], 12) + current([[107.5, 107], [107.5, 72]], 12) +
        current([[45.5, 23], [169.5, 23]], 15.5) + current([[45.5, 107], [169.5, 107]], 15.5)],
    railSplit: () => [`<rect x="12" y="44" width="92" height="20" rx="10" fill="#efe7d4" stroke="${PEN}" stroke-width="1.6"/><rect x="116" y="44" width="92" height="20" rx="10" fill="#efe7d4" stroke="${PEN}" stroke-width="1.6"/>` +
      ln(16, 38, 100, 38, RED, 2.4) + ln(120, 38, 204, 38, RED, 2.4) +
      Array.from({ length: 6 }, (_, k) => `<circle cx="${24 + k * 14.5}" cy="54" r="2.4" fill="${PEN}"/><circle cx="${128 + k * 14.5}" cy="54" r="2.4" fill="${PEN}"/>`).join(""),
      cross(110, 54, 5) + tx(110, 24, "cut in the middle", { s: 15 }),
      `<path d="M96.5 54 C100 84 124.5 84 128 54" fill="none" stroke="${PEN}" stroke-width="3" stroke-linecap="round"/>` + circ(96.5, 54, 3.4, PEN) + circ(128, 54, 3.4, PEN),
      tick(150, 96) + tx(110, 116, "a short wire joins the halves", { s: 15 })],
    // gap
    river: () => [`<path d="M8 58 H212 M8 76 H212" fill="none" stroke="${PEN}" stroke-width="2"/>`, wavy(14, 206, 64) + wavy(18, 200, 70),
      [20, 44, 68].map((x) => ln(x, 12, x, 56, PEN, 3) + ln(x, 78, x, 120, PEN, 3)).join("") + ln(170, 12, 170, 56, PEN, 3) + ln(170, 78, 170, 120, PEN, 3) +
        `<rect x="162" y="52" width="16" height="30" rx="2" fill="${PAPER}" stroke="${PEN}" stroke-width="2.2"/>`,
      tx(108, 100, "no way", { s: 15 }) + tx(108, 116, "across", { s: 15 }) + cross(44, 67, 5) + tx(200, 46, "bridge", { s: 15 })],
    gapBridge: () => [slot(70, 9, 5, true, 9.5) + slot(70, 77, 5, true, 9.5) + slot(140, 9, 5, true, 9.5) + slot(140, 77, 5, true, 9.5) + `<rect x="44" y="59" width="122" height="8" rx="4" fill="#d9cfb8"/>`,
      `<path d="M140 37.5 C178 44 178 82 140 86.5" fill="none" stroke="${PEN}" stroke-width="3" stroke-linecap="round"/>` + circ(140, 37.5, 3.4, PEN) + circ(140, 86.5, 3.4, PEN),
      cross(70, 63, 6) + tick(186, 66) + tx(24, 70, "gap", { s: 16 }) + tx(198, 106, "a wire", { s: 15 }) + tx(198, 122, "crosses it", { s: 15 })],
    gapStraddle: () => [slot(46, 18) + slot(146, 9, 5, true, 9.5) + slot(146, 77, 5, true, 9.5) + `<rect x="124" y="59" width="44" height="8" rx="4" fill="#d9cfb8"/>`,
      ln(46, 30, 70, 30) + resV(70, 38, 60) + ln(70, 30, 70, 38) + ln(70, 60, 70, 66) + ln(70, 66, 46, 66) +
        ln(146, 37.5, 174, 37.5) + resV(174, 44, 80) + ln(174, 37.5, 174, 44) + ln(174, 80, 174, 86.5) + ln(174, 86.5, 146, 86.5),
      cross(88, 49, 6) + tick(200, 60) + tx(56, 102, "both legs in", { s: 14 }) + tx(56, 118, "one strip", { s: 14 }) + tx(193, 108, "a leg on", { s: 13 }) + tx(193, 122, "each side", { s: 13 })],
    // polarity
    turnstileIn: () => [ln(10, 104, 210, 104, PEN, 2) + turnstile(110, 62, false), person(46, 100) + `<path d="M58 66 H80" fill="none" stroke="${PEN}" stroke-width="2.4"/>` + arrow(82, 66, 0, PEN),
      tick(160, 66) + tx(110, 124, "one way: it turns", { s: 16 })],
    turnstileLocked: () => [ln(10, 104, 210, 104, PEN, 2) + turnstile(110, 62, true), person(174, 100) + `<path d="M162 66 H140" fill="none" stroke="${PEN}" stroke-width="2.4"/>` + arrow(138, 66, 180, PEN),
      cross(60, 66, 7) + tx(110, 124, "the other way: locked", { s: 16 })],
    ledBackwards: () => [loopWires({ resAt: true }) + battery(X0, YM) + flip(X1, YM, ledV(X1, YM, false)), tx(112, 124, "backwards: almost no current", { s: 16 })],
    // resistor
    wheelFast: () => [pipes([{ pts: RING, closed: true }]) + pump(44, 65) + wheel(176, 65), live(water(RING, "fast", true)),
      burst(196, 44, 11) + ln(186, 78, 196, 90, PEN, 2.4) + tx(110, 60, "full blast:", { s: 16 }) + tx(110, 78, "the wheel breaks", { s: 16 })],
    narrowPipe: () => [pipes([{ pts: [[84, 28], [44, 28], [44, 102], [176, 102], [176, 28], [136, 28]] }, { pts: [[84, 28], [136, 28]], w: 8 }]) + pump(44, 65),
      live(water(RING, "flow", true) + wheel(176, 65, 13, true)),
      tx(110, 14, "a narrow bit", { s: 15 }) + tx(110, 60, "less flows,", { s: 16 }) + tx(110, 78, "all the way round", { s: 16 })],
    ledBurn: () => [loopWires() + battery(X0, YM) + ledV(X1, YM, true), current(loopPath, 9), burst(X1 + 18, YM - 16, 12) + tx(112, 124, "no resistor: far too much current", { s: 15 })],
    // short
    shortcutPipe: () => [pipes([{ pts: [[84, 28], [44, 28], [44, 102], [176, 102], [176, 28], [136, 28]] }, { pts: [[84, 28], [136, 28]], w: 8 }, { pts: [[70, 28], [70, 102]], w: 15 }]) +
      pump(44, 65) + wheel(176, 65),
      live(water([[44, 65], [44, 28], [70, 28], [70, 102], [44, 102], [44, 65]], "fast") + water([[70, 28], [176, 28], [176, 102], [70, 102]], "still")),
      tx(116, 58, "a shortcut:", { s: 14 }) + tx(116, 76, "all rushes past", { s: 14 })],
    shortcutWeak: () => [pipes([{ pts: [[84, 28], [44, 28], [44, 102], [176, 102], [176, 28], [136, 28]] }, { pts: [[84, 28], [136, 28]], w: 8 }, { pts: [[70, 28], [70, 102]], w: 15 }]) +
      pump(44, 65) + wheel(176, 65),
      live(water([[44, 65], [44, 28], [70, 28], [70, 102], [44, 102], [44, 65]], "fast") + water([[70, 28], [176, 28], [176, 102], [70, 102]], "still")),
      tx(116, 58, "it can't keep up,", { s: 14 }) + tx(116, 76, "the wheel stops", { s: 14 }) + cross(200, 65, 6)],
    shortDark: () => [loopWires({ resAt: true }) + battery(X0, YM) + ledV(X1, YM, false) + ln(68, Y0, 68, Y1, PEN, 3),
      current([[X0, YM - 10], [X0, Y0], [68, Y0], [68, Y1], [X0, Y1], [X0, YM + 12]], 8), heat(12, 60),
      tx(116, 58, "only wire:", { s: 15 }) + tx(116, 76, "near 0 V: dark", { s: 15 })],
    // the capstone's "which idea?" board
    pick: () => [tx(110, 92, "?", { s: 90 }), tx(110, 122, "pick an idea", { s: 16 })],
  };

  // the layers of a picture: a scene, or "nb:<id>" (the Notebook's drawing of that idea, in chalk)
  function layers(art) {
    if (art.startsWith("nb:")) return [BB.NotebookArt.body(art.slice(3))];
    const f = S[art];
    return f ? [].concat(f()) : [];
  }
  const has = (art) => (art.startsWith("nb:") ? BB.NotebookArt.ids().includes(art.slice(3)) : !!S[art]);

  let uid = 0;
  function board(art) {
    const k = ++uid;
    const grain = `<filter id="chalk${k}" x="-4%" y="-4%" width="108%" height="108%">` +
      `<feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="${k % 9}" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="2.2" result="d"/>` +
      `<feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="${(k % 7) + 3}" result="g"/>` +
      `<feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.9" result="m"/><feComposite in="d" in2="m" operator="in"/></filter>`;
    const body = layers(art).map((l, i) => (typeof l === "string" ? `<g data-layer="${i}" filter="url(#chalk${k})">${l}</g>` : `<g data-layer="${i}" class="ch-live">${l.live}</g>`)).join("");
    return chalkify(`<svg viewBox="0 0 220 130" class="ch-svg" aria-hidden="true"><defs>${grain}</defs>${body}</svg>`);
  }

  // Draw a board's picture stroke by stroke: lines are drawn along their length, filled shapes and words fade in.
  // The whole picture takes at most `budget` ms. instant (or reduced motion): show it at once. Returns the time it takes.
  function animate(host, opts = {}) {
    const svg = host.querySelector("svg");
    if (!svg || opts.instant || !svg.animate) return 0;
    const steps = [];
    const paired = new Map();               // data-pair → the outline's step: its inside rides along
    for (const g of svg.querySelectorAll("[data-layer]")) {
      const els = g.classList.contains("ch-live") ? [g] : [...g.querySelectorAll("path, line, polyline, polygon, circle, rect, text")];
      for (const el of els) {
        const pk = el.getAttribute("data-pair");
        if (pk && paired.has(pk)) { paired.get(pk).riders.push(el); continue; }
        const stroke = el.getAttribute("stroke"), fill = el.getAttribute("fill");
        let L = 0;
        if (stroke && stroke !== "none" && el.getTotalLength && !el.getAttribute("stroke-dasharray")) { try { L = el.getTotalLength(); } catch (e) { L = 0; } }
        const dur = L ? Math.min(Math.max(L / 300, 0.12), 0.7) * 1000 : el.tagName === "text" ? 260 : 90;
        const step = { el, L, dur, fill: fill && fill !== "none", riders: [] };
        if (pk) paired.set(pk, step);
        steps.push(step);
      }
      if (steps.length) steps[steps.length - 1].gap = 250;
    }
    let t = 0;
    for (const s of steps) { s.at = t; t += s.dur * 0.6 + (s.gap || 0); }
    const total = steps.length ? steps[steps.length - 1].at + steps[steps.length - 1].dur : 0, budget = opts.budget || 3500;
    const k = total > budget ? budget / total : 1;
    for (const s of steps) {
      const timing = { duration: s.dur * k, delay: s.at * k, fill: "backwards", easing: "ease-in-out" };
      if (s.L) {
        const frames = s.fill ? [{ strokeDashoffset: s.L, fillOpacity: 0 }, { strokeDashoffset: 0, fillOpacity: 1 }] : [{ strokeDashoffset: s.L }, { strokeDashoffset: 0 }];
        for (const el of [s.el, ...s.riders]) {
          let L = s.L;
          try { L = el.getTotalLength(); } catch (e) { /* keep the outline's */ }
          el.style.strokeDasharray = `${L} ${L}`;
          const a = el.animate(el === s.el ? frames : [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], timing);
          a.onfinish = () => { el.style.strokeDasharray = ""; };
        }
      } else s.el.animate([{ opacity: 0 }, { opacity: 1 }], timing);
    }
    return total * k;
  }

  BB.ChalkArt = { board, animate, has, layers, chalkify, scenes: () => Object.keys(S), PALETTE, BOARD };
})(window.BB = window.BB || {});
