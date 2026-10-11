// Rules of a level: which parts may be moved, flipped, removed or switched, what is in the parts tray,
// and which holes are open. No DOM. In the sandbox and the classic missions there are no rules (G.rules is null).
//
// level.rules = {
//   tray: [{type: "wire", n: 1}, {type: "resistor", value: 330, n: 1}, {type: "led", color: "green", n: 1}],
//   allow: {move, legs, remove, flip, ctl, replace: [ids] or "*", place: false, wire: false},
//   guardShorts: true,       // undo any move that joins + straight to −, and explain
// }
// level.region = {rows: [1, 16], cols: "a-e" | "a-j", rails: "none" | "top" | "all"}
// A coach beat may add its own `allow`, which is merged over the level's while that beat is active.
// Parts the player put on the board are always theirs to move, flip and remove.
(function (BB) {
  "use strict";
  const OK = { ok: true };
  const no = (say) => ({ ok: false, say });
  const listed = (v, id) => v === "*" || (Array.isArray(v) && v.includes(id));

  // Parts of the same kind share a tray slot: all wires; resistors by value; LEDs by colour.
  function keyOf(p) {
    if (p.type === "resistor") return `resistor:${p.value}`;
    if (p.type === "led") return `led:${p.color || "red"}`;
    return p.type;
  }
  function itemOf(key) {
    const [type, x] = key.split(":");
    if (type === "resistor") return { type, value: +x };
    if (type === "led") return { type, color: x };
    return { type };
  }

  const FIXED = {
    move: "This part is fixed in this level.",
    legs: "This part is fixed in this level.",
    remove: "This part has to stay on the board for now.",
    flip: "Not this one: it is fine the way it is.",
    ctl: "Leave that alone for now.",
    replace: "Not now.",
    probe: "Not now.",
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

    // How many parts of this kind are left in the tray: what the level gives, plus level parts taken off the board,
    // minus what the player has put on the board. Counted from the board, so Undo keeps it right.
    available(G, key) {
      let n = this.init.get(key) || 0;
      for (const [id, p] of this.start) if (keyOf(p) === key && !G.doc.get(id)) n++;
      for (const p of G.doc.parts) if (this.own(p.id) && keyOf(p) === key) n--;
      return Math.max(n, 0);
    }
    // The hotbar: the level's tray, plus any level part the player has taken off the board.
    tray(G) {
      const keys = [...this.init.keys()];
      for (const [id, p] of this.start) if (!G.doc.get(id) && !keys.includes(keyOf(p)) && !["battery", "meter"].includes(p.type)) keys.push(keyOf(p));
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
          if (this.available(G, "wire") <= 0) return no("No wires left in the tray. Take one off the board to reuse it.");
          return OK;
        }
        case "body": return OK;                       // moving the battery pack or meter body changes nothing electrical
        case "move": case "legs": case "remove": case "flip": case "ctl": case "replace": case "probe":
          if (this.own(act.id) || listed(allow[act.kind], act.id)) return OK;
          return no(FIXED[act.kind]);
        default: return OK;
      }
    }
  }

  BB.Rules = { LevelRules, keyOf, itemOf };
})(window.BB = window.BB || {});
