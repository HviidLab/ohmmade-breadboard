// Chapter 10: Sensors. The light sensor (LDR) is a resistor that reacts to light: low resistance in light, high in the
// dark. In a divider it turns light into a voltage you can measure; feeding a transistor's base it makes a night light.
// Then a challenge: build a sunrise light, the opposite of the night light (on in the light, off in the dark). To make
// it dark, press and hold on the sensor (Shift-click keeps it covered).
// Same rules as before: a question in every level, predict first, the goal and not the holes, hints only on request.
// Data only, built with the kit from ch1.js and the meter helpers from ch2.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, part, FINISH } = K;
  const { M, on, volts, ohms, fmtV, fmtR, shownV, shownmA, shownR, RING, METER, allow, REGION, NEXT } = K.meter;

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
      id: "10-4", title: "Sunrise light", teaches: [], uses: ["nightLight", "ldrDivider", "divider", "ldr", "npnSwitch", "baseR", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0],
      card: { name: "Sensors", text: "A light sensor's resistance falls in light and rises in the dark. In a divider it turns light into a voltage, and that voltage can work a transistor." },
      layouts: [{}],
      // The opposite of 10-3: the LED on in the light, off when the sensor is covered. The idea: the sensor goes on the
      // + side of the divider at B, the fixed resistor on the − side, and that resistor must be small enough to hold B
      // under 0.7 V in the dark. Sim model: light sensor 1.85 kΩ in room light, 75 kΩ covered; NPN β 200, Vbe ≈ 0.7 V;
      // yellow LED + 330 Ω. Worked numbers (checked in the simulator, LED current light / covered):
      //   sensor + side, 4.7 kΩ to −  : B ≈ (6 − 0.7)/1.85k − 0.7/4.7k ≈ 2.7 mA → 11.8 mA; covered B at 6 × 4.7/79.7 ≈ 0.35 V → 0 mA ✓
      //   sensor + side, 100 kΩ to −  : covered B ≈ 0.72 V, 0.063 mA in → 11.5 mA, still on ✗ (the distractor)
      //   sensor + side, nothing to − : covered 5.3 V / 75k ≈ 0.07 mA into B → 11.5 mA, still on ✗
      //   sensor + side, 330 Ω to −, 4.7 kΩ in the LED's loop: light 0.8 mA, too dim (goal wants ≥ 3 mA) ✗
      //   10-3's night light (100 kΩ from +, sensor to −): light 0 mA, covered 8.7 mA: the wrong way round ✗
      //   4.7 kΩ from +, sensor to −  : on in both (0.72 mA / 1.1 mA into B) ✗
      // (a 10 kΩ to − would leave B at 0.66 V covered and the LED at 1.1 mA: half on; it is not in the tray.)
      // Base current in light ≈ 2.7 mA, far under the 50 mA base rating: the sensor itself limits it.
      make: (V) => {
        const seen = {};
        const sensor = (S) => S.parts("ldr")[0];
        const covered = (S) => { const s = sensor(S); return !!s && (s.part.lux ?? 200) <= 5; };
        const leds = (S) => S.parts("led").filter((q) => q.ok);
        const rail = (S, k) => { const b = S.battery(); return b && b.nets[k]; };        // k 0: the + rail, 1: the − rail
        // Both states must be seen on the same circuit: any change to the parts or the battery switch starts the test again.
        const tested = (S, m) => {
          const sig = S.all.filter((q) => q.type !== "meter").map((q) => `${q.id}:${q.legs.join(",")}:${q.ok}:${q.part.on !== false}`).join("|");
          if (m.sig !== sig) { m.sig = sig; m.on = m.off = false; }
          if (!sensor(S) || !leds(S).length || !S.batteryOn()) return false;
          if (!covered(S) && leds(S).some((q) => q.rd.I >= 0.003)) m.on = true;
          if (covered(S) && leds(S).every((q) => q.rd.I < 0.0005)) m.off = true;
          return !!m.on && !!m.off;
        };
        const building = (C) => !!C.beat && C.beat.id === "build";
        const ledI = (S) => Math.max(0, ...leds(S).map((q) => Math.abs(q.rd.I || 0)));
        // 10-3's night light: a big resistor (47 kΩ or more) from the + rail to B, the sensor from B to the − rail
        const night = (S) => { const s = sensor(S), q = S.parts("npn").find((t) => t.ok);
          return !!s && !!q && S.joins(s, q.nets[1], rail(S, 1)) && S.parts("resistor").some((r) => r.part.value >= 47000 && S.joins(r, rail(S, 0), q.nets[1])); };
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4")),
          rules: { tray: [{ type: "npn", n: 1 }, { type: "ldr", n: 1 }, { type: "resistor", value: 4700, n: 1 }, { type: "resistor", value: 100000, n: 1 },
            { type: "resistor", value: 330, n: 1 }, { type: "led", color: "yellow", n: 1 }, { type: "wire", n: 4 }], banner: true },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "brief", say: V.say("A sunrise signal: the yellow LED is its lamp. It must come on when light falls on the sensor. Covering the sensor is night: LED off.",
              "Your own sunrise signal, with the yellow LED as its lamp: on when light falls on the sensor, off when it is covered (that is night)."), waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Build it, then test it: in the light, and covered (press and hold the sensor). Ask for a hint if you need one.",
              hints: [{ say: "The LED's loop is as in 10-3. But there the sensor sat on the − side of B, so the dark switched it on. Swap the sides." },
                { say: "The sensor from the + rail to B, a resistor from B to the − rail. Covered, that resistor must hold B well under 0.7 V: which one does?" },
                { show: [V.RES("h1", "+T6", "a6", 330), V.LED("h2", "c6", "c7", "yellow"), V.WIRE("h3", "e7", "e12"), { id: "h4", type: "npn", legs: ["c12", "c13", "c14"] },
                  V.WIRE("h5", "a14", "-T15"), { id: "h6", type: "ldr", legs: ["+T13", "a13"] }, V.WIRE("h7", "b13", "b18"), V.RES("h8", "a18", "-T18", 4700)] }],
              waitFor: { when: tested } },
            Object.assign(FINISH("More light, less resistance: the sensor on the + side lets current into B. Covered, the resistor below holds B under 0.7 V. Chapter 10 done!"),
              { note: "real light sensors differ a lot. Measure yours in light and in the dark, then pick the fixed resistor to suit." }),
          ],
          goals: [{ text: "On in the light, off when covered", when: tested }],
          react: [
            // 10-3's wiring (the 100 kΩ from + to B, the sensor from B to −) behaving as a night light: off in the light, on covered
            { hold: 1, when: (S, C) => {
              if (!building(C) || !night(S) || (covered(S) ? ledI(S) < 0.0005 : ledI(S) >= 0.0005)) return null;
              return "That's 10-3's night light: on in the dark. Here it's the other way round.";
            } },
            // covered, yet the LED still glows (a resistor too big or missing below B, or a small one above): say how much current still gets into B
            { hold: 1, when: (S, C) => {
              const q = S.parts("npn").find((t) => t.ok);
              if (!building(C) || !q || night(S) || !covered(S) || ledI(S) < 0.0005 || !(Math.abs(q.rd.Ib || 0) > 0)) return null;
              return `Covered, ${shownmA(q.rd.Ib)} still flows into B (${shownV(q.rd.Vbe)} from B to E): with a current gain of about 200, that lights the LED. Keep B well under 0.7 V.`;
            } },
            // in the light, but too little current for the LED
            { hold: 1, when: (S, C) => {
              const I = ledI(S);
              if (!building(C) || !sensor(S) || covered(S) || I < 0.0005 || I >= 0.003) return null;
              return `In the light only ${shownmA(I)} flows through the LED: too dim. Follow its loop: what holds the current back?`;
            } },
          ],
          challenge: { text: "Use at most three wires", final: () => !seen.more, when: (S) => { if (S.parts("wire").length > 3) seen.more = true; return false; } },
          solution: [{ next: 1 }, { place: { type: "resistor", value: 330 }, at: ["+T6", "a6"] }, { place: { type: "led", color: "yellow" }, at: ["c6", "c7"] }, { wire: ["e7", "e12"] },
            { place: { type: "npn" }, at: ["c12", "c13", "c14"] }, { wire: ["a14", "-T15"] }, { place: { type: "ldr", lux: 200 }, at: ["+T13", "a13"] },
            { wire: ["b13", "b18"] }, { place: { type: "resistor", value: 4700 }, at: ["a18", "-T18"] }, { wait: 0.8 }, { cover: "ldr" }, { wait: 0.8 }, { next: 1 }],
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
        "d": "A light-dependent resistor, also sold as a photocell or photoresistor: low resistance in the light, high in the dark.",
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
