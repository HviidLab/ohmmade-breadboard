// Chapter 4: LED maths. The LED keeps about the same push whatever the current, so the resistor takes the rest:
// LED current = (battery − LED) ÷ resistor. That lets you choose a resistor for the current you want, for every colour
// (they need different pushes), and keep below the LED's 20 mA limit. Then a challenge: three colours, one current.
// Same rules as Chapters 2 and 3: a question in every level, predict first, the goal and not the holes, hints on request.
// Data only, built with the kit from ch1.js and the meter helpers from ch2.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, part, FINISH } = K;
  const { M, volts, across, fmtV, RING, METER, allow, REGION, NEXT } = K.meter;

  const fmtI = (a) => { const m = Math.abs(a) * 1000; return `${m < 10 ? m.toFixed(1) : Math.round(m)} mA`; };
  const LOOP_METER = (V) => METER("mA", "mA", V.hs("b7", "-T9"));      // closes the loop from the LED's − strip to the − rail
  const RES = (V, r) => V.RES("res1", "+T6", "a6", r);
  const LED = (V, c) => V.LED("led1", "c6", "c7", c);
  const PLACE_R = (V, r) => ({ place: { type: "resistor", value: r }, at: V.hs("+T6", "a6") });
  const PLACE_L = (V, c) => ({ place: { type: "led", color: c }, at: V.hs("c6", "c7") });
  const SWAP_HINT = { say: "Click the part and press Remove. Then drag the new one into the same two holes." };
  const theLed = (S) => S.parts("led").find((q) => q.ok) || null;
  const resOf = (S, r) => S.parts("resistor").some((q) => q.part.value === r);
  // the meter, in the loop, reads the LED's current
  const current = (S) => { const q = theLed(S); return q && lit(q, 0.001) && S.readsCurrentOf(q, 0.0005, 0.1) ? Math.abs(M(S).value) : null; };
  const near = (x, lo, hi) => x !== null && x >= lo && x <= hi;

  const L = [
    {
      id: "4-1", title: "The LED's share", teaches: ["ledDrop"], uses: ["across", "twiceR", "resistor", "polarity", "loop", "strip", "rail"], shifts: [0, 4, 8],
      colors: ["red", "yellow", "green"],
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["Drop to a third", "Stay about the same", "Grow"], 1, ["an LED is not like a resistor: it keeps about 2 V whatever the current. The resistor takes the change.", null,
          "less current does not give the LED more push. It keeps about 2 V; the resistor takes the change."]);
        const P2 = V.predict(["About 4 V", "About 2 V", "About 6 V"], 0, [null, "the LED keeps its 2 V, and the resistor takes the rest: 6 − 2 = 4 V.", "the shares add up to 6 V, and the LED keeps 2 V: the resistor gets 4 V."]), seen = {};
        const onLed = (S) => across(S, "led1") && volts(S) > 1.5;
        const swapped = (S) => resOf(S, 1000) && !resOf(S, 330) && onLed(S);
        const resShare = (S) => resOf(S, 1000) && S.parts("resistor").some((q) => S.across(q)) && volts(S) !== null && Math.abs(volts(S)) > 3.5;
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), RES(V, 330), LED(V, V.c1), V.WIRE("wire1", "e7", "-T7"), METER("V")),
          rules: { tray: [{ type: "resistor", value: 1000, n: 1 }], allow: allow({ remove: ["res1"], dial: ["V"], socket: ["VO"] }) },
          ui: { xray: true },
          goalsFrom: 4,
          beats: [
            { id: "led", say: "First, measure the push across the LED.", hints: [RING(V.hs("d6", "d7"))],
              waitFor: { when: (S) => { if (onLed(S)) seen.v1 = volts(S); return onLed(S); } } },
            { id: "p1", say: () => `${fmtV(seen.v1 || 2)} with 330 Ω. With 1 kΩ, only a third of the current flows. The LED's volts will…`, highlight: { lcd: "meter" },
              predict: P1, waitFor: { predict: true } },
            { id: "swap", say: "Find out: swap in the 1 kΩ resistor, and measure across the LED again.", hints: [SWAP_HINT, RING(V.hs("d6", "d7"))],
              waitFor: { when: (S) => { if (swapped(S)) seen.v2 = volts(S); return swapped(S); } } },
            { id: "p2", reply: "p1", say: () => `${fmtV(seen.v1 || 2)}, then ${fmtV(seen.v2 || 1.9)}. The LED keeps about the same. How much does the 1 kΩ take?`,
              predict: P2, waitFor: { predict: true } },
            { id: "res", say: "Measure across the resistor.", hints: [RING(V.hs("+T8", "b6"))], waitFor: { when: resShare } },
            Object.assign(FINISH("The LED keeps about the same push, whatever the current. The resistor takes the rest of the battery's 6 V."), { reply: "p2" }),
          ],
          goals: [{ text: "Measure the resistor's share with 1 kΩ", when: resShare }],
          bonus: [
            { text: "Predict the LED's volts", final: (C) => C.right("p1") },
            { text: "Predict the resistor's share", final: (C) => C.right("p2") },
          ],
          solution: [{ probe: V.hs("d6", "d7") }, { choose: "right" }, { remove: "res1" }, PLACE_R(V, 1000), { probe: V.hs("d6", "d7") }, { wait: 0.6 }, { choose: "right" },
            { probe: V.hs("+T8", "b6") }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "4-2", title: "Work out the current", teaches: ["ledCurrent"], uses: ["ledDrop", "ohmsLaw", "sameCurrent", "resistor", "polarity", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["About 18 mA", "About 27 mA", "About 9 mA"], 0, [null, "that forgets the LED's share. The resistor gets 6 − 2 = 4 V: 4 ÷ 0.22 ≈ 18.", "a smaller resistor lets more through, not less: 4 V ÷ 0.22 kΩ ≈ 18 mA."]);
        const P2 = V.predict(["About 17 mA", "About 27 mA", "About 10 mA"], 0, [null, "green keeps 2.2 V, so the resistor gets 3.8 V: 3.8 ÷ 0.22 ≈ 17.", "only a little less than red: the resistor still gets 3.8 V, and 3.8 ÷ 0.22 ≈ 17."]), seen = {};
        const m1 = (S) => resOf(S, 220) && !resOf(S, 470) && near(current(S), 0.016, 0.02);
        const m2 = (S) => resOf(S, 220) && !!theLed(S) && theLed(S).part.color === "green" && near(current(S), 0.0155, 0.019);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), RES(V, 470), LED(V, "red"), LOOP_METER(V)),
          rules: { tray: [{ type: "resistor", value: 220, n: 1 }, { type: "led", color: "green", n: 1 }], allow: allow({ remove: ["res1", "led1"], dial: ["V", "mA"], socket: ["VO", "mA"] }) },
          ui: { xray: true },
          goalsFrom: 4,
          beats: [
            { id: "rule", say: "The resistor gets 6 − 2 = 4 V. 470 Ω is 0.47 kΩ, so 4 V ÷ 0.47 kΩ ≈ 8.5 mA. The LED gets the same current: see the meter.",
              highlight: { lcd: "meter" }, waitFor: NEXT },
            { id: "p1", say: "With a 220 Ω resistor, that is 0.22 kΩ, what will the meter show?", predict: P1, waitFor: { predict: true } },
            { id: "m1", say: "Find out: swap in the 220 Ω resistor.", hints: [SWAP_HINT], waitFor: { when: (S) => { if (m1(S)) seen.i1 = current(S); return m1(S); } } },
            { id: "p2", reply: "p1", say: () => `${fmtI(seen.i1 || 0.018)}. Now a green LED, which takes 2.2 V, with the same 220 Ω?`, predict: P2, waitFor: { predict: true } },
            { id: "m2", say: "Check it: swap in the green LED, long leg on the + side.", hints: [SWAP_HINT], waitFor: { when: m2 } },
            Object.assign(FINISH("(6 − 2.2) V ÷ 0.22 kΩ ≈ 17 mA. LED current = (battery − LED) ÷ resistor."), { reply: "p2" }),
          ],
          goals: [{ text: "Measure the green LED's current", when: m2 }],
          bonus: [
            { text: "Predict the current with 220 Ω", final: (C) => C.right("p1") },
            { text: "Predict the green LED's current", final: (C) => C.right("p2") },
          ],
          solution: [{ next: 1 }, { choose: "right" }, { remove: "res1" }, PLACE_R(V, 220), { wait: 0.6 }, { choose: "right" }, { remove: "led1" }, PLACE_L(V, "green"), { wait: 0.8 }, { next: 1 }],
        };
      },
    },
    {
      id: "4-3", title: "Choose the resistor", teaches: ["chooseR"], uses: ["ledCurrent", "ledDrop", "ohmsLaw", "resistor", "polarity", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["400 Ω", "600 Ω", "200 Ω"], 0, [null, "that uses all 6 V, but the LED keeps 2 V. The resistor gets 4 V: 4 V ÷ 10 mA = 400 Ω.",
          "that is the LED's 2 V. The resistor gets the other 4 V: 4 V ÷ 10 mA = 400 Ω."]);
        const ten = (S) => near(current(S), 0.008, 0.0101);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), LED(V, "red"), LOOP_METER(V)),
          rules: { tray: [{ type: "resistor", value: 100, n: 1 }, { type: "resistor", value: 220, n: 1 }, { type: "resistor", value: 470, n: 1 }, { type: "resistor", value: 1000, n: 1 }],
            allow: allow({ dial: ["V", "mA"], socket: ["VO", "mA"] }), banner: true },
          allowDamage: true,
          ui: { xray: true },
          beats: [
            { id: "p", say: "This red LED needs a resistor, and we want 10 mA. Resistor = (6 − 2) V ÷ 10 mA = …", highlight: { part: "led1" }, predict: P, waitFor: { predict: true } },
            { id: "build", reply: "p", say: "Resistors come in fixed sizes. Round up to the next one: a little less current is always safe. Put it in.",
              hints: [{ say: "Which size in the tray is the next one above 400 Ω?" }, { say: "470 Ω. One leg on the red + rail, the other in the LED's + strip." }, { show: [V.RES("h", "+T6", "a6", 470)] }],
              waitFor: { when: ten, hold: 0.6 } },
            FINISH("Work out the resistor, then round up to the next real size. That is how every LED circuit is designed."),
          ],
          goals: [{ text: "8 to 10 mA through the LED", when: ten, hold: 0.6 }],
          bonus: [
            { text: "Work out the resistor", final: (C) => C.right("p") },
            { text: "Right on the first try", final: (C) => (C.count.place || 0) <= 1 },
          ],
          solution: [{ choose: "right" }, PLACE_R(V, 470), { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "4-4", title: "Colours", teaches: ["ledColours"], uses: ["chooseR", "ledCurrent", "ledDrop", "resistor", "polarity", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["270 Ω", "330 Ω", "390 Ω"], 1, ["rounding down lets more than 10 mA through. 300 Ω is not a size, so round up: 330 Ω.", null,
          "that is the red LED's. Blue keeps 3 V, so the resistor gets 3 V: 3 V ÷ 10 mA = 300 Ω, so 330 Ω."]), seen = {};
        const blue = (S) => { const q = theLed(S); return !!q && q.part.color === "blue" ? q : null; };
        const blueV = (S) => !!blue(S) && S.across(blue(S)) && volts(S) > 2.5;
        const ten = (S) => !!blue(S) && resOf(S, 330) && lit(blue(S), 0.008) && blue(S).rd.I <= 0.0101;
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), RES(V, 390), LED(V, "red"), V.WIRE("wire1", "e7", "-T7"), METER("V")),
          rules: { tray: [{ type: "led", color: "blue", n: 1 }, { type: "resistor", value: 270, n: 1 }, { type: "resistor", value: 330, n: 1 }, { type: "resistor", value: 470, n: 1 }],
            allow: allow({ remove: ["res1", "led1"], dial: ["V", "mA"], socket: ["VO", "mA"] }) },
          ui: { xray: true },
          goalsFrom: 4,
          beats: [
            { id: "red", say: "A red LED with 390 Ω: about 10 mA. Measure the push across the LED.", hints: [RING(V.hs("d6", "d7"))],
              waitFor: { when: (S) => across(S, "led1") && volts(S) > 1.5 } },
            { id: "swap", say: "Now swap in the blue LED from the tray, and measure across it.", hints: [SWAP_HINT, RING(V.hs("d6", "d7"))],
              waitFor: { when: (S) => { if (blueV(S)) seen.v = volts(S); return blueV(S); } } },
            { id: "name", say: () => `${fmtV(seen.v || 2.9)}! Blue needs about 3 V, red about 2 V. So the resistor gets only 3 V, and less current flows: it is dimmer.`, waitFor: NEXT },
            { id: "p", say: "Which resistor gives the blue LED about 10 mA? (6 − 3) V ÷ 10 mA = …", predict: P, waitFor: { predict: true } },
            { id: "fix", reply: "p", say: "300 Ω, rounded up to the next size: 330 Ω. Swap it in for the 390 Ω.", hints: [SWAP_HINT],
              waitFor: { when: ten, hold: 0.6 } },
            FINISH("Each colour takes its own push: red about 2 V, yellow and green a little more, blue and white about 3 V."),
          ],
          goals: [{ text: "The blue LED at 8 to 10 mA", when: ten }],
          bonus: [
            { text: "Choose the blue LED's resistor", final: (C) => C.right("p") },
            { text: "Keep the blue LED's long leg on the + side the first time", final: (C) => (C.count.flip || 0) === 0 && (C.count.place || 0) <= 2 },
          ],
          solution: [{ probe: V.hs("d6", "d7") }, { wait: 0.4 }, { remove: "led1" }, PLACE_L(V, "blue"), { probe: V.hs("d6", "d7") }, { wait: 0.6 }, { next: 1 }, { choose: "right" },
            { remove: "res1" }, PLACE_R(V, 330), { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "4-5", title: "The 20 mA limit", teaches: ["ledMax"], uses: ["chooseR", "ledCurrent", "resistor", "polarity", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["200 Ω", "20 Ω", "2 kΩ"], 0, [null, "careful with the units: 4 V ÷ 20 mA = 0.2 kΩ, that is 200 Ω.", "4 V ÷ 20 mA = 0.2 kΩ, that is 200 Ω, not 2 kΩ."]);
        const popped = (S) => S.parts("led").some((q) => !q.ok);
        const safeNow = (S) => resOf(S, 220) && !resOf(S, 47) && near(current(S), 0.015, 0.02);
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), RES(V, 330), LED(V, "red"), LOOP_METER(V)),
          rules: { tray: [{ type: "resistor", value: 47, n: 1 }, { type: "resistor", value: 220, n: 1 }], allow: allow({ remove: ["res1"], dial: ["V", "mA"], socket: ["VO", "mA"] }), banner: true },
          allowDamage: true, simText: { led: null },
          ui: { xray: true },
          beats: [
            { id: "p", say: "A small LED is made for 20 mA at most. The smallest safe resistor for this red one: (6 − 2) V ÷ 20 mA = …", predict: P, waitFor: { predict: true } },
            { id: "try", reply: "p", say: "What if you go far below 200 Ω? Swap in the 47 Ω and watch the meter.", hints: [SWAP_HINT],
              waitFor: { when: popped, hold: 0.05 } },
            { id: "fix", say: "Pop! About 75 mA, nearly four times too much. Put the 220 Ω in, the next size up from 200 Ω, and a fresh LED.",
              hints: [{ say: "Swap the 47 Ω for the 220 Ω. Then click the burned LED and press Fresh one." }], waitFor: { when: safeNow, hold: 0.6 } },
            Object.assign(FINISH("Keep an LED under 20 mA: the resistor must be at least (battery − LED) ÷ 20 mA. Bigger is always safe."),
              { note: "an LED far over 20 mA gets hot and can crack. Work out the resistor before you switch on." }),
          ],
          goals: [{ text: "The LED just under 20 mA, safely", when: safeNow }],
          bonus: [
            { text: "Work out the smallest safe resistor", final: (C) => C.right("p") },
            { text: "Pop only one LED", final: (C) => (C.count.destroyed || 0) <= 1 },
          ],
          solution: [{ choose: "right" }, { remove: "res1" }, PLACE_R(V, 47), { wait: 0.6 }, { remove: "resistor" }, PLACE_R(V, 220), { replace: "led1" }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "4-6", title: "Traffic light", teaches: [], uses: ["ledColours", "chooseR", "ledMax", "ledCurrent", "resistor", "polarity", "loop", "strip", "rail", "gap"], shifts: [0],
      card: { name: "LED maths", text: "Resistor = (battery − LED) ÷ current. Each colour takes its own push, so each LED gets its own resistor." },
      layouts: [{}],
      make: (V) => {
        const COLS = ["red", "yellow", "green"], seen = {};
        const okI = (q) => q.ok && q.rd.I >= 0.008 && q.rd.I <= 0.012;
        const all = (S) => COLS.every((c) => S.parts("led").some((q) => q.part.color === c && okI(q)));
        return {
          region: { rows: [1, 26], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), METER("V")),
          rules: { tray: [{ type: "led", color: "red", n: 1 }, { type: "led", color: "yellow", n: 1 }, { type: "led", color: "green", n: 1 },
            { type: "resistor", value: 220, n: 1 }, { type: "resistor", value: 330, n: 2 }, { type: "resistor", value: 390, n: 2 }, { type: "resistor", value: 470, n: 1 },
            { type: "wire", n: 3 }], allow: allow({ replace: ["meter"] }), banner: true },
          allowDamage: true,
          ui: { xray: true },
          beats: [
            { id: "brief", say: V.say("A traffic light of your own: a red, a yellow and a green LED, each with between 8 and 12 mA.",
              "Build three lights, red, yellow and green, each with 8 to 12 mA through it."), waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Each LED needs its own resistor. Ask for a hint if you get stuck.",
              hints: [{ say: "Each LED gets its own loop: + rail, resistor, LED, − rail. Resistor = (6 − LED) V ÷ 10 mA, rounded up." },
                { say: "Red takes about 2 V, yellow 2.1 V, green 2.2 V. Work out each one, then take the next size up in the tray." },
                { show: [V.RES("h1", "+T6", "a6", 470), V.LED("h2", "c6", "c7", "red"), V.WIRE("h3", "e7", "-T7"), V.RES("h4", "+T12", "a12", 390), V.LED("h5", "c12", "c13", "yellow"),
                  V.WIRE("h6", "e13", "-T13"), V.RES("h7", "+T18", "a18", 390), V.LED("h8", "c18", "c19", "green"), V.WIRE("h9", "e19", "-T19")] }],
              waitFor: { when: all, hold: 0.8 } },
            FINISH("Three colours, three resistors, one battery. LED maths done!"),
          ],
          goals: [{ text: "Red, yellow and green, each 8 to 12 mA", when: all, hold: 0.8 }],
          bonus: [
            { text: "Nothing breaks", final: (C) => C.broken.size === 0 },
            { text: "No LED above 12 mA at any moment", final: () => !seen.over,
              when: (S) => { if (S.parts("led").some((q) => q.ok && q.rd.I > 0.0125)) seen.over = true; return false; } },
          ],
          solution: [{ next: 1 },
            { place: { type: "resistor", value: 470 }, at: ["+T6", "a6"] }, { place: { type: "led", color: "red" }, at: ["c6", "c7"] }, { wire: ["e7", "-T7"] },
            { place: { type: "resistor", value: 390 }, at: ["+T12", "a12"] }, { place: { type: "led", color: "yellow" }, at: ["c12", "c13"] }, { wire: ["e13", "-T13"] },
            { place: { type: "resistor", value: 390 }, at: ["+T18", "a18"] }, { place: { type: "led", color: "green" }, at: ["c18", "c19"] }, { wire: ["e19", "-T19"] },
            { wait: 1.2 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(4, "LED maths", L);
})(window.BB = window.BB || {});
