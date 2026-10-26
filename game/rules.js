// Rules of a level: which parts may be moved, flipped, removed or switched, what is in the parts tray,
// and which holes are open. No DOM. In the sandbox there are no rules (G.rules is null).
//
// level.rules = {
//   tray: [{type: "wire", n: 1}, {type: "resistor", value: 330, n: 1}, {type: "led", color: "green", n: 1}],
//   allow: {move, legs, remove, flip, ctl, replace, probe: [ids] or "*", place: false, wire: false,
//           dial: ["off", "V", …], socket: ["VO", "mA"],     // which meter dial positions and red-lead sockets may be used
//           pins: {D13: ["LOW", "HIGH"]},                     // the controller board's pins the player may set, and to what
//           program: false},                                  // a board with `programs` (a list to choose from): no choosing now
//   guardShorts: true,       // undo any move that joins + straight to −, and explain
//   guardMeter: true,        // undo any move that would blow the meter's fuse, and explain
// }
// level.region = {rows: [1, 16], cols: "a-e" | "a-j", rails: "none" | "top" | "all"}
// A coach beat may add its own `allow`, which is merged over the level's while that beat is active.
// Parts the player put on the board are always theirs to move, flip and remove.
(function (BB) {
  "use strict";
  const OK = { ok: true };
  const no = (say) => ({ ok: false, say });
  const listed = (v, id) => v === "*" || (Array.isArray(v) && v.includes(id));

  // Parts of the same kind share a tray slot: all wires; resistors and capacitors by value (a resistor also by tag:
  // "Resistor A"); LEDs by colour.
  function keyOf(p) {
    if (p.type === "resistor") return `resistor:${p.value}${p.tag ? `:${p.tag}` : ""}`;
    if (p.type === "cap") return `cap:${p.value ?? CAP}`;
    if (p.type === "led") return `led:${p.color || "red"}`;
    return p.type;
  }
  function itemOf(key) {
    const [type, x, tag] = key.split(":");
    if (type === "resistor") return tag ? { type, value: +x, tag } : { type, value: +x };
    if (type === "cap") return { type, value: +x };
    if (type === "led") return { type, color: x };
    return { type };
  }
  const CAP = 1e-4;            // farads, for a capacitor that comes without a value
  // A new part as the player gets it from the tray or drawer (item: {type, value, color, tag}), plugged in at `legs`.
  function partOf(item, legs, level) {
    const part = { type: item.type, legs };
    if (item.type === "resistor") part.value = item.value ?? 330;
    if (item.tag) part.tag = item.tag;
    if (item.type === "led") part.color = item.color ?? "red";
    if (item.type === "cap") part.value = item.value ?? CAP;
    if (item.type === "pot") part.pos = 0.5;
    if (item.type === "ldr") part.lux = 200;
    if (item.type === "button") { part.pairs = "across"; part.pressed = false; if (level && level.rules && level.rules.latchButtons) part.latch = true; }
    return part;
  }

  const FIXED = {
    move: "This part is fixed in this level.",
    legs: "This part is fixed in this level.",
    remove: "This part has to stay on the board for now.",
    flip: "Not this one: it is fine the way it is.",
    ctl: "Leave that alone for now.",
    replace: "Not now.",
    probe: "Not now.",
    empty: "Not this one: see what it does as it is.",
  };

  class LevelRules {
    constructor(level) {
      this.lv = level;
      this.start = new Map(level.start.parts.map((p) => [p.id, p]));
      this.init = new Map();
      for (const t of (level.rules && level.rules.tray) || []) this.init.set(keyOf(t), (this.init.get(keyOf(t)) || 0) + t.n);
    }
    allow(G) { return Object.assign({ place: true, wire: true }, this.lv.rules && this.lv.rules.allow, G && G.coach && G.coach.beat && G.coach.beat.allow); }
    own(id) { return !this.start.has(id); }
    get guardShorts() { return !!(this.lv.rules && this.lv.rules.guardShorts); }
    get guardMeter() { return !!(this.lv.rules && this.lv.rules.guardMeter); }
    // May the meter's dial go to this position (or its red lead into this socket)? Unlisted means any.
    dialOK(G, mode) { const d = this.allow(G).dial; return !d || d.includes(mode); }
    socketOK(G, socket) { const s = this.allow(G).socket; return !s || s.includes(socket); }
    // The modes a controller board pin may be set to here (none: the pin is locked, or the board's program sets it).
    pinModes(G, id, pin) {
      const part = G.doc.get(id), p = this.allow(G).pins;
      if (!part || (part.program && part.program.out === pin)) return [];
      if (p) return p[pin] || [];
      return this.own(id) || listed(this.allow(G).ctl, id) ? ["INPUT", "LOW", "HIGH"] : [];
    }

    // How many parts of this kind are left in the tray: what the level gives, plus level parts taken off the board,
    // minus what the player has put on the board. Counted from the board, so Undo keeps it right.
    available(G, key) {
      let n = this.init.get(key) || 0;
      for (const [id, p] of this.start) if (!p.broken && keyOf(p) === key && !G.doc.get(id)) n++;     // a broken wire does not come back
      for (const p of G.doc.parts) if (this.own(p.id) && keyOf(p) === key) n--;
      return Math.max(n, 0);
    }
    // The hotbar: the level's tray, plus any level part the player has taken off the board.
    tray(G) {
      const keys = [...this.init.keys()];
      for (const [id, p] of this.start) if (!G.doc.get(id) && !p.broken && !keys.includes(keyOf(p)) && !["battery", "meter"].includes(p.type)) keys.push(keyOf(p));
      return keys.map((key) => Object.assign(itemOf(key), { key, n: this.available(G, key) }));
    }

    inRegion(pt) {
      const r = this.lv.region;
      if (!r || !pt) return true;
      if (pt.startsWith("U.")) return true;
      const p = BBShared.parse(pt);
      if (r.rows && (p.row < r.rows[0] || p.row > r.rows[1])) return false;
      if (p.kind === "rail") return r.rails === "all" || (r.rails === "top" && p.rail[1] === "T");
      return r.cols === "a-j" || "abcde".includes(p.col);
    }

    can(G, act) {
      const allow = this.allow(G);
      switch (act.kind) {
        case "hole": return this.inRegion(act.hole) ? OK : no("That part of the board is not open yet.");
        case "place": {
          if (allow.place === false) return no("Not yet. Follow Sparky first.");
          if (this.available(G, keyOf(act)) <= 0) return no(`No ${BB.Parts.name(Object.assign({ value: 330 }, act)).replace(/^Jumper wire$/, "wire")} left in the tray.`);
          return OK;
        }
        case "wire": {
          if (allow.place === false || allow.wire === false) return no("Not yet. Follow Sparky first.");
          if (this.available(G, "wire") <= 0) return no("No wire left. Take one off the board to use it again.");
          return OK;
        }
        case "body": return OK;                       // moving the battery pack or meter body changes nothing electrical
        case "ctl": {
          // the meter's dial and sockets: "mode:V" from a click, or key "mode" with a value from G.set
          const [key, val] = act.ctl.includes(":") ? act.ctl.split(":") : [act.ctl, act.value];
          if (key === "mode" && val !== undefined && !this.dialOK(G, val)) return no("Sparky has not shown you that one yet.");
          if (key === "socket" && val !== undefined && !this.socketOK(G, val)) return no("Leave the red lead where it is for now.");
          if (key === "program") return (G.doc.get(act.id) || {}).programs && this.allow(G).program !== false ? OK : no("The board's program stays as it is here.");
          if (key === "pin" && val !== undefined) {
            if (this.pinModes(G, act.id, val).length) return OK;
            const part = G.doc.get(act.id);
            return no(part && part.program && part.program.out === val ? "The board's program sets that pin, not you." : "Leave that pin alone for now.");
          }
        }
        // falls through
        case "replace":
          // a part that burned out can always be replaced, so no level can get stuck on a broken part
          if (act.kind === "replace" && G && G.sim && ((G.sim.rt.get(act.id) || {}).destroyed || (BB.Uno && BB.Uno.damaged(G.sim.rt.get(act.id))))) return OK;
        // falls through
        case "move": case "legs": case "remove": case "flip": case "probe": case "empty":
          if (this.own(act.id) || listed(allow[act.kind], act.id)) return OK;
          return no(FIXED[act.kind]);
        default: return OK;
      }
    }
  }

  // Would the meter blow its fuse right now? Set for mA (red lead in the mA socket), it is almost a wire.
  function meterOverload(doc, sim) {
    const m = doc.parts.find((p) => p.type === "meter");
    if (!m || m.socket !== "mA" || !m.legs[0] || !m.legs[1]) return false;
    const rt = sim.rt.get(m.id);
    if (rt && rt.destroyed) return false;
    sim.settle();
    return Math.abs((sim.read(m.id) || {}).Ishunt || 0) > BB.Devices.PARAMS.meter.fuseA;
  }

  BB.Rules = { LevelRules, keyOf, itemOf, partOf, meterOverload };
})(window.BB = window.BB || {});
