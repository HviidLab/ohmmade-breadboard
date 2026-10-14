// Chapter 2: Measuring. The multimeter: volts, volts across a part, finding a break, milliamps in the path, the fuse,
// ohms with the power off, the continuity beep; then a detective level and a check-up.
// Data only, built with the kit from ch1.js (variants, helpers); see the design document (design/game-design.md).
// The meter stands to the right of the board (placed by the kit); `probe` steps in a solution put both tips at once.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { variant, start, lit, safe, part, anyLit, onOff, FINISH } = K;
  const VF = { red: 2.0, yellow: 2.1, green: 2.2, blue: 3.0, white: 3.1 };

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
  const nets = (q) => q.legs.map((h) => net(h));
  const fmtV = (v) => `${Math.abs(v) < 0.05 ? "0" : Math.abs(v).toFixed(1)} V`;
  const fmtR = (r) => (r >= 1000 ? `${+(r / 1000).toFixed(1)} kΩ` : `${Math.round(r)} Ω`);
  const fmtmA = (a) => `${Math.round(Math.abs(a) * 1000)} mA`;
  const NEXT = { next: true };

  const METER = (m = "V", socket = "VO") => ({ id: "meter", type: "meter", mode: m, socket, legs: [null, null] });
  const BASE = { probe: ["meter"], ctl: ["meter"] };
  const allow = (more) => Object.assign({}, BASE, more);

  const L = [
    {
      id: "2-1", title: "How hard does it push?", teaches: ["volts"], uses: ["loop", "rail", "switch"], shifts: [0, 4, 8],
      // which rail holes Sparky marks: near the battery, or far along the rails
      layouts: [{ at: 10 }, { at: 17 }],
      make: (V) => {
        const P = V.predict(["6 V", "0 V", "−6 V"], 1), at = V.L.at;
        const rails = (S) => on(S, "bb:+T", "bb:-T");
        return {
          region: { rows: V.rows([1, 20]), cols: "a-j", rails: "top" }, ui: { xray: true },
          start: start(V.BAT("+T3", "-T4"), METER("off")),
          rules: { tray: [], allow: allow({ ctl: ["meter", "bat"], dial: ["off", "V"], socket: ["VO"] }), guardMeter: true },
          goalsFrom: 2,
          beats: [
            { id: "meet", say: V.say("This is a multimeter. It measures things you cannot see. First: how hard does the battery push?",
              "Meet the multimeter. It shows you what you cannot see. Let's start with how hard the battery pushes."), highlight: { part: "meter" }, waitFor: NEXT },
            { id: "dial", say: "Turn the dial to V. V is for volts: the push.", highlight: { ctl: "mode:V", id: "meter" },
              hints: [{ say: "Click the V⎓ mark next to the meter's dial." }], waitFor: { when: (S) => mode(S, "V") } },
            { id: "probes", say: "Put the red probe in a + rail hole and the black probe in a − rail hole.", highlight: { nets: ["bb:+T", "bb:-T"] },
              hints: [{ say: "Drag the red probe's tip onto any hole of the red + rail, then the black one onto the blue − rail." }, { highlight: { holes: V.hs(`+T${at}`, `-T${at}`) } }],
              waitFor: { when: (S) => rails(S) && volts(S) > 5.5 } },
            { id: "p", say: "6 V: your battery pushes with 6 volts. What will the meter show if you switch the battery off?", highlight: { lcd: "meter" }, predict: P, waitFor: { predict: true } },
            { id: "off", say: "Find out: switch the battery off.", highlight: { ctl: "switch", id: "bat" },
              hints: [{ say: "The switch is the small slider on the battery box. Keep the probes on the rails." }],
              waitFor: { when: (S) => !onOff(S) && rails(S) && volts(S) !== null && Math.abs(volts(S)) < 0.05 } },
            FINISH((C) => `${C.right("p") ? "You called it: " : ""}0 V, no push. The meter always compares two points: red against black.`),
          ],
          goals: [{ text: "Measure the battery's push", when: (S) => rails(S) && volts(S) > 5.5 }],
          bonus: [
            { text: "Predict the reading with the battery off", final: (C) => C.right("p") },
            { text: "Swap the probes and see the minus sign", when: (S) => rails(S) && volts(S) < -5.5 },
          ],
          solution: [{ next: 1 }, { dial: "V" }, { probe: V.hs(`+T${at}`, `-T${at}`) }, { choose: "right" }, { ctl: "bat" }, { wait: 0.6 }, { ctl: "bat" },
            { probe: V.hs(`-T${at}`, `+T${at}`) }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-2", title: "Volts across a part", teaches: ["across"], uses: ["volts", "loop", "strip", "rail", "resistor", "polarity"], shifts: [0, 4, 8],
      colors: ["red", "green", "blue", "yellow"], values: [330, 470, 1000],
      // the resistor first or the LED first; where the probes go in the solution (red on the + side)
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.WIRE("wire1", "e7", "-T7")], res: ["+T10", "b6"], led: ["d6", "d7"], wire: ["b7", "-T10"] },
        { parts: (V) => [V.WIRE("wire1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.RES("res1", "e7", "-T7")], res: ["b7", "-T10"], led: ["d6", "d7"], wire: ["+T10", "b6"] },
      ],
      make: (V) => {
        const vf = Math.round(VF[V.c1]), P = V.predict(["About 0 V", `About ${vf} V`, "6 V"], 0), seen = {};
        const across = (S, id) => S.across(part(S, id)) && volts(S) !== null;
        return {
          region: { rows: V.rows([1, 20]), cols: "a-j", rails: "top" }, ui: { xray: true },
          start: start(V.BAT("+T3", "-T4"), ...V.L.parts(V), METER("V")),
          rules: { tray: [], allow: allow({ dial: ["V"], socket: ["VO"] }), guardMeter: true },
          goalsFrom: 0,
          beats: [
            { id: "res", say: "Volts are always between two points. Put a probe on each side of the resistor.", highlight: { part: "res1" },
              hints: [{ say: "One tip in a hole joined to one leg, the other tip in a hole joined to the other leg." }, { highlight: { holes: V.hs(...V.L.res) } }],
              waitFor: { when: (S) => { if (across(S, "res1")) seen.r = volts(S); return across(S, "res1"); } } },
            { id: "led", say: "Now put a probe on each side of the LED.", highlight: { part: "led1" },
              hints: [{ highlight: { holes: V.hs(...V.L.led) } }],
              waitFor: { when: (S) => { if (across(S, "led1")) seen.l = volts(S); return across(S, "led1"); } } },
            { id: "name", say: () => `About ${fmtV(seen.l || vf)} across the LED, ${fmtV(seen.r || 6 - vf)} across the resistor. Each part uses up some of the push.`,
              highlight: { lcd: "meter" }, waitFor: NEXT },
            { id: "p", say: "What will the meter read across the wire?", highlight: { part: "wire1" }, predict: P, waitFor: { predict: true } },
            { id: "wire", say: "Measure it.", highlight: { part: "wire1" }, hints: [{ highlight: { holes: V.hs(...V.L.wire) } }],
              waitFor: { when: (S) => across(S, "wire1") } },
            FINISH((C) => `${C.right("p") ? "Right: " : ""}almost 0 V. A wire uses no push. It just carries the current on to the next part.`),
          ],
          goals: [{ text: "Measure across the resistor, the LED and the wire", when: (S, m) => {
            for (const id of ["res1", "led1", "wire1"]) if (across(S, id)) m[id] = true;
            return m.res1 && m.led1 && m.wire1;
          } }],
          bonus: [
            { text: "Predict the reading across the wire", final: (C) => C.right("p") },
            { text: "Read the LED with no minus sign", when: (S) => across(S, "led1") && volts(S) > 1 },
          ],
          solution: [{ probe: V.hs(...V.L.res) }, { probe: V.hs(...V.L.led) }, { next: 1 }, { choose: "right" }, { probe: V.hs(...V.L.wire) }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-3", title: "Find the break", teaches: ["break"], uses: ["across", "volts", "loop", "strip", "rail", "gap", "resistor", "polarity"], shifts: [0, 3, 6],
      colors: ["red", "yellow", "green"],
      // the hidden fault in the second circuit: the wire one strip off, the wire below the centre gap, or the LED one strip off.
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
        const P = V.predict(["About 0 V", "About 2 V", "6 V"], 0), seen = {};
        const gap = [V.n("bb:L7"), "bb:-T"];
        const lit2 = (S) => lit(part(S, "led2"));
        return {
          region: { rows: V.rows([1, 20]), cols: "a-j", rails: "top" }, ui: { xray: true },
          start: start(V.BAT("+T3", "-T4"), V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"), ...V.L.parts(V), METER("V")),
          rules: { tray: [{ type: "wire", n: 2 }], allow: allow({ dial: ["V"], socket: ["VO"], move: ["wire2", "led2"], legs: ["wire2", "led2"] }), guardMeter: true },
          beats: [
            { id: "gap", say: "This loop is open, so nothing flows. Put one probe on each side of the gap.", highlight: { nets: gap },
              hints: [{ say: "One tip in a marked strip, the other on the blue − rail." }, { highlight: { holes: V.hs("b7", "-T10") } }],
              waitFor: { when: (S) => { const v = volts(S); if (on(S, ...gap) && v > 2.5) seen.gap = v; return on(S, ...gap) && v > 2.5; } } },
            { id: "p", say: () => `${fmtV(seen.gap || 4.6)} across the gap: almost the whole push, waiting there. What will it read across the LED?`,
              highlight: { lcd: "meter" }, predict: P, waitFor: { predict: true } },
            { id: "led", say: "Measure it.", highlight: { part: "led1" }, hints: [{ highlight: { holes: V.hs("d6", "d7") } }],
              waitFor: { when: (S) => S.across(part(S, "led1")) && volts(S) !== null && Math.abs(volts(S)) < 0.3 } },
            { id: "name", say: (C) => `${C.right("p") ? "Right: " : ""}0 V. Nothing flows, so the parts use no push. It all sits at the break.`, waitFor: NEXT },
            { id: "find", say: "The second LED is dark too, but its break is hidden. Find it with the meter, then fix it.", highlight: { part: "led2" },
              hints: [{ say: "Measure across each part and each join. Where almost the whole push shows up, there is the break." }, { say: V.L.hint },
                { show: [V.WIRE("h", ...V.hs(...V.L.fix))] }],
              waitFor: { when: lit2 } },
            FINISH("Measure across each part in turn. Where almost the whole push shows up, there is the break."),
          ],
          goals: [{ text: "Light the second LED", when: lit2, hold: 0.6 }],
          bonus: [
            { text: "Predict the reading across the LED", final: (C) => C.right("p") },
            { text: "Find the break with the meter before you fix it", when: (S, m) => {
              const p = probes(S), row = (h) => BBShared.parse(h).row;
              if (!lit2(S) && volts(S) > 2.5 && !on(S, "bb:+T", "bb:-T") && p && [M(S).red, M(S).com].some((h) => row(h) >= V.r(12))) m.found = true;
              return !!m.found && lit2(S);
            } },
          ],
          solution: [{ probe: V.hs("b7", "-T10") }, { choose: "right" }, { probe: V.hs("d6", "d7") }, { next: 1 }, { probe: V.hs(...V.L.find) }, { wait: 0.6 },
            { wire: V.hs(...V.L.fix) }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-4", title: "Count the flow", teaches: ["current"], uses: ["volts", "loop", "strip", "rail", "resistor", "polarity"], shifts: [0, 4, 8],
      colors: ["red", "yellow", "green", "blue"], values: [330, 470, 1000],
      // which wire the meter takes the place of; where its probes go (red on the + side)
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.WIRE("wire1", "e7", "-T7")], ends: ["bb:L7", "bb:-T"], at: ["b7", "-T10"] },
        { parts: (V) => [V.WIRE("wire1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.RES("res1", "e7", "-T7")], ends: ["bb:+T", "bb:L6"], at: ["+T10", "b6"] },
      ],
      make: (V) => {
        const P = V.predict(["The LED goes out", "Nothing", "The meter reads more"], 0), seen = {};
        const ends = V.L.ends.map((n) => V.n(n));
        const reads = (S) => lit(part(S, "led1")) && amps(S, part(S, "led1"));
        const setFor = (S) => mode(S, "mA") && M(S).socket === "mA";
        return {
          region: { rows: V.rows([1, 20]), cols: "a-j", rails: "top" }, ui: { xray: true },
          start: start(V.BAT("+T3", "-T4"), ...V.L.parts(V), METER("V")),
          rules: { tray: [], allow: allow({ dial: ["V", "mA"], socket: ["VO", "mA"] }), guardMeter: true },
          goalsFrom: 3,
          beats: [
            { id: "why", say: "Volts are the push. Now let's count the flow. For that, the current has to go through the meter.", highlight: { part: "meter" }, waitFor: NEXT },
            { id: "set", say: "Set the meter for current: turn the dial to mA, for milliamps, and move the red lead to the mA socket.",
              highlight: { ctl: ["mode:mA", "socket:mA"], id: "meter" },
              hints: [{ say: "Click mA next to the dial. Then click the mA socket at the bottom of the meter." }], waitFor: { when: setFor } },
            { id: "open", say: "Open the loop: take this wire out.", allow: { remove: ["wire1"] }, highlight: [{ part: "wire1" }, { ui: "#hotbar" }],
              hints: [{ say: "Drag the wire onto the parts tray, or click it and press Remove." }], waitFor: { event: "remove", id: "wire1" } },
            { id: "close", say: "Close the loop with the meter: one probe in each strip where the wire was.", highlight: { nets: ends },
              hints: [{ say: "The red probe goes on the side nearer the battery's +, the black probe on the other side." }, { highlight: { holes: V.hs(...V.L.at) } }],
              waitFor: { when: (S) => { if (reads(S)) seen.i = M(S).value; return reads(S); } } },
            { id: "p", say: () => `${fmtmA(seen.i || 0.012)}: that many thousandths of an amp flow round the loop. What happens if you pull out one probe?`,
              highlight: { lcd: "meter" }, predict: P, waitFor: { predict: true } },
            FINISH((C) => `${C.right("p") ? "Right: " : ""}the meter is part of the loop now. Try it! Then set the dial back to V and the red lead to VΩ.`),
          ],
          goals: [{ text: "Measure the LED's current", when: reads }],
          bonus: [
            { text: "Predict what happens if a probe comes out", final: (C) => C.right("p") },
            { text: "Set the meter back: dial to V, red lead to VΩ", when: (S, m) => { if (reads(S)) m.read = true; return !!m.read && mode(S, "V") && M(S).socket === "VO"; } },
          ],
          solution: [{ next: 1 }, { dial: "mA" }, { socket: "mA" }, { remove: "wire1" }, { probe: V.hs(...V.L.at) }, { wait: 1 }, { choose: "right" },
            { probe: [null, null] }, { dial: "V" }, { socket: "VO" }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-5", title: "The meter's fuse", teaches: ["fuse"], uses: ["current", "short", "volts", "loop", "rail", "resistor", "polarity"], shifts: [0, 4, 8],
      colors: ["red", "yellow", "green", "blue"], values: [330, 470, 1000],
      // where the loop is open, and where the meter closes it (red on the + side)
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7")], gap: ["bb:L7", "bb:-T"], at: ["b7", "-T10"] },
        { parts: (V) => [V.LED("led1", "c6", "c7"), V.RES("res1", "e7", "-T7")], gap: ["bb:+T", "bb:L6"], at: ["+T10", "b6"] },
      ],
      make: (V) => {
        const P = V.predict(["It reads 6 V", "A short circuit: something blows", "Nothing"], 1);
        const gap = V.L.gap.map((n) => V.n(n));
        const reads = (S) => lit(part(S, "led1")) && amps(S, part(S, "led1"));
        return {
          region: { rows: V.rows([1, 20]), cols: "a-j", rails: "top" }, ui: { xray: true },
          start: start(V.BAT("+T3", "-T4"), ...V.L.parts(V), METER("mA", "mA")),
          rules: { tray: [], allow: allow({ dial: ["V", "mA"], socket: ["VO", "mA"], replace: ["meter"] }), banner: true },
          allowDamage: true, simText: { meter: null },
          beats: [
            { id: "p", say: "Set for mA, the meter is almost a wire. What happens if you put it across the battery?", highlight: { part: "meter" }, predict: P, waitFor: { predict: true } },
            { id: "try", say: "Find out: red probe on the + rail, black probe on the − rail.", highlight: { nets: ["bb:+T", "bb:-T"] },
              hints: [{ highlight: { holes: V.hs("+T12", "-T12") } }], waitFor: { when: (S) => !!M(S) && !M(S).fuseOK, hold: 0.05 } },
            { id: "fuse", say: (C) => `${C.right("p") ? "You called it. " : ""}Pop! The meter's fuse blew. It burns out so the meter does not. Click the meter: New fuse.`,
              highlight: { part: "meter" }, hints: [{ say: "Click the meter body. A card with a New fuse button appears next to it." }], waitFor: { event: "replace", id: "meter" } },
            { id: "right", say: "Volts go across. Current goes through. Now measure this LED's current the right way.", highlight: { nets: gap },
              hints: [{ say: "The loop is open here. Close it with the meter: one probe in each marked strip, red on the + side." }, { highlight: { holes: V.hs(...V.L.at) } }],
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
      id: "2-6", title: "Ohms, power off", teaches: ["ohms"], uses: ["volts", "resistor", "switch", "loop", "strip", "rail", "polarity"], shifts: [0, 4, 8],
      values: [330, 470, 1000],
      layouts: [{}],
      make: (V) => {
        const VALUES = [220, 330, 470, 1000, 2200, 10000].filter((r) => r !== V.ohms);
        const pick = () => VALUES.splice(Math.floor(V.R() * VALUES.length), 1)[0];
        const [r2, r3] = V.orig ? [1000, 220] : [pick(), pick()];
        const kilo = [V.ohms, r2, r3].some((r) => r >= 1000), seen = {};
        const reads = (S, id) => { const q = part(S, id); return !!q && S.across(q) && ohms(S) !== null && S.near(ohms(S), q.part.value, 0.03); };
        const inCircuit = ["res1", "led1", "wire1"];
        return {
          region: { rows: V.rows([1, 20]), cols: "a-j", rails: "top" }, ui: { xray: true },
          start: start(V.BAT("+T3", "-T4"), V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.WIRE("wire1", "e7", "-T7"),
            V.RES("res2", "b12", "b15", r2), V.RES("res3", "g12", "g15", r3), METER("V")),
          rules: { tray: [], allow: allow({ ctl: ["meter", "bat"], dial: ["V", "ohm"], socket: ["VO"] }) },
          goalsFrom: 3,
          beats: [
            { id: "dial", say: "Resistors come in sizes, measured in ohms (Ω). A bigger number holds the current back harder. Turn the dial to Ω.",
              highlight: { ctl: "mode:ohm", id: "meter" }, hints: [{ say: "Click the Ω mark next to the meter's dial." }], waitFor: { when: (S) => mode(S, "ohm") } },
            { id: "loose", say: "Put one probe on each leg of this loose resistor.", highlight: { part: "res2" },
              hints: [{ highlight: { holes: V.hs("c12", "c15") } }], waitFor: { when: (S) => reads(S, "res2") } },
            { id: "name", say: `${fmtR(r2)}. The meter sends its own tiny current through and sees how hard the resistor holds it back.`,
              highlight: { lcd: "meter" }, waitFor: NEXT },
            { id: "circuit", say: "Now measure the resistor in the circuit. Switch the battery off first: its push would confuse the meter.",
              highlight: [{ ctl: "switch", id: "bat" }, { part: "res1" }],
              hints: [{ say: "The switch is the slider on the battery box. Then a probe on each side of the resistor." }, { highlight: { holes: V.hs("+T10", "b6") } }],
              waitFor: { when: (S) => !onOff(S) && reads(S, "res1") } },
            FINISH(`Ohms: always with the power off.${kilo ? " 1 kΩ means 1000 Ω, by the way." : ""}`),
          ],
          goals: [{ text: "Measure the resistor in the circuit", when: (S) => !onOff(S) && reads(S, "res1") }],
          bonus: [
            { text: "Measure every resistor on the board", when: (S, m) => { for (const id of ["res1", "res2", "res3"]) if (reads(S, id)) m[id] = true; return m.res1 && m.res2 && m.res3; } },
            { text: "Never measure ohms with the power on", final: () => !seen.powered,
              when: (S, m, C) => {
                const bad = mode(S, "ohm") && onOff(S) && inCircuit.some((id) => S.across(part(S, id)));
                if (bad && !seen.powered) { seen.powered = true; C.h.aside("Power off first! With the battery on, the meter just shows OL or a wrong number."); }
                return false;
              } },
          ],
          solution: [{ dial: "ohm" }, { probe: V.hs("c12", "c15") }, { wait: 0.6 }, { next: 1 }, { probe: V.hs("h12", "h15") }, { wait: 0.6 },
            { ctl: "bat" }, { probe: V.hs("+T10", "b6") }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "2-7", title: "The beep", teaches: ["continuity"], uses: ["volts", "strip", "gap", "loop", "rail", "resistor", "polarity", "switch"], shifts: [0, 3, 6],
      // which of the three wires is broken inside
      layouts: [{ broken: "w2" }, { broken: "w1" }, { broken: "w3" }],
      make: (V) => {
        const P = V.predict(["Yes", "No"], 1), WIRES = ["w1", "w2", "w3"], seen = {};
        const ENDS = { w1: ["+T6", "a6"], w2: ["e10", "e13"], w3: ["a13", "-T13"] };
        const PROBE = { w1: ["+T10", "b6"], w2: ["b10", "b13"], w3: ["c13", "-T15"] };
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
          region: { rows: V.rows([1, 20]), cols: "a-j", rails: "top" },
          start: start(bat, ...WIRES.map(wire), V.RES("res1", "b6", "b9"), V.LED("led1", "c9", "c10"), METER("V")),
          rules: { tray: [{ type: "wire", n: 1 }], allow: allow({ socket: ["VO"] }), banner: true },
          beats: [
            { id: "same", say: "Turn the dial to the beep, ·))). Then put both probes in the same group of 5 holes.", highlight: { ctl: "mode:cont", id: "meter" },
              hints: [{ say: "Click ·))) next to the dial. Then, for example, one probe in a16 and the other in d16." }, { highlight: { holes: V.hs("a16", "d16") } }],
              waitFor: { when: (S) => beat(S, true) } },
            { id: "next", say: "Beep: those holes are joined by metal. Now try two holes in neighbouring groups.",
              hints: [{ say: "For example a16 and a17: same letter, rows next to each other." }], waitFor: { when: (S) => beat(S, false) } },
            { id: "p", say: `No beep: not joined. Would it beep from e${V.r(16)} to f${V.r(16)}, across the centre gap?`, highlight: { holes: V.hs("e16", "f16") },
              predict: P, waitFor: { predict: true } },
            { id: "find", say: (C) => `${C.right("p") ? "Right, no beep. " : "No beep: the gap splits them. "}One of these wires is broken inside. Find it, swap it, switch on.`,
              highlight: { parts: WIRES }, allow: { ctl: ["meter", "bat"], remove: WIRES },
              hints: [{ say: "Put a probe on each end of a wire. A good wire beeps. The broken one stays quiet." },
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
      id: "2-8", title: "Detective", teaches: [], uses: ["volts", "across", "break", "continuity", "loop", "strip", "rail", "polarity", "resistor"], shifts: [0, 4, 8],
      card: { name: "Measure first", text: "Before you change anything, measure. Where almost the whole push shows up, or a wire stays quiet, there is your fault." },
      colors: ["red", "yellow", "green"],
      // the fault: a wire broken inside, the LED the wrong way round, or the LED one strip off. Probes that show it; the one-change fix.
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"), Object.assign(V.WIRE("wire1", "e7", "-T7"), { broken: true })],
          show: ["b7", "-T10"], fix: { wire: ["d7", "-T12"] }, hint: "Is every wire really joining its two ends? The beep can tell." },
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
          region: { rows: V.rows([1, 20]), cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), ...V.L.parts(V), METER("V")),
          rules: { tray: [{ type: "wire", n: 1 }, { type: "led", color: V.c1, n: 1 }],
            allow: allow({ move: ["led1", "wire1"], legs: ["led1", "wire1"], flip: ["led1"], remove: ["led1", "wire1"], replace: ["led1", "meter"] }), banner: true },
          allowDamage: true,
          beats: [
            { id: "case", say: V.say("This one should light, but it doesn't. Use the meter to find out why, then fix it.",
              "A dark LED, and no idea why. Find the fault with the meter, then fix it."),
              hints: [{ say: "Measure volts across each part and each join. Where almost the whole push shows up, look closely.", after: 600 }, { say: V.L.hint, after: 900 }],
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
    {
      id: "2-9", title: "Full check-up", teaches: [], uses: ["volts", "current", "fuse", "ohms", "loop", "strip", "rail", "gap", "polarity", "resistor", "short"],
      card: { name: "Measure, choose, build, check", text: "Measure the parts, choose the right ones, build, then check the circuit with the meter. That is real electronics." },
      colors: ["red", "yellow", "green"], values: [330, 470],
      // which of the two mystery resistors is the safe one
      layouts: [{ safe: "B" }, { safe: "A" }],
      make: (V) => {
        const safeTag = V.L.safe, badTag = safeTag === "A" ? "B" : "A";
        const R = { [safeTag]: V.ohms, [badTag]: 22 };
        const res = (tag) => ({ type: "resistor", value: R[tag], tag });
        const measured = (S, tag) => S.parts("resistor").some((q) => q.part.tag === tag && S.across(q) && ohms(S) !== null && S.near(ohms(S), R[tag], 0.03));
        const lit1 = (S) => S.parts("led").some(safe), reads = (S) => S.parts("led").some((q) => lit(q) && amps(S, q));
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" }, ui: { xray: true },
          start: start(V.BAT("+T3", "-T4"), METER("V")),
          rules: { tray: [{ type: "resistor", value: R.A, tag: "A", n: 1 }, { type: "resistor", value: R.B, tag: "B", n: 1 }, { type: "led", color: V.c1, n: 1 }, { type: "wire", n: 3 }],
            allow: allow({ replace: ["meter"] }), banner: true },
          allowDamage: true,
          beats: [
            { id: "brief", say: V.say("Two mystery resistors, A and B. One would burn your LED. Measure them, build a safe LED circuit, then measure its current.",
              "Last job: resistors A and B, but one would burn the LED. Measure, build a safe LED circuit, then measure its current."), waitFor: { next: true, label: "Start" } },
            { id: "build", say: V.say("Over to you. Ask for a hint any time.", "Your bench. Ask for a hint if you get stuck."),
              hints: [{ say: "Put each resistor on its own strips, not joined to anything, and measure it in Ω. The bigger one is the safe one." },
                { say: "Build: + rail, the safe resistor, the LED (+ leg first). Close the loop to the − rail with the meter, set for mA." }],
              waitFor: { when: (S) => lit1(S) && reads(S), hold: 0.5 } },
            FINISH("You measured, chose, built and checked. That is real electronics. Chapter 2 done!"),
          ],
          goals: [{ text: "Light the LED safely", when: lit1 }, { text: "Measure the LED's current", when: reads }],
          bonus: [
            { text: "Nothing breaks, no fuse blown", final: (C) => C.broken.size === 0 },
            { text: "Measure both resistors before you plug one in", when: (S, m) => {
              if (S.parts("led").some((q) => !q.ok || Math.abs(q.rd.I || 0) > 1e-4)) m.late = true;
              for (const t of ["A", "B"]) if (measured(S, t)) m[t] = true;
              return !m.late && !!m.A && !!m.B;
            } },
          ],
          solution: [{ next: 1 }, { place: res(safeTag), at: ["b12", "b15"] }, { place: res(badTag), at: ["g12", "g15"] }, { dial: "ohm" },
            { probe: ["c12", "c15"] }, { probe: ["h12", "h15"] }, { wire: ["+T12", "a12"] }, { place: { type: "led", color: V.c1 }, at: ["c15", "c16"] },
            { probe: [null, null] }, { dial: "mA" }, { socket: "mA" }, { probe: ["d16", "-T18"] }, { wait: 1.2 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(2, "Measuring", L);
})(window.BB = window.BB || {});
