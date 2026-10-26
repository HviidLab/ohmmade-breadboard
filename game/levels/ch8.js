// Chapter 8: Capacitors and time. A capacitor stores charge on two plates with a gap between them (an LED keeps glowing
// after the battery goes off); no charge crosses the gap, so current flows only while it fills or empties (in a row
// with an LED: a flash, then dark); filling through a resistor is fast at first, then slower (the voltage staircase
// shows why); R × C sets how long; an electrolytic capacitor has a right way round. Then you build 8-1's glow
// yourself, and a challenge: a camera flash, charged by one button and fired by another.
// Each capacitor shows a charge ring that fills with amber, and the "inside the capacitor" panel (capview.js) shows
// its plates. Same rules as before: a question in every level, predict first, the goal and not the holes, hints only
// on request. Data only, built with the kit from ch1.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, safe, part, onOff, wires, FINISH } = K;
  const { METER, allow, REGION, NEXT } = K.meter;

  const CAP = (V, id, a, b, value) => ({ id, type: "cap", value, legs: V.hs(a, b) });
  const vc = (S, id) => { const q = part(S, id); return q && q.ok ? Math.abs(q.rd.Vc || 0) : 0; };
  const off = (V, bat) => Object.assign(bat, { on: false });
  const SWITCH_HINT = { say: "The switch is the slider on the battery box." };

  const L = [
    {
      id: "8-1", title: "A store of energy", teaches: ["capStore"], uses: ["switch", "parallelV", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 4, 8], meter: false,
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["It goes out at once", "It fades out over a second", "It stays on"], 1, ["the capacitor filled up while the battery was on, and now it lets its charge out through the LED.", null,
          "a capacitor holds only a little: it lets its charge out through the LED, and the glow fades."]);
        const led = (S) => part(S, "led1");
        const faded = (S, m) => { if (onOff(S) && lit(led(S))) m.on = true; if (m.on && !onOff(S) && lit(led(S), 0.001)) m.glow = true; return !!m.glow && !onOff(S) && !lit(led(S), 0.0003); };
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T6", "a6", 100), CAP(V, "c1", "c6", "c7", 1e-3), V.WIRE("w1", "e7", "-T7"),
            V.RES("r2", "d6", "d9", 470), V.LED("led1", "c9", "c10"), V.WIRE("w2", "e10", "-T10")),
          rules: { tray: [], allow: allow({ ctl: ["bat"] }) },
          ui: { strips: true, capView: "c1" },
          goalsFrom: 1,
          beats: [
            { id: "meet", say: "New part: the blue can is a capacitor. The window on the left shows inside it: two metal plates, a thin gap between them.",
              highlight: [{ part: "c1" }, { ui: "#capview" }], waitFor: NEXT },
            { id: "here", say: "The battery has filled it: + charge on one plate, − on the other. How much it holds per volt is in farads; this one is 1000 µF.",
              highlight: [{ part: "c1" }, { ui: "#capview" }], waitFor: NEXT },
            { id: "loops", say: "It sits in two loops: the battery fills it through the 100 Ω, and a small loop runs from it through the 470 Ω and the LED.",
              highlight: { parts: ["c1", "r2", "led1", "w1", "w2"] }, waitFor: NEXT },
            { id: "p", say: "The slider on the battery box is its switch, now ON. If you slide it to OFF, what does the LED do?",
              highlight: { ctl: "switch", id: "bat" }, predict: P, waitFor: { predict: true } },
            { id: "off", say: "Find out: slide the battery box's switch to OFF, and watch the LED and the plates.", highlight: { ctl: "switch", id: "bat" }, hints: [SWITCH_HINT],
              waitFor: { when: faded } },
            Object.assign(FINISH("Battery off, the small loop was left: the charge flowed round it, through the LED. It stops at about 2 V, too little for an LED."), { reply: "p" }),
          ],
          goals: [{ text: "Watch the LED fade with the battery off", when: faded }],
          challenge: { text: "Fill it and let it glow out twice", when: (S, m) => { const on = onOff(S); if (m.prev === true && !on) m.n = (m.n || 0) + 1; m.prev = on; return (m.n || 0) >= 2; } },
          solution: [{ next: 1 }, { next: 1 }, { next: 1 }, { choose: "right" }, { ctl: "bat" }, { wait: 2.5 }, { ctl: "bat" }, { wait: 1.2 }, { ctl: "bat" }, { wait: 2.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "8-2", title: "No way through", teaches: ["capBlock"], uses: ["capStore", "switch", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 4, 8], meter: false,
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["It lights and stays lit", "It flashes, then goes dark", "It stays dark"], 1, ["it lights only while the capacitor fills. Once it is full, no more current flows round the loop.", null,
          "while the capacitor fills, current flows round the loop, so the LED lights for a moment."]);
        const P2 = V.predict(["It flashes again", "It stays dark", "It stays lit"], 1, ["with the switch off nothing joined its legs, so it stayed full: nothing can flow in.", null,
          "a full capacitor blocks the loop: no steady current gets through it."]);
        const led = (S) => part(S, "led1");
        const flashed = (S, m) => { if (onOff(S) && lit(led(S))) m.lit = true; return !!m.lit && onOff(S) && !lit(led(S), 0.0003); };
        // off, then on again, and the LED still dark a second later
        const again = (S, m) => {
          if (!onOff(S)) { m.off = true; m.t0 = undefined; return false; }
          if (!m.off) return false;
          if (m.t0 === undefined) m.t0 = S.t;
          return S.t - m.t0 >= 1.2 && !lit(led(S), 0.0003);
        };
        return {
          region: REGION(V),
          start: start(off(V, V.BAT("+T3", "-T4")), V.RES("r1", "+T6", "a6", 470), CAP(V, "c1", "c6", "c8", 1e-3), V.LED("led1", "e8", "e10"), V.WIRE("w1", "a10", "-T10")),
          rules: { tray: [{ type: "resistor", value: 100, n: 1 }], allow: allow({ ctl: ["bat"] }) },
          ui: { strips: true, capView: "c1" },
          goalsFrom: 1,
          beats: [
            { id: "p1", say: "Now the capacitor is in a row with the LED: one loop through the 470 Ω, the capacitor and the LED. Switch on: what will the LED do?",
              highlight: { parts: ["r1", "c1", "led1", "w1"] }, predict: P1, waitFor: { predict: true } },
            { id: "on", say: "Find out: switch the battery on. Watch the LED, and the plates in the window on the left.", highlight: { ctl: "switch", id: "bat" }, hints: [SWITCH_HINT],
              waitFor: { when: flashed } },
            { id: "inside", reply: "p1", say: "Charge piled onto one plate and off the other, but none crossed the gap. Full, it pushes back as hard as the battery: no more current.",
              highlight: { ui: "#capview" }, waitFor: NEXT },
            { id: "p2", say: "Switch the battery off, then on again. Will the LED flash again?", predict: P2, waitFor: { predict: true } },
            { id: "again", say: "Find out: switch off, then on again, and watch the LED.", highlight: { ctl: "switch", id: "bat" }, hints: [SWITCH_HINT], waitFor: { when: again } },
            Object.assign(FINISH("It was still full, so nothing flowed in. A capacitor lets current through only while it fills or empties: a full one blocks the loop."),
              { reply: "p2", note: "to empty a capacitor, join its legs through a resistor. From the next level on, you can also click a capacitor and press Empty it." }),
          ],
          goals: [{ text: "See the LED flash, then go dark", when: flashed }, { text: "Off and on again: see it stay dark", when: again }],
          // full, then emptied through the 100 Ω across its legs, then a fresh flash: lit, and dark again with the battery on
          challenge: { text: "Empty it through the 100 Ω across its legs, then make it flash again", when: (S, m) => {
              const v = vc(S, "c1"), L = led(S);
              m.s = m.s || 0;
              if (m.s === 0 && v > 3) m.s = 1;
              else if (m.s === 1 && v < 1) m.s = 2;
              else if (m.s === 2 && onOff(S) && lit(L)) m.s = 3;
              else if (m.s === 3 && onOff(S) && !lit(L, 0.0003)) m.s = 4;
              return m.s === 4;
            } },
          solution: [{ choose: "right" }, { ctl: "bat" }, { wait: 4 }, { next: 1 }, { choose: "right" }, { ctl: "bat" }, { ctl: "bat" }, { wait: 2 },
            { ctl: "bat" }, { place: { type: "resistor", value: 100 }, at: V.hs("b6", "b8") }, { wait: 1 }, { remove: "resistor" }, { ctl: "bat" }, { wait: 4 }, { next: 1 }],
        };
      },
    },
    {
      id: "8-3", title: "Filling takes time", teaches: ["capTime"], uses: ["capBlock", "capStore", "seriesShare", "ohmsLaw", "volts", "switch", "resistor", "loop", "strip", "rail"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["Steadily, the same each second", "Fast at first, then slower", "Slowly at first, then faster"], 1, ["the current is not steady: it shrinks as the capacitor fills.", null,
          "at the start the whole 6 V is across the resistor, so the current is biggest then."]);
        const P2 = V.predict(["The current stops", "The current stays the same", "It keeps filling past 6 V"], 0, [null, "with nothing left across the resistor, Ohm's law gives no current.",
          "it can't: once its voltage matches the battery's, no more current flows in."]);
        const probes = (S) => S.across(part(S, "c1"));
        const full = (S) => vc(S, "c1") > 5;
        return {
          region: REGION(V),
          start: start(off(V, V.BAT("+T3", "-T4")), V.RES("r1", "+T6", "a6", 4700), CAP(V, "c1", "c6", "c7", 1e-3), V.WIRE("w1", "e7", "-T7"), METER("V", "VO")),
          rules: { tray: [{ type: "resistor", value: 1000, n: 1 }], allow: allow({ ctl: ["bat", "meter"], dial: ["V"], socket: ["VO"], remove: ["r1"], empty: ["c1"] }) },
          ui: { strips: true, ladder: true },
          goalsFrom: 1,
          beats: [
            { id: "measure", say: "The voltage staircase is back, with the resistor and the capacitor as its steps. Measure the meeting point (black probe on the − rail).",
              highlight: [{ ui: "#ladder" }, { parts: ["r1", "c1"] }], hints: [{ say: "The meeting point is the strip with the resistor's end and the capacitor's + leg." }], waitFor: { when: probes, hold: 0.3 } },
            { id: "p1", say: "It is empty, so at switch-on the whole 6 V is across the resistor. How will the capacitor's step grow?", highlight: { ui: "#ladder" }, predict: P1, waitFor: { predict: true } },
            { id: "fill", say: "Find out: switch on, and watch the two steps until the capacitor is past 5 V.", highlight: { ctl: "switch", id: "bat" }, hints: [SWITCH_HINT], waitFor: { when: full } },
            { id: "why", reply: "p1", say: "At first the whole 6 V was across the resistor: a big current. As the capacitor's step grew, the resistor's shrank, and so did the current.",
              highlight: { ui: "#ladder" }, waitFor: NEXT },
            { id: "p2", say: "What happens when the capacitor's step reaches the battery's full 6 V?", predict: P2, waitFor: { predict: true } },
            Object.assign(FINISH("Nothing is left across the resistor, so no current: it is full. Fast at first, then slower and slower: every capacitor fills like that."), { reply: "p2" }),
          ],
          goals: [{ text: "Measure the meeting point", when: probes }, { text: "Fill the capacitor past 5 V", when: full }],
          // filled once, emptied, then filled again through the 1 kΩ alone
          challenge: { text: "Switch off, click the capacitor and press Empty it. Then swap in the 1 kΩ and fill it past 5 V again", when: (S, m) => {
              const v = vc(S, "c1"), rs = S.parts("resistor");
              m.s = m.s || 0;
              if (m.s === 0 && v > 5) m.s = 1;
              else if (m.s === 1 && v < 0.5) m.s = 2;
              return m.s === 2 && v > 5 && rs.length === 1 && rs[0].part.value === 1000;
            } },
          solution: [{ probe: V.hs("b6", "-T9") }, { choose: "right" }, { ctl: "bat" }, { wait: 9.5 }, { next: 1 }, { choose: "right" },
            { ctl: "bat" }, { empty: "c1" }, { remove: "r1" }, { place: { type: "resistor", value: 1000 }, at: V.hs("+T6", "a6") }, { ctl: "bat" }, { wait: 2.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "8-4", title: "R × C", teaches: ["tau"], uses: ["capTime", "capBlock", "capStore", "switch", "resistor", "loop", "strip", "rail"], shifts: [0], meter: false,
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["1 kΩ, the same", "4.7 kΩ", "10 kΩ, ten times bigger"], 2, ["the same resistor fills a capacitor ten times smaller ten times faster.",
          "4.7 kΩ is not enough: the small can would still fill about twice as fast.", null]);
        // the race: from switching on with both cans (nearly) empty, the time each takes to pass 5 V
        const R = { t: -1 };
        const track = (S) => {
          if (S.t === R.t) return R;
          R.t = S.t;
          const a = vc(S, "cA"), b = vc(S, "cB");
          // off: no race, and how full the cans are when it starts (the small one can pass 1 V in the very first moment)
          if (!onOff(S)) { R.t0 = R.ta = R.tb = undefined; R.ready = a < 1 && b < 1; return R; }
          if (R.t0 === undefined) { if (!R.ready && (a > 1 || b > 1)) return R; R.t0 = S.t; R.ready = false; R.races = (R.races || 0) + 1; }
          if (R.ta === undefined && a > 5) R.ta = S.t - R.t0;
          if (R.tb === undefined && b > 5) R.tb = S.t - R.t0;
          return R;
        };
        const inStep = (S) => { const r = track(S); return r.ta !== undefined && r.tb !== undefined && Math.abs(r.ta - r.tb) <= 0.25 * Math.max(r.ta, r.tb); };
        const rB = (S) => S.parts("resistor").find((q) => q.id !== "rA" && q.legs.every(Boolean));
        return {
          region: REGION(V),
          start: start(off(V, V.BAT("+T3", "-T4")),
            V.RES("rA", "+T5", "a5", 1000), CAP(V, "cA", "c5", "c6", 1e-3), V.WIRE("wA", "e6", "-T6"),
            CAP(V, "cB", "c12", "c13", 1e-4), V.WIRE("wB", "e13", "-T13")),
          rules: { tray: [{ type: "resistor", value: 1000, n: 1 }, { type: "resistor", value: 4700, n: 1 }, { type: "resistor", value: 10000, n: 1 }],
            allow: allow({ ctl: ["bat"], empty: ["cA", "cB"] }) },
          ui: { strips: true },
          goalsFrom: 1,
          react: [{ hold: 0.6, when: (S, C) => {
            if (!C.beat || C.beat.id !== "race") return null;
            const r = track(S);
            if (onOff(S) && r.t0 === undefined) return "Empty both cans first: switch off, click each can and press Empty it. Then switch on.";
            if (r.ta === undefined || r.tb === undefined || inStep(S)) return null;
            return r.tb < r.ta ? "The small can won: its resistor lets the current in too easily. Switch off, click each can and press Empty it, then try a bigger resistor."
              : "The small can lost: its resistor holds the current back too much. Switch off, click each can and press Empty it, then try a smaller resistor.";
          } }],
          beats: [
            { id: "p", say: "Left: 1 kΩ and 1000 µF. Right: a 100 µF, ten times smaller, with no resistor yet. Which resistor makes it fill as fast as the left?",
              highlight: { parts: ["rA", "cA", "cB"] }, predict: P, waitFor: { predict: true } },
            { id: "race", say: "Put your resistor from the + rail to the small can's strip and switch on. To race again: switch off, click each can, press Empty it.",
              hints: [{ say: "The small can holds a tenth as much, so it needs a resistor that lets in a tenth as much current." },
                { show: [V.RES("h1", "+T12", "a12", 10000)] }],
              waitFor: { when: inStep } },
            { id: "name", reply: "p", say: "Multiply: kΩ × µF gives milliseconds. 1 kΩ × 1000 µF = 1000 ms = 1 s; 10 kΩ × 100 µF = 1 s too. Same R × C, same time.", waitFor: NEXT },
            { id: "empty", say: "Emptying works the same way: through a resistor, R × C sets how long a capacitor takes to empty. Bigger R or C, a longer glow.", waitFor: NEXT },
            FINISH("R × C is the time constant: in that time the capacitor fills about two thirds of the way. Bigger R or C, slower."),
          ],
          goals: [{ text: "Fill both cans in step", pre: "Race the two cans", when: inStep }],
          challenge: { text: "Get them in step in your first race", when: (S) => inStep(S) && track(S).races === 1 },
          solution: [{ choose: "right" }, { place: { type: "resistor", value: 10000 }, at: ["+T12", "a12"] }, { ctl: "bat" }, { wait: 3 }, { next: 1 }, { next: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "8-5", title: "Which way round", teaches: ["capPolarity"], uses: ["capStore", "polarity", "short", "switch", "rail"], shifts: [0, 4, 8], meter: false,
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["It swells up and vents", "It fills up the other way", "Nothing at all"], 0, [null,
          "an electrolytic capacitor has a right way round. Backwards, current leaks through it and heats it up.", "backwards, current leaks through it, and it heats up and can vent."]);
        const vented = (S) => S.parts("cap").some((q) => !q.ok);
        const right = (S) => S.parts("cap").some((q) => q.ok && q.rd.Vc > 5);
        return {
          region: REGION(V),
          start: start(off(V, V.BAT("+T3", "-T4")), CAP(V, "c1", "-T8", "+T8", 1e-3)),
          rules: { tray: [], allow: allow({ ctl: ["bat"], flip: ["c1"], legs: ["c1"], move: ["c1"] }), banner: true },
          demo: { cap: 1 }, simText: { cap: null },
          ui: { strips: true },
          beats: [
            { id: "p", say: "This capacitor is in backwards: its + leg is on the − rail. On this can, the stripe marks the − leg. What happens when you switch on?",
              highlight: { part: "c1" }, predict: P, waitFor: { predict: true } },
            { id: "on", say: "Find out: switch the battery on, and watch.", highlight: { ctl: "switch", id: "bat" }, hints: [SWITCH_HINT], waitFor: { when: vented, hold: 0.05 } },
            { id: "fix", reply: "p", say: "It vented. Click the can: Flip, then Fresh one. Then switch the battery on (if it is off) and let it charge.",
              hints: [{ say: "Switch the battery off first. Then click the capacitor: Flip (or the R key), then Fresh one." }], waitFor: { when: right, hold: 0.5 } },
            Object.assign(FINISH("An electrolytic capacitor has a right way round, like an LED: + leg to the + side, stripe to the − side."),
              { note: "a backwards electrolytic capacitor can burst. Cans mark the − leg; small tantalum beads mark + instead. Check, and keep your face away." }),
          ],
          goals: [{ text: "A capacitor charged the right way round", when: right, hold: 0.5 }],
          challenge: { text: "Switch the battery off before you fix it", when: (S, m, C) => { if (C.count.replace && m.off === undefined) m.off = !onOff(S); return m.off === true; } },
          solution: [{ choose: "right" }, { ctl: "bat" }, { wait: 4 }, { ctl: "bat" }, { flip: "c1" }, { replace: "c1" }, { wait: 0.3 }, { ctl: "bat" }, { wait: 1.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "8-6", title: "Your own glow", teaches: [], uses: ["capStore", "capBlock", "capPolarity", "switch", "parallelV", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0], meter: false,
      card: { name: "Your own glow", text: "A capacitor filled through a resistor, and an LED beside it. Battery off, the LED's loop is its only way out." },
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Through the 470 Ω and the LED", "Back into the battery", "Nowhere: it stays full, like in 8-2"], 0, [null,
          "the battery's switch is off: no path leads back into it.", "in 8-2 nothing joined its legs. Here the LED's branch does: a loop, so it empties through the LED."]);
        // the LED lit through both resistors in a row: each of them carries the LED's whole current
        const chain = (S) => {
          const l = S.parts("led").find(safe), rs = S.parts("resistor");
          return onOff(S) && !!l && rs.length === 2 && rs.every((r) => r.ok && Math.abs(r.rd.I || 0) >= 0.9 * l.rd.I);
        };
        const full = (S) => onOff(S) && S.parts("led").some(safe) && S.parts("cap").some((q) => q.ok && Math.abs(q.rd.Vc || 0) > 4);
        const faded = (S, m) => {
          const ls = S.parts("led");
          if (full(S)) m.on = true;
          if (m.on && !onOff(S) && ls.some((q) => lit(q, 0.001))) m.glow = true;
          return !!m.glow && !onOff(S) && !ls.some((q) => lit(q, 0.0003));
        };
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4")),
          rules: { tray: [{ type: "cap", value: 1e-3, n: 1 }, { type: "resistor", value: 100, n: 1 }, { type: "resistor", value: 470, n: 1 }, { type: "led", color: "red", n: 1 },
            { type: "wire", n: 2 }], allow: allow({ ctl: ["bat"] }), banner: true },
          ui: { strips: true, capView: true },
          goalsFrom: 0,
          // the capacitor in a row with the LED (neither leg on the − rail): it fills, then blocks the loop, as in 8-2
          react: [{ hold: 1, when: (S, C) => {
            if (!C.beat || !["led", "cap"].includes(C.beat.id)) return null;
            const minus = S.battery() && S.root(S.battery().nets[1]), q = S.parts("cap").find((x) => x.ok && x.legs.every(Boolean));
            if (!q || !minus || q.nets.some((n) => S.root(n) === minus)) return null;
            return "That capacitor is in a row with the LED: as in 8-2, it fills, then blocks the loop. Put it beside the LED's branch, striped leg on the − rail.";
          } }],
          beats: [
            { id: "led", say: V.say("You build 8-1's glow, in steps. First a lit LED: from the + rail through the 100 Ω, then the 470 Ω, then the LED, to the − rail.",
              "Build 8-1's glow step by step. First, light the LED: + rail, the 100 Ω, the 470 Ω, the LED, − rail, all in one row."),
              hints: [{ say: "Each part shares a strip with the next one. The LED's + leg goes in the 470 Ω's strip, its − leg in the − rail." },
                { show: [V.RES("h1", "+T6", "a6", 100), V.RES("h3", "d6", "d10", 470), V.LED("h4", "c10", "-T12")] }],
              waitFor: { when: chain, hold: 0.5 } },
            { id: "cap", say: "Now a store beside the LED's branch: the capacitor from the strip where the two resistors meet to the − rail, stripe on the − rail.",
              hints: [{ say: "Its + leg goes in the strip between the 100 Ω and the 470 Ω. The 100 Ω lets the battery fill it gently." },
                { show: [CAP(V, "h2", "c6", "-T8", 1e-3)] }],
              waitFor: { when: full, hold: 0.5 } },
            { id: "p", say: "Full. It is in parallel with the LED's branch: same two points, same voltage. Switch the battery off: where can its energy go?",
              highlight: { ctl: "switch", id: "bat" }, predict: P, waitFor: { predict: true } },
            { id: "off", say: "Find out: slide the battery box's switch to OFF, and watch the LED and the ring.", highlight: { ctl: "switch", id: "bat" }, hints: [SWITCH_HINT],
              waitFor: { when: faded } },
            { id: "why", reply: "p", say: "It emptied round the small loop: the 470 Ω and the LED. The 100 Ω leads only to the battery, and that is off: a dead end.", waitFor: NEXT },
            FINISH("So the 100 Ω only fills it. Into an empty can, a big rush of current flows at first (8-3); the 100 Ω keeps that rush small."),
          ],
          goals: [{ text: "The LED lit through both resistors", when: chain }, { text: "The capacitor full, beside the LED", when: full },
            { text: "The LED glows on with the battery off", when: faded }],
          challenge: { text: "Use no wires: legs can go straight into a rail", when: (S, m) => wires(S).length === 0 && faded(S, m) },
          solution: [{ place: { type: "resistor", value: 100 }, at: ["+T6", "a6"] }, { place: { type: "resistor", value: 470 }, at: ["d6", "d10"] },
            { place: { type: "led", color: "red" }, at: ["c10", "-T12"] }, { wait: 1 }, { place: { type: "cap", value: 1e-3 }, at: ["c6", "-T8"] }, { wait: 1.2 },
            { choose: "right" }, { ctl: "bat" }, { wait: 3 }, { next: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "8-7", title: "Camera flash", teaches: [], uses: ["capStore", "capBlock", "capTime", "capPolarity", "buttonLoop", "buttonLegs", "resistor", "polarity", "loop", "strip", "rail", "gap"], shifts: [0], meter: false,
      card: { name: "Capacitors and time", text: "A capacitor stores charge and lets it out later. Filling and emptying take time: R × C sets how long." },
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Nothing: too little is left in the can", "Another flash", "The LED stays on"], 0, [null,
          "the flash used the can's store until too little was left to light the LED, as in 8-1.", "Fire alone does not reach the battery: only the can feeds the LED."]);
        // a push button across the centre gap, legs in rows r and r + 2, with its name on it
        const BUTTON = (id, r, tag) => ({ id, type: "button", tag, legs: V.hs(`e${r}`, `f${r}`, `e${r + 2}`, `f${r + 2}`), pairs: "across", pressed: false });
        const down = (S, id) => { const q = part(S, id); return !!q && !!q.part.pressed; };
        const led = (S) => S.parts("led").find((x) => x.ok);
        const can = (S) => S.parts("cap").find((x) => x.ok && x.legs.every(Boolean));
        const vcan = (S) => { const q = can(S); return q ? Math.abs(q.rd.Vc || 0) : 0; };
        const charging = (S) => down(S, "bc") && !down(S, "bf");
        const firing = (S) => down(S, "bf") && !down(S, "bc");
        // holding Charge fills the can, and the LED stays dark
        const charged = (S, m) => { if (charging(S) && vcan(S) > 5 && !lit(led(S), 0.0003)) m.ok = true; return !!m.ok; };
        // holding Fire: the LED flashes, then goes dark while Fire is still held (the can, not the battery, fed it)
        const flashed = (S, m) => {
          if (!firing(S)) { m.lit = false; return !!m.ok; }
          if (lit(led(S), 0.002)) m.lit = true;
          else if (m.lit && !lit(led(S), 0.0003)) m.ok = true;
          return !!m.ok;
        };
        // after the flash: Fire up, then down again without charging, and the LED dark (the can keeps about 2 V, too little to light it)
        const again = (S, m) => {
          if (down(S, "bc")) { m.up = false; return false; }
          if (!down(S, "bf")) { m.up = true; return false; }
          return !!m.up && !lit(led(S), 0.0003);
        };
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4"), V.RES("r0", "+T6", "a6", 100), BUTTON("bc", 6, "Charge"), V.WIRE("w1", "b8", "b10"), BUTTON("bf", 10, "Fire")),
          rules: { tray: [{ type: "cap", value: 1e-3, n: 1 }, { type: "resistor", value: 470, n: 1 }, { type: "led", color: "red", n: 1 }, { type: "wire", n: 2 }],
            allow: allow({ ctl: ["bc", "bf"] }), banner: true },
          ui: { strips: true, capView: true },
          goalsFrom: 2,
          react: [{ hold: 0.6, when: (S, C) => {
            if (!C.beat || C.beat.id !== "build") return null;
            if (charging(S) && lit(led(S))) return "The LED lights while you charge: the battery reaches it. Put the LED's loop after Fire, so only the can feeds it.";
            if (charging(S) && can(S) && vcan(S) < 0.5) return "Charge is down, but the can isn't filling. Its + leg goes in a strip Charge feeds, its striped leg on the − rail.";
            if (firing(S) && vcan(S) > 4 && !lit(led(S), 0.0003)) return "Fire is down and the can is full, but no light: from Fire's far side, the can needs a loop through the 470 Ω and the LED.";
            return null;
          } }],
          beats: [
            { id: "brief", say: V.say("A camera's flash: the battery first fills a capacitor, then the photo button lets it all out into the lamp. Here the lamp is the LED.",
              "Build a camera flash: a battery fills a capacitor, and the photo button lets it all out into the lamp. Here the lamp is the red LED."), waitFor: { next: true, label: "Start" } },
            { id: "board", say: "Charge joins the + rail, through the 100 Ω, to strips 8 and 10: the wire makes them one point. Fire joins strip 10 to strip 12.",
              highlight: { parts: ["bc", "w1", "bf"] }, waitFor: NEXT },
            { id: "build", say: "Build it. Hold Charge: the can fills, the LED stays dark. Then hold Fire: a flash that dies away. Ask for a hint if you need one.",
              hints: [{ say: "Charge must reach the can, and Fire must lead from the can to the LED. Which strips do both buttons reach?" },
                { say: "The can from strip 8 or 10 to the − rail, stripe on the rail. The LED's loop from strip 12: the 470 Ω, then the LED, to the − rail." },
                { show: [CAP(V, "h1", "c10", "-T12", 1e-3), V.RES("h2", "a12", "a16", 470), V.LED("h3", "c16", "-T18")] }],
              waitFor: { when: (S, m) => charged(S, m.c = m.c || {}) && flashed(S, m.f = m.f || {}) } },
            { id: "p", say: "The flash died away. Without pressing Charge, what will a second press of Fire do?", predict: P, waitFor: { predict: true } },
            { id: "again", say: "Find out: let go of Fire, then hold it down again, and watch the LED and the plates.", highlight: { part: "bf" }, waitFor: { when: again, hold: 0.5 } },
            Object.assign(FINISH("Charge filled the can; Fire let its store out through the LED, until too little was left. Stored now, used later. Chapter 8 done!"), { reply: "p" }),
          ],
          goals: [{ text: "Hold Charge: the can fills, the LED stays dark", when: charged }, { text: "Hold Fire: a flash that dies away", when: flashed }],
          challenge: { text: "Use the capacitor the right way round the first time", final: (C) => !C.broken.has("cap") && (C.count.flip || 0) === 0 },
          solution: [{ next: 1 }, { next: 1 }, { place: { type: "cap", value: 1e-3 }, at: ["c10", "-T12"] },
            { place: { type: "resistor", value: 470 }, at: ["a12", "a16"] }, { place: { type: "led", color: "red" }, at: ["c16", "-T18"] },
            { press: "bc", on: true }, { wait: 1 }, { press: "bc", on: false }, { press: "bf", on: true }, { wait: 3 }, { choose: "right" },
            { press: "bf", on: false }, { wait: 0.3 }, { press: "bf", on: true }, { wait: 1 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(8, "Capacitors and time", L, {
    "lede": "Until now everything happened at once. A capacitor stores energy and lets it go slowly, so circuits get a sense of time.",
    "cover": "capTime",
    "questions": [
      "What does an LED do when the battery goes off but a capacitor still feeds it?",
      "Why does an LED in a row with a capacitor only flash?",
      "Why does filling a capacitor take time?"
    ],
    "words": [
      {
        "w": "Capacitor",
        "d": "A part that stores energy: two plates kept apart by an insulator, + charge on one, − on the other.",
        "sym": "cap"
      },
      {
        "w": "Capacitance (F, µF)",
        "d": "How much charge a capacitor holds per volt, in farads (F). A farad is huge, so most are in microfarads (µF): millionths of a farad.",
        "sym": "cap"
      },
      {
        "w": "Time constant (R × C)",
        "d": "Resistance × capacitance, for a resistor and capacitor together: about two thirds full after that long. kΩ × µF gives milliseconds.",
        "sym": "clock"
      },
      {
        "w": "Electrolytic",
        "d": "A capacitor with a + leg and a striped − leg. Backwards, it can swell and vent. Small ceramic capacitors have no right way round.",
        "sym": "cap"
      }
    ]
  });
})(window.BB = window.BB || {});
