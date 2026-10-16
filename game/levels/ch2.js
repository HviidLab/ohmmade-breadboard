// Chapter 2: Measuring. Every level asks a question about the circuit that you cannot answer by looking, and the
// multimeter finds the answer: why one LED is dimmer (voltage, the push), how the voltage is shared (shares add up), how much
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
  // the probes sit on these two nodes (either way round; any hole of a strip, or of a strip wired to it, counts)
  const on = (S, a, b) => { const p = probes(S); return !!p && ((S.same(p[0], a) && S.same(p[1], b)) || (S.same(p[0], b) && S.same(p[1], a))); };
  // a volts reading (null when the meter is not showing volts)
  const volts = (S) => (mode(S, "V") && M(S).socket === "VO" && !M(S).display && probes(S) ? M(S).value : null);
  // Why a current measurement does not count yet, once both probes are on the board (null: nothing wrong with the meter)
  const ampsWhy = (S, led) => {
    const m = M(S);
    if (!m || !probes(S)) return null;
    if (!m.fuseOK) return "The meter's fuse is blown. Click the meter: New fuse.";
    if (m.mode !== "mA") return "To measure current, turn the dial to mA.";
    if (m.socket !== "mA") return "The red lead is in the VΩ socket. Move it to mA, so the current can flow through the meter.";
    if (led && !(led.ok && led.rd.I > 5e-4)) return "No current flows yet: the meter must close the gap, one probe on each side of it.";
    return null;
  };
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
        const P = V.predict(["Its LED is weaker", "Its battery pushes less", "Its wires are longer"], 1,
          ["the two LEDs are the same kind. The difference is in the push behind them.", null, "a wire's length hardly matters here: a wire is just metal."]), seen = {};
        const top = (S) => on(S, "bb:+T", "bb:-T") && Math.abs(volts(S) || 0) > 5.5;
        const bottom = (S) => on(S, "bb:+B", "bb:-B") && Math.abs(volts(S) || 0) > 2.5 && Math.abs(volts(S)) < 3.5;
        const bright = (S) => lit(part(S, "led2"), 0.009);
        return {
          region: Object.assign(REGION(V), { rails: "all" }),
          start: start(V.BAT("+T3", "-T4"), Object.assign(V.BAT("+B3", "-B4"), { id: "bat2", cells: 2 }),
            V.RES("res1", "+T6", "a6", 330), V.LED("led1", "c6", "c7"), V.WIRE("w1", "e7", "-T7"),
            V.WIRE("wa", "+B5", "j5"), V.RES("res2", "g5", "g8", 330), V.LED("led2", "h8", "h9"), V.WIRE("wb", "f9", "-B9"), METER("off")),
          rules: { tray: [], allow: allow({ dial: ["off", "V"], socket: ["VO"], legs: ["wa", "wb"], move: ["wa", "wb"] }), guardMeter: true, guardShorts: true },   // moving wire ends between rails: shorts are easy, and not the lesson
          ui: { strips: true },
          beats: [
            { id: "q", say: "Two circuits with the same parts. So why is the bottom LED dimmer than the top one?", highlight: { parts: ["led1", "led2"] },
              predict: P, waitFor: { predict: true } },
            { id: "dial", say: "Let's measure with the multimeter. Turn its dial to V. Voltage is the push that drives current. It is measured in volts (V).",
              hints: [{ say: "Click the V⎓ mark next to the meter's dial.", highlight: { ctl: "mode:V", id: "meter" } }], waitFor: { when: (S) => mode(S, "V") } },
            { id: "top", say: "Measure the top battery's voltage: one probe on its + rail, the other on its − rail.",
              hints: [RING(V.hs("+T10", "-T10"), "The top battery feeds the two rails along the top edge. Try the rings.")],
              waitFor: { when: (S) => { if (top(S)) seen.top = volts(S); return top(S); } } },
            { id: "bottom", say: () => `${fmtV(seen.top || 6)} at the top. Now measure the bottom battery the same way, on the bottom rails.`,
              hints: [RING(V.hs("+B10", "-B10"))], waitFor: { when: (S) => { if (bottom(S)) seen.bottom = volts(S); return bottom(S); } } },
            { id: "fix", reply: "q", say: () => `${fmtV(seen.bottom || 3)} at the bottom: half the voltage, so less current. Make the bottom LED bright.`,
              hints: [{ say: "These two wires join the bottom LED's loop to the 3 V pack. Which battery should they reach?", highlight: { parts: ["wa", "wb"] } },
                { say: "Press right on a wire's end and drag it up to a top rail: + end to the + rail, − end to the − rail." },
                { show: [V.WIRE("h1", "+T14", "j5"), V.WIRE("h2", "f9", "-T14")] }],
              waitFor: { when: bright } },
            Object.assign(FINISH("Voltage is the push. More voltage drives more current round the loop, and the LED glows brighter."),
              { note: "a new pack of 4 AA cells reads about 6.3 V, a used one less. Rechargeable cells give only about 4.8 V." }),
          ],
          goals: [{ text: "Make the bottom LED as bright as the top one", when: bright, hold: 0.6 }],
          challenge: { text: "Make the dim LED bright by moving just two wire ends", final: (C) => (C.count.move || 0) <= 2 && !C.count.place },
          solution: [{ choose: "right" }, { dial: "V" }, { probe: V.hs("+T10", "-T10") }, { probe: V.hs("+B10", "-B10") }, { wait: 0.6 },
            { move: "wa", to: V.hs("+T14", "j5") }, { move: "wb", to: V.hs("f9", "-T14") }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-2", title: "Sharing the voltage", teaches: ["across"], uses: ["volts", "loop", "strip", "rail", "resistor", "polarity"], shifts: [0, 4, 8],
      colors: ["red", "yellow", "green"], values: [330, 470],
      // the resistor first or the LED first; where the probes go (red on the + side)
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.WIRE("wire1", "e7", "-T7")], res: ["+T8", "b6"], led: ["d6", "d7"], wire: ["b7", "-T9"] },
        { parts: (V) => [V.WIRE("wire1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.RES("res1", "e7", "-T7")], res: ["b7", "-T9"], led: ["d6", "d7"], wire: ["+T8", "b6"] },
      ],
      make: (V) => {
        const P1 = V.predict(["The resistor", "The LED", "The wire"], 0, [null, "the LED looks busiest, but it needs only about 2 V. The rest is across the resistor.", "there is almost no voltage across a wire: it is just metal."]);
        const P2 = V.predict(["About 3 V", "About 4 V", "About 6 V"], 0, [null, "the resistor doesn't always have 4 V across it. The shares add up to 6 V, and blue needs 3 V.", "the shares add up to 6 V, so the resistor's share is 6 − 3 = 3 V."]), seen = {};
        const blue = (S) => S.parts("led").some((q) => q.part.color === "blue" && lit(q));
        const blueRes = (S) => blue(S) && across(S, "res1") && Math.abs(volts(S)) > 2.6 && Math.abs(volts(S)) < 3.4;
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), ...V.L.parts(V), METER("V")),
          rules: { tray: [{ type: "led", color: "blue", n: 1 }], allow: allow({ dial: ["V"], socket: ["VO"] }), guardMeter: true },
          ui: { strips: true },
          goalsFrom: 4,
          beats: [
            { id: "p1", say: "The battery's 6 V, its push, is shared out among the parts in the loop. Which part do you think gets the biggest share?", predict: P1, waitFor: { predict: true } },
            { id: "res", say: "Find out. Measure the voltage across the resistor: one probe on each side of it.",
              hints: [RING(V.hs(...V.L.res), "Across means one probe in a hole joined to each leg. Try the rings.")],
              waitFor: { when: (S) => { if (across(S, "res1")) seen.r = volts(S); return across(S, "res1"); } } },
            { id: "both", reply: "p1", say: () => `${fmtV(seen.r || 4)} across the resistor. Now measure across the LED, and across the wire.`,
              hints: [RING(V.hs(...V.L.led)), RING(V.hs(...V.L.wire), "And the wire: one probe at each end.")],
              waitFor: { when: (S, m) => {
                if (across(S, "led1")) { m.l = true; seen.l = volts(S); }
                if (across(S, "wire1")) m.w = true;
                return m.l && m.w;
              } } },
            { id: "p2", say: () => `Resistor ${fmtV(seen.r || 4)}, LED ${fmtV(seen.l || 2)}, wire 0 V: together the battery's 6 V. A blue LED needs 3 V. And the resistor?`,
              highlight: { lcd: "meter" }, predict: P2, waitFor: { predict: true } },
            { id: "blue", say: "Find out: swap in the blue LED from the tray, then measure across the resistor again.", allow: { remove: ["led1"] },
              hints: [{ say: "Click the LED and press Remove. Drag the blue LED into the same holes, its longer leg where the old longer leg was." },
                RING(V.hs(...V.L.res))],
              waitFor: { when: blueRes } },
            Object.assign(FINISH("The voltages across the parts always add up to the battery's voltage: the LED's share, and the rest across the resistor."), { reply: "p2" }),
          ],
          goals: [{ text: "Measure the resistor's share with the blue LED", when: blueRes }],
          challenge: { text: "Measure the blue LED's share too", when: (S) => { const q = S.parts("led").find((x) => x.part.color === "blue" && lit(x)); return !!q && S.across(q) && volts(S) !== null && Math.abs(volts(S)) > 2.5; } },
          solution: [{ choose: "right" }, { probe: V.hs(...V.L.res) }, { probe: V.hs(...V.L.led) }, { probe: V.hs(...V.L.wire) }, { choose: "right" },
            { remove: "led1" }, { place: { type: "led", color: "blue" }, at: V.hs("c6", "c7") }, { probe: V.hs(...V.L.res) }, { wait: 0.6 }, { probe: V.hs(...V.L.led) }, { wait: 0.5 }, { next: 1 }],
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
        const P = V.predict(["The LED goes out", "Nothing", "The meter reads more"], 0,
          [null, "the meter is part of the loop now. Pull a probe out and the loop is open.", "a pulled probe opens the loop: no current at all, so the meter reads 0."]), seen = {};
        const reads = (S) => lit(part(S, "led1")) && amps(S, part(S, "led1"));
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), ...V.L.parts(V), METER("V")),
          rules: { tray: [], allow: allow({ dial: ["V", "mA"], socket: ["VO", "mA"] }), guardMeter: true },
          ui: { strips: true },
          goalsFrom: 2,
          react: [{ hold: 1.2, when: (S, C) => (C.beat && C.beat.id === "close" && !reads(S) ? ampsWhy(S, part(S, "led1")) : null) }],
          beats: [
            { id: "set", say: "The current must go through the meter. Set it for current, in mA (thousandths of an amp): dial to mA, red lead into the mA socket.",
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
            Object.assign(FINISH("The meter is part of the loop now. Pull a probe out and see the dots stop everywhere."), { reply: "p" }),
          ],
          goals: [{ text: "Measure the LED's current", when: reads }],
          challenge: { text: "Read the current with no minus sign", when: (S) => reads(S) && M(S).value > 0 },
          solution: [{ dial: "mA" }, { socket: "mA" }, { remove: "wire1" }, { probe: V.hs(...V.L.at) }, { wait: 1 }, { choose: "right" }, { next: 1 }],
        };
      },
    },
    {
      id: "2-4", title: "Is current used up?", teaches: ["sameCurrent"], uses: ["current", "loop", "strip", "rail", "resistor", "polarity"], shifts: [0, 3, 6],
      colors: ["red", "yellow", "green"], values: [330, 470],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Less after the LED", "The same", "More after the LED"], 1,
          ["current is not used up. Every bit that flows into the LED comes out of the other side.", null, "nothing adds current along the way: the same flow goes all round."]), seen = {};
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
          ui: { strips: true },
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
            { id: "same", reply: "p", say: () => `${fmtmA(seen.w3 || 0.012)} after, ${fmtmA(seen.w2 || 0.012)} before: the same! About 2 V drops across the LED, yet no charge is lost: each bit just carries less energy.`,
              highlight: { lcd: "meter" }, waitFor: NEXT },
            { id: "third", say: "One more check: put the wire back, and measure before the resistor, in place of this wire.", highlight: { part: "w1" },
              allow: { remove: ["w1"] }, hints: [RING(V.hs(...AT.w1))], waitFor: { when: rec("w1") } },
            FINISH("The same current flows all the way round: out of +, through every part, back into −. So a resistor protects an LED from either side."),
          ],
          goals: [{ text: "Measure the current in three places", when: (S, m) => { for (const w of ["w1", "w2", "w3"]) if (reads(S, w)) m[w] = true; return m.w1 && m.w2 && m.w3; } }],
          challenge: { text: "Every reading without a minus sign", final: () => !seen.neg },
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
        const P = V.predict(["It reads 6 V", "A short circuit: something blows", "Nothing"], 1,
          ["only when set for V. Set for mA, the meter is almost a wire, and a wire across a battery is a short.", null, "set for mA, the meter is almost a wire: across the battery, a huge current flows."]);
        const reads = (S) => lit(part(S, "led1")) && amps(S, part(S, "led1"));
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), ...V.L.parts(V), METER("mA", "mA")),
          rules: { tray: [], allow: allow({ dial: ["V", "mA"], socket: ["VO", "mA"], replace: ["meter"] }), banner: true },
          demo: { meter: 1, short: true }, simText: { meter: null },
          ui: { strips: true },
          beats: [
            { id: "p", say: "Set for mA, the meter is almost a wire. What happens if you put it across the battery?", highlight: { part: "meter" }, predict: P, waitFor: { predict: true } },
            { id: "try", say: "Find out: put the meter across the battery, one probe on each of its rails.",
              hints: [RING(V.hs("+T12", "-T12"))], waitFor: { when: (S) => !!M(S) && !M(S).fuseOK, hold: 0.05 } },
            { id: "fuse", reply: "p", say: "Pop! The meter's fuse blew. It burns out so the meter does not. Click the meter: New fuse.",
              highlight: { part: "meter" }, hints: [{ say: "Click the meter body. A card with a New fuse button appears next to it." }], waitFor: { event: "replace", id: "meter" } },
            { id: "right", say: "Voltage is across a part, current goes through it. Now measure this LED's current the right way.",
              hints: [{ say: "The loop is open. Close the gap with the meter, so the current flows through it." }, RING(V.hs(...V.L.at))],
              waitFor: { when: reads } },
            Object.assign(FINISH("Before you measure, check the dial and the red lead. mA goes in the path, never across."),
              { note: "a blown meter fuse must be replaced with the same kind. Set the dial and the red lead before the probes touch anything." }),
          ],
          goals: [{ text: "Measure the LED's current", when: reads }],
          react: [{ hold: 1.2, when: (S, C) => (C.beat && C.beat.id === "right" && !reads(S) ? ampsWhy(S, part(S, "led1")) : null) }],
          challenge: { text: "Then measure the battery's voltage, with the meter set right", when: (S) => mode(S, "V") && M(S).socket === "VO" && on(S, "bb:+T", "bb:-T") && Math.abs(volts(S) || 0) > 5.5 },
          solution: [{ choose: "right" }, { probe: V.hs("+T12", "-T12") }, { wait: 0.6 }, { probe: [null, null] }, { replace: "meter" }, { probe: V.hs(...V.L.at) }, { wait: 1 }, { dial: "V" }, { socket: "VO" }, { probe: V.hs("+T12", "-T12") }, { wait: 0.5 }, { next: 1 }],
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
        const P = V.predict(["More", "Less", "The same"], 1, ["a bigger resistor holds back more, so less current flows.", null, "the resistor sets how much flows: another size, another current."]), seen = {};
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
          ui: { strips: true },
          goalsFrom: 4,
          beats: [
            { id: "p", say: "Resistors come in sizes, measured in ohms (Ω); 1 kΩ is 1000 Ω. This one is 220 Ω. With a bigger resistor, more or less current?",
              highlight: { part: "res1" }, predict: P, waitFor: { predict: true } },
            { id: "r470", say: "Find out: swap in the 470 Ω resistor from the tray. Watch the meter and the LED.",
              hints: [{ say: "Click the resistor and press Remove. Then drag the 470 Ω one into the same holes." }], waitFor: { when: rec(470) } },
            { id: "r1k", say: () => `${fmtmA(seen[470] || 0.0085)} with 470 Ω. Now try the 1 kΩ one: that is 1000 Ω.`, waitFor: { when: rec(1000) } },
            { id: "name", reply: "p", say: () => `220 Ω ${fmtmA(seen[220] || 0.018)}, 470 Ω ${fmtmA(seen[470] || 0.0085)}, 1 kΩ ${fmtmA(seen[1000] || 0.004)}. Bigger holds back more: less flow.`,
              highlight: { lcd: "meter" }, waitFor: NEXT },
            { id: "use", say: "Your turn: make the LED as bright as you can, but keep the current under 15 mA. Which resistor?",
              hints: [{ say: "220 Ω let more than 15 mA through. 470 Ω gave far less. Which size lies between?" }], waitFor: { when: pick, hold: 0.6 } },
            FINISH("Choosing the resistor sets the current. That is how you make an LED just as bright as you want."),
          ],
          goals: [{ text: "The brightest LED under 15 mA", when: pick }],
          react: [{ when: (S, C) => {
            if (!C.beat || C.beat.id !== "use" || !reads(S)) return null;
            const i = Math.abs(M(S).value);
            return i < 0.0099 ? `Lit, but only ${fmtmA(i)}: you can go brighter and still stay under 15 mA.` : i > 0.0151 ? `${fmtmA(i)}: over 15 mA. Hold it back a little more.` : null;
          } }],
          challenge: { text: "Pick the right resistor on the first try", final: (C) => (C.count.place || 0) <= 3,
              when: (S) => { rec(220)(S); return false; } },
          solution: [{ choose: "right" }, { remove: "res1" }, RES(470), { wait: 0.6 }, { remove: "resistor" }, RES(1000), { wait: 0.6 }, { next: 1 },
            { remove: "resistor" }, RES(330), { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-7", title: "Resistance", teaches: ["ohms"], uses: ["biggerR", "resistor", "loop", "strip", "rail", "polarity"], shifts: [0, 4],
      colors: ["red", "yellow", "green"], values: [330, 470],
      // which of the two lettered resistors is the safe one
      layouts: [{ safe: "B" }, { safe: "A" }],
      make: (V) => {
        const R = { [V.L.safe]: V.ohms, [V.L.safe === "A" ? "B" : "A"]: 22 }, ID = { A: "resA", B: "resB" };
        const tiny = "a small resistor holds back almost nothing. The bigger one is the safe one.";
        const P = V.predict(["Resistor A", "Resistor B"], V.L.safe === "A" ? 0 : 1, V.L.safe === "A" ? [null, tiny] : [tiny, null]);
        const reads = (S, t) => { const q = part(S, ID[t]); return !!q && S.across(q) && ohms(S) !== null && S.near(ohms(S), R[t], 0.03); };
        const ok = (S) => S.parts("led").some(safe);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.LED("led1", "c6", "c7"), V.WIRE("w1", "e7", "-T7"),
            Object.assign(V.RES("resA", "b12", "b15", R.A), { tag: "A" }), Object.assign(V.RES("resB", "g12", "g15", R.B), { tag: "B" }), METER("V")),
          rules: { tray: [], allow: allow({ ctl: ["meter", "bat"], dial: ["V", "mA", "ohm"], move: ["resA", "resB"], legs: ["resA", "resB"], remove: ["resA", "resB"], replace: ["led1"] }) },
          ui: { strips: true },
          beats: [
            { id: "lost", say: "These two resistors lost their labels. One keeps the LED safe, the other would burn it out. Which is which?",
              highlight: { parts: ["resA", "resB"] }, waitFor: NEXT },
            { id: "dial", say: "The meter can measure a resistor's size. Turn the dial to Ω, for ohms.",
              hints: [{ say: "Click the Ω mark next to the meter's dial.", highlight: { ctl: "mode:ohm", id: "meter" } }], waitFor: { when: (S) => mode(S, "ohm") } },
            { id: "measure", say: "Measure both resistors: one probe on each leg. On its own, a resistor needs no battery: the meter sends its own current.",
              hints: [RING(V.hs("c12", "c15")), RING(V.hs("h12", "h15"), "And resistor B.")],
              waitFor: { when: (S, m) => { if (reads(S, "A")) m.A = true; if (reads(S, "B")) m.B = true; return m.A && m.B; } } },
            { id: "p", say: `A is ${fmtR(R.A)}, B is ${fmtR(R.B)}. Which one keeps the LED safe?`, predict: P, waitFor: { predict: true } },
            { id: "use", reply: "p", say: "Put the safe one in the gap between the + rail and the LED.",
              highlight: { holes: V.hs("+T6", "a6") },
              hints: [{ say: "Drag the resistor so one leg is on the red + rail and the other in the LED's + strip." }, { show: [V.RES("h", "+T6", "a6", V.ohms)] }],
              waitFor: { when: ok, hold: 0.6 } },
            FINISH("Resistance is a resistor's size, in ohms. Measure with the battery off, or the part on its own: the battery's voltage confuses the meter."),
          ],
          goals: [{ text: "Light the LED safely", when: ok, hold: 0.6 }],
          challenge: { text: "Check your resistor with Ω where it sits, battery off", when: (S) => {
              const q = part(S, ID[V.L.safe]), b = S.battery();
              return !!q && !!b && b.part.on === false && q.nets.includes("bb:+T") && S.across(q) && ohms(S) !== null && S.near(ohms(S), R[V.L.safe], 0.05);
            } },
          solution: [{ next: 1 }, { dial: "ohm" }, { probe: V.hs("c12", "c15") }, { probe: V.hs("h12", "h15") }, { choose: "right" },
            { move: ID[V.L.safe], to: V.hs("+T6", "a6") }, { wait: 1 }, { ctl: "bat" }, { probe: V.hs("+T8", "b6") }, { wait: 0.5 }, { next: 1 }],
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
        const P = V.predict(["Across the LED", "Across the break", "Nowhere: nothing flows"], 1,
          ["with no current, no voltage drops across the LED. It shows up across the break.", null, "even with nothing flowing, the battery still pushes. Its voltage shows up across the break."]), seen = {};
        const gap = [V.n("bb:L7"), "bb:-T"], brk = V.hs("e7", "-T7");          // the break: the two holes the wire's ends were in
        const lit2 = (S) => lit(part(S, "led2"));
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.WIRE("wire1", "e7", "-T7"), ...V.L.parts(V), METER("V")),
          rules: { tray: [{ type: "wire", n: 1 }], allow: allow({ dial: ["V", "mA", "ohm"], move: ["wire2", "led2"], legs: ["wire2", "led2"] }) },
          ui: { strips: true },
          beats: [
            { id: "make", say: "A break is a place where the loop is cut, so current can't get through. A missing wire is one. Make one: take this wire out.",
              highlight: { part: "wire1" }, allow: { remove: ["wire1"] },
              hints: [{ say: "Click the wire and press Remove, or drag it onto the parts tray." }], waitFor: { event: "remove", id: "wire1" } },
            { id: "p", say: "The dots stopped: the break is where the wire was. With the meter on V, where will you read most of the voltage (the push)?",
              highlight: { holes: brk }, predict: P, waitFor: { predict: true } },
            { id: "led", say: "Find out. First measure across the LED: one probe on each side of it.",
              hints: [RING(V.hs("d6", "d7"))],
              waitFor: { when: (S) => { const ok = across(S, "led1") && Math.abs(volts(S)) < 0.3; if (ok) seen.led = volts(S); return ok; } } },
            { id: "brk", say: () => `${fmtV(seen.led || 0)} across the LED. Now measure across the break: one probe in each hole where the wire's ends were.`,
              highlight: { holes: brk }, hints: [RING(brk)],
              waitFor: { when: (S) => { const ok = on(S, ...gap) && Math.abs(volts(S) || 0) > 2.5; if (ok) seen.gap = volts(S); return ok; } } },
            { id: "find", reply: "p", say: () => `${fmtV(seen.gap || 4.6)} across the break: most of the 6 V. The ${K.COLOR_WORD[V.c2]} LED has a hidden break: find it and close it.`,
              highlight: { part: "led2" },
              hints: [{ say: "Follow its loop from + to −. Measure across each place where one part should join the next. Most of the voltage there: the break." },
                RING(V.hs(...V.L.find), "Try here: probes in the rings."),
                { say: `${V.L.hint} One wire there closes the loop.`, show: [V.WIRE("h", ...V.hs(...V.L.fix))] }],
              waitFor: { when: lit2 } },
            FINISH("That's break hunting: with no current, no voltage drops across the parts, so most of it shows up across the break."),
          ],
          goals: [{ text: `Light the ${K.COLOR_WORD[V.c2]} LED`, when: lit2, hold: 0.6 }],
          challenge: { text: "Find the break with the meter before you fix it", when: (S, m) => {
              const row = (h) => BBShared.parse(h).row;
              if (!lit2(S) && Math.abs(volts(S) || 0) > 2.5 && !on(S, "bb:+T", "bb:-T") && probes(S) && [M(S).red, M(S).com].some((h) => row(h) >= V.r(12))) m.found = true;
              return !!m.found && lit2(S);
            } },
          solution: [{ remove: "wire1" }, { choose: "right" }, { probe: V.hs("d6", "d7") }, { probe: brk }, { wait: 0.4 },
            { probe: V.hs(...V.L.find) }, { wait: 0.6 }, { wire: V.hs(...V.L.fix) }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-9", title: "The beep", teaches: ["continuity"], uses: ["volts", "strip", "gap", "loop", "rail", "resistor", "polarity", "switch"], shifts: [0, 3, 6],
      // which of the three wires is broken inside
      layouts: [{ broken: "w2" }, { broken: "w1" }, { broken: "w3" }],
      make: (V) => {
        const P = V.predict(["Yes", "No"], 1, ["the centre gap splits each column into two strips that are not joined.", null]), WIRES = ["w1", "w2", "w3"], seen = {};
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
              hints: [RING(V.hs("a16", "a17"), "Same letter, columns next to each other: for example these.")], waitFor: { when: (S) => beat(S, false) } },
            { id: "p", say: `No beep: not joined. Would it beep from e${V.r(16)} to f${V.r(16)}, across the centre gap?`, highlight: { holes: V.hs("e16", "f16") },
              predict: P, waitFor: { predict: true } },
            { id: "find", reply: "p", say: "One of these wires is broken inside. Find it, swap it, switch on.",
              highlight: { parts: WIRES }, allow: { ctl: ["meter", "bat"], remove: WIRES },
              hints: [{ say: "Put a probe at each end of a wire. A good wire beeps. The broken one stays quiet." },
                { say: "Take the quiet wire off, put a new one in its holes, then switch the battery on." }, { highlight: { part: V.L.broken } }],
              waitFor: { when: (S) => anyLit(S) } },
            FINISH("A wire can look fine and still be broken inside. The beep tells you the truth."),
          ],
          goals: [{ text: "Light the LED", when: (S) => anyLit(S), hold: 0.6 }],
          challenge: { text: "Find the broken wire without pulling out a good one", final: () => !seen.pulled,
              when: (S) => { if (WIRES.some((id) => id !== V.L.broken && !part(S, id))) seen.pulled = true; return false; } },
          solution: [{ dial: "cont" }, { probe: V.hs("a16", "d16") }, { probe: V.hs("a16", "a17") }, { choose: "right" }, { probe: V.hs(...PROBE[V.L.broken]) }, { wait: 0.5 },
            { remove: V.L.broken }, { wire: V.hs(...ENDS[V.L.broken]) }, { ctl: "bat" }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-10", title: "Detective", teaches: [], uses: ["volts", "across", "break", "continuity", "loop", "strip", "rail", "polarity", "resistor"], shifts: [0, 4, 8],
      card: { name: "Measure first", text: "Before you change anything, measure. Where most of the voltage shows up, or a wire stays quiet, there is your fault." },
      colors: ["red", "yellow", "green"],
      // the fault: the LED one strip off (seed 0: it needs the meter most), a wire broken inside, or the LED the wrong way round. Probes that show it; the one-change fix.
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c7", "c8"), V.WIRE("wire1", "e8", "-T8")],
          show: ["b6", "b7"], fix: { wire: ["d6", "d7"] }, hint: "Follow the loop strip by strip. Is each part's leg in the same strip as the next part?" },
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"), Object.assign(V.WIRE("wire1", "e7", "-T7"), { broken: true })],
          show: ["b7", "-T9"], fix: { wire: ["d7", "-T12"] }, hint: "Is every wire really joining its two ends? The beep can tell." },
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c7", "c6"), V.WIRE("wire1", "e7", "-T7")],
          show: ["b6", "b7"], fix: { flip: "led1" }, hint: "Look at each LED leg. Which way should the longer + leg face?" },
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
          beats: [
            { id: "case", say: V.say("This one should light, but it doesn't. Use the meter to find out why, then fix it.",
              "A dark LED, and no idea why. Find the fault with the meter, then fix it."),
              hints: [{ say: "Measure the voltage across each part and each join. Where most of it shows up, look closely." }, { say: V.L.hint }],
              waitFor: { when: ok } },
            FINISH("Case closed. Measure first, then change things: that is how you fix any circuit."),
          ],
          goals: [{ text: "Light the LED", when: ok, hold: 0.6 }],
          challenge: { text: "Find the fault with the meter, then fix it with one change", when: (S, m, C) => {
              const quiet = mode(S, "cont") && !M(S).beep && on(S, ...show);
              if (!changes(C) && ((on(S, ...show) && Math.abs(volts(S) || 0) > 2.5) || quiet)) m.found = true;
              return !!m.found && ok(S) && changes(C) <= 1;
            } },
          solution: [{ probe: V.hs(...V.L.show) }, { wait: 0.6 }, fix, { wait: 1 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(2, "Measuring", L, {
    lede: "So far you could only see whether an LED lit. Now you get a tool that measures what the eye cannot see.", cover: "volts",
    questions: ["Why is one LED dimmer than another, with the same parts?", "How is the battery's voltage shared out among the parts in a loop?",
      "Does an LED use up current, so less comes out than goes in?"],
    words: [
      { w: "Multimeter", d: "A meter that measures voltage, current or resistance. Its dial chooses which.", sym: "VΩ" },
      { w: "Probes", d: "The meter's two leads. The red one goes where you measure; the black one (COM) is what you compare with.", sym: "probes" },
      { w: "Voltage (V)", d: "The push that drives current, measured in volts (V). Always across a part, or between two points.", sym: "V" },
      { w: "Milliamp (mA)", d: "Current is counted in amps; a milliamp is a thousandth of one. Measured through the meter: the current flows through it.", sym: "mA" },
      { w: "Ohm (Ω)", d: "How much a resistor holds the current back. 1 kΩ (a kilo-ohm) is 1000 Ω.", sym: "resistor" },
      { w: "Fuse", d: "A thin wire inside the meter that burns through when far too much current flows, to save the meter.", sym: "fuse" },
    ],
  });
  // The meter checks and helpers, for the later chapters.
  K.meter = { net, M, mode, probes, on, volts, ohms, amps, across, fmtV, fmtR, fmtmA, RING, METER, allow, REGION, NEXT };
})(window.BB = window.BB || {});
