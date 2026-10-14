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
    circuitSounds(doc, sim, dt);
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
        if (r.shine) r.shine.setAttribute("opacity", Math.min(B, 1) * 0.75);       // the dome itself lights up
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
  // ---------- putting parts into the breadboard, and pulling them out ----------
  // Each leg makes a small click as it goes into a hole's spring clip; then the body knocks with its own material.
  // tick: centre of the click (Hz); knock: body tone (Hz, 0 = none); kq: how ringing the knock is; g: loudness.
  const MAT = {
    resistor: { tick: 3400, knock: 430, kq: 7, g: 1 },        // ceramic body: bright, dry
    led: { tick: 3900, knock: 980, kq: 9, g: 0.9 },           // plastic dome: light, higher
    wire: { tick: 2700, knock: 0, g: 0.6 },                   // just a soft tick
    cap: { tick: 3000, knock: 250, kq: 5, g: 1.1 },           // metal can: deeper, rounder
    pot: { tick: 3200, knock: 330, kq: 6, g: 1.05 },
    npn: { tick: 3700, knock: 720, kq: 8, g: 0.9 },
    button: { tick: 3000, knock: 520, kq: 6, g: 1 },
    ldr: { tick: 3500, knock: 840, kq: 9, g: 0.85 },
    battery: { tick: 2400, knock: 300, kq: 5, g: 1.05 },      // a lead into a rail: heavier
    meter: { tick: 5200, knock: 2600, kq: 30, g: 0.7 },       // probe tip: a metallic tink
    uno: { tick: 3000, knock: 400, kq: 6, g: 1 },
  };
  let noiseBuf = null, played = { in: 0, out: 0, jingle: 0, connect: 0, disconnect: 0, crackle: 0 };
  function noise(a) {
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * 0.25), a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = a.createBufferSource();
    src.buffer = noiseBuf;
    return src;
  }
  const vary = (x, r = 0.06) => x * (1 + (Math.random() * 2 - 1) * r);
  // A filtered noise burst: the click of a leg (up = a rising "schk" for pulling out).
  function click(a, t, f, gain, up) {
    const n = noise(a), bp = a.createBiquadFilter(), g = a.createGain(), dur = up ? 0.045 : 0.018;
    bp.type = "bandpass"; bp.Q.value = up ? 2.2 : 1.3;
    bp.frequency.setValueAtTime(up ? f * 0.55 : f, t);
    if (up) bp.frequency.exponentialRampToValueAtTime(f * 1.35, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g).connect(a.destination); n.start(t, Math.random() * 0.15, dur + 0.01);
  }
  // A short tone: the body's knock (or the little pop when a part comes free).
  function tone(a, t, f, gain, dur, to) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  // `legs` = how many legs go into holes. Clicks are a few milliseconds apart, as legs never go in at once.
  function insert(type, legs = 2) {
    played.in++;
    const a = ctx(); if (!a) return;
    const m = MAT[type] || MAT.resistor, t0 = a.currentTime + 0.005, n = Math.max(1, Math.min(legs, 4));
    for (let k = 0; k < n; k++) click(a, t0 + k * vary(0.026, 0.3), vary(m.tick), 0.16 * m.g, false);
    if (m.knock) tone(a, t0 + (n - 1) * 0.026 + 0.008, vary(m.knock, 0.04), 0.07 * m.g, 0.012 * m.kq);
  }
  function extract(type, legs = 2) {
    played.out++;
    const a = ctx(); if (!a) return;
    const m = MAT[type] || MAT.resistor, t0 = a.currentTime + 0.005, n = Math.max(1, Math.min(legs, 4));
    for (let k = 0; k < n; k++) click(a, t0 + k * vary(0.03, 0.3), vary(m.tick * 0.8), 0.1 * m.g, true);
    tone(a, t0 + (n - 1) * 0.03 + 0.03, vary(320), 0.035 * m.g, 0.05, 820);
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
  // A short rising chime: n notes (1 for a bonus star, 3 for a finished level).
  function chime(n = 1) {
    const a = ctx(); if (!a) return;
    const notes = [880, 1108.7, 1318.5].slice(0, Math.max(1, n));
    notes.forEach((f, k) => {
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + k * 0.11;
      o.type = "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.55);
    });
  }
  // Sparky's voice: one short pitched syllable. The pitch comes from the letter (so a word always sounds the same),
  // the tone colour from its vowel; questions rise, exclamations are higher and louder.
  const SCALE = [0, 2, 4, 7, 9, 12, 14], FORMANT = { a: 1000, e: 1650, i: 2200, o: 750, u: 600, y: 1900 };
  let voiced = 0;
  function voice(ch, mods = {}) {
    voiced++;
    const a = ctx(); if (!a) return;
    const c = ch.toLowerCase(), semi = SCALE[c.charCodeAt(0) % SCALE.length] + (mods.question ? 5 : 0) + (mods.excited ? 2 : 0);
    const f0 = 520 * Math.pow(2, semi / 12) * (0.98 + Math.random() * 0.04), t = a.currentTime, dur = 0.07;
    const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(f0 * 1.08, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.03);
    f.type = "bandpass"; f.frequency.value = FORMANT[c] || 1300; f.Q.value = 1.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(mods.excited ? 0.2 : 0.15, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  // ---------- the circuit's own sounds: lights coming on, the loop closing and opening, shorts, overheating ----------
  const LED_KEY = { red: 523.25, yellow: 587.33, green: 659.25, blue: 783.99, white: 880 };    // each colour its own key
  const ledOn = new Map();
  let loopOn = false, primed = false, hum = null, hiss = null, hushed = false;
  // A new bench (a level loaded, a mission started): note what is already on, without a sound.
  function reset() { ledOn.clear(); loopOn = false; primed = false; }

  // A bell-like note: a sine with a slightly out-of-tune overtone, quick attack, ringing decay.
  function bell(a, t, f, gain, dur = 0.7) {
    for (const [mult, g] of [[1, 1], [2.01, 0.35], [3.98, 0.12]]) tone(a, t, f * mult, gain * g, dur / mult);
  }
  function jingle(color) {
    played.jingle++;
    const a = ctx(); if (!a) return;
    const f = LED_KEY[color] || LED_KEY.red, t = a.currentTime + 0.01;
    [1, 1.26, 1.5].forEach((m, k) => bell(a, t + k * 0.075, f * m, 0.07));
    bell(a, t + 0.26, f * 2, 0.04, 0.9);                    // the sparkle on top
  }
  function connect(up) {
    played[up ? "connect" : "disconnect"]++;
    const a = ctx(); if (!a) return;
    const t = a.currentTime + 0.01;
    if (up) { tone(a, t, 392, 0.06, 0.12, 587); tone(a, t + 0.09, 587, 0.05, 0.18, 784); }
    else { tone(a, t, 587, 0.04, 0.14, 392); tone(a, t + 0.1, 392, 0.035, 0.2, 294); }
  }
  // Continuous sounds (a short circuit's buzz, a hot part's hiss): built once, faded in and out.
  function bed(a, kind) {
    const g = a.createGain(); g.gain.value = 0; g.connect(a.destination);
    if (kind === "hum") {
      const o = a.createOscillator(), lp = a.createBiquadFilter(), trem = a.createOscillator(), td = a.createGain(), body = a.createGain();
      o.type = "sawtooth"; o.frequency.value = 100; lp.type = "lowpass"; lp.frequency.value = 900;
      trem.frequency.value = 9; td.gain.value = 0.35; body.gain.value = 0.65;
      trem.connect(td).connect(body.gain);                 // a flutter in the buzz
      o.connect(lp).connect(body).connect(g); o.start(); trem.start();
    } else {
      const n = noise(a), hp = a.createBiquadFilter();
      n.loop = true; hp.type = "highpass"; hp.frequency.value = 4000;
      n.connect(hp).connect(g); n.start();
    }
    return g;
  }
  function level(node, v) { const a = audio; if (node && a) node.gain.setTargetAtTime(v, a.currentTime, 0.06); }
  function hush() { if (hushed) return; hushed = true; level(hum, 0); level(hiss, 0); }

  function circuitSounds(doc, sim, dt) {
    hushed = false;
    let short = false, flowing = false, heat = 0, lit = 0;
    for (const p of doc.parts) {
      const rt = sim.rt.get(p.id), rd = sim.read(p.id) || {};
      if (!rt) continue;
      if (p.type === "battery" && p.on !== false && !rt.destroyed) { if (rd.short) short = true; else if (Math.abs(rd.I || 0) > 5e-4) flowing = true; }
      if (!rt.destroyed && p.type !== "meter") heat = Math.max(heat, rt.level || 0);
      if (p.type === "led") {
        const was = ledOn.get(p.id) || false, I = rt.destroyed ? 0 : rd.I || 0;
        const on = was ? I > 0.001 : I > 0.002;           // a little hysteresis, so a dim LED does not chatter
        if (on && !was && primed) { lit++; if (lit === 1 && I <= 0.03) jingle(p.color); }    // far too much current: no happy jingle, it is about to pop
        ledOn.set(p.id, on);
      }
    }
    if (primed && flowing !== loopOn && !short) { if (!(flowing && lit)) connect(flowing); }
    if (!short) loopOn = flowing;
    primed = true;
    if (muted) { level(hum, 0); level(hiss, 0); return; }
    // short circuit: buzz with crackles; overheating: crackles, and a hiss once it smokes
    const a = (short || heat >= 1) ? ctx() : audio;
    if (!a) return;
    if (short && !hum) hum = bed(a, "hum");
    if (heat >= 2 && !hiss) hiss = bed(a, "hiss");
    level(hum, short ? 0.07 : 0);
    level(hiss, heat >= 2 ? 0.025 : 0);
    const rate = short ? 10 : heat >= 2 ? 14 : heat >= 1 ? 3 : 0;
    if (rate && Math.random() < rate * dt) { played.crackle++; click(a, a.currentTime + 0.002, vary(3000 + Math.random() * 3000, 0), heat >= 2 || short ? 0.09 : 0.05, false); }
    hazard.hum = short; hazard.sizzle = heat >= 2; hazard.heat = heat;
  }
  const hazard = { hum: false, sizzle: false, heat: 0 };

  function setMuted(m) { muted = m; if (m) beep(false); }
  function unlock() { ctx(); }

  BB.Effects = { reset, hush, hazard, MAT, insert, extract, get placed() { return Object.assign({}, played); }, voice, get voiced() { return voiced; }, init, frame, burst, chime, setMuted, unlock, fmtLcd, midOf, get muted() { return muted; } };
})(window.BB = window.BB || {});
