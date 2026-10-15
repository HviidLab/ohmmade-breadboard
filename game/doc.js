// Document model: which parts exist and where their legs are plugged in. No DOM.
// Placement rules per part kind, hole occupancy, undo/redo, serialisation.
(function (BB) {
  "use strict";
  const COLS = ["+T", "-T", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "+B", "-B"];
  const ROWS = 63;

  // Grid position of a breadboard point: {row, col} with col an index into COLS.
  function grid(point) {
    if (!point || point.startsWith("U.")) return null;
    const p = BBShared.parse(point);
    return { row: p.row, col: COLS.indexOf(p.kind === "rail" ? p.rail : p.col) };
  }
  function point(row, col) {
    if (row < 1 || row > ROWS || col < 0 || col >= COLS.length) return null;
    const c = COLS[col];
    return c.length === 2 ? `${c}${row}` : `${c}${row}`;
  }
  const isStrip = (pt) => pt && /^[a-j]\d+$/.test(pt);
  const span = (a, b) => { const g = grid(a), h = grid(b); return g && h ? Math.max(Math.abs(g.row - h.row), Math.abs(g.col - h.col)) : 0; };

  const MAXSPAN = { resistor: 12, ldr: 8, led: 3, cap: 3, wire: 99, battery: 99 };

  // Default leg positions when a part is dropped with leg 0 at `pt`. Returns null if impossible.
  function footprint(type, pt, rot = 0) {
    const g = grid(pt);
    if (!g) return null;
    const P = (dr, dc = 0) => point(g.row + (rot ? -dr : dr), g.col + dc);
    switch (type) {
      case "resistor": return [pt, P(4)];
      case "wire": return [pt, P(3)];
      case "ldr": return [pt, P(2)];
      case "led": case "cap": return [pt, P(1)];
      case "pot": case "npn": return [pt, P(1), P(2)];
      case "button": {
        const e = COLS.indexOf("e");
        return [point(g.row, e), point(g.row, e + 1), point(g.row + 2, e), point(g.row + 2, e + 1)];
      }
      default: return null;
    }
  }

  class Doc {
    constructor(data) {
      this.parts = [];
      this.nextId = 1;
      this.undoStack = [];
      this.redoStack = [];
      if (data) this.load(data);
    }
    serialize() { return JSON.stringify({ parts: this.parts, nextId: this.nextId }); }
    load(data) {
      const d = typeof data === "string" ? JSON.parse(data) : data;
      this.parts = d.parts || [];
      this.nextId = d.nextId || this.parts.length + 1;
    }
    // `pending`: the top snapshot belongs to the action going on now, so a guard may take that action back (and only that).
    snapshot() { this.undoStack.push(this.serialize()); if (this.undoStack.length > 100) this.undoStack.shift(); this.redo0 = this.redoStack; this.redoStack = []; this.pending = true; }
    // The action changed nothing after all: forget its snapshot and keep Redo.
    unsnapshot() { if (!this.pending) return; this.undoStack.pop(); this.redoStack = this.redo0 || []; this.pending = false; }
    undo() { if (!this.undoStack.length) return false; this.redoStack.push(this.serialize()); this.load(this.undoStack.pop()); this.pending = false; return true; }
    redo() { if (!this.redoStack.length) return false; this.undoStack.push(this.serialize()); this.load(this.redoStack.pop()); this.pending = false; return true; }

    get(id) { return this.parts.find((p) => p.id === id); }

    // Map point -> {id, leg} for every plugged leg except meter probes (probes clip on).
    occupancy(exceptId) {
      const occ = new Map();
      for (const p of this.parts) {
        if (p.id === exceptId || p.type === "meter") continue;
        p.legs.forEach((pt, k) => { if (pt) occ.set(pt, { id: p.id, leg: k }); });
      }
      return occ;
    }

    // Check whether legs are a valid placement for a part of `type` (ignoring part `exceptId`).
    validate(type, legs, exceptId) {
      if (type === "meter") return { ok: true };
      if (legs.some((l) => l === null || l === undefined)) return { ok: false, why: "Drop it right on the board's holes." };
      if (new Set(legs).size !== legs.length) return { ok: false, why: "Two legs in the same hole." };
      const occ = this.occupancy(exceptId);
      const busy = legs.find((l) => occ.has(l));
      if (busy) return { ok: false, why: `Hole ${busy} is already in use.` };
      if (legs.every((l) => !l.startsWith("U.")) && legs.length === 2 && MAXSPAN[type] !== undefined) {
        const s = span(legs[0], legs[1]);
        if (s > MAXSPAN[type]) return { ok: false, why: "The legs do not reach that far." };
      }
      if ((type === "pot" || type === "npn") && !legs.every(isStrip)) return { ok: false, why: "Put it in the main strips, not the rails." };
      if (type === "button") {
        const cols = legs.map((l) => (l.startsWith("U.") ? "" : BBShared.parse(l).col));
        if (cols.join() !== "e,f,e,f") return { ok: false, why: "A push button sits across the centre gap." };
      }
      return { ok: true };
    }

    add(part) {
      part.id = part.id || `${part.type}${this.nextId++}`;
      this.parts.push(part);
      return part;
    }
    remove(id) { this.parts = this.parts.filter((p) => p.id !== id); }
  }

  BB.Doc = Doc;
  BB.Grid = { COLS, ROWS, grid, point, isStrip, span, footprint, MAXSPAN };
})(window.BB = window.BB || {});
