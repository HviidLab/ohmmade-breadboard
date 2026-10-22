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
  // A reading as the meter's display shows it (the same digits, without the sign). When Sparky quotes back what the
  // player measured, he must say exactly what the meter showed, not a rounded or typical value.
  const shownV = (v) => { const a = Math.abs(v); return `${a < 10 ? a.toFixed(2) : a.toFixed(1)} V`; };
  const shownmA = (i) => { const m = Math.abs(i) * 1000; return `${m < 10 ? m.toFixed(2) : m.toFixed(1)} mA`; };
  const shownR = (r) => (r >= 1e6 ? `${(r / 1e6).toFixed(2)} MΩ` : r >= 1000 ? `${(r / 1000).toFixed(2)} kΩ` : `${r.toFixed(1)} Ω`);
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
            { id: "dial", say: "Let's measure with the multimeter. Click V⎓ beside its dial. Voltage is the push that drives current, in volts (V).", highlight: { ctl: "mode:V", id: "meter" },
              hints: [{ say: "Click the V⎓ mark next to the meter's dial.", highlight: { ctl: "mode:V", id: "meter" } }], waitFor: { when: (S) => mode(S, "V") } },
            { id: "top", say: "Measure the top battery's voltage: drag one probe tip onto its + rail, the other onto its − rail.",
              hints: [RING(V.hs("+T10", "-T10"), "The top battery feeds the two rails along the top edge. Try the rings.")],
              waitFor: { when: (S) => { if (top(S)) seen.top = volts(S); return top(S); } } },
            { id: "bottom", say: () => `${shownV(seen.top ?? 6)} at the top${(seen.top ?? 1) < 0 ? " (minus: red is on −)" : ""}. Now measure the bottom battery the same way, on the bottom rails.`,
              hints: [RING(V.hs("+B10", "-B10"))], waitFor: { when: (S) => { if (bottom(S)) seen.bottom = volts(S); return bottom(S); } } },
            { id: "fix", reply: "q", say: () => `${shownV(seen.bottom ?? 3)} at the bottom: half, so less current. Drag its two wires' rail ends up to the top rails: + to +, − to −.`,
              hints: [{ say: "These two wires join the bottom LED's loop to the 3 V pack. Which battery should they reach?", highlight: { parts: ["wa", "wb"] } },
                { say: "Press right on a wire's end and drag it up to a top rail: + end to the + rail, − end to the − rail." },
                { show: [V.WIRE("h1", "+T14", "j5"), V.WIRE("h2", "f9", "-T14")] }],
              waitFor: { when: bright } },
            Object.assign(FINISH("Voltage is the push. More voltage drives more current round the loop, and the LED glows brighter."),
              { note: "a new pack of 4 AA cells reads about 6.3 V, a used one less. Rechargeable NiMH cells give about 4.8 V; never fit 3.7 V lithium cells." }),
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
        const blueRes = (S) => { const ok = blue(S) && across(S, "res1") && Math.abs(volts(S)) > 2.6 && Math.abs(volts(S)) < 3.4; if (ok) seen.b = volts(S); return ok; };
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
            { id: "both", reply: "p1", say: () => `${shownV(seen.r ?? 4)} across the resistor. Now measure across the LED, and across the wire.`,
              hints: [RING(V.hs(...V.L.led)), RING(V.hs(...V.L.wire), "And the wire: one probe at each end.")],
              waitFor: { when: (S, m) => {
                if (across(S, "led1")) { m.l = true; seen.l = volts(S); }
                if (across(S, "wire1")) { m.w = true; seen.w = volts(S); }
                return m.l && m.w;
              } } },
            { id: "p2", say: () => `Resistor ${shownV(seen.r ?? 4)}, LED ${shownV(seen.l ?? 2)}, wire ${shownV(seen.w ?? 0)}: together the battery's voltage. A blue LED needs about 3 V. How much across the resistor?`,
              highlight: { lcd: "meter" }, predict: P2, waitFor: { predict: true } },
            { id: "blue", say: `Find out: swap the ${K.COLOR_WORD[V.c1]} LED for the blue one from the tray. Then measure the voltage across the resistor again.`,
              allow: { remove: ["led1"] },
              hints: [{ say: `Click the ${K.COLOR_WORD[V.c1]} LED, press Remove, then drag the blue one into its holes, its longer leg where the old longer leg was.` },
                RING(V.hs(...V.L.res))],
              waitFor: { when: blueRes } },
            Object.assign(FINISH(() => `${shownV(seen.b ?? 3)} across the resistor, so about 3 V across the blue LED. The voltages across the parts of a loop add up to the battery's voltage.`),
              { reply: "p2" }),
          ],
          goals: [{ text: "Measure the voltage across the resistor, with the blue LED in", when: blueRes }],
          // the swap is done: Sparky says what is left to do in this step
          react: [{ hold: 1, when: (S, c) => (c.beat && c.beat.id === "blue" && blue(S) && !blueRes(S)
            ? "The blue LED is lit. Now measure the voltage across the resistor: one probe on each side of it." : null) }],
          challenge: { text: "Measure the voltage across the blue LED too", when: (S) => { const q = S.parts("led").find((x) => x.part.color === "blue" && lit(x)); return !!q && S.across(q) && volts(S) !== null && Math.abs(volts(S)) > 2.5; } },
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
            { id: "close", say: "Now close the gap with the meter: one probe in each strip of the gap, so the current flows through it.",
              hints: [{ say: "Current leaves the battery's + and should go into the meter through the red probe. So red goes on the + side." }, RING(V.hs(...V.L.at))],
              waitFor: { when: (S) => { if (reads(S)) { seen.i = M(S).value; } return reads(S); } } },
            { id: "p", say: () => `${shownmA(seen.i ?? 0.012)}: that many thousandths of an amp flow round${(seen.i ?? 1) < 0 ? " (the minus: red is on the − side)" : ""}. What if you pull out a probe?`,
              highlight: { lcd: "meter" }, predict: P, waitFor: { predict: true } },
            Object.assign(FINISH("The meter is part of the loop now. Pull a probe out and see the dots stop everywhere."),
              { reply: "p", note: "after measuring current, move the red lead back to VΩ and the dial to OFF, or the next voltage check blows the fuse." }),
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
            { id: "before", say: "Find out. The meter is set for mA. Take this wire out and close its gap with the meter, red probe nearer the +.", highlight: { part: "w2" },
              allow: { remove: ["w2"] }, hints: [{ say: "Take the wire out and close the gap with the meter, red probe on the side nearer the +." }, RING(V.hs(...AT.w2))],
              waitFor: { when: rec("w2") } },
            { id: "after", say: () => `${shownmA(seen.w2 ?? 0.012)} before the LED. Put that wire back, then measure after the LED, in place of this wire.`,
              highlight: { part: "w3" }, allow: { remove: ["w3"] },
              hints: [{ say: "Drag the wire from the tray back into its two holes. Then take out the marked wire and put the meter there." }, RING(V.hs(...AT.w3))],
              waitFor: { when: rec("w3") } },
            { id: "same", reply: "p", say: () => `${shownmA(seen.w3 ?? 0.012)} after, ${shownmA(seen.w2 ?? 0.012)} before: the same! About 2 V drops across the LED, yet no charge is lost: each bit just carries less energy.`,
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
            { id: "right", say: "Voltage is across a part, current goes through it. Now close the loop's gap with the meter: one probe on each side.",
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
        const P = V.predict(["More", "Less", "The same"], 1, ["a bigger resistor holds back more, so less current flows.", null, "the resistor sets how much flows: another value, another current."]), seen = {};
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
            { id: "p", say: "Resistors come in sizes, in ohms (Ω), not by how big they look. 1 kΩ is 1000 Ω. This is 220 Ω. With a bigger one, more or less current?",
              highlight: { part: "res1" }, predict: P, waitFor: { predict: true } },
            { id: "r470", say: "Find out: click the 220 Ω and press Remove, then drag the 470 Ω into the same holes. Watch the meter and the LED.",
              hints: [{ say: "Click the resistor and press Remove. Then drag the 470 Ω one into the same holes." }], waitFor: { when: rec(470) } },
            { id: "r1k", say: () => `${shownmA(seen[470] ?? 0.0085)} with 470 Ω. Now swap in the 1 kΩ one, that is 1000 Ω, the same way.`, waitFor: { when: rec(1000) } },
            { id: "name", reply: "p", say: () => `220 Ω ${shownmA(seen[220] ?? 0.018)}, 470 Ω ${shownmA(seen[470] ?? 0.0085)}, 1 kΩ ${shownmA(seen[1000] ?? 0.004)}. Bigger holds back more: less current.`,
              highlight: { lcd: "meter" }, waitFor: NEXT },
            { id: "use", say: "Your turn: put in the resistor that makes the LED brightest while the meter stays under 15 mA.",
              hints: [{ say: "220 Ω let more than 15 mA through. 470 Ω gave far less. Which value lies between?" }], waitFor: { when: pick, hold: 0.6 } },
            FINISH("Choosing the resistor sets the current. That is how you make an LED just as bright as you want."),
          ],
          goals: [{ text: "The brightest LED under 15 mA", when: pick }],
          react: [{ when: (S, C) => {
            if (!C.beat || C.beat.id !== "use" || !reads(S)) return null;
            const i = Math.abs(M(S).value);
            return i < 0.0099 ? `Lit, but only ${shownmA(i)}: you can go brighter and still stay under 15 mA.` : i > 0.0151 ? `${shownmA(i)}: over 15 mA. Hold it back a little more.` : null;
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
        const R = { [V.L.safe]: V.ohms, [V.L.safe === "A" ? "B" : "A"]: 22 }, ID = { A: "resA", B: "resB" }, seen = {};
        const tiny = "a small resistor holds back too little: far too much current flows. The bigger one is the safe one.";
        const P = V.predict(["Resistor A", "Resistor B"], V.L.safe === "A" ? 0 : 1, V.L.safe === "A" ? [null, tiny] : [tiny, null]);
        const reads = (S, t) => { const q = part(S, ID[t]), ok = !!q && S.across(q) && ohms(S) !== null && S.near(ohms(S), R[t], 0.03); if (ok) seen[t] = ohms(S); return ok; };
        const ok = (S) => S.parts("led").some(safe);
        // the safe resistor's own bands, for the Real bench note
        const bands = V.ohms === 470 ? "yellow, violet, brown is 470 Ω" : "orange, orange, brown is 330 Ω";
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
            { id: "p", say: () => `A reads ${shownR(seen.A ?? R.A)}, B reads ${shownR(seen.B ?? R.B)}. Which one keeps the LED safe?`, predict: P, waitFor: { predict: true } },
            { id: "use", reply: "p", say: "Put the safe one in the gap between the + rail and the LED. The battery must be on, so the LED lights.",
              highlight: { holes: V.hs("+T6", "a6") },
              hints: [{ say: "Drag the resistor so one leg is on the red + rail and the other in the LED's + strip." }, { show: [V.RES("h", "+T6", "a6", V.ohms)] }],
              waitFor: { when: ok, hold: 0.6 } },
            Object.assign(FINISH("Resistance is a resistor's size, in ohms. Measure with the battery off, best with the part out: the battery and other parts fool the meter."),
              { note: `real resistors show their value in colour bands: ${bands}. The meter checks the bands.` }),
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
      // which wire of the second LED's loop is broken inside: the one to the − rail, or the one from the + rail
      layouts: [{ broken: "wire2b" }, { broken: "wire2a" }],
      make: (V) => {
        const P = V.predict(["Across the LED", "Across the break", "Nowhere: nothing flows"], 1,
          ["with no current, no voltage drops across the LED. It shows up across the break.", null, "even with nothing flowing, the battery still pushes. Its voltage shows up across the break."]), seen = {};
        const gap = [V.n("bb:L7"), "bb:-T"], brk = V.hs("e7", "-T7");          // the break: the two holes the wire's ends were in
        const c1 = K.COLOR_WORD[V.c1], c2 = K.COLOR_WORD[V.c2], BRK = V.L.broken;
        // the second LED's loop: + rail, wire, resistor, LED, wire, − rail. Its ends, and holes for a probe at each end of a wire.
        const ENDS = { wire2a: ["+T12", "a12"], wire2b: ["e16", "-T16"] }, PROBE = { wire2a: ["+T11", "d12"], wire2b: ["d16", "-T18"] };
        const LOOP = ["wire2a", "res2", "led2", "wire2b"];
        const wire = (id) => Object.assign(V.WIRE(id, ...ENDS[id]), id === BRK ? { broken: true } : {});
        const lit2 = (S) => lit(part(S, "led2"));
        const found = (S) => { const q = part(S, BRK), ok = !!q && S.across(q) && Math.abs(volts(S) || 0) > 2.5; if (ok) seen.found = volts(S); return ok; };
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"),
            wire("wire2a"), V.RES("res2", "b12", "b15"), V.LED("led2", "c15", "c16", V.c2), wire("wire2b"), METER("V")),
          rules: { tray: [{ type: "wire", n: 1 }], allow: allow({ dial: ["V"], socket: ["VO"], remove: ["wire2a", "wire2b"], move: ["wire2a", "wire2b"], legs: ["wire2a", "wire2b"] }) },
          ui: { strips: true },
          beats: [
            { id: "p", say: `A break is where the loop is cut. The ${c1} LED's wire is missing: a break. On V, where will the meter read most of the voltage?`,
              highlight: { holes: brk }, predict: P, waitFor: { predict: true } },
            { id: "led", say: `Find out. First measure across the ${c1} LED: one probe on each side of it.`, highlight: { part: "led1" },
              hints: [RING(V.hs("d6", "d7"))],
              waitFor: { when: (S) => { const ok = across(S, "led1") && Math.abs(volts(S)) < 0.3; if (ok) seen.led = volts(S); return ok; } } },
            { id: "brk", say: () => `${shownV(seen.led ?? 0)} across the ${c1} LED. Now measure across the break: one probe in each hole where the wire's ends belong.`,
              highlight: { holes: brk }, hints: [RING(brk)],
              waitFor: { when: (S) => { const ok = on(S, ...gap) && Math.abs(volts(S) || 0) > 2.5; if (ok) seen.gap = volts(S); return ok; } } },
            { id: "rule", reply: "p", say: () => `${shownV(seen.gap ?? 4.6)} across the break, about 0 V across the LED: with no current, a part that works has no voltage across it.`,
              waitFor: NEXT },
            { id: "find", say: `The ${c2} LED's loop has a break you can't see: a wire broken inside. Find it by measuring across each part, then swap it.`,
              highlight: { parts: LOOP },
              hints: [{ say: "Across a part: one probe at each end of it. Try the parts one by one. The broken one has most of the voltage.", highlight: { parts: LOOP } },
                RING(V.hs(...PROBE[BRK]), "Try this wire: probes in the rings."),
                { say: "Click the broken wire, press Remove, then put a new wire from the tray in the same two holes.", show: [V.WIRE("h", ...ENDS[BRK])] }],
              waitFor: { when: lit2, hold: 0.6 } },
            FINISH("Break hunting: look for most of the voltage. Not all 6 V: the meter's tiny current flows through the LED, so it has about 1.4 V across it."),
          ],
          goals: [{ text: `Light the ${c2} LED`, when: lit2, hold: 0.6 }],
          // Sparky reads the meter with the player: the other LED; a part of the loop that works, or the broken wire
          react: [{ hold: 0.8, when: (S, c) => {
            const id = c.beat && c.beat.id, v = volts(S);
            if (v === null) return null;
            if (id === "led" && S.across(part(S, "led2"))) return `That's the ${c2} LED. Measure across the ${c1} one, whose wire you took out.`;
            if (id !== "find") return null;
            if (found(S)) return `${shownV(v)} across this wire: most of the voltage, so it's the broken one. Swap it for a new wire from the tray, in the same holes.`;
            const q = LOOP.filter((x) => x !== BRK).map((x) => part(S, x)).find((x) => x && S.across(x));
            return q && Math.abs(v) < 0.3 ? `About 0 V across this ${q.type === "led" ? "LED" : q.type}: it works, so the break is not here. Try another part.` : null;
          } }],
          challenge: { text: "Find the broken wire with the meter before you take any wire out", when: (S, m) => {
              if (!m.found && LOOP.some((x) => x.startsWith("wire") && !part(S, x))) m.pulled = true;
              if (found(S)) m.found = true;
              return !!m.found && !m.pulled && lit2(S);
            } },
          solution: [{ choose: "right" }, { probe: V.hs("d6", "d7") }, { probe: brk }, { wait: 0.4 }, { next: 1 },
            { probe: V.hs("d12", "d15") }, { wait: 0.6 }, { probe: V.hs(...PROBE[BRK]) }, { wait: 0.6 },
            { remove: BRK }, { wire: V.hs(...ENDS[BRK]) }, { wait: 1 }, { next: 1 }],
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
            { id: "same", say: "The battery is off: the beep uses the meter's own tiny current. Turn the dial to the beep, ·))), and put both probes in one group of 5.",
              hints: [{ say: "Click ·))) next to the meter's dial.", highlight: { ctl: "mode:cont", id: "meter" } }, RING(V.hs("a16", "d16"), "Then, for example, these two holes.")],
              waitFor: { when: (S) => beat(S, true) } },
            { id: "next", say: `Beep: those holes are joined by metal. Now probe two groups side by side on the same half, like ${V.h("a16")} and ${V.h("a17")}.`,
              hints: [RING(V.hs("a16", "a17"), "Same letter, columns next to each other: for example these.")], waitFor: { when: (S) => beat(S, false) } },
            { id: "p", say: `No beep: not joined. Would it beep from e${V.r(16)} to f${V.r(16)}, across the centre gap?`, highlight: { holes: V.hs("e16", "f16") },
              predict: P, waitFor: { predict: true } },
            { id: "find", reply: "p", say: "One of these wires is broken inside. Find it with the beep, swap it for a new wire, then switch the battery on.",
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
      id: "2-10", title: "The traffic light", teaches: [], uses: ["volts", "across", "break", "continuity", "loop", "strip", "rail", "polarity", "resistor"], shifts: [0, 4, 8],
      card: { name: "Measure first", text: "A part can look fine and be broken inside. Measure across each part: where most of the voltage shows up, there is your fault." },
      // a toy traffic light, one loop per lamp: red, yellow, green from the top. Which loop's wire and which loop's LED are broken inside.
      layouts: [{ wire: 0, led: 2 }, { wire: 2, led: 1 }, { wire: 1, led: 0 }],
      make: (V) => {
        const COLS = ["red", "yellow", "green"], ROW = [6, 10, 14];
        const W = V.L.wire, D = V.L.led, OK = [0, 1, 2].find((k) => k !== W && k !== D), w = K.COLOR_WORD[COLS[OK]];
        // loop k: + rail, resistor, LED, wire, − rail. Its parts' holes, and holes for a probe across the wire and across the LED.
        const ends = (k) => { const r = ROW[k]; return { res: [`+T${r}`, `a${r}`], led: [`c${r}`, `c${r + 1}`], wire: [`e${r + 1}`, `-T${r + 1}`] }; };
        const probeWire = (k) => [`d${ROW[k] + 1}`, `-T${ROW[k] + 2}`], probeLed = (k) => [`d${ROW[k]}`, `d${ROW[k] + 1}`];
        const loop = (k) => [V.RES(`res${k + 1}`, ...ends(k).res), Object.assign(V.LED(`led${k + 1}`, ...ends(k).led, COLS[k]), k === D ? { broken: true } : {}),
          Object.assign(V.WIRE(`wire${k + 1}`, ...ends(k).wire), k === W ? { broken: true } : {})];
        const BROKEN = [`wire${W + 1}`, `led${D + 1}`], PARTS = [1, 2, 3].flatMap((n) => [`res${n}`, `led${n}`, `wire${n}`]);
        const GOOD = PARTS.filter((id) => !BROKEN.includes(id));
        const allLit = (S) => COLS.every((c) => S.parts("led").some((q) => q.part.color === c && lit(q)));
        const P = V.predict(["The battery is flat", "A wire is missing", "A part is broken inside"], 2,
          [`the ${w} LED lights from the same battery, so the battery still pushes.`, "follow each loop: + rail, resistor, LED, wire, − rail. Nothing is missing.", null]);
        // the part whose two strips the probes are in: exactly, or through strips joined by wires
        const probed = (S) => {
          const p = probes(S);
          if (!p || p[0] === p[1]) return null;
          const qs = S.all.filter((q) => ["led", "resistor", "wire"].includes(q.type));
          return qs.find((q) => (q.nets[0] === p[0] && q.nets[1] === p[1]) || (q.nets[0] === p[1] && q.nets[1] === p[0])) || qs.find((q) => S.across(q)) || null;
        };
        const name = (q) => (q.type === "led" ? "LED" : q.type);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), ...loop(0), ...loop(1), ...loop(2), METER("V")),
          rules: { tray: [{ type: "wire", n: 1 }, ...COLS.map((color) => ({ type: "led", color, n: 1 }))],
            allow: allow({ ctl: ["meter", "bat"], dial: ["V", "cont", "ohm"], socket: ["VO"], move: PARTS, legs: PARTS, flip: PARTS.filter((id) => id.startsWith("led")), remove: PARTS }), banner: true },
          ui: { strips: true },
          starAt: "find",              // the third star's note goes with the step where the player hunts for the broken parts
          beats: [
            { id: "p", say: `A toy traffic light: three LEDs for its lamps, each in its own loop. Only the ${w} one lights, and nothing looks wrong. Why?`,
              predict: P, waitFor: { predict: true } },
            { id: "find", reply: "p", say: "A part can break inside and still look fine, even an LED. Two parts here are broken. Find them with the meter, and swap only those.",
              hints: [{ say: "Measure across each part of a dark loop, one probe at each end. A part that works has about 0 V. The broken one has most of it." },
                RING(V.hs(...probeWire(W)), "Try this wire: probes in the rings."), RING(V.hs(...probeLed(D)), "And this LED: probes in the rings."),
                { say: "Swap each one: click it, press Remove, then drag a new one from the tray into the same holes.",
                  show: [V.WIRE("h1", ...ends(W).wire), V.LED("h2", ...ends(D).led, COLS[D])] }],
              waitFor: { when: allLit, hold: 0.6 } },
            FINISH("Case closed. A part can look fine and be broken inside. Measure first: the broken one has most of the voltage."),
          ],
          goals: [{ text: "Light all three LEDs", when: allLit, hold: 0.6 }],
          // Sparky reads the meter with the player (the method from 2-8): 0 V across a good part with no current, most of the voltage across the broken one
          react: [{ hold: 0.8, when: (S) => {
            if (GOOD.some((id) => !part(S, id))) return "That part works, so the third star is gone this time. Put it back, and measure before you swap.";
            const q = probed(S);
            if (!q || allLit(S) || on(S, "bb:+T", "bb:-T")) return null;
            const b = S.battery(), off = b && b.part.on === false;
            if (mode(S, "cont")) {
              if (!off || q.type !== "wire" || M(S).display) return null;
              return M(S).beep ? "Beep: this wire joins its two ends. It works." : "No beep: this wire is broken inside. Swap it for a new one from the tray, in the same holes.";
            }
            const v = volts(S);
            if (v === null) return null;
            if (off) return "The battery is off, so there is no voltage to find. Switch it on to measure voltage, or use the beep.";
            if (BROKEN.includes(q.id) && Math.abs(v) > 2.5) return `${shownV(v)} across this ${name(q)}: most of the voltage, so it's broken inside. Swap it for a new one from the tray, in the same holes.`;
            if (Math.abs(q.rd.I || 0) > 1e-3) return `Current flows through this ${name(q)}, so its loop works. Look in a dark loop.`;
            if (Math.abs(v) < 0.3) return `About 0 V across this ${name(q)}: with no current, a part that works has no voltage across it. Try another part.`;
            return null;
          } }],
          challenge: { text: "Take out only the two broken parts, none that work",
            when: (S, m) => { if (GOOD.some((id) => !part(S, id))) m.pulled = true; return false; }, final: (C, m) => !m.pulled },
          solution: [{ choose: "right" }, { probe: V.hs(...probeWire(W)) }, { wait: 0.6 }, { remove: `wire${W + 1}` }, { wire: V.hs(...ends(W).wire) },
            { probe: V.hs(...probeLed(D)) }, { wait: 0.6 }, { remove: `led${D + 1}` }, { place: { type: "led", color: COLS[D] }, at: V.hs(...ends(D).led) },
            { wait: 1 }, { next: 1 }],
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
      { w: "Ohm (Ω)", d: "The unit of resistance, which is how much a part holds the current back. 1 kΩ (a kilo-ohm) is 1000 Ω.", sym: "resistor" },
      { w: "Fuse", d: "A thin wire inside the meter that burns through when far too much current flows, to save the meter.", sym: "fuse" },
    ],
  });
  // The meter checks and helpers, for the later chapters.
  K.meter = { net, M, mode, probes, on, volts, ohms, amps, across, fmtV, fmtR, fmtmA, shownV, shownmA, shownR, RING, METER, allow, REGION, NEXT };
})(window.BB = window.BB || {});
