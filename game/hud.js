// HUD: part icons, tooltip, banner, toast, and the meter's note for two points no loop joins.
(function (BB) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  // What a new resistor or LED gets when the tray does not say.
  const defaults = { resistor: 330, ledColor: "red" };

  function icon(type, color, value) {
    const bd = BBShared.bands(Math.round(value || 330));      // the resistor's real colour bands
    const s = {        // small drawings in the bench's style (art style 1); the LED's + leg is the longer, bent one
      battery: '<rect x="3" y="4" width="38" height="20" rx="6" fill="#1a2433" stroke="#2e3e54"/><rect x="7" y="7" width="6" height="14" rx="3" fill="#ee9a3c"/><rect x="15" y="7" width="6" height="14" rx="3" fill="#2b313a"/><rect x="23" y="7" width="6" height="14" rx="3" fill="#ee9a3c"/><rect x="31" y="9" width="7" height="5" rx="2.5" fill="#22a65a"/>',
      resistor: `<line x1="2" y1="14" x2="42" y2="14" stroke="#c7ccd1" stroke-width="2"/><rect x="11" y="8" width="22" height="12" rx="6" fill="#ecd3a4" stroke="#a8834c"/><rect x="14" y="8" width="2.6" height="12" fill="${bd[0]}"/><rect x="18.5" y="8" width="2.6" height="12" fill="${bd[1]}"/><rect x="23" y="8" width="2.6" height="12" fill="${bd[2]}"/><rect x="28.5" y="8" width="2.2" height="12" fill="${bd[3]}"/>`,
      wire: '<path d="M4 22 Q22 0 40 22" stroke="rgba(10,16,24,.55)" stroke-width="5.5" fill="none" stroke-linecap="round"/><path d="M4 22 Q22 0 40 22" stroke="#36c46b" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
      led: `<polyline points="17,16 17,20 14.8,22.4 17,24.8 17,27.6" fill="none" stroke="#c7ccd1" stroke-width="2" stroke-linejoin="round"/><line x1="27" y1="22.5" x2="27" y2="16" stroke="#c7ccd1" stroke-width="2"/><circle cx="22" cy="12" r="10" fill="${color || "#d81e28"}" stroke="rgba(0,0,0,.35)"/><ellipse cx="18.5" cy="8.5" rx="2.4" ry="3.6" fill="#fff" opacity=".55"/>`,
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

  // ---------- meter ----------
  // Are the probes on two points that no part joins (two separate circuits, or an empty strip)? A voltmeter then has
  // no loop for its tiny current and shows about 0 V: true, but puzzling, so the meter says why.
  const APART = "No loop joins these two points, so no current can flow through the meter: it shows about 0 V.";
  function apart(G, m) {
    if (!m || !m.legs[0] || !m.legs[1]) return false;
    const parent = new Map(), find = (x) => { while (parent.has(x) && parent.get(x) !== x) x = parent.get(x); return x; };
    const join = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    for (const p of G.doc.parts) {
      if (p.type === "meter" || !p.legs) continue;
      const nets = p.legs.map((l, k) => (l ? BB.netKey(l, p.id, k) : null)).filter(Boolean);
      for (let k = 1; k < nets.length; k++) join(nets[0], nets[k]);
    }
    return find(BB.netKey(m.legs[0])) !== find(BB.netKey(m.legs[1]));
  }

  // ---------- tooltip, banner, toast ----------
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

  BB.HUD = { apart, APART, icon, defaults, toast, tooltip, banner };
})(window.BB = window.BB || {});
