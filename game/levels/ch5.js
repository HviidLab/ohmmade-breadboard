// Chapter 5: Series and parallel. Parts in a row (series) share one current and add their resistances, and they share
// out the voltage; parts side by side (parallel) each get the whole voltage, and their currents add up. Then a surprise:
// two LEDs side by side on one resistor (only the one needing less voltage lights), and an open puzzle: four lights on a small battery.
// Same rules as Chapters 2 to 4: a question in every level, predict first, the goal and not the holes, hints on request.
// Data only, built with the kit from ch1.js and the meter helpers from ch2.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, part, darkLed, FINISH } = K;
  const { M, volts, fmtV, shownV, shownmA, RING, METER, allow, REGION, NEXT } = K.meter;

  const fmtI = (a) => { const m = Math.abs(a) * 1000; return `${m < 10 ? m.toFixed(1) : Math.round(m)} mA`; };
  const reads = (S) => (M(S) && M(S).mode === "mA" && M(S).socket === "mA" && M(S).fuseOK && !M(S).display && M(S).red && M(S).com ? Math.abs(M(S).value) : null);
  const near = (x, lo, hi) => x !== null && x >= lo && x <= hi;
  const acrossQ = (S, q) => !!q && S.across(q) && volts(S) !== null;
  const resWith = (S, r) => S.parts("resistor").filter((q) => q.part.value === r && q.ok);
  const railToRail = (S, q) => S.joins(q, "bb:+T", "bb:-T");      // from the + rail to the − rail (or strips wired to them)

  const L = [
    {
      id: "5-1", title: "Two in a row", teaches: ["seriesR"], uses: ["twiceR", "ohmsLaw", "sameCurrent", "resistor", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["12 mA", "6 mA", "3 mA"], 2, ["a second resistor in a row holds back more, so the current falls, not rises.", "the current must get through both: twice the resistance, half the current.", null]);
        const P2 = V.predict(["2 mA", "3 mA", "6 mA"], 0, [null, "1 kΩ + 2 kΩ = 3 kΩ in all, and 6 V ÷ 3 kΩ = 2 mA.", "in a row the resistances add up to 3 kΩ, so 6 V ÷ 3 kΩ = 2 mA."]), seen = {};
        const two = (S) => !part(S, "w1") && resWith(S, 1000).length === 2 && near(reads(S), 0.0028, 0.0032);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T6", "a6", 1000), V.WIRE("w1", "c6", "c10"), METER("mA", "mA", V.hs("b10", "-T12"))),
          rules: { tray: [{ type: "resistor", value: 1000, n: 1 }, { type: "resistor", value: 2000, n: 1 }], allow: allow({ remove: ["w1"], dial: ["V", "mA"], socket: ["VO", "mA"] }) },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "p1", say: "One 1 kΩ resistor: about 6 mA. Put a second 1 kΩ in a row with it, in place of the wire. What will the meter read?",
              highlight: { part: "w1" }, predict: P1, waitFor: { predict: true } },
            { id: "build", say: "Find out: take the wire out and put the second resistor in its place.",
              hints: [{ say: "Click the wire and press Remove. Then drag the 1 kΩ into the two holes the wire used." }],
              waitFor: { when: (S) => { if (two(S)) seen.i = reads(S); return two(S); } } },
            { id: "p2", reply: "p1", say: () => `${shownmA(seen.i ?? 0.003)}. In a row, called series, the resistances add: 1 kΩ + 1 kΩ = 2 kΩ. And 1 kΩ + 2 kΩ?`,
              highlight: { lcd: "meter" }, predict: P2, waitFor: { predict: true } },
            Object.assign(FINISH("3 kΩ in all, so 6 V ÷ 3 kΩ = 2 mA. Resistances in series add up."), { reply: "p2" }),
          ],
          goals: [{ text: "Two 1 kΩ resistors in a row", when: two }],
          challenge: { text: "Then build 1 kΩ + 2 kΩ and read the 2 mA you worked out", when: (S) => resWith(S, 1000).length === 1 && resWith(S, 2000).length === 1 && near(reads(S), 0.0019, 0.0021) },
          solution: [{ choose: "right" }, { remove: "w1" }, { place: { type: "resistor", value: 1000 }, at: V.hs("c6", "c10") }, { wait: 0.8 }, { choose: "right" }, { remove: "resistor" }, { place: { type: "resistor", value: 2000 }, at: V.hs("c6", "c10") }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "5-2", title: "The bigger share", teaches: ["seriesShare"], uses: ["seriesR", "across", "ohmsLaw", "resistor", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["The 1 kΩ", "The 2 kΩ", "Both the same"], 1, ["the bigger resistor has the bigger share of the voltage, not the smaller one.", null, "the same current goes through both, so the bigger one has the bigger share."]);
        const P2 = V.predict(["3 V each", "6 V each", "2 V and 4 V"], 0, [null, "in series they share the 6 V: it is not given to each one.", "that was for 1 kΩ and 2 kΩ. Two equal resistors have equal shares."]), seen = {};
        const swapped = (S) => !part(S, "r2") && resWith(S, 1000).length === 2;
        const half = (S) => swapped(S) && S.parts("resistor").some((q) => q.id !== "r1" && acrossQ(S, q) && Math.abs(volts(S)) > 2.7 && Math.abs(volts(S)) < 3.3);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T6", "a6", 1000), V.RES("r2", "c6", "c10", 2000), V.WIRE("w1", "e10", "-T10"), METER("V")),
          rules: { tray: [{ type: "resistor", value: 1000, n: 1 }], allow: allow({ dial: ["V"], socket: ["VO"] }) },     // the swap is its own step: the shares before it are 1 kΩ's and 2 kΩ's
          ui: { strips: true },
          goalsFrom: 4,
          beats: [
            { id: "p1", say: "A 1 kΩ and a 2 kΩ in a row share the battery's 6 V. Which one has the bigger share?", highlight: { parts: ["r1", "r2"] }, predict: P1, waitFor: { predict: true } },
            { id: "both", say: "Find out: measure across each resistor.", hints: [RING(V.hs("+T8", "b6")), RING(V.hs("d6", "d10"), "And the other one.")],
              waitFor: { when: (S, m) => {
                if (acrossQ(S, part(S, "r1"))) { m.a = true; seen.a = volts(S); }
                if (acrossQ(S, part(S, "r2"))) { m.b = true; seen.b = volts(S); }
                return m.a && m.b;
              } } },
            { id: "p2", reply: "p1", say: () => `${shownV(seen.a ?? 2)} and ${shownV(seen.b ?? 4)}: twice the resistance, twice the share. With two 1 kΩ?`,
              highlight: { lcd: "meter" }, predict: P2, waitFor: { predict: true } },
            { id: "swap", say: "Check it: swap the 2 kΩ for the 1 kΩ from the tray, and measure across it.", allow: allow({ remove: ["r2"], dial: ["V"], socket: ["VO"] }),
              hints: [{ say: "Click the 2 kΩ and press Remove, then drag the 1 kΩ into the same two holes." }, RING(V.hs("d6", "d10"))], waitFor: { when: half } },
            Object.assign(FINISH("In series, the resistors share out the voltage, the bigger one with the bigger share. The shares add up to the battery's voltage."), { reply: "p2" }),
          ],
          goals: [{ text: "Measure across the second 1 kΩ", when: half }],
          challenge: { text: "With two 1 kΩ, measure both shares: 3 V each", when: (S, m) => {
              if (half(S)) m.b = true;
              if (swapped(S) && acrossQ(S, part(S, "r1")) && Math.abs(volts(S)) > 2.7 && Math.abs(volts(S)) < 3.3) m.a = true;
              return !!m.a && !!m.b;
            } },
          solution: [{ choose: "right" }, { probe: V.hs("+T8", "b6") }, { probe: V.hs("d6", "d10") }, { wait: 0.5 }, { choose: "right" }, { remove: "r2" },
            { place: { type: "resistor", value: 1000 }, at: V.hs("c6", "c10") }, { probe: V.hs("d6", "d10") }, { wait: 0.6 }, { probe: V.hs("+T8", "b6") }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "5-3", title: "Side by side", teaches: ["parallelV"], uses: ["seriesShare", "volts", "across", "ohmsLaw", "resistor", "rail"], shifts: [0, 4],
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["6 V each", "3 V each", "2 V and 4 V"], 0, [null, "side by side they don't share: each goes straight from + to −, so each has all 6 V across it.", "that was for a row. Side by side, each one has the whole 6 V across it."]);
        const P2 = V.predict(["3 mA", "6 mA", "9 mA"], 0, [null, "the 2 kΩ has 6 V across it too, but holds back twice as much: 6 V ÷ 2 kΩ = 3 mA.", "9 mA is what the battery sends to both. The 2 kΩ alone draws 6 ÷ 2 = 3 mA."]);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T8", "-T10", 1000), V.RES("r2", "+T14", "-T16", 2000), METER("V")),
          rules: { tray: [], allow: allow({ dial: ["V", "mA"], socket: ["VO", "mA"], move: ["r2"], legs: ["r2"] }) },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "p1", say: "Now side by side: the 1 kΩ and the 2 kΩ each go straight from + to −. How much voltage is across each one?",
              highlight: { parts: ["r1", "r2"] }, predict: P1, waitFor: { predict: true } },
            { id: "both", say: "Measure across each of them.", hints: [RING(V.hs("+T9", "-T9")), RING(V.hs("+T15", "-T15"), "Any + hole and any − hole will do: each resistor sits between the rails.")],
              waitFor: { when: (S, m) => {
                if (acrossQ(S, part(S, "r1")) && Math.abs(volts(S)) > 5.5) m.a = true;
                if (acrossQ(S, part(S, "r2")) && Math.abs(volts(S)) > 5.5) m.b = true;
                return m.a && m.b;
              } } },
            { id: "p2", reply: "p1", say: "6 V across both: side by side, called parallel, each has the whole voltage across it. So the 1 kΩ draws about 6 mA. And the 2 kΩ?",
              predict: P2, waitFor: { predict: true } },
            Object.assign(FINISH("6 V ÷ 2 kΩ = 3 mA. In parallel, every branch has the same voltage across it and draws its own current."), { reply: "p2",
              hints: [{ say: "On mA the meter goes in the path, never across. So open the 2 kΩ's branch: drag its − leg off the rail into a free strip." },
                { show: [V.RES("h", "+T14", "a16", 2000)] },
                RING(V.hs("b16", "-T18"), "Lift the probes off the rails before you set mA. Then close the gap: red probe in the 2 kΩ's strip, black on the − rail.")] }),
          ],
          goals: [{ text: "Measure across both resistors", when: (S, m) => {
            if (acrossQ(S, part(S, "r1")) && Math.abs(volts(S)) > 5.5) m.a = true;
            if (acrossQ(S, part(S, "r2")) && Math.abs(volts(S)) > 5.5) m.b = true;
            return m.a && m.b;
          } }],
          challenge: { text: "Then measure the 2 kΩ's own 3 mA: move its − leg into a free strip, and close that gap with the meter", when: (S) => { const q = part(S, "r2"); return !!q && S.readsCurrentOf(q, 0.0027, 0.0033); } },
          solution: [{ choose: "right" }, { probe: V.hs("+T9", "-T9") }, { probe: V.hs("+T15", "-T15") }, { wait: 0.5 }, { choose: "right" },
            { move: "r2", to: V.hs("+T14", "a16") }, { probe: V.hs("b16", "-T18") }, { dial: "mA" }, { socket: "mA" }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "5-4", title: "Branches add up", teaches: ["parallelI"], uses: ["parallelV", "current", "ohmsLaw", "resistor", "rail", "strip"], shifts: [0, 4],
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["9 mA", "3 mA", "6 mA"], 0, [null, "adding a branch gives the current a second path, so the battery sends more, not less.", "the first branch still draws its 6 mA, and the new one adds its own 3 mA."]);
        const P2 = V.predict(["15 mA", "9 mA", "7 mA"], 0, [null, "every new branch adds its own current: 9 + 6 = 15 mA.", "branches add, they don't average: 6 + 3 + 6 = 15 mA."]), seen = {};
        const nBranches = (S) => S.parts("resistor").filter((q) => q.ok && railToRail(S, q)).length;
        const nine = (S) => nBranches(S) === 2 && near(reads(S), 0.0086, 0.0094);
        const fifteen = (S) => nBranches(S) === 3 && near(reads(S), 0.0143, 0.0157);
        return {
          region: REGION(V),
          // the battery's + lead goes into strip 3, and the meter carries everything on to the + rail
          start: start(Object.assign(V.BAT("c3", "-T4")), METER("mA", "mA", V.hs("b3", "+T5")), V.RES("r1", "+T8", "-T10", 1000)),
          rules: { tray: [{ type: "resistor", value: 2000, n: 1 }, { type: "resistor", value: 1000, n: 1 }], allow: allow({ dial: ["V", "mA"], socket: ["VO", "mA"], replace: ["meter"] }) },
          ui: { strips: true },
          goalsFrom: 3,
          beats: [
            { id: "p1", say: "The meter sits in the main line, the path all the current takes, so it counts everything: about 6 mA for one 1 kΩ branch. Add a 2 kΩ?",
              highlight: { lcd: "meter" }, predict: P1, waitFor: { predict: true } },
            { id: "add", say: "Find out: put the 2 kΩ side by side with the other one: drop it on the + rail, then drag its free end to the − rail.",
              hints: [{ say: "One leg on the red + rail, the other on the blue − rail, like the resistor already there." }, { show: [V.RES("h", "+T14", "-T16", 2000)] }],
              waitFor: { when: (S) => { if (nine(S)) seen.i = reads(S); return nine(S); } } },
            { id: "p2", reply: "p1", say: () => `${shownmA(seen.i ?? 0.009)}: about 6 + 3. The branches add up. A third branch, another 1 kΩ?`, predict: P2, waitFor: { predict: true } },
            { id: "add2", say: "Add it, and watch the meter.", hints: [{ show: [V.RES("h", "+T17", "-T19", 1000)] }], waitFor: { when: fifteen } },
            Object.assign(FINISH("In parallel, the currents add up: the battery supplies every branch at once."), { reply: "p2" }),
          ],
          goals: [{ text: "Three branches: about 15 mA in all", when: fifteen }],
          challenge: { text: "Reach 15 mA, then take a branch away and watch the total drop", when: (S, m) => { if (fifteen(S)) m.f = true; return !!m.f && nBranches(S) === 2 && reads(S) !== null && reads(S) < 0.0135; } },
          solution: [{ choose: "right" }, { place: { type: "resistor", value: 2000 }, at: V.hs("+T14", "-T16") }, { wait: 0.6 }, { choose: "right" },
            { place: { type: "resistor", value: 1000 }, at: V.hs("+T17", "-T19") }, { wait: 0.8 }, { remove: "resistor" }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "5-5", title: "One resistor, two LEDs", teaches: ["ownResistor"], uses: ["parallelV", "ledColours", "ledDrop", "chooseR", "resistor", "polarity", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Both", "Only the red one", "Only the blue one"], 1, ["side by side they have the same voltage across them: about 2 V, too little for blue, which needs 3 V.", null,
          "blue needs more voltage, about 3 V. Red lights at 2 V and holds the voltage there."]);
        const blue = (S) => S.parts("led").find((q) => q.part.color === "blue") || null;
        const shared = (S) => S.joins(blue(S), V.n("bb:L6"), V.n("bb:L7"));       // beside the red LED, in the same two strips
        const both = (S) => S.parts("led").filter((q) => lit(q, 0.005) && q.rd.I <= 0.02).length === 2;
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T6", "a6", 330), V.LED("led1", "c6", "c7", "red"), V.WIRE("w1", "e7", "-T7")),
          // the red LED's wire may move, so a curious player can also try red and blue in a row (and move it back)
          rules: { tray: [{ type: "led", color: "blue", n: 1 }, { type: "resistor", value: 270, n: 1 }, { type: "wire", n: 1 }], allow: allow({ move: ["w1"], legs: ["w1"] }), banner: true },
          ui: { strips: true },
          beats: [
            { id: "p", say: "Put a blue LED side by side with the red one, in the same two strips, sharing the resistor. Which one will light?",
              highlight: { part: "led1" }, predict: P, waitFor: { predict: true } },
            { id: "share", say: "Find out: plug the blue LED into the same two strips as the red one, longer leg on the + side.",
              hints: [{ say: `Into ${V.h("d6")} and ${V.h("d7")}, say: the same strips as the red LED, which is in ${V.h("c6")} and ${V.h("c7")}.` }, { show: [V.LED("h", "d6", "d7", "blue")] }],
              waitFor: { when: shared, hold: 0.6 } },
            { id: "fix", reply: "p", say: "About 2 V across both: too little for blue. Move blue to free strips, with the 270 Ω from the + rail to its + leg.",
              hints: [{ say: "Move the blue LED to free strips, with its − leg straight in the − rail. Then 270 Ω from the + rail to its + leg." },
                { show: [V.RES("h1", "+T12", "a12", 270), V.LED("h2", "c12", "-T14", "blue")] }],
              waitFor: { when: both, hold: 0.6 } },
            { id: "row", say: "In a row, LED voltages add up: red 2 V + blue 3 V = 5 V. That leaves only about 1 V across the resistor.", waitFor: NEXT },
            FINISH("LEDs side by side each need their own resistor. LEDs in a row carry one current, so one resistor can serve the whole row."),
          ],
          goals: [{ text: "Both LEDs lit, each with its own resistor", when: both, hold: 0.6 }],
          // red and blue in a row also light, dimly: say so, and what this level asks instead
          react: [{ hold: 0.8, when: (S, C) => {
            const ls = S.parts("led").filter((q) => q.ok && q.rd.I > 0.001), b = S.battery(), ib = Math.abs((b && b.rd.I) || 0);
            if (!C.beat || C.beat.id === "p" || ls.length !== 2 || !ls.every((q) => Math.abs(q.rd.I - ib) <= 0.03 * ib)) return null;
            return `In a row, both light: red 2 V + blue 3 V leaves about 1 V for the resistor, so only ${shownmA(ib)}. That works too. Here: side by side, each with its own resistor.`;
          } }],
          challenge: { text: "Both LEDs within 3 mA of each other", when: (S) => { const ls = S.parts("led").filter((q) => lit(q, 0.005)); return both(S) && ls.length === 2 && Math.abs(ls[0].rd.I - ls[1].rd.I) <= 0.003; } },
          solution: [{ choose: "right" }, { place: { type: "led", color: "blue" }, at: V.hs("d6", "d7") }, { wait: 1 }, { move: "led", to: V.hs("c12", "-T14") },
            { place: { type: "resistor", value: 270 }, at: V.hs("+T12", "a12") }, { wait: 1 }, { next: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "5-6", title: "A string of lights", teaches: [], shifts: [0], colors: ["red", "yellow", "green"],
      uses: ["seriesR", "seriesShare", "sameCurrent", "parallelV", "parallelI", "ownResistor", "ledCurrent", "ledDrop", "current", "resistor", "polarity", "loop", "strip", "rail"],
      card: { name: "Series and parallel", text: "In a row, parts share one current and share out the voltage. Side by side, they have the same voltage across them and the currents add up." },
      layouts: [{}],
      make: (V) => {
        // Four LEDs, two 220 Ω, and the battery may give 20 mA at most. Worked with the simulator's models (battery 6 V with
        // 0.5 Ω inside; LED n = 2, 2.0 / 2.1 / 2.2 V at 12 mA for red / yellow / green); currents per LED, then the battery's:
        //   two rows side by side, each row 220 Ω + two LEDs in a row:  9.29 / 8.47 / 7.65 mA each, battery 18.6 / 16.9 / 15.3 mA  ✓
        //     (the meter on mA in the main line adds its 1 Ω:            9.22 / 8.40 / 7.58 mA,       battery 18.4 / 16.8 / 15.2 mA  ✓)
        //   each 220 Ω with two LEDs side by side:                       9.11 / 8.89 / 8.67 mA each,  battery 36.5 / 35.6 / 34.7 mA  ✗ (too much)
        //   all four side by side on one 220 Ω:                          4.63 / 4.52 / 4.41 mA each,  battery 18.5 / 18.1 / 17.6 mA  ✗ (too little each)
        //   all four in one row (220 Ω, or both):                         about 1.5 V each, a few µA: dark                          ✗ (4 × 2 V = 8 V > 6 V)
        //   three in a row + 220 Ω, one LED + 220 Ω:                      1.9 / 1.1 / 0.4 mA and 17.9 / 17.5 / 17.0 mA            ✗
        //   two pairs side by side in a row, on 220 Ω:                    4.91 / 4.48 / 4.06 mA each,  battery 9.8 / 9.0 / 8.1 mA    ✗
        //   the same on both 220 Ω side by side (110 Ω), or two rows sharing them: 9.29 / 8.47 / 7.65 mA, battery 18.6 / 16.9 / 15.3 mA:
        //     the numbers of the answer, but LEDs (or rows) side by side share one resistance, against "one resistor per LED" (5-5):
        //     real LEDs differ, so one path would hog the current. So the goal also asks that the current never splits except at
        //     the battery's + and −: every other point joins just two parts that carry current (the meter on mA counts as a wire).
        //   With only these designs lighting all four, the window (5 to 10 mA) and the limit (20 mA) have 7 % or more to spare.
        //   (A 330 Ω for the second row would give green 5.3 mA, too close to 5: so two 220 Ω, two rows alike.)
        const c = V.c1, vf = BB.Devices.ledParams(c).vf, LO = 0.005, HI = 0.010, MAX = 0.020;
        const leds = (S) => S.parts("led").filter((q) => q.ok);
        const ib = (S) => { const b = S.battery(); return Math.abs((b && b.rd.I) || 0); };
        const inWindow = (q) => q.rd.I >= LO && q.rd.I <= HI;
        // the current splits only at the battery's two ends: away from them, each point joins exactly two parts carrying current
        const rowsOnly = (S) => {
          const up = new Map(), find = (x) => { while (up.has(x)) x = up.get(x); return x; };
          const join = (a, b) => { if (!a || !b) return; a = find(a); b = find(b); if (a !== b) up.set(a, b); };
          for (const q of S.parts("wire")) if (q.ok && !q.part.broken) join(q.nets[0], q.nets[1]);
          const m = S.meter;
          if (m && m.mode === "mA" && m.socket === "mA" && m.fuseOK && m.red && m.com) join(BB.netKey(m.red), BB.netKey(m.com));
          const b = S.battery(); if (!b) return false;
          const ends = new Set(b.nets.map(find)), n = new Map();
          for (const q of [...S.parts("led"), ...S.parts("resistor")]) {
            if (!q.ok || Math.abs(q.rd.I || 0) < 1e-4) continue;
            for (const net of q.nets) { const k = find(net); if (!ends.has(k)) n.set(k, (n.get(k) || 0) + 1); }
          }
          return [...n.values()].every((x) => x === 2);
        };
        const built = (S) => { const ls = leds(S); return ls.length === 4 && ls.every(inWindow) && ib(S) <= MAX && rowsOnly(S); };
        const a = ((6 - 2 * vf) / 0.22).toFixed(1), a2 = (2 * (6 - 2 * vf) / 0.22).toFixed(1);     // mA through two LEDs in a row with 220 Ω, by (battery − LEDs) ÷ resistance; two such rows
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), METER("mA", "mA")),
          rules: { tray: [{ type: "led", color: c, n: 4 }, { type: "resistor", value: 220, n: 2 }, { type: "wire", n: 4 }], allow: allow({ replace: ["meter"] }), banner: true },
          ui: { strips: true },
          beats: [
            { id: "brief", say: V.say(`A little decoration has four ${c} lights: here, the four LEDs. To run for weeks on its battery, it may draw 20 mA at most.`,
              `Four ${c} LEDs are the lights of a little decoration. Its battery must last for weeks, so it may give 20 mA at most.`), waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Light all four, each at 5 to 10 mA, while the battery gives 20 mA at most. The meter can check. Ask for a hint if you get stuck.",
              hints: [{ say: "Side by side, the branches' currents add up at the battery. In a row, one current goes through every part. Which helps here?" },
                { say: `Two LEDs in a row with 220 Ω: (6 − ${vf.toFixed(1)} − ${vf.toFixed(1)}) V ÷ 220 Ω ≈ ${a} mA through both. Two such rows side by side: about ${a2} mA.` },
                { show: [V.RES("h1", "+T6", "a6", 220), V.LED("h2", "c6", "c7", c), V.LED("h3", "b7", "-T9", c),
                  V.RES("h5", "+T12", "a12", 220), V.LED("h6", "c12", "c13", c), V.LED("h7", "b13", "-T15", c)] }],
              waitFor: { when: built, hold: 0.8 } },
            Object.assign(FINISH("In a row, two LEDs share one current, so one resistor serves both: half the battery current of two side by side. Chapter 5 done!"),
              { note: "in a row, if one LED fails and opens the loop, every LED in that row goes dark; side by side, the rest stay lit." }),
          ],
          goals: [{ text: `All four ${c} LEDs at 5 to 10 mA each, every path with its own resistor, and the battery at most 20 mA in all`, when: built, hold: 0.8 }],
          react: [{ hold: 1, when: (S, C) => (C.beat && C.beat.id === "build" ? darkLed(S) : null) }, { hold: 1, when: (S, C) => {
            if (!C.beat || C.beat.id !== "build" || built(S)) return null;
            const ls = leds(S);
            if (ls.length !== 4) return null;
            // all four in one row: about 1.5 V across each, almost no current
            if (ls.every((q) => q.rd.I < 5e-4 && q.rd.V > 1) && ls.reduce((t, q) => t + q.rd.V, 0) > 5)
              return `Four ${c} LEDs in one row need about 4 × ${vf.toFixed(1)} = ${(4 * vf).toFixed(1)} V to light, and the battery has only 6 V. So they stay dark.`;
            if (!ls.every((q) => q.rd.I > 0.001)) return null;
            if (ls.every(inWindow) && ib(S) > MAX) return `Each LED gets its share, but the battery gives ${shownmA(ib(S))}: too much for this small battery, which may give 20 mA at most.`;
            if (ls.every(inWindow)) return "All lit, under 20 mA, but the current splits after a resistor. Real LEDs differ, so one path would hog it. Give each path its own resistor.";
            const off = ls.reduce((w, q) => (Math.abs(q.rd.I - 0.0075) > Math.abs(w.rd.I - 0.0075) ? q : w));
            const alike = ls.every((q) => Math.abs(q.rd.I - off.rd.I) <= 0.03 * off.rd.I);
            return `All four lit, but ${alike ? "each" : "one"} LED has ${shownmA(off.rd.I)}. They need 5 to 10 mA each.`;
          } }],
          challenge: { text: "Measure the battery's whole current with the meter", when: (S) => built(S) && S.readsCurrentOf(S.battery(), 0.005, MAX) },
          // both rows end in strip 20, and the meter carries their current on to the − rail: the battery's whole current
          solution: [{ next: 1 }, { place: { type: "resistor", value: 220 }, at: ["+T6", "a6"] }, { place: { type: "led", color: c }, at: ["c6", "c7"] },
            { place: { type: "led", color: c }, at: ["d7", "d8"] }, { wire: ["e8", "a20"] }, { place: { type: "resistor", value: 220 }, at: ["+T12", "a12"] },
            { place: { type: "led", color: c }, at: ["c12", "c13"] }, { place: { type: "led", color: c }, at: ["d13", "d14"] }, { wire: ["e14", "b20"] },
            { probe: ["c20", "-T20"] }, { wait: 1.5 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(5, "Series and parallel", L, {
    "lede": "With more than one part there are two ways to join them: one after another, or side by side. They behave very differently.",
    "cover": "parallelI",
    "questions": [
      "Two resistors in a row: more current, or less?",
      "How do parts in a row share out the voltage?",
      "Side by side, what voltage does each part have across it?"
    ],
    "words": [
      {
        "w": "Series (in a row)",
        "d": "One part after another: the same current goes through each of them.",
        "sym": "resistor"
      },
      {
        "w": "Parallel (side by side)",
        "d": "Parts joined at both ends to the same two points have the same voltage across them. Straight across the battery: its whole voltage.",
        "sym": "battery"
      },
      {
        "w": "Branch",
        "d": "One path of a parallel circuit. The battery supplies all the branches at once.",
        "sym": "switch"
      },
      {
        "w": "Main line",
        "d": "The path all the current takes before it splits into branches, and after they join again.",
        "sym": "A"
      }
    ]
  });
})(window.BB = window.BB || {});
