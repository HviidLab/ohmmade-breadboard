// Chapter 3: Ohm's law. Chapter 2 showed that a bigger resistor lets less current through; here the numbers come in:
// twice the resistance halves the current, twice the voltage doubles it, the rule current = voltage ÷ resistance, the rule
// turned round to find a resistor, and power (voltage × current) that turns into heat. Then a challenge with two answers.
// Same rules as Chapter 2: a question in every level, predict first, the goal and not the holes, hints only on request.
// Data only, built with the kit from ch1.js and the meter helpers from ch2.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, part, FINISH } = K;
  const { M, mode, ohms, shownmA, RING, METER, allow, REGION, NEXT } = K.meter;

  const fmtI = (a) => { const m = Math.abs(a) * 1000; return `${m < 10 ? m.toFixed(1) : Math.round(m)} mA`; };
  const fmtK = (r) => (r >= 1000 ? `${+(r / 1000).toFixed(1)} kΩ` : `${r} Ω`);
  // the meter, set for mA, closes the loop from strip 6 (red) to the − rail (black)
  const LOOP_METER = (V) => METER("mA", "mA", V.hs("b6", "-T9"));
  const RES = (V, r) => V.RES("res1", "+T6", "a6", r);
  const PLACE = (V, r) => ({ place: { type: "resistor", value: r }, at: V.hs("+T6", "a6") });
  // the meter, set for mA, sits in the loop: it carries the battery's whole current (however many resistors make the loop)
  const reading = (S) => {
    const m = M(S), b = S.battery();
    if (!m || m.mode !== "mA" || m.socket !== "mA" || !m.fuseOK || m.display || !m.red || !m.com || !b) return null;
    const i = Math.abs(m.value), ib = Math.abs(b.rd.I || 0);
    return i >= 0.0002 && i <= 0.05 && Math.abs(i - ib) <= 0.03 * ib + 2e-6 ? i : null;
  };
  // the swap steps: just this one resistor carries the current (one left lying unjoined on the board does not count)
  const only = (S, r) => { const rs = S.parts("resistor").filter((q) => q.ok && Math.abs(q.rd.I || 0) > 1e-5); return rs.length === 1 && rs[0].part.value === r && reading(S) !== null; };
  const between = (S, lo, hi) => { const i = reading(S); return i !== null && i >= lo && i <= hi; };
  const cells = (S) => (S.battery() ? S.battery().part.cells || 4 : 0);
  const SWAP_HINT = { say: "Click the resistor and press Remove. Then drag the new one into the same two holes." };

  const L = [
    {
      id: "3-1", title: "Twice the resistor", teaches: ["twiceR"], uses: ["current", "biggerR", "resistor", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["12 mA", "6 mA", "3 mA"], 2, ["more resistance holds back more, so the current goes down, not up.", "the resistor sets the current: twice the resistance lets only half through.", null]), seen = {};
        const rec = (r) => (S) => { if (only(S, r)) seen[r] = reading(S); return only(S, r); };
        const goal = (S) => between(S, 0.00135, 0.00165);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), RES(V, 1000), LOOP_METER(V)),
          rules: { tray: [{ type: "resistor", value: 2000, n: 1 }, { type: "resistor", value: 470, n: 1 }, { type: "resistor", value: 3900, n: 1 }, { type: "resistor", value: 10000, n: 1 }],
            allow: allow({ remove: ["res1"], dial: ["V", "mA"], socket: ["VO", "mA"], replace: ["meter"] }) },
          ui: { strips: true },
          goalsFrom: 3,
          beats: [
            { id: "p", say: "No LED this time: a 1 kΩ resistor and the meter, counting about 6 mA. With 2 kΩ, twice the resistance, what will it read?",
              highlight: { lcd: "meter" }, predict: P, waitFor: { predict: true } },
            { id: "swap", say: "Find out: swap in the 2 kΩ resistor from the tray.", hints: [SWAP_HINT], waitFor: { when: rec(2000) } },
            { id: "name", reply: "p", say: () => `${shownmA(seen[2000] ?? 0.003)}. Twice the resistance, half the current. Halve it once more?`, waitFor: NEXT },
            { id: "use", say: "Make about 1.5 mA flow, with one resistor from the tray.",
              hints: [{ say: "2 kΩ gave about 3 mA. Half of that needs twice 2 kΩ: about 4 kΩ." }, { say: "3.9 kΩ is the nearest size in the tray." }],
              waitFor: { when: goal, hold: 0.6 } },
            FINISH("Double the resistance and the current halves. They go opposite ways, in step."),
          ],
          goals: [{ text: "Make about 1.5 mA flow", when: goal }],
          challenge: { text: "Pick the 1.5 mA resistor on the first try", final: (C) => (C.count.place || 0) <= 2 },
          solution: [{ choose: "right" }, { remove: "res1" }, PLACE(V, 2000), { wait: 0.6 }, { next: 1 }, { remove: "resistor" }, PLACE(V, 3900), { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "3-2", title: "Twice the voltage", teaches: ["twiceV"], uses: ["twiceR", "volts", "current", "resistor", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["1.5 mA", "3 mA", "6 mA"], 2, ["more voltage drives more current, not less.", "the voltage drives the current: twice the voltage, twice the current.", null]);
        const P2 = V.predict(["3 mA", "6 mA", "12 mA"], 0, [null, "twice the resistance halves the current: 6 mA becomes 3 mA.", "more resistance means less current, not more."]), seen = {};
        const six = (S) => cells(S) === 4 && only(S, 1000) && between(S, 0.0055, 0.0065);
        const goal = (S) => cells(S) === 4 && only(S, 2000);
        return {
          region: REGION(V),
          start: start(Object.assign(V.BAT("+T3", "-T4"), { cells: 2, cellSwap: true }), RES(V, 1000), LOOP_METER(V)),
          rules: { tray: [{ type: "resistor", value: 2000, n: 1 }], allow: allow({ ctl: ["meter", "bat"], remove: ["res1"], dial: ["V", "mA"], socket: ["VO", "mA"] }) },
          ui: { strips: true },
          goalsFrom: 3,
          beats: [
            { id: "p1", say: "This pack holds only two cells: 3 V. With 1 kΩ the meter shows about 3 mA. With four cells, twice the voltage, what will it show?",
              highlight: { part: "bat" }, predict: P1, waitFor: { predict: true } },
            { id: "add", say: "Find out: click the empty slots in the battery pack to put in two more cells.", highlight: { part: "bat" },
              hints: [{ say: "The two dashed slots with a + in them. One click puts both cells in." }],
              waitFor: { when: (S) => { if (six(S)) seen.six = reading(S); return six(S); } } },
            { id: "p2", reply: "p1", say: () => `${shownmA(seen.six ?? 0.006)}. Twice the voltage, twice the current. Keep 6 V, use 2 kΩ: what will it read?`,
              highlight: { lcd: "meter" }, predict: P2, waitFor: { predict: true } },
            { id: "swap", say: "Find out: swap in the 2 kΩ resistor.", hints: [SWAP_HINT], waitFor: { when: goal } },
            Object.assign(FINISH("More voltage, more current. More resistance, less current. The next level puts both in one rule."), { reply: "p2" }),
          ],
          goals: [{ text: "Measure the current with 6 V and 2 kΩ", when: goal }],
          challenge: { text: "Then make 1.5 mA with the 2 kΩ: take two cells out", when: (S) => cells(S) === 2 && only(S, 2000) && between(S, 0.0014, 0.0016) },
          solution: [{ choose: "right" }, { cells: "bat" }, { wait: 0.6 }, { choose: "right" }, { remove: "res1" }, PLACE(V, 2000), { wait: 0.8 }, { cells: "bat" }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "3-3", title: "The rule", teaches: ["ohmsLaw"], uses: ["twiceR", "twiceV", "current", "resistor", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["About 2.7 mA", "About 13 mA", "About 0.4 mA"], 0, [null, "careful: divide, don't multiply. 6 ÷ 2.2 ≈ 2.7.", "that is the wrong way up: voltage ÷ resistance is 6 ÷ 2.2 ≈ 2.7."]);
        const P2 = V.predict(["About 1.3 mA", "About 4.7 mA", "About 28 mA"], 0, [null, "4.7 is the resistance, not the current: 6 ÷ 4.7 ≈ 1.3.", "divide, don't multiply: 6 ÷ 4.7 ≈ 1.3."]), seen = {};
        const rec = (r) => (S) => { if (only(S, r)) seen[r] = reading(S); return only(S, r); };
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), RES(V, 1000), LOOP_METER(V)),
          rules: { tray: [{ type: "resistor", value: 2200, n: 1 }, { type: "resistor", value: 4700, n: 1 }, { type: "resistor", value: 10000, n: 1 }], allow: allow({ remove: ["res1"], dial: ["V", "mA"], socket: ["VO", "mA"] }) },
          ui: { strips: true },
          goalsFrom: 4,
          beats: [
            { id: "rule", say: "The rule: current = voltage ÷ resistance. Volts ÷ kΩ gives mA: 6 V ÷ 1 kΩ = 6 mA: about what the meter shows.", highlight: { lcd: "meter" }, waitFor: NEXT },
            { id: "p1", say: "Now 2.2 kΩ, that is 2200 Ω. Work it out: 6 V ÷ 2.2 kΩ = …", predict: P1, waitFor: { predict: true } },
            { id: "m1", say: "Measure it: swap in the 2.2 kΩ resistor.", hints: [SWAP_HINT], waitFor: { when: rec(2200) } },
            { id: "p2", reply: "p1", say: () => `${shownmA(seen[2200] ?? 0.0027)} with 2.2 kΩ. And 6 V ÷ 4.7 kΩ = …`, highlight: { lcd: "meter" }, predict: P2, waitFor: { predict: true } },
            { id: "m2", say: "Check it with the 4.7 kΩ resistor.", hints: [SWAP_HINT], waitFor: { when: rec(4700) } },
            Object.assign(FINISH("Current = voltage ÷ resistance. Engineers call it Ohm's law."), { reply: "p2" }),
          ],
          goals: [{ text: "Measure the current with 4.7 kΩ", when: (S) => only(S, 4700) }],
          challenge: { text: "Then make about 0.6 mA with a resistor from the tray", when: (S) => between(S, 0.00055, 0.00065) },
          solution: [{ next: 1 }, { choose: "right" }, { remove: "res1" }, PLACE(V, 2200), { wait: 0.6 }, { choose: "right" }, { remove: "resistor" }, PLACE(V, 4700), { wait: 0.8 }, { remove: "resistor" }, PLACE(V, 10000), { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "3-4", title: "Find the resistor", teaches: ["findR"], uses: ["ohmsLaw", "ohms", "current", "resistor", "switch", "loop", "strip", "rail"], shifts: [0, 4, 8],
      values: [1500, 1200, 3000],
      layouts: [{}],
      make: (V) => {
        const R = V.ohms, mA = 6000 / R;                                   // 4, 5 or 2 mA
        // the two wrong answers: voltage × current, and current ÷ voltage
        const WHY = [null, "that is voltage × current. Turn the rule round: resistance = voltage ÷ current.", "that is current ÷ voltage, upside down. Resistance = voltage ÷ current."];
        const P = V.predict([fmtK(R), `${+(6 * mA).toFixed(0)} kΩ`, `${+(mA / 6).toFixed(2)} kΩ`], 0, WHY);
        const I2 = R === 3000 ? 3 : 2, R2 = 6 / I2;                   // the second one, worked out in your head (never the same as the first)
        const P2 = V.predict([`${R2} kΩ`, `${6 * I2} kΩ`, `${+(I2 / 6).toFixed(2)} kΩ`], 0, WHY);
        const checked = (S) => { const q = part(S, "resX"); return !!q && S.battery().part.on === false && S.across(q) && ohms(S) !== null && S.near(ohms(S), R, 0.03); };
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), Object.assign(V.RES("resX", "+T6", "a6", R), { tag: "X" }), LOOP_METER(V)),
          rules: { tray: [{ type: "wire", n: 1 }], allow: allow({ ctl: ["meter", "bat"], dial: ["V", "mA", "ohm"], socket: ["VO", "mA"] }) },
          ui: { strips: true },
          goalsFrom: 2,
          beats: [
            { id: "intro", say: `This resistor's colour bands are too worn to read. 6 V pushes about ${+mA.toFixed(1)} mA through it. Turn the rule round: resistance = voltage ÷ current.`,
              highlight: { lcd: "meter" }, waitFor: NEXT },
            { id: "p", say: `Volts ÷ mA gives kΩ. So how big is it? 6 V ÷ ${+mA.toFixed(1)} mA = …`, predict: P, waitFor: { predict: true } },
            { id: "check", reply: "p", say: "Let's check: battery off, dial to Ω, the red lead back into VΩ, then measure across the resistor.",
              hints: [{ say: "Battery switch off. Dial to Ω, red lead back in VΩ. Then one probe on each side of the resistor." }, RING(V.hs("+T8", "b6"))],
              waitFor: { when: checked } },
            { id: "p2", say: `One more, in your head: 6 V pushes ${I2} mA through another resistor. How big is that one?`, predict: P2, waitFor: { predict: true } },
            Object.assign(FINISH(`6 V ÷ ${I2} mA = ${R2} kΩ. Know two of voltage, current and resistance, and you can work out the third.`),
              { reply: "p2", note: "real resistors show their value in colour bands: yellow, violet, red is 47 × 100 = 4.7 kΩ. Gold means ±5 %. Can't read them? Measure." }),
          ],
          goals: [{ text: "Check the resistor with Ω", when: checked }],
          challenge: { text: "Then close the loop with a wire and measure the voltage across it", when: (S) => { const q = part(S, "resX"); return !!q && mode(S, "V") && S.across(q) && Math.abs(M(S).value || 0) > 5.5; } },
          solution: [{ next: 1 }, { choose: "right" }, { ctl: "bat" }, { socket: "VO" }, { dial: "ohm" }, { probe: V.hs("+T8", "b6") }, { wait: 0.6 }, { choose: "right" }, { ctl: "bat" }, { wire: V.hs("c6", "-T10") }, { dial: "V" }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "3-5", title: "Hot resistor", teaches: ["power"], uses: ["ohmsLaw", "resistor", "short", "loop", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["The 1 kΩ", "The 33 Ω", "Neither"], 1, ["the big one lets little current through. On the same 6 V, the small one lets far more through: more power, more heat.", null,
          "every resistor warms up. The 33 Ω lets so much through that it gets very hot."]);
        const across = (S, q) => S.joins(q, "bb:+T", "bb:-T");      // straight across the rails (or strips wired to them)
        const hot = (S) => S.parts("resistor").some((q) => q.part.value === 33 && across(S, q) && (q.rt.level || 0) >= 1);
        const gone = (S) => !S.parts("resistor").some((q) => q.part.value === 33 && q.ok);
        const cool = (S) => S.parts("resistor").some((q) => q.part.value === 1000 && across(S, q) && q.ok) && gone(S);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4")),
          rules: { tray: [{ type: "resistor", value: 33, n: 1 }, { type: "resistor", value: 1000, n: 1 }], banner: true },
          simText: { resistor: null },
          ui: { strips: true },
          beats: [
            { id: "p", say: "A resistor turns electrical energy into heat. Which one gets hot, straight across the 6 V rails: the 1 kΩ or the 33 Ω?", predict: P, waitFor: { predict: true } },
            { id: "try", say: "Find out: put the 33 Ω resistor straight across the rails, one leg on +, one on −.", highlight: { nets: ["bb:+T", "bb:-T"] },
              hints: [{ say: "Drag it from the tray so one leg lands on the red + rail and the other on the blue − rail." }, { show: [V.RES("h", "+T10", "-T13", 33)] }],
              waitFor: { when: hot, hold: 0.05 } },
            { id: "pull", say: "It's scorching hot! Get it out of the loop, quick! On a real bench: battery off first, and don't touch it.",
              hints: [{ say: "Drag it onto the parts tray, or click it and press Remove." }], waitFor: { when: gone, hold: 0.05 } },
            { id: "name", reply: "p", say: (C) => `${C.broken.has("resistor") ? "Too late, it burned. " : "Phew. "}6 V pushed 180 mA (0.18 A) through it. Power = voltage × current: 6 V × 0.18 A ≈ 1 watt (W).`, waitFor: NEXT },
            { id: "cool", say: "Resistors like these are made for ¼ W. For the 1 kΩ, power = 6 V × 6 mA = 0.036 W. Put it across the rails instead: it stays cool.", hints: [{ show: [V.RES("h", "+T10", "-T13", 1000)] }],
              waitFor: { when: cool, hold: 1 } },
            Object.assign(FINISH("Resistors like these handle ¼ W. Work out voltage × current, and keep well below that."),
              { note: "an overloaded resistor gets hot enough to burn fingers, and smokes. Unplug first, and let it cool before you touch it." }),
          ],
          goals: [{ text: "A resistor across the rails that stays cool", when: cool, hold: 1 }],
          challenge: { text: "Pull the 33 Ω out before it smokes", when: (S, m) => { if (S.parts("resistor").some((q) => q.part.value === 33 && (q.rt.level || 0) >= 2)) m.smoke = true; return false; },
            final: (C, m) => !m.smoke && !C.broken.has("resistor") },
          solution: [{ choose: "right" }, { place: { type: "resistor", value: 33 }, at: V.hs("+T10", "-T13") }, { wait: 1 }, { remove: "resistor" }, { wait: 0.4 }, { next: 1 },
            { place: { type: "resistor", value: 1000 }, at: V.hs("+T10", "-T13") }, { wait: 1.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "3-6", title: "3 mA, two ways", teaches: [], uses: ["ohmsLaw", "twiceR", "twiceV", "findR", "current", "resistor", "loop", "strip", "rail"], shifts: [0, 4, 8],
      card: { name: "Ohm's law at work", text: "Current = voltage ÷ resistance. To get the current you want, choose the resistance, or the voltage." },
      layouts: [{}],
      make: (V) => {
        // the target current; each one can be made two ways: a resistor on 6 V, or another on 3 V (two cells out)
        const T = V.pick([{ mA: 3, r6: 2000, r3: 1000 }, { mA: 1.5, r6: 3900, r3: 2000 }]), tA = T.mA / 1000;
        const three = (S) => between(S, tA * 0.966, tA * 1.034);
        return {
          title: `${T.mA} mA, two ways`,
          region: REGION(V),
          start: start(Object.assign(V.BAT("+T3", "-T4"), { cellSwap: true }), LOOP_METER(V)),
          rules: { tray: [{ type: "resistor", value: 1000, n: 1 }, { type: "resistor", value: 2000, n: 1 }, { type: "resistor", value: 2200, n: 1 }, { type: "resistor", value: 3900, n: 1 },
            { type: "resistor", value: 4700, n: 1 }],
            allow: allow({ ctl: ["meter", "bat"], replace: ["meter"] }), banner: true },
          ui: { strips: true },
          beats: [
            { id: "brief", say: V.say(`Make ${T.mA} mA flow through the meter, as near as the parts allow. There is more than one way to do it.`,
              `Your task: ${T.mA} mA through the meter, as near as you can. Find a way, then maybe a second one.`), waitFor: { next: true, label: "Start" } },
            { id: "build", say: "The meter waits in strip 6, ready to count. Build the rest. Ask for a hint if you need one.",
              hints: [{ say: `Current = voltage ÷ resistance. 6 V ÷ what = ${T.mA} mA?` }, { say: `Or change the voltage: take two cells out. 3 V ÷ what = ${T.mA} mA?` },
                { say: "One leg of the resistor on the + rail, the other in strip 6, the meter's strip." }],
              waitFor: { when: three, hold: 0.6 } },
            FINISH("Two ways to the same current: choose the resistance, or choose the voltage."),
          ],
          goals: [{ text: `Make ${T.mA} mA flow (within 3 %)`, when: three, hold: 0.6 }],
          challenge: { text: "Find both ways", when: (S, m) => { if (three(S)) m[cells(S)] = true; return !!m[2] && !!m[4]; } },
          solution: [{ next: 1 }, PLACE(V, T.r6), { wait: 1 }, { remove: "resistor" }, { cells: "bat" }, PLACE(V, T.r3), { wait: 1 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(3, "Ohm's law", L, {
    "lede": "You can measure voltage, current and resistance. Now the three come together in one rule, so you can work things out before you build.",
    "cover": "ohmsLaw",
    "questions": [
      "What happens to the current if you double the resistance?",
      "And if you double the voltage?",
      "Why does one resistor get hot while another stays cool?"
    ],
    "words": [
      {
        "w": "Ohm's law",
        "d": "For a resistor, current = voltage ÷ resistance. Know two of the three, and you can work out the third.",
        "sym": "Ω"
      },
      {
        "w": "Kilo-ohm (kΩ)",
        "d": "1000 Ω. Handy: volts ÷ kΩ gives mA.",
        "sym": "resistor"
      },
      {
        "w": "Amp (A)",
        "d": "The unit of current. 1 A = 1000 mA, so 180 mA is 0.18 A.",
        "sym": "A"
      },
      {
        "w": "Watt (W)",
        "d": "The unit of power. 1 V across a part with 1 A through it makes 1 W.",
        "sym": "W"
      },
      {
        "w": "Power",
        "d": "How fast a part turns electrical energy into heat or light: voltage × current. Resistors like these are made for ¼ W.",
        "sym": "heat"
      }
    ]
  });
})(window.BB = window.BB || {});
