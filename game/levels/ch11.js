// Chapter 11: The controller board. A pin is a switch you set (HIGH is 5 V, LOW is 0 V) that gives only about 20 mA;
// a pin set to IN reads HIGH or LOW; a program joins what the board reads to what it sets; an analog pin reads a
// voltage as a number from 0 to 1023, so the board can read the light. Then a small puzzle: a porch light on the wrong
// program, and you pick the right one.
// Kept easy on purpose (playtest 2026-10-27: Chapters 9–11 were too hard): the knob and floating levels were cut, the
// pull-down stays pre-built with one sentence, and the last two levels are pre-built but for one wire or one choice.
// The board is generic (no trademarks). It sits above the breadboard; its pins are set by clicking their badges.
// Same rules as before: a question in every level, predict first, hints only on request.
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
  const COPY = { out: "D13", rule: "copy", from: "D2" }, OPP = { out: "D13", rule: "opposite", from: "D2" };
  const BELOW = { out: "D13", rule: "below", from: "A0", n: 500 }, ABOVE = { out: "D13", rule: "above", from: "A0", n: 500 };
  const PIN = { say: "Each pin's badge sits just above its socket. Click it to switch: L is LOW, H is HIGH.", highlight: { ctl: "pin:D13", id: "board" } };
  const COVER = { say: "Press and hold on the light sensor to cover it. Shift-click keeps it covered; Shift-click again uncovers it." };
  const PRESS = { say: "Press and hold the button. Shift-click keeps it down; Shift-click again lets it go." };

  const mode = (S, n) => S.uno.mode(n);
  const pressed = (S) => { const b = part(S, "b1"); return !!b && !!b.part.pressed; };
  const led = (S) => lit(part(S, "led1"));

  const L = [
    {
      id: "11-1", title: "A pin you switch", teaches: ["pinOut"], uses: ["loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 3],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Light up", "Stay dark", "Burn out"], 0, [null, "HIGH joins D13 to 5 V, so current flows round the LED's loop.",
          "the 330 Ω holds the current down, just as it does with a battery."]);
        const hi = (S) => mode(S, "D13") === "HIGH" && led(S), lo = (S) => mode(S, "D13") === "LOW" && !lit(part(S, "led1"), 0.0005);
        return {
          region: REGION(V),
          start: start(BOARD({ pins: { D13: "LOW" } }), GND(V), ...LEDLOOP(V)),
          rules: { tray: [], allow: allow({ pins: { D13: ["LOW", "HIGH"] } }) },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "A controller board, running on USB. Its pin D13 feeds the LED. Set D13 HIGH, which joins it to 5 V inside the board: the LED…",
              highlight: { part: "board" }, predict: P, waitFor: { predict: true } },
            { id: "high", say: "Find out: click D13's badge on the board. H means HIGH, L means LOW.", hints: [PIN], waitFor: { when: hi, hold: 0.3 } },
            { id: "gnd", reply: "p", say: "The blue wire joins the − rail to GND, the board's 0 V. So the LED's loop runs from D13, through the LED, back to GND.", waitFor: NEXT },
            { id: "low", say: "HIGH joined D13 to 5 V, so a current flowed. Now set it LOW: click D13's badge again. LOW joins it to GND, the board's 0 V.",
              waitFor: { when: lo, hold: 0.3 } },
            Object.assign(FINISH("A pin is a switch you control: HIGH gives about 5 V, LOW 0 V. In code: pinMode(13, OUTPUT); then digitalWrite(13, HIGH);"),
              { note: "static from your body can harm the board's chip: touch grounded metal first, and hold the board by its edges." }),
          ],
          goals: [{ text: "Light the LED from D13", when: hi }, { text: "Switch it off from D13", when: (S, m) => { if (hi(S)) m.on = true; return !!m.on && lo(S); } }],
          challenge: { text: "Blink it: on, off, on, off", when: (S, m) => { const now = led(S); if (now !== !!m.was) { m.n = (m.n || 0) + 1; m.was = now; } return (m.n || 0) >= 4; } },
          solution: [{ choose: "right" }, { pin: "D13", mode: "HIGH" }, { wait: 0.5 }, { next: 1 }, { pin: "D13", mode: "LOW" }, { wait: 0.5 },
            { pin: "D13", mode: "HIGH" }, { wait: 0.3 }, { pin: "D13", mode: "LOW" }, { wait: 0.5 }, { next: 1 }],
        };
      },
    },
    {
      id: "11-2", meter: "mA", title: "A pin's limit", teaches: ["pinLimit"], uses: ["pinOut", "ledCurrent", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 3],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["The LED just lights", "The pin is damaged", "Nothing happens"], 1, ["with no resistor, far more current flows than a pin can safely give.", null,
          "with no resistor, only the pin's own small resistance holds the current down: far too little."]), seen = {};
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
          demo: { uno: 1 }, simText: { uno: null },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "This LED is on D13 with a plain wire where its resistor should be. Set D13 HIGH, and…", highlight: { part: "w3" },
              predict: P, waitFor: { predict: true } },
            { id: "try", say: "Find out: set D13 HIGH.", hints: [PIN], waitFor: { when: hurt, hold: 0.05 } },
            { id: "fix", reply: "p", say: "Pop! D13 was forced past its 40 mA limit. Swap the plain wire for the 330 Ω, then click the board: Fresh board.", allow: { remove: ["w3"] },
              hints: [{ say: "Click the plain wire and remove it. Put the 330 Ω in its place. Then click the board and press Fresh board." }, { show: [V.RES("h", "b15", "b18", 330)] }],
              waitFor: { when: fixed, hold: 0.6 } },
            Object.assign(FINISH(() => `${fmtI(seen.i ?? 0.008)} now. A pin gives about 20 mA safely, so an LED on a pin always needs its resistor.`),
              { note: "a real pin pushed past 40 mA may fail at once or weaken over time, and the LED is overloaded too. Fit the resistor, every time." }),
          ],
          goals: [{ text: "Light the LED safely from D13", when: fixed, hold: 0.6 }],
          challenge: { text: "Finish without a hint", final: (C) => C.hintsUsed === 0 },
          solution: [{ choose: "right" }, { pin: "D13", mode: "HIGH" }, { wait: 2.5 }, { remove: "w3" }, { place: { type: "resistor", value: 330 }, at: V.hs("b15", "b18") },
            { replace: "board" }, { wait: 1 }, { next: 1 }],
        };
      },
    },
    {
      id: "11-3", title: "A pin that reads", teaches: ["pinIn"], uses: ["pinOut", "buttonLoop", "buttonLegs", "resistor", "strip", "rail", "gap"], shifts: [0, 3],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["HIGH", "LOW", "5 V"], 0, [null, "the button joins D2 to 5 V, and anything above 3 V reads HIGH.", "a pin set to IN reads HIGH or LOW, not a voltage: 5 V reads HIGH."]);
        const high = (S) => pressed(S) && S.uno.read("D2") === "HIGH", low = (S) => !pressed(S) && S.uno.read("D2") === "LOW";
        return {
          region: REGION(V),
          start: start(BOARD({ watch: ["D2"] }), ...POWER(V), ...BUTTON(V)),
          rules: { tray: [{ type: "wire", n: 1 }], allow: allow({ ctl: ["b1"] }) },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "D2 is set to IN: it doesn't set a voltage, it reads one. The button joins D2 to 5 V. Press it, and the screen will say D2 reads…",
              highlight: { lcd: "board" }, predict: P, waitFor: { predict: true } },
            { id: "press", say: "Find out: press and hold the button, and watch the board's screen.", hints: [PRESS], waitFor: { when: high, hold: 0.2 } },
            { id: "name", reply: "p", say: "5 V reads HIGH. Now let go. With the button up, the 10 kΩ holds D2 at GND, so it reads LOW.", highlight: { part: "pd" },
              waitFor: { when: low, hold: 0.3 } },
            Object.assign(FINISH("A pin set to IN reads its voltage: above 3 V is HIGH, below 1.5 V is LOW. In code: pinMode(2, INPUT), then digitalRead(2)."),
              { note: "a real board has no screen: after Serial.begin(9600); it sends readings to your computer with Serial.println(digitalRead(2));" }),
          ],
          goals: [{ text: "Make D2 read HIGH", when: high }, { text: "And LOW again", when: (S, m) => { if (high(S)) m.h = true; return !!m.h && low(S); } }],
          challenge: { text: "Then make D2 read HIGH with a wire instead of the button", when: (S, m, C) => !pressed(S) && S.uno.read("D2") === "HIGH" && S.parts("wire").some((q) => !["p5", "pg", "w5", "wd"].includes(q.id)) },
          solution: [{ choose: "right" }, { press: "b1", on: true }, { wait: 0.5 }, { press: "b1", on: false }, { wait: 0.5 }, { press: "b1", on: true }, { wait: 0.2 },
            { press: "b1", on: false }, { wait: 0.2 }, { press: "b1", on: true }, { wait: 0.2 }, { press: "b1", on: false }, { wait: 0.3 }, { wire: V.hs("+T9", "c7") }, { wait: 0.4 }, { next: 1 }],
        };
      },
    },
    {
      id: "11-4", title: "A tiny program", teaches: ["program"], uses: ["pinIn", "pinOut", "pinLimit", "buttonLoop", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 3],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["Light up", "Stay dark", "Blink"], 0, [null, "pressing makes D2 read HIGH, and the program copies that to D13.", "the program only copies D2: D13 stays HIGH as long as you press."]);
        const rule = (S) => (part(S, "board").part.program || {}).rule;
        const copyOn = (S) => rule(S) === "copy" && pressed(S) && led(S);
        const oppOff = (S) => rule(S) === "opposite" && pressed(S) && !lit(part(S, "led1"), 0.0005);
        const tried = (S, m) => { if (rule(S) !== "opposite") return false; if (!pressed(S) && led(S)) m.up = true; if (oppOff(S)) m.down = true; return !!m.up && !!m.down; };
        return {
          region: REGION(V),
          start: start(BOARD({ watch: ["D2"], program: COPY, programs: [COPY, OPP] }), ...POWER(V), ...BUTTON(V), ...LEDLOOP(V)),
          rules: { tray: [], allow: allow({ ctl: ["b1"] }) },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "The board runs a program, shown on its screen: D13 copies D2. Press the button, and the LED will…", highlight: { lcd: "board" },
              allow: { program: false }, predict: P, waitFor: { predict: true } },
            { id: "press", say: "Find out: press and hold the button.", allow: { program: false }, hints: [PRESS], waitFor: { when: copyOn, hold: 0.3 } },
            { id: "swap", reply: "p", say: "D2 reads HIGH, so the program sets D13 HIGH. Now change the program: click the board's screen once.", highlight: { lcd: "board" },
              hints: [{ say: "The screen is the panel on the board that shows the program, marked now. One click switches to the next program." }],
              waitFor: { when: (S) => rule(S) === "opposite", hold: 0.3 } },
            { id: "test", say: "Now D13 is the opposite of D2. Test it: watch the LED with the button up, then hold the button down.", hints: [PRESS], waitFor: { when: tried } },
            Object.assign(FINISH("Same wires, a new program, and the LED does the opposite. The ! in the code means \"not\". In a controller, the program decides."),
              { note: "on a real board, the code line on the screen sits inside loop(), which the board runs over and over, many thousands of times a second." }),
          ],
          goals: [{ text: "Light the LED with the button", when: copyOn }, { text: "Make the button switch it off", when: oppOff }],
          challenge: { text: "Then switch back to “copies”", when: (S, m) => { if (rule(S) === "opposite") m.o = true; return !!m.o && rule(S) === "copy"; } },
          solution: [{ choose: "right" }, { press: "b1", on: true }, { wait: 0.5 }, { press: "b1", on: false }, { wait: 0.3 }, { program: "opposite" }, { wait: 0.3 },
            { press: "b1", on: true }, { wait: 0.4 }, { press: "b1", on: false }, { wait: 0.3 }, { program: "copy" }, { wait: 0.3 }, { next: 1 }],
        };
      },
    },
    {
      id: "11-5", title: "Reading the light", teaches: ["analogRead"], uses: ["pinOut", "ldr", "divider", "volts", "strip", "rail"], shifts: [0, 3],
      layouts: [{}],
      // The sensor from the + rail to strip 17 and a 10 kΩ from there to the − rail are pre-built (a divider, Chapter 6);
      // one wire from strip 17 to A0. Sim: sensor 1.85 kΩ light, 75 kΩ covered, 5 V: A0 ≈ 864 in light, ≈ 120 covered.
      make: (V) => {
        const P = V.predict(["Lower", "Higher", "The same"], 0, [null, "covered, the sensor's resistance rises: its share of the 5 V grows, so less is left at A0.",
          "change one resistor of a divider and its meeting point moves: the sensor's resistance rises in the dark."]), seen = {};
        const covered = (S) => { const q = part(S, "s1"); return !!q && (q.part.lux ?? 200) <= 5; };
        const a0 = (S) => (S.parts("wire").some((w) => w.legs.includes("U.A0") && w.nets.some((n) => S.same(n, V.n("bb:L17")))) ? S.uno.analog("A0") : null);
        const light = (S) => { const v = a0(S); const ok = v !== null && !covered(S) && v > 700 && v < 1000; if (ok) seen.light = v; return ok; };
        const darkR = (S) => { const v = a0(S); const ok = v !== null && covered(S) && v < 400; if (ok) seen.dark = v; return ok; };
        return {
          region: REGION(V),
          start: start(BOARD({ watch: ["A0"] }), ...POWER(V), { id: "s1", type: "ldr", legs: V.hs("+T17", "a17"), lux: 200 }, V.RES("r2", "c17", "-T19", 10000)),
          rules: { tray: [{ type: "wire", n: 1 }], allow: allow({ ctl: ["s1"] }) },
          ui: { strips: true },
          goalsFrom: 2,
          beats: [
            { id: "power", say: "No battery now: the red wire brings the board's 5 V to the + rail, and the blue one joins the − rail to GND (0 V).", waitFor: NEXT },
            { id: "what", say: "A0 measures a voltage and turns it into a number: 0 V reads 0, 5 V reads 1023. The board's screen shows it.",
              highlight: { holes: ["U.A0"] }, waitFor: NEXT },
            { id: "wire", say: `The light sensor and the 10 kΩ meet at strip ${V.r(17)}. Draw a wire from that strip to A0 (both marked).`,
              highlight: { holes: [V.h("b17"), "U.A0"] },
              hints: [{ say: "A0 is in the group marked “analog in”, on the right of the board." }, { show: [V.WIRE("h", "b17", "U.A0")] }],
              waitFor: { when: light, hold: 0.4 } },
            { id: "p", say: () => `A0 reads ${seen.light ?? 864} in room light. Cover the sensor, and A0 will read…`, highlight: { part: "s1" },
              predict: P, waitFor: { predict: true } },
            { id: "dark", reply: "p", say: "Find out: cover the sensor (press and hold it), and watch A0 on the board's screen.", highlight: { part: "s1" },
              hints: [COVER], waitFor: { when: darkR, hold: 0.4 } },
            FINISH(() => `${seen.light ?? 864} in the light, ${seen.dark ?? 120} covered: the darker, the lower A0 reads. In code: analogRead(A0). Next: the board acts on it.`),
          ],
          goals: [{ text: "Read the light on A0", when: light }, { text: "A0 lower with the sensor covered", when: darkR }],
          challenge: { text: "Light, dark, and light again", when: (S, m) => { const v = a0(S), d = covered(S); if (v !== null) { if (!d && !m.l1) m.l1 = true; if (d && m.l1) m.d = true; if (!d && m.d) m.l2 = true; } return !!m.l2; } },
          solution: [{ next: 1 }, { next: 1 }, { wire: [V.h("b17"), "U.A0"] }, { wait: 0.8 }, { choose: "right" }, { cover: "s1" }, { wait: 0.8 }, { cover: "s1", on: false }, { wait: 0.6 },
            { next: 1 }],
        };
      },
    },
    {
      id: "11-6", title: "Porch light", teaches: [], uses: ["program", "analogRead", "pinOut", "pinLimit", "ldr", "divider", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0],
      card: { name: "The controller board", text: "A board's pins set a voltage (HIGH or LOW) or read one (IN, or a number on A0). Its program joins what it reads to what it sets." },
      layouts: [{}],
      // A small decision puzzle (playtest 2026-10-27: keep the capstones easy). 11-5's light reader on A0 and an LED on D13
      // are pre-built; the board runs the wrong program ("D13 on while A0 > 500": on by day). Click the screen for the other
      // one. A0 ≈ 864 in light, ≈ 120 covered, so only "< 500" is off in light and on covered.
      // The board starts with D13 HIGH, as its program sets it in light, so no reading lags a frame behind the program.
      make: (V) => {
        const P = V.predict(["D13 on while A0 < 500", "D13 on while A0 > 500", "Either one"], 0, [null,
          "A0 reads high in the light, so that program lights the lamp by day, as now.",
          "the two do opposite things: A0 is high in the light and low in the dark."]);
        const rule = (S) => (part(S, "board").part.program || {}).rule;
        const ledI = (S) => Math.max(0, ...S.parts("led").filter((q) => q.ok).map((q) => Math.abs(q.rd.I || 0)));
        const covered = (S) => { const q = part(S, "s1"); return !!q && (q.part.lux ?? 200) <= 5; };
        // both states with the same program: changing it starts the test again. Each state must last 5 frames, since the
        // program reacts a moment after the sensor is covered (else the wrong program would pass in that moment)
        const tested = (S, m) => {
          if (m.rule !== rule(S)) { m.rule = rule(S); m.on = m.off = false; }
          const off = !covered(S) && ledI(S) < 0.0005, on = covered(S) && ledI(S) > 0.003;
          m.offN = off ? (m.offN || 0) + 1 : 0; m.onN = on ? (m.onN || 0) + 1 : 0;
          if (m.offN >= 5) m.off = true;
          if (m.onN >= 5) m.on = true;
          return !!m.off && !!m.on;
        };
        return {
          region: REGION(V),
          start: start(BOARD({ watch: ["A0"], program: ABOVE, programs: [ABOVE, BELOW], pins: { D13: "HIGH" } }), ...POWER(V), { id: "s1", type: "ldr", legs: V.hs("+T17", "a17"), lux: 200 },
            V.RES("r2", "c17", "-T19", 10000), V.WIRE("w4", "b17", "U.A0"), V.WIRE("w1", "U.D13", "a14"), V.RES("r1", "b14", "b11", 330), V.LED("led1", "c11", "-T9", "yellow")),
          rules: { tray: [], allow: allow({ ctl: ["s1"] }) },
          ui: { strips: true },
          goalsFrom: 2,
          beats: [
            { id: "brief", say: V.say("A porch light: the yellow LED should come on at dusk. But it is on in daylight! The wiring is fine: the program is wrong.",
              "This porch light should come on at dusk, yet it shines in daylight. The wires are right; the program on the screen is wrong."),
              highlight: { lcd: "board" }, waitFor: NEXT },
            { id: "p", say: () => "A0 reads high in the light and low when the sensor is covered. Which program makes a porch light?", highlight: { lcd: "board" },
              predict: P, waitFor: { predict: true } },
            { id: "test", reply: "p", say: "Find out: click the board's screen to switch program. Then test it: in room light, then covered (that is dusk).", highlight: { lcd: "board" },
              hints: [{ say: "The screen is the panel on the board that shows the program, marked now. One click switches to the next program." }, COVER],
              waitFor: { when: tested } },
            FINISH("A porch light run by a program: the same wires, and the right rule turns it on at dusk. Chapter 11 done!"),
          ],
          goals: [{ text: "Off in the light, on in the dark", when: tested }],
          react: [{ hold: 1, when: (S, C) => {
            if (!C.beat || C.beat.id !== "test" || covered(S) || ledI(S) < 0.003) return null;
            return `The lamp is on in daylight: A0 reads ${S.uno.analog("A0")}, more than 500. The program must switch D13 on only when A0 is low.`;
          } }],
          challenge: { text: "Finish without a hint", final: (C) => C.hintsUsed === 0 },
          solution: [{ next: 1 }, { choose: "right" }, { program: "below" }, { wait: 0.6 }, { cover: "s1" }, { wait: 0.8 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(11, "The controller board", L, {
    "lede": "Meet a board with a tiny computer on it. Its pins switch and read, and a program decides what happens.",
    "cover": "program",
    "questions": [
      "What does setting a pin HIGH or LOW do?",
      "How does a board read a button, or the light?",
      "How does a program join what the board reads to what it sets?"
    ],
    "words": [
      {
        "w": "Controller board",
        "d": "A small computer with pins you can set and read, running on USB.",
        "sym": "chip"
      },
      {
        "w": "Pin, HIGH and LOW",
        "d": "A connection on the board. HIGH joins it to 5 V, LOW to 0 V.",
        "sym": "chip"
      },
      {
        "w": "GND (ground)",
        "d": "The board's 0 V point, like the battery's −.",
        "sym": "gnd"
      },
      {
        "w": "IN (input)",
        "d": "A pin set to read: above 3 V it reads HIGH, below 1.5 V LOW.",
        "sym": "chip"
      },
      {
        "w": "A0 (analog pin)",
        "d": "Reads a voltage from 0 to 5 V as a number from 0 to 1023.",
        "sym": "V"
      },
      {
        "w": "Program",
        "d": "Rules the board runs over and over: code in loop(), such as digitalWrite(13, HIGH); after pinMode(13, OUTPUT); in setup().",
        "sym": "chip"
      }
    ]
  });
})(window.BB = window.BB || {});
