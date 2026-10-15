// The title screen's picture: key art painted with Nano Banana 2.1 (art/raw/title_nb_2.png) and then corrected by
// hand (art/fix_title_nb2.py), so its circuit is real: a 4×AA pack, its red lead in the + rail, a resistor from the
// + rail into a strip, the red LED's long leg in that strip, its short leg in the next strip, a black jumper from there
// to the − rail, and the pack's black lead in the − rail. Over it, in the picture's own units, a soft pulse on the LED's
// glow and a few sparks round Sparky.
(function (BB) {
  "use strict";

  const W = 1376, H = 768;                                   // the picture's size in px
  const LED = [955, 455];                                    // the LED's dome

  function scene() {
    return `<svg class="ts-scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs><radialGradient id="tsLed" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff6a50" stop-opacity=".55"/><stop offset=".4" stop-color="#ff4a3a" stop-opacity=".2"/><stop offset="1" stop-color="#ff4a3a" stop-opacity="0"/></radialGradient></defs>
      <image href="game/art/out/title_key.webp" width="${W}" height="${H}"/>
      <circle class="ts-ledpulse" cx="${LED[0]}" cy="${LED[1] + 30}" r="120" fill="url(#tsLed)"/>
      ${Array.from({ length: 12 }, (_, n) => `<circle class="ts-spark" cx="${1130 + ((n * 83) % 230)}" cy="${250 + ((n * 61) % 260)}" r="${1.2 + (n % 3) * 0.8}" fill="#ffd27a" style="animation-delay:${(n * 0.37) % 3}s"/>`).join("")}
    </svg>`;
  }

  BB.TitleArt = { scene };
})(window.BB = window.BB || {});
