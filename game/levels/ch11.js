// Chapter 11: The controller board. A pin is a switch you set (HIGH is 5 V, LOW is 0 V) that gives only about 20 mA;
// an analog pin reads a voltage as a number from 0 to 1023; a pin set to IN reads HIGH or LOW, floats without a pull-down,
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
      id: "11-3", title: "Reading a knob", teaches: ["analogRead"], uses: ["pinOut", "potKnob", "divider", "volts", "strip", "rail"], shifts: [0, 3],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["About 512", "About 1023", "About 2.5"], 0, [null, "1023 is the full 5 V. Half of 5 V reads about half of that: 512.",
          "A0 doesn't show a voltage. It turns the voltage into a number: 2.5 V reads about 512."]), seen = {};
        const wired = (S) => S.parts("wire").some((w) => w.legs.includes("U.A0") && w.nets.includes(V.n("bb:L17")));
        const a0 = (S) => (wired(S) ? S.uno.analog("A0") : null);
        const mid = (S) => { const v = a0(S); if (v !== null && v > 400 && v < 624) seen.mid = v; return v !== null && v > 400 && v < 624; };
        const ends = (S, m) => { const v = a0(S); if (v === null) return false; if (v < 20) m.lo = true; if (v > 1000) m.hi = true; return !!m.lo && !!m.hi; };
        return {
          region: REGION(V),
          start: start(BOARD({ watch: ["A0"] }), ...POWER(V), { id: "k1", type: "pot", legs: V.hs("c16", "c17", "c18"), pos: 0.5 },
            V.WIRE("w1", "a16", "+T16"), V.WIRE("w2", "a18", "-T18")),
          rules: { tray: [{ type: "wire", n: 1 }], allow: allow({ ctl: ["k1"] }) },
          ui: { strips: true },
          goalsFrom: 2,
          beats: [
            { id: "power", say: "No battery now: the red wire brings the board's 5 V to the + rail, and the blue one joins the − rail to GND (0 V).", waitFor: NEXT },
            { id: "p", say: "The knob's ends are on 5 V and GND. A0 turns 0 to 5 V into a number from 0 to 1023. Knob in the middle: A0 reads…",
              highlight: { part: "k1" }, predict: P, waitFor: { predict: true } },
            { id: "wire", say: "Find out: keep the knob in the middle, and draw a wire from its middle leg to the board's A0 socket.",
              hints: [{ say: "A0 is in the group marked “analog in”, on the right of the board.", highlight: { holes: ["U.A0"] } }, { show: [V.WIRE("h", "b17", "U.A0")] }],
              waitFor: { when: mid, hold: 0.3 } },
            { id: "turn", reply: "p", say: () => `A0 reads ${seen.mid ?? 512}: about ${((seen.mid ?? 512) * 5 / 1024).toFixed(1)} V, near half of 5 V. Now turn the knob all the way, both ways.`,
              waitFor: { when: ends } },
            FINISH("A0 turns its voltage into a number: 0 V reads 0, 5 V reads 1023. In code: analogRead(A0). That's how a board reads a knob."),
          ],
          goals: [{ text: "Read the knob at both ends", when: ends }],
          challenge: { text: "Then set A0 between 500 and 524", when: (S, m) => { if (ends(S, m)) m.both = true; const v = a0(S); return !!m.both && v !== null && v >= 500 && v <= 524; } },
          solution: [{ next: 1 }, { choose: "right" }, { wire: [V.h("b17"), "U.A0"] }, { wait: 0.6 }, { knob: "k1", pos: 0 }, { wait: 0.3 }, { knob: "k1", pos: 1 }, { wait: 0.3 },
            { knob: "k1", pos: 0.5 }, { wait: 0.6 }, { next: 1 }],
        };
      },
    },
    {
      id: "11-4", title: "A pin that reads", teaches: ["pinIn"], uses: ["pinOut", "buttonLoop", "buttonLegs", "resistor", "strip", "rail", "gap"], shifts: [0, 3],
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
            { id: "name", reply: "p", say: "5 V reads HIGH. Now let go: the 10 kΩ joins D2 to GND, so it reads LOW.",
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
      id: "11-5", title: "Floating", teaches: ["pullDown"], uses: ["pinIn", "pinOut", "buttonLoop", "buttonLegs", "resistor", "strip", "rail", "gap"], shifts: [0, 3],
      layouts: [{}],
      make: (V) => {
        const P = V.predict(["LOW", "HIGH", "HIGH and LOW, jumping about"], 2, ["D2 is joined only to a wire and the open button: nothing pulls it down to 0 V, so it floats.", "nothing pulls it up either. Joined to neither 5 V nor GND, it floats, and its reading jumps about.", null]);
        let once = false;                    // D2 has floated: only after that does holding it LOW count
        const floated = (S, m) => { if (pressed(S) || !S.uno.floating("D2")) return false; m[S.uno.read("D2")] = true; if (m.HIGH && m.LOW) once = true; return !!m.HIGH && !!m.LOW; };
        const steady = (S) => once && !pressed(S) && !S.uno.floating("D2") && S.uno.read("D2") === "LOW";
        return {
          region: REGION(V),
          start: start(BOARD({ watch: ["D2"] }), ...POWER(V), ...BUTTON(V)),
          rules: { tray: [], allow: allow({ ctl: ["b1"], remove: ["pd"] }) },
          ui: { strips: true },
          goalsFrom: 1,
          beats: [
            { id: "p", say: "Take the 10 kΩ away, and with the button up D2 is joined to neither 5 V nor GND. D2 will read…", highlight: { part: "pd" },
              predict: P, waitFor: { predict: true } },
            { id: "remove", say: "Find out: take the 10 kΩ off the board (it goes back to the parts tray). Keep the button up, and watch the screen.",
              hints: [{ say: "Click the 10 kΩ, then Remove." }], waitFor: { when: floated } },
            { id: "float", reply: "p", say: "Nothing holds it to 5 V or GND, so it floats: its reading jumps about by itself.", waitFor: NEXT },
            { id: "back", say: `Now put the 10 kΩ back: drag it from the parts tray, from strip ${V.r(7)} (D2's wire) to the − rail. D2 will settle at LOW.`,
              highlight: { holes: V.hs("a7", "-T7") }, hints: [{ show: [V.RES("h", "-T7", "a7", 10000)] }], waitFor: { when: steady, hold: 1 } },
            FINISH("That 10 kΩ is a pull-down: it holds D2 LOW until the button pulls it HIGH. A resistor, not a wire, so a press can't short 5 V."),
          ],
          goals: [{ text: "See D2 float", pre: "Watch D2", when: floated }, { text: "Put the 10 kΩ back: D2 steady at LOW", when: steady, hold: 1 }],
          challenge: { text: "Then press: D2 reads HIGH", when: (S, m) => { if (steady(S)) m.s = true; return !!m.s && pressed(S) && S.uno.read("D2") === "HIGH"; } },
          solution: [{ choose: "right" }, { remove: "pd" }, { wait: 1.5 }, { next: 1 }, { place: { type: "resistor", value: 10000 }, at: V.hs("-T7", "a7") }, { wait: 1.4 },
            { press: "b1", on: true }, { wait: 0.3 }, { press: "b1", on: false }, { wait: 0.3 }, { next: 1 }],
        };
      },
    },
    {
      id: "11-6", title: "A tiny program", teaches: ["program"], uses: ["pinIn", "pullDown", "pinOut", "pinLimit", "buttonLoop", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0, 3],
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
      id: "11-7", title: "Night light, by program", teaches: [], uses: ["program", "analogRead", "pinOut", "pinLimit", "ldrDivider", "ldr", "divider", "loop", "resistor", "polarity", "strip", "rail"], shifts: [0],
      card: { name: "The controller board", text: "A board's pins set a voltage (HIGH or LOW) or read one (IN, or a number on A0). Its program joins what it reads to what it sets." },
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
          ui: { strips: true },
          goalsFrom: 2,
          beats: [
            { id: "brief", say: V.say("A porch light: the board must switch the yellow LED on at dusk and off in daylight. Its program is on its screen: read it first.",
              "Your turn: a porch light, run by the board's program. Read the program on its screen first."), waitFor: NEXT },
            { id: "read", say: "D13 on while A0 < 500 means: D13 is HIGH while A0 reads less than 500. Work out what A0 must do in the dark.", waitFor: { next: true, label: "Start" } },
            { id: "build", say: "Build what the program needs, then test it: in the light, and covered (that is dusk).",
              hints: [{ say: "The program sets D13 HIGH while A0 reads under 500. So A0 needs a voltage that falls in the dark: a divider with the light sensor." },
                { say: "The divider: the light sensor from the + rail to a strip, the 10 kΩ from that strip to the − rail. Wire the strip to A0." },
                { say: "The LED: a wire from D13, the 330 Ω, the LED, then the − rail." },
                { show: [{ id: "h1", type: "ldr", legs: V.hs("+T17", "a17") }, V.RES("h2", "c17", "-T19", 10000), V.WIRE("h4", "b17", "U.A0"),
                  V.WIRE("h5", "U.D13", "a14"), V.RES("h6", "b14", "b11", 330), V.LED("h7", "c11", "-T9", "yellow")] }],
              waitFor: { when: tested } },
            FINISH("A porch light run by a program: dusk switches it on. Chapter 11 done!"),
          ],
          goals: [{ text: "Off in the light, on in the dark", when: tested }],
          // On in daylight: with the sensor on the − side of the divider, A0 reads high in the dark and low in the light (1.85 kΩ light, 75 kΩ covered, 10 kΩ, 5 V).
          react: [{ hold: 1, when: (S) => {
            const sen = S.parts("ldr")[0], lit = S.parts("led").some((q) => q.ok && q.rd.I > 0.003);
            if (!sen || !lit || (sen.part.lux ?? 200) <= 5 || !S.uno || !(S.uno.analog("A0") < 500)) return null;      // only when the program itself turned it on
            return `The LED is on in the light: A0 reads ${S.uno.analog("A0")}, under 500. A0 must fall in the dark: which side of the divider is the sensor on?`;
          } }],
          challenge: { text: "Use at most two wires", when: (S, m) => { m.max = Math.max(m.max || 0, S.parts("wire").filter((q) => !["p5", "pg"].includes(q.id)).length); return false; },
            final: (C, m) => (m.max || 0) <= 2 },
          solution: [{ next: 1 }, { next: 1 }, { place: { type: "ldr", lux: 200 }, at: V.hs("+T17", "a17") }, { place: { type: "resistor", value: 10000 }, at: V.hs("c17", "-T19") },
            { wire: [V.h("b17"), "U.A0"] }, { wire: ["U.D13", V.h("a14")] }, { place: { type: "resistor", value: 330 }, at: V.hs("b14", "b11") },
            { place: { type: "led", color: "yellow" }, at: V.hs("c11", "-T9") }, { wait: 0.6 }, { cover: "ldr" }, { wait: 0.8 }, { next: 1 }],
        };
      },
    },
  ];

  K.chapter(11, "The controller board", L, {
    "lede": "Meet a board with a tiny computer on it. Its pins switch and read, and a program decides what happens.",
    "cover": "program",
    "questions": [
      "What does setting a pin HIGH or LOW do?",
      "How does a board read a knob, or a button?",
      "Why does a button's input need a pull-down resistor?"
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
        "w": "Pull-down",
        "d": "A resistor from an input to GND that holds it LOW until a button pulls it HIGH.",
        "sym": "resistor"
      },
      {
        "w": "Program",
        "d": "Rules the board runs over and over: code in loop(), such as digitalWrite(13, HIGH); after pinMode(13, OUTPUT); in setup().",
        "sym": "chip"
      }
    ]
  });
})(window.BB = window.BB || {});
