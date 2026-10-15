// The title screen's picture, drawn in code so its circuit is real: a 4×AA pack, a 330 Ω resistor from the + rail into
// strip 6, a red LED from strip 6 to strip 7 (its + leg towards the resistor), and a wire from strip 7 to the − rail.
// The current dots follow that loop. The board is drawn flat in board units and tipped back with one affine matrix;
// the parts that stand up (the LED, Sparky) are drawn upright at the projected holes. Art style 1: flat shapes that glow.
(function (BB) {
  "use strict";

  // ---------- the board, in board units (one hole pitch = 26) ----------
  const P = 26, COLS = 10, X = (c) => 40 + (c - 1) * P, BW = X(COLS) + 40;
  const Y = { "+T": 30, "-T": 56, a: 98, b: 124, c: 150, d: 176, e: 202, f: 254, g: 280, h: 306, i: 332, j: 358, "+B": 400, "-B": 426 }, BH = 456;
  // the view: board units → screen units (viewBox 1600 × 900), tipped back and turned a little
  const ANG = (-10 * Math.PI) / 180, K = 1.35, SY = 0.46, OX = 870, OY = 505;
  const M = [K * Math.cos(ANG), K * Math.sin(ANG) * SY, -K * Math.sin(ANG), K * Math.cos(ANG) * SY, OX, OY];
  const proj = ([x, y]) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
  const at = (h) => [X(+h.replace(/^[+-]?[A-Za-z]+/, "")), Y[h.replace(/\d+$/, "")]];      // "c6" → board point
  const f = (n) => +n.toFixed(1);

  function board() {
    let s = `<rect x="0" y="0" width="${BW}" height="${BH}" rx="18" fill="#efe9dc"/>`;
    // rails: a band each, red + and blue − lines, one hole per column
    for (const [k, col] of [["+T", "#d6453d"], ["-T", "#3a78d6"], ["+B", "#d6453d"], ["-B", "#3a78d6"]]) {
      s += `<rect x="22" y="${Y[k] - 10}" width="${BW - 44}" height="20" rx="10" fill="#e3dccb"/>`;
      s += `<line x1="26" x2="${BW - 26}" y1="${Y[k] + (k[0] === "+" ? -13 : 13)}" y2="${Y[k] + (k[0] === "+" ? -13 : 13)}" stroke="${col}" stroke-width="2.4"/>`;
      for (let c = 1; c <= COLS; c++) s += `<rect x="${X(c) - 3.2}" y="${Y[k] - 3.2}" width="6.4" height="6.4" rx="1.5" fill="#3b3a36"/>`;
    }
    // strips: each group of five joined holes in its own slot (board version 3)
    for (let c = 1; c <= COLS; c++) {
      for (const [top, bot] of [["a", "e"], ["f", "j"]]) {
        s += `<rect x="${X(c) - 10}" y="${Y[top] - 11}" width="20" height="${Y[bot] - Y[top] + 22}" rx="10" fill="#e3dccb" stroke="#d3cab4" stroke-width="1"/>`;
        for (const r of "abcdefghij".slice(top === "a" ? 0 : 5, top === "a" ? 5 : 10)) s += `<rect x="${X(c) - 3.2}" y="${Y[r] - 3.2}" width="6.4" height="6.4" rx="1.5" fill="#3b3a36"/>`;
      }
    }
    s += `<rect x="20" y="${(Y.e + Y.f) / 2 - 7}" width="${BW - 40}" height="14" rx="7" fill="#d9d1bf"/>`;      // the centre gap
    return s;
  }

  // ---------- the circuit (board units) ----------
  const BAT = { x: X(2) - 18, y: -132, w: 214, h: 92 };          // the pack lies on the desk behind the board
  const lead = (x0, y0, h) => { const [x1, y1] = at(h); return `M${x0} ${y0} C${x0} ${y0 + 30} ${x1} ${y1 - 46} ${x1} ${y1}`; };
    // The circuit: + lead into +T1, a red jumper +T3 → a3, the resistor b3–b7 lying across four strips, the LED c7 (+) – c8,
  // a wire e8 → −T8, and the − lead from −T2. The loop the current takes, for the dots, follows the same holes.
  const PLUS = [BAT.x + 62, BAT.y + BAT.h], MINUS = [BAT.x + 112, BAT.y + BAT.h];
  const [j0, j1, ra, rb, l0, l1, w0, w1] = ["+T3", "a3", "b3", "b7", "c7", "c8", "e8", "-T8"].map(at);
  const arc = (p, q, bulge) => `C${p[0] + bulge} ${p[1] - 30} ${q[0] + bulge} ${q[1] + 30} ${q[0]} ${q[1]}`;
  const LOOP = `${lead(...PLUS, "+T1")} L${j0[0]} ${j0[1]} ${arc(j0, j1, -18).replace(/^C/, "C")} L${ra[0]} ${ra[1]} L${rb[0]} ${rb[1]} L${l0[0]} ${l0[1]} L${l1[0]} ${l1[1]}` +
    ` L${w0[0]} ${w0[1]} ${arc(w0, w1, 30)} L${at("-T2")[0]} ${at("-T2")[1]}` +
    ` C${at("-T2")[0]} ${at("-T2")[1] - 46} ${MINUS[0]} ${MINUS[1] + 30} ${MINUS[0]} ${MINUS[1]} L${MINUS[0]} ${BAT.y + 46} L${PLUS[0]} ${BAT.y + 46} L${PLUS[0]} ${PLUS[1]}`;

  function circuit() {
    let s = "";
    // the battery pack: its side, its top, four AA cells, the switch on
    s += `<rect x="${BAT.x}" y="${BAT.y + 10}" width="${BAT.w}" height="${BAT.h}" rx="16" fill="#0d1420"/>`;
    s += `<rect x="${BAT.x}" y="${BAT.y}" width="${BAT.w}" height="${BAT.h}" rx="16" fill="#1a2433" stroke="#2e3e54" stroke-width="2"/>`;
    for (let k = 0; k < 4; k++) {
      const cx = BAT.x + 16 + k * 34;
      s += `<rect x="${cx}" y="${BAT.y + 12}" width="26" height="${BAT.h - 24}" rx="9" fill="#2a3442"/>`;
      s += `<rect x="${cx + 3}" y="${BAT.y + (k % 2 ? 40 : 16)}" width="20" height="36" rx="7" fill="#f2a33a"/>`;
    }
    s += `<rect x="${BAT.x + 158}" y="${BAT.y + 26}" width="40" height="22" rx="11" fill="#22a65a"/><circle cx="${BAT.x + 187}" cy="${BAT.y + 37}" r="8" fill="#dfffe9"/>`;
    // leads into the rails; a red jumper from the + rail into strip 3; the wire from strip 8 back to the − rail
    s += `<path d="${lead(...PLUS, "+T1")}" stroke="#e04848" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    s += `<path d="${lead(...MINUS, "-T2")}" stroke="#151a20" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M${j0[0]} ${j0[1]} ${arc(j0, j1, -18)}" stroke="#e04848" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M${w0[0]} ${w0[1]} ${arc(w0, w1, 30)}" stroke="#3a8ee6" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    // the resistor, lying from b3 to b7: legs, a beige body, its bands (330 Ω: orange, orange, brown, gold)
    s += `<line x1="${ra[0]}" y1="${ra[1]}" x2="${rb[0]}" y2="${rb[1]}" stroke="#aeb6bf" stroke-width="3"/>`;
    const rx0 = ra[0] + 18, rw = rb[0] - ra[0] - 36;
    s += `<rect x="${rx0}" y="${ra[1] - 11}" width="${rw}" height="22" rx="10" fill="#ecd3a4" stroke="#a8834c" stroke-width="1.4"/>`;
    [["#ff8c1a", 0.16], ["#ff8c1a", 0.32], ["#8a4b16", 0.48], ["#d4af37", 0.8]].forEach(([c, t]) => { s += `<rect x="${rx0 + rw * t - 2.5}" y="${ra[1] - 10}" width="5" height="20" fill="${c}"/>`; });
    // the LED's legs into c7 and c8 (the dome stands up, drawn after the board)
    s += `<line x1="${l0[0]}" y1="${l0[1]}" x2="${l1[0]}" y2="${l1[1]}" stroke="#aeb6bf" stroke-width="3"/>`;
    return s;
  }

  // ---------- the room ----------
  function room() {
    let s = `<defs>
      <linearGradient id="tsWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1a33"/><stop offset="1" stop-color="#0a1526"/></linearGradient>
      <linearGradient id="tsSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f2448"/><stop offset="1" stop-color="#173a63"/></linearGradient>
      <linearGradient id="tsDesk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#173a4f"/><stop offset="1" stop-color="#0d2132"/></linearGradient>
      <radialGradient id="tsLamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".33"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
      <radialGradient id="tsLed" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff5a4a" stop-opacity=".85"/><stop offset=".35" stop-color="#ff4a3a" stop-opacity=".35"/><stop offset="1" stop-color="#ff4a3a" stop-opacity="0"/></radialGradient>
      <filter id="tsGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="tsSoft"><feGaussianBlur stdDeviation="14"/></filter></defs>`;
    s += `<rect width="1600" height="900" fill="url(#tsWall)"/>`;
    // a window on the night city
    s += `<rect x="1060" y="40" width="470" height="330" rx="18" fill="#0a1220"/><rect x="1076" y="56" width="438" height="298" rx="10" fill="url(#tsSky)"/>`;
    const blocks = [[1076, 210, 70], [1146, 160, 54], [1200, 240, 90], [1290, 130, 60], [1350, 200, 80], [1430, 170, 84]];
    for (const [x, y, w] of blocks) {
      s += `<rect x="${x}" y="${y}" width="${w}" height="${354 - y}" fill="#0b1830"/>`;
      for (let wy = y + 14; wy < 340; wy += 22) for (let wx = x + 10; wx < x + w - 10; wx += 18) if ((wx * 7 + wy * 3) % 5 < 2) s += `<rect x="${wx}" y="${wy}" width="7" height="9" rx="1.5" fill="#f2c45a" opacity=".75"/>`;
    }
    s += `<rect x="1290" y="56" width="10" height="298" fill="#0a1220"/><rect x="1076" y="200" width="438" height="10" fill="#0a1220" opacity=".9"/>`;
    s += `<circle cx="1180" cy="110" r="22" fill="#fff2c8" opacity=".9"/>`;      // the moon
    // a shelf with a few dark shapes
    s += `<rect x="560" y="150" width="380" height="12" rx="4" fill="#132845"/><rect x="590" y="96" width="44" height="54" rx="6" fill="#112340"/>` +
      `<rect x="646" y="78" width="30" height="72" rx="5" fill="#16305a"/><rect x="690" y="110" width="84" height="40" rx="6" fill="#102038"/><circle cx="830" cy="124" r="26" fill="#13284a"/>`;
    // the desk
    s += `<path d="M420 410 L1600 372 L1600 900 L300 900 Z" fill="url(#tsDesk)"/><path d="M420 410 L1600 372" stroke="#2a5a74" stroke-width="3" opacity=".7"/>`;
    s += `<ellipse cx="1130" cy="600" rx="430" ry="200" fill="url(#tsLamp)"/>`;
    return s;
  }

  // ---------- Sparky, standing on the desk to the right of the board, pointing at the LED ----------
  const SPARKY = { x: 1385, y: 392, w: 185 };                    // his box on screen (the drawing is 120 × 160 units, from y = −24)
  function sparky(target) {
    const art = (BB.CoachUI && BB.CoachUI.SPARK) || "";
    const k = SPARKY.w / 120, sh = [SPARKY.x + 24 * k, SPARKY.y + (78 + 24) * k];       // his left shoulder, towards the board
    const deg = (Math.atan2(target[1] - sh[1], target[0] - sh[0]) * 180) / Math.PI;
    const pointed = art.replace('<g class="sp-arm" transform="translate(96 78)">', `<g class="sp-arm" transform="translate(24 78) rotate(${f(deg)})">`)
      .replace(/id="sp/g, 'id="tsp').replace(/url\(#sp/g, "url(#tsp");          // his own gradient ids: the level's Sparky has the same ones
    return `<ellipse cx="${SPARKY.x + SPARKY.w / 2}" cy="${SPARKY.y + SPARKY.w * 160 / 120 - 6}" rx="${SPARKY.w * 0.42}" ry="16" fill="#04101c" opacity=".55"/>` +
      `<foreignObject x="${SPARKY.x}" y="${SPARKY.y}" width="${SPARKY.w}" height="${f(SPARKY.w * 160 / 120)}"><div xmlns="http://www.w3.org/1999/xhtml" class="ts-sparky happy pointing">${pointed}</div></foreignObject>`;
  }

  // ---------- the whole scene ----------
  function scene() {
    const mat = `matrix(${M.map(f).join(" ")})`;
    const side = `matrix(${[M[0], M[1], M[2], M[3], M[4], M[5] + 16].map(f).join(" ")})`;        // the board's thickness: the same shape, a little lower
    const led = proj([(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2]);
    const dome = `<g transform="translate(${f(led[0])} ${f(led[1])}) scale(1.3)">
      <circle r="90" fill="url(#tsLed)"/><line x1="-6" y1="0" x2="-6" y2="-34" stroke="#aeb6bf" stroke-width="3"/><line x1="6" y1="2" x2="6" y2="-30" stroke="#aeb6bf" stroke-width="3"/>
      <ellipse cx="0" cy="-36" rx="19" ry="5" fill="#a8251e"/><path d="M-17 -36 V-62 A17 17 0 0 1 17 -62 V-36 Z" fill="#ff4a3a"/>
      <path d="M-9 -44 V-64 A9 9 0 0 1 -2 -71" stroke="#ffd0c8" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
      <circle cy="-56" r="30" fill="#ff6a50" opacity=".25" filter="url(#tsGlow)"/></g>`;
    return `<svg class="ts-scene" viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">${room()}
      <ellipse cx="${f(proj([BW / 2, BH / 2])[0])}" cy="${f(proj([BW / 2, BH / 2])[1] + 40)}" rx="${f(BW * K * 0.62)}" ry="${f(BH * K * SY * 0.62)}" fill="#020a14" opacity=".55" filter="url(#tsSoft)"/>
      <g transform="${side}"><rect x="0" y="0" width="${BW}" height="${BH}" rx="18" fill="#b9b2a2"/></g>
      <g transform="${mat}">${board()}${circuit()}
        <path d="${LOOP}" class="ts-dots" fill="none" stroke="#ffc35c" stroke-width="7" stroke-linecap="round" stroke-dasharray="0 22" filter="url(#tsGlow)"/></g>
      ${dome}${sparky([led[0] + 10, led[1] - 50])}
      ${Array.from({ length: 14 }, (_, n) => `<circle class="ts-spark" cx="${1180 + ((n * 97) % 330)}" cy="${300 + ((n * 61) % 210)}" r="${1.5 + (n % 3)}" fill="#ffd27a" style="animation-delay:${(n * 0.37) % 3}s"/>`).join("")}
    </svg>`;
  }

  BB.TitleArt = { scene };
})(window.BB = window.BB || {});
