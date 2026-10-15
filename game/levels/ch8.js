// Chapter 8: Capacitors and time. A capacitor stores charge (an LED keeps glowing after the battery goes off), filling
// it through a resistor takes time (fast at first, then slower), R × C sets how long, and an electrolytic capacitor is
// one-way (backwards it vents). Then a challenge: keep an LED glowing after a button is let go.
// Each capacitor shows a charge ring that fills with amber. Same rules as before: a question in every level, predict
// first, the goal and not the holes, hints only on request. Data only, built with the kit from ch1.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, part, onOff, FINISH } = K;
  const { METER, allow, REGION, NEXT } = K.meter;

  const CAP = (V, id, a, b, value) => ({ id, type: "cap", value, legs: V.hs(a, b) });
  const vc = (S, id) => { const q = part(S, id); return q && q.ok ? Math.abs(q.rd.Vc || 0) : 0; };
  const off = (V, bat) => Object.assign(bat, { on: false });
  const SWITCH_HINT = { say: "The switch is the slider on the battery box." };

  const L = [
    {
      id: "8-1", title: "A bucket for charge", teaches: ["capStore"], uses: ["switch", "parallelV", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["It goes out at once", "It fades out over a second", "It stays on"], 1, ["the capacitor filled up while the battery was on, and now it empties through the LED.", null,
          "a capacitor holds only a little: it empties through the LED, and the glow fades."]);
        const led = (S) => part(S, "led1");
        const faded = (S, m) => { if (onOff(S) && lit(led(S))) m.on = true; if (m.on && !onOff(S) && lit(led(S), 0.001)) m.glow = true; return !!m.glow && !onOff(S) && !lit(led(S), 0.0003); };
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T6", "a6", 100), CAP(V, "c1", "c6", "c7", 1e-3), V.WIRE("w1", "e7", "-T7"),
            V.RES("r2", "d6", "d9", 470), V.LED("led1", "c9", "c10"), V.WIRE("w2", "e10", "-T10")),
          rules: { tray: [], allow: allow({ ctl: ["bat"] }) },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "The blue can is a capacitor. It stores energy: think of a little bucket for charge. Its ring shows how full it is. Switch off: the LED…",
              highlight: { part: "c1" }, predict: P, waitFor: { predict: true } },
            { id: "off", say: "Find out: switch the battery off, and watch the LED and the ring.", highlight: { ctl: "switch", id: "bat" }, hints: [SWITCH_HINT],
              waitFor: { when: faded } },
            Object.assign(FINISH("The capacitor filled up while the battery was on, then emptied through the LED: a short glow."), { reply: "p" }),
          ],
          goals: [{ text: "Watch the LED fade with the battery off", when: faded }],
          challenge: { text: "Fill it and let it glow out twice", when: (S, m) => { const on = onOff(S); if (m.prev === true && !on) m.n = (m.n || 0) + 1; m.prev = on; return (m.n || 0) >= 2; } },
          solution: [{ choose: "right" }, { ctl: "bat" }, { wait: 2.5 }, { ctl: "bat" }, { wait: 1.2 }, { ctl: "bat" }, { wait: 2.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "8-2", title: "Filling takes time", teaches: ["capTime"], uses: ["capStore", "volts", "switch", "resistor", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["At once", "It takes a few seconds", "It never fills"], 1, ["the resistor holds the current back, so the bucket fills slowly.", null,
          "current flows in until the capacitor's push nearly matches the battery's: then it is full."]);
        const P2 = V.predict(["At the start", "Near the end", "The same all the way"], 0, [null, "near the end it is slowest: the capacitor pushes back, so less push is left for the resistor.",
          "as it fills, its own push grows, so less is left across the resistor, and less current flows in."]);
        const full = (S) => vc(S, "c1") > 5;
        return {
          region: REGION(V),
          start: start(off(V, V.BAT("+T3", "-T4")), V.RES("r1", "+T6", "a6", 4700), CAP(V, "c1", "c6", "c7", 1e-3), V.WIRE("w1", "e7", "-T7"), METER("V", "VO", V.hs("b6", "-T9"))),
          rules: { tray: [], allow: allow({ ctl: ["bat", "meter"], dial: ["V"], socket: ["VO"] }) },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "p1", say: "An empty 1000 µF capacitor, filled through a 4.7 kΩ resistor. The meter watches its push. Switch on: will it be full at once?",
              highlight: { part: "c1" }, predict: P1, waitFor: { predict: true } },
            { id: "fill", say: "Find out: switch the battery on, and watch the meter and the ring.", highlight: { ctl: "switch", id: "bat" }, hints: [SWITCH_HINT],
              waitFor: { when: full } },
            { id: "p2", reply: "p1", say: "A few seconds. When did it fill fastest?", predict: P2, waitFor: { predict: true } },
            Object.assign(FINISH("Fast at first, slower as it fills: its own push grows, so less is left across the resistor, and less current flows in."), { reply: "p2" }),
          ],
          goals: [{ text: "Fill the capacitor above 5 V", when: full }],
          challenge: { text: "Switch off, and see it hold its push for 2 seconds", when: (S, m) => {
              const v = vc(S, "c1");
              if (onOff(S) || v < 1) { m.t0 = undefined; return false; }
              if (m.t0 === undefined) { m.t0 = S.t; m.v0 = v; }
              return S.t - m.t0 >= 2 && Math.abs(v - m.v0) < 0.2;
            } },
          solution: [{ choose: "right" }, { ctl: "bat" }, { wait: 9.5 }, { choose: "right" }, { ctl: "bat" }, { wait: 2.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "8-3", title: "R × C", teaches: ["tau"], uses: ["capTime", "capStore", "switch", "resistor", "loop", "strip", "rail"], shifts: [0],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Left and middle", "Left and right", "Middle and right"], 0, [null, "the right one has a 10 kΩ, ten times the left one's resistance: it fills ten times slower.",
          "the right one has ten times the middle one's capacitance: it fills ten times slower."]);
        const race = (S, m) => { if (vc(S, "cA") > 5 && vc(S, "cB") > 5 && vc(S, "cC") < 2.5) m.seen = true; return !!m.seen; };
        return {
          region: REGION(V),
          start: start(off(V, V.BAT("+T3", "-T4")),
            V.RES("rA", "+T5", "a5", 1000), CAP(V, "cA", "c5", "c6", 1e-3), V.WIRE("wA", "e6", "-T6"),
            V.RES("rB", "+T10", "a10", 10000), CAP(V, "cB", "c10", "c11", 1e-4), V.WIRE("wB", "e11", "-T11"),
            V.RES("rC", "+T15", "a15", 10000), CAP(V, "cC", "c15", "c16", 1e-3), V.WIRE("wC", "e16", "-T16")),
          rules: { tray: [], allow: allow({ ctl: ["bat"] }) },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "Left: 1 kΩ and 1000 µF. Middle: 10 kΩ and 100 µF. Right: 10 kΩ and 1000 µF. Which two will fill equally fast?",
              highlight: { parts: ["cA", "cB", "cC"] }, predict: P, waitFor: { predict: true } },
            { id: "race", say: "Find out: switch on, and watch the three rings.", highlight: { ctl: "switch", id: "bat" }, hints: [SWITCH_HINT], waitFor: { when: race } },
            { id: "name", reply: "p", say: "Multiply: kΩ × µF gives milliseconds. 1 kΩ × 1000 µF = 1000 ms = 1 s; 10 kΩ × 100 µF = 1 s too. The right one: 10 s.", waitFor: NEXT },
            FINISH("R × C, in seconds, is the capacitor's time: in that time it fills about two thirds of the way. Bigger R or C, slower."),
          ],
          goals: [{ text: "Watch left and middle win the race", pre: "Watch the race", when: race }],
          challenge: { text: "Wait until the right one passes half full", when: (S) => vc(S, "cC") > 3 },
          solution: [{ choose: "right" }, { ctl: "bat" }, { wait: 2.2 }, { next: 1 }, { wait: 6 }, { next: 1 }],
        };
      },
    },
    {
      id: "8-4", title: "Which way round", teaches: ["capPolarity"], uses: ["capStore", "polarity", "short", "switch", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["It swells up and vents", "It fills up the other way", "Nothing at all"], 0, [null,
          "an electrolytic capacitor works one way only. Backwards, current leaks through it and heats it up.", "backwards, current leaks through it, and it heats up until it vents."]);
        const vented = (S) => S.parts("cap").some((q) => !q.ok);
        const right = (S) => S.parts("cap").some((q) => q.ok && q.rd.Vc > 5);
        return {
          region: REGION(V),
          start: start(off(V, V.BAT("+T3", "-T4")), CAP(V, "c1", "-T8", "+T8", 1e-3)),
          rules: { tray: [], allow: allow({ ctl: ["bat"], flip: ["c1"], legs: ["c1"], move: ["c1"] }), banner: true },
          demo: { cap: 1 }, simText: { cap: null },
          ui: { strips: true },
          beats: [
            { id: "p", say: "This capacitor is in backwards: its + leg is on the − rail. The stripe marks the − leg. What happens when you switch on?",
              highlight: { part: "c1" }, predict: P, waitFor: { predict: true } },
            { id: "on", say: "Find out: switch the battery on, and watch.", highlight: { ctl: "switch", id: "bat" }, hints: [SWITCH_HINT], waitFor: { when: vented, hold: 0.05 } },
            { id: "fix", reply: "p", say: "It swelled and vented. Turn it the right way round, + leg to the + rail, and take a fresh one.",
              hints: [{ say: "Switch the battery off first. Then click the capacitor: Flip (or the R key), then Fresh one." }], waitFor: { when: right, hold: 0.5 } },
            Object.assign(FINISH("An electrolytic capacitor is one-way, like an LED: + leg to the + side, stripe to the − side."),
              { note: "a backwards electrolytic capacitor can burst and spray hot liquid. Check the stripe before you switch on, and keep your face away." }),
          ],
          goals: [{ text: "A capacitor charged the right way round", when: right, hold: 0.5 }],
          challenge: { text: "Switch the battery off before you fix it", when: (S, m, C) => { if (C.count.replace && m.off === undefined) m.off = !onOff(S); return m.off === true; } },
          solution: [{ choose: "right" }, { ctl: "bat" }, { wait: 4 }, { ctl: "bat" }, { flip: "c1" }, { replace: "c1" }, { wait: 0.3 }, { ctl: "bat" }, { wait: 1.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "8-5", title: "Fading light", teaches: [], uses: ["capStore", "capTime", "tau", "capPolarity", "buttonLoop", "buttonLegs", "resistor", "polarity", "loop", "strip", "rail", "gap"], shifts: [0],
      card: { name: "Capacitors and time", text: "A capacitor stores energy and lets it out again over time. R × C sets how long: bigger R or C, slower." },
      layouts: [{}],
      make: (V) => {
        // after the button is let go, the LED keeps glowing (> 0.5 mA) for at least a second
        const glow = (S, m) => {
          const b = S.parts("button")[0], q = S.parts("led").find((x) => x.ok);
          if (!b || !q) return false;
          if (b.part.pressed) { m.t0 = null; return false; }
          if (lit(q, 0.0005)) { if (m.t0 === null || m.t0 === undefined) m.t0 = S.t; return S.t - m.t0 >= 1.0; }
          m.t0 = undefined; return false;
        };
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), { id: "b1", type: "button", legs: ["e6", "f6", "e8", "f8"], pairs: "across", pressed: false }, V.WIRE("w0", "+T6", "a6")),
          rules: { tray: [{ type: "cap", value: 1e-4, n: 1 }, { type: "cap", value: 1e-3, n: 1 }, { type: "resistor", value: 100, n: 1 }, { type: "resistor", value: 470, n: 1 },
            { type: "led", color: "red", n: 1 }, { type: "wire", n: 2 }], allow: allow({ ctl: ["b1"] }), banner: true },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "brief", say: V.say("Make the LED keep glowing for a second after you let go of the button. The button feeds column 8 while you hold it.",
              "When you let go of the button, the LED should glow on for at least a second. The button feeds column 8 while pressed."), waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Build it, then hold the button for a couple of seconds and let go. Ask for a hint if you need one.",
              hints: [{ say: "From column 8: a small resistor to the capacitor's + leg (its − leg to the − rail). From that strip: a resistor and the LED to the − rail." },
                { say: "The 100 µF empties ten times faster than the 1000 µF." },
                { show: [V.RES("h1", "a8", "a10", 100), CAP(V, "h2", "c10", "c11", 1e-3), V.WIRE("h3", "e11", "-T11"), V.RES("h4", "d10", "d14", 470), V.LED("h5", "c14", "c15"),
                  V.WIRE("h6", "e15", "-T15")] }],
              waitFor: { when: glow, hold: 0.05 } },
            FINISH("Your own fading light: the capacitor fills while you press, and empties slowly through the LED. Chapter 8 done!"),
          ],
          goals: [{ text: "The LED glows on for a second after you let go", when: glow, hold: 0.05 }],      // a moment, then it fades: reaching one second is the goal
          challenge: { text: "Use the capacitor the right way round the first time", final: (C) => !C.broken.has("cap") && (C.count.flip || 0) === 0 },
          solution: [{ next: 1 }, { place: { type: "resistor", value: 100 }, at: ["a8", "a10"] }, { place: { type: "cap", value: 1e-3 }, at: ["c10", "c11"] }, { wire: ["e11", "-T11"] },
            { place: { type: "resistor", value: 470 }, at: ["d10", "d14"] }, { place: { type: "led", color: "red" }, at: ["c14", "c15"] }, { wire: ["e15", "-T15"] },
            { press: "b1", on: true }, { wait: 2 }, { press: "b1", on: false }, { wait: 1.6 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(8, "Capacitors and time", L, {
    "lede": "Until now everything happened at once. A capacitor stores energy and lets it go slowly, so circuits get a sense of time.",
    "cover": "capTime",
    "questions": [
      "What does an LED do when the battery goes off but a capacitor still feeds it?",
      "Why does filling a capacitor take time?",
      "Which way round must a capacitor go?"
    ],
    "words": [
      {
        "w": "Capacitor",
        "d": "A part that stores energy as charge on two plates. Think of a little bucket.",
        "sym": "cap"
      },
      {
        "w": "Microfarad (µF)",
        "d": "The unit of capacitance, a millionth of a farad. More µF stores more.",
        "sym": "cap"
      },
      {
        "w": "Time (R × C)",
        "d": "Resistance × capacitance: about two thirds full after that long. kΩ × µF gives milliseconds.",
        "sym": "clock"
      },
      {
        "w": "Electrolytic",
        "d": "A capacitor with a + leg and a striped − leg. Backwards, it swells and vents.",
        "sym": "cap"
      }
    ]
  });
})(window.BB = window.BB || {});
