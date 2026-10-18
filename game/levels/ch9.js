// Chapter 9: The transistor. A tiny current into the base lets a big current flow from collector to emitter, so a
// transistor is a switch worked by a small current; the base needs its own resistor or it burns. Then you build a
// transistor switch yourself, and an open puzzle: a tiny button, made for at most 2 mA, must switch an LED that needs
// about 11 mA.
// Same rules as before: a question in every level, predict first, the goal and not the holes, hints only on request.
// Data only, built with the kit from ch1.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, safe, part, wires, darkLed, FINISH } = K;
  const { allow, REGION, NEXT, shownmA } = K.meter;

  const fmtI = (a) => { const m = Math.abs(a) * 1000; return `${m < 1 ? m.toFixed(2) : m < 10 ? m.toFixed(1) : Math.round(m)} mA`; };
  // the transistor in strips 12 (C), 13 (B) and 14 (E); the LED's loop from the + rail through it to the − rail
  const NPN = (V) => ({ id: "q1", type: "npn", legs: V.hs("c12", "c13", "c14") });
  const NPN_AT = (legs, id) => ({ id, type: "npn", legs });
  const LOOP = (V) => [V.RES("r1", "+T8", "a8", 330), V.LED("led1", "c8", "c9"), V.WIRE("w1", "e9", "e12"), NPN(V), V.WIRE("w2", "a14", "-T14")];

  const L = [
    {
      id: "9-1", title: "A tiny current", teaches: ["npnSwitch"], uses: ["current", "ohmsLaw", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 4],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["The LED lights", "Nothing", "The transistor burns out"], 0, [null, "a small current into B is exactly what opens the path from C to E.",
          "the 10 kΩ keeps the base current tiny and safe: that is what it is there for."]), seen = {};
        const on = (S) => { const q = part(S, "q1"), l = part(S, "led1"); if (q && lit(l)) { seen.ib = q.rd.Ib; seen.ic = q.rd.Ic; } return !!q && q.ok && lit(l); };
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), ...LOOP(V), V.RES("rb", "b13", "b17", 10000)),
          rules: { tray: [{ type: "wire", n: 1 }] },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "A transistor: three legs, C, B and E. The LED's loop runs in at C and out at E, yet it is dark. What if a tiny current flows into B?",
              highlight: { part: "q1" }, predict: P, waitFor: { predict: true } },
            { id: "touch", say: "Find out: draw a wire from the + rail to the free end of the 10 kΩ resistor, so a little current flows into B.",
              hints: [{ say: `The 10 kΩ runs from the B strip to strip ${V.r(17)}. Join strip ${V.r(17)} to the + rail.` }, { show: [V.WIRE("h", "+T17", "a17")] }], waitFor: { when: on, hold: 0.5 } },
            { id: "name", reply: "p", say: () => `${fmtI(seen.ib ?? 0.0005)} into B switches ${fmtI(seen.ic ?? 0.012)} through the LED. A small current controls a big one.`,
              waitFor: NEXT },
            { id: "loops", say: "Two loops share E. The big one: + rail, 330 Ω, LED, in at C, out at E, − rail. The small one: + rail, 10 kΩ, in at B, out at E too.",
              highlight: { part: "q1" }, waitFor: NEXT },
            { id: "off", say: "Now take that wire away. No current into B, so the LED goes dark: switching B's tiny current switches the LED's big one.",
              waitFor: { event: "remove" } },
            Object.assign(FINISH("Both currents leave by E, so E always goes to the − rail. Switch B's tiny current on and off, and the LED's big one follows."),
              { note: "leg order differs by part: a BC547 is C, B, E (flat side to you); 2N2222s come as E, B, C or C, B, E. Check the datasheet." }),
          ],
          goals: [{ text: "Light the LED through the transistor", when: on }],
          challenge: { text: "Finish without a hint", final: (C) => C.hintsUsed === 0 },
          solution: [{ choose: "right" }, { wire: V.hs("+T17", "a17") }, { wait: 0.8 }, { next: 1 }, { next: 1 }, { remove: "wire" }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "9-2", meter: "mA", title: "The base resistor", teaches: ["baseR"], uses: ["npnSwitch", "short", "resistor", "loop", "strip", "rail"], shifts: [0, 4],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["The LED gets brighter", "The transistor burns out", "Nothing happens"], 1, ["the LED's current is set by its 330 Ω, not by the base. And far too much rushes into B.", null,
          "with no resistor, hundreds of mA rush into B, and the transistor burns."]);
        const burned = (S) => S.parts("npn").some((q) => !q.ok);
        const fixed = (S) => S.parts("npn").every((q) => q.ok) && S.parts("resistor").some((q) => q.part.value === 10000) && lit(part(S, "led1"));
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), ...LOOP(V)),
          rules: { tray: [{ type: "wire", n: 1 }, { type: "resistor", value: 10000, n: 1 }], banner: true },
          demo: { npn: 1 }, simText: { npn: null },
          ui: { strips: true },
          beats: [
            { id: "p", say: "Last time a 10 kΩ fed the base. What if a wire runs straight from the + rail into B, with no resistor?", highlight: { part: "q1" },
              predict: P, waitFor: { predict: true } },
            { id: "try", say: `Find out: draw a wire from the + rail straight into strip ${V.r(13)}, the B strip.`, hints: [{ show: [V.WIRE("h", "+T13", "a13")] }],
              waitFor: { when: burned, hold: 0.05 } },
            { id: "fix", reply: "p", say: "Pop! Hundreds of mA rushed into B. Wire out, 10 kΩ from the + rail to B, then click the transistor: Fresh one.",
              hints: [{ say: "Remove the wire. 10 kΩ from the + rail into the B strip. Then click the transistor and press Fresh one." }, { show: [V.RES("h", "+T13", "a13", 10000)] }],
              waitFor: { when: fixed, hold: 0.6 } },
            Object.assign(FINISH("Base current flows in at B and out at E, through a junction that needs about 0.7 V. 10 kΩ lets in (6 − 0.7) V ÷ 10 kΩ ≈ 0.5 mA."),
              { note: "a burned transistor gets hot enough to burn you. Always give the base its own resistor." }),
          ],
          goals: [{ text: "Light the LED with a 10 kΩ on the base", when: fixed, hold: 0.6 }],
          challenge: { text: "Finish without a hint", final: (C) => C.hintsUsed === 0 },
          solution: [{ choose: "right" }, { wire: V.hs("+T13", "a13") }, { wait: 0.5 }, { remove: "wire" }, { place: { type: "resistor", value: 10000 }, at: V.hs("+T13", "a13") },
            { replace: "q1" }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "9-3", title: "Your own switch", teaches: [], uses: ["npnSwitch", "baseR", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0],
      card: { name: "Your own transistor switch", text: "The LED's loop in at C, B's loop through a resistor into B, and E, where both leave, to the − rail." },
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["E", "C", "B"], 0, [null, "C is where the LED's current goes in. Both currents leave by E, so E goes to the − rail.",
          "B is the control leg: its tiny current comes in from the 10 kΩ, then leaves by E."]);
        const npn = (S) => S.parts("npn").find((q) => q.ok && q.legs.every(Boolean));
        const on = (S) => { const q = npn(S); return !!q && Math.abs(q.rd.Ib || 0) > 1e-5 && Math.abs(q.rd.Ic || 0) > 0.003 && S.parts("led").some(safe); };
        const offB = (S, m) => { if (on(S)) m.on = true; return !!m.on && !!npn(S) && S.parts("led").length > 0 && !S.parts("led").some((q) => lit(q, 0.0005)) && !S.parts("resistor").some((q) => q.part.value === 10000); };
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4")),
          rules: { tray: [{ type: "npn", n: 1 }, { type: "resistor", value: 330, n: 1 }, { type: "resistor", value: 10000, n: 1 }, { type: "led", color: "red", n: 1 },
            { type: "wire", n: 3 }], banner: true },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "brief", say: V.say("Your turn: a transistor switch on an empty board. Drop the transistor on three free strips: its legs read C, B, E.",
              "Now you build a transistor switch yourself. Drop the transistor on three free strips; its legs read C, B and E."), waitFor: { next: true, label: "Start" } },
            { id: "p", say: "Before you build: which of the transistor's three legs must go to the − rail?", predict: P, waitFor: { predict: true } },
            { id: "build", reply: "p", say: "E, where both currents leave. Build both loops: + rail, 330 Ω, the LED, into C. And + rail, 10 kΩ, into B.",
              hints: [{ say: "The LED's − leg goes in C's strip, the 10 kΩ's end in B's strip, and a wire joins E's strip to the − rail." },
                { show: [V.RES("h1", "+T12", "a12", 330), V.LED("h2", "b12", "b14"), NPN_AT(["c14", "c15", "c16"], "h3"), V.WIRE("h4", "a16", "-T16"), V.RES("h5", "+T15", "a15", 10000)] }],
              waitFor: { when: on, hold: 0.5 } },
            { id: "off", say: "Now switch the LED off at B: take the 10 kΩ out, and watch the LED.", hints: [{ say: "Click the 10 kΩ and press Remove." }],
              waitFor: { when: offB, hold: 0.3 } },
            FINISH("B's tiny current switched the LED's big one: your own transistor switch. Next: a button does the switching."),
          ],
          goals: [{ text: "Light the LED through the transistor", when: on }, { text: "Switch it off at B", when: offB }],
          react: [{ hold: 1.5, when: (S, C) => {
            const q = npn(S);
            if (!C.beat || C.beat.id !== "build" || !q) return null;
            if (S.parts("led").some((l) => lit(l)) && Math.abs(q.rd.Ic || 0) < 0.002) return "The LED lights, but its current doesn't pass the transistor. The LED's loop must go in at C and out at E.";
            if (S.parts("led").some((l) => lit(l, 0.003))) return null;
            if (!S.same(q.nets[2], "bb:-T")) return "Nothing joins E to the − rail, so neither loop is closed. Both currents leave the transistor by E.";
            if (Math.abs(q.rd.Ib || 0) < 1e-5) return "No current flows into B yet. B's loop: + rail, 10 kΩ, into B's strip, then out by E to the − rail.";
            return darkLed(S);
          } }],
          challenge: { text: "Use only one wire", when: (S) => wires(S).length <= 1 && on(S) },
          solution: [{ next: 1 }, { choose: "right" }, { place: { type: "resistor", value: 330 }, at: ["+T12", "a12"] }, { place: { type: "led", color: "red" }, at: ["b12", "b14"] },
            { place: { type: "npn" }, at: ["c14", "c15", "c16"] }, { wire: ["a16", "-T16"] }, { place: { type: "resistor", value: 10000 }, at: ["+T15", "a15"] }, { wait: 1 },
            { remove: "resistor" }, { wait: 0.8 }, { next: 1 }],
        };
      },
    },
    {
      id: "9-4", meter: "mA", title: "The weak button", teaches: [], uses: ["npnSwitch", "baseR", "buttonLoop", "buttonLegs", "current", "loop", "resistor", "polarity", "strip", "rail", "gap"],
      shifts: [0],
      card: { name: "The transistor switch", text: "A tiny current into B, through a resistor, lets a big current flow from C to E. A small switch can control a big load." },
      layouts: [{}],
      // A tiny button (like a key on a thin keypad) made for at most 2 mA must switch the green LED's ≈ 11 mA. The simulated
      // button does not break at 11 mA: 2 mA is this button's rating, and the goal checks it. Worked numbers (6 V, 0.5 Ω inside,
      // green LED 2.2 V at 12 mA, NPN β = 200, Vbe ≈ 0.7 V, a pressed button ≈ 0.2 Ω; in brackets what the simulator gives):
      //  - right: LED loop + → 330 Ω → LED → C, E → −; the button feeds B through the 10 kΩ. Base (6 − 0.7) / 10 kΩ ≈ 0.53 mA
      //    through the button ✓ (0.53 mA); β × 0.53 mA ≈ 106 mA ≫ what the 330 Ω allows, so the transistor is fully on and the LED gets
      //    (6 − 2.2 − ~0.1) / 330 ≈ 11 mA ✓ (11.2 mA; the goal asks ≥ 5 mA). Button up: no base current, LED dark ✓.
      //  - the button in the LED's own loop (with or without the transistor): ≈ (6 − 2.2) / 330 ≈ 11.5 mA through it ✗ (11.5 mA; 11.2 mA with the transistor).
      //  - the button between E and − (or C and the LED): it carries Ic + Ib ≈ 11.2 + 0.5 mA ✗ (11.7 mA).
      //  - resistors swapped (button + 330 Ω into B, 10 kΩ in the LED's loop): base (6 − 0.7) / 330 ≈ 16 mA through the button ✗ (15.3 mA),
      //    and the LED only gets ≈ (6 − 2.2) / 10 kΩ ≈ 0.4 mA ✗ (0.40 mA).
      //  - the button straight into B, no resistor: hundreds of mA, the base burns (the game's burn message) ✗.
      //  - 10 kΩ from + to B and the button from B to −: on with the button up (11.2 mA), off with it down ✗ (the wrong way round).
      // "Off" means under 0.5 mA, "on" at least 5 mA: resistors and an LED alone give no current gain, so a contact carrying
      // ≤ 2 mA cannot change the LED's current by 4.5 mA. Only the transistor can pass this goal.
      make: (V) => {
        const LIMIT = 0.002, seen = {};
        const P = V.predict(["About 11 mA, like the LED", "About 2 mA", "Almost none"], 0, [null,
          "in one loop every part carries the same current, so the LED's 11 mA flows through the button too.",
          "pressed, the button is almost a wire in the loop: the LED's whole 11 mA flows through it."]);
        const WORD = ["", "", "twice", "three times", "four times", "five times", "six times", "seven times", "eight times", "nine times", "ten times"];
        // the current through a button: through its contacts (pressed) or along a joined pair, whichever is biggest
        const btnI = (b) => {
          const l = b.rd.legI || [0, 0, 0, 0], into = b.part.pairs === "along" ? [l[0], l[2], l[1], l[3]] : l;
          return Math.max(Math.abs(into[0] + into[1]), ...l.map((x) => Math.abs(x)));
        };
        const btnMax = (S) => Math.max(0, ...S.parts("button").map(btnI));
        const ledI = (S) => Math.max(0, ...S.parts("led").filter((q) => q.ok).map((q) => q.rd.I || 0));
        // the circuit as built, with the battery switch (not the button's state): a change means testing the new circuit again
        const built = (S) => S.all.filter((q) => q.type !== "meter").map((q) => `${q.id}:${q.legs.join(",")}:${q.part.on !== false}`).join("|");
        const tested = (S, m) => {
          const bs = S.parts("button");
          if (!bs.length || S.destroyed()) return false;
          const key = built(S);
          if (m.key !== key) { m.key = key; m.off = m.on = false; }
          const down = bs.some((b) => b.part.pressed), i = ledI(S), ib = btnMax(S);
          if (!down && i < 0.0005) m.off = true;
          if (down && i >= 0.005 && ib <= LIMIT) { m.on = true; seen.ib = ib; seen.il = i; }
          return !!m.off && !!m.on;
        };
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4")),
          rules: { tray: [{ type: "npn", n: 1 }, { type: "button", n: 1 }, { type: "resistor", value: 10000, n: 1 }, { type: "resistor", value: 330, n: 1 },
            { type: "led", color: "green", n: 1 }, { type: "wire", n: 4 }], latchButtons: true, banner: true },
          ui: { strips: true },
          goalsFrom: 3,
          beats: [
            { id: "brief", say: V.say("The keys of a thin keypad are tiny buttons. This one is made for at most 2 mA. More, and its contacts wear out. The LED needs about 11 mA.",
              "This tiny button is like a key on a thin keypad: made for at most 2 mA. More, and its contacts wear out. The LED needs about 11 mA."), waitFor: NEXT },
            { id: "p", say: "If the button sat in the LED's own loop, how much current would flow through it when pressed?", predict: P, waitFor: { predict: true } },
            { id: "recall", reply: "p", say: "Too much for this button. But in 9-3, B's tiny current through the 10 kΩ switched the LED's big one.",
              waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Make the button light the LED: off with it up, on with it down. Click the button to hold it down; click again to let it up.",
              hints: [{ say: "The LED's loop: + rail, 330 Ω, the LED, then the transistor in at C, out at E, and on to the − rail." },
                { say: "The button's loop: + rail, the 10 kΩ, the button, then into B. Its tiny current leaves by E too.",
                  highlight: { holes: V.hs("c14", "c15", "c16") } },
                { show: [V.RES("h1", "+T12", "a12", 330), V.LED("h2", "b12", "b14", "green"), { id: "h3", type: "npn", legs: V.hs("c14", "c15", "c16") },
                  V.WIRE("h4", "a16", "-T16"), { id: "h6", type: "button", legs: V.hs("e15", "f15", "e17", "f17"), pairs: "across" }, V.RES("h7", "+T20", "a17", 10000)] }],
              waitFor: { when: tested } },
            Object.assign(FINISH(() => `Just ${shownmA(seen.ib ?? 0.00053)} through the button switched ${shownmA(seen.il ?? 0.0113)} through the LED, by way of the transistor. Chapter 9 done!`),
              { note: "a real key or small switch has a current rating on its datasheet. Above it, its contacts wear out or burn." }),
          ],
          goals: [{ text: "Off with the button up, on with it down, and at most 2 mA through the button", when: tested }],
          react: [{ hold: 1, when: (S, C) => (C.beat && C.beat.id === "build" ? darkLed(S) : null) }, { hold: 1.5, when: (S, C) => {
            // the button down and the LED dark: say which loop is missing
            const q = S.parts("npn").find((x) => x.ok), down = S.parts("button").some((b) => b.part.pressed);
            if (!C.beat || C.beat.id !== "build" || !q || !down || ledI(S) > 0.003 || q.legs.some((l) => !l)) return null;
            if (!S.same(q.nets[2], "bb:-T")) return "Nothing joins E to the − rail, so neither loop is closed. Both currents leave the transistor by E.";
            if (Math.abs(q.rd.Ib || 0) < 1e-5) return "The button is down, but no current flows into B. B's loop needs a path: + rail, 10 kΩ, button, B, then out by E to the − rail.";
            return null;
          } }, { hold: 1, when: (S) => {
            if (!S.parts("button").some((b) => b.part.pressed) || S.destroyed()) return null;
            const ib = btnMax(S); if (ib <= LIMIT) return null;
            const n = Math.round(ib / LIMIT);
            if (ledI(S) < 0.003) return `${shownmA(ib)} flows through the button, but it is made for at most 2 mA.`;
            return `The LED lights, but ${shownmA(ib)} flows through the button: ${n >= 2 ? `${WORD[n] || `${n} times`} what it is made for` : "more than it is made for"}.`;
          } }],
          challenge: { text: "Use only one wire", when: (S, m) => S.parts("wire").length <= 1 && tested(S, m) },
          solution: [{ next: 1 }, { choose: "right" }, { next: 1 }, { place: { type: "resistor", value: 330 }, at: V.hs("+T12", "a12") },
            { place: { type: "led", color: "green" }, at: V.hs("b12", "b14") }, { place: { type: "npn" }, at: V.hs("c14", "c15", "c16") }, { wire: V.hs("a16", "-T16") },
            { place: { type: "button", pairs: "across", pressed: false, latch: true }, at: V.hs("e15", "f15", "e17", "f17") },
            { place: { type: "resistor", value: 10000 }, at: V.hs("+T20", "a17") }, { wait: 0.5 }, { press: "button" }, { wait: 0.8 }, { press: "button" }, { wait: 0.3 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(9, "The transistor", L, {
    "lede": "A tiny current can control a big one. That is the transistor, and billions of its cousins fill every computer.",
    "cover": "npnSwitch",
    "questions": [
      "What does a tiny current into the base do?",
      "Why does the base need its own resistor?",
      "How can a small button switch a bigger current?"
    ],
    "words": [
      {
        "w": "Transistor",
        "d": "A part where a small current into B controls a big one from C to E. Here it is a switch; it can also amplify.",
        "sym": "npn"
      },
      {
        "w": "Base (B)",
        "d": "The control leg. A small current in here lets current flow from C to E.",
        "sym": "npn"
      },
      {
        "w": "Collector (C), emitter (E)",
        "d": "The big current comes in at C and leaves at E.",
        "sym": "npn"
      },
      {
        "w": "Fully on",
        "d": "With plenty of base current the transistor is almost a closed switch: the LED's resistor sets the current.",
        "sym": "switch"
      }
    ]
  });
})(window.BB = window.BB || {});
