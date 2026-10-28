// Coach: runs a level's beats. Each beat is one short mentor line, an optional highlight, and something to wait for:
// a Continue click, a prediction, an action by the player (an event), or a state of the circuit (`when`).
// Also the hint ladder (only when the player presses Hint: never on a timer, so there is time to think), the stars and
// plain-language messages for failures. No DOM:
// the screen side (coachui.js) passes in `hooks`, and the tests pass in a stub.
//
// beat = { id, say: "text" | (coach) => "text", highlight, allow: {...rules},
//          waitFor: {next: true, label} | {predict: true} | {event: "remove", id} | {when: (S, mem, coach) => bool, hold},
//          predict: {choices: [...], answer: k, why: [line per wrong choice]}, reply: "p" (this beat answers prediction "p"),
//          hints: [{say} | {highlight} | {show: [parts]}] }
// A beat with `reply` opens with Sparky's answer to that prediction: "Right!" or "Not quite: " and the belief behind the
// wrong choice, said once, above the beat's own line. A beat's `note` is a "Real bench" safety line shown under it.
// Stars: ★1 the level is done; ★2 a clean build (nothing broke and no short circuit, except what level.demo allows:
// {led: 1, short: true}); ★3 the level's challenge: { text, when: (S, mem, coach) => bool, final: (coach, mem) => bool }.
// level.react = [{ when: (S, coach) => text | null, hold }]: Sparky remarks on a near miss (lit, but the wrong current;
// a series chain where separate loops were asked). Said once a state has lasted `hold` seconds; again after it changed.
(function (BB) {
  "use strict";

  // Plain words for failures, for players who have not met the numbers yet.
  const PLAIN = {
    led: "Pop! The LED burned out: far too much current went through it.",
    resistor: "The resistor burned out: it got far too hot.",
    wire: "The wire got so hot its insulation melted: far too much current went through it.",
    battery: "The batteries overheated in a short circuit. Click the battery pack for fresh ones.",
    meter: "The meter's fuse blew: on mA, the meter is almost a wire. A real one then just reads 0 mA. Click the meter for a new fuse.",
    uno: "A pin gave far too much current and is damaged. Click the board for a fresh one.",
  };
  const SHORT = "Careful: that would join + to − through only wire. That is a short circuit, so I undid it.";
  const METER = "Careful: set for mA, the meter is almost a wire. There it would blow its fuse, so I undid it. More on that soon.";

  const noop = () => {};
  const HOOKS = ["say", "highlight", "ghost", "beat", "challenge", "aside"];

  class CoachRun {
    constructor(level, hooks = {}) {
      this.lv = level;
      this.h = {};
      for (const k of HOOKS) this.h[k] = hooks[k] || noop;
      this.i = -1;
      this.mem = {};                       // scratch memory of the current beat's `when`
      this.chMem = {};                     // the challenge's scratch memory
      this.challenge = false;              // the challenge is met
      this.lost = {};                      // part type -> how many burned out (or blew, or were damaged)
      this.shortT = 0;                     // seconds of short circuit
      this.hintsUsed = 0;
      this.reacts = (level.react || []).map(() => ({ t: 0, said: null }));
      this.pred = {};                      // beat id -> chosen answer
      this.count = {};                     // event type -> how many times
      this.broken = new Set();             // types of parts that failed during this attempt
      this.t = 0; this.idle = 0; this.hint = 0; this.held = 0;
      this.finished = false;
    }
    get beat() { return this.lv.beats[this.i] || null; }
    get done() { return this.i >= this.lv.beats.length; }
    // Goals count from the last beat on (the beats before it teach; the last one is the puzzle or the wrap-up).
    get goalsOn() { return this.i >= (this.lv.goalsFrom ?? this.lv.beats.length - 1); }
    text(b) {
      const t = typeof b.say === "function" ? b.say(this) : b.say, star = this.starNote(b);
      return star ? `${t}\n${star}` : t;
    }
    // Sparky tells the player about stars still to win. On the first step (or the level's `starAt` step): a challenge
    // that has to be planned from the start (it is judged at the end: a first try, no hints, few wires). On the last
    // step: the challenge, if it can still be done now or was missed, and a lost clean build.
    starNote(b) {
      const ch = this.lv.challenge, beats = this.lv.beats, low = (s) => s.charAt(0).toLowerCase() + s.slice(1);
      if (ch && ch.final && b === (beats.find((x) => x.id === this.lv.starAt) || beats[0]) && beats.length > 1) return `★ For a third star, plan ahead: ${low(ch.text)}.`;
      if (b !== beats[beats.length - 1] || this.finished) return "";
      const out = [];
      if (ch && !this.challenge) {
        let will = false;
        if (ch.final) { try { will = !!ch.final(this, this.chMem); } catch (e) { will = false; } }
        if (!will) out.push(ch.final ? `★ Play again for one more star: ${low(ch.text)}.` : `★ One more star: ${low(ch.text)}. Try it now, or finish the level.`);
      }
      if (!this.clean) out.push("★ Play again without breaking anything for the clean-build star.");
      return out.join(" ");
    }
    right(id) { const b = this.lv.beats.find((x) => x.id === id); return !!b && this.pred[id] === b.predict.answer; }
    // Sparky's answer to prediction `id`: {ok, text}, or null if it was not asked.
    reply(id) {
      const b = this.lv.beats.find((x) => x.id === id);
      if (!b || this.pred[id] === undefined) return null;
      if (this.right(id)) return { ok: true, text: b.predict.ok || "Right!" };
      return { ok: false, text: `Not quite: ${(b.predict.why || [])[this.pred[id]] || ""}`.trim() };
    }

    start() { this.enter(0); }
    enter(i) {
      this.i = i; this.mem = {}; this.idle = 0; this.hint = 0; this.held = 0; this.hintSay = null;
      this.h.ghost(null);
      if (this.done) { this.h.highlight(null); this.h.beat(null); return; }
      const b = this.beat;
      this.h.say(this.text(b), this.offer(b));
      // a step where the player only reads or answers gets calm "look" marks; they show once the line is said
      this.h.highlight(b.highlight || null, { look: !!(b.waitFor.next || b.waitFor.predict), after: true });
      this.h.beat(b);
    }
    // What the mentor bar offers under the line.
    offer(b) {
      return {
        next: b.waitFor.next ? b.waitFor.label || "Continue" : null,
        choices: b.waitFor.predict ? b.predict.choices : null,
        reply: b.reply ? this.reply(b.reply) : null,
        note: b.note || null,
        hints: (b.hints || []).length - this.hint,
      };
    }
    advance() { this.enter(this.i + 1); }

    // Every frame, with the same query object the goals use.
    step(S, dt) {
      this.t += dt;
      if (!this.finished && S.shortNow && S.shortNow()) this.shortT += dt;
      const ch = this.lv.challenge;
      if (ch && ch.when && !this.challenge && !this.finished) {
        let ok = false;
        try { ok = !!ch.when(S, this.chMem, this); } catch (e) { ok = false; }
        if (ok) {
          this.challenge = true; this.h.challenge();
          if (this.beat === this.lv.beats[this.lv.beats.length - 1]) this.h.say(this.text(this.beat), this.offer(this.beat));    // the star note goes
        }
      }
      (this.lv.react || []).forEach((r, k) => {
        if (this.finished) return;
        let text = null;
        try { text = r.when(S, this) || null; } catch (e) { text = null; }
        const st = this.reacts[k];
        if (!text) { st.t = 0; st.said = null; return; }
        st.t += dt;
        if (st.t >= (r.hold ?? 1.5) && st.said !== text) { st.said = text; this.h.aside(text); }
      });
      if (this.done) return;
      this.idle += dt;
      const w = this.beat.waitFor;
      if (w.when) {
        let ok = false;
        try { ok = !!w.when(S, this.mem, this); } catch (e) { ok = false; }
        this.held = ok ? this.held + dt : 0;
        if (this.held >= (w.hold ?? 0.3)) { this.advance(); return; }
      }
    }
    showHint() {
      const b = this.beat, hs = (b && b.hints) || [];
      if (this.hint >= hs.length) return;
      const h = hs[this.hint++];
      this.hintsUsed++;
      if (h.say) this.hintSay = h.say;             // a hint's words stay up while later hints add marks or a ghost
      this.h.say(this.hintSay ? `${this.text(b)}\n${this.hintSay}` : this.text(b), this.offer(b));
      if (h.highlight) this.h.highlight([].concat(b.highlight || [], h.highlight));
      if (h.show) this.h.ghost(h.show);
    }

    // Something the player did: "place", "remove", "flip", "set", "replace", "undo", "move", "probe", "destroyed".
    emit(type, data = {}) {
      this.count[type] = (this.count[type] || 0) + 1;
      if (type !== "destroyed") this.idle = 0;
      if (type === "undo") this.probeStep = null;     // an undone probe move: the next one starts a fresh measurement again
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
      this.lost[part.type] = (this.lost[part.type] || 0) + 1;
      this.emit("destroyed", { id: part.id, type: part.type });
      const own = this.lv.simText || {};
      if (part.type in own) return own[part.type];
      return PLAIN[part.type] || "Something burned out.";
    }

    // A clean build so far: nothing broke beyond what the level breaks on purpose, and no short circuit (unless it is the lesson).
    get clean() {
      const d = this.lv.demo || {};
      if (Object.entries(this.lost).some(([type, n]) => n > (d[type] || 0))) return false;
      return !!d.short || this.shortT <= 0.5;
    }
    // The goals are done: settle the challenge and the stars.
    finish() {
      if (!this.finished) {
        const ch = this.lv.challenge;
        if (ch && ch.final && !this.challenge) { try { this.challenge = !!ch.final(this, this.chMem); } catch (e) { this.challenge = false; } }
        this.finished = true;
        this.wasClean = this.clean;
        this.stars = 1 + (this.wasClean ? 1 : 0) + (this.challenge ? 1 : 0);
      }
      return { stars: this.stars, clean: this.wasClean, challenge: this.challenge };
    }
  }

  // The words for the clean-build star.
  const cleanText = (lv) => (Object.keys(lv.demo || {}).some((k) => k !== "short") ? "Clean build: nothing else breaks" : "Clean build: nothing breaks, no short circuit");

  BB.Coach = { CoachRun, SHORT, METER, PLAIN, cleanText };
})(window.BB = window.BB || {});
