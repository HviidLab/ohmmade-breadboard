// Sim: compiles a document (parts with legs plugged into points) into a circuit, solves it over time,
// integrates damage and applies failures between steps. No DOM.
(function (BB) {
  "use strict";
  const { Circuit, Solver } = BB.Engine;
  const { Stress } = BB.Damage;
  const STEP = 1e-3;              // transient step (s) when the circuit has capacitors

  // Net key for a connection point. Breadboard holes use the shared strip/rail rule;
  // Uno sockets are "U.<name>"; null means a loose leg or probe.
  function netKey(point, partId, k) {
    if (!point) return `loose:${partId}:${k}`;
    if (point.startsWith("U.")) return BB.Uno ? BB.Uno.netOf(point) : point;
    return `bb:${BBShared.net(point)}`;
  }

  class Sim {
    constructor(doc) {
      this.doc = doc;                 // {parts: [...]}
      this.rt = new Map();            // part id -> runtime {destroyed, stress:{}, ...}
      this.t = 0;
      this.events = [];               // {t, partId, kind, text}
      this.compile();
    }

    runtime(part) {
      let rt = this.rt.get(part.id);
      if (!rt) {
        rt = { destroyed: false, stress: {}, cause: null };
        const spec = BB.Parts.TYPES[part.type].stresses;
        if (spec) for (const [k, o] of Object.entries(spec(part))) rt.stress[k] = new Stress(o);
        this.rt.set(part.id, rt);
      }
      return rt;
    }

    // Rebuild the circuit after any change to parts, legs or failures.
    compile() {
      if (this.handles) for (const h of this.handles.values()) if (h.save) h.save();
      const oldV = this.solver ? new Map(this.circuit.keys.map((k, i) => [k, this.solver.v[i]])) : null;
      const c = new Circuit();
      this.handles = new Map();
      this.nodeOf = new Map();
      for (const part of this.doc.parts) {
        const T = BB.Parts.TYPES[part.type];
        const nodes = part.legs.map((pt, k) => {
          const key = netKey(pt, part.id, k);
          const n = c.node(key);
          if (pt) this.nodeOf.set(pt, n);
          return n;
        });
        try { this.handles.set(part.id, T.build(c, nodes, part, this.runtime(part))); }
        catch (err) {                        // one broken part must not stop the whole circuit
          if (BB.reportError) BB.reportError(err, `building ${part.type} ${part.id}`);
          this.handles.set(part.id, { read: () => ({}) });
        }
      }
      for (const id of [...this.rt.keys()]) if (!this.doc.parts.some((p) => p.id === id)) this.rt.delete(id);
      this.circuit = c;
      this.solver = new Solver(c);
      if (oldV) c.keys.forEach((k, i) => { if (oldV.has(k) && !this.solver.isRef[i]) this.solver.v[i] = oldV.get(k); });   // references stay at 0 V
      this.dirty = true;
    }

    get v() { return this.solver.v; }

    // Mark parameters changed (knob, switch) without a topology change.
    touch() { this.solver.markDirty(); this.dirty = true; }

    // Change a part setting (knob position, button press, light level, switch) and rebuild.
    set(partId, key, value) {
      const part = this.doc.parts.find((p) => p.id === partId);
      if (!part || part[key] === value) return;
      part[key] = value;
      this.compile();
    }

    read(partId) { const h = this.handles.get(partId); return h ? h.read(this) : null; }

    // Voltage at a connection point vs its island reference; null when nothing is connected there.
    voltageAt(point) { const n = this.circuit.index.get(netKey(point)); return n === undefined ? null : this.solver.v[n]; }

    // Advance simulated time by dt seconds.
    advance(dt) {
      let left = dt, guard = 0;
      while (left > 1e-12 && guard++ < 1000000) {
        const dynamic = this.solver.dynamic.length > 0;
        const h = dynamic ? Math.min(STEP, left) : left;
        if (dynamic || this.dirty) { this.solver.solve(dynamic ? h : 0); this.dirty = false; }
        if (dynamic) this.solver.accept(h);
        const fail = this.integrate(h);
        if (fail) {
          this.t += fail.t;
          left -= fail.t;
          this.destroy(fail.part, fail.key);
          continue;
        }
        this.t += h;
        left -= h;
      }
    }

    // Integrate every stress over h. Returns the earliest failure inside h, if any.
    integrate(h) {
      let first = null;
      for (const part of this.doc.parts) {
        const rt = this.rt.get(part.id);
        if (rt.destroyed) continue;
        const keys = Object.keys(rt.stress);
        if (!keys.length) continue;
        const rd = this.read(part.id);
        const br = rt.broken || {};
        for (const k of keys) {
          const st = rt.stress[k];
          if (br[k]) {                       // a broken sub-element carries no stress; a resettable one cools down
            st.update(0, h);
            if (st.resettable && st.h < 0.5) { delete br[k]; this.events.push({ t: this.t, partId: part.id, kind: "reset", text: "The USB fuse has cooled down and reset. The board is powered again." }); this.compile(); return null; }
            continue;
          }
          const tf = st.update(st.x(rd), h);
          if (tf !== null && (!first || tf < first.t)) first = { t: Math.max(tf, 0), part, key: k };
        }
        rt.level = Math.max(0, ...keys.filter((q) => !br[q]).map((q) => rt.stress[q].level()));
      }
      return first;
    }

    destroy(part, key) {
      const rt = this.rt.get(part.id);
      if (rt.stress[key].sub) {               // one pin or the USB fuse, not the whole part
        rt.broken = rt.broken || {};
        rt.broken[key] = true;
        rt.stress[key].h = rt.stress[key].fail;      // it failed at the threshold, not at the end of the step
        const text = BB.Parts.TYPES[part.type].failText(part, rt, key);
        this.events.push({ t: this.t, partId: part.id, kind: key === "poly" ? "trip" : "destroyed", key, text });
        this.compile();
        return;
      }
      rt.destroyed = true;
      rt.cause = key;
      rt.level = 3;
      const text = BB.Parts.TYPES[part.type].failText(part, rt);
      this.events.push({ t: this.t, partId: part.id, kind: "destroyed", text });
      this.compile();
    }

    // Replace a damaged part with a fresh one.
    replace(partId) {
      const rt = this.rt.get(partId);
      if (!rt) return;
      rt.destroyed = false; rt.cause = null; rt.level = 0; rt.broken = {};
      for (const st of Object.values(rt.stress)) st.reset();
      this.compile();
    }
  }

  BB.Sim = Sim;
  BB.netKey = netKey;
})(window.BB = window.BB || {});
