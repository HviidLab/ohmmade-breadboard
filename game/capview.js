// Inside the capacitor (Chapter 8): a panel beside the bench that shows what happens inside the can. Two plates with
// a gap of insulator between them; + charge piles up on one plate and − on the other as it fills, and the current
// flows in the legs (onto one plate, off the other) only while it fills or empties. No charge ever crosses the gap.
// It sits where the voltage staircase would (a level has one or the other). Levels switch it on with
// ui: { capView: "c1" } (that capacitor) or ui: { capView: true } (the first one on the board).
(function (BB) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const FULL = 6, NMAX = 7;              // the battery's 6 V fills it: then each plate shows NMAX charges
  const FLOW = 0.00015;                  // A: less than this is no current worth showing

  let on = false, want = null, lastKey = "", last = null;
  function enter(lv) {
    want = lv && lv.ui && lv.ui.capView;
    on = !!want;
    lastKey = ""; last = null;
    const box = $("capview");
    if (box) { box.hidden = !on; if (on) box.querySelector("svg").replaceChildren(); }
  }
  function leave() { on = false; const box = $("capview"); if (box) box.hidden = true; }

  // What the panel shows now: { n: charges per plate, sign: +1 when the + leg's plate holds the + charge, flow: -1|0|1 }.
  function state(S) {
    const caps = S.parts("cap"), q = typeof want === "string" ? caps.find((c) => c.id === want) : caps[0];
    if (!q) return null;
    if (!q.ok) return { dead: true };
    const vc = q.rd.Vc || 0, I = q.rd.I || 0;
    const n = Math.round(Math.min(Math.abs(vc) / FULL, 1) * NMAX);
    // I > 0: current flows in at the + leg. With the + plate charged, that is filling; the other way, emptying.
    const flow = Math.abs(I) < FLOW ? 0 : Math.sign(I);
    const fast = Math.abs(I) > 0.004 ? 2 : 1;
    return { n, sign: vc < 0 ? -1 : 1, flow, fast, filling: flow !== 0 && (n === 0 || Math.sign(I) === Math.sign(vc || I)) };
  }

  // Ten times a second: follow the capacitor, and draw when something changed.
  function tick(G) {
    if (!on) return;
    const st = state(BB.Goals.query(G)), key = JSON.stringify(st);
    if (key === lastKey) return;
    lastKey = key; last = st;
    draw(st);
  }
  function resized() { if (on) draw(last); }

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function draw(st) {
    const box = $("capview"), svg = box.querySelector("svg"), note = box.querySelector(".ld-note");
    const W = Math.max(svg.clientWidth, 160), H = Math.max(svg.clientHeight, 140);
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    if (!st) { el("text", { x: W / 2, y: H / 2, class: "ld-empty" }, svg, "No capacitor on the board yet."); note.textContent = ""; return; }
    if (st.dead) { el("text", { x: W / 2, y: H / 2, class: "ld-empty" }, svg, "This one has vented."); note.textContent = ""; return; }
    const cx = W / 2, gap = 34, pw = 9, top = 22, ph = Math.min(H - 70, 150), mid = top + ph / 2;
    const xl = cx - gap / 2 - pw, xr = cx + gap / 2;
    // the gap: insulator, and the words that say so
    el("rect", { x: cx - gap / 2, y: top, width: gap, height: ph, class: "cv-gap" }, svg);
    el("text", { x: cx, y: top + ph + 16, class: "cv-label" }, svg, "insulator");
    el("text", { x: cx, y: top + ph + 31, class: "cv-small" }, svg, "nothing crosses it");
    // the legs: wires from the plates out to each side, with the current (amber dots) only while it fills or empties
    const wl = [[xl, mid], [14, mid], [14, H - 10]], wr = [[xr + pw, mid], [W - 14, mid], [W - 14, H - 10]];
    const pts = (p) => p.map((q) => q.join(",")).join(" ");
    el("polyline", { points: pts(wl), class: "cv-wire" }, svg);
    el("polyline", { points: pts(wr), class: "cv-wire" }, svg);
    if (st.flow) {
      // conventional current: in at the + leg and out at the − leg when I > 0; the dots run along the wire's direction
      const inL = st.flow > 0, cls = `cv-flow${st.fast > 1 ? " fast" : ""}`;
      el("polyline", { points: pts(inL ? [...wl].reverse() : wl), class: cls }, svg);
      el("polyline", { points: pts(inL ? wr : [...wr].reverse()), class: cls }, svg);
    }
    el("text", { x: 22, y: mid - 8, class: "cv-leg pos", "text-anchor": "start" }, svg, "+ leg");
    el("text", { x: W - 22, y: mid - 8, class: "cv-leg neg", "text-anchor": "end" }, svg, "− leg");
    // the plates, and the charge on each: + on one, − on the other, facing each other across the gap
    el("rect", { x: xl, y: top, width: pw, height: ph, rx: 2, class: "cv-plate" }, svg);
    el("rect", { x: xr, y: top, width: pw, height: ph, rx: 2, class: "cv-plate" }, svg);
    const step = ph / (NMAX + 1);
    for (let k = 0; k < st.n; k++) {
      const y = top + step * (k + 1) + (NMAX - st.n) * step / 2;
      const [lp, rp] = st.sign > 0 ? ["+", "−"] : ["−", "+"];
      for (const [x, t] of [[xl + pw + 7, lp], [xr - 7, rp]]) {
        el("circle", { cx: x, cy: y, r: 6, class: t === "+" ? "cv-q pos" : "cv-q neg" }, svg);
        el("text", { x, y: y + 4, class: "cv-qt" }, svg, t);
      }
    }
    note.textContent = st.flow ? (st.filling ? "Filling: charge flows onto one plate and off the other." : "Emptying: the charge flows back round, outside the can.")
      : st.n ? "Holding its charge: no current flows." : "Empty: no charge on the plates.";
  }

  BB.CapView = { enter, leave, tick, resized, get on() { return on; } };
})(window.BB = window.BB || {});
