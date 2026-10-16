// Chapter 5: Series and parallel. Parts in a row (series) share one current and add their resistances, and they share
// out the voltage; parts side by side (parallel) each get the whole voltage, and their currents add up. Then a surprise:
// two LEDs side by side on one resistor (only the one needing less voltage lights), and a challenge with LEDs in a row.
// Same rules as Chapters 2 to 4: a question in every level, predict first, the goal and not the holes, hints on request.
// Data only, built with the kit from ch1.js and the meter helpers from ch2.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, part, FINISH } = K;
  const { M, volts, fmtV, RING, METER, allow, REGION, NEXT } = K.meter;

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
            { id: "p1", say: "One 1 kΩ resistor: 6 mA. Put a second 1 kΩ in a row with it, in place of the wire. What will the meter read?",
              highlight: { part: "w1" }, predict: P1, waitFor: { predict: true } },
            { id: "build", say: "Find out: take the wire out and put the second resistor in its place.",
              hints: [{ say: "Click the wire and press Remove. Then drag the 1 kΩ into the two holes the wire used." }],
              waitFor: { when: (S) => { if (two(S)) seen.i = reads(S); return two(S); } } },
            { id: "p2", reply: "p1", say: () => `${fmtI(seen.i || 0.003)}. In a row, called series, the resistances add: 1 kΩ + 1 kΩ = 2 kΩ. And 1 kΩ + 2 kΩ?`,
              highlight: { lcd: "meter" }, predict: P2, waitFor: { predict: true } },
            Object.assign(FINISH("3 kΩ in all, so 6 V ÷ 3 kΩ = 2 mA. Resistors in series add up."), { reply: "p2" }),
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
          rules: { tray: [{ type: "resistor", value: 1000, n: 1 }], allow: allow({ remove: ["r2"], dial: ["V"], socket: ["VO"] }) },
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
            { id: "p2", reply: "p1", say: () => `${fmtV(seen.a || 2)} and ${fmtV(seen.b || 4)}: twice the resistance, twice the share. With two 1 kΩ?`,
              highlight: { lcd: "meter" }, predict: P2, waitFor: { predict: true } },
            { id: "swap", say: "Check it: swap the 2 kΩ for the 1 kΩ from the tray, and measure across it.",
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
            { id: "p2", reply: "p1", say: "6 V across both: side by side, called parallel, each has the whole voltage across it. So the 1 kΩ draws 6 mA. And the 2 kΩ?",
              predict: P2, waitFor: { predict: true } },
            Object.assign(FINISH("6 V ÷ 2 kΩ = 3 mA. In parallel, every branch has the full voltage across it and draws its own current."), { reply: "p2" }),
          ],
          goals: [{ text: "Measure across both resistors", when: (S, m) => {
            if (acrossQ(S, part(S, "r1")) && Math.abs(volts(S)) > 5.5) m.a = true;
            if (acrossQ(S, part(S, "r2")) && Math.abs(volts(S)) > 5.5) m.b = true;
            return m.a && m.b;
          } }],
          challenge: { text: "Then measure the 2 kΩ branch's current: 3 mA", when: (S) => { const q = part(S, "r2"); return !!q && S.readsCurrentOf(q, 0.0027, 0.0033); } },
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
            { id: "p1", say: "The meter sits in the main line, the path all the current takes, so it counts everything: 6 mA for one 1 kΩ branch. Add a 2 kΩ?",
              highlight: { lcd: "meter" }, predict: P1, waitFor: { predict: true } },
            { id: "add", say: "Find out: put the 2 kΩ side by side with the other resistor, from the + rail to the − rail.",
              hints: [{ say: "One leg on the red + rail, the other on the blue − rail, like the resistor already there." }, { show: [V.RES("h", "+T14", "-T16", 2000)] }],
              waitFor: { when: (S) => { if (nine(S)) seen.i = reads(S); return nine(S); } } },
            { id: "p2", reply: "p1", say: () => `${fmtI(seen.i || 0.009)}: 6 + 3. The branches add up. A third branch, another 1 kΩ?`, predict: P2, waitFor: { predict: true } },
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
          rules: { tray: [{ type: "led", color: "blue", n: 1 }, { type: "resistor", value: 270, n: 1 }, { type: "wire", n: 1 }], banner: true },
          ui: { strips: true },
          beats: [
            { id: "p", say: "Put a blue LED side by side with the red one, in the same two strips, sharing the resistor. Which one will light?",
              highlight: { part: "led1" }, predict: P, waitFor: { predict: true } },
            { id: "share", say: "Find out: plug the blue LED into the same two strips as the red one, longer leg on the + side.",
              hints: [{ say: "Into d6 and d7, say: the same strips as the red LED, which is in c6 and c7." }, { show: [V.LED("h", "d6", "d7", "blue")] }],
              waitFor: { when: shared, hold: 0.6 } },
            { id: "fix", reply: "p", say: "Side by side they have the same voltage, about 2 V: too little for blue. Give blue its own resistor and strips.",
              hints: [{ say: "Move the blue LED to free strips. Then 270 Ω from the + rail to its + leg, and a wire from its − leg to the − rail." },
                { show: [V.RES("h1", "+T12", "a12", 270), V.LED("h2", "c12", "c13", "blue"), V.WIRE("h3", "e13", "-T13")] }],
              waitFor: { when: both, hold: 0.6 } },
            FINISH("Each LED gets its own resistor. Side by side on one, the LED that needs the least voltage draws almost all the current."),
          ],
          goals: [{ text: "Both LEDs lit, each with its own resistor", when: both, hold: 0.6 }],
          challenge: { text: "Both LEDs within 3 mA of each other", when: (S) => { const ls = S.parts("led").filter((q) => lit(q, 0.005)); return both(S) && ls.length === 2 && Math.abs(ls[0].rd.I - ls[1].rd.I) <= 0.003; } },
          solution: [{ choose: "right" }, { place: { type: "led", color: "blue" }, at: V.hs("d6", "d7") }, { wait: 1 }, { move: "led", to: V.hs("c12", "c13") },
            { place: { type: "resistor", value: 270 }, at: V.hs("+T12", "a12") }, { wire: V.hs("e13", "-T13") }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "5-6", title: "Christmas lights", teaches: [], uses: ["seriesR", "seriesShare", "ledCurrent", "ledDrop", "resistor", "polarity", "loop", "strip", "rail"], shifts: [0],
      card: { name: "Series and parallel", text: "In a row, parts share one current and share out the voltage. Side by side, each has the whole voltage across it and the currents add up." },
      layouts: [{}],
      make: (V) => {
        const W = V.pick([{ lo: 8, hi: 11, aim: 10, r: 220 }, { lo: 4, hi: 7, aim: 5, r: 390 }, { lo: 12, hi: 16, aim: 14, r: 150 }]);     // the current window, and an answer
        // two LEDs in the window, in a row (each carries the battery's whole current), and one resistor carrying it
        const two = (S) => {
          const ls = S.parts("led").filter((q) => q.ok && q.rd.I >= W.lo / 1000 && q.rd.I <= W.hi / 1000), b = S.battery(), ib = Math.abs((b && b.rd.I) || 0);
          return ls.length === 2 && ls.every((q) => Math.abs(q.rd.I - ib) <= 0.03 * ib) && S.parts("resistor").filter((q) => q.ok && Math.abs(q.rd.I || 0) > 1e-5).length === 1;
        };
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), METER("mA", "mA")),
          rules: { tray: [{ type: "led", color: "red", n: 2 }, { type: "resistor", value: 100, n: 1 }, { type: "resistor", value: 150, n: 1 }, { type: "resistor", value: 220, n: 1 }, { type: "resistor", value: 390, n: 1 }, { type: "resistor", value: 470, n: 1 },
            { type: "wire", n: 2 }], allow: allow({ replace: ["meter"] }), banner: true },
          ui: { strips: true },
          beats: [
            { id: "brief", say: V.say(`Christmas lights: two red LEDs in a row, with one resistor, each at ${W.lo} to ${W.hi} mA.`,
              `Two red LEDs one after the other, one resistor for both, and ${W.lo} to ${W.hi} mA through them.`), waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Build it. Ask for a hint if you get stuck.",
              hints: [{ say: "In a row, the two LEDs need 2 V each: 4 V. What is left for the resistor?" }, { say: `That leaves 6 − 4 = 2 V. Which size lets about ${W.aim} mA through: 2 V ÷ ${W.aim} mA = …?` },
                { show: [V.RES("h1", "+T6", "a6", W.r), V.LED("h2", "c6", "c7", "red"), V.LED("h3", "d7", "d8", "red"), V.WIRE("h4", "e8", "-T8")] }],
              waitFor: { when: two, hold: 0.8 } },
            FINISH("LEDs in a row add up their voltages, so less is left for the resistor. Chapter 5 done!"),
          ],
          goals: [{ text: `Two red LEDs in a row, each ${W.lo} to ${W.hi} mA, one resistor`, when: two, hold: 0.8 }],
          react: [{ when: (S) => {
            const ls = S.parts("led").filter((q) => q.ok && q.rd.I > 0.002);
            if (ls.length !== 2 || two(S)) return null;
            if (ls.every((q) => q.rd.I >= W.lo / 1000 && q.rd.I <= W.hi / 1000)) return "Both lit, but side by side. Here they go in a row: the current goes through one, then the other.";
            return `Both lit, but at ${fmtI(ls[0].rd.I)}. You need ${W.lo} to ${W.hi} mA: the meter can check it.`;
          } }],
          challenge: { text: "Use only one wire", when: (S) => two(S) && S.parts("wire").length <= 1 },
          solution: [{ next: 1 }, { place: { type: "resistor", value: W.r }, at: ["+T6", "a6"] }, { place: { type: "led", color: "red" }, at: ["c6", "c7"] },
            { place: { type: "led", color: "red" }, at: ["d7", "d8"] }, { wire: ["e8", "-T8"] }, { wait: 1.2 }, { next: 1 }],
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
      "Side by side, does each part get the whole voltage?"
    ],
    "words": [
      {
        "w": "Series (in a row)",
        "d": "One part after another: the same current goes through each of them.",
        "sym": "resistor"
      },
      {
        "w": "Parallel (side by side)",
        "d": "Each part from the same + to the same −: each one has the whole voltage across it.",
        "sym": "battery"
      },
      {
        "w": "Branch",
        "d": "One path of a parallel circuit. The battery supplies all the branches at once.",
        "sym": "switch"
      },
      {
        "w": "Main line",
        "d": "The path all the current takes before it splits into branches.",
        "sym": "A"
      }
    ]
  });
})(window.BB = window.BB || {});
