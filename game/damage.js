// Damage: a first-order "heat" integrator per stress, with an OK → STRESSED → SMOKING → DESTROYED state machine.
// Steady state s = r (power-like) or r² (current-like), where r = |x| / rated. dh/dt = (s − h)/tau.
(function (BB) {
  "use strict";

  const STATES = ["ok", "stressed", "smoking", "destroyed"];

  class Stress {
    // opts: {rated, tau, square, smoke, fail, what}
    constructor(opts) { Object.assign(this, { smoke: Infinity, fail: Infinity, square: true }, opts); this.h = 0; this.peak = 0; }
    reset() { this.h = 0; this.peak = 0; }
    // Advance by dt seconds with stress quantity x. Returns the failure time inside dt (seconds) or null.
    update(x, dt) {
      const r = Math.abs(x) / this.rated, s = this.square ? r * r : r;
      const h0 = this.h, h1 = s + (h0 - s) * Math.exp(-dt / this.tau);
      this.h = h1; this.last = x; this.peak = Math.max(this.peak, Math.abs(x));
      if (h0 < this.fail && h1 >= this.fail) return this.tau * Math.log((s - h0) / (s - this.fail));
      return null;
    }
    level() {
      if (this.h >= this.fail) return 3;
      if (this.h >= this.smoke) return 2;
      if (this.h > 1) return 1;
      return 0;
    }
  }

  BB.Damage = { Stress, STATES };
})(window.BB = window.BB || {});
