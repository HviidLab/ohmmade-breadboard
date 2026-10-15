// Chapter 1: First Light. From "what is a circuit" to an LED with its resistor, built from nothing.
// Data only; see coach.js (beats), rules.js (rules, region) and the design document (design/game-design.md).
// Board: rows 1–63 run left to right; columns a–e above the centre gap, f–j below; rails +T/−T on top.
//
// Every level has variants, so a replay is not the same game: a different layout that teaches the same idea,
// a different place on the board, other LED colours, shuffled prediction choices, other wording. A variant is
// made from a seed: seed 0 is always the original level (the first play, the map, the tests' mouse paths).
// make(V) builds the level; V.L is the chosen layout, V.h("e8") moves a hole by the variant's row shift.
(function (BB) {
  "use strict";
  const xr = (r) => BBShared.X0 + (r - 1) * BBShared.P;
  const WIRE_COLORS = ["#2fae5a", "#f08c2a", "#f2c94c", "#3a8ee6", "#e9ecef"];
  const COLOR_WORD = { red: "red", yellow: "yellow", green: "green", blue: "blue", white: "white" };

  // Circuit checks for beats, goals and bonus objectives (S is the goals query object).
  const lit = (q, lo = 0.003) => !!q && q.ok && q.rd.I >= lo;
  const safe = (q) => lit(q) && q.rd.I <= 0.02;
  const part = (S, id) => S.all.find((q) => q.id === id);
  const anyLit = (S) => S.parts("led").some((q) => lit(q));
  const wires = (S) => S.parts("wire");
  const wireHoles = (S, net) => wires(S).flatMap((q) => q.legs.filter((l, k) => q.nets[k] === net));
  const onOff = (S) => S.battery() && S.battery().part.on !== false;
  const LIT = { text: "Light the LED", when: (S) => anyLit(S), hold: 0.6 };
  const FINISH = (say) => ({ id: "end", say, waitFor: { next: true, label: "Finish level" } });

  // ---------- variants ----------
  function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  // The variant for a seed. Seed 0: first layout, no shift, red LED, choices in their written order, first wording.
  function variant(fam, seed) {
    const R = rng(seed + 1), pick = (a) => a[Math.floor(R() * a.length)], orig = seed === 0;
    const V = { seed, orig, R };
    V.k = orig ? 0 : seed % fam.layouts.length;
    V.L = fam.layouts[V.k];
    V.dr = orig ? 0 : pick(fam.shifts || [0]);
    const cols = fam.colors || ["red", "yellow", "green"];
    V.c1 = orig ? cols[0] : pick(cols);
    V.c2 = orig ? (fam.colors2 ? fam.colors2[0] : cols[1]) : pick((fam.colors2 || cols).filter((c) => c !== V.c1));
    V.ohms = orig ? (fam.values || [330])[0] : pick(fam.values || [330]);
    V.wc = orig ? WIRE_COLORS[0] : pick(WIRE_COLORS);
    V.say = (...alts) => (orig ? alts[0] : pick(alts));            // one of several wordings of a line
    const shift = (h) => h.replace(/^([+-][TB]|[a-j])(\d+)$/, (m, c, n) => `${c}${+n + V.dr}`);
    V.h = (h) => shift(h);
    V.hs = (...hs) => hs.map(shift);
    V.n = (net) => net.replace(/^bb:([LR])(\d+)$/, (m, c, n) => `bb:${c}${+n + V.dr}`);
    V.r = (row) => row + V.dr;
    V.rows = ([a, b]) => [a + V.dr, b + V.dr];
    // A prediction with its choices shuffled (except in the original); the right answer follows its choice, and so
    // does `why`: for each wrong choice, one line that names the belief behind it (Sparky says it after the answer).
    V.pick = (a) => (orig ? a[0] : pick(a));                         // one of several versions of a puzzle
    V.predict = (choices, answer, why = []) => {
      if (orig) return { choices, answer, why };
      const order = choices.map((c, k) => [R(), k]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      return { choices: order.map((k) => choices[k]), answer: order.indexOf(answer), why: order.map((k) => why[k]) };
    };
    // Parts, with holes moved by the variant's shift.
    V.BAT = (pos, neg) => ({ id: "bat", type: "battery", legs: V.hs(pos, neg), on: true });
    V.RES = (id, a, b, value = V.ohms) => ({ id, type: "resistor", value, legs: V.hs(a, b) });
    V.LED = (id, a, k, color = V.c1) => ({ id, type: "led", color, legs: V.hs(a, k) });
    V.WIRE = (id, a, b, color = V.wc) => ({ id, type: "wire", legs: V.hs(a, b), color });
    return V;
  }
  const start = (...parts) => ({ parts, nextId: 20 });

  const L = [
    {
      id: "1-1", title: "Close the loop", teaches: ["loop"], uses: [], shifts: [0, 4, 8, 14],
      // the gap in the loop: before the resistor, between the parts, or after the LED
      layouts: [
        { bat: ["a3", "a14"], res: ["b3", "b7"], led: ["c7", "c8"], gap: [8, 14] },
        { bat: ["a3", "a10"], res: ["b5", "b9"], led: ["c9", "c10"], gap: [3, 5] },
        { bat: ["a3", "a11"], res: ["b3", "b7"], led: ["c10", "c11"], gap: [7, 10] },
      ],
      make: (V) => {
        const [g1, g2] = V.L.gap;
        return {
          region: { rows: V.rows([1, 16]), cols: "a-e", rails: "none" },
          start: start(V.BAT(...V.L.bat), V.RES("res1", ...V.L.res), V.LED("led1", ...V.L.led)),
          rules: { tray: [{ type: "wire", n: 1 }], guardShorts: true },
          beats: [
            { id: "bat", say: V.say("This is a battery. It pushes current, a flow of electricity, out of its red + lead and wants it back at its black − lead.",
              "Meet the battery. Current, a flow of electricity, leaves through its red + lead and must come home through the black − lead."), highlight: { part: "bat" }, waitFor: { next: true } },
            { id: "gap", say: V.say("Here the path is broken. Nothing can flow, so the LED stays dark.", "See this break? With the path broken, nothing flows and the LED stays dark."),
              highlight: { nets: [V.n(`bb:L${g1}`), V.n(`bb:L${g2}`)] }, waitFor: { next: true } },
            { id: "wire", say: "Drag from a hole in this marked group of holes to a hole in that one. That makes a wire.", highlight: { nets: [V.n(`bb:L${g1}`), V.n(`bb:L${g2}`)] },
              hints: [{ say: "Press on a free hole in one marked group, hold, and drag to a free hole in the other." }, { highlight: { holes: V.hs(`e${g1}`, `e${g2}`) } }, { show: [V.WIRE("h", `e${g1}`, `e${g2}`)] }],
              waitFor: { when: (S) => anyLit(S) } },
            FINISH(V.say("Light! The dots show the current: out of +, through every part, back to −. A closed loop.", "It glows! Follow the dots: out of +, through every part, and back to −. A closed loop.")),
          ],
          goals: [LIT],
          challenge: { text: "Light it again with the wire in a different pair of holes", when: (S, m) => { m.p = m.p || new Set(); if (anyLit(S)) wires(S).forEach((q) => m.p.add(q.legs.slice().sort().join())); return m.p.size >= 2; } },
          solution: [{ next: 1 }, { next: 1 }, { wire: V.hs(`e${g1}`, `e${g2}`) }, { wait: 1 }, { remove: "wire" }, { wait: 0.5 }, { wire: V.hs(`d${g1}`, `d${g2}`) }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "1-2", title: "Break the loop", teaches: ["switch"], uses: ["loop"], shifts: [0, 4, 8, 14],
      layouts: [
        { bat: ["a3", "a14"], res: ["b3", "b7"], led: ["c7", "c8"], wire: [8, 14] },
        { bat: ["a3", "a10"], res: ["b5", "b9"], led: ["c9", "c10"], wire: [3, 5] },
        { bat: ["a3", "a11"], res: ["b3", "b7"], led: ["c10", "c11"], wire: [7, 10] },
      ],
      make: (V) => {
        const [w1, w2] = V.L.wire, P = V.predict(["Only the LED goes dark", "Everything stops", "Nothing changes"], 1,
          ["a loop is one path. Open it anywhere and the current stops everywhere, not only at the LED.", null, "the wire is part of the loop. Without it there is a gap, and nothing can flow."]);
        return {
          region: { rows: V.rows([1, 16]), cols: "a-e", rails: "none" },
          start: start(V.BAT(...V.L.bat), V.RES("res1", ...V.L.res), V.LED("led1", ...V.L.led), V.WIRE("wire1", `e${w1}`, `e${w2}`)),
          rules: { tray: [], allow: { ctl: ["bat"] }, guardShorts: true },
          beats: [
            { id: "off", say: V.say("The loop is closed, so current flows. Click the battery's switch to turn it off.", "Current is flowing round the loop. Now click the battery's switch to turn it off."),
              highlight: { ctl: "switch", id: "bat" }, hints: [{ say: "The switch is the small green slider on the battery box." }], waitFor: { when: (S) => !onOff(S) } },
            { id: "on", say: "Off: the switch opened the loop inside the battery, so nothing flows anywhere. Now switch it on again.", highlight: { ctl: "switch", id: "bat" },
              waitFor: { when: (S) => onOff(S) && anyLit(S) } },
            { id: "p", say: "What happens if you pull the wire out?", predict: P, highlight: { part: "wire1" }, waitFor: { predict: true } },
            { id: "pull", say: "Find out: drag the wire onto the parts tray, or click it and press Remove.", allow: { remove: ["wire1"] }, highlight: [{ part: "wire1" }, { ui: "#hotbar" }],
              hints: [{ say: "Click the wire. A small card appears next to it with a Remove button." }], waitFor: { event: "remove", id: "wire1" } },
            { id: "close", reply: "p", say: "Everything stopped. A loop open anywhere stops all the current. Now close it again.",
              hints: [{ say: "The wire is back in your tray. Drag it onto the board, or draw one from hole to hole." }, { show: [V.WIRE("h", `e${w1}`, `e${w2}`)] }],
              waitFor: { when: (S) => anyLit(S) } },
            FINISH("That is all a switch does: it opens and closes the loop."),
          ],
          goals: [Object.assign({}, LIT, { text: "Get the LED lit again" })],
          challenge: { text: "Close the loop with the wire in different holes", when: (S, m, C) => { const [a, b] = V.hs(`e${w1}`, `e${w2}`); return !!C.count.remove && anyLit(S) && wires(S).some((q) => !(q.legs.includes(a) && q.legs.includes(b))); } },
          solution: [{ ctl: "bat" }, { wait: 0.5 }, { ctl: "bat" }, { wait: 0.5 }, { choose: "right" }, { remove: "wire1" }, { wire: V.hs(`d${w1}`, `d${w2}`) }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "1-3", title: "Hidden strips", teaches: ["strip"], uses: ["loop"], shifts: [0, 4, 8, 14],
      // where the LED must go (strips t), and which holes the prediction asks about (in the loop or not)
      layouts: [
        { bat: ["a3", "a14"], parts: (V) => [V.RES("res1", "b3", "b7"), V.WIRE("wire1", "d8", "d14")], t: [7, 8], ask: [10, 11], yes: false },
        { bat: ["a3", "a11"], parts: (V) => [V.WIRE("wire1", "d3", "d6"), V.RES("res1", "b7", "b11")], t: [6, 7], ask: [13, 14], yes: false },
        { bat: ["a3", "a14"], parts: (V) => [V.RES("res1", "b3", "b7"), V.WIRE("wire1", "d8", "d14")], t: [7, 8], ask: [7, 8], yes: true },
      ],
      make: (V) => {
        const [t1, t2] = V.L.t, P = V.predict(["Yes", "No"], V.L.yes ? 0 : 1, V.L.yes ? [null, "each leg sits in a strip, and a strip joins it to every part plugged into that strip."]
          : ["a leg only joins what shares its strip, and nothing else is plugged into those two strips.", null]);
        return {
          region: { rows: V.rows([1, 16]), cols: "a-e", rails: "none" },
          start: start(V.BAT(...V.L.bat), ...V.L.parts(V)),
          rules: { tray: [{ type: "led", color: V.c1, n: 1 }], guardShorts: true },
          ui: { xray: true },
          beats: [
            { id: "xray", do: { xray: true }, say: V.say("X-ray on! Under each group of 5 holes is a metal strip. Everything plugged into one strip is connected.",
              "Let's look inside: X-ray on! Each group of 5 holes sits on one metal strip, so they are all connected."), highlight: { nets: [V.n(`bb:L${t1}`)] }, waitFor: { next: true } },
            { id: "p", say: "If the LED's legs went into these two holes, would it light?", highlight: { holes: V.hs(`c${V.L.ask[0]}`, `c${V.L.ask[1]}`) }, predict: P, waitFor: { predict: true } },
            { id: "plug", reply: "p", say: V.L.yes ? "Both strips are in the loop. Plug the LED in there, or anywhere else in the same strips."
              : "Those strips are not in the loop. Plug the LED in where it closes the loop.",
              highlight: { nets: [V.n(`bb:L${t1}`), V.n(`bb:L${t2}`)] },
              hints: [{ say: "Which strips does the loop already reach? Look for strips with a part's leg in them." }, { say: `One leg in strip ${V.r(t1)}, the other in strip ${V.r(t2)}.`, highlight: { holes: V.hs(`c${t1}`, `c${t2}`) } }, { show: [V.LED("h", `c${t1}`, `c${t2}`)] }],
              waitFor: { when: (S) => anyLit(S) } },
            FINISH(V.say("Lit, with no extra wire: the strips did the joining. Try other holes in the same strips.", "No wire needed: the strips joined the legs for you. Try other holes in the same strips.")),
          ],
          goals: [LIT],
          challenge: { text: "Light it from two different pairs of holes", when: (S, m) => { m.h = m.h || new Set(); S.parts("led").forEach((q) => { if (lit(q)) m.h.add(q.legs[0]); }); return m.h.size >= 2; } },
          solution: [{ next: 1 }, { choose: "right" }, { place: { type: "led", color: V.c1 }, at: V.hs(`c${t1}`, `c${t2}`) }, { wait: 0.6 }, { move: "led", to: V.hs(`e${t1}`, `e${t2}`) }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "1-4", title: "The rails", teaches: ["rail"], uses: ["loop", "strip"], shifts: [0, 4, 8],
      // the missing link: from the LED to the − rail, or from the + rail to the LED
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7")], need: 7, rail: "-T", word: "blue − rail",
          feed: "The resistor takes its current from the red one.", sol: ["e7", "-T30"] },
        { parts: (V) => [V.LED("led1", "c8", "c9"), V.RES("res1", "a9", "-T9")], need: 8, rail: "+T", word: "red + rail",
          feed: "The resistor gives its current back to the blue one.", sol: ["+T30", "e8"] },
      ],
      make: (V) => {
        const Lt = V.L, near = Lt.rail === "-T" ? 4 : 3, P = V.predict(["Yes", "No"], 0, [null, "a rail is one long strip: every hole along it is joined, however far away."]);
        return {
          region: { rows: V.rows([1, 34]), cols: "a-e", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), ...Lt.parts(V)),
          rules: { tray: [{ type: "wire", n: 1 }], guardShorts: true },
          ui: { xray: true },
          beats: [
            { id: "rails", do: { xray: true }, say: V.say("These long lines are the rails. Each rail is one strip that runs the whole length of the board.",
              "Meet the rails: two long strips that run the whole length of the board."), highlight: { nets: ["bb:+T", "bb:-T"] }, waitFor: { next: true } },
            { id: "feed", say: `The battery feeds them: + to the red rail, − to the blue rail. ${Lt.feed}`, highlight: [{ holes: V.hs("+T3", "-T4") }, { part: "res1" }], waitFor: { next: true } },
            { id: "p", say: `Would a wire from the LED to the far end of the ${Lt.word}, at column ${V.r(30)}, close the loop?`, highlight: { holes: [V.h(`${Lt.rail}30`)] }, predict: P, waitFor: { predict: true } },
            { id: "wire", reply: "p", say: `The whole rail is one strip. Wire the LED's free strip to the ${Lt.word}.`,
              highlight: { nets: [V.n(`bb:L${Lt.need}`), `bb:${Lt.rail}`] },
              hints: [{ say: `Drag from a free hole in strip ${V.r(Lt.need)} to any hole on the ${Lt.word}.` }, { highlight: { holes: V.hs(`e${Lt.need}`, `${Lt.rail}${Lt.need}`) } }, { show: [V.WIRE("h", `e${Lt.need}`, `${Lt.rail}${Lt.need}`)] }],
              waitFor: { when: (S) => anyLit(S) } },
            FINISH("The rails bring + and − to wherever you need them along the board."),
          ],
          goals: [LIT],
          challenge: { text: "Use a rail hole 20 or more columns from the battery", when: (S) => anyLit(S) && wireHoles(S, `bb:${Lt.rail}`).some((h) => BBShared.parse(h).row >= V.r(near + 20)) },
          solution: [{ next: 1 }, { next: 1 }, { choose: "right" }, { wire: V.hs(...Lt.sol) }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "1-5", title: "Mind the gap", teaches: ["gap"], uses: ["loop", "strip", "rail"], shifts: [0, 4, 8, 12],
      // what sits on the wrong side of the centre gap: the wire's end, or the resistor's leg
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.WIRE("wire1", "g7", "-T7", "#f08c2a")], id: "wire1", row: 7, wrong: "g7",
          what: "The wire is in the wrong one.", fix: "drag the wire's end", hint: "Click the orange wire, then drag its round end", bridge: ["e7", "f7"], moved: ["e7", "-T7"] },
        { parts: (V) => [V.RES("res1", "+T6", "f6"), V.LED("led1", "c6", "c7"), V.WIRE("wire1", "e7", "-T7")], id: "res1", row: 6, wrong: "f6",
          what: "One of the resistor's legs is in the wrong one.", fix: "drag the resistor's leg", hint: "Click the resistor, then drag its round end", bridge: ["d6", "g6"], moved: ["+T6", "d6"] },
      ],
      make: (V) => {
        const Lt = V.L, P = V.predict(["The LED is broken", "Something is not really connected", "The battery is flat"], 1,
          ["a dark LED is not always broken. First check that every part is really joined into the loop.", null,
            "a flat battery is rare. When a circuit stays dark, look for a joint that isn't really joined first."]);
        P.ok = "Good eye!";
        return {
          region: { rows: V.rows([1, 24]), cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), ...Lt.parts(V)),
          rules: { tray: [{ type: "wire", n: 1 }], allow: { move: [Lt.id], legs: [Lt.id] }, guardShorts: true },
          ui: { xray: true },
          beats: [
            { id: "p", say: V.say("This circuit looks finished, but the LED stays dark. Why?", "Everything seems to be there, yet the LED is dark. What is wrong?"), predict: P, waitFor: { predict: true } },
            { id: "gap", do: { xray: true }, reply: "p", say: `The gap down the middle splits each numbered column into two strips, top and bottom. ${Lt.what}`,
              highlight: { nets: [V.n(`bb:L${Lt.row}`), V.n(`bb:R${Lt.row}`)] }, waitFor: { next: true } },
            { id: "fix", say: `Fix it: ${Lt.fix} across the gap, or bridge the gap with a new wire.`, highlight: { part: Lt.id },
              hints: [{ say: `${Lt.hint} at ${V.h(Lt.wrong)} up into strip ${V.r(Lt.row)}, above the gap.` }, { highlight: { holes: [V.h(Lt.wrong), V.h(`e${Lt.row}`)] } }, { show: [V.WIRE("h", ...Lt.bridge)] }],
              waitFor: { when: (S) => anyLit(S) } },
            FINISH("Remember the gap: the top and bottom halves of a column are not connected."),
          ],
          goals: [LIT],
          challenge: { text: "Fix it by moving the misplaced end, with no new wire", when: (S) => anyLit(S) && !!part(S, Lt.id) && !part(S, Lt.id).legs.includes(V.h(Lt.wrong)) && wires(S).length === 1 },
          solution: [{ choose: "right" }, { next: 1 }, { move: Lt.id, to: V.hs(...Lt.moved) }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "1-6", title: "Which way round?", teaches: ["polarity"], uses: ["loop", "strip", "rail"], shifts: [0, 4, 8, 12],
      // which LEDs are the wrong way round: both, only the second, or only the first
      layouts: [{ back: [true, true] }, { back: [false, true] }, { back: [true, false] }],
      make: (V) => {
        const [b1, b2] = V.L.back, flips = (b1 ? 1 : 0) + (b2 ? 1 : 0), w1 = COLOR_WORD[V.c1], w2 = COLOR_WORD[V.c2];
        const led1 = b1 ? V.LED("led1", "c7", "c6") : V.LED("led1", "c6", "c7"), led2 = b2 ? V.LED("led2", "d8", "d7", V.c2) : V.LED("led2", "d7", "d8", V.c2);
        const look = "look at each long + leg: it must point back towards the resistor, where the current comes from.";
        const both = b1 && b2, P = both ? V.predict(["Yes", "No"], 1, ["in one loop every part must let the current through. One backwards LED still blocks it for both.", null])
          : V.predict([`The ${w1} one`, `The ${w2} one`, "Both"], b1 ? 0 : 1, b1 ? [null, look, "only one is backwards. " + look] : [look, null, "only one is backwards. " + look]);
        const on = (S) => lit(part(S, "led1"), 0.002) && lit(part(S, "led2"), 0.002);
        return {
          region: { rows: V.rows([1, 24]), cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), V.RES("res1", "+T6", "a6", 330), led1, led2, V.WIRE("wire1", "e8", "-T8")),
          rules: { tray: [], allow: { flip: ["led1", "led2"] }, guardShorts: true },
          ui: { xray: true },
          beats: [
            { id: "dark", say: "Two LEDs in one loop, and both are dark. An LED is one-way: current can only go in at its + leg.", highlight: { parts: ["led1", "led2"] }, waitFor: { next: true } },
            { id: "leg", say: "The + leg is the long one, marked + here. It must face the + side of the loop (here, the resistor's side).", highlight: { holes: [led1.legs[0], led2.legs[0]] }, waitFor: { next: true } },
            both ? { id: "p", say: `If you flip just the ${w1} LED, will the lights come on?`, highlight: { part: "led1" }, predict: P, waitFor: { predict: true } }
              : { id: "p", say: "One of them is the wrong way round. Which one?", highlight: { parts: ["led1", "led2"] }, predict: P, waitFor: { predict: true } },
            { id: "flip", reply: "p", say: both ? "Click an LED and press Flip (or the R key). Make both face the right way." : "Click the LED that is the wrong way round and press Flip (or the R key).",
              hints: [{ say: "Current comes from the resistor on the left. Each + leg should be on the left side of its LED." }, { highlight: { parts: ["led1", "led2"] } }],
              waitFor: { when: on } },
            FINISH("One-way parts must all face along the loop, from + to −."),
          ],
          goals: [{ text: "Light both LEDs", when: on, hold: 0.6 }],
          challenge: { text: `Use no more than ${flips} flip${flips > 1 ? "s" : ""}`, final: (C) => (C.count.flip || 0) <= flips },
          solution: [{ next: 1 }, { next: 1 }, { choose: "right" }, ...(b1 ? [{ flip: "led1" }] : []), ...(b2 ? [{ flip: "led2" }] : []), { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "1-7", title: "Why the resistor?", teaches: ["resistor"], uses: ["loop", "strip", "rail", "polarity"], shifts: [0, 4, 8, 12],
      // the resistor on the + side (from the red rail) or on the − side (to the blue rail)
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6", 330), V.LED("led1", "c6", "c7"), V.WIRE("wire1", "e7", "-T7")], bridge: ["+T6", "a6"], back: ["+T6", "a6"], other: "-",
          swap: [{ remove: "wire1" }, { move: "resistor", to: ["a7", "-T7"] }, { wire: ["+T6", "a6"] }] },
        { parts: (V) => [V.WIRE("wire1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.RES("res1", "e7", "-T7", 330)], bridge: ["e7", "-T7"], back: ["-T7", "a7"], other: "+",
          swap: [{ remove: "wire1" }, { move: "resistor", to: ["+T6", "a6"] }, { wire: ["e7", "-T7"] }] },
      ],
      make: (V) => {
        // which side of the LED the resistor is on: "+" (between the + rail and the LED) or "-" (between the LED and the − rail)
        const side = (S) => {
          const l = part(S, "led1"), r = S.parts("resistor").find((q) => q.ok);
          if (!l || !r || !lit(l)) return null;
          return r.nets.includes("bb:+T") && r.nets.includes(l.nets[0]) ? "+" : r.nets.includes("bb:-T") && r.nets.includes(l.nets[1]) ? "-" : null;
        };
        const Lt = V.L, P = V.predict(["glow brighter", "stay the same", "burn out"], 2,
          ["brighter for a moment, yes. But nothing holds the current down, so it climbs until the LED burns out.", "the resistor is what holds the current down. Without it, far more flows.", null]);
        return {
          region: { rows: V.rows([1, 24]), cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), ...Lt.parts(V)),
          rules: { tray: [{ type: "wire", n: 1 }], allow: { place: false, replace: ["led1"] }, guardShorts: true },
          demo: { led: 1 }, simText: { led: null },
          ui: { xray: true },
          beats: [
            { id: "what", say: V.say("This striped part is a resistor. What is it doing here?", "See the part with coloured stripes? That is a resistor. Why is it here?"), highlight: { part: "res1" }, waitFor: { next: true } },
            { id: "p", say: "If a plain wire took the resistor's place, the LED would…", predict: P, waitFor: { predict: true } },
            { id: "out", say: "Let's find out. Drag the resistor onto the parts tray to take it out.", allow: { remove: ["res1"] }, highlight: [{ part: "res1" }, { ui: "#hotbar" }],
              hints: [{ say: "Or click the resistor and press Remove on the card next to it." }], waitFor: { event: "remove", id: "res1" } },
            { id: "bridge", say: "Dark: the loop is open. Now bridge the gap the resistor left with a wire.", allow: { place: true },
              highlight: { holes: V.hs(...Lt.bridge) },
              hints: [{ say: "Draw a wire between the two holes where the resistor's legs were." }, { show: [V.WIRE("h", ...Lt.bridge)] }],
              waitFor: { when: (S) => S.destroyed("led") } },
            { id: "fix", reply: "p", say: "Pop! Nothing held the current back. Fix it: wire out, resistor back, and a fresh LED.",
              allow: { place: true, remove: ["res1", "wire1"], move: ["wire1"], legs: ["wire1"] },
              hints: [{ say: "Take the new wire off. Drop the resistor on the rail where it was. Then click the LED and press Fresh one." }, { show: [V.RES("h", ...Lt.back, 330)] }],
              waitFor: { when: (S) => lit(part(S, "led1")) && S.parts("resistor").length > 0 } },
            Object.assign(FINISH("That is the resistor's job: it holds the current down to a safe amount. It works on either side of the LED."),
              { note: "an LED with no resistor gets hot and can crack. Always fit the resistor before you connect the battery.",
                allow: { place: true, remove: ["res1", "wire1"], move: ["wire1"], legs: ["wire1"] } }),
          ],
          goals: [{ text: "Light the LED safely, with a resistor", when: (S) => safe(part(S, "led1")) && S.parts("resistor").length > 0, hold: 0.6 }],
          challenge: { text: "Then move the resistor to the other side of the LED, still lit", when: (S) => side(S) === Lt.other },
          solution: [{ next: 1 }, { choose: "right" }, { remove: "res1" }, { wire: V.hs(...Lt.bridge) }, { wait: 0.5 }, { remove: "wire" },
            { place: { type: "resistor", value: 330 }, at: V.hs(...Lt.back) }, { replace: "led1" }, { wait: 1 },
            ...Lt.swap.map((st) => (st.to ? Object.assign({}, st, { to: V.hs(...st.to) }) : st.wire ? { wire: V.hs(...st.wire) } : st)), { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "1-8", title: "Short circuit", teaches: ["short"], uses: ["loop", "rail", "resistor"], shifts: [0, 4, 8, 12],
      layouts: [
        { parts: (V) => [V.RES("res1", "+T6", "a6", 330), V.LED("led1", "c6", "c7"), V.WIRE("wire1", "e7", "-T7")] },
        { parts: (V) => [V.WIRE("wire1", "+T6", "a6"), V.LED("led1", "c6", "c7"), V.RES("res1", "e7", "-T7", 330)] },
      ],
      make: (V) => {
        const P = V.predict(["The LED gets brighter", "The LED goes dark", "Nothing"], 1,
          ["more current flows, but through the wire. The battery can't keep up its push, so the LED gets almost none.", null,
            "the wire lets a huge current flow, and the battery can't keep up its push."]);
        return {
          region: { rows: V.rows([1, 24]), cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), ...V.L.parts(V)),
          rules: { tray: [{ type: "wire", n: 1 }], guardShorts: false, banner: true },
          demo: { short: true }, simText: { wire: null },
          ui: { xray: true },
          beats: [
            { id: "p", say: V.say("What happens if a wire joins the red + rail straight to the blue − rail?", "Suppose a wire went straight from the red + rail to the blue − rail. What happens?"), predict: P, waitFor: { predict: true } },
            { id: "try", say: "Try it: drag a wire from the red + rail to the blue − rail.", highlight: { nets: ["bb:+T", "bb:-T"] },
              hints: [{ highlight: { holes: V.hs("+T12", "-T12") } }, { show: [V.WIRE("h", "+T12", "-T12")] }],
              waitFor: { when: (S) => S.shortNow(), hold: 0.05 } },
            { id: "pull", say: "Short circuit! The LED went dark, and the wire and the batteries are heating up. Pull the wire out, quick!",
              waitFor: { when: (S) => !S.shortNow(), hold: 0.05 } },
            Object.assign(FINISH((C) => (C.broken.has("battery") ? "Too late: the batteries overheated. A huge current poured through, and their push collapsed: the rails fell to almost 0 V."
              : "Phew! A huge current poured through the wire, the battery's push collapsed, the rails fell to almost 0 V, and the LED went dark.")),
            { reply: "p", note: "never short a battery. Wires and cells get hot enough to burn you, and some batteries can catch fire." }),
          ],
          goals: [{ text: "Light the LED, with no short circuit", when: (S) => anyLit(S) && !S.shortNow(), hold: 0.6 }],
          challenge: { text: "Pull the short out before the batteries get hot (3 seconds)", when: (S, m) => {
              if (S.shortNow()) { if (m.t0 === undefined) m.t0 = S.t; m.long = m.long || S.t - m.t0 >= 3; } else m.t0 = undefined;
              return false;
            }, final: (C, m) => !m.long && !C.broken.has("battery") },
          solution: [{ choose: "right" }, { wire: V.hs("+T12", "-T12") }, { wait: 0.4 }, { remove: "wire" }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "1-9", title: "Build it yourself", teaches: [], uses: ["loop", "strip", "rail", "gap", "polarity", "resistor", "short"],
      card: { name: "Your first circuit", text: "Battery +, a resistor, an LED with its + leg towards +, and back to −. You built it from nothing." },
      layouts: [{}], colors: ["red", "yellow", "green", "blue"], values: [330, 220, 470],
      make: (V) => ({
        region: { rows: [1, 30], cols: "a-j", rails: "top" },
        start: start(V.BAT("+T3", "-T4")),
        rules: { tray: [{ type: "resistor", value: V.ohms, n: 1 }, { type: "led", color: V.c1, n: 1 }, { type: "wire", n: 3 }], guardShorts: false, banner: true },
        ui: { xray: true },
        beats: [
          { id: "brief", say: V.say("Your turn. Light the LED safely from the rails. You have a resistor, an LED and three wires.",
            "Now you build it. Light the LED safely from the rails, with a resistor, an LED and up to three wires."), waitFor: { next: true, label: "Start" } },
          { id: "build", say: V.say("Build it. Ask for a hint any time.", "Over to you. Ask for a hint if you get stuck."),
            hints: [{ say: "The path: + rail, resistor, LED (+ leg first), then back to the − rail. Drop the resistor on the red rail." }, { highlight: { nets: ["bb:+T", "bb:-T"] } },
              { show: [V.RES("h1", "+T10", "a10"), V.LED("h2", "c10", "c11"), V.WIRE("h3", "e11", "-T11")] }],
            waitFor: { when: (S) => S.parts("led").some(safe) } },
          FINISH("You built it from nothing. That is the circuit behind every little indicator light."),
        ],
        goals: [{ text: "Light the LED safely", when: (S) => S.parts("led").some(safe), hold: 0.6 }],
        challenge: { text: "Use at most one wire", when: (S) => S.parts("led").some(safe) && wires(S).length <= 1 },
        solution: [{ next: 1 }, { place: { type: "resistor", value: V.ohms }, at: ["+T10", "a10"] }, { place: { type: "led", color: V.c1 }, at: ["c10", "c11"] },
          { wire: ["e11", "-T11"] }, { wait: 1 }, { next: 1 }],
      }),
    },
    {
      id: "1-10", title: "Two lights", teaches: [], uses: ["loop", "strip", "rail", "gap", "polarity", "resistor", "short"],
      card: { name: "Two circuits, one battery", text: "Each LED gets its own resistor. Both share the same rails, so one battery lights them all." },
      layouts: [{}], colors: ["red", "yellow", "green", "blue"], colors2: ["green", "red", "yellow", "blue"], values: [330, 470],
      make: (V) => {
        // each lit LED has its own path from + to −, with one resistor in it: joined to each rail directly, by a wire or by the resistor
        const link = (S, net, rail) => (net === rail ? "direct" : wires(S).some((q) => q.nets.includes(net) && q.nets.includes(rail)) ? "wire"
          : S.parts("resistor").some((q) => q.ok && q.nets.includes(net) && q.nets.includes(rail)) ? "res" : null);
        const own = (S, q) => { const a = link(S, q.nets[0], "bb:+T"), k = link(S, q.nets[1], "bb:-T"); return !!a && !!k && (a === "res") !== (k === "res"); };
        const sep = (S) => { const ls = S.parts("led").filter(safe); return ls.length >= 2 && ls.every((q) => own(S, q)); };
        return {
        region: { rows: [1, 40], cols: "a-j", rails: "top" },
        start: start(V.BAT("+T3", "-T4")),
        rules: { tray: [{ type: "resistor", value: V.ohms, n: 2 }, { type: "led", color: V.c1, n: 1 }, { type: "led", color: V.c2, n: 1 }, { type: "wire", n: 3 }], guardShorts: false, banner: true },
        ui: { xray: true },
        beats: [
          { id: "brief", say: V.say("Last one: light both LEDs at the same time, each with its own resistor.", "Final test: both LEDs lit at once, and each one gets its own resistor."), waitFor: { next: true, label: "Start" } },
          { id: "build", say: "Build it.",
            hints: [{ say: "Build two LED circuits side by side. Both can use the same rails." },
              { show: [V.RES("h1", "+T8", "a8"), V.LED("h2", "c8", "c9"), V.WIRE("h3", "e9", "-T9"), V.RES("h4", "+T16", "a16"), V.LED("h5", "c16", "c17", V.c2), V.WIRE("h6", "e17", "-T17")] }],
            waitFor: { when: sep } },
          FINISH("Two lights, one battery. That is Chapter 1 done!"),
        ],
        goals: [{ text: "Light both LEDs safely, each in its own loop", when: sep, hold: 0.6 }],
        react: [{ when: (S) => (S.parts("led").filter((q) => lit(q)).length >= 2 && !sep(S) ? "You built them in a row: one loop. That works too (more in chapter 5), but here each LED needs its own path from + to −." : null) }],
        challenge: { text: "Use at most one wire", when: (S) => sep(S) && wires(S).length <= 1 },
        solution: [{ next: 1 }, { place: { type: "resistor", value: V.ohms }, at: ["+T8", "a8"] }, { place: { type: "led", color: V.c1 }, at: ["c8", "c9"] },
          { place: { type: "led", color: V.c2 }, at: ["c16", "-T16"] }, { place: { type: "resistor", value: V.ohms }, at: ["+T16", "a16"] }, { wire: ["e9", "-T9"] },
          { wait: 1 }, { next: 1 }],
        };
      },
    },
  ];

  // A playable level: the family's fixed facts (id, title, ideas) plus what this variant built.
  function instance(fam, seed = 0) {
    const V = variant(fam, seed), lv = Object.assign({ id: fam.id, title: fam.title, teaches: fam.teaches, uses: fam.uses, card: fam.card, chapter: fam.chapter, seed, layout: V.k }, fam.make(V));
    lv.view = lv.region.rows;
    // the battery pack sits centred above the open part of the board, clear of the objective card
    const bats = lv.start.parts.filter((p) => p.type === "battery"), [r0, r1] = lv.region.rows;
    bats.forEach((bat, k) => { bat.bx = Math.round((xr(r0) + xr(r1)) / 2 - 115); bat.by = k ? BBShared.Y["-B"] + 60 : -150; });   // a second pack below the board
    // the meter stands to the right of the open part of the board, its probes resting on the bench below it
    const m = lv.start.parts.find((p) => p.type === "meter");
    if (m) { const h = BB.Render ? BB.Render.meterSize()[1] : 330; m.bx = xr(r1) + 70; m.by = 100; m.loose = [[m.bx + 95, m.by + h + 40], [m.bx + 165, m.by + h + 40]]; }
    // the controller board sits above the open part of the board, its sockets just over the top rails
    const u = lv.start.parts.find((p) => p.type === "uno");
    if (u) { u.bx = Math.round((xr(r0) + xr(r1)) / 2 - BB.Uno.W / 2); u.by = -190; }
    return lv;
  }
  // A chapter: its levels become playable families (each builds variants from a seed).
  function chapter(n, title, fams) {
    for (const fam of fams) { fam.chapter = n; fam.instance = (seed) => instance(fam, seed); }
    BB.Levels.chapters.push({ n, title, levels: fams });
  }

  BB.Levels = BB.Levels || {};
  BB.Levels.chapters = [];
  chapter(1, "First Light", L);
  // What later chapters build their levels with.
  BB.Levels.kit = { variant, chapter, start, xr, WIRE_COLORS, COLOR_WORD, lit, safe, part, anyLit, wires, wireHoles, onOff, FINISH };
  BB.Levels.all = () => BB.Levels.chapters.flatMap((c) => c.levels);
  BB.Levels.get = (id) => BB.Levels.all().find((l) => l.id === id) || null;
  // A seed for the next play of a level: 0 the first time, then a different variant from the last one.
  BB.Levels.nextSeed = (fam, last) => {
    if (last === undefined || last === null) return 0;
    const layout = (s) => (s === 0 ? 0 : s % fam.layouts.length);
    for (let k = 0; k < 20; k++) {
      const s = 1 + Math.floor(Math.random() * 9999);
      if (s !== last && (fam.layouts.length === 1 || layout(s) !== layout(last))) return s;
    }
    return last + 1;
  };
})(window.BB = window.BB || {});
