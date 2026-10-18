// Chapter 6: Dividers and the knob. Two resistors in a row make a middle point at part of the voltage; a potentiometer
// is a middle point you can move with a knob; a knob in an LED's loop makes a dimmer, which needs a fixed resistor too.
// Then you build a divider yourself (3 V from two equal resistors, and the same 3 V from two bigger ones), and a
// challenge: make 2 V, with resistors or with the knob.
// Same rules as before: a question in every level, predict first, the goal and not the holes, hints only on request.
// Data only, built with the kit from ch1.js and the meter helpers from ch2.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, safe, part, FINISH } = K;
  const { M, net, on, volts, fmtV, shownV, RING, METER, allow, REGION, NEXT } = K.meter;
  const { wires } = K;

  const vAt = (S, n) => (on(S, n, "bb:-T") && volts(S) !== null ? Math.abs(volts(S)) : null);   // a strip's voltage, against the − rail
  const between = (x, lo, hi) => x !== null && x >= lo && x <= hi;
  // the meter's red probe on a strip (not a rail), its black probe on the − rail, reading lo to hi volts
  const strip = (S, lo, hi) => { const m = M(S); return !!m && !!m.red && !!m.com && BBShared.parse(m.red).kind === "strip" && between(vAt(S, net(m.red)), lo, hi); };
  const POT = (V, pos = 0.5) => ({ id: "pot", type: "pot", legs: V.hs("c12", "c13", "c14"), pos });

  const L = [
    {
      id: "6-1", title: "The middle point", teaches: ["divider"], uses: ["seriesShare", "seriesR", "volts", "across", "resistor", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["3 V", "6 V", "0 V"], 0, [null, "the middle point is half way down the row: each resistor has half of the 6 V across it.", "only the − rail is at 0 V. The middle point is half way: 3 V."]);
        const P2 = V.predict(["Rise above 3 V", "Drop below 3 V", "Stay at 3 V"], 0, [null, "the meter shows the − side's share, and the bigger resistor has the bigger share: it rises.",
          "unequal resistors have unequal shares. The bigger one, on the − side, has more across it, so the middle rises."]), seen = {};
        const mid = V.n("bb:L6");
        const m1 = (S) => between(vAt(S, mid), 2.8, 3.2);
        const m2 = (S) => !part(S, "r2") && S.parts("resistor").some((q) => q.part.value === 22000) && between(vAt(S, mid), 3.9, 4.3);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T6", "a6", 10000), V.RES("r2", "c6", "c10", 10000), V.WIRE("w1", "e10", "-T10"), METER("V")),
          rules: { tray: [{ type: "resistor", value: 22000, n: 1 }], allow: allow({ remove: ["r2", "r1"], dial: ["V"], socket: ["VO"] }) },
          ui: { strips: true },
          goalsFrom: 4,
          beats: [
            { id: "what", say: "Two 10 kΩ resistors in a row, from + to −. The strip where they meet, marked here, is called the middle point.", highlight: { nets: [mid] }, waitFor: NEXT },
            { id: "p1", say: "What voltage is at the middle point, measured against the − rail (0 V)?",
              highlight: { nets: [mid] }, predict: P1, waitFor: { predict: true } },
            { id: "m1", say: "Find out: measure the middle strip against the − rail.", hints: [RING(V.hs("d6", "-T12"))],
              waitFor: { when: (S) => { if (m1(S)) seen.v = vAt(S, mid); return m1(S); } } },
            { id: "p2", reply: "p1", say: () => `${shownV(seen.v ?? 3)}: one current, equal resistors, equal shares. The meter shows the share across the − side resistor. Make it 22 kΩ: the middle will…`,
              highlight: { part: "r2" },
              predict: P2, waitFor: { predict: true } },
            { id: "m2", say: "Find out: swap the resistor on the − side for the 22 kΩ, and measure the middle again.",
              hints: [{ say: "Click the resistor on the − side and press Remove, then drag the 22 kΩ into the same two holes." }, RING(V.hs("d6", "-T12"))], waitFor: { when: m2 } },
            Object.assign(FINISH("6 V × 22 ÷ (10 + 22) ≈ 4.1 V: the − side's share. Two resistors like this are called a voltage divider."), { reply: "p2" }),
          ],
          goals: [{ text: "Measure the middle point with 22 kΩ on the − side", when: m2 }],
          challenge: { text: "Then swap sides: 22 kΩ on the + side, the middle point below 2 V", when: (S) => S.parts("resistor").some((q) => q.part.value === 22000 && q.nets.some((n) => S.same(n, "bb:+T"))) && between(vAt(S, mid), 1.6, 1.99) },
          solution: [{ next: 1 }, { choose: "right" }, { probe: V.hs("d6", "-T12") }, { wait: 0.5 }, { choose: "right" }, { remove: "r2" }, { place: { type: "resistor", value: 22000 }, at: V.hs("c6", "c10") },
            { probe: V.hs("d6", "-T12") }, { wait: 0.6 }, { remove: "r1" }, { remove: "resistor" }, { place: { type: "resistor", value: 22000 }, at: V.hs("+T6", "a6") },
            { place: { type: "resistor", value: 10000 }, at: V.hs("c6", "c10") }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "6-2", title: "The knob", teaches: ["potKnob"], uses: ["divider", "volts", "resistor", "strip", "rail"], shifts: [0, 4],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["From 0 V to 6 V", "From 2 V to 4 V", "Only 3 V"], 0, [null, "the wiper slides all the way, from the − end to the + end: 0 V to 6 V.",
          "turning the knob moves the wiper, and its voltage follows: anywhere from 0 V to 6 V."]), seen = {};
        const w = V.n("bb:L13");
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), POT(V), V.WIRE("w1", "a12", "+T12"), V.WIRE("w2", "a14", "-T14"), METER("V")),
          rules: { tray: [], allow: allow({ ctl: ["meter", "pot"], dial: ["V"], socket: ["VO"] }) },
          ui: { strips: true },
          goalsFrom: 4,
          beats: [
            { id: "what", say: "This is a potentiometer, a knob with three legs. The outer legs go to + and −. The middle leg goes to the wiper, which slides along a track.",
              highlight: { part: "pot" }, waitFor: NEXT },
            { id: "m", say: "Measure the wiper's voltage against the − rail.", hints: [RING(V.hs("e13", "-T16"), "The wiper's leg is the middle one. Try the rings.")],
              waitFor: { when: (S) => { const v = vAt(S, w); const kn = part(S, "pot"); if (v !== null) { seen.v = v; seen.pos = kn ? kn.part.pos ?? 0.5 : 0.5; } return v !== null; } } },
            { id: "p", say: () => `${shownV(seen.v ?? 3)} with the knob ${Math.abs((seen.pos ?? 0.5) - 0.5) < 0.03 ? "in the middle" : "where it is"}. How far can turning the knob move the wiper's voltage?`, highlight: { lcd: "meter" }, predict: P, waitFor: { predict: true } },
            { id: "low", say: "Find out: drag the knob up or down until the meter shows less than 1 V.", highlight: { ctl: "knob", id: "pot" },
              hints: [{ say: "Press on the white knob and drag the mouse up or down, keeping the probes on the wiper and the − rail." }], waitFor: { when: (S) => between(vAt(S, w), 0, 0.99) } },
            { id: "high", reply: "p", say: "Now turn it the other way, until the meter shows more than 5 V.", highlight: { ctl: "knob", id: "pot" },
              waitFor: { when: (S) => between(vAt(S, w), 5.01, 6.1) } },
            FINISH("A potentiometer is a middle point you can move: any voltage from 0 V to the full 6 V."),
          ],
          goals: [{ text: "Turn the wiper above 5 V", when: (S) => between(vAt(S, w), 5.01, 6.1) }],
          challenge: { text: "Set the wiper back to 3 V (±0.1 V) before you finish", when: (S, m, C) => C.beat && C.beat.id === "end" && between(vAt(S, w), 2.9, 3.1) },
          solution: [{ next: 1 }, { probe: V.hs("e13", "-T16") }, { wait: 0.4 }, { choose: "right" }, { knob: "pot", pos: 0.9 }, { wait: 0.6 }, { knob: "pot", pos: 0.1 }, { wait: 0.6 },
            { knob: "pot", pos: 0.5 }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "6-3", title: "A dimmer", teaches: ["dimmer"], uses: ["potKnob", "ledCurrent", "ledMax", "seriesR", "resistor", "polarity", "loop", "strip", "rail"], shifts: [0, 4],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["To keep the LED safe when the knob is at 0", "To make the LED brighter", "No reason"], 0, [null,
          "a resistor only holds current back: it makes the LED dimmer, not brighter.", "at one end the knob is almost 0 Ω. Then only the 220 Ω holds the current down."]);
        const led = (S) => part(S, "led1");
        const swept = (S, m) => { const q = led(S); if (q && q.ok) { if (q.rd.I > 0.012) m.hi = true; if (q.rd.I < 0.001) m.lo = true; } return !!m.hi && !!m.lo; };
        // what burned at almost 0 Ω: the LED, the knob (its thin track and sliding contact are made for small currents), or both
        const burned = {};
        const popped = (S) => { burned.led = S.parts("led").some((q) => !q.ok); burned.pot = S.parts("pot").some((q) => !q.ok); return burned.led || burned.pot; };
        const fixed = (S) => S.parts("resistor").some((q) => q.part.value === 220 && q.ok) && !!led(S) && safe(led(S)) && S.parts("pot").every((q) => q.ok);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T6", "a6", 220), V.LED("led1", "c6", "c7"), V.WIRE("w1", "e7", "e12"), POT(V, 0.5), V.WIRE("w2", "a13", "-T13")),
          rules: { tray: [{ type: "wire", n: 1 }], allow: allow({ ctl: ["pot"], remove: ["r1"] }), banner: true },
          demo: { led: 1, pot: 1 }, simText: { led: null, pot: null },
          ui: { strips: true },
          beats: [
            { id: "turn", say: "Here the knob is a resistor you turn, 0 to 10 kΩ. Turn it all the way one way, then all the way the other. Watch the LED.", highlight: { ctl: "knob", id: "pot" },
              hints: [{ say: "Press on the white knob and drag the mouse up or down." }], waitFor: { when: swept } },
            { id: "p", say: "Turned one way, the knob adds up to 10 kΩ: dim. The other way, almost nothing: bright. So why is the 220 Ω there too?",
              highlight: { part: "r1" }, predict: P, waitFor: { predict: true } },
            { id: "try", say: "Find out: take the 220 Ω out, bridge its gap with a wire, and turn the knob until the LED is at its brightest.",
              hints: [{ say: "Remove the resistor, draw a wire between its two holes, then drag the knob." }], waitFor: { when: popped, hold: 0.05 } },
            { id: "fix", reply: "p", say: () => (burned.pot && burned.led ? "Pop! At almost 0 Ω, almost nothing held the current back: the LED and the knob both burned. Wire out, 220 Ω back, then click each: Fresh one."
              : burned.pot ? "Pop! At almost 0 Ω, so much current crowded through the knob's thin track that it burned. Wire out, 220 Ω back, then click the knob: Fresh one."
              : "Pop! Almost nothing held the current back. Take the wire out, put the 220 Ω back, then click the LED: Fresh one."),
              hints: [{ say: "Take the wire off, put the 220 Ω back in its holes, then click the burned part and press Fresh one." }], waitFor: { when: fixed, hold: 0.6 } },
            FINISH("A knob in the loop makes a dimmer. Keep a fixed resistor in the loop too, for when the knob is at almost 0 Ω."),
          ],
          goals: [{ text: "The dimmer working again, safely", when: fixed, hold: 0.6 }],
          challenge: { text: "Finish without a hint", final: (C) => C.hintsUsed === 0 },
          solution: [{ knob: "pot", pos: 0 }, { wait: 0.4 }, { knob: "pot", pos: 1 }, { wait: 0.4 }, { choose: "right" }, { remove: "r1" }, { wire: V.hs("+T6", "a6") },
            { knob: "pot", pos: 0 }, { wait: 0.6 }, { remove: "wire" }, { place: { type: "resistor", value: 220 }, at: V.hs("+T6", "a6") }, { replace: "led1" }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "6-4", title: "Your own divider", teaches: [], uses: ["divider", "seriesShare", "volts", "resistor", "strip", "rail"], shifts: [0],
      card: { name: "Your own divider", text: "Two resistors in a row from + to −. Equal ones, of any size, put the middle point at half: what counts is how they compare." },
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Stay at 3 V", "Rise", "Drop"], 0, [null, "both grow by the same amount, so their shares stay equal: half of the 6 V each.",
          "the shares depend on how the two resistors compare, and both grew alike: still half each."]), seen = {};
        const half = (S) => { const ok = strip(S, 2.85, 3.15); if (ok) seen.v = vAt(S, net(M(S).red)); return ok; };
        const rs = (S) => S.parts("resistor").filter((q) => q.legs.every(Boolean));
        const big = (S) => rs(S).length === 2 && rs(S).every((q) => q.part.value === 22000) && half(S);
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), METER("V")),
          rules: { tray: [{ type: "resistor", value: 10000, n: 2 }, { type: "resistor", value: 22000, n: 2 }, { type: "wire", n: 2 }], allow: allow({}), banner: true },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "brief", say: V.say("Your turn: build a middle point at 3 V from the two 10 kΩ resistors, in a row from the + rail to the − rail.",
              "Now you build one: a middle point at 3 V, from two 10 kΩ resistors in a row between the + rail and the − rail."), waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Build it: + rail, 10 kΩ, a strip, 10 kΩ, − rail. Then measure that strip, the middle point, against the − rail.",
              hints: [{ say: "Drop one 10 kΩ from the + rail into a strip. Then the other from that same strip to the − rail." },
                { show: [V.RES("h1", "+T6", "a6", 10000), V.RES("h2", "c6", "-T9", 10000)] }, RING(["d6", "-T12"])],
              waitFor: { when: half, hold: 0.6 } },
            { id: "p", say: () => `${shownV(seen.v ?? 3)}: equal resistors, equal shares. Swap both for the 22 kΩ ones, over twice as big. The middle point will…`,
              predict: P, waitFor: { predict: true } },
            { id: "swap", say: "Find out: swap both 10 kΩ for the 22 kΩ ones, and measure the middle point again.",
              hints: [{ say: "Click a resistor and press Remove, then drag a 22 kΩ into its two holes. Then the same with the other one." }], waitFor: { when: big, hold: 0.6 } },
            Object.assign(FINISH("Still 3 V. The middle point is set by how the two resistors compare, not by how big they are. Next: any voltage you like."), { reply: "p" }),
          ],
          goals: [{ text: "A middle point at 3 V", when: half }, { text: "3 V again, from two 22 kΩ", when: big, hold: 0.6 }],
          challenge: { text: "Use no wires: a resistor's legs reach the rails", when: (S) => big(S) && wires(S).length === 0 },
          solution: [{ next: 1 }, { place: { type: "resistor", value: 10000 }, at: ["+T6", "a6"] }, { place: { type: "resistor", value: 10000 }, at: ["c6", "-T9"] },
            { probe: ["d6", "-T12"] }, { wait: 1 }, { choose: "right" }, { remove: "resistor" }, { remove: "resistor" },
            { place: { type: "resistor", value: 22000 }, at: ["+T6", "a6"] }, { place: { type: "resistor", value: 22000 }, at: ["c6", "-T9"] }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "6-5", title: "Make 2 V", teaches: [], uses: ["divider", "potKnob", "seriesShare", "volts", "resistor", "strip", "rail"], shifts: [0],
      card: { name: "Dividers", text: "Two resistors, or a knob, make a middle point at any part of the battery's voltage: 6 V × the − side resistor ÷ both together. Draw current from the middle and it drops." },
      layouts: [{}],
      make: (V) => {
        // a strip (not a rail) that the meter reads at 2 V against the − rail, and which part of the circuit
        // the target voltage, and the resistor pair that makes it (+ side, − side)
        const T = V.pick([{ v: 2, up: 22000, lo: 10000 }, { v: 4, up: 10000, lo: 22000 }, { v: 1.5, up: 22000, lo: 6800 }]);
        const k = (r) => `${r / 1000} kΩ`;
        const two = (S) => strip(S, T.v - 0.15, T.v + 0.15);
        const byKnob = (S) => two(S) && S.parts("pot").some((q) => S.same(q.nets[1], net(M(S).red)));      // the probe on the wiper's node
        return {
          title: `Make ${T.v} V`,
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), METER("V")),
          rules: { tray: [{ type: "resistor", value: 4700, n: 1 }, { type: "resistor", value: 10000, n: 1 }, { type: "resistor", value: 22000, n: 1 }, { type: "resistor", value: 6800, n: 1 },
            { type: "pot", n: 1 }, { type: "wire", n: 3 }], allow: allow({}), banner: true },
          ui: { strips: true },
          beats: [
            { id: "brief", say: V.say(`Make ${T.v} V on a strip (within 0.15 V, against the − rail). Resistors or the knob: your choice.`,
              `Your task: a strip at ${T.v} V against the − rail. Use two resistors, or the knob, or both ways.`), waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Build it, then measure your strip against the − rail. Ask for a hint if you need one.",
              hints: [{ say: `With two resistors, the − side's share is ${T.v} V and the + side's ${6 - T.v} V. Their sizes go in the same ratio.` },
                { say: `Which pair in the tray is close to ${6 - T.v} : ${T.v}? Or wire the knob's ends to + and −, and turn it.` },
                { say: `${k(T.up)} on the + side, ${k(T.lo)} on the − side: 6 × ${T.lo / 1000} ÷ ${(T.up + T.lo) / 1000} ≈ ${(6 * T.lo / (T.up + T.lo)).toFixed(1)} V.` }],
              waitFor: { when: two, hold: 0.6 } },
            FINISH("A middle point at any voltage you like: two resistors for a fixed one, a knob for one you can change."),
          ],
          goals: [{ text: `A strip at ${T.v} V`, when: two, hold: 0.6 }],
          challenge: { text: "Do it both ways: resistors and the knob", when: (S, m) => { if (two(S)) { if (byKnob(S)) m.k = true; else m.r = true; } return !!m.k && !!m.r; } },
          solution: [{ next: 1 },
            { place: { type: "resistor", value: T.up }, at: ["+T6", "a6"] }, { place: { type: "resistor", value: T.lo }, at: ["c6", "-T9"] },
            { probe: ["d6", "-T12"] }, { wait: 1 },
            { place: { type: "pot" }, at: ["c16", "c17", "c18"] }, { wire: ["a16", "+T16"] }, { wire: ["a18", "-T18"] }, { knob: "pot", pos: 1 - T.v / 6 },
            { probe: ["e17", "-T20"] }, { wait: 1 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(6, "Dividers and the knob", L, {
    "lede": "Two resistors can split the battery's voltage into any part you like. A knob does the same, and you can turn it.",
    "cover": "divider",
    "questions": [
      "What voltage sits between two equal resistors?",
      "How does a knob give any voltage from 0 to 6 V?",
      "Why does a dimmer need a fixed resistor too?"
    ],
    "words": [
      {
        "w": "Voltage divider",
        "d": "Two resistors in series. The point between them sits at part of the battery's voltage.",
        "sym": "resistor"
      },
      {
        "w": "Middle point",
        "d": "The strip between the two resistors, measured against the − rail.",
        "sym": "V"
      },
      {
        "w": "Potentiometer (knob)",
        "d": "A resistor with a wiper that slides along its track when you turn the knob. It is marked with its full resistance, such as 10K.",
        "sym": "pot"
      },
      {
        "w": "Wiper",
        "d": "The contact inside the knob, joined to its middle leg. It slides along the track from one end to the other.",
        "sym": "pot"
      },
      {
        "w": "Dimmer",
        "d": "A knob in an LED's loop: turn it to change the brightness.",
        "sym": "led"
      }
    ]
  });
})(window.BB = window.BB || {});
