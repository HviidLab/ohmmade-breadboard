// Chapter 6: Dividers and the knob. Two resistors in a row make a middle point at part of the push; a potentiometer
// is a middle point you can move with a knob; a knob in an LED's loop makes a dimmer, which needs a fixed resistor too.
// Then a challenge: make exactly 2 V, with resistors or with the knob.
// Same rules as before: a question in every level, predict first, the goal and not the holes, hints only on request.
// Data only, built with the kit from ch1.js and the meter helpers from ch2.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, safe, part, FINISH } = K;
  const { M, net, on, volts, fmtV, RING, METER, allow, REGION, NEXT } = K.meter;

  const vAt = (S, n) => (on(S, n, "bb:-T") && volts(S) !== null ? Math.abs(volts(S)) : null);   // a strip's push, against the − rail
  const between = (x, lo, hi) => x !== null && x >= lo && x <= hi;
  const POT = (V, pos = 0.5) => ({ id: "pot", type: "pot", legs: V.hs("c12", "c13", "c14"), pos });

  const L = [
    {
      id: "6-1", title: "The middle point", teaches: ["divider"], uses: ["seriesShare", "seriesR", "volts", "across", "resistor", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["3 V", "6 V", "0 V"], 0), P2 = V.predict(["Rise above 3 V", "Drop below 3 V", "Stay at 3 V"], 0), seen = {};
        const mid = V.n("bb:L6");
        const m1 = (S) => between(vAt(S, mid), 2.8, 3.2);
        const m2 = (S) => !part(S, "r2") && S.parts("resistor").some((q) => q.part.value === 22000) && between(vAt(S, mid), 3.9, 4.3);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T6", "a6", 10000), V.RES("r2", "c6", "c10", 10000), V.WIRE("w1", "e10", "-T10"), METER("V")),
          rules: { tray: [{ type: "resistor", value: 22000, n: 1 }], allow: allow({ remove: ["r2"], dial: ["V"], socket: ["VO"] }) },
          ui: { xray: true },
          goalsFrom: 3,
          beats: [
            { id: "p1", say: "Two 10 kΩ resistors in a row, from + to −. What push sits at the middle point between them, against the − rail?",
              highlight: { nets: [mid] }, predict: P1, waitFor: { predict: true } },
            { id: "m1", say: "Find out: measure the middle strip against the − rail.", hints: [RING(V.hs("d6", "-T12"))],
              waitFor: { when: (S) => { if (m1(S)) seen.v = vAt(S, mid); return m1(S); } } },
            { id: "p2", say: (C) => `${C.right("p1") ? "Right: " : ""}${fmtV(seen.v || 3)}, halfway. If the lower resistor is bigger, 22 kΩ, the middle point will…`,
              predict: P2, waitFor: { predict: true } },
            { id: "m2", say: "Find out: swap the lower resistor for the 22 kΩ, and measure the middle again.",
              hints: [{ say: "Click the lower resistor and press Remove, then drag the 22 kΩ into the same two holes." }, RING(V.hs("d6", "-T12"))], waitFor: { when: m2 } },
            FINISH((C) => `${C.right("p2") ? "Right: " : ""}6 V × 22 ÷ (10 + 22) ≈ 4.1 V. Two resistors make a middle point at part of the push.`),
          ],
          goals: [{ text: "Measure the middle point with 22 kΩ below", when: m2 }],
          bonus: [
            { text: "Predict the middle point", final: (C) => C.right("p1") },
            { text: "Predict which way it moves", final: (C) => C.right("p2") },
          ],
          solution: [{ choose: "right" }, { probe: V.hs("d6", "-T12") }, { wait: 0.5 }, { choose: "right" }, { remove: "r2" }, { place: { type: "resistor", value: 22000 }, at: V.hs("c6", "c10") },
            { probe: V.hs("d6", "-T12") }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "6-2", title: "The knob", teaches: ["potKnob"], uses: ["divider", "volts", "resistor", "strip", "rail"], shifts: [0, 4],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["From 0 V to 6 V", "From 2 V to 4 V", "Only 3 V"], 0), seen = {};
        const w = V.n("bb:L13");
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), POT(V), V.WIRE("w1", "a12", "+T12"), V.WIRE("w2", "a14", "-T14"), METER("V")),
          rules: { tray: [], allow: allow({ ctl: ["meter", "pot"], dial: ["V"], socket: ["VO"] }) },
          ui: { xray: true },
          goalsFrom: 4,
          beats: [
            { id: "what", say: "This is a potentiometer, a knob with three legs. The outer legs go to + and −. The middle leg, the wiper, slides along between them.",
              highlight: { part: "pot" }, waitFor: NEXT },
            { id: "m", say: "Measure the wiper's push against the − rail.", hints: [RING(V.hs("e13", "-T16"), "The wiper is the middle leg. Try the rings.")],
              waitFor: { when: (S) => { const v = vAt(S, w); if (v !== null) seen.v = v; return v !== null; } } },
            { id: "p", say: () => `${fmtV(seen.v || 3)} with the knob in the middle. How far can turning the knob move the wiper's push?`, highlight: { lcd: "meter" }, predict: P, waitFor: { predict: true } },
            { id: "low", say: "Find out: drag the knob up or down until the meter shows less than 1 V.", highlight: { ctl: "knob", id: "pot" },
              hints: [{ say: "Press on the white knob and drag the mouse up or down, keeping the probes on the wiper and the − rail." }], waitFor: { when: (S) => between(vAt(S, w), 0, 0.99) } },
            { id: "high", say: (C) => `${C.right("p") ? "Right so far. " : ""}Now turn it the other way, until the meter shows more than 5 V.`, highlight: { ctl: "knob", id: "pot" },
              waitFor: { when: (S) => between(vAt(S, w), 5.01, 6.1) } },
            FINISH("A potentiometer is a middle point you can move: any push from 0 V to the full 6 V."),
          ],
          goals: [{ text: "Turn the wiper above 5 V", when: (S) => between(vAt(S, w), 5.01, 6.1) }],
          bonus: [
            { text: "Predict how far the knob reaches", final: (C) => C.right("p") },
            { text: "Set the wiper back to 3 V (±0.1 V) before you finish", when: (S, m, C) => C.beat && C.beat.id === "end" && between(vAt(S, w), 2.9, 3.1) },
          ],
          solution: [{ next: 1 }, { probe: V.hs("e13", "-T16") }, { wait: 0.4 }, { choose: "right" }, { knob: "pot", pos: 0.9 }, { wait: 0.6 }, { knob: "pot", pos: 0.1 }, { wait: 0.6 },
            { knob: "pot", pos: 0.5 }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "6-3", title: "A dimmer", teaches: ["dimmer"], uses: ["potKnob", "ledCurrent", "ledMax", "seriesR", "resistor", "polarity", "loop", "strip", "rail"], shifts: [0, 4],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["To keep the LED safe when the knob is at 0", "To make the LED brighter", "No reason"], 0);
        const led = (S) => part(S, "led1");
        const swept = (S, m) => { const q = led(S); if (q && q.ok) { if (q.rd.I > 0.012) m.hi = true; if (q.rd.I < 0.001) m.lo = true; } return !!m.hi && !!m.lo; };
        const popped = (S) => S.parts("led").some((q) => !q.ok) || S.parts("pot").some((q) => !q.ok);
        const fixed = (S) => S.parts("resistor").some((q) => q.part.value === 220 && q.ok) && !!led(S) && safe(led(S)) && S.parts("pot").every((q) => q.ok);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T6", "a6", 220), V.LED("led1", "c6", "c7"), V.WIRE("w1", "e7", "e12"), POT(V, 0.5), V.WIRE("w2", "a13", "-T13")),
          rules: { tray: [{ type: "wire", n: 1 }], allow: allow({ ctl: ["pot"], remove: ["r1"] }), banner: true },
          allowDamage: true, simText: { led: null, pot: null },
          ui: { xray: true },
          beats: [
            { id: "turn", say: "This knob sits in the LED's loop. Turn it all the way both ways, and watch the LED.", highlight: { ctl: "knob", id: "pot" },
              hints: [{ say: "Press on the white knob and drag the mouse up or down." }], waitFor: { when: swept } },
            { id: "p", say: "Turned one way, the knob adds up to 10 kΩ: dim. The other way, almost nothing: bright. So why is the 220 Ω there too?",
              highlight: { part: "r1" }, predict: P, waitFor: { predict: true } },
            { id: "try", say: "Find out: take the 220 Ω out, bridge its gap with a wire, and turn the knob until the LED is at its brightest.",
              hints: [{ say: "Remove the resistor, draw a wire between its two holes, then drag the knob." }], waitFor: { when: popped, hold: 0.05 } },
            { id: "fix", say: (C) => `${C.right("p") ? "Right. " : ""}Pop! At 0 Ω nothing held the current back. Put the 220 Ω back instead of the wire, with a fresh LED.`,
              hints: [{ say: "Take the wire off, put the 220 Ω back in its holes, then click the burned part and press Fresh one." }], waitFor: { when: fixed, hold: 0.6 } },
            FINISH("A knob in the loop makes a dimmer. Keep a fixed resistor in the loop too, for when the knob is turned right down."),
          ],
          goals: [{ text: "The dimmer working again, safely", when: fixed, hold: 0.6 }],
          bonus: [
            { text: "Predict why the 220 Ω is there", final: (C) => C.right("p") },
            { text: "Break only one part", final: (C) => (C.count.destroyed || 0) <= 1 },
          ],
          solution: [{ knob: "pot", pos: 0 }, { wait: 0.4 }, { knob: "pot", pos: 1 }, { wait: 0.4 }, { choose: "right" }, { remove: "r1" }, { wire: V.hs("+T6", "a6") },
            { knob: "pot", pos: 0 }, { wait: 0.6 }, { remove: "wire" }, { place: { type: "resistor", value: 220 }, at: V.hs("+T6", "a6") }, { replace: "led1" }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "6-4", title: "Exactly 2 V", teaches: [], uses: ["divider", "potKnob", "seriesShare", "volts", "resistor", "strip", "rail"], shifts: [0],
      card: { name: "Dividers", text: "Two resistors, or a knob, make a middle point at any part of the push: 6 V × lower ÷ total." },
      layouts: [{}],
      make: (V) => {
        // a strip (not a rail) that the meter reads at 2 V against the − rail, and which part of the circuit
        const two = (S) => { const m = M(S); return !!m && !!m.red && !!m.com && BBShared.parse(m.red).kind === "strip" && between(vAt(S, net(m.red)), 1.85, 2.15); };
        const byKnob = (S) => two(S) && S.parts("pot").some((q) => q.nets[1] === net(M(S).red));
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), METER("V")),
          rules: { tray: [{ type: "resistor", value: 4700, n: 1 }, { type: "resistor", value: 10000, n: 1 }, { type: "resistor", value: 22000, n: 1 },
            { type: "pot", n: 1 }, { type: "wire", n: 3 }], allow: allow({}), banner: true },
          allowDamage: true,
          ui: { xray: true },
          beats: [
            { id: "brief", say: V.say("Make exactly 2 V on a strip (between 1.85 and 2.15 V against the − rail). Resistors or the knob: your choice.",
              "Your task: a strip at 2 V against the − rail. Use two resistors, or the knob, or both ways."), waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Build it, then measure your strip against the − rail. Ask for a hint if you need one.",
              hints: [{ say: "With two resistors: 6 V × lower ÷ total = 2 V, so the upper one must be twice the lower one." },
                { say: "22 kΩ above and 10 kΩ below come close: 6 × 10 ÷ 32 ≈ 1.9 V. Or wire the knob's ends to + and −, and turn it." }],
              waitFor: { when: two, hold: 0.6 } },
            FINISH("A middle point at any push you like: two resistors for a fixed one, a knob for one you can change."),
          ],
          goals: [{ text: "A strip at 2 V", when: two, hold: 0.6 }],
          bonus: [
            { text: "Do it both ways: resistors and the knob", when: (S, m) => { if (two(S)) { if (byKnob(S)) m.k = true; else m.r = true; } return !!m.k && !!m.r; } },
            { text: "Nothing breaks", final: (C) => C.broken.size === 0 },
          ],
          solution: [{ next: 1 },
            { place: { type: "resistor", value: 22000 }, at: ["+T6", "a6"] }, { place: { type: "resistor", value: 10000 }, at: ["c6", "c10"] }, { wire: ["e10", "-T10"] },
            { probe: ["d6", "-T12"] }, { wait: 1 },
            { place: { type: "pot" }, at: ["c16", "c17", "c18"] }, { wire: ["a16", "+T16"] }, { wire: ["a18", "-T18"] }, { knob: "pot", pos: 0.667 },
            { probe: ["e17", "-T20"] }, { wait: 1 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(6, "Dividers and the knob", L);
})(window.BB = window.BB || {});
