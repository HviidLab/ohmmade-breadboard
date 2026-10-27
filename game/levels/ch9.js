// Chapter 9: The transistor. A tiny current into the base lets a big current flow from collector to emitter, so a
// transistor is a switch worked by a small current; the base needs its own resistor or it burns. Then you build a
// transistor switch in three steps, and a small puzzle: a tiny button, made for at most 2 mA, must switch an LED that
// needs about 11 mA. Which of two gaps gets the button?
// Kept easy on purpose (playtest 2026-10-27: Chapters 9–11 were too hard): mostly pre-built boards, 1–2 parts per
// step, the target strips marked, no voltages or gain in the action lines.
// Same rules as before: a question in every level, predict first, hints only on request.
// Data only, built with the kit from ch1.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, safe, part, darkLed, FINISH } = K;
  const { REGION, NEXT, shownmA } = K.meter;

  const fmtI = (a) => { const m = Math.abs(a) * 1000; return `${m < 1 ? m.toFixed(2) : m < 10 ? m.toFixed(1) : Math.round(m)} mA`; };
  // the transistor in strips 12 (C), 13 (B) and 14 (E); the LED's loop from the + rail through it to the − rail
  const NPN = (V) => ({ id: "q1", type: "npn", legs: V.hs("c12", "c13", "c14") });
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
            { id: "p", say: "A transistor, with legs C, B and E. The LED's loop runs in at C and out at E, yet the LED is dark. What if a tiny current flows into B?",
              highlight: { part: "q1" }, predict: P, waitFor: { predict: true } },
            { id: "touch", say: "Find out: draw a wire from the + rail to the free end of the 10 kΩ (both marked). Then a tiny current can flow into B.",
              highlight: { holes: V.hs("+T17", "a17") },
              hints: [{ say: `The 10 kΩ runs from B's strip to strip ${V.r(17)}. Join strip ${V.r(17)} to the + rail.` }, { show: [V.WIRE("h", "+T17", "a17")] }], waitFor: { when: on, hold: 0.5 } },
            { id: "name", reply: "p", say: () => `${fmtI(seen.ib ?? 0.0005)} into B switches ${fmtI(seen.ic ?? 0.012)} through the LED. A small current controls a big one.`,
              waitFor: NEXT },
            { id: "loops", say: "Two currents meet here. The LED's big one goes in at C, the tiny one in at B. Both come out at E, and go on to the − rail.",
              highlight: { part: "q1" }, waitFor: NEXT },
            { id: "off", say: "Now take your wire away, and watch the LED.",
              hints: [{ say: "Click the wire and press Remove, or drag it back to the parts tray." }], waitFor: { event: "remove" } },
            Object.assign(FINISH("No current into B, no current through the LED. Switch B's tiny current on and off, and the LED's big one follows."),
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
        const B = V.n("bb:L13");
        const burned = (S) => S.parts("npn").some((q) => !q.ok);
        const noWire = (S) => !S.parts("wire").some((w) => w.nets.some((n) => S.same(n, B)) && w.nets.some((n) => S.same(n, "bb:+T")));
        const baseR = (S) => S.parts("resistor").some((r) => r.part.value === 10000 && S.joins(r, "bb:+T", B));
        const fixed = (S) => S.parts("npn").every((q) => q.ok) && baseR(S) && lit(part(S, "led1"));
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), ...LOOP(V)),
          rules: { tray: [{ type: "wire", n: 1 }, { type: "resistor", value: 10000, n: 1 }], banner: true },
          demo: { npn: 1 }, simText: { npn: null },
          ui: { strips: true },
          beats: [
            { id: "p", say: "Last time a 10 kΩ fed B. What if a wire runs straight from the + rail into B, with no resistor?", highlight: { part: "q1" },
              predict: P, waitFor: { predict: true } },
            { id: "try", say: "Find out: draw a wire from the + rail straight into B's strip (both marked).", highlight: { holes: V.hs("+T13", "a13") },
              hints: [{ show: [V.WIRE("h", "+T13", "a13")] }], waitFor: { when: burned, hold: 0.05 } },
            { id: "out", reply: "p", say: "Pop! Far too much current rushed into B and burned the transistor. Take your wire out.",
              hints: [{ say: "Click the wire and press Remove, or drag it back to the parts tray." }], waitFor: { when: noWire } },
            { id: "res", say: "Now put the 10 kΩ where the wire was: from the + rail into B's strip (marked).", highlight: { holes: V.hs("+T13", "a13") },
              hints: [{ show: [V.RES("h", "+T13", "a13", 10000)] }], waitFor: { when: baseR } },
            { id: "fresh", say: "Last, a new transistor: click the burned one and press Fresh one.", highlight: { part: "q1" },
              hints: [{ say: "Click the transistor. A small card appears with a Fresh one button." }], waitFor: { when: fixed, hold: 0.6 } },
            Object.assign(FINISH("The 10 kΩ lets only about 0.5 mA into B: plenty to switch the LED, and safe for the transistor."),
              { note: "a burned transistor gets hot enough to burn you. Always give the base its own resistor." }),
          ],
          goals: [{ text: "Light the LED with a 10 kΩ into B", when: fixed, hold: 0.6 }],
          challenge: { text: "Finish without a hint", final: (C) => C.hintsUsed === 0 },
          solution: [{ choose: "right" }, { wire: V.hs("+T13", "a13") }, { wait: 0.5 }, { remove: "wire" }, { place: { type: "resistor", value: 10000 }, at: V.hs("+T13", "a13") },
            { replace: "q1" }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "9-3", title: "Your own switch", teaches: [], uses: ["npnSwitch", "baseR", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0],
      card: { name: "Your own transistor switch", text: "The LED's loop in at C and out at E, E to the − rail, and a resistor into B. B's tiny current switches the LED." },
      layouts: [{}],
      // In three steps on a half-built board: the transistor (C in the LED's strip 9, so B is 10 and E is 11), E's wire to
      // the − rail, then the 10 kΩ into B. Each step is its own goal; the strips are marked.
      make: (V) => {
        const P = V.predict(["E", "C", "B"], 0, [null, "C is where the LED's current goes in. Both currents come out at E, so E goes to the − rail.",
          "B is the control leg: its tiny current comes in from a resistor, then comes out at E."]);
        const LEDN = V.n("bb:L9"), BN = V.n("bb:L10"), EN = V.n("bb:L11");
        const npn = (S) => S.parts("npn").find((q) => q.ok && q.legs.every(Boolean));
        const placed = (S) => { const q = npn(S); return !!q && S.same(q.nets[0], LEDN) && S.same(q.nets[1], BN) && S.same(q.nets[2], EN); };
        const grounded = (S) => placed(S) && S.same(npn(S).nets[2], "bb:-T");
        const on = (S) => grounded(S) && S.parts("resistor").some((r) => r.ok && r.part.value === 10000 && S.joins(r, "bb:+T", BN)) && safe(part(S, "led1"));
        const off = (S, m) => { if (on(S)) m.on = true; return !!m.on && grounded(S) && !lit(part(S, "led1"), 0.0005) && !S.parts("resistor").some((r) => r.part.value === 10000); };
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T8", "a8", 330), V.LED("led1", "c8", "c9")),
          rules: { tray: [{ type: "npn", n: 1 }, { type: "wire", n: 1 }, { type: "resistor", value: 10000, n: 1 }], banner: true },
          ui: { strips: true },
          goalsFrom: 0,
          beats: [
            { id: "npn", say: V.say("Your own transistor switch, in three steps. First: drop the transistor on the marked holes, C (its left leg) in the LED's strip.",
              "You build a transistor switch, step by step. First, the transistor: on the marked holes, with C, its left leg, in the LED's strip."),
              highlight: { holes: V.hs("d9", "d10", "d11") },
              hints: [{ say: "Drag the transistor from the parts tray. Its legs read C, B, E from left to right." }, { show: [{ id: "h", type: "npn", legs: V.hs("d9", "d10", "d11") }] }],
              waitFor: { when: placed, hold: 0.3 } },
            { id: "p", say: "The LED's loop now goes in at C. Which leg must go to the − rail?", predict: P, waitFor: { predict: true } },
            { id: "e", reply: "p", say: "E, where both currents come out. Draw a wire from E's strip to the − rail (both marked).", highlight: { holes: V.hs("a11", "-T11") },
              hints: [{ show: [V.WIRE("h", "a11", "-T11")] }], waitFor: { when: grounded, hold: 0.3 } },
            { id: "b", say: "The loop is closed, but the LED is dark: nothing flows into B. Last: the 10 kΩ from the + rail into B's strip (marked).",
              highlight: { holes: V.hs("+T10", "a10") }, hints: [{ show: [V.RES("h", "+T10", "a10", 10000)] }], waitFor: { when: on, hold: 0.5 } },
            FINISH("Your own transistor switch: B's tiny current turns on the LED's big one. Next: a button does the switching."),
          ],
          goals: [{ text: "The transistor, C in the LED's strip", when: placed }, { text: "E to the − rail", when: grounded }, { text: "The LED on, with the 10 kΩ into B", when: on }],
          react: [{ hold: 1.2, when: (S, C) => {
            const q = npn(S);
            if (!C.beat || C.beat.id !== "npn" || !q || placed(S)) return null;
            if (S.same(q.nets[2], LEDN)) return "The transistor is the wrong way round: E is in the LED's strip. Click it and press Flip.";
            return "C, the transistor's left leg, goes in the LED's strip. Drag it onto the marked holes.";
          } }],
          challenge: { text: "Then switch it off at B: take the 10 kΩ out", when: off },
          solution: [{ place: { type: "npn" }, at: V.hs("d9", "d10", "d11") }, { wait: 0.4 }, { choose: "right" }, { wire: V.hs("a11", "-T11") }, { wait: 0.4 },
            { place: { type: "resistor", value: 10000 }, at: V.hs("+T10", "a10") }, { wait: 0.8 }, { remove: "resistor" }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "9-4", meter: "mA", title: "The weak button", teaches: [], uses: ["npnSwitch", "baseR", "buttonLoop", "buttonLegs", "current", "loop", "resistor", "polarity", "strip", "rail", "gap"],
      shifts: [0],
      card: { name: "The transistor switch", text: "A tiny current into B, through a resistor, lets a big current flow from C to E. A small switch can control a big load." },
      layouts: [{}],
      // A small decision puzzle (playtest 2026-10-27: keep the capstones easy). 9-3's switch is pre-built with two gaps:
      // one in the LED's loop (strip 7, the LED's − leg, to strip 9, C) and one in B's loop (strip 12, the 10 kΩ's end, to
      // strip 10, B). The tray has the button and one wire. The button is made for at most 2 mA (its rating; the simulated
      // button does not break). Worked numbers (6 V, green LED 2.2 V, NPN β 200, Vbe ≈ 0.7 V; simulator in brackets):
      //  - button in B's gap, wire in the LED's: base (6 − 0.7) / 10 kΩ ≈ 0.53 mA through the button ✓ (0.53 mA); fully on,
      //    the LED gets (6 − 2.2 − ~0.1) / 330 ≈ 11 mA ✓ (11.2 mA; the goal asks ≥ 5 mA). Button up: no base current, dark ✓.
      //  - button in the LED's gap, wire in B's: the LED's whole ≈ 11 mA flows through the button ✗ (11.2 mA).
      make: (V) => {
        const LIMIT = 0.002, seen = {};
        const P = V.predict(["The gap in B's loop", "The gap in the LED's loop", "Either gap"], 0, [null,
          "there the LED's whole current, about 11 mA, would flow through the button: far over its 2 mA.",
          "in the LED's loop the button would carry the LED's 11 mA. In B's loop it carries only B's tiny current."]);
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
        const GAPS = V.hs("d7", "d9", "d10", "d12");
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T6", "a6", 330), V.LED("led1", "c6", "c7", "green"), { id: "q1", type: "npn", legs: V.hs("c9", "c10", "c11") },
            V.WIRE("w2", "a11", "-T11"), V.RES("rb", "+T12", "a12", 10000)),
          rules: { tray: [{ type: "button", n: 1 }, { type: "wire", n: 1 }], latchButtons: true, banner: true },
          ui: { strips: true },
          goalsFrom: 2,
          beats: [
            { id: "brief", say: V.say("The keys of a thin keypad are tiny buttons. This one is made for at most 2 mA: more wears out its contacts. The LED needs about 11 mA.",
              "This tiny button is like a key on a thin keypad: made for at most 2 mA, or its contacts wear out. The LED needs about 11 mA."), waitFor: NEXT },
            { id: "p", say: `9-3's switch, with two gaps (marked): the LED's loop is open from strip ${V.r(7)} to ${V.r(9)}, B's loop from ${V.r(10)} to ${V.r(12)}. Which gets the button?`,
              highlight: { holes: GAPS }, predict: P, waitFor: { predict: true } },
            { id: "build", reply: "p", say: "Find out: the button in one gap, your wire in the other. Then test it: this button stays down when clicked, and pops up when clicked again.",
              highlight: { holes: GAPS },
              hints: [{ say: "The button across the centre gap, its legs on B's strip and the 10 kΩ's strip. The wire joins the LED's strip to C's strip." },
                { show: [{ id: "h1", type: "button", legs: V.hs("e10", "f10", "e12", "f12"), pairs: "across" }, V.WIRE("h2", "b7", "b9")] }],
              waitFor: { when: tested } },
            Object.assign(FINISH(() => `Just ${shownmA(seen.ib ?? 0.00053)} through the button switched ${shownmA(seen.il ?? 0.0112)} through the LED, by way of the transistor. Chapter 9 done!`),
              { note: "a real key or small switch has a current rating on its datasheet. Above it, its contacts wear out or burn." }),
          ],
          goals: [{ text: "Off with the button up, on with it down, and at most 2 mA through the button", when: tested }],
          react: [{ hold: 1, when: (S, C) => (C.beat && C.beat.id === "build" ? darkLed(S) : null) }, { hold: 1.5, when: (S, C) => {
            // the button down and the LED dark: say which loop is still open
            const down = S.parts("button").some((b) => b.part.pressed), q = part(S, "q1");
            if (!C.beat || C.beat.id !== "build" || !q || !down || ledI(S) > 0.003) return null;
            if (Math.abs(q.rd.Ib || 0) < 1e-5) return "The button is down, but no current flows into B: B's loop still has a gap, between the 10 kΩ and B.";
            return "Current flows into B, but the LED's loop still has a gap, between the LED and C.";
          } }, { hold: 1, when: (S) => {
            if (!S.parts("button").some((b) => b.part.pressed) || S.destroyed()) return null;
            const ib = btnMax(S); if (ib <= LIMIT) return null;
            const n = Math.round(ib / LIMIT);
            if (ledI(S) < 0.003) return `${shownmA(ib)} flows through the button, but it is made for at most 2 mA.`;
            return `The LED lights, but ${shownmA(ib)} flows through the button: ${n >= 2 ? `${WORD[n] || `${n} times`} what it is made for` : "more than it is made for"}. Try the other gap.`;
          } }, { hold: 1, when: (S, C) => {
            // lit with the button up: the button is not breaking its gap (turned so a pair of legs joins the two strips)
            if (!C.beat || C.beat.id !== "build" || S.parts("button").some((b) => b.part.pressed) || ledI(S) < 0.003 || S.destroyed()) return null;
            return "The LED is on with the button up, so the button isn't breaking its gap. Pressing must join its two strips: sit it across the centre gap.";
          } }],
          challenge: { text: "Finish without a hint", final: (C) => C.hintsUsed === 0 },
          solution: [{ next: 1 }, { choose: "right" }, { place: { type: "button", pairs: "across", pressed: false, latch: true }, at: V.hs("e10", "f10", "e12", "f12") },
            { wire: V.hs("b7", "b9") }, { wait: 0.5 }, { press: "button" }, { wait: 0.8 }, { press: "button" }, { wait: 0.3 }, { next: 1 }],
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
      }
    ]
  });
})(window.BB = window.BB || {});
