// Chapter 11: The controller board. A pin is a switch you set (HIGH is 5 V, LOW is 0 V) that gives only about 20 mA;
// an analog pin reads a push as a number from 0 to 1023; a pin set to IN reads HIGH or LOW, floats without a pull-down,
// and a program joins what the board reads to what it sets. Then a challenge: a night light run by a program.
// The board is generic (no trademarks). It sits above the breadboard; its pins are set by clicking their badges.
// Same rules as before: a question in every level, predict first, the goal and not the holes, hints only on request.
// Data only, built with the kit from ch1.js and the meter helpers from ch2.js.
(function (BB) {
  "use strict";
  const K = BB.Levels.kit, { start, lit, part, FINISH } = K;
  const { allow, REGION, NEXT } = K.meter;

  const fmtI = (a) => { const m = Math.abs(a) * 1000; return `${m < 10 ? m.toFixed(1) : Math.round(m)} mA`; };
  const BOARD = (more) => Object.assign({ id: "board", type: "uno", legs: [], pins: {} }, more);
  const RED = "#e5484d", BLUE = "#3a8ee6";
  const GND = (V) => V.WIRE("pg", "U.GND0", "-T2", BLUE);
  const POWER = (V) => [V.WIRE("p5", "U.5V", "+T1", RED), GND(V)];
  // the LED on D13: D13, a 330 Ω (or a plain wire where it should be), the LED, the − rail
  const LEDLOOP = (V, bare) => [V.WIRE("w1", "U.D13", "a15"), bare ? V.WIRE("w3", "b15", "b18", "#e9ecef") : V.RES("r1", "b15", "b18", 330),
    V.LED("led1", "c18", "c19", "red"), V.WIRE("w2", "a19", "-T19")];
  // a button from the + rail into D2, with its 10 kΩ pull-down from D2's strip to the − rail
  const BUTTON = (V) => [V.WIRE("w5", "+T5", "a5"), { id: "b1", type: "button", legs: V.hs("e5", "f5", "e7", "f7"), pairs: "across", pressed: false },
    V.RES("pd", "-T7", "a7", 10000), V.WIRE("wd", "b7", "U.D2")];
  const COPY = { out: "D13", rule: "copy", from: "D2" }, OPP = { out: "D13", rule: "opposite", from: "D2" }, BELOW = { out: "D13", rule: "below", from: "A0", n: 500 };
  const PIN = { say: "Each pin's badge sits just above its socket. Click it to switch: L is LOW, H is HIGH.", highlight: { ctl: "pin:D13", id: "board" } };
  const PRESS = { say: "Press and hold the button. Shift-click keeps it down; Shift-click again lets it go." };

  const mode = (S, n) => S.uno.mode(n);
  const pressed = (S) => { const b = part(S, "b1"); return !!b && !!b.part.pressed; };
  const led = (S) => lit(part(S, "led1"));

  const L = [
    {
      id: "11-1", title: "A pin you switch", teaches: ["pinOut"], uses: ["loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 3],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Light up", "Stay dark", "Burn out"], 0);
        const hi = (S) => mode(S, "D13") === "HIGH" && led(S), lo = (S) => mode(S, "D13") === "LOW" && !lit(part(S, "led1"), 0.0005);
        return {
          region: REGION(V),
          start: start(BOARD({ pins: { D13: "LOW" } }), GND(V), ...LEDLOOP(V)),
          rules: { tray: [], allow: allow({ pins: { D13: ["LOW", "HIGH"] } }) },
          ui: { xray: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "This is a controller board, powered by its USB cable. Its pin D13 feeds the LED. Set D13 HIGH, and the LED will…",
              highlight: { part: "board" }, predict: P, waitFor: { predict: true } },
            { id: "high", say: "Find out: click D13's badge on the board. H means HIGH, L means LOW.", hints: [PIN], waitFor: { when: hi, hold: 0.3 } },
            { id: "low", say: (C) => `${C.right("p") ? "Right: " : ""}HIGH joins D13 to 5 V inside the board, so a current flows. Now set it LOW.`,
              waitFor: { when: lo, hold: 0.3 } },
            FINISH("A pin is a switch you control: HIGH gives 5 V, LOW gives 0 V. The board does the switching."),
          ],
          goals: [{ text: "Light the LED from D13", when: hi }, { text: "Switch it off from D13", when: (S, m) => { if (hi(S)) m.on = true; return !!m.on && lo(S); } }],
          bonus: [
            { text: "Predict what HIGH does", final: (C) => C.right("p") },
            { text: "Blink it: on, off, on, off", when: (S, m) => { const now = led(S); if (now !== !!m.was) { m.n = (m.n || 0) + 1; m.was = now; } return (m.n || 0) >= 4; } },
          ],
          solution: [{ choose: "right" }, { pin: "D13", mode: "HIGH" }, { wait: 0.5 }, { pin: "D13", mode: "LOW" }, { wait: 0.5 },
            { pin: "D13", mode: "HIGH" }, { wait: 0.3 }, { pin: "D13", mode: "LOW" }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "11-2", title: "A pin's limit", teaches: ["pinLimit"], uses: ["pinOut", "ledCurrent", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 3],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["The LED just lights", "The pin is damaged", "Nothing happens"], 1), seen = {};
        const hurt = (S) => { const p = S.uno.pin("D13"); return !!p && p.damaged; };
        const fixed = (S) => {
          const p = S.uno.pin("D13"), ok = !!p && !p.damaged && p.mode === "HIGH" && led(S) && Math.abs(p.I) < 0.02 && S.parts("resistor").some((q) => q.part.value === 330);
          if (ok) seen.i = p.I;
          return ok;
        };
        return {
          region: REGION(V),
          start: start(BOARD({ pins: { D13: "LOW" } }), GND(V), ...LEDLOOP(V, true)),
          rules: { tray: [{ type: "resistor", value: 330, n: 1 }], allow: allow({ pins: { D13: ["LOW", "HIGH"] } }) },
          allowDamage: true, simText: { uno: null },
          ui: { xray: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "This LED is on D13 with a plain wire where its resistor should be. Set D13 HIGH, and…", highlight: { part: "w3" },
              predict: P, waitFor: { predict: true } },
            { id: "try", say: "Find out: set D13 HIGH.", hints: [PIN], waitFor: { when: hurt, hold: 0.05 } },
            { id: "fix", say: (C) => `${C.right("p") ? "Right. " : ""}Pop! D13 gave over 60 mA. Swap the plain wire for the 330 Ω, then get a fresh board.`, allow: { remove: ["w3"] },
              hints: [{ say: "Click the plain wire and remove it. Put the 330 Ω in its place. Then click the board and press Fresh board." }, { show: [V.RES("h", "b15", "b18", 330)] }],
              waitFor: { when: fixed, hold: 0.6 } },
            FINISH(() => `${fmtI(seen.i || 0.008)} now. A pin gives about 20 mA safely, so an LED on a pin always needs its resistor.`),
          ],
          goals: [{ text: "Light the LED safely from D13", when: fixed, hold: 0.6 }],
          bonus: [
            { text: "Predict what a bare LED does", final: (C) => C.right("p") },
            { text: "Damage only one board", final: (C) => (C.count.destroyed || 0) <= 1 },
          ],
          solution: [{ choose: "right" }, { pin: "D13", mode: "HIGH" }, { wait: 2.5 }, { remove: "w3" }, { place: { type: "resistor", value: 330 }, at: V.hs("b15", "b18") },
            { replace: "board" }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "11-3", title: "Reading a knob", teaches: ["analogRead"], uses: ["pinOut", "potKnob", "divider", "volts", "strip", "rail"], shifts: [0, 3],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["About 512", "About 1023", "About 2.5"], 0), seen = {};
        const wired = (S) => S.parts("wire").some((w) => w.legs.includes("U.A0") && w.nets.includes(V.n("bb:L17")));
        const a0 = (S) => (wired(S) ? S.uno.analog("A0") : null);
        const mid = (S) => { const v = a0(S); if (v !== null && v > 400 && v < 624) seen.mid = v; return v !== null && v > 400 && v < 624; };
        const ends = (S, m) => { const v = a0(S); if (v === null) return false; if (v < 20) m.lo = true; if (v > 1000) m.hi = true; return !!m.lo && !!m.hi; };
        return {
          region: REGION(V),
          start: start(BOARD({ watch: ["A0"] }), ...POWER(V), { id: "k1", type: "pot", legs: V.hs("c16", "c17", "c18"), pos: 0.5 },
            V.WIRE("w1", "a16", "+T16"), V.WIRE("w2", "a18", "-T18")),
          rules: { tray: [{ type: "wire", n: 1 }], allow: allow({ ctl: ["k1"] }) },
          ui: { xray: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "The knob's ends are on 5 V and GND. Wire its middle leg to A0, knob in the middle: the screen will show A0 reads…",
              highlight: { part: "k1" }, predict: P, waitFor: { predict: true } },
            { id: "wire", say: "Find out: draw a wire from the knob's middle leg to the board's A0 socket.",
              hints: [{ say: "A0 is in the group marked “analog in”, on the right of the board.", highlight: { holes: ["U.A0"] } }, { show: [V.WIRE("h", "b17", "U.A0")] }],
              waitFor: { when: mid, hold: 0.3 } },
            { id: "turn", say: (C) => `${C.right("p") ? "Right: " : ""}half of 5 V reads ${seen.mid || 512}, about half of 1023. Now turn the knob all the way, both ways.`,
              waitFor: { when: ends } },
            FINISH("A0 turns its push into a number: 0 V reads 0, 5 V reads 1023. That's how a board reads a knob."),
          ],
          goals: [{ text: "Read the knob at both ends", when: ends }],
          bonus: [
            { text: "Predict the middle", final: (C) => C.right("p") },
            { text: "Then set A0 between 500 and 524", when: (S, m) => { if (ends(S, m)) m.both = true; const v = a0(S); return !!m.both && v !== null && v >= 500 && v <= 524; } },
          ],
          solution: [{ choose: "right" }, { wire: [V.h("b17"), "U.A0"] }, { wait: 0.6 }, { knob: "k1", pos: 0 }, { wait: 0.3 }, { knob: "k1", pos: 1 }, { wait: 0.3 },
            { knob: "k1", pos: 0.5 }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "11-4", title: "A pin that reads", teaches: ["pinIn"], uses: ["pinOut", "buttonLoop", "buttonLegs", "resistor", "strip", "rail", "gap"], shifts: [0, 3],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["HIGH", "LOW", "5 V"], 0);
        const high = (S) => pressed(S) && S.uno.read("D2") === "HIGH", low = (S) => !pressed(S) && S.uno.read("D2") === "LOW";
        return {
          region: REGION(V),
          start: start(BOARD({ watch: ["D2"] }), ...POWER(V), ...BUTTON(V)),
          rules: { tray: [], allow: allow({ ctl: ["b1"] }) },
          ui: { xray: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "D2 is set to IN: it doesn't push, it reads. The button joins D2 to 5 V. Press it, and the screen will say D2 reads…",
              highlight: { lcd: "board" }, predict: P, waitFor: { predict: true } },
            { id: "press", say: "Find out: press and hold the button, and watch the board's screen.", hints: [PRESS], waitFor: { when: high, hold: 0.2 } },
            { id: "name", say: (C) => `${C.right("p") ? "Right: " : ""}5 V reads HIGH. Now let go: the 10 kΩ joins D2 to GND, so it reads LOW.`,
              waitFor: { when: low, hold: 0.3 } },
            FINISH("A pin set to IN reads its push: above 3 V is HIGH, below 1.5 V is LOW. That's how a board reads a button."),
          ],
          goals: [{ text: "Make D2 read HIGH", when: high }, { text: "And LOW again", when: (S, m) => { if (high(S)) m.h = true; return !!m.h && low(S); } }],
          bonus: [
            { text: "Predict what D2 reads", final: (C) => C.right("p") },
            { text: "Press it three times", when: (S, m) => { const h = high(S); if (h && !m.was) m.n = (m.n || 0) + 1; m.was = h; return (m.n || 0) >= 3; } },
          ],
          solution: [{ choose: "right" }, { press: "b1", on: true }, { wait: 0.5 }, { press: "b1", on: false }, { wait: 0.5 }, { press: "b1", on: true }, { wait: 0.2 },
            { press: "b1", on: false }, { wait: 0.2 }, { press: "b1", on: true }, { wait: 0.2 }, { press: "b1", on: false }, { wait: 0.3 }, { next: 1 }],
        };
      },
    },
    {
      id: "11-5", title: "Floating", teaches: ["pullDown"], uses: ["pinIn", "pinOut", "buttonLoop", "buttonLegs", "resistor", "strip", "rail", "gap"], shifts: [0, 3],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["LOW", "HIGH", "HIGH and LOW at random"], 2);
        let once = false;                    // D2 has floated: only after that does holding it LOW count
        const floated = (S, m) => { if (pressed(S) || !S.uno.floating("D2")) return false; m[S.uno.read("D2")] = true; if (m.HIGH && m.LOW) once = true; return !!m.HIGH && !!m.LOW; };
        const steady = (S) => once && !pressed(S) && !S.uno.floating("D2") && S.uno.read("D2") === "LOW";
        return {
          region: REGION(V),
          start: start(BOARD({ watch: ["D2"] }), ...POWER(V), ...BUTTON(V)),
          rules: { tray: [], allow: allow({ ctl: ["b1"], remove: ["pd"] }) },
          ui: { xray: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "Take the 10 kΩ away, and with the button up nothing joins D2 to anything. D2 will read…", highlight: { part: "pd" },
              predict: P, waitFor: { predict: true } },
            { id: "remove", say: "Find out: take the 10 kΩ off the board. Keep the button up, and watch the screen.",
              hints: [{ say: "Click the 10 kΩ, then Remove." }], waitFor: { when: floated } },
            { id: "back", say: (C) => `${C.right("p") ? "Right: " : ""}nothing holds it, so it floats and reads at random. Put the 10 kΩ back, from D2's strip to the − rail.`,
              hints: [{ show: [V.RES("h", "-T7", "a7", 10000)] }], waitFor: { when: steady, hold: 1 } },
            FINISH("That 10 kΩ is a pull-down: it holds D2 LOW until the button pulls it HIGH. Every button input needs one."),
          ],
          goals: [{ text: "See D2 float", when: floated }, { text: "Hold D2 steady at LOW", when: steady, hold: 1 }],
          bonus: [
            { text: "Predict a floating pin", final: (C) => C.right("p") },
            { text: "Then press: D2 reads HIGH", when: (S, m) => { if (steady(S)) m.s = true; return !!m.s && pressed(S) && S.uno.read("D2") === "HIGH"; } },
          ],
          solution: [{ choose: "right" }, { remove: "pd" }, { wait: 1.5 }, { place: { type: "resistor", value: 10000 }, at: V.hs("-T7", "a7") }, { wait: 1.4 },
            { press: "b1", on: true }, { wait: 0.3 }, { press: "b1", on: false }, { wait: 0.3 }, { next: 1 }],
        };
      },
    },
    {
      id: "11-6", title: "A tiny program", teaches: ["program"], uses: ["pinIn", "pullDown", "pinOut", "pinLimit", "buttonLoop", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 3],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Light up", "Stay dark", "Blink"], 0);
        const rule = (S) => (part(S, "board").part.program || {}).rule;
        const copyOn = (S) => rule(S) === "copy" && pressed(S) && led(S);
        const oppOff = (S) => rule(S) === "opposite" && pressed(S) && !lit(part(S, "led1"), 0.0005);
        const tried = (S, m) => { if (rule(S) !== "opposite") return false; if (!pressed(S) && led(S)) m.up = true; if (oppOff(S)) m.down = true; return !!m.up && !!m.down; };
        return {
          region: REGION(V),
          start: start(BOARD({ watch: ["D2"], program: COPY, programs: [COPY, OPP] }), ...POWER(V), ...BUTTON(V), ...LEDLOOP(V)),
          rules: { tray: [], allow: allow({ ctl: ["b1"] }) },
          ui: { xray: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "The board runs a program, shown on its screen: D13 copies D2. Press the button, and the LED will…", highlight: { lcd: "board" },
              allow: { program: false }, predict: P, waitFor: { predict: true } },
            { id: "press", say: "Find out: press the button.", allow: { program: false }, hints: [PRESS], waitFor: { when: copyOn, hold: 0.3 } },
            { id: "swap", say: (C) => `${C.right("p") ? "Right: " : ""}D2 reads HIGH, so the program sets D13 HIGH. Click the screen to change the program, then try the button.`,
              hints: [{ say: "Click the board's screen once: the program becomes “D13 is opposite of D2”.", highlight: { lcd: "board" } }], waitFor: { when: tried } },
            FINISH("Same wires, a new program, and the LED does the opposite. In a controller, the program decides."),
          ],
          goals: [{ text: "Light the LED with the button", when: copyOn }, { text: "Make the button switch it off", when: oppOff }],
          bonus: [
            { text: "Predict what the program does", final: (C) => C.right("p") },
            { text: "Then switch back to “copies”", when: (S, m) => { if (rule(S) === "opposite") m.o = true; return !!m.o && rule(S) === "copy"; } },
          ],
          solution: [{ choose: "right" }, { press: "b1", on: true }, { wait: 0.5 }, { press: "b1", on: false }, { wait: 0.3 }, { program: "opposite" }, { wait: 0.3 },
            { press: "b1", on: true }, { wait: 0.4 }, { press: "b1", on: false }, { wait: 0.3 }, { program: "copy" }, { wait: 0.3 }, { next: 1 }],
        };
      },
    },
    {
      id: "11-7", title: "Night light, by program", teaches: [], uses: ["program", "analogRead", "pinOut", "pinLimit", "ldrDivider", "ldr", "divider", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0],
      card: { name: "The controller board", text: "A board's pins set a push (HIGH or LOW) or read one (IN, or a number on A0). Its program joins what it reads to what it sets." },
      layouts: [{}],
      make: (V) => {
        const seen = {};
        const tested = (S, m) => {
          const s = S.parts("ldr")[0], leds = S.parts("led").filter((q) => q.ok); if (!s || !leds.length) return false;
          const covered = (s.part.lux ?? 200) <= 5;
          if (!covered && leds.every((q) => q.rd.I < 0.0005)) m.off = true;
          if (covered && leds.some((q) => q.rd.I > 0.003)) m.on = true;
          return !!m.off && !!m.on;
        };
        return {
          region: REGION(V),
          start: start(BOARD({ watch: ["A0"], program: BELOW }), ...POWER(V)),
          rules: { tray: [{ type: "ldr", n: 1 }, { type: "resistor", value: 10000, n: 1 }, { type: "resistor", value: 330, n: 1 }, { type: "led", color: "yellow", n: 1 },
            { type: "wire", n: 4 }], banner: true },
          allowDamage: true,
          ui: { xray: true },
          goalsFrom: 1,
          beats: [
            { id: "brief", say: V.say("Build a night light with the board. Its program sets D13 HIGH while A0 reads under 500.",
              "Your turn: the program is ready. Build the night light around it."), waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Build a light-sensor divider into A0, and the LED on D13. Then test it: in the light, and covered.",
              hints: [{ say: "The divider: the light sensor from the + rail to a strip, the 10 kΩ from that strip to the − rail. Wire the strip to A0." },
                { say: "The LED: a wire from D13, the 330 Ω, the LED, then the − rail." },
                { show: [{ id: "h1", type: "ldr", legs: V.hs("+T17", "a17") }, V.RES("h2", "c17", "c20", 10000), V.WIRE("h3", "a20", "-T20"), V.WIRE("h4", "b17", "U.A0"),
                  V.WIRE("h5", "U.D13", "a14"), V.RES("h6", "b14", "b11", 330), V.LED("h7", "c11", "c10", "yellow"), V.WIRE("h8", "e10", "-T10")] }],
              waitFor: { when: tested } },
            FINISH("A night light run by a program. Chapter 11 done!"),
          ],
          goals: [{ text: "Off in the light, on in the dark", when: tested }],
          bonus: [
            { text: "Nothing breaks", final: (C) => C.broken.size === 0 },
            { text: "Use at most four wires", final: () => !seen.more, when: (S) => { if (S.parts("wire").length > 6) seen.more = true; return false; } },
          ],
          solution: [{ next: 1 }, { place: { type: "ldr", lux: 200 }, at: V.hs("+T17", "a17") }, { place: { type: "resistor", value: 10000 }, at: V.hs("c17", "c20") },
            { wire: V.hs("a20", "-T20") }, { wire: [V.h("b17"), "U.A0"] }, { wire: ["U.D13", V.h("a14")] }, { place: { type: "resistor", value: 330 }, at: V.hs("b14", "b11") },
            { place: { type: "led", color: "yellow" }, at: V.hs("c11", "c10") }, { wire: V.hs("e10", "-T10") }, { wait: 0.6 }, { cover: "ldr" }, { wait: 0.8 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(11, "The controller board", L);
})(window.BB = window.BB || {});
