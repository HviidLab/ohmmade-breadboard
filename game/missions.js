// Missions: the workbook experiments as goals the simulator checks. Goals test physics, not exact holes.
(function (BB) {
  "use strict";
  const near = (x, w, r) => Number.isFinite(x) && Math.abs(x - w) <= Math.abs(w) * r;
  const lit = (q, lo = 0.005, hi = 0.02) => q && q.ok && q.rd.I >= lo && q.rd.I <= hi;
  const res = (S, v) => S.parts("resistor").filter((q) => q.part.value === v && q.ok);

  // Starting parts: battery pack on the top rails and the meter beside the board.
  function base(on = true, extra = []) {
    return { parts: [
      { id: "battery1", type: "battery", legs: ["+T3", "-T4"], on, bx: -40, by: -175 },
      { id: "meter1", type: "meter", mode: "V", socket: "VO", legs: [null, null], bx: -275, by: 150, loose: [[-140, 95], [-90, 95]] },
      ...extra,
    ], nextId: 20 };
  }
  // Parts of a workbook layout (BBShared.EXPS) after `upto` steps, converted to game parts.
  function layout(expId, upto) {
    const exp = BBShared.EXPS.find((e) => e.id === expId);
    if (!exp) return [];
    const parts = new Map();
    exp.steps.slice(0, (upto ?? exp.steps.length - 1) + 1).forEach((s) => { for (const id of s.remove) parts.delete(id); for (const p of s.add) parts.set(p.id, p); });
    const out = [];
    for (const p of parts.values()) {
      const legs = p.pins.slice();
      const id = `x${p.id}`;
      if (p.type === "res") out.push({ id, type: "resistor", value: p.val, legs });
      else if (p.type === "jumper" || p.type === "touch") out.push({ id, type: "wire", legs, color: "#2fae5a" });
      else if (p.type === "led") out.push({ id, type: "led", legs });
      else if (p.type === "cap") out.push({ id, type: "cap", value: 1e-3, legs });
      else if (p.type === "pot") out.push({ id, type: "pot", pos: 0.5, legs });
      else if (p.type === "npn") out.push({ id, type: "npn", legs });
      else if (p.type === "button") out.push({ id, type: "button", pairs: "across", pressed: false, legs });
      else if (p.type === "ldr") out.push({ id, type: "ldr", lux: 200, legs });
    }
    return out;
  }

  const M = [
    { id: "E0", title: "Meet the meter", workbook: "workbook.html#e0-meet-the-meter", art: "m_E0",
      brief: "Learn the two simplest meter jobs: read the battery voltage, and read a resistor's value.",
      start: base(true), view: [1, 20],
      goals: [
        { text: "Measure the pack voltage in V mode (≈ 6 V)", when: (S) => S.meterV(5.6, 6.6) && S.across(S.battery()) },
        { text: "Measure a 330 Ω resistor in Ω mode (put it on its own, away from the battery)", when: (S) => S.meter && S.meter.mode === "ohm" && !S.meter.display && near(S.meter.value, 330, 0.02) && res(S, 330).some((q) => S.across(q)) },
      ],
      hints: ["Drag the red probe to a + rail hole and the black probe to a − rail hole.", "Put the resistor between two separate rows, then touch one probe to each row. Set the dial to Ω."] },

    { id: "E1", title: "Map the breadboard", workbook: "workbook.html#e1-map-the-breadboard", art: "m_E1",
      brief: "Use continuity mode (the beep) to find out which holes are connected inside the board. The battery is off.",
      start: (() => { const d = base(false); d.parts[1].mode = "cont"; return d; })(), view: [1, 24],
      goals: [
        { text: "Beep: two holes in the same 5-hole strip", when: (S) => { const m = S.meter; return m && m.mode === "cont" && m.beep && m.red && m.com && m.red !== m.com && /^[a-j]/.test(m.red) && BB.netKey(m.red) === BB.netKey(m.com); } },
        { text: "No beep: the same column in two neighbouring rows", when: (S) => { const m = S.meter; if (!m || m.mode !== "cont" || m.beep || !m.red || !m.com) return false; const a = BBShared.parse(m.red), b = BBShared.parse(m.com); return a.kind === "strip" && b.kind === "strip" && a.col === b.col && Math.abs(a.row - b.row) === 1; } },
        { text: "No beep: across the centre gap (e and f)", when: (S) => { const m = S.meter; if (!m || m.mode !== "cont" || m.beep || !m.red || !m.com) return false; const a = BBShared.parse(m.red), b = BBShared.parse(m.com); return a.row === b.row && [a.col, b.col].sort().join() === "e,f"; } },
        { text: "Beep: two holes on the same rail, 40 or more rows apart", when: (S) => { const m = S.meter; if (!m || m.mode !== "cont" || !m.beep || !m.red || !m.com) return false; const a = BBShared.parse(m.red), b = BBShared.parse(m.com); return a.kind === "rail" && a.rail === b.rail && Math.abs(a.row - b.row) >= 40; } },
      ],
      hints: ["The dial is already on continuity (·))). Drag both probes onto holes.", "Zoom out with the wheel to reach row 45 and beyond."] },

    { id: "E2", title: "Ohm's law", workbook: "workbook.html#e2-ohms-law", art: "m_E2",
      brief: "Put a 330 Ω resistor between the rails and check V = I × R with the meter.",
      start: base(true), view: [1, 20],
      goals: [
        { text: "330 Ω across the pack: about 18 mA flows", when: (S) => res(S, 330).some((q) => near(Math.abs(q.rd.I), 0.01815, 0.05)) },
        { text: "Measure its voltage (≈ 6.0 V)", when: (S) => res(S, 330).some((q) => S.readsVoltageOf(q, 5.6, 6.3)) },
        { text: "Measure its current in series (≈ 18 mA)", when: (S) => res(S, 330).some((q) => S.readsCurrentOf(q, 0.0170, 0.0190)) },
      ],
      hints: ["Resistor from the + rail to a10, jumper from c10 to the − rail.", "For current: red lead to the mA socket, dial to mA, then replace the jumper with the two probes.", "18 mA × 330 Ω = 6 V."] },

    { id: "E3", title: "LED and resistor", workbook: "workbook.html#e3-led-and-resistor", art: "m_E3",
      brief: "Light the red LED safely, then measure how the 6 V is shared between the LED and the resistor.",
      start: base(true), view: [1, 20],
      goals: [
        { text: "The LED is lit, between 5 and 20 mA", hold: 1, when: (S) => S.parts("led").some((q) => lit(q)) },
        { text: "Measure the LED voltage (≈ 2.0 V)", when: (S) => S.parts("led").some((q) => q.ok && q.rd.I > 0.003 && S.readsVoltageOf(q, 1.8, 2.2)) },
        { text: "Measure the resistor voltage (≈ 4.0 V)", when: (S) => S.parts("resistor").some((q) => q.ok && S.readsVoltageOf(q, 3.6, 4.4)) },
        { text: "Measure the LED current in series (≈ 12 mA)", when: (S) => S.parts("led").some((q) => S.readsCurrentOf(q, 0.010, 0.014)) },
      ],
      hints: ["The long leg (+) goes toward the + rail.", "(6 − 2) V ÷ 330 Ω ≈ 12 mA.", "LED voltage + resistor voltage = pack voltage."] },

    { id: "E3x", title: "Smoke test", workbook: "workbook.html#e3-led-and-resistor", art: "m_E3x", allowDamage: true, badge: true,
      brief: "Why does an LED need a resistor? Find out the safe way: in the simulator. Replace the resistor with a plain jumper wire.",
      start: base(true, layout("E3", 3).filter((p) => p.type !== "battery")), view: [1, 20],
      goals: [
        { text: "First, see the LED lit safely", hold: 0.5, when: (S) => S.parts("led").some((q) => lit(q)) },
        { text: "Swap the resistor for a jumper wire", hold: 0, when: (S, mem) => (mem.seen = mem.seen || S.parts("resistor").length === 0 && S.parts("led").length > 0) },
        { text: "The LED burns out", hold: 0, when: (S) => S.destroyed("led") },
      ],
      hints: ["Select the resistor and press Delete. Then drag a jumper from the + rail to row 10.", "Read the log: it shows how much current flowed."] },

    { id: "E4s", title: "Series", workbook: "workbook.html#e4-series-and-parallel", art: "m_E4",
      brief: "Connect 330 Ω and 1 kΩ in one line. The current is the same everywhere; the voltages add up.",
      start: base(true), view: [1, 24],
      goals: [
        { text: "330 Ω and 1 kΩ in series: 4.5 mA through both", when: (S) => res(S, 330).some((a) => near(Math.abs(a.rd.I), 0.00451, 0.05)) && res(S, 1000).some((b) => near(Math.abs(b.rd.I), 0.00451, 0.05)) },
        { text: "Measure the voltage across 330 Ω (≈ 1.49 V)", when: (S) => res(S, 330).some((q) => S.readsVoltageOf(q, 1.40, 1.58)) },
        { text: "Measure the voltage across 1 kΩ (≈ 4.51 V)", when: (S) => res(S, 1000).some((q) => S.readsVoltageOf(q, 4.30, 4.70)) },
        { text: "Measure the current in series (≈ 4.5 mA)", when: (S) => res(S, 330).some((q) => S.readsCurrentOf(q, 0.0042, 0.0048)) },
      ],
      hints: ["330 Ω from the + rail to a10, 1 kΩ from c10 to c20, jumper from a20 to the − rail.", "1.49 V + 4.51 V = 6 V."] },

    { id: "E4p", title: "Parallel", workbook: "workbook.html#e4-series-and-parallel", art: "m_E4",
      brief: "Connect 330 Ω and 1 kΩ side by side between the rails. The voltage is the same; the currents add up.",
      start: base(true), view: [1, 24],
      goals: [
        { text: "Both across the full pack: 18.2 mA and 6.0 mA", when: (S) => res(S, 330).some((a) => near(Math.abs(a.rd.I), 0.01815, 0.05)) && res(S, 1000).some((b) => near(Math.abs(b.rd.I), 0.006, 0.05)) },
        { text: "Measure the current in one branch", when: (S) => res(S, 330).some((q) => S.readsCurrentOf(q, 0.0170, 0.0190)) || res(S, 1000).some((q) => S.readsCurrentOf(q, 0.0056, 0.0063)) },
        { text: "Measure the total current from the pack (≈ 24 mA)", when: (S) => S.readsCurrentOf(S.battery(), 0.0225, 0.0255) },
      ],
      hints: ["Each resistor needs its own jumper to the − rail.", "For the total: move the battery's red lead to an empty strip (for example a40), then put the meter between that strip and the + rail."] },

    { id: "E5", title: "Divider and dimmer", workbook: "workbook.html#e5-voltage-divider-and-potentiometer", art: "m_E5",
      brief: "Make 3 V from 6 V with two resistors, then make any voltage with a potentiometer, then dim an LED with it.",
      start: base(true), view: [1, 30],
      goals: [
        { text: "Two 10 kΩ resistors make 3.0 V (measure it)", when: (S) => res(S, 10000).length >= 2 && S.meterV(2.85, 3.15) },
        { text: "Turn the pot: the wiper reaches below 0.1 V", when: (S) => S.parts("pot").some((p) => S.probeOn(0, [p.nets[1]])) && S.meterV(-0.01, 0.1) },
        { text: "…and above 5.8 V", when: (S) => S.parts("pot").some((p) => S.probeOn(0, [p.nets[1]])) && S.meterV(5.8, 6.2) },
        { text: "Dimmer: the LED goes from ≥ 15 mA down to ≤ 0.5 mA (and survives)", hold: 0, when: (S, mem) => {
          const led = S.parts("led").find((q) => q.ok);
          if (!led || !S.parts("pot").length) return false;
          if (led.rd.I >= 0.015) mem.hi = true;
          if (led.rd.I > 0.0002 && led.rd.I <= 0.0005) mem.lo = true;
          return mem.hi && mem.lo;
        } },
      ],
      hints: ["The pot's middle leg is the wiper.", "Dimmer: + rail → pot end leg; wiper → 220 Ω → LED → − rail. Then drag the knob up and down.", "Without the 220 Ω, the LED burns at one end of the knob."] },

    { id: "E6", title: "Button and pull-down", workbook: "workbook.html#e6-button-and-pull-down-resistor", art: "m_E6",
      brief: "Switch an LED with a button, then see why an Arduino input needs a pull-down resistor.",
      start: base(true), view: [20, 44],
      goals: [
        { text: "The LED is on only while the button is pressed", hold: 0, when: (S, mem) => {
          const b = S.first("button"), led = S.parts("led").find((q) => q.ok);
          if (!b || !led) return false;
          if (b.part.pressed && led.rd.I > 0.005) mem.on = true;
          if (!b.part.pressed && led.rd.I < 1e-4) mem.off = true;
          return mem.on && mem.off;
        } },
        { text: "With a 10 kΩ pull-down: the row reads ≈ 0 V released and ≈ 6 V pressed", hold: 0, when: (S, mem) => {
          const b = S.first("button");
          if (!b || !res(S, 10000).length || !S.meter || S.meter.mode !== "V" || !S.probeOn(0, b.nets)) return false;
          if (!b.part.pressed && S.meterV(-0.05, 0.1)) mem.lo = true;
          if (b.part.pressed && S.meterV(5.7, 6.2)) mem.hi = true;
          return mem.lo && mem.hi;
        } },
      ],
      hints: ["The button sits across the centre gap. Press it with the inspector's button or by holding its cap.", "Pull-down: 10 kΩ from the button's output row to the − rail. Measure that row against the − rail."] },

    { id: "E7", title: "Capacitor charging", workbook: "workbook.html#e7-capacitor-charging", art: "m_E7",
      brief: "Charge a 1000 µF capacitor through 10 kΩ. After one time constant (τ = R × C = 10 s) it reaches 63 % of 6 V.",
      start: base(true), view: [30, 50],
      goals: [
        { text: "Start with the capacitor empty (< 0.1 V)", when: (S) => S.parts("cap").some((q) => q.ok && Math.abs(q.rd.V) < 0.1) },
        { text: "Read ≈ 3.79 V on the meter 10 s after charging starts", hold: 0, when: (S, mem) => {
          const c = S.parts("cap").find((q) => q.ok && q.part.value >= 1e-3);
          if (!c || !res(S, 10000).length) return false;
          if (mem.t0 === undefined && Math.abs(c.rd.V) < 0.15 && c.rd.I > 2e-4) mem.t0 = S.t;
          if (mem.t0 !== undefined && S.t - mem.t0 >= 10 && mem.v10 === undefined) mem.v10 = S.readsVoltageOf(c, 0, 7) ? S.meter.value : NaN;
          return mem.v10 !== undefined && Math.abs(mem.v10 - 3.79) < 0.25;
        } },
      ],
      hints: ["+ leg (long) toward the resistor, − leg (stripe) to the − rail.", "Put the meter across the capacitor first, then plug in the last resistor leg. Use 5× speed if you like.", "To empty the capacitor, put a 1 kΩ across it for a few seconds."] },

    { id: "E8", title: "Transistor switch", workbook: "workbook.html#e8-transistor-switch", art: "m_E8",
      brief: "Let a small base current switch a larger LED current, the way an Arduino pin drives a motor.",
      start: base(true), view: [38, 62],
      goals: [
        { text: "The LED turns on and off with the base current", hold: 0, when: (S, mem) => {
          const q = S.parts("npn").find((x) => x.ok), led = S.parts("led").find((x) => x.ok);
          if (!q || !led) return false;
          if (q.rd.Ib > 2e-4 && led.rd.I > 0.008) mem.on = true;
          if (q.rd.Ib < 1e-6 && led.rd.I < 1e-4) mem.off = true;
          return mem.on && mem.off;
        } },
        { text: "Measure the base current (≈ 0.53 mA)", when: (S) => S.parts("npn").some((q) => S.readsCurrentOf(q, 0.00048, 0.00058, "Ib")) },
        { text: "Measure the LED current (≈ 11.5 mA)", when: (S) => S.parts("led").some((q) => S.readsCurrentOf(q, 0.0105, 0.0125)) },
      ],
      hints: ["C, B, E in three rows next to each other. E to the − rail.", "Base: 10 kΩ to a control wire. Touch the wire to + (on) or − (off).", "Ic ÷ Ib ≈ 22: the transistor is fully on."] },

    { id: "E9", title: "Night light", workbook: "workbook.html#e9-optional-night-light", art: "m_E9",
      brief: "Add a light sensor to the transistor switch. The LED should turn on when it gets dark.",
      start: base(true, layout("E9", 0).filter((p) => p.type !== "battery")), view: [38, 62],
      goals: [
        { text: "LED off in room light", when: (S) => S.parts("ldr").some((l) => (l.part.lux ?? 200) >= 100) && S.parts("npn").length && S.parts("led").every((q) => q.rd.I < 5e-4) },
        { text: "LED on (> 3 mA) when you cover the sensor", when: (S) => S.parts("ldr").some((l) => (l.part.lux ?? 200) <= 5) && S.parts("led").some((q) => q.ok && q.rd.I > 0.003) },
      ],
      hints: ["100 kΩ from the + rail to the base row; the LDR from the base row to the − rail.", "Select the LDR and hold 'Cover with your hand'."] },
  ];

  function unoStart() {
    return { parts: [
      { id: "uno1", type: "uno", legs: [], pins: {}, bx: -760, by: -40 },
      { id: "meter1", type: "meter", mode: "V", socket: "VO", legs: [null, null], bx: -275, by: 520, loose: [[-140, 465], [-90, 465]] },
    ], nextId: 20 };
  }
  M.push(
    { id: "A1", title: "Blink by hand", workbook: "primer.html#10-transistors-as-switches", art: "m_A1",
      brief: "Light an LED from pin D13, the way the first Arduino sketch does. Keep the pin current at 20 mA or less.",
      start: unoStart(), view: [1, 20],
      goals: [
        { text: "D13 HIGH lights the LED at 5–20 mA", hold: 1, when: (S) => { const p = S.uno.pin("D13"); return p && p.mode === "HIGH" && Math.abs(p.I) <= 0.02 && S.parts("led").some((q) => lit(q)); } },
        { text: "D13 LOW: the LED goes dark", when: (S) => { const p = S.uno.pin("D13"); return p && p.mode === "LOW" && S.parts("led").length && S.parts("led").every((q) => q.rd.I < 1e-4); } },
      ],
      hints: ["Wire D13 to a strip, then a 330 Ω resistor, the LED, and a wire back to a GND socket.", "Click the D13 pin badge (or use the pin panel) to switch it: in → LOW → HIGH.", "Without the resistor, the pin gives about 64 mA and is damaged after a few seconds."] },
    { id: "A2", title: "Read the pot", workbook: "workbook.html#e5-voltage-divider-and-potentiometer", art: "m_A2",
      brief: "Connect a potentiometer between 5V and GND, and its wiper to A0. analogRead(A0) turns the voltage into a number from 0 to 1023.",
      start: unoStart(), view: [1, 20],
      goals: [
        { text: "analogRead(A0) at 10 or below", when: (S) => S.parts("pot").length && S.uno.analog("A0") <= 10 },
        { text: "analogRead(A0) at 1013 or above", when: (S) => S.parts("pot").length && S.uno.analog("A0") >= 1013 },
        { text: "analogRead(A0) in the middle (500–524)", when: (S) => S.parts("pot").length && S.uno.analog("A0") >= 500 && S.uno.analog("A0") <= 524 },
      ],
      hints: ["End legs to 5V and GND; the middle leg (wiper) to A0.", "512 is half of 1024: the wiper at 2.5 V."] },
    { id: "A3", title: "Button input", workbook: "workbook.html#e6-button-and-pull-down-resistor", art: "m_A3",
      brief: "Read a push button on pin D2. See why the input needs a pull-down resistor.",
      start: unoStart(), view: [20, 44],
      goals: [
        { text: "With a 10 kΩ pull-down, D2 reads LOW released and HIGH pressed", hold: 0, when: (S, mem) => {
          const b = S.first("button"), p = S.uno.pin("D2");
          if (!b || !p || p.mode !== "INPUT" || !res(S, 10000).length) return false;
          if (!b.part.pressed && p.read === "LOW") mem.lo = true;
          if (b.part.pressed && p.read === "HIGH") mem.hi = true;
          return mem.lo && mem.hi;
        } },
        { text: "Remove the pull-down: released, D2 is floating", when: (S) => { const b = S.first("button"); return b && !b.part.pressed && !res(S, 10000).length && S.uno.floating("D2"); } },
      ],
      hints: ["Button across the gap. One side to 5V, the other side to D2.", "Pull-down: 10 kΩ from the D2 row to GND.", "A floating input reads HIGH or LOW at random. That is why every button input needs a pull-down (or INPUT_PULLUP)."] },
  );

  BB.Missions = { list: M, layout, base };
})(window.BB = window.BB || {});
