// Chapter 10: Sensors. The light sensor (LDR) is a resistor that reacts to light: low resistance in light, high in the
// dark. Joined from a transistor's base to the − rail it makes a night light: in light it is an easy path that leads the
// base current away, in the dark the current goes into the base. Then a small puzzle: make an always-on LED a night
// light by choosing which rail the sensor goes to. To make it dark, press and hold on the sensor (Shift-click keeps it
// covered).
// Kept easy on purpose (playtest 2026-10-27: Chapters 9–11 were too hard): the light-meter divider level and the
// sunrise light were cut, and the night light is explained with current paths, not divider voltages.
// Same rules as before: a question in every level, predict first, hints only on request.
// Data only, built with the kit from ch1.js and the meter helpers from ch2.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, part, darkLed, FINISH } = K;
  const { ohms, shownR, RING, METER, allow, REGION, NEXT } = K.meter;

  const LDR = (V, id, a, b) => ({ id, type: "ldr", legs: V.hs(a, b), lux: 200 });
  const dark = (S, id) => { const q = part(S, id); return !!q && (q.part.lux ?? 200) <= 5; };
  const COVER = { say: "Press and hold on the light sensor to cover it with your hand. Shift-click keeps it covered; Shift-click again uncovers it." };
  // the LED's transistor switch with a 100 kΩ into B, and a wire carrying B's strip over to strip 18
  const NIGHT = (V) => [V.BAT("+T3", "-T4"), V.RES("r1", "+T8", "a8", 330), V.LED("led1", "c8", "c9"), V.WIRE("w1", "e9", "e12"),
    { id: "q1", type: "npn", legs: V.hs("c12", "c13", "c14") }, V.WIRE("w2", "a14", "-T15"), V.RES("rb", "+T13", "a13", 100000), V.WIRE("w3", "b13", "b18")];

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
            { id: "dark", say: () => `${shownR(seen.light ?? 1850)} in room light. Now cover it: press and hold on the sensor (Shift-click keeps it covered). Watch the meter.`, hints: [COVER], waitFor: { when: darkR } },
            Object.assign(FINISH(() => `${shownR(seen.light ?? 1850)} in the light, ${shownR(seen.dark ?? 75000)} covered. More light, less resistance: more current gets through.`),
              { reply: "p", note: "a real light sensor reads about 2 kΩ in room light, tens of kΩ under your hand, and 1 MΩ (M means million) or more in total darkness." }),
          ],
          goals: [{ text: "Measure it in the dark", when: darkR }],
          challenge: { text: "Light, dark, and light again", when: (S, m) => { const d = dark(S, "s1"); if (reading(S) !== null) { if (!d && !m.l1) m.l1 = true; if (d && m.l1) m.d = true; if (!d && m.d) m.l2 = true; } return !!m.l2; } },
          solution: [{ choose: "right" }, { probe: V.hs("b10", "b13") }, { wait: 0.5 }, { cover: "s1" }, { wait: 0.5 }, { cover: "s1", on: false }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "10-2", title: "Night light", teaches: ["nightLight"], uses: ["ldr", "npnSwitch", "baseR", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 4],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["The LED lights up", "The LED goes out", "Nothing changes"], 0, [null, "it is off already. Covered, the sensor's resistance rises, and current flows into B instead.",
          "covering the sensor raises its resistance, so current flows into B and the LED comes on."]);
        const works = (S) => dark(S, "s1") && lit(part(S, "led1"));
        return {
          region: REGION(V),
          start: start(...NIGHT(V), LDR(V, "s1", "a18", "-T18")),
          rules: { tray: [], allow: allow({ ctl: ["s1"] }) },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "The LED's transistor switch. A 100 kΩ feeds B, and the light sensor runs from B to the − rail. Cover the sensor, and the LED…",
              highlight: { part: "s1" }, predict: P, waitFor: { predict: true } },
            { id: "cover", say: "Find out: cover the light sensor (press and hold it), and watch the LED.", highlight: { part: "s1" }, hints: [COVER], waitFor: { when: works, hold: 0.4 } },
            { id: "name", reply: "p", say: "In light the sensor is an easy path: the 100 kΩ's tiny current flows through it, past B. Covered, it's a hard path: the current goes into B.",
              highlight: { part: "s1" }, waitFor: NEXT },
            FINISH("The sensor decides where B's tiny current goes: past B in the light, into B in the dark. The transistor does the switching."),
          ],
          goals: [{ text: "The LED on in the dark", pre: "Cover the sensor", when: works }],
          challenge: { text: "And off again in the light", when: (S, m) => { if (works(S)) m.on = true; return !!m.on && !dark(S, "s1") && !lit(part(S, "led1"), 0.0005); } },
          solution: [{ choose: "right" }, { cover: "s1" }, { wait: 0.8 }, { next: 1 }, { cover: "s1", on: false }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "10-3", title: "Your own night light", teaches: [], uses: ["nightLight", "ldr", "npnSwitch", "baseR", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0],
      card: { name: "Sensors", text: "A light sensor's resistance falls in light and rises in the dark. From a transistor's base to the − rail, it switches an LED on when it gets dark." },
      layouts: [{}],
      // A small decision puzzle (playtest 2026-10-27: keep the capstones easy). 10-2's circuit without its sensor: the
      // 100 kΩ feeds B, so the LED is on, light or dark. One sensor leg goes in strip 18 (joined to B); which rail for the
      // other? Sim model: sensor 1.85 kΩ in room light, 75 kΩ covered; NPN β 200, Vbe ≈ 0.7 V.
      //  - − rail: light, B at ≈ 0.1 V, no base current, LED off ✓; covered, ≈ 0.04 mA into B, LED ≈ 9 mA ✓ (10-2's numbers).
      //  - + rail: the sensor beside the 100 kΩ, ≈ 2.9 mA into B in light (far under a base's rating), on in both ✗.
      make: (V) => {
        const P = V.predict(["The − rail", "The + rail", "Either rail"], 0, [null,
          "from the + rail the sensor only feeds B more current, so the LED stays on in the light.",
          "only from B to the − rail is the sensor a way past B. From the + rail it feeds B even more."]);
        const sensor = (S) => S.parts("ldr")[0];
        const covered = (S) => { const s = sensor(S); return !!s && (s.part.lux ?? 200) <= 5; };
        const ledI = (S) => Math.max(0, ...S.parts("led").filter((q) => q.ok).map((q) => Math.abs(q.rd.I || 0)));
        const B = V.n("bb:L13");
        // both states on the same circuit: any change to the parts or the battery switch starts the test again
        const tested = (S, m) => {
          const sig = S.all.filter((q) => q.type !== "meter").map((q) => `${q.id}:${q.legs.join(",")}:${q.ok}:${q.part.on !== false}`).join("|");
          if (m.sig !== sig) { m.sig = sig; m.on = m.off = false; }
          if (!sensor(S) || !S.batteryOn()) return false;
          if (!covered(S) && ledI(S) < 0.0005) m.off = true;
          if (covered(S) && ledI(S) >= 0.003) m.on = true;
          return !!m.on && !!m.off;
        };
        const building = (C) => !!C.beat && C.beat.id === "build";
        const SPOTS = V.hs("a18", "+T18", "-T18");
        return {
          region: REGION(V),
          start: start(...NIGHT(V)),
          rules: { tray: [{ type: "ldr", n: 1 }], banner: true },
          ui: { strips: true },
          goalsFrom: 2,
          beats: [
            { id: "brief", say: V.say("Your turn: a night light. This LED is on all the time, light or dark: the 100 kΩ always feeds B a tiny current.",
              "Make this LED a night light. Right now it is on all the time: the 100 kΩ feeds B, light or dark."), highlight: { part: "rb" }, waitFor: NEXT },
            { id: "p", say: `The sensor goes from strip ${V.r(18)} (joined to B by the wire) to a rail. Which rail makes the LED go off in the light?`,
              highlight: { holes: SPOTS }, predict: P, waitFor: { predict: true } },
            { id: "build", reply: "p", say: `Find out: put the sensor from strip ${V.r(18)} to a rail. Then test it: in room light, then covered (press and hold it).`,
              highlight: { holes: SPOTS }, hints: [{ show: [{ id: "h", type: "ldr", legs: V.hs("a18", "-T18") }] }, COVER], waitFor: { when: tested } },
            FINISH("Your own night light: in light the sensor leads B's current away, in the dark it goes into B. Chapter 10 done!"),
          ],
          goals: [{ text: "Off in the light, on when covered", when: tested }],
          react: [{ hold: 1, when: (S, C) => {
            const s = sensor(S);
            if (!building(C) || !s || covered(S) || ledI(S) < 0.0005) return null;
            if (!s.nets.some((n) => S.same(n, B))) return `The LED is still on in the light. One sensor leg goes in strip ${V.r(18)} (marked): the wire joins it to B.`;
            if (s.nets.some((n) => S.same(n, "bb:+T"))) return "The LED is on in the light: from the + rail the sensor only adds more current into B. Try the other rail.";
            return null;
          } }, { hold: 1.5, when: (S, C) => (building(C) && covered(S) && ledI(S) < 0.003 ? darkLed(S) : null) }],
          challenge: { text: "Finish without a hint", final: (C) => C.hintsUsed === 0 },
          solution: [{ next: 1 }, { choose: "right" }, { place: { type: "ldr", lux: 200 }, at: V.hs("a18", "-T18") }, { wait: 0.8 }, { cover: "ldr" }, { wait: 0.8 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(10, "Sensors", L, {
    "lede": "Circuits can feel the world. A light sensor turns brightness into resistance, and with a transistor it can switch a light.",
    "cover": "ldr",
    "questions": [
      "What happens to a light sensor's resistance in the dark?",
      "How can a light sensor steer a transistor?",
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
        "d": "A transistor switch with a light sensor from its base to the − rail: on when it gets dark.",
        "sym": "led"
      }
    ]
  });
})(window.BB = window.BB || {});
