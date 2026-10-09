// Per-frame visual effects (glow, heat, smoke, meter LCD) and sound (pop, continuity beep).
(function (BB) {
  "use strict";
  const R = BB.Render;
  let smokeLayer, particles = [], audio = null, beepNode = null, muted = false;
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function init() {
    smokeLayer = R.el("g", { id: "L-smoke", "pointer-events": "none" });
    R.layers.ui.parentNode.insertBefore(smokeLayer, R.layers.ui);
  }

  function midOf(part) {
    const pts = part.legs.filter(Boolean).map((pt) => (pt.startsWith("U.") ? BB.Uno.socketXY(pt) : R.xy(pt)));
    if (!pts.length) return null;
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  }

  function puff(x, y, n = 1, dark = false) {
    if (reduced()) n = Math.min(n, 1);
    for (let k = 0; k < n; k++) {
      const useArt = BB.Art && BB.Art.has("smoke");
      const c = useArt
        ? R.el("image", { href: BB.Art.url("smoke"), x: x - 8, y: y - 8, width: 16, height: 16, opacity: 0.6, style: dark ? "filter:brightness(.35)" : null }, smokeLayer)
        : R.el("circle", { cx: x, cy: y, r: 4, fill: dark ? "#2a2522" : "#b9b4ad", opacity: 0.5 }, smokeLayer);
      particles.push({ c, x: x + (Math.random() - 0.5) * 8, y, vx: (Math.random() - 0.5) * 14, vy: -18 - Math.random() * 18, r: 4 + Math.random() * 3, life: 0, max: 2 + Math.random() * 1.5 });
    }
  }

  function burst(part) {
    const m = midOf(part);
    if (!m) return;
    puff(m[0], m[1], 14, true);
    const f = BB.Art && BB.Art.has("spark")
      ? R.el("image", { href: BB.Art.url("spark"), x: m[0] - 30, y: m[1] - 30, width: 60, height: 60, opacity: 1 }, smokeLayer)
      : R.el("circle", { cx: m[0], cy: m[1], r: 22, fill: "#fff3c4", opacity: 0.95, style: "mix-blend-mode:screen" }, smokeLayer);
    particles.push({ c: f, flash: true, life: 0, max: 0.25 });
    pop();
  }

  function fmtLcd(rd) {
    if (!rd) return ["", ""];
    if (rd.display) return [rd.display, rd.mode === "mA" ? "mA" : rd.mode === "V" ? "V⎓" : "Ω"];
    if (typeof rd.value !== "number" || Number.isNaN(rd.value)) return ["- - -", ""];
    if (rd.mode === "V") return [rd.value.toFixed(Math.abs(rd.value) < 10 ? 2 : 1), "V⎓"];
    if (rd.mode === "mA") { const v = rd.value * 1000; return [Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1), "mA"]; }
    const r = rd.value;
    if (r >= 1e6) return [(r / 1e6).toFixed(2), "MΩ"];
    if (r >= 1000) return [(r / 1000).toFixed(2), "kΩ"];
    return [r.toFixed(1), "Ω"];
  }

  function frame(doc, sim, dt) {
    let beeping = false;
    for (const part of doc.parts) {
      const r = R.refs.get(part.id), rt = sim.rt.get(part.id);
      if (!r || !rt) continue;
      const rd = sim.read(part.id);
      if (part.type === "led" && r.glow) {
        const I = rt.destroyed ? 0 : Math.max(rd.I, 0);
        const B = Math.min(Math.sqrt(I / 0.02), 1.8);
        r.glow.setAttribute("opacity", Math.min(B, 1) * 0.95);
        r.glow.setAttribute("r", 18 + 26 * Math.min(B, 1.8));
        r.glow.setAttribute("fill", I > 0.03 ? "url(#glowHot)" : r.glowFill || "url(#glow)");
        if (r.core) r.core.setAttribute("opacity", I > 0.03 ? Math.min((I - 0.03) / 0.05, 1) : 0);
      }
      if (part.type === "resistor" && r.heat && !rt.destroyed) {
        const h = rt.stress.heat.h;
        r.heat.setAttribute("opacity", Math.max(0, Math.min((h - 0.8) / 3.2, 0.85)));
      }
      if (part.type === "wire" && r.glow && !rt.destroyed) r.glow.setAttribute("opacity", Math.max(0, Math.min((Math.abs(rd.I) - 2) / 6, 0.9)));
      if (part.type === "uno" && r.onLed) {
        r.onLed.setAttribute("opacity", rd.powered ? 0.95 : 0);
        r.lLed.setAttribute("opacity", rd.powered && rd.pins.D13.V > 3 ? 0.95 : 0);
      }
      if (part.type === "meter" && r.lcd) {
        const [v, u] = fmtLcd(rd);
        r.lcd.textContent = v;
        r.lcdUnit.textContent = u;
        if (rd.beep) beeping = true;
      }
      // continuous smoke while a part is over its limit
      if (rt.level >= 2 && !rt.destroyed && Math.random() < dt * 6) { const m = midOf(part); if (m) puff(m[0], m[1]); }
    }
    beep(beeping);
    // particles
    particles = particles.filter((p) => {
      p.life += dt;
      if (p.life >= p.max) { p.c.remove(); return false; }
      const f = p.life / p.max;
      if (p.flash) { p.c.setAttribute("opacity", 0.95 * (1 - f)); if (p.c.tagName === "circle") p.c.setAttribute("r", 22 + 30 * f); return true; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += 10 * dt;
      if (p.c.tagName === "image") { const s = p.r * 4; p.c.setAttribute("x", p.x - s / 2); p.c.setAttribute("y", p.y - s / 2); p.c.setAttribute("width", s); p.c.setAttribute("height", s); }
      else { p.c.setAttribute("cx", p.x); p.c.setAttribute("cy", p.y); p.c.setAttribute("r", p.r); }
      p.c.setAttribute("opacity", 0.6 * (1 - f));
      return true;
    });
  }

  // ---------- sound ----------
  function ctx() {
    if (muted) return null;
    if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (audio.state === "suspended") audio.resume().catch(() => {});
    return audio;
  }
  function pop() {
    const a = ctx(); if (!a) return;
    const len = Math.floor(a.sampleRate * 0.18), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = "lowpass"; f.frequency.value = 1800; g.gain.value = 0.5;
    src.connect(f).connect(g).connect(a.destination); src.start();
  }
  function beep(on) {
    if (on && !beepNode) {
      const a = ctx(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain();
      o.type = "square"; o.frequency.value = 2700; g.gain.value = 0.03;
      o.connect(g).connect(a.destination); o.start();
      beepNode = { o, g };
    } else if (!on && beepNode) { beepNode.o.stop(); beepNode = null; }
  }
  function setMuted(m) { muted = m; if (m) beep(false); }
  function unlock() { ctx(); }

  BB.Effects = { init, frame, burst, setMuted, unlock, fmtLcd, midOf };
})(window.BB = window.BB || {});
