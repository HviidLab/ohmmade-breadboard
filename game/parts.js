// Part catalogue: how each breadboard part becomes devices, what it reads out, and how it fails.
// build(circuit, nodes, part, rt) returns a handle with read(sim) → readout object.
// stresses(part) → {key: {rated, tau, square, smoke, fail, x: (readout) => quantity}}.
// failText(part, rt, readout) → teaching message with numbers.
// legI(readout) → current into the part at each leg, in leg order (they sum to zero); used to draw the current flowing.
(function (BB) {
  "use strict";
  const D = BB.Devices, P = D.PARAMS;
  const mA = (a) => `${(Math.abs(a) * 1000).toFixed(Math.abs(a) < 0.01 ? 2 : Math.abs(a) < 0.1 ? 1 : 0)} mA`;
  const fmtA = (a) => (Math.abs(a) >= 1 ? `${Math.abs(a).toFixed(2)} A` : mA(a));
  const fmtR = (r) => (r >= 1e6 ? `${r / 1e6} MΩ` : r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`);

  // Standard resistor values (E12 series), 10 Ω to 1 MΩ: what a starter kit or shop sells.
  const E12_BASE = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
  const E12 = [];
  for (let d = 1; d <= 10000; d *= 10) for (const b of E12_BASE) E12.push(b * d);   // 10 Ω … 820 kΩ
  E12.push(1e6);
  const RMIN = 10, RMAX = 1e6;
  // "4.7k", "4k7", "470", "2.2 kΩ", "1M" → ohms rounded to two significant digits (what colour bands can show), or null.
  function parseOhms(text) {
    const s = String(text).trim().replace(/\s+/g, "").replace(/(ohms?|Ω)$/i, "").replace(",", ".");
    const m = /^(\d*\.?\d+)([kKmM]?)(\d*)$/.exec(s);
    if (!m) return null;
    const mult = { "": 1, k: 1e3, K: 1e3, m: 1e6, M: 1e6 }[m[2]];
    const x = (m[3] ? parseFloat(`${m[1]}.${m[3]}`) : parseFloat(m[1])) * mult;
    if (!(x > 0)) return null;
    const p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
    return Math.round(x / p) * p;
  }
  // The smallest standard value of at least r.
  const e12AtLeast = (r) => E12.find((v) => v >= r) ?? RMAX;

  const COLOR_NAME = { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue", white: "White" };
  // What to call a part on screen: "Blue LED", "Resistor 4.7 kΩ", "Jumper wire".
  function name(part) {
    if (part.type === "led") return `${COLOR_NAME[part.color] || "Red"} LED`;
    if (part.type === "resistor") return part.tag ? `Resistor ${part.tag}` : `Resistor ${fmtR(part.value)}`;   // a tagged one hides its value
    if (part.type === "battery" && part.cells) return `Battery pack ${part.cells}×AA`;
    if (part.type === "cap" && part.value) return `Capacitor ${Math.round(part.value * 1e6)} µF`;
    return TYPES[part.type].label;
  }

  const TYPES = {
    resistor: {
      label: "Resistor", legs: ["a", "b"], kind: "flex",
      build(c, [a, b], part, rt) {
        if (rt.destroyed) return { read: () => ({ I: 0, V: 0, P: 0 }) };
        const r = c.add(new D.Resistor(a, b, part.value));
        return { read: (S) => { const I = r.current(S.v); return { I, V: I * part.value, P: I * I * part.value }; } };
      },
      stresses: () => ({ heat: { rated: 0.25, tau: 5, square: false, smoke: 2.5, fail: 4, x: (rd) => rd.P } }),
      legI: (rd) => [rd.I || 0, -(rd.I || 0)],
      failText: (part, rt) => `The ${fmtR(part.value)} resistor burned out. It had to handle ${(rt.stress.heat.peak).toFixed(2)} W; a ¼ W resistor is rated for 0.25 W. Use a larger resistance, so less current flows.`,
    },

    wire: {
      label: "Jumper wire", legs: ["a", "b"], kind: "flex",
      build(c, [a, b], part, rt) {
        if (rt.destroyed || part.broken) return { read: () => ({ I: 0 }) };      // broken inside: looks fine, joins nothing
        const r = c.add(new D.Resistor(a, b, P.wire.r));
        return { read: (S) => ({ I: r.current(S.v) }) };
      },
      // A jumper carries a battery short (about 11 A) for a long time; the batteries overheat first (as on a real bench).
      stresses: () => ({ heat: { rated: 2.5, tau: 5, square: true, smoke: 1.78, fail: 25, x: (rd) => rd.I } }),
      legI: (rd) => [rd.I || 0, -(rd.I || 0)],
      failText: (part, rt) => `A jumper wire got so hot its insulation melted: ${fmtA(rt.stress.heat.peak)} flowed through it, with nothing to limit the current.`,
    },

    battery: {
      label: "Battery pack 4×AA", legs: ["pos", "neg"], kind: "flex",
      build(c, [pos, neg], part, rt) {
        c.preferRef(neg, 2);
        if (rt.destroyed) return { read: () => ({ I: 0, V: 0, Pint: 0 }) };
        const k = (part.cells || 4) / 4, rint = P.battery.rint * k;            // part.cells: a smaller pack (2×AA = 3 V)
        const s = c.add(new D.Source(pos, neg, P.battery.emf * k, rint));
        s.on = part.on !== false;
        return { src: s, read: (S) => { const I = s.current(S.v); return { I, V: S.v[pos] - S.v[neg], Pint: I * I * rint, short: I > 2 }; } };
      },
      stresses: () => ({ heat: { rated: 1, tau: 20, square: false, smoke: 10, fail: 18, x: (rd) => rd.Pint } }),      // a full short: hot in 3 s, ruined in 6 s
      legI: (rd) => [-(rd.I || 0), rd.I || 0],
      failText: () => "The batteries overheated in a short circuit. Real cells get hot enough to burn you, and can leak. Always put a resistance in the path.",
    },

    led: {
      label: "LED", legs: ["anode", "cathode"], kind: "bend",
      build(c, [a, k], part, rt) {
        if (rt.destroyed) return { read: () => ({ I: 0, V: 0, P: 0 }) };
        const d = D.led(c, a, k, D.ledParams(part.color));
        return { read: (S) => { const I = d.current(S.v), V = d.voltage(S.v); return { I, V, P: I * V, reverse: V < -5 }; } };
      },
      stresses: (part) => ({ current: { rated: D.ledParams(part.color).imax, tau: 0.1, square: true, smoke: 6, fail: 12, x: (rd) => Math.max(rd.I, 0) } }),
      legI: (rd) => [rd.I || 0, -(rd.I || 0)],
      failText(part, rt) {
        const p = D.ledParams(part.color), emf = P.battery.emf, raw = (emf - p.vf) / 0.02, r = e12AtLeast(raw);    // the 20 mA rule, rounded up (level 4-5)
        return `The ${name(part).toLowerCase().replace(" led", " LED")} burned out: ${fmtA(rt.stress.current.peak)} flowed, and a standard LED takes about ${p.imax * 1000} mA. ` +
          `It drops about ${p.vf.toFixed(1)} V, so from the ${emf} V pack a resistor of at least (${emf} − ${p.vf.toFixed(1)}) V ÷ 20 mA = ${fmtR(Math.round(raw))}${r > raw + 0.5 ? `, so ${fmtR(r)}` : ""} or more keeps it safe.`;
      },
    },

    // Multimeter: legs = probe tips (red, COM). part.mode: off|V|mA|ohm|cont. part.socket: "VO" | "mA".
    meter: {
      label: "Multimeter", legs: ["red", "com"], kind: "probe",
      build(c, [red, com], part, rt) {
        c.preferRef(com, 1);
        const m = P.meter, mode = part.mode || "V", socket = part.socket || "VO";
        let dev = null, src = null;
        if (socket === "mA") { if (!rt.destroyed) dev = c.add(new D.Resistor(red, com, m.rShunt)); }
        else if (mode === "V") dev = c.add(new D.Resistor(red, com, m.rV));
        else if (mode === "ohm" || mode === "cont") src = c.add(new D.Source(red, com, m.ohmV, m.ohmR));
        return {
          read(S) {
            const V = S.v[red] - S.v[com];
            const Ishunt = dev && socket === "mA" ? dev.current(S.v) : 0;
            const out = { V, Ishunt, mode, socket, fuseOK: !rt.destroyed, Ip: socket === "mA" ? Ishunt : mode === "V" ? V / m.rV : src ? -src.current(S.v) : 0 };
            if (mode === "off") out.display = "OFF";
            else if (mode === "V") out.value = V;
            else if (mode === "mA") {
              if (socket === "mA" && rt.destroyed) out.display = "FUSE";
              out.value = socket === "mA" ? Ishunt : 0;
              if (socket === "VO") out.note = "The red lead is in the VΩ socket, so no current can flow through the meter.";
            } else {
              if (socket === "mA") out.display = "OL";
              else {
                const I = src.current(S.v);         // test current out through the red probe
                const R = I > 1e-9 ? V / I : Infinity;
                out.value = R;
                if (I < -1e-9 || R < 0) {           // something else pushes current into the probes: the circuit is powered
                  out.display = "Err";
                  out.note = "Power is on: switch it off to measure ohms.";
                } else if (!(R < 40e6) || V > m.ohmV * 0.999) out.display = "OL";
                if (mode === "cont") out.beep = R < 50;
              }
            }
            return out;
          },
        };
      },
      legI: (rd) => [rd.Ip || 0, -(rd.Ip || 0)],
      stresses: () => ({ fuse: { rated: P.meter.fuseA, tau: 0.2, square: true, fail: 2.5, x: (rd) => rd.Ishunt } }),
      failText: (part, rt) => `The meter's fuse blew: ${fmtA(rt.stress.fuse.peak)} went through it. With the red lead in the mA socket, the meter is almost a wire. Put it in the path of the current, never across a battery or a part.`,
    },

    // Electrolytic capacitor: legs + and −. ESR, leakage, reverse conduction when connected backwards.
    cap: {
      label: "Electrolytic capacitor", legs: ["pos", "neg"], kind: "bend",
      build(c, [pos, neg], part, rt) {
        if (rt.destroyed) return { read: () => ({ V: 0, I: 0, Prev: 0 }) };
        const k = P.cap, mid = c.internal("cap");
        const esr = c.add(new D.Resistor(pos, mid, k.esr[part.value] || 0.3));
        const cap = c.add(new D.Capacitor(mid, neg, part.value));
        cap.vc = rt.vc || 0;
        c.add(new D.Resistor(pos, neg, k.leak));
        const rmid = c.internal("caprev");
        const rr = c.add(new D.Resistor(neg, rmid, k.revRs));
        const is = 0.01 / Math.exp(k.revKnee / (2 * BB.Engine.VT));
        c.add(new D.Junction(rmid, pos, is, 2));
        return {
          save: () => { rt.vc = cap.vc; },
          read: (S) => {
            const V = S.v[pos] - S.v[neg], Irev = rr.current(S.v);
            return { V, Vc: cap.vc, I: esr.current(S.v), Ileak: V / k.leak, Irev, Prev: Math.max(Irev, 0) * Math.max(-V, 0), reverse: V < -0.5 };
          },
        };
      },
      stresses: () => ({ reverse: { rated: 0.1, tau: 4, square: false, smoke: 4, fail: 8, x: (rd) => rd.Prev } }),
      legI: (rd) => { const i = (rd.I || 0) + (rd.Ileak || 0) - (rd.Irev || 0); return [i, -i]; },
      failText: () => "The capacitor vented: it was connected the wrong way round. An electrolytic capacitor has a + and a − leg; the stripe marks the − leg.",
    },

    // 10 kΩ potentiometer: legs end1, wiper, end2. part.pos in 0..1 = wiper position from end1.
    pot: {
      label: "Potentiometer 10 kΩ", legs: ["end1", "wiper", "end2"], kind: "fixed3",
      build(c, [e1, w, e2], part, rt) {
        if (rt.destroyed) return { read: () => ({ P1: 0, P2: 0, a: 0 }) };
        const k = P.pot, a = part.pos ?? 0.5;
        const r1 = c.add(new D.Resistor(e1, w, Math.max(a * k.r, k.rmin)));
        const r2 = c.add(new D.Resistor(w, e2, Math.max((1 - a) * k.r, k.rmin)));
        return { read: (S) => { const i1 = r1.current(S.v), i2 = r2.current(S.v); return { I1: i1, I2: i2, P1: i1 * i1 * r1.r, P2: i2 * i2 * r2.r, a, Vw: S.v[w] }; } };
      },
      stresses: (part) => ({
        seg1: { rated: 0.1, tau: 2, square: false, smoke: 2.5, fail: 4, x: (rd) => rd.P1 / Math.max(rd.a, 0.02) },
        seg2: { rated: 0.1, tau: 2, square: false, smoke: 2.5, fail: 4, x: (rd) => rd.P2 / Math.max(1 - rd.a, 0.02) },
      }),
      legI: (rd) => [rd.I1 || 0, (rd.I2 || 0) - (rd.I1 || 0), -(rd.I2 || 0)],
      failText: () => "The potentiometer track burned: near the end of its travel, a tiny piece of track carried the whole current. Put a fixed resistor in series with it.",
    },

    // 4-leg push button: legs p0,p1 (one side), p2,p3 (other side). part.pairs: "across" (p0–p1, p2–p3 joined) or "along".
    button: {
      label: "Push button", legs: ["p0", "p1", "p2", "p3"], kind: "button",
      build(c, n, part) {
        const k = P.button, along = part.pairs === "along";
        const [a0, a1, b0, b1] = along ? [n[0], n[2], n[1], n[3]] : [n[0], n[1], n[2], n[3]];
        const ra = c.add(new D.Resistor(a0, a1, k.rPair));
        const rb = c.add(new D.Resistor(b0, b1, k.rPair));
        const rp = c.add(new D.Resistor(a0, b0, part.pressed ? k.rPressed : Infinity));
        return { read: (S) => {
          const ia = ra.current(S.v), ib = rb.current(S.v), ip = rp.current(S.v);
          const into = [ia + ip, -ia, ib - ip, -ib];            // a0, a1, b0, b1
          return { pressed: !!part.pressed, legI: along ? [into[0], into[2], into[1], into[3]] : into };
        } };
      },
      legI: (rd) => rd.legI || [0, 0, 0, 0],
    },

    // Light-dependent resistor GL5528. part.lux = light level.
    ldr: {
      label: "Light sensor (LDR)", legs: ["a", "b"], kind: "flex",
      build(c, [a, b], part) {
        const k = P.ldr, lux = Math.max(part.lux ?? 200, 0.01);
        const R = Math.min(k.r10 * Math.pow(lux / 10, -k.gamma), k.rmax);
        const r = c.add(new D.Resistor(a, b, R));
        return { read: (S) => ({ R, I: r.current(S.v), lux }) };
      },
      legI: (rd) => [rd.I || 0, -(rd.I || 0)],
    },

    // NPN transistor (BC547-like): legs C, B, E as in the workbook (rows 50, 51, 52).
    npn: {
      label: "NPN transistor", legs: ["c", "b", "e"], kind: "fixed3",
      build(c, [cc, b, e], part, rt) {
        if (rt.destroyed) {
          if (rt.cause === "power") c.add(new D.Resistor(cc, e, 1));     // failed short C–E
          return { read: (S) => ({ Ib: 0, Ic: 0, Vbe: S.v[b] - S.v[e], Vce: S.v[cc] - S.v[e], P: 0 }) };
        }
        const q = D.npn(c, b, cc, e);
        return { read: (S) => { const Ib = q.ib(S.v), Ic = q.ic(S.v), Vce = S.v[cc] - S.v[e]; return { Ib, Ic, Vbe: S.v[b] - S.v[e], Vce, P: Vce * Ic + (S.v[b] - S.v[e]) * Ib }; } };
      },
      legI: (rd) => [rd.Ic || 0, rd.Ib || 0, -((rd.Ic || 0) + (rd.Ib || 0))],
      stresses: () => ({
        base: { rated: 0.05, tau: 0.05, square: true, fail: 4, x: (rd) => rd.Ib },
        power: { rated: 0.5, tau: 2, square: false, smoke: 1.0, fail: 1.2, x: (rd) => rd.P },
      }),
      failText: (part, rt) => rt.cause === "base"
        ? `The transistor burned out: ${fmtA(rt.stress.base.peak)} went into its base. Always put a resistor (for example 10 kΩ) in series with the base.`
        : "The transistor overheated and failed as a short from collector to emitter, so the LED is now stuck on. Limit the collector current with a resistor.",
    },

    // The controller board, USB powered. part.pins = {D13: "LOW"|"HIGH"|"INPUT", ...}. No legs: other parts plug into its sockets.
    uno: {
      label: "Controller board", legs: [], kind: "board",
      build(c, nodes, part, rt) {
        const U = P.uno, br = rt.broken || {}, g = c.node("U.GND");
        c.preferRef(g, 3);
        const n5 = c.node("U.5V"), n33 = c.node("U.3V3");
        const powered = !br.poly;
        const s5 = c.add(new D.Source(n5, g, U.v5, U.r5)); s5.on = powered;          // r5: a short draws about 1.7 A, about what a USB port can give
        const s33 = c.add(new D.Source(n33, g, U.v33, U.r33)); s33.on = powered;
        const pins = {};
        for (const name of [...BB.Uno.DIGITAL, ...BB.Uno.ANALOG]) {
          const n = c.node(`U.${name}`), mode = name[0] === "A" ? "INPUT" : (part.pins && part.pins[name]) || "INPUT";
          const pin = { name, node: n, mode };
          if (br[`pin:${name}`] || br[`clamp:${name}`]) { c.add(new D.Resistor(n, g, 100e3)); pin.damaged = true; }
          else if (mode !== "INPUT") { pin.src = c.add(new D.Source(n, g, mode === "HIGH" ? U.v5 : 0, U.rPin)); pin.src.on = powered; }
          else {
            c.add(new D.Resistor(n, g, U.rIn));
            pin.up = c.add(new D.Junction(n, n5, U.clampIs, 1));     // clamp to 5 V
            pin.dn = c.add(new D.Junction(g, n, U.clampIs, 1));     // clamp to GND
          }
          pins[name] = pin;
        }
        return {
          read(S) {
            const out = { powered, I5: powered ? s5.current(S.v) + s33.current(S.v) : 0, pins: {}, analog: {}, pinI: {}, clampI: {} };
            const v5 = S.v[n5] || 0;
            for (const [name, pin] of Object.entries(pins)) {
              const V = S.v[pin.node];
              const I = pin.src && powered ? pin.src.current(S.v) : 0;
              const Ic = pin.up ? Math.max(pin.up.current(), 0) + Math.max(pin.dn.current(), 0) : 0;
              const read = pin.mode !== "INPUT" ? pin.mode : V > 3.0 ? "HIGH" : V < 1.5 ? "LOW" : "?";
              out.pins[name] = { V, I, mode: pin.mode, damaged: !!pin.damaged, read, node: pin.node };
              out.pinI[name] = I; out.clampI[name] = Ic;
              if (name[0] === "A") out.analog[name] = Math.max(0, Math.min(1023, Math.floor((V / Math.max(v5, 1e-3)) * 1024)));
            }
            return out;
          },
        };
      },
      stresses() {
        const st = { poly: { rated: 0.5, tau: 1, square: true, fail: 4, sub: true, resettable: true, x: (rd) => rd.I5 } };
        for (const n of BB.Uno.DIGITAL) st[`pin:${n}`] = { rated: 0.04, tau: 2, square: true, fail: 1.5, sub: true, x: (rd) => rd.pinI[n] || 0 };
        for (const n of [...BB.Uno.DIGITAL, ...BB.Uno.ANALOG]) st[`clamp:${n}`] = { rated: 0.01, tau: 0.5, square: true, fail: 2, sub: true, x: (rd) => rd.clampI[n] || 0 };
        return st;
      },
      failText(part, rt, key) {
        const st = rt.stress[key];
        if (key === "poly") return `The board's USB fuse tripped: ${fmtA(st.peak)} was drawn from 5V. It resets when it cools down. Look for a short from 5V or a pin to GND.`;
        const [kind, pin] = key.split(":");
        if (kind === "pin") return `Pin ${pin} is damaged: it supplied ${fmtA(st.peak)}. A pin can give about 20 mA safely and 40 mA at most. Put a 220–330 Ω resistor in series with an LED.`;
        return `Pin ${pin} is damaged: more than 5 V (or less than 0 V) was forced into it, and ${fmtA(st.peak)} flowed through its protection diodes. Never connect more than 5 V to a pin, and share GND between circuits.`;
      },
    },
  };

  BB.Parts = { TYPES, fmtA, fmtR, name, E12, RMIN, RMAX, parseOhms, e12AtLeast, COLOR_NAME };
})(window.BB = window.BB || {});
