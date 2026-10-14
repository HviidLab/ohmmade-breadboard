// Coach: runs a level's beats. Each beat is one short mentor line, an optional highlight, and something to wait for:
// a Continue click, a prediction, an action by the player (an event), or a state of the circuit (`when`).
// Also the hint ladder, bonus objectives, plain-language messages for failures, and local telemetry. No DOM:
// the screen side (coachui.js) passes in `hooks`, and the tests pass in a stub.
//
// beat = { id, say: "text" | (coach) => "text", highlight, do: {xray}, allow: {...rules},
//          waitFor: {next: true, label} | {predict: true} | {event: "remove", id} | {when: (S, mem, coach) => bool, hold},
//          predict: {choices: [...], answer: k}, hints: [{say} | {highlight} | {show: [parts]}] }
// level.bonus = [{ text, when: (S, mem, coach) => bool } | { text, final: (coach) => bool }]
(function (BB) {
  "use strict";
  const HINT_AT = [15, 30, 45];          // seconds without a successful action before each hint step

  // Plain words for failures, for players who have not met the numbers yet.
  const PLAIN = {
    led: "Pop! The LED burned out: far too much current went through it.",
    resistor: "The resistor burned out: it got far too hot.",
    wire: "The wire melted! A short circuit sent a huge current through it.",
    battery: "The batteries overheated and leaked after a long short circuit.",
    meter: "Pop! The meter's fuse blew: set for mA, the meter is almost a wire. Click the meter to put in a new fuse.",
  };
  const SHORT = "Careful: that would join + straight to − with nothing in between. That is a short circuit, so I undid it.";
  const METER = "Careful: set for mA, the meter is almost a wire. There it would blow its fuse, so I undid it. More on that soon.";

  const noop = () => {};
  const HOOKS = ["say", "highlight", "ghost", "xray", "beat", "bonus", "aside"];

  class CoachRun {
    constructor(level, hooks = {}) {
      this.lv = level;
      this.h = {};
      for (const k of HOOKS) this.h[k] = hooks[k] || noop;
      this.i = -1;
      this.mem = {};                       // scratch memory of the current beat's `when`
      this.bmem = (level.bonus || []).map(() => ({}));
      this.bonus = (level.bonus || []).map(() => false);
      this.pred = {};                      // beat id -> chosen answer
      this.count = {};                     // event type -> how many times
      this.broken = new Set();             // types of parts that failed during this attempt
      this.t = 0; this.idle = 0; this.hint = 0; this.held = 0; this.beatT = 0;
      this.tele = [];                      // [{id, t, hints}] per beat
      this.finished = false;
    }
    get beat() { return this.lv.beats[this.i] || null; }
    get done() { return this.i >= this.lv.beats.length; }
    // Goals count from the last beat on (the beats before it teach; the last one is the puzzle or the wrap-up).
    get goalsOn() { return this.i >= (this.lv.goalsFrom ?? this.lv.beats.length - 1); }
    text(b) { return typeof b.say === "function" ? b.say(this) : b.say; }
    right(id) { const b = this.lv.beats.find((x) => x.id === id); return !!b && this.pred[id] === b.predict.answer; }

    start() { this.enter(0); }
    enter(i) {
      if (this.beat) this.tele.push({ id: this.beat.id || String(this.i), t: +this.beatT.toFixed(1), hints: this.hint });
      this.i = i; this.mem = {}; this.idle = 0; this.hint = 0; this.held = 0; this.beatT = 0; this.hintSay = null;
      this.h.ghost(null);
      if (this.done) { this.h.highlight(null); this.h.beat(null); return; }
      const b = this.beat;
      if (b.do && b.do.xray !== undefined) this.h.xray(b.do.xray);
      this.h.say(this.text(b), this.offer(b));
      this.h.highlight(b.highlight || null);
      this.h.beat(b);
    }
    // What the mentor bar offers under the line.
    offer(b) {
      return {
        next: b.waitFor.next ? b.waitFor.label || "Continue" : null,
        choices: b.waitFor.predict ? b.predict.choices : null,
        hints: (b.hints || []).length - this.hint,
      };
    }
    advance() { this.enter(this.i + 1); }

    // Every frame, with the same query object the goals use.
    step(S, dt) {
      this.t += dt;
      (this.lv.bonus || []).forEach((bn, k) => {
        if (this.bonus[k] || !bn.when) return;
        let ok = false;
        try { ok = !!bn.when(S, this.bmem[k], this); } catch (e) { ok = false; }
        if (ok) { this.bonus[k] = true; this.h.bonus(k); }
      });
      if (this.done) return;
      this.beatT += dt; this.idle += dt;
      const w = this.beat.waitFor;
      if (w.when) {
        let ok = false;
        try { ok = !!w.when(S, this.mem, this); } catch (e) { ok = false; }
        this.held = ok ? this.held + dt : 0;
        if (this.held >= (w.hold ?? 0.3)) { this.advance(); return; }
      }
      const hs = this.beat.hints || [];
      if (this.hint < hs.length && this.idle >= (hs[this.hint].after ?? HINT_AT[this.hint] ?? 60)) this.showHint();
    }
    showHint() {
      const b = this.beat, hs = (b && b.hints) || [];
      if (this.hint >= hs.length) return;
      const h = hs[this.hint++];
      if (h.say) this.hintSay = h.say;             // a hint's words stay up while later hints add marks or a ghost
      this.h.say(this.hintSay ? `${this.text(b)}\n${this.hintSay}` : this.text(b), this.offer(b));
      if (h.highlight) this.h.highlight([].concat(b.highlight || [], h.highlight));
      if (h.show) this.h.ghost(h.show);
    }

    // Something the player did: "place", "remove", "flip", "set", "replace", "undo", "move", "probe", "destroyed".
    emit(type, data = {}) {
      this.count[type] = (this.count[type] || 0) + 1;
      if (type !== "destroyed") this.idle = 0;
      const w = this.beat && this.beat.waitFor;
      if (w && w.event === type && (!w.id || w.id === data.id)) this.advance();
    }
    // Continue. On the last beat, `blocked` (from the game) can hold the player back while a goal is not met yet.
    next() {
      const b = this.beat;
      if (!b || !b.waitFor.next) return;
      const why = this.i === this.lv.beats.length - 1 && this.blocked ? this.blocked() : null;
      if (why) { this.h.say(this.text(b), this.offer(b)); this.h.aside && this.h.aside(why); return; }
      this.advance();
    }
    choose(k) {
      const b = this.beat;
      if (!b || !b.waitFor.predict) return;
      this.pred[b.id || String(this.i)] = k;
      this.idle = 0;
      this.advance();
    }

    // A part failed. Returns the plain message to show (null when the level's own beat says it).
    simEvent(ev, part) {
      if (ev.kind !== "destroyed" || !part) return null;
      this.broken.add(part.type);
      this.emit("destroyed", { id: part.id, type: part.type });
      const own = this.lv.simText || {};
      if (part.type in own) return own[part.type];
      return PLAIN[part.type] || "Something burned out.";
    }

    // The goals are done: settle the bonus objectives and the stars. Stars = 1 + bonus objectives earned.
    finish() {
      if (!this.finished) {
        (this.lv.bonus || []).forEach((bn, k) => { if (!this.bonus[k] && bn.final) { try { this.bonus[k] = !!bn.final(this); } catch (e) { this.bonus[k] = false; } } });
        this.finished = true;
        this.stars = 1 + this.bonus.filter(Boolean).length;
      }
      return { stars: this.stars, bonus: this.bonus.slice() };
    }
  }

  BB.Coach = { CoachRun, SHORT, METER, PLAIN, HINT_AT };
})(window.BB = window.BB || {});
