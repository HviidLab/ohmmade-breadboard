// Chapter 9: The transistor. A tiny current into the base lets a big current flow from collector to emitter, so a
// transistor is a switch worked by a small current; the base needs its own resistor or it burns. Then a challenge:
// a transistor switch worked by a button.
// Same rules as before: a question in every level, predict first, the goal and not the holes, hints only on request.
// Data only, built with the kit from ch1.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, safe, part, FINISH } = K;
  const { allow, REGION, NEXT } = K.meter;

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
            { id: "p", say: "A transistor: three legs, C, B and E. The LED's loop runs in at C and out at E, yet it is dark. What if a tiny current flows into B?",
              highlight: { part: "q1" }, predict: P, waitFor: { predict: true } },
            { id: "touch", say: "Find out: draw a wire from the + rail to the free end of the 10 kΩ resistor, so a little current flows into B.",
              hints: [{ say: "The 10 kΩ runs from the B strip to strip 17. Join strip 17 to the + rail." }, { show: [V.WIRE("h", "+T17", "a17")] }], waitFor: { when: on, hold: 0.5 } },
            { id: "name", reply: "p", say: () => `${fmtI(seen.ib || 0.0005)} into B switches ${fmtI(seen.ic || 0.012)} through the LED. A small current controls a big one.`,
              waitFor: NEXT },
            FINISH("It passes up to about 200 × the base current, far more than the LED needs. So it is fully on, a closed switch: the 330 Ω sets the current."),
          ],
          goals: [{ text: "Light the LED through the transistor", when: on }],
          challenge: { text: "Switch it off again by taking the wire away", when: (S, m) => { if (lit(part(S, "led1"))) m.on = true; return !!m.on && !S.parts("wire").some((q) => !["w1", "w2"].includes(q.id)); } },
          solution: [{ choose: "right" }, { wire: V.hs("+T17", "a17") }, { wait: 0.8 }, { next: 1 }, { remove: "wire" }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "9-2", title: "The base resistor", teaches: ["baseR"], uses: ["npnSwitch", "short", "resistor", "loop", "strip", "rail"], shifts: [0, 4],
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
            { id: "try", say: "Find out: draw a wire from the + rail straight into the B strip.", hints: [{ show: [V.WIRE("h", "+T13", "a13")] }],
              waitFor: { when: burned, hold: 0.05 } },
            { id: "fix", reply: "p", say: "Pop! Hundreds of mA rushed into B. Take the wire out, put the 10 kΩ in from the + rail to B, and a fresh transistor.",
              hints: [{ say: "Remove the wire. 10 kΩ from the + rail into the B strip. Then click the transistor and press Fresh one." }, { show: [V.RES("h", "+T13", "a13", 10000)] }],
              waitFor: { when: fixed, hold: 0.6 } },
            Object.assign(FINISH("From B to E is a one-way junction needing about 0.7 V. A 10 kΩ lets in (6 − 0.7) V ÷ 10 kΩ ≈ 0.5 mA: plenty to switch."),
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
      id: "9-3", title: "Push to light", teaches: [], uses: ["npnSwitch", "baseR", "buttonLoop", "buttonLegs", "loop", "resistor", "polarity", "strip", "rail", "gap"], shifts: [0],
      card: { name: "The transistor switch", text: "A tiny current into B, through a resistor, lets a big current flow from C to E. A small switch can control a big load." },
      layouts: [{}],
      make: (V) => {
        const seen = {};
        const tested = (S, m) => {
          const b = S.parts("button")[0], q = S.parts("npn")[0]; if (!b || !q || !q.ok) return false;
          const on = S.parts("led").some((x) => lit(x));
          if (!b.part.pressed && !on) m.off = true;
          if (b.part.pressed && on) { m.on = true; if (q.rd.Ib > 0.002) seen.big = true; }
          return !!m.off && !!m.on;
        };
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4")),
          rules: { tray: [{ type: "npn", n: 1 }, { type: "button", n: 1 }, { type: "resistor", value: 10000, n: 1 }, { type: "resistor", value: 330, n: 1 },
            { type: "led", color: "green", n: 1 }, { type: "wire", n: 4 }], latchButtons: true, banner: true },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "brief", say: V.say("Build a transistor switch: the button sends a tiny current into B, and the transistor lights the LED.",
              "Your turn: a button that switches the LED on through a transistor."), waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Build it, then test it: button up, LED off; down, LED on. This button stays down when clicked; click again to let it up.",
              hints: [{ say: "LED loop: + rail, 330 Ω, the LED, into C. E to the − rail." }, { say: "Base: + rail, the button, the 10 kΩ, into B." },
                { show: [V.RES("h1", "+T6", "a6", 330), V.LED("h2", "c6", "c7", "green"), V.WIRE("h3", "e7", "e12"), { id: "h4", type: "npn", legs: ["c12", "c13", "c14"] },
                  V.WIRE("h5", "a14", "-T14"), V.WIRE("h6", "+T17", "a17"), { id: "h7", type: "button", legs: ["e17", "f17", "e19", "f19"], pairs: "across" },
                  V.RES("h8", "a19", "b13", 10000)] }],
              waitFor: { when: tested } },
            FINISH("A push of a tiny button, a big current in the LED. Chapter 9 done!"),
          ],
          goals: [{ text: "LED off with the button up, on with it down", when: tested }],
          challenge: { text: "Keep the base current under 2 mA", final: () => !seen.big },
          solution: [{ next: 1 }, { place: { type: "resistor", value: 330 }, at: ["+T6", "a6"] }, { place: { type: "led", color: "green" }, at: ["c6", "c7"] }, { wire: ["e7", "e12"] },
            { place: { type: "npn" }, at: ["c12", "c13", "c14"] }, { wire: ["a14", "-T14"] }, { wire: ["+T17", "a17"] },
            { place: { type: "button", pairs: "across", pressed: false, latch: true }, at: ["e17", "f17", "e19", "f19"] }, { place: { type: "resistor", value: 10000 }, at: ["a19", "b13"] },
            { wait: 0.5 }, { press: "button" }, { wait: 0.8 }, { press: "button" }, { wait: 0.3 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(9, "The transistor", L, {
    "lede": "A tiny current can control a big one. That is the transistor, the part that fills every computer.",
    "cover": "npnSwitch",
    "questions": [
      "What does a tiny current into the base do?",
      "Why does the base need its own resistor?",
      "How can a small button switch a bigger current?"
    ],
    "words": [
      {
        "w": "Transistor",
        "d": "A switch worked by a small current, with three legs: C, B and E.",
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
        "d": "With plenty of base current the transistor is like a closed switch: the LED's resistor sets the current.",
        "sym": "switch"
      }
    ]
  });
})(window.BB = window.BB || {});
