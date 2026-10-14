// Chapter 2: Measuring. Every level asks a question about the circuit that you cannot answer by looking, and the
// multimeter finds the answer: why one LED is dimmer (volts, the push), where the push goes (shares add up), how much
// current flows, whether the LED uses it up (no), the fuse, bigger resistor less current, ohms, breaks, the beep.
// Sparky states what to find out, not where the probes go: the red and black rings come only as a hint.
// Data only, built with the kit from ch1.js (variants, helpers); see the design document (design/game-design.md).
// The meter stands to the right of the board (placed by the kit); `probe` steps in a solution put both tips at once.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, safe, part, anyLit, onOff, FINISH } = K;

  // ---------- meter checks (S is the goals query object) ----------
  const net = (h) => BB.netKey(h);
  const M = (S) => S.meter;
  const mode = (S, m) => !!M(S) && M(S).mode === m;
  const probes = (S) => (M(S) && M(S).red && M(S).com ? [net(M(S).red), net(M(S).com)] : null);
  // the probes sit on these two nets, in either order
  const on = (S, a, b) => { const p = probes(S); return !!p && ((p[0] === a && p[1] === b) || (p[0] === b && p[1] === a)); };
  // a volts reading (null when the meter is not showing volts)
  const volts = (S) => (mode(S, "V") && M(S).socket === "VO" && !M(S).display && probes(S) ? M(S).value : null);
  const ohms = (S) => (mode(S, "ohm") && M(S).socket === "VO" && !M(S).display && probes(S) ? M(S).value : null);
  const amps = (S, q) => !!q && S.readsCurrentOf(q, 0.0005, 0.05);
  const across = (S, id) => S.across(part(S, id)) && volts(S) !== null;
  const fmtV = (v) => `${Math.abs(v) < 0.05 ? "0" : Math.abs(v).toFixed(1)} V`;
  const fmtR = (r) => (r >= 1000 ? `${+(r / 1000).toFixed(1)} kΩ` : `${Math.round(r)} Ω`);
  const fmtmA = (a) => `${Math.round(Math.abs(a) * 1000)} mA`;
  const NEXT = { next: true };
  // the first hint of a measuring step: rings on the two holes, red probe and black probe
  const RING = (holes, say = "Try here: the red probe in the red ring, the black probe in the black ring.") => ({ say, highlight: { probes: holes } });

  const METER = (m = "V", socket = "VO", legs = [null, null]) => ({ id: "meter", type: "meter", mode: m, socket, legs });
  const BASE = { probe: ["meter"], ctl: ["meter"] };
  const allow = (more) => Object.assign({}, BASE, more);
  const REGION = (V) => ({ rows: V.rows([1, 20]), cols: "a-j", rails: "top" });

  const L = [
    {
      id: "2-1", title: "Two batteries", teaches: ["volts"], uses: ["loop", "strip", "rail", "gap", "resistor", "polarity"], shifts: [0, 4, 8],
      colors: ["red", "yellow", "green"],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Its LED is weaker", "Its battery pushes less", "Its wires are longer"], 1), seen = {};
        const top = (S) => on(S, "bb:+T", "bb:-T") && Math.abs(volts(S) || 0) > 5.5;
        const bottom = (S) => on(S, "bb:+B", "bb:-B") && Math.abs(volts(S) || 0) > 2.5 && Math.abs(volts(S)) < 3.5;
        const bright = (S) => lit(part(S, "led2"), 0.009);
        return {
          region: Object.assign(REGION(V), { rails: "all" }),
          start: start(V.BAT("+T3", "-T4"), Object.assign(V.BAT("+B3", "-B4"), { id: "bat2", cells: 2 }),
            V.RES("res1", "+T6", "a6", 330), V.LED("led1", "c6", "c7"), V.WIRE("w1", "e7", "-T7"),
            V.WIRE("wa", "+B5", "j5"), V.RES("res2", "g5", "g8", 330), V.LED("led2", "h8", "h9"), V.WIRE("wb", "f9", "-B9"), METER("off")),
          rules: { tray: [], allow: allow({ dial: ["off", "V"], socket: ["VO"], legs: ["wa", "wb"], move: ["wa", "wb"] }), guardMeter: true },
          ui: { xray: true },
          beats: [
            { id: "q", say: "Two circuits with the same parts. So why is the bottom LED dimmer than the top one?", highlight: { parts: ["led1", "led2"] },
              predict: P, waitFor: { predict: true } },
            { id: "dial", say: "Let's measure. Turn the meter's dial to V, for volts. Volts measure how hard a battery pushes.",
              hints: [{ say: "Click the V⎓ mark next to the meter's dial.", highlight: { ctl: "mode:V", id: "meter" } }], waitFor: { when: (S) => mode(S, "V") } },
            { id: "top", say: "Measure the top battery's push: one probe on its + rail, the other on its − rail.",
              hints: [RING(V.hs("+T10", "-T10"), "The top battery feeds the two rails along the top edge. Try the rings.")],
              waitFor: { when: (S) => { if (top(S)) seen.top = volts(S); return top(S); } } },
            { id: "bottom", say: () => `${fmtV(seen.top || 6)} at the top. Now measure the bottom battery the same way, on the bottom rails.`,
              hints: [RING(V.hs("+B10", "-B10"))], waitFor: { when: (S) => { if (bottom(S)) seen.bottom = volts(S); return bottom(S); } } },
            { id: "fix", say: (C) => `${C.right("q") ? "Right: " : ""}${fmtV(seen.bottom || 3)} at the bottom, half the push, so less current. Make the bottom LED bright.`,
              hints: [{ say: "The bottom LED gets its push through these two wires, from the 3 V pack. Which battery should they reach?", highlight: { parts: ["wa", "wb"] } },
                { say: "Move both wires' rail ends to the top rails: + end to the + rail, − end to the − rail. One battery, one loop." },
                { show: [V.WIRE("h1", "+T14", "j5"), V.WIRE("h2", "f9", "-T14")] }],
              waitFor: { when: bright } },
            FINISH("Volts are the push. More push drives more current round the loop, and the LED glows brighter."),
          ],
          goals: [{ text: "Make the bottom LED as bright as the top one", when: bright, hold: 0.6 }],
          bonus: [
            { text: "Guess why it is dimmer", final: (C) => C.right("q") },
            { text: "Do it by moving just two wire ends", final: (C) => (C.count.move || 0) <= 2 && !C.count.place },
          ],
          solution: [{ choose: "right" }, { dial: "V" }, { probe: V.hs("+T10", "-T10") }, { probe: V.hs("+B10", "-B10") }, { wait: 0.6 },
            { move: "wa", to: V.hs("+T14", "j5") }, { move: "wb", to: V.hs("f9", "-T14") }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-2", title: "Where does the push go?", teaches: ["across"], uses: ["volts", "loop", "strip", "rail", "resistor", "polarity"], shifts: [0, 4, 8],
      colors: ["red", "yellow", "green"], values: [330, 470],
      // the resistor first or the LED first; where the probes go (red on the + side)
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.WIRE("wire1", "e7", "-T7")], res: ["+T8", "b6"], led: ["d6", "d7"], wire: ["b7", "-T9"] },
        { parts: (V) => [V.WIRE("wire1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.RES("res1", "e7", "-T7")], res: ["b7", "-T9"], led: ["d6", "d7"], wire: ["+T8", "b6"] },
      ],
      make: (V) => {
        const P1 = V.predict(["The resistor", "The LED", "The wire"], 0), P2 = V.predict(["About 3 V", "About 4 V", "About 6 V"], 0), seen = {};
        const blue = (S) => S.parts("led").some((q) => q.part.color === "blue" && lit(q));
        const blueRes = (S) => blue(S) && across(S, "res1") && Math.abs(volts(S)) > 2.6 && Math.abs(volts(S)) < 3.4;
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), ...V.L.parts(V), METER("V")),
          rules: { tray: [{ type: "led", color: "blue", n: 1 }], allow: allow({ dial: ["V"], socket: ["VO"] }), guardMeter: true },
          ui: { xray: true },
          goalsFrom: 4,
          beats: [
            { id: "p1", say: "Each part in the loop uses some of the battery's 6 V push. Which part do you think uses the most?", predict: P1, waitFor: { predict: true } },
            { id: "res", say: "Find out. Measure the push across the resistor: one probe on each side of it.",
              hints: [RING(V.hs(...V.L.res), "Across means one probe in a hole joined to each leg. Try the rings.")],
              waitFor: { when: (S) => { if (across(S, "res1")) seen.r = volts(S); return across(S, "res1"); } } },
            { id: "both", say: () => `${fmtV(seen.r || 4)} across the resistor. Now measure across the LED, and across the wire.`,
              hints: [RING(V.hs(...V.L.led)), RING(V.hs(...V.L.wire), "And the wire: one probe at each end.")],
              waitFor: { when: (S, m) => {
                if (across(S, "led1")) { m.l = true; seen.l = volts(S); }
                if (across(S, "wire1")) m.w = true;
                return m.l && m.w;
              } } },
            { id: "p2", say: () => `Resistor ${fmtV(seen.r || 4)}, LED ${fmtV(seen.l || 2)}, wire 0 V: together the battery's 6 V. A blue LED takes 3 V. And the resistor?`,
              highlight: { lcd: "meter" }, predict: P2, waitFor: { predict: true } },
            { id: "blue", say: "Find out: swap in the blue LED from the tray, then measure across the resistor again.", allow: { remove: ["led1"] },
              hints: [{ say: "Click the LED and press Remove. Drag the blue LED into the same holes, its long leg where the old long leg was." },
                RING(V.hs(...V.L.res))],
              waitFor: { when: blueRes } },
            FINISH((C) => `${C.right("p2") ? "Right: " : ""}the shares always add up to the battery's push. The LED takes its share, the resistor the rest.`),
          ],
          goals: [{ text: "Measure the resistor's share with the blue LED", when: blueRes }],
          bonus: [
            { text: "Guess which part uses the most push", final: (C) => C.right("p1") },
            { text: "Predict the resistor's share with the blue LED", final: (C) => C.right("p2") },
          ],
          solution: [{ choose: "right" }, { probe: V.hs(...V.L.res) }, { probe: V.hs(...V.L.led) }, { probe: V.hs(...V.L.wire) }, { choose: "right" },
            { remove: "led1" }, { place: { type: "led", color: "blue" }, at: V.hs("c6", "c7") }, { probe: V.hs(...V.L.res) }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-3", title: "Count the flow", teaches: ["current"], uses: ["volts", "loop", "strip", "rail", "resistor", "polarity"], shifts: [0, 4, 8],
      colors: ["red", "yellow", "green", "blue"], values: [330, 470, 1000],
      // which wire the meter takes the place of; where its probes go (red on the + side)
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.WIRE("wire1", "e7", "-T7")], at: ["b7", "-T9"] },
        { parts: (V) => [V.WIRE("wire1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.RES("res1", "e7", "-T7")], at: ["+T8", "b6"] },
      ],
      make: (V) => {
        const P = V.predict(["The LED goes out", "Nothing", "The meter reads more"], 0), seen = {};
        const reads = (S) => lit(part(S, "led1")) && amps(S, part(S, "led1"));
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), ...V.L.parts(V), METER("V")),
          rules: { tray: [], allow: allow({ dial: ["V", "mA"], socket: ["VO", "mA"] }), guardMeter: true },
          ui: { xray: true },
          goalsFrom: 2,
          beats: [
            { id: "set", say: "To count the flow, the current must go through the meter. Set it for current: dial to mA, red lead into the mA socket.",
              hints: [{ say: "Click mA next to the dial. Then click the mA socket at the bottom of the meter.", highlight: { ctl: ["mode:mA", "socket:mA"], id: "meter" } }],
              waitFor: { when: (S) => mode(S, "mA") && M(S).socket === "mA" } },
            { id: "open", say: "The current has to go through the meter, so make a gap for it: take the wire out.", allow: { remove: ["wire1"] },
              hints: [{ say: "Click the wire and press Remove, or drag it onto the parts tray.", highlight: { part: "wire1" } }],
              waitFor: { event: "remove", id: "wire1" } },
            { id: "close", say: "Now close the gap with the meter, so the current flows through it. Which probe goes on which side?",
              hints: [{ say: "Current leaves the battery's + and should go into the meter through the red probe. So red goes on the + side." }, RING(V.hs(...V.L.at))],
              waitFor: { when: (S) => { if (reads(S)) { seen.i = M(S).value; } return reads(S); } } },
            { id: "p", say: () => `${fmtmA(seen.i || 0.012)}: that many thousandths of an amp flow round${(seen.i || 1) < 0 ? " (the minus: red is on the − side)" : ""}. What if you pull out a probe?`,
              highlight: { lcd: "meter" }, predict: P, waitFor: { predict: true } },
            FINISH((C) => `${C.right("p") ? "Right: " : ""}the meter is part of the loop now. Pull a probe out and see the dots stop everywhere.`),
          ],
          goals: [{ text: "Measure the LED's current", when: reads }],
          bonus: [
            { text: "Predict what happens if a probe comes out", final: (C) => C.right("p") },
            { text: "Read the current with no minus sign", when: (S) => reads(S) && M(S).value > 0 },
          ],
          solution: [{ dial: "mA" }, { socket: "mA" }, { remove: "wire1" }, { probe: V.hs(...V.L.at) }, { wait: 1 }, { choose: "right" }, { next: 1 }],
        };
      },
    },
    {
      id: "2-4", title: "Is current used up?", teaches: ["sameCurrent"], uses: ["current", "loop", "strip", "rail", "resistor", "polarity"], shifts: [0, 3, 6],
      colors: ["red", "yellow", "green"], values: [330, 470],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Less after the LED", "The same", "More after the LED"], 1), seen = {};
        // where the meter measures: before the LED (wire w2), after it (w3), before the resistor (w1); red probe on the + side
        const AT = { w2: ["a9", "a11"], w3: ["a12", "-T14"], w1: ["+T8", "c6"] };
        const NETS = { w2: ["bb:L9", "bb:L11"], w3: ["bb:L12", "bb:-T"], w1: ["bb:+T", "bb:L6"] };
        const reads = (S, w) => { const q = part(S, "led1"); return lit(q) && amps(S, q) && on(S, ...NETS[w].map((n) => V.n(n))); };
        const rec = (w) => (S) => { if (reads(S, w)) { seen[w] = M(S).value; if (M(S).value < 0) seen.neg = true; } return reads(S, w); };
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.WIRE("w1", "+T6", "a6"), V.RES("res1", "b6", "b9"), V.WIRE("w2", "c9", "c11"), V.LED("led1", "d11", "d12"),
            V.WIRE("w3", "e12", "-T12"), METER("mA", "mA")),
          rules: { tray: [], allow: allow({ dial: ["V", "mA"], socket: ["VO", "mA"] }), guardMeter: true },
          ui: { xray: true },
          goalsFrom: 0,
          beats: [
            { id: "p", say: "This LED is lit. Does it use up some of the current? Is there less current after the LED than before it?", highlight: { part: "led1" },
              predict: P, waitFor: { predict: true } },
            { id: "before", say: "Find out. The meter is set for mA. Measure the current before the LED, in place of this wire.", highlight: { part: "w2" },
              allow: { remove: ["w2"] }, hints: [{ say: "Take the wire out and close the gap with the meter, red probe on the side nearer the +." }, RING(V.hs(...AT.w2))],
              waitFor: { when: rec("w2") } },
            { id: "after", say: () => `${fmtmA(seen.w2 || 0.012)} before the LED. Put that wire back, then measure after the LED, in place of this wire.`,
              highlight: { part: "w3" }, allow: { remove: ["w3"] },
              hints: [{ say: "Drag the wire from the tray back into its two holes. Then take out the marked wire and put the meter there." }, RING(V.hs(...AT.w3))],
              waitFor: { when: rec("w3") } },
            { id: "same", say: (C) => `${C.right("p") ? "Right: " : ""}${fmtmA(seen.w3 || 0.012)} after, ${fmtmA(seen.w2 || 0.012)} before: the same! The LED uses push, not current.`,
              highlight: { lcd: "meter" }, waitFor: NEXT },
            { id: "third", say: "One more check: put the wire back, and measure before the resistor, in place of this wire.", highlight: { part: "w1" },
              allow: { remove: ["w1"] }, hints: [RING(V.hs(...AT.w1))], waitFor: { when: rec("w1") } },
            FINISH("The same current flows all the way round a loop: out of +, through every part, and back into −."),
          ],
          goals: [{ text: "Measure the current in three places", when: (S, m) => { for (const w of ["w1", "w2", "w3"]) if (reads(S, w)) m[w] = true; return m.w1 && m.w2 && m.w3; } }],
          bonus: [
            { text: "Guess whether the LED uses up current", final: (C) => C.right("p") },
            { text: "Every reading without a minus sign", final: () => !seen.neg },
          ],
          solution: [{ choose: "right" }, { remove: "w2" }, { probe: V.hs(...AT.w2) }, { wait: 0.6 }, { probe: [null, null] }, { wire: V.hs("c9", "c11") },
            { remove: "w3" }, { probe: V.hs(...AT.w3) }, { wait: 0.6 }, { next: 1 }, { probe: [null, null] }, { wire: V.hs("e12", "-T12") },
            { remove: "w1" }, { probe: V.hs(...AT.w1) }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-5", title: "The meter's fuse", teaches: ["fuse"], uses: ["current", "short", "volts", "loop", "rail", "resistor", "polarity"], shifts: [0, 4, 8],
      colors: ["red", "yellow", "green", "blue"], values: [330, 470, 1000],
      // where the loop is open, and where the meter closes it (red on the + side)
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7")], at: ["b7", "-T9"] },
        { parts: (V) => [V.LED("led1", "c6", "c7"), V.RES("res1", "e7", "-T7")], at: ["+T8", "b6"] },
      ],
      make: (V) => {
        const P = V.predict(["It reads 6 V", "A short circuit: something blows", "Nothing"], 1);
        const reads = (S) => lit(part(S, "led1")) && amps(S, part(S, "led1"));
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), ...V.L.parts(V), METER("mA", "mA")),
          rules: { tray: [], allow: allow({ dial: ["V", "mA"], socket: ["VO", "mA"], replace: ["meter"] }), banner: true },
          allowDamage: true, simText: { meter: null },
          ui: { xray: true },
          beats: [
            { id: "p", say: "Set for mA, the meter is almost a wire. What happens if you put it across the battery?", highlight: { part: "meter" }, predict: P, waitFor: { predict: true } },
            { id: "try", say: "Find out: put the meter across the battery, one probe on each of its rails.",
              hints: [RING(V.hs("+T12", "-T12"))], waitFor: { when: (S) => !!M(S) && !M(S).fuseOK, hold: 0.05 } },
            { id: "fuse", say: (C) => `${C.right("p") ? "You called it. " : ""}Pop! The meter's fuse blew. It burns out so the meter does not. Click the meter: New fuse.`,
              highlight: { part: "meter" }, hints: [{ say: "Click the meter body. A card with a New fuse button appears next to it." }], waitFor: { event: "replace", id: "meter" } },
            { id: "right", say: "Volts go across. Current goes through. Now measure this LED's current the right way.",
              hints: [{ say: "The loop is open. Close the gap with the meter, so the current flows through it." }, RING(V.hs(...V.L.at))],
              waitFor: { when: reads } },
            FINISH("Before you measure, check the dial and the red lead. mA goes in the path, never across."),
          ],
          goals: [{ text: "Measure the LED's current", when: reads }],
          bonus: [
            { text: "Predict what happens", final: (C) => C.right("p") },
            { text: "Blow only one fuse", final: (C) => (C.count.destroyed || 0) <= 1 },
          ],
          solution: [{ choose: "right" }, { probe: V.hs("+T12", "-T12") }, { wait: 0.6 }, { probe: [null, null] }, { replace: "meter" }, { probe: V.hs(...V.L.at) }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-6", title: "Bigger resistor, less flow", teaches: ["biggerR"], uses: ["current", "resistor", "loop", "strip", "rail", "polarity"], shifts: [0, 4, 8],
      colors: ["red", "yellow", "green"],
      // the resistor on the + side or the − side; the meter is already in the loop (red on the + side)
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6", 220), V.LED("led1", "c6", "c7")], at: ["b7", "-T9"], res: ["+T6", "a6"] },
        { parts: (V) => [V.LED("led1", "c6", "c7"), V.RES("res1", "e7", "-T7", 220)], at: ["+T8", "b6"], res: ["e7", "-T7"] },
      ],
      make: (V) => {
        const P = V.predict(["More", "Less", "The same"], 1), seen = {};
        const reads = (S) => { const q = part(S, "led1"); return lit(q, 0.001) && amps(S, q); };
        const only = (S, r) => { const rs = S.parts("resistor"); return rs.length === 1 && rs[0].part.value === r && reads(S); };
        const rec = (r) => (S) => { if (only(S, r)) seen[r] = M(S).value; return only(S, r); };
        const pick = (S) => reads(S) && Math.abs(M(S).value) >= 0.010 && Math.abs(M(S).value) <= 0.015;
        const RES = (r) => ({ place: { type: "resistor", value: r }, at: V.hs(...V.L.res) });
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), ...V.L.parts(V), METER("mA", "mA", V.hs(...V.L.at))),
          rules: { tray: [{ type: "resistor", value: 470, n: 1 }, { type: "resistor", value: 1000, n: 1 }, { type: "resistor", value: 330, n: 1 }],
            allow: allow({ dial: ["V", "mA"], socket: ["VO", "mA"], remove: ["res1"] }) },
          ui: { xray: true },
          goalsFrom: 4,
          beats: [
            { id: "p", say: "Resistors come in sizes, measured in ohms (Ω). This one is 220 Ω. With a bigger resistor, will more or less current flow?",
              highlight: { part: "res1" }, predict: P, waitFor: { predict: true } },
            { id: "r470", say: "Find out: swap in the 470 Ω resistor from the tray. Watch the meter and the LED.",
              hints: [{ say: "Click the resistor and press Remove. Then drag the 470 Ω one into the same holes." }], waitFor: { when: rec(470) } },
            { id: "r1k", say: () => `${fmtmA(seen[470] || 0.0085)} with 470 Ω. Now try the 1 kΩ one: that is 1000 Ω.`, waitFor: { when: rec(1000) } },
            { id: "name", say: (C) => `${C.right("p") ? "Right: " : ""}220 Ω ${fmtmA(seen[220] || 0.018)}, 470 Ω ${fmtmA(seen[470] || 0.0085)}, 1 kΩ ${fmtmA(seen[1000] || 0.004)}. Bigger holds back more: less flow.`,
              highlight: { lcd: "meter" }, waitFor: NEXT },
            { id: "use", say: "Your turn: make the LED as bright as you can, but keep the current under 15 mA. Which resistor?",
              hints: [{ say: "220 Ω let more than 15 mA through. 470 Ω gave far less. Which size lies between?" }], waitFor: { when: pick, hold: 0.6 } },
            FINISH("Choosing the resistor sets the current. That is how you make an LED just as bright as you want."),
          ],
          goals: [{ text: "The brightest LED under 15 mA", when: pick }],
          bonus: [
            { text: "Guess what a bigger resistor does", final: (C) => C.right("p") },
            { text: "Pick it on the first try", final: (C) => (C.count.place || 0) <= 3,
              when: (S) => { rec(220)(S); return false; } },          // also notes the 220 Ω reading for Sparky
          ],
          solution: [{ choose: "right" }, { remove: "res1" }, RES(470), { wait: 0.6 }, { remove: "resistor" }, RES(1000), { wait: 0.6 }, { next: 1 },
            { remove: "resistor" }, RES(330), { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-7", title: "Ohms", teaches: ["ohms"], uses: ["biggerR", "resistor", "loop", "strip", "rail", "polarity"], shifts: [0, 4],
      colors: ["red", "yellow", "green"], values: [330, 470],
      // which of the two lettered resistors is the safe one
      layouts: [{ safe: "B" }, { safe: "A" }],
      make: (V) => {
        const R = { [V.L.safe]: V.ohms, [V.L.safe === "A" ? "B" : "A"]: 22 }, ID = { A: "resA", B: "resB" };
        const P = V.predict(["Resistor A", "Resistor B"], V.L.safe === "A" ? 0 : 1);
        const reads = (S, t) => { const q = part(S, ID[t]); return !!q && S.across(q) && ohms(S) !== null && S.near(ohms(S), R[t], 0.03); };
        const ok = (S) => S.parts("led").some(safe);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.LED("led1", "c6", "c7"), V.WIRE("w1", "e7", "-T7"),
            Object.assign(V.RES("resA", "b12", "b15", R.A), { tag: "A" }), Object.assign(V.RES("resB", "g12", "g15", R.B), { tag: "B" }), METER("V")),
          rules: { tray: [], allow: allow({ dial: ["V", "mA", "ohm"], move: ["resA", "resB"], legs: ["resA", "resB"], remove: ["resA", "resB"], replace: ["led1"] }) },
          allowDamage: true,
          ui: { xray: true },
          beats: [
            { id: "lost", say: "These two resistors lost their labels. One keeps the LED safe, the other would burn it out. Which is which?",
              highlight: { parts: ["resA", "resB"] }, waitFor: NEXT },
            { id: "dial", say: "The meter can measure a resistor's size. Turn the dial to Ω, for ohms.",
              hints: [{ say: "Click the Ω mark next to the meter's dial.", highlight: { ctl: "mode:ohm", id: "meter" } }], waitFor: { when: (S) => mode(S, "ohm") } },
            { id: "measure", say: "Measure both resistors: one probe on each leg. On its own, a resistor needs no battery: the meter sends its own current.",
              hints: [RING(V.hs("c12", "c15")), RING(V.hs("h12", "h15"), "And resistor B.")],
              waitFor: { when: (S, m) => { if (reads(S, "A")) m.A = true; if (reads(S, "B")) m.B = true; return m.A && m.B; } } },
            { id: "p", say: `A is ${fmtR(R.A)}, B is ${fmtR(R.B)}. Which one keeps the LED safe?`, predict: P, waitFor: { predict: true } },
            { id: "use", say: (C) => `${C.right("p") ? "Right. " : "Bigger holds back more. "}Put the safe one in the gap between the + rail and the LED.`,
              highlight: { holes: V.hs("+T6", "a6") },
              hints: [{ say: "Drag the resistor so one leg is on the red + rail and the other in the LED's + strip." }, { show: [V.RES("h", "+T6", "a6", V.ohms)] }],
              waitFor: { when: ok, hold: 0.6 } },
            FINISH("Ohms tell a resistor's size. Measure with the power off, or the part on its own: a battery's push confuses the meter."),
          ],
          goals: [{ text: "Light the LED safely", when: ok, hold: 0.6 }],
          bonus: [
            { text: "Choose the safe one from your readings", final: (C) => C.right("p") },
            { text: "Nothing burns out", final: (C) => C.broken.size === 0 },
          ],
          solution: [{ next: 1 }, { dial: "ohm" }, { probe: V.hs("c12", "c15") }, { probe: V.hs("h12", "h15") }, { choose: "right" },
            { move: ID[V.L.safe], to: V.hs("+T6", "a6") }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-8", title: "Find the break", teaches: ["break"], uses: ["across", "volts", "loop", "strip", "rail", "gap", "resistor", "polarity"], shifts: [0, 3, 6],
      colors: ["red", "yellow", "green"],
      // the hidden break in the second circuit: the wire one strip off, the wire below the centre gap, or the LED one strip off.
      // find: probes that show the break; fix: one wire that mends it
      layouts: [
        { parts: (V) => [V.RES("res2", "+T13", "a13"), V.LED("led2", "c13", "c14", V.c2), V.WIRE("wire2", "e15", "-T15")], find: ["b14", "-T17"], fix: ["d14", "d15"],
          hint: "The LED's − leg and the wire to the − rail are in different strips." },
        { parts: (V) => [V.RES("res2", "+T13", "a13"), V.LED("led2", "c13", "c14", V.c2), V.WIRE("wire2", "g14", "-T14")], find: ["b14", "-T17"], fix: ["e14", "f14"],
          hint: "The wire to the − rail starts below the centre gap." },
        { parts: (V) => [V.RES("res2", "+T13", "a13"), V.LED("led2", "c14", "c15", V.c2), V.WIRE("wire2", "e15", "-T15")], find: ["b13", "b14"], fix: ["d13", "d14"],
          hint: "The resistor and the LED's + leg are in different strips." },
      ],
      make: (V) => {
        const P = V.predict(["Across the LED", "Across the gap", "Nowhere: nothing flows"], 1), seen = {};
        const gap = [V.n("bb:L7"), "bb:-T"];
        const lit2 = (S) => lit(part(S, "led2"));
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.WIRE("wire1", "e7", "-T7"), ...V.L.parts(V), METER("V")),
          rules: { tray: [{ type: "wire", n: 1 }], allow: allow({ dial: ["V", "mA", "ohm"], move: ["wire2", "led2"], legs: ["wire2", "led2"] }) },
          ui: { xray: true },
          beats: [
            { id: "what", say: "A break is a place where the loop is cut, so no current gets across: a missing wire, a leg in the wrong strip, a broken wire.",
              waitFor: NEXT },
            { id: "pull", say: "Make a break you can see: take this wire out, and watch the dots.", highlight: { part: "wire1" }, allow: { remove: ["wire1"] },
              hints: [{ say: "Click the wire and press Remove, or drag it onto the parts tray." }], waitFor: { event: "remove", id: "wire1" } },
            { id: "p", say: "The dots stopped everywhere. Where will the meter find the battery's push now?", predict: P, waitFor: { predict: true } },
            { id: "measure", say: "Measure both, with the meter on V: across the LED, and across the gap the wire left.",
              hints: [RING(V.hs("d6", "d7"), "Across the LED: try the rings."), RING(V.hs("b7", "-T9"), "Across the gap: one probe where the wire was, one on the − rail.")],
              waitFor: { when: (S, m) => {
                if (across(S, "led1") && Math.abs(volts(S)) < 0.3) m.l = true;
                if (on(S, ...gap) && Math.abs(volts(S) || 0) > 2.5) { m.g = true; seen.gap = volts(S); }
                return m.l && m.g;
              } } },
            { id: "find", say: (C) => `${C.right("p") ? "Right: " : ""}${fmtV(seen.gap || 4.6)} across the gap, 0 V across the LED. The ${K.COLOR_WORD[V.c2]} LED has a hidden break. Find it.`,
              highlight: { part: "led2" },
              hints: [RING(V.hs(...V.L.find), "Try here. Most of the push across two points means the break is between them."),
                { say: `${V.L.hint} One wire there closes the loop.` }, { show: [V.WIRE("h", ...V.hs(...V.L.fix))] }],
              waitFor: { when: lit2 } },
            FINISH("No current, so the parts use no push: it all sits at the break. Measure across each join until you find it."),
          ],
          goals: [{ text: `Light the ${K.COLOR_WORD[V.c2]} LED`, when: lit2, hold: 0.6 }],
          bonus: [
            { text: "Predict where the push goes", final: (C) => C.right("p") },
            { text: "Find the break with the meter before you fix it", when: (S, m) => {
              const row = (h) => BBShared.parse(h).row;
              if (!lit2(S) && Math.abs(volts(S) || 0) > 2.5 && !on(S, "bb:+T", "bb:-T") && probes(S) && [M(S).red, M(S).com].some((h) => row(h) >= V.r(12))) m.found = true;
              return !!m.found && lit2(S);
            } },
          ],
          solution: [{ next: 1 }, { remove: "wire1" }, { choose: "right" }, { probe: V.hs("d6", "d7") }, { probe: V.hs("b7", "-T9") }, { wait: 0.4 },
            { probe: V.hs(...V.L.find) }, { wait: 0.6 }, { wire: V.hs(...V.L.fix) }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-9", title: "The beep", teaches: ["continuity"], uses: ["volts", "strip", "gap", "loop", "rail", "resistor", "polarity", "switch"], shifts: [0, 3, 6],
      // which of the three wires is broken inside
      layouts: [{ broken: "w2" }, { broken: "w1" }, { broken: "w3" }],
      make: (V) => {
        const P = V.predict(["Yes", "No"], 1), WIRES = ["w1", "w2", "w3"], seen = {};
        const ENDS = { w1: ["+T6", "a6"], w2: ["e10", "e13"], w3: ["a13", "-T13"] };
        const PROBE = { w1: ["+T8", "b6"], w2: ["b10", "b13"], w3: ["c13", "-T15"] };
        const wire = (id) => Object.assign(V.WIRE(id, ...ENDS[id]), id === V.L.broken ? { broken: true } : {});
        const bat = Object.assign(V.BAT("+T3", "-T4"), { on: false });
        const strip = (h) => !!h && BBShared.parse(h).kind === "strip";
        const beat = (S, same) => {
          const m = M(S);
          if (!mode(S, "cont") || !strip(m.red) || !strip(m.com)) return false;
          const a = BBShared.parse(m.red), b = BBShared.parse(m.com), half = (p) => ("abcde".includes(p.col) ? 0 : 1);
          return same ? m.beep && net(m.red) === net(m.com) && m.red !== m.com : !m.beep && half(a) === half(b) && Math.abs(a.row - b.row) === 1;
        };
        return {
          region: REGION(V),
          start: start(bat, ...WIRES.map(wire), V.RES("res1", "b6", "b9"), V.LED("led1", "c9", "c10"), METER("V")),
          rules: { tray: [{ type: "wire", n: 1 }], allow: allow({ socket: ["VO"] }), banner: true },
          beats: [
            { id: "same", say: "Turn the dial to the beep, ·))). Then put both probes in the same group of 5 holes.",
              hints: [{ say: "Click ·))) next to the meter's dial.", highlight: { ctl: "mode:cont", id: "meter" } }, RING(V.hs("a16", "d16"), "Then, for example, these two holes.")],
              waitFor: { when: (S) => beat(S, true) } },
            { id: "next", say: "Beep: those holes are joined by metal. Now try two holes in neighbouring groups.",
              hints: [RING(V.hs("a16", "a17"), "Same letter, rows next to each other: for example these.")], waitFor: { when: (S) => beat(S, false) } },
            { id: "p", say: `No beep: not joined. Would it beep from e${V.r(16)} to f${V.r(16)}, across the centre gap?`, highlight: { holes: V.hs("e16", "f16") },
              predict: P, waitFor: { predict: true } },
            { id: "find", say: (C) => `${C.right("p") ? "Right, no beep. " : "No beep: the gap splits them. "}One of these wires is broken inside. Find it, swap it, switch on.`,
              highlight: { parts: WIRES }, allow: { ctl: ["meter", "bat"], remove: WIRES },
              hints: [{ say: "Put a probe at each end of a wire. A good wire beeps. The broken one stays quiet." },
                { say: "Take the quiet wire off, put a new one in its holes, then switch the battery on." }, { highlight: { part: V.L.broken } }],
              waitFor: { when: (S) => anyLit(S) } },
            FINISH("A wire can look fine and still be broken inside. The beep tells you the truth."),
          ],
          goals: [{ text: "Light the LED", when: (S) => anyLit(S), hold: 0.6 }],
          bonus: [
            { text: "Predict: does it beep across the centre gap?", final: (C) => C.right("p") },
            { text: "Find the broken wire without pulling out a good one", final: () => !seen.pulled,
              when: (S) => { if (WIRES.some((id) => id !== V.L.broken && !part(S, id))) seen.pulled = true; return false; } },
          ],
          solution: [{ dial: "cont" }, { probe: V.hs("a16", "d16") }, { probe: V.hs("a16", "a17") }, { choose: "right" }, { probe: V.hs(...PROBE[V.L.broken]) }, { wait: 0.5 },
            { remove: V.L.broken }, { wire: V.hs(...ENDS[V.L.broken]) }, { ctl: "bat" }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-10", title: "Detective", teaches: [], uses: ["volts", "across", "break", "continuity", "loop", "strip", "rail", "polarity", "resistor"], shifts: [0, 4, 8],
      card: { name: "Measure first", text: "Before you change anything, measure. Where most of the push shows up, or a wire stays quiet, there is your fault." },
      colors: ["red", "yellow", "green"],
      // the fault: a wire broken inside, the LED the wrong way round, or the LED one strip off. Probes that show it; the one-change fix.
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"), Object.assign(V.WIRE("wire1", "e7", "-T7"), { broken: true })],
          show: ["b7", "-T9"], fix: { wire: ["d7", "-T12"] }, hint: "Is every wire really joining its two ends? The beep can tell." },
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c7", "c6"), V.WIRE("wire1", "e7", "-T7")],
          show: ["b6", "b7"], fix: { flip: "led1" }, hint: "Look at each LED leg. Which way should the long + leg face?" },
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c7", "c8"), V.WIRE("wire1", "e8", "-T8")],
          show: ["b6", "b7"], fix: { wire: ["d6", "d7"] }, hint: "Follow the loop strip by strip. Is each part's leg in the same strip as the next part?" },
      ],
      make: (V) => {
        const show = V.hs(...V.L.show).map(net), changes = (C) => ["place", "remove", "flip", "move"].reduce((n, k) => n + (C.count[k] || 0), 0);
        const fix = V.L.fix.wire ? { wire: V.hs(...V.L.fix.wire) } : V.L.fix;
        const ok = (S) => S.parts("led").some(safe);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), ...V.L.parts(V), METER("V")),
          rules: { tray: [{ type: "wire", n: 1 }, { type: "led", color: V.c1, n: 1 }],
            allow: allow({ move: ["led1", "wire1"], legs: ["led1", "wire1"], flip: ["led1"], remove: ["led1", "wire1"], replace: ["led1", "meter"] }), banner: true },
          allowDamage: true,
          beats: [
            { id: "case", say: V.say("This one should light, but it doesn't. Use the meter to find out why, then fix it.",
              "A dark LED, and no idea why. Find the fault with the meter, then fix it."),
              hints: [{ say: "Measure volts across each part and each join. Where most of the push shows up, look closely." }, { say: V.L.hint }],
              waitFor: { when: ok } },
            FINISH("Case closed. Measure first, then change things: that is how you fix any circuit."),
          ],
          goals: [{ text: "Light the LED", when: ok, hold: 0.6 }],
          bonus: [
            { text: "Find the fault with the meter before you change anything", when: (S, m, C) => {
              const quiet = mode(S, "cont") && !M(S).beep && on(S, ...show);
              if (!changes(C) && ((on(S, ...show) && Math.abs(volts(S) || 0) > 2.5) || quiet)) m.found = true;
              return !!m.found && ok(S);
            } },
            { text: "Fix it with one change", final: (C) => changes(C) <= 1 },
          ],
          solution: [{ probe: V.hs(...V.L.show) }, { wait: 0.6 }, fix, { wait: 1 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(2, "Measuring", L);
})(window.BB = window.BB || {});
