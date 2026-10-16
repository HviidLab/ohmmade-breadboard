// Goal evaluation: a query API over the running simulation, goal latching, stars, saved progress. No DOM.
(function (BB) {
  "use strict";
  const near = (x, want, rel) => Number.isFinite(x) && Math.abs(x - want) <= Math.abs(want) * rel;

  // Build the query object for the current instant.
  function query(G) {
    const sim = G.sim, doc = G.doc;
    const info = (p) => {
      const rt = sim.rt.get(p.id) || {};
      return { id: p.id, type: p.type, part: p, legs: p.legs, ok: !rt.destroyed, rt, rd: sim.read(p.id) || {}, nets: p.legs.map((l, k) => BB.netKey(l, p.id, k)) };
    };
    const all = doc.parts.map(info);
    // Strips joined by a wire are one node: a probe or a part in any of them counts the same.
    const up = new Map(), find = (x) => { while (up.has(x)) x = up.get(x); return x; };
    for (const q of all) if (q.type === "wire" && q.ok && !q.part.broken && q.nets[0] && q.nets[1]) { const a = find(q.nets[0]), b = find(q.nets[1]); if (a !== b) up.set(a, b); }
    const same = (a, b) => !!a && !!b && find(a) === find(b);
    const m = all.find((q) => q.type === "meter");
    const meter = m ? {
      ...m, mode: m.part.mode || "V", socket: m.part.socket || "VO", value: m.rd.value, display: m.rd.display, beep: !!m.rd.beep,
      fuseOK: m.rd.fuseOK, red: m.legs[0], com: m.legs[1],
    } : null;
    const S = {
      t: sim.t, all, meter, near, same,
      // a 2-leg part connects these two nodes (either way round)
      joins: (q, a, b) => !!q && ((same(q.nets[0], a) && same(q.nets[1], b)) || (same(q.nets[0], b) && same(q.nets[1], a))),
      // the voltage at a hole, against the battery's −
      v: (point) => sim.voltageAt(point),
      parts: (type) => all.filter((q) => q.type === type),
      first: (type) => all.find((q) => q.type === type),
      battery: () => all.find((q) => q.type === "battery"),
      batteryOn: () => all.some((q) => q.type === "battery" && q.part.on !== false && q.ok),
      // meter probes sit on the two nets of a 2-leg part (either order)
      across(p) {
        if (!meter || !p || !meter.red || !meter.com) return false;
        const a = BB.netKey(meter.red), b = BB.netKey(meter.com);
        return (same(a, p.nets[0]) && same(b, p.nets[1])) || (same(a, p.nets[1]) && same(b, p.nets[0]));
      },
      // meter in V mode shows this part's voltage
      readsVoltageOf(p, lo, hi) {
        if (!meter || !p || meter.mode !== "V" || meter.socket !== "VO" || meter.display || !meter.red || !meter.com) return false;
        const v = Math.abs(meter.value), pv = Math.abs(p.rd.V ?? 0);
        return v >= lo && v <= hi && Math.abs(v - pv) <= 0.03 * pv + 0.02;
      },
      // meter in mA mode, in series, carrying (about) the same current as this part
      readsCurrentOf(p, lo, hi, which = "I") {
        if (!meter || !p || meter.mode !== "mA" || meter.socket !== "mA" || !meter.fuseOK || meter.display) return false;
        const i = Math.abs(meter.value), pi = Math.abs(p.rd[which] ?? 0);
        return i >= lo && i <= hi && Math.abs(i - pi) <= 0.03 * pi + 2e-6;
      },
      meterV: (lo, hi) => !!meter && meter.mode === "V" && meter.socket === "VO" && !meter.display && meter.red && meter.com && meter.value >= lo && meter.value <= hi,
      probeOn: (k, netKeys) => !!meter && !!meter.legs[k] && netKeys.some((n) => same(n, BB.netKey(meter.legs[k]))),
      destroyed: (type) => all.some((q) => (!type || q.type === type) && !q.ok && q.type !== "meter"),
      shortNow: () => all.some((q) => q.type === "battery" && q.rd.short),
      uno: (() => {
        const u = all.find((q) => q.type === "uno");
        return {
          present: !!u, powered: !!u && u.rd.powered,
          pin: (n) => (u ? u.rd.pins[n] : null),
          analog: (n) => (u ? u.rd.analog[n] : null),
          floating: (n) => !!u && u.rd.pins[n].mode === "INPUT" && sim.solver.theveninR(u.rd.pins[n].node) > 1e7,
          read: (n) => (u ? BB.Uno.reading(sim, u.part, n).read : null),        // what the board reads on pin n (a floating pin flickers)
          mode: (n) => (u ? (u.part.pins || {})[n] || "INPUT" : null),
          damaged: () => !!u && Object.values(u.rd.pins).some((q) => q.damaged),
        };
      })(),
    };
    return S;
  }

  // Tracks one level attempt: goal latching. (The stars are settled by the coach.)
  class Run {
    constructor(level) {
      this.m = level;
      this.state = level.goals.map(() => ({ held: 0, done: false, mem: {} }));
      this.complete = false; this.t0 = null;
    }
    step(G, dt) {
      const S = query(G);
      if (this.t0 === null) this.t0 = S.t;
      S.since = S.t - this.t0;
      if (this.goalsOn !== false) this.m.goals.forEach((g, k) => {     // levels switch goals off while the coach is still teaching
        const st = this.state[k];
        if (st.done) return;
        let ok = false;
        try { ok = !!g.when(S, st.mem); } catch (e) { ok = false; }
        st.held = ok ? st.held + dt : 0;
        if (st.held >= (g.hold ?? 0.5)) st.done = true;
      });
      if (!this.complete && this.state.every((s) => s.done)) this.complete = true;
      return S;
    }
    nextOpen() { return this.state.findIndex((s) => !s.done); }
  }

  BB.Goals = { query, Run, near };
})(window.BB = window.BB || {});
