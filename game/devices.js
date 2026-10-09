// Device models. Each device has `nodes` (for island grouping) and one or more of:
//   stampLinear(ctx)          constant part (resistors, sources)
//   stamp(ctx, v)             nonlinear companion at node voltages v
//   stampDynamic(ctx, h)      transient companion (capacitors), accept(v, h) after a step
//   current(v)                the device's main current, for readouts
(function (BB) {
  "use strict";
  const { pnjlim, VT } = BB.Engine;

  // All tunable constants in one place.
  const PARAMS = {
    battery: { emf: 6.0, rint: 0.5 },
    wire: { r: 0.02 },
    led: { vf: 2.0, iAt: 0.012, n: 2.0, rs: 5, bv: 12, imax: 0.02 },
    // Typical 5 mm starter-kit LEDs: forward voltage at 12 mA. Blue and white (InGaN) also have more series resistance.
    ledColors: {
      red: { vf: 2.0 }, yellow: { vf: 2.1 }, green: { vf: 2.2 }, blue: { vf: 3.0, rs: 10 }, white: { vf: 3.1, rs: 10 },
    },
    meter: { rV: 10e6, rShunt: 1.0, fuseA: 0.2, ohmV: 3.0, ohmR: 1000 },
    cap: { leak: 10e6, revKnee: 1.0, revRs: 20, esr: { 1e-3: 0.1, 1e-4: 0.3, 1e-5: 1.0 } },
    npn: { is: 1e-14, bf: 200, br: 5, rb: 10, rc: 5, re: 0.5 },
    pot: { r: 10000, rmin: 0.5 },
    button: { rPair: 0.05, rPressed: 0.1 },
    ldr: { r10: 15000, gamma: 0.7, rmax: 1e6 },
    uno: { v5: 5.0, r5: 0.2, v33: 3.3, r33: 0.5, rPin: 40, rIn: 100e6, clampIs: 1e-12 },
  };
  // LED saturation current, calibrated so that V = vf at iAt.
  const calibrate = (p) => Object.assign(p, { is: p.iAt / (Math.exp((p.vf - p.iAt * p.rs) / (p.n * VT)) - 1) });
  const L = calibrate(PARAMS.led);
  // Model parameters for an LED colour (red when unknown).
  const ledCache = new Map();
  function ledParams(color) {
    const c = PARAMS.ledColors[color] ? color : "red";
    if (!ledCache.has(c)) ledCache.set(c, calibrate(Object.assign({ color: c }, PARAMS.led, PARAMS.ledColors[c])));
    return ledCache.get(c);
  }

  // ---------- linear ----------
  class Resistor {
    constructor(a, b, r) { this.nodes = [a, b]; this.r = r; }
    stampLinear(ctx) { if (this.r < Infinity) ctx.g(this.nodes[0], this.nodes[1], 1 / this.r); }
    current(v) { return this.r < Infinity ? (v[this.nodes[0]] - v[this.nodes[1]]) / this.r : 0; }
  }

  // EMF with internal resistance (Norton form). Current flows out of `pos` through the load.
  class Source {
    constructor(pos, neg, emf, r) { this.nodes = [pos, neg]; this.emf = emf; this.r = r; this.on = true; }
    stampLinear(ctx) {
      if (!this.on) return;
      const [p, n] = this.nodes;
      ctx.g(p, n, 1 / this.r);
      ctx.i(n, p, (this.emf * ctx.srcScale) / this.r);
    }
    // current delivered out of the + terminal
    current(v) { return this.on ? (this.emf - (v[this.nodes[0]] - v[this.nodes[1]])) / this.r : 0; }
  }

  // ---------- junctions ----------
  // Ideal exponential junction from a to k with optional reverse breakdown.
  class Junction {
    constructor(a, k, is, n, bv = Infinity) {
      this.nodes = [a, k]; this.is = is; this.nvt = n * VT; this.bv = bv;
      this.vcrit = this.nvt * Math.log(this.nvt / (Math.SQRT2 * is));
      this.vd = 0; this.vr = 0;
    }
    stamp(ctx, v) {
      const [a, k] = this.nodes, nvt = this.nvt;
      let vd = pnjlim(v[a] - v[k], this.vd, nvt, this.vcrit, ctx);
      this.vd = vd;
      const e = Math.exp(Math.min(vd / nvt, 80));
      let I = this.is * (e - 1), G = (this.is / nvt) * e + BB.Engine.GMIN;
      if (this.bv < Infinity) {          // breakdown: mirrored junction at -bv
        let vr = pnjlim(-vd - this.bv, this.vr, nvt, this.vcrit, ctx);
        this.vr = vr;
        const er = Math.exp(Math.min(vr / nvt, 80));
        I -= this.is * er; G += (this.is / nvt) * er;
      }
      ctx.branch(a, k, I, [[a, G], [k, -G]], v, I - G * vd);
      this.I = I;
    }
    current() { return this.I || 0; }
  }

  // LED: series resistance + junction (+ breakdown). Built from simpler devices.
  function led(circuit, anode, cathode, p = PARAMS.led) {
    const mid = circuit.internal("led");
    const rs = circuit.add(new Resistor(anode, mid, p.rs));
    const j = circuit.add(new Junction(mid, cathode, p.is, p.n, p.bv));
    return { rs, j, current: (v) => rs.current(v), voltage: (v) => v[anode] - v[cathode] };
  }

  // ---------- capacitor (backward Euler) ----------
  class Capacitor {
    constructor(a, b, c) { this.nodes = [a, b]; this.c = c; this.vc = 0; }
    stampDynamic(ctx, h) {
      const g = this.c / h, [a, b] = this.nodes;
      ctx.g(a, b, g);
      ctx.i(b, a, g * this.vc);     // history current
    }
    accept(v, h) { this.vc = v[this.nodes[0]] - v[this.nodes[1]]; }
    current(v, h) { return h ? (this.c / h) * ((v[this.nodes[0]] - v[this.nodes[1]]) - this.vc) : 0; }
  }

  // ---------- NPN, Ebers–Moll transport model ----------
  class NPN {
    constructor(b, c, e, p = PARAMS.npn) {
      this.nodes = [b, c, e]; this.p = p;
      this.nvt = VT; this.vcrit = VT * Math.log(VT / (Math.SQRT2 * p.is));
      this.vbe = 0; this.vbc = 0;
    }
    stamp(ctx, v) {
      const [b, c, e] = this.nodes, p = this.p, vt = this.nvt;
      const vbe = (this.vbe = pnjlim(v[b] - v[e], this.vbe, vt, this.vcrit, ctx));
      const vbc = (this.vbc = pnjlim(v[b] - v[c], this.vbc, vt, this.vcrit, ctx));
      const ebe = Math.exp(Math.min(vbe / vt, 80)), ebc = Math.exp(Math.min(vbc / vt, 80));
      const gbe = (p.is / vt) * ebe, gbc = (p.is / vt) * ebc;
      // transport current c -> e
      const ict = p.is * (ebe - ebc);
      ctx.branch(c, e, ict, [[b, gbe - gbc], [e, -gbe], [c, gbc]], v, ict - gbe * vbe + gbc * vbc);
      // base-emitter and base-collector diodes
      const ibe = (p.is / p.bf) * (ebe - 1), ibc = (p.is / p.br) * (ebc - 1);
      const g1 = gbe / p.bf + BB.Engine.GMIN, g2 = gbc / p.br + BB.Engine.GMIN;
      ctx.branch(b, e, ibe, [[b, g1], [e, -g1]], v, ibe - g1 * vbe);
      ctx.branch(b, c, ibc, [[b, g2], [c, -g2]], v, ibc - g2 * vbc);
      this.ib = ibe + ibc; this.ic = ict - ibc;
    }
  }
  function npn(circuit, b, c, e, p = PARAMS.npn) {
    const bi = circuit.internal("b"), ci = circuit.internal("c"), ei = circuit.internal("e");
    const rb = circuit.add(new Resistor(b, bi, p.rb));
    const rc = circuit.add(new Resistor(c, ci, p.rc));
    const re = circuit.add(new Resistor(e, ei, p.re));
    const q = circuit.add(new NPN(bi, ci, ei, p));
    return { q, rb, rc, re, ib: (v) => rb.current(v), ic: (v) => rc.current(v) };
  }

  // ---------- current-limited source (Arduino supplies and pins) ----------
  // I = ilim·tanh((vset − V)/(r·ilim)), out of `pos`.
  class LimitedSource {
    constructor(pos, neg, vset, r, ilim) { this.nodes = [pos, neg]; this.vset = vset; this.r = r; this.ilim = ilim; this.on = true; }
    stamp(ctx, v) {
      const [p, n] = this.nodes;
      if (!this.on) return;
      const vs = this.vset * ctx.srcScale, x = (vs - (v[p] - v[n])) / (this.r * this.ilim);
      const t = Math.tanh(Math.max(-20, Math.min(20, x)));
      const I = this.ilim * t, dIdV = -(1 - t * t) / this.r;   // dI/d(Vp−Vn)
      // current flows from n to p through the source
      ctx.branch(n, p, I, [[p, dIdV], [n, -dIdV]], v);
      this.I = I;
    }
    current() { return this.on ? this.I || 0 : 0; }
  }

  BB.Devices = { PARAMS, ledParams, Resistor, Source, Junction, led, Capacitor, NPN, npn, LimitedSource };
})(window.BB = window.BB || {});
