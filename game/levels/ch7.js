// Chapter 7: Buttons. A push button closes the loop only while it is pressed; its four legs come in two joined pairs,
// which is why it sits across the centre gap; two buttons in a row need both pressed, two side by side need either.
// Then you build a button light yourself, and a challenge: a light that either of two buttons switches on. In 7-3 to
// 7-6 the buttons latch (click down, click up), because a mouse cannot hold two at once.
// Same rules as before: a question in every level, predict first, the goal and not the holes, hints only on request.
// Data only, built with the kit from ch1.js and the meter helpers from ch2.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, safe, part, anyLit, wires, darkLed, FINISH } = K;
  const { M, mode, net, RING, METER, allow, REGION, NEXT } = K.meter;

  // a push button across the centre gap: legs in rows r and r + 2 (e and f), so each row's two legs are joined
  const BUTTON = (V, id, r, latch = false) => Object.assign({ id, type: "button", legs: V.hs(`e${r}`, `f${r}`, `e${r + 2}`, `f${r + 2}`), pairs: "across", pressed: false }, latch ? { latch: true } : {});
  const down = (S, id) => { const q = part(S, id); return !!q && !!q.part.pressed; };
  const LATCH_HINT = { say: "These buttons stay down when clicked and pop up when clicked again, like a lamp's on/off button. Most push buttons spring back." };

  const L = [
    {
      id: "7-1", title: "Press to light", teaches: ["buttonLoop"], uses: ["switch", "loop", "gap", "resistor", "polarity", "strip", "rail"], shifts: [0, 4, 8],
      colors: ["red", "yellow", "green", "blue"],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["The LED lights while you hold it", "The LED stays on after one press", "Nothing"], 0, [null,
          "a push button springs back when you let go, and the loop opens again.", "the button sits in the LED's loop: pressing it closes the loop."]);
        const led = (S) => part(S, "led1");
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T6", "a6", 330), V.LED("led1", "c6", "c7", V.c1), BUTTON(V, "b1", 7), V.WIRE("w1", "a9", "-T9")),
          rules: { tray: [], allow: allow({ ctl: ["b1"] }) },
          goalsFrom: 1,
          ui: { strips: true },
          beats: [
            { id: "p", say: "This red-capped part is a push button, sitting in the LED's loop. What will happen when you press it?", highlight: { part: "b1" },
              predict: P, waitFor: { predict: true } },
            { id: "press", say: "Find out: press the button and hold it down.", highlight: { part: "b1" },
              hints: [{ say: "Press the red cap with the mouse and keep the mouse button down." }], waitFor: { when: (S) => down(S, "b1") && lit(led(S)), hold: 0.4 } },
            { id: "let", say: "Now let go.", waitFor: { when: (S) => !down(S, "b1") && !lit(led(S), 0.0005), hold: 0.3 } },
            Object.assign(FINISH("A push button closes the loop only while you press it. Let go and it springs back: the loop opens again."), { reply: "p" }),
          ],
          goals: [{ text: "Light the LED with the button", when: (S, m) => { if (down(S, "b1") && lit(led(S))) m.on = true; return !!m.on; } }],
          challenge: { text: "Flash the LED three times", when: (S, m) => { const on = lit(led(S)); if (on && !m.was) m.n = (m.n || 0) + 1; m.was = on; return (m.n || 0) >= 3; } },
          solution: [{ choose: "right" }, { press: "b1", on: true }, { wait: 0.6 }, { press: "b1", on: false }, { wait: 0.5 }, { press: "b1", on: true }, { wait: 0.3 }, { press: "b1", on: false },
            { wait: 0.3 }, { press: "b1", on: true }, { wait: 0.3 }, { press: "b1", on: false }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "7-2", title: "Four legs", teaches: ["buttonLegs"], uses: ["buttonLoop", "continuity", "gap", "strip"], shifts: [0, 4, 8],
      layouts: [{}],
      make: (V) => {
        const P1 = V.predict(["The two on one column, across the gap", "The two on the same side of the gap", "None of them"], 0, [null,
          "the two legs on one side sit in different columns. Only pressing joins those.", "inside, each pair of legs across the gap is one piece of metal: always joined."]);
        const P2 = V.predict(["Yes", "No"], 0, [null, "pressing joins the two columns, so the legs on one side are joined too while it is down."]);
        const beepOn = (S, a, b) => mode(S, "cont") && !!M(S).beep && !!M(S).red && !!M(S).com
          && ((S.same(net(M(S).red), a) && S.same(net(M(S).com), b)) || (S.same(net(M(S).red), b) && S.same(net(M(S).com), a)));
        // the button's legs sit in four strips: L10 and R10 are one joined pair, L12 and R12 the other
        const L10 = V.n("bb:L10"), R10 = V.n("bb:R10"), L12 = V.n("bb:L12"), R12 = V.n("bb:R12");
        const across = (S) => !down(S, "b1") && (beepOn(S, L10, R10) || beepOn(S, L12, R12));        // either always-joined pair
        const pressed = (S) => down(S, "b1") && (beepOn(S, L10, L12) || beepOn(S, R10, R12));      // two legs on the same side, either side
        return {
          region: REGION(V),
          start: start(BUTTON(V, "b1", 10), METER("cont")),
          rules: { tray: [], allow: allow({ ctl: ["meter", "b1"], dial: ["off", "V", "mA", "ohm", "cont"] }) },
          ui: { strips: true },
          goalsFrom: 3,
          beats: [
            { id: "p1", say: "A push button has four legs. Which of them are joined, even without pressing?", highlight: { part: "b1" }, predict: P1, waitFor: { predict: true } },
            { id: "across", say: "Find out with the beep: probe the strips of two of its legs, without pressing. Try pairs until one beeps.",
              hints: [{ say: "Each leg sits in a strip. Put one probe in the strip of one leg and the other probe in the strip of another." }, RING(V.hs("a10", "j10"))],
              waitFor: { when: across } },
            { id: "p2", reply: "p1", say: "Legs on one numbered column, across the gap, are always joined. Will two legs on the same side beep while you press?",
              predict: P2, waitFor: { predict: true } },
            { id: "pressed", say: "Find out: probe two legs on the same side of the gap, and press the button. Shift-click keeps it down.",
              hints: [{ say: "Shift-click the red cap: it stays down. Shift-click again to let it up." }, RING(V.hs("a10", "a12"))], waitFor: { when: pressed } },
            Object.assign(FINISH("Each pair sits on one column, across the gap; pressing joins the columns. The legs are spaced to fit the gap, so each gets its own strip."), { reply: "p2" }),
          ],
          goals: [{ text: "Hear the beep through the pressed button", when: pressed }],
          challenge: { text: "Finish without a hint", final: (C) => C.hintsUsed === 0 },
          solution: [{ choose: "right" }, { probe: V.hs("a10", "j10") }, { wait: 0.4 }, { choose: "right" }, { probe: V.hs("a10", "a12") }, { press: "b1", on: true }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "7-3", title: "Both buttons", teaches: ["buttonsAnd"], uses: ["buttonLegs", "buttonLoop", "seriesR", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 4],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Only when both are down", "When either one is down", "Never"], 0, [null,
          "in a row the current must pass both buttons: one still up leaves a break.", "with both down, the path is complete, so the LED lights."]);
        const led = (S) => part(S, "led1");
        const tried = (S, m) => {
          const a = down(S, "b1"), b = down(S, "b2"), on = lit(led(S));
          if ((a !== b) && !on) m.one = true;
          if (a && b && on) m.both = true;
          return !!m.one && !!m.both;
        };
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T6", "a6", 330), V.LED("led1", "c6", "c7"), BUTTON(V, "b1", 7, true), V.WIRE("w1", "a9", "a11"),
            BUTTON(V, "b2", 11, true), V.WIRE("w2", "a13", "-T13")),
          rules: { tray: [], allow: allow({ ctl: ["b1", "b2"] }) },
          ui: { strips: true },
          beats: [
            { id: "p", say: "Two buttons in a row in the LED's loop. These click down and stay down, to free your hands. When will the LED light?", highlight: { parts: ["b1", "b2"] },
              predict: P, waitFor: { predict: true } },
            { id: "try", say: "Find out: try one button down, then both.", hints: [LATCH_HINT], waitFor: { when: tried } },
            Object.assign(FINISH("In a row, the current must pass both buttons, so both must be down. This one AND that one."), { reply: "p" }),
          ],
          goals: [{ text: "Light the LED with both buttons down", when: (S) => down(S, "b1") && down(S, "b2") && lit(led(S)) }],
          challenge: { text: "End with both buttons up again", when: (S, m, C) => !!C.beat && C.beat.id === "end" && !down(S, "b1") && !down(S, "b2") },
          solution: [{ choose: "right" }, { press: "b1" }, { wait: 0.5 }, { press: "b2" }, { wait: 0.8 }, { press: "b1" }, { press: "b2" }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "7-4", title: "Either button", teaches: ["buttonsOr"], uses: ["buttonsAnd", "parallelV", "buttonLoop", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 4],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["When either one is down", "Only when both are down", "Never"], 0, [null,
          "side by side, each button gives the current its own path. One is enough.", "each button, pressed, closes its own path round the loop."]);
        const led = (S) => part(S, "led1");
        const tried = (S, m) => {
          const a = down(S, "b1"), b = down(S, "b2"), on = lit(led(S));
          if (a && !b && on) m.a = true;
          if (b && !a && on) m.b = true;
          return !!m.a && !!m.b;
        };
        return {
          region: REGION(V),
          start: start(V.BAT("+T3", "-T4"), V.RES("r1", "+T6", "a6", 330), V.LED("led1", "c6", "c7"), BUTTON(V, "b1", 7, true), V.WIRE("w1", "a9", "-T9"),
            V.WIRE("w2", "b7", "b11"), BUTTON(V, "b2", 11, true), V.WIRE("w3", "a13", "-T13")),
          rules: { tray: [], allow: allow({ ctl: ["b1", "b2"] }) },
          goalsFrom: 1,
          ui: { strips: true },
          beats: [
            { id: "p", say: "Now the two buttons sit side by side. When will the LED light?", highlight: { parts: ["b1", "b2"] },
              predict: P, waitFor: { predict: true } },
            { id: "try", say: "Find out: click one button down, then up again, then the other one down. Watch the LED each time.", hints: [LATCH_HINT], waitFor: { when: tried } },
            Object.assign(FINISH("Side by side, each button has its own path, and either will do. This one OR that one. A doorbell with two buttons works like this."),
              { reply: "p", allow: { remove: ["w1", "w2", "w3"], move: ["w1", "w2", "w3"], legs: ["w1", "w2", "w3"] } }),
          ],
          goals: [{ text: "Light the LED with each button on its own", when: tried }],
          challenge: { text: "Then turn it back into AND by moving wires: both buttons needed", when: (S, m, C) => {
              if (!C.beat || C.beat.id !== "end") return false;
              const a = down(S, "b1"), b = down(S, "b2"), on = lit(led(S));
              if (a !== b && !on) m.one = true;
              if (a && b && on) m.both = true;
              return !!m.one && !!m.both;
            } },
          solution: [{ choose: "right" }, { press: "b1" }, { wait: 0.6 }, { press: "b1" }, { press: "b2" }, { wait: 0.6 }, { press: "b2" }, { wait: 0.4 },
            { remove: "w2" }, { move: "w1", to: V.hs("a9", "a11") }, { press: "b1" }, { wait: 0.5 }, { press: "b2" }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "7-5", title: "Your own button", teaches: [], uses: ["buttonLegs", "buttonLoop", "loop", "resistor", "polarity", "strip", "rail", "gap"], shifts: [0],
      card: { name: "Your own button", text: "A button across the gap, in the LED's loop: the loop goes in at a leg on one number and out at a leg on the other." },
      layouts: [{}], colors: ["red", "green", "blue"],
      make: (V) => {
        const P = V.predict(["Two with different numbers", "Two on one numbered column, across the gap", "Any two"], 0, [null,
          "those two are always joined inside: the loop would skip the button, and the LED would stay on.",
          "two pairs of legs are always joined. Only legs with different numbers are joined by pressing."]);
        // the circuit as built (not the button's state): a change means testing the new circuit again
        const built = (S) => S.all.filter((q) => q.type !== "meter").map((q) => `${q.id}:${q.legs.join(",")}`).join("|");
        const tested = (S, m) => {
          const b = S.parts("button")[0];
          if (!b || b.legs.some((l) => !l) || S.destroyed()) return false;
          const key = built(S);
          if (m.key !== key) { m.key = key; m.off = m.on = false; }
          if (!b.part.pressed && !anyLit(S)) m.off = true;
          if (b.part.pressed && S.parts("led").some(safe)) m.on = true;
          return !!m.off && !!m.on;
        };
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4")),
          rules: { tray: [{ type: "button", n: 1 }, { type: "led", color: V.c1, n: 1 }, { type: "resistor", value: 330, n: 1 }, { type: "wire", n: 3 }], latchButtons: true, banner: true },
          goalsFrom: 1,
          ui: { strips: true },
          beats: [
            { id: "brief", say: V.say("Your turn: an LED with its own button, from an empty board. This button stays down when clicked, and pops up when clicked again.",
              "Now you build one: an LED and its button, on an empty board. Click this button and it stays down; click again and it pops up."), waitFor: { next: true, label: "Start" } },
            { id: "p", say: "The loop must go in at one of the button's four legs and out at another. Which two, so that pressing switches the LED?",
              predict: P, waitFor: { predict: true } },
            { id: "build", reply: "p", say: "Different numbers: pressing joins them. Build it: + rail, 330 Ω, LED, button, − rail. Then test it: button up, then down.",
              hints: [{ say: "Sit the button across the centre gap. The loop comes in at a leg on one number and goes out from a leg on the other." },
                { show: [V.RES("h1", "+T6", "a6", 330), BUTTON(V, "h3", 6), V.LED("h2", "a8", "-T10", V.c1)] }],
              waitFor: { when: tested } },
            FINISH("One loop, and one break in it that you control: the button. Next: two buttons, one light."),
          ],
          goals: [{ text: "Off with the button up, on with it down", when: tested }],
          react: [{ hold: 1, when: (S, C) => {
            if (!C.beat || C.beat.id !== "build") return null;
            const b = S.parts("button")[0];
            if (b && b.legs.every(Boolean) && !b.part.pressed && anyLit(S)) return "The LED is on with the button up, so its loop skips the button. Does the current go in at one number and out at the other?";
            return b && b.part.pressed ? darkLed(S) : null;
          } }],
          challenge: { text: "Use no wires: legs can go straight into a rail", when: (S, m) => wires(S).length === 0 && tested(S, m) },
          solution: [{ next: 1 }, { choose: "right" }, { place: { type: "resistor", value: 330 }, at: ["+T6", "a6"] },
            { place: { type: "button", pairs: "across", pressed: false, latch: true }, at: ["e6", "f6", "e8", "f8"] },
            { place: { type: "led", color: V.c1 }, at: ["a8", "-T10"] }, { wait: 0.6 }, { press: "button" }, { wait: 0.8 }, { press: "button" }, { wait: 0.4 }, { next: 1 }],
        };
      },
    },
    {
      id: "7-6", title: "Two doors", teaches: [], uses: ["buttonsOr", "buttonsAnd", "buttonLegs", "buttonLoop", "loop", "resistor", "polarity", "strip", "rail", "gap"], shifts: [0],
      card: { name: "Buttons", text: "A button closes a loop while it is down. In a row, buttons need all to be down (AND); side by side, any one will do (OR)." },
      layouts: [{}],
      make: (V) => {
        const btns = (S) => S.parts("button"), seen = {};
        const state = (S, m) => {
          const bs = btns(S); if (bs.length < 2) return false;
          const d = bs.map((q) => !!q.part.pressed), on = anyLit(S);
          if (!d[0] && !d[1] && !on) m.none = true;
          if (d[0] && !d[1] && on) m.a = true;
          if (d[1] && !d[0] && on) m.b = true;
          return !!m.none && !!m.a && !!m.b;
        };
        return {
          region: { rows: [1, 24], cols: "a-j", rails: "top" },
          start: start(V.BAT("+T3", "-T4")),
          rules: { tray: [{ type: "button", n: 2 }, { type: "led", color: "yellow", n: 1 }, { type: "resistor", value: 330, n: 1 }, { type: "wire", n: 4 }], latchButtons: true, banner: true },
          goalsFrom: 1,
          ui: { strips: true },
          beats: [
            { id: "brief", say: V.say("A house has a front door and a back door, each with a bell button, and one bell. Here the bell is the LED: either button must light it.",
              "Two doors, one bell: here the bell is the yellow LED. The button at either door must light it."), waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Build it, then test it: no button, the first one, the second one. These buttons stay down when clicked. Ask for a hint if you need one.",
              hints: [{ say: "Side by side: each button gives the current its own path from the resistor to the LED." },
                { show: [V.RES("h1", "+T7", "a7", 330), BUTTON(V, "h3", 7), BUTTON(V, "h6", 11), V.WIRE("h5", "b7", "b11"), V.WIRE("h4", "c9", "c13"),
                  V.LED("h2", "a13", "-T15", "yellow")] }],
              waitFor: { when: state } },
            FINISH("Either button lights the LED, as either door's button rings the same bell: side by side is OR. Chapter 7 done!"),
          ],
          goals: [{ text: "Off with no button; on with either one", when: state }],
          challenge: { text: "Use at most two wires", final: () => !seen.over, when: (S) => { if (S.parts("wire").length > 2) seen.over = true; return false; } },
          solution: [{ next: 1 }, { place: { type: "resistor", value: 330 }, at: ["+T7", "a7"] },
            { place: { type: "button", pairs: "across", pressed: false, latch: true }, at: ["e7", "f7", "e9", "f9"] },
            { place: { type: "button", pairs: "across", pressed: false, latch: true }, at: ["e11", "f11", "e13", "f13"] }, { wire: ["b7", "b11"] }, { wire: ["c9", "c13"] },
            { place: { type: "led", color: "yellow" }, at: ["a13", "-T15"] }, { wait: 0.5 },
            // the buttons get ids in the order they are placed: button21 first, button22 second
            { press: "button21" }, { wait: 0.5 }, { press: "button21" }, { press: "button22" }, { wait: 0.5 }, { press: "button22" }, { wait: 0.3 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(7, "Buttons", L, {
    "lede": "A button is a switch your finger works. With two of them you can build little rules: this AND that, this OR that.",
    "cover": "buttonsOr",
    "questions": [
      "Which of a push button's four legs are joined?",
      "Why does a button sit across the centre gap?",
      "How can either of two buttons light the same LED?"
    ],
    "words": [
      {
        "w": "Push button",
        "d": "A normally open (NO) switch: it closes the loop only while you press it, and springs back when you let go.",
        "sym": "button"
      },
      {
        "w": "Pair",
        "d": "A button's four legs come in two joined pairs; pressing joins the pairs together.",
        "sym": "button"
      },
      {
        "w": "AND",
        "d": "Buttons in series: every one must be down.",
        "sym": "switch"
      },
      {
        "w": "OR",
        "d": "Buttons in parallel: any one will do.",
        "sym": "switch"
      }
    ]
  });
})(window.BB = window.BB || {});
