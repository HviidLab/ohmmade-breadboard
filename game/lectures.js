// Sparky's blackboard lectures ("I don't get it"): one per idea, 3 to 5 boards. Each board is one picture (chalk-art.js)
// and one line from Sparky (at most 140 characters). An everyday picture comes first, then the circuit. The lectures
// explain the idea, never the answer to a level, so they are free: they never count as a hint. In the order of the
// ideas (concepts.js), so check_terms.py can tell the early chapters' words from the later ones. No DOM.
(function (BB) {
  "use strict";
  const LIST = [
    { id: "loop", slides: [
      { kind: "life", art: "pumpRing", say: "Picture a ring of pipe, full of water, with a pump in it. The pump pushes, and the water goes round and round.",
        alt: "A pump in a closed ring of pipe; the water flows all the way round." },
      { kind: "life", art: "pumpPlug", say: "Put a plug anywhere in the ring, and all the water stops. Water only moves if it can come back round to the pump.",
        alt: "The same ring with a plug in it; the water stands still everywhere." },
      { kind: "circuit", art: "nb:loop", say: "A circuit is that ring: the battery is the pump, the wires are the pipes. The current flows out of +, round the loop, into −.",
        alt: "A battery, a resistor and an LED in a closed loop, with the current going round." },
      { kind: "circuit", art: "loopOpen", say: "One wire end loose, and the loop is open. No current flows anywhere, so the LED stays dark. Close the loop, and it lights.",
        alt: "The same loop with one wire end lifted out; the LED is dark." },
    ] },
    { id: "switch", slides: [
      { kind: "life", art: "bridgeDown", say: "Picture a ring road packed with cars, bumper to bumper. One part is a drawbridge. While it is down, the whole queue rolls round.",
        alt: "Cars all round a ring road, with a drawbridge at the bottom, down." },
      { kind: "life", art: "bridgeUp", say: "Lift the bridge, and there is a gap. The cars are packed tight, so every car stops, even the ones far away from the bridge.",
        alt: "The drawbridge raised, a gap in the road; all the cars stand still." },
      { kind: "circuit", art: "nb:switch", say: "A switch is that drawbridge. Open it, and the loop has a gap: the current stops everywhere at once, and the LED goes dark.",
        alt: "A loop with an open switch at the bottom; nothing flows and the LED is dark." },
      { kind: "circuit", art: "switchClosed", say: "Close it, and the loop is whole again. The wires are full of charge, so it all moves at once: the LED lights straight away.",
        alt: "The same loop with the switch closed; the current flows and the LED lights." },
    ] },
    { id: "strip", slides: [
      { kind: "life", art: "roomDoors", say: "Picture a row of rooms, each with five doors. Walk in through any of the five doors, and you are in the same room.",
        alt: "Three rooms in a row, each with five doors; two people walk into the middle room by different doors." },
      { kind: "life", art: "roomWalls", say: "Two rooms side by side are close, but there is a wall between them. From inside one, you can't get into the other.",
        alt: "Two rooms side by side; the way from one into the other is blocked." },
      { kind: "circuit", art: "nb:strip", say: "The breadboard is like that. Under each group of 5 holes is one metal strip. The next 5 holes are another strip, not joined.",
        alt: "A strip of five holes joined by a metal bar inside, next to another strip." },
      { kind: "circuit", art: "stripLegs", say: "So to join two legs, put them in the same strip. Any of its 5 holes works: inside, it is all one piece of metal.",
        alt: "A resistor's leg and an LED's leg in the same strip; the current flows from one to the other." },
    ] },
    { id: "rail", slides: [
      { kind: "life", art: "mains", say: "A street has two long pipes under it: one brings water from the pump, one takes it back. Every house joins both, anywhere along.",
        alt: "A pump feeding a long pipe out and a long pipe back, with three houses joined to both." },
      { kind: "circuit", art: "nb:rail", say: "The rails are those two pipes. On this board, each rail is one long strip, the whole length: + by the red line, − by the blue.",
        alt: "The + rail and the − rail: long strips of holes along the board's edge." },
      { kind: "circuit", art: "railTaps", say: "Put the battery on the rails. Then a circuit anywhere along the board can reach both: from the + rail, through its parts, to the − rail.",
        alt: "A battery on the rails, and two resistor and LED pairs far apart, each from the + rail to the − rail; both light." },
      { kind: "circuit", art: "railSplit", say: "Careful on a real board: on some, each rail is cut in two in the middle. Then a short wire joins the two halves.",
        alt: "A rail cut in two in the middle, its halves joined by a short wire." },
    ] },
    { id: "gap", slides: [
      { kind: "life", art: "river", say: "A town has a river through the middle. The streets on both sides line up, but they don't meet. You can only cross at a bridge.",
        alt: "Streets on both sides of a river, lined up but not joined; one bridge crosses." },
      { kind: "circuit", art: "nb:gap", say: "The centre gap is that river. Each numbered column is two strips, one above the gap and one below. They are not joined.",
        alt: "Two strips in the same column, one above and one below the centre gap; they are not joined." },
      { kind: "circuit", art: "gapBridge", say: "To get across, build a bridge: a wire from a hole above the gap to a hole below it, or a part with one leg on each side.",
        alt: "A wire joins a strip above the gap to the strip below it." },
      { kind: "circuit", art: "gapStraddle", say: "Both legs in one strip: the strip joins them, so the current takes the strip and skips the part. Give each leg its own strip.",
        alt: "Left: a resistor with both legs in one strip. Right: a resistor with one leg above the gap and one below, in strips of their own." },
    ] },
    { id: "polarity", slides: [
      { kind: "life", art: "turnstileIn", say: "A turnstile turns only one way. Walk in the right way, and it turns and lets you through.",
        alt: "A person walks towards a turnstile, the way it turns." },
      { kind: "life", art: "turnstileLocked", say: "Come from the other side, and it locks: nobody gets through.",
        alt: "A person walks towards the turnstile from the other side; it is locked." },
      { kind: "circuit", art: "nb:polarity", say: "An LED is a one-way door for current. Current goes in at its + leg (the longer leg) and out at its − leg (the shorter leg).",
        alt: "The LED symbol: current goes from its + leg to its − leg, not the other way." },
      { kind: "circuit", art: "ledBackwards", say: "The wrong way round, the LED blocks the loop like an open switch: almost no current flows, so it stays dark. Turn it round, it lights.",
        alt: "A loop with the LED the wrong way round; it is dark." },
    ] },
    { id: "resistor", slides: [
      { kind: "life", art: "wheelFast", say: "A strong pump drives water round, through a small water wheel. With nothing to hold the water back, it rushes and breaks the wheel.",
        alt: "A pump drives water fast round a ring; the small water wheel in it breaks." },
      { kind: "life", art: "narrowPipe", say: "Put a narrow bit of pipe in the ring. It holds the water back, so less flows, all the way round. The wheel turns gently.",
        alt: "The same ring with a narrow section; the water flows gently and the wheel turns." },
      { kind: "circuit", art: "nb:resistor", say: "A resistor is that narrow pipe. In the loop with the LED, it holds the current back, so just enough flows to light the LED.",
        alt: "A loop with a resistor and an LED; the LED glows." },
      { kind: "circuit", art: "ledBurn", say: "Once it lights, an LED hardly holds the current back. Without a resistor, far too much flows: it gets hot and burns out.",
        alt: "A loop with only an LED; far too much current, and the LED burns out." },
    ] },
    { id: "short", slides: [
      { kind: "life", art: "shortcutPipe", say: "Back to the pump. Add a wide pipe from its outlet straight back to its inlet: the water rushes through there, as much as it can.",
        alt: "A wide shortcut pipe right by the pump; the water rushes through it and the wheel stands still." },
      { kind: "life", art: "shortcutWeak", say: "The pump can't keep up: its push falls to almost nothing. So almost no water goes the long way, and the wheel stops.",
        alt: "The same picture: the pump's push is gone, and the long way round stands still." },
      { kind: "circuit", art: "nb:short", say: "A wire straight from + to − is a short circuit: only wire, almost no resistance. A huge current flows, and wires get hot.",
        alt: "A wire straight from the battery's + to its −, with a huge current." },
      { kind: "circuit", art: "shortDark", say: "The battery can't keep up either: the voltage between + and − falls close to 0 V, too little to light anything. Take the wire out!",
        alt: "A loop with a short wire next to the battery; the LED is dark and the battery is hot." },
    ] },
  ];
  const byId = new Map(LIST.map((l) => [l.id, l]));
  const get = (id) => byId.get(id) || null;
  const has = (id) => byId.has(id);
  // The idea a level's lecture is about, and the ideas to pick from (the level's own first, then the ones it uses).
  const topic = (lv) => (lv.teaches || []).find(has) || null;
  const choices = (lv) => [...new Set([...(lv.teaches || []), ...(lv.uses || [])])].filter(has);
  BB.Lectures = { LIST, get, has, topic, choices, PICK: "Which idea shall we go over again? Pick one." };
})(window.BB = window.BB || {});
