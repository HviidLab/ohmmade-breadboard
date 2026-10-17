// The controller board: a generic board powered by USB, with one row of header sockets along its bottom edge
// (5V, GND, pins D2–D13, analog pins A0–A5). No programming language: pins are set by clicking, and a level can give the
// board a tiny fixed program (one rule, such as "D13 copies D2"), run by the simulator.
(function (BB) {
  "use strict";
  const P = 26;                          // socket pitch, the same as the breadboard's
  const W = 660, H = 200, SY = H - 18;   // drawn size in world units; the socket row's y
  const DIGITAL = ["D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13"];
  const ANALOG = ["A0", "A1", "A2", "A3", "A4", "A5"];
  const GROUPS = [[28, ["3V3", "5V", "GND0", "GND1"]], [160, DIGITAL], [506, ANALOG]];
  const SOCKETS = [];
  for (const [x0, names] of GROUPS) names.forEach((n, k) => SOCKETS.push({ name: n, x: x0 + k * P, y: SY }));
  const pos = { bx: -760, by: -40 };

  const netOf = (pt) => (/^U\.GND\d$/.test(pt) ? "U.GND" : pt);
  const socketXY = (pt) => {
    const s = SOCKETS.find((q) => `U.${q.name}` === pt);
    return s ? [pos.bx + s.x, pos.by + s.y] : [pos.bx, pos.by];
  };
  function socketAt(wx, wy, rad) {
    let best = null, bd = rad;
    for (const s of SOCKETS) {
      const d = Math.hypot(wx - (pos.bx + s.x), wy - (pos.by + s.y));
      if (d <= bd) { bd = d; best = `U.${s.name}`; }
    }
    return best;
  }
  const usable = (pt) => SOCKETS.some((s) => `U.${s.name}` === pt);
  const label = (name) => name.replace(/^GND\d$/, "GND").replace("3V3", "3.3V");

  // A pin that is damaged (not the USB fuse, which resets by itself) makes the board need replacing.
  const damaged = (rt) => !!rt && Object.keys(rt.broken || {}).some((k) => k !== "poly");

  // What a pin set to IN reads. Nothing holding it (only the pin's own 100 MΩ): it floats, and reads HIGH or LOW at random,
  // a new guess every 0.15 s. Deterministic in simulated time, so tests see the same flicker every run.
  function reading(sim, part, name) {
    const rd = sim.read(part.id), pin = rd && rd.pins && rd.pins[name];
    if (!pin || !rd.powered) return { read: "LOW", floating: false, V: 0 };
    if (pin.damaged) return { read: "LOW", floating: false, V: pin.V, damaged: true };
    if (pin.mode !== "INPUT") return { read: pin.mode, floating: false, V: pin.V };
    let floating = pin.read === "?";
    try { if (!floating) floating = sim.solver.theveninR(pin.node) > 1e7; } catch (e) { /* no circuit yet */ }
    if (!floating) return { read: pin.read, floating: false, V: pin.V };
    let h = Math.floor(sim.t / 0.15) * 2654435761 + name.length * 97 + name.charCodeAt(1) * 31;
    h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
    return { read: (h >>> 7) & 1 ? "HIGH" : "LOW", floating: true, V: pin.V };
  }

  // The tiny programs. Each is one rule that sets an output pin from an input pin.
  const RULES = {
    copy: (r) => r.read,
    opposite: (r) => (r.read === "HIGH" ? "LOW" : "HIGH"),
    below: (r, prog, sim, part) => ((sim.read(part.id).analog || {})[prog.from] < prog.n ? "HIGH" : "LOW"),
  };
  function programText(prog) {
    if (!prog) return "";
    if (prog.rule === "copy") return `${prog.out} copies ${prog.from}`;
    if (prog.rule === "opposite") return `${prog.out} is the opposite of ${prog.from}`;
    if (prog.rule === "below") return `${prog.out} on while ${prog.from} < ${prog.n}`;
    return "";
  }
  // The same rule as one line of the code a real controller board runs (C, as most boards are programmed).
  function programCode(prog) {
    if (!prog) return "";
    const pin = (n) => (n[0] === "D" ? n.slice(1) : n);
    if (prog.rule === "copy") return `digitalWrite(${pin(prog.out)}, digitalRead(${pin(prog.from)}));`;
    if (prog.rule === "opposite") return `digitalWrite(${pin(prog.out)}, !digitalRead(${pin(prog.from)}));`;
    if (prog.rule === "below") return `digitalWrite(${pin(prog.out)}, analogRead(${pin(prog.from)}) < ${prog.n});`;
    return "";
  }
  // Run every board's program once. Returns true when it changed a pin (the caller rebuilds the circuit).
  function tick(sim) {
    let changed = false;
    for (const part of sim.doc.parts) {
      const prog = part.type === "uno" && part.program;
      if (!prog || !RULES[prog.rule]) continue;
      const rd = sim.read(part.id);
      if (!rd || !rd.powered) continue;
      const want = RULES[prog.rule](reading(sim, part, prog.from), prog, sim, part);
      if ((part.pins || {})[prog.out] !== want) { part.pins = Object.assign({}, part.pins, { [prog.out]: want }); changed = true; }
    }
    return changed;
  }

  BB.Uno = { W, H, P, SOCKETS, DIGITAL, ANALOG, pos, netOf, socketXY, socketAt, usable, label, damaged, reading, tick, programText, programCode, present: false };
})(window.BB = window.BB || {});
