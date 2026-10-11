// Chapter 1: First Light. From "what is a circuit" to an LED with its resistor, built from nothing.
// Data only; see coach.js (beats), rules.js (rules, region) and the design document (design/game-design.md).
// Board: rows 1–63 run left to right; columns a–e above the centre gap, f–j below; rails +T/−T on top.
(function (BB) {
  "use strict";
  const xr = (r) => BBShared.X0 + (r - 1) * BBShared.P;
  const BAT = (pos, neg) => ({ id: "bat", type: "battery", legs: [pos, neg], on: true });     // placed below, over the open board
  const RES = (id, a, b, value = 330) => ({ id, type: "resistor", value, legs: [a, b] });
  const LED = (id, a, k, color = "red") => ({ id, type: "led", color, legs: [a, k] });
  const WIRE = (id, a, b, color = "#2fae5a") => ({ id, type: "wire", legs: [a, b], color });
  const start = (...parts) => ({ parts, nextId: 20 });

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

  const L = [
    {
      id: "1-1", title: "Close the loop", teaches: ["loop"], uses: [],
      region: { rows: [1, 16], cols: "a-e", rails: "none" },
      start: start(BAT("a3", "a14"), RES("res1", "b3", "b7"), LED("led1", "c7", "c8")),
      rules: { tray: [{ type: "wire", n: 1 }], guardShorts: true },
      beats: [
        { id: "bat", say: "This is a battery. It pushes current out of its red + lead and wants it back at its black − lead.", highlight: { part: "bat" }, waitFor: { next: true } },
        { id: "gap", say: "Here the path is broken. Nothing can flow, so the LED stays dark.", highlight: { nets: ["bb:L8", "bb:L14"] }, waitFor: { next: true } },
        { id: "wire", say: "Drag from a hole in this group to a hole in that one. That makes a wire.", highlight: { nets: ["bb:L8", "bb:L14"] },
          hints: [{ say: "Press on a free hole next to the LED, hold, and drag to a free hole next to the black lead." }, { highlight: { holes: ["e8", "e14"] } }, { show: [WIRE("h", "e8", "e14")] }],
          waitFor: { when: (S) => anyLit(S) } },
        FINISH("Light! The dots show the current: out of +, through every part, back to −. A closed loop."),
      ],
      goals: [LIT],
      bonus: [
        { text: "Light it from a second hole in the same group", when: (S, m) => { m.h = m.h || new Set(); if (anyLit(S)) wireHoles(S, "bb:L8").forEach((h) => m.h.add(h)); return m.h.size >= 2; } },
        { text: "Pull the wire out again and watch the dots stop", when: (S, m) => { if (anyLit(S)) m.lit = true; return !!m.lit && wires(S).length === 0; } },
      ],
      solution: [{ next: 1 }, { next: 1 }, { wire: ["e8", "e14"] }, { wait: 1 }, { remove: "wire" }, { wait: 0.5 }, { wire: ["d8", "d14"] }, { wait: 1 }, { next: 1 }],
    },
    {
      id: "1-2", title: "Break the loop", teaches: ["switch"], uses: ["loop"],
      region: { rows: [1, 16], cols: "a-e", rails: "none" },
      start: start(BAT("a3", "a14"), RES("res1", "b3", "b7"), LED("led1", "c7", "c8"), WIRE("wire1", "e8", "e14")),
      rules: { tray: [], allow: { ctl: ["bat"] }, guardShorts: true },
      beats: [
        { id: "off", say: "The loop is closed, so current flows. Click the battery's switch to turn it off.", highlight: { ctl: "switch", id: "bat" },
          hints: [{ say: "The switch is the small green slider on the battery box." }], waitFor: { when: (S) => !onOff(S) } },
        { id: "on", say: "Off: the switch opened the loop inside the battery, so nothing flows anywhere. Now switch it on again.", highlight: { ctl: "switch", id: "bat" },
          waitFor: { when: (S) => onOff(S) && anyLit(S) } },
        { id: "p", say: "What happens if you pull the green wire out?", predict: { choices: ["Only the LED goes dark", "Everything stops", "Nothing changes"], answer: 1 }, highlight: { part: "wire1" }, waitFor: { predict: true } },
        { id: "pull", say: "Find out: drag the wire onto the parts tray, or click it and press Remove.", allow: { remove: ["wire1"] }, highlight: [{ part: "wire1" }, { ui: "#hotbar" }],
          hints: [{ say: "Click the green wire. A small card appears next to it with a Remove button." }],
          waitFor: { event: "remove", id: "wire1" } },
        { id: "close", say: (C) => `${C.right("p") ? "You called it: " : ""}everything stopped. A loop open anywhere stops all the current. Now close it again.`,
          hints: [{ say: "The wire is back in your tray. Drag it onto the board, or draw one from hole to hole." }, { show: [WIRE("h", "e8", "e14")] }],
          waitFor: { when: (S) => anyLit(S) } },
        FINISH("That is all a switch does: it opens and closes the loop."),
      ],
      goals: [LIT],
      bonus: [
        { text: "Predict what happens", final: (C) => C.right("p") },
        { text: "Close the loop with the wire in different holes", when: (S, m, C) => !!C.count.remove && anyLit(S) && wires(S).some((q) => !(q.legs.includes("e8") && q.legs.includes("e14"))) },
      ],
      solution: [{ ctl: "bat" }, { wait: 0.5 }, { ctl: "bat" }, { wait: 0.5 }, { choose: 1 }, { remove: "wire1" }, { wire: ["d8", "c14"] }, { wait: 1 }, { next: 1 }],
    },
    {
      id: "1-3", title: "Hidden strips", teaches: ["strip"], uses: ["loop"],
      region: { rows: [1, 16], cols: "a-e", rails: "none" },
      start: start(BAT("a3", "a14"), RES("res1", "b3", "b7"), WIRE("wire1", "d8", "d14")),
      rules: { tray: [{ type: "led", color: "red", n: 1 }], guardShorts: true },
      ui: { xray: true },
      beats: [
        { id: "xray", do: { xray: true }, say: "X-ray on! Under each group of 5 holes is a metal strip. Everything plugged into one strip is connected.", highlight: { nets: ["bb:L7"] }, waitFor: { next: true } },
        { id: "p", say: "If the LED's legs went into these two holes, would it light?", highlight: { holes: ["c10", "c11"] }, predict: { choices: ["Yes", "No"], answer: 1 }, waitFor: { predict: true } },
        { id: "plug", say: (C) => `${C.right("p") ? "Right: " : "No: "}those strips are not in the loop. Plug the LED into the resistor's strip and the wire's strip.`,
          highlight: { nets: ["bb:L7", "bb:L8"] },
          hints: [{ say: "One leg in strip 7 with the resistor, the other in strip 8 with the wire." }, { highlight: { holes: ["c7", "c8"] } }, { show: [LED("h", "c7", "c8")] }],
          waitFor: { when: (S) => anyLit(S) } },
        FINISH("Lit, with no extra wire: the strips did the joining. Try other holes in the same strips."),
      ],
      goals: [LIT],
      bonus: [
        { text: "Predict whether it lights", final: (C) => C.right("p") },
        { text: "Light it from two different pairs of holes", when: (S, m) => { m.h = m.h || new Set(); S.parts("led").forEach((q) => { if (lit(q)) m.h.add(q.legs[0]); }); return m.h.size >= 2; } },
      ],
      solution: [{ next: 1 }, { choose: 1 }, { place: { type: "led", color: "red" }, at: ["c7", "c8"] }, { wait: 0.6 }, { move: "led", to: ["e7", "e8"] }, { wait: 0.6 }, { next: 1 }],
    },
    {
      id: "1-4", title: "The rails", teaches: ["rail"], uses: ["loop", "strip"],
      region: { rows: [1, 34], cols: "a-e", rails: "top" },
      start: start(BAT("+T3", "-T4"), RES("res1", "+T6", "a6"), LED("led1", "c6", "c7")),
      rules: { tray: [{ type: "wire", n: 1 }], guardShorts: true },
      ui: { xray: true },
      beats: [
        { id: "rails", do: { xray: true }, say: "These long lines are the rails. Each rail is one strip that runs the whole length of the board.", highlight: { nets: ["bb:+T", "bb:-T"] }, waitFor: { next: true } },
        { id: "feed", say: "The battery feeds them: + to the red rail, − to the blue rail. The resistor takes its current from the red one.", highlight: [{ holes: ["+T3", "-T4"] }, { part: "res1" }], waitFor: { next: true } },
        { id: "p", say: "Would a wire from the LED to the far end of the blue rail, at row 30, close the loop?", highlight: { holes: ["-T30"] }, predict: { choices: ["Yes", "No"], answer: 0 }, waitFor: { predict: true } },
        { id: "wire", say: (C) => `${C.right("p") ? "Yes! " : "It would! "}The whole rail is one strip. Wire the LED's other strip to the blue − rail.`,
          highlight: { nets: ["bb:L7", "bb:-T"] },
          hints: [{ say: "Drag from a free hole in strip 7 to any hole on the blue rail." }, { highlight: { holes: ["e7", "-T7"] } }, { show: [WIRE("h", "e7", "-T7")] }],
          waitFor: { when: (S) => anyLit(S) } },
        FINISH("The rails bring + and − to wherever you need them along the board."),
      ],
      goals: [LIT],
      bonus: [
        { text: "Predict whether the far end works", final: (C) => C.right("p") },
        { text: "Use a − rail hole 20 or more rows from the battery", when: (S) => anyLit(S) && wireHoles(S, "bb:-T").some((h) => BBShared.parse(h).row >= 24) },
      ],
      solution: [{ next: 1 }, { next: 1 }, { choose: 0 }, { wire: ["e7", "-T30"] }, { wait: 1 }, { next: 1 }],
    },
    {
      id: "1-5", title: "Mind the gap", teaches: ["gap"], uses: ["loop", "strip", "rail"],
      region: { rows: [1, 24], cols: "a-j", rails: "top" },
      start: start(BAT("+T3", "-T4"), RES("res1", "+T6", "a6"), LED("led1", "c6", "c7"), WIRE("wire1", "g7", "-T7", "#f08c2a")),
      rules: { tray: [{ type: "wire", n: 1 }], allow: { move: ["wire1"], legs: ["wire1"] }, guardShorts: true },
      ui: { xray: true },
      beats: [
        { id: "p", say: "This circuit looks finished, but the LED stays dark. Why?", predict: { choices: ["The LED is broken", "The wire is not really connected", "The battery is flat"], answer: 1 }, waitFor: { predict: true } },
        { id: "gap", do: { xray: true }, say: (C) => `${C.right("p") ? "Good eye. " : ""}The gap down the middle splits each column into two strips. The wire is in the wrong one.`,
          highlight: { nets: ["bb:L7", "bb:R7"] }, waitFor: { next: true } },
        { id: "fix", say: "Fix it: drag the wire's end across the gap, or bridge the gap with a new wire.", highlight: { part: "wire1" },
          hints: [{ say: "Click the orange wire, then drag its round end at g7 up into strip 7, above the gap." }, { highlight: { holes: ["g7", "e7"] } }, { show: [WIRE("h", "e7", "f7")] }],
          waitFor: { when: (S) => anyLit(S) } },
        FINISH("Remember the gap: the top and bottom halves of a column are not connected."),
      ],
      goals: [LIT],
      bonus: [
        { text: "Find out why it is dark", final: (C) => C.right("p") },
        { text: "Fix it by bridging the gap with a new wire", when: (S) => anyLit(S) && !!part(S, "wire1") && part(S, "wire1").legs.includes("g7") },
      ],
      solution: [{ choose: 1 }, { next: 1 }, { wire: ["e7", "f7"] }, { wait: 1 }, { next: 1 }],
    },
    {
      id: "1-6", title: "Which way round?", teaches: ["polarity"], uses: ["loop", "strip", "rail"],
      region: { rows: [1, 24], cols: "a-j", rails: "top" },
      start: start(BAT("+T3", "-T4"), RES("res1", "+T6", "a6"), LED("led1", "c7", "c6"), LED("led2", "d8", "d7", "yellow"), WIRE("wire1", "e8", "-T8")),
      rules: { tray: [], allow: { flip: ["led1", "led2"] }, guardShorts: true },
      ui: { xray: true },
      beats: [
        { id: "dark", say: "Two LEDs in one loop, and both are dark. An LED is one-way: current can only go in at its + leg.", highlight: { parts: ["led1", "led2"] }, waitFor: { next: true } },
        { id: "leg", say: "The + leg is the long one, marked + here. It must face the + side of the loop, where the resistor is.", highlight: { holes: ["c7", "d8"] }, waitFor: { next: true } },
        { id: "p", say: "If you flip just the red LED, will the lights come on?", highlight: { part: "led1" }, predict: { choices: ["Yes", "No"], answer: 1 }, waitFor: { predict: true } },
        { id: "flip", say: "Click an LED and press Flip (or the R key). Make both face the right way.",
          hints: [{ say: "Current comes from the resistor on the left. Each + leg should be on the left side of its LED." }, { highlight: { parts: ["led1", "led2"] } }],
          waitFor: { when: (S) => lit(part(S, "led1"), 0.002) && lit(part(S, "led2"), 0.002) } },
        FINISH("One-way parts must all face along the loop, from + to −."),
      ],
      goals: [{ text: "Light both LEDs", when: (S) => lit(part(S, "led1"), 0.002) && lit(part(S, "led2"), 0.002), hold: 0.6 }],
      bonus: [
        { text: "Predict what one flip does", final: (C) => C.right("p") },
        { text: "Use no more than 2 flips", final: (C) => (C.count.flip || 0) <= 2 },
      ],
      solution: [{ next: 1 }, { next: 1 }, { choose: 1 }, { flip: "led1" }, { flip: "led2" }, { wait: 1 }, { next: 1 }],
    },
    {
      id: "1-7", title: "Why the resistor?", teaches: ["resistor"], uses: ["loop", "strip", "rail", "polarity"],
      region: { rows: [1, 24], cols: "a-j", rails: "top" },
      start: start(BAT("+T3", "-T4"), RES("res1", "+T6", "a6"), LED("led1", "c6", "c7"), WIRE("wire1", "e7", "-T7")),
      rules: { tray: [{ type: "wire", n: 1 }], allow: { place: false, replace: ["led1"] }, guardShorts: true },
      allowDamage: true, simText: { led: null },
      ui: { xray: true },
      beats: [
        { id: "what", say: "This striped part is a resistor. What is it doing here?", highlight: { part: "res1" }, waitFor: { next: true } },
        { id: "p", say: "If a plain wire took the resistor's place, the LED would…", predict: { choices: ["glow brighter", "stay the same", "burn out"], answer: 2 }, waitFor: { predict: true } },
        { id: "out", say: "Let's find out. Drag the resistor onto the parts tray to take it out.", allow: { remove: ["res1"] }, highlight: [{ part: "res1" }, { ui: "#hotbar" }],
          hints: [{ say: "Or click the resistor and press Remove on the card next to it." }], waitFor: { event: "remove", id: "res1" } },
        { id: "bridge", say: "Dark: the loop is open. Now bridge the gap with a wire, from the red + rail to the LED's strip.", allow: { place: true },
          highlight: { nets: ["bb:+T", "bb:L6"] },
          hints: [{ highlight: { holes: ["+T6", "a6"] } }, { show: [WIRE("h", "+T6", "a6")] }],
          waitFor: { when: (S) => S.destroyed("led") } },
        { id: "fix", say: (C) => `${C.right("p") ? "You called it. " : ""}Pop! Nothing held the current back. Fix it: wire out, resistor back, and a fresh LED.`,
          allow: { place: true, remove: ["res1"] },
          hints: [{ say: "Take the new wire off. Drop the resistor on the red rail above the LED's strip. Then click the LED and press Fresh one." }, { show: [RES("h", "+T6", "a6")] }],
          waitFor: { when: (S) => lit(part(S, "led1")) && S.parts("resistor").length > 0 } },
        FINISH("That is the resistor's job: it holds the current down to a safe amount."),
      ],
      goals: [{ text: "Light the LED safely, with a resistor", when: (S) => safe(part(S, "led1")) && S.parts("resistor").length > 0, hold: 0.6 }],
      bonus: [
        { text: "Predict what happens", final: (C) => C.right("p") },
        { text: "Fix it with only one fresh LED", final: (C) => (C.count.replace || 0) <= 1 },
      ],
      solution: [{ next: 1 }, { choose: 2 }, { remove: "res1" }, { wire: ["+T6", "a6"] }, { wait: 0.5 }, { remove: "wire" },
        { place: { type: "resistor", value: 330 }, at: ["+T6", "a6"] }, { replace: "led1" }, { wait: 1 }, { next: 1 }],
    },
    {
      id: "1-8", title: "Short circuit", teaches: ["short"], uses: ["loop", "rail", "resistor"],
      region: { rows: [1, 24], cols: "a-j", rails: "top" },
      start: start(BAT("+T3", "-T4"), RES("res1", "+T6", "a6"), LED("led1", "c6", "c7"), WIRE("wire1", "e7", "-T7")),
      rules: { tray: [{ type: "wire", n: 1 }], guardShorts: false, banner: true },
      allowDamage: true, simText: { wire: null },
      ui: { xray: true },
      beats: [
        { id: "p", say: "What happens if a wire joins the red + rail straight to the blue − rail?", predict: { choices: ["The LED gets brighter", "The LED goes dark", "Nothing"], answer: 1 }, waitFor: { predict: true } },
        { id: "try", say: "Try it: drag a wire from the red + rail to the blue − rail.", highlight: { nets: ["bb:+T", "bb:-T"] },
          hints: [{ highlight: { holes: ["+T12", "-T12"] } }, { show: [WIRE("h", "+T12", "-T12")] }],
          waitFor: { when: (S) => S.shortNow(), hold: 0.05 } },
        { id: "pull", say: "Short circuit! The current takes the easy path, so the LED is dark and the wire heats up. Pull it out, quick!",
          waitFor: { when: (S) => !S.shortNow(), hold: 0.05 } },
        FINISH((C) => (C.broken.has("wire") ? "Too late: it melted. A short has nothing to slow the current, so it gets huge and hot." : "Phew! A short has nothing to slow the current, so it gets huge and hot. Never join + and − directly.")),
      ],
      goals: [{ text: "Light the LED, with no short circuit", when: (S) => anyLit(S) && !S.shortNow(), hold: 0.6 }],
      bonus: [
        { text: "Predict what a short does", final: (C) => C.right("p") },
        { text: "Pull the short out before the wire melts", final: (C) => !C.broken.has("wire") },
      ],
      solution: [{ choose: 1 }, { wire: ["+T12", "-T12"] }, { wait: 0.4 }, { remove: "wire" }, { wait: 1 }, { next: 1 }],
    },
    {
      id: "1-9", title: "Build it yourself", teaches: [], uses: ["loop", "strip", "rail", "gap", "polarity", "resistor", "short"],
      card: { name: "Your first circuit", text: "Battery +, a resistor, an LED with its + leg towards +, and back to −. You built it from nothing." },
      region: { rows: [1, 30], cols: "a-j", rails: "top" },
      start: start(BAT("+T3", "-T4")),
      rules: { tray: [{ type: "resistor", value: 330, n: 1 }, { type: "led", color: "red", n: 1 }, { type: "wire", n: 3 }], guardShorts: false, banner: true },
      allowDamage: true,
      ui: { xray: true },
      beats: [
        { id: "brief", say: "Your turn. Light the LED safely from the rails. You have a resistor, an LED and three wires.", waitFor: { next: true, label: "Start" } },
        { id: "build", say: "Build it. Ask for a hint any time.",
          hints: [{ say: "The path: + rail, resistor, LED (+ leg first), then back to the − rail. Drop the resistor on the red rail." }, { highlight: { nets: ["bb:+T", "bb:-T"] } },
            { show: [RES("h1", "+T10", "a10"), LED("h2", "c10", "c11"), WIRE("h3", "e11", "-T11")] }],
          waitFor: { when: (S) => S.parts("led").some(safe) } },
        FINISH("You built it from nothing. That is the circuit behind every little indicator light."),
      ],
      goals: [{ text: "Light the LED safely", when: (S) => S.parts("led").some(safe), hold: 0.6 }],
      bonus: [
        { text: "Nothing breaks", final: (C) => C.broken.size === 0 },
        { text: "Use at most one wire", when: (S) => S.parts("led").some(safe) && wires(S).length <= 1 },
      ],
      solution: [{ next: 1 }, { place: { type: "resistor", value: 330 }, at: ["+T10", "a10"] }, { place: { type: "led", color: "red" }, at: ["c10", "c11"] },
        { wire: ["e11", "-T11"] }, { wait: 1 }, { next: 1 }],
    },
    {
      id: "1-10", title: "Two lights", teaches: [], uses: ["loop", "strip", "rail", "gap", "polarity", "resistor", "short"],
      card: { name: "Two circuits, one battery", text: "Each LED gets its own resistor. Both share the same rails, so one battery lights them all." },
      region: { rows: [1, 40], cols: "a-j", rails: "top" },
      start: start(BAT("+T3", "-T4")),
      rules: { tray: [{ type: "resistor", value: 330, n: 2 }, { type: "led", color: "red", n: 1 }, { type: "led", color: "green", n: 1 }, { type: "wire", n: 3 }], guardShorts: false, banner: true },
      allowDamage: true,
      ui: { xray: true },
      beats: [
        { id: "brief", say: "Last one: light both LEDs at the same time, each with its own resistor.", waitFor: { next: true, label: "Start" } },
        { id: "build", say: "Build it.",
          hints: [{ say: "Build two LED circuits side by side. Both can use the same rails." },
            { show: [RES("h1", "+T8", "a8"), LED("h2", "c8", "c9"), WIRE("h3", "e9", "-T9"), RES("h4", "+T16", "a16"), LED("h5", "c16", "c17", "green"), WIRE("h6", "e17", "-T17")] }],
          waitFor: { when: (S) => S.parts("led").filter(safe).length >= 2 } },
        FINISH("Two lights, one battery. That is Chapter 1 done!"),
      ],
      goals: [{ text: "Light both LEDs safely", when: (S) => S.parts("led").filter(safe).length >= 2, hold: 0.6 }],
      bonus: [
        { text: "Nothing breaks", final: (C) => C.broken.size === 0 },
        { text: "Use at most one wire", when: (S) => S.parts("led").filter(safe).length >= 2 && wires(S).length <= 1 },
      ],
      solution: [{ next: 1 }, { place: { type: "resistor", value: 330 }, at: ["+T8", "a8"] }, { place: { type: "led", color: "red" }, at: ["c8", "c9"] },
        { place: { type: "led", color: "green" }, at: ["c16", "-T16"] }, { place: { type: "resistor", value: 330 }, at: ["+T16", "a16"] }, { wire: ["e9", "-T9"] },
        { wait: 1 }, { next: 1 }],
    },
  ];

  for (const lv of L) {
    lv.chapter = 1; lv.view = lv.view || lv.region.rows;
    // the battery pack sits centred above the open part of the board, clear of the objective card
    const bat = lv.start.parts.find((p) => p.type === "battery"), [r0, r1] = lv.region.rows;
    if (bat) { bat.bx = Math.round((xr(r0) + xr(r1)) / 2 - 115); bat.by = -150; }
  }
  BB.Levels = BB.Levels || {};
  BB.Levels.chapters = [{ n: 1, title: "First Light", levels: L }];
  BB.Levels.all = () => BB.Levels.chapters.flatMap((c) => c.levels);
  BB.Levels.get = (id) => BB.Levels.all().find((l) => l.id === id) || null;
})(window.BB = window.BB || {});
