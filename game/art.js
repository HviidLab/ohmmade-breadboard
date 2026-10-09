// Generated art: lookup of processed sprites (art/manifest.js) and measured anchor points.
// If the manifest is missing, BB.Art.has() is false and the renderer keeps its vector drawings.
(function (BB) {
  "use strict";
  const M = window.BB_ART || {};
  // Anchor points as fractions of each sprite (measured on the processed images).
  const ANCHORS = {
    meter_body: { body: [0, 0, 0.74, 0.9], lcd: [0.13, 0.12, 0.63, 0.30], dial: [0.38, 0.53, 0.20], dialAngle: 33,
      sockets: { mA: [0.19, 0.775], COM: [0.38, 0.775], VO: [0.57, 0.775] } },
    battery_holder: { switch: [0.83, 0.12] },
    resistor_body: { body: [0.27, 0.73] },
  };
  BB.Art = {
    has: (name) => !!M[name] && !BB.Art.disabled,
    url: (name) => M[name].src,
    size: (name) => [M[name].w, M[name].h],
    anchor: (name) => ANCHORS[name] || {},
    disabled: /(^|[?&#])noart\b/.test(location.search + location.hash),
  };
})(window.BB = window.BB || {});
