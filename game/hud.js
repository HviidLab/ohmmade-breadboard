// HUD: parts drawer, meter LCD, inspector, parts list, event log, tooltip, banner, toast.
(function (BB) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const T = BB.Parts.TYPES;
  const num = (x) => typeof x === "number" && Number.isFinite(x);
  const fmtA = (a) => { if (!num(a)) return "—"; const x = Math.abs(a); return x >= 1 ? `${a.toFixed(2)} A` : x >= 1e-3 ? `${(a * 1e3).toFixed(2)} mA` : x >= 1e-6 ? `${(a * 1e6).toFixed(1)} µA` : "0 mA"; };
  const fmtV = (v) => (num(v) ? `${v.toFixed(2)} V` : "—");
  const fmtP = (p) => (!num(p) ? "—" : p >= 1 ? `${p.toFixed(2)} W` : `${(p * 1000).toFixed(0)} mW`);
  const fmtR = BB.Parts.fmtR, nameOf = BB.Parts.name, PN = BB.Parts;
  // What a new resistor or LED from the drawer gets: the last value or colour you chose in the Inspector.
  const defaults = { resistor: 330, ledColor: "red" };
  const STATE = ["ok", "stressed", "smoking", "destroyed"];
  const STATE_TXT = { ok: "OK", stressed: "over its rating", smoking: "smoking", destroyed: "destroyed" };

  const DRAWER = [
    { type: "battery", label: "Battery pack", sub: "4×AA · 6 V" },
    { type: "resistor", label: "Resistor", sub: "330 Ω · any value" },
    { type: "wire", label: "Jumper wire", sub: "or drag from a hole" },
    { type: "led", label: "Red LED", sub: "≈ 2.0 V · 5 colours" },
    { type: "cap", label: "Capacitor", sub: "1000 µF electrolytic", value: 1e-3 },
    { type: "cap", label: "Capacitor", sub: "100 µF electrolytic", value: 1e-4 },
    { type: "pot", label: "Potentiometer", sub: "10 kΩ knob" },
    { type: "button", label: "Push button", sub: "4 legs, across the gap" },
    { type: "npn", label: "NPN transistor", sub: "BC547 · C B E" },
    { type: "ldr", label: "Light sensor", sub: "LDR GL5528" },
    { type: "meter", label: "Multimeter", sub: "V · mA · Ω · beep" },
    { type: "uno", label: "Controller board", sub: "5V · GND · pins D2–D13" },
  ];

  function icon(type, color) {
    const s = {        // small drawings in the bench's style (art style 1)
      battery: '<rect x="3" y="4" width="38" height="20" rx="6" fill="#1a2433" stroke="#2e3e54"/><rect x="7" y="7" width="6" height="14" rx="3" fill="#ee9a3c"/><rect x="15" y="7" width="6" height="14" rx="3" fill="#2b313a"/><rect x="23" y="7" width="6" height="14" rx="3" fill="#ee9a3c"/><rect x="31" y="9" width="7" height="5" rx="2.5" fill="#22a65a"/>',
      resistor: '<line x1="2" y1="14" x2="42" y2="14" stroke="#c7ccd1" stroke-width="2"/><rect x="11" y="8" width="22" height="12" rx="6" fill="#ecd3a4" stroke="#a8834c"/><rect x="15" y="8" width="2.6" height="12" fill="#ff7a1a"/><rect x="20" y="8" width="2.6" height="12" fill="#ff7a1a"/><rect x="25" y="8" width="2.6" height="12" fill="#7a4520"/>',
      wire: '<path d="M4 22 Q22 0 40 22" stroke="rgba(10,16,24,.55)" stroke-width="5.5" fill="none" stroke-linecap="round"/><path d="M4 22 Q22 0 40 22" stroke="#36c46b" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
      led: `<line x1="17" y1="26" x2="17" y2="16" stroke="#c7ccd1" stroke-width="2"/><line x1="27" y1="26" x2="27" y2="16" stroke="#c7ccd1" stroke-width="2"/><circle cx="22" cy="12" r="10" fill="${color || "#d81e28"}" stroke="rgba(0,0,0,.35)"/><ellipse cx="18.5" cy="8.5" rx="2.4" ry="3.6" fill="#fff" opacity=".55"/>`,
      cap: '<circle cx="22" cy="14" r="11" fill="#3a63d6" stroke="#1c3474"/><circle cx="28" cy="14" r="3.8" fill="#c9d6f6"/>',
      pot: '<rect x="8" y="3" width="28" height="22" rx="6" fill="#2f6fd0" stroke="#173a75"/><circle cx="22" cy="14" r="7.5" fill="#eef1f4"/><line x1="22" y1="14" x2="26" y2="9" stroke="#26303a" stroke-width="2.2" stroke-linecap="round"/>',
      button: '<rect x="10" y="2" width="24" height="24" rx="6" fill="#2b3038"/><circle cx="22" cy="14" r="7" fill="#ff5a5a" stroke="#7a1d1d"/>',
      npn: '<path d="M10 6H34V14Q22 30 10 14Z" fill="#2b3038" stroke="#0c0e11"/>',
      ldr: '<circle cx="22" cy="14" r="10" fill="#f0c85c" stroke="#a67c2a"/><path d="M15 12h3v5h3v-5h3v5h3v-5h3" stroke="#8b3a1a" stroke-width="1.4" fill="none"/>',
      uno: '<rect x="4" y="3" width="36" height="22" rx="4" fill="#1d5fa8"/><rect x="14" y="4" width="22" height="3" fill="#0b0c0d"/><rect x="18" y="21" width="18" height="3" fill="#0b0c0d"/><rect x="2" y="9" width="8" height="7" fill="#c9ced3"/>',
      meter: '<rect x="11" y="1" width="22" height="26" rx="6" fill="#ffc43d" stroke="#b9800f"/><rect x="14" y="4" width="16" height="20" rx="4" fill="#1c2633"/><rect x="16" y="6" width="12" height="5" rx="1.5" fill="#0e2620"/><circle cx="22" cy="17" r="4" fill="#2b3644"/>',
    };
    return `<svg viewBox="0 0 44 28" aria-hidden="true">${s[type] || ""}</svg>`;
  }

  function buildDrawer(onStart) {
    const ul = $("drawer");
    DRAWER.forEach((d, k) => {
      const li = document.createElement("li");
      li.tabIndex = 0;
      li.dataset.k = k;
      li.addEventListener("pointerdown", (e) => { e.preventDefault(); onStart(d, e); });
      li.addEventListener("keydown", (e) => { if (e.key === "Enter") onStart(d, null); });
      ul.appendChild(li);
    });
    refreshDrawer();
  }
  // Drawer labels follow the defaults: "Resistor 4.7 kΩ", "Blue LED".
  function refreshDrawer() {
    const vf = BB.Devices.ledParams(defaults.ledColor).vf;
    DRAWER.forEach((d, k) => {
      const li = document.querySelector(`#drawer li[data-k="${k}"]`);
      if (!li) return;
      let label = d.label, sub = d.sub, color = null;
      if (d.type === "resistor") sub = `${fmtR(defaults.resistor)} · any value`;
      if (d.type === "led") { label = `${PN.COLOR_NAME[defaults.ledColor]} LED`; sub = `≈ ${vf.toFixed(1)} V · 5 colours`; color = BB.Render.LEDC[defaults.ledColor].icon; }
      li.innerHTML = `${icon(d.type, color)}<span class="lbl">${label}<span class="sub">${sub}</span></span>`;
    });
  }

  // ---------- meter ----------
  function meter(G) {
    const m = G.doc.parts.find((p) => p.type === "meter");
    if (!m) { $("lcd-mode").textContent = "no meter"; $("lcd-v").textContent = "—"; $("lcd-note").textContent = "Drag the multimeter from the drawer."; return; }
    const rd = G.sim.read(m.id);
    const [v, u] = BB.Effects.fmtLcd(rd);
    $("lcd-mode").textContent = { off: "off", V: "DC volts", mA: "DC mA", ohm: "ohms", cont: "continuity" }[m.mode || "V"];
    $("lcd-where").textContent = `red ${m.legs[0] || "loose"} · COM ${m.legs[1] || "loose"}`;
    $("lcd-v").innerHTML = `${v}<small>${u}</small>`;
    const notes = [];
    if (rd.note) notes.push(rd.note);
    if (m.socket === "mA" && m.mode !== "mA") notes.push("Careful: the red lead is still in the mA socket. The meter is almost a wire now.");
    if (rd.beep) notes.push("Beep: the probes are connected.");
    const at = (pt) => (pt.startsWith("U.") ? `board ${BB.Uno.label(pt.slice(2))}` : `${pt} (${BBShared.netName(BBShared.net(pt)).replace(/ \(.*\)$/, "")})`);
    if (m.legs[0] && m.legs[1]) notes.push(`Red in ${at(m.legs[0])}, black in ${at(m.legs[1])}.`);
    if (!rd.fuseOK) notes.push("The mA fuse is blown. Select the meter and replace the fuse.");
    $("lcd-note").textContent = notes.join(" ");
  }

  // ---------- inspector ----------
  let inspFor = null;
  function inspector(G, force) {
    const body = $("insp-body");
    const part = G.sel && G.doc.get(G.sel);
    if (!part) { if (inspFor !== null || force) { body.innerHTML = '<p class="note">Click a part to see its voltage, current and temperature.</p>'; inspFor = null; } return; }
    if (inspFor !== part.id || force) {
      inspFor = part.id;
      body.innerHTML = `<p><strong>${nameOf(part)}</strong> <span class="state" id="insp-state"></span></p><dl class="kv" id="insp-kv"></dl><div id="insp-ctl"></div><div class="row" id="insp-act"></div>`;
      controls(G, part, $("insp-ctl"));
      const act = $("insp-act");
      const add = (label, fn, cls = "btn") => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = label; b.addEventListener("click", fn); act.appendChild(b); return b; };
      if (!["meter", "battery", "uno"].includes(part.type)) add("Rotate (R)", () => G.rotate(part.id));
      add("Delete", () => G.remove(part.id));
      const rt = G.sim.rt.get(part.id);
      if (rt && rt.destroyed) add(part.type === "meter" ? "Replace fuse" : "Replace with a new one", () => G.replace(part.id), "btn primary");
    }
    values(G, part);
  }

  function controls(G, part, host) {
    const sel = (label, opts, cur, fn) => {
      const id = `ctl-${label.replace(/\W/g, "")}`;
      host.insertAdjacentHTML("beforeend", `<div class="row"><label for="${id}">${label}</label><select id="${id}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(cur) ? " selected" : ""}>${t}</option>`).join("")}</select></div>`);
      $(id).addEventListener("change", (e) => fn(e.target.value));
    };
    const range = (label, min, max, step, cur, fn) => {
      const id = `ctl-${label.replace(/\W/g, "")}`;
      host.insertAdjacentHTML("beforeend", `<div class="row" style="display:grid"><label for="${id}">${label}</label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${cur}"></div>`);
      $(id).addEventListener("input", (e) => fn(+e.target.value));
    };
    switch (part.type) {
      case "resistor": {
        // type any value ("4.7k", "4k7", "470") or pick a standard one; it is rounded to what colour bands can show
        host.insertAdjacentHTML("beforeend", `<div class="row"><label for="ctl-Value">Value</label><input id="ctl-Value" class="rval" list="e12" value="${fmtR(part.value).replace(" ", "")}" autocomplete="off" spellcheck="false" aria-describedby="ctl-Value-note"></div><p class="note" id="ctl-Value-note">Type a value such as 4.7k or pick one. 10 Ω to 1 MΩ.</p>`);
        if (!$("e12")) document.body.insertAdjacentHTML("beforeend", `<datalist id="e12">${PN.E12.map((r) => `<option value="${fmtR(r).replace(" ", "")}">`).join("")}</datalist>`);
        const inp = $("ctl-Value"), note = $("ctl-Value-note");
        const apply = () => {
          const r = PN.parseOhms(inp.value);
          if (r === null || r < PN.RMIN || r > PN.RMAX) { note.textContent = `“${inp.value}” is not a value from 10 Ω to 1 MΩ. Try 220, 4.7k or 1M.`; note.classList.add("bad"); return; }
          note.classList.remove("bad");
          inp.value = fmtR(r).replace(" ", "");
          note.textContent = PN.E12.includes(r) ? "A standard (E12) value." : "Not a standard E12 value, but it exists in other series.";
          defaults.resistor = r; refreshDrawer();
          G.set(part.id, "value", r, true);
        };
        inp.addEventListener("change", apply);
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } e.stopPropagation(); });
        break;
      }
      case "led":
        sel("Colour", Object.keys(BB.Devices.PARAMS.ledColors).map((c) => [c, `${PN.COLOR_NAME[c]} (≈ ${BB.Devices.ledParams(c).vf.toFixed(1)} V)`]), part.color || "red",
          (v) => { defaults.ledColor = v; refreshDrawer(); G.set(part.id, "color", v, true); });
        break;
      case "cap": sel("Value", [[1e-3, "1000 µF"], [1e-4, "100 µF"], [1e-5, "10 µF"]], part.value, (v) => G.set(part.id, "value", +v, true)); break;
      case "pot": range("Knob position", 0, 1, 0.01, part.pos ?? 0.5, (v) => G.set(part.id, "pos", v)); break;
      case "ldr": {
        range("Light (lux, log scale)", 0, 3, 0.05, Math.log10(part.lux ?? 200), (v) => G.set(part.id, "lux", Math.round(Math.pow(10, v))));
        host.insertAdjacentHTML("beforeend", '<div class="row"><button type="button" class="btn" id="ctl-cover">Cover with your hand (hold)</button></div>');
        const b = $("ctl-cover"); let keep = 200;
        b.addEventListener("pointerdown", () => { keep = part.lux ?? 200; G.set(part.id, "lux", 1); });
        const up = () => G.set(part.id, "lux", keep);
        b.addEventListener("pointerup", up); b.addEventListener("pointerleave", () => { if (part.lux === 1) up(); });
        break;
      }
      case "button": {
        host.insertAdjacentHTML("beforeend", '<div class="row"><button type="button" class="btn" id="ctl-press">Press (hold)</button><label><input type="checkbox" id="ctl-latch"> keep pressed</label></div>');
        const b = $("ctl-press");
        b.addEventListener("pointerdown", () => G.set(part.id, "pressed", true));
        b.addEventListener("pointerup", () => { if (!$("ctl-latch").checked) G.set(part.id, "pressed", false); });
        $("ctl-latch").addEventListener("change", (e) => G.set(part.id, "pressed", e.target.checked));
        break;
      }
      case "battery":
        host.insertAdjacentHTML("beforeend", `<div class="row"><button type="button" class="btn" id="ctl-on">${part.on !== false ? "Switch off" : "Switch on"}</button></div>`);
        $("ctl-on").addEventListener("click", () => G.set(part.id, "on", part.on === false, true, true));
        break;
      case "meter":
        sel("Dial", [["off", "OFF"], ["V", "DC volts (V⎓)"], ["mA", "DC milliamps (mA)"], ["ohm", "Ohms (Ω)"], ["cont", "Continuity (beep)"]], part.mode || "V", (v) => G.set(part.id, "mode", v, true, true));
        sel("Red lead in", [["VO", "VΩ socket"], ["mA", "mA socket"]], part.socket || "VO", (v) => G.set(part.id, "socket", v, true, true));
        break;
    }
  }

  function values(G, part) {
    const rt = G.sim.rt.get(part.id), rd = G.sim.read(part.id) || {};
    const st = STATE[rt ? (rt.destroyed ? 3 : rt.level || 0) : 0];
    const s = $("insp-state");
    if (s) { s.className = `state ${st}`; s.textContent = part.type === "meter" && st === "destroyed" ? "fuse blown" : STATE_TXT[st]; }
    const kv = [];
    const temp = (h) => `${Math.round(25 + 100 * h)} °C`;
    switch (part.type) {
      case "resistor": kv.push(["Voltage", fmtV(rd.V)], ["Current", fmtA(rd.I)], ["Power", `${fmtP(rd.P)} of 250 mW`], ["Temperature", temp(rt.stress.heat.h)]); break;
      case "led": kv.push(["Current", `${fmtA(rd.I)} (max ${BB.Devices.ledParams(part.color).imax * 1000} mA)`], ["Voltage", fmtV(rd.V)], ["Brightness", `${Math.round(Math.min(Math.sqrt(Math.max(rd.I, 0) / 0.02), 1) * 100)} %`]); break;
      case "wire": kv.push(["Current", fmtA(rd.I)]); break;
      case "battery": kv.push(["Terminal voltage", fmtV(rd.V)], ["Current", fmtA(rd.I)], ["Heat inside", fmtP(rd.Pint)]); break;
      case "cap": kv.push(["Voltage", fmtV(rd.V)], ["Current", fmtA(rd.I)]); if (rd.reverse) kv.push(["Warning", "connected backwards"]); break;
      case "pot": kv.push(["Wiper voltage", fmtV(rd.Vw || 0)], ["Track 1 power", fmtP(rd.P1 || 0)], ["Track 2 power", fmtP(rd.P2 || 0)]); break;
      case "button": kv.push(["State", rd.pressed ? "pressed" : "released"], ["Pairs", part.pairs === "along" ? "turned 90°: always connected" : "across: connects when pressed"]); break;
      case "ldr": kv.push(["Light", `${part.lux ?? 200} lux`], ["Resistance", fmtR(Math.round(rd.R))], ["Current", fmtA(rd.I)]); break;
      case "npn": kv.push(["Base current", fmtA(rd.Ib)], ["Collector current", fmtA(rd.Ic)], ["V base–emitter", fmtV(rd.Vbe)], ["V collector–emitter", fmtV(rd.Vce)]); break;
      case "meter": kv.push(["Fuse", rd.fuseOK ? "OK" : "blown"]); break;
    }
    const el = $("insp-kv");
    if (el) el.innerHTML = kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  }

  // ---------- part list, log, tooltip, banner, toast ----------
  function partList(G) {
    const ul = $("partlist");
    ul.innerHTML = G.doc.parts.map((p) => {
      const rt = G.sim.rt.get(p.id);
      const extra = p.type === "cap" ? (p.value >= 1e-3 ? "1000 µF" : p.value >= 1e-4 ? "100 µF" : "10 µF") : "";
      return `<li><button type="button" data-id="${p.id}" aria-current="${p.id === G.sel}"><span>${nameOf(p)} ${extra}</span><span class="mono">${rt && rt.destroyed ? "✗" : p.legs.filter(Boolean).join(" ")}</span></button></li>`;
    }).join("") || '<li class="note">Nothing yet.</li>';
    ul.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => G.select(b.dataset.id)));
  }

  function log(text, kind = "", t = 0) {
    const li = document.createElement("li");
    li.className = kind;
    li.innerHTML = `<time>${t.toFixed(1)} s</time>`;
    li.appendChild(document.createTextNode(text));
    $("log").prepend(li);
  }

  let toastTimer = null;
  function toast(text, ms = 7000) {
    const t = $("toast");
    clearTimeout(toastTimer);
    if (!text) { t.hidden = true; return; }
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  function tooltip(text, cx, cy) {
    const tt = $("tooltip");
    if (!text) { tt.hidden = true; return; }
    const r = $("stage").getBoundingClientRect();
    tt.textContent = text;
    tt.hidden = false;
    tt.style.left = `${Math.min(cx - r.left + 16, r.width - 240)}px`;
    tt.style.top = `${Math.min(cy - r.top + 16, r.height - 120)}px`;
  }

  function banner(text) { const b = $("banner"); b.hidden = !text; if (text) b.textContent = text; }

  // One-line readout for hovering a part.
  function partTip(G, id) {
    const part = G.doc.get(id), rt = G.sim.rt.get(id), rd = G.sim.read(id);
    if (!part || !rd) return "";
    const head = nameOf(part);
    if (rt && rt.destroyed) return `${head}\ndestroyed: select it and replace it`;
    const lines = [head];
    if (rd.I !== undefined) lines.push(`I = ${fmtA(rd.I)}`);
    if (rd.V !== undefined && part.type !== "meter") lines.push(`V = ${fmtV(rd.V)}`);
    if (rd.P !== undefined && part.type === "resistor") lines.push(`P = ${fmtP(rd.P)}`);
    if (part.type === "npn") lines.push(`Ib = ${fmtA(rd.Ib)}, Ic = ${fmtA(rd.Ic)}`);
    return lines.join("\n");
  }

  // 60-second trace of the meter reading (sampled by main.js).
  function trace(buf, now) {
    const svg = $("trace");
    const pts = buf.filter((q) => q.t > now - 60 && Number.isFinite(q.v));
    if (pts.length < 2) { svg.innerHTML = '<text x="140" y="40" text-anchor="middle" fill="#5f8070" font-size="11" font-family="IBM Plex Mono, monospace">reading over time</text>'; return; }
    let lo = Math.min(...pts.map((q) => q.v)), hi = Math.max(...pts.map((q) => q.v));
    if (hi - lo < 1e-9) { hi += 0.5 * (Math.abs(hi) || 1); lo -= 0.5 * (Math.abs(lo) || 1); }
    const X = (t) => 4 + ((t - (now - 60)) / 60) * 272, Y = (v) => 64 - ((v - lo) / (hi - lo)) * 56;
    const unit = buf.unit || "";
    svg.innerHTML = `<polyline points="${pts.map((q) => `${X(q.t).toFixed(1)},${Y(q.v).toFixed(1)}`).join(" ")}" fill="none" stroke="#bff7d9" stroke-width="1.6" vector-effect="non-scaling-stroke"/>` +
      `<text x="276" y="12" text-anchor="end" fill="#5f8070" font-size="10" font-family="IBM Plex Mono, monospace">${hi.toPrecision(3)} ${unit}</text>` +
      `<text x="276" y="66" text-anchor="end" fill="#5f8070" font-size="10" font-family="IBM Plex Mono, monospace">${lo.toPrecision(3)} ${unit}  · 60 s</text>`;
  }

  // controller board pin panel: modes, voltages, currents, digitalRead and analogRead.
  let unoKey = "";
  function uno(G) {
    const panel = $("uno-panel");
    const part = G.doc.parts.find((p) => p.type === "uno");
    if (!part) { panel.hidden = true; unoKey = ""; return; }
    panel.hidden = false;
    const rd = G.sim.read(part.id);
    if (unoKey !== part.id) {
      unoKey = part.id;
      panel.innerHTML = `<h2>Controller board</h2><p class="note" id="uno-power"></p>
        <p class="note">Click a pin to cycle: input → output LOW → output HIGH.</p>
        <div class="pins" id="uno-pins">${BB.Uno.DIGITAL.map((n) => `<button type="button" class="pinbtn" data-pin="${n}"></button>`).join("")}</div>
        <dl class="kv" id="uno-analog"></dl>`;
      panel.querySelectorAll(".pinbtn").forEach((b) => b.addEventListener("click", () => G.cyclePin(part.id, b.dataset.pin)));
    }
    $("uno-power").textContent = rd.powered ? `Runs on USB · 5V supplies ${fmtA(rd.I5)}` : "USB fuse tripped: the board is off until it cools.";
    for (const b of panel.querySelectorAll(".pinbtn")) {
      const n = b.dataset.pin, pin = rd.pins[n];
      let read = pin.read;
      if (pin.mode === "INPUT" && !pin.damaged && G.sim.solver.theveninR(pin.node) > 1e7) read = "floating";
      const I = Math.abs(pin.I), warn = I > 0.04 ? "bad" : I > 0.02 ? "warn" : "";
      b.className = `pinbtn ${pin.mode.toLowerCase()} ${warn}${pin.damaged ? " damaged" : ""}`;
      b.innerHTML = `<b>${n}</b><span>${pin.damaged ? "damaged" : pin.mode === "INPUT" ? `in · ${read}` : `out ${pin.mode}`}</span><span>${pin.V.toFixed(2)} V${pin.mode !== "INPUT" ? ` · ${(pin.I * 1000).toFixed(1)} mA` : ""}</span>`;
      b.setAttribute("aria-label", `${n}: ${pin.damaged ? "damaged" : pin.mode === "INPUT" ? "input, reads " + read : "output " + pin.mode}`);
    }
    $("uno-analog").innerHTML = BB.Uno.ANALOG.map((n) => `<dt>analogRead(${n})</dt><dd>${rd.pins[n].damaged ? "damaged" : rd.analog[n]}</dd>`).join("");
  }

  BB.HUD = { icon, defaults, refreshDrawer, uno, trace, buildDrawer, meter, inspector, partList, log, toast, tooltip, banner, partTip, DRAWER, fmtA, fmtV };
})(window.BB = window.BB || {});
