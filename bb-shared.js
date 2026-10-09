// Breadboard geometry, connectivity and the workbook layouts, shared by the trainer and the game.
// Hole names: "a10" (column a, row 10) or rail holes "+T10", "-T10", "+B10", "-B10".
const BBShared = (() => {
  const P = 26, X0 = 70;
  const Y = { "+T": 80, "-T": 106, a: 150, b: 176, c: 202, d: 228, e: 254, f: 302, g: 328, h: 354, i: 380, j: 406, "+B": 450, "-B": 476 };

  function parse(h) {
    let m = /^([+-][TB])(\d+)$/.exec(h);
    if (m) return { kind: "rail", rail: m[1], row: +m[2] };
    m = /^([a-j])(\d+)$/.exec(h);
    return { kind: "strip", col: m[1], row: +m[2] };
  }
  function net(h) {
    const p = parse(h);
    if (p.kind === "rail") return p.rail;
    return ("abcde".includes(p.col) ? "L" : "R") + p.row;
  }
  function netName(n) {
    if (n === "+T") return "the top + rail (6 V)";
    if (n === "-T") return "the top − rail (GND)";
    if (n === "+B") return "the bottom + rail";
    if (n === "-B") return "the bottom − rail";
    return `row ${n.slice(1)}, holes ${n[0] === "L" ? "a–e" : "f–j"}`;
  }

  const BANDS = { 0: "#1a1a1a", 1: "#8b4513", 2: "#d42a2a", 3: "#f08c00", 4: "#fab005", 5: "#2f9e44", 6: "#1c7ed6", 7: "#7048e8", 8: "#868e96", 9: "#f8f9fa" };
  function bands(v) {
    const d = String(v), z = d.length - 2;
    return [BANDS[d[0]], BANDS[d[1]], BANDS[z], "#c9a227"];
  }
  const LABEL = (v) => (v >= 1000 ? `${v / 1000}k` : `${v}`);

  function curve(a, b, bend = 14) {
    const [x1, y1] = a, [x2, y2] = b;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    return `M ${x1} ${y1} Q ${mx + nx * bend} ${my + ny * bend} ${x2} ${y2}`;
  }

  // ---------- experiments (hole positions match 02-experiments.md) ----------
  const BAT = (r) => ({ id: "bat", type: "battery", pins: [`+T${r}`, `-T${r + 1}`] });
  const R = (id, v, a, b) => ({ id, type: "res", val: v, pins: [a, b] });
  const J = (id, a, b) => ({ id, type: "jumper", pins: [a, b] });
  const LED = (id, an, ca) => ({ id, type: "led", pins: [an, ca] });
  const AM = (id, red, black) => ({ id, type: "ammeter", pins: [red, black] });
  const s = (text, add = [], remove = [], meter = null) => ({ text, add, remove, meter });
  const V = (red, black, reading) => ({ mode: "DC volts", red, black, reading });
  const A = (reading) => ({ mode: "DC mA", reading });
  const C = (red, black, reading) => ({ mode: "Continuity", red, black, reading });

  const EXPS = [
    { id: "E1", title: "E1 · Map the breadboard", rows: [8, 14], steps: [
      s("No battery. Set the meter to continuity. Touch a10 and e10.", [], [], C("a10", "e10")),
      s("Touch a10 and a11.", [], [], C("a10", "a11")),
      s("Touch e10 and f10, across the centre gap.", [], [], C("e10", "f10")),
      s("Touch f10 and j10.", [], [], C("f10", "j10")),
      s("Touch two holes at the ends of the + rail. (On a real board, also test row 1 against row 63.)", [], [], C("+T8", "+T14")),
    ]},
    { id: "E2", title: "E2 · Ohm's law", rows: [8, 13], steps: [
      s("Put the pack's red wire in the + rail and the black wire in the − rail. Keep the pack off.", [BAT(8)]),
      s("Put the 330 Ω resistor between the + rail and a10.", [R("r1", 330, "+T10", "a10")]),
      s("Put a jumper from c10 to the − rail.", [J("j1", "c10", "-T11")]),
      s("Turn on the pack. Measure between the + rail and the − rail.", [], [], V("+T12", "-T12", "≈ 6.0 V (6.2–6.4 V with new cells)")),
      s("Turn off the pack. Remove the jumper. Move the red lead to mA. Put the meter between c10 (red) and the − rail (black). Turn on.", [AM("am", "c10", "-T11")], ["j1"], A("≈ 18.2 mA")),
      s("Repeat with 1 kΩ (≈ 6.0 mA) and 10 kΩ (≈ 0.6 mA). Then move the red lead back to VΩ.", [], [], A("1 kΩ: ≈ 6.0 mA · 10 kΩ: ≈ 0.6 mA")),
    ]},
    { id: "E3", title: "E3 · LED and resistor", rows: [8, 13], steps: [
      s("Put the pack's wires in the rails. Keep the pack off.", [BAT(8)]),
      s("Put the 330 Ω resistor between the + rail and a10.", [R("r1", 330, "+T10", "a10")]),
      s("Put the LED's long leg (anode) in c10 and the short leg in c11.", [LED("led", "c10", "c11")]),
      s("Put a jumper from a11 to the − rail. Turn on the pack: the LED is on.", [J("j1", "a11", "-T11")]),
      s("Measure across the LED: red probe in row 10, black probe in row 11.", [], [], V("b10", "b11", "≈ 2.0 V (1.8–2.1 V)")),
      s("Measure across the resistor: red probe on the + rail, black probe in row 10.", [], [], V("+T12", "b10", "≈ 4.0 V")),
      s("Turn off. Replace the jumper with the meter (mA): red at a11, black on the − rail. Turn on.", [AM("am", "a11", "-T11")], ["j1"], A("≈ 12.1 mA")),
    ]},
    { id: "E4s", title: "E4 · Series", rows: [8, 22], steps: [
      s("Put the pack's wires in the rails. Keep the pack off.", [BAT(8)]),
      s("Put the 330 Ω resistor between the + rail and a10.", [R("r1", 330, "+T10", "a10")]),
      s("Put the 1 kΩ resistor between c10 and c20.", [R("r2", 1000, "c10", "c20")]),
      s("Put a jumper from a20 to the − rail. Turn on.", [J("j1", "a20", "-T21")]),
      s("Measure across the 330 Ω resistor: + rail and row 10.", [], [], V("+T12", "b10", "≈ 1.49 V")),
      s("Measure across the 1 kΩ resistor: row 10 and row 20.", [], [], V("d10", "d20", "≈ 4.51 V")),
      s("Replace the jumper with the meter (mA): red at a20, black on the − rail.", [AM("am", "a20", "-T21")], ["j1"], A("≈ 4.51 mA")),
    ]},
    { id: "E4p", title: "E4 · Parallel", rows: [8, 15], steps: [
      s("Put the pack's wires in the rails. Keep the pack off.", [BAT(8)]),
      s("Put the 330 Ω resistor between the + rail and a10. Put a jumper from c10 to the − rail.", [R("r1", 330, "+T10", "a10"), J("j1", "c10", "-T11")]),
      s("Put the 1 kΩ resistor between the + rail and a12. Put a jumper from c12 to the − rail. Turn on.", [R("r2", 1000, "+T12", "a12"), J("j2", "c12", "-T13")]),
      s("Measure across either resistor: both have the full pack voltage.", [], [], V("+T14", "-T14", "≈ 6.0 V across each")),
      s("Replace the c10 jumper with the meter (mA).", [AM("am", "c10", "-T11")], ["j1"], A("≈ 18.2 mA in the 330 Ω branch")),
      s("Put the c10 jumper back. Replace the c12 jumper with the meter.", [J("j1b", "c10", "-T11"), AM("am2", "c12", "-T13")], ["am", "j2"], A("≈ 6.0 mA in the 1 kΩ branch")),
    ]},
    { id: "E5", title: "E5 · Divider and potentiometer", rows: [8, 28], steps: [
      s("Put the pack's wires in the rails. Keep the pack off.", [BAT(8)]),
      s("Put one 10 kΩ resistor between the + rail and a10. Put the other between b10 and the − rail.", [R("r1", 10000, "+T10", "a10"), R("r2", 10000, "b10", "-T9")]),
      s("Turn on. Measure between row 10 and the − rail.", [], [], V("c10", "-T12", "≈ 3.0 V")),
      s("Remove both resistors. Put the potentiometer in e20, e21, e22. Jumpers: a20 to the + rail, a22 to the − rail.", [{ id: "pot", type: "pot", pins: ["e20", "e21", "e22"] }, J("j1", "a20", "+T20"), J("j2", "a22", "-T22")], ["r1", "r2"]),
      s("Measure between the wiper (row 21) and the − rail. Turn the knob slowly.", [], [], V("c21", "-T24", "0 V to 6 V as you turn")),
      s("Dimmer: remove the a22 jumper. Put 220 Ω from a21 to a25, the LED in c25 (long) and c26, and a jumper from a26 to the − rail.", [R("r3", 220, "a21", "a25"), LED("led", "c25", "c26"), J("j3", "a26", "-T26")], ["j2"]),
      s("Replace the a26 jumper with the meter (mA). Turn the knob from one end to the other.", [AM("am", "a26", "-T26")], ["j3"], A("≈ 0.39 mA to 18.2 mA")),
    ]},
    { id: "E6", title: "E6 · Button and pull-down", rows: [28, 39], steps: [
      s("Put the button across the centre gap, legs in rows 30 and 32. Check with continuity: beep only while pushed.", [{ id: "btn", type: "button", pins: ["e30", "f30", "e32", "f32"] }], [], C("a30", "a32", "beep only while you push")),
      s("Put the pack's wires in the rails. Jumper from a30 to the + rail.", [BAT(28), J("j1", "a30", "+T30")]),
      s("Put 330 Ω between a32 and a36, the LED in c36 (long) and c37, and a jumper from a37 to the − rail. Turn on and push.", [R("r1", 330, "a32", "a36"), LED("led", "c36", "c37"), J("j2", "a37", "-T37")]),
      s("Pull-down: remove the resistor, LED and a37 jumper. Put 10 kΩ between b32 and the − rail. Measure row 32 to the − rail.", [R("r2", 10000, "b32", "-T33")], ["r1", "led", "j2"], V("c32", "-T35", "released: 0 V · pushed: ≈ 6 V")),
      s("Remove the 10 kΩ resistor and measure again.", [], ["r2"], V("c32", "-T35", "released: still ≈ 0 V, because the meter's own 10 MΩ acts as a pull-down")),
    ]},
    { id: "E7", title: "E7 · Capacitor charging", rows: [38, 48], steps: [
      s("Put the pack's wires in the rails. Keep the pack off.", [BAT(38)]),
      s("Capacitor: + leg (long) in c40, − leg (stripe) in c41. Jumper from a41 to the − rail.", [{ id: "cap", type: "cap", pins: ["c40", "c41"] }, J("j1", "a41", "-T41")]),
      s("Discharge: put 1 kΩ between b40 and b41 for 10 seconds, then remove it.", [R("rd", 1000, "b40", "b41")]),
      s("Put one leg of the 10 kΩ resistor in a40. Connect the meter (V) to row 40 and the − rail. Turn on. Put the free leg in the + rail and start the stopwatch.", [R("r1", 10000, "a40", "+T40")], ["rd"], V("d40", "-T43", "5 s: 2.36 V · 10 s: 3.79 V · 20 s: 5.19 V · 30 s: 5.70 V")),
      s("Optional: remove the 10 kΩ. Put 1 kΩ from b40 to b45, the LED in c45 (long) and c46, a jumper from a46 to the − rail. The LED flashes and fades in about 1–2 s.", [R("r2", 1000, "b40", "b45"), LED("led", "c45", "c46"), J("j2", "a46", "-T46")], ["r1"]),
    ]},
    { id: "E8", title: "E8 · Transistor switch", rows: [42, 58], steps: [
      s("Put the pack's wires in the rails. Keep the pack off.", [BAT(42)]),
      s("Transistor: C in e50, B in e51, E in e52 (check your pin diagram). Jumper from a52 to the − rail.", [{ id: "q", type: "npn", pins: ["e50", "e51", "e52"] }, J("j1", "a52", "-T52")]),
      s("330 Ω from the + rail to a44. LED in c44 (long) and c45. Jumper from d45 to d50.", [R("r1", 330, "+T44", "a44"), LED("led", "c44", "c45"), J("j2", "d45", "d50")]),
      s("10 kΩ from a51 to a56. A control wire in c56. Turn on, and touch the free end to the + rail: the LED turns on.", [R("r2", 10000, "a51", "a56"), { id: "ctl", type: "touch", pins: ["c56", "+T56"] }]),
      s("Base current: put the meter (mA) between the + rail (red) and the control wire (black).", [AM("am", "+T57", "c56")], ["ctl"], A("≈ 0.53 mA")),
      s("LED current: control wire back on the + rail. Remove the d45–d50 jumper and put the meter there: red row 45, black row 50.", [{ id: "ctl2", type: "touch", pins: ["c56", "+T56"] }, AM("am2", "d45", "d50")], ["am", "j2"], A("≈ 11.5 mA")),
    ]},
    { id: "E9", title: "E9 · Night light (optional)", rows: [42, 58], steps: [
      s("Start with the E8 circuit, without the 10 kΩ resistor and the control wire.", [BAT(42), { id: "q", type: "npn", pins: ["e50", "e51", "e52"] }, J("j1", "a52", "-T52"), R("r1", 330, "+T44", "a44"), LED("led", "c44", "c45"), J("j2", "d45", "d50")]),
      s("Put 100 kΩ between the + rail and a51. Put the LDR between b51 and the − rail.", [R("r2", 100000, "+T51", "a51"), { id: "ldr", type: "ldr", pins: ["b51", "-T49"] }]),
      s("Turn on. Measure the base (row 51) to the − rail. Cover the LDR with your hand.", [], [], V("c51", "-T54", "room light: below 0.7 V, LED off · covered: ≈ 0.7 V, LED on")),
    ]},
  ];

  return { P, X0, Y, parse, net, netName, BANDS, bands, LABEL, curve, EXPS };
})();
