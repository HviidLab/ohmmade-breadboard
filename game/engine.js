// Circuit solver: nodal analysis + Newton–Raphson, backward-Euler transient.
// Devices live in devices.js. The engine never touches the DOM.
(function (BB) {
  "use strict";

  const GMIN = 1e-12;
  const MAX_ITER = 60;

  // ---------- circuit ----------
  class Circuit {
    constructor() {
      this.keys = [];            // node index -> key (net name or "#internal")
      this.index = new Map();    // key -> node index
      this.devices = [];
      this.refPrio = new Map();  // node index -> priority as island reference (higher wins)
    }
    node(key) {
      if (!this.index.has(key)) { this.index.set(key, this.keys.length); this.keys.push(key); }
      return this.index.get(key);
    }
    internal(label) { this.keys.push(`#${label}`); return this.keys.length - 1; }
    add(dev) { this.devices.push(dev); return dev; }
    preferRef(node, prio) { this.refPrio.set(node, Math.max(prio, this.refPrio.get(node) || 0)); }
  }

  // ---------- stamping context ----------
  class Ctx {
    constructor(n, map) { this.n = n; this.map = map; this.A = new Float64Array(n * n); this.b = new Float64Array(n); this.srcScale = 1; this.limited = false; }
    // conductance g between nodes a and b
    g(a, b, g) {
      const A = this.A, n = this.n, ma = this.map[a], mb = this.map[b];
      if (ma >= 0) A[ma * n + ma] += g;
      if (mb >= 0) A[mb * n + mb] += g;
      if (ma >= 0 && mb >= 0) { A[ma * n + mb] -= g; A[mb * n + ma] -= g; }
    }
    // a fixed current i flowing through the element from node a to node b
    i(a, b, i) {
      const ma = this.map[a], mb = this.map[b];
      if (ma >= 0) this.b[ma] -= i;
      if (mb >= 0) this.b[mb] += i;
    }
    // Nonlinear branch current I0 from node x to node y, with partial derivatives
    // jac = [[node, dI/dV(node)], ...]. The companion current is I0 − Σ d·V at the linearisation
    // point: node voltages v, or `ieq` given directly by devices that limit junction voltages.
    branch(x, y, I0, jac, v, ieq) {
      const A = this.A, n = this.n, mx = this.map[x], my = this.map[y];
      const own = ieq === undefined;
      if (own) ieq = I0;
      for (const [node, d] of jac) {
        if (own) ieq -= d * v[node];
        const mn = this.map[node];
        if (mn < 0) continue;
        if (mx >= 0) A[mx * n + mn] += d;
        if (my >= 0) A[my * n + mn] -= d;
      }
      if (mx >= 0) this.b[mx] -= ieq;
      if (my >= 0) this.b[my] += ieq;
    }
  }

  // SPICE junction-voltage limiting. vt = n·Vt of the junction.
  function pnjlim(vnew, vold, vt, vcrit, ctx) {
    if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
      ctx.limited = true;
      if (vold > 0) {
        const arg = 1 + (vnew - vold) / vt;
        return arg > 0 ? vold + vt * Math.log(arg) : vcrit;
      }
      return vt * Math.log(vnew / vt);
    }
    return vnew;
  }

  // ---------- solver ----------
  class Solver {
    constructor(circuit) {
      this.c = circuit;
      const N = circuit.keys.length;
      this.N = N;
      // islands: union-find over the nodes of each device
      const parent = Array.from({ length: N }, (_, k) => k);
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      for (const d of circuit.devices) for (let k = 1; k < d.nodes.length; k++) {
        const a = find(d.nodes[0]), b = find(d.nodes[k]);
        if (a !== b) parent[a] = b;
      }
      const best = new Map();   // island root -> reference node
      for (let k = 0; k < N; k++) {
        const r = find(k), cur = best.get(r);
        const pk = circuit.refPrio.get(k) || 0, pc = cur === undefined ? -1 : (circuit.refPrio.get(cur) || 0);
        if (cur === undefined || pk > pc) best.set(r, k);
      }
      this.island = Array.from({ length: N }, (_, k) => find(k));
      this.ref = Array.from({ length: N }, (_, k) => best.get(this.island[k]));
      this.isRef = Array.from({ length: N }, (_, k) => this.ref[k] === k);
      this.map = new Int32Array(N);
      let n = 0;
      for (let k = 0; k < N; k++) this.map[k] = this.isRef[k] ? -1 : n++;
      this.n = n;
      this.ctx = new Ctx(n, this.map);
      this.linA = new Float64Array(n * n);
      this.linB = new Float64Array(n);
      this.v = new Float64Array(N);          // node voltages vs island reference
      this.nonlinear = circuit.devices.filter((d) => d.stamp);
      this.linear = circuit.devices.filter((d) => d.stampLinear);
      this.dynamic = circuit.devices.filter((d) => d.stampDynamic);
      this.linDirty = true;
      this.hiccup = false;
      this.iterations = 0;
    }

    markDirty() { this.linDirty = true; }

    buildLinear(srcScale) {
      const ctx = this.ctx;
      ctx.A.fill(0); ctx.b.fill(0); ctx.srcScale = srcScale;
      for (const d of this.linear) d.stampLinear(ctx);
      this.linA.set(ctx.A); this.linB.set(ctx.b);
      this.linScale = srcScale;
      this.linDirty = false;
    }

    // One Newton solve. h > 0 means a transient step of h seconds.
    newton(h, gmin, srcScale, maxIter) {
      const { ctx, n, N, map } = this;
      if (this.linDirty || this.linScale !== srcScale) this.buildLinear(srcScale);
      const v = this.v, x = new Float64Array(n);
      for (let it = 0; it < maxIter; it++) {
        ctx.A.set(this.linA); ctx.b.set(this.linB);
        ctx.srcScale = srcScale; ctx.limited = false;
        if (h > 0) for (const d of this.dynamic) d.stampDynamic(ctx, h);
        for (const d of this.nonlinear) d.stamp(ctx, v);
        for (let k = 0; k < n; k++) ctx.A[k * n + k] += gmin;
        x.set(ctx.b);
        if (!BB.LinAlg.solve(ctx.A, x, n)) return false;
        let conv = !ctx.limited, maxd = 0;
        for (let k = 0; k < N; k++) {
          const m = map[k];
          if (m < 0) continue;
          let nv = x[m];
          if (!Number.isFinite(nv)) return false;
          let dv = nv - v[k];
          if (dv > 2) dv = 2; else if (dv < -2) dv = -2;   // per-iteration step limit
          if (Math.abs(dv) > 1e-6 + 1e-3 * Math.abs(v[k])) conv = false;
          maxd = Math.max(maxd, Math.abs(dv));
          v[k] += dv;
        }
        this.iterations = it + 1;
        if (conv && it > 0) return true;
      }
      return false;
    }

    // Robust solve: plain Newton, then gmin stepping, then source stepping.
    solve(h = 0) {
      const saved = Float64Array.from(this.v);
      this.hiccup = false;
      if (this.n === 0) return true;
      if (this.newton(h, GMIN, 1, MAX_ITER)) return true;
      this.v.set(saved);
      let ok = true;
      for (let g = 1e-2; g >= GMIN * 0.99; g /= 10) if (!this.newton(h, g, 1, MAX_ITER)) { ok = false; break; }
      if (ok && this.newton(h, GMIN, 1, MAX_ITER)) return true;
      this.v.fill(0);
      ok = true;
      for (let s = 0.1; s <= 1.0001; s += 0.1) if (!this.newton(h, GMIN, Math.min(s, 1), MAX_ITER)) { ok = false; break; }
      if (ok) return true;
      this.v.set(saved);
      this.hiccup = true;
      return false;
    }

    // Accept a transient step: capacitors store their new voltage.
    accept(h) { for (const d of this.dynamic) d.accept(this.v, h); }

    // Voltage of node k against its island reference (0 for references).
    V(k) { return this.v[k]; }

    // Thevenin resistance seen at node k (inject 1 nA, re-solve linearised). Large = floating.
    theveninR(k) {
      if (this.isRef[k]) return 0;
      const { ctx, n } = this;
      ctx.A.set(this.linA); ctx.b.fill(0); ctx.limited = false;
      const dummy = new Ctx(n, this.map); dummy.A = ctx.A; dummy.b = new Float64Array(n);
      for (const d of this.nonlinear) d.stamp(dummy, this.v);   // adds the linearised conductances
      for (let i = 0; i < n; i++) ctx.A[i * n + i] += GMIN;
      const x = new Float64Array(n); x[this.map[k]] = 1e-9;
      if (!BB.LinAlg.solve(ctx.A, x, n)) return Infinity;
      return x[this.map[k]] / 1e-9;
    }
  }

  BB.Engine = { Circuit, Solver, pnjlim, GMIN, VT: 0.025852 };
})(window.BB = window.BB || {});
