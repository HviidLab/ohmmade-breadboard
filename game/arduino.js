// Uno-style board: header sockets, supplies, GPIO pins (no programming: pins are set by clicking).
(function (BB) {
  "use strict";
  const W = 640;                         // drawn width in world units (real board 68.6 mm)
  const ASPECT = 736 / 973;
  const H = W * ASPECT;
  // Header strips as fractions of the board image: [x0, x1, y, names]
  const STRIPS = [
    [0.31, 0.65, 0.04, ["SCL", "SDA", "AREF", "GND2", "D13", "D12", "D11", "D10", "D9", "D8"]],
    [0.67, 0.94, 0.04, ["D7", "D6", "D5", "D4", "D3", "D2", "D1", "D0"]],
    [0.43, 0.70, 0.875, ["NC", "IOREF", "RESET", "3V3", "5V", "GND0", "GND1", "VIN"]],
    [0.73, 0.94, 0.875, ["A0", "A1", "A2", "A3", "A4", "A5"]],
  ];
  const SOCKETS = [];
  for (const [x0, x1, y, names] of STRIPS) names.forEach((n, k) => SOCKETS.push({ name: n, fx: x0 + ((k + 0.5) * (x1 - x0)) / names.length, fy: y, top: y < 0.5 }));
  const DIGITAL = ["D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13"];
  const ANALOG = ["A0", "A1", "A2", "A3", "A4", "A5"];
  const pos = { bx: -760, by: -40 };

  const netOf = (pt) => (/^U\.GND\d$/.test(pt) ? "U.GND" : pt);
  const socketXY = (pt) => {
    const s = SOCKETS.find((q) => `U.${q.name}` === pt);
    return s ? [pos.bx + s.fx * W, pos.by + s.fy * H] : [pos.bx, pos.by];
  };
  function socketAt(wx, wy, rad) {
    let best = null, bd = rad;
    for (const s of SOCKETS) {
      const d = Math.hypot(wx - (pos.bx + s.fx * W), wy - (pos.by + s.fy * H));
      if (d <= bd) { bd = d; best = `U.${s.name}`; }
    }
    return best;
  }
  const usable = (pt) => !/^U\.(NC|D0|D1|SCL|SDA|AREF|IOREF|RESET)$/.test(pt);

  BB.Uno = { W, H, SOCKETS, DIGITAL, ANALOG, pos, netOf, socketXY, socketAt, usable, present: false };
})(window.BB = window.BB || {});
