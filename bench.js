// Shared helpers for the bench labs: number formatting, the page nav, and predict → check tables.
const Bench = (() => {
  const SVGNS = "http://www.w3.org/2000/svg";

  const PAGES = [
    ["index.html", "Start"],
    ["primer.html", "Primer"],
    ["ohms-law.html", "Ohm's law"],
    ["series-parallel.html", "Series & parallel"],
    ["breadboard.html", "Breadboard"],
    ["more-circuits.html", "Divider · capacitor · transistor"],
    ["workbook.html", "Workbook"],
    ["game.html", "Breadboard game"],
  ];

  function nav() {
    const here = location.pathname.split("/").pop() || "index.html";
    const bar = document.createElement("header");
    bar.className = "topbar";
    bar.innerHTML = `<a class="brand" href="index.html">Ohmmade Breadboard</a><nav aria-label="Pages"></nav>`;
    const n = bar.querySelector("nav");
    for (const [href, label] of PAGES.slice(1)) {
      const a = document.createElement("a");
      a.href = href;
      a.textContent = label;
      if (href === here) a.setAttribute("aria-current", "page");
      n.appendChild(a);
    }
    document.querySelector(".wrap").prepend(bar);
  }

  // Engineering formatting with 3 significant figures.
  function sig(x, n = 3) {
    if (!isFinite(x)) return "—";
    if (x === 0) return "0";
    const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(x))));
    return x.toFixed(Math.min(d, 3));
  }
  function amps(a) {
    const x = Math.abs(a);
    if (x === 0) return ["0.00", "mA"];
    if (x < 1e-3) return [sig(a * 1e6), "µA"];
    if (x < 1) return [sig(a * 1e3), "mA"];
    return [sig(a), "A"];
  }
  function volts(v) { return [Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2), "V"]; }
  function ohms(r) {
    if (!isFinite(r)) return ["∞", "Ω"];
    if (r >= 1e6) return [sig(r / 1e6), "MΩ"];
    if (r >= 1e3) return [sig(r / 1e3), "kΩ"];
    return [sig(r), "Ω"];
  }
  function watts(p) { return p < 1 ? [sig(p * 1e3), "mW"] : [sig(p), "W"]; }
  const str = ([n, u]) => `${n} ${u}`;

  // Standard resistor values used across the labs.
  const RVALS = [100, 220, 330, 470, 680, 1000, 2200, 3300, 4700, 10000, 22000, 47000, 100000];

  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  function setMeter(node, [num, unit]) {
    node.innerHTML = `${num}<small>${unit}</small>`;
  }

  /* Predict → check table.
     rows: [{label, answer (SI number), unit: "mA"|"V"|"Ω"|"s", hint, load()}] */
  function checkTable(host, rows) {
    const scale = { mA: 1e-3, "µA": 1e-6, V: 1, "Ω": 1, s: 1, mW: 1e-3, W: 1 };
    const t = document.createElement("table");
    t.className = "check";
    t.innerHTML = `<thead><tr><th scope="col">Situation</th><th scope="col">Your prediction</th><th scope="col">Result</th></tr></thead><tbody></tbody>`;
    const tb = t.querySelector("tbody");
    rows.forEach((r, i) => {
      const id = `${host.id || "chk"}-${i}`;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><label for="${id}">${r.label}</label></td>
        <td><span class="row"><input id="${id}" type="number" step="any" inputmode="decimal"><span class="unit">${r.unit}</span>
        <button class="btn ghost" type="button">Check</button></span></td>
        <td class="res" aria-live="polite"></td>`;
      const [inp, btn, res] = [tr.querySelector("input"), tr.querySelector("button"), tr.querySelector(".res")];
      const go = () => {
        const want = r.answer / scale[r.unit];
        const show = `${sig(want)} ${r.unit}`;
        const got = parseFloat(inp.value);
        if (!isFinite(got)) {
          res.innerHTML = `<span>Answer: ${show}</span>`;
        } else {
          const err = want === 0 ? Math.abs(got) : Math.abs(got - want) / Math.abs(want);
          res.innerHTML = err <= 0.05
            ? `<span class="good">✓ ${show}</span>`
            : `<span class="off">✗ ${show}</span>${r.hint ? `<br><span class="note">${r.hint}</span>` : ""}`;
        }
        if (r.load) r.load();
      };
      btn.addEventListener("click", go);
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
      tb.appendChild(tr);
    });
    host.appendChild(t);
    const p = document.createElement("p");
    p.className = "note";
    p.textContent = "Within 5 % counts as correct. Checking a row also loads that situation into the drawing.";
    host.appendChild(p);
  }

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return { nav, sig, amps, volts, ohms, watts, str, RVALS, el, setMeter, checkTable, reducedMotion, SVGNS };
})();
