// Chapter 10: Sensors. The light sensor (LDR) is a resistor that reacts to light: low resistance in light, high in the
// dark. In a divider it turns light into a voltage you can measure; feeding a transistor's base it makes a night light.
// Then a challenge: build a night light. To make it dark, press and hold on the sensor (Shift-click keeps it covered).
// Same rules as before: a question in every level, predict first, the goal and not the holes, hints only on request.
// Data only, built with the kit from ch1.js and the meter helpers from ch2.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, part, FINISH } = K;
  const { M, on, volts, ohms, fmtV, fmtR, shownV, shownR, RING, METER, allow, REGION, NEXT } = K.meter;

  const LDR = (V, id, a, b) => ({ id, type: "ldr", legs: V.hs(a, b), lux: 200 });
  const dark = (S, id) => { const q = part(S, id); return !!q && (q.part.lux ?? 200) <= 5; };
  const COVER = { say: "Press and hold on the light sensor to cover it with your hand. Shift-click keeps it covered; Shift-click again uncovers it." };

  const L = [
    {
      id: "10-1", title: "Light and resistance", teaches: ["ldr"], uses: ["ohms", "resistor", "strip"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Up", "Down", "It stays the same"], 0, [null, "it works the other way round: more light, less resistance. So covered, its resistance goes up.",
          "this resistor reacts to light: cover it and its resistance climbs."]), seen = {};
        const reading = (S) => { const q = part(S, "s1"); return !!q && S.across(q) && ohms(S) !== null && S.near(ohms(S), q.rd.R, 0.05) ? ohms(S) : null; };
        const light = (S) => { const r = reading(S); if (r !== null && !dark(S, "s1")) seen.light = r; return r !== null && !dark(S, "s1"); };
        const darkR = (S) => { const r = reading(S); if (r !== null && dark(S, "s1") && r > 30000) seen.dark = r; return r !== null && dark(S, "s1") && r > 30000; };
        return {
          region: REGION(V),
          start: start(LDR(V, "s1", "c10", "c13"), METER("ohm")),
          rules: { tray: [], allow: allow({ ctl: ["meter", "s1"] }) },
          ui: { strips: true },
          goalsFrom: 2,
          beats: [
            { id: "p", say: "This is a light sensor: a resistor that reacts to light. Cover it with your hand: will its resistance go up or down?", highlight: { part: "s1" },
              predict: P, waitFor: { predict: true } },
            { id: "light", say: "First measure it in room light. The meter is already on Ω.", hints: [RING(V.hs("b10", "b13"))], waitFor: { when: light } },
            { id: "dark", say: () => `${shownR(seen.light ?? 1850)} in room light. Now cover it, and watch the meter.`, hints: [COVER], waitFor: { when: darkR } },
            Object.assign(FINISH(() => `${shownR(seen.light ?? 1850)} in the light, ${shownR(seen.dark ?? 75000)} covered. More light, less resistance: more current gets through.`),
              { reply: "p", note: "a real light sensor reads about 2 kΩ in room light, tens of kΩ under your hand, and 1 MΩ or more in total darkness." }),
          ],
          goals: [{ text: "Measure it in the dark", when: darkR }],
          challenge: { text: "Light, dark, and light again", when: (S, m) => { const d = dark(S, "s1"); if (reading(S) !== null) { if (!d && !m.l1) m.l1 = true; if (d && m.l1) m.d = true; if (!d && m.d) m.l2 = true; } return !!m.l2; } },
          solution: [{ choose: "right" }, { probe: V.hs("b10", "b13") }, { wait: 0.5 }, { cover: "s1" }, { wait: 0.5 }, { cover: "s1", on: false }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "10-2", title: "A light meter", teaches: ["ldrDivider"], uses: ["ldr", "divider", "volts", "resistor", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Drop", "Rise", "Stay the same"], 0, [null, "the sensor sits on the + side. Its share grows in the dark, so less is left across the 10 kΩ.",
          "change one resistor of a divider and the middle point moves."]), seen = {};
        const mid = V.n("bb:L6");
        const vMid = (S) => (on(S, mid, "bb:-T") && volts(S) !== null ? Math.abs(volts(S)) : null);
        const light = (S) => { const v = vMid(S); if (v !== null && !dark(S, "s1") && v > 4) seen.light = v; return v !== null && !dark(S, "s1") && v > 4; };
        const low = (S) => { const v = vMid(S); if (v !== null && dark(S, "s1") && v < 1.5) seen.dark = v; return v !== null && dark(S, "s1") && v < 1.5; };
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), LDR(V, "s1", "+T6", "a6"), V.RES("r1", "c6", "c10", 10000), V.WIRE("w1", "e10", "-T10"), METER("V")),
          rules: { tray: [], allow: allow({ ctl: ["meter", "s1"], dial: ["V"], socket: ["VO"] }) },
          ui: { strips: true },
          goalsFrom: 2,
          beats: [
            { id: "p", say: "The light sensor sits above a 10 kΩ, making a middle point. In the dark its resistance rises. So the middle point will…",
              highlight: { nets: [mid] }, predict: P, waitFor: { predict: true } },
            { id: "light", say: "Measure the middle point against the − rail, in room light.", hints: [RING(V.hs("d6", "-T12"))], waitFor: { when: light } },
            { id: "dark", say: () => `${shownV(seen.light ?? 5)} in the light. Now cover the sensor and watch.`, hints: [COVER], waitFor: { when: low } },
            Object.assign(FINISH(() => `${shownV(seen.light ?? 5)} in light, ${shownV(seen.dark ?? 0.7)} in the dark. Light becomes a voltage you can measure.`), { reply: "p" }),
          ],
          goals: [{ text: "Measure the middle point in the dark", when: low }],
          challenge: { text: "Light, dark, and light again", when: (S, m) => { const d = dark(S, "s1"); if (vMid(S) !== null) { if (!d && !m.l1) m.l1 = true; if (d && m.l1) m.d = true; if (!d && m.d) m.l2 = true; } return !!m.l2; } },
          solution: [{ choose: "right" }, { probe: V.hs("d6", "-T12") }, { wait: 0.5 }, { cover: "s1" }, { wait: 0.5 }, { cover: "s1", on: false }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "10-3", title: "Night light", teaches: ["nightLight"], uses: ["ldrDivider", "ldr", "npnSwitch", "baseR", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 4],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["The LED lights up", "The LED goes out", "Nothing changes"], 0, [null, "it is off already. In the dark the sensor's resistance rises, and B gets current.",
          "covering the sensor raises its resistance, so B gets current and the LED comes on."]);
        const ledOn = (S) => lit(part(S, "led1"));
        const works = (S) => dark(S, "s1") && ledOn(S);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T8", "a8", 330), V.LED("led1", "c8", "c9"), V.WIRE("w1", "e9", "e12"), { id: "q1", type: "npn", legs: V.hs("c12", "c13", "c14") },
            V.WIRE("w2", "a14", "-T15"), V.RES("rb", "+T13", "a13", 100000), V.WIRE("w3", "b13", "b18"), LDR(V, "s1", "a18", "-T18")),
          rules: { tray: [], allow: allow({ ctl: ["s1"] }) },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "A transistor switch for the LED. A 100 kΩ feeds its base; the light sensor runs from the base to the − rail. Cover it: the LED…",
              highlight: { part: "s1" }, predict: P, waitFor: { predict: true } },
            { id: "cover", say: "Find out: cover the light sensor.", hints: [COVER], waitFor: { when: works, hold: 0.4 } },
            { id: "name", reply: "p", say: "The 100 kΩ and the sensor make a divider at B. In light B stays below 0.7 V: hardly any base current. Covered, B rises and current flows in.", waitFor: NEXT },
            FINISH("About 0.04 mA gets into B, × about 200 ≈ 9 mA (that varies a lot by part): on, but not fully. The sensor decides, the transistor switches."),
          ],
          goals: [{ text: "The LED on in the dark", pre: "Cover the sensor", when: works }],
          challenge: { text: "And off again in the light", when: (S, m) => { if (works(S)) m.on = true; return !!m.on && !dark(S, "s1") && !lit(part(S, "led1"), 0.0005); } },
          solution: [{ choose: "right" }, { cover: "s1" }, { wait: 0.8 }, { next: 1 }, { cover: "s1", on: false }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "10-4", title: "Build a night light", teaches: [], uses: ["nightLight", "ldrDivider", "ldr", "npnSwitch", "baseR", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0],
      card: { name: "Sensors", text: "A light sensor's resistance falls in light and rises in the dark. In a divider it turns light into a voltage, and that voltage can work a transistor." },
      layouts: [{}],
      make: (V) => {
        const seen = {};
        const tested = (S, m) => {
          const s = S.parts("ldr")[0]; if (!s) return false;
          const covered = (s.part.lux ?? 200) <= 5, leds = S.parts("led").filter((q) => q.ok);
          if (!leds.length) return false;
          if (!covered && leds.every((q) => q.rd.I < 0.0005)) m.off = true;
          if (covered && leds.some((q) => q.rd.I > 0.003)) m.on = true;
          return !!m.off && !!m.on;
        };
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4")),
          rules: { tray: [{ type: "npn", n: 1 }, { type: "ldr", n: 1 }, { type: "resistor", value: 100000, n: 1 }, { type: "resistor", value: 330, n: 1 },
            { type: "led", color: "yellow", n: 1 }, { type: "wire", n: 4 }], banner: true },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "brief", say: V.say("Build a night light: the yellow LED off in room light, on when you cover the light sensor.",
              "Your own night light: dark sensor, LED on; light, LED off."), waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Build it, then test it: in the light, and covered. Ask for a hint if you need one.",
              hints: [{ say: "The LED's loop: + rail, 330 Ω, the LED, into C. E to the − rail." }, { say: "The base: 100 kΩ from the + rail into B, and the light sensor from B to the − rail." },
                { show: [V.RES("h1", "+T6", "a6", 330), V.LED("h2", "c6", "c7", "yellow"), V.WIRE("h3", "e7", "e12"), { id: "h4", type: "npn", legs: ["c12", "c13", "c14"] },
                  V.WIRE("h5", "a14", "-T15"), V.RES("h6", "+T13", "a13", 100000), V.WIRE("h7", "b13", "b18"), { id: "h8", type: "ldr", legs: ["a18", "-T18"] }] }],
              waitFor: { when: tested } },
            FINISH("Your own night light. Chapter 10 done!"),
          ],
          goals: [{ text: "Off in the light, on in the dark", when: tested }],
          challenge: { text: "Use at most three wires", final: () => !seen.more, when: (S) => { if (S.parts("wire").length > 3) seen.more = true; return false; } },
          solution: [{ next: 1 }, { place: { type: "resistor", value: 330 }, at: ["+T6", "a6"] }, { place: { type: "led", color: "yellow" }, at: ["c6", "c7"] }, { wire: ["e7", "e12"] },
            { place: { type: "npn" }, at: ["c12", "c13", "c14"] }, { wire: ["a14", "-T15"] }, { place: { type: "resistor", value: 100000 }, at: ["+T13", "a13"] },
            { wire: ["b13", "b18"] }, { place: { type: "ldr", lux: 200 }, at: ["a18", "-T18"] }, { wait: 0.6 }, { cover: "ldr" }, { wait: 0.8 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(10, "Sensors", L, {
    "lede": "Circuits can feel the world. A light sensor turns brightness into resistance, and from there into a voltage you can use.",
    "cover": "ldr",
    "questions": [
      "What happens to a light sensor's resistance in the dark?",
      "How do you turn light into a voltage you can measure?",
      "How does a night light know when to switch on?"
    ],
    "words": [
      {
        "w": "Light sensor (LDR)",
        "d": "A resistor that reacts to light: low in the light, high in the dark.",
        "sym": "ldr"
      },
      {
        "w": "Covered",
        "d": "Your hand over the sensor makes it dark: in the game, press and hold it.",
        "sym": "ldr"
      },
      {
        "w": "Night light",
        "d": "A transistor switch fed from a light-sensor divider: on when it gets dark.",
        "sym": "led"
      }
    ]
  });
})(window.BB = window.BB || {});
